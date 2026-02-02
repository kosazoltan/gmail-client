import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../hooks/useAccounts';
import { useDeleteEmail } from '../../hooks/useEmails';
import { api } from '../../lib/api';
import { EmailList } from '../email/EmailList';
import { EmailDetail } from '../email/EmailDetail';
import { ResizablePanels } from '../common/ResizablePanels';
import {
  Tags,
  ArrowLeft,
  Loader2,
  Briefcase,
  User,
  Newspaper,
  Bell,
  Wallet,
  Folder,
} from 'lucide-react';
import type { Email, Category } from '../../types';
import { getNextEmailAfterDelete } from '../../lib/emailNavigation';

const iconMap: Record<string, typeof Briefcase> = {
  briefcase: Briefcase,
  user: User,
  newspaper: Newspaper,
  bell: Bell,
  wallet: Wallet,
  folder: Folder,
};

export function CategoryView() {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const deleteEmail = useDeleteEmail();

  const accountId = session?.activeAccountId || undefined;

  const { data: categoryData, isLoading: loadingCategories } = useQuery({
    queryKey: ['views', 'by-category', accountId],
    queryFn: () => api.views.byCategory(),
    enabled: !!accountId,
  });

  const { data: categoryEmails, isLoading: loadingEmails } = useQuery({
    queryKey: ['views', 'by-category-emails', selectedCategory?.id],
    queryFn: () => api.views.byCategoryEmails(selectedCategory!.id),
    enabled: !!selectedCategory,
  });

  if (!selectedCategory) {
    return (
      <div className="overflow-auto h-full">
        <div className="px-4 py-3 bg-gray-50 dark:bg-dark-bg-tertiary border-b border-gray-200 dark:border-dark-border flex items-center gap-2">
          <Tags className="h-5 w-5 text-gray-500 dark:text-dark-text-secondary" />
          <h2 className="text-sm font-medium text-gray-600 dark:text-dark-text">Kategóriák</h2>
        </div>

        {loadingCategories ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(categoryData?.categories || []).map((cat) => {
              const Icon = iconMap[cat.icon] || Folder;
              return (
                <div
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat)}
                  className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-dark-border cursor-pointer hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-sm transition-all"
                >
                  <div
                    className="p-2.5 rounded-lg"
                    style={{
                      backgroundColor: `${cat.color}15`,
                      color: cat.color,
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-dark-text text-sm">{cat.name}</div>
                    <div className="text-xs text-gray-400 dark:text-dark-text-muted">
                      {cat.emailCount || 0} levél
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const emails = categoryEmails?.emails || [];

  // Ref a friss emails lista eléréséhez (stale closure fix)
  const emailsRef = useRef(emails);
  useEffect(() => {
    emailsRef.current = emails;
  }, [emails]);

  const leftPanel = (
    <>
      <div className="px-4 py-3 bg-gray-50 dark:bg-dark-bg-tertiary border-b border-gray-200 dark:border-dark-border flex items-center gap-2">
        <button
          onClick={() => {
            setSelectedCategory(null);
            setSelectedEmail(null);
          }}
          className="p-2.5 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-bg touch-manipulation"
          aria-label="Vissza"
        >
          <ArrowLeft className="h-5 w-5 text-gray-500 dark:text-dark-text-secondary" />
        </button>
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: selectedCategory.color }}
        />
        <span className="text-sm font-medium text-gray-600 dark:text-dark-text">
          {selectedCategory.name}
        </span>
      </div>
      <EmailList
        emails={emails}
        isLoading={loadingEmails}
        selectedEmailId={selectedEmail?.id || null}
        onSelectEmail={setSelectedEmail}
        onDeleteEmail={(emailId) => {
          deleteEmail.mutate(emailId, {
            onSuccess: () => {
              if (selectedEmail?.id === emailId) {
                const nextEmail = getNextEmailAfterDelete(emailsRef.current, emailId);
                setSelectedEmail(nextEmail);
              }
            }
          });
        }}
        emptyMessage="Nincsenek levelek ebben a kategóriában"
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
    <ResizablePanels
      leftPanel={leftPanel}
      rightPanel={rightPanel}
      rightPanelActive={!!selectedEmail}
      storageKey="category-list-width"
    />
  );
}
