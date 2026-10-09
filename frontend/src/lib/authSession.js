// Shared by initial authentication and API 401 recovery within this tab.
const inFlight = new Map();
export function refreshSession(apiUrl, useCookie) {
  const key = `${apiUrl}:${useCookie}`;
  if (inFlight.has(key)) return inFlight.get(key);
  const request = (async () => {
    const refreshToken = useCookie ? null : localStorage.getItem('refreshToken');
    if (!useCookie && !refreshToken)
      throw Object.assign(new Error('로그인이 필요합니다.'), { status: 401 });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (useCookie) {
        const proofResponse = await fetch(`${apiUrl}/auth/csrf-token`, {
          method: 'GET',
          credentials: 'include',
          signal: controller.signal,
        });
        if (!proofResponse.ok) throw new Error('CSRF 토큰을 확인할 수 없습니다.');
        const proof = await proofResponse.json();
        const token = proof?.data?.csrfToken;
        if (typeof token !== 'string' || !token) throw new Error('CSRF 토큰을 확인할 수 없습니다.');
        headers['X-CSRF-Token'] = token;
      }
      const response = await fetch(`${apiUrl}/auth/refresh-token`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify(useCookie ? {} : { refreshToken }),
        signal: controller.signal,
      });
      if (!response.ok)
        throw Object.assign(new Error('로그인 갱신에 실패했습니다.'), { status: response.status });
      const json = await response.json();
      const data = json?.data || json;
      if (!useCookie && !data?.token) throw new Error('로그인 갱신 응답이 올바르지 않습니다.');
      if (!useCookie) {
        if (localStorage.getItem('refreshToken') !== refreshToken) {
          throw Object.assign(new Error('로그인 상태가 변경되었습니다.'), { status: 409 });
        }
        localStorage.setItem('token', data.token);
        if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  })().finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
}
