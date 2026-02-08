import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../hooks/useAccounts';
import { useUnifiedInboxInfinite } from '../../hooks/useUnifiedInbox';
import {
  useToggleStar,
  useMarkRead,
  useDeleteEmail,
  useBatchDeleteEmails,
} from '../../hooks/useEmails';
import { useKeyboardShortcuts, useSearchFocus } from '../../hooks/useKeyboardShortcuts';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { EmailDetail } from '../email/EmailDetail';
import { KeyboardShortcutsHelp } from '../common/KeyboardShortcutsHelp';
import { ResizablePanels } from '../common/ResizablePanels';
import { LoginScreen } from '../auth/LoginScreen';
import { UnifiedEmailList } from '../email/UnifiedEmailList';
import { CheckSquare, X, Trash2, Square, CheckCheck, Filter, Inbox, Loader2 } from 'lucide-react';
import type { Email } from '../../types';
import { getNextEmailAfterDelete } from '../../lib/emailNavigation';
import { cn } from '../../lib/utils';

export function UnifiedInboxView() {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [filterAccountId, setFilterAccountId] = useState<string | undefined>(undefined);
  const [showAccountFilter, setShowAccountFilter] = useState(false);

  // Selection mode state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);

  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useUnifiedInboxInfinite({ filterAccountId });

  const { containerRef } = useInfiniteScroll({
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });
  const toggleStar = useToggleStar();
  const markRead = useMarkRead();
  const deleteEmail = useDeleteEmail();
  const batchDeleteEmails = useBatchDeleteEmails();
  const focusSearch = useSearchFocus();

  const emails = useMemo(() => data?.pages?.flatMap((page) => page.emails) || [], [data?.pages]);
  const accounts = useMemo(() => data?.pages?.[0]?.accounts || [], [data?.pages]);
  const totalEmails = data?.pages?.[0]?.total || 0;

  // Selected email index
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

  // Navigation
  const handleNextEmail = useCallback(() => {
    if (emails.length === 0) return;
    if (selectedIndex === -1) {
      setSelectedEmail(emails[0]);
    } else if (selectedIndex < emails.length - 1) {
      setSelectedEmail(emails[selectedIndex + 1]);
    }
  }, [emails, selectedIndex]);

  const handlePrevEmail = useCallback(() => {
    if (emails.length === 0) return;
    if (selectedIndex === -1) {
      setSelectedEmail(emails[emails.length - 1]);
    } else if (selectedIndex > 0) {
      setSelectedEmail(emails[selectedIndex - 1]);
    }
  }, [emails, selectedIndex]);

  // Reply
  const handleReply = useCallback(() => {
    if (!selectedEmail) return;
    const originalBody = selectedEmail.body || selectedEmail.snippet || '';
    const replyBody = `\n\n─────────────────────────\nDatum: ${new Date(selectedEmail.date).toLocaleString('hu-HU')}\nFeladó: ${selectedEmail.fromName || selectedEmail.from || ''}\n\n${originalBody}`;

    navigate(
      `/compose?reply=true&to=${encodeURIComponent(selectedEmail.from || '')}&subject=${encodeURIComponent(`Re: ${selectedEmail.subject || ''}`)}${selectedEmail.threadId ? `&threadId=${selectedEmail.threadId}` : ''}&body=${encodeURIComponent(replyBody)}`,
    );
  }, [selectedEmail, navigate]);

  // Forward
  const handleForward = useCallback(() => {
    if (!selectedEmail) return;
    navigate(`/compose?subject=${encodeURIComponent(`Fwd: ${selectedEmail.subject || ''}`)}`);
  }, [selectedEmail, navigate]);

  // Toggle star
  const handleToggleStar = useCallback(() => {
    if (!selectedEmail) return;
    toggleStar.mutate({
      emailId: selectedEmail.id,
      isStarred: !selectedEmail.isStarred,
    });
    setSelectedEmail((prev) => (prev ? { ...prev, isStarred: !prev.isStarred } : null));
  }, [selectedEmail, toggleStar]);

  // Toggle read
  const handleToggleRead = useCallback(() => {
    if (!selectedEmail) return;
    markRead.mutate({
      emailId: selectedEmail.id,
      isRead: !selectedEmail.isRead,
    });
    setSelectedEmail((prev) => (prev ? { ...prev, isRead: !prev.isRead } : null));
  }, [selectedEmail, markRead]);

  // Delete
  const handleDelete = useCallback(() => {
    if (!selectedEmail) return;
    setShowDeleteConfirm(true);
  }, [selectedEmail]);

  // Ref for fresh emails list
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

  // Keyboard shortcuts
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
      } else if (showAccountFilter) {
        setShowAccountFilter(false);
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
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="dark:bg-dark-bg-tertiary dark:border-dark-border sticky top-0 z-10 flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2">
        <button
          onClick={toggleSelectionMode}
          className={cn(
            'rounded-lg p-2 transition-colors',
            selectionMode
              ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'
              : 'dark:hover:bg-dark-border dark:text-dark-text-secondary text-gray-600 hover:bg-gray-200',
          )}
          title={selectionMode ? 'Kijelölés befejezése' : 'Kijelölési mód'}
        >
          <CheckSquare className="h-5 w-5" />
        </button>

        {selectionMode ? (
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
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Inbox className="h-5 w-5 text-blue-500" />
              <h2 className="dark:text-dark-text-secondary text-sm font-medium text-gray-600">
                Minden levél{totalEmails ? ` (${totalEmails})` : ''}
              </h2>
            </div>

            <div className="flex-1" />

            {/* Account filter */}
            <div className="relative">
              <button
                onClick={() => setShowAccountFilter(!showAccountFilter)}
                className={cn(
                  'flex items-center gap-1 rounded-lg p-2 transition-colors',
                  filterAccountId
                    ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'
                    : 'dark:hover:bg-dark-border dark:text-dark-text-secondary text-gray-600 hover:bg-gray-200',
                )}
                title="Fiók szűrő"
              >
                <Filter className="h-5 w-5" />
                {filterAccountId && (
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor:
                        accounts.find((a) => a.accountId === filterAccountId)?.color || '#3B82F6',
                    }}
                  />
                )}
              </button>

              {showAccountFilter && (
                <div className="dark:bg-dark-bg-secondary dark:border-dark-border absolute top-full right-0 z-20 mt-1 min-w-[200px] rounded-lg border border-gray-200 bg-white shadow-lg">
                  <div className="dark:border-dark-border border-b border-gray-100 p-2">
                    <span className="dark:text-dark-text-muted text-xs tracking-wide text-gray-500 uppercase">
                      Szűrés fiók szerint
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setFilterAccountId(undefined);
                      setShowAccountFilter(false);
                    }}
                    className={cn(
                      'dark:hover:bg-dark-bg-tertiary flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50',
                      !filterAccountId &&
                        'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
                    )}
                  >
                    <Inbox className="h-4 w-4" />
                    <span>Minden fiók</span>
                  </button>

                  {accounts.map((account) => (
                    <button
                      key={account.accountId}
                      onClick={() => {
                        setFilterAccountId(account.accountId);
                        setShowAccountFilter(false);
                      }}
                      className={cn(
                        'dark:hover:bg-dark-bg-tertiary flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50',
                        filterAccountId === account.accountId &&
                          'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
                      )}
                    >
                      <span
                        className="h-3 w-3 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: account.color }}
                      />
                      <span className="flex-1 truncate">{account.email}</span>
                      <span className="dark:text-dark-text-muted text-xs text-gray-400">
                        {account.count}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Account stats bar */}
      {!selectionMode && accounts.length > 1 && (
        <div className="dark:bg-dark-bg/50 dark:border-dark-border flex items-center gap-1 border-b border-gray-100 bg-gray-100/50 px-4 py-1.5">
          {accounts.map((account) => (
            <button
              key={account.accountId}
              onClick={() =>
                setFilterAccountId(
                  filterAccountId === account.accountId ? undefined : account.accountId,
                )
              }
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs transition-colors',
                filterAccountId === account.accountId
                  ? 'dark:bg-dark-bg-secondary bg-white shadow-sm'
                  : 'dark:hover:bg-dark-bg-tertiary hover:bg-gray-200/50',
              )}
              title={`${account.email} (${account.count} levél)`}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: account.color }} />
              <span className="dark:text-dark-text-secondary max-w-[100px] truncate text-gray-600">
                {account.email.split('@')[0]}
              </span>
              <span className="dark:text-dark-text-muted text-gray-400">{account.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Email list */}
      <div ref={containerRef} className="flex-1 overflow-auto">
        <UnifiedEmailList
          emails={emails}
          isLoading={isLoading}
          selectedEmailId={selectedEmail?.id || null}
          onSelectEmail={setSelectedEmail}
          onDeleteEmail={(emailId) => {
            // BUG #3 Fix: Use emailsRef to get fresh data in onSuccess callback
            deleteEmail.mutate(emailId, {
              onSuccess: () => {
                if (selectedEmail?.id === emailId) {
                  const nextEmail = getNextEmailAfterDelete(emailsRef.current, emailId);
                  setSelectedEmail(nextEmail);
                }
              },
            });
          }}
          emptyMessage="Nincs beérkezett levél egyetlen fiókban sem."
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelectEmail}
        />
        {isFetchingNextPage && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            <span className="dark:text-dark-text-secondary ml-2 text-sm text-gray-500">
              További levelek betöltése...
            </span>
          </div>
        )}
      </div>
    </div>
  );

  const rightPanel = (
    <EmailDetail
      emailId={selectedEmail?.id || null}
      accountId={selectedEmail?.accountId}
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
        storageKey="unified-inbox-list-width"
      />

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="dark:bg-dark-bg-secondary dark:border-dark-border mx-4 max-w-sm rounded-lg bg-white p-6 shadow-xl dark:border">
            <h3 className="dark:text-dark-text mb-2 text-lg font-medium text-gray-900">
              Email törlése
            </h3>
            <p className="dark:text-dark-text-secondary mb-4 text-sm text-gray-500">
              Biztosan törölni szeretnéd ezt az emailt? Az email a kukába kerül.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="dark:border-dark-border dark:hover:bg-dark-bg-tertiary dark:text-dark-text rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
              >
                Mégse
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteEmail.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteEmail.isPending ? 'Törlés...' : 'Törlés'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch delete confirmation modal */}
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

      {/* Keyboard shortcuts help */}
      <KeyboardShortcutsHelp
        isOpen={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
      />
    </>
  );
}
