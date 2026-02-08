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
      <div className="rounded-xl bg-yellow-50 p-4 dark:bg-yellow-500/10">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600 dark:text-yellow-400" />
          <div>
            <h4 className="font-medium text-yellow-800 dark:text-yellow-200">
              Push értesítések nem elérhetők
            </h4>
            <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
              A push értesítések csak telepített PWA alkalmazásban működnek. Telepítsd az
              alkalmazást a főképernyőre az értesítések használatához.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Ha megtagadták az engedélyt
  if (permission === 'denied') {
    return (
      <div className="rounded-xl bg-red-50 p-4 dark:bg-red-500/10">
        <div className="flex items-start gap-3">
          <BellOff className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
          <div>
            <h4 className="font-medium text-red-800 dark:text-red-200">Értesítések letiltva</h4>
            <p className="mt-1 text-sm text-red-700 dark:text-red-300">
              Az értesítések le vannak tiltva a böngésző beállításokban. Engedélyezd őket a böngésző
              beállításaiban a használathoz.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Státusz */}
      <div className="dark:bg-dark-bg-tertiary flex items-center justify-between rounded-xl bg-gray-50 p-4">
        <div className="flex items-center gap-3">
          {isSubscribed ? (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-500/20">
              <Bell className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
          ) : (
            <div className="dark:bg-dark-bg-secondary flex h-10 w-10 items-center justify-center rounded-full bg-gray-200">
              <BellOff className="dark:text-dark-text-secondary h-5 w-5 text-gray-500" />
            </div>
          )}
          <div>
            <h4 className="dark:text-dark-text font-medium">Push értesítések</h4>
            <p className="dark:text-dark-text-secondary text-sm text-gray-500">
              {isSubscribed ? 'Értesítések bekapcsolva' : 'Értesítések kikapcsolva'}
            </p>
          </div>
        </div>

        <button
          onClick={isSubscribed ? unsubscribe : subscribe}
          disabled={isLoading}
          className={`rounded-lg px-4 py-2 font-medium transition-colors disabled:opacity-50 ${
            isSubscribed
              ? 'dark:bg-dark-bg-secondary dark:text-dark-text dark:hover:bg-dark-bg-tertiary bg-gray-200 text-gray-700 hover:bg-gray-300'
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
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Sikeres bekapcsolás */}
      {isSubscribed && !error && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-500/10 dark:text-green-300">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          Az értesítések be vannak kapcsolva. Új emailekről értesítést kapsz.
        </div>
      )}

      {/* Teszt gomb */}
      {isSubscribed && (
        <button
          onClick={sendTest}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
        >
          <Send className="h-4 w-4" />
          Teszt értesítés küldése
        </button>
      )}

      {/* Információ */}
      <div className="dark:text-dark-text-muted text-xs text-gray-400">
        <p>
          Az értesítések segítségével azonnal tudomást szerzel az új beérkező levelekről, még akkor
          is, ha az alkalmazás nincs megnyitva.
        </p>
      </div>
    </div>
  );
}
