import { useState } from 'react';
import { Clock, Calendar, ChevronDown, X } from 'lucide-react';
import { getScheduleOptions, formatScheduledTime } from '../../hooks/useScheduledEmails';
import { cn } from '../../lib/utils';

interface ScheduleMenuProps {
  onSchedule: (timestamp: number) => void;
  disabled?: boolean;
}

export function ScheduleMenu({ onSchedule, disabled }: ScheduleMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('09:00');

  const options = getScheduleOptions();

  const handleQuickSchedule = (timestamp: number) => {
    onSchedule(timestamp);
    setIsOpen(false);
  };

  const handleCustomSchedule = () => {
    if (!customDate || !customTime) return;

    const [year, month, day] = customDate.split('-').map(Number);
    const [hours, minutes] = customTime.split(':').map(Number);

    const scheduledDate = new Date(year, month - 1, day, hours, minutes);
    const timestamp = scheduledDate.getTime();

    if (timestamp <= Date.now()) {
      return; // Don't allow past dates
    }

    onSchedule(timestamp);
    setIsOpen(false);
    setShowCustomPicker(false);
    setCustomDate('');
    setCustomTime('09:00');
  };

  // Set minimum date to tomorrow
  const today = new Date();
  const minDate = today.toISOString().split('T')[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-dark-border',
          'text-sm text-gray-600 dark:text-dark-text-secondary',
          'hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary transition-colors',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        <Clock className="h-4 w-4" />
        <span className="hidden sm:inline">Ütemezés</span>
        <ChevronDown className="h-3 w-3" />
      </button>

      {isOpen && (
        <>
          {/* Overlay */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          {/* Menu */}
          <div className="absolute bottom-full mb-2 right-0 z-50 bg-white dark:bg-dark-bg-secondary rounded-lg shadow-lg border border-gray-200 dark:border-dark-border py-1 min-w-[240px]">
            <div className="px-3 py-2 border-b border-gray-100 dark:border-dark-border">
              <h3 className="text-sm font-medium text-gray-800 dark:text-dark-text">
                Küldés ütemezése
              </h3>
            </div>

            {/* Quick options */}
            <div className="py-1">
              {options.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleQuickSchedule(option.time)}
                  className="flex items-center justify-between w-full px-3 py-2 text-sm text-gray-700 dark:text-dark-text-secondary hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary"
                >
                  <span>{option.label}</span>
                  <span className="text-xs text-gray-400 dark:text-dark-text-muted">
                    {formatScheduledTime(option.time)}
                  </span>
                </button>
              ))}
            </div>

            <div className="border-t border-gray-100 dark:border-dark-border py-1">
              {!showCustomPicker ? (
                <button
                  onClick={() => setShowCustomPicker(true)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-dark-text-secondary hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary"
                >
                  <Calendar className="h-4 w-4" />
                  Egyéni időpont...
                </button>
              ) : (
                <div className="px-3 py-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500 dark:text-dark-text-muted">
                      Egyéni időpont
                    </span>
                    <button
                      onClick={() => setShowCustomPicker(false)}
                      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary"
                    >
                      <X className="h-3 w-3 text-gray-400" />
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      min={minDate}
                      className="flex-1 px-2 py-1 text-sm border border-gray-200 dark:border-dark-border rounded bg-white dark:bg-dark-bg text-gray-700 dark:text-dark-text"
                    />
                    <input
                      type="time"
                      value={customTime}
                      onChange={(e) => setCustomTime(e.target.value)}
                      className="w-24 px-2 py-1 text-sm border border-gray-200 dark:border-dark-border rounded bg-white dark:bg-dark-bg text-gray-700 dark:text-dark-text"
                    />
                  </div>

                  <button
                    onClick={handleCustomSchedule}
                    disabled={!customDate || !customTime}
                    className="w-full px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Ütemezés
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface ScheduledBadgeProps {
  scheduledAt: number;
  onCancel: () => void;
}

export function ScheduledBadge({ scheduledAt, onCancel }: ScheduledBadgeProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-800 rounded-lg text-sm">
      <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      <span className="text-blue-800 dark:text-blue-200">
        Ütemezve: {formatScheduledTime(scheduledAt)}
      </span>
      <button
        onClick={onCancel}
        className="p-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-500/20 text-blue-600 dark:text-blue-400"
        title="Ütemezés törlése"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
