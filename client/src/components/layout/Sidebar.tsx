import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useSession } from '../../hooks/useAccounts';
import {
  useSavedSearches,
  useDeleteSavedSearch,
  useIncrementSearchUsage,
} from '../../hooks/useSavedSearches';
import { useDueRemindersCount } from '../../hooks/useReminders';
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
  ChevronDown,
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
  CalendarClock,
  Mail,
  LayoutDashboard,
  Calendar,
  CheckSquare,
  BarChart3,
  Sparkles,
  FolderSearch,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useDashboard } from '../../hooks/useDashboard';
import { useSmartFolders } from '../../hooks/useSmartFolders';
import { useDetectedTaskStats } from '../../hooks/useDetectedTasks';
import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useMoveEmail } from '../../hooks/useLabels';
import { getDraggedEmail, useDragDrop } from '../../hooks/useDragDrop';
import { toast } from '../../lib/toast';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  isMobile?: boolean;
  isTablet?: boolean;
}

// --- Collapsible group helpers ---

function getStoredGroupState(key: string, defaultOpen: boolean): boolean {
  try {
    const stored = localStorage.getItem(`sidebar-group-${key}`);
    if (stored !== null) return stored === 'true';
  } catch {
    /* ignore */
  }
  return defaultOpen;
}

function setStoredGroupState(key: string, isOpen: boolean): void {
  try {
    localStorage.setItem(`sidebar-group-${key}`, String(isOpen));
  } catch {
    /* ignore */
  }
}

function useCollapsibleGroup(key: string, defaultOpen = true) {
  const [isOpen, setIsOpen] = useState(() => getStoredGroupState(key, defaultOpen));
  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      setStoredGroupState(key, next);
      return next;
    });
  }, [key]);
  return { isOpen, toggle };
}

// --- Shared nav state classes (DRY: NavItem + saved-search button) ---
// WCAG 2.2 AA: light-mode foreground #3651d4 a #5b78ff/14 hatteren ~5.4:1
const ACTIVE_NAV_CLASS =
  'bg-gradient-to-r from-[#5b78ff]/14 to-[#5b78ff]/8 text-[#3651d4] shadow-[inset_0_0_0_1px_rgba(91,120,255,0.18)] dark:from-[#5b78ff]/20 dark:to-[#5b78ff]/10 dark:text-[#a3b6ff] dark:shadow-[inset_0_0_0_1px_rgba(91,120,255,0.28)]';
const INACTIVE_NAV_CLASS =
  'dark:text-dark-text-secondary dark:hover:bg-dark-bg-tertiary/80 dark:hover:text-dark-text text-gray-600 hover:bg-gray-100/80 hover:text-gray-900';

// --- Navigation item component ---

