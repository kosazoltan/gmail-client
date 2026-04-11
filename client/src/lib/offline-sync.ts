/**
 * Offline sync queue — sends pending drafts when online.
 * Uses offline-store.ts getPendingDrafts + the compose/send API.
 */
import { getPendingDrafts, saveDraft, deleteDraft, type OfflineDraft } from './offline-store';

const API_BASE = '/api/emails';

interface SendResult {
  sent: string[];
  failed: Array<{ id: string; error: string }>;
}

/**
 * Attempt to send all pending drafts via the API.
 * Successful drafts are deleted from IndexedDB; failures remain as 'pending'.
 */
export async function syncPendingDrafts(accountId: string): Promise<SendResult> {
  const pending = await getPendingDrafts();
  const result: SendResult = { sent: [], failed: [] };

  if (pending.length === 0) return result;

  for (const draft of pending) {
    try {
      const response = await fetch(`${API_BASE}/send?accountId=${encodeURIComponent(accountId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          to: draft.to,
          cc: draft.cc || undefined,
          bcc: draft.bcc || undefined,
          subject: draft.subject,
          body: draft.body,
        }),
      });

      if (response.ok) {
        await deleteDraft(draft.id);
        result.sent.push(draft.id);
      } else {
        const errorText = await response.text().catch(() => 'Unknown error');
        result.failed.push({ id: draft.id, error: `HTTP ${response.status}: ${errorText}` });
      }
    } catch (err) {
      // Network error — draft stays pending for next retry
      result.failed.push({
        id: draft.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

/**
 * Mark a draft as 'pending' so the sync queue picks it up.
 */
export async function queueDraftForSync(draft: OfflineDraft): Promise<void> {
  await saveDraft({
    ...draft,
    status: 'pending',
    updatedAt: Date.now(),
  });
}

/**
 * Register a listener that auto-syncs when the browser goes online.
 * Returns a cleanup function.
 */
export function registerAutoSync(accountId: string): () => void {
  const handler = () => {
    syncPendingDrafts(accountId).catch((err) =>
      console.error('[OfflineSync] Auto-sync failed:', err),
    );
  };

  window.addEventListener('online', handler);

  // Also attempt sync immediately if we're already online
  if (navigator.onLine) {
    syncPendingDrafts(accountId).catch((err) =>
      console.error('[OfflineSync] Initial sync failed:', err),
    );
  }

  return () => window.removeEventListener('online', handler);
}
