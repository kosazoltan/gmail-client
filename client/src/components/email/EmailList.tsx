import { EmailItem } from './EmailItem';
import { useToggleStar } from '../../hooks/useEmails';
import { Loader2, MailX } from 'lucide-react';
import type { Email } from '../../types';

interface EmailListProps {
  emails: Email[];
  isLoading?: boolean;
  selectedEmailId: string | null;
  onSelectEmail: (email: Email) => void;
  onDeleteEmail?: (emailId: string) => void;
  title?: string;
  emptyMessage?: string;
}

export function EmailList({
  emails,
  isLoading,
  selectedEmailId,
  onSelectEmail,
  onDeleteEmail,
  title,
  emptyMessage = 'Nincsenek levelek',
}: EmailListProps) {
  const toggleStar = useToggleStar();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500 dark:text-blue-400" />
        <span className="ml-3 text-gray-500 dark:text-dark-text-secondary">Levelek betöltése...</span>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400 dark:text-dark-text-muted">
        <MailX className="h-12 w-12 mb-3" />
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {title && (
        <div className="px-4 py-2 bg-gray-50 dark:bg-dark-bg-tertiary border-b border-gray-200 dark:border-dark-border">
          <h2 className="text-sm font-medium text-gray-600 dark:text-dark-text-secondary">{title}</h2>
        </div>
      )}
      {emails.map((email) => (
        <EmailItem
          key={email.id}
          email={email}
          isSelected={email.id === selectedEmailId}
          onClick={() => onSelectEmail(email)}
          onToggleStar={(e) => {
            e.stopPropagation();
            toggleStar.mutate({
              emailId: email.id,
              isStarred: !email.isStarred,
            });
          }}
          onDelete={onDeleteEmail}
        />
      ))}
    </div>
  );
}
