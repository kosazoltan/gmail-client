import { lazy, Suspense, useState } from 'react';
import {
  Settings,
  MoveHorizontal,
  Send,
  Moon,
  Crown,
  Wrench,
  LayoutGrid,
  Palette,
  Signature,
  Mail,
  Shield,
} from 'lucide-react';
import { useLockScreen } from '../../hooks/useLockScreen';
import { SwipeSettings } from '../settings/SwipeSettings';
import { UndoSendSettings } from '../settings/UndoSendSettings';
import { QuietHoursSettings } from '../settings/QuietHoursSettings';
import { VIPSettings } from '../settings/VIPSettings';
import { ToolbarSettings } from '../settings/ToolbarSettings';
import { InboxRulesSettings } from '../settings/InboxRulesSettings';
import { NotificationPreferences } from '../settings/NotificationPreferences';

const DensitySettings = lazy(() =>
  import('../settings/DensitySettings').then((m) => ({ default: m.DensitySettings })),
);
const AccountColorSettings = lazy(() =>
  import('../settings/AccountColorSettings').then((m) => ({ default: m.AccountColorSettings })),
);
const SignatureSettings = lazy(() =>
  import('../settings/SignatureSettings').then((m) => ({ default: m.SignatureSettings })),
);

export function SettingsView() {
  const lock = useLockScreen();
  const [pin, setPin] = useState('');

  return (
    <div className="dark:bg-dark-bg flex-1 overflow-auto bg-gray-50">
      <div className="mx-auto max-w-full p-3 sm:p-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-500/20">
            <Settings className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="dark:text-dark-text text-xl font-semibold text-gray-800">Beállítások</h1>
            <p className="dark:text-dark-text-muted text-sm text-gray-500">
              Testreszabhatod az alkalmazás működését
            </p>
          </div>
        </div>

        {/* Settings sections */}
        <div className="space-y-6">
          {/* Swipe Settings */}
          <section className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <MoveHorizontal className="dark:text-dark-text-muted h-5 w-5 text-gray-500" />
              <span className="dark:text-dark-text-muted text-sm font-medium tracking-wider text-gray-500 uppercase">
                Swipe műveletek
              </span>
            </div>
            <SwipeSettings />
          </section>

          {/* Undo Send Settings */}
          <section className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <Send className="dark:text-dark-text-muted h-5 w-5 text-gray-500" />
              <span className="dark:text-dark-text-muted text-sm font-medium tracking-wider text-gray-500 uppercase">
                Email küldés
              </span>
            </div>
            <UndoSendSettings />
          </section>

          {/* Quiet Hours Settings */}
          <section className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <Moon className="dark:text-dark-text-muted h-5 w-5 text-gray-500" />
              <span className="dark:text-dark-text-muted text-sm font-medium tracking-wider text-gray-500 uppercase">
                Értesítések
              </span>
            </div>
            <QuietHoursSettings />
            <div className="dark:border-dark-border mt-4 border-t border-gray-200 pt-4">
              <NotificationPreferences />
            </div>
          </section>

          {/* VIP Settings */}
          <section className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <Crown className="dark:text-dark-text-muted h-5 w-5 text-gray-500" />
              <span className="dark:text-dark-text-muted text-sm font-medium tracking-wider text-gray-500 uppercase">
                VIP küldők
              </span>
            </div>
            <VIPSettings />
          </section>

          {/* Toolbar Settings */}
          <section className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <Wrench className="dark:text-dark-text-muted h-5 w-5 text-gray-500" />
              <span className="dark:text-dark-text-muted text-sm font-medium tracking-wider text-gray-500 uppercase">
                Eszköztár
              </span>
            </div>
            <ToolbarSettings />
          </section>

          <section className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <LayoutGrid className="dark:text-dark-text-muted h-5 w-5 text-gray-500" />
              <span className="dark:text-dark-text-muted text-sm font-medium tracking-wider text-gray-500 uppercase">
                Nézet
              </span>
            </div>
            <Suspense
              fallback={
                <p className="dark:text-dark-text-muted text-sm text-gray-500">Betöltés...</p>
              }
            >
              <DensitySettings />
            </Suspense>
          </section>

          <section className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <Palette className="dark:text-dark-text-muted h-5 w-5 text-gray-500" />
              <span className="dark:text-dark-text-muted text-sm font-medium tracking-wider text-gray-500 uppercase">
                Fiók színek
              </span>
            </div>
            <Suspense
              fallback={
                <p className="dark:text-dark-text-muted text-sm text-gray-500">Betöltés...</p>
              }
            >
              <AccountColorSettings />
            </Suspense>
          </section>

          <section className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <Signature className="dark:text-dark-text-muted h-5 w-5 text-gray-500" />
              <span className="dark:text-dark-text-muted text-sm font-medium tracking-wider text-gray-500 uppercase">
                Aláírások
              </span>
            </div>
            <Suspense
              fallback={
                <p className="dark:text-dark-text-muted text-sm text-gray-500">Betöltés...</p>
              }
            >
              <SignatureSettings />
            </Suspense>
          </section>
          <section className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <Shield className="dark:text-dark-text-muted h-5 w-5 text-gray-500" />
              <span className="dark:text-dark-text-muted text-sm font-medium tracking-wider text-gray-500 uppercase">
                Biztonság
              </span>
            </div>
            <div className="space-y-3 text-sm">
              <label className="flex items-center justify-between gap-3">
                <span className="dark:text-dark-text">Automatikus zárolás</span>
                <input
                  type="checkbox"
                  checked={lock.autoLockEnabled}
                  onChange={(e) => lock.setAutoLockEnabled(e.target.checked)}
                />
              </label>

              <label className="flex items-center justify-between gap-3">
                <span className="dark:text-dark-text">Timeout (perc)</span>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={lock.lockTimeoutMinutes}
                  onChange={(e) => lock.setLockTimeoutMinutes(Number(e.target.value || 5))}
                  className="dark:border-dark-border dark:bg-dark-bg dark:text-dark-text w-full rounded border border-gray-300 px-2 py-2 sm:w-24"
                />
              </label>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="password"
                  inputMode="numeric"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Új PIN (4-6 számjegy)"
                  className="dark:border-dark-border dark:bg-dark-bg dark:text-dark-text dark:placeholder-dark-text-muted rounded border border-gray-300 px-2 py-1"
                />
                <button
                  onClick={() => {
                    if (/^\d{4,6}$/.test(pin)) {
                      void lock.setPin(pin);
                      setPin('');
                    }
                  }}
                  className="dark:hover:bg-dark-bg-tertiary rounded bg-blue-600 px-3 py-1 text-white"
                >
                  PIN mentése
                </button>
                <button
                  onClick={lock.clearPin}
                  className="dark:border-dark-border dark:hover:bg-dark-bg-tertiary rounded border border-gray-300 px-3 py-1"
                >
                  PIN törlése
                </button>
                <button
                  onClick={lock.lockNow}
                  className="dark:border-dark-border dark:hover:bg-dark-bg-tertiary rounded border border-gray-300 px-3 py-1"
                >
                  Zárolás most
                </button>
              </div>
            </div>
          </section>

          <section className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <Mail className="dark:text-dark-text-muted h-5 w-5 text-gray-500" />
              <span className="dark:text-dark-text-muted text-sm font-medium tracking-wider text-gray-500 uppercase">
                Bejövő levelek szabályai
              </span>
            </div>
            <InboxRulesSettings />
          </section>
        </div>

        {/* Footer info */}
        <div className="dark:text-dark-text-muted mt-8 text-center text-xs text-gray-400">
          <p>A beállítások automatikusan mentődnek.</p>
        </div>
      </div>
    </div>
  );
}
