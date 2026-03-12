import { useState } from 'react';
import {
  useSession,
  useLogin,
  useLogout,
  useSwitchAccount,
  useUpdateAccountColor,
} from '../../hooks/useAccounts';
import { getInitials, cn } from '../../lib/utils';
import { ChevronDown, Plus, LogOut, Check, Palette } from 'lucide-react';
import { getAccountColor } from './accountUtils';

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

  const activeAccount = session.accounts.find((a) => a.id === session.activeAccountId);

  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="mx-auto flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium text-white"
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
        className="dark:hover:bg-dark-bg-tertiary flex w-full items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-gray-100"
      >
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium text-white"
          style={{
            backgroundColor: getAccountColor(activeAccount),
          }}
        >
          {getInitials(activeAccount?.name || activeAccount?.email || '?')}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <div className="dark:text-dark-text truncate text-sm font-medium text-gray-800">
            {activeAccount?.name}
          </div>
          <div className="dark:text-dark-text-muted truncate text-xs text-gray-400">
            {activeAccount?.email}
          </div>
        </div>
        <ChevronDown className="dark:text-dark-text-muted h-4 w-4 flex-shrink-0 text-gray-400" />
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
          'dark:bg-dark-bg-secondary dark:border-dark-border absolute z-50 min-w-[280px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg',
          compact ? 'bottom-0 left-12' : 'right-0 bottom-full left-0 mb-1',
        )}
      >
        {/* Fiókok */}
        {session.accounts.map((account) => (
          <div key={account.id} className="relative">
            <div className="dark:hover:bg-dark-bg-tertiary flex w-full items-center gap-2 px-3 py-2 hover:bg-gray-50">
              <button
                onClick={() => onSwitch(account.id)}
                className="flex flex-1 items-center gap-2 text-left"
              >
                <div
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: getAccountColor(account) }}
                >
                  {getInitials(account.name || account.email)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="dark:text-dark-text truncate text-sm text-gray-800">
                    {account.name}
                  </div>
                  <div className="dark:text-dark-text-muted truncate text-xs text-gray-400">
                    {account.email}
                  </div>
                </div>
                {account.id === session.activeAccountId && (
                  <Check className="h-4 w-4 flex-shrink-0 text-blue-500" />
                )}
              </button>

              {/* Szín választó gomb */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setColorPickerFor(colorPickerFor === account.id ? null : account.id);
                }}
                className="dark:hover:bg-dark-bg dark:text-dark-text-muted dark:hover:text-dark-text rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600"
                title="Fiók színének módosítása"
              >
                <Palette className="h-4 w-4" />
              </button>
            </div>

            {/* Szín választó panel */}
            {colorPickerFor === account.id && (
              <div className="dark:bg-dark-bg dark:border-dark-border border-t border-gray-100 bg-gray-50 px-3 py-2">
                <div className="dark:text-dark-text-muted mb-2 text-xs text-gray-500">
                  Válassz színt:
                </div>
                <div className="grid grid-cols-8 gap-1">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => handleColorChange(account.id, color)}
                      className={cn(
                        'h-6 w-6 rounded-full border-2 transition-transform hover:scale-110',
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

        <div className="dark:border-dark-border my-1 border-t border-gray-100" />

        {/* Fiók hozzáadása */}
        <button
          onClick={onAdd}
          className="dark:hover:bg-dark-bg-tertiary dark:text-dark-text-secondary flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          <Plus className="h-4 w-4" />
          Fiók hozzáadása
        </button>

        {/* Kijelentkezés */}
        {session.activeAccountId && (
          <button
            onClick={() => onLogout(session.activeAccountId!)}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <LogOut className="h-4 w-4" />
            Kijelentkezés
          </button>
        )}
      </div>
    </>
  );
}

