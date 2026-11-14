import { useEffect, useRef } from 'react';
import { getSocket } from '@/utils/socket';

// 같은 테이블(같은 QR)에 접속한 손님들의 장바구니를 실시간으로 맞춘다.
// 서버는 상태를 저장하지 않고 같은 테이블 방 안에서만 중계한다.
//
// 장바구니를 통째로 덮어쓰지 않고 담은 항목(cartItemId)마다 따로 합친다.
// - 항목마다 버전(v)을 두고, 같은 항목은 버전이 높은 쪽이 이긴다.
// - 지운 항목은 "지움 기록(deleted)"으로 남겨, 소식을 놓친 기기가 옛 장바구니를 보내도 되살아나지 않는다.
// - 버전은 램포트 시계(받은 버전보다 항상 크게)라 기기마다 시계가 달라도 순서가 꼬이지 않는다.
// - 상대가 내 최신 내용을 모르면 바로 내 상태를 돌려보내 따라잡게 한다.

const TOMBSTONE_TTL_MS = 30 * 60 * 1000;
const MAX_ENTRIES = 60; // 서버 isValidSharedCart 상한과 같다

const toWireItem = ({ cartItemId, menuItem, quantity, selectedOptions, unitPrice }) => ({
  cartItemId,
  menuItem: {
    id: menuItem.id,
    name: menuItem.name,
    price: menuItem.price,
    image_url: menuItem.image_url || null,
    emoji: menuItem.emoji || null,
    category_id: menuItem.category_id,
  },
  quantity,
  selectedOptions: selectedOptions || [],
  unitPrice,
});

const toWire = (cart) => cart.map(toWireItem);

const fromWire = (items, menuItems) =>
  (Array.isArray(items) ? items : [])
    .filter((it) => it && !it.deleted && it.menuItem && Number(it.quantity) > 0)
    .map(({ v: _v, createdAt: _createdAt, deleted: _deleted, ...it }) => ({
      ...it,
      quantity: Number(it.quantity),
      // 내 화면에 있는 메뉴 정보가 있으면 그것을 쓴다 (이미지·설명 등)
      menuItem: menuItems.find((m) => m.id === it.menuItem.id) || it.menuItem,
    }));

// 내용 비교용 서명: 수량·옵션·가격·메뉴가 같으면 같은 항목이다
const itemSig = (wireItem) =>
  JSON.stringify([
    wireItem.menuItem?.id,
    Number(wireItem.quantity),
    wireItem.unitPrice,
    wireItem.selectedOptions || [],
  ]);

// a가 b보다 새로우면 true. 버전이 같으면 지움 기록이 이기고, 그래도 같으면 서명으로 정해 모든 기기가 같은 답을 낸다.
const isNewer = (a, b) => {
  if (!b) return true;
  if (a.v !== b.v) return a.v > b.v;
  if (Boolean(a.deleted) !== Boolean(b.deleted)) return Boolean(a.deleted);
  if (a.deleted) return false;
  return itemSig(a) > itemSig(b);
};

// 오래된 지움 기록을 정리하고 서버 상한(60개)에 맞춘다. 살아 있는 항목은 지우지 않는다.
const pruneEntries = (entries, now = Date.now()) => {
  const live = [];
  const tombstones = [];
  entries.forEach((entry) => {
    if (!entry.deleted) live.push(entry);
    else if (now - entry.v < TOMBSTONE_TTL_MS) tombstones.push(entry);
  });
  tombstones.sort((a, b) => b.v - a.v);
  const kept = [...live, ...tombstones.slice(0, Math.max(0, MAX_ENTRIES - live.length))];
  return new Map(kept.map((entry) => [entry.cartItemId, entry]));
};

const normalizeRemote = (raw, fallbackVersion, now) => {
  if (!raw || typeof raw.cartItemId !== 'string' || !raw.cartItemId) return null;
  const v = Number.isFinite(raw.v) ? raw.v : fallbackVersion;
  if (!Number.isFinite(v)) return null;
  const createdAt = Number.isFinite(raw.createdAt) ? raw.createdAt : v;
  if (raw.deleted) {
    // 이미 정리했을 오래된 지움 기록은 받지 않는다 (서로 정리·재추가를 되풀이하지 않도록)
    if (now - v >= TOMBSTONE_TTL_MS) return null;
    return { cartItemId: raw.cartItemId, v, createdAt, deleted: true };
  }
  if (!raw.menuItem || !(Number(raw.quantity) > 0)) return null;
  return { ...toWireItem({ ...raw, quantity: Number(raw.quantity) }), v, createdAt };
};

