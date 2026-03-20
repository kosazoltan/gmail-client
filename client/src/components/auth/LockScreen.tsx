import { useState } from 'react';
import { ZMailLogo } from '../common/ZMailLogo';

interface LockScreenProps {
  onUnlock: (pin: string) => Promise<boolean>;
}

export function LockScreen({ onUnlock }: LockScreenProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!/^\d{4,6}$/.test(pin)) return;
    setBusy(true);
    const ok = await onUnlock(pin);
    setBusy(false);
    if (!ok) {
      setError(true);
      setTimeout(() => setError(false), 500);
      return;
    }
    setPin('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div
        className={`dark:border-dark-border dark:bg-dark-bg-secondary w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl ${error ? 'animate-[shake_0.3s_ease-in-out]' : ''}`}
      >
        <div className="mb-6 flex flex-col items-center gap-2">
          <ZMailLogo size={40} className="sm:h-14 sm:w-14" />
          <h2 className="dark:text-dark-text text-xl font-semibold text-gray-900">
            Alkalmazás zárolva
          </h2>
          <p className="dark:text-dark-text-muted text-sm text-gray-500">
            Add meg a PIN-kódot a folytatáshoz
          </p>
        </div>

        <input
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, ''));
            if (error) setError(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
          placeholder="PIN (4-6 számjegy)"
          className="dark:border-dark-border dark:bg-dark-bg dark:text-dark-text dark:placeholder-dark-text-muted w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-center text-lg tracking-[0.45em] text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
          autoFocus
        />

        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">Hibás PIN</p>}

        <button
          onClick={() => void submit()}
          disabled={busy || !/^\d{4,6}$/.test(pin)}
          className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Ellenőrzés…' : 'Feloldás'}
        </button>
      </div>
    </div>
  );
}
