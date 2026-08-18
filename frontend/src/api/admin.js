import api from './client';

export const adminAPI = {
  getSettlements: (storeId) => api.get(`/admin/stores/${storeId}/settlements`),
  getSettlement: (storeId, id) => api.get(`/admin/stores/${storeId}/settlements/${id}`),
  generateSettlement: (storeId, data) =>
    api.post(`/admin/stores/${storeId}/settlements/generate`, data),
  updateSettlementStatus: (storeId, id, status) =>
    api.patch(`/admin/stores/${storeId}/settlements/${id}/status`, { status }),
  issueTaxInvoice: (storeId, id) =>
    api.post(`/admin/stores/${storeId}/settlements/${id}/tax-invoice`),
  getReceiptSettings: (storeId) => api.get(`/admin/stores/${storeId}/receipt-settings`),
  updateReceiptSettings: (storeId, data) =>
    api.put(`/admin/stores/${storeId}/receipt-settings`, data),
  // 매장 정보 보강 (네이버 지역검색 API) — super_admin 전용, 커서 기반 배치
  enrichStores: ({ limit = 10, afterId = 0 } = {}) =>
    api.post('/admin/enrich-stores', { limit, afterId }),
  // 보강 공급자 설정 상태 (미설정 공급자 비활성화 UI)
  enrichmentStatus: () => api.get('/admin/enrichment-status'),
  // 서울 열린데이터(일반음식점 LOCALDATA) 보강 — 커서(start) 기반 배치
  enrichSeoul: ({ start = 1, size = 300, dryRun = false } = {}) =>
    api.post('/admin/enrich-seoul', { start, size, dryRun }),
  // 주소 → 좌표 지오코딩 (좌표 없는 매장) — 커서(afterId) 기반 배치
  geocodeStores: ({ limit = 20, afterId = 0, dryRun = false } = {}) =>
    api.post('/admin/geocode-stores', { limit, afterId, dryRun }),
  // 슈퍼관리자 플랫폼 대시보드
  platformOverview: () => api.get('/admin/platform/overview'),
  platformStores: (params = {}) => api.get('/admin/platform/stores', { params }),
  platformTrend: (days = 14) => api.get('/admin/platform/trend', { params: { days } }),
  storeDetail: (id, days = 14) =>
    api.get(`/admin/platform/stores/${id}/detail`, { params: { days } }),
  toggleStoreActive: (id, is_active) =>
    api.patch(`/admin/platform/stores/${id}/active`, { is_active }),
  grantPoints: (id, data) => api.post(`/admin/platform/stores/${id}/points`, data),
  // 매장 정보 보강 (AI + 커버리지) — super_admin 전용
  enrichmentCoverage: () => api.get('/admin/platform/enrichment/coverage'),
  storeCompletion: (id) => api.get(`/admin/platform/stores/${id}/completion`),
  runStoreEnhance: (id, { autoSave = false } = {}) =>
    api.post(`/admin/platform/stores/${id}/enhance`, null, { params: { autoSave } }),
  applyStoreEnhance: (id, enhancements) =>
    api.post(`/admin/platform/stores/${id}/enhance/apply`, { enhancements }),
  // 매장 연동 승인 요청 (사업자 ↔ 공공매장)
  linkRequests: (status = 'pending') =>
    api.get('/admin/store-link-requests', { params: { status } }),
  approveLinkRequest: (id) => api.post(`/admin/store-link-requests/${id}/approve`),
  rejectLinkRequest: (id) => api.post(`/admin/store-link-requests/${id}/reject`),
};

export const planRequestsAPI = {
  create: (data) => api.post('/plan-requests', data),
  getByStore: (storeId) => api.get(`/plan-requests/store/${storeId}`),
  getAll: (status = null) => api.get(`/plan-requests${status ? `?status=${status}` : ''}`),
  getPendingCount: () => api.get('/plan-requests/pending-count'),
  approve: (id, adminNote = '') =>
    api.post(`/plan-requests/${id}/approve`, { admin_note: adminNote }),
  reject: (id, adminNote = '') =>
    api.post(`/plan-requests/${id}/reject`, { admin_note: adminNote }),
};

