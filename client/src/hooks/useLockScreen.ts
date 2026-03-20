import { useCallback, useEffect, useRef, useState } from 'react';

const PIN_STORAGE_KEY = 'zmail.lock.pinHash';
const LOCK_TIMEOUT_KEY = 'zmail.lock.timeoutMinutes';
const AUTO_LOCK_ENABLED_KEY = 'zmail.lock.autoEnabled';

async function sha256(value: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function getStoredTimeoutMinutes(): number {
  const raw = Number(localStorage.getItem(LOCK_TIMEOUT_KEY));
  if (!Number.isFinite(raw) || raw <= 0) return 5;
  return raw;
}

function getStoredAutoLockEnabled(): boolean {
  const raw = localStorage.getItem(AUTO_LOCK_ENABLED_KEY);
  return raw === null ? true : raw === 'true';
}

export function useLockScreen() {
  const [isLocked, setIsLocked] = useState(false);
  const [lockTimeoutMinutes, setLockTimeoutMinutesState] = useState(getStoredTimeoutMinutes);
  const [autoLockEnabled, setAutoLockEnabledState] = useState(getStoredAutoLockEnabled);
  const [hasPin, setHasPin] = useState(() => !!localStorage.getItem(PIN_STORAGE_KEY));
  const timerRef = useRef<number | null>(null);

  const clearExistingTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const lockNow = useCallback(() => {
    if (!localStorage.getItem(PIN_STORAGE_KEY)) return;
    setIsLocked(true);
  }, []);

  const resetTimer = useCallback(() => {
    clearExistingTimer();
    if (!autoLockEnabled || !localStorage.getItem(PIN_STORAGE_KEY) || isLocked) return;

    timerRef.current = window.setTimeout(
      () => {
        setIsLocked(true);
      },
      lockTimeoutMinutes * 60 * 1000,
    );
  }, [autoLockEnabled, clearExistingTimer, isLocked, lockTimeoutMinutes]);

  const setLockTimeoutMinutes = useCallback((minutes: number) => {
    const safeMinutes = Math.max(1, Math.min(120, Math.round(minutes)));
    localStorage.setItem(LOCK_TIMEOUT_KEY, String(safeMinutes));
    setLockTimeoutMinutesState(safeMinutes);
  }, []);

  const setAutoLockEnabled = useCallback((enabled: boolean) => {
    localStorage.setItem(AUTO_LOCK_ENABLED_KEY, String(enabled));
    setAutoLockEnabledState(enabled);
  }, []);

  const setPin = useCallback(
    async (pin: string) => {
      const hash = await sha256(pin);
      localStorage.setItem(PIN_STORAGE_KEY, hash);
      setHasPin(true);
      setIsLocked(false);
      resetTimer();
    },
    [resetTimer],
  );

  const unlock = useCallback(
    async (pin: string) => {
      const storedHash = localStorage.getItem(PIN_STORAGE_KEY);
      if (!storedHash) {
        setIsLocked(false);
        return true;
      }

      const inputHash = await sha256(pin);
      const ok = inputHash === storedHash;
      if (ok) {
        setIsLocked(false);
        resetTimer();
      }
      return ok;
    },
    [resetTimer],
  );

  const clearPin = useCallback(() => {
    localStorage.removeItem(PIN_STORAGE_KEY);
    setHasPin(false);
    setIsLocked(false);
    clearExistingTimer();
  }, [clearExistingTimer]);

  useEffect(() => {
    const handler = () => resetTimer();
    const events: Array<keyof WindowEventMap> = ['mousemove', 'mousedown', 'keydown', 'touchstart'];

    for (const event of events) {
      window.addEventListener(event, handler, { passive: true });
    }

    resetTimer();

    return () => {
      for (const event of events) {
        window.removeEventListener(event, handler);
      }
      clearExistingTimer();
    };
  }, [clearExistingTimer, resetTimer]);

  useEffect(() => {
    if (!autoLockEnabled) {
      clearExistingTimer();
      return;
    }
    resetTimer();
  }, [autoLockEnabled, clearExistingTimer, lockTimeoutMinutes, resetTimer]);

  return {
    isLocked,
    hasPin,
    autoLockEnabled,
    lockTimeoutMinutes,
    unlock,
    setPin,
    clearPin,
    lockNow,
    setAutoLockEnabled,
    setLockTimeoutMinutes,
  };
}
