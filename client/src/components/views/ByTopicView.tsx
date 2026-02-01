import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../hooks/useAccounts';
import { useDeleteEmail } from '../../hooks/useEmails';
import { api } from '../../lib/api';
import { EmailList } from '../email/EmailList';
import { EmailDetail } from '../email/EmailDetail';
import { MessageSquare, ArrowLeft, Loader2 } from 'lucide-react';
import type { Email, Topic } from '../../types';
import { getNextEmailAfterDelete } from '../../lib/emailNavigation';

export function ByTopicView() {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const deleteEmail = useDeleteEmail();

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
        <div className="px-4 py-3 bg-gray-50 dark:bg-dark-bg-tertiary border-b border-gray-200 dark:border-dark-border flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-gray-500 dark:text-dark-text-secondary" />
          <h2 className="text-sm font-medium text-gray-600 dark:text-dark-text">Téma szerint</h2>
        </div>

        {loadingTopics ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-dark-border">
            {(topicsData?.topics || []).map((topic) => (
              <div
                key={topic.id}
                onClick={() => setSelectedTopic(topic)}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary transition-colors"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-500/20 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-purple-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-dark-text text-sm truncate">
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

  const emails = topicEmails?.emails || [];

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
              setSelectedTopic(null);
              setSelectedEmail(null);
            }}
            className="p-2.5 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-bg touch-manipulation"
            aria-label="Vissza"
          >
            <ArrowLeft className="h-5 w-5 text-gray-500 dark:text-dark-text-secondary" />
          </button>
          <span className="text-sm font-medium text-gray-600 dark:text-dark-text">{selectedTopic.name}</span>
        </div>

        <EmailList
          emails={emails}
          isLoading={loadingEmails}
          selectedEmailId={selectedEmail?.id || null}
          onSelectEmail={setSelectedEmail}
          onDeleteEmail={(emailId) => {
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
          emptyMessage="Nincsenek levelek ebben a témában"
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
      </div>
    </div>
  );
}
