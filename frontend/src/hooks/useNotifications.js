import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/apiClient';

const POLL_INTERVAL_MS = 60_000; // 60 secondes

export function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef(null);

  const fetch = useCallback(async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unread_count || 0);
    } catch {
      // silencieux — ne pas bloquer l'UI
    }
  }, []);

  // Chargement initial + polling
  useEffect(() => {
    setLoading(true);
    fetch().finally(() => setLoading(false));
    intervalRef.current = setInterval(fetch, POLL_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, [fetch]);

  const markRead = useCallback(async (notifId) => {
    try {
      await api.patch(`/notifications/${notifId}/read`);
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { /* silencieux */ }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch { /* silencieux */ }
  }, []);

  return { notifications, unreadCount, loading, markRead, markAllRead, refresh: fetch };
}
