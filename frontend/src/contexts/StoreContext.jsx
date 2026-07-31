import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { storesAPI } from '@/api';
import { useAuth } from '@/contexts/AuthContext';

const StoreContext = createContext(null);

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within StoreProvider');
  }
  return context;
};

export const StoreProvider = ({ children }) => {
  const { user, consumeStoresCache } = useAuth();
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);
  const [loading, setLoading] = useState(true);

  // 매장 목록 로드
  const fetchStores = useCallback(async () => {
    try {
      const cached = consumeStoresCache?.();
      if (cached && cached.length > 0) {
        setStores(cached);
        setSelectedStore(cached[0]);
        setLoading(false);
        return;
      }

      const res = user?.role === 'super_admin'
        ? await storesAPI.getAll({ limit: 50 })
        : await storesAPI.getMy();
      const list = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
      setStores(list);
      if (list.length > 0) setSelectedStore(list[0]);
    } catch (e) {
      console.error('매장 로딩 실패:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.role, consumeStoresCache]);

  // 초기 로드
  useEffect(() => {
    if (user) {
      fetchStores();
    }
  }, [user, fetchStores]);

  // 매장 변경
  const changeStore = useCallback((storeId) => {
    const store = stores.find(s => s.id === storeId || s.id === Number(storeId));
    if (store) {
      setSelectedStore(store);
    }
  }, [stores]);

  const value = {
    stores,
    selectedStore,
    loading,
    changeStore,
    setSelectedStore,
    refetch: fetchStores,
  };

  return (
    <StoreContext.Provider value={value}>
      {children}
    </StoreContext.Provider>
  );
};

export default StoreContext;
