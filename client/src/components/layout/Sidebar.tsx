import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useSession, useLogin } from '../../hooks/useAccounts';
import { useSavedSearches, useDeleteSavedSearch, useIncrementSearchUsage } from '../../hooks/useSavedSearches';
import { useDueRemindersCount } from '../../hooks/useReminders';
import { AccountSwitcher } from '../accounts/AccountSwitcher';
import { ZMailLogo } from '../common/ZMailLogo';
import { LoginHelp } from '../auth/LoginHelp';
import {
  Inbox,
  Users,
  MessageSquare,
  Clock,
  Tags,
  PenSquare,
  ChevronLeft,
  Database,
  Keyboard,
  Paperclip,
  Search,
  Bookmark,
  X,
  Bell,
  Newspaper,
  LogIn,
  HelpCircle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useState } from 'react';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onShowShortcuts?: () => void;
}

const navItems = [
  { path: '/', icon: Inbox, label: 'Beérkezett' },
  { path: '/by-sender', icon: Users, label: 'Küldő szerint' },
  { path: '/by-topic', icon: MessageSquare, label: 'Téma szerint' },
  { path: '/by-time', icon: Clock, label: 'Időszak szerint' },
  { path: '/by-category', icon: Tags, label: 'Kategóriák' },
  { path: '/attachments', icon: Paperclip, label: 'Mellékletek' },
  { path: '/newsletters', icon: Newspaper, label: 'Hírlevelek' },
  { path: '/reminders', icon: Bell, label: 'Emlékeztetők' },
  { path: '/database', icon: Database, label: 'Adatbázis' },
];

