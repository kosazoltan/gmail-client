import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../hooks/useAccounts';
import { useDeleteEmail, useBatchDeleteEmails } from '../../hooks/useEmails';
import { api } from '../../lib/api';
import { EmailList } from '../email/EmailList';
import { EmailDetail } from '../email/EmailDetail';
import { ResizablePanels } from '../common/ResizablePanels';
import { MessageSquare, ArrowLeft, Loader2, CheckSquare, CheckCheck, Square, Trash2, X } from 'lucide-react';
import type { Email, Topic } from '../../types';

export function ByTopicView() {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const deleteEmail = useDeleteEmail();
  const batchDeleteEmails = useBatchDeleteEmails();

  // Selection mode state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);

  const accountId = session?.activeAccountId || undefined;

  const { data: topicsData, isLoading: loadingTopics } = useQuery({
    queryKey: ['views', 'by-topic', accountId],
    queryFn: () => api.views.byTopic(),
    enabled: !!accountId,
  });

  const { data: topicEmails, isLoading: loadingEmails } = useQuery({
    queryKey: ['views', 'by-topic-emails', selectedTopic?.id],
    queryFn: () => api.views.byTopicEmails(selectedTopic!.id),
    enabled: !!selectedTopic,
  });

  const emailsRef = useRef<Email[]>([]);
  const emails = useMemo(() => topicEmails?.emails ?? [], [topicEmails?.emails]);
  useEffect(() => {
    emailsRef.current = emails;
  }, [emails]);

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => {
      if (prev) setSelectedIds(new Set());
      return !prev;
    });
  }, []);

  const toggleSelectEmail = useCallback((emailId: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(emailId)) newSet.delete(emailId);
      else newSet.add(emailId);
      return newSet;
    });
  }, []);

  const selectAllEmails = useCallback(() => {
    setSelectedIds(new Set(emailsRef.current.map((e) => e.id)));
  }, []);

  const deselectAllEmails = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const confirmBatchDelete = useCallback(() => {
    const idsToDelete = Array.from(selectedIds);
    batchDeleteEmails.mutate({ emailIds: idsToDelete, accountId }, {
      onSuccess: () => {
        setShowBatchDeleteConfirm(false);
        setSelectedIds(new Set());
        setSelectionMode(false);
        if (selectedEmail && selectedIds.has(selectedEmail.id)) {
          setSelectedEmail(null);
        }
      },
    });
  }, [selectedIds, batchDeleteEmails, selectedEmail, accountId]);

  if (!selectedTopic) {
    return (
      <div className="h-full overflow-auto">
        <div className="dark:bg-dark-bg-tertiary dark:border-dark-border flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3">
          <MessageSquare className="dark:text-dark-text-secondary h-5 w-5 text-gray-500" />
          <h2 className="dark:text-dark-text text-sm font-medium text-gray-600">Téma szerint</h2>
        </div>

        {loadingTopics ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="dark:divide-dark-border divide-y divide-gray-100">
            {(topicsData?.topics || []).map((topic) => (
              <div
                key={topic.id}
                onClick={() => setSelectedTopic(topic)}
                className="dark:hover:bg-dark-bg-tertiary flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-500/20">
                  <MessageSquare className="h-5 w-5 text-purple-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="dark:text-dark-text truncate text-sm font-medium text-gray-900">
                    {topic.name}
                  </div>
                </div>
                <div className="flex-shrink-0 text-sm font-medium text-purple-600">
                  {topic.messageCount} levél
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const leftPanel = (
    <>
      <div className="dark:bg-dark-bg-tertiary dark:border-dark-border sticky top-0 z-10 flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2">
        {!selectionMode && (
          <>
            <button
              onClick={() => {
                setSelectedTopic(null);
                setSelectedEmail(null);
                setSelectionMode(false);
                setSelectedIds(new Set());
              }}
              className="dark:hover:bg-dark-bg touch-manipulation rounded-lg p-2.5 hover:bg-gray-200"
              aria-label="Vissza"
            >
              <ArrowLeft className="dark:text-dark-text-secondary h-5 w-5 text-gray-500" />
            </button>
            <span className="dark:text-dark-text flex-1 text-sm font-medium text-gray-600">
              {selectedTopic.name}
            </span>
          </>
        )}
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
                  onClick={() => setShowBatchDeleteConfirm(true)}
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
        )}
      </div>
      <EmailList
        emails={emails}
        isLoading={loadingEmails}
        selectedEmailId={selectedEmail?.id || null}
        onSelectEmail={setSelectedEmail}
        onDeleteEmail={(emailId) => {
          const emailIndex = emails.findIndex((e) => e.id === emailId);
          deleteEmail.mutate({ emailId }, {
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
            },
          });
        }}
        emptyMessage="Nincsenek levelek ebben a témában"
        selectionMode={selectionMode}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelectEmail}
      />
    </>
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
    <>
      <ResizablePanels
        leftPanel={leftPanel}
        rightPanel={rightPanel}
        rightPanelActive={!!selectedEmail && !selectionMode}
        storageKey="topic-list-width"
      />

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
