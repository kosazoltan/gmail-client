import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSession } from '../../hooks/useAccounts';
import { useSearch } from '../../hooks/useSearch';
import { useLabels } from '../../hooks/useLabels';
import { useDeleteEmail } from '../../hooks/useEmails';
import { EmailList } from '../email/EmailList';
import { EmailDetail } from '../email/EmailDetail';
import { ResizablePanels } from '../common/ResizablePanels';
import { LoginScreen } from '../auth/LoginScreen';
import type { Email } from '../../types';
import { getNextEmailAfterDelete } from '../../lib/emailNavigation';

export function LabelView() {
  const navigate = useNavigate();
  const { labelId } = useParams<{ labelId: string }>();
  const { data: session } = useSession();
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const deleteEmail = useDeleteEmail();

  const accountId = session?.activeAccountId || undefined;

  // Címke név lekérése
  const { data: labelsData } = useLabels();
  const labels = labelsData?.labels;
  const label = useMemo(() => {
    if (!labels || !labelId) return null;
    return labels.find((l) => l.id === labelId);
  }, [labels, labelId]);

  // Gmail label keresés szintaxis: label:LABEL_NAME
  const searchQuery = labelId ? `label:${labelId}` : '';
  const { data, isLoading } = useSearch(searchQuery, { accountId });
  const emails = useMemo(() => data?.emails ?? [], [data?.emails]);

  const emailsRef = useRef(emails);
  useEffect(() => {
    emailsRef.current = emails;
  }, [emails]);

  if (!session?.authenticated) {
    return <LoginScreen />;
  }

  const labelColor = label?.color?.backgroundColor || '#6b7280';

  const leftPanel = (
    <div className="flex h-full flex-col">
      {/* Címke fejléc */}
      <div className="dark:bg-dark-bg-tertiary dark:border-dark-border flex items-center gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3">
        <span className="h-4 w-4 rounded-full" style={{ backgroundColor: labelColor }} />
        <h2 className="dark:text-dark-text text-sm font-medium text-gray-700">
          {label?.name || 'Címke'}
          {data?.total !== undefined && (
            <span className="dark:text-dark-text-muted ml-2 text-gray-400">({data.total})</span>
          )}
        </h2>
      </div>

      <div className="flex-1 overflow-auto">
        <EmailList
          emails={emails}
          isLoading={isLoading}
          selectedEmailId={selectedEmail?.id || null}
          onSelectEmail={setSelectedEmail}
          onDeleteEmail={(emailId) => {
            deleteEmail.mutate({ emailId }, {
              onSuccess: () => {
                if (selectedEmail?.id === emailId) {
                  const nextEmail = getNextEmailAfterDelete(emailsRef.current, emailId);
                  setSelectedEmail(nextEmail);
                }
              },
            });
          }}
          emptyMessage="Nincs email ezzel a címkével"
        />
      </div>
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
      onReplyAll={({ to, cc, subject, threadId, body, fromName, date }) => {
        const originalBody = body || '';
        const replyBody = `\n\n─────────────────────────\nDátum: ${date ? new Date(date).toLocaleString('hu-HU') : ''}\nFeladó: ${fromName || to}\n\n${originalBody}`;
        navigate(
          `/compose?reply=true&to=${encodeURIComponent(to)}${cc ? `&cc=${encodeURIComponent(cc)}` : ''}&subject=${encodeURIComponent(subject)}${threadId ? `&threadId=${threadId}` : ''}&body=${encodeURIComponent(replyBody)}`,
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
      storageKey="label-list-width"
    />
  );
}
