// Reads and session revocation are safe to repeat; orders/payments are not.
export function shouldWakeAndRetry(error) {
  const config = error?.config;
  if (!config || config._coldRetry || config.signal?.aborted || error.code === 'ERR_CANCELED')
    return false;
  const method = String(config.method || 'get').toLowerCase();
  const logout = method === 'post' && /^\/auth\/logout\/?$/.test(config.url || '');
  if (!['get', 'head'].includes(method) && !logout) return false;
  if (!error.response) return true;
  if (error.response.status === 502 || error.response.status === 504) return true;
  // JSON 503 is an application/provider availability response, not a sleeping host.
  return (
    error.response.status === 503 &&
    typeof error.response.data === 'string' &&
    /<html|<!doctype/i.test(error.response.data)
  );
}