export function Sidebar({ isOpen, onToggle, onShowShortcuts }: SidebarProps) {
  const { data: session } = useSession();
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: savedSearchesData } = useSavedSearches();
  const deleteSavedSearch = useDeleteSavedSearch();
  const incrementUsage = useIncrementSearchUsage();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showLoginHelp, setShowLoginHelp] = useState(false);

  const savedSearches = savedSearchesData?.searches || [];
  const currentSearchQuery = location.pathname === '/search' ? new URLSearchParams(location.search).get('q') : null;
  const { data: dueRemindersCount } = useDueRemindersCount();

  const handleSavedSearchClick = (id: string, query: string) => {
    incrementUsage.mutate(id);
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  const handleDeleteSavedSearch = (id: string) => {
    deleteSavedSearch.mutate(id, {
      onSuccess: () => setDeleteConfirmId(null),
    });
  };

  return (
    <aside
      className={cn(
        'flex flex-col bg-white dark:bg-dark-bg-secondary border-r border-gray-200 dark:border-dark-border transition-all duration-200',
        isOpen ? 'w-64' : 'w-16',
      )}
    >
      {/* Logo / Collapse */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-dark-border">
        {isOpen ? (
          <div className="flex items-center gap-2">
            <ZMailLogo size={28} />
            <span className="font-semibold text-gray-800 dark:text-dark-text">ZMail</span>
          </div>
        ) : (
          <ZMailLogo size={28} className="mx-auto" />
        )}
        <button
          onClick={onToggle}
          className={cn(
            'p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary text-gray-500 dark:text-dark-text-secondary touch-manipulation',
            !isOpen && 'hidden lg:block',
          )}
          aria-label={isOpen ? 'Oldalsáv összecsukása' : 'Oldalsáv kinyitása'}
          title={isOpen ? 'Oldalsáv összecsukása' : 'Oldalsáv kinyitása'}
        >
          <ChevronLeft
            className={cn('h-5 w-5 transition-transform', !isOpen && 'rotate-180')}
          />
        </button>
      </div>

      {/* Új levél gomb */}
      <div className="p-3">
        <button
          onClick={() => navigate('/compose')}
          className={cn(
            'flex items-center gap-2 rounded-2xl bg-blue-600 dark:bg-blue-500 text-white shadow-md hover:bg-blue-700 dark:hover:bg-blue-600 hover:shadow-lg transition-all',
            isOpen ? 'px-6 py-3 w-full justify-center' : 'p-3 mx-auto',
          )}
          aria-label="Új levél írása"
          title="Új levél írása"
        >
          <PenSquare className="h-5 w-5" />
          {isOpen && <span className="font-medium">Új levél</span>}
        </button>
      </div>

      {/* Navigáció */}
      <nav className="flex-1 py-2 space-y-1 px-2 overflow-auto" aria-label="Fő navigáció">
        {navItems.map((item) => {
          const showBadge = item.path === '/reminders' && dueRemindersCount && dueRemindersCount > 0;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              aria-label={item.label}
              title={item.label}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors touch-manipulation min-h-[44px]',
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 font-medium'
                    : 'text-gray-600 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary hover:text-gray-900 dark:hover:text-dark-text',
                  !isOpen && 'justify-center px-2',
                )
              }
            >
              <div className="relative">
                <item.icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                {showBadge && !isOpen && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 bg-orange-500 rounded-full" aria-label={`${dueRemindersCount} esedékes emlékeztető`} />
                )}
              </div>
              {isOpen && (
                <div className="flex items-center justify-between flex-1">
                  <span>{item.label}</span>
                  {showBadge && (
                    <span className="px-1.5 py-0.5 text-xs bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded-full font-medium">
                      {dueRemindersCount}
                    </span>
                  )}
                </div>
              )}
            </NavLink>
          );
        })}

        {/* Mentett keresések */}
        {savedSearches.length > 0 && (
          <>
            {isOpen && (
              <div className="pt-3 pb-1 px-3">
                <div className="flex items-center gap-2 text-xs font-medium text-gray-400 dark:text-dark-text-muted uppercase tracking-wider">
                  <Bookmark className="h-3 w-3" aria-hidden="true" />
                  Mentett keresések
                </div>
              </div>
            )}
            {savedSearches.slice(0, isOpen ? 10 : 3).map((search) => {
              const isActive = currentSearchQuery === search.query;
              return (
                <div key={search.id} className="relative group">
                  <button
                    onClick={() => handleSavedSearchClick(search.id, search.query)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors w-full text-left touch-manipulation min-h-[44px]',
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 font-medium'
                        : 'text-gray-600 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary hover:text-gray-900 dark:hover:text-dark-text',
                      !isOpen && 'justify-center px-2',
                    )}
                    title={isOpen ? search.query : `${search.name}: ${search.query}`}
                    aria-label={`Mentett keresés: ${search.name}`}
                  >
                    <Search className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                    {isOpen && <span className="truncate">{search.name}</span>}
                  </button>

                  {/* Törlés gomb - csak ha a sidebar nyitva van */}
                  {isOpen && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(search.id);
                      }}
                      className="absolute right-1 top-1/2 -translate-y-1/2 p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-opacity touch-manipulation"
                      title="Mentett keresés törlése"
                      aria-label={`${search.name} mentett keresés törlése`}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}

                  {/* Törlés megerősítés */}
                  {deleteConfirmId === search.id && (
                    <div className="absolute left-0 right-0 top-full mt-1 p-2 bg-white dark:bg-dark-bg-secondary border border-gray-200 dark:border-dark-border rounded-lg shadow-lg z-10">
                      <p className="text-xs text-gray-600 dark:text-dark-text-secondary mb-2">
                        Biztosan törlöd?
                      </p>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleDeleteSavedSearch(search.id)}
                          className="flex-1 px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                          aria-label="Igen, törlés megerősítése"
                        >
                          Igen
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="flex-1 px-2 py-1 text-xs bg-gray-100 dark:bg-dark-bg-tertiary text-gray-700 dark:text-dark-text rounded hover:bg-gray-200 dark:hover:bg-dark-bg"
                          aria-label="Nem, törlés megszakítása"
                        >
                          Nem
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </nav>

      {/* Billentyűparancsok gomb */}
      {onShowShortcuts && (
        <div className="px-2 pb-2">
          <button
            onClick={onShowShortcuts}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-3 text-sm text-gray-500 dark:text-dark-text-muted hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary w-full touch-manipulation min-h-[44px]',
              !isOpen && 'justify-center px-2',
            )}
            title="Billentyűparancsok (?)"
            aria-label="Billentyűparancsok megjelenítése"
          >
            <Keyboard className="h-5 w-5" aria-hidden="true" />
            {isOpen && <span>Billentyűparancsok</span>}
          </button>
        </div>
      )}

      {/* Fiókkezelés */}
      <div className="border-t border-gray-200 dark:border-dark-border p-3">
        {session?.authenticated ? (
          <AccountSwitcher compact={!isOpen} />
        ) : (
          <div className="space-y-2">
            <button
              onClick={() => login.mutate()}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-3 text-sm hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary w-full touch-manipulation min-h-[44px]',
                isOpen
                  ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 font-medium'
                  : 'text-gray-600 dark:text-dark-text-secondary justify-center px-2',
              )}
              aria-label="Bejelentkezés Google fiókkal"
              title="Bejelentkezés Google fiókkal"
            >
              <LogIn className="h-5 w-5" aria-hidden="true" />
              {isOpen && <span>Bejelentkezés</span>}
            </button>

            {/* Bejelentkezési segítség gomb */}
            <button
              onClick={() => setShowLoginHelp(true)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-3 text-sm hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary w-full text-gray-500 dark:text-dark-text-muted touch-manipulation min-h-[44px]',
                !isOpen && 'justify-center px-2',
              )}
              aria-label="Bejelentkezési segítség"
              title="Bejelentkezési segítség"
            >
              <HelpCircle className="h-5 w-5" aria-hidden="true" />
              {isOpen && <span>Bejelentkezési segítség</span>}
            </button>
          </div>
        )}
      </div>

      {/* Login Help Modal */}
      <LoginHelp isOpen={showLoginHelp} onClose={() => setShowLoginHelp(false)} />
    </aside>
  );
}
