import api from './client';

export const aiOrderAPI = {
  parsePublic: (storeId, transcript) =>
    api.post('/ai-order/public/parse', { store_id: Number(storeId), transcript }),
};
