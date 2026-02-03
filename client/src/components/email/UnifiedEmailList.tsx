import { SwipeableEmailItem } from './SwipeableEmailItem';
import { useToggleStar, useMarkRead } from '../../hooks/useEmails';
import { useSnoozeEmail, getSnoozeOptions } from '../../hooks/useSnooze';
import { useVipEmails, isVipEmail } from '../../hooks/useVip';
import { Loader2, MailX } from 'lucide-react';
import { toast } from '../../lib/toast';
import type { Email } from '../../types';

interface UnifiedEmailListProps {
  emails: Email[];
  isLoading?: boolean;
  selectedEmailId: string | null;
  onSelectEmail: (email: Email) => void;
  onDeleteEmail?: (emailId: string) => void;
  onArchiveEmail?: (emailId: string) => void;
  emptyMessage?: string;
  // Selection mode props
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (emailId: string) => void;
}

export function UnifiedEmailList({
  emails,
  isLoading,
  selectedEmailId,
  onSelectEmail,
  onDeleteEmail,
  onArchiveEmail,
  emptyMessage = 'Nincsenek levelek',
  selectionMode = false,
  selectedIds = new Set(),
  onToggleSelect,
}: UnifiedEmailListProps) {
  const toggleStar = useToggleStar();
  const markRead = useMarkRead();
  const snoozeEmail = useSnoozeEmail();
  const { data: vipEmails } = useVipEmails();

  const handleToggleRead = (emailId: string, isRead: boolean) => {
    markRead.mutate({ emailId, isRead });
  };

  // Quick snooze for swipe action
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
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400 dark:text-dark-text-muted">
        <MailX className="h-12 w-12 mb-3" />
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {emails.map((email) => (
        <div key={email.id} className="relative">
          {/* Account color indicator */}
          {email.accountColor && (
            <div
              className="absolute left-0 top-0 bottom-0 w-1"
              style={{ backgroundColor: email.accountColor }}
              title={email.accountEmail || 'Account'}
            />
          )}
          <div className={email.accountColor ? 'ml-1' : ''}>
            <SwipeableEmailItem
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
              isVip={isVipEmail(email.from, vipEmails)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
