import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useSearch } from '../../hooks/useSearch';
import { useSession } from '../../hooks/useAccounts';
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

  const accountId = session?.activeAccountId || undefined;
  const { data, isLoading } = useSearch(query, { accountId });

  return (
    <div className="flex h-full">
      <div className="w-full lg:w-2/5 xl:w-1/3 border-r border-gray-200 overflow-auto">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
          <Search className="h-5 w-5 text-gray-500" />
          <h2 className="text-sm font-medium text-gray-600">
            Keresés: "{query}"
            {data && <span className="text-gray-400 ml-1">({data.total} találat)</span>}
          </h2>
        </div>

        <EmailList
          emails={data?.emails || []}
          isLoading={isLoading}
          selectedEmailId={selectedEmail?.id || null}
          onSelectEmail={setSelectedEmail}
          emptyMessage={`Nincs találat: "${query}"`}
        />
      </div>

      <div className="hidden lg:block flex-1">
        <EmailDetail
          emailId={selectedEmail?.id || null}
          accountId={accountId}
          onBack={() => setSelectedEmail(null)}
          onReply={({ to, subject, threadId }) => {
            navigate(
              `/compose?reply=true&to=${encodeURIComponent(to)}&subject=${encodeURIComponent(subject)}${threadId ? `&threadId=${threadId}` : ''}`,
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
