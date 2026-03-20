import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Calendar,
  Check,
  CheckSquare,
  ChevronDown,
  Clock,
  ExternalLink,
  Loader2,
  Mail,
  MailOpen,
  MapPin,
  RefreshCw,
  Sparkles,
  Square,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from '../../lib/toast';
import { useDashboard } from '../../hooks/useDashboard';
import { useUpdateDetectedTask } from '../../hooks/useDetectedTasks';
import { useLatestBrief, useGenerateBrief } from '../../hooks/useDailyBrief';
import { useMarketAnalysis } from '../../hooks/useMarketAnalysis';
import { useBatchDeleteEmails, useBatchMarkRead, useDeleteEmail } from '../../hooks/useEmails';
import { useDeleteCalendarEvent } from '../../hooks/useCalendar';
import type { ActionCenterItem, DashboardData, MarketRateInfo } from '../../types';

const DEFAULT_VISIBLE_ITEMS = 3;

function isSafeExternalLink(link: string): boolean {
  return /^https:\/\//i.test(link);
}

function buildEmailAppLink(emailId: string | null, accountId?: string | null): string | null {
  if (!emailId) return null;
  const params = new URLSearchParams({ emailId });
  if (accountId) params.set('accountId', accountId);
  return `/?${params.toString()}`;
}

function getQuoteAppLink(item: ActionCenterItem): string | null {
  return buildEmailAppLink(item.emailId, item.accountId) ?? item.links.app;
}

function formatTime(isoString: string): string {
  if (!isoString) return '';
  return format(new Date(isoString), 'HH:mm');
}

function formatFeedDue(timestamp: number): string {
  return format(new Date(timestamp), 'yyyy. MMM d. HH:mm', { locale: hu });
}

