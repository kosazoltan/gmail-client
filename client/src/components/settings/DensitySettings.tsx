import { useSettings, useUpdateSetting, defaultSettings } from '../../hooks/useSettings';
import type { UserSettings } from '../../types';

type DensityMode = NonNullable<UserSettings['messageDensity']>;

const OPTIONS: Array<{ value: DensityMode; title: string; description: string }> = [
  {
    value: 'compact',
    title: 'Kompakt',
    description: 'Kisebb térköz, egysoros feladó+tárgy, előnézet nélkül.',
  },
  {
    value: 'normal',
    title: 'Normál',
    description: 'Alapértelmezett lista megjelenés.',
  },
  {
    value: 'comfortable',
    title: 'Kényelmes',
    description: 'Nagyobb betűk és 2 soros előnézet.',
  },
];

export function DensitySettings() {
  const { data: settings } = useSettings();
  const updateSetting = useUpdateSetting();

  const currentDensity = settings?.messageDensity ?? defaultSettings.messageDensity ?? 'normal';
  const conversationView = settings?.conversationView ?? defaultSettings.conversationView ?? true;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="dark:text-dark-text text-sm font-medium text-gray-800">Üzenetsűrűség</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => updateSetting.mutate({ key: 'messageDensity', value: option.value })}
              className={`rounded-xl border p-3 text-left transition-colors ${
                currentDensity === option.value
                  ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-500/10'
                  : 'dark:border-dark-border dark:hover:bg-dark-bg-tertiary border-gray-200 hover:bg-gray-50'
              }`}
            >
              <p className="dark:text-dark-text text-sm font-medium text-gray-800">
                {option.title}
              </p>
              <p className="dark:text-dark-text-muted mt-1 text-xs text-gray-500">
                {option.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="dark:border-dark-border rounded-xl border border-gray-200 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="dark:text-dark-text text-sm font-medium text-gray-800">
              Beszélgetés nézet
            </p>
            <p className="dark:text-dark-text-muted text-xs text-gray-500">
              Csoportosítás thread szerint be/ki.
            </p>
          </div>
          <button
            onClick={() =>
              updateSetting.mutate({ key: 'conversationView', value: !conversationView })
            }
            className={`relative h-6 w-12 rounded-full transition-colors ${
              conversationView ? 'bg-blue-500' : 'dark:bg-dark-border bg-gray-300'
            }`}
            aria-label="Beszélgetés nézet kapcsoló"
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                conversationView ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
