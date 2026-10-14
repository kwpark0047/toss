import api from './client';
const root = '/business-support';
const store = (id) => `${root}/stores/${encodeURIComponent(id)}`;
const entry = (sid, id) => `${store(sid)}/cases/${encodeURIComponent(id)}`;
export const businessSupportAPI = {
  overview: () => api.get(`${root}/overview`),
  list: (sid, cursor) =>
    api.get(`${sid ? store(sid) : root}/cases`, { params: { cursor: cursor || '0:0' } }),
  enrollment: (sid) => api.get(`${store(sid)}/enrollment`),
  enroll: (sid, enabled) => api.put(`${store(sid)}/enrollment`, { enabled }),
  rescan: (sid) => api.post(`${store(sid)}/rescan`),
  detail: (sid, id) => api.get(entry(sid, id)),
  transition: (sid, id, event, operation_id, note) =>
    api.post(`${entry(sid, id)}/${event}`, { operation_id, note }),
  evaluate: (sid, id) => api.post(`${entry(sid, id)}/evaluate`),
};
