const { AppError } = require('./errorHandler');

function parseProductOptions(options) {
  if (!options) return [];
  try {
    const parsed = typeof options === 'string' ? JSON.parse(options) : options;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((group, groupIndex) => {
      const rawChoices = Array.isArray(group?.choices)
        ? group.choices
        : Array.isArray(group?.items)
          ? group.items
          : (Array.isArray(group?.values) ? group.values : []).map((name, choiceIndex) => ({
              id: `choice-${groupIndex + 1}-${choiceIndex + 1}`,
              name,
              price_adjustment: group?.prices?.[choiceIndex] || 0,
            }));
      const type =
        group?.type === 'checkbox' || Number(group?.max_choices ?? group?.maxSelect) > 1
          ? 'checkbox'
          : 'radio';
      const required = Boolean(group?.is_required ?? group?.required);
      return {
        ...group,
        id: group?.id ?? `group-${groupIndex + 1}`,
        name: String(group?.name || ''),
        is_required: required,
        min_choices: required
          ? Math.max(1, Number(group?.min_choices ?? group?.minSelect) || 0)
          : Math.max(0, Number(group?.min_choices ?? group?.minSelect) || 0),
        max_choices: Math.max(
          1,
          Number(group?.max_choices ?? group?.maxSelect) ||
            (type === 'radio' ? 1 : rawChoices.length || 1)
        ),
        choices: rawChoices.map((choice, choiceIndex) =>
          typeof choice === 'string'
            ? {
                id: `choice-${groupIndex + 1}-${choiceIndex + 1}`,
                name: choice,
                price_adjustment: 0,
              }
            : {
                ...choice,
                id: choice?.id ?? `choice-${groupIndex + 1}-${choiceIndex + 1}`,
                name: String(choice?.name || ''),
                price_adjustment: Number(choice?.price_adjustment ?? choice?.price ?? 0),
                is_active: choice?.is_active !== false && choice?.isActive !== false,
              }
        ),
      };
    });
  } catch {
    return [];
  }
}

function sameIdentifier(left, right) {
  return (
    left !== undefined &&
    left !== null &&
    right !== undefined &&
    right !== null &&
    String(left) === String(right)
  );
}

function priceOrderItem(product, item, storeId) {
  const quantity = Number(item?.quantity);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new AppError('상품 수량이 올바르지 않습니다.', 400);
  }
  if (!product || Number(product.store_id) !== Number(storeId)) {
    throw new AppError(
      `상품 정보를 찾을 수 없습니다: ${item?.product_name || item?.product_id}`,
      400
    );
  }
  if (product.is_sold_out) {
    throw new AppError(`품절된 상품이 포함되어 있습니다: ${product.name}`, 409);
  }
  if (!product.is_active) {
    throw new AppError(`판매 중단된 상품입니다: ${product.name}`, 400);
  }

  const optionGroups = parseProductOptions(product.options);
  const requestedOptions = Array.isArray(item.options) ? item.options : [];
  const canonicalOptions = [];
  const selectedGroupIds = new Set();
  const selectedChoiceIds = new Set();
  const groupChoiceCounts = new Map();
  let optionAmount = 0;

  for (const requested of requestedOptions) {
    const group = optionGroups.find(
      (candidate) =>
        sameIdentifier(candidate.id, requested.groupId) || candidate.name === requested.groupName
    );
    if (!group) {
      throw new AppError(`상품 옵션이 올바르지 않습니다: ${product.name}`, 409);
    }

    const groupKey = String(group.id ?? group.name);
    const choiceCount = groupChoiceCounts.get(groupKey) || 0;
    const maxChoices = Math.max(1, Number(group.max_choices) || 1);
    if (choiceCount >= maxChoices) {
      throw new AppError(`상품 옵션이 올바르지 않습니다: ${product.name}`, 409);
    }

    const choices = Array.isArray(group.choices) ? group.choices : [];
    const choice = choices.find((candidate) => {
      if (typeof candidate === 'string') return candidate === requested.choiceName;
      return (
        sameIdentifier(candidate.id, requested.choiceId) || candidate.name === requested.choiceName
      );
    });
    if (!choice) throw new AppError(`상품 옵션이 올바르지 않습니다: ${product.name}`, 409);

    const choiceData = typeof choice === 'string' ? { name: choice, price_adjustment: 0 } : choice;
    if (choiceData.is_active === false || choiceData.isActive === false) {
      throw new AppError(`선택할 수 없는 상품 옵션입니다: ${product.name}`, 409);
    }
    const choiceKey = `${groupKey}:${choiceData.id ?? choiceData.name}`;
    if (selectedChoiceIds.has(choiceKey)) {
      throw new AppError(`상품 옵션이 올바르지 않습니다: ${product.name}`, 409);
    }
    const adjustment = Number(choiceData.price_adjustment || 0);
    if (!Number.isInteger(adjustment)) {
      throw new AppError(`상품 옵션 가격이 올바르지 않습니다: ${product.name}`, 500);
    }

    selectedGroupIds.add(groupKey);
    selectedChoiceIds.add(choiceKey);
    groupChoiceCounts.set(groupKey, choiceCount + 1);
    optionAmount += adjustment;
    canonicalOptions.push({
      groupId: group.id,
      groupName: group.name,
      choiceId: choiceData.id,
      choiceName: choiceData.name,
      priceAdjustment: adjustment,
    });
  }

  for (const group of optionGroups) {
    const groupKey = String(group.id ?? group.name);
    const selectedCount = groupChoiceCounts.get(groupKey) || 0;
    const minChoices = Math.max(0, Number(group.min_choices ?? (group.is_required ? 1 : 0)) || 0);
    if (selectedCount < minChoices) {
      throw new AppError(`${group.name} 옵션을 최소 ${minChoices}개 선택해 주세요.`, 409);
    }
  }

  const unitPrice = Number(product.price) + optionAmount;
  if (!Number.isInteger(unitPrice) || unitPrice < 0) {
    throw new AppError(`상품 가격이 올바르지 않습니다: ${product.name}`, 500);
  }

  return {
    product_id: product.id,
    product_name: product.name,
    quantity,
    price: unitPrice,
    subtotal: unitPrice * quantity,
    options: canonicalOptions,
    user_phone: item.user_phone,
  };
}

function assertClientTotal(clientTotal, serverTotal) {
  if (Number(clientTotal) !== serverTotal) {
    throw new AppError('상품 가격이 변경되었습니다. 메뉴를 새로고침한 후 다시 주문해 주세요.', 409);
  }
}

module.exports = { priceOrderItem, assertClientTotal };
