import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../hooks/useAccounts';
import { useEmails, useToggleStar, useMarkRead, useDeleteEmail } from '../../hooks/useEmails';
import { useKeyboardShortcuts, useSearchFocus } from '../../hooks/useKeyboardShortcuts';
import { EmailList } from '../email/EmailList';
import { EmailDetail } from '../email/EmailDetail';
import { KeyboardShortcutsHelp } from '../common/KeyboardShortcutsHelp';
import { LoginScreen } from '../auth/LoginScreen';
import type { Email } from '../../types';
import { getNextEmailAfterDelete } from '../../lib/emailNavigation';

export function InboxView() {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [page, setPage] = useState(1);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const accountId = session?.activeAccountId || undefined;
  const { data, isLoading } = useEmails({ accountId, page, limit: 50 });
  const toggleStar = useToggleStar();
  const markRead = useMarkRead();
  const deleteEmail = useDeleteEmail();
  const focusSearch = useSearchFocus();

  const emails = useMemo(() => data?.emails || [], [data?.emails]);

  // Kiválasztott email indexe
  const selectedIndex = useMemo(() => {
    if (!selectedEmail) return -1;
    return emails.findIndex((e) => e.id === selectedEmail.id);
  }, [emails, selectedEmail]);

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
      if (showDeleteConfirm) {
        setShowDeleteConfirm(false);
      } else if (showShortcutsHelp) {
        setShowShortcutsHelp(false);
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

  return (
    <>
      <div className="flex h-full relative">
        {/* Email lista - rejtett ha van kiválasztott email kis képernyőn */}
        <div className={`
          w-full lg:w-2/5 xl:w-1/3 border-r border-gray-200 dark:border-dark-border overflow-auto
          ${selectedEmail ? 'hidden lg:block' : 'block'}
        `}>
          <EmailList
            emails={emails}
            isLoading={isLoading}
            selectedEmailId={selectedEmail?.id || null}
            onSelectEmail={setSelectedEmail}
            onDeleteEmail={(emailId) => {
              // Ha a kiválasztott emailt töröljük, válasszuk ki a következőt
              const emailIndex = emails.findIndex(e => e.id === emailId);
              deleteEmail.mutate(emailId, {
                onSuccess: () => {
                  if (selectedEmail?.id === emailId) {
                    if (emails.length > 1) {
                      if (emailIndex < emails.length - 1) {
                        setSelectedEmail(emails[emailIndex + 1]);
                      } else {
                        setSelectedEmail(emails[emailIndex - 1]);
                      }
                    } else {
                      setSelectedEmail(null);
                    }
                  }
                }
              });
            }}
            title={`Beérkezett levelek${data?.total ? ` (${data.total})` : ''}`}
            emptyMessage="Nincs beérkezett levél. Szinkronizálj a frissítéshez!"
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

        {/* Email részletek - full screen kis képernyőn, jobb oldal nagy képernyőn */}
        <div className={`
          flex-1
          ${selectedEmail ? 'block absolute inset-0 lg:relative lg:inset-auto bg-white dark:bg-dark-bg z-10' : 'hidden lg:block'}
        `}>
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

      {/* Billentyűparancsok súgó */}
      <KeyboardShortcutsHelp
        isOpen={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
      />
    </>
  );
}
