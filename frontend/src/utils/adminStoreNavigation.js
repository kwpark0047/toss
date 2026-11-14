const STORE_ADMIN_SECTIONS = new Set([
  'orders',
  'inventory',
  'menu',
  'tables',
  'sales',
  'staff',
  'reviews',
  'settlements',
  'customers',
  'reservations',
  'receipt',
  'analytics',
  'notifications',
  'developer',
  'qr-customizer',
  'partnerships',
]);

export function getStoreAdminPath(storeId, section) {
  if (!storeId || storeId === 'undefined' || !STORE_ADMIN_SECTIONS.has(section)) {
    return storeId ? '/admin' : '/admin/stores/new';
  }

  return `/admin/stores/${encodeURIComponent(storeId)}/${section}`;
}
