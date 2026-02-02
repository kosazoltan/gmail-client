import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../hooks/useAccounts';
import { useTrash } from '../../hooks/useTrash';
import { useDeleteEmail } from '../../hooks/useEmails';
import { EmailList } from '../email/EmailList';
import { EmailDetail } from '../email/EmailDetail';
import { ResizablePanels } from '../common/ResizablePanels';
import { LoginScreen } from '../auth/LoginScreen';
import type { Email } from '../../types';
import { getNextEmailAfterDelete } from '../../lib/emailNavigation';

export function TrashView() {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const deleteEmail = useDeleteEmail();

  const accountId = session?.activeAccountId || undefined;
  const { data, isLoading } = useTrash({ accountId, page: 1 });
  const emails = data?.emails || [];

  const emailsRef = useRef(emails);
  useEffect(() => {
    emailsRef.current = emails;
  }, [emails]);

  if (!session?.authenticated) {
    return <LoginScreen />;
  }

  const leftPanel = (
    <EmailList
      emails={emails}
      isLoading={isLoading}
      selectedEmailId={selectedEmail?.id || null}
      onSelectEmail={setSelectedEmail}
      onDeleteEmail={(emailId) => {
        deleteEmail.mutate(emailId, {
          onSuccess: () => {
            if (selectedEmail?.id === emailId) {
              const nextEmail = getNextEmailAfterDelete(emailsRef.current, emailId);
              setSelectedEmail(nextEmail);
            }
          }
        });
      }}
      title={`Kuka (${emails.length})`}
      emptyMessage="A kuka üres"
    />
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
      storageKey="trash-list-width"
    />
  );
}
