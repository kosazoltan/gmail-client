import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../hooks/useAccounts';
import { useInbox } from '../../hooks/useInbox';
import { useToggleStar, useMarkRead, useDeleteEmail, useBatchDeleteEmails } from '../../hooks/useEmails';
import { useKeyboardShortcuts, useSearchFocus } from '../../hooks/useKeyboardShortcuts';
import { ThreadedEmailList } from '../email/ThreadedEmailList';
import { EmailDetail } from '../email/EmailDetail';
import { KeyboardShortcutsHelp } from '../common/KeyboardShortcutsHelp';
import { ResizablePanels } from '../common/ResizablePanels';
import { LoginScreen } from '../auth/LoginScreen';
import { CheckSquare, X, Trash2, Square, CheckCheck } from 'lucide-react';
import type { Email } from '../../types';
import { getNextEmailAfterDelete } from '../../lib/emailNavigation';

export function InboxView() {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [page, setPage] = useState(1);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Selection mode state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);

  const accountId = session?.activeAccountId || undefined;
  const { data, isLoading } = useInbox({ accountId, page });
  const toggleStar = useToggleStar();
  const markRead = useMarkRead();
  const deleteEmail = useDeleteEmail();
  const batchDeleteEmails = useBatchDeleteEmails();
  const focusSearch = useSearchFocus();

  const emails = useMemo(() => data?.emails || [], [data?.emails]);

  // Kiválasztott email indexe
  const selectedIndex = useMemo(() => {
    if (!selectedEmail) return -1;
    return emails.findIndex((e) => e.id === selectedEmail.id);
  }, [emails, selectedEmail]);

  // Selection mode handlers
  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => {
      if (prev) {
        setSelectedIds(new Set());
      }
      return !prev;
    });
  }, []);

  const toggleSelectEmail = useCallback((emailId: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(emailId)) {
        newSet.delete(emailId);
      } else {
        newSet.add(emailId);
      }
      return newSet;
    });
  }, []);

  const selectAllEmails = useCallback(() => {
    setSelectedIds(new Set(emails.map((e) => e.id)));
  }, [emails]);

  const deselectAllEmails = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleBatchDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    setShowBatchDeleteConfirm(true);
  }, [selectedIds]);

  const confirmBatchDelete = useCallback(() => {
    const idsToDelete = Array.from(selectedIds);
    batchDeleteEmails.mutate(idsToDelete, {
      onSuccess: () => {
        setShowBatchDeleteConfirm(false);
        setSelectedIds(new Set());
        setSelectionMode(false);
        if (selectedEmail && selectedIds.has(selectedEmail.id)) {
          setSelectedEmail(null);
        }
      },
    });
  }, [selectedIds, batchDeleteEmails, selectedEmail]);

  // Navigáció következő emailre
  const handleNextEmail = useCallback(() => {
    if (emails.length === 0) return;
    if (selectedIndex === -1) {
      setSelectedEmail(emails[0]);
    } else if (selectedIndex < emails.length - 1) {
      setSelectedEmail(emails[selectedIndex + 1]);
    }
  }, [emails, selectedIndex]);

  // Navigáció előző emailre
  const handlePrevEmail = useCallback(() => {
    if (emails.length === 0) return;
    if (selectedIndex === -1) {
      setSelectedEmail(emails[emails.length - 1]);
    } else if (selectedIndex > 0) {
      setSelectedEmail(emails[selectedIndex - 1]);
    }
  }, [emails, selectedIndex]);

  // Válasz
  const handleReply = useCallback(() => {
    if (!selectedEmail) return;
    // Eredeti üzenet egyszerű formában (prefix nélkül)
    const originalBody = selectedEmail.body || selectedEmail.snippet || '';
    const replyBody = `\n\n─────────────────────────\nDátum: ${new Date(selectedEmail.date).toLocaleString('hu-HU')}\nFeladó: ${selectedEmail.fromName || selectedEmail.from || ''}\n\n${originalBody}`;

    navigate(
      `/compose?reply=true&to=${encodeURIComponent(selectedEmail.from || '')}&subject=${encodeURIComponent(`Re: ${selectedEmail.subject || ''}`)}${selectedEmail.threadId ? `&threadId=${selectedEmail.threadId}` : ''}&body=${encodeURIComponent(replyBody)}`,
    );
  }, [selectedEmail, navigate]);

  // Továbbítás
  const handleForward = useCallback(() => {
    if (!selectedEmail) return;
    navigate(
      `/compose?subject=${encodeURIComponent(`Fwd: ${selectedEmail.subject || ''}`)}`,
    );
  }, [selectedEmail, navigate]);

  // Csillagozás toggle
  const handleToggleStar = useCallback(() => {
    if (!selectedEmail) return;
    toggleStar.mutate({
      emailId: selectedEmail.id,
      isStarred: !selectedEmail.isStarred,
    });
    // Frissítsük a helyi állapotot is
    setSelectedEmail((prev) =>
      prev ? { ...prev, isStarred: !prev.isStarred } : null,
    );
  }, [selectedEmail, toggleStar]);

  // Olvasott/olvasatlan toggle
  const handleToggleRead = useCallback(() => {
    if (!selectedEmail) return;
    markRead.mutate({
      emailId: selectedEmail.id,
      isRead: !selectedEmail.isRead,
    });
    setSelectedEmail((prev) =>
      prev ? { ...prev, isRead: !prev.isRead } : null,
    );
  }, [selectedEmail, markRead]);

  // Törlés
  const handleDelete = useCallback(() => {
    if (!selectedEmail) return;
    setShowDeleteConfirm(true);
  }, [selectedEmail]);

  // Ref a friss emails lista eléréséhez (stale closure fix)
  const emailsRef = useRef(emails);
  useEffect(() => {
    emailsRef.current = emails;
  }, [emails]);

  const confirmDelete = useCallback(() => {
    if (!selectedEmail) return;
    const emailIdToDelete = selectedEmail.id;

    deleteEmail.mutate(emailIdToDelete, {
      onSuccess: () => {
        const nextEmail = getNextEmailAfterDelete(emailsRef.current, emailIdToDelete);
        setSelectedEmail(nextEmail);
        setShowDeleteConfirm(false);
      },
    });
  }, [selectedEmail, deleteEmail]);

  // Billentyűparancsok
  useKeyboardShortcuts({
    onNextEmail: handleNextEmail,
    onPrevEmail: handlePrevEmail,
    onReply: handleReply,
    onForward: handleForward,
    onToggleStar: handleToggleStar,
    onToggleRead: handleToggleRead,
    onDelete: handleDelete,
    onSearch: focusSearch,
    onCompose: () => navigate('/compose'),
    onBack: () => {
      if (showBatchDeleteConfirm) {
        setShowBatchDeleteConfirm(false);
      } else if (showDeleteConfirm) {
        setShowDeleteConfirm(false);
      } else if (showShortcutsHelp) {
        setShowShortcutsHelp(false);
      } else if (selectionMode) {
        setSelectionMode(false);
        setSelectedIds(new Set());
      } else {
        setSelectedEmail(null);
      }
    },
    onShowHelp: () => setShowShortcutsHelp(true),
    enabled: session?.authenticated,
  });

  if (!session?.authenticated) {
    return <LoginScreen />;
  }

  const leftPanel = (
    <div className="flex flex-col h-full">
      {/* Selection toolbar - sticky */}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-dark-bg-tertiary border-b border-gray-200 dark:border-dark-border sticky top-0 z-10">
        <button
          onClick={toggleSelectionMode}
          className={`p-2 rounded-lg transition-colors ${
            selectionMode
              ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
              : 'hover:bg-gray-200 dark:hover:bg-dark-border text-gray-600 dark:text-dark-text-secondary'
          }`}
          title={selectionMode ? 'Kijelölés befejezése' : 'Kijelölési mód'}
        >
          <CheckSquare className="h-5 w-5" />
        </button>

        {selectionMode && (
          <>
            <div className="h-5 w-px bg-gray-300 dark:bg-dark-border" />

            <button
              onClick={selectAllEmails}
              className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-border text-gray-600 dark:text-dark-text-secondary"
              title="Összes kijelölése"
            >
              <CheckCheck className="h-5 w-5" />
            </button>

            <button
              onClick={deselectAllEmails}
              className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-border text-gray-600 dark:text-dark-text-secondary"
              title="Kijelölés törlése"
            >
              <Square className="h-5 w-5" />
            </button>

            {selectedIds.size > 0 && (
              <>
                <div className="h-5 w-px bg-gray-300 dark:bg-dark-border" />

                <span className="text-sm text-gray-600 dark:text-dark-text-secondary">
                  {selectedIds.size} kijelölve
                </span>

                <button
                  onClick={handleBatchDelete}
                  className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400"
                  title="Kijelöltek törlése"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </>
            )}

            <div className="flex-1" />

            <button
              onClick={toggleSelectionMode}
              className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-border text-gray-600 dark:text-dark-text-secondary"
              title="Bezárás"
            >
              <X className="h-5 w-5" />
            </button>
          </>
        )}

        {!selectionMode && (
          <h2 className="text-sm font-medium text-gray-600 dark:text-dark-text-secondary">
            Beérkezett levelek{data?.total ? ` (${data.total})` : ''}
          </h2>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        <ThreadedEmailList
          emails={emails}
          isLoading={isLoading}
          selectedEmailId={selectedEmail?.id || null}
          onSelectEmail={setSelectedEmail}
          onDeleteEmail={(emailId) => {
            const emailIndex = emails.findIndex(e => e.id === emailId);
            deleteEmail.mutate(emailId, {
              onSuccess: () => {
                if (selectedEmail?.id === emailId) {
                  // Ha az email nincs a listában vagy ez az egyetlen, null-ra állítjuk
                  if (emailIndex < 0 || emails.length <= 1) {
                    setSelectedEmail(null);
                  } else if (emailIndex < emails.length - 1) {
                    setSelectedEmail(emails[emailIndex + 1]);
                  } else {
                    setSelectedEmail(emails[emailIndex - 1]);
                  }
                }
              }
            });
          }}
          emptyMessage="Nincs beérkezett levél. Szinkronizálj a frissítéshez!"
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelectEmail}
        />
      </div>
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
    <>
      <ResizablePanels
        leftPanel={leftPanel}
        rightPanel={rightPanel}
        rightPanelActive={!!selectedEmail && !selectionMode}
        storageKey="inbox-list-width"
      />

      {/* Törlés megerősítő modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-dark-bg-secondary rounded-lg p-6 max-w-sm mx-4 shadow-xl dark:border dark:border-dark-border">
            <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text mb-2">
              Email törlése
            </h3>
            <p className="text-sm text-gray-500 dark:text-dark-text-secondary mb-4">
              Biztosan törölni szeretnéd ezt az emailt? Az email a kukába kerül.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary dark:text-dark-text"
              >
                Mégse
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteEmail.isPending}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteEmail.isPending ? 'Törlés...' : 'Törlés'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch törlés megerősítő modal */}
      {showBatchDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-dark-bg-secondary rounded-lg p-6 max-w-sm mx-4 shadow-xl dark:border dark:border-dark-border">
            <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text mb-2">
              {selectedIds.size} email törlése
            </h3>
            <p className="text-sm text-gray-500 dark:text-dark-text-secondary mb-4">
              Biztosan törölni szeretnéd a kijelölt {selectedIds.size} emailt? A levelek a kukába kerülnek.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowBatchDeleteConfirm(false)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary dark:text-dark-text"
              >
                Mégse
              </button>
              <button
                onClick={confirmBatchDelete}
                disabled={batchDeleteEmails.isPending}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {batchDeleteEmails.isPending ? 'Törlés...' : `${selectedIds.size} törlése`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Billentyűparancsok súgó */}
      <KeyboardShortcutsHelp
        isOpen={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
      />
    </>
  );
}
