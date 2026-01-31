import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function TermsOfService() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 dark:text-dark-text-secondary hover:text-gray-900 dark:hover:text-dark-text mb-6"
        >
          <ArrowLeft className="h-5 w-5" />
          Vissza
        </button>

        <div className="bg-white dark:bg-dark-bg-secondary rounded-xl shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-dark-text mb-6">
            Felhasználási Feltételek
          </h1>
          <p className="text-sm text-gray-500 dark:text-dark-text-muted mb-8">
            Utolsó frissítés: 2025. január 31.
          </p>

          <div className="prose dark:prose-invert max-w-none">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-text mt-6 mb-3">
              1. A Szolgáltatás Elfogadása
            </h2>
            <p className="text-gray-700 dark:text-dark-text-secondary mb-4">
              A ZMail szolgáltatás ("Szolgáltatás") használatával Ön elfogadja és magára
              nézve kötelezőnek ismeri el jelen Felhasználási Feltételeket ("Feltételek").
              Ha nem ért egyet ezekkel a Feltételekkel, kérjük, ne használja a Szolgáltatást.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-text mt-6 mb-3">
              2. A Szolgáltatás Leírása
            </h2>
            <p className="text-gray-700 dark:text-dark-text-secondary mb-4">
              A ZMail egy személyes email kliens alkalmazás, amely a Google Gmail
              szolgáltatásával integrálódik, és az alábbi funkciókat biztosítja:
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-dark-text-secondary mb-4">
              <li>Gmail levelek olvasása és kezelése</li>
              <li>Email küldése és válaszolás</li>
              <li>Levelek rendszerezése küldő, téma, időszak és kategória szerint</li>
              <li>Mellékletek kezelése</li>
              <li>Keresés a levelek között</li>
              <li>Emlékeztetők beállítása</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-text mt-6 mb-3">
              3. Google Fiók Hozzáférés
            </h2>
            <p className="text-gray-700 dark:text-dark-text-secondary mb-4">
              A Szolgáltatás használatához Google fiókkal történő bejelentkezés és
              Gmail hozzáférés engedélyezése szükséges. Az engedélyezéssel Ön:
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-dark-text-secondary mb-4">
              <li>Hozzáférést biztosít a Gmail leveleihez</li>
              <li>Engedélyezi levelek olvasását és küldését</li>
              <li>Elfogadja a Google API Szolgáltatások Felhasználási Feltételeit</li>
            </ul>
            <p className="text-gray-700 dark:text-dark-text-secondary mb-4">
              A hozzáférést bármikor visszavonhatja a Google Fiók beállításokban.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-text mt-6 mb-3">
              4. Felhasználói Kötelezettségek
            </h2>
            <p className="text-gray-700 dark:text-dark-text-secondary mb-4">
              A Szolgáltatás használatakor Ön vállalja, hogy:
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-dark-text-secondary mb-4">
              <li>Valós és pontos adatokat ad meg</li>
              <li>Nem használja a Szolgáltatást jogellenes célokra</li>
              <li>Nem küld spam vagy kéretlen leveleket</li>
              <li>Nem próbálja megkerülni a biztonsági intézkedéseket</li>
              <li>Nem terheli túl szándékosan a rendszert</li>
              <li>Betartja a Google Szolgáltatási Feltételeit</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-text mt-6 mb-3">
              5. Szellemi Tulajdon
            </h2>
            <p className="text-gray-700 dark:text-dark-text-secondary mb-4">
              A Szolgáltatás és annak összes tartalma (dizájn, kód, logók) a Fejlesztő
              szellemi tulajdonát képezi. A Gmail és Google védjegyek a Google LLC
              tulajdonát képezik.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-text mt-6 mb-3">
              6. Felelősség Korlátozása
            </h2>
            <p className="text-gray-700 dark:text-dark-text-secondary mb-4">
              A Szolgáltatás "ahogy van" alapon működik. A Fejlesztő nem vállal garanciát:
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-dark-text-secondary mb-4">
              <li>A Szolgáltatás megszakítás nélküli működésére</li>
              <li>Az adatvesztés elkerülésére</li>
              <li>A Google szolgáltatások elérhetőségére</li>
              <li>Harmadik fél okozta károkra</li>
            </ul>
            <p className="text-gray-700 dark:text-dark-text-secondary mb-4">
              A Fejlesztő felelőssége a közvetlen, bizonyított károkra korlátozódik.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-text mt-6 mb-3">
              7. Szolgáltatás Módosítása és Megszüntetése
            </h2>
            <p className="text-gray-700 dark:text-dark-text-secondary mb-4">
              Fenntartjuk a jogot:
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-dark-text-secondary mb-4">
              <li>A Szolgáltatás funkcióinak módosítására</li>
              <li>A Szolgáltatás ideiglenes vagy végleges felfüggesztésére</li>
              <li>Felhasználói hozzáférés korlátozására a Feltételek megsértése esetén</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-text mt-6 mb-3">
              8. Adatvédelem
            </h2>
            <p className="text-gray-700 dark:text-dark-text-secondary mb-4">
              Az adatkezelési gyakorlatainkat az{' '}
              <a
                href="/privacy"
                className="text-blue-600 hover:underline"
              >
                Adatvédelmi Szabályzat
              </a>
              {' '}tartalmazza, amely jelen Feltételek szerves részét képezi.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-text mt-6 mb-3">
              9. Változtatások
            </h2>
            <p className="text-gray-700 dark:text-dark-text-secondary mb-4">
              Fenntartjuk a jogot jelen Feltételek módosítására. A lényeges változásokról
              értesítést küldünk. A módosítások után a Szolgáltatás további használata
              a módosított Feltételek elfogadását jelenti.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-text mt-6 mb-3">
              10. Irányadó Jog
            </h2>
            <p className="text-gray-700 dark:text-dark-text-secondary mb-4">
              Jelen Feltételekre Magyarország jogszabályai az irányadók.
              Vitás kérdések esetén a felek elsődlegesen békés megegyezésre törekednek.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-text mt-6 mb-3">
              11. Kapcsolat
            </h2>
            <p className="text-gray-700 dark:text-dark-text-secondary mb-4">
              Ha kérdése van a Felhasználási Feltételekkel kapcsolatban:
            </p>
            <p className="text-gray-700 dark:text-dark-text-secondary mb-4">
              <strong>Email:</strong> support@mindenes.org
            </p>

            <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-text mt-6 mb-3">
              12. Elfogadás
            </h2>
            <p className="text-gray-700 dark:text-dark-text-secondary mb-4">
              A Google fiókjával történő bejelentkezéssel és a Szolgáltatás használatával
              Ön kijelenti, hogy elolvasta, megértette és elfogadja jelen Felhasználási
              Feltételeket és az Adatvédelmi Szabályzatot.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
