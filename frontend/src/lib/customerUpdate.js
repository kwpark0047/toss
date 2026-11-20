let checkpoint;
export const isCustomerMenu = (path) => /^\/menu\/\d+\/?$/.test(path);

export function registerMenuCheckpoint(handler) {
  checkpoint = handler;
  return () => { if (checkpoint === handler) checkpoint = undefined; };
}

export function prepareCustomerUpdate() {
  // A lazy menu may not have registered its cart yet. Never race its mount.
  if (!checkpoint) return false;
  const active = document.activeElement;
  if (active && (active.matches('input,textarea,select') || active.isContentEditable)) return false;
  return checkpoint();
}
