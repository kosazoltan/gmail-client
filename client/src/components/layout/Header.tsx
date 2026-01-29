import { useNavigate } from 'react-router-dom';
import { Search, Menu, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useSession, useSyncAccount } from '../../hooks/useAccounts';
import { ThemeToggle } from './ThemeToggle';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onToggleSidebar: () => void;
}

export function Header({ searchQuery, onSearchChange, onToggleSidebar }: HeaderProps) {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const syncAccount = useSyncAccount();
  const [localQuery, setLocalQuery] = useState(searchQuery);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (localQuery.trim()) {
      onSearchChange(localQuery.trim());
      navigate(`/search?q=${encodeURIComponent(localQuery.trim())}`);
    }
  };

  const handleSync = () => {
    if (session?.activeAccountId) {
      syncAccount.mutate({ accountId: session.activeAccountId });
    }
  };

  return (
    <header className="flex items-center gap-4 bg-white dark:bg-dark-bg-secondary border-b border-gray-200 dark:border-dark-border px-4 py-2.5">
      <button
        onClick={onToggleSidebar}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary text-gray-500 dark:text-dark-text-secondary lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Keresőbar */}
      <form onSubmit={handleSearch} className="flex-1 max-w-2xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-dark-text-muted" />
          <input
            type="text"
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            placeholder="Keresés a levelekben..."
            className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-dark-bg-tertiary border border-transparent dark:border-dark-border rounded-lg text-sm text-gray-900 dark:text-dark-text focus:bg-white dark:focus:bg-dark-bg focus:border-blue-300 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-300 dark:focus:ring-blue-500 outline-none transition-colors"
          />
        </div>
      </form>

      {/* Téma váltó */}
      <ThemeToggle />

      {/* Szinkronizálás gomb */}
      {session?.authenticated && (
        <button
          onClick={handleSync}
          disabled={syncAccount.isPending}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary text-gray-500 dark:text-dark-text-secondary disabled:opacity-50"
          title="Levelek szinkronizálása"
        >
          <RefreshCw
            className={`h-5 w-5 ${syncAccount.isPending ? 'animate-spin' : ''}`}
          />
        </button>
      )}
    </header>
  );
}
