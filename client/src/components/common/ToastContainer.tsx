import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle, X, Undo2 } from 'lucide-react';
import { toast, type Toast } from '../../lib/toast';

const icons = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
  undo: Undo2,
};

const colors = {
  success: 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800',
  error: 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800',
  info: 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800',
  warning: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800',
  undo: 'bg-gray-800 dark:bg-gray-700 text-white border-gray-700 dark:border-gray-600',
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const unsubscribe = toast.subscribe(setToasts);
    return () => {
      unsubscribe();
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md"
      role="region"
      aria-label="Értesítések"
    >
      {toasts.map((t) => {
        const Icon = icons[t.type];
        const isUndo = t.type === 'undo';

        return (
          <div
            key={t.id}
            className={`relative flex items-start gap-3 p-4 rounded-lg border shadow-lg animate-slide-in overflow-hidden ${colors[t.type]}`}
            role="alert"
            aria-live="polite"
          >
            {/* Progress bar for undo toasts */}
            {isUndo && t.progress !== undefined && (
              <div
                className="absolute bottom-0 left-0 h-1 bg-blue-500 transition-all duration-50"
                style={{ width: `${t.progress}%` }}
              />
            )}

            <Icon className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="flex-1 text-sm font-medium">{t.message}</p>

            {isUndo && t.onUndo ? (
              <button
                onClick={() => toast.undo(t.id)}
                className="shrink-0 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors"
              >
                Visszavonás
              </button>
            ) : (
              <button
                onClick={() => toast.dismiss(t.id)}
                className="shrink-0 p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded transition-colors"
                aria-label="Bezárás"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
