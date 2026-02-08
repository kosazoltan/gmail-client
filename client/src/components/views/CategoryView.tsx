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
      <div className="h-full overflow-auto">
        <div className="dark:bg-dark-bg-tertiary dark:border-dark-border flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3">
          <Tags className="dark:text-dark-text-secondary h-5 w-5 text-gray-500" />
          <h2 className="dark:text-dark-text text-sm font-medium text-gray-600">Kategóriák</h2>
        </div>

        {loadingCategories ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {(categoryData?.categories || []).map((cat) => {
              const Icon = iconMap[cat.icon] || Folder;
              return (
                <div
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat)}
                  className="dark:border-dark-border flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 p-4 transition-all hover:border-blue-300 hover:shadow-sm dark:hover:border-blue-500"
                >
                  <div
                    className="rounded-lg p-2.5"
                    style={{
                      backgroundColor: `${cat.color}15`,
                      color: cat.color,
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="dark:text-dark-text text-sm font-medium text-gray-900">
                      {cat.name}
                    </div>
                    <div className="dark:text-dark-text-muted text-xs text-gray-400">
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
      <div className="dark:bg-dark-bg-tertiary dark:border-dark-border flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3">
        <button
          onClick={() => {
            setSelectedCategory(null);
            setSelectedEmail(null);
          }}
          className="dark:hover:bg-dark-bg touch-manipulation rounded-lg p-2.5 hover:bg-gray-200"
          aria-label="Vissza"
        >
          <ArrowLeft className="dark:text-dark-text-secondary h-5 w-5 text-gray-500" />
        </button>
        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: selectedCategory.color }} />
        <span className="dark:text-dark-text text-sm font-medium text-gray-600">
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
            },
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
