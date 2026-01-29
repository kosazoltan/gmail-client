import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../hooks/useAccounts';
import { api } from '../../lib/api';
import { EmailList } from '../email/EmailList';
import { EmailDetail } from '../email/EmailDetail';
import { MessageSquare, ArrowLeft, Loader2 } from 'lucide-react';
import type { Email, Topic } from '../../types';

export function ByTopicView() {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

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

  if (!selectedTopic) {
    return (
      <div className="overflow-auto h-full">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-gray-500" />
          <h2 className="text-sm font-medium text-gray-600">Téma szerint</h2>
        </div>

        {loadingTopics ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {(topicsData?.topics || []).map((topic) => (
              <div
                key={topic.id}
                onClick={() => setSelectedTopic(topic)}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-purple-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 text-sm truncate">
                    {topic.name}
                  </div>
                </div>
                <div className="text-sm font-medium text-purple-600 flex-shrink-0">
                  {topic.messageCount} levél
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
              setSelectedTopic(null);
              setSelectedEmail(null);
            }}
            className="p-1 rounded hover:bg-gray-200"
          >
            <ArrowLeft className="h-4 w-4 text-gray-500" />
          </button>
          <span className="text-sm font-medium text-gray-600">{selectedTopic.name}</span>
        </div>

        <EmailList
          emails={topicEmails?.emails || []}
          isLoading={loadingEmails}
          selectedEmailId={selectedEmail?.id || null}
          onSelectEmail={setSelectedEmail}
          emptyMessage="Nincsenek levelek ebben a témában"
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
