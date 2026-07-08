import api from './client';

export const naverPlaceAPI = {
  getStoreInfo: (storeId) => api.get(`/naver-place/store/${storeId}`),
};
