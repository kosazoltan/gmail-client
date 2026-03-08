import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useSession } from '../../hooks/useAccounts';
import {
  useSavedSearches,
  useDeleteSavedSearch,
  useIncrementSearchUsage,
} from '../../hooks/useSavedSearches';
import { useDueRemindersCount } from '../../hooks/useReminders';
import { useUnreadCount } from '../../hooks/useInbox';
import { useLabels } from '../../hooks/useLabels';
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
  HelpCircle,
  User,
  Receipt,
  Trash2,
  Tag,
  Settings,
  CalendarClock,
  Mail,
  LayoutDashboard,
  Calendar,
  CheckSquare,
  Bot,
  BarChart3,
  Workflow,
  Sun,
  Sparkles,
  FolderSearch,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useDashboard } from '../../hooks/useDashboard';
import { useSmartFolders } from '../../hooks/useSmartFolders';
import { useDetectedTaskStats } from '../../hooks/useDetectedTasks';
import { useState, useMemo } from 'react';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onShowShortcuts?: () => void;
}

// Dashboard szekció — felül, vizuálisan elkülönítve
const dashboardItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/calendar', icon: Calendar, label: 'Naptár' },
  { path: '/tasks', icon: CheckSquare, label: 'Feladatok' },
  { path: '/team', icon: Bot, label: 'AI Csapat' },
  { path: '/market', icon: BarChart3, label: 'Piaci Elemz\u00e9s' },
];

// AI szekció — intelligens funkciók
const aiItems = [
  { path: '/ai-assistant', icon: Sparkles, label: '🤖 AI Asszisztens' },
  { path: '/ai-analytics', icon: BarChart3, label: '📊 Dashboard' },
  { path: '/ai-workflows', icon: Workflow, label: '⚡ Workflow-k' },
  { path: '/ai-brief', icon: Sun, label: '📋 Napi Brief' },
];

// Email szekció — a megszokott menüpontok
const emailItems = [
  { path: '/', icon: Inbox, label: 'Beérkezett' },
  { path: '/unified', icon: Mail, label: 'Minden levél' },
  { path: '/by-sender', icon: Users, label: 'Küldő szerint' },
  { path: '/by-topic', icon: MessageSquare, label: 'Téma szerint' },
  { path: '/by-time', icon: Clock, label: 'Időszak szerint' },
  { path: '/by-category', icon: Tags, label: 'Kategóriák' },
  { path: '/personal', icon: User, label: 'Személyes' },
  { path: '/invoices', icon: Receipt, label: 'Számlák' },
  { path: '/trash', icon: Trash2, label: 'Kuka' },
  { path: '/attachments', icon: Paperclip, label: 'Mellékletek' },
  { path: '/newsletters', icon: Newspaper, label: 'Hírlevelek' },
  { path: '/reminders', icon: Bell, label: 'Emlékeztetők' },
  { path: '/scheduled', icon: CalendarClock, label: 'Ütemezett' },
  { path: '/database', icon: Database, label: 'Adatbázis' },
];

