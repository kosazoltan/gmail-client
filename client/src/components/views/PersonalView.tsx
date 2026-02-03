import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../hooks/useAccounts';
import { useEmailsInfinite, useDeleteEmail } from '../../hooks/useEmails';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { ThreadedEmailList } from '../email/ThreadedEmailList';
import { EmailDetail } from '../email/EmailDetail';
import { ResizablePanels } from '../common/ResizablePanels';
import { LoginScreen } from '../auth/LoginScreen';
import { Loader2 } from 'lucide-react';
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

  const accountId = session?.activeAccountId || undefined;
  const {
    data,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useEmailsInfinite({ accountId, limit: 100 });
  const deleteEmail = useDeleteEmail();

  const { containerRef } = useInfiniteScroll({
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });

  // Személyes emailek szűrése
  const personalEmails = useMemo(() => {
    const emails = data?.pages?.flatMap(page => page.emails) || [];
    return emails.filter(isPersonalEmail);
  }, [data?.pages]);

  const emailsRef = useRef(personalEmails);
  useEffect(() => {
    emailsRef.current = personalEmails;
  }, [personalEmails]);

  if (!session?.authenticated) {
    return <LoginScreen />;
  }

  const leftPanel = (
    <div ref={containerRef} className="flex flex-col h-full overflow-auto">
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
      {isFetchingNextPage && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          <span className="ml-2 text-sm text-gray-500 dark:text-dark-text-secondary">További levelek betöltése...</span>
        </div>
      )}
    </div>
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
      storageKey="personal-list-width"
    />
  );
}
