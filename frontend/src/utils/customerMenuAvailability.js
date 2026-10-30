export const canOrderFromMenuSnapshot = (storeOpen, cachedSections) =>
  Boolean(storeOpen) && !Object.values(cachedSections || {}).some(Boolean);