function NavItem({
  path,
  icon: Icon,
  label,
  badge,
  badgeColor = 'blue',
  sidebarOpen,
  onDropEmail,
}: {
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: number;
  badgeColor?: 'blue' | 'purple' | 'green' | 'red' | 'orange';
  sidebarOpen: boolean;
  onDropEmail?: (payload: { emailId: string; accountId?: string }) => void;
}) {
  const badgeColors: Record<string, string> = {
    blue: 'bg-[#5b78ff]/12 text-[#3651d4] dark:bg-[#5b78ff]/18 dark:text-[#8ba3ff]',
    purple: 'bg-purple-100 text-[#7e22ce] dark:bg-purple-500/18 dark:text-purple-300',
    green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/18 dark:text-emerald-300',
    red: 'bg-rose-100 text-[#be123c] dark:bg-rose-500/18 dark:text-rose-300',
    orange: 'bg-amber-100 text-[#92400e] dark:bg-amber-500/18 dark:text-amber-300',
  };

  const drag = useDragDrop();

  return (
    <NavLink
      to={path}
      end={path === '/'}
      aria-label={label}
      title={label}
      onDragOver={onDropEmail ? drag.onDragOver : undefined}
      onDragLeave={onDropEmail ? drag.onDragLeave : undefined}
      onDrop={
        onDropEmail
          ? (e) => {
              e.preventDefault();
              const payload = getDraggedEmail(e.dataTransfer);
              if (payload) onDropEmail(payload);
              drag.resetDragState();
            }
          : undefined
      }
      className={({ isActive }) =>
        cn(
          'group/nav relative flex min-h-[40px] touch-manipulation items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
          isActive ? ACTIVE_NAV_CLASS : INACTIVE_NAV_CLASS,
          drag.isDraggingOver &&
            'bg-[#5b78ff]/10 ring-2 ring-[#5b78ff]/50 ring-offset-1 ring-offset-transparent',
          !sidebarOpen && 'justify-center px-2',
        )
      }
    >
      <div className="relative">
        <Icon className="h-[18px] w-[18px] flex-shrink-0" aria-hidden="true" />
        {badge !== undefined && badge > 0 && !sidebarOpen && (
          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-[#5b78ff] ring-2 ring-white dark:ring-[#14171f]" />
        )}
      </div>
      {sidebarOpen && (
        <div className="flex flex-1 items-center justify-between">
          <span>{label}</span>
          {badge !== undefined && badge > 0 && (
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-xs font-medium',
                badgeColors[badgeColor],
              )}
            >
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </div>
      )}
    </NavLink>
  );
}

// --- Collapsible section header ---

function SectionHeader({
  label,
  icon: Icon,
  isOpen,
  onToggle,
  sidebarOpen,
  isTablet,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isOpen: boolean;
  onToggle: () => void;
  sidebarOpen: boolean;
  isTablet?: boolean;
}) {
  if (!sidebarOpen || isTablet) return null;

  return (
    <button
      onClick={onToggle}
      className="dark:text-dark-text-muted flex w-full items-center gap-2 px-3 pt-3 pb-1 text-xs font-medium tracking-wider text-gray-400 uppercase transition-colors hover:text-gray-600 dark:hover:text-gray-300"
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      <span className="flex-1 text-left">{label}</span>
      <ChevronDown
        className={cn('h-3 w-3 transition-transform duration-200', !isOpen && '-rotate-90')}
      />
    </button>
  );
}

export function Sidebar({ isOpen, onToggle, isMobile = false, isTablet = false }: SidebarProps) {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = !!session?.authenticated;
  const { data: savedSearchesData } = useSavedSearches(isAuthenticated);
  const deleteSavedSearch = useDeleteSavedSearch();
  const incrementUsage = useIncrementSearchUsage();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showLoginHelp, setShowLoginHelp] = useState(false);
  const moveEmail = useMoveEmail();

  const savedSearches = savedSearchesData?.searches || [];
  const currentSearchQuery =
    location.pathname === '/search' ? new URLSearchParams(location.search).get('q') : null;
  const { data: dueRemindersCount } = useDueRemindersCount(isAuthenticated);
  const { data: dashboardData } = useDashboard(isAuthenticated);
  const { data: smartFoldersData } = useSmartFolders(isAuthenticated);
  const smartFolders = smartFoldersData?.folders || [];
  const { data: detectedTaskStats } = useDetectedTaskStats(isAuthenticated);
  const detectedTaskCount = detectedTaskStats?.open ?? 0;
  const unreadCount = dashboardData?.unreadCount ?? 0;

  // User categories for sidebar sub-items
  const { data: categoriesData } = useQuery({
    queryKey: ['views', 'by-category', session?.activeAccountId],
    queryFn: () => api.views.byCategory(),
    enabled: !!session?.activeAccountId,
    staleTime: 60000,
  });
  const categories = categoriesData?.categories;
  const userCategories = useMemo(() => {
    if (!categories) return [];
    return categories.filter((c) => !c.isSystem && !c.is_system);
  }, [categories]);

  // Collapsible groups
  const viewsGroup = useCollapsibleGroup('views', false);
  const aiGroup = useCollapsibleGroup('ai-views', true);
  const savedSearchGroup = useCollapsibleGroup('saved-searches', false);

  const handleSavedSearchClick = (id: string, query: string) => {
    incrementUsage.mutate(id);
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  const handleDeleteSavedSearch = (id: string) => {
    deleteSavedSearch.mutate(id, {
      onSuccess: () => setDeleteConfirmId(null),
    });
  };

  const dropTargets: Record<string, { labelId: string; label: string }> = {
    '/': { labelId: 'INBOX', label: 'Inbox' },
    '/trash': { labelId: 'TRASH', label: 'Kuka' },
    '/newsletters': { labelId: 'CATEGORY_PROMOTIONS', label: 'Hírlevelek' },
    '/personal': { labelId: 'CATEGORY_PERSONAL', label: 'Személyes' },
  };

  const handleDropToPath = (path: string, payload: { emailId: string; accountId?: string }) => {
    const target = dropTargets[path];
    if (!target) return;
    moveEmail.mutate(
      {
        emailId: payload.emailId,
        addLabelIds: [target.labelId],
        removeLabelIds: target.labelId === 'INBOX' ? [] : ['INBOX'],
      },
      {
        onSuccess: () => toast.success(`Email áthelyezve: ${target.label}`),
        onError: () => toast.error('Áthelyezés sikertelen'),
      },
    );
  };

  return (
    <aside
      className={cn(
        'dark:bg-dark-bg-secondary/95 dark:border-dark-border flex h-full flex-col border-r border-gray-200/70 bg-white/95 backdrop-blur-md transition-all duration-200',
        isMobile ? 'w-[92vw] max-w-[390px]' : isTablet ? 'w-20' : isOpen ? 'w-64' : 'w-16',
      )}
    >
      {/* Logo / Collapse */}
      <div className="dark:border-dark-border/60 flex items-center justify-between border-b border-gray-100/80 p-4">
        {isOpen && !isTablet ? (
          <div className="flex items-center gap-2.5">
            <ZMailLogo size={28} />
            <span className="dark:text-dark-text bg-gradient-to-br from-gray-900 to-gray-700 bg-clip-text text-base font-semibold tracking-tight text-transparent dark:from-white dark:to-gray-300">
              ZMail
            </span>
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
            'group/compose flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#5b78ff] to-[#4861e8] font-semibold text-white shadow-[0_4px_14px_rgba(91,120,255,0.35)] transition-all duration-200 hover:from-[#4861e8] hover:to-[#3a4ed1] hover:shadow-[0_6px_20px_rgba(91,120,255,0.5)] active:scale-[0.98]',
            isOpen ? 'w-full justify-center px-6 py-3' : 'mx-auto p-3',
          )}
          aria-label="Új levél írása"
          title="Új levél írása"
        >
          <PenSquare className="h-5 w-5 transition-transform group-hover/compose:rotate-[-6deg]" />
          {isOpen && !isTablet && <span>Új levél</span>}
        </button>
      </div>

      {/* Navigáció */}
      <nav className="flex-1 space-y-0.5 overflow-auto px-2 py-2" aria-label="Fő navigáció">
        {/* === FŐ csoport: Home, Inbox, Compose === */}
        <NavItem path="/dashboard" icon={LayoutDashboard} label="Home" sidebarOpen={isOpen} />
        <NavItem
          path="/"
          icon={Inbox}
          label="Inbox"
          badge={unreadCount}
          badgeColor="blue"
          sidebarOpen={isOpen}
          onDropEmail={(payload) => handleDropToPath('/', payload)}
        />
        <NavItem path="/compose" icon={PenSquare} label="Compose" sidebarOpen={isOpen} />

        {/* Separator */}
        <div className="dark:border-dark-border mx-2 my-1.5 border-t border-gray-200/60" />

        {/* === NÉZETEK csoport (összecsukható) === */}
        <SectionHeader
          label="Nézetek"
          icon={Mail}
          isOpen={viewsGroup.isOpen}
          onToggle={viewsGroup.toggle}
          sidebarOpen={isOpen}
          isTablet={isTablet}
        />
        {(viewsGroup.isOpen || !isOpen) && (
          <>
            <NavItem path="/unified" icon={Mail} label="Minden levél" sidebarOpen={isOpen} />
            <NavItem path="/by-sender" icon={Users} label="Küldő szerint" sidebarOpen={isOpen} />
            <NavItem
              path="/personal"
              icon={User}
              label="Személyes"
              sidebarOpen={isOpen}
              onDropEmail={(payload) => handleDropToPath('/personal', payload)}
            />
            <NavItem
              path="/trash"
              icon={Trash2}
              label="Trash"
              sidebarOpen={isOpen}
              onDropEmail={(payload) => handleDropToPath('/trash', payload)}
            />
            <NavItem
              path="/newsletters"
              icon={Newspaper}
              label="Hírlevelek"
              sidebarOpen={isOpen}
              onDropEmail={(payload) => handleDropToPath('/newsletters', payload)}
            />
            <NavItem
              path="/by-topic"
              icon={MessageSquare}
              label="Téma szerint"
              sidebarOpen={isOpen}
            />
            <NavItem path="/by-time" icon={Clock} label="Időszak szerint" sidebarOpen={isOpen} />
            <NavItem path="/by-category" icon={Tags} label="Kategóriák" sidebarOpen={isOpen} />
            <NavItem path="/invoices" icon={Receipt} label="Számlák" sidebarOpen={isOpen} />
            <NavItem
              path="/invoice-automation"
              icon={CalendarClock}
              label="Számla automatizálás"
              sidebarOpen={isOpen}
            />
            <NavItem
              path="/attachments"
              icon={Paperclip}
              label="Mellékletek"
              sidebarOpen={isOpen}
            />
            <NavItem
              path="/reminders"
              icon={Bell}
              label="Emlékeztetők"
              badge={dueRemindersCount && dueRemindersCount > 0 ? dueRemindersCount : undefined}
              badgeColor="orange"
              sidebarOpen={isOpen}
            />
            <NavItem
              path="/scheduled"
              icon={CalendarClock}
              label="Ütemezett"
              sidebarOpen={isOpen}
            />
          </>
        )}

        {/* Separator */}
        <div className="dark:border-dark-border mx-2 my-1.5 border-t border-gray-200/60" />

        {/* === AI NÉZETEK csoport (összecsukható) === */}
        <SectionHeader
          label="AI Nézetek"
          icon={Sparkles}
          isOpen={aiGroup.isOpen}
          onToggle={aiGroup.toggle}
          sidebarOpen={isOpen}
          isTablet={isTablet}
        />
        {(aiGroup.isOpen || !isOpen) && (
          <>
            <NavItem
              path="/ai-assistant"
              icon={Sparkles}
              label="AI Asszisztens"
              sidebarOpen={isOpen}
            />
            <NavItem
              path="/smart-folders"
              icon={FolderSearch}
              label="Smart Folders"
              badge={smartFolders.length > 0 ? smartFolders.length : undefined}
              badgeColor="purple"
              sidebarOpen={isOpen}
            />
            <NavItem
              path="/tasks"
              icon={CheckSquare}
              label="Tasks"
              badge={
                detectedTaskCount > 0
                  ? detectedTaskCount
                  : dashboardData?.openTasksCount || undefined
              }
              badgeColor={detectedTaskCount > 0 ? 'red' : 'green'}
              sidebarOpen={isOpen}
            />
            <NavItem
              path="/calendar"
              icon={Calendar}
              label="Naptár"
              badge={dashboardData?.todayEventsCount || undefined}
              badgeColor="purple"
              sidebarOpen={isOpen}
            />
            <NavItem path="/market" icon={BarChart3} label="Market" sidebarOpen={isOpen} />
            <NavItem path="/analytics" icon={BarChart3} label="Statisztikák" sidebarOpen={isOpen} />
          </>
        )}

        {/* Smart Folders alatti mappák — világosan a Smart Folders alá tartoznak, nem a Market alá */}
        {aiGroup.isOpen && smartFolders.length > 0 && isOpen && (
          <>
            <div className="px-3 pt-2 pb-1">
              <div className="dark:text-dark-text-muted flex items-center gap-2 text-xs font-medium tracking-wider text-gray-400 uppercase">
                <FolderSearch className="h-3 w-3" aria-hidden="true" />
                Smart Folders
              </div>
            </div>
            {smartFolders.slice(0, 4).map((folder) => (
              <NavLink
                key={folder.id}
                to={`/smart-folders?id=${folder.id}`}
                className={cn(
                  'flex min-h-[36px] touch-manipulation items-center gap-3 rounded-lg px-3 py-2 pl-8 text-sm transition-colors',
                  'dark:text-dark-text-secondary dark:hover:bg-dark-bg-tertiary dark:hover:text-dark-text text-gray-500 hover:bg-gray-100 hover:text-gray-900',
                )}
                title={`${folder.name} (${folder.emailCount ?? 0})`}
                aria-label={`Smart Folder: ${folder.name}`}
              >
                <span className="flex-shrink-0 text-sm" aria-hidden="true">
                  {folder.icon}
                </span>
                <div className="flex min-w-0 flex-1 items-center justify-between">
                  <span className="truncate text-xs">{folder.name}</span>
                  <span className="dark:text-dark-text-muted ml-2 text-[10px] text-gray-400">
                    {folder.emailCount ?? 0}
                  </span>
                </div>
              </NavLink>
            ))}
          </>
        )}

        {/* User Categories */}
        {userCategories.length > 0 && isOpen && aiGroup.isOpen && (
          <>
            {isOpen && (
              <div className="px-3 pt-2 pb-1">
                <div className="dark:text-dark-text-muted flex items-center gap-2 text-xs font-medium tracking-wider text-gray-400 uppercase">
                  <Tags className="h-3 w-3" aria-hidden="true" />
                  Saját kategóriák
                </div>
              </div>
            )}
            {userCategories.slice(0, 5).map((cat) => (
              <NavLink
                key={cat.id}
                to={`/by-category?categoryId=${encodeURIComponent(cat.id)}`}
                className={cn(
                  'flex min-h-[36px] touch-manipulation items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  'dark:text-dark-text-secondary dark:hover:bg-dark-bg-tertiary dark:hover:text-dark-text text-gray-500 hover:bg-gray-100 hover:text-gray-900',
                )}
                title={`${cat.name} (${cat.emailCount ?? 0})`}
                aria-label={`Kategória: ${cat.name}`}
              >
                <span
                  className="h-3 w-3 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: cat.color }}
                  aria-hidden="true"
                />
                <div className="flex min-w-0 flex-1 items-center justify-between">
                  <span className="truncate text-xs">{cat.name}</span>
                  {(cat.emailCount ?? 0) > 0 && (
                    <span className="dark:text-dark-text-muted ml-2 text-[10px] text-gray-400">
                      {cat.emailCount}
                    </span>
                  )}
                </div>
              </NavLink>
            ))}
          </>
        )}

        {/* Separator */}
        <div className="dark:border-dark-border mx-2 my-1.5 border-t border-gray-200/60" />

        {/* === Mentett keresések (összecsukható) === */}
        {savedSearches.length > 0 && (
          <>
            <SectionHeader
              label="Mentett keresések"
              icon={Bookmark}
              isOpen={savedSearchGroup.isOpen}
              onToggle={savedSearchGroup.toggle}
              sidebarOpen={isOpen}
              isTablet={isTablet}
            />
            {(savedSearchGroup.isOpen || !isOpen) &&
              savedSearches.slice(0, isOpen ? 10 : 3).map((search) => {
                const isActive = currentSearchQuery === search.query;
                return (
                  <div key={search.id} className="group relative">
                    <button
                      onClick={() => handleSavedSearchClick(search.id, search.query)}
                      className={cn(
                        'flex min-h-[40px] w-full touch-manipulation items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all duration-150',
                        isActive ? ACTIVE_NAV_CLASS : INACTIVE_NAV_CLASS,
                        !isOpen && 'justify-center px-2',
                      )}
                      title={isOpen ? search.query : `${search.name}: ${search.query}`}
                      aria-label={`Mentett keresés: ${search.name}`}
                    >
                      <Search className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                      {isOpen && <span className="truncate">{search.name}</span>}
                    </button>

                    {/* Törlés gomb */}
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

      {/* Bottom actions - Settings & Accounts */}
      <div className="dark:border-dark-border space-y-1 border-t border-gray-200 px-2 py-2">
        {/* Intentionally left for future bottom actions */}
      </div>

      {/* Bejelentkezési segítség */}
      {!session?.authenticated && (
        <div className="dark:border-dark-border border-t border-gray-200 p-3">
          <button
            onClick={() => setShowLoginHelp(true)}
            className={cn(
              'dark:hover:bg-dark-bg-tertiary dark:text-dark-text-muted flex min-h-[40px] w-full touch-manipulation items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-gray-500 hover:bg-gray-100',
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
