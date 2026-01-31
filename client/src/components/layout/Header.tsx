import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Menu, RefreshCw, BookmarkPlus, Check } from 'lucide-react';
import { useState } from 'react';
import { useSession, useSyncAccount } from '../../hooks/useAccounts';
import { useCreateSavedSearch } from '../../hooks/useSavedSearches';
import { ThemeToggle } from './ThemeToggle';
import { HeaderAccountSwitcher } from '../accounts/HeaderAccountSwitcher';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onToggleSidebar: () => void;
}

export function Header({ searchQuery, onSearchChange, onToggleSidebar }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: session } = useSession();
  const syncAccount = useSyncAccount();
  const createSavedSearch = useCreateSavedSearch();
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [justSaved, setJustSaved] = useState(false);

  // Keresési lekérdezés az URL-ből
  const isSearchPage = location.pathname === '/search';
  const urlSearchQuery = new URLSearchParams(location.search).get('q') || '';

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

  const handleSaveSearch = () => {
    if (!saveName.trim() || !urlSearchQuery) return;

    createSavedSearch.mutate(
      { name: saveName.trim(), query: urlSearchQuery },
      {
        onSuccess: () => {
          setShowSaveInput(false);
          setSaveName('');
          setJustSaved(true);
          setTimeout(() => setJustSaved(false), 2000);
        },
      },
    );
  };

  return (
    <header className="flex items-center gap-2 sm:gap-4 bg-white dark:bg-dark-bg-secondary border-b border-gray-200 dark:border-dark-border px-2 sm:px-4 py-2.5">
      <button
        onClick={onToggleSidebar}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary text-gray-500 dark:text-dark-text-secondary lg:hidden flex-shrink-0"
        aria-label="Menü megnyitása"
        title="Menü megnyitása"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      {/* Keresőbar */}
      <form onSubmit={handleSearch} className="flex-1 min-w-0 max-w-2xl">
        <div className="relative flex items-center gap-1 sm:gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-dark-text-muted" aria-hidden="true" />
            <input
              type="text"
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              placeholder="Keresés..."
              aria-label="Keresés a levelekben"
              className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-dark-bg-tertiary border border-transparent dark:border-dark-border rounded-lg text-sm text-gray-900 dark:text-dark-text focus:bg-white dark:focus:bg-dark-bg focus:border-blue-300 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-300 dark:focus:ring-blue-500 outline-none transition-colors"
            />
          </div>

          {/* Keresés mentése gomb */}
          {isSearchPage && urlSearchQuery && (
            <>
              {showSaveInput ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder="Keresés neve..."
                    aria-label="Mentett keresés neve"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveSearch();
                      } else if (e.key === 'Escape') {
                        setShowSaveInput(false);
                        setSaveName('');
                      }
                    }}
                    className="w-24 sm:w-32 px-2 py-1.5 bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded text-sm text-gray-900 dark:text-dark-text"
                  />
                  <button
                    type="button"
                    onClick={handleSaveSearch}
                    disabled={!saveName.trim() || createSavedSearch.isPending}
                    className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary text-blue-600 dark:text-blue-400 disabled:opacity-50"
                    aria-label="Keresés mentése"
                    title="Keresés mentése"
                  >
                    <Check className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSaveInput(true)}
                  className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary transition-colors flex-shrink-0 ${
                    justSaved
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-500 dark:text-dark-text-secondary'
                  }`}
                  title={justSaved ? 'Mentve!' : 'Keresés mentése'}
                  aria-label={justSaved ? 'Keresés elmentve' : 'Keresés mentése'}
                >
                  {justSaved ? (
                    <Check className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <BookmarkPlus className="h-5 w-5" aria-hidden="true" />
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </form>

      {/* Téma váltó - rejtett nagyon kis képernyőn */}
      <div className="hidden sm:block flex-shrink-0">
        <ThemeToggle />
      </div>

      {/* Szinkronizálás gomb */}
      {session?.authenticated && (
        <button
          onClick={handleSync}
          disabled={syncAccount.isPending}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary text-gray-500 dark:text-dark-text-secondary disabled:opacity-50 flex-shrink-0"
          title="Levelek szinkronizálása"
          aria-label="Levelek szinkronizálása"
        >
          <RefreshCw
            className={`h-5 w-5 ${syncAccount.isPending ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
        </button>
      )}

      {/* Fiókváltó */}
      <HeaderAccountSwitcher />
    </header>
  );
}
