import { useEffect, useRef } from 'react';
import { getPendingDrafts, deleteDraft, saveDraft } from '../lib/offline-store';
import { api } from '../lib/api';
import { toast } from '../lib/toast';

/**
 * Online/Offline sync hook.
 * Ha visszajön a net → pending draft-ok automatikus küldése.
 * Optimistic delete: ELŐSZÖR töröljük a draft-ot, AZTÁN küldjük — dupla küldés megelőzésre.
 */
export function useOfflineSync() {
  const isSyncingRef = useRef(false);

  useEffect(() => {
    const syncPendingDrafts = async () => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;

      try {
        const pending = await getPendingDrafts();
        if (pending.length === 0) return;

        let sentCount = 0;

        for (const draft of pending) {
          try {
            // Optimistic delete: ELŐSZÖR törlés, AZTÁN küldés (dupla küldés megelőzés)
            await deleteDraft(draft.id);
            try {
              await api.emails.send({
                to: draft.to,
                subject: draft.subject,
                body: draft.body,
                cc: draft.cc || undefined,
                attachments: draft.attachments,
              });
              sentCount++;
            } catch (sendErr) {
              // Küldés sikertelen → visszamentjük
              console.error(`[OfflineSync] Küldés sikertelen (${draft.id}), visszamentés:`, sendErr);
              await saveDraft({ ...draft, updatedAt: Date.now() });
            }
          } catch (err) {
            console.error(`[OfflineSync] Draft hiba (${draft.id}):`, err);
          }
        }

        if (sentCount > 0) {
          toast.success(
            sentCount === 1
              ? '1 offline piszkozat elküldve'
              : `${sentCount} offline piszkozat elküldve`,
          );
        }
      } catch (err) {
        console.error('[OfflineSync] Sync hiba:', err);
      } finally {
        isSyncingRef.current = false;
      }
    };

    const handleOnline = () => {
      // Kis késleltetés, hogy a hálózat stabilizálódjon
      setTimeout(syncPendingDrafts, 1500);
    };

    window.addEventListener('online', handleOnline);

    // Induláskor is szinkronizáljunk ha online vagyunk
    if (navigator.onLine) {
      syncPendingDrafts();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, []);
}
