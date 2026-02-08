import { useState, useMemo } from 'react';
import {
  useNewsletterSenders,
  useNewsletterEmailsInfinite,
  useSyncNewsletters,
  useMuteNewsletterSender,
  useRemoveNewsletterSender,
} from '../../hooks/useNewsletters';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import type { NewsletterSender } from '../../types';
import {
  Newspaper,
  RefreshCw,
  Loader2,
  Mail,
  VolumeX,
  Volume2,
  Trash2,
  ChevronRight,
  X,
} from 'lucide-react';
import { formatEmailDate, displaySender } from '../../lib/utils';

interface NewslettersViewProps {
  onEmailSelect: (emailId: string) => void;
}

export function NewslettersView({ onEmailSelect }: NewslettersViewProps) {
  const [selectedSenderId, setSelectedSenderId] = useState<string | null>(null);
  const [includeMuted, setIncludeMuted] = useState(false);
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);

  const { data: sendersData, isLoading: sendersLoading } = useNewsletterSenders();
  const {
    data: emailsData,
    isLoading: emailsLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useNewsletterEmailsInfinite({
    senderId: selectedSenderId || undefined,
    includeMuted,
  });
  const syncNewsletters = useSyncNewsletters();
  const muteSender = useMuteNewsletterSender();
  const removeSender = useRemoveNewsletterSender();

  const { containerRef } = useInfiniteScroll({
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });

  const senders = sendersData?.senders || [];
  const emails = useMemo(
    () => emailsData?.pages?.flatMap((page) => page.emails) || [],
    [emailsData?.pages],
  );
  const totalEmails = emailsData?.pages?.[0]?.total || 0;

  const handleSync = () => {
    syncNewsletters.mutate();
  };

  const handleMute = (sender: NewsletterSender) => {
    muteSender.mutate({ id: sender.id, muted: !sender.isMuted });
  };

  const handleRemove = (id: string) => {
    removeSender.mutate(id, {
      onSuccess: () => {
        setRemoveConfirmId(null);
        if (selectedSenderId === id) {
          setSelectedSenderId(null);
        }
      },
    });
  };

  const selectedSender = selectedSenderId ? senders.find((s) => s.id === selectedSenderId) : null;

  return (
    <div className="flex h-full">
      {/* Oldalsáv - Küldők listája */}
      <div className="dark:border-dark-border dark:bg-dark-bg-tertiary flex w-72 flex-col border-r border-gray-200 bg-gray-50">
        <div className="dark:border-dark-border border-b border-gray-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Newspaper className="h-5 w-5 text-blue-500" />
              <h2 className="dark:text-dark-text font-semibold text-gray-900">Hírlevelek</h2>
            </div>
            <button
              onClick={handleSync}
              disabled={syncNewsletters.isPending}
              className="dark:hover:bg-dark-bg dark:text-dark-text-secondary rounded p-1.5 text-gray-500 hover:bg-gray-200 disabled:opacity-50"
              title="Hírlevél küldők frissítése"
            >
              <RefreshCw className={`h-4 w-4 ${syncNewsletters.isPending ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <label className="dark:text-dark-text-muted flex items-center gap-2 text-xs text-gray-500">
            <input
              type="checkbox"
              checked={includeMuted}
              onChange={(e) => setIncludeMuted(e.target.checked)}
              className="dark:border-dark-border rounded border-gray-300 text-blue-600"
            />
            Némított küldők mutatása
          </label>
        </div>

        {sendersLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          </div>
        ) : senders.length === 0 ? (
          <div className="dark:text-dark-text-muted p-4 text-center text-gray-400">
            <Newspaper className="mx-auto mb-2 h-10 w-10 opacity-50" />
            <p className="text-sm">Nincs detektált hírlevél</p>
            <button
              onClick={handleSync}
              disabled={syncNewsletters.isPending}
              className="mt-2 text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              Detektálás indítása
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            {/* Mind megjelenítése */}
            <button
              onClick={() => {
                setSelectedSenderId(null);
              }}
              className={`dark:border-dark-border flex w-full items-center justify-between border-b border-gray-200 px-4 py-3 text-left ${
                !selectedSenderId
                  ? 'bg-blue-50 dark:bg-blue-500/10'
                  : 'dark:hover:bg-dark-bg hover:bg-gray-100'
              }`}
            >
              <div>
                <div className="dark:text-dark-text text-sm font-medium text-gray-900">
                  Összes hírlevél
                </div>
                <div className="dark:text-dark-text-muted text-xs text-gray-500">
                  {senders.length} küldő
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </button>

            {/* Küldők listája */}
            {senders
              .filter((s) => includeMuted || !s.isMuted)
              .map((sender) => (
                <div key={sender.id} className="group relative">
                  <button
                    onClick={() => {
                      setSelectedSenderId(sender.id);
                    }}
                    className={`dark:border-dark-border flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left ${
                      selectedSenderId === sender.id
                        ? 'bg-blue-50 dark:bg-blue-500/10'
                        : 'dark:hover:bg-dark-bg hover:bg-gray-100'
                    } ${sender.isMuted ? 'opacity-50' : ''}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="dark:text-dark-text truncate text-sm font-medium text-gray-900">
                        {sender.name || sender.email.split('@')[0]}
                      </div>
                      <div className="dark:text-dark-text-muted truncate text-xs text-gray-500">
                        {sender.email}
                      </div>
                      <div className="dark:text-dark-text-muted mt-0.5 text-xs text-gray-400">
                        {sender.emailCount} levél
                        {sender.isMuted && (
                          <span className="ml-2 text-orange-500">
                            <VolumeX className="inline h-3 w-3" /> Némítva
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Akció gombok */}
                  <div className="absolute top-1/2 right-2 flex -translate-y-1/2 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMute(sender);
                      }}
                      className={`rounded p-1.5 ${
                        sender.isMuted
                          ? 'bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400'
                          : 'dark:bg-dark-bg bg-gray-100 text-gray-500 hover:bg-orange-100 hover:text-orange-600 dark:hover:bg-orange-500/20'
                      }`}
                      title={sender.isMuted ? 'Némítás feloldása' : 'Némítás'}
                    >
                      {sender.isMuted ? (
                        <Volume2 className="h-3.5 w-3.5" />
                      ) : (
                        <VolumeX className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRemoveConfirmId(sender.id);
                      }}
                      className="dark:bg-dark-bg rounded bg-gray-100 p-1.5 text-gray-500 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-500/20"
                      title="Eltávolítás a hírlevelek közül"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Eltávolítás megerősítés */}
                  {removeConfirmId === sender.id && (
                    <div className="dark:bg-dark-bg-secondary dark:border-dark-border absolute top-full right-0 left-0 z-10 mx-2 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
                      <p className="dark:text-dark-text-secondary mb-2 text-xs text-gray-600">
                        Eltávolítod a hírlevelek közül?
                      </p>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleRemove(sender.id)}
                          className="flex-1 rounded bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600"
                        >
                          Igen
                        </button>
                        <button
                          onClick={() => setRemoveConfirmId(null)}
                          className="dark:bg-dark-bg-tertiary dark:text-dark-text flex-1 rounded bg-gray-100 px-2 py-1 text-xs text-gray-700"
                        >
                          Nem
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Fő tartalom - Emailek listája */}
      <div className="flex flex-1 flex-col">
        {/* Fejléc */}
        <div className="dark:border-dark-border border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {selectedSender && (
                <button
                  onClick={() => setSelectedSenderId(null)}
                  className="dark:hover:bg-dark-bg-tertiary rounded p-1 text-gray-500 hover:bg-gray-100"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <h1 className="dark:text-dark-text text-lg font-medium text-gray-900">
                {selectedSender ? selectedSender.name || selectedSender.email : 'Összes hírlevél'}
              </h1>
            </div>
            {totalEmails > 0 && (
              <span className="dark:text-dark-text-muted text-sm text-gray-500">
                {totalEmails} levél
              </span>
            )}
          </div>
        </div>

        {/* Email lista */}
        <div ref={containerRef} className="flex-1 overflow-auto">
          {emailsLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          ) : emails.length === 0 ? (
            <div className="dark:text-dark-text-muted flex h-64 items-center justify-center text-gray-400">
              <div className="text-center">
                <Mail className="mx-auto mb-2 h-12 w-12 opacity-50" />
                <p>Nincsenek hírlevél emailek</p>
              </div>
            </div>
          ) : (
            <>
              <div className="dark:divide-dark-border divide-y divide-gray-100">
                {emails.map((email) => (
                  <button
                    key={email.id}
                    onClick={() => onEmailSelect(email.id)}
                    className={`dark:hover:bg-dark-bg-tertiary w-full px-6 py-4 text-left transition-colors hover:bg-gray-50 ${
                      !email.isRead ? 'bg-blue-50/50 dark:bg-blue-500/5' : ''
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <span
                            className={`text-sm ${
                              !email.isRead
                                ? 'dark:text-dark-text font-semibold text-gray-900'
                                : 'dark:text-dark-text-secondary text-gray-700'
                            }`}
                          >
                            {displaySender(email.fromName, email.from)}
                          </span>
                          {email.newsletter_name && !selectedSenderId && (
                            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                              {email.newsletter_name}
                            </span>
                          )}
                        </div>
                        <div
                          className={`truncate text-sm ${
                            !email.isRead
                              ? 'dark:text-dark-text text-gray-900'
                              : 'dark:text-dark-text-secondary text-gray-600'
                          }`}
                        >
                          {email.subject || '(Nincs tárgy)'}
                        </div>
                        <div className="dark:text-dark-text-muted mt-1 truncate text-xs text-gray-400">
                          {email.snippet}
                        </div>
                      </div>
                      <div className="dark:text-dark-text-muted text-xs whitespace-nowrap text-gray-400">
                        {formatEmailDate(email.date)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Loading indicator */}
              {isFetchingNextPage && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                  <span className="dark:text-dark-text-secondary ml-2 text-sm text-gray-500">
                    További levelek betöltése...
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
