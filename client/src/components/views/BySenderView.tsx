import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../hooks/useAccounts';
import { useDeleteEmail } from '../../hooks/useEmails';
import { api } from '../../lib/api';
import { EmailList } from '../email/EmailList';
import { EmailDetail } from '../email/EmailDetail';
import { ResizablePanels } from '../common/ResizablePanels';
import { displaySender, getInitials, emailToColor, formatRelativeTime } from '../../lib/utils';
import { Users, ArrowLeft, Loader2 } from 'lucide-react';
import type { Email, SenderGroup } from '../../types';
import { getNextEmailAfterDelete } from '../../lib/emailNavigation';

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

  const emails = senderEmails?.emails || [];

  // Ref a friss emails lista eléréséhez (stale closure fix)
  const emailsRef = useRef(emails);
  useEffect(() => {
    emailsRef.current = emails;
  }, [emails]);

  // Küldő lista nézet
  if (!selectedSender) {
    return (
      <div className="flex h-full">
        <div className="w-full overflow-auto">
          <div className="dark:bg-dark-bg-tertiary dark:border-dark-border flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3">
            <Users className="dark:text-dark-text-secondary h-5 w-5 text-gray-500" />
            <h2 className="dark:text-dark-text text-sm font-medium text-gray-600">Küldő szerint</h2>
          </div>

          {loadingSenders ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : (
            <div className="dark:divide-dark-border divide-y divide-gray-100">
              {(sendersData?.senders || []).map((sender) => {
                const name = displaySender(sender.name, sender.email);
                const initials = getInitials(name);
                const color = emailToColor(sender.email);

                return (
                  <div
                    key={sender.id}
                    onClick={() => setSelectedSender(sender)}
                    className="dark:hover:bg-dark-bg-tertiary flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50"
                  >
                    <div
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-medium text-white"
                      style={{ backgroundColor: color }}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="dark:text-dark-text text-sm font-medium text-gray-900">
                        {name}
                      </div>
                      <div className="dark:text-dark-text-muted text-xs text-gray-400">
                        {sender.email}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <div className="text-sm font-medium text-[#4f6ef7]">
                        {sender.messageCount} levél
                      </div>
                      {sender.lastMessageAt && (
                        <div className="dark:text-dark-text-muted text-xs text-gray-400">
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

  const leftPanel = (
    <>
      <div className="dark:bg-dark-bg-tertiary dark:border-dark-border flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3">
        <button
          onClick={() => {
            setSelectedSender(null);
            setSelectedEmail(null);
          }}
          className="dark:hover:bg-dark-bg touch-manipulation rounded-lg p-2.5 hover:bg-gray-200"
          aria-label="Vissza"
        >
          <ArrowLeft className="dark:text-dark-text-secondary h-5 w-5 text-gray-500" />
        </button>
        <span className="dark:text-dark-text text-sm font-medium text-gray-600">
          {displaySender(selectedSender.name, selectedSender.email)}
        </span>
      </div>
      <EmailList
        emails={emails}
        isLoading={loadingEmails}
        selectedEmailId={selectedEmail?.id || null}
        onSelectEmail={setSelectedEmail}
        onDeleteEmail={(emailId) => {
          deleteEmail.mutate({ emailId }, {
            onSuccess: () => {
              if (selectedEmail?.id === emailId) {
                const nextEmail = getNextEmailAfterDelete(emailsRef.current, emailId);
                setSelectedEmail(nextEmail);
              }
            },
          });
        }}
        emptyMessage="Nincsenek levelek ettől a küldőtől"
      />
    </>
  );

  const rightPanel = (
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
  );

  return (
    <ResizablePanels
      leftPanel={leftPanel}
      rightPanel={rightPanel}
      rightPanelActive={!!selectedEmail}
      storageKey="sender-list-width"
    />
  );
}
