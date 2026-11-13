const normalizeOptionText = (value) =>
  String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('ko-KR')
    .replace(/[\s\p{P}\p{S}]/gu, '');

const parseOptionGroups = (value) => {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value || '[]') : value;
    return Array.isArray(parsed)
      ? parsed.filter((group) => group && typeof group === 'object')
      : [];
  } catch {
    return [];
  }
};

const getChoices = (group, groupIndex = 0) => {
  const source = Array.isArray(group?.choices)
    ? group.choices
    : Array.isArray(group?.items)
      ? group.items
      : (Array.isArray(group?.values) ? group.values : []).map((name, index) => ({
          id: `choice-${index + 1}`,
          name,
          price_adjustment: group?.prices?.[index] || 0,
        }));
  return source
    .filter((choice) => choice && choice.is_active !== false && choice.isActive !== false)
    .map((choice, index) => ({
      id: String(choice.id ?? `choice-${groupIndex + 1}-${index + 1}`),
      name: String(typeof choice === 'string' ? choice : choice.name || '').trim(),
      priceAdjustment: Number(choice.price_adjustment ?? choice.price ?? 0) || 0,
    }))
    .filter((choice) => choice.name);
};

const resolveVoiceDraft = (parsed, catalog, transcript) => {
  if (!Array.isArray(parsed?.items) || parsed.items.length === 0) {
    return {
      success: false,
      error: '메뉴를 찾지 못했어요. 메뉴 이름을 포함해 다시 말씀해 주세요.',
    };
  }
  if (parsed.items.length > 12) {
    return {
      success: false,
      error: '한 번에 담을 수 있는 메뉴는 12종까지예요. 나누어 말씀해 주세요.',
    };
  }

  const items = [];
  const clarifications = [];
  for (const parsedItem of parsed.items) {
    const product = catalog.find((item) => Number(item.id) === Number(parsedItem.product_id));
    const quantity = Number(parsedItem.quantity);
    if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      clarifications.push('메뉴 또는 수량을 정확히 확인하지 못했어요. 다시 말씀해 주세요.');
      continue;
    }

    const groups = parseOptionGroups(product.options).map((group, index) => {
      const choices = getChoices(group, index);
      const isMultiple =
        group.type === 'checkbox' || Number(group.max_choices ?? group.maxSelect) > 1;
      return {
        id: String(group.id ?? `group-${index + 1}`),
        name: String(group.name || `옵션 ${index + 1}`),
        required: Boolean(group.is_required ?? group.required),
        minChoices: Math.max(
          0,
          Number(group.min_choices ?? (group.is_required || group.required ? 1 : 0)) || 0
        ),
        maxChoices: Math.max(
          1,
          Number(group.max_choices ?? group.maxSelect) || (isMultiple ? choices.length : 1)
        ),
        choices,
      };
    });
    const requestedOptions = Array.isArray(parsedItem.options) ? parsedItem.options : [];
    const selectedOptions = [];
    const selectedByGroup = new Map();

    for (const requested of requestedOptions) {
      const query = normalizeOptionText(
        typeof requested === 'string' ? requested : requested?.name
      );
      if (!query) continue;
      const matches = groups.flatMap((group) =>
        group.choices
          .filter((choice) => {
            const choiceName = normalizeOptionText(choice.name);
            return choiceName === query || (query.length >= 2 && query.includes(choiceName));
          })
          .map((choice) => ({ group, choice }))
      );
      if (matches.length !== 1) {
        clarifications.push(
          matches.length
            ? `${product.name}의 옵션을 구분하지 못했어요.`
            : `${product.name}에서 “${String(requested).slice(0, 40)}” 옵션을 찾지 못했어요.`
        );
        continue;
      }
      const { group, choice } = matches[0];
      const groupSelections = selectedByGroup.get(group.id) || [];
      if (groupSelections.some((selected) => selected.choiceId === choice.id)) continue;
      if (groupSelections.length >= group.maxChoices) {
        clarifications.push(
          `${product.name}의 ${group.name}은(는) 최대 ${group.maxChoices}개까지 선택할 수 있어요.`
        );
        continue;
      }
      groupSelections.push({ group, choice });
      selectedByGroup.set(group.id, groupSelections);
      selectedOptions.push({
        groupId: group.id,
        groupName: group.name,
        choiceId: choice.id,
        choiceName: choice.name,
        priceAdjustment: choice.priceAdjustment,
      });
    }

    for (const group of groups) {
      const count = (selectedByGroup.get(group.id) || []).length;
      if (count < group.minChoices)
        clarifications.push(`${product.name}의 필수 옵션 “${group.name}”을(를) 말씀해 주세요.`);
    }

    const unitPrice =
      Number(product.price) +
      selectedOptions.reduce((sum, option) => sum + option.priceAdjustment, 0);
    items.push({
      product_id: product.id,
      name: product.name,
      quantity,
      selected_options: selectedOptions,
      base_price: Number(product.price),
      unit_price: unitPrice,
      line_total: unitPrice * quantity,
    });
  }

  const uniqueClarifications = [...new Set(clarifications)];
  if (!items.length)
    return { success: false, error: uniqueClarifications[0] || '주문 내용을 다시 확인해 주세요.' };
  return {
    success: true,
    transcript,
    items,
    total: items.reduce((sum, item) => sum + item.line_total, 0),
    needs_clarification: uniqueClarifications.length > 0,
    clarifications: uniqueClarifications,
  };
};

module.exports = { resolveVoiceDraft, parseOptionGroups, getChoices };
