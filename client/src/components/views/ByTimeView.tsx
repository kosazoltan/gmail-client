import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../hooks/useAccounts';
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
    today: 'bg-green-50 text-green-600',
    yesterday: 'bg-blue-50 text-blue-600',
    this_week: 'bg-indigo-50 text-indigo-600',
    this_month: 'bg-purple-50 text-purple-600',
    older: 'bg-gray-100 text-gray-600',
  };

  if (!selectedPeriod) {
    return (
      <div className="overflow-auto h-full">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
          <Clock className="h-5 w-5 text-gray-500" />
          <h2 className="text-sm font-medium text-gray-600">Időszak szerint</h2>
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
                className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div
                  className={`p-3 rounded-lg ${periodColors[period.id] || 'bg-gray-50 text-gray-600'}`}
                >
                  <Calendar className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{period.name}</div>
                </div>
                <div className="text-lg font-semibold text-gray-800">
                  {period.count}
                  <span className="text-sm font-normal text-gray-400 ml-1">levél</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="w-full lg:w-2/5 xl:w-1/3 border-r border-gray-200 overflow-auto">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
          <button
            onClick={() => {
              setSelectedPeriod(null);
              setSelectedEmail(null);
            }}
            className="p-1 rounded hover:bg-gray-200"
          >
            <ArrowLeft className="h-4 w-4 text-gray-500" />
          </button>
          <span className="text-sm font-medium text-gray-600">{selectedPeriod.name}</span>
        </div>

        <EmailList
          emails={periodEmails?.emails || []}
          isLoading={loadingEmails}
          selectedEmailId={selectedEmail?.id || null}
          onSelectEmail={setSelectedEmail}
          emptyMessage="Nincsenek levelek ebben az időszakban"
        />
      </div>

      <div className="hidden lg:block flex-1">
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
  );
}
