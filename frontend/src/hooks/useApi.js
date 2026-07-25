import { useState, useCallback } from 'react';
import { extractErrorMessage } from '@/lib/errorUtils';

/**
 * @deprecated useApiQuery/useApiMutation 훅으로 대체 예정.
 * 새 컴포넌트는 useApiQuery 사용 권장.
 */
export const useApi = (apiFunc) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const request = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFunc(...args);
      setData(response.data);
      return response.data;
    } catch (err) {
      const msg = extractErrorMessage(err);
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiFunc]);

  return { data, error, loading, request };
};
