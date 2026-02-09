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
      <div className="dark:bg-dark-bg flex flex-1 items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="dark:bg-dark-bg flex-1 overflow-auto bg-gray-50">
      <div className="mx-auto max-w-3xl p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-lg bg-purple-100 p-2 dark:bg-purple-500/20">
            <CalendarClock className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="dark:text-dark-text text-xl font-semibold text-gray-800">
              Ütemezett emailek
            </h1>
            <p className="dark:text-dark-text-muted text-sm text-gray-500">
              {scheduledEmails?.length || 0} várakozó email
            </p>
          </div>
        </div>

        {/* List */}
        {!scheduledEmails || scheduledEmails.length === 0 ? (
          <div className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-8 text-center">
            <Mail className="dark:text-dark-text-muted mx-auto mb-4 h-12 w-12 text-gray-300" />
            <h3 className="dark:text-dark-text-secondary mb-2 text-lg font-medium text-gray-600">
              Nincsenek ütemezett emailek
            </h3>
            <p className="dark:text-dark-text-muted text-sm text-gray-400">
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
            <div className="dark:bg-dark-bg-secondary mx-4 max-w-sm rounded-xl bg-white p-6 shadow-xl">
              <h3 className="dark:text-dark-text mb-2 text-lg font-medium text-gray-800">
                Ütemezett email törlése
              </h3>
              <p className="dark:text-dark-text-secondary mb-4 text-sm text-gray-500">
                Biztosan törölni szeretnéd ezt az ütemezett emailt? Ez a művelet nem vonható vissza.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="dark:text-dark-text-secondary dark:bg-dark-bg-tertiary dark:hover:bg-dark-bg flex-1 rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-200"
                >
                  Mégsem
                </button>
                <button
                  onClick={() => handleDelete(confirmDeleteId)}
                  disabled={deleteScheduled.isPending}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm text-white transition-colors hover:bg-red-700 disabled:opacity-50"
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
    <div className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {/* Recipients */}
          <div className="mb-1 flex items-center gap-2">
            <span className="dark:text-dark-text truncate text-sm font-medium text-gray-800">
              Címzett: {email.to}
            </span>
            {email.cc && (
              <span className="dark:text-dark-text-muted text-xs text-gray-400">
                (CC: {email.cc})
              </span>
            )}
          </div>

          {/* Subject */}
          <p className="dark:text-dark-text-secondary mb-2 truncate text-sm text-gray-600">
            {email.subject || '(Nincs tárgy)'}
          </p>

          {/* Body preview */}
          <p className="dark:text-dark-text-muted line-clamp-2 text-xs text-gray-400">
            {email.body || '(Üres üzenet)'}
          </p>
        </div>

        {/* Scheduled time */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          <div
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
              isPastDue
                ? 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400'
                : 'bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400'
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
              className="rounded p-1.5 text-blue-600 hover:bg-blue-50 disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
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
              className="rounded p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10"
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
