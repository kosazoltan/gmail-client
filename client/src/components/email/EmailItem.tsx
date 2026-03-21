import { useState } from 'react';
import {
  Star,
  Paperclip,
  Trash2,
  Check,
  Pin,
  Mail,
  MailOpen,
  Crown,
  Archive,
  Clock,
} from 'lucide-react';
import { cn, formatEmailDate, displaySender, getInitials, emailToColor } from '../../lib/utils';
import { useSettings, defaultSettings } from '../../hooks/useSettings';
import { setDraggedEmail } from '../../hooks/useDragDrop';
import type { Email } from '../../types';

interface EmailItemProps {
  email: Email;
  isSelected: boolean;
  onClick: () => void;
  onToggleStar: (e: React.MouseEvent) => void;
  onDelete?: (emailId: string) => void;
  onTogglePin?: (emailId: string) => void;
  onToggleRead?: (emailId: string, isRead: boolean) => void;
  onArchive?: (emailId: string) => void;
  onSnooze?: (emailId: string) => void;
  isPinned?: boolean;
  isVip?: boolean;
  // Selection mode props
  selectionMode?: boolean;
  isChecked?: boolean;
  onToggleCheck?: (emailId: string, event?: React.MouseEvent) => void;
}

export function EmailItem({
  email,
  isSelected,
  onClick,
  onToggleStar,
  onDelete,
  onTogglePin,
  onToggleRead,
  onArchive,
  onSnooze,
  isPinned = false,
  isVip = false,
  selectionMode = false,
  isChecked = false,
  onToggleCheck,
}: EmailItemProps) {
  const sender = displaySender(email.fromName, email.from);
  const initials = getInitials(sender);
  const avatarColor = emailToColor(email.from || '');
  const { data: settings } = useSettings();
  const density = settings?.messageDensity ?? defaultSettings.messageDensity ?? 'normal';

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleCheck?.(email.id, e);
  };

  const handleItemClick = (e: React.MouseEvent) => {
    if (selectionMode) {
      onToggleCheck?.(email.id, e);
    } else {
      onClick();
    }
  };

  return (
    <>
      <div
        draggable={true}
        onDragStart={(e) => {
          setDraggedEmail(e.dataTransfer, { emailId: email.id, accountId: email.accountId });
        }}
        onClick={handleItemClick}
        onContextMenu={handleContextMenu}
        className={cn(
          'dark:border-dark-border flex cursor-pointer items-start gap-2 border-b border-gray-100 transition-colors sm:gap-3',
          density === 'compact' && 'px-2 py-1.5 sm:px-3 sm:py-2',
          density === 'normal' && 'px-3 py-2 sm:px-4 sm:py-3',
          density === 'comfortable' && 'px-4 py-3 sm:px-5 sm:py-4',
          isSelected && !selectionMode
            ? 'border-l-2 border-l-blue-500 bg-blue-50 dark:bg-blue-500/10'
            : 'dark:hover:bg-dark-bg-tertiary hover:bg-gray-50',
          isChecked && 'bg-blue-50 dark:bg-blue-500/10',
          !email.isRead && !isChecked && 'dark:bg-dark-bg-secondary bg-white',
          email.isRead && !isSelected && !isChecked && 'dark:bg-dark-bg/50 bg-gray-50/50',
        )}
      >
        {email.accountColor && (
          <span
            className="mt-1 h-1 w-1 flex-shrink-0 rounded-full sm:h-2.5 sm:w-2.5"
            style={{ backgroundColor: email.accountColor }}
            title={email.accountEmail || 'Fiók szín'}
          />
        )}

        {/* Checkbox vagy Avatar */}
        {selectionMode ? (
          <button
            onClick={handleCheckboxClick}
            className={cn(
              'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-colors sm:h-10 sm:w-10',
              isChecked
                ? 'bg-blue-500 text-white'
                : 'dark:bg-dark-bg-tertiary dark:text-dark-text-secondary dark:hover:bg-dark-border bg-gray-200 text-gray-500 hover:bg-gray-300',
            )}
          >
            {isChecked ? (
              <Check className="h-4 w-4 sm:h-5 sm:w-5" />
            ) : (
              <span className="text-xs font-medium sm:text-sm">{initials}</span>
            )}
          </button>
        ) : (
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium text-white sm:h-10 sm:w-10 sm:text-sm"
            style={{ backgroundColor: avatarColor }}
          >
            {initials}
          </div>
        )}

        {/* Tartalom */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1 sm:gap-2">
            <span className="flex min-w-0 items-center gap-1">
              {isVip && (
                <span title="VIP küldő">
                  <Crown className="h-3 w-3 flex-shrink-0 text-amber-500 sm:h-4 sm:w-4" />
                </span>
              )}
              <span
                className={cn(
                  'truncate break-words',
                  density === 'comfortable' ? 'text-sm sm:text-base' : 'text-xs sm:text-sm',
                  !email.isRead
                    ? 'dark:text-dark-text font-semibold text-gray-900'
                    : 'dark:text-dark-text-secondary text-gray-700',
                )}
              >
                {sender}
              </span>
            </span>
            <span className="dark:text-dark-text-muted flex-shrink-0 text-[10px] text-gray-400 sm:text-xs">
              {formatEmailDate(email.date)}
            </span>
          </div>

          {density === 'compact' ? (
            <div
              className={cn(
                'truncate text-xs break-words sm:text-sm',
                !email.isRead
                  ? 'dark:text-dark-text font-medium text-gray-800'
                  : 'dark:text-dark-text-secondary text-gray-600',
              )}
            >
              {email.subject || '(Nincs tárgy)'}
            </div>
          ) : (
            <>
              <div
                className={cn(
                  'mt-0.5 truncate break-words',
                  density === 'comfortable' ? 'text-sm sm:text-base' : 'text-xs sm:text-sm',
                  !email.isRead
                    ? 'dark:text-dark-text font-medium text-gray-800'
                    : 'dark:text-dark-text-secondary text-gray-600',
                )}
              >
                {email.subject || '(Nincs tárgy)'}
              </div>

              <div
                className={cn(
                  'dark:text-dark-text-muted mt-0.5 hidden text-gray-400 sm:block',
                  density === 'comfortable'
                    ? 'line-clamp-2 text-xs sm:text-sm'
                    : 'truncate text-[10px] break-words sm:text-xs',
                )}
              >
                {email.snippet || ''}
              </div>
            </>
          )}
        </div>

        {/* Műveletek */}
        <div className="flex flex-shrink-0 flex-col items-center gap-0.5 sm:gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleStar(e);
            }}
            className="dark:hover:bg-dark-bg-tertiary touch-manipulation rounded-lg p-1.5 transition-colors hover:bg-gray-200 sm:p-2.5"
            aria-label={email.isStarred ? 'Csillag eltávolítása' : 'Csillagozás'}
          >
            <Star
              className={cn(
                'h-4 w-4 sm:h-5 sm:w-5',
                email.isStarred
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'dark:text-dark-text-muted dark:hover:text-dark-text-secondary text-gray-300 hover:text-gray-400',
              )}
            />
          </button>
          {email.hasAttachments && (
            <Paperclip className="dark:text-dark-text-muted h-3 w-3 text-gray-400 sm:h-3.5 sm:w-3.5" />
          )}
        </div>
      </div>

      {/* Context menu (jobb klikk) */}
      {contextMenu && (
        <div className="fixed inset-0 z-50" onClick={() => setContextMenu(null)}>
          <div
            className="dark:bg-dark-bg-secondary dark:border-dark-border animate-scale-in absolute min-w-[200px] rounded-xl border border-gray-200 bg-white py-1.5 shadow-xl"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => {
                onToggleRead?.(email.id, !email.isRead);
                setContextMenu(null);
              }}
              className="dark:text-dark-text dark:hover:bg-dark-bg-tertiary flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
            >
              {email.isRead ? <MailOpen className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
              {email.isRead ? 'Megjelölés olvasatlanként' : 'Megjelölés olvasottként'}
            </button>
            <button
              onClick={(e) => {
                onToggleStar(e);
                setContextMenu(null);
              }}
              className="dark:text-dark-text dark:hover:bg-dark-bg-tertiary flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
            >
              <Star
                className={cn('h-4 w-4', email.isStarred && 'fill-yellow-400 text-yellow-400')}
              />
              {email.isStarred ? 'Csillag eltávolítása' : 'Csillag hozzáadása'}
            </button>
            <button
              onClick={() => {
                onTogglePin?.(email.id);
                setContextMenu(null);
              }}
              className="dark:text-dark-text dark:hover:bg-dark-bg-tertiary flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
            >
              <Pin className={cn('h-4 w-4', isPinned && 'fill-amber-500 text-amber-500')} />
              {isPinned ? 'Kitűzés feloldása' : 'Kitűzés'}
            </button>
            {onArchive && (
              <button
                onClick={() => {
                  onArchive(email.id);
                  setContextMenu(null);
                }}
                className="dark:text-dark-text dark:hover:bg-dark-bg-tertiary flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-500/10"
              >
                <Archive className="h-4 w-4" />
                Archiválás
              </button>
            )}
            {onSnooze && (
              <button
                onClick={() => {
                  onSnooze(email.id);
                  setContextMenu(null);
                }}
                className="dark:text-dark-text dark:hover:bg-dark-bg-tertiary flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-purple-700 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-500/10"
              >
                <Clock className="h-4 w-4" />
                Szundi
              </button>
            )}
            <div className="dark:border-dark-border my-1 border-t border-gray-100" />
            <button
              onClick={() => {
                onDelete?.(email.id);
                setContextMenu(null);
              }}
              className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              <Trash2 className="h-4 w-4" />
              Törlés
            </button>
          </div>
        </div>
      )}
    </>
  );
}
