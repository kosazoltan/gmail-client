import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useSearch } from '../../hooks/useSearch';
import { useSession } from '../../hooks/useAccounts';
import { useDeleteEmail } from '../../hooks/useEmails';
import { EmailList } from '../email/EmailList';
import { EmailDetail } from '../email/EmailDetail';
import { ResizablePanels } from '../common/ResizablePanels';
import { Search } from 'lucide-react';
import type { Email } from '../../types';
import { getNextEmailAfterDelete } from '../../lib/emailNavigation';

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

  const leftPanel = (
    <>
      <div className="dark:bg-dark-bg-tertiary dark:border-dark-border flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3">
        <Search className="dark:text-dark-text-secondary h-5 w-5 text-gray-500" />
        <h2 className="dark:text-dark-text text-sm font-medium text-gray-600">
          Keresés: "{query}"
          {data && (
            <span className="dark:text-dark-text-muted ml-1 text-gray-400">
              ({data.total} találat)
            </span>
          )}
        </h2>
      </div>
      <EmailList
        emails={emails}
        isLoading={isLoading}
        selectedEmailId={selectedEmail?.id || null}
        onSelectEmail={setSelectedEmail}
        onDeleteEmail={(emailId) => {
          const emailIndex = emails.findIndex((e) => e.id === emailId);
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
            },
          });
        }}
        emptyMessage={`Nincs találat: "${query}"`}
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
      storageKey="search-list-width"
    />
  );
}
