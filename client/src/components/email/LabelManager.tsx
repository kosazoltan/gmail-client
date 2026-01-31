import { useState, useCallback, useMemo } from 'react';
import { useLabels, useAddLabelToEmail, useRemoveLabelFromEmail, useCreateLabel } from '../../hooks/useLabels';
import { Tag, Plus, Check, X, Loader2 } from 'lucide-react';
import type { GmailLabel } from '../../types';

interface LabelManagerProps {
  emailId: string;
  currentLabels: string[];
  onClose: () => void;
}

// Konstansok - kiemelve a komponensből a teljesítmény és újrahasználhatóság érdekében
const SYSTEM_LABEL_IDS = ['INBOX', 'SENT', 'DRAFT', 'TRASH', 'SPAM', 'STARRED', 'IMPORTANT', 'UNREAD'] as const;
const SHOWN_SYSTEM_LABELS = ['INBOX', 'STARRED', 'IMPORTANT'] as const;

const SYSTEM_LABEL_NAMES: Readonly<Record<string, string>> = {
  INBOX: 'Beérkezett',
  SENT: 'Elküldött',
  DRAFT: 'Piszkozat',
  TRASH: 'Kuka',
  SPAM: 'Spam',
  STARRED: 'Csillagozott',
  IMPORTANT: 'Fontos',
  UNREAD: 'Olvasatlan',
};

const SYSTEM_LABEL_COLORS: Readonly<Record<string, string>> = {
  INBOX: '#4285f4',
  SENT: '#34a853',
  DRAFT: '#fbbc05',
  TRASH: '#ea4335',
  SPAM: '#ea4335',
  STARRED: '#fbbc05',
  IMPORTANT: '#fbbc05',
};

const DEFAULT_LABEL_COLOR = '#6b7280';

// Helper függvények - kiemelve a komponensből
function getLabelDisplayName(label: GmailLabel): string {
  if ((SYSTEM_LABEL_IDS as readonly string[]).includes(label.id)) {
    return SYSTEM_LABEL_NAMES[label.id] ?? label.name;
  }
  return label.name;
}

function getLabelColor(label: GmailLabel): string {
  if (label.color?.backgroundColor) {
    return label.color.backgroundColor;
  }
  if ((SYSTEM_LABEL_IDS as readonly string[]).includes(label.id)) {
    return SYSTEM_LABEL_COLORS[label.id] ?? DEFAULT_LABEL_COLOR;
  }
  return DEFAULT_LABEL_COLOR;
}

export function LabelManager({ emailId, currentLabels, onClose }: LabelManagerProps) {
  const { data, isLoading, error: labelsError } = useLabels();
  const addLabel = useAddLabelToEmail();
  const removeLabel = useRemoveLabelFromEmail();
  const createLabel = useCreateLabel();

  const [showNewLabel, setShowNewLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');

  const labels = data?.labels ?? [];

  // Memoizált szűrés a teljesítmény érdekében
  const { userLabels, systemLabels } = useMemo(() => ({
    userLabels: labels.filter((l) => l.type === 'user'),
    systemLabels: labels.filter(
      (l) => l.type === 'system' && (SHOWN_SYSTEM_LABELS as readonly string[]).includes(l.id)
    ),
  }), [labels]);

  const handleToggleLabel = useCallback((label: GmailLabel) => {
    const isActive = currentLabels.includes(label.id);

    if (isActive) {
      removeLabel.mutate({ emailId, labelIds: [label.id] });
    } else {
      addLabel.mutate({ emailId, labelIds: [label.id] });
    }
  }, [emailId, currentLabels, addLabel, removeLabel]);

  const handleCreateLabel = useCallback(() => {
    const trimmedName = newLabelName.trim();
    if (!trimmedName) return;

    createLabel.mutate(
      { name: trimmedName },
      {
        onSuccess: () => {
          setNewLabelName('');
          setShowNewLabel(false);
        },
      },
    );
  }, [newLabelName, createLabel]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreateLabel();
    } else if (e.key === 'Escape') {
      setShowNewLabel(false);
    }
  }, [handleCreateLabel]);

  const isPending = addLabel.isPending || removeLabel.isPending;

  return (
    <div className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-dark-bg-secondary rounded-lg shadow-lg border border-gray-200 dark:border-dark-border z-50">
      <div className="p-3 border-b border-gray-200 dark:border-dark-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium dark:text-dark-text">Címkék</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary rounded"
          type="button"
          aria-label="Bezárás"
        >
          <X className="h-4 w-4 text-gray-400" />
        </button>
      </div>

      {isLoading ? (
        <div className="p-4 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
        </div>
      ) : labelsError ? (
        <div className="p-4 text-sm text-red-500 text-center">
          Hiba a címkék betöltésekor
        </div>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto">
          {/* Rendszer címkék */}
          {systemLabels.length > 0 && (
            <div className="p-2 border-b border-gray-100 dark:border-dark-border">
              <div className="text-xs text-gray-400 uppercase mb-1 px-2">Rendszer</div>
              {systemLabels.map((label) => {
                const isActive = currentLabels.includes(label.id);
                return (
                  <button
                    key={label.id}
                    onClick={() => handleToggleLabel(label)}
                    disabled={isPending}
                    type="button"
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary disabled:opacity-50"
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: getLabelColor(label) }}
                    />
                    <span className="flex-1 text-left text-sm dark:text-dark-text">
                      {getLabelDisplayName(label)}
                    </span>
                    {isActive && <Check className="h-4 w-4 text-green-500 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Felhasználói címkék */}
          <div className="p-2">
            {userLabels.length > 0 ? (
              <>
                <div className="text-xs text-gray-400 uppercase mb-1 px-2">Saját címkék</div>
                {userLabels.map((label) => {
                  const isActive = currentLabels.includes(label.id);
                  return (
                    <button
                      key={label.id}
                      onClick={() => handleToggleLabel(label)}
                      disabled={isPending}
                      type="button"
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary disabled:opacity-50"
                    >
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: getLabelColor(label) }}
                      />
                      <span className="flex-1 text-left text-sm dark:text-dark-text truncate">
                        {label.name}
                      </span>
                      {isActive && <Check className="h-4 w-4 text-green-500 flex-shrink-0" />}
                    </button>
                  );
                })}
              </>
            ) : (
              <div className="text-xs text-gray-400 px-2 py-2">Nincsenek saját címkék</div>
            )}
          </div>
        </div>
      )}

      {/* Új címke létrehozása */}
      <div className="p-2 border-t border-gray-200 dark:border-dark-border">
        {showNewLabel ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newLabelName}
              onChange={(e) => setNewLabelName(e.target.value)}
              placeholder="Címke neve..."
              className="flex-1 px-2 py-1 text-sm border border-gray-200 dark:border-dark-border rounded bg-transparent dark:text-dark-text"
              autoFocus
              onKeyDown={handleKeyDown}
              maxLength={100}
            />
            <button
              onClick={handleCreateLabel}
              disabled={!newLabelName.trim() || createLabel.isPending}
              type="button"
              className="p-1 text-green-500 hover:bg-green-50 dark:hover:bg-green-500/20 rounded disabled:opacity-50"
              aria-label="Mentés"
            >
              {createLabel.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={() => setShowNewLabel(false)}
              type="button"
              className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary rounded"
              aria-label="Mégse"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowNewLabel(true)}
            type="button"
            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/20 rounded"
          >
            <Plus className="h-4 w-4" />
            Új címke létrehozása
          </button>
        )}
      </div>
    </div>
  );
}
