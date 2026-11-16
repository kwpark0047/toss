const asLabels = (values) =>
  [
    ...new Set(
      values.map((value) => (typeof value === 'string' ? value.trim() : '')).filter(Boolean)
    ),
  ].slice(0, 12);

export const normalizeAllergens = (value) => {
  if (Array.isArray(value)) return asLabels(value);
  if (typeof value !== 'string' || !value.trim()) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return asLabels(parsed);
    if (Array.isArray(parsed?.allergens)) return asLabels(parsed.allergens);
  } catch {
    // Legacy rows store a comma/newline separated label list.
  }
  return asLabels(value.split(/[,\n，、]/));
};

const normalizeSearchText = (value) =>
  (typeof value === 'string' ? value : '').toLowerCase().replace(/\s+/g, '');

// 메뉴판에 실제로 등록된 알레르기 항목만 필터 칩으로 노출한다.
export const collectMenuAllergens = (items = []) =>
  [...new Set(items.flatMap((item) => normalizeAllergens(item?.allergens)))].sort((a, b) =>
    a.localeCompare(b, 'ko')
  );

// 검색어는 공백·대소문자를 무시하고 메뉴명·설명에서 찾는다.
// 알레르기 제외는 해당 항목이 등록된 메뉴만 숨긴다. 정보가 없는 메뉴는 남겨 두고 화면에서 안내한다.
export const filterMenuItems = (items = [], { query = '', excludedAllergens = [] } = {}) => {
  const needle = normalizeSearchText(query);
  const excluded = new Set(excludedAllergens);

  return items.filter((item) => {
    if (needle) {
      const haystack = normalizeSearchText(`${item?.name ?? ''} ${item?.description ?? ''}`);
      if (!haystack.includes(needle)) return false;
    }
    if (excluded.size > 0 && normalizeAllergens(item?.allergens).some((label) => excluded.has(label))) {
      return false;
    }
    return true;
  });
};
