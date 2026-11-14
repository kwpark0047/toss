import { normalizeMenuOptionGroups } from '../menuOptionGroups';

// Display-time guard only. Checkout remains responsible for authoritative revalidation.
export function liveDraftToCart(draft, menuItems) {
  const invalid = () => {
    throw Error('메뉴·가격·옵션이 변경되었거나 확인이 필요합니다. 다시 말씀해 주세요.');
  };
  if (
    !draft?.success ||
    draft.needs_clarification ||
    !Array.isArray(draft.items) ||
    !draft.items.length ||
    draft.items.length > 12
  )
    invalid();
  const lines = draft.items.map((line) => {
    const item = menuItems.find((m) => Number(m.id) === Number(line.product_id));
    if (
      !item ||
      item.isSoldOut ||
      item.is_sold_out ||
      item.is_available === false ||
      item.is_active === false ||
      !Number.isSafeInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > 20 ||
      Number(item.price) !== line.base_price ||
      item.name !== line.name
    )
      invalid();
    const groups = normalizeMenuOptionGroups(item.options),
      selected = line.selected_options;
    if (!Array.isArray(selected)) invalid();
    const counts = new Map(),
      seen = new Set();
    let unitPrice = Number(item.price);
    for (const option of selected) {
      const group = groups.find((g) => g.id === String(option.groupId));
      const choice = group?.choices.find((c) => c.id === String(option.choiceId));
      const key = JSON.stringify([option.groupId, option.choiceId]);
      if (
        !choice ||
        !choice.is_active ||
        seen.has(key) ||
        choice.name !== option.choiceName ||
        choice.price_adjustment !== option.priceAdjustment
      )
        invalid();
      seen.add(key);
      counts.set(group.id, (counts.get(group.id) || 0) + 1);
      unitPrice += choice.price_adjustment;
    }
    for (const group of groups) {
      const count = counts.get(group.id) || 0;
      if (count < group.min_choices || count > group.max_choices) invalid();
    }
    if (
      !Number.isSafeInteger(unitPrice) ||
      unitPrice < 0 ||
      unitPrice !== line.unit_price ||
      unitPrice * line.quantity !== line.line_total
    )
      invalid();
    return { item, quantity: line.quantity, selectedOptions: selected, unitPrice };
  });
  if (lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0) !== draft.total)
    invalid();
  return lines;
}
