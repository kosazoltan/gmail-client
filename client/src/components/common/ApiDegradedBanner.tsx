import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import {
  getApiDegradationState,
  probeApiRecovery,
  subscribeApiDegradation,
  type ApiDegradationState,
} from '../../lib/api';

function remainingSeconds(retryAt: number | null): number {
  if (!retryAt) return 0;
  const ms = Math.max(0, retryAt - Date.now());
  return Math.ceil(ms / 1000);
}

export function ApiDegradedBanner() {
  const [state, setState] = useState<ApiDegradationState>(() => getApiDegradationState());
  const [isProbing, setIsProbing] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => subscribeApiDegradation(setState), []);

  useEffect(() => {
    if (!state.isDegraded) return;

    const ticker = setInterval(() => {
      setTick((x) => x + 1);
    }, 1000);

    return () => clearInterval(ticker);
  }, [state.isDegraded]);

  const secondsLeft = state.isDegraded ? remainingSeconds(state.retryAt) : 0;

  useEffect(() => {
    if (!state.isDegraded || secondsLeft > 0) return;

    const timer = setTimeout(() => {
      void probeApiRecovery();
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [state.isDegraded, secondsLeft]);

  if (!state.isDegraded) return null;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-orange-200 bg-orange-50 px-4 py-2 text-sm text-orange-800 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300">
      <div className="flex min-w-0 items-center gap-2">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        <span className="truncate">
          API atmenetileg nem elerheto. Automatikus ujraproba
          {secondsLeft > 0 ? ` ${secondsLeft}s mulva` : ' folyamatban'}.
        </span>
      </div>

      <button
        onClick={() => {
          if (isProbing) return;
          setIsProbing(true);
          void probeApiRecovery().finally(() => setIsProbing(false));
        }}
        disabled={isProbing}
        className="inline-flex items-center gap-1 rounded-md border border-orange-300 bg-white/70 px-2 py-1 text-xs font-medium text-orange-700 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-orange-400/30 dark:bg-orange-500/10 dark:text-orange-200 dark:hover:bg-orange-500/20"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isProbing ? 'animate-spin' : ''}`} />
        Ujraproba
      </button>
    </div>
  );
}
