import { useLogin } from '../../hooks/useAccounts';
import { ZMailLogo } from '../common/ZMailLogo';
import { Loader2 } from 'lucide-react';

export function LoginScreen() {
  const login = useLogin();

  return (
    <div className="dark:from-dark-bg dark:to-dark-bg-secondary flex h-full flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-white px-4">
      <div className="dark:bg-dark-bg-secondary/80 flex w-full max-w-lg flex-col items-center rounded-xl bg-white/80 p-8 shadow-xl backdrop-blur-sm sm:p-10">
        {/* Logo és branding */}
        <div className="mb-8 flex flex-col items-center">
          <ZMailLogo size={80} className="mb-4" />
          <h1 className="dark:text-dark-text mb-2 text-3xl font-bold text-gray-900 sm:text-4xl">
            ZMail
          </h1>
          <p className="dark:text-dark-text-secondary max-w-md text-center text-gray-500">
            Egyszerű és gyors email kliens a Gmail fiókjaidhoz
          </p>
        </div>

        {/* Funkciók lista */}
        <div className="dark:text-dark-text-secondary mb-8 grid max-w-lg grid-cols-1 gap-3 text-sm text-gray-600 sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <span className="text-[#4f6ef7]">✓</span>
            <span>Billentyűparancsok</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#4f6ef7]">✓</span>
            <span>Sötét téma</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#4f6ef7]">✓</span>
            <span>Kategorizálás</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#4f6ef7]">✓</span>
            <span>Emlékeztetők</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#4f6ef7]">✓</span>
            <span>Melléklet kezelés</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#4f6ef7]">✓</span>
            <span>Hírlevél kezelés</span>
          </div>
        </div>

        {/* Google bejelentkezés gomb */}
        <button
          onClick={() => login.mutate()}
          disabled={login.isPending}
          className="flex items-center gap-3 rounded-lg bg-[#4f6ef7] px-6 py-3 text-white shadow-md transition-all hover:bg-[#3d5ce5] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Bejelentkezés Google fiókkal"
        >
          {login.isPending ? (
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          )}
          <span className="font-medium text-white">
            {login.isPending ? 'Átirányítás...' : 'Bejelentkezés Google fiókkal'}
          </span>
        </button>
      </div>

      {/* Lábléc infó */}
      <p className="dark:text-dark-text-muted mt-8 max-w-sm text-center text-xs text-gray-400">
        A bejelentkezéssel elfogadod, hogy az alkalmazás hozzáfér a Gmail fiókodhoz. Az adataid
        biztonságban vannak és csak helyileg tárolódnak.
      </p>
    </div>
  );
}
