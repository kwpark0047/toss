import api from './client';

export const categoriesAPI = {
  getAll: () => api.get('/categories/store/1'),
  getByStore: (storeId) => api.get('/categories/store/' + storeId),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.put('/categories/' + id, data),
  delete: (id) => api.delete('/categories/' + id),
  updateSort: (orders) => api.put('/categories/sort', { orders }),
};

export const productsAPI = {
  getAll: () => api.get('/products/store/1'),
  getByStore: (storeId, categoryId) => {
    let url = '/products/store/' + storeId;
    if (categoryId) url += '?category_id=' + categoryId;
    return api.get(url);
  },
  getById: (id) => api.get('/products/' + id),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put('/products/' + id, data),
  delete: (id) => api.delete('/products/' + id),
  bulkCreate: (data) => api.post('/products/bulk', data),
  importFromStore: (targetId, sourceId) => api.post('/products/import', { target_store_id: targetId, source_store_id: sourceId }),
};

export const optionTemplatesAPI = {
  getByStore: (storeId) => api.get(`/option-templates/store/${storeId}`),
  create: (data) => api.post('/option-templates', data),
  update: (id, data) => api.put(`/option-templates/${id}`, data),
  delete: (id) => api.delete(`/option-templates/${id}`),
};
