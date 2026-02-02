import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { GripVertical } from 'lucide-react';

interface ResizablePanelsProps {
  leftPanel: ReactNode;
  rightPanel: ReactNode;
  /** Kezdeti szélesség százalékban (0-100) */
  defaultLeftWidth?: number;
  /** Minimum szélesség százalékban */
  minLeftWidth?: number;
  /** Maximum szélesség százalékban */
  maxLeftWidth?: number;
  /** localStorage kulcs a szélesség mentéséhez */
  storageKey?: string;
  /** Mobilon a bal panel rejtve, ha rightPanelActive */
  rightPanelActive?: boolean;
}

export function ResizablePanels({
  leftPanel,
  rightPanel,
  defaultLeftWidth = 35,
  minLeftWidth = 20,
  maxLeftWidth = 60,
  storageKey = 'email-list-width',
  rightPanelActive = false,
}: ResizablePanelsProps) {
  // Szélesség betöltése localStorage-ből
  const [leftWidth, setLeftWidth] = useState(() => {
    if (typeof window === 'undefined') return defaultLeftWidth;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed >= minLeftWidth && parsed <= maxLeftWidth) {
        return parsed;
      }
    }
    return defaultLeftWidth;
  });

  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Szélesség mentése localStorage-be
  useEffect(() => {
    localStorage.setItem(storageKey, leftWidth.toString());
  }, [leftWidth, storageKey]);

  // Drag kezelés
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (clientX: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = ((clientX - rect.left) / rect.width) * 100;
      setLeftWidth(Math.max(minLeftWidth, Math.min(maxLeftWidth, newWidth)));
    };

    const handleMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX);
      }
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleEnd);

    // Prevent text selection while dragging
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging, minLeftWidth, maxLeftWidth]);

  return (
    <div ref={containerRef} className="flex h-full relative">
      {/* Bal panel (email lista) */}
      <div
        className={`
          border-r border-gray-200 dark:border-dark-border overflow-auto
          ${rightPanelActive ? 'hidden lg:block' : 'block w-full lg:w-auto'}
        `}
        style={{ width: rightPanelActive ? undefined : '100%', flex: `0 0 ${leftWidth}%` }}
      >
        <div className="hidden lg:block h-full" style={{ width: '100%' }}>
          {leftPanel}
        </div>
        <div className={`lg:hidden h-full ${rightPanelActive ? 'hidden' : 'block'}`}>
          {leftPanel}
        </div>
      </div>

      {/* Átméretező fogantyú - csak desktop */}
      <div
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        className={`
          hidden lg:flex items-center justify-center
          w-1 hover:w-1.5 bg-gray-200 dark:bg-dark-border
          hover:bg-blue-400 dark:hover:bg-blue-500
          cursor-col-resize transition-all duration-150 group
          ${isDragging ? 'w-1.5 bg-blue-500 dark:bg-blue-400' : ''}
        `}
      >
        <div
          className={`
            absolute flex items-center justify-center
            w-4 h-12 rounded-full
            bg-gray-100 dark:bg-dark-bg-tertiary
            border border-gray-300 dark:border-dark-border
            opacity-0 group-hover:opacity-100 transition-opacity
            ${isDragging ? 'opacity-100 bg-blue-100 dark:bg-blue-500/20 border-blue-400' : ''}
          `}
        >
          <GripVertical className="h-4 w-4 text-gray-400 dark:text-dark-text-muted" />
        </div>
      </div>

      {/* Jobb panel (email detail) */}
      <div
        className={`
          flex-1 min-w-0
          ${rightPanelActive
            ? 'block absolute inset-0 lg:relative lg:inset-auto bg-white dark:bg-dark-bg z-10'
            : 'hidden lg:block'
          }
        `}
      >
        {rightPanel}
      </div>
    </div>
  );
}
