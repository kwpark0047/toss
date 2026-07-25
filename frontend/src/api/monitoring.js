import api from './client';

export const monitoringAPI = {
  /** 시스템 통합 메트릭 (플랫폼 + 성능 + 서버) */
  getSystemStats: () => api.get('/monitoring/stats'),

  /** 에러 요약 (지정 시간 내 에러 집계) */
  getErrorSummary: (hours = 24) => api.get('/monitoring/errors', { params: { hours } }),
};

export default monitoringAPI;
