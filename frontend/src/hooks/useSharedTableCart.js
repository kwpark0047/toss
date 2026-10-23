import { useEffect, useRef } from 'react';
import { getSocket } from '@/utils/socket';

// 같은 테이블(같은 QR)에 접속한 손님들의 장바구니를 실시간으로 맞춘다.
// 서버는 상태를 저장하지 않고 같은 테이블 방 안에서만 중계한다. 새로 들어온 기기는
// 다른 기기에 현재 장바구니를 요청하고, 마지막으로 바뀐 장바구니(version)가 모두에게 적용된다.
const toWire = (cart) =>
  cart.map(({ cartItemId, menuItem, quantity, selectedOptions, unitPrice }) => ({
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
  }));

const fromWire = (items, menuItems) =>
  (Array.isArray(items) ? items : [])
    .filter((it) => it && it.menuItem && Number(it.quantity) > 0)
    .map((it) => ({
      ...it,
      // 내 화면에 있는 메뉴 정보가 있으면 그것을 쓴다 (이미지·설명 등)
      menuItem: menuItems.find((m) => m.id === it.menuItem.id) || it.menuItem,
    }));

export default function useSharedTableCart({ storeId, tableNumber, cart, setCart, menuItems }) {
  const versionRef = useRef(0);
  const applyingRemoteRef = useRef(false);
  const cartRef = useRef(cart);
  const menuItemsRef = useRef(menuItems);
  useEffect(() => {
    cartRef.current = cart;
    menuItemsRef.current = menuItems;
  }, [cart, menuItems]);

  // 방 참여 + 수신
  useEffect(() => {
    if (!storeId || !tableNumber) return undefined;
    const socket = getSocket();
    if (!socket) return undefined;
    if (!socket.connected) socket.connect();

    const join = () => {
      socket.emit('shared-cart:join', { storeId: Number(storeId), tableName: tableNumber });
      socket.emit('shared-cart:request');
    };
    const onState = ({ cart: items, version } = {}) => {
      if (!Number.isFinite(version) || version <= versionRef.current) return;
      versionRef.current = version;
      applyingRemoteRef.current = true;
      setCart(fromWire(items, menuItemsRef.current || []));
    };
    const onRequest = () => {
      if (cartRef.current.length === 0 || versionRef.current === 0) return;
      socket.emit('shared-cart:state', {
        cart: toWire(cartRef.current),
        version: versionRef.current,
      });
    };

    socket.on('connect', join);
    socket.on('shared-cart:state', onState);
    socket.on('shared-cart:request', onRequest);
    if (socket.connected) join();
    return () => {
      socket.off('connect', join);
      socket.off('shared-cart:state', onState);
      socket.off('shared-cart:request', onRequest);
      socket.emit('shared-cart:leave');
    };
  }, [storeId, tableNumber, setCart]);

  // 내 기기에서 바뀐 장바구니를 같은 테이블에 알림
  useEffect(() => {
    if (!storeId || !tableNumber) return;
    if (applyingRemoteRef.current) {
      applyingRemoteRef.current = false;
      return;
    }
    // 처음 열었을 때 빈 장바구니는 알리지 않는다 (다른 기기의 장바구니를 지우지 않도록)
    if (versionRef.current === 0 && cart.length === 0) return;
    const socket = getSocket();
    if (!socket) return;
    versionRef.current = Math.max(Date.now(), versionRef.current + 1);
    socket.emit('shared-cart:state', { cart: toWire(cart), version: versionRef.current });
  }, [cart, storeId, tableNumber]);
}

export { toWire, fromWire };
