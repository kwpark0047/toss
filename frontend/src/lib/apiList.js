// The API client returns the server envelope, not an Axios response.
export function readApiList(response) {
  if (response == null) return [];
  let value = response;
  for (let depth = 0; depth < 3; depth += 1) {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== 'object') break;
    if (Array.isArray(value.items)) return value.items;
    value = value.data;
  }
  throw new Error('목록 데이터 형식이 올바르지 않습니다. 다시 조회해 주세요.');
}
