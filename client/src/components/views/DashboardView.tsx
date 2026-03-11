import { useNavigate } from 'react-router-dom';
import { useDashboard } from '../../hooks/useDashboard';
import { useDetectedTasks, useDetectedTaskStats, useUpdateDetectedTask } from '../../hooks/useDetectedTasks';
import { useLatestBrief, useGenerateBrief } from '../../hooks/useDailyBrief';
import { useMarketAnalysis } from '../../hooks/useMarketAnalysis';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import {
  Mail,
  Calendar,
  CheckSquare,
  Clock,
  MapPin,
  ArrowRight,
  Loader2,
  AlertCircle,
  Sparkles,
  Zap,
  Reply,
  Check,
  ExternalLink,
  BarChart3,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ActionCenterItem } from '../../types';

const GREETINGS = [
  { from: 0, to: 5, text: 'Jó éjszakát' },
  { from: 5, to: 9, text: 'Jó reggelt' },
  { from: 9, to: 18, text: 'Jó napot' },
  { from: 18, to: 22, text: 'Jó estét' },
  { from: 22, to: 24, text: 'Jó éjszakát' },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  return GREETINGS.find((g) => hour >= g.from && hour < g.to)?.text || 'Szia';
}

export function DashboardView() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useDashboard();
  const { data: detectedTasksData } = useDetectedTasks({ status: 'open', limit: 5 });
  const { data: detectedTaskStats } = useDetectedTaskStats();
  const updateTask = useUpdateDetectedTask();

  const { data: briefData } = useLatestBrief();
  const generateBrief = useGenerateBrief();
  const { data: marketData, isForceRefreshing, forceRefresh: refreshMarket } = useMarketAnalysis();

  const today = new Date();
  const formattedDate = format(today, 'yyyy. MMMM d., EEEE', { locale: hu });

  const detectedTasks = detectedTasksData?.tasks || [];
  const upcomingEvents = data?.todayEvents?.slice(0, 2) || [];
  const actionCenter = data?.actionCenter?.blocks;
  const topMarketRates = marketData?.rates.slice(0, 3) || [];

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
            A dashboard betöltése sikertelen. Lehet, hogy újra kell jelentkezned a
            naptár és feladatok eléréséhez.
          </p>
        </div>
      </div>
    );
  }

  // Build briefing text
  const urgentTasks = Math.max(
    detectedTaskStats?.high ?? 0,
    data?.actionCenter?.blocks.urgentClientMatters?.length ?? 0,
  );
  const openTaskCount = data?.openTasksCount ?? 0;
  const todayEventCount = data?.todayEventsCount ?? 0;
  const unread = data?.unreadCount ?? 0;

  const briefingParts: string[] = [];
  if (urgentTasks > 0) briefingParts.push(`${urgentTasks} sürgős feladat`);
  if (todayEventCount > 0) briefingParts.push(`${todayEventCount} esemény ma`);
  if (unread > 0) briefingParts.push(`${unread} olvasatlan levél`);
  if (openTaskCount > 0) briefingParts.push(`${openTaskCount} nyitott teendő`);

  const briefingText = briefingParts.length > 0
    ? briefingParts.join(' · ')
    : 'Minden rendben — nincs sürgős teendő! 🎉';

  const handleCompleteTask = (taskId: string) => {
    updateTask.mutate({ id: taskId, data: { status: 'done' } });
  };

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

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      {/* Hero AI Briefing Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#4f6ef7] to-[#7c3aed] p-5 text-white shadow-lg sm:p-8">
        <div className="absolute right-0 top-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-white/10 blur-2xl sm:h-48 sm:w-48" />
        <div className="absolute bottom-0 left-0 h-24 w-24 -translate-x-6 translate-y-6 rounded-full bg-white/5 blur-xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-1">
            <Sparkles className="h-6 w-6 text-yellow-300" />
            <span className="text-sm font-medium text-white/80">Napi AI Briefing</span>
          </div>
          <h1 className="text-2xl font-bold sm:text-3xl">
            {getGreeting()}!
          </h1>
          <p className="mt-1 text-sm text-white/70">{formattedDate}</p>
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-white/15 px-4 py-3 backdrop-blur-sm">
            <Zap className="h-5 w-5 flex-shrink-0 text-yellow-300" />
            <p className="text-sm font-medium">{briefingText}</p>
          </div>

          {/* AI Daily Brief */}
          {briefData?.brief?.isFresh && briefData.brief.summary && (
            <div className="mt-3 rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm">
              <p className="text-sm text-white/90">{briefData.brief.summary}</p>
              {briefData.brief.highlights.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {briefData.brief.highlights.map((h, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-white/75">
                      <span className="h-1 w-1 rounded-full bg-yellow-300" />
                      {h}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {!briefData?.brief?.isFresh && (
            <button
              onClick={() => generateBrief.mutate()}
              disabled={generateBrief.isPending}
              className="mt-3 flex items-center gap-2 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm transition-colors hover:bg-white/25 disabled:opacity-50"
            >
              {generateBrief.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              AI Brief generálása
            </button>
          )}
        </div>
      </div>

      {/* Aktív Workflow Blokkok */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ActionCenterBlock
          title="Mai fókusz"
          items={actionCenter?.todayFocus}
          emptyText="Nincs mára határidős teendő."
          onOpenApp={handleOpenApp}
        />
        <ActionCenterBlock
          title="Azonnali intézkedést igényel"
          items={actionCenter?.urgentClientMatters}
          emptyText="Nincs sürgős válasz."
          onOpenApp={handleOpenApp}
        />
        <ActionCenterBlock
          title="Válasz nélkül maradt emailek"
          items={actionCenter?.unanswered}
          emptyText="Nincs válasz nélkül maradt email."
          onOpenApp={handleOpenApp}
        />
        <ActionCenterBlock
          title="Többször utánkövetett ügyek"
          items={actionCenter?.repeatedFollowUps}
          emptyText="Nincs többször utánkövetett ügy."
          onOpenApp={handleOpenApp}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ActionCenterBlock
          title="Emailből felismert határidők / találkozók"
          items={actionCenter?.suggestedEvents}
          emptyText="Nincs közelgő határidő emailből."
          onOpenApp={handleOpenApp}
          compact
        />
        <ActionCenterBlock
          title="Mai naptári események"
          items={actionCenter?.todayCalendar}
          emptyText="Nincs mai naptári esemény."
          onOpenApp={handleOpenApp}
          compact
        />
        <ActionCenterBlock
          title="Következő figyelendő ügyek"
          items={actionCenter?.delegatedWatch}
          emptyText="Nincs közelgő figyelendő ügy."
          onOpenApp={handleOpenApp}
          compact
        />
      </div>

      <div className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="dark:text-dark-text flex items-center gap-2 text-lg font-semibold text-gray-900">
              <BarChart3 className="h-5 w-5 text-emerald-500" />
              Piaci operáció
            </h2>
            <p className="dark:text-dark-text-muted mt-1 text-sm text-gray-500">
              Friss market összkép a napi döntésekhez.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void refreshMarket()}
              disabled={isForceRefreshing}
              className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <span className="flex items-center gap-1">
                <RefreshCw className={cn('h-3.5 w-3.5', isForceRefreshing && 'animate-spin')} />
                Frissítés
              </span>
            </button>
            <button
              onClick={() => navigate('/market')}
              className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600"
            >
              Market nézet
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
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
                Frissítve: {format(new Date(marketData.generatedAt), 'yyyy. MMM d. HH:mm', { locale: hu })}
              </p>
            )}
            {marketData && !marketData.isAIPowered && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">
                {marketData.fallbackMessage || 'A piaci modul jelenleg sablon-alapú fallback összegzést mutat.'}
              </p>
            )}
          </div>

          <div className="space-y-2">
            {topMarketRates.length > 0 ? topMarketRates.map((rate) => (
              <button
                key={rate.pair}
                onClick={() => navigate('/market')}
                className="dark:border-dark-border dark:hover:bg-dark-bg-tertiary flex w-full items-center justify-between rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-2 text-left hover:bg-gray-50 dark:bg-dark-bg-tertiary/40"
              >
                <div>
                  <p className="dark:text-dark-text text-sm font-medium text-gray-900">{rate.label}</p>
                  <p className="dark:text-dark-text-muted text-xs text-gray-500">{rate.pair}</p>
                </div>
                <div className="text-right">
                  <p className="dark:text-dark-text text-sm font-semibold text-gray-900">
                    {rate.rate.toFixed(rate.pair.endsWith('HUF') || rate.pair.startsWith('XAU') ? 2 : 4)}
                  </p>
                  <p className={cn(
                    'text-xs font-medium',
                    rate.changePercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
                  )}>
                    {rate.changePercent >= 0 ? '+' : ''}{rate.changePercent.toFixed(2)}%
                  </p>
                </div>
              </button>
            )) : (
              <p className="dark:text-dark-text-muted rounded-xl border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-500 dark:border-gray-700">
                A piaci adatok még nem érkeztek meg.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left: Smart Triage — top 3 unanswered */}
        <div className="lg:col-span-2 dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="dark:text-dark-text flex items-center gap-2 text-lg font-semibold text-gray-900">
              <Mail className="h-5 w-5 text-[#4f6ef7]" />
              Smart Triage
            </h2>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1 text-sm text-[#4f6ef7] hover:underline"
            >
              Inbox <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {detectedTasks.length > 0 ? (
            <div className="space-y-2">
              {detectedTasks.slice(0, 3).map((task) => (
                <div
                  key={task.id}
                  className="dark:border-dark-border dark:hover:bg-dark-bg-tertiary group flex items-start gap-3 rounded-lg border border-gray-100 p-3 transition-colors hover:bg-gray-50"
                >
                  <div
                    className={cn(
                      'mt-0.5 h-2.5 w-2.5 flex-shrink-0 rounded-full',
                      task.priority === 'high'
                        ? 'bg-red-500'
                        : task.priority === 'medium'
                          ? 'bg-yellow-500'
                          : 'bg-green-500',
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="dark:text-dark-text truncate text-sm font-medium text-gray-900">
                      {task.subject || 'Email feladat'}
                    </p>
                    <div className="dark:text-dark-text-muted mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                      <span className="truncate">{task.fromName || task.fromEmail || ''}</span>
                      {task.reason && (
                        <>
                          <span>·</span>
                          <span className="truncate">{task.reason}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => handleCompleteTask(task.id)}
                      className="rounded-lg p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-500/10"
                      title="Kész"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => navigate(`/?emailId=${encodeURIComponent(task.emailId)}${task.accountId ? `&accountId=${encodeURIComponent(task.accountId)}` : ''}`)}
                      className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10"
                      title="Megnyitás"
                    >
                      <Reply className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="dark:text-dark-text-muted py-8 text-center text-sm text-gray-500">
              Nincs megválaszolatlan email — szép munka! ✅
            </div>
          )}
        </div>

        {/* Right column: Calendar + Tasks stacked */}
        <div className="space-y-4">
          {/* Calendar: next 2 events */}
          <div className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="dark:text-dark-text flex items-center gap-2 text-base font-semibold text-gray-900">
                <Calendar className="h-5 w-5 text-purple-500" />
                Következő események
              </h2>
              <button
                onClick={() => navigate('/calendar')}
                className="text-xs text-[#4f6ef7] hover:underline"
              >
                Mind
              </button>
            </div>

            {upcomingEvents.length > 0 ? (
              <div className="space-y-2">
                {upcomingEvents.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => handleOpenCalendar(event.id, event.start)}
                    className={cn(
                      'dark:border-dark-border dark:hover:bg-dark-bg-tertiary w-full rounded-lg border p-3 text-left transition-colors hover:bg-gray-50',
                      event.isAllDay
                        ? 'border-gray-200 bg-gray-50/50 dark:bg-dark-bg-tertiary/50'
                        : 'border-purple-200 bg-purple-50/30 dark:border-purple-500/20 dark:bg-purple-500/5',
                    )}
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
                ))}
              </div>
            ) : (
              <p className="dark:text-dark-text-muted py-4 text-center text-xs text-gray-500">
                Nincs ma több esemény 🎉
              </p>
            )}
          </div>

          {/* AI Detected Tasks — checkable */}
          <div className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="dark:text-dark-text flex items-center gap-2 text-base font-semibold text-gray-900">
                <CheckSquare className="h-5 w-5 text-green-500" />
                AI Feladatok
              </h2>
              <button
                onClick={() => navigate('/tasks')}
                className="text-xs text-[#4f6ef7] hover:underline"
              >
                Mind
              </button>
            </div>

            {data?.openTasks && data.openTasks.length > 0 ? (
              <div className="space-y-2">
                {data.openTasks.slice(0, 4).map((task) => (
                  <button
                    key={task.id}
                    onClick={() =>
                      task.appLink
                        ? navigate(task.appLink)
                        : task.emailId
                          ? navigate(`/?emailId=${encodeURIComponent(task.emailId)}${task.accountId ? `&accountId=${encodeURIComponent(task.accountId)}` : ''}`)
                          : navigate('/tasks')
                    }
                    className="dark:border-dark-border dark:hover:bg-dark-bg-tertiary flex w-full items-start gap-2.5 rounded-lg border border-gray-100 p-2.5 text-left transition-colors hover:bg-gray-50"
                  >
                    <div className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-2 border-gray-300 dark:border-gray-600" />
                    <div className="min-w-0 flex-1">
                      <p className="dark:text-dark-text truncate text-xs font-medium text-gray-900">
                        {task.title}
                      </p>
                      {task.due && (
                        <p
                          className={cn(
                            'mt-0.5 text-[10px]',
                            isOverdue(task.due)
                              ? 'font-medium text-red-500 dark:text-red-400'
                              : 'text-gray-500 dark:text-gray-400',
                          )}
                        >
                          {formatDueDate(task.due)}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="dark:text-dark-text-muted py-4 text-center text-xs text-gray-500">
                Minden feladat kész ✅
              </p>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}

// Segédfüggvények

function ActionCenterBlock({
  title,
  items,
  emptyText,
  onOpenApp,
  compact = false,
}: {
  title: string;
  items?: ActionCenterItem[];
  emptyText: string;
  onOpenApp: (link: string | null) => void;
  compact?: boolean;
}) {
  const list = items?.slice(0, 5) ?? [];

  return (
    <div className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="dark:text-dark-text text-base font-semibold text-gray-900">
          {title}
        </h2>
      </div>

      {list.length > 0 ? (
        <div className="space-y-2">
          {list.map((item) => (
            <div
              key={item.id}
              className="dark:border-dark-border dark:hover:bg-dark-bg-tertiary group flex items-start gap-3 rounded-lg border border-gray-100 p-3 transition-colors hover:bg-gray-50"
            >
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
              <div className="min-w-0 flex-1">
                {item.links.app ? (
                  <button
                    onClick={() => onOpenApp(item.links.app)}
                    className="block w-full text-left"
                  >
                    <p className="dark:text-dark-text truncate text-sm font-medium text-gray-900 hover:text-[#4f6ef7] dark:hover:text-[#88a2ff]">
                      {item.title}
                    </p>
                    {item.summary && (
                      <p className="dark:text-dark-text-muted truncate text-xs text-gray-500">
                        {item.summary}
                      </p>
                    )}
                  </button>
                ) : (
                  <>
                    <p className="dark:text-dark-text truncate text-sm font-medium text-gray-900">
                      {item.title}
                    </p>
                    {item.summary && (
                      <p className="dark:text-dark-text-muted truncate text-xs text-gray-500">
                        {item.summary}
                      </p>
                    )}
                  </>
                )}
                {item.quote && (
                  <button
                    onClick={() => onOpenApp(getQuoteAppLink(item))}
                    disabled={!getQuoteAppLink(item)}
                    className={cn(
                      'block w-full text-left dark:text-dark-text-muted text-[11px] text-gray-400',
                      compact ? 'truncate' : 'line-clamp-2',
                      getQuoteAppLink(item) && 'hover:text-[#4f6ef7] dark:hover:text-[#88a2ff]',
                    )}
                  >
                    {item.quote}
                  </button>
                )}
                {item.dueAt != null ? (
                  <p className="dark:text-dark-text-muted mt-1 text-[10px] text-gray-400">
                    {formatFeedDue(item.dueAt)}
                  </p>
                ) : null}
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
                    title="Megnyitás az appban"
                  >
                    {item.links.app.startsWith('/calendar') ? <Calendar className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
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
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="dark:text-dark-text-muted py-4 text-center text-xs text-gray-500">
          {emptyText}
        </p>
      )}
    </div>
  );
}

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
  const date = new Date(isoString);
  return format(date, 'HH:mm');
}

function formatFeedDue(timestamp: number): string {
  const date = new Date(timestamp);
  return format(date, 'yyyy. MMM d. HH:mm', { locale: hu });
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
