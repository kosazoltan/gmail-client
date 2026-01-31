import { useState } from 'react';
import {
  useSession,
  useLogin,
  useLogout,
  useSwitchAccount,
} from '../../hooks/useAccounts';
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
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
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
    <div className="flex items-center gap-1 relative">
      {/* Bejelentkezett fiókok */}
      {session.accounts.map((account) => {
        const isActive = account.id === session.activeAccountId;
        return (
          <button
            key={account.id}
            onClick={() => handleAccountClick(account.id)}
            className={cn(
              'relative w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-medium transition-all flex-shrink-0',
              isActive
                ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-dark-bg-secondary'
                : 'opacity-60 hover:opacity-100 hover:scale-105',
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
        className="w-9 h-9 rounded-full flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-dark-border text-gray-400 dark:text-dark-text-muted hover:border-blue-400 hover:text-blue-500 dark:hover:border-blue-400 dark:hover:text-blue-400 transition-colors flex-shrink-0"
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

          <div className="absolute right-0 top-full mt-2 z-50 bg-white dark:bg-dark-bg-secondary rounded-xl shadow-lg border border-gray-200 dark:border-dark-border py-2 min-w-[200px]">
            {/* Fiók info */}
            {(() => {
              const account = session.accounts.find(a => a.id === dropdownAccountId);
              if (!account) return null;
              return (
                <div className="px-4 py-2 border-b border-gray-100 dark:border-dark-border">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0"
                      style={{ backgroundColor: emailToColor(account.email) }}
                    >
                      {getInitials(account.name || account.email)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-dark-text truncate">
                        {account.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-dark-text-secondary truncate">
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
              className="flex items-center gap-2 w-full px-4 py-2.5 hover:bg-red-50 dark:hover:bg-red-500/10 text-sm text-red-600 dark:text-red-400 transition-colors"
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
              className="flex items-center gap-2 w-full px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary text-sm text-gray-500 dark:text-dark-text-secondary transition-colors"
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