function formatDueDate(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(date);
  due.setHours(0, 0, 0, 0);

  const diff = Math.floor((due.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return `${Math.abs(diff)} napja lejárt`;
  if (diff === 0) return 'Ma';
  if (diff === 1) return 'Holnap';
  return format(date, 'MMM d.', { locale: hu });
}

function isOverdue(dateString: string): boolean {
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

function getSelectableEmailIds(item: Pick<ActionCenterItem, 'emailId' | 'emailIds'>): string[] {
  const ids = (item.emailIds ?? []).filter((id): id is string => Boolean(id));
  if (ids.length > 0) return ids;
  return item.emailId ? [item.emailId] : [];
}

function getTaskSelectableIds(task: DashboardData['openTasks'][number]): string[] {
  return task.emailId ? [task.emailId] : [];
}

function areAllSelected(selectedIds: Set<string>, ids: string[]): boolean {
  return ids.length > 0 && ids.every((id) => selectedIds.has(id));
}

export function DashboardView() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useDashboard();
  const updateTask = useUpdateDetectedTask();
  const batchDeleteEmails = useBatchDeleteEmails();
  const batchMarkRead = useBatchMarkRead();
  const deleteEmail = useDeleteEmail();
  const deleteCalendarEvent = useDeleteCalendarEvent();

  const { data: briefData } = useLatestBrief();
  const generateBrief = useGenerateBrief();
  const { data: marketData, isForceRefreshing, forceRefresh: refreshMarket } = useMarketAnalysis();

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedEmailIds, setSelectedEmailIds] = useState<Set<string>>(new Set());
  const [hiddenActionItemIds, setHiddenActionItemIds] = useState<Set<string>>(new Set());
  const [hiddenTaskIds, setHiddenTaskIds] = useState<Set<string>>(new Set());
  const [hiddenEventIds, setHiddenEventIds] = useState<Set<string>>(new Set());

  const actionCenter = data?.actionCenter?.blocks;
  const openTasks = data?.openTasks || [];
  const upcomingEvents =
    data?.todayEvents
      ?.filter((event) => !hiddenEventIds.has(event.id))
      .slice(0, DEFAULT_VISIBLE_ITEMS) || [];
  const topMarketRates = marketData?.rates.slice(0, 3) || [];
  const selectedCount = selectedEmailIds.size;

  const handleOpenApp = (link: string | null) => {
    if (!link) return;
    navigate(link);
  };

  const handleOpenCalendar = (eventId: string, start: string) => {
    const params = new URLSearchParams({ eventId });
    const date = new Date(start);
    if (!Number.isNaN(date.getTime())) {
      params.set('date', format(date, 'yyyy-MM-dd'));
    }
    navigate(`/calendar?${params.toString()}`);
  };

  const handleCompleteTask = (taskId: string) => {
    updateTask.mutate({ id: taskId, data: { status: 'done' } });
  };

  const hideActionItem = (id: string) => {
    setHiddenActionItemIds((prev) => new Set(prev).add(id));
  };

  const restoreActionItem = (id: string) => {
    setHiddenActionItemIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const hideTask = (id: string) => {
    setHiddenTaskIds((prev) => new Set(prev).add(id));
  };

  const restoreTask = (id: string) => {
    setHiddenTaskIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const hideEvent = (id: string) => {
    setHiddenEventIds((prev) => new Set(prev).add(id));
  };

  const restoreEvent = (id: string) => {
    setHiddenEventIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleDeleteCalendarEvent = (eventId: string) => {
    hideEvent(eventId);
    deleteCalendarEvent.mutate(eventId, {
      onError: () => {
        restoreEvent(eventId);
        toast.error('Hiba a naptári esemény törlésekor');
      },
    });
  };

  const handleDeleteActionItem = (item: ActionCenterItem) => {
    const ids = getSelectableEmailIds(item);
    if (ids.length === 0) return;

    hideActionItem(item.id);

    const onError = () => {
      restoreActionItem(item.id);
      toast.error('Hiba az email törlésekor');
    };

    if (ids.length === 1) {
      deleteEmail.mutate({ emailId: ids[0], accountId: item.accountId ?? undefined }, { onError });
      return;
    }

    batchDeleteEmails.mutate(
      { emailIds: ids, accountId: item.accountId ?? undefined },
      { onError },
    );
  };

  const handleDeleteTask = (task: DashboardData['openTasks'][number]) => {
    const ids = getTaskSelectableIds(task);
    if (ids.length === 0) return;

    hideTask(task.id);

    deleteEmail.mutate(
      { emailId: ids[0], accountId: task.accountId ?? undefined },
      {
        onError: () => {
          restoreTask(task.id);
          toast.error('Hiba az email törlésekor');
        },
      },
    );
  };

  const toggleItemSelection = (ids: string[]) => {
    if (ids.length === 0) return;
    setSelectedEmailIds((prev) => {
      const next = new Set(prev);
      const shouldRemove = ids.every((id) => next.has(id));
      ids.forEach((id) => {
        if (shouldRemove) {
          next.delete(id);
        } else {
          next.add(id);
        }
      });
      return next;
    });
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedEmailIds(new Set());
  };

  const handleBatchDelete = () => {
    if (selectedCount === 0) return;
    const confirmed = window.confirm(`${selectedCount} kijelölt email kerüljön a kukába?`);
    if (!confirmed) return;

    batchDeleteEmails.mutate(
      { emailIds: Array.from(selectedEmailIds) },
      {
        onSuccess: () => {
          exitSelectionMode();
        },
      },
    );
  };

  const handleBatchMarkRead = () => {
    if (selectedCount === 0) return;
    batchMarkRead.mutate(
      { emailIds: Array.from(selectedEmailIds), isRead: true },
      {
        onSuccess: () => {
          exitSelectionMode();
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#4f6ef7]" />
          <p className="dark:text-dark-text-secondary text-sm text-gray-500">
            Dashboard betöltése...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle className="h-8 w-8 text-red-500" />
          <p className="dark:text-dark-text-secondary text-sm text-gray-500">
            A dashboard betöltése sikertelen. Lehet, hogy újra kell jelentkezned a naptár és a
            feladatok eléréséhez.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-3 sm:space-y-6 sm:p-6">
      {selectionMode && (
        <div className="dark:bg-dark-bg-secondary dark:border-dark-border flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div>
            <p className="dark:text-dark-text text-sm font-medium text-gray-900">
              {selectedCount > 0
                ? `${selectedCount} email kijelölve`
                : 'Jelölj ki egy vagy több emailt a dashboard blokkokból.'}
            </p>
            <p className="dark:text-dark-text-muted text-xs text-gray-500">
              A naptári és Google Task elemek nem kijelölhetők, csak az email-alapú tételek.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleBatchMarkRead}
              disabled={selectedCount === 0 || batchMarkRead.isPending}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <MailOpen className="h-3.5 w-3.5" />
              Olvasottnak jelölés
            </button>
            <button
              onClick={handleBatchDelete}
              disabled={selectedCount === 0 || batchDeleteEmails.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Törlés
            </button>
            <button
              onClick={exitSelectionMode}
              className="rounded-lg px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Mégse
            </button>
          </div>
        </div>
      )}

      <DashboardSection
        title="Mai teendők"
        description="A levelek és AI-feladatok, amelyekhez ma tényleges emberi döntés kell."
        action={
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (selectionMode) {
                  exitSelectionMode();
                } else {
                  setSelectionMode(true);
                }
              }}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {selectionMode ? 'Kijelölés bezárása' : 'Kijelöléses mód'}
            </button>
            <button
              onClick={() => navigate('/tasks')}
              className="flex items-center gap-1 text-sm text-[#4f6ef7] hover:underline"
            >
              Feladatok <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4">
          <ActionCenterCard
            title="Sürgős ügyek"
            items={actionCenter?.urgentClientMatters}
            emptyText="Nincs sürgős emberi beavatkozást igénylő ügy."
            onOpenApp={handleOpenApp}
            selectionMode={selectionMode}
            selectedEmailIds={selectedEmailIds}
            onToggleSelection={toggleItemSelection}
            onDeleteItem={handleDeleteActionItem}
            hiddenItemIds={hiddenActionItemIds}
          />
          <ActionCenterCard
            title="Válaszra vár"
            items={actionCenter?.unanswered}
            emptyText="Nincs válaszra váró email."
            onOpenApp={handleOpenApp}
            selectionMode={selectionMode}
            selectedEmailIds={selectedEmailIds}
            onToggleSelection={toggleItemSelection}
            onDeleteItem={handleDeleteActionItem}
            hiddenItemIds={hiddenActionItemIds}
          />
          <OpenTasksCard
            title="AI feladatok"
            tasks={openTasks}
            emptyText="Minden feladat rendezett."
            onOpenTask={handleOpenApp}
            onCompleteTask={handleCompleteTask}
            selectionMode={selectionMode}
            selectedEmailIds={selectedEmailIds}
            onToggleSelection={toggleItemSelection}
            onDeleteTask={handleDeleteTask}
            hiddenTaskIds={hiddenTaskIds}
          />
        </div>
      </DashboardSection>

      <DashboardSection
        title="Időhöz kötött dolgok"
        description="Emailből felismert események, naptár és közelgő figyelendő ügyek."
        action={
          <button
            onClick={() => navigate('/calendar')}
            className="flex items-center gap-1 text-sm text-[#4f6ef7] hover:underline"
          >
            Naptár <ArrowRight className="h-3.5 w-3.5" />
          </button>
        }
      >
        <div className="grid grid-cols-1 gap-4">
          <ActionCenterCard
            title="Emailből felismert események"
            items={actionCenter?.suggestedEvents}
            emptyText="Nincs emailből felismert esemény."
            onOpenApp={handleOpenApp}
            selectionMode={selectionMode}
            selectedEmailIds={selectedEmailIds}
            onToggleSelection={toggleItemSelection}
            compact
          />
          <CalendarCard
            title="Mai naptári események"
            events={upcomingEvents}
            onOpenCalendar={handleOpenCalendar}
            onDeleteEvent={handleDeleteCalendarEvent}
          />
          <ActionCenterCard
            title="Figyelendő ügyek"
            items={actionCenter?.delegatedWatch}
            emptyText="Nincs közelgő figyelendő ügy."
            onOpenApp={handleOpenApp}
            selectionMode={selectionMode}
            selectedEmailIds={selectedEmailIds}
            onToggleSelection={toggleItemSelection}
            compact
          />
        </div>
      </DashboardSection>

      <DashboardSection
        title="Összefoglalók"
        description="Rövid napi áttekintés, fókuszlista és a piaci blokk a hosszabb oldal helyett."
      >
        <div className="grid grid-cols-1 gap-4">
          <ActionCenterCard
            title="Mai fókusz"
            items={actionCenter?.todayFocus}
            emptyText="Nincs mára fókuszált ügy."
            onOpenApp={handleOpenApp}
            selectionMode={selectionMode}
            selectedEmailIds={selectedEmailIds}
            onToggleSelection={toggleItemSelection}
            compact
          />
          <BriefSummaryCard
            summary={briefData?.brief?.summary || null}
            highlights={briefData?.brief?.highlights || []}
            isFresh={briefData?.brief?.isFresh || false}
            isPending={generateBrief.isPending}
            onGenerate={() => generateBrief.mutate()}
            onOpen={() => navigate('/tasks')}
          />
          <MarketSummaryCard
            marketData={marketData}
            topMarketRates={topMarketRates}
            isForceRefreshing={isForceRefreshing}
            onRefresh={() => void refreshMarket()}
            onOpen={() => navigate('/market')}
          />
        </div>
      </DashboardSection>
    </div>
  );
}

function DashboardSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="dark:text-dark-text text-lg font-semibold text-gray-900">{title}</h2>
          <p className="dark:text-dark-text-muted text-sm text-gray-500">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ActionCenterCard({
  title,
  items,
  emptyText,
  onOpenApp,
  selectionMode,
  selectedEmailIds,
  onToggleSelection,
  compact = false,
  onDeleteItem,
  hiddenItemIds,
}: {
  title: string;
  items?: ActionCenterItem[];
  emptyText: string;
  onOpenApp: (link: string | null) => void;
  selectionMode: boolean;
  selectedEmailIds: Set<string>;
  onToggleSelection: (ids: string[]) => void;
  compact?: boolean;
  onDeleteItem?: (item: ActionCenterItem) => void;
  hiddenItemIds?: Set<string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const list = (items ?? []).filter((item) => !hiddenItemIds?.has(item.id));
  const visibleItems = expanded ? list : list.slice(0, DEFAULT_VISIBLE_ITEMS);

  return (
    <div className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="dark:text-dark-text text-base font-semibold text-gray-900">{title}</h3>
        {list.length > DEFAULT_VISIBLE_ITEMS && (
          <button
            onClick={() => setExpanded((prev) => !prev)}
            className="flex items-center gap-1 text-xs text-[#4f6ef7] hover:underline"
          >
            {expanded ? 'Kevesebb' : `Még ${list.length - DEFAULT_VISIBLE_ITEMS}`}
            <ChevronDown
              className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')}
            />
          </button>
        )}
      </div>

      {visibleItems.length === 0 ? (
        <p className="dark:text-dark-text-muted py-6 text-center text-xs text-gray-500">
          {emptyText}
        </p>
      ) : (
        <div className="space-y-2">
          {visibleItems.map((item) => {
            const selectableIds = getSelectableEmailIds(item);
            const itemSelected = areAllSelected(selectedEmailIds, selectableIds);

            return (
              <div
                key={item.id}
                className="dark:border-dark-border dark:hover:bg-dark-bg-tertiary group flex items-start gap-3 rounded-lg border border-gray-100 p-3 transition-colors hover:bg-gray-50"
              >
                {selectionMode && selectableIds.length > 0 ? (
                  <button
                    onClick={() => onToggleSelection(selectableIds)}
                    className="mt-0.5 text-[#4f6ef7]"
                    title="Kijelölés"
                  >
                    {itemSelected ? (
                      <CheckSquare className="h-4 w-4" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                ) : (
                  <div
                    className={cn(
                      'mt-0.5 h-2.5 w-2.5 flex-shrink-0 rounded-full',
                      item.priority === 'critical'
                        ? 'bg-red-600'
                        : item.priority === 'high'
                          ? 'bg-red-500'
                          : item.priority === 'medium'
                            ? 'bg-yellow-500'
                            : 'bg-green-500',
                    )}
                  />
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {item.links.app ? (
                      <button
                        onClick={() => onOpenApp(item.links.app)}
                        className="min-w-0 text-left"
                      >
                        <p className="dark:text-dark-text truncate text-sm font-medium text-gray-900 hover:text-[#4f6ef7] dark:hover:text-[#88a2ff]">
                          {item.title}
                        </p>
                      </button>
                    ) : (
                      <p className="dark:text-dark-text truncate text-sm font-medium text-gray-900">
                        {item.title}
                      </p>
                    )}
                    {(item.groupSize ?? 0) > 1 && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
                        {item.groupSize} email
                      </span>
                    )}
                  </div>

                  {item.summary && (
                    <p className="dark:text-dark-text-muted truncate text-xs text-gray-500">
                      {item.summary}
                    </p>
                  )}

                  {item.quote && (
                    <button
                      onClick={() => onOpenApp(getQuoteAppLink(item))}
                      disabled={!getQuoteAppLink(item)}
                      className={cn(
                        'dark:text-dark-text-muted mt-1 block w-full text-left text-[11px] text-gray-400',
                        compact ? 'truncate' : 'line-clamp-2',
                        getQuoteAppLink(item) && 'hover:text-[#4f6ef7] dark:hover:text-[#88a2ff]',
                      )}
                    >
                      {item.quote}
                    </button>
                  )}

                  {item.dueAt != null && (
                    <p className="dark:text-dark-text-muted mt-1 text-[10px] text-gray-400">
                      {formatFeedDue(item.dueAt)}
                    </p>
                  )}

                  {!compact && item.suggestedAction && (
                    <p className="mt-1 text-[11px] text-[#4f6ef7] dark:text-[#88a2ff]">
                      {item.suggestedAction}
                    </p>
                  )}
                </div>

                <div className="flex flex-shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {item.links.app && (
                    <button
                      onClick={() => onOpenApp(item.links.app)}
                      className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10"
                      title="Megnyitás"
                    >
                      {item.links.app.startsWith('/calendar') ? (
                        <Calendar className="h-4 w-4" />
                      ) : (
                        <Mail className="h-4 w-4" />
                      )}
                    </button>
                  )}
                  {item.links.gmail && (
                    <a
                      href={item.links.gmail}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/40"
                      title="Megnyitás Gmailben"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                  {item.links.calendar && isSafeExternalLink(item.links.calendar) && (
                    <a
                      href={item.links.calendar}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg p-1.5 text-purple-600 hover:bg-purple-50 dark:text-purple-300 dark:hover:bg-purple-500/10"
                      title="Megnyitás a naptárban"
                    >
                      <Calendar className="h-4 w-4" />
                    </a>
                  )}
                  {onDeleteItem && getSelectableEmailIds(item).length > 0 && (
                    <button
                      onClick={() => onDeleteItem(item)}
                      className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                      title="Törlés"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OpenTasksCard({
  title,
  tasks,
  emptyText,
  onOpenTask,
  onCompleteTask,
  selectionMode,
  selectedEmailIds,
  onToggleSelection,
  onDeleteTask,
  hiddenTaskIds,
}: {
  title: string;
  tasks: DashboardData['openTasks'];
  emptyText: string;
  onOpenTask: (link: string | null) => void;
  onCompleteTask: (taskId: string) => void;
  selectionMode: boolean;
  selectedEmailIds: Set<string>;
  onToggleSelection: (ids: string[]) => void;
  onDeleteTask?: (task: DashboardData['openTasks'][number]) => void;
  hiddenTaskIds?: Set<string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const filteredTasks = tasks.filter((task) => !hiddenTaskIds?.has(task.id));
  const visibleTasks = expanded ? filteredTasks : filteredTasks.slice(0, DEFAULT_VISIBLE_ITEMS);

  return (
    <div className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="dark:text-dark-text text-base font-semibold text-gray-900">{title}</h3>
        {filteredTasks.length > DEFAULT_VISIBLE_ITEMS && (
          <button
            onClick={() => setExpanded((prev) => !prev)}
            className="flex items-center gap-1 text-xs text-[#4f6ef7] hover:underline"
          >
            {expanded ? 'Kevesebb' : `Még ${filteredTasks.length - DEFAULT_VISIBLE_ITEMS}`}
            <ChevronDown
              className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')}
            />
          </button>
        )}
      </div>

      {visibleTasks.length === 0 ? (
        <p className="dark:text-dark-text-muted py-6 text-center text-xs text-gray-500">
          {emptyText}
        </p>
      ) : (
        <div className="space-y-2">
          {visibleTasks.map((task) => {
            const selectableIds = getTaskSelectableIds(task);
            const selected = areAllSelected(selectedEmailIds, selectableIds);

            return (
              <div
                key={task.id}
                className="dark:border-dark-border dark:hover:bg-dark-bg-tertiary group flex items-start gap-2.5 rounded-lg border border-gray-100 p-3 transition-colors hover:bg-gray-50"
              >
                {selectionMode && selectableIds.length > 0 ? (
                  <button
                    onClick={() => onToggleSelection(selectableIds)}
                    className="mt-0.5 text-[#4f6ef7]"
                    title="Kijelölés"
                  >
                    {selected ? (
                      <CheckSquare className="h-4 w-4" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                ) : (
                  <div className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-2 border-gray-300 dark:border-gray-600" />
                )}

                <div className="min-w-0 flex-1">
                  <button
                    onClick={() =>
                      onOpenTask(
                        task.appLink ||
                          buildEmailAppLink(task.emailId ?? null, task.accountId ?? null) ||
                          '/tasks',
                      )
                    }
                    className="block w-full text-left"
                  >
                    <p className="dark:text-dark-text truncate text-sm font-medium text-gray-900 hover:text-[#4f6ef7] dark:hover:text-[#88a2ff]">
                      {task.title}
                    </p>
                  </button>

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                    <span>{task.listTitle}</span>
                    {task.due && (
                      <>
                        <span>·</span>
                        <span
                          className={cn(
                            isOverdue(task.due) && 'font-medium text-red-500 dark:text-red-400',
                          )}
                        >
                          {formatDueDate(task.due)}
                        </span>
                      </>
                    )}
                  </div>

                  {task.notes && (
                    <p className="dark:text-dark-text-muted mt-1 line-clamp-2 text-[11px] text-gray-400">
                      {task.notes}
                    </p>
                  )}
                </div>

                <div className="flex flex-shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {task.listId === 'detected' && (
                    <button
                      onClick={() => onCompleteTask(task.id)}
                      className="rounded-lg p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-500/10"
                      title="Kész"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() =>
                      onOpenTask(
                        task.appLink ||
                          buildEmailAppLink(task.emailId ?? null, task.accountId ?? null) ||
                          '/tasks',
                      )
                    }
                    className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10"
                    title="Megnyitás"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  {onDeleteTask && getTaskSelectableIds(task).length > 0 && (
                    <button
                      onClick={() => onDeleteTask(task)}
                      className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                      title="Törlés"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CalendarCard({
  title,
  events,
  onOpenCalendar,
  onDeleteEvent,
}: {
  title: string;
  events: DashboardData['todayEvents'];
  onOpenCalendar: (eventId: string, start: string) => void;
  onDeleteEvent?: (eventId: string) => void;
}) {
  return (
    <div className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Calendar className="h-5 w-5 text-purple-500" />
        <h3 className="dark:text-dark-text text-base font-semibold text-gray-900">{title}</h3>
      </div>

      {events.length === 0 ? (
        <p className="dark:text-dark-text-muted py-6 text-center text-xs text-gray-500">
          Nincs ma több naptári esemény.
        </p>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <div
              key={event.id}
              className={cn(
                'dark:border-dark-border group dark:hover:bg-dark-bg-tertiary relative w-full rounded-lg border p-3 text-left transition-colors hover:bg-gray-50',
                event.isAllDay
                  ? 'dark:bg-dark-bg-tertiary/50 border-gray-200 bg-gray-50/50'
                  : 'border-purple-200 bg-purple-50/30 dark:border-purple-500/20 dark:bg-purple-500/5',
              )}
            >
              <button
                onClick={() => onOpenCalendar(event.id, event.start)}
                className="block w-full text-left"
              >
                <p className="dark:text-dark-text truncate text-sm font-medium text-gray-900">
                  {event.summary}
                </p>
                <div className="dark:text-dark-text-muted mt-1 flex items-center gap-2 text-xs text-gray-500">
                  <Clock className="h-3 w-3" />
                  {event.isAllDay
                    ? 'Egész napos'
                    : `${formatTime(event.start)} – ${formatTime(event.end)}`}
                </div>
                {event.location && (
                  <div className="dark:text-dark-text-muted mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{event.location}</span>
                  </div>
                )}
              </button>

              {onDeleteEvent && event.isOrganizer && (
                <button
                  onClick={(eventClick) => {
                    eventClick.stopPropagation();
                    onDeleteEvent(event.id);
                  }}
                  className="absolute top-2 right-2 rounded-lg p-1.5 text-red-500 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-500/10"
                  title="Törlés"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BriefSummaryCard({
  summary,
  highlights,
  isFresh,
  isPending,
  onGenerate,
  onOpen,
}: {
  summary: string | null;
  highlights: string[];
  isFresh: boolean;
  isPending: boolean;
  onGenerate: () => void;
  onOpen: () => void;
}) {
  return (
    <div className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[#4f6ef7]" />
          <h3 className="dark:text-dark-text text-base font-semibold text-gray-900">
            Napi AI brief
          </h3>
        </div>
        <button onClick={onOpen} className="text-xs text-[#4f6ef7] hover:underline">
          Részletes nézet
        </button>
      </div>

      {isFresh && summary ? (
        <>
          <p className="dark:text-dark-text-secondary text-sm leading-relaxed text-gray-600">
            {summary}
          </p>
          {highlights.length > 0 && (
            <ul className="mt-3 space-y-2">
              {highlights.slice(0, 3).map((highlight, index) => (
                <li
                  key={index}
                  className="dark:text-dark-text-muted flex items-start gap-2 text-xs text-gray-500"
                >
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#4f6ef7]" />
                  <span>{highlight}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <p className="dark:text-dark-text-muted text-sm text-gray-500">
            Nincs friss brief. Generálj új napi összefoglalót az AI-val.
          </p>
          <button
            onClick={onGenerate}
            disabled={isPending}
            className="flex items-center gap-2 rounded-lg bg-[#4f6ef7] px-3 py-2 text-xs font-medium text-white hover:bg-[#3d5ce5] disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            AI Brief generálása
          </button>
        </div>
      )}
    </div>
  );
}

function MarketSummaryCard({
  marketData,
  topMarketRates,
  isForceRefreshing,
  onRefresh,
  onOpen,
}: {
  marketData:
    | {
        isAIPowered?: boolean;
        overallSentiment?: string;
        generatedAt?: string | number;
        fallbackMessage?: string | null;
      }
    | undefined;
  topMarketRates: MarketRateInfo[];
  isForceRefreshing: boolean;
  onRefresh: () => void;
  onOpen: () => void;
}) {
  return (
    <div className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-emerald-500" />
            <h3 className="dark:text-dark-text text-base font-semibold text-gray-900">
              Piaci összkép
            </h3>
          </div>
          <p className="dark:text-dark-text-muted mt-1 text-sm text-gray-500">
            Rövid market kivonat a napi döntésekhez.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={isForceRefreshing}
            className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <span className="flex items-center gap-1">
              <RefreshCw className={cn('h-3.5 w-3.5', isForceRefreshing && 'animate-spin')} />
              Frissítés
            </span>
          </button>
          <button onClick={onOpen} className="text-xs text-[#4f6ef7] hover:underline">
            Market nézet
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/60 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/5">
        <div className="mb-2 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-500" />
          <p className="dark:text-dark-text text-sm font-medium text-gray-900">
            {marketData?.isAIPowered ? 'AI-alapú piaci összkép' : 'Fallback piaci összkép'}
          </p>
        </div>
        <p className="dark:text-dark-text-secondary text-sm leading-relaxed text-gray-600">
          {marketData?.overallSentiment || 'A piaci briefing betöltése folyamatban van.'}
        </p>
        {marketData?.generatedAt && (
          <p className="dark:text-dark-text-muted mt-2 text-xs text-gray-500">
            Frissítve:{' '}
            {format(new Date(marketData.generatedAt), 'yyyy. MMM d. HH:mm', { locale: hu })}
          </p>
        )}
        {marketData && !marketData.isAIPowered && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">
            {marketData.fallbackMessage || 'A piaci modul jelenleg fallback összegzést mutat.'}
          </p>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {topMarketRates.length > 0 ? (
          topMarketRates.map((rate) => (
            <button
              key={rate.pair}
              onClick={onOpen}
              className="dark:border-dark-border dark:hover:bg-dark-bg-tertiary dark:bg-dark-bg-tertiary/40 flex w-full items-center justify-between rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-2 text-left hover:bg-gray-50"
            >
              <div>
                <p className="dark:text-dark-text text-sm font-medium text-gray-900">
                  {rate.label}
                </p>
                <p className="dark:text-dark-text-muted text-xs text-gray-500">{rate.pair}</p>
              </div>
              <div className="text-right">
                <p className="dark:text-dark-text text-sm font-semibold text-gray-900">
                  {rate.rate.toFixed(
                    rate.pair.endsWith('HUF') || rate.pair.startsWith('XAU') ? 2 : 4,
                  )}
                </p>
                <p
                  className={cn(
                    'text-xs font-medium',
                    rate.changePercent >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400',
                  )}
                >
                  {rate.changePercent >= 0 ? '+' : ''}
                  {rate.changePercent.toFixed(2)}%
                </p>
              </div>
            </button>
          ))
        ) : (
          <p className="dark:text-dark-text-muted rounded-xl border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-500 dark:border-gray-700">
            A piaci adatok még nem érkeztek meg.
          </p>
        )}
      </div>
    </div>
  );
}
