import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSettings, defaultSettings } from './useSettings';
import { useVipEmails, isVipEmail } from './useVip';
import { toast } from '../lib/toast';

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

    const es = new EventSource('/api/sse/events', { withCredentials: true });
    es.addEventListener('new-email', (event) => {
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
    });

    return () => es.close();
  }, [enabled, queryClient, settings, vipEmails]);
}
