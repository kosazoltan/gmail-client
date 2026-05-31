# Intelligens Számlagyűjtő Modul Implementációs Útmutató AI Fejlesztőnek

Ez a dokumentum egy általános, alkalmazásfüggetlen specifikáció egy professzionális e-mail alapú számlagyűjtő és számlaautomatizáló modul implementálásához.

## Feladat

Készíts egy e-mail alapú számlagyűjtő rendszert, amely:

- felismeri a számla jellegű e-maileket,
- listázza őket egy külön „Számlák” menüpontban,
- képes mellékletekből és e-mailben lévő letöltési linkekből számladokumentumokat kinyerni,
- biztonságosan feltölti vagy archiválja őket célmappákba,
- cégekhez, projektekhez vagy könyvelési célokhoz rendeli őket,
- havi jóváhagyási kapu után továbbküldi a megfelelő címzetteknek,
- idempotens, újrafuttatható, auditálható, és nem küld duplikátumot.

## Helyes Architektúra

Ne csak frontend oldali kulcsszavas szűrést készíts. A rendszer két rétegből álljon.

### 1. Felhasználói Nézet

- Legyen „Számlák” menüpont.
- Az e-mail listából számlagyanús leveleket szűrjön.
- Legyen nyitható e-mail betekintővel, törléssel, válasz és továbbítás alapfunkciókkal.
- Ez csak kényelmi nézet, nem a végleges automatizációs döntési motor.

### 2. Háttér Automatizáció

- Napi számlagyűjtés.
- Havi előző hónapos újrasöprés.
- Manuális újrafuttatás: napi, előző hónap, adott hónap.
- Havi jóváhagyási kapu a kiküldés előtt.
- Státusz API és admin UI futási markerekkel.

## Frontend Menüpont

Implementálj egy `InvoicesView` jellegű nézetet.

Követelmények:

- Kérje le az aktív fiók e-mailjeit lapozva vagy infinite scrollal.
- Szűrje a számlagyanús leveleket:
  - tárgy,
  - snippet vagy előnézet,
  - törzs első releváns része,
  - feladó domain vagy cím,
  - mellékletnév alapján.
- Kulcsszavak legyenek többnyelvűek:
  - magyar: `számla`, `díjbekérő`, `proforma`, `befizetés`, `fizetendő`, `esedékesség`,
  - angol: `invoice`, `bill`, `receipt`, `payment`, `billing`, `statement`, `amount due`.
- Legyen üres állapot: „Nincs számla típusú levél”.
- Legyen megnyitható részletes e-mail nézet.
- A kiválasztott e-mail törlése után válassza ki a következő releváns elemet, ne hagyjon törött UI állapotot.

## Backend Számlaautomatizációs API

Készíts ilyen végpontokat.

### `GET /invoice-automation/status`

Adja vissza:

- konfiguráció rendben van-e,
- hiányzó környezeti változók,
- AI státusz,
- ütemezési szabályok,
- legutóbbi futási markerek.

### `POST /invoice-automation/run`

Body példák:

```json
{ "mode": "daily" }
```

```json
{ "mode": "previous_month" }
```

```json
{ "mode": "month", "monthKey": "YYYY-MM" }
```

Követelmények:

- Validálja a módot.
- Validálja a hónap formátumát.
- Hosszabb timeouttal fusson.
- Írási vagy archiválási műveletnél ne legyen automatikus retry, mert duplikált műveletet okozhat.

### `POST /invoice-automation/approve`

Body:

```json
{ "monthKey": "YYYY-MM" }
```

A havi kiküldés csak ezután indulhat.

### `GET /invoice-automation/ai-status?live=1`

Élő AI health check. Fontos: ez ne adjon routing döntést.

## Számlafelismerési Szabálymotor

Hozz létre külön szabályszolgáltatást. Ne keverd a route-ba.

### Normalizálás

Minden vizsgált szöveget normalizálj:

- lowercase,
- ékezetek eltávolítása,
- whitespace tömörítés,
- trim.

### Számla Szándék Felismerése

Keress többnyelvű kifejezéseket:

- `invoice`,
- `bill`,
- `billing`,
- `proforma`,
- `receipt`,
- `tax invoice`,
- `szamla`,
- `e-szamla`,
- `dijbekero`,
- `vegszamla`,
- `eloszamla`,
- `bizonylat`,
- `nyugta`,
- `fizetes`,
- `payment`.

### Dokumentumszintű Számla Felismerése

Ne csak e-mail szöveg alapján dönts. Ha van PDF, DOC, DOCX, TXT vagy más elemezhető tartalom, abból nyert szöveg legyen az elsődleges bizonyíték.

Példák dokumentumjelzőkre:

- `invoice`,
- `tax invoice`,
- `receipt`,
- `proforma`,
- `szamla`,
- `e-szamla`,
- `dijbekero`,
- `bizonylat`,
- `nyugta`,
- `sorszam`,
- `szamlaszam`,
- `teljesites datuma`.

### Hamis Pozitív Kizárás

