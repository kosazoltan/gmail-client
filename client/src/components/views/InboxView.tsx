import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSession } from '../../hooks/useAccounts';
import { useInboxInfinite } from '../../hooks/useInbox';
import {
  useToggleStar,
  useMarkRead,
  useDeleteEmail,
  useBatchDeleteEmails,
  useBatchMarkRead,
} from '../../hooks/useEmails';
import { useKeyboardShortcuts, useSearchFocus } from '../../hooks/useKeyboardShortcuts';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { ThreadedEmailList } from '../email/ThreadedEmailList';
import { EmailList } from '../email/EmailList';
import { BulkActionBar } from '../email/BulkActionBar';
import { EmailDetail } from '../email/EmailDetail';
import { KeyboardShortcutsHelp } from '../common/KeyboardShortcutsHelp';
import { ResizablePanels } from '../common/ResizablePanels';
import { LoginScreen } from '../auth/LoginScreen';
import { CheckSquare, X, Trash2, Square, CheckCheck, Loader2, MailOpen, Mail } from 'lucide-react';
import type { Email } from '../../types';
import { getNextEmailAfterDelete } from '../../lib/emailNavigation';
import { api } from '../../lib/api';
import { useSettings, defaultSettings } from '../../hooks/useSettings';

export function InboxView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Selection mode state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);

  const emailIdFromQuery = searchParams.get('emailId');
  const accountIdFromQuery = searchParams.get('accountId') || undefined;
  const accountId = accountIdFromQuery || session?.activeAccountId || undefined;
  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useInboxInfinite({
    accountId,
  });
  const { data: settings } = useSettings();
  const conversationView = settings?.conversationView ?? defaultSettings.conversationView ?? true;

  const { containerRef } = useInfiniteScroll({
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });
  const toggleStar = useToggleStar();
  const markRead = useMarkRead();
  const deleteEmail = useDeleteEmail();
  const batchDeleteEmails = useBatchDeleteEmails();
  const batchMarkRead = useBatchMarkRead();
  const focusSearch = useSearchFocus();

  const emails = useMemo(() => data?.pages?.flatMap((page) => page.emails) || [], [data?.pages]);
  const totalEmails = data?.pages?.[0]?.total || 0;

  // Kiválasztott email indexe
  const selectedIndex = useMemo(() => {
    if (!selectedEmail) return -1;
    return emails.findIndex((e) => e.id === selectedEmail.id);
  }, [emails, selectedEmail]);

  const lastClickedIndexRef = useRef<number>(-1);
  const lastDirectFetchRef = useRef<string | null>(null);
  const directFetchDoneRef = useRef<Set<string>>(new Set());

  // Selection mode handlers
  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => {
      if (prev) {
        setSelectedIds(new Set());
      }
      return !prev;
    });
  }, []);

  const toggleSelectEmail = useCallback(
    (emailId: string, event?: React.MouseEvent) => {
      const emailIndex = emails.findIndex((e) => e.id === emailId);

      if (event?.shiftKey && lastClickedIndexRef.current >= 0 && emailIndex >= 0) {
        // Shift+click: select range
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
      if (selectedIds.size === 0) return;
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
    [selectedIds, batchMarkRead, accountId],
  );

  const handleBatchDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    setShowBatchDeleteConfirm(true);
  }, [selectedIds]);

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

  const withSelectionRefresh = useCallback(
    async (fn: () => Promise<void>) => {
      await fn();
      setSelectedIds(new Set());
      setSelectionMode(false);
      await queryClient.invalidateQueries({ queryKey: ['emails'] });
    },
    [queryClient],
  );

  const handleBulkArchive = useCallback(async () => {
    if (!accountId || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    await withSelectionRefresh(async () => {
      await Promise.all(ids.map((id) => api.labels.moveEmail(id, ['ARCHIVE'], ['INBOX'])));
    });
  }, [accountId, selectedIds, withSelectionRefresh]);

  const handleBulkStar = useCallback(async () => {
    if (!accountId || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    await withSelectionRefresh(async () => {
      await Promise.all(ids.map((id) => api.emails.toggleStar(id, true, accountId)));
    });
  }, [accountId, selectedIds, withSelectionRefresh]);

  const handleBulkLabel = useCallback(async () => {
    if (!accountId || selectedIds.size === 0) return;
    const label = window.prompt('Label ID vagy név');
    if (!label) return;
    const ids = Array.from(selectedIds);
    await withSelectionRefresh(async () => {
      await Promise.all(ids.map((id) => api.labels.addToEmail(id, [label])));
    });
  }, [accountId, selectedIds, withSelectionRefresh]);

  const handleBulkSpam = useCallback(async () => {
    if (!accountId || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    await withSelectionRefresh(async () => {
      await Promise.all(ids.map((id) => api.labels.moveEmail(id, ['SPAM'], ['INBOX'])));
    });
  }, [accountId, selectedIds, withSelectionRefresh]);

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
    navigate(`/compose?subject=${encodeURIComponent(`Fwd: ${selectedEmail.subject || ''}`)}`);
  }, [selectedEmail, navigate]);

  // Csillagozás toggle
  const handleToggleStar = useCallback(() => {
    if (!selectedEmail) return;
    toggleStar.mutate({
      emailId: selectedEmail.id,
      isStarred: !selectedEmail.isStarred,
      accountId,
    });
    // Frissítsük a helyi állapotot is
    setSelectedEmail((prev) => (prev ? { ...prev, isStarred: !prev.isStarred } : null));
  }, [selectedEmail, toggleStar, accountId]);

  // Olvasott/olvasatlan toggle
  const handleToggleRead = useCallback(() => {
    if (!selectedEmail) return;
    markRead.mutate({
      emailId: selectedEmail.id,
      isRead: !selectedEmail.isRead,
      accountId,
    });
    setSelectedEmail((prev) => (prev ? { ...prev, isRead: !prev.isRead } : null));
  }, [selectedEmail, markRead, accountId]);

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

  useEffect(() => {
    if (!emailIdFromQuery) return;

    const match = emails.find((email) => email.id === emailIdFromQuery);
    if (match) {
      queueMicrotask(() => {
        setSelectedEmail((prev) => (prev?.id === match.id ? prev : match));
      });
      return;
    }

    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [emailIdFromQuery, emails, hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    if (!emailIdFromQuery || !accountId) return;

    const match = emails.find((email) => email.id === emailIdFromQuery);
    // Egy email ID-t csak egyszer kérünk le közvetlenül: enélkül minden
    // emails-cache frissítésnél (pl. olvasottnak jelölés) újra lefutna a fetch.
    if (
      match ||
      lastDirectFetchRef.current === emailIdFromQuery ||
      directFetchDoneRef.current.has(emailIdFromQuery)
    ) {
      return;
    }

    let cancelled = false;
    lastDirectFetchRef.current = emailIdFromQuery;

    void api.emails
      .get(emailIdFromQuery, accountId)
      .then((email) => {
        directFetchDoneRef.current.add(emailIdFromQuery);
        if (!cancelled) {
          setSelectedEmail(email);
        }
      })
      .catch(() => {
        // Hibánál is megjelöljük: a pagination fallback (testvér effect) folytatja,
        // és nem akarunk végtelen újrapróbálkozást ugyanarra az ID-ra.
        directFetchDoneRef.current.add(emailIdFromQuery);
      })
      .finally(() => {
        if (lastDirectFetchRef.current === emailIdFromQuery) {
          lastDirectFetchRef.current = null;
        }
      });

    return () => {
      cancelled = true;
    };
  }, [emailIdFromQuery, accountId, emails]);

  const confirmDelete = useCallback(() => {
    if (!selectedEmail) return;
    const emailIdToDelete = selectedEmail.id;

    deleteEmail.mutate(
      { emailId: emailIdToDelete, accountId },
      {
        onSuccess: () => {
          const nextEmail = getNextEmailAfterDelete(emailsRef.current, emailIdToDelete);
          setSelectedEmail(nextEmail);
          setShowDeleteConfirm(false);
        },
      },
    );
  }, [selectedEmail, deleteEmail, accountId]);

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
    <div className="flex h-full flex-col">
      <BulkActionBar
        selectedIds={Array.from(selectedIds)}
        onArchive={() => void handleBulkArchive()}
        onDelete={handleBatchDelete}
        onMarkRead={() => handleBatchMarkRead(true)}
        onMarkUnread={() => handleBatchMarkRead(false)}
        onStar={() => void handleBulkStar()}
        onLabel={() => void handleBulkLabel()}
        onSpam={() => void handleBulkSpam()}
        onClearSelection={deselectAllEmails}
        onSelectAll={selectAllEmails}
        totalCount={emails.length}
      />
      {/* Selection toolbar - sticky */}
      <div className="dark:bg-dark-bg-tertiary dark:border-dark-border sticky top-0 z-10 flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2">
        <button
          onClick={toggleSelectionMode}
          className={`rounded-lg p-2 transition-colors ${
            selectionMode
              ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'
              : 'dark:hover:bg-dark-border dark:text-dark-text-secondary text-gray-600 hover:bg-gray-200'
          }`}
          title={selectionMode ? 'Kijelölés befejezése' : 'Kijelölési mód'}
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
          <h2 className="dark:text-dark-text-secondary text-sm font-medium text-gray-600">
            Beérkezett levelek{totalEmails ? ` (${totalEmails})` : ''}
          </h2>
        )}
      </div>

      <div ref={containerRef} className="flex-1 overflow-auto">
        {conversationView ? (
          <ThreadedEmailList
            emails={emails}
            isLoading={isLoading}
            selectedEmailId={selectedEmail?.id || null}
            onSelectEmail={setSelectedEmail}
            onDeleteEmail={(emailId) => {
              const emailIndex = emails.findIndex((e) => e.id === emailId);
              deleteEmail.mutate(
                { emailId, accountId },
                {
                  onSuccess: () => {
                    if (selectedEmail?.id === emailId) {
                      if (emailIndex < 0 || emails.length <= 1) {
                        setSelectedEmail(null);
                      } else if (emailIndex < emails.length - 1) {
                        setSelectedEmail(emails[emailIndex + 1]);
                      } else {
                        setSelectedEmail(emails[emailIndex - 1]);
                      }
                    }
                  },
                },
              );
            }}
            emptyMessage="Nincs beérkezett levél. Szinkronizálj a frissítéshez!"
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelectEmail}
          />
        ) : (
          <EmailList
            emails={emails}
            isLoading={isLoading}
            selectedEmailId={selectedEmail?.id || null}
            onSelectEmail={setSelectedEmail}
            onDeleteEmail={(emailId) => {
              const emailIndex = emails.findIndex((e) => e.id === emailId);
              deleteEmail.mutate(
                { emailId, accountId },
                {
                  onSuccess: () => {
                    if (selectedEmail?.id === emailId) {
                      if (emailIndex < 0 || emails.length <= 1) {
                        setSelectedEmail(null);
                      } else if (emailIndex < emails.length - 1) {
                        setSelectedEmail(emails[emailIndex + 1]);
                      } else {
                        setSelectedEmail(emails[emailIndex - 1]);
                      }
                    }
                  },
                },
              );
            }}
            emptyMessage="Nincs beérkezett levél. Szinkronizálj a frissítéshez!"
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelectEmail}
          />
        )}
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

      {/* Billentyűparancsok súgó */}
      <KeyboardShortcutsHelp
        isOpen={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
      />
    </>
  );
}
