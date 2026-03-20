import { Moon, Clock, Calendar } from 'lucide-react';
// responsive-tuned: mobile-first touch sizing
import { useSettings, useUpdateSetting, defaultSettings } from '../../hooks/useSettings';
import { cn } from '../../lib/utils';

export function QuietHoursSettings() {
  const { data: settings } = useSettings();
  const updateSetting = useUpdateSetting();

  const enabled = settings?.quietHoursEnabled ?? defaultSettings.quietHoursEnabled;
  const startTime = settings?.quietHoursStart ?? defaultSettings.quietHoursStart;
  const endTime = settings?.quietHoursEnd ?? defaultSettings.quietHoursEnd;
  const weekendOnly = settings?.quietHoursWeekendOnly ?? defaultSettings.quietHoursWeekendOnly;

  const handleToggle = () => {
    updateSetting.mutate({ key: 'quietHoursEnabled', value: !enabled });
  };

  const handleStartTimeChange = (time: string) => {
    updateSetting.mutate({ key: 'quietHoursStart', value: time });
  };

  const handleEndTimeChange = (time: string) => {
    updateSetting.mutate({ key: 'quietHoursEnd', value: time });
  };

  const handleWeekendOnlyToggle = () => {
    updateSetting.mutate({ key: 'quietHoursWeekendOnly', value: !weekendOnly });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="dark:text-dark-text mb-1 text-lg font-medium text-gray-800">Csendes órák</h3>
        <p className="dark:text-dark-text-muted mb-4 text-sm text-gray-500">
          A megadott időszakban nem kapsz push értesítéseket az új levelekről.
        </p>
      </div>

      {/* Enable toggle */}
      <div className="dark:bg-dark-bg flex items-center justify-between rounded-lg bg-gray-50 p-4">
        <div className="flex items-center gap-3">
          <Moon className="h-5 w-5 text-[#4f6ef7]" />
          <div>
            <div className="dark:text-dark-text font-medium text-gray-800">Csendes mód</div>
            <div className="dark:text-dark-text-muted text-sm text-gray-500">
              Értesítések némítása
            </div>
          </div>
        </div>
        <button
          onClick={handleToggle}
          disabled={updateSetting.isPending}
          className={cn(
            'relative h-6 w-12 rounded-full transition-colors',
            enabled ? 'bg-[#4f6ef7]' : 'dark:bg-dark-bg-tertiary bg-gray-300',
          )}
        >
          <span
            className={cn(
              'absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition-transform',
              enabled && 'translate-x-6',
            )}
          />
        </button>
      </div>

      {/* Time settings */}
      {enabled && (
        <div className="space-y-4 border-l-2 border-[#4f6ef7]/30 pl-4 dark:border-[#4f6ef7]/40">
          {/* Time range */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="dark:text-dark-text-muted mb-1 block text-sm text-gray-500">
                <Clock className="mr-1 inline h-4 w-4" />
                Kezdés
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                disabled={updateSetting.isPending}
                className="dark:border-dark-border dark:bg-dark-bg-secondary dark:text-dark-text w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 disabled:opacity-50"
              />
            </div>
            <div className="flex-1">
              <label className="dark:text-dark-text-muted mb-1 block text-sm text-gray-500">
                <Clock className="mr-1 inline h-4 w-4" />
                Befejezés
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => handleEndTimeChange(e.target.value)}
                disabled={updateSetting.isPending}
                className="dark:border-dark-border dark:bg-dark-bg-secondary dark:text-dark-text w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 disabled:opacity-50"
              />
            </div>
          </div>

          {/* Weekend only */}
          <div className="dark:bg-dark-bg flex items-center justify-between rounded-lg bg-gray-50 p-3">
            <div className="flex items-center gap-2">
              <Calendar className="dark:text-dark-text-muted h-4 w-4 text-gray-500" />
              <span className="dark:text-dark-text-secondary text-sm text-gray-700">
                Csak hétvégén
              </span>
            </div>
            <button
              onClick={handleWeekendOnlyToggle}
              disabled={updateSetting.isPending}
              className={cn(
                'relative h-5 w-10 rounded-full transition-colors',
                weekendOnly ? 'bg-[#4f6ef7]' : 'dark:bg-dark-bg-tertiary bg-gray-300',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform',
                  weekendOnly && 'translate-x-5',
                )}
              />
            </button>
          </div>

          {/* Info */}
          <div className="rounded-lg bg-[#4f6ef7]/10 p-3 text-sm text-[#4f6ef7] dark:bg-[#4f6ef7]/10 dark:text-[#8b9ff7]">
            <p>
              {weekendOnly ? (
                <>
                  Hétvégéken {startTime} és {endTime} között nem kapsz értesítéseket.
                </>
              ) : (
                <>
                  Minden nap {startTime} és {endTime} között nem kapsz értesítéseket.
                </>
              )}
            </p>
          </div>
        </div>
      )}

      <div className="dark:text-dark-text-muted dark:border-dark-border border-t border-gray-100 pt-2 text-xs text-gray-400">
        Megjegyzés: Ez a beállítás csak a push értesítésekre vonatkozik. Az emailek továbbra is
        megérkeznek és láthatóak lesznek az alkalmazásban.
      </div>
    </div>
  );
}
