// A timed-out caller must not create another database query while the first is pending.
function createReadinessProbe(check, { timeoutMs = 3000, cacheMs = 1000 } = {}) {
  let pending = null;
  let last = null;
  let checkedAt = 0;
  return async function probe() {
    if (last !== null && Date.now() - checkedAt < cacheMs) return last;
    if (!pending) {
      pending = Promise.resolve()
        .then(check)
        .then(
          () => true,
          () => false
        )
        .then((ok) => {
          last = ok;
          checkedAt = Date.now();
          pending = null;
          return ok;
        });
    }
    let timer;
    try {
      return await Promise.race([
        pending,
        new Promise((resolve) => {
          timer = setTimeout(() => resolve(false), timeoutMs);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
}
module.exports = { createReadinessProbe };
