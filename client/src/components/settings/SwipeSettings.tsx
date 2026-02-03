import { useState } from 'react';
import {
  Trash2,
  Archive,
  Mail,
  Star,
  Clock,
  X,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { useSettings, useUpdateSetting, defaultSettings, getSwipeActionLabel, getSwipeActionColor } from '../../hooks/useSettings';
import type { SwipeAction } from '../../types';

const SWIPE_ACTIONS: SwipeAction[] = ['delete', 'archive', 'read', 'star', 'snooze', 'none'];

const ACTION_ICONS: Record<SwipeAction, React.ReactNode> = {
  delete: <Trash2 className="h-5 w-5" />,
  archive: <Archive className="h-5 w-5" />,
  read: <Mail className="h-5 w-5" />,
  star: <Star className="h-5 w-5" />,
  snooze: <Clock className="h-5 w-5" />,
  none: <X className="h-5 w-5" />,
};

interface SwipeActionSelectorProps {
  direction: 'left' | 'right';
  currentAction: SwipeAction;
  onSelect: (action: SwipeAction) => void;
  isPending: boolean;
}

function SwipeActionSelector({ direction, currentAction, onSelect, isPending }: SwipeActionSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const DirectionIcon = direction === 'left' ? ChevronLeft : ChevronRight;
  const directionLabel = direction === 'left' ? 'Balra húzás' : 'Jobbra húzás';

  return (
    <div className="bg-gray-50 dark:bg-dark-bg rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <DirectionIcon className="h-5 w-5 text-gray-500 dark:text-dark-text-muted" />
          <span className="font-medium text-gray-800 dark:text-dark-text">{directionLabel}</span>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={isPending}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-dark-border hover:bg-white dark:hover:bg-dark-bg-secondary transition-colors disabled:opacity-50"
        >
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: getSwipeActionColor(currentAction) }}
          />
          <span className="text-sm text-gray-700 dark:text-dark-text-secondary">
            {getSwipeActionLabel(currentAction)}
          </span>
        </button>
      </div>

      {isOpen && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-dark-border">
          {SWIPE_ACTIONS.map((action) => (
            <button
              key={action}
              onClick={() => {
                onSelect(action);
                setIsOpen(false);
              }}
              disabled={isPending}
              className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                currentAction === action
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                  : 'border-gray-200 dark:border-dark-border hover:bg-white dark:hover:bg-dark-bg-secondary'
              }`}
            >
              <span
                className="p-1.5 rounded"
                style={{ backgroundColor: `${getSwipeActionColor(action)}20`, color: getSwipeActionColor(action) }}
              >
                {ACTION_ICONS[action]}
              </span>
              <span className="text-sm text-gray-700 dark:text-dark-text-secondary">
                {getSwipeActionLabel(action)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Preview */}
      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-dark-border">
        <div className="text-xs text-gray-400 dark:text-dark-text-muted mb-2">Előnézet:</div>
        <div className="relative h-14 bg-white dark:bg-dark-bg-secondary rounded-lg border border-gray-200 dark:border-dark-border overflow-hidden">
          {/* Background action indicator */}
          <div
            className={`absolute inset-y-0 ${direction === 'left' ? 'right-0' : 'left-0'} w-16 flex items-center ${direction === 'left' ? 'justify-end pr-3' : 'justify-start pl-3'}`}
            style={{ backgroundColor: getSwipeActionColor(currentAction) }}
          >
            <span className="text-white">{ACTION_ICONS[currentAction]}</span>
          </div>

          {/* Fake email item */}
          <div
            className="absolute inset-0 bg-white dark:bg-dark-bg-secondary flex items-center px-4 gap-3 transition-transform"
            style={{ transform: `translateX(${direction === 'left' ? '-40px' : '40px'})` }}
          >
            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-dark-bg-tertiary" />
            <div className="flex-1">
              <div className="h-3 w-24 bg-gray-200 dark:bg-dark-bg-tertiary rounded mb-1" />
              <div className="h-2 w-32 bg-gray-100 dark:bg-dark-bg rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SwipeSettings() {
  const { data: settings } = useSettings();
  const updateSetting = useUpdateSetting();

  const leftAction = settings?.swipeLeftAction || defaultSettings.swipeLeftAction!;
  const rightAction = settings?.swipeRightAction || defaultSettings.swipeRightAction!;

  const handleLeftActionChange = (action: SwipeAction) => {
    updateSetting.mutate({ key: 'swipeLeftAction', value: action });
  };

  const handleRightActionChange = (action: SwipeAction) => {
    updateSetting.mutate({ key: 'swipeRightAction', value: action });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium text-gray-800 dark:text-dark-text mb-1">
          Swipe műveletek
        </h3>
        <p className="text-sm text-gray-500 dark:text-dark-text-muted mb-4">
          Testreszabhatod, hogy mi történjen, amikor balra vagy jobbra húzod az emaileket.
        </p>
      </div>

      <div className="space-y-3">
        <SwipeActionSelector
          direction="left"
          currentAction={leftAction}
          onSelect={handleLeftActionChange}
          isPending={updateSetting.isPending}
        />

        <SwipeActionSelector
          direction="right"
          currentAction={rightAction}
          onSelect={handleRightActionChange}
          isPending={updateSetting.isPending}
        />
      </div>

      <div className="text-xs text-gray-400 dark:text-dark-text-muted pt-2 border-t border-gray-100 dark:border-dark-border">
        Tipp: A swipe műveletek csak mobilon és érintőképernyőn működnek, de asztali gépen is kipróbálhatod egérrel.
      </div>
    </div>
  );
}
