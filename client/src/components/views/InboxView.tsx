import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../hooks/useAccounts';
import { useEmails } from '../../hooks/useEmails';
import { EmailList } from '../email/EmailList';
import { EmailDetail } from '../email/EmailDetail';
import type { Email } from '../../types';

export function InboxView() {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [page, setPage] = useState(1);

  const accountId = session?.activeAccountId || undefined;
  const { data, isLoading } = useEmails({ accountId, page, limit: 50 });

  if (!session?.authenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <p className="text-lg mb-2">Üdvözlünk a Gmail Kliensben!</p>
        <p className="text-sm">Jelentkezz be egy Google fiókkal a bal oldali menüben.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Email lista */}
      <div className="w-full lg:w-2/5 xl:w-1/3 border-r border-gray-200 overflow-auto">
        <EmailList
          emails={data?.emails || []}
          isLoading={isLoading}
          selectedEmailId={selectedEmail?.id || null}
          onSelectEmail={setSelectedEmail}
          title={`Beérkezett levelek${data?.total ? ` (${data.total})` : ''}`}
          emptyMessage="Nincs beérkezett levél. Szinkronizálj a frissítéshez!"
        />

        {/* Lapozás */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 p-3 border-t border-gray-200">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-sm rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
            >
              Előző
            </button>
            <span className="text-sm text-gray-500">
              {page} / {data.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page === data.totalPages}
              className="px-3 py-1 text-sm rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
            >
              Következő
            </button>
          </div>
        )}
      </div>

      {/* Email részletek */}
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
