import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { renderHook, act } from '@testing-library/react';

// 같은 테이블 방을 흉내 내는 가짜 서버: 보낸 기기를 뺀 나머지에게 중계하고,
// offline인 기기는 메시지를 받지 못한다 (화면 꺼짐·잠깐 끊김).
const room = new Set();
const makeSocket = (name) => {
  const handlers = {};
  const socket = {
    name,
    connected: true,
    online: true,
    connect: vi.fn(),
    on: (event, fn) => {
      (handlers[event] ||= []).push(fn);
    },
    off: (event, fn) => {
      handlers[event] = (handlers[event] || []).filter((h) => h !== fn);
    },
    emit: (event, payload) => {
      if (event === 'shared-cart:join') {
        room.add(socket);
        return;
      }
      if (event === 'shared-cart:leave') {
        room.delete(socket);
        return;
      }
      if (!socket.online) return;
      room.forEach((peer) => {
        if (peer !== socket && peer.online) peer.receive(event, payload);
      });
    },
    receive: (event, payload) => {
      // 실제 네트워크처럼 JSON으로 한 번 직렬화된 내용을 받는다
      const copy = payload === undefined ? undefined : JSON.parse(JSON.stringify(payload));
      (handlers[event] || []).forEach((h) => h(copy));
    },
    reconnect: () => {
      socket.online = true;
      (handlers.connect || []).forEach((h) => h());
    },
  };
  return socket;
};

let currentSocket = null;
vi.mock('@/utils/socket', () => ({ getSocket: () => currentSocket }));

const {
  default: useSharedTableCart,
  toWire,
  fromWire,
  mergeEntries,
  diffLocal,
  pruneEntries,
} = await import('@/hooks/useSharedTableCart');

const menuItems = [
  { id: 1, name: '짜장면', price: 8000, category_id: 1 },
  { id: 2, name: '짬뽕', price: 9000, category_id: 1 },
  { id: 3, name: '탕수육', price: 18000, category_id: 2 },
];
const line = (cartItemId, menuId, quantity = 1) => {
  const menuItem = menuItems.find((m) => m.id === menuId);
  return { cartItemId, menuItem, quantity, selectedOptions: [], unitPrice: menuItem.price };
};
const total = (cart) => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

// 기기 하나 = 메뉴 화면 하나 (MenuPage가 쓰는 것과 같은 방식으로 훅을 붙인다)
const openDevice = (name) => {
  const socket = makeSocket(name);
  currentSocket = socket;
  const view = renderHook(() => {
    const [cart, setCart] = useState([]);
    useSharedTableCart({ storeId: 7, tableNumber: '3', cart, setCart, menuItems });
    return { cart, setCart };
  });
  return {
    socket,
    get cart() {
      return view.result.current.cart;
    },
    add: (item) =>
      act(() => (currentSocket = socket) && view.result.current.setCart((prev) => [...prev, item])),
    setQty: (id, quantity) =>
      act(
        () =>
          (currentSocket = socket) &&
          view.result.current.setCart((prev) =>
            prev.map((it) => (it.cartItemId === id ? { ...it, quantity } : it))
          )
      ),
    remove: (id) =>
      act(
        () =>
          (currentSocket = socket) &&
          view.result.current.setCart((prev) => prev.filter((it) => it.cartItemId !== id))
      ),
    clear: () => act(() => (currentSocket = socket) && view.result.current.setCart([])),
    close: () => view.unmount(),
  };
};

beforeEach(() => {
  room.clear();
});

describe('공유 장바구니 직렬화', () => {
  const cart = [
    {
      cartItemId: 'a1',
      menuItem: { id: 1, name: '짜장면', price: 8000, description: '긴 설명', category_id: 2 },
      quantity: 2,
      selectedOptions: [{ name: '곱빼기' }],
      unitPrice: 9000,
    },
  ];

  it('필요한 필드만 보내고 다시 받으면 같은 장바구니가 된다', () => {
    const wire = toWire(cart);
    expect(wire[0].menuItem.description).toBeUndefined();
    const back = fromWire(wire, [{ id: 1, name: '짜장면', price: 8000, description: '긴 설명' }]);
    expect(back[0].menuItem.description).toBe('긴 설명');
    expect(back[0]).toMatchObject({ cartItemId: 'a1', quantity: 2, unitPrice: 9000 });
  });

  it('수량 0이나 깨진 항목, 지움 기록은 장바구니에 넣지 않는다', () => {
    expect(fromWire([{ menuItem: { id: 1 }, quantity: 0 }, null, { quantity: 1 }], [])).toEqual([]);
    expect(fromWire([{ cartItemId: 'x', deleted: true, v: 5 }], [])).toEqual([]);
  });
});

