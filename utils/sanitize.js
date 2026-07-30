const SENSITIVE_FIELDS = [
  'card',
  'secret',
  'customerKey',
  'customer_key',
  'cardPassword',
  'credential',
];

const sanitizeRawResponse = (data) => {
  if (!data) return data;
  const cleaned = JSON.parse(JSON.stringify(data));
  const removeSensitive = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
      if (SENSITIVE_FIELDS.some((f) => key.toLowerCase().includes(f.toLowerCase()))) {
        delete obj[key];
      } else if (typeof obj[key] === 'object') {
        removeSensitive(obj[key]);
      }
    }
  };
  removeSensitive(cleaned);
  return cleaned;
};

module.exports = { sanitizeRawResponse };
