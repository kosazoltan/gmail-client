import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Menu, RefreshCw, BookmarkPlus, Check } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useSession, useSyncAccount } from '../../hooks/useAccounts';
import { useCreateSavedSearch } from '../../hooks/useSavedSearches';
import { ThemeToggle } from './ThemeToggle';
import { HeaderAccountSwitcher } from '../accounts/HeaderAccountSwitcher';
import { toast } from '../../lib/toast';

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
  const justSavedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (justSavedTimerRef.current) {
        clearTimeout(justSavedTimerRef.current);
      }
    };
  }, []);

  // Keresési lekérdezés az URL-ből
  const isSearchPage = location.pathname === '/search';
  const urlSearchQuery = new URLSearchParams(location.search).get('q') || '';

  // URL query szinkronizálása a localQuery-vel (pl. back button esetén)
  useEffect(() => {
    if (isSearchPage && urlSearchQuery) {
      setLocalQuery(urlSearchQuery);
    } else if (!isSearchPage && localQuery && !searchQuery) {
      // Ha elhagyjuk a keresési oldalt és nincs külső searchQuery, töröljük a localQuery-t
      setLocalQuery('');
    }
  }, [urlSearchQuery, isSearchPage]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (localQuery.trim()) {
      onSearchChange(localQuery.trim());
      navigate(`/search?q=${encodeURIComponent(localQuery.trim())}`);
    }
  };

  const handleSync = () => {
    if (session?.activeAccountId) {
      syncAccount.mutate(
        { accountId: session.activeAccountId },
        {
          onSuccess: () => {
            toast.success('Levelek sikeresen szinkronizálva');
          },
          onError: () => {
            toast.error('Hiba történt a szinkronizálás során');
          },
        },
      );
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
          // Clear any existing timer before setting a new one
          if (justSavedTimerRef.current) {
            clearTimeout(justSavedTimerRef.current);
          }
          justSavedTimerRef.current = setTimeout(() => setJustSaved(false), 2000);
        },
      },
    );
  };

  return (
    <header className="relative z-50 dark:bg-dark-bg-secondary dark:border-dark-border flex items-center gap-2 border-b border-gray-200/80 bg-white px-3 py-2.5 backdrop-blur-sm sm:gap-4 sm:px-5">
      <button
        onClick={onToggleSidebar}
        className="dark:hover:bg-dark-bg-tertiary dark:text-dark-text-secondary flex-shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
        aria-label="Menü megnyitása"
        title="Menü megnyitása"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      {/* Keresőbar */}
      <form onSubmit={handleSearch} className="max-w-2xl min-w-0 flex-1">
        <div className="relative flex items-center gap-1 sm:gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              className="dark:text-dark-text-muted absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
            <input
              type="text"
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              placeholder="Keresés..."
              aria-label="Keresés a levelekben"
              className="dark:bg-dark-bg-tertiary dark:border-dark-border dark:text-dark-text dark:placeholder:text-dark-text-muted dark:focus:bg-dark-bg w-full rounded-xl border border-transparent bg-gray-100 py-2 pr-4 pl-10 text-sm text-gray-900 transition-all duration-200 outline-none placeholder:text-gray-400 focus:border-[#4f6ef7]/50 focus:bg-white focus:ring-2 focus:ring-[#4f6ef7]/20 dark:focus:border-[#4f6ef7]/50"
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
                    className="dark:bg-dark-bg dark:border-dark-border dark:text-dark-text w-24 rounded border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 sm:w-32"
                  />
                  <button
                    type="button"
                    onClick={handleSaveSearch}
                    disabled={!saveName.trim() || createSavedSearch.isPending}
                    className="dark:hover:bg-dark-bg-tertiary rounded p-1.5 text-blue-600 hover:bg-gray-100 disabled:opacity-50 dark:text-blue-400"
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
                  className={`dark:hover:bg-dark-bg-tertiary flex-shrink-0 rounded-lg p-2 transition-colors hover:bg-gray-100 ${
                    justSaved
                      ? 'text-green-600 dark:text-green-400'
                      : 'dark:text-dark-text-secondary text-gray-500'
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
      <div className="hidden flex-shrink-0 sm:block">
        <ThemeToggle />
      </div>

      {/* Szinkronizálás gomb */}
      {session?.authenticated && (
        <button
          onClick={handleSync}
          disabled={syncAccount.isPending}
          className="dark:hover:bg-dark-bg-tertiary dark:text-dark-text-secondary flex-shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
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