describe('항목 단위 병합', () => {
  let clock = 1000;
  const tick = () => ++clock;

  it('지운 항목은 더 오래된 상태가 와도 되살아나지 않는다', () => {
    const before = diffLocal(new Map(), [line('a', 1), line('b', 2)], tick).entries;
    const stale = [...before.values()];
    const afterDelete = diffLocal(before, [line('a', 1)], tick).entries;
    const { entries, changed, remoteStale } = mergeEntries(afterDelete, stale, 0, clock);
    expect(changed).toBe(false);
    expect(remoteStale).toBe(true);
    expect(entries.get('b').deleted).toBe(true);
  });

  it('서로 다른 항목을 동시에 바꾸면 둘 다 남는다', () => {
    const base = diffLocal(new Map(), [line('a', 1)], tick).entries;
    const mine = diffLocal(base, [line('a', 1), line('b', 2)], tick).entries;
    const theirs = diffLocal(base, [line('a', 1, 3)], tick).entries;
    const { entries } = mergeEntries(mine, [...theirs.values()], 0, clock);
    expect(entries.get('a').quantity).toBe(3);
    expect(entries.get('b').deleted).toBeFalsy();
  });

  it('오래된 지움 기록은 정리하되 살아 있는 항목은 남긴다', () => {
    const entries = new Map([
      ['live', { ...toWire([line('live', 1)])[0], v: 1, createdAt: 1 }],
      ['old', { cartItemId: 'old', v: 1, createdAt: 1, deleted: true }],
      ['recent', { cartItemId: 'recent', v: 40 * 60 * 1000, createdAt: 1, deleted: true }],
    ]);
    const pruned = pruneEntries(entries, 45 * 60 * 1000);
    expect([...pruned.keys()].sort()).toEqual(['live', 'recent']);
  });
});

describe('같은 테이블 기기 사이 동기화', () => {
  it('휴지통으로 지우면 다른 기기 합계도 맞게 줄어든다', () => {
    const a = openDevice('A');
    const b = openDevice('B');
    a.add(line('a1', 1));
    a.add(line('a2', 3));
    expect(total(b.cart)).toBe(26000);
    a.remove('a2');
    expect(b.cart.map((it) => it.cartItemId)).toEqual(['a1']);
    expect(total(a.cart)).toBe(8000);
    expect(total(b.cart)).toBe(8000);
  });

  it('삭제 소식을 놓친 기기가 수량을 바꿔도 지운 메뉴가 되살아나지 않는다', () => {
    const a = openDevice('A');
    const b = openDevice('B');
    a.add(line('a1', 1));
    a.add(line('a2', 3));
    b.socket.online = false; // B 화면 꺼짐
    a.remove('a2');
    expect(total(b.cart)).toBe(26000); // B는 아직 모른다
    b.socket.online = true;
    b.setQty('a1', 2); // B가 옛 장바구니에서 수량을 바꾼다
    expect(a.cart.map((it) => [it.cartItemId, it.quantity])).toEqual([['a1', 2]]);
    expect(total(a.cart)).toBe(16000);
    // A가 바로 최신 상태를 돌려보내 B도 따라잡는다
    expect(b.cart.map((it) => [it.cartItemId, it.quantity])).toEqual([['a1', 2]]);
    expect(total(b.cart)).toBe(16000);
  });

  it('장바구니를 다 비운 뒤 다시 연결된 기기도 비워진 것을 안다', () => {
    const a = openDevice('A');
    const b = openDevice('B');
    a.add(line('a1', 1));
    b.socket.online = false;
    a.remove('a1');
    expect(a.cart).toEqual([]);
    act(() => b.socket.reconnect());
    expect(b.cart).toEqual([]);
  });

  it('늦게 들어온 기기가 먼저 담아도 다른 사람 메뉴를 지우지 않는다', () => {
    const a = openDevice('A');
    a.add(line('a1', 1));
    const c = openDevice('C');
    expect(c.cart.map((it) => it.cartItemId)).toEqual(['a1']);
    c.socket.online = false;
    c.add(line('c1', 2));
    act(() => c.socket.reconnect());
    expect(a.cart.map((it) => it.cartItemId).sort()).toEqual(['a1', 'c1']);
    expect(c.cart.map((it) => it.cartItemId).sort()).toEqual(['a1', 'c1']);
  });

  it('주문 후 장바구니를 비우면 모든 기기에서 비워진다', () => {
    const a = openDevice('A');
    const b = openDevice('B');
    a.add(line('a1', 1));
    b.add(line('b1', 2));
    b.clear();
    expect(a.cart).toEqual([]);
    expect(b.cart).toEqual([]);
  });

  it('처음 열었을 때 빈 장바구니는 다른 기기 장바구니를 지우지 않는다', () => {
    const a = openDevice('A');
    a.add(line('a1', 1));
    const b = openDevice('B');
    expect(a.cart.map((it) => it.cartItemId)).toEqual(['a1']);
    expect(b.cart.map((it) => it.cartItemId)).toEqual(['a1']);
  });
});
