import { Star, Paperclip } from 'lucide-react';
import { cn, formatEmailDate, displaySender, getInitials, emailToColor } from '../../lib/utils';
import type { Email } from '../../types';

interface EmailItemProps {
  email: Email;
  isSelected: boolean;
  onClick: () => void;
  onToggleStar: (e: React.MouseEvent) => void;
}

export function EmailItem({ email, isSelected, onClick, onToggleStar }: EmailItemProps) {
  const sender = displaySender(email.fromName, email.from);
  const initials = getInitials(sender);
  const avatarColor = emailToColor(email.from || '');

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-gray-100 dark:border-dark-border transition-colors',
        isSelected ? 'bg-blue-50 dark:bg-blue-500/10 border-l-2 border-l-blue-500' : 'hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary',
        !email.isRead && 'bg-white dark:bg-dark-bg-secondary',
        email.isRead && !isSelected && 'bg-gray-50/50 dark:bg-dark-bg/50',
      )}
    >
      {/* Avatar */}
      <div
        className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium"
        style={{ backgroundColor: avatarColor }}
      >
        {initials}
      </div>

      {/* Tartalom */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              'text-sm truncate',
              !email.isRead ? 'font-semibold text-gray-900 dark:text-dark-text' : 'text-gray-700 dark:text-dark-text-secondary',
            )}
          >
            {sender}
          </span>
          <span className="text-xs text-gray-400 dark:text-dark-text-muted flex-shrink-0">
            {formatEmailDate(email.date)}
          </span>
        </div>

        <div
          className={cn(
            'text-sm truncate mt-0.5',
            !email.isRead ? 'font-medium text-gray-800 dark:text-dark-text' : 'text-gray-600 dark:text-dark-text-secondary',
          )}
        >
          {email.subject || '(Nincs tárgy)'}
        </div>

        <div className="text-xs text-gray-400 dark:text-dark-text-muted truncate mt-0.5">
          {email.snippet || ''}
        </div>
      </div>

      {/* Műveletek */}
      <div className="flex flex-col items-center gap-1 flex-shrink-0">
        <button
          onClick={onToggleStar}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-dark-bg-tertiary transition-colors"
        >
          <Star
            className={cn(
              'h-4 w-4',
              email.isStarred
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300 dark:text-dark-text-muted hover:text-gray-400 dark:hover:text-dark-text-secondary',
            )}
          />
        </button>
        {email.hasAttachments && (
          <Paperclip className="h-3.5 w-3.5 text-gray-400 dark:text-dark-text-muted" />
        )}
      </div>
    </div>
  );
}
