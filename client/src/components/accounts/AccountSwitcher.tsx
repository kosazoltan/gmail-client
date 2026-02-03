import { useState } from 'react';
import {
  useSession,
  useLogin,
  useLogout,
  useSwitchAccount,
  useUpdateAccountColor,
} from '../../hooks/useAccounts';
import { getInitials, emailToColor, cn } from '../../lib/utils';
import { ChevronDown, Plus, LogOut, Check, Palette } from 'lucide-react';
import type { Account } from '../../types';

// Előre definiált színek
const PRESET_COLORS = [
  '#EF4444', // Piros
  '#F97316', // Narancs
  '#F59E0B', // Sárga
  '#84CC16', // Lime
  '#22C55E', // Zöld
  '#10B981', // Smaragd
  '#14B8A6', // Türkiz
  '#06B6D4', // Cián
  '#0EA5E9', // Égkék
  '#3B82F6', // Kék
  '#6366F1', // Indigo
  '#8B5CF6', // Lila
  '#A855F7', // Viola
  '#D946EF', // Fukszia
  '#EC4899', // Rózsaszín
  '#6B7280', // Szürke
];

// Fiók színének meghatározása - ha van saját szín, azt használja, különben generál
function getAccountColor(account: Account | undefined): string {
  if (!account) return '#6B7280';
  return account.color || emailToColor(account.email);
}

interface AccountSwitcherProps {
  compact?: boolean;
}

export function AccountSwitcher({ compact = false }: AccountSwitcherProps) {
  const { data: session } = useSession();
  const login = useLogin();
  const logout = useLogout();
  const switchAccount = useSwitchAccount();
  const [isOpen, setIsOpen] = useState(false);

  if (!session?.authenticated) return null;

  const activeAccount = session.accounts.find(
    (a) => a.id === session.activeAccountId,
  );

  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium mx-auto"
          style={{
            backgroundColor: getAccountColor(activeAccount),
          }}
        >
          {getInitials(activeAccount?.name || activeAccount?.email || '?')}
        </button>

        {isOpen && (
          <AccountDropdown
            session={session}
            onSwitch={(id) => {
              switchAccount.mutate(id);
              setIsOpen(false);
            }}
            onAdd={() => login.mutate()}
            onLogout={(id) => logout.mutate(id)}
            onClose={() => setIsOpen(false)}
            compact
          />
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full px-2 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary transition-colors"
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
          style={{
            backgroundColor: getAccountColor(activeAccount),
          }}
        >
          {getInitials(activeAccount?.name || activeAccount?.email || '?')}
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="text-sm font-medium text-gray-800 dark:text-dark-text truncate">
            {activeAccount?.name}
          </div>
          <div className="text-xs text-gray-400 dark:text-dark-text-muted truncate">
            {activeAccount?.email}
          </div>
        </div>
        <ChevronDown className="h-4 w-4 text-gray-400 dark:text-dark-text-muted flex-shrink-0" />
      </button>

      {isOpen && (
        <AccountDropdown
          session={session}
          onSwitch={(id) => {
            switchAccount.mutate(id);
            setIsOpen(false);
          }}
          onAdd={() => login.mutate()}
          onLogout={(id) => logout.mutate(id)}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

function AccountDropdown({
  session,
  onSwitch,
  onAdd,
  onLogout,
  onClose,
  compact,
}: {
  session: import('../../types').SessionInfo;
  onSwitch: (id: string) => void;
  onAdd: () => void;
  onLogout: (id: string) => void;
  onClose: () => void;
  compact?: boolean;
}) {
  const updateColor = useUpdateAccountColor();
  const [colorPickerFor, setColorPickerFor] = useState<string | null>(null);

  const handleColorChange = (accountId: string, color: string) => {
    updateColor.mutate({ accountId, color });
    setColorPickerFor(null);
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div
        className={cn(
          'absolute z-50 bg-white dark:bg-dark-bg-secondary rounded-lg shadow-lg border border-gray-200 dark:border-dark-border py-1 min-w-[280px]',
          compact ? 'left-12 bottom-0' : 'bottom-full left-0 right-0 mb-1',
        )}
      >
        {/* Fiókok */}
        {session.accounts.map((account) => (
          <div key={account.id} className="relative">
            <div className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary">
              <button
                onClick={() => onSwitch(account.id)}
                className="flex items-center gap-2 flex-1 text-left"
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                  style={{ backgroundColor: getAccountColor(account) }}
                >
                  {getInitials(account.name || account.email)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-800 dark:text-dark-text truncate">{account.name}</div>
                  <div className="text-xs text-gray-400 dark:text-dark-text-muted truncate">{account.email}</div>
                </div>
                {account.id === session.activeAccountId && (
                  <Check className="h-4 w-4 text-blue-500 flex-shrink-0" />
                )}
              </button>

              {/* Szín választó gomb */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setColorPickerFor(colorPickerFor === account.id ? null : account.id);
                }}
                className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-dark-bg text-gray-400 dark:text-dark-text-muted hover:text-gray-600 dark:hover:text-dark-text transition-colors"
                title="Fiók színének módosítása"
              >
                <Palette className="h-4 w-4" />
              </button>
            </div>

            {/* Szín választó panel */}
            {colorPickerFor === account.id && (
              <div className="px-3 py-2 bg-gray-50 dark:bg-dark-bg border-t border-gray-100 dark:border-dark-border">
                <div className="text-xs text-gray-500 dark:text-dark-text-muted mb-2">Válassz színt:</div>
                <div className="grid grid-cols-8 gap-1">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => handleColorChange(account.id, color)}
                      className={cn(
                        'w-6 h-6 rounded-full border-2 transition-transform hover:scale-110',
                        account.color === color
                          ? 'border-gray-800 dark:border-white'
                          : 'border-transparent',
                      )}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        <div className="border-t border-gray-100 dark:border-dark-border my-1" />

        {/* Fiók hozzáadása */}
        <button
          onClick={onAdd}
          className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary text-sm text-gray-600 dark:text-dark-text-secondary"
        >
          <Plus className="h-4 w-4" />
          Fiók hozzáadása
        </button>

        {/* Kijelentkezés */}
        {session.activeAccountId && (
          <button
            onClick={() => onLogout(session.activeAccountId!)}
            className="flex items-center gap-2 w-full px-3 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm text-red-600 dark:text-red-400"
          >
            <LogOut className="h-4 w-4" />
            Kijelentkezés
          </button>
        )}
      </div>
    </>
  );
}

// Export a getAccountColor függvényt, hogy más komponensek is használhassák
export { getAccountColor };
