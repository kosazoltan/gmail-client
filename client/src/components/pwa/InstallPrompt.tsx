import { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Ellenőrizzük, hogy már telepítve van-e (standalone mód)
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandalone(isInStandaloneMode);

    // iOS detektálás
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    // Ha már telepítve van, nem mutatjuk a promptot
    if (isInStandaloneMode) {
      return;
    }

    // Ellenőrizzük, hogy korábban elutasította-e
    const dismissedAt = localStorage.getItem('pwa-install-dismissed');
    if (dismissedAt) {
      const dismissedDate = new Date(parseInt(dismissedAt));
      const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      // 7 napig ne kérdezzük újra
      if (daysSinceDismissed < 7) {
        return;
      }
    }

    // beforeinstallprompt event kezelése (Chrome, Edge, Samsung Browser)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // FIX: Unified cleanup that handles both iOS and non-iOS cases
    let timer: ReturnType<typeof setTimeout> | null = null;

    // iOS esetén 3 másodperc után mutatjuk a manuális telepítési útmutatót
    if (isIOSDevice && !isInStandaloneMode) {
      timer = setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
    }

    // Single cleanup function that always removes the event listener
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    // PWA telepítés eredménye kezelve
    void outcome;

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    setShowPrompt(false);
  };

  // Ne mutassuk, ha már telepítve van vagy nincs prompt
  if (isStandalone || !showPrompt) {
    return null;
  }

  // iOS-re külön UI
  if (isIOS) {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-white dark:bg-dark-bg-secondary rounded-xl shadow-2xl border border-gray-200 dark:border-dark-border p-4 z-50 animate-slide-up">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary"
        >
          <X className="h-4 w-4 text-gray-400" />
        </button>

        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-12 h-12 bg-blue-100 dark:bg-blue-500/20 rounded-xl flex items-center justify-center">
            <Smartphone className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-dark-text mb-1">
              Telepítsd a ZMail-t!
            </h3>
            <p className="text-sm text-gray-500 dark:text-dark-text-secondary mb-3">
              iOS-en: Nyomd meg a{' '}
              <span className="inline-flex items-center">
                <svg className="h-4 w-4 mx-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L12 14M12 2L8 6M12 2L16 6M4 12V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>{' '}
              ikont, majd <strong>"Hozzáadás a Főképernyőhöz"</strong>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Android / Desktop UI
  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-white dark:bg-dark-bg-secondary rounded-xl shadow-2xl border border-gray-200 dark:border-dark-border p-4 z-50 animate-slide-up">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary"
      >
        <X className="h-4 w-4 text-gray-400" />
      </button>

      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-12 h-12 bg-blue-100 dark:bg-blue-500/20 rounded-xl flex items-center justify-center">
          <Download className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-dark-text mb-1">
            Telepítsd a ZMail-t!
          </h3>
          <p className="text-sm text-gray-500 dark:text-dark-text-secondary mb-3">
            Gyorsabb hozzáférés és offline támogatás az alkalmazás telepítésével.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleInstall}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Telepítés
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-2 text-gray-600 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary text-sm font-medium rounded-lg transition-colors"
            >
              Később
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
