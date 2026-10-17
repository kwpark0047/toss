import api from './client';
import { wakeupServer } from './wakeup';
const unwrap = (response) => response?.data || response;
async function post(path, data) {
  await wakeupServer();
  return unwrap(await api.post(`/auth/free/${path}`, data));
}
export function getBrowserProof(create = true) {
  const key = 'wemarket_auth_browser_proof';
  const old = localStorage.getItem(key);
  if (/^[a-f0-9]{64}$/.test(old || '')) return old;
  if (!create) return null;
  const proof = Array.from(crypto.getRandomValues(new Uint8Array(32)), (x) =>
    x.toString(16).padStart(2, '0')
  ).join('');
  localStorage.setItem(key, proof);
  return proof;
}
export const freeAuthAPI = {
  config: async () => unwrap(await api.get('/auth/free/config')),
  simpleSignup: (data) => post('signup/simple', data),
  requestEmail: (data) => post('email/request', { ...data, browserProof: getBrowserProof() }),
  verifyEmail: (data) => post('email/verify', { ...data, browserProof: getBrowserProof(false) }),
  startOAuth: (data) =>
    post(`oauth/${data.provider}/start`, { ...data, browserProof: getBrowserProof() }),
  exchange: (flowId) => post('oauth/exchange', { flowId, browserProof: getBrowserProof(false) }),
  mfa: (data) => post('mfa', { ...data, browserProof: getBrowserProof(false) }),
  accounts: async () => unwrap(await api.get('/auth/free/accounts')),
  reauth: (method, value) =>
    post(`reauth/${method}`, method === 'password' ? { password: value } : { code: value }),
  unlink: (provider, reauthProof) => post('accounts/unlink', { provider, reauthProof }),
  withdraw: (reauthProof, operationId) => post('withdraw', { reauthProof, operationId }),
};

