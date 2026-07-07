import api from './client';

export const adminAPI = {
  getSettlements: (storeId) => api.get(`/admin/stores/${storeId}/settlements`),
  getSettlement: (storeId, id) => api.get(`/admin/stores/${storeId}/settlements/${id}`),
  generateSettlement: (storeId, data) => api.post(`/admin/stores/${storeId}/settlements/generate`, data),
  updateSettlementStatus: (storeId, id, status) => api.patch(`/admin/stores/${storeId}/settlements/${id}/status`, { status }),
  issueTaxInvoice: (storeId, id) => api.post(`/admin/stores/${storeId}/settlements/${id}/tax-invoice`),
  getReceiptSettings: (storeId) => api.get(`/admin/stores/${storeId}/receipt-settings`),
  updateReceiptSettings: (storeId, data) => api.put(`/admin/stores/${storeId}/receipt-settings`, data),
  // 매장 정보 보강 (네이버 지역검색 API) — super_admin 전용, 커서 기반 배치
  enrichStores: ({ limit = 10, afterId = 0 } = {}) => api.post('/admin/enrich-stores', { limit, afterId }),
  // 슈퍼관리자 플랫폼 대시보드
  platformOverview: () => api.get('/admin/platform/overview'),
  platformStores: ({ page = 1, limit = 20, search = '' } = {}) => api.get('/admin/platform/stores', { params: { page, limit, search } }),
};

export const planRequestsAPI = {
  create: (data) => api.post('/plan-requests', data),
  getByStore: (storeId) => api.get(`/plan-requests/store/${storeId}`),
  getAll: (status = null) => api.get(`/plan-requests${status ? `?status=${status}` : ''}`),
  getPendingCount: () => api.get('/plan-requests/pending-count'),
  approve: (id, adminNote = '') => api.post(`/plan-requests/${id}/approve`, { admin_note: adminNote }),
  reject: (id, adminNote = '') => api.post(`/plan-requests/${id}/reject`, { admin_note: adminNote }),
};

export const staffRequestsAPI = {
  create: (data) => api.post('/staff-requests', data),
  getByStore: (storeId) => api.get(`/staff-requests/store/${storeId}`),
  getAll: (status = null) => api.get(`/staff-requests${status ? `?status=${status}` : ''}`),
  getPendingCount: () => api.get('/staff-requests/pending-count'),
  approve: (id, adminNote = '') => api.post(`/staff-requests/${id}/approve`, { admin_note: adminNote }),
  reject: (id, adminNote = '') => api.post(`/staff-requests/${id}/reject`, { admin_note: adminNote }),
};

export const bulkSmsAPI = {
  getFilterOptions: () => api.get('/admin/bulk-sms/filter-options'),
  getFilteredCustomers: (params) => api.get('/admin/bulk-sms/customers', { params }),
  sendBulkSms: (data) => api.post('/admin/bulk-sms/send', data),
};

export const exportAPI = {
  _download: async (url, fileName) => {
    const { API_URL } = await import('./client');
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}${url}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('파일 생성에 실패했습니다.');
    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
  },
  salesExcel: (storeId, startDate, endDate) =>
    exportAPI._download(
      `/export/store/${storeId}/excel/sales?start_date=${startDate}&end_date=${endDate}`,
      `매출통계_${storeId}_${startDate}_${endDate}.xlsx`
    ),
  ordersExcel: (storeId, startDate, endDate) =>
    exportAPI._download(
      `/export/store/${storeId}/excel/orders?start_date=${startDate}&end_date=${endDate}`,
      `주문내역_${storeId}_${startDate}_${endDate}.xlsx`
    ),
  customersExcel: (storeId) =>
    exportAPI._download(
      `/export/store/${storeId}/excel/customers`,
      `단골고객_${storeId}.xlsx`
    ),
  menuExcel: (storeId, startDate, endDate) =>
    exportAPI._download(
      `/export/store/${storeId}/excel/menu?start_date=${startDate}&end_date=${endDate}`,
      `메뉴분석_${storeId}_${startDate}_${endDate}.xlsx`
    ),
  reportPdf: (storeId, startDate, endDate) =>
    exportAPI._download(
      `/export/store/${storeId}/pdf/report?start_date=${startDate}&end_date=${endDate}`,
      `종합보고서_${storeId}_${startDate}_${endDate}.pdf`
    ),
};
