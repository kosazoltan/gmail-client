import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../hooks/useAccounts';
import { useDeleteEmail } from '../../hooks/useEmails';
import { api } from '../../lib/api';
import { EmailList } from '../email/EmailList';
import { EmailDetail } from '../email/EmailDetail';
import { Clock, ArrowLeft, Loader2, Calendar } from 'lucide-react';
import type { Email, TimePeriod } from '../../types';

export function ByTimeView() {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const deleteEmail = useDeleteEmail();

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

  const periodColors: Record<string, string> = {
    today: 'bg-green-50 dark:bg-green-500/20 text-green-600',
    yesterday: 'bg-blue-50 dark:bg-blue-500/20 text-blue-600',
    this_week: 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600',
    this_month: 'bg-purple-50 dark:bg-purple-500/20 text-purple-600',
    older: 'bg-gray-100 dark:bg-gray-500/20 text-gray-600 dark:text-gray-400',
  };

  // Emailek az időszakhoz
  const emails = periodEmails?.emails || [];

  // Ref a friss emails lista eléréséhez (stale closure fix)
  // FONTOS: A hookokat a korai return előtt kell hívni!
  const emailsRef = useRef(emails);
  useEffect(() => { emailsRef.current = emails; }, [emails]);

  if (!selectedPeriod) {
    return (
      <div className="overflow-auto h-full">
        <div className="px-4 py-3 bg-gray-50 dark:bg-dark-bg-tertiary border-b border-gray-200 dark:border-dark-border flex items-center gap-2">
          <Clock className="h-5 w-5 text-gray-500 dark:text-dark-text-secondary" />
          <h2 className="text-sm font-medium text-gray-600 dark:text-dark-text">Időszak szerint</h2>
        </div>

        {loadingTime ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {(timeData?.periods || []).map((period) => (
              <div
                key={period.id}
                onClick={() => setSelectedPeriod(period)}
                className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-dark-border cursor-pointer hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-sm transition-all"
              >
                <div
                  className={`p-3 rounded-lg ${periodColors[period.id] || 'bg-gray-50 dark:bg-gray-500/20 text-gray-600 dark:text-gray-400'}`}
                >
                  <Calendar className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-dark-text">{period.name}</div>
                </div>
                <div className="text-lg font-semibold text-gray-800 dark:text-dark-text">
                  {period.count}
                  <span className="text-sm font-normal text-gray-400 dark:text-dark-text-muted ml-1">levél</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full relative">
      {/* Email lista - rejtett ha van kiválasztott email kis képernyőn */}
      <div className={`
        w-full lg:w-2/5 xl:w-1/3 border-r border-gray-200 dark:border-dark-border overflow-auto
        ${selectedEmail ? 'hidden lg:block' : 'block'}
      `}>
        <div className="px-4 py-3 bg-gray-50 dark:bg-dark-bg-tertiary border-b border-gray-200 dark:border-dark-border flex items-center gap-2">
          <button
            onClick={() => {
              setSelectedPeriod(null);
              setSelectedEmail(null);
            }}
            className="p-2.5 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-bg touch-manipulation"
            aria-label="Vissza"
          >
            <ArrowLeft className="h-5 w-5 text-gray-500 dark:text-dark-text-secondary" />
          </button>
          <span className="text-sm font-medium text-gray-600 dark:text-dark-text">{selectedPeriod.name}</span>
        </div>

        <EmailList
          emails={emails}
          isLoading={loadingEmails}
          selectedEmailId={selectedEmail?.id || null}
          onSelectEmail={setSelectedEmail}
          onDeleteEmail={(emailId) => {
            // Használjuk a ref-et a friss emails lista eléréséhez (stale closure fix)
            const currentEmails = emailsRef.current;
            const emailIndex = currentEmails.findIndex(e => e.id === emailId);
            deleteEmail.mutate(emailId, {
              onSuccess: () => {
                if (selectedEmail?.id === emailId) {
                  if (currentEmails.length > 1 && emailIndex !== -1) {
                    if (emailIndex < currentEmails.length - 1) {
                      setSelectedEmail(currentEmails[emailIndex + 1]);
                    } else if (emailIndex > 0) {
                      setSelectedEmail(currentEmails[emailIndex - 1]);
                    } else {
                      setSelectedEmail(null);
                    }
                  } else {
                    setSelectedEmail(null);
                  }
                }
              }
            });
          }}
          emptyMessage="Nincsenek levelek ebben az időszakban"
        />
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
          onReply={({ to, subject, threadId, cc }) => {
            navigate(
              `/compose?reply=true&to=${encodeURIComponent(to)}&subject=${encodeURIComponent(subject)}${threadId ? `&threadId=${threadId}` : ''}${cc ? `&cc=${encodeURIComponent(cc)}` : ''}`,
            );
          }}
          onForward={({ subject, body }) => {
            navigate(
              `/compose?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
            );
          }}
          onDeleteSuccess={() => {
            const currentEmails = emailsRef.current;
            const deletedIndex = currentEmails.findIndex(e => e.id === selectedEmail?.id);
            if (currentEmails.length > 1 && deletedIndex !== -1) {
              if (deletedIndex < currentEmails.length - 1) {
                setSelectedEmail(currentEmails[deletedIndex + 1]);
              } else if (deletedIndex > 0) {
                setSelectedEmail(currentEmails[deletedIndex - 1]);
              } else {
                setSelectedEmail(null);
              }
            } else {
              setSelectedEmail(null);
            }
          }}
        />
      </div>
    </div>
  );
}
