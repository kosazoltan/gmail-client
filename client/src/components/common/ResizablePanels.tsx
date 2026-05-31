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
  defaultLeftWidth = 38,
  minLeftWidth = 25,
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
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    const isFold = /SM-F9[56789]\d|Galaxy Z Fold|ZFold|z fold/i.test(navigator.userAgent);
    return window.innerWidth < (isFold ? 680 : 768);
  });
  const containerRef = useRef<HTMLDivElement>(null);

  // Szélesség mentése localStorage-be
  useEffect(() => {
    localStorage.setItem(storageKey, leftWidth.toString());
  }, [leftWidth, storageKey]);

  // Mobil nézet detektálás (lista legyen teljes szélességben)
  useEffect(() => {
    const onResize = () => {
      const isFold = /SM-F9[56789]\d|Galaxy Z Fold|ZFold|z fold/i.test(navigator.userAgent);
      setIsMobile(window.innerWidth < (isFold ? 680 : 768));
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
    <div ref={containerRef} className="relative flex h-full">
      {/* Bal panel (email lista) */}
      <div
        className={`dark:border-dark-border h-full overflow-auto border-r border-gray-200 ${rightPanelActive ? 'hidden md:block' : 'block'} `}
        style={{
          flex: `0 0 ${isMobile ? 100 : leftWidth}%`,
          maxWidth: rightPanelActive ? undefined : '100%',
        }}
      >
        {leftPanel}
      </div>

      {/* Átméretező fogantyú - tablet és desktop */}
      <div
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        className={`dark:bg-dark-border group hidden w-2 cursor-col-resize items-center justify-center bg-gray-200 transition-all duration-150 hover:w-2 hover:bg-blue-400 md:flex md:w-1 md:hover:w-1.5 dark:hover:bg-blue-500 ${isDragging ? 'w-2 bg-blue-500 md:w-1.5 dark:bg-blue-400' : ''} `}
      >
        <div
          className={`dark:bg-dark-bg-tertiary dark:border-dark-border absolute flex h-14 w-5 items-center justify-center rounded-full border border-gray-300 bg-gray-100 opacity-100 transition-opacity md:h-12 md:w-4 md:opacity-0 md:group-hover:opacity-100 ${isDragging ? 'border-blue-400 bg-blue-100 opacity-100 dark:bg-blue-500/20' : ''} `}
        >
          <GripVertical className="dark:text-dark-text-muted h-5 w-5 text-gray-400 md:h-4 md:w-4" />
        </div>
      </div>

      {/* Jobb panel (email detail) */}
      <div
        className={`min-w-0 flex-1 ${
          rightPanelActive
            ? 'dark:bg-dark-bg absolute inset-0 z-10 block bg-white md:relative md:inset-auto'
            : 'hidden md:block'
        } `}
      >
        {rightPanel}
      </div>
    </div>
  );
}
