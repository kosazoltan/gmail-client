import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search,
  Menu,
  RefreshCw,
  BookmarkPlus,
  Check,
  Settings,
  Database,
  Keyboard,
  SlidersHorizontal,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useSession, useSyncAccount } from '../../hooks/useAccounts';
import { useCreateSavedSearch } from '../../hooks/useSavedSearches';
import { ThemeToggle } from './ThemeToggle';
import { HeaderAccountSwitcher } from '../accounts/HeaderAccountSwitcher';
import { toast } from '../../lib/toast';
import { QuotaIndicator } from '../common/QuotaIndicator';
import { AdvancedSearch } from '../email/AdvancedSearch';
import { buildOperatorQuery, pushSearchHistory, getSearchHistory } from '../../hooks/useSearch';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

function reportManualRefreshError(error: unknown): void {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const isProduction =
      window.location.hostname === 'mindenes.org' ||
      window.location.hostname === 'www.mindenes.org';
    if (!isProduction) {
      console.warn('Skipping error report in non-production environment', err);
      return;
    }

    if (err.message?.includes('Not allowed by CORS')) {
      return;
    }

    const payload = {
      errorType: 'manual_email_refresh',
      message: err.message,
      stack: err.stack,
      repo: 'gmail-client',
      context: 'manual-email-refresh',
      url: window.location.href,
      browser: navigator.userAgent,
      timestamp: new Date().toISOString(),
    };

    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        `${API_BASE}/api/error-report`,
        new Blob([JSON.stringify(payload)], { type: 'application/json' }),
      );
    } else {
      fetch(`${API_BASE}/api/error-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Never throw from error reporter
  }
}

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onToggleSidebar: () => void;
  onShowShortcuts?: () => void;
}

export function Header({
  searchQuery,
  onSearchChange,
  onToggleSidebar,
  onShowShortcuts,
}: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: session } = useSession();
  const syncAccount = useSyncAccount();
  const createSavedSearch = useCreateSavedSearch();
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [justSaved, setJustSaved] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [history, setHistory] = useState<string[]>(() => getSearchHistory());
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
    if (isSearchPage && urlSearchQuery && urlSearchQuery !== localQuery) {
      setTimeout(() => setLocalQuery(urlSearchQuery), 0);
    } else if (!isSearchPage && localQuery && !searchQuery) {
      // Ha elhagyjuk a keresési oldalt és nincs külső searchQuery, töröljük a localQuery-t
      setTimeout(() => setLocalQuery(''), 0);
    }
  }, [isSearchPage, urlSearchQuery, localQuery, searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (localQuery.trim()) {
      onSearchChange(localQuery.trim());
      setHistory(pushSearchHistory(localQuery.trim()));
      navigate(`/search?q=${encodeURIComponent(localQuery.trim())}`);
    }
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setShowAdvanced(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSync = () => {
    if (session?.activeAccountId) {
      syncAccount.mutate(
        { accountId: session.activeAccountId },
        {
          onSuccess: () => {
            toast.success('Levelek sikeresen szinkronizálva');
          },
          onError: (error) => {
            toast.error('Hiba történt a szinkronizálás során');
            reportManualRefreshError(error);
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

  const headerMenuItems = [
    {
      label: 'Beállítások',
      icon: Settings,
      action: () => navigate('/settings'),
    },
    {
      label: 'Adatbázis',
      icon: Database,
      action: () => navigate('/database'),
    },
    {
      label: 'Billentyűparancsok',
      icon: Keyboard,
      action: () => onShowShortcuts?.(),
    },
  ];

  return (
    <header className="dark:bg-dark-bg-secondary dark:border-dark-border relative z-50 flex items-center gap-2 border-b border-gray-200/80 bg-white px-3 py-2.5 backdrop-blur-sm sm:gap-4 sm:px-5">
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

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="dark:hover:bg-dark-bg-tertiary flex-shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            title="Szűrők (Ctrl+Shift+F)"
          >
            <SlidersHorizontal className="h-5 w-5" />
          </button>

          {showAdvanced && (
            <AdvancedSearch
              onClose={() => setShowAdvanced(false)}
              onApply={(filters) => {
                const query = buildOperatorQuery(filters);
                if (query) {
                  setLocalQuery(query);
                  onSearchChange(query);
                  setHistory(pushSearchHistory(query));
                  navigate(`/search?q=${encodeURIComponent(query)}`);
                }
                setShowAdvanced(false);
              }}
            />
          )}

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
      {history.length > 0 && !isSearchPage && (
        <div className="hidden max-w-xs items-center gap-1 overflow-hidden lg:flex">
          {history.slice(0, 3).map((item) => (
            <button
              key={item}
              onClick={() => {
                setLocalQuery(item);
                onSearchChange(item);
                navigate(`/search?q=${encodeURIComponent(item)}`);
              }}
              className="dark:bg-dark-bg-tertiary dark:text-dark-text-secondary truncate rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600"
            >
              {item}
            </button>
          ))}
        </div>
      )}

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

      <div className="flex items-center gap-1">
        {headerMenuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              onClick={item.action}
              className="dark:hover:bg-dark-bg-tertiary dark:text-dark-text-secondary flex-shrink-0 rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:hover:text-white"
              title={item.label}
              aria-label={item.label}
            >
              <Icon className="h-4.5 w-4.5 flex-shrink-0" />
            </button>
          );
        })}
      </div>

      <QuotaIndicator />

      {/* Fiókváltó */}
      <HeaderAccountSwitcher />
    </header>
  );
}
