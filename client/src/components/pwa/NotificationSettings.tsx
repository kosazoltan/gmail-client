import { Bell, BellOff, Loader2, AlertCircle, CheckCircle2, Send } from 'lucide-react';
import { usePushNotifications } from '../../hooks/usePushNotifications';

export function NotificationSettings() {
  const {
    permission,
    isSubscribed,
    isLoading,
    error,
    isSupported,
    subscribe,
    unsubscribe,
    sendTest,
  } = usePushNotifications();

  // Ha nem támogatott, mutatjuk hogy miért
  if (!isSupported) {
    return (
      <div className="p-4 bg-yellow-50 dark:bg-yellow-500/10 rounded-xl">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-yellow-800 dark:text-yellow-200">
              Push értesítések nem elérhetők
            </h4>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              A push értesítések csak telepített PWA alkalmazásban működnek.
              Telepítsd az alkalmazást a főképernyőre az értesítések használatához.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Ha megtagadták az engedélyt
  if (permission === 'denied') {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-500/10 rounded-xl">
        <div className="flex items-start gap-3">
          <BellOff className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-red-800 dark:text-red-200">
              Értesítések letiltva
            </h4>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
              Az értesítések le vannak tiltva a böngésző beállításokban.
              Engedélyezd őket a böngésző beállításaiban a használathoz.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Státusz */}
      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-dark-bg-tertiary rounded-xl">
        <div className="flex items-center gap-3">
          {isSubscribed ? (
            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
              <Bell className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-dark-bg-secondary flex items-center justify-center">
              <BellOff className="h-5 w-5 text-gray-500 dark:text-dark-text-secondary" />
            </div>
          )}
          <div>
            <h4 className="font-medium dark:text-dark-text">Push értesítések</h4>
            <p className="text-sm text-gray-500 dark:text-dark-text-secondary">
              {isSubscribed
                ? 'Értesítések bekapcsolva'
                : 'Értesítések kikapcsolva'}
            </p>
          </div>
        </div>

        <button
          onClick={isSubscribed ? unsubscribe : subscribe}
          disabled={isLoading}
          className={`px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 ${
            isSubscribed
              ? 'bg-gray-200 dark:bg-dark-bg-secondary text-gray-700 dark:text-dark-text hover:bg-gray-300 dark:hover:bg-dark-bg-tertiary'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : isSubscribed ? (
            'Kikapcsolás'
          ) : (
            'Bekapcsolás'
          )}
        </button>
      </div>

      {/* Hiba üzenet */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-500/10 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-300 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Sikeres bekapcsolás */}
      {isSubscribed && !error && (
        <div className="p-3 bg-green-50 dark:bg-green-500/10 rounded-lg flex items-center gap-2 text-green-700 dark:text-green-300 text-sm">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          Az értesítések be vannak kapcsolva. Új emailekről értesítést kapsz.
        </div>
      )}

      {/* Teszt gomb */}
      {isSubscribed && (
        <button
          onClick={sendTest}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
        >
          <Send className="h-4 w-4" />
          Teszt értesítés küldése
        </button>
      )}

      {/* Információ */}
      <div className="text-xs text-gray-400 dark:text-dark-text-muted">
        <p>Az értesítések segítségével azonnal tudomást szerzel az új beérkező levelekről,
        még akkor is, ha az alkalmazás nincs megnyitva.</p>
      </div>
    </div>
  );
}
