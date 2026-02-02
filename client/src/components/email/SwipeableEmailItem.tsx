import { useState, useRef, useCallback } from 'react';
import { Trash2, Mail, MailOpen, Pin } from 'lucide-react';
import { EmailItem } from './EmailItem';
import type { Email } from '../../types';

interface SwipeableEmailItemProps {
  email: Email;
  isSelected: boolean;
  onClick: () => void;
  onToggleStar: (e: React.MouseEvent) => void;
  onDelete?: (emailId: string) => void;
  onToggleRead?: (emailId: string, isRead: boolean) => void;
  onPin?: (emailId: string) => void;
  selectionMode?: boolean;
  isChecked?: boolean;
  onToggleCheck?: (emailId: string) => void;
  isPinned?: boolean;
}

const SWIPE_THRESHOLD = 80;
const MAX_SWIPE = 120;

export function SwipeableEmailItem({
  email,
  isSelected,
  onClick,
  onToggleStar,
  onDelete,
  onToggleRead,
  onPin,
  selectionMode = false,
  isChecked = false,
  onToggleCheck,
  isPinned = false,
}: SwipeableEmailItemProps) {
  const [swipeX, setSwipeX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (selectionMode) return;
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = e.touches[0].clientX;
    setIsDragging(true);
  }, [selectionMode]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || selectionMode) return;

    currentXRef.current = e.touches[0].clientX;
    const diff = currentXRef.current - startXRef.current;

    // Limit the swipe distance
    const clampedDiff = Math.max(-MAX_SWIPE, Math.min(MAX_SWIPE, diff));
    setSwipeX(clampedDiff);
  }, [isDragging, selectionMode]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging || selectionMode) return;
    setIsDragging(false);

    // Check if swipe threshold was reached
    if (swipeX < -SWIPE_THRESHOLD) {
      // Swipe left - Delete
      setSwipeX(-MAX_SWIPE);
      setTimeout(() => {
        onDelete?.(email.id);
        setSwipeX(0);
      }, 200);
    } else if (swipeX > SWIPE_THRESHOLD) {
      // Swipe right - Toggle read
      setSwipeX(MAX_SWIPE);
      setTimeout(() => {
        onToggleRead?.(email.id, !email.isRead);
        setSwipeX(0);
      }, 200);
    } else {
      // Reset position
      setSwipeX(0);
    }
  }, [isDragging, selectionMode, swipeX, email.id, email.isRead, onDelete, onToggleRead]);

  // Mouse events for desktop
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (selectionMode || e.button !== 0) return;
    startXRef.current = e.clientX;
    currentXRef.current = e.clientX;
    setIsDragging(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      currentXRef.current = moveEvent.clientX;
      const diff = currentXRef.current - startXRef.current;
      const clampedDiff = Math.max(-MAX_SWIPE, Math.min(MAX_SWIPE, diff));
      setSwipeX(clampedDiff);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      const diff = currentXRef.current - startXRef.current;
      if (diff < -SWIPE_THRESHOLD) {
        setSwipeX(-MAX_SWIPE);
        setTimeout(() => {
          onDelete?.(email.id);
          setSwipeX(0);
        }, 200);
      } else if (diff > SWIPE_THRESHOLD) {
        setSwipeX(MAX_SWIPE);
        setTimeout(() => {
          onToggleRead?.(email.id, !email.isRead);
          setSwipeX(0);
        }, 200);
      } else {
        setSwipeX(0);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [selectionMode, email.id, email.isRead, onDelete, onToggleRead]);

  const showLeftAction = swipeX < -20;
  const showRightAction = swipeX > 20;

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden"
    >
      {/* Left background (Delete - red) */}
      <div
        className={`absolute inset-y-0 right-0 flex items-center justify-end px-4 bg-red-500 transition-opacity ${showLeftAction ? 'opacity-100' : 'opacity-0'}`}
        style={{ width: MAX_SWIPE }}
      >
        <Trash2 className="h-6 w-6 text-white" />
      </div>

      {/* Right background (Mark read/unread - blue) */}
      <div
        className={`absolute inset-y-0 left-0 flex items-center justify-start px-4 bg-blue-500 transition-opacity ${showRightAction ? 'opacity-100' : 'opacity-0'}`}
        style={{ width: MAX_SWIPE }}
      >
        {email.isRead ? (
          <MailOpen className="h-6 w-6 text-white" />
        ) : (
          <Mail className="h-6 w-6 text-white" />
        )}
      </div>

      {/* Pin indicator */}
      {isPinned && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500" />
      )}

      {/* Swipeable content */}
      <div
        className={`relative bg-white dark:bg-dark-bg-secondary ${isDragging ? '' : 'transition-transform duration-200'}`}
        style={{ transform: `translateX(${swipeX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
      >
        <EmailItem
          email={email}
          isSelected={isSelected}
          onClick={onClick}
          onToggleStar={onToggleStar}
          onDelete={onDelete}
          onTogglePin={onPin}
          onToggleRead={onToggleRead}
          isPinned={isPinned}
          selectionMode={selectionMode}
          isChecked={isChecked}
          onToggleCheck={onToggleCheck}
        />
      </div>
    </div>
  );
}
