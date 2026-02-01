import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../hooks/useAccounts';
import { useDeleteEmail } from '../../hooks/useEmails';
import { api } from '../../lib/api';
import { EmailList } from '../email/EmailList';
import { EmailDetail } from '../email/EmailDetail';
import {
  displaySender,
  getInitials,
  emailToColor,
  formatRelativeTime,
} from '../../lib/utils';
import { Users, ArrowLeft, Loader2 } from 'lucide-react';
import type { Email, SenderGroup } from '../../types';

export function BySenderView() {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const [selectedSender, setSelectedSender] = useState<SenderGroup | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const deleteEmail = useDeleteEmail();

  const accountId = session?.activeAccountId || undefined;

  const { data: sendersData, isLoading: loadingSenders } = useQuery({
    queryKey: ['views', 'by-sender', accountId],
    queryFn: () => api.views.bySender({ accountId }),
    enabled: !!accountId,
  });

  const { data: senderEmails, isLoading: loadingEmails } = useQuery({
    queryKey: ['views', 'by-sender-emails', selectedSender?.email],
    queryFn: () => api.views.bySenderEmails(selectedSender!.email),
    enabled: !!selectedSender,
  });

  // Küldő lista nézet
  if (!selectedSender) {
    return (
      <div className="flex h-full">
        <div className="w-full overflow-auto">
          <div className="px-4 py-3 bg-gray-50 dark:bg-dark-bg-tertiary border-b border-gray-200 dark:border-dark-border flex items-center gap-2">
            <Users className="h-5 w-5 text-gray-500 dark:text-dark-text-secondary" />
            <h2 className="text-sm font-medium text-gray-600 dark:text-dark-text">Küldő szerint</h2>
          </div>

          {loadingSenders ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-dark-border">
              {(sendersData?.senders || []).map((sender) => {
                const name = displaySender(sender.name, sender.email);
                const initials = getInitials(name);
                const color = emailToColor(sender.email);

                return (
                  <div
                    key={sender.id}
                    onClick={() => setSelectedSender(sender)}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary transition-colors"
                  >
                    <div
                      className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium"
                      style={{ backgroundColor: color }}
                    >
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-dark-text text-sm">{name}</div>
                      <div className="text-xs text-gray-400 dark:text-dark-text-muted">{sender.email}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-medium text-blue-600">
                        {sender.messageCount} levél
                      </div>
                      {sender.lastMessageAt && (
                        <div className="text-xs text-gray-400 dark:text-dark-text-muted">
                          {formatRelativeTime(sender.lastMessageAt)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Küldő leveleinek nézete
  const emails = senderEmails?.emails || [];

  return (
    <div className="flex h-full relative">
      {/* Email lista - rejtett ha van kiválasztott email kis képernyőn */}
      <div className={`
        w-full lg:w-2/5 xl:w-1/3 border-r border-gray-200 dark:border-dark-border overflow-auto
        ${selectedEmail ? 'hidden lg:block' : 'block'}
      `}>
        <div className="px-4 py-3 bg-gray-50 dark:bg-dark-bg-tertiary border-b border-gray-200 dark:border-dark-border flex items-center gap-2">
          <button
            onClick={() => {
              setSelectedSender(null);
              setSelectedEmail(null);
            }}
            className="p-2.5 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-bg touch-manipulation"
            aria-label="Vissza"
          >
            <ArrowLeft className="h-5 w-5 text-gray-500 dark:text-dark-text-secondary" />
          </button>
          <span className="text-sm font-medium text-gray-600 dark:text-dark-text">
            {displaySender(selectedSender.name, selectedSender.email)}
          </span>
        </div>

        <EmailList
          emails={emails}
          isLoading={loadingEmails}
          selectedEmailId={selectedEmail?.id || null}
          onSelectEmail={setSelectedEmail}
          onDeleteEmail={(emailId) => {
            const emailIndex = emails.findIndex(e => e.id === emailId);
            deleteEmail.mutate(emailId, {
              onSuccess: () => {
                if (selectedEmail?.id === emailId) {
                  if (emails.length > 1) {
                    if (emailIndex < emails.length - 1) {
                      setSelectedEmail(emails[emailIndex + 1]);
                    } else {
                      setSelectedEmail(emails[emailIndex - 1]);
                    }
                  } else {
                    setSelectedEmail(null);
                  }
                }
              }
            });
          }}
          emptyMessage="Nincsenek levelek ettől a küldőtől"
        />
      </div>

      {/* Email részletek - full screen kis képernyőn, jobb oldal nagy képernyőn */}
      <div className={`
        flex-1
        ${selectedEmail ? 'block absolute inset-0 lg:relative lg:inset-auto bg-white dark:bg-dark-bg z-10' : 'hidden lg:block'}
      `}>
        <EmailDetail
          emailId={selectedEmail?.id || null}
          accountId={accountId}
          onBack={() => setSelectedEmail(null)}
          onReply={({ to, subject, threadId, body, fromName, date }) => {
            const originalBody = body || '';
            const replyBody = `\n\n─────────────────────────\nDátum: ${date ? new Date(date).toLocaleString('hu-HU') : ''}\nFeladó: ${fromName || to}\n\n${originalBody}`;
            navigate(
              `/compose?reply=true&to=${encodeURIComponent(to)}&subject=${encodeURIComponent(subject)}${threadId ? `&threadId=${threadId}` : ''}&body=${encodeURIComponent(replyBody)}`,
            );
          }}
          onForward={({ subject, body }) => {
            navigate(
              `/compose?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
            );
          }}
        />
      </div>
    </div>
  );
}
