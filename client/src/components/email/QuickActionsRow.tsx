import { Archive, Mail, MailOpen, Trash2, Clock, Reply } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { Email } from '../../types';

interface QuickActionsRowProps {
  email: Email;
  onArchive?: () => void;
  onDelete?: () => void;
  onToggleRead?: () => void;
  onSnooze?: () => void;
  onQuickReply?: () => void;
  className?: string;
  dense?: boolean;
}

/**
 * AquaMail-style Quick Actions Row
 * Shows inline action buttons for common email operations
 * Appears below email preview to enable 1-tap actions
 */
export function QuickActionsRow({
  email,
  onArchive,
  onDelete,
  onToggleRead,
  onSnooze,
  onQuickReply,
  className,
  dense = false,
}: QuickActionsRowProps) {
  const iconSize = dense ? 'h-4 w-4' : 'h-5 w-5';
  const buttonSize = dense ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm';

  const actions = [
    {
      id: 'read',
      label: email.isRead ? 'Mark Unread' : 'Mark Read',
      icon: email.isRead ? <MailOpen className={iconSize} /> : <Mail className={iconSize} />,
      onClick: onToggleRead,
      color: 'text-blue-600 dark:text-blue-400',
      visible: !!onToggleRead,
    },
    {
      id: 'reply',
      label: 'Reply',
      icon: <Reply className={iconSize} />,
      onClick: onQuickReply,
      color: 'text-green-600 dark:text-green-400',
      visible: !!onQuickReply,
    },
    {
      id: 'archive',
      label: 'Archive',
      icon: <Archive className={iconSize} />,
      onClick: onArchive,
      color: 'text-amber-600 dark:text-amber-400',
      visible: !!onArchive,
    },
    {
      id: 'snooze',
      label: 'Snooze',
      icon: <Clock className={iconSize} />,
      onClick: onSnooze,
      color: 'text-purple-600 dark:text-purple-400',
      visible: !!onSnooze,
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: <Trash2 className={iconSize} />,
      onClick: onDelete,
      color: 'text-red-600 dark:text-red-400',
      visible: !!onDelete,
    },
  ];

  const visibleActions = actions.filter((a) => a.visible);

  if (visibleActions.length === 0) return null;

  return (
    <div
      className={cn(
        'dark:bg-dark-bg-secondary flex flex-wrap gap-1 border-t border-gray-200 bg-gray-50 dark:border-gray-700',
        dense ? 'px-2 py-1' : 'px-3 py-2',
        className,
      )}
    >
      {visibleActions.map((action) => (
        <button
          key={action.id}
          onClick={(e) => {
            e.stopPropagation();
            action.onClick?.();
          }}
          title={action.label}
          className={cn(
            'dark:hover:bg-dark-bg inline-flex items-center gap-1 rounded transition-all hover:bg-white',
            buttonSize,
            action.color,
            'hover:shadow-sm',
          )}
        >
          {action.icon}
          {!dense && <span>{action.label}</span>}
        </button>
      ))}
    </div>
  );
}
