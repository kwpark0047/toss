import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { useState } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';

// Use real Node transports, not a fake already-connected socket.
vi.mock('socket.io-client', async () => {
  const { createRequire } = await import('node:module');
  return { io: createRequire(import.meta.url)('socket.io-client').io };
});
const require = createRequire(import.meta.url);
const { Server } = require('socket.io');
let server;
let socketModule;
let useSharedTableCart;
let handshakes = [];

beforeAll(async () => {
  const http = createServer();
  server = new Server(http);
  server.use((socket, next) => {
    handshakes.push(Boolean(socket.handshake.auth?.token));
    // Production rejects invalid auth with a namespace CONNECT_ERROR. Reproduce
    // that protocol boundary without pulling backend/Prisma into frontend CI.
    if (socket.handshake.auth?.token) {
      const error = new Error('Invalid access token');
      error.data = { code: 'UNAUTHENTICATED' };
      next(error);
    } else next();
  });
  server.on('connection', (socket) => {
    socket.on('shared-cart:join', ({ storeId, tableName }) => {
      socket.data.room = `${storeId}:${tableName}`;
      socket.join(socket.data.room);
    });
    for (const event of ['shared-cart:request', 'shared-cart:state']) {
      socket.on(event, (data) => {
        if (socket.data.room) socket.to(socket.data.room).emit(event, data);
      });
    }
  });
  await new Promise((resolve) => http.listen(0, '127.0.0.1', resolve));
  vi.stubEnv('VITE_SOCKET_URL', `http://127.0.0.1:${http.address().port}`);
  localStorage.setItem('token', 'expired-admin-token-fixture');
  socketModule = await import('@/utils/socket');
  useSharedTableCart = (await import('@/hooks/useSharedTableCart')).default;
});

afterAll(async () => {
  socketModule?.default.disconnect();
  localStorage.removeItem('token');
  vi.unstubAllEnvs();
  await new Promise((resolve) => server.close(resolve));
});

describe('first customer connection with stale admin credentials', () => {
  it('reproduces the authenticated singleton rejecting the stale token without reconnecting', async () => {
    const socket = socketModule.default;
    const error = new Promise((resolve) => socket.once('connect_error', resolve));
    socket.connect();
    expect((await error).data.code).toBe('UNAUTHENTICATED');
    expect(socket.connected).toBe(false);
    expect(socket.active).toBe(false);
  });

  it('syncs two fresh customer mounts and bidirectional deletions without reload or login refresh', async () => {
    handshakes = [];
    const menuItems = [
      { id: 1, name: 'test1', price: 1000 },
      { id: 2, name: 'test2', price: 2000 },
    ];
    const device = () => renderHook(() => {
      const [cart, setCart] = useState([]);
      useSharedTableCart({ storeId: 9, tableNumber: 'first-connect', cart, setCart, menuItems });
      return { cart, setCart };
    });
    const a = device();
    const b = device();
    const item = (id) => ({ cartItemId: `c${id}`, menuItem: menuItems[id - 1], quantity: 1, selectedOptions: [], unitPrice: id * 1000 });
    // Add before the handshakes finish: the first connect must replay these edits.
    act(() => a.result.current.setCart([item(1)]));
    act(() => b.result.current.setCart([item(2)]));
    const total = (view) => view.result.current.cart.reduce((sum, row) => sum + row.quantity * row.unitPrice, 0);
    try {
      await waitFor(() => {
        expect(total(a)).toBe(3000);
        expect(total(b)).toBe(3000);
      }, { timeout: 4000 });
      expect(handshakes).toEqual([false, false]);
      expect(localStorage.getItem('token')).toBe('expired-admin-token-fixture');
      act(() => a.result.current.setCart((cart) => cart.filter((row) => row.cartItemId !== 'c2')));
      await waitFor(() => expect(total(b)).toBe(1000));
      act(() => b.result.current.setCart([]));
      await waitFor(() => expect(a.result.current.cart).toEqual([]));
    } finally {
      a.unmount();
      b.unmount();
    }
  });
});
