import webpush from 'web-push';
import crypto from 'crypto';
import { queryAll, queryOne, execute } from '../db/index.js';

// VAPID kulcsok - ezeket környezeti változóból olvassuk
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@mindenes.org';

// Web-push konfiguráció
if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  console.log('Push notifications enabled');
} else {
  console.log('Push notifications disabled - VAPID keys not configured');
}

interface PushSubscription {
  id: string;
  account_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: number;
}

// Subscription mentése
export function saveSubscription(
  accountId: string,
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  },
): void {
  const id = crypto.randomUUID();

  // Ellenőrizzük, hogy már létezik-e ez az endpoint
  const existing = queryOne<{ id: string }>(
    'SELECT id FROM push_subscriptions WHERE endpoint = ? AND account_id = ?',
    [subscription.endpoint, accountId],
  );

  if (existing) {
    // Frissítjük a meglévőt
    execute(
      'UPDATE push_subscriptions SET p256dh = ?, auth = ?, created_at = ? WHERE id = ?',
      [subscription.keys.p256dh, subscription.keys.auth, Date.now(), existing.id],
    );
  } else {
    // Új subscription
    execute(
      `INSERT INTO push_subscriptions (id, account_id, endpoint, p256dh, auth, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, accountId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, Date.now()],
    );
  }
}

// Subscription törlése (opcionális accountId-val a biztonság érdekében)
export function deleteSubscription(endpoint: string, accountId?: string): void {
  if (accountId) {
    // Ha accountId is meg van adva, csak azt a subscription-t törli, ami ehhez a fiókhoz tartozik
    execute('DELETE FROM push_subscriptions WHERE endpoint = ? AND account_id = ?', [endpoint, accountId]);
  } else {
    // Visszafelé kompatibilitás - csak endpoint alapján törlés
    execute('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint]);
  }
}

// Subscription törlése account alapján
export function deleteSubscriptionsByAccount(accountId: string): void {
  execute('DELETE FROM push_subscriptions WHERE account_id = ?', [accountId]);
}

// Push notification küldése egy fióknak
export async function sendPushToAccount(
  accountId: string,
  payload: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    url?: string;
    tag?: string;
  },
): Promise<{ sent: number; failed: number }> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.log('Push notification skipped - VAPID keys not configured');
    return { sent: 0, failed: 0 };
  }

  const subscriptions = queryAll<PushSubscription>(
    'SELECT * FROM push_subscriptions WHERE account_id = ?',
    [accountId],
  );

  let sent = 0;
  let failed = 0;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          icon: payload.icon || '/icons/icon-192x192.png',
          badge: payload.badge || '/icons/icon-72x72.png',
          url: payload.url || '/',
          tag: payload.tag,
        }),
      );
      sent++;
    } catch (error: unknown) {
      console.error('Push notification failed:', error);

      // Ha a subscription érvénytelen, töröljük
      const statusCode = error && typeof error === 'object' && 'statusCode' in error
        ? (error as { statusCode: number }).statusCode
        : undefined;
      if (statusCode === 410 || statusCode === 404) {
        execute('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
      }
      failed++;
    }
  }

  return { sent, failed };
}

// Push notification küldése minden feliratkozónak
export async function sendPushToAll(payload: {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
}): Promise<{ sent: number; failed: number }> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    return { sent: 0, failed: 0 };
  }

  const subscriptions = queryAll<PushSubscription>('SELECT * FROM push_subscriptions', []);

  let sent = 0;
  let failed = 0;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        JSON.stringify(payload),
      );
      sent++;
    } catch (error: unknown) {
      const statusCode = error && typeof error === 'object' && 'statusCode' in error
        ? (error as { statusCode: number }).statusCode
        : undefined;
      if (statusCode === 410 || statusCode === 404) {
        execute('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
      }
      failed++;
    }
  }

  return { sent, failed };
}

// VAPID public key lekérése (frontend-nek)
export function getVapidPublicKey(): string {
  return vapidPublicKey;
}

// VAPID kulcsok generálása (egyszer kell futtatni)
export function generateVapidKeys(): { publicKey: string; privateKey: string } {
  return webpush.generateVAPIDKeys();
}
