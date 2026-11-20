export const itemSig = (item) => JSON.stringify([
  item.menuItem?.id, Number(item.quantity), item.unitPrice, item.selectedOptions || [],
]);
export const isNewer = (a, b) => {
  if (!b) return true;
  if (a.v !== b.v) return a.v > b.v;
  if (Boolean(a.deleted) !== Boolean(b.deleted)) return Boolean(a.deleted);
  return !a.deleted && itemSig(a) > itemSig(b);
};
