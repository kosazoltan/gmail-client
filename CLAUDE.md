# CLAUDE.md - Kötelező fejlesztési szabályok

## Kommunikáció nyelve

**KÖTELEZŐ ÉRVÉNYŰ UTASÍTÁS:** A fejlesztés során mindig magyarul kell kommunikálni. Minden válasz, magyarázat, commit üzenet és dokumentáció magyar nyelven készüljön.

## Push előtti kötelező build és teszt

**KÖTELEZŐ ÉRVÉNYŰ UTASÍTÁS:** Minden `git push` előtt végezz próba buildet és futtasd a teszteket.
Csak tesztelt, deploy-kész kód pusholható.

### Push előtti checklist:

1. **Server build:** `cd server && npm run build`
2. **Client build:** `cd client && npm run build`
3. **Client tesztek:** `cd client && npx vitest run`
4. **Formázás ellenőrzés:** `npm run format:check`

Ha bármelyik lépés hibával zárul, **TILOS pusholni**. Először javítsd ki a hibákat.

### Automatikus kikényszerítés

A `.git/hooks/pre-push` hook automatikusan futtatja a build és teszt lépéseket minden push előtt.
Ha a hook sikertelen, a push blokkolva lesz.

## Push utáni kötelező merge to main és deploy

**KÖTELEZŐ ÉRVÉNYŰ UTASÍTÁS:** Minden sikeres feature branch push után végezd el a merge-öt a `main` branchbe, majd indítsd el a deploy folyamatot. A teljes pipeline:

### 1. Feature branch push (pre-push hook ellenőriz)

A push csak akkor megy át, ha a pre-push hook mind a 4 ellenőrzést sikeresen lefuttatja.

### 2. Merge to main

```bash
git checkout main
git pull origin main
git merge <feature-branch>
git push origin main
```

### 3. Automatikus deploy (GitHub Actions)

A `main` branchre történő push automatikusan triggereli a `.github/workflows/deploy-to-vps.yml` workflow-t, ami:

- SSH-n csatlakozik a VPS-hez (`mail.mindenes.org`)
- Lehúzza a legfrissebb kódot
- Telepíti a függőségeket (backend + frontend)
- Buildeli a TypeScript backend-et
- Buildeli a React frontend-et
- Nginx konfigurációt frissíti
- Újraindítja a backend service-t
- SSL tanúsítványt ellenőrzi
- Végső verifikációt futtat

### 4. Manuális deploy (ha szükséges)

Ha a GitHub Actions nem elérhető:

```bash
ssh root@mail.mindenes.org
cd /root/gmail-client
bash deploy.sh
```

### Teljes pipeline összefoglalás

```
Feature branch munka
    → git push (pre-push hook: build + teszt + formázás)
    → merge to main
    → git push origin main
    → GitHub Actions automatikus deploy
    → Éles szerver frissítve (mail.mindenes.org)
```

**Ha bármelyik lépés hibával zárul, TILOS továbblépni.** Először javítsd ki a hibákat.
