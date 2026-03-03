import { useState, useMemo } from 'react';
import { useCalendarWeek, useCalendarToday } from '../../hooks/useCalendar';
import { format, addDays, startOfWeek, isToday as isTodayFn } from 'date-fns';
import { hu } from 'date-fns/locale';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  ExternalLink,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { CalendarEvent } from '../../types';

type ViewMode = 'week' | 'day';

export function CalendarView() {
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [selectedDate, setSelectedDate] = useState(new Date());

  const { data: weekData, isLoading: weekLoading, error: weekError } = useCalendarWeek();
  const { data: todayData, isLoading: todayLoading, error: todayError } = useCalendarToday();

  const isLoading = viewMode === 'week' ? weekLoading : todayLoading;
  const error = viewMode === 'week' ? weekError : todayError;
  const events = viewMode === 'week' ? weekData?.events : todayData?.events;

  // Hét napjai (hétfőtől vasárnapig)
  const weekDays = useMemo(() => {
    const monday = startOfWeek(selectedDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }, [selectedDate]);

  // Események nap szerint csoportosítva
  const eventsByDay = useMemo(() => {
    if (!events) return new Map<string, CalendarEvent[]>();

    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const dateStr = event.isAllDay
        ? event.start
        : format(new Date(event.start), 'yyyy-MM-dd');

      const existing = map.get(dateStr) || [];
      existing.push(event);
      map.set(dateStr, existing);
    }
    return map;
  }, [events]);

  const navigateWeek = (direction: number) => {
    setSelectedDate((prev) => addDays(prev, direction * 7));
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#4f6ef7]" />
          <p className="dark:text-dark-text-secondary text-sm text-gray-500">
            Naptár betöltése...
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
            A naptár betöltése sikertelen. Lehet, hogy újra kell jelentkezned.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      {/* Fejléc */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <CalendarIcon className="h-7 w-7 text-purple-500" />
          <h1 className="dark:text-dark-text text-2xl font-bold text-gray-900">Naptár</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Nézet váltó */}
          <div className="dark:bg-dark-bg-tertiary flex rounded-lg bg-gray-100 p-1">
            <button
              onClick={() => setViewMode('week')}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                viewMode === 'week'
                  ? 'bg-white text-[#4f6ef7] shadow-sm dark:bg-dark-bg-secondary dark:text-[#6d8cff]'
                  : 'dark:text-dark-text-secondary text-gray-600 hover:text-gray-900',
              )}
            >
              Heti
            </button>
            <button
              onClick={() => setViewMode('day')}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                viewMode === 'day'
                  ? 'bg-white text-[#4f6ef7] shadow-sm dark:bg-dark-bg-secondary dark:text-[#6d8cff]'
                  : 'dark:text-dark-text-secondary text-gray-600 hover:text-gray-900',
              )}
            >
              Napi
            </button>
          </div>

          {/* Hét navigáció */}
          {viewMode === 'week' && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigateWeek(-1)}
                className="dark:hover:bg-dark-bg-tertiary dark:text-dark-text-secondary rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                aria-label="Előző hét"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => setSelectedDate(new Date())}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-[#4f6ef7] hover:bg-[#4f6ef7]/10"
              >
                Ma
              </button>
              <button
                onClick={() => navigateWeek(1)}
                className="dark:hover:bg-dark-bg-tertiary dark:text-dark-text-secondary rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                aria-label="Következő hét"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Heti nézet */}
      {viewMode === 'week' && (
        <div className="space-y-3">
          {weekDays.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayEvents = eventsByDay.get(dateStr) || [];
            const today = isTodayFn(day);

            return (
              <div
                key={dateStr}
                className={cn(
                  'dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border bg-white p-4 shadow-sm',
                  today
                    ? 'border-purple-300 ring-1 ring-purple-200 dark:border-purple-500/30 dark:ring-purple-500/10'
                    : 'border-gray-200',
                )}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold',
                      today
                        ? 'bg-purple-500 text-white'
                        : 'dark:bg-dark-bg-tertiary dark:text-dark-text bg-gray-100 text-gray-700',
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                  <span className="dark:text-dark-text text-sm font-medium text-gray-700">
                    {format(day, 'EEEE', { locale: hu })}
                  </span>
                  {today && (
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-600 dark:bg-purple-500/20 dark:text-purple-400">
                      Ma
                    </span>
                  )}
                </div>

                {dayEvents.length > 0 ? (
                  <div className="space-y-2 pl-10">
                    {dayEvents.map((event) => (
                      <EventCard key={event.id} event={event} />
                    ))}
                  </div>
                ) : (
                  <p className="dark:text-dark-text-muted pl-10 text-sm text-gray-400">
                    Nincs esemény
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Napi nézet */}
      {viewMode === 'day' && (
        <div className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-purple-500 text-lg font-bold text-white">
              {format(new Date(), 'd')}
            </span>
            <div>
              <h2 className="dark:text-dark-text text-lg font-semibold text-gray-900">
                {format(new Date(), 'yyyy. MMMM d., EEEE', { locale: hu })}
              </h2>
              <p className="dark:text-dark-text-secondary text-sm text-gray-500">
                {todayData?.events?.length || 0} esemény
              </p>
            </div>
          </div>

          {todayData?.events && todayData.events.length > 0 ? (
            <div className="space-y-3">
              {/* Egész napos események először */}
              {todayData.events
                .filter((e) => e.isAllDay)
                .map((event) => (
                  <EventCard key={event.id} event={event} expanded />
                ))}
              {/* Időpontos események */}
              {todayData.events
                .filter((e) => !e.isAllDay)
                .map((event) => (
                  <EventCard key={event.id} event={event} expanded />
                ))}
            </div>
          ) : (
            <div className="dark:text-dark-text-muted py-12 text-center text-sm text-gray-400">
              Nincs ma esemény — szabad a nap! 🎉
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EventCard({ event, expanded = false }: { event: CalendarEvent; expanded?: boolean }) {
  return (
    <div
      className={cn(
        'dark:border-dark-border rounded-lg border p-3 transition-colors',
        event.isAllDay
          ? 'border-gray-200 bg-gray-50/70 dark:bg-dark-bg-tertiary/50'
          : 'border-purple-200 bg-purple-50/30 dark:border-purple-500/20 dark:bg-purple-500/5',
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full',
            event.isAllDay ? 'bg-gray-400 dark:bg-gray-500' : 'bg-purple-500',
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="dark:text-dark-text text-sm font-medium text-gray-900">{event.summary}</p>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <div className="dark:text-dark-text-muted flex items-center gap-1.5 text-xs text-gray-500">
              <Clock className="h-3 w-3" />
              {event.isAllDay
                ? 'Egész napos'
                : `${formatTime(event.start)} – ${formatTime(event.end)}`}
            </div>

            {event.location && (
              <div className="dark:text-dark-text-muted flex items-center gap-1.5 text-xs text-gray-500">
                <MapPin className="h-3 w-3" />
                <span className="truncate">{event.location}</span>
              </div>
            )}
          </div>

          {expanded && event.description && (
            <p className="dark:text-dark-text-secondary mt-2 line-clamp-2 text-xs text-gray-600">
              {event.description}
            </p>
          )}

          {/* Linkek */}
          {expanded && (event.htmlLink || event.hangoutLink) && (
            <div className="mt-2 flex gap-2">
              {event.htmlLink && (
                <a
                  href={event.htmlLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-[#4f6ef7] hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Google Naptár
                </a>
              )}
              {event.hangoutLink && (
                <a
                  href={event.hangoutLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-green-600 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Google Meet
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(isoString: string): string {
  if (!isoString) return '';
  return format(new Date(isoString), 'HH:mm');
}
