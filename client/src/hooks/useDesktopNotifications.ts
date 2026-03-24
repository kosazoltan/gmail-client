import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSettings, defaultSettings } from './useSettings';
import { useVipEmails, isVipEmail } from './useVip';
import { toast } from '../lib/toast';
import { api, getApiDegradationState, subscribeApiDegradation } from '../lib/api';

interface NewEmailEvent {
  emailId: string;
  accountId?: string;
  subject: string | null;
  from: string | null;
  fromName: string | null;
  snippet: string | null;
}

function inQuietHours(start: string, end: string) {
  const now = new Date();
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const cur = now.getHours() * 60 + now.getMinutes();
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  return s <= e ? cur >= s && cur <= e : cur >= s || cur <= e;
}

export function useDesktopNotifications(enabled: boolean) {
  const queryClient = useQueryClient();
  const { data: settings } = useSettings();
  const { data: vipEmails } = useVipEmails();

  useEffect(() => {
    if (!enabled || !('Notification' in window)) return;
    if (Notification.permission === 'default') Notification.requestPermission();

    let isActive = true;
    let reconnectDelayMs = 2000;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let es: EventSource | null = null;

    const clearReconnectTimer = () => {
      if (!reconnectTimer) return;
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    };

    const scheduleReconnect = (delayMs: number) => {
      if (!isActive) return;
      clearReconnectTimer();
      reconnectTimer = setTimeout(
        () => {
          reconnectTimer = null;
          connect();
        },
        Math.max(1000, delayMs),
      );
    };

    const onNewEmail = (event: Event) => {
      let data: NewEmailEvent;
      try {
        data = JSON.parse((event as MessageEvent).data) as NewEmailEvent;
      } catch (err) {
        console.warn('Invalid SSE payload', err);
        return;
      }
      const sender = data.fromName || data.from || 'Ismeretlen';
      const subject = data.subject || '(nincs tárgy)';
      const snippet = (data.snippet || '').slice(0, 100);

      queryClient.invalidateQueries({ queryKey: ['emails'] });

      const desktopEnabled =
        settings?.desktopNotificationsEnabled ?? defaultSettings.desktopNotificationsEnabled;
      const vipOnly = settings?.vipNotificationsOnly ?? defaultSettings.vipNotificationsOnly;
      const soundEnabled =
        settings?.notificationSoundEnabled ?? defaultSettings.notificationSoundEnabled;
      const quietEnabled = settings?.quietHoursEnabled ?? defaultSettings.quietHoursEnabled;
      const quietStart = settings?.quietHoursStart ?? defaultSettings.quietHoursStart ?? '22:00';
      const quietEnd = settings?.quietHoursEnd ?? defaultSettings.quietHoursEnd ?? '07:00';

      if (!desktopEnabled || document.hasFocus()) return;
      if (quietEnabled && inQuietHours(quietStart, quietEnd)) return;
      if (vipOnly && !isVipEmail(data.from, vipEmails)) return;
      if (Notification.permission !== 'granted') return;

      const n = new Notification(`Új email: ${sender}`, {
        body: `${subject}\n${snippet}`,
        icon: isVipEmail(data.from, vipEmails)
          ? '/icons/icon-512x512.png'
          : '/icons/icon-192x192.png',
      });
      n.onclick = () => {
        window.focus();
        window.location.href = `/?emailId=${encodeURIComponent(data.emailId)}${data.accountId ? `&accountId=${encodeURIComponent(data.accountId)}` : ''}`;
      };

      if (soundEnabled) {
        try {
          new Audio('/notification.mp3').play().catch(() => undefined);
        } catch {
          toast.info(`📬 ${sender}: ${subject}`);
        }
      }
    };

    const closeEventSource = () => {
      if (!es) return;
      es.close();
      es = null;
    };

    const connect = () => {
      if (!isActive || !navigator.onLine) return;
      const degradation = getApiDegradationState();
      if (degradation.isDegraded) {
        const waitMs = Math.max(1500, (degradation.retryAt ?? Date.now() + 1500) - Date.now());
        scheduleReconnect(waitMs);
        return;
      }

      closeEventSource();
      // Production: VITE_API_URL → api.mindenes.org (relatív /api/... csak Vite proxy alatt működik)
      es = new EventSource(api.sse.eventsUrl(), { withCredentials: true });
      es.addEventListener('new-email', onNewEmail);
      es.addEventListener('connected', () => {
        reconnectDelayMs = 2000;
      });
      es.onerror = () => {
        closeEventSource();
        reconnectDelayMs = Math.min(reconnectDelayMs * 2, 30000);
        scheduleReconnect(reconnectDelayMs);
      };
    };

    const unsubscribeDegradation = subscribeApiDegradation((state) => {
      if (!isActive) return;
      if (state.isDegraded) {
        closeEventSource();
        const waitMs = Math.max(1500, (state.retryAt ?? Date.now() + 1500) - Date.now());
        scheduleReconnect(waitMs);
        return;
      }
      if (!es) {
        scheduleReconnect(500);
      }
    });

    const handleOnline = () => {
      reconnectDelayMs = 2000;
      scheduleReconnect(500);
    };

    const handleOffline = () => {
      closeEventSource();
      clearReconnectTimer();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    connect();

    return () => {
      isActive = false;
      unsubscribeDegradation();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearReconnectTimer();
      closeEventSource();
    };
  }, [enabled, queryClient, settings, vipEmails]);
}