export function Sidebar({ isOpen, onToggle, onShowShortcuts }: SidebarProps) {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: savedSearchesData } = useSavedSearches();
  const deleteSavedSearch = useDeleteSavedSearch();
  const incrementUsage = useIncrementSearchUsage();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showLoginHelp, setShowLoginHelp] = useState(false);

  const savedSearches = savedSearchesData?.searches || [];
  const currentSearchQuery =
    location.pathname === '/search' ? new URLSearchParams(location.search).get('q') : null;
  const { data: dueRemindersCount } = useDueRemindersCount();
  const { data: labelsData } = useLabels();
  const { data: unreadCount } = useUnreadCount(session?.activeAccountId || undefined);
  const { data: dashboardData } = useDashboard();
  const { data: smartFoldersData } = useSmartFolders();
  const smartFolders = smartFoldersData?.folders || [];
  const { data: detectedTaskStats } = useDetectedTaskStats();
  const detectedTaskCount = detectedTaskStats?.open ?? 0;

  // Gyakran használt címkék (user típusúak, messagesTotal alapján rendezve)
  const frequentLabels = useMemo(() => {
    if (!labelsData?.labels) return [];
    return labelsData.labels
      .filter((l) => l.type === 'user' && l.messagesTotal > 0)
      .sort((a, b) => b.messagesTotal - a.messagesTotal)
      .slice(0, 5); // Top 5 leggyakrabban használt
  }, [labelsData?.labels]);

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
        'dark:bg-dark-bg-secondary dark:border-dark-border flex h-full flex-col border-r border-gray-200/80 bg-white transition-all duration-200',
        isOpen ? 'w-64' : 'w-16',
      )}
    >
      {/* Logo / Collapse */}
      <div className="dark:border-dark-border flex items-center justify-between border-b border-gray-100 p-4">
        {isOpen ? (
          <div className="flex items-center gap-2">
            <ZMailLogo size={28} />
            <span className="dark:text-dark-text font-semibold text-gray-800">ZMail</span>
          </div>
        ) : (
          <ZMailLogo size={28} className="mx-auto" />
        )}
        <button
          onClick={onToggle}
          className={cn(
            'dark:hover:bg-dark-bg-tertiary dark:text-dark-text-secondary touch-manipulation rounded-lg p-2.5 text-gray-500 hover:bg-gray-100',
            !isOpen && 'hidden lg:block',
          )}
          aria-label={isOpen ? 'Oldalsáv összecsukása' : 'Oldalsáv kinyitása'}
          title={isOpen ? 'Oldalsáv összecsukása' : 'Oldalsáv kinyitása'}
        >
          <ChevronLeft className={cn('h-5 w-5 transition-transform', !isOpen && 'rotate-180')} />
        </button>
      </div>

      {/* Új levél gomb */}
      <div className="p-3">
        <button
          onClick={() => navigate('/compose')}
          className={cn(
            'flex items-center gap-2 rounded-xl bg-[#4f6ef7] text-white shadow-md transition-all duration-200 hover:bg-[#3d5ce5] hover:shadow-lg',
            isOpen ? 'w-full justify-center px-6 py-3' : 'mx-auto p-3',
          )}
          aria-label="Új levél írása"
          title="Új levél írása"
        >
          <PenSquare className="h-5 w-5" />
          {isOpen && <span className="font-medium">Új levél</span>}
        </button>
      </div>

      {/* Navigáció */}
      <nav className="flex-1 space-y-1 overflow-auto px-2 py-2" aria-label="Fő navigáció">
        {/* Dashboard szekció */}
        {dashboardItems.map((item) => {
          // Badge logika: naptár → mai események, feladatok → nyitott tasks
          const calendarBadge =
            item.path === '/calendar' && dashboardData?.todayEventsCount
              ? dashboardData.todayEventsCount
              : 0;
          const tasksBadge =
            item.path === '/tasks' && detectedTaskCount > 0
              ? detectedTaskCount
              : item.path === '/tasks' && dashboardData?.openTasksCount
                ? dashboardData.openTasksCount
                : 0;
          const badgeCount = calendarBadge || tasksBadge;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              aria-label={item.label}
              title={item.label}
              className={({ isActive }) =>
                cn(
                  'flex min-h-[44px] touch-manipulation items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors',
                  isActive
                    ? 'bg-[#4f6ef7]/10 font-medium text-[#4f6ef7] dark:bg-[#4f6ef7]/15 dark:text-[#6d8cff]'
                    : 'dark:text-dark-text-secondary dark:hover:bg-dark-bg-tertiary dark:hover:text-dark-text text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                  !isOpen && 'justify-center px-2',
                )
              }
            >
              <div className="relative">
                <item.icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                {badgeCount > 0 && !isOpen && (
                  <span
                    className={cn(
                      'absolute -top-1 -right-1 h-2 w-2 rounded-full',
                      item.path === '/calendar' ? 'bg-purple-500' : item.path === '/tasks' && detectedTaskCount > 0 ? 'bg-red-500' : 'bg-green-500',
                    )}
                  />
                )}
              </div>
              {isOpen && (
                <div className="flex flex-1 items-center justify-between">
                  <span>{item.label}</span>
                  {badgeCount > 0 && (
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.5 text-xs font-medium',
                        item.path === '/calendar'
                          ? 'bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400'
                          : item.path === '/tasks' && detectedTaskCount > 0
                            ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400'
                            : 'bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400',
                      )}
                    >
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                  )}
                </div>
              )}
            </NavLink>
          );
        })}

        {/* Elválasztó vonal a dashboard és AI szekciók között */}
        <div className="dark:border-dark-border mx-2 border-t border-gray-200/60 my-1" />

        {/* AI szekció */}
        {aiItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            aria-label={item.label}
            title={item.label}
            className={({ isActive }) =>
              cn(
                'flex min-h-[44px] touch-manipulation items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors',
                isActive
                  ? 'bg-[#4f6ef7]/10 font-medium text-[#4f6ef7] dark:bg-[#4f6ef7]/15 dark:text-[#6d8cff]'
                  : 'dark:text-dark-text-secondary dark:hover:bg-dark-bg-tertiary dark:hover:text-dark-text text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                !isOpen && 'justify-center px-2',
              )
            }
          >
            <item.icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
            {isOpen && <span>{item.label}</span>}
          </NavLink>
        ))}

        {/* Elválasztó vonal az AI és email szekciók között */}
        <div className="dark:border-dark-border mx-2 border-t border-gray-200/60 my-1" />

        {/* Email szekció */}
        {emailItems.map((item) => {
          const showBadge =
            item.path === '/reminders' && dueRemindersCount && dueRemindersCount > 0;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              aria-label={item.label}
              title={item.label}
              className={({ isActive }) =>
                cn(
                  'flex min-h-[44px] touch-manipulation items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors',
                  isActive
                    ? 'bg-[#4f6ef7]/10 font-medium text-[#4f6ef7] dark:bg-[#4f6ef7]/15 dark:text-[#6d8cff]'
                    : 'dark:text-dark-text-secondary dark:hover:bg-dark-bg-tertiary dark:hover:text-dark-text text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                  !isOpen && 'justify-center px-2',
                )
              }
            >
              <div className="relative">
                <item.icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                {showBadge && !isOpen && (
                  <span
                    className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-orange-500"
                    aria-label={`${dueRemindersCount} esedékes emlékeztető`}
                  />
                )}
                {item.path === '/' && !isOpen && unreadCount !== undefined && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-[#4f6ef7]" />
                )}
              </div>
              {isOpen && (
                <div className="flex flex-1 items-center justify-between">
                  <span>{item.label}</span>
                  {showBadge && (
                    <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">
                      {dueRemindersCount}
                    </span>
                  )}
                  {item.path === '/' && unreadCount !== undefined && unreadCount > 0 && (
                    <span className="rounded-full bg-[#4f6ef7]/10 px-1.5 py-0.5 text-xs font-medium text-[#4f6ef7] dark:bg-[#4f6ef7]/20 dark:text-[#6d8cff]">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </div>
              )}
            </NavLink>
          );
        })}

        {/* 🧠 Smart Folders szekció */}
        {smartFolders.length > 0 && (
          <>
            {isOpen && (
              <div className="px-3 pt-3 pb-1">
                <div className="dark:text-dark-text-muted flex items-center gap-2 text-xs font-medium tracking-wider text-gray-400 uppercase">
                  <FolderSearch className="h-3 w-3" aria-hidden="true" />
                  🧠 Smart Folders
                </div>
              </div>
            )}
            <NavLink
              to="/smart-folders"
              aria-label="Smart Folders"
              title="Smart Folders"
              className={({ isActive }) =>
                cn(
                  'flex min-h-[44px] touch-manipulation items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors',
                  isActive
                    ? 'bg-[#4f6ef7]/10 font-medium text-[#4f6ef7] dark:bg-[#4f6ef7]/15 dark:text-[#6d8cff]'
                    : 'dark:text-dark-text-secondary dark:hover:bg-dark-bg-tertiary dark:hover:text-dark-text text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                  !isOpen && 'justify-center px-2',
                )
              }
            >
              <FolderSearch className="h-5 w-5 flex-shrink-0 text-purple-500" aria-hidden="true" />
              {isOpen && (
                <div className="flex flex-1 items-center justify-between">
                  <span>Összes mappa</span>
                  <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-600 dark:bg-purple-500/20 dark:text-purple-400">
                    {smartFolders.length}
                  </span>
                </div>
              )}
            </NavLink>
            {smartFolders.slice(0, isOpen ? 4 : 2).map((folder) => (
              <NavLink
                key={folder.id}
                to={`/smart-folders?id=${folder.id}`}
                className={cn(
                  'flex min-h-[44px] touch-manipulation items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors',
                  'dark:text-dark-text-secondary dark:hover:bg-dark-bg-tertiary dark:hover:text-dark-text text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                  !isOpen && 'justify-center px-2',
                )}
                title={`${folder.name} (${folder.emailCount ?? 0})`}
                aria-label={`Smart Folder: ${folder.name}`}
              >
                <span className="flex-shrink-0 text-base" aria-hidden="true">{folder.icon}</span>
                {isOpen && (
                  <div className="flex min-w-0 flex-1 items-center justify-between">
                    <span className="truncate">{folder.name}</span>
                    <span className="dark:text-dark-text-muted ml-2 text-xs text-gray-400">
                      {folder.emailCount ?? 0}
                    </span>
                  </div>
                )}
              </NavLink>
            ))}
          </>
        )}

        {/* Gyakran használt címkék */}
        {frequentLabels.length > 0 && (
          <>
            {isOpen && (
              <div className="px-3 pt-3 pb-1">
                <div className="dark:text-dark-text-muted flex items-center gap-2 text-xs font-medium tracking-wider text-gray-400 uppercase">
                  <Tag className="h-3 w-3" aria-hidden="true" />
                  Gyakori címkék
                </div>
              </div>
            )}
            {frequentLabels.slice(0, isOpen ? 5 : 3).map((label) => {
              const isActive = location.pathname === `/label/${label.id}`;
              const labelColor = label.color?.backgroundColor || '#6b7280';
              return (
                <NavLink
                  key={label.id}
                  to={`/label/${label.id}`}
                  className={cn(
                    'flex min-h-[44px] touch-manipulation items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors',
                    isActive
                      ? 'bg-[#4f6ef7]/10 font-medium text-[#4f6ef7] dark:bg-[#4f6ef7]/15 dark:text-[#6d8cff]'
                      : 'dark:text-dark-text-secondary dark:hover:bg-dark-bg-tertiary dark:hover:text-dark-text text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                    !isOpen && 'justify-center px-2',
                  )}
                  title={isOpen ? `${label.name} (${label.messagesTotal})` : label.name}
                  aria-label={`Címke: ${label.name}`}
                >
                  <span
                    className="h-3 w-3 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: labelColor }}
                    aria-hidden="true"
                  />
                  {isOpen && (
                    <div className="flex min-w-0 flex-1 items-center justify-between">
                      <span className="truncate">{label.name}</span>
                      <span className="dark:text-dark-text-muted ml-2 text-xs text-gray-400">
                        {label.messagesTotal}
                      </span>
                    </div>
                  )}
                </NavLink>
              );
            })}
          </>
        )}

        {/* Mentett keresések */}
        {savedSearches.length > 0 && (
          <>
            {isOpen && (
              <div className="px-3 pt-3 pb-1">
                <div className="dark:text-dark-text-muted flex items-center gap-2 text-xs font-medium tracking-wider text-gray-400 uppercase">
                  <Bookmark className="h-3 w-3" aria-hidden="true" />
                  Mentett keresések
                </div>
              </div>
            )}
            {savedSearches.slice(0, isOpen ? 10 : 3).map((search) => {
              const isActive = currentSearchQuery === search.query;
              return (
                <div key={search.id} className="group relative">
                  <button
                    onClick={() => handleSavedSearchClick(search.id, search.query)}
                    className={cn(
                      'flex min-h-[44px] w-full touch-manipulation items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition-colors',
                      isActive
                        ? 'bg-[#4f6ef7]/10 font-medium text-[#4f6ef7] dark:bg-[#4f6ef7]/15 dark:text-[#6d8cff]'
                        : 'dark:text-dark-text-secondary dark:hover:bg-dark-bg-tertiary dark:hover:text-dark-text text-gray-600 hover:bg-gray-100 hover:text-gray-900',
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
                      className="absolute top-1/2 right-1 -translate-y-1/2 touch-manipulation rounded-lg p-2 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                      title="Mentett keresés törlése"
                      aria-label={`${search.name} mentett keresés törlése`}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}

                  {/* Törlés megerősítés */}
                  {deleteConfirmId === search.id && (
                    <div className="dark:bg-dark-bg-secondary dark:border-dark-border absolute top-full right-0 left-0 z-10 mt-1 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
                      <p className="dark:text-dark-text-secondary mb-2 text-xs text-gray-600">
                        Biztosan törlöd?
                      </p>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleDeleteSavedSearch(search.id)}
                          className="flex-1 rounded bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600"
                          aria-label="Igen, törlés megerősítése"
                        >
                          Igen
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="dark:bg-dark-bg-tertiary dark:text-dark-text dark:hover:bg-dark-bg flex-1 rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200"
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

      {/* Bottom actions - Settings & Keyboard shortcuts */}
      <div className="dark:border-dark-border space-y-1 border-t border-gray-200 px-2 py-2">
        {/* Beállítások */}
        <NavLink
          to="/settings"
          aria-label="Beállítások"
          title="Beállítások"
          className={({ isActive }) =>
            cn(
              'flex min-h-[44px] touch-manipulation items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors',
              isActive
                ? 'bg-[#4f6ef7]/10 font-medium text-[#4f6ef7] dark:bg-[#4f6ef7]/15 dark:text-[#6d8cff]'
                : 'dark:text-dark-text-secondary dark:hover:bg-dark-bg-tertiary dark:hover:text-dark-text text-gray-600 hover:bg-gray-100 hover:text-gray-900',
              !isOpen && 'justify-center px-2',
            )
          }
        >
          <Settings className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
          {isOpen && <span>Beállítások</span>}
        </NavLink>

        {/* Billentyűparancsok gomb */}
        {onShowShortcuts && (
          <button
            onClick={onShowShortcuts}
            className={cn(
              'dark:text-dark-text-muted dark:hover:bg-dark-bg-tertiary flex min-h-[44px] w-full touch-manipulation items-center gap-2 rounded-lg px-3 py-3 text-sm text-gray-500 hover:bg-gray-100',
              !isOpen && 'justify-center px-2',
            )}
            title="Billentyűparancsok (?)"
            aria-label="Billentyűparancsok megjelenítése"
          >
            <Keyboard className="h-5 w-5" aria-hidden="true" />
            {isOpen && <span>Billentyűparancsok</span>}
          </button>
        )}
      </div>

      {/* Bejelentkezési segítség - csak ha nincs bejelentkezve */}
      {!session?.authenticated && (
        <div className="dark:border-dark-border border-t border-gray-200 p-3">
          <button
            onClick={() => setShowLoginHelp(true)}
            className={cn(
              'dark:hover:bg-dark-bg-tertiary dark:text-dark-text-muted flex min-h-[44px] w-full touch-manipulation items-center gap-2 rounded-lg px-3 py-3 text-sm text-gray-500 hover:bg-gray-100',
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

      {/* Login Help Modal */}
      <LoginHelp isOpen={showLoginHelp} onClose={() => setShowLoginHelp(false)} />
    </aside>
  );
}
