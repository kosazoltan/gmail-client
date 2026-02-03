import { useState, useEffect } from 'react';
import { useSettings, useUpdateSetting, defaultSettings } from '../../hooks/useSettings';
import { cn } from '../../lib/utils';
import {
  GripVertical,
  Reply,
  ReplyAll,
  Forward,
  Star,
  Trash2,
  Clock,
  Bell,
  Tag,
  Archive,
  Eye,
  EyeOff,
  RotateCcw,
} from 'lucide-react';

// All available toolbar actions
const allActions = [
  { id: 'reply', label: 'Válasz', icon: Reply },
  { id: 'reply-all', label: 'Válasz mindenkinek', icon: ReplyAll },
  { id: 'forward', label: 'Továbbítás', icon: Forward },
  { id: 'star', label: 'Csillag', icon: Star },
  { id: 'delete', label: 'Törlés', icon: Trash2 },
  { id: 'archive', label: 'Archiválás', icon: Archive },
  { id: 'snooze', label: 'Szundi', icon: Clock },
  { id: 'remind', label: 'Emlékeztető', icon: Bell },
  { id: 'labels', label: 'Címkék', icon: Tag },
] as const;

type ActionId = typeof allActions[number]['id'];

// BUG #10 Fix: Validate action IDs at runtime
const validActionIds = new Set(allActions.map(a => a.id));
function filterValidActionIds(actions: unknown): ActionId[] {
  if (!Array.isArray(actions)) return [];
  return actions.filter((a): a is ActionId =>
    typeof a === 'string' && validActionIds.has(a as ActionId)
  );
}

