import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../hooks/useAccounts';
import { useTrash } from '../../hooks/useTrash';
import { useDeleteEmail } from '../../hooks/useEmails';
import { EmailList } from '../email/EmailList';
import { EmailDetail } from '../email/EmailDetail';
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

  return (
    <div className="flex h-full relative">
      {/* Email lista - rejtett ha van kiválasztott email kis képernyőn */}
      <div className={`
        w-full lg:w-2/5 xl:w-1/3 border-r border-gray-200 dark:border-dark-border overflow-auto
        ${selectedEmail ? 'hidden lg:block' : 'block'}
      `}>
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
      </div>

      {/* Email részletek - teljes képernyős kis képernyőn, oldalsó panel nagyobbon */}
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
