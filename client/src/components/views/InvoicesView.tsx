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

// Számla kulcsszavak keresése a tárgyban, törzsben vagy melléklet nevében
const INVOICE_KEYWORDS = [
  // Magyar
  'számla', 'díjbekérő', 'proforma', 'fizetési felszólítás', 'befizetés',
  'pénzügyi', 'tartozás', 'egyenleg', 'fizetendő', 'esedékesség',
  // Angol
  'invoice', 'bill', 'receipt', 'payment', 'billing',
  'statement', 'due', 'amount due', 'pay now', 'payment confirmation',
  // Általános
  'pdf', 'e-számla', 'e-bill', 'számlázz.hu', 'billingo', 'szamlazz',
];

function isInvoiceEmail(email: Email): boolean {
  const subject = (email.subject || '').toLowerCase();
  const snippet = (email.snippet || '').toLowerCase();
  const body = (email.body || '').toLowerCase();
  const from = (email.from || '').toLowerCase();

  // Keresés a tárgyban
  for (const keyword of INVOICE_KEYWORDS) {
    if (subject.includes(keyword)) return true;
  }

  // Keresés a snippet-ben (rövid előnézet)
  for (const keyword of INVOICE_KEYWORDS) {
    if (snippet.includes(keyword)) return true;
  }

  // Keresés a body-ban (csak az első 1000 karakter)
  const bodyPreview = body.substring(0, 1000);
  for (const keyword of INVOICE_KEYWORDS) {
    if (bodyPreview.includes(keyword)) return true;
  }

  // Számla szolgáltatók email címei
  const invoiceSenders = [
    'szamlazz.hu', 'billingo', 'számla', 'billing', 'invoice',
    'payment', 'accounts', 'penzugy', 'fizetes',
  ];
  for (const sender of invoiceSenders) {
    if (from.includes(sender)) return true;
  }

  // Melléklet ellenőrzése
  if (email.attachments && email.attachments.length > 0) {
    for (const att of email.attachments) {
      const filename = (att.filename || '').toLowerCase();
      // PDF mellékletek számla névvel
      if (filename.includes('számla') || filename.includes('invoice') ||
          filename.includes('bill') || filename.includes('receipt')) {
        return true;
      }
    }
  }

  return false;
}

export function InvoicesView() {
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

  // Számlák szűrése
  const invoiceEmails = useMemo(() => {
    const emails = data?.pages?.flatMap(page => page.emails) || [];
    return emails.filter(isInvoiceEmail);
  }, [data?.pages]);

  const emailsRef = useRef(invoiceEmails);
  useEffect(() => {
    emailsRef.current = invoiceEmails;
  }, [invoiceEmails]);

  if (!session?.authenticated) {
    return <LoginScreen />;
  }

  const leftPanel = (
    <div ref={containerRef} className="flex flex-col h-full overflow-auto">
      <ThreadedEmailList
        emails={invoiceEmails}
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
        title={`Számlák (${invoiceEmails.length})`}
        emptyMessage="Nincs számla típusú levél"
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
      storageKey="invoices-list-width"
    />
  );
}
