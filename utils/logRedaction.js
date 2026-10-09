const sensitive =
  /password|secret|token|authorization|cookie|payment[_-]?key|customer[_-]?key|phone|email|api[_-]?key/i;
function text(value) {
  return String(value)
    .replace(/\b01[016789][ -]?\d{3,4}[ -]?\d{4}\b/g, '[REDACTED_PHONE]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED_TOKEN]')
    .replace(
      /\b(password|secret|token|authorization|paymentKey|customerKey|api[_-]?key)\s*[=:]\s*[^\s,;&]+/gi,
      '$1=[REDACTED]'
    )
    .replace(/([?&](?:key|token|secret|api_key)=)[^&\s]+/gi, '$1[REDACTED]');
}
function redact(value, seen = new WeakSet()) {
  if (typeof value === 'string') return text(value);
  if (!value || typeof value !== 'object') return typeof value === 'bigint' ? String(value) : value;
  if (value instanceof Date) return value.toISOString();
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  if (value instanceof Error)
    return { message: text(value.message), stack: text(value.stack || ''), name: value.name };
  if (Array.isArray(value)) return value.map((v) => redact(v, seen));
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, sensitive.test(k) ? '[REDACTED]' : redact(v, seen)])
  );
}
module.exports = { redact, text };
