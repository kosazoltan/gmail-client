import { useEffect, useState } from 'react';
import { useEmailDetail, useMarkRead, useDeleteEmail } from '../../hooks/useEmails';
import { AttachmentView } from './AttachmentView';
import {
  formatFullDate,
  displaySender,
  getInitials,
  emailToColor,
} from '../../lib/utils';
import {
  ArrowLeft,
  Reply,
  Forward,
  Trash2,
  Loader2,
  Paperclip,
} from 'lucide-react';

interface EmailDetailProps {
  emailId: string | null;
  accountId?: string;
  onBack: () => void;
  onReply: (email: { to: string; subject: string; threadId?: string }) => void;
  onForward?: (email: { subject: string; body: string }) => void;
}

export function EmailDetail({
  emailId,
  accountId,
  onBack,
  onReply,
  onForward,
}: EmailDetailProps) {
  const { data: email, isLoading } = useEmailDetail(emailId, accountId);
  const markRead = useMarkRead();
  const deleteEmail = useDeleteEmail();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Automatikus olvasottnak jelölés
  useEffect(() => {
    if (email && !email.isRead) {
      markRead.mutate({ emailId: email.id, isRead: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email?.id, email?.isRead]);

  if (!emailId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-dark-text-muted">
        <p>Válassz ki egy levelet a megtekintéshez</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!email) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-dark-text-muted">
        <p>Email nem található</p>
      </div>
    );
  }

  const sender = displaySender(email.fromName, email.from);
  const initials = getInitials(sender);
  const avatarColor = emailToColor(email.from || '');

  return (
    <div className="flex flex-col h-full bg-white dark:bg-dark-bg-secondary">
      {/* Fejléc */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-dark-border">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary text-gray-500 dark:text-dark-text-secondary lg:hidden"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="flex-1" />

        <button
          onClick={() =>
            onReply({
              to: email.from || '',
              subject: `Re: ${email.subject || ''}`,
              threadId: email.threadId || undefined,
            })
          }
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary text-gray-600 dark:text-dark-text-secondary"
        >
          <Reply className="h-4 w-4" />
          Válasz
        </button>

        <button
          onClick={() =>
            onForward?.({
              subject: `Fwd: ${email.subject || ''}`,
              body: `\n\n---------- Továbbított üzenet ----------\nKüldő: ${email.fromName || ''} <${email.from}>\nDátum: ${formatFullDate(email.date)}\nTárgy: ${email.subject}\nCímzett: ${email.to}\n\n${email.body || ''}`,
            })
          }
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary text-gray-600 dark:text-dark-text-secondary"
        >
          <Forward className="h-4 w-4" />
          Továbbítás
        </button>

        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-red-600 dark:text-red-400"
        >
          <Trash2 className="h-4 w-4" />
          Törlés
        </button>
      </div>

      {/* Törlés megerősítő modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-dark-bg-secondary rounded-lg p-6 max-w-sm mx-4 shadow-xl dark:border dark:border-dark-border">
            <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text mb-2">
              Email törlése
            </h3>
            <p className="text-sm text-gray-500 dark:text-dark-text-secondary mb-4">
              Biztosan törölni szeretnéd ezt az emailt? Az email a kukába kerül.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary dark:text-dark-text"
              >
                Mégse
              </button>
              <button
                onClick={() => {
                  deleteEmail.mutate(email.id, {
                    onSuccess: () => {
                      setShowDeleteConfirm(false);
                      onBack();
                    },
                  });
                }}
                disabled={deleteEmail.isPending}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteEmail.isPending ? 'Törlés...' : 'Törlés'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Levél tartalom */}
      <div className="flex-1 overflow-auto p-6">
        {/* Tárgy */}
        <h1 className="text-xl font-semibold text-gray-900 dark:text-dark-text mb-4">
          {email.subject || '(Nincs tárgy)'}
        </h1>

        {/* Küldő infó */}
        <div className="flex items-start gap-3 mb-6">
          <div
            className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium"
            style={{ backgroundColor: avatarColor }}
          >
            {initials}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 dark:text-dark-text">{sender}</span>
              <span className="text-sm text-gray-400 dark:text-dark-text-muted">
                &lt;{email.from}&gt;
              </span>
            </div>
            <div className="text-sm text-gray-500 dark:text-dark-text-secondary mt-0.5">
              Címzett: {email.to}
              {email.cc && <span className="ml-2">Másolat: {email.cc}</span>}
            </div>
            <div className="text-xs text-gray-400 dark:text-dark-text-muted mt-1">
              {formatFullDate(email.date)}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="border-t border-gray-100 dark:border-dark-border pt-4">
          {email.bodyHtml ? (
            <div
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: email.bodyHtml }}
            />
          ) : email.body ? (
            <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-dark-text font-sans">
              {email.body}
            </pre>
          ) : (
            <p className="text-gray-400 dark:text-dark-text-muted italic">Nincs megjeleníthető tartalom</p>
          )}
        </div>

        {/* Mellékletek */}
        {email.attachments && email.attachments.length > 0 && (
          <div className="mt-6 border-t border-gray-100 dark:border-dark-border pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Paperclip className="h-4 w-4 text-gray-400 dark:text-dark-text-muted" />
              <span className="text-sm font-medium text-gray-600 dark:text-dark-text-secondary">
                {email.attachments.length} melléklet
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {email.attachments.map((att) => (
                <AttachmentView key={att.id} attachment={att} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