Ne fogadj el minden számla szót. Példa: `számlavezető bank` ne számítson számladokumentumnak.

### Melléklet Szűrés

Engedett fájltípusok:

- `.pdf`,
- `.xlsx`,
- `.xls`,
- `.doc`,
- `.docx`,
- `.csv`,
- `.xml`,
- `.txt`.

Tiltott zajmellékletek:

- `logo.*`,
- `image001.*`,
- `signature.*`,
- `icon.*`,
- `spacer.*`,
- `.ics`,
- `noname.*`.

## Cég, Projekt vagy Könyvelési Cél Routing

Ne hardcode-old üzleti címzettekkel a core logikát. Legyen konfigurálható routing tábla.

Példa:

```ts
const ROUTING_TARGETS = {
  TENANT_A: {
    aliases: [/tenant a/i, /tax number 123456/i],
    envRecipients: ['ACCOUNTING_TENANT_A_PRIMARY', 'ACCOUNTING_TENANT_A_SECONDARY'],
    defaultRecipients: [],
  },
  TENANT_B: {
    aliases: [/tenant b/i],
    envRecipients: ['ACCOUNTING_TENANT_B_PRIMARY'],
    defaultRecipients: [],
  },
};
```

Szabály:

- Ha pontosan egy cél illeszkedik, route-olható.
- Ha nulla vagy több cél illeszkedik, legyen `UNKNOWN` vagy `manual_review`.
- Ismeretlen cél esetén tilos automatikusan default címzettre küldeni.

## AI Használat Helyes Módja

Az AI csak tanácsadó lehet, nem végső döntéshozó.

Helyes:

- AI segíthet céget vagy projektet javasolni, ha determinisztikus szabály nem talál.
- AI health check külön végponton legyen.
- A végleges kiküldési döntést determinisztikus szabály és review gate hozza.

Rossz:

- „Kérdezzük meg az AI-t, hogy számla-e, és küldjük tovább.”
- „AI szerint ez X cég, ezért automatikusan mehet.”
- „Ha bizonytalan, akkor is küldjük el.”

Kötelező megállási pontok:

- ismeretlen cég,
- kétértelmű cég,
- adó vagy VAT kockázat,
- nem egyértelmű számladokumentum,
- korrekciós vagy stornó gyanú.

Ezekben az esetekben: `manual_review`, nincs automatikus továbbítás.

## Dokumentumfeldolgozás

Implementálj dokumentum parser réteget:

- PDF: szövegkinyerés.
- DOC/DOCX: raw text extraction.
- TXT/CSV/JSON/text: UTF-8 szöveg.
- Max fájlméret: körülbelül 10 MB.
- Nem támogatott típusnál ne omoljon össze a futás, csak logoljon és hagyja ki.

Minden dokumentumhoz számolj:

- bináris SHA-256 hash,
- normalizált szöveg SHA-256 hash.

Ezeket idempotenciára és duplikátumszűrésre használd.

## Linkből Számla Letöltése

Az e-mail HTML és plain text tartalmából keress számlaletöltő linkeket.

Pontozás:

- invoice, receipt, bill, szamla, dijbekero token,
- `.pdf` URL,
- ismert számlaszolgáltató domain,
- download, view, megtekintes, letoltes szöveg.

Csak magas pontszámú linket tölts le.

Biztonsági szabályok:

- Csak `https://` engedett.
- Localhost és private IP tiltva.
- DNS feloldás után is ellenőrizni kell, hogy nem privát IP-re mutat.
- Redirect limit legyen, például 4 hop.
- Max letöltés legyen, például 10 MB.
- HTML válaszból csak akkor menj tovább, ha található benne újabb jó pontszámú PDF link.

Rossz kísérletek:

- bármilyen URL letöltése e-mailből,
- HTTP engedése,
- belső hálózati címek engedése,
- redirectek korlátlan követése,
- méretlimit nélküli letöltés.

## Idempotencia és Audit

Minden futás legyen újrafuttatható.

Tárolj markereket:

- `invoice_doc_sha_<sha>`: dokumentum már feldolgozva,
- `invoice_link_<emailId>_<linkHash>`: link már próbálva vagy feldolgozva,
- `invoice_auto_<accountId>_<emailId>_<docHash>`: archivált számla rekord,
- `invoice_daily_collected_<dateKey>`: napi futás claim vagy done,
- `invoice_monthly_collected_<monthKey>`: havi gyűjtés claim vagy done,
- `invoice_monthly_preview_sent_<monthKey>`: jóváhagyási előnézet elküldve,
- `invoice_monthly_approved_<monthKey>`: ember jóváhagyta,
- `invoice_monthly_sent_<monthKey>_<targetHash>`: havi kiküldés megtörtént.

Ezek megakadályozzák:

- duplikált feltöltést,
- duplikált linkletöltést,
- duplikált havi kiküldést,
- párhuzamos futások ütközését.

## Archiválás

A dokumentumokat strukturált mappába mentsd:

