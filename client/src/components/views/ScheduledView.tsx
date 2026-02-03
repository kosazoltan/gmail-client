import { useState } from 'react';
import { CalendarClock, Send, Trash2, Clock, Mail, Loader2 } from 'lucide-react';
import {
  useScheduledEmails,
  useDeleteScheduledEmail,
  useSendScheduledNow,
  formatScheduledTime,
} from '../../hooks/useScheduledEmails';
import { toast } from '../../lib/toast';
import type { ScheduledEmail } from '../../types';

export function ScheduledView() {
  const { data: scheduledEmails, isLoading } = useScheduledEmails();
  const deleteScheduled = useDeleteScheduledEmail();
  const sendNow = useSendScheduledNow();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    deleteScheduled.mutate(id, {
      onSuccess: () => {
        toast.success('Ütemezett email törölve');
        setConfirmDeleteId(null);
      },
      onError: () => {
        toast.error('Nem sikerült törölni');
      },
    });
  };

  const handleSendNow = (id: string) => {
    sendNow.mutate(id, {
      onSuccess: () => {
        toast.success('Email elküldve!');
      },
      onError: () => {
        toast.error('Nem sikerült elküldeni');
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-dark-bg">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-gray-50 dark:bg-dark-bg">
      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-purple-100 dark:bg-purple-500/20 rounded-lg">
            <CalendarClock className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-800 dark:text-dark-text">
              Ütemezett emailek
            </h1>
            <p className="text-sm text-gray-500 dark:text-dark-text-muted">
              {scheduledEmails?.length || 0} várakozó email
            </p>
          </div>
        </div>

        {/* List */}
        {!scheduledEmails || scheduledEmails.length === 0 ? (
          <div className="bg-white dark:bg-dark-bg-secondary rounded-xl border border-gray-200 dark:border-dark-border p-8 text-center">
            <Mail className="h-12 w-12 text-gray-300 dark:text-dark-text-muted mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600 dark:text-dark-text-secondary mb-2">
              Nincsenek ütemezett emailek
            </h3>
            <p className="text-sm text-gray-400 dark:text-dark-text-muted">
              Az új levél írásánál használd az "Ütemezés" gombot az email későbbi küldéséhez.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {scheduledEmails.map((email) => (
              <ScheduledEmailCard
                key={email.id}
                email={email}
                onSendNow={() => handleSendNow(email.id)}
                onDelete={() => setConfirmDeleteId(email.id)}
                isSending={sendNow.isPending}
                isDeleting={deleteScheduled.isPending && confirmDeleteId === email.id}
              />
            ))}
          </div>
        )}

        {/* Delete confirmation modal */}
        {confirmDeleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-dark-bg-secondary rounded-xl p-6 max-w-sm mx-4 shadow-xl">
              <h3 className="text-lg font-medium text-gray-800 dark:text-dark-text mb-2">
                Ütemezett email törlése
              </h3>
              <p className="text-sm text-gray-500 dark:text-dark-text-secondary mb-4">
                Biztosan törölni szeretnéd ezt az ütemezett emailt? Ez a művelet nem vonható vissza.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="flex-1 px-4 py-2 text-sm text-gray-600 dark:text-dark-text-secondary bg-gray-100 dark:bg-dark-bg-tertiary rounded-lg hover:bg-gray-200 dark:hover:bg-dark-bg transition-colors"
                >
                  Mégsem
                </button>
                <button
                  onClick={() => handleDelete(confirmDeleteId)}
                  disabled={deleteScheduled.isPending}
                  className="flex-1 px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {deleteScheduled.isPending ? 'Törlés...' : 'Törlés'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface ScheduledEmailCardProps {
  email: ScheduledEmail;
  onSendNow: () => void;
  onDelete: () => void;
  isSending: boolean;
  isDeleting: boolean;
}

function ScheduledEmailCard({
  email,
  onSendNow,
  onDelete,
  isSending,
  isDeleting,
}: ScheduledEmailCardProps) {
  const isPastDue = email.scheduledAt < Date.now();

  return (
    <div className="bg-white dark:bg-dark-bg-secondary rounded-xl border border-gray-200 dark:border-dark-border p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Recipients */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-gray-800 dark:text-dark-text truncate">
              Címzett: {email.to}
            </span>
            {email.cc && (
              <span className="text-xs text-gray-400 dark:text-dark-text-muted">
                (CC: {email.cc})
              </span>
            )}
          </div>

          {/* Subject */}
          <p className="text-sm text-gray-600 dark:text-dark-text-secondary truncate mb-2">
            {email.subject || '(Nincs tárgy)'}
          </p>

          {/* Body preview */}
          <p className="text-xs text-gray-400 dark:text-dark-text-muted line-clamp-2">
            {email.body || '(Üres üzenet)'}
          </p>
        </div>

        {/* Scheduled time */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
              isPastDue
                ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400'
                : 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400'
            }`}
          >
            <Clock className="h-3 w-3" />
            {formatScheduledTime(email.scheduledAt)}
          </div>

          {/* Actions */}
          <div className="flex gap-1">
            <button
              onClick={onSendNow}
              disabled={isSending || isDeleting}
              className="p-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 disabled:opacity-50"
              title="Küldés most"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={onDelete}
              disabled={isSending || isDeleting}
              className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-500/10 text-red-600 dark:text-red-400 disabled:opacity-50"
              title="Törlés"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
