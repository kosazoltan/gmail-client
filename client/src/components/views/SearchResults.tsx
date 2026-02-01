import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useSearch } from '../../hooks/useSearch';
import { useSession } from '../../hooks/useAccounts';
import { useDeleteEmail } from '../../hooks/useEmails';
import { EmailList } from '../email/EmailList';
import { EmailDetail } from '../email/EmailDetail';
import { Search } from 'lucide-react';
import type { Email } from '../../types';

export function SearchResults() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: session } = useSession();
  const query = searchParams.get('q') || '';
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const deleteEmail = useDeleteEmail();

  const accountId = session?.activeAccountId || undefined;
  const { data, isLoading } = useSearch(query, { accountId });
  const emails = data?.emails || [];

  return (
    <div className="flex h-full relative">
      {/* Email lista - rejtett ha van kiválasztott email kis képernyőn */}
      <div className={`
        w-full lg:w-2/5 xl:w-1/3 border-r border-gray-200 dark:border-dark-border overflow-auto
        ${selectedEmail ? 'hidden lg:block' : 'block'}
      `}>
        <div className="px-4 py-3 bg-gray-50 dark:bg-dark-bg-tertiary border-b border-gray-200 dark:border-dark-border flex items-center gap-2">
          <Search className="h-5 w-5 text-gray-500 dark:text-dark-text-secondary" />
          <h2 className="text-sm font-medium text-gray-600 dark:text-dark-text">
            Keresés: "{query}"
            {data && <span className="text-gray-400 dark:text-dark-text-muted ml-1">({data.total} találat)</span>}
          </h2>
        </div>

        <EmailList
          emails={emails}
          isLoading={isLoading}
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
          emptyMessage={`Nincs találat: "${query}"`}
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
