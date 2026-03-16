import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../hooks/useAccounts';
import { useDeleteEmail, useBatchDeleteEmails } from '../../hooks/useEmails';
import { api } from '../../lib/api';
import { EmailList } from '../email/EmailList';
import { EmailDetail } from '../email/EmailDetail';
import { ResizablePanels } from '../common/ResizablePanels';
import { Clock, ArrowLeft, Loader2, Calendar, CheckSquare, CheckCheck, Square, Trash2, X } from 'lucide-react';
import type { Email, TimePeriod } from '../../types';
import { getNextEmailAfterDelete } from '../../lib/emailNavigation';

export function ByTimeView() {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const deleteEmail = useDeleteEmail();
  const batchDeleteEmails = useBatchDeleteEmails();

  // Selection mode state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);

  const accountId = session?.activeAccountId || undefined;

  const { data: timeData, isLoading: loadingTime } = useQuery({
    queryKey: ['views', 'by-time', accountId],
    queryFn: () => api.views.byTime(),
    enabled: !!accountId,
  });

  const { data: periodEmails, isLoading: loadingEmails } = useQuery({
    queryKey: ['views', 'by-time-emails', selectedPeriod?.id],
    queryFn: () => api.views.byTimeEmails(selectedPeriod!.id),
    enabled: !!selectedPeriod,
  });

  const emails = useMemo(() => periodEmails?.emails ?? [], [periodEmails?.emails]);

  // Ref a friss emails lista eléréséhez (stale closure fix)
  const emailsRef = useRef(emails);
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

  const periodColors: Record<string, string> = {
    today: 'bg-green-50 dark:bg-green-500/20 text-green-600',
    yesterday: 'bg-blue-50 dark:bg-blue-500/20 text-blue-600',
    this_week: 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600',
    this_month: 'bg-purple-50 dark:bg-purple-500/20 text-purple-600',
    older: 'bg-gray-100 dark:bg-gray-500/20 text-gray-600 dark:text-gray-400',
  };

  if (!selectedPeriod) {
    return (
      <div className="h-full overflow-auto">
        <div className="dark:bg-dark-bg-tertiary dark:border-dark-border flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3">
          <Clock className="dark:text-dark-text-secondary h-5 w-5 text-gray-500" />
          <h2 className="dark:text-dark-text text-sm font-medium text-gray-600">Időszak szerint</h2>
        </div>

        {loadingTime ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="space-y-3 p-4">
            {(timeData?.periods || []).map((period) => (
              <div
                key={period.id}
                onClick={() => setSelectedPeriod(period)}
                className="dark:border-dark-border flex cursor-pointer items-center gap-4 rounded-xl border border-gray-200 p-4 transition-all hover:border-blue-300 hover:shadow-sm dark:hover:border-blue-500"
              >
                <div
                  className={`rounded-lg p-3 ${periodColors[period.id] || 'bg-gray-50 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400'}`}
                >
                  <Calendar className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <div className="dark:text-dark-text font-medium text-gray-900">{period.name}</div>
                </div>
                <div className="dark:text-dark-text text-lg font-semibold text-gray-800">
                  {period.count}
                  <span className="dark:text-dark-text-muted ml-1 text-sm font-normal text-gray-400">
                    levél
                  </span>
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
                setSelectedPeriod(null);
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
              {selectedPeriod.name}
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
          deleteEmail.mutate({ emailId }, {
            onSuccess: () => {
              if (selectedEmail?.id === emailId) {
                const nextEmail = getNextEmailAfterDelete(emailsRef.current, emailId);
                setSelectedEmail(nextEmail);
              }
            },
          });
        }}
        emptyMessage="Nincsenek levelek ebben az időszakban"
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
        storageKey="time-list-width"
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
