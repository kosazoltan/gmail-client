import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from '../lib/toast';

interface NewEmailEvent {
  emailId: string;
  subject: string | null;
  from: string | null;
  fromName: string | null;
  date: number;
  snippet: string | null;
}

/**
 * Hook that listens to SSE events for new emails.
 * Shows toast notifications and invalidates inbox queries.
 * Optionally requests browser notification permission.
 */
export function useNewEmailNotification(enabled: boolean) {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isMountedRef = useRef(true);
  const MAX_RECONNECT_ATTEMPTS = 10;

  // Request browser notification permission on mount
  useEffect(() => {
    if (enabled && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [enabled]);

  const handleNewEmail = useCallback(
    (event: MessageEvent) => {
      try {
        const data: NewEmailEvent = JSON.parse(event.data);
        const sender = data.fromName || data.from || 'Ismeretlen';
        const subject = data.subject || '(nincs tárgy)';

        // Toast notification
        toast.info(`📬 ${sender}: ${subject}`, 5000);

        // Browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification(`Új email: ${sender}`, {
              body: subject,
              icon: '/icons/icon-192x192.png',
              tag: `email-${data.emailId}`,
            });
          } catch {
            // Notification API may fail in some contexts (e.g. incognito)
          }
        }

        // Invalidate inbox queries so the list refreshes
        queryClient.invalidateQueries({ queryKey: ['inbox'] });
        queryClient.invalidateQueries({ queryKey: ['inbox-infinite'] });
        queryClient.invalidateQueries({ queryKey: ['unified-inbox'] });
        queryClient.invalidateQueries({ queryKey: ['unified-inbox-infinite'] });
        queryClient.invalidateQueries({ queryKey: ['unread-count'] });
        queryClient.invalidateQueries({ queryKey: ['emails'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      } catch {
        // Ignore parse errors
      }
    },
    [queryClient],
  );

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = api.sse.eventsUrl();
    const es = new EventSource(url, { withCredentials: true });
    eventSourceRef.current = es;

    es.addEventListener('new-email', handleNewEmail);

    es.addEventListener('connected', () => {
      reconnectAttemptsRef.current = 0; // Reset on successful connection
    });

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;

      // Exponential backoff reconnect
      if (!isMountedRef.current) return;
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 60000);
        reconnectAttemptsRef.current++;
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      }
    };
  }, [handleNewEmail]);

  useEffect(() => {
    if (!enabled) return;

    connect();

    return () => {
      isMountedRef.current = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [enabled, connect]);
}
