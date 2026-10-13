// Server memory only. Callers must enforce authorization before invoking load().
module.exports = function singleFlightCache(ttlMs = 30000) {
  let value;
  let expires = 0;
  let pending;
  return function load(factory) {
    if (Date.now() < expires) return Promise.resolve(value);
    if (pending) return pending;
    pending = Promise.resolve()
      .then(factory)
      .then((result) => {
        value = result;
        expires = Date.now() + ttlMs;
        return result;
      })
      .finally(() => {
        pending = undefined;
      });
    return pending;
  };
};
