import { useNavigate } from 'react-router-dom';
import { useDashboard } from '../../hooks/useDashboard';
import { useDetectedTasks, useUpdateDetectedTask } from '../../hooks/useDetectedTasks';
import { useCalendarEvents } from '../../hooks/useCalendar';
import { useUnreadCount } from '../../hooks/useInbox';
import { useSession } from '../../hooks/useAccounts';
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
  LayoutDashboard,
  Sparkles,
  Zap,
  Reply,
  Check,
} from 'lucide-react';
import { cn } from '../../lib/utils';

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
  const { data: session } = useSession();
  const { data, isLoading, error } = useDashboard();
  const { data: detectedTasksData } = useDetectedTasks({ status: 'open', limit: 5 });
  const updateTask = useUpdateDetectedTask();

  // Calendar: next 2 events from now
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  const { data: calendarData } = useCalendarEvents({
    timeMin: now.toISOString(),
    timeMax: endOfDay.toISOString(),
  });
  const { data: unreadCount } = useUnreadCount(session?.activeAccountId || undefined);

  const today = new Date();
  const formattedDate = format(today, 'yyyy. MMMM d., EEEE', { locale: hu });

  const detectedTasks = detectedTasksData?.tasks || [];
  const upcomingEvents = calendarData?.events?.slice(0, 2) || data?.todayEvents?.slice(0, 2) || [];

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
  const urgentTasks = detectedTasks.filter((t) => t.priority === 'high').length;
  const openTaskCount = data?.openTasksCount ?? 0;
  const todayEventCount = data?.todayEventsCount ?? 0;
  const unread = unreadCount ?? data?.unreadCount ?? 0;

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
                      onClick={() => navigate(`/?emailId=${task.emailId}`)}
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
                    onClick={() => navigate('/calendar')}
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
                    onClick={() => navigate('/tasks')}
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

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={Mail}
          label="Olvasatlan levél"
          value={unread}
          color="blue"
          onClick={() => navigate('/')}
        />
        <StatCard
          icon={Calendar}
          label="Mai események"
          value={todayEventCount}
          color="purple"
          onClick={() => navigate('/calendar')}
        />
        <StatCard
          icon={CheckSquare}
          label="Nyitott feladatok"
          value={openTaskCount}
          color="green"
          onClick={() => navigate('/tasks')}
        />
      </div>
    </div>
  );
}

// Segédfüggvények

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: 'blue' | 'purple' | 'green';
  onClick: () => void;
}) {
  const colorStyles = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400',
    green: 'bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400',
  };

  return (
    <button
      onClick={onClick}
      className="dark:bg-dark-bg-secondary dark:border-dark-border dark:hover:bg-dark-bg-tertiary rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-all hover:shadow-md"
    >
      <div className="flex items-center gap-4">
        <div className={cn('rounded-lg p-2.5', colorStyles[color])}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="dark:text-dark-text text-2xl font-bold text-gray-900">{value}</p>
          <p className="dark:text-dark-text-secondary text-sm text-gray-500">{label}</p>
        </div>
      </div>
    </button>
  );
}

function formatTime(isoString: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  return format(date, 'HH:mm');
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
