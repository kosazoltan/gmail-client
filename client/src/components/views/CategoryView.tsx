import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../hooks/useAccounts';
import { api } from '../../lib/api';
import { EmailList } from '../email/EmailList';
import { EmailDetail } from '../email/EmailDetail';
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

  return (
    <div className="flex h-full">
      <div className="w-full lg:w-2/5 xl:w-1/3 border-r border-gray-200 dark:border-dark-border overflow-auto">
        <div className="px-4 py-3 bg-gray-50 dark:bg-dark-bg-tertiary border-b border-gray-200 dark:border-dark-border flex items-center gap-2">
          <button
            onClick={() => {
              setSelectedCategory(null);
              setSelectedEmail(null);
            }}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-dark-bg"
          >
            <ArrowLeft className="h-4 w-4 text-gray-500 dark:text-dark-text-secondary" />
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
          emails={categoryEmails?.emails || []}
          isLoading={loadingEmails}
          selectedEmailId={selectedEmail?.id || null}
          onSelectEmail={setSelectedEmail}
          emptyMessage="Nincsenek levelek ebben a kategóriában"
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
