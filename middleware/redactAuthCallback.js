module.exports = function redactAuthCallback(req, _res, next) {
  const url = req.url || '';
  if (/^\/api\/auth\/free\/oauth\/(google|kakao)\/callback(?:\?|$)/.test(url)) {
    const parsed = new URL(url, 'http://internal.invalid');
    Object.defineProperty(req, 'freeAuthCallback', {
      value: {
        code: parsed.searchParams.get('code'),
        state: parsed.searchParams.get('state'),
        error: parsed.searchParams.get('error'),
      },
      enumerable: false,
      configurable: true,
    });
    req.url = parsed.pathname;
    req.originalUrl = parsed.pathname;
  }
  next();
};
