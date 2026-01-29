import { useState } from 'react';
import {
  useNewsletterSenders,
  useNewsletterEmails,
  useSyncNewsletters,
  useMuteNewsletterSender,
  useRemoveNewsletterSender,
} from '../../hooks/useNewsletters';
import type { NewsletterSender, Email } from '../../types';
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
import { formatEmailDate, formatRelativeTime, displaySender } from '../../lib/utils';

interface NewslettersViewProps {
  onEmailSelect: (emailId: string) => void;
}

export function NewslettersView({ onEmailSelect }: NewslettersViewProps) {
  const [selectedSenderId, setSelectedSenderId] = useState<string | null>(null);
  const [includeMuted, setIncludeMuted] = useState(false);
  const [page, setPage] = useState(1);
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);

  const { data: sendersData, isLoading: sendersLoading } = useNewsletterSenders();
  const { data: emailsData, isLoading: emailsLoading } = useNewsletterEmails({
    page,
    senderId: selectedSenderId || undefined,
    includeMuted,
  });
  const syncNewsletters = useSyncNewsletters();
  const muteSender = useMuteNewsletterSender();
  const removeSender = useRemoveNewsletterSender();

  const senders = sendersData?.senders || [];
  const emails = emailsData?.emails || [];
  const totalPages = emailsData?.totalPages || 1;

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

  const selectedSender = selectedSenderId
    ? senders.find((s) => s.id === selectedSenderId)
    : null;

  return (
    <div className="flex h-full">
      {/* Oldalsáv - Küldők listája */}
      <div className="w-72 border-r border-gray-200 dark:border-dark-border flex flex-col bg-gray-50 dark:bg-dark-bg-tertiary">
        <div className="p-4 border-b border-gray-200 dark:border-dark-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Newspaper className="h-5 w-5 text-blue-500" />
              <h2 className="font-semibold text-gray-900 dark:text-dark-text">
                Hírlevelek
              </h2>
            </div>
            <button
              onClick={handleSync}
              disabled={syncNewsletters.isPending}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-dark-bg text-gray-500 dark:text-dark-text-secondary disabled:opacity-50"
              title="Hírlevél küldők frissítése"
            >
              <RefreshCw
                className={`h-4 w-4 ${syncNewsletters.isPending ? 'animate-spin' : ''}`}
              />
            </button>
          </div>

          <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-dark-text-muted">
            <input
              type="checkbox"
              checked={includeMuted}
              onChange={(e) => setIncludeMuted(e.target.checked)}
              className="rounded border-gray-300 dark:border-dark-border text-blue-600"
            />
            Némított küldők mutatása
          </label>
        </div>

        {sendersLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          </div>
        ) : senders.length === 0 ? (
          <div className="p-4 text-center text-gray-400 dark:text-dark-text-muted">
            <Newspaper className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nincs detektált hírlevél</p>
            <button
              onClick={handleSync}
              disabled={syncNewsletters.isPending}
              className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
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
                setPage(1);
              }}
              className={`w-full px-4 py-3 text-left flex items-center justify-between border-b border-gray-200 dark:border-dark-border ${
                !selectedSenderId
                  ? 'bg-blue-50 dark:bg-blue-500/10'
                  : 'hover:bg-gray-100 dark:hover:bg-dark-bg'
              }`}
            >
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-dark-text">
                  Összes hírlevél
                </div>
                <div className="text-xs text-gray-500 dark:text-dark-text-muted">
                  {senders.length} küldő
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </button>

            {/* Küldők listája */}
            {senders
              .filter((s) => includeMuted || !s.isMuted)
              .map((sender) => (
                <div key={sender.id} className="relative group">
                  <button
                    onClick={() => {
                      setSelectedSenderId(sender.id);
                      setPage(1);
                    }}
                    className={`w-full px-4 py-3 text-left flex items-center gap-3 border-b border-gray-100 dark:border-dark-border ${
                      selectedSenderId === sender.id
                        ? 'bg-blue-50 dark:bg-blue-500/10'
                        : 'hover:bg-gray-100 dark:hover:bg-dark-bg'
                    } ${sender.isMuted ? 'opacity-50' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-dark-text truncate">
                        {sender.name || sender.email.split('@')[0]}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-dark-text-muted truncate">
                        {sender.email}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-dark-text-muted mt-0.5">
                        {sender.emailCount} levél
                        {sender.isMuted && (
                          <span className="ml-2 text-orange-500">
                            <VolumeX className="h-3 w-3 inline" /> Némítva
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Akció gombok */}
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMute(sender);
                      }}
                      className={`p-1.5 rounded ${
                        sender.isMuted
                          ? 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400'
                          : 'bg-gray-100 dark:bg-dark-bg hover:bg-orange-100 dark:hover:bg-orange-500/20 text-gray-500 hover:text-orange-600'
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
                      className="p-1.5 rounded bg-gray-100 dark:bg-dark-bg hover:bg-red-100 dark:hover:bg-red-500/20 text-gray-500 hover:text-red-600"
                      title="Eltávolítás a hírlevelek közül"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Eltávolítás megerősítés */}
                  {removeConfirmId === sender.id && (
                    <div className="absolute left-0 right-0 top-full z-10 p-2 bg-white dark:bg-dark-bg-secondary border border-gray-200 dark:border-dark-border rounded-lg shadow-lg mx-2">
                      <p className="text-xs text-gray-600 dark:text-dark-text-secondary mb-2">
                        Eltávolítod a hírlevelek közül?
                      </p>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleRemove(sender.id)}
                          className="flex-1 px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                        >
                          Igen
                        </button>
                        <button
                          onClick={() => setRemoveConfirmId(null)}
                          className="flex-1 px-2 py-1 text-xs bg-gray-100 dark:bg-dark-bg-tertiary text-gray-700 dark:text-dark-text rounded"
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
      <div className="flex-1 flex flex-col">
        {/* Fejléc */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {selectedSender && (
                <button
                  onClick={() => setSelectedSenderId(null)}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary text-gray-500"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <h1 className="text-lg font-medium text-gray-900 dark:text-dark-text">
                {selectedSender
                  ? selectedSender.name || selectedSender.email
                  : 'Összes hírlevél'}
              </h1>
            </div>
            {emailsData && (
              <span className="text-sm text-gray-500 dark:text-dark-text-muted">
                {emailsData.total} levél
              </span>
            )}
          </div>
        </div>

        {/* Email lista */}
        <div className="flex-1 overflow-auto">
          {emailsLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          ) : emails.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-gray-400 dark:text-dark-text-muted">
              <div className="text-center">
                <Mail className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nincsenek hírlevél emailek</p>
              </div>
            </div>
          ) : (
            <>
              <div className="divide-y divide-gray-100 dark:divide-dark-border">
                {emails.map((email) => (
                  <button
                    key={email.id}
                    onClick={() => onEmailSelect(email.id)}
                    className={`w-full px-6 py-4 text-left hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary transition-colors ${
                      !email.isRead ? 'bg-blue-50/50 dark:bg-blue-500/5' : ''
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`text-sm ${
                              !email.isRead
                                ? 'font-semibold text-gray-900 dark:text-dark-text'
                                : 'text-gray-700 dark:text-dark-text-secondary'
                            }`}
                          >
                            {displaySender(email.fromName, email.from)}
                          </span>
                          {email.newsletter_name && !selectedSenderId && (
                            <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded">
                              {email.newsletter_name}
                            </span>
                          )}
                        </div>
                        <div
                          className={`text-sm truncate ${
                            !email.isRead
                              ? 'text-gray-900 dark:text-dark-text'
                              : 'text-gray-600 dark:text-dark-text-secondary'
                          }`}
                        >
                          {email.subject || '(Nincs tárgy)'}
                        </div>
                        <div className="text-xs text-gray-400 dark:text-dark-text-muted truncate mt-1">
                          {email.snippet}
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 dark:text-dark-text-muted whitespace-nowrap">
                        {formatEmailDate(email.date)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Lapozás */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 py-4 border-t border-gray-100 dark:border-dark-border">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-sm rounded border border-gray-200 dark:border-dark-border disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary"
                  >
                    Előző
                  </button>
                  <span className="text-sm text-gray-500 dark:text-dark-text-muted">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 text-sm rounded border border-gray-200 dark:border-dark-border disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary"
                  >
                    Következő
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
