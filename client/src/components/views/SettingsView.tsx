import { Settings, MoveHorizontal, Send, Moon, Crown, Wrench } from 'lucide-react';
import { SwipeSettings } from '../settings/SwipeSettings';
import { UndoSendSettings } from '../settings/UndoSendSettings';
import { QuietHoursSettings } from '../settings/QuietHoursSettings';
import { VIPSettings } from '../settings/VIPSettings';
import { ToolbarSettings } from '../settings/ToolbarSettings';

export function SettingsView() {
  return (
    <div className="dark:bg-dark-bg flex-1 overflow-auto bg-gray-50">
      <div className="mx-auto max-w-3xl p-4 sm:p-6">
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
        </div>

        {/* Footer info */}
        <div className="dark:text-dark-text-muted mt-8 text-center text-xs text-gray-400">
          <p>A beállítások automatikusan mentődnek.</p>
        </div>
      </div>
    </div>
  );
}
