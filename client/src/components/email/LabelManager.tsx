import { useState } from 'react';
import { useLabels, useAddLabelToEmail, useRemoveLabelFromEmail, useCreateLabel } from '../../hooks/useLabels';
import { Tag, Plus, Check, X, Loader2 } from 'lucide-react';
import type { GmailLabel } from '../../types';

interface LabelManagerProps {
  emailId: string;
  currentLabels: string[];
  onClose: () => void;
}

// Rendszer címkék szép nevei
const SYSTEM_LABEL_NAMES: Record<string, string> = {
  INBOX: 'Beérkezett',
  SENT: 'Elküldött',
  DRAFT: 'Piszkozat',
  TRASH: 'Kuka',
  SPAM: 'Spam',
  STARRED: 'Csillagozott',
  IMPORTANT: 'Fontos',
  UNREAD: 'Olvasatlan',
};

// Rendszer címkék színei
const SYSTEM_LABEL_COLORS: Record<string, string> = {
  INBOX: '#4285f4',
  SENT: '#34a853',
  DRAFT: '#fbbc05',
  TRASH: '#ea4335',
  SPAM: '#ea4335',
  STARRED: '#fbbc05',
  IMPORTANT: '#fbbc05',
};

export function LabelManager({ emailId, currentLabels, onClose }: LabelManagerProps) {
  const { data, isLoading } = useLabels();
  const addLabel = useAddLabelToEmail();
  const removeLabel = useRemoveLabelFromEmail();
  const createLabel = useCreateLabel();

  const [showNewLabel, setShowNewLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');

  const labels = data?.labels || [];

  // Rendszer címkék ID-i
  const SYSTEM_LABEL_IDS = ['INBOX', 'SENT', 'DRAFT', 'TRASH', 'SPAM', 'STARRED', 'IMPORTANT', 'UNREAD'];
  const SHOWN_SYSTEM_LABELS = ['INBOX', 'STARRED', 'IMPORTANT'];

  // Szűrjük ki a felhasználói és rendszer címkéket
  const userLabels = labels.filter((l) => !SYSTEM_LABEL_IDS.includes(l.id));
  const systemLabels = labels.filter((l) => SHOWN_SYSTEM_LABELS.includes(l.id));

  const handleToggleLabel = (label: GmailLabel) => {
    const isActive = currentLabels.includes(label.id);

    if (isActive) {
      removeLabel.mutate({ emailId, labelIds: [label.id] });
    } else {
      addLabel.mutate({ emailId, labelIds: [label.id] });
    }
  };

  const handleCreateLabel = () => {
    if (!newLabelName.trim()) return;

    createLabel.mutate(
      { name: newLabelName.trim() },
      {
        onSuccess: () => {
          setNewLabelName('');
          setShowNewLabel(false);
        },
      },
    );
  };

  const getLabelDisplayName = (label: GmailLabel) => {
    if (SYSTEM_LABEL_IDS.includes(label.id)) {
      return SYSTEM_LABEL_NAMES[label.id] || label.name;
    }
    return label.name;
  };

  const getLabelColor = (label: GmailLabel) => {
    if (label.color?.backgroundColor) {
      return label.color.backgroundColor;
    }
    if (SYSTEM_LABEL_IDS.includes(label.id)) {
      return SYSTEM_LABEL_COLORS[label.id] || '#6b7280';
    }
    return '#6b7280';
  };

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
        >
          <X className="h-4 w-4 text-gray-400" />
        </button>
      </div>

      {isLoading ? (
        <div className="p-4 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto">
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
                    disabled={addLabel.isPending || removeLabel.isPending}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary disabled:opacity-50"
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: getLabelColor(label) }}
                    />
                    <span className="flex-1 text-left text-sm dark:text-dark-text">
                      {getLabelDisplayName(label)}
                    </span>
                    {isActive && <Check className="h-4 w-4 text-green-500" />}
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
                      disabled={addLabel.isPending || removeLabel.isPending}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary disabled:opacity-50"
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: getLabelColor(label) }}
                      />
                      <span className="flex-1 text-left text-sm dark:text-dark-text truncate">
                        {label.name}
                      </span>
                      {isActive && <Check className="h-4 w-4 text-green-500" />}
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
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateLabel();
                if (e.key === 'Escape') setShowNewLabel(false);
              }}
            />
            <button
              onClick={handleCreateLabel}
              disabled={!newLabelName.trim() || createLabel.isPending}
              className="p-1 text-green-500 hover:bg-green-50 dark:hover:bg-green-500/20 rounded disabled:opacity-50"
            >
              {createLabel.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={() => setShowNewLabel(false)}
              className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary rounded"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowNewLabel(true)}
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
