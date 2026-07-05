/**
 * API barrel — re-exports all domain modules.
 * New code should import from specific domain modules for better tree-shaking:
 *   import { storesAPI } from '@/api/stores';
 *   import { authAPI } from '@/api/auth';
 */
export { default as api, API_URL } from './client';
export { default } from './client';
export { wakeupServer } from './wakeup';

export { authAPI } from './auth';
export { customersAPI } from './customers';
export { storesAPI, storeAccountAPI, businessAPI } from './stores';
export { categoriesAPI, productsAPI, optionTemplatesAPI } from './products';
export { ordersAPI, paymentsAPI } from './orders';
export { staffAPI } from './staff';
export { adminAPI, planRequestsAPI, staffRequestsAPI, bulkSmsAPI, exportAPI } from './admin';
export { boardAPI, communityAPI, chatAPI } from './board';
export { reviewsAPI } from './reviews';
export { notificationsAPI } from './notifications';
export { inventoryAPI } from './inventory';
export { pointsAPI, analyticsAPI, uploadsAPI, waitingAPI, reservationsAPI, tablesAPI, cartAPI, legalAPI, aiAPI, getSocket } from './misc';
