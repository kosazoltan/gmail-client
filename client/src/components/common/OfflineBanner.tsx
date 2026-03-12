import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { getPendingDrafts } from '../../lib/offline-store';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (isOnline) {
      return;
    }

    // Offline módban ellenőrizzük a pending piszkozatokat
    const checkPending = async () => {
      try {
        const pending = await getPendingDrafts();
        setPendingCount(pending.length);
      } catch {
        // IndexedDB hiba — nem kritikus
      }
    };

    checkPending();
    const interval = setInterval(checkPending, 5000);
    return () => clearInterval(interval);
  }, [isOnline]);

  if (isOnline) return null;

  return (
    <div className="flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
      <WifiOff className="h-4 w-4" />
      <span>
        ⚡ Offline mód
        {pendingCount > 0
          ? ` — ${pendingCount} piszkozat küldésre vár`
          : ' — a piszkozataid mentve vannak'}
      </span>
    </div>
  );
}