export const plansAPI = {
  getAll: () => api.get('/admin/plans'),
  getActive: () => api.get('/plans'),
  getById: (id) => api.get(`/admin/plans/${id}`),
  create: (data) => api.post('/admin/plans', data),
  update: (id, data) => api.patch(`/admin/plans/${id}`, data),
  deactivate: (id) => api.patch(`/admin/plans/${id}/deactivate`),
  reorder: (plans) => api.post('/admin/plans/reorder', { plans }),
  getStats: () => api.get('/admin/plans/stats/subscriptions'),
};

export const tierSettingsAPI = {
  getTiers: (storeId) => api.get(`/admin/stores/${storeId}/tier-settings`),
  upsertTier: (storeId, data) => api.post(`/admin/stores/${storeId}/tier-settings`, data),
  deleteTier: (storeId, tierName) =>
    api.delete(`/admin/stores/${storeId}/tier-settings/${encodeURIComponent(tierName)}`),
};

export const staffRequestsAPI = {
  create: (data) => api.post('/staff-requests', data),
  getByStore: (storeId) => api.get(`/staff-requests/store/${storeId}`),
  getAll: (status = null) => api.get(`/staff-requests${status ? `?status=${status}` : ''}`),
  getPendingCount: () => api.get('/staff-requests/pending-count'),
  approve: (id, adminNote = '') =>
    api.post(`/staff-requests/${id}/approve`, { admin_note: adminNote }),
  reject: (id, adminNote = '') =>
    api.post(`/staff-requests/${id}/reject`, { admin_note: adminNote }),
};

export const bulkSmsAPI = {
  getFilterOptions: () => api.get('/admin/bulk-sms/filter-options'),
  getFilteredCustomers: (params) => api.get('/admin/bulk-sms/customers', { params }),
  sendBulkSms: (data) => api.post('/admin/bulk-sms/send', data),
};

export const dynamicPricingAPI = {
  // 가격 규칙 CRUD
  getRules: (storeId, params = {}) => api.get(`/admin/stores/${storeId}/pricing/rules`, { params }),
  createRule: (storeId, data) => api.post(`/admin/stores/${storeId}/pricing/rules`, data),
  updateRule: (storeId, ruleId, data) =>
    api.patch(`/admin/stores/${storeId}/pricing/rules/${ruleId}`, data),
  deleteRule: (storeId, ruleId) => api.delete(`/admin/stores/${storeId}/pricing/rules/${ruleId}`),

  // 가격 변경 이력
  getPriceLogs: (storeId, params = {}) =>
    api.get(`/admin/stores/${storeId}/pricing/logs`, { params }),

  // 수동 가격 변경
  applyManualPrice: (storeId, data) => api.post(`/admin/stores/${storeId}/pricing/manual`, data),

  // 최적화 작업
  runOptimization: (storeId, data) => api.post(`/admin/stores/${storeId}/pricing/optimize`, data),
  getJobs: (storeId, params = {}) => api.get(`/admin/stores/${storeId}/pricing/jobs`, { params }),

  // 경쟁사 가격
  upsertCompetitor: (storeId, data) =>
    api.post(`/admin/stores/${storeId}/pricing/competitors`, data),
  getCompetitors: (storeId, params = {}) =>
    api.get(`/admin/stores/${storeId}/pricing/competitors`, { params }),

  // 수요 예측
  getForecasts: (storeId, params = {}) =>
    api.get(`/admin/stores/${storeId}/pricing/forecasts`, { params }),
};

