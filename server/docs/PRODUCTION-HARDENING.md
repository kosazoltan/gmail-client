# Production hardening (ZMail szerver)

## Kötelező környezeti változók (fail-closed indulás)

Ha a futás **production runtime**-nak minősül (`NODE_ENV=production`, `RENDER=true`, vagy `FLY_APP_NAME` beállítva), indulás előtt ellenőrzés fut (`assertProductionEnvironment`).

| Változó                                                             | Követelmény                                                           |
| ------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `DATABASE_URL`                                                      | Kötelező (már a `db/index` betöltéskor; hiány → kilépés)              |
| `SESSION_SECRET`                                                    | Nem üres, ≥16 karakter, nem a dev placeholder                         |
| `ENCRYPTION_KEY`                                                    | Nem üres, ≥16 karakter, nem a dev placeholder                         |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | Kötelező; redirect **https**                                          |
| `FRONTEND_URL` / `BACKEND_URL`                                      | Kötelező, **https**                                                   |
| `ERRORLOG_HMAC_SECRET`                                              | Kötelező, ≥16 karakter, **nem** a repóban lévő alapértelmezett string |

Kivétel Google secretre: `ZMAIL_ALLOW_NON_GOCSPX_SECRET=1` (nem ajánlott).

Kényszerített production ellenőrzés dev gépen: `ZMAIL_PRODUCTION_ENFORCEMENT=1`.  
Kikapcsolás (ritka): `ZMAIL_PRODUCTION_ENFORCEMENT=0`.

## Watchdog (check-overdue, fail-closed)

Percenként lefut: `processExpiredSnoozes` + `processScheduledEmails`. **Mindkettő** sikeres kell legyen, hogy frissüljön a `zmail_runtime_watchdog` tábla.

Ha productionben a legutóbbi sikeres tick óta eltelt idő > SLA (alap **15 perc**, `ZMAIL_CRITICAL_JOBS_SLA_MS`), a **`/api/health` HTTP 503** és:

- `code`: `WATCHDOG_CRITICAL_JOBS_OVERDUE` vagy `WATCHDOG_NO_ROW`
- `error`: emberi üzenet
- `database`: `connected` (ha a DB elérhető, de a jobok nem)

Így a Render health check is elhasal → forgalom leválasztás.

Kikapcsolás (csak debug / vész): `ZMAIL_CRITICAL_JOBS_WATCHDOG=0`.

## Audit

Watchdog fail-closed esemény legfeljebb **5 percenként** egyszer kerül az `audit_log` táblába: `event_type = system_watchdog_overdue`.

## API hibakódok

- `AppError` harmadik paramétere opcionális `code` → JSON `{ error, code? }`.
- Health 503: `code` mező mindig kitöltve (`HEALTH_DATABASE_UNAVAILABLE`, watchdog kódok).

## Render Blueprint

`render.yaml`: `ERRORLOG_HMAC_SECRET` → `generateValue: true` (új service). Meglévő service-nél add hozzá kézzel a Dashboardon, ha hiányzik.
