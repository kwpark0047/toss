import { useCallback, useState } from 'react';
import { menuCartKey, restoreMenuCart } from '@/lib/menuCartSession';

export default function useMenuCartState(storeId, tableNumber) {
  const key = menuCartKey(storeId, tableNumber);
  const [session, setSession] = useState(() => ({ key, cart: restoreMenuCart(storeId, tableNumber) }));
  // React discards this render and immediately rerenders with the new table.
  if (session.key !== key) setSession({ key, cart: restoreMenuCart(storeId, tableNumber) });
  const setCart = useCallback((update) => {
    setSession((previous) => {
      const cart = previous.key === key ? previous.cart : restoreMenuCart(storeId, tableNumber);
      return { key, cart: typeof update === 'function' ? update(cart) : update };
    });
  }, [key, storeId, tableNumber]);
  return [session.cart, setCart];
}
