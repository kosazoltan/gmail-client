import { useState, useEffect } from 'react';
// responsive-tuned: mobile-first touch sizing
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

type ActionId = (typeof allActions)[number]['id'];

// BUG #10 Fix: Validate action IDs at runtime
const validActionIds = new Set(allActions.map((a) => a.id));
function filterValidActionIds(actions: unknown): ActionId[] {
  if (!Array.isArray(actions)) return [];
  return actions.filter(
    (a): a is ActionId => typeof a === 'string' && validActionIds.has(a as ActionId),
  );
}

export function ToolbarSettings() {
  const { data: settings } = useSettings();
  const updateSetting = useUpdateSetting();

  const currentActions =
    filterValidActionIds(settings?.toolbarActions) ||
    (defaultSettings.toolbarActions as ActionId[]);
  const [visibleActions, setVisibleActions] = useState<ActionId[]>(currentActions);
  const [draggedItem, setDraggedItem] = useState<ActionId | null>(null);

  // Sync with settings when loaded
  useEffect(() => {
    if (settings?.toolbarActions) {
      // BUG #10 Fix: Validate when syncing from settings
      queueMicrotask(() => setVisibleActions(filterValidActionIds(settings.toolbarActions)));
    }
  }, [settings?.toolbarActions]);

  const hiddenActions = allActions.filter((a) => !visibleActions.includes(a.id)).map((a) => a.id);

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
      ? visibleActions.filter((a) => a !== actionId)
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
          <h3 className="dark:text-dark-text mb-1 text-lg font-medium text-gray-800">
            Eszköztár testreszabása
          </h3>
          <p className="dark:text-dark-text-muted text-sm text-gray-500">
            Rendezd át és válaszd ki a megjelenő eszköztár gombokat az email nézetben.
          </p>
        </div>
        <button
          onClick={resetToDefault}
          className="dark:text-dark-text-muted dark:hover:text-dark-text dark:hover:bg-dark-bg-tertiary flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          title="Alapértelmezett visszaállítása"
        >
          <RotateCcw className="h-4 w-4" />
          Alapértelmezett
        </button>
      </div>

      {/* Visible actions - draggable list */}
      <div className="space-y-2">
        <div className="dark:text-dark-text-secondary flex items-center gap-2 text-sm font-medium text-gray-600">
          <Eye className="h-4 w-4" />
          Látható gombok
        </div>
        <div
          className="dark:bg-dark-bg min-h-[100px] rounded-lg bg-gray-50 p-2"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, visibleActions.length)}
        >
          {visibleActions.length === 0 ? (
            <div className="dark:text-dark-text-muted flex h-20 items-center justify-center text-sm text-gray-400">
              Húzz ide gombokat a megjelenítéshez
            </div>
          ) : (
            <div className="space-y-1">
              {visibleActions.map((actionId, index) => {
                const action = allActions.find((a) => a.id === actionId);
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
                      'dark:bg-dark-bg-secondary dark:border-dark-border flex cursor-move items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 transition-all',
                      draggedItem === actionId && 'scale-95 opacity-50',
                    )}
                  >
                    <GripVertical className="dark:text-dark-text-muted h-4 w-4 text-gray-400" />
                    <Icon className="dark:text-dark-text-secondary h-4 w-4 text-gray-600" />
                    <span className="dark:text-dark-text flex-1 text-sm text-gray-700">
                      {action.label}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveAction(actionId, 'up')}
                        disabled={index === 0}
                        className="dark:hover:bg-dark-bg-tertiary rounded p-1 hover:bg-gray-100 disabled:opacity-30"
                        title="Mozgatás felfelé"
                      >
                        <svg
                          className="h-3 w-3 text-gray-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 15l7-7 7 7"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => moveAction(actionId, 'down')}
                        disabled={index === visibleActions.length - 1}
                        className="dark:hover:bg-dark-bg-tertiary rounded p-1 hover:bg-gray-100 disabled:opacity-30"
                        title="Mozgatás lefelé"
                      >
                        <svg
                          className="h-3 w-3 text-gray-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => toggleAction(actionId)}
                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
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
          <div className="dark:text-dark-text-secondary flex items-center gap-2 text-sm font-medium text-gray-600">
            <EyeOff className="h-4 w-4" />
            Rejtett gombok
          </div>
          <div className="flex flex-wrap gap-2">
            {hiddenActions.map((actionId) => {
              const action = allActions.find((a) => a.id === actionId);
              if (!action) return null;
              const Icon = action.icon;

              return (
                <button
                  key={actionId}
                  onClick={() => toggleAction(actionId)}
                  draggable
                  onDragStart={(e) => handleDragStart(e, actionId)}
                  onDragEnd={handleDragEnd}
                  className="dark:bg-dark-bg-tertiary dark:text-dark-text-secondary dark:hover:bg-dark-border flex cursor-move items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-200"
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
      <div className="dark:border-dark-border space-y-2 border-t border-gray-100 pt-2">
        <div className="dark:text-dark-text-secondary text-sm font-medium text-gray-600">
          Előnézet
        </div>
        <div className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-lg border border-gray-200 bg-white p-2">
          <div className="flex items-center gap-1">
            {visibleActions.map((actionId) => {
              const action = allActions.find((a) => a.id === actionId);
              if (!action) return null;
              const Icon = action.icon;

              return (
                <div
                  key={actionId}
                  className="dark:bg-dark-bg-tertiary dark:text-dark-text-secondary rounded-full bg-gray-100 p-2 text-gray-600"
                  title={action.label}
                >
                  <Icon className="h-4 w-4" />
                </div>
              );
            })}
            {visibleActions.length === 0 && (
              <span className="dark:text-dark-text-muted px-2 text-sm text-gray-400">
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
            className="rounded-lg bg-[#4f6ef7] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#3d5ce5] disabled:opacity-50"
          >
            {updateSetting.isPending ? 'Mentés...' : 'Változások mentése'}
          </button>
        </div>
      )}

      <div className="dark:text-dark-text-muted dark:border-dark-border border-t border-gray-100 pt-2 text-xs text-gray-400">
        Tipp: A gombokat húzással is átrendezheted.
      </div>
    </div>
  );
}
