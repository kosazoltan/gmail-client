import {
  ArrowLeft,
  BookmarkPlus,
  Check,
  Database,
  Keyboard,
  Menu,
  RefreshCw,
  Search,
  Settings,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSession, useSyncAccount } from '../../hooks/useAccounts';
import { useCreateSavedSearch } from '../../hooks/useSavedSearches';
import { buildOperatorQuery, getSearchHistory, pushSearchHistory } from '../../hooks/useSearch';
import { API_BASE } from '../../lib/api';
import { userVisibleApiError } from '../../lib/mutationErrors';
import { toast } from '../../lib/toast';
import { HeaderAccountSwitcher } from '../accounts/HeaderAccountSwitcher';
import { QuotaIndicator } from '../common/QuotaIndicator';
import { AdvancedSearch } from '../email/AdvancedSearch';
import { ThemeToggle } from './ThemeToggle';

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
        `${API_BASE}/error-report`,
        new Blob([JSON.stringify(payload)], { type: 'application/json' }),
      );
    } else {
      fetch(`${API_BASE}/error-report`, {
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
  sidebarOpen?: boolean;
  onShowShortcuts?: () => void;
}

export function Header({
  searchQuery,
  onSearchChange,
  onToggleSidebar,
  sidebarOpen = false,
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
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [history, setHistory] = useState<string[]>(() => getSearchHistory());
  const justSavedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchSuggestionListId = 'header-search-suggestions';

  // Cleanup timer on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (justSavedTimerRef.current) {
        clearTimeout(justSavedTimerRef.current);
      }
      if (autoSearchTimerRef.current) {
        clearTimeout(autoSearchTimerRef.current);
      }
    };
  }, []);

  // Keresési lekérdezés az URL-ből
  const isSearchPage = location.pathname === '/search';
  const urlSearchQuery = new URLSearchParams(location.search).get('q') || '';

  // URL query szinkronizálása a localQuery-vel (pl. back/forward navigáció esetén).
  // Fontos: ne figyeljük a localQuery-t, különben gépelés közben visszaírjuk az URL régi q értékét.
  useEffect(() => {
    if (isSearchPage) {
      setTimeout(() => setLocalQuery(urlSearchQuery), 0);
      return;
    }

    // Ha elhagyjuk a keresési oldalt és nincs külső searchQuery, töröljük a localQuery-t.
    if (!searchQuery) {
      setTimeout(() => setLocalQuery(''), 0);
    }
  }, [isSearchPage, urlSearchQuery, searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = localQuery.trim();

    if (!normalized) {
      onSearchChange('');
      if (isSearchPage) {
        navigate('/');
      }
      if (window.innerWidth < 640) setMobileSearchOpen(false);
      return;
    }

    onSearchChange(normalized);
    setHistory(pushSearchHistory(normalized));
    navigate(`/search?q=${encodeURIComponent(normalized)}`);
    if (window.innerWidth < 640) {
      setMobileSearchOpen(false);
    }
  };

  // Prediktív keresés: a /search oldalon gépelés közben frissítjük a találatokat.
  useEffect(() => {
    if (!isSearchPage) return;
    const normalized = localQuery.trim();
    if (normalized === urlSearchQuery.trim()) return;

    if (autoSearchTimerRef.current) {
      clearTimeout(autoSearchTimerRef.current);
    }

    autoSearchTimerRef.current = setTimeout(() => {
      if (!normalized) {
        onSearchChange('');
        navigate('/', { replace: true });
        return;
      }
      onSearchChange(normalized);
      navigate(`/search?q=${encodeURIComponent(normalized)}`, { replace: true });
    }, 220);

    return () => {
      if (autoSearchTimerRef.current) {
        clearTimeout(autoSearchTimerRef.current);
      }
    };
  }, [isSearchPage, localQuery, urlSearchQuery, navigate, onSearchChange]);

  const searchSuggestions = useMemo(() => {
    const q = localQuery.trim().toLowerCase();
    const historyMatches = history.filter((item) => {
      const normalized = item.trim().toLowerCase();
      if (!normalized) return false;
      if (!q) return true;
      return normalized.includes(q);
    });

    const operatorHints = ['from:', 'to:', 'cc:', 'subject:', 'body:', 'after:', 'before:'];
    const operatorMatches = operatorHints.filter((op) => (q ? op.includes(q) : true));

    return [...historyMatches, ...operatorMatches]
      .filter((item, idx, arr) => arr.indexOf(item) === idx)
      .slice(0, 8);
  }, [history, localQuery]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setShowAdvanced(true);
      }
      if (event.key === 'Escape' && mobileSearchOpen) {
        setMobileSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mobileSearchOpen]);

  useEffect(() => {
    if (mobileSearchOpen) {
      searchInputRef.current?.focus();
    }
  }, [mobileSearchOpen]);

  const handleSync = () => {
    if (session?.activeAccountId) {
      syncAccount.mutate(
        { accountId: session.activeAccountId },
        {
          onSuccess: () => {
            toast.success('Levelek sikeresen szinkronizálva');
          },
          onError: (error) => {
            toast.error(userVisibleApiError(error, 'Hiba történt a szinkronizálás során'));
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
    <header className="relative z-50 flex items-center gap-2 border-b border-[#e0e3e9]/60 bg-[#f6f8fc]/85 px-3 py-2.5 backdrop-blur-md backdrop-saturate-150 sm:gap-4 sm:px-5 dark:border-[#22293b]/60 dark:bg-[#131722]/85">
      <button
        onClick={onToggleSidebar}
        className="dark:hover:bg-dark-bg-tertiary dark:text-dark-text-secondary shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
        aria-label={sidebarOpen ? 'Menü bezárása' : 'Menü megnyitása'}
        title={sidebarOpen ? 'Menü bezárása' : 'Menü megnyitása'}
        aria-pressed={sidebarOpen}
      >
        {sidebarOpen ? (
          <X className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Menu className="h-5 w-5" aria-hidden="true" />
        )}
      </button>

      {/* Keresőbar */}
      <form
        onSubmit={handleSearch}
        className={`min-w-0 flex-1 transition-all ${mobileSearchOpen ? 'dark:bg-dark-bg-secondary absolute inset-0 z-50 flex max-w-full items-center bg-white px-2 sm:static sm:z-auto sm:bg-transparent sm:px-0 sm:dark:bg-transparent' : 'max-w-2xl'}`}
      >
        <div
          className={`relative flex items-center gap-1 sm:gap-2 ${mobileSearchOpen ? 'w-full' : 'min-w-0 flex-1'}`}
        >
          {mobileSearchOpen && (
            <button
              type="button"
              onClick={() => setMobileSearchOpen(false)}
              className="dark:text-dark-text-secondary dark:hover:bg-dark-bg-tertiary mr-1 shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100 sm:hidden"
              aria-label="Vissza"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div className="relative min-w-0 flex-1">
            <Search
              className="dark:text-dark-text-muted absolute top-1/2 left-4.5 h-4 w-4 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && isSearchPage) {
                  e.preventDefault();
                  setLocalQuery('');
                  onSearchChange('');
                  navigate('/');
                }
              }}
              placeholder="Keresés a levelekben..."
              aria-label="Keresés a levelekben"
              list={searchSuggestionListId}
              className={`shadow-soft hover:shadow-medium w-full rounded-full border border-transparent bg-[#eaf1fb] py-2.5 pr-4 pl-12 text-sm text-gray-900 placeholder-gray-500 transition-all duration-200 outline-none hover:bg-[#e3ecfa] focus:bg-white focus:ring-4 focus:ring-[#0b57d0]/12 dark:border-[#22293b] dark:bg-[#1b2132] dark:text-[#f1f3f9] dark:placeholder-[#646d8c] dark:hover:bg-[#1e263a] dark:focus:border-[#0b57d0]/50 dark:focus:bg-[#0b0d14] dark:focus:ring-[#0b57d0]/20 ${mobileSearchOpen ? '' : 'hidden sm:block'}`}
            />
            <datalist id={searchSuggestionListId}>
              {searchSuggestions.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="dark:hover:bg-dark-bg-tertiary shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100"
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
                <div className="hidden items-center gap-1 sm:flex">
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
                  className={`dark:hover:bg-dark-bg-tertiary shrink-0 rounded-lg p-2 transition-colors hover:bg-gray-100 ${
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
      <div className="hidden shrink-0 sm:block">
        <ThemeToggle />
      </div>

      {/* Szinkronizálás gomb */}
      <button
        type="button"
        onClick={() => setMobileSearchOpen((v) => !v)}
        className="dark:text-dark-text-secondary dark:hover:bg-dark-bg-tertiary rounded-lg p-2 text-gray-500 hover:bg-gray-100 sm:hidden"
        aria-label="Kereső"
      >
        <Search className="h-5 w-5" />
      </button>

      {session?.authenticated && (
        <button
          onClick={handleSync}
          disabled={syncAccount.isPending}
          className="dark:hover:bg-dark-bg-tertiary dark:text-dark-text-secondary shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
          title="Levelek szinkronizálása"
          aria-label="Levelek szinkronizálása"
        >
          <RefreshCw
            className={`h-5 w-5 ${syncAccount.isPending ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
        </button>
      )}

      <div className="hidden items-center gap-1 sm:flex">
        {headerMenuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              onClick={item.action}
              className="dark:hover:bg-dark-bg-tertiary dark:text-dark-text-secondary shrink-0 rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:hover:text-white"
              title={item.label}
              aria-label={item.label}
            >
              <Icon className="h-4.5 w-4.5 shrink-0" />
            </button>
          );
        })}
      </div>

      <div className="hidden md:block">
        <QuotaIndicator />
      </div>

      {/* Fiókváltó */}
      <HeaderAccountSwitcher />
    </header>
  );
}
