import { useSettings, useUpdateSetting, defaultSettings } from '../../hooks/useSettings';

const DELAY_OPTIONS = [
  { value: 0, label: 'Kikapcsolva' },
  { value: 5, label: '5 másodperc' },
  { value: 10, label: '10 másodperc' },
  { value: 15, label: '15 másodperc' },
  { value: 20, label: '20 másodperc' },
  { value: 30, label: '30 másodperc' },
];

export function UndoSendSettings() {
  const { data: settings } = useSettings();
  const updateSetting = useUpdateSetting();

  const currentDelay = settings?.undoSendDelay ?? defaultSettings.undoSendDelay;

  const handleDelayChange = (delay: number) => {
    updateSetting.mutate({ key: 'undoSendDelay', value: delay });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="dark:text-dark-text mb-1 text-lg font-medium text-gray-800">
          Küldés visszavonása
        </h3>
        <p className="dark:text-dark-text-muted mb-4 text-sm text-gray-500">
          Az email küldése után ennyi ideig tudod visszavonni a küldést.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {DELAY_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => handleDelayChange(option.value)}
            disabled={updateSetting.isPending}
            className={`rounded-lg border px-4 py-3 text-sm transition-colors ${
              currentDelay === option.value
                ? 'border-blue-500 bg-blue-50 font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
                : 'dark:border-dark-border dark:text-dark-text-secondary dark:hover:bg-dark-bg-tertiary border-gray-200 text-gray-700 hover:bg-gray-50'
            } disabled:opacity-50`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {(currentDelay ?? 0) > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-500/10">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Amikor email küldésre kattintasz, {currentDelay} másodperced lesz a visszavonásra. Ez
            alatt az idő alatt megjelenik egy "Visszavonás" gomb, amire kattintva visszatérhetsz a
            szerkesztőbe.
          </p>
        </div>
      )}
    </div>
  );
}
