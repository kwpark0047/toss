const STORAGE_KEY = 'RECENTLY_VIEWED_STORES';
const MAX_ITEMS = 8;

export function getRecentStores() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addRecentStore(store) {
  if (!store || !store.id) return;
  try {
    const list = getRecentStores().filter(s => s.id !== store.id);
    list.unshift({
      id: store.id,
      name: store.name || store.store_name || '매장',
      business_type: store.business_type || '',
      address: store.address || '',
      visited_at: new Date().toISOString(),
    });
    if (list.length > MAX_ITEMS) list.length = MAX_ITEMS;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch { /* localStorage unavailable */ }
}
