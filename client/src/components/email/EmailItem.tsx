import { useState, useRef, useEffect } from 'react';
import { Star, Paperclip, Trash2, Check, Pin, Mail, MailOpen } from 'lucide-react';
import { cn, formatEmailDate, displaySender, getInitials, emailToColor } from '../../lib/utils';
import type { Email } from '../../types';

interface EmailItemProps {
  email: Email;
  isSelected: boolean;
  onClick: () => void;
  onToggleStar: (e: React.MouseEvent) => void;
  onDelete?: (emailId: string) => void;
  onTogglePin?: (emailId: string) => void;
  onToggleRead?: (emailId: string, isRead: boolean) => void;
  isPinned?: boolean;
  // Selection mode props
  selectionMode?: boolean;
  isChecked?: boolean;
  onToggleCheck?: (emailId: string) => void;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
}

export function EmailItem({
  email,
  isSelected,
  onClick,
  onToggleStar,
  onDelete,
  onTogglePin,
  onToggleRead,
  isPinned = false,
  selectionMode = false,
  isChecked = false,
  onToggleCheck,
}: EmailItemProps) {
  const sender = displaySender(email.fromName, email.from);
  const initials = getInitials(sender);
  const avatarColor = emailToColor(email.from || '');

  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu({ visible: false, x: 0, y: 0 });
      }
    };

    if (contextMenu.visible) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [contextMenu.visible]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Calculate position, keep menu within viewport
    const x = Math.min(e.clientX, window.innerWidth - 160);
    const y = Math.min(e.clientY, window.innerHeight - 100);

    setContextMenu({ visible: true, x, y });
  };

  const handleDelete = () => {
    setContextMenu({ visible: false, x: 0, y: 0 });
    onDelete?.(email.id);
  };

  const handleTogglePin = () => {
    setContextMenu({ visible: false, x: 0, y: 0 });
    onTogglePin?.(email.id);
  };

  const handleToggleRead = () => {
    setContextMenu({ visible: false, x: 0, y: 0 });
    onToggleRead?.(email.id, !email.isRead);
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleCheck?.(email.id);
  };

  const handleItemClick = () => {
    if (selectionMode) {
      onToggleCheck?.(email.id);
    } else {
      onClick();
    }
  };

  return (
    <>
    <div
      onClick={handleItemClick}
      onContextMenu={handleContextMenu}
      className={cn(
        'flex items-start gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 cursor-pointer border-b border-gray-100 dark:border-dark-border transition-colors',
        isSelected && !selectionMode ? 'bg-blue-50 dark:bg-blue-500/10 border-l-2 border-l-blue-500' : 'hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary',
        isChecked && 'bg-blue-50 dark:bg-blue-500/10',
        !email.isRead && !isChecked && 'bg-white dark:bg-dark-bg-secondary',
        email.isRead && !isSelected && !isChecked && 'bg-gray-50/50 dark:bg-dark-bg/50',
      )}
    >
      {/* Checkbox vagy Avatar */}
      {selectionMode ? (
        <button
          onClick={handleCheckboxClick}
          className={cn(
            'flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-colors',
            isChecked
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 dark:bg-dark-bg-tertiary text-gray-500 dark:text-dark-text-secondary hover:bg-gray-300 dark:hover:bg-dark-border'
          )}
        >
          {isChecked ? <Check className="h-4 w-4 sm:h-5 sm:w-5" /> : <span className="text-xs sm:text-sm font-medium">{initials}</span>}
        </button>
      ) : (
        <div
          className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-medium"
          style={{ backgroundColor: avatarColor }}
        >
          {initials}
        </div>
      )}

      {/* Tartalom */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 sm:gap-2">
          <span
            className={cn(
              'text-xs sm:text-sm truncate',
              !email.isRead ? 'font-semibold text-gray-900 dark:text-dark-text' : 'text-gray-700 dark:text-dark-text-secondary',
            )}
          >
            {sender}
          </span>
          <span className="text-[10px] sm:text-xs text-gray-400 dark:text-dark-text-muted flex-shrink-0">
            {formatEmailDate(email.date)}
          </span>
        </div>

        <div
          className={cn(
            'text-xs sm:text-sm truncate mt-0.5',
            !email.isRead ? 'font-medium text-gray-800 dark:text-dark-text' : 'text-gray-600 dark:text-dark-text-secondary',
          )}
        >
          {email.subject || '(Nincs tárgy)'}
        </div>

        <div className="text-[10px] sm:text-xs text-gray-400 dark:text-dark-text-muted truncate mt-0.5 hidden sm:block">
          {email.snippet || ''}
        </div>
      </div>

      {/* Műveletek */}
      <div className="flex flex-col items-center gap-0.5 sm:gap-1 flex-shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleStar(e);
          }}
          className="p-1.5 sm:p-2.5 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-bg-tertiary transition-colors touch-manipulation"
          aria-label={email.isStarred ? 'Csillag eltávolítása' : 'Csillagozás'}
        >
          <Star
            className={cn(
              'h-4 w-4 sm:h-5 sm:w-5',
              email.isStarred
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300 dark:text-dark-text-muted hover:text-gray-400 dark:hover:text-dark-text-secondary',
            )}
          />
        </button>
        {email.hasAttachments && (
          <Paperclip className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-gray-400 dark:text-dark-text-muted" />
        )}
      </div>
    </div>

    {/* Context menu */}
    {contextMenu.visible && (
      <div
        ref={menuRef}
        className="fixed z-50 bg-white dark:bg-dark-bg-secondary rounded-xl shadow-lg border border-gray-100 dark:border-dark-border py-1 min-w-[180px]"
        style={{ left: contextMenu.x, top: contextMenu.y }}
      >
        <button
          onClick={handleTogglePin}
          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-dark-text hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary transition-colors touch-manipulation"
        >
          <Pin className={cn('h-5 w-5', isPinned && 'fill-amber-500 text-amber-500')} />
          <span>{isPinned ? 'Rögzítés feloldása' : 'Rögzítés'}</span>
        </button>
        <button
          onClick={handleToggleRead}
          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-dark-text hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary transition-colors touch-manipulation"
        >
          {email.isRead ? (
            <>
              <MailOpen className="h-5 w-5" />
              <span>Olvasatlannak jelölés</span>
            </>
          ) : (
            <>
              <Mail className="h-5 w-5" />
              <span>Olvasottnak jelölés</span>
            </>
          )}
        </button>
        <div className="border-t border-gray-100 dark:border-dark-border my-1" />
        <button
          onClick={handleDelete}
          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors touch-manipulation"
        >
          <Trash2 className="h-5 w-5" />
          <span>Törlés</span>
        </button>
      </div>
    )}
    </>
  );
}
