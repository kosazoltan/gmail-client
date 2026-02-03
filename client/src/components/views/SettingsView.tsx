import { Settings, MoveHorizontal, Send, Moon, Crown, Wrench } from 'lucide-react';
import { SwipeSettings } from '../settings/SwipeSettings';
import { UndoSendSettings } from '../settings/UndoSendSettings';
import { QuietHoursSettings } from '../settings/QuietHoursSettings';
import { VIPSettings } from '../settings/VIPSettings';
import { ToolbarSettings } from '../settings/ToolbarSettings';

export function SettingsView() {
  return (
    <div className="flex-1 overflow-auto bg-gray-50 dark:bg-dark-bg">
      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-100 dark:bg-blue-500/20 rounded-lg">
            <Settings className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-800 dark:text-dark-text">
              Beállítások
            </h1>
            <p className="text-sm text-gray-500 dark:text-dark-text-muted">
              Testreszabhatod az alkalmazás működését
            </p>
          </div>
        </div>

        {/* Settings sections */}
        <div className="space-y-6">
          {/* Swipe Settings */}
          <section className="bg-white dark:bg-dark-bg-secondary rounded-xl border border-gray-200 dark:border-dark-border p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <MoveHorizontal className="h-5 w-5 text-gray-500 dark:text-dark-text-muted" />
              <span className="text-sm font-medium text-gray-500 dark:text-dark-text-muted uppercase tracking-wider">
                Swipe műveletek
              </span>
            </div>
            <SwipeSettings />
          </section>

          {/* Undo Send Settings */}
          <section className="bg-white dark:bg-dark-bg-secondary rounded-xl border border-gray-200 dark:border-dark-border p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Send className="h-5 w-5 text-gray-500 dark:text-dark-text-muted" />
              <span className="text-sm font-medium text-gray-500 dark:text-dark-text-muted uppercase tracking-wider">
                Email küldés
              </span>
            </div>
            <UndoSendSettings />
          </section>

          {/* Quiet Hours Settings */}
          <section className="bg-white dark:bg-dark-bg-secondary rounded-xl border border-gray-200 dark:border-dark-border p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Moon className="h-5 w-5 text-gray-500 dark:text-dark-text-muted" />
              <span className="text-sm font-medium text-gray-500 dark:text-dark-text-muted uppercase tracking-wider">
                Értesítések
              </span>
            </div>
            <QuietHoursSettings />
          </section>

          {/* VIP Settings */}
          <section className="bg-white dark:bg-dark-bg-secondary rounded-xl border border-gray-200 dark:border-dark-border p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Crown className="h-5 w-5 text-gray-500 dark:text-dark-text-muted" />
              <span className="text-sm font-medium text-gray-500 dark:text-dark-text-muted uppercase tracking-wider">
                VIP küldők
              </span>
            </div>
            <VIPSettings />
          </section>

          {/* Toolbar Settings */}
          <section className="bg-white dark:bg-dark-bg-secondary rounded-xl border border-gray-200 dark:border-dark-border p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Wrench className="h-5 w-5 text-gray-500 dark:text-dark-text-muted" />
              <span className="text-sm font-medium text-gray-500 dark:text-dark-text-muted uppercase tracking-wider">
                Eszköztár
              </span>
            </div>
            <ToolbarSettings />
          </section>
        </div>

        {/* Footer info */}
        <div className="mt-8 text-center text-xs text-gray-400 dark:text-dark-text-muted">
          <p>A beállítások automatikusan mentődnek.</p>
        </div>
      </div>
    </div>
  );
}
