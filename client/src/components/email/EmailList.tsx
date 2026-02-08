import { SwipeableEmailItem } from './SwipeableEmailItem';
import { useToggleStar, useMarkRead } from '../../hooks/useEmails';
import { useSnoozeEmail, getSnoozeOptions } from '../../hooks/useSnooze';
import { useVipEmails, isVipEmail } from '../../hooks/useVip';
import { Loader2, MailX } from 'lucide-react';
import { toast } from '../../lib/toast';
import type { Email } from '../../types';

interface EmailListProps {
  emails: Email[];
  isLoading?: boolean;
  selectedEmailId: string | null;
  onSelectEmail: (email: Email) => void;
  onDeleteEmail?: (emailId: string) => void;
  onArchiveEmail?: (emailId: string) => void;
  title?: string;
  emptyMessage?: React.ReactNode;
  // Selection mode props
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (emailId: string, event?: React.MouseEvent) => void;
  // Pinned emails
  pinnedEmailIds?: Set<string>;
}

export function EmailList({
  emails,
  isLoading,
  selectedEmailId,
  onSelectEmail,
  onDeleteEmail,
  onArchiveEmail,
  title,
  emptyMessage = 'Nincsenek levelek',
  selectionMode = false,
  selectedIds = new Set(),
  onToggleSelect,
  pinnedEmailIds = new Set(),
}: EmailListProps) {
  const toggleStar = useToggleStar();
  const markRead = useMarkRead();
  const snoozeEmail = useSnoozeEmail();
  const { data: vipEmails } = useVipEmails();

  const handleToggleRead = (emailId: string, isRead: boolean) => {
    markRead.mutate({ emailId, isRead });
  };

  // Quick snooze for swipe action - snooze until tomorrow morning
  const handleQuickSnooze = (emailId: string) => {
    const options = getSnoozeOptions();
    const tomorrowOption = options.find((o) => o.id === 'tomorrow_morning');
    if (tomorrowOption) {
      snoozeEmail.mutate(
        { emailId, snoozeUntil: tomorrowOption.time },
        {
          onSuccess: () => {
            toast.success('Email elhalasztva holnap reggelig');
          },
        },
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500 dark:text-blue-400" />
        <span className="ml-3 text-gray-500 dark:text-dark-text-secondary">Levelek betöltése...</span>
      </div>
    );
  }

  if (emails.length === 0) {
    if (typeof emptyMessage !== 'string') {
      return <>{emptyMessage}</>;
    }
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
        <SwipeableEmailItem
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
          onArchive={onArchiveEmail}
          onSnooze={handleQuickSnooze}
          onToggleRead={handleToggleRead}
          selectionMode={selectionMode}
          isChecked={selectedIds.has(email.id)}
          onToggleCheck={onToggleSelect}
          isPinned={pinnedEmailIds.has(email.id)}
          isVip={isVipEmail(email.from, vipEmails)}
        />
      ))}
    </div>
  );
}
