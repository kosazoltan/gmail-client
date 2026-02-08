import { useState } from 'react';
import { useSession, useLogin, useLogout, useSwitchAccount } from '../../hooks/useAccounts';
import { getInitials, emailToColor, cn } from '../../lib/utils';
import { Plus, LogOut, X, LogIn } from 'lucide-react';

export function HeaderAccountSwitcher() {
  const { data: session } = useSession();
  const login = useLogin();
  const logout = useLogout();
  const switchAccount = useSwitchAccount();
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownAccountId, setDropdownAccountId] = useState<string | null>(null);

  // Ha nincs bejelentkezve, mutassunk bejelentkezés gombot
  if (!session?.authenticated) {
    return (
      <button
        onClick={() => login.mutate()}
        className="flex items-center gap-2 rounded-full bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        title="Bejelentkezés Google fiókkal"
      >
        <LogIn className="h-4 w-4" />
        <span className="hidden sm:inline">Bejelentkezés</span>
      </button>
    );
  }

  const handleAccountClick = (accountId: string) => {
    if (accountId === session.activeAccountId) {
      // Ha az aktív fiókra kattintunk, mutassuk a dropdown-t
      setDropdownAccountId(accountId);
      setShowDropdown(true);
    } else {
      // Váltsunk a fiókra
      switchAccount.mutate(accountId);
    }
  };

  const handleLogout = (accountId: string) => {
    logout.mutate(accountId);
    setShowDropdown(false);
    setDropdownAccountId(null);
  };

  return (
    <div className="relative flex items-center gap-1">
      {/* Bejelentkezett fiókok */}
      {session.accounts.map((account) => {
        const isActive = account.id === session.activeAccountId;
        return (
          <button
            key={account.id}
            onClick={() => handleAccountClick(account.id)}
            className={cn(
              'relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-medium text-white transition-all',
              isActive
                ? 'dark:ring-offset-dark-bg-secondary ring-2 ring-blue-500 ring-offset-2'
                : 'opacity-60 hover:scale-105 hover:opacity-100',
            )}
            style={{ backgroundColor: emailToColor(account.email) }}
            title={`${account.name || account.email}${isActive ? ' (aktív)' : ''}`}
          >
            {getInitials(account.name || account.email)}
          </button>
        );
      })}

      {/* Fiók hozzáadása gomb */}
      <button
        onClick={() => login.mutate()}
        className="dark:border-dark-border dark:text-dark-text-muted flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border-2 border-dashed border-gray-300 text-gray-400 transition-colors hover:border-blue-400 hover:text-blue-500 dark:hover:border-blue-400 dark:hover:text-blue-400"
        title="Fiók hozzáadása"
      >
        <Plus className="h-4 w-4" />
      </button>

      {/* Dropdown az aktív fiókhoz */}
      {showDropdown && dropdownAccountId && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setShowDropdown(false);
              setDropdownAccountId(null);
            }}
          />

          <div className="dark:bg-dark-bg-secondary dark:border-dark-border absolute top-full right-0 z-50 mt-2 min-w-[200px] rounded-xl border border-gray-200 bg-white py-2 shadow-lg">
            {/* Fiók info */}
            {(() => {
              const account = session.accounts.find((a) => a.id === dropdownAccountId);
              if (!account) return null;
              return (
                <div className="dark:border-dark-border border-b border-gray-100 px-4 py-2">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-medium text-white"
                      style={{ backgroundColor: emailToColor(account.email) }}
                    >
                      {getInitials(account.name || account.email)}
                    </div>
                    <div className="min-w-0">
                      <div className="dark:text-dark-text truncate text-sm font-medium text-gray-900">
                        {account.name}
                      </div>
                      <div className="dark:text-dark-text-secondary truncate text-xs text-gray-500">
                        {account.email}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Kijelentkezés */}
            <button
              onClick={() => handleLogout(dropdownAccountId)}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              <LogOut className="h-4 w-4" />
              Kijelentkezés
            </button>

            {/* Bezárás */}
            <button
              onClick={() => {
                setShowDropdown(false);
                setDropdownAccountId(null);
              }}
              className="dark:hover:bg-dark-bg-tertiary dark:text-dark-text-secondary flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-500 transition-colors hover:bg-gray-50"
            >
              <X className="h-4 w-4" />
              Bezárás
            </button>
          </div>
        </>
      )}
    </div>
  );
}
