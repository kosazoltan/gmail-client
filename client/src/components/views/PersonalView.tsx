import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../hooks/useAccounts';
import { useEmails, useDeleteEmail } from '../../hooks/useEmails';
import { ThreadedEmailList } from '../email/ThreadedEmailList';
import { EmailDetail } from '../email/EmailDetail';
import { LoginScreen } from '../auth/LoginScreen';
import type { Email } from '../../types';
import { getNextEmailAfterDelete } from '../../lib/emailNavigation';

// Személyes emailek - nem hírlevél, nem számla, nem automatikus értesítés
function isPersonalEmail(email: Email): boolean {
  const subject = (email.subject || '').toLowerCase();
  const from = (email.from || '').toLowerCase();
  const snippet = (email.snippet || '').toLowerCase();

  // Kizárjuk a számlákat
  const invoiceKeywords = ['számla', 'invoice', 'bill', 'receipt', 'nyugta', 'fizetés', 'payment'];
  const hasInvoiceKeyword = invoiceKeywords.some(kw =>
    subject.includes(kw) || snippet.includes(kw)
  );
  if (hasInvoiceKeyword) return false;

  // Kizárjuk a hírleveleket
  const newsletterKeywords = ['newsletter', 'hírlevél', 'unsubscribe', 'leiratkozás', 'noreply', 'no-reply', 'donotreply'];
  const hasNewsletterKeyword = newsletterKeywords.some(kw =>
    subject.includes(kw) || from.includes(kw)
  );
  if (hasNewsletterKeyword) return false;

  // Kizárjuk az automatikus értesítéseket
  const automatedKeywords = ['notification', 'értesítés', 'alert', 'automated', 'automatic', 'system'];
  const hasAutomatedKeyword = automatedKeywords.some(kw =>
    subject.includes(kw) || from.includes(kw)
  );
  if (hasAutomatedKeyword) return false;

  // A maradék személyes
  return true;
}

export function PersonalView() {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [page, setPage] = useState(1);

  const accountId = session?.activeAccountId || undefined;
  const { data, isLoading } = useEmails({ accountId, page, limit: 100 });
  const deleteEmail = useDeleteEmail();

  // Személyes emailek szűrése
  const personalEmails = useMemo(() => {
    const emails = data?.emails || [];
    return emails.filter(isPersonalEmail);
  }, [data?.emails]);

  const emailsRef = useRef(personalEmails);
  useEffect(() => {
    emailsRef.current = personalEmails;
  }, [personalEmails]);

  if (!session?.authenticated) {
    return <LoginScreen />;
  }

  return (
    <div className="flex h-full relative">
      {/* Email lista */}
      <div className={`
        w-full lg:w-2/5 xl:w-1/3 border-r border-gray-200 dark:border-dark-border overflow-auto
        ${selectedEmail ? 'hidden lg:block' : 'block'}
      `}>
        <ThreadedEmailList
          emails={personalEmails}
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
          title={`Személyes levelek (${personalEmails.length})`}
          emptyMessage="Nincs személyes levél"
        />

        {/* Lapozás */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 p-3 border-t border-gray-200 dark:border-dark-border">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-3 text-sm rounded-lg border border-gray-300 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary disabled:opacity-50 dark:text-dark-text touch-manipulation"
            >
              Előző
            </button>
            <span className="text-sm text-gray-500 dark:text-dark-text-secondary">
              {page} / {data.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page === data.totalPages}
              className="px-4 py-3 text-sm rounded-lg border border-gray-300 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary disabled:opacity-50 dark:text-dark-text touch-manipulation"
            >
              Következő
            </button>
          </div>
        )}
      </div>

      {/* Email részletek */}
      <div className={`
        flex-1
        ${selectedEmail ? 'block absolute inset-0 lg:relative lg:inset-auto bg-white dark:bg-dark-bg z-10' : 'hidden lg:block'}
      `}>
        <EmailDetail
          emailId={selectedEmail?.id || null}
          accountId={accountId}
          onBack={() => setSelectedEmail(null)}
          onReply={({ to, subject, threadId, cc, body }) => {
            navigate(
              `/compose?reply=true&to=${encodeURIComponent(to)}&subject=${encodeURIComponent(subject)}${threadId ? `&threadId=${threadId}` : ''}${cc ? `&cc=${encodeURIComponent(cc)}` : ''}${body ? `&body=${encodeURIComponent(body)}` : ''}`,
            );
          }}
          onForward={({ subject, body }) => {
            navigate(
              `/compose?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
            );
          }}
          onDeleteSuccess={() => {
            const nextEmail = getNextEmailAfterDelete(emailsRef.current, selectedEmail?.id);
            setSelectedEmail(nextEmail);
          }}
        />
      </div>
    </div>
  );
}
