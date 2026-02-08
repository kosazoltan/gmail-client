# CLAUDE.md - Kötelező fejlesztési szabályok

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
