import { useState, useCallback } from 'react';
import { get, post } from '../api/client';

export default function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async (url) => {
    setLoading(true);
    setError(null);
    try {
      const result = await get(url);
      return result;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const postData = useCallback(async (url, body) => {
    setLoading(true);
    setError(null);
    try {
      const result = await post(url, body);
      return result;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, fetchData, postData };
}