export const campaignAPI = {
  // 캠페인 CRUD
  getList: (storeId, params = {}) => api.get(`/coupons/stores/${storeId}/campaigns`, { params }),
  create: (storeId, data) => api.post(`/coupons/stores/${storeId}/campaigns`, data),
  update: (storeId, campaignId, data) =>
    api.post(`/coupons/stores/${storeId}/campaigns`, { ...data, id: campaignId }),
  delete: (storeId, campaignId) => api.delete(`/coupons/stores/${storeId}/campaigns/${campaignId}`),
  toggle: (storeId, campaignId, data) =>
    api.post(`/coupons/stores/${storeId}/campaigns`, { ...data, id: campaignId }),

  // 쿠폰
  getCoupons: (storeId, params = {}) => api.get(`/coupons/stores/${storeId}/coupons`, { params }),

  // CRM 분석
  getAnalysis: (storeId, params = {}) => api.get(`/crm/store/${storeId}/analysis`, { params }),
  sendSmartSms: (storeId, data) => api.post(`/crm/store/${storeId}/send-smart-sms`, data),
  getAutomationRuns: (storeId, status = 'pending') =>
    api.get(`/crm/store/${storeId}/automation-campaigns`, { params: { status } }),
  generateAutomation: (storeId, data) =>
    api.post(`/crm/store/${storeId}/automation-campaigns/generate`, data),
  decideAutomation: (storeId, id, status) =>
    api.post(`/crm/store/${storeId}/automation-campaigns/${id}/decide`, { status }),
  sendAutomation: (storeId, id) =>
    api.post(`/crm/store/${storeId}/automation-campaigns/${id}/send`),
};

export const grantTemplateAPI = {
  getGrantTemplates: (storeId) => api.get(`/admin/stores/${storeId}/grant-templates`),
  createGrantTemplate: (data) =>
    api.post(`/admin/stores/${storeIdFromData(data)}/grant-templates`, data),
  updateGrantTemplate: (id, data) => api.patch(`/admin/grant-templates/${id}`, data),
  deleteGrantTemplate: (id) => api.delete(`/admin/grant-templates/${id}`),
};

const storeIdFromData = (data) => data.store_id || '';

export const customerSegmentationAPI = {
  // 세그멘트
  getSegments: (storeId, params = {}) => api.get(`/admin/stores/${storeId}/segments`, { params }),
  createSegment: (storeId, data) => api.post(`/admin/stores/${storeId}/segments`, data),
  updateSegment: (storeId, segmentId, data) =>
    api.post(`/admin/stores/${storeId}/segments`, { ...data, id: segmentId }),
  deleteSegment: (storeId, segmentId) =>
    api.delete(`/admin/stores/${storeId}/segments/${segmentId}`),

  // 고객 개인화
  getPersonalization: (storeId, customerPhone) =>
    api.get(`/admin/stores/${storeId}/personalization`, { params: { customerPhone } }),
  upsertPersonalization: (storeId, data) =>
    api.put(`/admin/stores/${storeId}/personalization`, data),

  // AI 추천
  getRecommendations: (storeId, params = {}) =>
    api.get(`/admin/stores/${storeId}/recommendations`, { params }),
  createRecommendation: (storeId, data) =>
    api.post(`/admin/stores/${storeId}/recommendations`, data),
  getRecommendationsBySegment: (storeId, segmentId) =>
    api.get(`/admin/stores/${storeId}/segments/${segmentId}/recommendations`),
  getSegmentCustomers: (storeId, segmentId, params = {}) =>
    api.get(`/admin/stores/${storeId}/segments/${segmentId}/customers`, { params }),

  // 분석
  getPersonalizationAnalytics: (storeId, params = {}) =>
    api.get(`/admin/stores/${storeId}/personalization-analytics`, { params }),
};

export const exportAPI = {
  _download: async (url, fileName) => {
    const { API_URL } = await import('./client');
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}${url}`, {
      headers: { Authorization: `Bearer ${token}` },
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
    exportAPI._download(`/export/store/${storeId}/excel/customers`, `단골고객_${storeId}.xlsx`),
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
