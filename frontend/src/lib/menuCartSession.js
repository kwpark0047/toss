import { isNewer } from './cartVersions';
const TTL = 30 * 60 * 1000;
export const menuCartKey = (storeId, tableNumber) =>
  `wm-menu-cart-v1:${storeId}:${encodeURIComponent(tableNumber || '')}`;

export function readMenuCart(storeId, tableNumber, storage, now = Date.now()) {
  try {
    storage ||= localStorage;
    const value = JSON.parse(storage.getItem(menuCartKey(storeId, tableNumber)) || 'null');
    if (!value || value.schema !== 1 || !Number.isFinite(value.savedAt) ||
        now - value.savedAt > TTL || !Array.isArray(value.entries) || value.entries.length > 60) return [];
    return value.entries.filter((item) => item && (!item.deleted || now - item.v < TTL) && typeof item.cartItemId === 'string' &&
      Number.isFinite(item.v) && (item.deleted || (item.menuItem &&
        Number(item.quantity) > 0 && Number.isFinite(Number(item.unitPrice)))));
  } catch { return []; }
}

export function writeMenuCart(storeId, tableNumber, entries, storage) {
  try {
    storage ||= localStorage;
    const merged = new Map(readMenuCart(storeId, tableNumber, storage).map((entry) => [entry.cartItemId, entry]));
    for (const entry of entries) if (isNewer(entry, merged.get(entry.cartItemId))) merged.set(entry.cartItemId, entry);
    const live = [...merged.values()].filter((entry) => !entry.deleted);
    if (live.length > 60) return false;
    const removed = [...merged.values()].filter((entry) => entry.deleted && Date.now() - entry.v < TTL)
      .sort((a, b) => b.v - a.v).slice(0, 60 - live.length);
    storage.setItem(menuCartKey(storeId, tableNumber), JSON.stringify({
      schema: 1, savedAt: Date.now(), entries: [...live, ...removed],
    }));
    return true;
  } catch { return false; }
}

export function restoreMenuCart(storeId, tableNumber) {
  return readMenuCart(storeId, tableNumber).filter((item) => !item.deleted)
    .map(({ v: _v, createdAt: _createdAt, deleted: _deleted, ...item }) => item);
}
