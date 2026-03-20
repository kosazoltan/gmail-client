import { useMemo } from 'react';
import { useAccounts } from '../../hooks/useAccounts';
import { useSettings, useUpdateSetting, defaultSettings } from '../../hooks/useSettings';
import type { Account } from '../../types';

export function SignatureSettings() {
  const { data: accounts = [] } = useAccounts();
  const { data: settings } = useSettings();
  const updateSetting = useUpdateSetting();

  const signatures = useMemo(
    () => settings?.accountSignatures ?? defaultSettings.accountSignatures ?? {},
    [settings?.accountSignatures],
  );

  const handleSignatureChange = (accountId: string, value: string) => {
    updateSetting.mutate({
      key: 'accountSignatures',
      value: {
        ...signatures,
        [accountId]: value,
      },
    });
  };

  if (accounts.length === 0) {
    return (
      <p className="dark:text-dark-text-muted text-sm text-gray-500">Nincs csatlakoztatott fiók.</p>
    );
  }

  return (
    <div className="space-y-3">
      {accounts.map((account: Account) => {
        const accountId = account.id;
        const value = signatures[accountId] || '';

        return (
          <div
            key={accountId}
            className="dark:border-dark-border rounded-xl border border-gray-200 p-3"
          >
            <p className="dark:text-dark-text mb-2 text-sm font-medium text-gray-800">
              {account.email}
            </p>
            <div
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => handleSignatureChange(accountId, e.currentTarget.innerHTML)}
              className="dark:bg-dark-bg-tertiary dark:border-dark-border dark:text-dark-text min-h-[90px] rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-400"
              dangerouslySetInnerHTML={{ __html: value }}
            />
            <p className="dark:text-dark-text-muted mt-1 text-xs text-gray-400">
              Rich text támogatott. Mentés fókuszvesztéskor.
            </p>
          </div>
        );
      })}
    </div>
  );
}
