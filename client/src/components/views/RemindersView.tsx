import { useState, useEffect } from 'react';
import { useReminders, useCompleteReminder, useDeleteReminder } from '../../hooks/useReminders';
import type { Reminder } from '../../types';
import { Bell, Check, Trash2, Loader2, Mail, Clock, AlertCircle } from 'lucide-react';
import { formatRelativeTime } from '../../lib/utils';
import { EmptyState } from '../common/EmptyState';

interface RemindersViewProps {
  onEmailSelect: (emailId: string) => void;
}

export function RemindersView({ onEmailSelect }: RemindersViewProps) {
  const [showCompleted, setShowCompleted] = useState(false);
  const { data, isLoading } = useReminders(showCompleted);
  const completeReminder = useCompleteReminder();
  const deleteReminder = useDeleteReminder();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const reminders = data?.reminders || [];

  // Időbélyeg state - effect-ben frissítjük (nem render közben)
  const [now, setNow] = useState(() => Date.now());

  // Percenként frissítjük az időt
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Szétválogatás: esedékes, jövőbeli, teljesített
  const dueReminders = reminders.filter((r: Reminder) => !r.isCompleted && r.remindAt <= now);
  const upcomingReminders = reminders.filter((r: Reminder) => !r.isCompleted && r.remindAt > now);
  const completedReminders = reminders.filter((r: Reminder) => r.isCompleted);

  const formatReminderTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const isToday = new Date().toDateString() === date.toDateString();
    const isTomorrow = new Date(Date.now() + 86400000).toDateString() === date.toDateString();

    const timeStr = date.toLocaleTimeString('hu-HU', {
      hour: '2-digit',
      minute: '2-digit',
    });

    if (isToday) {
      return `Ma ${timeStr}`;
    } else if (isTomorrow) {
      return `Holnap ${timeStr}`;
    } else {
      return date.toLocaleDateString('hu-HU', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  };

  const handleComplete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    completeReminder.mutate(id);
  };

  const handleDelete = (id: string) => {
    deleteReminder.mutate(id, {
      onSuccess: () => setDeleteConfirmId(null),
    });
  };

  interface ReminderCardProps {
    reminder: Reminder;
    isDue?: boolean;
    isCompleted?: boolean;
  }

  const ReminderCard = ({ reminder, isDue, isCompleted }: ReminderCardProps) => (
    <div
      className={`cursor-pointer rounded-lg border p-4 transition-colors ${
        isDue
          ? 'border-orange-200 bg-orange-50 hover:bg-orange-100 dark:border-orange-500/30 dark:bg-orange-500/10 dark:hover:bg-orange-500/20'
          : isCompleted
            ? 'dark:border-dark-border dark:bg-dark-bg-tertiary border-gray-200 bg-gray-50 opacity-60'
            : 'dark:border-dark-border dark:hover:bg-dark-bg-tertiary border-gray-200 hover:border-blue-300 hover:bg-gray-50 dark:hover:border-blue-500'
      }`}
      onClick={() => onEmailSelect(reminder.emailId)}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex-shrink-0 rounded-full p-2 ${
            isDue
              ? 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400'
              : isCompleted
                ? 'bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400'
                : 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'
          }`}
        >
          {isCompleted ? (
            <Check className="h-4 w-4" />
          ) : isDue ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <Mail className="dark:text-dark-text-muted h-3.5 w-3.5 text-gray-400" />
            <span className="dark:text-dark-text truncate text-sm font-medium text-gray-900">
              {reminder.email?.subject || '(Nincs tárgy)'}
            </span>
          </div>

          <div className="dark:text-dark-text-secondary mb-1 text-xs text-gray-500">
            {reminder.email?.fromName || reminder.email?.from}
          </div>

          <div className="dark:text-dark-text-muted flex items-center gap-1 text-xs text-gray-400">
            <Clock className="h-3 w-3" />
            <span>{formatReminderTime(reminder.remindAt)}</span>
            {isDue && (
              <span className="ml-1 font-medium text-orange-600 dark:text-orange-400">
                ({formatRelativeTime(reminder.remindAt)})
              </span>
            )}
          </div>

          {reminder.note && (
            <div className="dark:text-dark-text-secondary dark:bg-dark-bg mt-2 rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">
              {reminder.note}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {!isCompleted && (
            <button
              onClick={(e) => handleComplete(reminder.id, e)}
              disabled={completeReminder.isPending}
              className="rounded p-1.5 text-gray-400 hover:bg-green-100 hover:text-green-600 dark:hover:bg-green-500/20 dark:hover:text-green-400"
              title="Teljesítettnek jelölés"
            >
              <Check className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteConfirmId(reminder.id);
            }}
            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
            title="Törlés"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Törlés megerősítés */}
      {deleteConfirmId === reminder.id && (
        <div
          className="mt-3 rounded border border-red-200 bg-red-50 p-2 dark:border-red-500/30 dark:bg-red-500/10"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="mb-2 text-xs text-red-600 dark:text-red-400">
            Biztosan törlöd ezt az emlékeztetőt?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handleDelete(reminder.id)}
              disabled={deleteReminder.isPending}
              className="rounded bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600 disabled:opacity-50"
            >
              Igen, törlöm
            </button>
            <button
              onClick={() => setDeleteConfirmId(null)}
              className="dark:bg-dark-bg-tertiary dark:text-dark-text dark:hover:bg-dark-bg rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200"
            >
              Mégse
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-blue-500" />
          <h1 className="dark:text-dark-text text-xl font-semibold text-gray-900">Emlékeztetők</h1>
        </div>

        <label className="dark:text-dark-text-secondary flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
            className="dark:border-dark-border rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Teljesítettek mutatása
        </label>
      </div>

      {reminders.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Nincsenek emlékeztetők"
          description="Állíts be emlékeztetőt, hogy ne felejts el válaszolni fontos levelekre."
        />
      ) : (
        <div className="space-y-6">
          {/* Esedékes emlékeztetők */}
          {dueReminders.length > 0 && (
            <div>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-orange-600 dark:text-orange-400">
                <AlertCircle className="h-4 w-4" />
                Esedékes ({dueReminders.length})
              </h2>
              <div className="space-y-2">
                {dueReminders.map((reminder: Reminder) => (
                  <ReminderCard key={reminder.id} reminder={reminder} isDue />
                ))}
              </div>
            </div>
          )}

          {/* Közelgő emlékeztetők */}
          {upcomingReminders.length > 0 && (
            <div>
              <h2 className="dark:text-dark-text-secondary mb-3 flex items-center gap-2 text-sm font-medium text-gray-600">
                <Clock className="h-4 w-4" />
                Közelgő ({upcomingReminders.length})
              </h2>
              <div className="space-y-2">
                {upcomingReminders.map((reminder: Reminder) => (
                  <ReminderCard key={reminder.id} reminder={reminder} />
                ))}
              </div>
            </div>
          )}

          {/* Teljesített emlékeztetők */}
          {showCompleted && completedReminders.length > 0 && (
            <div>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
                <Check className="h-4 w-4" />
                Teljesített ({completedReminders.length})
              </h2>
              <div className="space-y-2">
                {completedReminders.map((reminder: Reminder) => (
                  <ReminderCard key={reminder.id} reminder={reminder} isCompleted />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
