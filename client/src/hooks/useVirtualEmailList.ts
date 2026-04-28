/**
 * Virtual email list hook using @tanstack/react-virtual.
 * Renders only visible rows — enables 10K+ email lists without DOM bloat.
 */
import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual';
import { useCallback, useRef } from 'react';

export interface VirtualEmailListOptions {
  /** Total number of items */
  count: number;
  /** Estimated row height in px (default: 72) */
  estimateSize?: number;
  /** Extra rows to render above/below viewport (default: 5) */
  overscan?: number;
  /** Callback when nearing the end of the list */
  onLoadMore?: () => void;
  /** How many items from the end to trigger onLoadMore (default: 10) */
  loadMoreThreshold?: number;
}

export function useVirtualEmailList(options: VirtualEmailListOptions) {
  const { count, estimateSize = 72, overscan = 5, onLoadMore, loadMoreThreshold = 10 } = options;

  const parentRef = useRef<HTMLDivElement>(null);

  // TanStack Virtual intentionally returns imperative helpers that React Compiler cannot memoize safely.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
    onChange: (instance) => {
      if (!onLoadMore) return;
      const items = instance.getVirtualItems();
      if (items.length === 0) return;
      const lastItem = items[items.length - 1];
      if (lastItem.index >= count - loadMoreThreshold) {
        onLoadMore();
      }
    },
  });

  const scrollToIndex = useCallback(
    (index: number, options?: { align?: 'start' | 'center' | 'end' | 'auto' }) => {
      virtualizer.scrollToIndex(index, options);
    },
    [virtualizer],
  );

  return {
    parentRef,
    virtualizer,
    virtualItems: virtualizer.getVirtualItems() as VirtualItem[],
    totalSize: virtualizer.getTotalSize(),
    scrollToIndex,
  };
}
