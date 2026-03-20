import { useEffect, useState } from 'react';

interface BulkActionBarProps {
  selectedIds: string[];
  onArchive: () => void;
  onDelete: () => void;
  onMarkRead: () => void;
  onMarkUnread: () => void;
  onStar: () => void;
  onClearSelection: () => void;
  onSelectAll: () => void;
  totalCount: number;
  onLabel?: () => void;
  onSpam?: () => void;
}

export function BulkActionBar({
  selectedIds,
  onArchive,
  onDelete,
  onMarkRead,
  onMarkUnread,
  onStar,
  onClearSelection,
  onSelectAll,
  totalCount,
  onLabel,
  onSpam,
}: BulkActionBarProps) {
  const [undoActive, setUndoActive] = useState(false);

  useEffect(() => {
    if (selectedIds.length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUndoActive(true);
    const timer = window.setTimeout(() => setUndoActive(false), 10000);
    return () => window.clearTimeout(timer);
  }, [selectedIds.length]);

  if (selectedIds.length === 0) return null;

  return (
    <div className="dark:border-dark-border dark:bg-dark-bg-tertiary/95 sticky top-0 z-20 border-b border-blue-200 bg-blue-50/95 px-3 py-2 backdrop-blur">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="dark:text-dark-text font-medium text-blue-800">
          {selectedIds.length} email kijelölve
        </span>
        <button
          onClick={onArchive}
          className="dark:hover:bg-dark-bg-tertiary rounded px-2 py-1 hover:bg-blue-100"
        >
          Archívum
        </button>
        <button
          onClick={onDelete}
          className="rounded px-2 py-1 text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-500/20"
        >
          Törlés
        </button>
        <button
          onClick={onMarkRead}
          className="dark:hover:bg-dark-bg-tertiary rounded px-2 py-1 hover:bg-blue-100"
        >
          Olvasott
        </button>
        <button
          onClick={onMarkUnread}
          className="dark:hover:bg-dark-bg-tertiary rounded px-2 py-1 hover:bg-blue-100"
        >
          Olvasatlan
        </button>
        <button
          onClick={onStar}
          className="dark:hover:bg-dark-bg-tertiary rounded px-2 py-1 hover:bg-blue-100"
        >
          Csillag
        </button>
        <button
          onClick={onLabel}
          className="dark:hover:bg-dark-bg-tertiary rounded px-2 py-1 hover:bg-blue-100"
        >
          Label
        </button>
        <button
          onClick={onSpam}
          className="dark:hover:bg-dark-bg-tertiary rounded px-2 py-1 hover:bg-blue-100"
        >
          Spam
        </button>
        <button
          onClick={onSelectAll}
          className="dark:hover:bg-dark-bg-tertiary rounded px-2 py-1 hover:bg-blue-100"
        >
          Összes kijelölése
        </button>
        <button
          onClick={onClearSelection}
          className="dark:hover:bg-dark-bg-tertiary rounded px-2 py-1 hover:bg-blue-100"
        >
          Kijelölés törlése
        </button>
        <span className="dark:text-dark-text-muted ml-auto text-xs text-gray-500">
          Összesen: {totalCount}
        </span>
        <button
          onClick={onClearSelection}
          disabled={!undoActive}
          className="dark:bg-dark-bg disabled:dark:bg-dark-bg rounded bg-gray-100 px-2 py-1 disabled:opacity-50"
        >
          Visszavonás
        </button>
      </div>
    </div>
  );
}
