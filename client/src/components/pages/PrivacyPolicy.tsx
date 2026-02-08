import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="dark:bg-dark-bg min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="dark:text-dark-text-secondary dark:hover:text-dark-text mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5" />
          Vissza
        </button>

        <div className="dark:bg-dark-bg-secondary rounded-xl bg-white p-8 shadow-sm">
          <h1 className="dark:text-dark-text mb-6 text-3xl font-bold text-gray-900">
            Adatvédelmi Szabályzat
          </h1>
          <p className="dark:text-dark-text-muted mb-8 text-sm text-gray-500">
            Utolsó frissítés: 2025. január 31.
          </p>

          <div className="prose dark:prose-invert max-w-none">
            <h2 className="dark:text-dark-text mt-6 mb-3 text-xl font-semibold text-gray-900">
              1. Bevezetés
            </h2>
            <p className="dark:text-dark-text-secondary mb-4 text-gray-700">
              A ZMail ("Alkalmazás", "Szolgáltatás") egy személyes email kliens alkalmazás, amely a
              Google Gmail szolgáltatásával integrálódik. Az Alkalmazás fejlesztője ("mi",
              "Fejlesztő") elkötelezett a felhasználók ("Ön", "felhasználó") adatainak védelme
              iránt.
            </p>
            <p className="dark:text-dark-text-secondary mb-4 text-gray-700">
              Ez az Adatvédelmi Szabályzat ismerteti, hogyan kezeljük az Ön személyes adatait az
              Alkalmazás használata során.
            </p>

            <h2 className="dark:text-dark-text mt-6 mb-3 text-xl font-semibold text-gray-900">
              2. Milyen adatokat gyűjtünk?
            </h2>
            <h3 className="dark:text-dark-text mt-4 mb-2 text-lg font-medium text-gray-800">
              2.1 Google Fiók Adatok
            </h3>
            <p className="dark:text-dark-text-secondary mb-4 text-gray-700">
              Az Alkalmazás használatához Google fiókkal történő bejelentkezés szükséges. A Google
              OAuth 2.0 protokollon keresztül az alábbi adatokhoz férünk hozzá:
            </p>
            <ul className="dark:text-dark-text-secondary mb-4 list-disc pl-6 text-gray-700">
              <li>Email cím</li>
              <li>Profil név</li>
              <li>Profil kép URL</li>
              <li>Gmail levelek (olvasás és írás)</li>
              <li>Gmail címkék</li>
            </ul>

            <h3 className="dark:text-dark-text mt-4 mb-2 text-lg font-medium text-gray-800">
              2.2 Helyi Adattárolás
            </h3>
            <p className="dark:text-dark-text-secondary mb-4 text-gray-700">
              Az Alkalmazás az alábbi adatokat tárolja helyileg a szerveren:
            </p>
            <ul className="dark:text-dark-text-secondary mb-4 list-disc pl-6 text-gray-700">
              <li>Email metaadatok (tárgy, feladó, dátum, címkék)</li>
              <li>Email tartalmak (lokális gyorsítótár céljából)</li>
              <li>Mellékletek metaadatai</li>
              <li>Felhasználói beállítások (emlékeztetők, mentett keresések)</li>
              <li>Titkosított OAuth tokenek</li>
            </ul>

            <h2 className="dark:text-dark-text mt-6 mb-3 text-xl font-semibold text-gray-900">
              3. Hogyan használjuk az adatokat?
            </h2>
            <p className="dark:text-dark-text-secondary mb-4 text-gray-700">
              Az összegyűjtött adatokat kizárólag az alábbi célokra használjuk:
            </p>
            <ul className="dark:text-dark-text-secondary mb-4 list-disc pl-6 text-gray-700">
              <li>Az email kliens funkcionalitásának biztosítása</li>
              <li>Levelek megjelenítése, küldése és kezelése</li>
              <li>Keresési funkció működtetése</li>
              <li>Emlékeztetők és értesítések kezelése</li>
              <li>Felhasználói élmény javítása</li>
            </ul>
            <p className="dark:text-dark-text-secondary mb-4 text-gray-700">
              <strong>Nem használjuk az adatokat:</strong>
            </p>
            <ul className="dark:text-dark-text-secondary mb-4 list-disc pl-6 text-gray-700">
              <li>Reklámozási célokra</li>
              <li>Harmadik feleknek történő értékesítésre</li>
              <li>Profilalkotásra vagy viselkedéselemzésre</li>
              <li>Automatizált döntéshozatalra</li>
            </ul>

            <h2 className="dark:text-dark-text mt-6 mb-3 text-xl font-semibold text-gray-900">
              4. Adatmegosztás
            </h2>
            <p className="dark:text-dark-text-secondary mb-4 text-gray-700">
              <strong>Nem osztjuk meg az Ön adatait harmadik felekkel</strong>, kivéve:
            </p>
            <ul className="dark:text-dark-text-secondary mb-4 list-disc pl-6 text-gray-700">
              <li>Google szolgáltatásokkal (Gmail API használata)</li>
              <li>Jogi kötelezettség esetén (hatósági megkeresés)</li>
            </ul>

            <h2 className="dark:text-dark-text mt-6 mb-3 text-xl font-semibold text-gray-900">
              5. Adatbiztonság
            </h2>
            <p className="dark:text-dark-text-secondary mb-4 text-gray-700">
              Az Ön adatainak védelme érdekében az alábbi intézkedéseket alkalmazzuk:
            </p>
            <ul className="dark:text-dark-text-secondary mb-4 list-disc pl-6 text-gray-700">
              <li>HTTPS titkosított kapcsolat</li>
              <li>OAuth tokenek AES-256 titkosítása</li>
              <li>Biztonságos session kezelés</li>
              <li>Rendszeres biztonsági frissítések</li>
            </ul>

            <h2 className="dark:text-dark-text mt-6 mb-3 text-xl font-semibold text-gray-900">
              6. Az Ön jogai
            </h2>
            <p className="dark:text-dark-text-secondary mb-4 text-gray-700">Önnek joga van:</p>
            <ul className="dark:text-dark-text-secondary mb-4 list-disc pl-6 text-gray-700">
              <li>
                <strong>Hozzáférés:</strong> Megtekintheti a tárolt adatait
              </li>
              <li>
                <strong>Törlés:</strong> Kérheti adatai törlését
              </li>
              <li>
                <strong>Hozzáférés visszavonása:</strong> Bármikor visszavonhatja a Google fiók
                hozzáférést
              </li>
              <li>
                <strong>Adathordozhatóság:</strong> Kérheti adatai exportálását
              </li>
            </ul>
            <p className="dark:text-dark-text-secondary mb-4 text-gray-700">
              A Google fiók hozzáférés visszavonásához:
            </p>
            <ol className="dark:text-dark-text-secondary mb-4 list-decimal pl-6 text-gray-700">
              <li>Nyissa meg a Google Fiók beállításokat</li>
              <li>Válassza a "Biztonság" menüpontot</li>
              <li>Keresse meg a "Harmadik féltől származó alkalmazások" részt</li>
              <li>Távolítsa el a ZMail hozzáférését</li>
            </ol>

            <h2 className="dark:text-dark-text mt-6 mb-3 text-xl font-semibold text-gray-900">
              7. Adatmegőrzés
            </h2>
            <p className="dark:text-dark-text-secondary mb-4 text-gray-700">
              Az adatokat addig őrizzük meg, amíg Ön használja a szolgáltatást. A fiók törlése vagy
              hozzáférés visszavonása esetén az összes kapcsolódó adat törlésre kerül a
              rendszerünkből.
            </p>

            <h2 className="dark:text-dark-text mt-6 mb-3 text-xl font-semibold text-gray-900">
              8. Cookie-k és Helyi Tárolás
            </h2>
            <p className="dark:text-dark-text-secondary mb-4 text-gray-700">
              Az Alkalmazás session cookie-kat használ a bejelentkezés fenntartásához. Nem
              használunk nyomkövető cookie-kat vagy analitikai szolgáltatásokat.
            </p>

            <h2 className="dark:text-dark-text mt-6 mb-3 text-xl font-semibold text-gray-900">
              9. Módosítások
            </h2>
            <p className="dark:text-dark-text-secondary mb-4 text-gray-700">
              Fenntartjuk a jogot ezen Adatvédelmi Szabályzat módosítására. A jelentős változásokról
              értesítést küldünk az Alkalmazáson keresztül.
            </p>

            <h2 className="dark:text-dark-text mt-6 mb-3 text-xl font-semibold text-gray-900">
              10. Kapcsolat
            </h2>
            <p className="dark:text-dark-text-secondary mb-4 text-gray-700">
              Ha kérdése van az Adatvédelmi Szabályzattal kapcsolatban, kérjük, lépjen kapcsolatba
              velünk:
            </p>
            <p className="dark:text-dark-text-secondary mb-4 text-gray-700">
              <strong>Email:</strong> privacy@mindenes.org
            </p>

            <h2 className="dark:text-dark-text mt-6 mb-3 text-xl font-semibold text-gray-900">
              11. Google API Services User Data Policy
            </h2>
            <p className="dark:text-dark-text-secondary mb-4 text-gray-700">
              ZMail's use and transfer to any other app of information received from Google APIs
              will adhere to{' '}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
