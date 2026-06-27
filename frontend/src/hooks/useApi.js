import { useState, useCallback } from 'react';

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
      const errorMessage = err.response?.data?.error || err.message || 'An unexpected error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiFunc]);

  return {
    data,
    error,
    loading,
    request
  };
};
