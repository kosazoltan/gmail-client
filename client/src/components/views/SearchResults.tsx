import { useState, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useSearch } from '../../hooks/useSearch';
import { useSession } from '../../hooks/useAccounts';
import { useDeleteEmail, useBatchDeleteEmails, useBatchMarkRead } from '../../hooks/useEmails';
import { EmailList } from '../email/EmailList';
import { EmailDetail } from '../email/EmailDetail';
import { ResizablePanels } from '../common/ResizablePanels';
import {
  Search,
  CheckSquare,
  X,
  Trash2,
  Square,
  CheckCheck,
  MailOpen,
  Mail,
  Users,
} from 'lucide-react';
import type { Email } from '../../types';
import { getNextEmailAfterDelete } from '../../lib/emailNavigation';

export function SearchResults() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: session } = useSession();
  const query = (searchParams.get('q') || '').trim();
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const deleteEmail = useDeleteEmail();
  const batchDeleteEmails = useBatchDeleteEmails();
  const batchMarkRead = useBatchMarkRead();

  // Cross-account search toggle
  const [allAccounts, setAllAccounts] = useState(false);
  const hasMultipleAccounts = (session?.accounts?.length || 0) > 1;

  // Selection mode state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const lastClickedIndexRef = useRef<number>(-1);

  const fallbackAccountId = session?.accounts?.[0]?.id;
  const accountId = allAccounts
    ? undefined
    : session?.activeAccountId || fallbackAccountId || undefined;
  const { data, isLoading, error } = useSearch(query, {
    page,
    limit: allAccounts ? 50 : 100,
    accountId,
    allAccounts: allAccounts || undefined,
  });
  const emails = useMemo(() => data?.emails ?? [], [data?.emails]);

  const toggleSelectionMode = useCallback(() => {
    if (allAccounts) return;
    setSelectionMode((prev) => {
      if (prev) {
        setSelectedIds(new Set());
      }
      return !prev;
    });
  }, [allAccounts]);

  const toggleSelectEmail = useCallback(
    (emailId: string, event?: React.MouseEvent) => {
      const emailIndex = emails.findIndex((e) => e.id === emailId);

      if (event?.shiftKey && lastClickedIndexRef.current >= 0 && emailIndex >= 0) {
        const start = Math.min(lastClickedIndexRef.current, emailIndex);
        const end = Math.max(lastClickedIndexRef.current, emailIndex);
        setSelectedIds((prev) => {
          const newSet = new Set(prev);
          for (let i = start; i <= end; i++) {
            newSet.add(emails[i].id);
          }
          return newSet;
        });
      } else {
        setSelectedIds((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(emailId)) {
            newSet.delete(emailId);
          } else {
            newSet.add(emailId);
          }
          return newSet;
        });
      }
      lastClickedIndexRef.current = emailIndex;
    },
    [emails],
  );

  const selectAllEmails = useCallback(() => {
    setSelectedIds(new Set(emails.map((e) => e.id)));
  }, [emails]);

  const deselectAllEmails = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleBatchMarkRead = useCallback(
    (isRead: boolean) => {
      if (selectedIds.size === 0 || allAccounts) return;
      batchMarkRead.mutate(
        { emailIds: Array.from(selectedIds), isRead, accountId },
        {
          onSuccess: () => {
            setSelectedIds(new Set());
            setSelectionMode(false);
          },
        },
      );
    },
    [selectedIds, batchMarkRead, allAccounts, accountId],
  );

  const handleBatchDelete = useCallback(() => {
    if (selectedIds.size === 0 || allAccounts) return;
    setShowBatchDeleteConfirm(true);
  }, [selectedIds, allAccounts]);

  const confirmBatchDelete = useCallback(() => {
    const idsToDelete = Array.from(selectedIds);
    batchDeleteEmails.mutate(
      { emailIds: idsToDelete, accountId },
      {
        onSuccess: () => {
          setShowBatchDeleteConfirm(false);
          setSelectedIds(new Set());
          setSelectionMode(false);
          if (selectedEmail && selectedIds.has(selectedEmail.id)) {
            setSelectedEmail(null);
          }
        },
      },
    );
  }, [selectedIds, batchDeleteEmails, selectedEmail, accountId]);

  const leftPanel = (
    <>
      <div className="dark:bg-dark-bg-tertiary dark:border-dark-border sticky top-0 z-10 flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2">
        <button
          onClick={toggleSelectionMode}
          disabled={allAccounts}
          className={`rounded-lg p-2 transition-colors ${
            selectionMode
              ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'
              : 'dark:hover:bg-dark-border dark:text-dark-text-secondary text-gray-600 hover:bg-gray-200'
          } disabled:cursor-not-allowed disabled:opacity-50`}
          title={
            allAccounts
              ? 'Többfiókos keresésben a batch műveletek le vannak tiltva'
              : selectionMode
                ? 'Kijelölés befejezése'
                : 'Kijelölési mód'
          }
        >
          <CheckSquare className="h-5 w-5" />
        </button>

        {selectionMode && (
          <>
            <div className="dark:bg-dark-border h-5 w-px bg-gray-300" />

            <button
              onClick={selectAllEmails}
              className="dark:hover:bg-dark-border dark:text-dark-text-secondary rounded-lg p-2 text-gray-600 hover:bg-gray-200"
              title="Összes kijelölése"
            >
              <CheckCheck className="h-5 w-5" />
            </button>

            <button
              onClick={deselectAllEmails}
              className="dark:hover:bg-dark-border dark:text-dark-text-secondary rounded-lg p-2 text-gray-600 hover:bg-gray-200"
              title="Kijelölés törlése"
            >
              <Square className="h-5 w-5" />
            </button>

            {selectedIds.size > 0 && (
              <>
                <div className="dark:bg-dark-border h-5 w-px bg-gray-300" />

                <span className="dark:text-dark-text-secondary text-sm text-gray-600">
                  {selectedIds.size} kijelölve
                </span>

                <button
                  onClick={handleBatchDelete}
                  className="rounded-lg p-2 text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-500/20"
                  title="Kijelöltek törlése"
                >
                  <Trash2 className="h-5 w-5" />
                </button>

                <button
                  onClick={() => handleBatchMarkRead(true)}
                  className="dark:hover:bg-dark-border dark:text-dark-text-secondary rounded-lg p-2 text-gray-600 hover:bg-gray-200"
                  title="Olvasottnak jelölés"
                >
                  <MailOpen className="h-5 w-5" />
                </button>

                <button
                  onClick={() => handleBatchMarkRead(false)}
                  className="dark:hover:bg-dark-border dark:text-dark-text-secondary rounded-lg p-2 text-gray-600 hover:bg-gray-200"
                  title="Olvasatlannak jelölés"
                >
                  <Mail className="h-5 w-5" />
                </button>
              </>
            )}

            <div className="flex-1" />

            <button
              onClick={toggleSelectionMode}
              className="dark:hover:bg-dark-border dark:text-dark-text-secondary rounded-lg p-2 text-gray-600 hover:bg-gray-200"
              title="Bezárás"
            >
              <X className="h-5 w-5" />
            </button>
          </>
        )}

        {!selectionMode && (
          <div className="flex items-center gap-2">
            <Search className="dark:text-dark-text-secondary h-5 w-5 text-gray-500" />
            <h2 className="dark:text-dark-text text-sm font-medium text-gray-600">
              Keresés: "{query}"
              {data && (
                <span className="dark:text-dark-text-muted ml-1 text-gray-400">
                  ({data.total} találat{allAccounts ? ', minden fiók' : ''})
                </span>
              )}
              {error && (
                <span className="ml-2 text-xs text-red-600 dark:text-red-400">(Keresési hiba)</span>
              )}
            </h2>
            <div className="flex-1" />
            {hasMultipleAccounts && (
              <button
                onClick={() =>
                  setAllAccounts((prev) => {
                    const next = !prev;
                    // Többfiókos módban a batch műveletek tiltottak — kijelölési
                    // módban ragadna a felület, ezért kilépünk belőle.
                    if (next) {
                      setSelectionMode(false);
                      setSelectedIds(new Set());
                    }
                    return next;
                  })
                }
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  allAccounts
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'
                    : 'dark:text-dark-text-secondary dark:hover:bg-dark-border text-gray-500 hover:bg-gray-200'
                }`}
                title={allAccounts ? 'Csak aktív fiókban keres' : 'Keresés minden fiókban'}
              >
                <Users className="h-3.5 w-3.5" />
                Minden fiók
              </button>
            )}
          </div>
        )}
      </div>
      <EmailList
        emails={emails}
        isLoading={isLoading}
        selectedEmailId={selectedEmail?.id || null}
        onSelectEmail={setSelectedEmail}
        onDeleteEmail={(emailId) => {
          const email = emails.find((item) => item.id === emailId);
          deleteEmail.mutate(
            { emailId, accountId: email?.accountId || accountId },
            {
              onSuccess: () => {
                if (selectedEmail?.id === emailId) {
                  const nextEmail = getNextEmailAfterDelete(emails, emailId);
                  setSelectedEmail(nextEmail);
                }
              },
            },
          );
        }}
        emptyMessage={`Nincs találat: "${query}"`}
        selectionMode={selectionMode && !allAccounts}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelectEmail}
        showAccountBadge={allAccounts}
      />
    </>
  );

  const rightPanel = (
    <EmailDetail
      emailId={selectedEmail?.id || null}
      accountId={selectedEmail?.accountId || accountId}
      onBack={() => setSelectedEmail(null)}
      onReply={({ to, subject, threadId, body, fromName, date }) => {
        const originalBody = body || '';
        const replyBody = `\n\n─────────────────────────\nDátum: ${date ? new Date(date).toLocaleString('hu-HU') : ''}\nFeladó: ${fromName || to}\n\n${originalBody}`;
        const replyAccountId = selectedEmail?.accountId;
        navigate(
          `/compose?reply=true&to=${encodeURIComponent(to)}&subject=${encodeURIComponent(subject)}${threadId ? `&threadId=${threadId}` : ''}${replyAccountId ? `&accountId=${encodeURIComponent(replyAccountId)}` : ''}&body=${encodeURIComponent(replyBody)}`,
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
    <>
      <ResizablePanels
        leftPanel={leftPanel}
        rightPanel={rightPanel}
        rightPanelActive={!!selectedEmail && !selectionMode}
        storageKey="search-list-width"
      />

      {/* Batch törlés megerősítő modal */}
      {showBatchDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="dark:bg-dark-bg-secondary dark:border-dark-border mx-4 max-w-sm rounded-lg bg-white p-6 shadow-xl dark:border">
            <h3 className="dark:text-dark-text mb-2 text-lg font-medium text-gray-900">
              {selectedIds.size} email törlése
            </h3>
            <p className="dark:text-dark-text-secondary mb-4 text-sm text-gray-500">
              Biztosan törölni szeretnéd a kijelölt {selectedIds.size} emailt? A levelek a kukába
              kerülnek.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowBatchDeleteConfirm(false)}
                className="dark:border-dark-border dark:hover:bg-dark-bg-tertiary dark:text-dark-text rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
              >
                Mégse
              </button>
              <button
                onClick={confirmBatchDelete}
                disabled={batchDeleteEmails.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                {batchDeleteEmails.isPending ? 'Törlés...' : `${selectedIds.size} törlése`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