- root: `Invoice-Automation`,
- hónap: `YYYY-MM`,
- cél, cég vagy projekt: például `TENANT_A`, `TENANT_B`.

Minden feltöltés után tárold:

- emailId,
- accountId,
- cél vagy cég,
- fájlnév,
- tárhely fileId,
- megtekintési link,
- monthKey,
- sourceKind: `attachment` vagy `link`,
- sha256,
- textSha256,
- reviewStatus,
- sourceUrl.

## Havi Jóváhagyási Folyamat

A havi automata kiküldés ne történjen meg azonnal.

Helyes folyamat:

1. Hónap első napján, helyi idő szerint reggel 7 után:
   - előző hónap teljes újrasöprése,
   - dokumentumok gyűjtése,
   - cégenként vagy projektenként csoportosítás.
2. Küldj előnézetet a fiók tulajdonosának:
   - melyik cég vagy projekt,
   - hány dokumentum,
   - dokumentumlinkek,
   - kik lennének a címzettek.
3. Csak `approve(monthKey)` után menjen ki a végleges havi e-mail.
4. A végleges kiküldést célonként markerrel zárd le.

Rossz:

- havi számlák automatikus kiküldése jóváhagyás nélkül,
- ismeretlen routing cél automatikus címzése,
- újrafuttatáskor ugyanazt a hónapot újra kiküldeni.

## Ütemezés

Napi gyűjtés:

- helyi időzóna szerint,
- például 07:00 után,
- legutóbbi 7 napra.

Havi gyűjtés:

- hónap 1-jén,
- előző teljes hónapra.

Manuális futtatás:

- napi,
- előző hónap,
- konkrét `YYYY-MM`.

Figyelj:

- időzóna explicit legyen,
- claim marker akadályozza meg, hogy egy intervallum többször fusson ugyanarra a napra vagy hónapra.

## Konfiguráció

Env változókból jöjjenek:

- célcímzettek,
- opcionális alert címzett,
- AI provider kulcsok,
- tárhely vagy OAuth scope.

Konfiguráció hiány esetén:

- ne crash-eljen az app,
- a számlaautomatizálás ne fusson veszélyesen,
- státuszban jelenjen meg a hiány,
- opcionálisan küldj figyelmeztetést vagy írj markerbe figyelmeztetést,
- kézi futtatás adjon `ok: false` és `missingConfig` választ.

## Rossz Kísérletek, Amelyeket Kerülni Kell

1. Csak kulcsszavas frontend szűrés.
   Ez jó menüpontnak, de nem elég automatizációnak.

2. AI-alapú végső döntés.
   AI tévedhet. Routing és kiküldés determinisztikus kapun menjen át.

3. Duplikációvédelem hiánya.
   Újrafuttatáskor ugyanazt a dokumentumot újra feltölti vagy kiküldi.

4. Arbitrary URL download.
   SSRF és adatbiztonsági kockázat.

5. Jóváhagyási kapu kihagyása.
   Havi könyvelési csomag emberi review nélkül veszélyes.

6. Mellékletnév alapján automatikus kiküldés.
   `invoice.pdf` önmagában nem elég. Tartalmi bizonyíték is kell.

7. Ismeretlen cég fallback címzettel.
   Ismeretlen cél esetén manual review kell, nem default e-mail.

8. Nincs méretlimit.
   PDF, linkletöltés és parsing maximum mérettel fusson.

9. Nincs audit marker.
   Nem lehet megmondani, mi történt és miért nem futott újra.

10. Nincs státusz UI.
    Üzemeltetéshez kell látni: config, AI, schedule, recent markers.

## Minimum Tesztek

Írj egységteszteket:

- cég vagy projekt felismerés alias alapján,
- ismeretlen cég manual review,
- számla intent felismerés,
- hamis pozitív kizárás, például banki „számlavezető”,
- zajmellékletek kihagyása,
- PDF/DOC/TXT feldolgozás méretlimittel,
- kockázatos VAT vagy adó eset manual review,
- havi approve nélkül nincs kiküldés,
- marker megléte esetén nincs duplikált feldolgozás.

## Implementációs Elv

A rendszer akkor helyes, ha:

- számlagyanús e-maileket kényelmesen listáz,
- dokumentumot tényleges tartalom alapján vizsgál,
- csak bizonyított célra route-ol,
- bizonytalan esetben megáll,
- minden futás újrafuttatható,
- nem küld duplikátumot,
- nem tölt le veszélyes linket,
- havi továbbküldés előtt emberi jóváhagyást kér,
- státuszban és markerekben minden fontos döntés visszakövethető.

## Rövid Összegzés

A jó megoldás nem egy egyszerű „számla” kulcsszavas mappa, hanem egy bizonyíték-alapú, idempotens, emberi jóváhagyással védett számlafeldolgozó pipeline.

A kulcsszavas menüpont csak a látható UX-réteg. A valódi érték a szabálymotor, dokumentumparser, linkbiztonság, hash-alapú duplikációvédelem és havi approval workflow.
