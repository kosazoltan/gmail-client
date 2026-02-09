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
          'dark:border-dark-border flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2',
          'dark:text-dark-text-secondary text-sm text-gray-600',
          'dark:hover:bg-dark-bg-tertiary transition-colors hover:bg-gray-50',
          'disabled:cursor-not-allowed disabled:opacity-50',
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
          <div className="dark:bg-dark-bg-secondary dark:border-dark-border absolute right-0 bottom-full z-50 mb-2 min-w-[240px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            <div className="dark:border-dark-border border-b border-gray-100 px-3 py-2">
              <h3 className="dark:text-dark-text text-sm font-medium text-gray-800">
                Küldés ütemezése
              </h3>
            </div>

            {/* Quick options */}
            <div className="py-1">
              {options.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleQuickSchedule(option.time)}
                  className="dark:text-dark-text-secondary dark:hover:bg-dark-bg-tertiary flex w-full items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <span>{option.label}</span>
                  <span className="dark:text-dark-text-muted text-xs text-gray-400">
                    {formatScheduledTime(option.time)}
                  </span>
                </button>
              ))}
            </div>

            <div className="dark:border-dark-border border-t border-gray-100 py-1">
              {!showCustomPicker ? (
                <button
                  onClick={() => setShowCustomPicker(true)}
                  className="dark:text-dark-text-secondary dark:hover:bg-dark-bg-tertiary flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Calendar className="h-4 w-4" />
                  Egyéni időpont...
                </button>
              ) : (
                <div className="space-y-2 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="dark:text-dark-text-muted text-xs font-medium text-gray-500">
                      Egyéni időpont
                    </span>
                    <button
                      onClick={() => setShowCustomPicker(false)}
                      className="dark:hover:bg-dark-bg-tertiary rounded p-1 hover:bg-gray-100"
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
                      className="dark:border-dark-border dark:bg-dark-bg dark:text-dark-text flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700"
                    />
                    <input
                      type="time"
                      value={customTime}
                      onChange={(e) => setCustomTime(e.target.value)}
                      className="dark:border-dark-border dark:bg-dark-bg dark:text-dark-text w-24 rounded border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700"
                    />
                  </div>

                  <button
                    onClick={handleCustomSchedule}
                    disabled={!customDate || !customTime}
                    className="w-full rounded bg-blue-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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
    <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm dark:border-blue-800 dark:bg-blue-500/10">
      <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      <span className="text-blue-800 dark:text-blue-200">
        Ütemezve: {formatScheduledTime(scheduledAt)}
      </span>
      <button
        onClick={onCancel}
        className="rounded p-0.5 text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-500/20"
        title="Ütemezés törlése"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
