// Local E2E entry: real application and Socket.IO, without index.mts schedulers.
const database = new URL(process.env.DATABASE_URL || 'http://missing');
if (
  process.env.NODE_ENV !== 'test' ||
  database.hostname !== '127.0.0.1' ||
  database.pathname !== '/wemarket_test_cart_pwa' ||
  process.env.PORT !== '3109'
) {
  throw Error('Explicit isolated cart/PWA test environment required');
}
const { httpServer } = await import('../app.mts');
httpServer.listen(Number(process.env.PORT), '127.0.0.1');