export function ToolbarSettings() {
  const { data: settings } = useSettings();
  const updateSetting = useUpdateSetting();

  const currentActions = filterValidActionIds(settings?.toolbarActions) || (defaultSettings.toolbarActions as ActionId[]);
  const [visibleActions, setVisibleActions] = useState<ActionId[]>(currentActions);
  const [draggedItem, setDraggedItem] = useState<ActionId | null>(null);

  // Sync with settings when loaded
  useEffect(() => {
    if (settings?.toolbarActions) {
      // BUG #10 Fix: Validate when syncing from settings
      setVisibleActions(filterValidActionIds(settings.toolbarActions));
    }
  }, [settings?.toolbarActions]);

  const hiddenActions = allActions.filter(a => !visibleActions.includes(a.id)).map(a => a.id);

  const handleDragStart = (e: React.DragEvent, actionId: ActionId) => {
    setDraggedItem(actionId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (!draggedItem) return;

    const newActions = [...visibleActions];
    const currentIndex = newActions.indexOf(draggedItem);

    if (currentIndex === -1) {
      // Adding from hidden
      newActions.splice(targetIndex, 0, draggedItem);
    } else {
      // Reordering
      newActions.splice(currentIndex, 1);
      newActions.splice(targetIndex, 0, draggedItem);
    }

    setVisibleActions(newActions);
    setDraggedItem(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const toggleAction = (actionId: ActionId) => {
    const newActions = visibleActions.includes(actionId)
      ? visibleActions.filter(a => a !== actionId)
      : [...visibleActions, actionId];
    setVisibleActions(newActions);
  };

  const moveAction = (actionId: ActionId, direction: 'up' | 'down') => {
    const index = visibleActions.indexOf(actionId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= visibleActions.length) return;

    const newActions = [...visibleActions];
    [newActions[index], newActions[newIndex]] = [newActions[newIndex], newActions[index]];
    setVisibleActions(newActions);
  };

  const resetToDefault = () => {
    setVisibleActions(defaultSettings.toolbarActions as ActionId[]);
  };

  const saveSettings = () => {
    updateSetting.mutate({ key: 'toolbarActions', value: visibleActions });
  };

  const hasChanges = JSON.stringify(visibleActions) !== JSON.stringify(currentActions);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-800 dark:text-dark-text mb-1">
            Eszköztár testreszabása
          </h3>
          <p className="text-sm text-gray-500 dark:text-dark-text-muted">
            Rendezd át és válaszd ki a megjelenő eszköztár gombokat az email nézetben.
          </p>
        </div>
        <button
          onClick={resetToDefault}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 dark:text-dark-text-muted hover:text-gray-700 dark:hover:text-dark-text hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary rounded-lg transition-colors"
          title="Alapértelmezett visszaállítása"
        >
          <RotateCcw className="h-4 w-4" />
          Alapértelmezett
        </button>
      </div>

      {/* Visible actions - draggable list */}
      <div className="space-y-2">
        <div className="text-sm font-medium text-gray-600 dark:text-dark-text-secondary flex items-center gap-2">
          <Eye className="h-4 w-4" />
          Látható gombok
        </div>
        <div
          className="bg-gray-50 dark:bg-dark-bg rounded-lg p-2 min-h-[100px]"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, visibleActions.length)}
        >
          {visibleActions.length === 0 ? (
            <div className="flex items-center justify-center h-20 text-sm text-gray-400 dark:text-dark-text-muted">
              Húzz ide gombokat a megjelenítéshez
            </div>
          ) : (
            <div className="space-y-1">
              {visibleActions.map((actionId, index) => {
                const action = allActions.find(a => a.id === actionId);
                if (!action) return null;
                const Icon = action.icon;

                return (
                  <div
                    key={actionId}
                    draggable
                    onDragStart={(e) => handleDragStart(e, actionId)}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    className={cn(
                      'flex items-center gap-2 p-2 bg-white dark:bg-dark-bg-secondary rounded-lg border border-gray-200 dark:border-dark-border cursor-move transition-all',
                      draggedItem === actionId && 'opacity-50 scale-95'
                    )}
                  >
                    <GripVertical className="h-4 w-4 text-gray-400 dark:text-dark-text-muted" />
                    <Icon className="h-4 w-4 text-gray-600 dark:text-dark-text-secondary" />
                    <span className="flex-1 text-sm text-gray-700 dark:text-dark-text">
                      {action.label}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveAction(actionId, 'up')}
                        disabled={index === 0}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary rounded disabled:opacity-30"
                        title="Mozgatás felfelé"
                      >
                        <svg className="h-3 w-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => moveAction(actionId, 'down')}
                        disabled={index === visibleActions.length - 1}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary rounded disabled:opacity-30"
                        title="Mozgatás lefelé"
                      >
                        <svg className="h-3 w-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => toggleAction(actionId)}
                        className="p-1 hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-500 rounded"
                        title="Elrejtés"
                      >
                        <EyeOff className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Hidden actions */}
      {hiddenActions.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-600 dark:text-dark-text-secondary flex items-center gap-2">
            <EyeOff className="h-4 w-4" />
            Rejtett gombok
          </div>
          <div className="flex flex-wrap gap-2">
            {hiddenActions.map((actionId) => {
              const action = allActions.find(a => a.id === actionId);
              if (!action) return null;
              const Icon = action.icon;

              return (
                <button
                  key={actionId}
                  onClick={() => toggleAction(actionId)}
                  draggable
                  onDragStart={(e) => handleDragStart(e, actionId)}
                  onDragEnd={handleDragEnd}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-dark-bg-tertiary text-gray-600 dark:text-dark-text-secondary hover:bg-gray-200 dark:hover:bg-dark-border rounded-lg text-sm transition-colors cursor-move"
                  title="Kattints a megjelenítéshez vagy húzd a kívánt helyre"
                >
                  <Icon className="h-4 w-4" />
                  {action.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Preview */}
      <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-dark-border">
        <div className="text-sm font-medium text-gray-600 dark:text-dark-text-secondary">
          Előnézet
        </div>
        <div className="bg-white dark:bg-dark-bg-secondary border border-gray-200 dark:border-dark-border rounded-lg p-2">
          <div className="flex items-center gap-1">
            {visibleActions.map((actionId) => {
              const action = allActions.find(a => a.id === actionId);
              if (!action) return null;
              const Icon = action.icon;

              return (
                <div
                  key={actionId}
                  className="p-2 rounded-full bg-gray-100 dark:bg-dark-bg-tertiary text-gray-600 dark:text-dark-text-secondary"
                  title={action.label}
                >
                  <Icon className="h-4 w-4" />
                </div>
              );
            })}
            {visibleActions.length === 0 && (
              <span className="text-sm text-gray-400 dark:text-dark-text-muted px-2">
                Nincs látható gomb
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Save button */}
      {hasChanges && (
        <div className="flex justify-end pt-2">
          <button
            onClick={saveSettings}
            disabled={updateSetting.isPending}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 text-sm font-medium transition-colors"
          >
            {updateSetting.isPending ? 'Mentés...' : 'Változások mentése'}
          </button>
        </div>
      )}

      <div className="text-xs text-gray-400 dark:text-dark-text-muted pt-2 border-t border-gray-100 dark:border-dark-border">
        Tipp: A gombokat húzással is átrendezheted.
      </div>
    </div>
  );
}
