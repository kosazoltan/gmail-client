import { useState, useRef, useCallback, useEffect } from 'react';
import { Trash2, Mail, MailOpen, Pin, Archive, Star, Clock, X } from 'lucide-react';
import { EmailItem } from './EmailItem';
import { useSettings, defaultSettings, getSwipeActionColor } from '../../hooks/useSettings';
import type { Email, SwipeAction } from '../../types';

interface SwipeableEmailItemProps {
  email: Email;
  isSelected: boolean;
  onClick: () => void;
  onToggleStar: (e: React.MouseEvent) => void;
  onDelete?: (emailId: string) => void;
  onToggleRead?: (emailId: string, isRead: boolean) => void;
  onPin?: (emailId: string) => void;
  onArchive?: (emailId: string) => void;
  onSnooze?: (emailId: string) => void;
  selectionMode?: boolean;
  isChecked?: boolean;
  onToggleCheck?: (emailId: string) => void;
  isPinned?: boolean;
  isVip?: boolean;
}

// Action icons based on action type
function getActionIcon(action: SwipeAction, isRead?: boolean): React.ReactNode {
  switch (action) {
    case 'delete':
      return <Trash2 className="h-6 w-6 text-white" />;
    case 'archive':
      return <Archive className="h-6 w-6 text-white" />;
    case 'read':
      return isRead ? <MailOpen className="h-6 w-6 text-white" /> : <Mail className="h-6 w-6 text-white" />;
    case 'star':
      return <Star className="h-6 w-6 text-white" />;
    case 'snooze':
      return <Clock className="h-6 w-6 text-white" />;
    case 'none':
      return <X className="h-6 w-6 text-white" />;
    default:
      return null;
  }
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
  onArchive,
  onSnooze,
  selectionMode = false,
  isChecked = false,
  onToggleCheck,
  isPinned = false,
  isVip = false,
}: SwipeableEmailItemProps) {
  const [swipeX, setSwipeX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // BUG #7 & #8 Fix: Track mounted state and cleanup refs
  const mountedRef = useRef(true);
  const timeoutRefs = useRef<number[]>([]);
  const mouseListenersRef = useRef<{ move: ((e: MouseEvent) => void) | null; up: (() => void) | null }>({ move: null, up: null });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Clear all pending timeouts
      timeoutRefs.current.forEach(id => clearTimeout(id));
      timeoutRefs.current = [];
      // Remove any lingering mouse event listeners
      if (mouseListenersRef.current.move) {
        document.removeEventListener('mousemove', mouseListenersRef.current.move);
      }
      if (mouseListenersRef.current.up) {
        document.removeEventListener('mouseup', mouseListenersRef.current.up);
      }
    };
  }, []);

  // Get swipe settings
  const { data: settings } = useSettings();
  const leftAction: SwipeAction = settings?.swipeLeftAction || defaultSettings.swipeLeftAction!;
  const rightAction: SwipeAction = settings?.swipeRightAction || defaultSettings.swipeRightAction!;

  // Execute the action based on type
  const executeAction = useCallback((action: SwipeAction) => {
    switch (action) {
      case 'delete':
        onDelete?.(email.id);
        break;
      case 'archive':
        onArchive?.(email.id);
        break;
      case 'read':
        onToggleRead?.(email.id, !email.isRead);
        break;
      case 'star':
        // For star action, we need a synthetic click event
        const syntheticEvent = { stopPropagation: () => {} } as React.MouseEvent;
        onToggleStar(syntheticEvent);
        break;
      case 'snooze':
        onSnooze?.(email.id);
        break;
      case 'none':
        // Do nothing
        break;
    }
  }, [email.id, email.isRead, onDelete, onArchive, onToggleRead, onToggleStar, onSnooze]);

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
    if (swipeX < -SWIPE_THRESHOLD && leftAction !== 'none') {
      // Swipe left - execute left action
      setSwipeX(-MAX_SWIPE);
      // BUG #8 Fix: Track timeout and check mounted state
      const timeoutId = window.setTimeout(() => {
        if (!mountedRef.current) return;
        executeAction(leftAction);
        setSwipeX(0);
      }, 200);
      timeoutRefs.current.push(timeoutId);
    } else if (swipeX > SWIPE_THRESHOLD && rightAction !== 'none') {
      // Swipe right - execute right action
      setSwipeX(MAX_SWIPE);
      const timeoutId = window.setTimeout(() => {
        if (!mountedRef.current) return;
        executeAction(rightAction);
        setSwipeX(0);
      }, 200);
      timeoutRefs.current.push(timeoutId);
    } else {
      // Reset position
      setSwipeX(0);
    }
  }, [isDragging, selectionMode, swipeX, leftAction, rightAction, executeAction]);

  // Mouse events for desktop
  // BUG #7 Fix: Store listener refs and cleanup properly
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (selectionMode || e.button !== 0) return;
    startXRef.current = e.clientX;
    currentXRef.current = e.clientX;
    setIsDragging(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!mountedRef.current) return;
      currentXRef.current = moveEvent.clientX;
      const diff = currentXRef.current - startXRef.current;
      const clampedDiff = Math.max(-MAX_SWIPE, Math.min(MAX_SWIPE, diff));
      setSwipeX(clampedDiff);
    };

    const handleMouseUp = () => {
      // Clean up listeners immediately
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      mouseListenersRef.current = { move: null, up: null };

      if (!mountedRef.current) return;
      setIsDragging(false);

      const diff = currentXRef.current - startXRef.current;
      if (diff < -SWIPE_THRESHOLD && leftAction !== 'none') {
        setSwipeX(-MAX_SWIPE);
        const timeoutId = window.setTimeout(() => {
          if (!mountedRef.current) return;
          executeAction(leftAction);
          setSwipeX(0);
        }, 200);
        timeoutRefs.current.push(timeoutId);
      } else if (diff > SWIPE_THRESHOLD && rightAction !== 'none') {
        setSwipeX(MAX_SWIPE);
        const timeoutId = window.setTimeout(() => {
          if (!mountedRef.current) return;
          executeAction(rightAction);
          setSwipeX(0);
        }, 200);
        timeoutRefs.current.push(timeoutId);
      } else {
        setSwipeX(0);
      }
    };

    // Store refs for cleanup
    mouseListenersRef.current = { move: handleMouseMove, up: handleMouseUp };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [selectionMode, leftAction, rightAction, executeAction]);

  const showLeftAction = swipeX < -20;
  const showRightAction = swipeX > 20;

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden"
    >
      {/* Left background - configurable action */}
      <div
        className={`absolute inset-y-0 right-0 flex items-center justify-end px-4 transition-opacity ${showLeftAction ? 'opacity-100' : 'opacity-0'}`}
        style={{ width: MAX_SWIPE, backgroundColor: getSwipeActionColor(leftAction) }}
      >
        {getActionIcon(leftAction, email.isRead)}
      </div>

      {/* Right background - configurable action */}
      <div
        className={`absolute inset-y-0 left-0 flex items-center justify-start px-4 transition-opacity ${showRightAction ? 'opacity-100' : 'opacity-0'}`}
        style={{ width: MAX_SWIPE, backgroundColor: getSwipeActionColor(rightAction) }}
      >
        {getActionIcon(rightAction, email.isRead)}
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
          isVip={isVip}
          selectionMode={selectionMode}
          isChecked={isChecked}
          onToggleCheck={onToggleCheck}
        />
      </div>
    </div>
  );
}
