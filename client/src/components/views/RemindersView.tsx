import { useState, useEffect } from 'react';
import {
  useReminders,
  useCompleteReminder,
  useDeleteReminder,
} from '../../hooks/useReminders';
import type { Reminder } from '../../types';
import {
  Bell,
  Check,
  Trash2,
  Loader2,
  Mail,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { formatRelativeTime } from '../../lib/utils';

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
  const dueReminders = reminders.filter(
    (r: Reminder) => !r.isCompleted && r.remindAt <= now,
  );
  const upcomingReminders = reminders.filter(
    (r: Reminder) => !r.isCompleted && r.remindAt > now,
  );
  const completedReminders = reminders.filter((r: Reminder) => r.isCompleted);

  const formatReminderTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const isToday = new Date().toDateString() === date.toDateString();
    const isTomorrow =
      new Date(Date.now() + 86400000).toDateString() === date.toDateString();

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
      className={`p-4 rounded-lg border transition-colors cursor-pointer ${
        isDue
          ? 'border-orange-200 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10 hover:bg-orange-100 dark:hover:bg-orange-500/20'
          : isCompleted
            ? 'border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg-tertiary opacity-60'
            : 'border-gray-200 dark:border-dark-border hover:border-blue-300 dark:hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary'
      }`}
      onClick={() => onEmailSelect(reminder.emailId)}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex-shrink-0 p-2 rounded-full ${
            isDue
              ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400'
              : isCompleted
                ? 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400'
                : 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
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

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Mail className="h-3.5 w-3.5 text-gray-400 dark:text-dark-text-muted" />
            <span className="text-sm font-medium text-gray-900 dark:text-dark-text truncate">
              {reminder.email?.subject || '(Nincs tárgy)'}
            </span>
          </div>

          <div className="text-xs text-gray-500 dark:text-dark-text-secondary mb-1">
            {reminder.email?.fromName || reminder.email?.from}
          </div>

          <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-dark-text-muted">
            <Clock className="h-3 w-3" />
            <span>{formatReminderTime(reminder.remindAt)}</span>
            {isDue && (
              <span className="ml-1 text-orange-600 dark:text-orange-400 font-medium">
                ({formatRelativeTime(reminder.remindAt)})
              </span>
            )}
          </div>

          {reminder.note && (
            <div className="mt-2 text-xs text-gray-600 dark:text-dark-text-secondary bg-gray-100 dark:bg-dark-bg px-2 py-1 rounded">
              {reminder.note}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {!isCompleted && (
            <button
              onClick={(e) => handleComplete(reminder.id, e)}
              disabled={completeReminder.isPending}
              className="p-1.5 rounded hover:bg-green-100 dark:hover:bg-green-500/20 text-gray-400 hover:text-green-600 dark:hover:text-green-400"
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
            className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-500"
            title="Törlés"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Törlés megerősítés */}
      {deleteConfirmId === reminder.id && (
        <div
          className="mt-3 p-2 bg-red-50 dark:bg-red-500/10 rounded border border-red-200 dark:border-red-500/30"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-xs text-red-600 dark:text-red-400 mb-2">
            Biztosan törlöd ezt az emlékeztetőt?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handleDelete(reminder.id)}
              disabled={deleteReminder.isPending}
              className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
            >
              Igen, törlöm
            </button>
            <button
              onClick={() => setDeleteConfirmId(null)}
              className="px-2 py-1 text-xs bg-gray-100 dark:bg-dark-bg-tertiary text-gray-700 dark:text-dark-text rounded hover:bg-gray-200 dark:hover:bg-dark-bg"
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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-blue-500" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-dark-text">
            Emlékeztetők
          </h1>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-dark-text-secondary">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
            className="rounded border-gray-300 dark:border-dark-border text-blue-600 focus:ring-blue-500"
          />
          Teljesítettek mutatása
        </label>
      </div>

      {reminders.length === 0 ? (
        <div className="text-center py-12">
          <Bell className="h-12 w-12 mx-auto text-gray-300 dark:text-dark-text-muted mb-4" />
          <p className="text-gray-500 dark:text-dark-text-secondary">
            Nincsenek emlékeztetők
          </p>
          <p className="text-sm text-gray-400 dark:text-dark-text-muted mt-1">
            Állíts be emlékeztetőket az emaileknél a harang ikonnal
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Esedékes emlékeztetők */}
          {dueReminders.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-orange-600 dark:text-orange-400 mb-3 flex items-center gap-2">
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
              <h2 className="text-sm font-medium text-gray-600 dark:text-dark-text-secondary mb-3 flex items-center gap-2">
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
              <h2 className="text-sm font-medium text-green-600 dark:text-green-400 mb-3 flex items-center gap-2">
                <Check className="h-4 w-4" />
                Teljesített ({completedReminders.length})
              </h2>
              <div className="space-y-2">
                {completedReminders.map((reminder: Reminder) => (
                  <ReminderCard
                    key={reminder.id}
                    reminder={reminder}
                    isCompleted
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
