import { useAccounts, useUpdateAccountColor } from '../../hooks/useAccounts';
import { useSettings, useUpdateSetting, defaultSettings } from '../../hooks/useSettings';
import type { Account } from '../../types';

const PRESET_COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#84CC16',
];

export function AccountColorSettings() {
  const { data: accounts = [] } = useAccounts();
  const { data: settings } = useSettings();
  const updateColor = useUpdateAccountColor();
  const updateSetting = useUpdateSetting();

  const savedColors = settings?.accountColors ?? defaultSettings.accountColors ?? {};

  const handleSetColor = (accountId: string, color: string) => {
    updateColor.mutate({ accountId, color });
    updateSetting.mutate({
      key: 'accountColors',
      value: {
        ...savedColors,
        [accountId]: color,
      },
    });
  };

  if (accounts.length === 0) {
    return (
      <p className="dark:text-dark-text-muted text-sm text-gray-500">Nincs beállítható fiók.</p>
    );
  }

  return (
    <div className="space-y-3">
      {accounts.map((account: Account) => {
        const accountId = account.id;
        const selectedColor =
          savedColors[accountId] || account.accountColor || account.color || '#3B82F6';

        return (
          <div
            key={accountId}
            className="dark:border-dark-border rounded-xl border border-gray-200 p-3"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: selectedColor }} />
              <span className="dark:text-dark-text text-sm font-medium text-gray-800">
                {account.email}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => handleSetColor(accountId, color)}
                  className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-105 ${
                    selectedColor === color
                      ? 'border-gray-900 dark:border-white'
                      : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                  title={`Szín: ${color}`}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
