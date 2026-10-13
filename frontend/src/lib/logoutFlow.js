export async function logoutFlow({ revoke, clearLocalSession, clearCaches }) {
  await revoke();
  clearLocalSession();
  try {
    await clearCaches();
    return { cacheCleared: true };
  } catch {
    return { cacheCleared: false };
  }
}
