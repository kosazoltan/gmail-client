import { useState, useMemo, useCallback } from 'react';
import {
  useCalendarEvents,
  useCalendarToday,
  useCreateCalendarEvent,
  useUpdateCalendarEvent,
  useDeleteCalendarEvent,
} from '../../hooks/useCalendar';
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
  Plus,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { CalendarEvent } from '../../types';

type ViewMode = 'week' | 'day';

interface EventFormData {
  summary: string;
  description: string;
  location: string;
  start: string;
  end: string;
  isAllDay: boolean;
}

const emptyForm: EventFormData = {
  summary: '',
  description: '',
  location: '',
  start: '',
  end: '',
  isAllDay: false,
};

export function CalendarView() {
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [formData, setFormData] = useState<EventFormData>(emptyForm);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const createMutation = useCreateCalendarEvent();
  const updateMutation = useUpdateCalendarEvent();
  const deleteMutation = useDeleteCalendarEvent();

  // Hét navigáció: a selectedDate alapján számolt timeMin/timeMax
  const monday = useMemo(() => startOfWeek(selectedDate, { weekStartsOn: 1 }), [selectedDate]);
  const sunday = useMemo(() => addDays(monday, 7), [monday]);

  const { data: weekData, isLoading: weekLoading, error: weekError } = useCalendarEvents({
    timeMin: monday.toISOString(),
    timeMax: sunday.toISOString(),
  });
  const { data: todayData, isLoading: todayLoading, error: todayError } = useCalendarToday();

  const isLoading = viewMode === 'week' ? weekLoading : todayLoading;
  const error = viewMode === 'week' ? weekError : todayError;
  const events = viewMode === 'week' ? weekData?.events : todayData?.events;

  // Hét napjai (hétfőtől vasárnapig)
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }, [monday]);

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

  const openCreateModal = useCallback(() => {
    setEditingEvent(null);
    setFormData(emptyForm);
    setModalOpen(true);
  }, []);

  const openEditModal = useCallback((event: CalendarEvent) => {
    setEditingEvent(event);
    // Convert event data to form format
    let startVal = '';
    let endVal = '';

    if (event.isAllDay) {
      startVal = event.start; // YYYY-MM-DD
      endVal = event.end || '';
    } else {
      // ISO → datetime-local format (YYYY-MM-DDTHH:mm)
      startVal = event.start ? event.start.slice(0, 16) : '';
      endVal = event.end ? event.end.slice(0, 16) : '';
    }

    setFormData({
      summary: event.summary === '(Nincs cím)' ? '' : event.summary,
      description: event.description || '',
      location: event.location || '',
      start: startVal,
      end: endVal,
      isAllDay: event.isAllDay,
    });
    setModalOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!formData.summary.trim()) return;
    if (!formData.start) return;

    const payload = {
      summary: formData.summary.trim(),
      description: formData.description || undefined,
      location: formData.location || undefined,
      start: formData.start,
      end: formData.end || undefined,
      isAllDay: formData.isAllDay,
    };

    try {
      if (editingEvent) {
        await updateMutation.mutateAsync({ id: editingEvent.id, ...payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      setModalOpen(false);
      setEditingEvent(null);
      setFormData(emptyForm);
    } catch {
      // Error is handled by mutation state
    }
  }, [formData, editingEvent, createMutation, updateMutation]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      setDeleteConfirmId(null);
    } catch {
      // Error is handled by mutation state
    }
  }, [deleteMutation]);

  const isSaving = createMutation.isPending || updateMutation.isPending;

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
          {/* Új esemény gomb */}
          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 rounded-lg bg-purple-500 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-purple-600"
          >
            <Plus className="h-4 w-4" />
            Új esemény
          </button>

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
                      <EventCard
                        key={event.id}
                        event={event}
                        onEdit={openEditModal}
                        onDelete={setDeleteConfirmId}
                      />
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
                  <EventCard
                    key={event.id}
                    event={event}
                    expanded
                    onEdit={openEditModal}
                    onDelete={setDeleteConfirmId}
                  />
                ))}
              {/* Időpontos események */}
              {todayData.events
                .filter((e) => !e.isAllDay)
                .map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    expanded
                    onEdit={openEditModal}
                    onDelete={setDeleteConfirmId}
                  />
                ))}
            </div>
          ) : (
            <div className="dark:text-dark-text-muted py-12 text-center text-sm text-gray-500">
              Nincs ma esemény — szabad a nap! 🎉
            </div>
          )}
        </div>
      )}

      {/* Esemény létrehozás/szerkesztés modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="dark:bg-dark-bg-secondary dark:border-dark-border w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="dark:text-dark-text text-lg font-semibold text-gray-900">
                {editingEvent ? 'Esemény szerkesztése' : 'Új esemény'}
              </h2>
              <button
                onClick={() => {
                  setModalOpen(false);
                  setEditingEvent(null);
                  setFormData(emptyForm);
                }}
                className="dark:text-dark-text-secondary dark:hover:bg-dark-bg-tertiary rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Cím */}
              <div>
                <label className="dark:text-dark-text-secondary mb-1 block text-sm font-medium text-gray-700">
                  Cím <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.summary}
                  onChange={(e) => setFormData((f) => ({ ...f, summary: e.target.value }))}
                  placeholder="Esemény neve..."
                  className="dark:bg-dark-bg-tertiary dark:border-dark-border dark:text-dark-text w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  autoFocus
                />
              </div>

              {/* Leírás */}
              <div>
                <label className="dark:text-dark-text-secondary mb-1 block text-sm font-medium text-gray-700">
                  Leírás
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Részletek..."
                  rows={3}
                  className="dark:bg-dark-bg-tertiary dark:border-dark-border dark:text-dark-text w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              {/* Helyszín */}
              <div>
                <label className="dark:text-dark-text-secondary mb-1 block text-sm font-medium text-gray-700">
                  Helyszín
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData((f) => ({ ...f, location: e.target.value }))}
                  placeholder="Helyszín..."
                  className="dark:bg-dark-bg-tertiary dark:border-dark-border dark:text-dark-text w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              {/* Egész napos */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isAllDay"
                  checked={formData.isAllDay}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, isAllDay: e.target.checked, start: '', end: '' }))
                  }
                  className="h-4 w-4 rounded border-gray-300 text-purple-500 focus:ring-purple-500"
                />
                <label
                  htmlFor="isAllDay"
                  className="dark:text-dark-text-secondary text-sm font-medium text-gray-700"
                >
                  Egész napos
                </label>
              </div>

              {/* Kezdés / Vége */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="dark:text-dark-text-secondary mb-1 block text-sm font-medium text-gray-700">
                    Kezdés <span className="text-red-500">*</span>
                  </label>
                  <input
                    type={formData.isAllDay ? 'date' : 'datetime-local'}
                    value={formData.start}
                    onChange={(e) => setFormData((f) => ({ ...f, start: e.target.value }))}
                    className="dark:bg-dark-bg-tertiary dark:border-dark-border dark:text-dark-text w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="dark:text-dark-text-secondary mb-1 block text-sm font-medium text-gray-700">
                    Vége
                  </label>
                  <input
                    type={formData.isAllDay ? 'date' : 'datetime-local'}
                    value={formData.end}
                    onChange={(e) => setFormData((f) => ({ ...f, end: e.target.value }))}
                    className="dark:bg-dark-bg-tertiary dark:border-dark-border dark:text-dark-text w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Hibaüzenet */}
              {(createMutation.error || updateMutation.error) && (
                <p className="text-sm text-red-500">
                  {(createMutation.error || updateMutation.error)?.message || 'Hiba történt'}
                </p>
              )}

              {/* Gombok */}
              <div className="flex justify-between pt-2">
                {editingEvent ? (
                  <button
                    onClick={() => {
                      setModalOpen(false);
                      setEditingEvent(null);
                      setFormData(emptyForm);
                      setDeleteConfirmId(editingEvent.id);
                    }}
                    className="flex items-center gap-1.5 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                    Törlés
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setModalOpen(false);
                      setEditingEvent(null);
                      setFormData(emptyForm);
                    }}
                    className="dark:text-dark-text-secondary dark:hover:bg-dark-bg-tertiary rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                  >
                    Mégse
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving || !formData.summary.trim() || !formData.start}
                    className="flex items-center gap-1.5 rounded-lg bg-purple-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-purple-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {editingEvent ? 'Mentés' : 'Létrehozás'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Törlés megerősítő modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="dark:bg-dark-bg-secondary dark:border-dark-border w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
            <h3 className="dark:text-dark-text mb-2 text-lg font-semibold text-gray-900">
              Esemény törlése
            </h3>
            <p className="dark:text-dark-text-secondary mb-4 text-sm text-gray-600">
              Biztosan törlöd ezt az eseményt? Ez a művelet nem vonható vissza.
            </p>

            {deleteMutation.error && (
              <p className="mb-3 text-sm text-red-500">
                {deleteMutation.error.message || 'Hiba történt a törlés során'}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="dark:text-dark-text-secondary dark:hover:bg-dark-bg-tertiary rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Mégse
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Törlés
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EventCard({
  event,
  expanded = false,
  onEdit,
  onDelete,
}: {
  event: CalendarEvent;
  expanded?: boolean;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        'group dark:border-dark-border rounded-lg border p-3 transition-colors',
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
          <div className="flex items-start justify-between gap-2">
            <p className="dark:text-dark-text text-sm font-medium text-gray-900">
              {event.summary}
            </p>

            {/* Akció gombok */}
            <div className="flex flex-shrink-0 items-center gap-1">
              <button
                onClick={() => onEdit(event)}
                className="dark:hover:bg-dark-bg-tertiary rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-purple-500"
                title="Szerkesztés"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onDelete(event.id)}
                className="dark:hover:bg-dark-bg-tertiary rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500"
                title="Törlés"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              {event.htmlLink && (
                <a
                  href={event.htmlLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="dark:hover:bg-dark-bg-tertiary rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-[#4f6ef7]"
                  title="Megnyitás Google Naptárban"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>

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

          {/* Linkek - expanded nézetben */}
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
