import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../hooks/useAccounts';
import { useEmails, useDeleteEmail } from '../../hooks/useEmails';
import { ThreadedEmailList } from '../email/ThreadedEmailList';
import { EmailDetail } from '../email/EmailDetail';
import { LoginScreen } from '../auth/LoginScreen';
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
  const [page, setPage] = useState(1);

  const accountId = session?.activeAccountId || undefined;
  const { data, isLoading } = useEmails({ accountId, page, limit: 100 });
  const deleteEmail = useDeleteEmail();

  // Számlák szűrése
  const invoiceEmails = useMemo(() => {
    const emails = data?.emails || [];
    return emails.filter(isInvoiceEmail);
  }, [data?.emails]);

  const emailsRef = useRef(invoiceEmails);
  useEffect(() => {
    emailsRef.current = invoiceEmails;
  }, [invoiceEmails]);

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
