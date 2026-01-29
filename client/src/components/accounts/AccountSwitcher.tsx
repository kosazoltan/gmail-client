import { useState } from 'react';
import {
  useSession,
  useLogin,
  useLogout,
  useSwitchAccount,
} from '../../hooks/useAccounts';
import { getInitials, emailToColor, cn } from '../../lib/utils';
import { ChevronDown, Plus, LogOut, Check } from 'lucide-react';

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
            backgroundColor: emailToColor(activeAccount?.email || ''),
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
        className="flex items-center gap-2 w-full px-2 py-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
          style={{
            backgroundColor: emailToColor(activeAccount?.email || ''),
          }}
        >
          {getInitials(activeAccount?.name || activeAccount?.email || '?')}
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="text-sm font-medium text-gray-800 truncate">
            {activeAccount?.name}
          </div>
          <div className="text-xs text-gray-400 truncate">
            {activeAccount?.email}
          </div>
        </div>
        <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
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
  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div
        className={cn(
          'absolute z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[220px]',
          compact ? 'left-12 bottom-0' : 'bottom-full left-0 right-0 mb-1',
        )}
      >
        {/* Fiókok */}
        {session.accounts.map((account) => (
          <button
            key={account.id}
            onClick={() => onSwitch(account.id)}
            className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 text-left"
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
              style={{ backgroundColor: emailToColor(account.email) }}
            >
              {getInitials(account.name || account.email)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-800 truncate">{account.name}</div>
              <div className="text-xs text-gray-400 truncate">{account.email}</div>
            </div>
            {account.id === session.activeAccountId && (
              <Check className="h-4 w-4 text-blue-500 flex-shrink-0" />
            )}
          </button>
        ))}

        <div className="border-t border-gray-100 my-1" />

        {/* Fiók hozzáadása */}
        <button
          onClick={onAdd}
          className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 text-sm text-gray-600"
        >
          <Plus className="h-4 w-4" />
          Fiók hozzáadása
        </button>

        {/* Kijelentkezés */}
        {session.activeAccountId && (
          <button
            onClick={() => onLogout(session.activeAccountId!)}
            className="flex items-center gap-2 w-full px-3 py-2 hover:bg-red-50 text-sm text-red-600"
          >
            <LogOut className="h-4 w-4" />
            Kijelentkezés
          </button>
        )}
      </div>
    </>
  );
}
