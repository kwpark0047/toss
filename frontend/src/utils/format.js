// 금액 정보를 형식화 (통화 기호 또는 단위 선택 가능)
export const formatPrice = (price, useSuffix = false) => {
  if (price === undefined || price === null || isNaN(price)) return useSuffix ? '0원' : '₩0';
  const formatted = Number(price).toLocaleString('ko-KR');
  return useSuffix ? `${formatted}원` : `₩${formatted}`;
};

// Format date with custom format
export const formatDate = (dateString, format = 'yyyy-MM-dd') => {
  if (!dateString) return '';

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';

  const pad = (num) => num.toString().padStart(2, '0');

  return format
    .replace('yyyy', date.getFullYear())
    .replace('MM', pad(date.getMonth() + 1))
    .replace('dd', pad(date.getDate()))
    .replace('HH', pad(date.getHours()))
    .replace('mm', pad(date.getMinutes()))
    .replace('ss', pad(date.getSeconds()));
};

// Truncate text with ellipsis if it exceeds maxLength
export const truncate = (str, maxLength = 100) => {
  if (!str) return '';
  return str.length > maxLength ? `${str.substring(0, maxLength)}...` : str;
};
