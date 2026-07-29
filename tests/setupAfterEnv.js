const { afterAll } = require('@jest/globals');

afterAll(async () => {
  const appPath = require.resolve('../app');
  const cachedApp = require.cache[appPath]?.exports;
  if (cachedApp?.io) cachedApp.io.close();
  if (cachedApp?.httpServer?.listening) {
    await new Promise((resolve) => cachedApp.httpServer.close(resolve));
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