// 받은 항목들을 내 항목들과 합친다.
// changed: 내 장바구니가 바뀌었는지, remoteStale: 상대가 내 최신 내용을 모르는지
const mergeEntries = (local, remoteItems, fallbackVersion, now = Date.now()) => {
  const merged = pruneEntries(local, now);
  const seen = new Set();
  let changed = false;
  let remoteStale = false;
  (Array.isArray(remoteItems) ? remoteItems : []).forEach((raw) => {
    const entry = normalizeRemote(raw, fallbackVersion, now);
    if (!entry) return;
    seen.add(entry.cartItemId);
    const mine = merged.get(entry.cartItemId);
    if (isNewer(entry, mine)) {
      merged.set(entry.cartItemId, entry);
      changed = true;
    } else if (isNewer(mine, entry)) {
      remoteStale = true;
    }
  });
  merged.forEach((_, id) => {
    if (!seen.has(id)) remoteStale = true;
  });
  return { entries: merged, changed, remoteStale };
};

// 내 기기에서 바뀐 장바구니를 항목 기록에 반영한다. tick()은 새 버전을 돌려준다.
const diffLocal = (local, cart, tick) => {
  const next = new Map(local);
  const present = new Set();
  let changed = false;
  cart.forEach((item) => {
    const wire = toWireItem(item);
    present.add(wire.cartItemId);
    const mine = next.get(wire.cartItemId);
    if (mine && !mine.deleted && itemSig(mine) === itemSig(wire)) return;
    const v = tick();
    next.set(wire.cartItemId, { ...wire, v, createdAt: mine?.createdAt ?? v });
    changed = true;
  });
  next.forEach((entry, id) => {
    if (entry.deleted || present.has(id)) return;
    next.set(id, { cartItemId: id, v: tick(), createdAt: entry.createdAt, deleted: true });
    changed = true;
  });
  return { entries: next, changed };
};

const entriesToCart = (entries, menuItems) =>
  fromWire(
    [...entries.values()]
      .filter((entry) => !entry.deleted)
      .sort((a, b) => a.createdAt - b.createdAt || (a.cartItemId < b.cartItemId ? -1 : 1)),
    menuItems
  );

const maxVersion = (entries) => {
  let max = 0;
  entries.forEach((entry) => {
    if (entry.v > max) max = entry.v;
  });
  return max;
};

export default function useSharedTableCart({ storeId, tableNumber, cart, setCart, menuItems }) {
  const entriesRef = useRef(new Map());
  const clockRef = useRef(0);
  const cartRef = useRef(cart);
  const menuItemsRef = useRef(menuItems);
  const socketRef = useRef(null);
  useEffect(() => {
    cartRef.current = cart;
    menuItemsRef.current = menuItems;
  }, [cart, menuItems]);

  const tick = () => {
    clockRef.current = Math.max(Date.now(), clockRef.current + 1);
    return clockRef.current;
  };

  const emitState = (socket) => {
    entriesRef.current = pruneEntries(entriesRef.current);
    if (entriesRef.current.size === 0) return;
    socket.emit('shared-cart:state', {
      cart: [...entriesRef.current.values()],
      version: maxVersion(entriesRef.current),
    });
  };

  // 방 참여 + 수신
  useEffect(() => {
    if (!storeId || !tableNumber) return undefined;
    const socket = getSocket();
    if (!socket) return undefined;
    if (!socket.connected) socket.connect();
    socketRef.current = socket;

    const join = () => {
      socket.emit('shared-cart:join', { storeId: Number(storeId), tableName: tableNumber });
      socket.emit('shared-cart:request');
      // 끊겨 있던 동안 바꾼 내용이 있으면 바로 알린다 (합치기라 남의 장바구니를 지우지 않는다)
      emitState(socket);
    };
    const onState = ({ cart: items, version } = {}) => {
      // 아직 반영 안 된 내 변경을 먼저 기록에 넣고 합친다
      const local = diffLocal(entriesRef.current, cartRef.current, tick).entries;
      const { entries, changed, remoteStale } = mergeEntries(local, items, version);
      clockRef.current = Math.max(clockRef.current, maxVersion(entries));
      entriesRef.current = entries;
      if (changed) {
        const nextCart = entriesToCart(entries, menuItemsRef.current || []);
        cartRef.current = nextCart;
        setCart(nextCart);
      }
      if (remoteStale) emitState(socket);
    };
    const onRequest = () => emitState(socket);

    socket.on('connect', join);
    socket.on('shared-cart:state', onState);
    socket.on('shared-cart:request', onRequest);
    if (socket.connected) join();
    return () => {
      socket.off('connect', join);
      socket.off('shared-cart:state', onState);
      socket.off('shared-cart:request', onRequest);
      socket.emit('shared-cart:leave');
      socketRef.current = null;
    };
  }, [storeId, tableNumber, setCart]);

  // 내 기기에서 바뀐 항목만 기록하고 같은 테이블에 알림
  useEffect(() => {
    if (!storeId || !tableNumber) return;
    const { entries, changed } = diffLocal(entriesRef.current, cart, tick);
    entriesRef.current = entries;
    if (!changed) return;
    const socket = socketRef.current || getSocket();
    if (socket) emitState(socket);
  }, [cart, storeId, tableNumber]);
}

export { toWire, fromWire, mergeEntries, diffLocal, pruneEntries, entriesToCart };
