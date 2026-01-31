import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ChevronDown, ChevronRight, ExternalLink, X } from 'lucide-react';

interface LoginHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LoginHelp({ isOpen, onClose }: LoginHelpProps) {
  const [expandedStep, setExpandedStep] = useState<number | null>(1);

  if (!isOpen) return null;

  const steps = [
    {
      title: 'Google figyelmeztetés megjelenik',
      content: (
        <>
          <p className="mb-2">
            A bejelentkezés során egy figyelmeztetés jelenik meg:
            "A Google nem ellenorizte ezt az alkalmazast"
          </p>
          <p className="text-sm text-gray-500 dark:text-dark-text-muted">
            Ez normalis, mert a ZMail sajat fejlesztesu alkalmazas.
          </p>
        </>
      ),
    },
    {
      title: 'Kattints a "Specialis" vagy "Advanced" linkre',
      content: (
        <>
          <p className="mb-2">
            A figyelmezteto oldalon keresd meg az "Advanced" vagy "Specialis" linket
            (altalaban bal also sarokban).
          </p>
          <div className="bg-gray-100 dark:bg-dark-bg-tertiary p-3 rounded-lg text-sm">
            <span className="text-blue-600 dark:text-blue-400 underline cursor-pointer">
              Advanced / Specialis
            </span>
          </div>
        </>
      ),
    },
    {
      title: 'Folytatas a ZMail-hez',
      content: (
        <>
          <p className="mb-2">
            A kibovitett reszben kattints a "Go to ZMail (unsafe)" vagy
            "Tovabb a ZMail alkalmazashoz (nem biztonsagos)" linkre.
          </p>
          <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 p-2 rounded">
            Megjegyzes: Az "unsafe" cimke csak azt jelenti, hogy a Google nem ellenorizte
            az alkalmazast. A ZMail biztonsagos, a kód nyilt forrasu.
          </p>
        </>
      ),
    },
    {
      title: 'Engedelyek megadasa',
      content: (
        <>
          <p className="mb-2">
            Hagyd jova a kert engedelyeket:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600 dark:text-dark-text-secondary">
            <li>Gmail levelek olvasasa</li>
            <li>Gmail levelek kuldese</li>
            <li>Gmail levelek modositasa (olvasott/csillag)</li>
            <li>Email cim es profil megtekintese</li>
          </ul>
        </>
      ),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-dark-bg-secondary rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-500/20 rounded-lg">
              <ShieldAlert className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-dark-text">
                Bejelentkezesi segitseg
              </h2>
              <p className="text-sm text-gray-500 dark:text-dark-text-muted">
                Google OAuth figyelmeztetés
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary text-gray-500"
            aria-label="Bezaras"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-sm text-gray-600 dark:text-dark-text-secondary mb-4">
            A Google egy figyelmeztetest jelenít meg az ellenorizetlen alkalmazasoknal.
            Kovesse az alabbi lepéseket a bejelentkezeshez:
          </p>

          <div className="space-y-2">
            {steps.map((step, index) => (
              <div
                key={index}
                className="border border-gray-200 dark:border-dark-border rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => setExpandedStep(expandedStep === index + 1 ? null : index + 1)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary"
                >
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-sm font-medium flex items-center justify-center">
                    {index + 1}
                  </div>
                  <span className="flex-1 text-left text-sm font-medium text-gray-900 dark:text-dark-text">
                    {step.title}
                  </span>
                  {expandedStep === index + 1 ? (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  )}
                </button>
                {expandedStep === index + 1 && (
                  <div className="px-3 pb-3 pt-1 text-sm text-gray-600 dark:text-dark-text-secondary border-t border-gray-100 dark:border-dark-border">
                    {step.content}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Additional info */}
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-500/10 rounded-lg">
            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">
              Miert latom ezt a figyelmeztetes?
            </h3>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              A ZMail egy privat alkalmazas, amelyet a Google nem ellenorzott hivatalosan.
              Ez nem jelent biztonsagi kockazatot - csak a Google verifikációs folyamat
              hianyzik. A ZMail osszes forráskodja nyilvánosan elerheto.
            </p>
          </div>

          {/* Google Console link for admins */}
          <a
            href="https://console.cloud.google.com/apis/credentials/consent"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center gap-2 text-xs text-gray-500 dark:text-dark-text-muted hover:text-blue-600 dark:hover:text-blue-400"
          >
            <ExternalLink className="h-3 w-3" />
            Fejlesztoknek: Google Cloud Console OAuth beallitasok
          </a>

          {/* Privacy & Terms links */}
          <div className="mt-4 pt-3 border-t border-gray-200 dark:border-dark-border flex gap-4 text-xs">
            <Link
              to="/privacy"
              onClick={onClose}
              className="text-gray-500 dark:text-dark-text-muted hover:text-blue-600 dark:hover:text-blue-400"
            >
              Adatvédelmi Szabályzat
            </Link>
            <Link
              to="/terms"
              onClick={onClose}
              className="text-gray-500 dark:text-dark-text-muted hover:text-blue-600 dark:hover:text-blue-400"
            >
              Felhasználási Feltételek
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg-tertiary">
          <button
            onClick={onClose}
            className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Ertettem
          </button>
        </div>
      </div>
    </div>
  );
}
