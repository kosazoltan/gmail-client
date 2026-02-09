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
            A bejelentkezés során egy figyelmeztetés jelenik meg: "A Google nem ellenorizte ezt az
            alkalmazast"
          </p>
          <p className="dark:text-dark-text-muted text-sm text-gray-500">
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
            A figyelmezteto oldalon keresd meg az "Advanced" vagy "Specialis" linket (altalaban bal
            also sarokban).
          </p>
          <div className="dark:bg-dark-bg-tertiary rounded-lg bg-gray-100 p-3 text-sm">
            <span className="cursor-pointer text-blue-600 underline dark:text-blue-400">
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
            A kibovitett reszben kattints a "Go to ZMail (unsafe)" vagy "Tovabb a ZMail
            alkalmazashoz (nem biztonsagos)" linkre.
          </p>
          <p className="rounded bg-amber-50 p-2 text-sm text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
            Megjegyzes: Az "unsafe" cimke csak azt jelenti, hogy a Google nem ellenorizte az
            alkalmazast. A ZMail biztonsagos, a kód nyilt forrasu.
          </p>
        </>
      ),
    },
    {
      title: 'Engedelyek megadasa',
      content: (
        <>
          <p className="mb-2">Hagyd jova a kert engedelyeket:</p>
          <ul className="dark:text-dark-text-secondary list-disc space-y-1 pl-5 text-sm text-gray-600">
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
      <div className="dark:bg-dark-bg-secondary max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="dark:border-dark-border flex items-center justify-between border-b border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-100 p-2 dark:bg-amber-500/20">
              <ShieldAlert className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="dark:text-dark-text font-semibold text-gray-900">
                Bejelentkezesi segitseg
              </h2>
              <p className="dark:text-dark-text-muted text-sm text-gray-500">
                Google OAuth figyelmeztetés
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="dark:hover:bg-dark-bg-tertiary rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            aria-label="Bezaras"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="dark:text-dark-text-secondary mb-4 text-sm text-gray-600">
            A Google egy figyelmeztetest jelenít meg az ellenorizetlen alkalmazasoknal. Kovesse az
            alabbi lepéseket a bejelentkezeshez:
          </p>

          <div className="space-y-2">
            {steps.map((step, index) => (
              <div
                key={index}
                className="dark:border-dark-border overflow-hidden rounded-lg border border-gray-200"
              >
                <button
                  onClick={() => setExpandedStep(expandedStep === index + 1 ? null : index + 1)}
                  className="dark:hover:bg-dark-bg-tertiary flex w-full items-center gap-3 p-3 hover:bg-gray-50"
                >
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                    {index + 1}
                  </div>
                  <span className="dark:text-dark-text flex-1 text-left text-sm font-medium text-gray-900">
                    {step.title}
                  </span>
                  {expandedStep === index + 1 ? (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  )}
                </button>
                {expandedStep === index + 1 && (
                  <div className="dark:text-dark-text-secondary dark:border-dark-border border-t border-gray-100 px-3 pt-1 pb-3 text-sm text-gray-600">
                    {step.content}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Additional info */}
          <div className="mt-4 rounded-lg bg-blue-50 p-3 dark:bg-blue-500/10">
            <h3 className="mb-1 text-sm font-medium text-blue-800 dark:text-blue-300">
              Miert latom ezt a figyelmeztetes?
            </h3>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              A ZMail egy privat alkalmazas, amelyet a Google nem ellenorzott hivatalosan. Ez nem
              jelent biztonsagi kockazatot - csak a Google verifikációs folyamat hianyzik. A ZMail
              osszes forráskodja nyilvánosan elerheto.
            </p>
          </div>

          {/* Google Console link for admins */}
          <a
            href="https://console.cloud.google.com/apis/credentials/consent"
            target="_blank"
            rel="noopener noreferrer"
            className="dark:text-dark-text-muted mt-4 flex items-center gap-2 text-xs text-gray-500 hover:text-blue-600 dark:hover:text-blue-400"
          >
            <ExternalLink className="h-3 w-3" />
            Fejlesztoknek: Google Cloud Console OAuth beallitasok
          </a>

          {/* Privacy & Terms links */}
          <div className="dark:border-dark-border mt-4 flex gap-4 border-t border-gray-200 pt-3 text-xs">
            <Link
              to="/privacy"
              onClick={onClose}
              className="dark:text-dark-text-muted text-gray-500 hover:text-blue-600 dark:hover:text-blue-400"
            >
              Adatvédelmi Szabályzat
            </Link>
            <Link
              to="/terms"
              onClick={onClose}
              className="dark:text-dark-text-muted text-gray-500 hover:text-blue-600 dark:hover:text-blue-400"
            >
              Felhasználási Feltételek
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="dark:border-dark-border dark:bg-dark-bg-tertiary border-t border-gray-200 bg-gray-50 p-4">
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-blue-600 py-2 font-medium text-white transition-colors hover:bg-blue-700"
          >
            Ertettem
          </button>
        </div>
      </div>
    </div>
  );
}
