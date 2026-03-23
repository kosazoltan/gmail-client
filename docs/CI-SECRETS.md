# GitHub Actions + Render API — titkok elhelyezése

## Fontos

- **Soha ne commitold** a valós API kulcsokat, `DATABASE_URL`-t vagy `server/.env` tartalmát a repóba.
- A `server/.env` **gitignore-olt** — ide tedd a helyi kulcsokat; a CI a **GitHub → Settings → Secrets and variables → Actions** tárolóból kapja.

## Változó → GitHub Secret megfeleltetés

| Lokális kulcs (`server/.env`) | GitHub Actions secret neve | Használat                                                             |
| ----------------------------- | -------------------------- | --------------------------------------------------------------------- |
| `GITHUB_PAT` vagy `GH_TOKEN`  | `GITHUB_PAT`               | Opcionális: `gh` / GitHub REST API workflow (workflow_dispatch smoke) |
| `RENDER_API_KEY`              | `RENDER_API_KEY`           | Render REST API (`rnd_…` — Account → API Keys)                        |
| `DEPLOY_HEALTHCHECK_URL`      | `DEPLOY_HEALTHCHECK_URL`   | Deploy healthcheck workflow végi GET (token gyakran az URL-ben)       |

A beépített `secrets.GITHUB_TOKEN` a legtöbb workflow-hoz elég (checkout, Gitleaks); a **PAT** csak akkor kell, ha szélesebb jogosultság kell.

## Egyszeri feltöltés GitHubra

1. Tedd be a kulcsokat a **`server/.env`** fájlba (vagy külön **`.env.secrets`** fájlba — lásd `.gitignore`).
2. Lépj be: `gh auth login`
3. Futtasd a repó gyökeréből:

```bash
node scripts/sync-actions-secrets.mjs
```

Opcionálisan más fájl:

```bash
ZMAIL_DOTENV_PATH=.env.secrets node scripts/sync-actions-secrets.mjs
```

## Render Dashboard

- API kulcs: **Account Settings → API Keys** → `rnd_…`
- Deploy Hook URL (ha a `DEPLOY_HEALTHCHECK_URL`-hez kell): **Service → Deploy → Deploy Hook**

## Ha a kulcsok „megvannak” máshol

Ha jelenleg csak chatben / más gépen vannak, másold be **kézzel** a `server/.env`-be (gitignore), majd futtasd a szinkron szkriptet — a repó fájljaiba ne írd be őket.
