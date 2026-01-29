import { useState } from 'react';
import { useSnoozeEmail, getSnoozeOptions } from '../../hooks/useSnooze';
import { Clock, Calendar, ChevronDown, X } from 'lucide-react';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';

interface SnoozeMenuProps {
  emailId: string;
  onSuccess?: () => void;
  className?: string;
}

export function SnoozeMenu({ emailId, onSuccess, className = '' }: SnoozeMenuProps) {
  const snoozeEmail = useSnoozeEmail();
  const [isOpen, setIsOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('09:00');

  const options = getSnoozeOptions();

  const handleSnooze = (snoozeUntil: number) => {
    snoozeEmail.mutate(
      { emailId, snoozeUntil },
      {
        onSuccess: () => {
          setIsOpen(false);
          onSuccess?.();
        },
      },
    );
  };

  const handleCustomSnooze = () => {
    if (!customDate) return;

    const [year, month, day] = customDate.split('-').map(Number);
    const [hours, minutes] = customTime.split(':').map(Number);

    const snoozeUntil = new Date(year, month - 1, day, hours, minutes).getTime();

    if (snoozeUntil <= Date.now()) {
      alert('A szundi időpont nem lehet a múltban!');
      return;
    }

    handleSnooze(snoozeUntil);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary text-gray-600 dark:text-dark-text-secondary transition-colors"
        title="Szundi"
      >
        <Clock className="h-4 w-4" />
        <span>Szundi</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Háttér kattintás bezáráshoz */}
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />

          {/* Dropdown */}
          <div className="absolute top-full right-0 mt-1 w-56 bg-white dark:bg-dark-bg-secondary border border-gray-200 dark:border-dark-border rounded-lg shadow-lg z-20 overflow-hidden">
            <div className="p-2">
              <div className="text-xs font-medium text-gray-400 dark:text-dark-text-muted px-2 py-1 uppercase">
                Emlékeztess később
              </div>

              {options.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleSnooze(option.time)}
                  disabled={snoozeEmail.isPending}
                  className="w-full flex items-center justify-between px-2 py-2 text-sm text-gray-700 dark:text-dark-text hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary rounded transition-colors disabled:opacity-50"
                >
                  <span>{option.label}</span>
                  <span className="text-xs text-gray-400 dark:text-dark-text-muted">
                    {format(option.time, 'HH:mm', { locale: hu })}
                  </span>
                </button>
              ))}

              <div className="border-t border-gray-100 dark:border-dark-border my-2" />

              {!showCustom ? (
                <button
                  onClick={() => setShowCustom(true)}
                  className="w-full flex items-center gap-2 px-2 py-2 text-sm text-gray-700 dark:text-dark-text hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary rounded transition-colors"
                >
                  <Calendar className="h-4 w-4" />
                  <span>Egyéni időpont...</span>
                </button>
              ) : (
                <div className="p-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-dark-text-secondary">
                      Egyéni időpont
                    </span>
                    <button
                      onClick={() => setShowCustom(false)}
                      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary"
                    >
                      <X className="h-3 w-3 text-gray-400" />
                    </button>
                  </div>

                  <input
                    type="date"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-dark-border rounded bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text"
                  />

                  <input
                    type="time"
                    value={customTime}
                    onChange={(e) => setCustomTime(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-dark-border rounded bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text"
                  />

                  <button
                    onClick={handleCustomSnooze}
                    disabled={!customDate || snoozeEmail.isPending}
                    className="w-full px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Szundi beállítása
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
