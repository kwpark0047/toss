// app.mts is loaded through import(), so require.cache cannot reliably close it.
afterAll(async () => {
  if (process.env.INTEGRATION_EXIT_DIAGNOSTICS === 'true')
    process.stderr.write('TEARDOWN_STARTED\n');
  const { io, httpServer } = await import('../../app');
  await new Promise((resolve) => io.close(resolve));
  if (httpServer.listening) await new Promise((resolve) => httpServer.close(resolve));
  await require('../../utils/cache').hybridCache.close();
  await require('../../utils/redisCache').getRedisCache().disconnect();
  await require('../../utils/aiRateLimiter').shutdownAIRateLimiter();
  await require('../../utils/runtimeResources').closeRuntimeResources();
  if (process.env.INTEGRATION_EXIT_DIAGNOSTICS === 'true') {
    process.stderr.write(
      'EXIT_RESOURCES ' + JSON.stringify(process.getActiveResourcesInfo()) + '\n'
    );
    process.stderr.write(
      'EXIT_HANDLES ' +
        JSON.stringify(
          process._getActiveHandles().map((handle) => ({
            kind: handle.constructor?.name,
            listening: handle.listening,
            localPort: handle.localPort,
            remotePort: handle.remotePort,
          }))
        ) +
        '\n'
    );
  }
});
