import { useState, useRef, useEffect } from 'react';
import { Bell, Clock, Calendar, X } from 'lucide-react';
import { useCreateReminder } from '../../hooks/useReminders';

interface ReminderMenuProps {
  emailId: string;
  onSuccess?: () => void;
}

export function ReminderMenu({ emailId, onSuccess }: ReminderMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('09:00');
  const [note, setNote] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const createReminder = useCreateReminder();

  // Kattintás figyelése a menü bezárásához
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowCustom(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleRemind = (timestamp: number) => {
    createReminder.mutate(
      { emailId, remindAt: timestamp, note: note || undefined },
      {
        onSuccess: () => {
          setIsOpen(false);
          setShowCustom(false);
          setNote('');
          onSuccess?.();
        },
      },
    );
  };

  const handleCustomRemind = () => {
    if (!customDate) return;
    const [year, month, day] = customDate.split('-').map(Number);
    const [hours, minutes] = customTime.split(':').map(Number);
    const date = new Date(year, month - 1, day, hours, minutes);
    handleRemind(date.getTime());
  };

  // Előre definiált időpontok
  const getPresetTimes = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Ma délután 14:00
    const thisAfternoon = new Date(today);
    thisAfternoon.setHours(14, 0, 0, 0);
    if (thisAfternoon <= now) {
      thisAfternoon.setDate(thisAfternoon.getDate() + 1);
    }

    // Ma este 18:00
    const thisEvening = new Date(today);
    thisEvening.setHours(18, 0, 0, 0);
    if (thisEvening <= now) {
      thisEvening.setDate(thisEvening.getDate() + 1);
    }

    // Holnap reggel 9:00
    const tomorrowMorning = new Date(today);
    tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
    tomorrowMorning.setHours(9, 0, 0, 0);

    // 3 nap múlva 9:00
    const inThreeDays = new Date(today);
    inThreeDays.setDate(inThreeDays.getDate() + 3);
    inThreeDays.setHours(9, 0, 0, 0);

    // Jövő hét hétfő 9:00
    const nextMonday = new Date(today);
    const daysUntilMonday = (8 - nextMonday.getDay()) % 7 || 7;
    nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
    nextMonday.setHours(9, 0, 0, 0);

    return [
      { label: 'Ma délután', sublabel: '14:00', time: thisAfternoon },
      { label: 'Ma este', sublabel: '18:00', time: thisEvening },
      { label: 'Holnap reggel', sublabel: '9:00', time: tomorrowMorning },
      { label: '3 nap múlva', sublabel: '9:00', time: inThreeDays },
      { label: 'Jövő hétfő', sublabel: '9:00', time: nextMonday },
    ];
  };

  const presets = getPresetTimes();

  // Minimum dátum az egyéni választáshoz
  const minDate = new Date().toISOString().split('T')[0];

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary text-gray-600 dark:text-dark-text-secondary"
        title="Emlékeztető beállítása"
      >
        <Bell className="h-4 w-4" />
        Emlékeztető
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-white dark:bg-dark-bg-secondary rounded-lg shadow-lg border border-gray-200 dark:border-dark-border z-50">
          {!showCustom ? (
            <>
              <div className="px-3 py-2 border-b border-gray-100 dark:border-dark-border">
                <span className="text-xs font-medium text-gray-500 dark:text-dark-text-muted">
                  Emlékeztető időpontja
                </span>
              </div>

              <div className="p-1">
                {presets.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => handleRemind(preset.time.getTime())}
                    disabled={createReminder.isPending}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm rounded-md hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary text-gray-700 dark:text-dark-text disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-400 dark:text-dark-text-muted" />
                      <span>{preset.label}</span>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-dark-text-muted">
                      {preset.sublabel}
                    </span>
                  </button>
                ))}

                <div className="border-t border-gray-100 dark:border-dark-border my-1" />

                <button
                  onClick={() => setShowCustom(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary text-gray-700 dark:text-dark-text"
                >
                  <Calendar className="h-4 w-4 text-gray-400 dark:text-dark-text-muted" />
                  <span>Egyéni időpont...</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-dark-border">
                <span className="text-xs font-medium text-gray-500 dark:text-dark-text-muted">
                  Egyéni időpont
                </span>
                <button
                  onClick={() => setShowCustom(false)}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary"
                >
                  <X className="h-3 w-3 text-gray-400" />
                </button>
              </div>

              <div className="p-3 space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-dark-text-muted mb-1">
                    Dátum
                  </label>
                  <input
                    type="date"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    min={minDate}
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-dark-border rounded bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 dark:text-dark-text-muted mb-1">
                    Időpont
                  </label>
                  <input
                    type="time"
                    value={customTime}
                    onChange={(e) => setCustomTime(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-dark-border rounded bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 dark:text-dark-text-muted mb-1">
                    Megjegyzés (opcionális)
                  </label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="pl. Válaszolni kell"
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-dark-border rounded bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text"
                  />
                </div>

                <button
                  onClick={handleCustomRemind}
                  disabled={!customDate || createReminder.isPending}
                  className="w-full py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createReminder.isPending ? 'Mentés...' : 'Emlékeztető beállítása'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
