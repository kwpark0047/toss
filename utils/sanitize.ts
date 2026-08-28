const SENSITIVE_FIELDS = [
  'card',
  'secret',
  'customerKey',
  'customer_key',
  'cardPassword',
  'credential',
];

export const sanitizeRawResponse = (data: any): any => {
  if (!data) return data;
  const cleaned = JSON.parse(JSON.stringify(data));
  const removeSensitive = (obj: any): void => {
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

export default { sanitizeRawResponse };