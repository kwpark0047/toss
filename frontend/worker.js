const BACKEND_URL = 'https://wemarket-toss.onrender.com';

const API_PREFIX = '/api/';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api' || url.pathname.startsWith(API_PREFIX)) {
      return proxyApi(request, url);
    }

    return env.ASSETS.fetch(request);
  },
};

async function proxyApi(request, url) {
  const targetUrl = new URL(BACKEND_URL);
  targetUrl.pathname = url.pathname;
  targetUrl.search = url.search;

  const headers = new Headers(request.headers);
  headers.set('Host', targetUrl.host);
  headers.delete('cf-connecting-ip');
  headers.delete('cf-ray');
  headers.delete('cf-visitor');
  headers.delete('x-forwarded-proto');
  headers.delete('x-forwarded-for');

  const init = {
    method: request.method,
    headers,
    redirect: 'follow',
  };

  const isBodyAllowed = request.method !== 'GET' && request.method !== 'HEAD' && request.body;
  if (isBodyAllowed) init.body = request.body;

  const upstream = await fetch(new Request(targetUrl.toString(), init), {
    cf: { cacheTtl: 0, cacheEverything: false },
  });

  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete('content-security-policy');
  responseHeaders.delete('x-powered-by');

  const response = new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });

  if (request.method === 'OPTIONS') {
    const cors = new Headers(responseHeaders);
    cors.set('Access-Control-Allow-Origin', '*');
    cors.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    cors.set(
      'Access-Control-Allow-Headers',
      request.headers.get('access-control-request-headers') || 'Content-Type, Authorization'
    );
    cors.set('Access-Control-Max-Age', '86400');
    return new Response(null, { status: 204, headers: cors });
  }

  return response;
}
