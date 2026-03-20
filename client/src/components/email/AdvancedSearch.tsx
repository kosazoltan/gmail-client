import { useState } from 'react';

export interface AdvancedSearchFilters {
  from?: string;
  to?: string;
  subject?: string;
  after?: string;
  before?: string;
  hasAttachment?: boolean;
  label?: string;
  isRead?: 'read' | 'unread' | '';
}

interface Props {
  onApply: (filters: AdvancedSearchFilters) => void;
  onClose: () => void;
}

export function AdvancedSearch({ onApply, onClose }: Props) {
  const [filters, setFilters] = useState<AdvancedSearchFilters>({ isRead: '' });
  return (
    <div className="dark:bg-dark-bg-secondary dark:border-dark-border absolute top-full right-0 z-50 mt-2 w-80 rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
      <div className="grid grid-cols-1 gap-2 text-sm">
        <input
          className="dark:border-dark-border dark:bg-dark-bg-secondary dark:text-dark-text dark:placeholder-dark-text-muted rounded border px-2 py-1"
          placeholder="Feladó (from:)"
          onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value }))}
        />
        <input
          className="dark:border-dark-border dark:bg-dark-bg-secondary dark:text-dark-text dark:placeholder-dark-text-muted rounded border px-2 py-1"
          placeholder="Címzett (to:)"
          onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value }))}
        />
        <input
          className="dark:border-dark-border dark:bg-dark-bg-secondary dark:text-dark-text dark:placeholder-dark-text-muted rounded border px-2 py-1"
          placeholder="Tárgy (subject:)"
          onChange={(e) => setFilters((p) => ({ ...p, subject: e.target.value }))}
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            className="dark:border-dark-border dark:bg-dark-bg-secondary dark:text-dark-text dark:placeholder-dark-text-muted rounded border px-2 py-1"
            onChange={(e) => setFilters((p) => ({ ...p, after: e.target.value }))}
          />
          <input
            type="date"
            className="dark:border-dark-border dark:bg-dark-bg-secondary dark:text-dark-text dark:placeholder-dark-text-muted rounded border px-2 py-1"
            onChange={(e) => setFilters((p) => ({ ...p, before: e.target.value }))}
          />
        </div>
        <input
          className="dark:border-dark-border dark:bg-dark-bg-secondary dark:text-dark-text dark:placeholder-dark-text-muted rounded border px-2 py-1"
          placeholder="Label"
          onChange={(e) => setFilters((p) => ({ ...p, label: e.target.value }))}
        />
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            onChange={(e) => setFilters((p) => ({ ...p, hasAttachment: e.target.checked }))}
          />{' '}
          Van melléklet
        </label>
        <select
          className="dark:border-dark-border dark:bg-dark-bg-secondary dark:text-dark-text dark:placeholder-dark-text-muted rounded border px-2 py-1"
          onChange={(e) =>
            setFilters((p) => ({ ...p, isRead: e.target.value as 'read' | 'unread' | '' }))
          }
        >
          <option value="">Olvasottság: mindegy</option>
          <option value="read">Olvasott</option>
          <option value="unread">Olvasatlan</option>
        </select>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="dark:border-dark-border dark:hover:bg-dark-bg-tertiary rounded border px-3 py-1"
        >
          Mégse
        </button>
        <button
          onClick={() => onApply(filters)}
          className="dark:hover:bg-dark-bg-tertiary rounded bg-blue-600 px-3 py-1 text-white"
        >
          Keresés
        </button>
      </div>
    </div>
  );
}
