export const getPhoneDigits = (value = '') => String(value).replace(/\D/g, '').slice(0, 11);

export const formatCustomerPhone = (value = '') => {
  const digits = getPhoneDigits(value);
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
};

export const isValidCustomerMobilePhone = (value = '') =>
  /^01[016789]\d{7,8}$/.test(String(value).replace(/\D/g, ''));

