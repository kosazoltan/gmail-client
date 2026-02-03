import { Moon, Clock, Calendar } from 'lucide-react';
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
        <h3 className="text-lg font-medium text-gray-800 dark:text-dark-text mb-1">
          Csendes órák
        </h3>
        <p className="text-sm text-gray-500 dark:text-dark-text-muted mb-4">
          A megadott időszakban nem kapsz push értesítéseket az új levelekről.
        </p>
      </div>

      {/* Enable toggle */}
      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-dark-bg rounded-lg">
        <div className="flex items-center gap-3">
          <Moon className="h-5 w-5 text-indigo-500" />
          <div>
            <div className="font-medium text-gray-800 dark:text-dark-text">
              Csendes mód
            </div>
            <div className="text-sm text-gray-500 dark:text-dark-text-muted">
              Értesítések némítása
            </div>
          </div>
        </div>
        <button
          onClick={handleToggle}
          disabled={updateSetting.isPending}
          className={cn(
            'relative w-12 h-6 rounded-full transition-colors',
            enabled
              ? 'bg-indigo-500'
              : 'bg-gray-300 dark:bg-dark-bg-tertiary',
          )}
        >
          <span
            className={cn(
              'absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform',
              enabled && 'translate-x-6',
            )}
          />
        </button>
      </div>

      {/* Time settings */}
      {enabled && (
        <div className="space-y-4 pl-4 border-l-2 border-indigo-200 dark:border-indigo-800">
          {/* Time range */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm text-gray-500 dark:text-dark-text-muted mb-1">
                <Clock className="inline h-4 w-4 mr-1" />
                Kezdés
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                disabled={updateSetting.isPending}
                className="w-full px-3 py-2 border border-gray-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg-secondary text-gray-800 dark:text-dark-text text-sm disabled:opacity-50"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm text-gray-500 dark:text-dark-text-muted mb-1">
                <Clock className="inline h-4 w-4 mr-1" />
                Befejezés
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => handleEndTimeChange(e.target.value)}
                disabled={updateSetting.isPending}
                className="w-full px-3 py-2 border border-gray-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg-secondary text-gray-800 dark:text-dark-text text-sm disabled:opacity-50"
              />
            </div>
          </div>

          {/* Weekend only */}
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-bg rounded-lg">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500 dark:text-dark-text-muted" />
              <span className="text-sm text-gray-700 dark:text-dark-text-secondary">
                Csak hétvégén
              </span>
            </div>
            <button
              onClick={handleWeekendOnlyToggle}
              disabled={updateSetting.isPending}
              className={cn(
                'relative w-10 h-5 rounded-full transition-colors',
                weekendOnly
                  ? 'bg-indigo-500'
                  : 'bg-gray-300 dark:bg-dark-bg-tertiary',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform',
                  weekendOnly && 'translate-x-5',
                )}
              />
            </button>
          </div>

          {/* Info */}
          <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg text-sm text-indigo-700 dark:text-indigo-300">
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

      <div className="text-xs text-gray-400 dark:text-dark-text-muted pt-2 border-t border-gray-100 dark:border-dark-border">
        Megjegyzés: Ez a beállítás csak a push értesítésekre vonatkozik. Az emailek továbbra is megérkeznek és láthatóak lesznek az alkalmazásban.
      </div>
    </div>
  );
}
