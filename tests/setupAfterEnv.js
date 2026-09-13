const { afterAll } = require('@jest/globals');

afterAll(async () => {
  // app.mts 가 ESM 이므로 require.cache[appPath] 는 module namespace 를 노출하고,
  // VM 모듈 환경에서 namespace.io 접근 시 "Cannot access 'io' before initialization"(TDZ) throws.
  // teardown 은 best-effort 이므로 실패해도 무시한다.
  try {
    const appPath = require.resolve('../app');
    const cachedApp = require.cache[appPath]?.exports;
    if (cachedApp?.io) cachedApp.io.close();
    if (cachedApp?.httpServer?.listening) {
      await new Promise((resolve) => cachedApp.httpServer.close(resolve));
    }
  } catch (_err) {
    // ESM app 캐시 접근 불가 — 무시
  }

  const prismaPath = require.resolve('../config/prisma');
  const cachedPrisma = require.cache[prismaPath]?.exports;
  if (typeof cachedPrisma?.disconnectAll === 'function') {
    await cachedPrisma.disconnectAll();
  }

  const firebasePath = require.resolve('../utils/firebaseAdmin');
  const cachedFirebase = require.cache[firebasePath]?.exports;
  if (typeof cachedFirebase?.shutdownFirebase === 'function') {
    await cachedFirebase.shutdownFirebase();
  }
});
