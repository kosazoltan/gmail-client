import { useState } from 'react';
// responsive-tuned: mobile-first touch sizing
import { Trash2, Archive, Mail, Star, Clock, X, ChevronRight, ChevronLeft } from 'lucide-react';
import {
  useSettings,
  useUpdateSetting,
  defaultSettings,
  getSwipeActionLabel,
  getSwipeActionColor,
} from '../../hooks/useSettings';
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

function SwipeActionSelector({
  direction,
  currentAction,
  onSelect,
  isPending,
}: SwipeActionSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const DirectionIcon = direction === 'left' ? ChevronLeft : ChevronRight;
  const directionLabel = direction === 'left' ? 'Balra húzás' : 'Jobbra húzás';

  return (
    <div className="dark:bg-dark-bg rounded-lg bg-gray-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DirectionIcon className="dark:text-dark-text-muted h-5 w-5 text-gray-500" />
          <span className="dark:text-dark-text font-medium text-gray-800">{directionLabel}</span>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={isPending}
          className="dark:border-dark-border dark:hover:bg-dark-bg-secondary flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 transition-colors hover:bg-white disabled:opacity-50"
        >
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: getSwipeActionColor(currentAction) }}
          />
          <span className="dark:text-dark-text-secondary text-sm text-gray-700">
            {getSwipeActionLabel(currentAction)}
          </span>
        </button>
      </div>

      {isOpen && (
        <div className="dark:border-dark-border mt-3 grid grid-cols-2 gap-2 border-t border-gray-200 pt-3 sm:grid-cols-3">
          {SWIPE_ACTIONS.map((action) => (
            <button
              key={action}
              onClick={() => {
                onSelect(action);
                setIsOpen(false);
              }}
              disabled={isPending}
              className={`flex items-center gap-2 rounded-lg border p-3 transition-colors ${
                currentAction === action
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                  : 'dark:border-dark-border dark:hover:bg-dark-bg-secondary border-gray-200 hover:bg-white'
              }`}
            >
              <span
                className="rounded p-1.5"
                style={{
                  backgroundColor: `${getSwipeActionColor(action)}20`,
                  color: getSwipeActionColor(action),
                }}
              >
                {ACTION_ICONS[action]}
              </span>
              <span className="dark:text-dark-text-secondary text-sm text-gray-700">
                {getSwipeActionLabel(action)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Preview */}
      <div className="dark:border-dark-border mt-3 border-t border-gray-200 pt-3">
        <div className="dark:text-dark-text-muted mb-2 text-xs text-gray-400">Előnézet:</div>
        <div className="dark:bg-dark-bg-secondary dark:border-dark-border relative h-14 overflow-hidden rounded-lg border border-gray-200 bg-white">
          {/* Background action indicator */}
          <div
            className={`absolute inset-y-0 ${direction === 'left' ? 'right-0' : 'left-0'} flex w-16 items-center ${direction === 'left' ? 'justify-end pr-3' : 'justify-start pl-3'}`}
            style={{ backgroundColor: getSwipeActionColor(currentAction) }}
          >
            <span className="text-white">{ACTION_ICONS[currentAction]}</span>
          </div>

          {/* Fake email item */}
          <div
            className="dark:bg-dark-bg-secondary absolute inset-0 flex items-center gap-3 bg-white px-4 transition-transform"
            style={{ transform: `translateX(${direction === 'left' ? '-40px' : '40px'})` }}
          >
            <div className="dark:bg-dark-bg-tertiary h-8 w-8 rounded-full bg-gray-200" />
            <div className="flex-1">
              <div className="dark:bg-dark-bg-tertiary mb-1 h-3 w-24 rounded bg-gray-200" />
              <div className="dark:bg-dark-bg h-2 w-32 rounded bg-gray-100" />
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
        <h3 className="dark:text-dark-text mb-1 text-lg font-medium text-gray-800">
          Swipe műveletek
        </h3>
        <p className="dark:text-dark-text-muted mb-4 text-sm text-gray-500">
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

      <div className="dark:text-dark-text-muted dark:border-dark-border border-t border-gray-100 pt-2 text-xs text-gray-400">
        Tipp: A swipe műveletek csak mobilon és érintőképernyőn működnek, de asztali gépen is
        kipróbálhatod egérrel.
      </div>
    </div>
  );
}
