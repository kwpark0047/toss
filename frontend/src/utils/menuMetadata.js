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
