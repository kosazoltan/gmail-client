import { useNavigate } from 'react-router-dom';
import { useDashboard } from '../../hooks/useDashboard';
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
} from 'lucide-react';
import { cn } from '../../lib/utils';

const GREETINGS = [
  { from: 0, to: 5, text: 'Jó éjszakát' },
  { from: 5, to: 9, text: 'Jó reggelt' },
  { from: 9, to: 18, text: 'Jó napot' },
  { from: 18, to: 22, text: 'Jó estét' },
  { from: 22, to: 24, text: 'Jó éjszakát' },
];

const QUOTES = [
  'A produktivitás nem az elfoglaltságról szól, hanem a hatékonyságról.',
  'Egy lépés naponta nagy utat jelent egy év alatt.',
  'Szervezd meg a napodat, és a napod megszervezi az életedet.',
  'A legjobb idő az elkezdésre: most.',
  'Fókuszálj arra, ami igazán fontos.',
  'A kis győzelmek nagy sikerekké állnak össze.',
  'Tervezz előre — a holnap a mai döntéseidből születik.',
];

function getGreeting(): string {
  const hour = new Date().getHours();
  return GREETINGS.find((g) => hour >= g.from && hour < g.to)?.text || 'Szia';
}

function getDailyQuote(): string {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
  );
  return QUOTES[dayOfYear % QUOTES.length];
}

export function DashboardView() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useDashboard();

  const today = new Date();
  const formattedDate = format(today, 'yyyy. MMMM d., EEEE', { locale: hu });

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

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      {/* Fejléc */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="h-7 w-7 text-[#4f6ef7]" />
          <h1 className="dark:text-dark-text text-2xl font-bold text-gray-900 sm:text-3xl">
            {getGreeting()}, Zoltán!
          </h1>
        </div>
        <p className="dark:text-dark-text-secondary text-sm text-gray-500">{formattedDate}</p>
        <p className="dark:text-dark-text-muted text-sm italic text-gray-400">
          „{getDailyQuote()}"
        </p>
      </div>

      {/* Statisztika kártyák */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={Mail}
          label="Olvasatlan levél"
          value={data?.unreadCount ?? 0}
          color="blue"
          onClick={() => navigate('/')}
        />
        <StatCard
          icon={Calendar}
          label="Mai események"
          value={data?.todayEventsCount ?? 0}
          color="purple"
          onClick={() => navigate('/calendar')}
        />
        <StatCard
          icon={CheckSquare}
          label="Nyitott feladatok"
          value={data?.openTasksCount ?? 0}
          color="green"
          onClick={() => navigate('/tasks')}
        />
      </div>

      {/* Mai események + Feladatok sor */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Mai naptár események */}
        <div className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="dark:text-dark-text flex items-center gap-2 text-lg font-semibold text-gray-900">
              <Calendar className="h-5 w-5 text-purple-500" />
              Mai események
            </h2>
            <button
              onClick={() => navigate('/calendar')}
              className="flex items-center gap-1 text-sm text-[#4f6ef7] hover:underline"
            >
              Összes <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {data?.todayEvents && data.todayEvents.length > 0 ? (
            <div className="space-y-2">
              {data.todayEvents.slice(0, 5).map((event) => (
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
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'mt-0.5 h-2 w-2 flex-shrink-0 rounded-full',
                        event.isAllDay ? 'bg-gray-400' : 'bg-purple-500',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="dark:text-dark-text truncate text-sm font-medium text-gray-900">
                        {event.summary}
                      </p>
                      <div className="dark:text-dark-text-muted mt-0.5 flex items-center gap-2 text-xs text-gray-500">
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
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="dark:text-dark-text-muted py-8 text-center text-sm text-gray-500">
              Nincs ma esemény — szabad a nap! 🎉
            </div>
          )}
        </div>

        {/* Sürgős teendők */}
        <div className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="dark:text-dark-text flex items-center gap-2 text-lg font-semibold text-gray-900">
              <CheckSquare className="h-5 w-5 text-green-500" />
              Nyitott feladatok
            </h2>
            <button
              onClick={() => navigate('/tasks')}
              className="flex items-center gap-1 text-sm text-[#4f6ef7] hover:underline"
            >
              Összes <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {data?.openTasks && data.openTasks.length > 0 ? (
            <div className="space-y-2">
              {data.openTasks.slice(0, 5).map((task) => (
                <button
                  key={task.id}
                  onClick={() => navigate('/tasks')}
                  className="dark:border-dark-border dark:hover:bg-dark-bg-tertiary w-full rounded-lg border border-gray-200 p-3 text-left transition-colors hover:bg-gray-50"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-2 border-gray-300 dark:border-gray-600" />
                    <div className="min-w-0 flex-1">
                      <p className="dark:text-dark-text truncate text-sm font-medium text-gray-900">
                        {task.title}
                      </p>
                      <div className="dark:text-dark-text-muted mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                        <span className="truncate">{task.listTitle}</span>
                        {task.due && (
                          <>
                            <span>·</span>
                            <span className={cn(
                              isOverdue(task.due) && 'font-medium text-red-500 dark:text-red-400'
                            )}>
                              {formatDueDate(task.due)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="dark:text-dark-text-muted py-8 text-center text-sm text-gray-500">
              Minden feladat kész — szép munka! ✅
            </div>
          )}
        </div>
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
