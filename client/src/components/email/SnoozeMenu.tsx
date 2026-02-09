import { useState } from 'react';
import { useSnoozeEmail, getSnoozeOptions } from '../../hooks/useSnooze';
import { Clock, Calendar, ChevronDown, X } from 'lucide-react';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { toast } from '../../lib/toast';

interface SnoozeMenuProps {
  emailId: string;
  onSuccess?: () => void;
  onClose?: () => void;
  className?: string;
  variant?: 'button' | 'menu-item';
}

export function SnoozeMenu({
  emailId,
  onSuccess,
  onClose,
  className = '',
  variant = 'button',
}: SnoozeMenuProps) {
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
          onClose?.();
        },
      },
    );
  };

  const handleCustomSnooze = () => {
    if (!customDate) return;

    // Dátum validálás
    const dateParts = customDate.split('-');
    if (dateParts.length !== 3) {
      toast.error('Érvénytelen dátum formátum!');
      return;
    }
    const [year, month, day] = dateParts.map(Number);
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      toast.error('Érvénytelen dátum!');
      return;
    }

    // Idő validálás
    const timeParts = customTime.split(':');
    if (timeParts.length < 2) {
      toast.error('Érvénytelen idő formátum!');
      return;
    }
    const [hours, minutes] = timeParts.map(Number);
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      toast.error('Érvénytelen időpont!');
      return;
    }

    const snoozeUntil = new Date(year, month - 1, day, hours, minutes).getTime();

    if (isNaN(snoozeUntil)) {
      toast.error('Érvénytelen dátum vagy időpont!');
      return;
    }

    if (snoozeUntil <= Date.now()) {
      toast.error('A szundi időpont nem lehet a múltban!');
      return;
    }

    handleSnooze(snoozeUntil);
  };

  // Menu item variant - egyszerű gomb a dropdown menüben
  if (variant === 'menu-item') {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="dark:text-dark-text dark:hover:bg-dark-bg-tertiary flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100"
      >
        <Clock className="h-4 w-4" />
        <span>Szundi</span>
      </button>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="dark:hover:bg-dark-bg-tertiary dark:text-dark-text-secondary flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100"
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
          <div className="dark:bg-dark-bg-secondary dark:border-dark-border absolute top-full right-0 z-20 mt-1 w-56 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
            <div className="p-2">
              <div className="dark:text-dark-text-muted px-2 py-1 text-xs font-medium text-gray-400 uppercase">
                Emlékeztess később
              </div>

              {options.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleSnooze(option.time)}
                  disabled={snoozeEmail.isPending}
                  className="dark:text-dark-text dark:hover:bg-dark-bg-tertiary flex w-full items-center justify-between rounded px-2 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50"
                >
                  <span>{option.label}</span>
                  <span className="dark:text-dark-text-muted text-xs text-gray-400">
                    {format(option.time, 'HH:mm', { locale: hu })}
                  </span>
                </button>
              ))}

              <div className="dark:border-dark-border my-2 border-t border-gray-100" />

              {!showCustom ? (
                <button
                  onClick={() => setShowCustom(true)}
                  className="dark:text-dark-text dark:hover:bg-dark-bg-tertiary flex w-full items-center gap-2 rounded px-2 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100"
                >
                  <Calendar className="h-4 w-4" />
                  <span>Egyéni időpont...</span>
                </button>
              ) : (
                <div className="space-y-2 p-2">
                  <div className="flex items-center justify-between">
                    <span className="dark:text-dark-text-secondary text-xs text-gray-500">
                      Egyéni időpont
                    </span>
                    <button
                      onClick={() => setShowCustom(false)}
                      className="dark:hover:bg-dark-bg-tertiary rounded p-1 hover:bg-gray-100"
                    >
                      <X className="h-3 w-3 text-gray-400" />
                    </button>
                  </div>

                  <input
                    type="date"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="dark:border-dark-border dark:bg-dark-bg dark:text-dark-text w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900"
                  />

                  <input
                    type="time"
                    value={customTime}
                    onChange={(e) => setCustomTime(e.target.value)}
                    className="dark:border-dark-border dark:bg-dark-bg dark:text-dark-text w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900"
                  />

                  <button
                    onClick={handleCustomSnooze}
                    disabled={!customDate || snoozeEmail.isPending}
                    className="w-full rounded bg-blue-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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
