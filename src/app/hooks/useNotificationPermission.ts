import { useCallback, useEffect, useState } from 'react';
import { getNotificationPermission, requestNotificationPermission } from '../utils/notification';

export function useNotificationPermission() {
  const [state, setState] = useState<PermissionState>('prompt');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const permission = await getNotificationPermission();
    setState(permission);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const request = useCallback(async () => {
    const result = await requestNotificationPermission();
    setState(result);
  }, []);

  return { state, loading, request, refresh };
}
