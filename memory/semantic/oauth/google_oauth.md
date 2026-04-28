---
id: sem_oauth_google_001
type: semantic
domain: oauth
title: 'Google OAuth 2.0 konfiguracio'
summary: 'ZMail Google OAuth beallitasok: redirect URI harom helyen egyeznie kell, GOCSPX- prefix kotelezo, Gmail API scope-ok.'
entities:
  - Google OAuth
  - Gmail API
  - GOCSPX
  - redirect_uri
tags:
  - oauth
  - google
  - authentication
  - credentials
  - Gmail API
importance: 0.95
confidence: 0.99
status: active
created_at: 2026-04-10T10:00:00Z
updated_at: 2026-04-10T10:00:00Z
time_scope: persistent
valid_from: 2026-02-16
source_refs:
  - file:CLAUDE.md
  - file:docs/google-oauth-verification.md
  - file:server/.env.example
retrieval_hints:
  lexical:
    - OAuth
    - Google
    - redirect_uri
    - GOCSPX
    - client_secret
    - Gmail API
    - scope
  semantic:
    - authentication setup
    - Google credentials
    - OAuth configuration
---

# Google OAuth 2.0 konfiguracio

## Alkalmazas adatok

- **App Name:** ZMail
- **Project ID:** zmail-485804
- **Client ID:** 694501523042-oc18ung7lebd9nsg7bf6vlc77lth3kte.apps.googleusercontent.com
- **Homepage:** https://mail.mindenes.org

## Redirect URI — HAROM helyen kell egyeznie!

1. **Google Cloud Console** → Credentials → Authorized redirect URIs
2. **Render env var:** `GOOGLE_REDIRECT_URI`
3. **Kodban:** `auth.service.ts` → `createOAuth2Client()`

**Jelenlegi ertek:** `https://api.mindenes.org/api/auth/callback`

## Client Secret

**MINDIG `GOCSPX-` prefix-szel kezdodik!**
Ha nem azzal kezdodik → ROSSZ secret → `auth_failed` lesz.
Kivetel: `ZMAIL_ALLOW_NON_GOCSPX_SECRET=1` (nem ajanlott)

## Gmail API scope-ok

| Scope              | Cel                         | Erzekeny |
| ------------------ | --------------------------- | -------- |
| `gmail.readonly`   | Email olvasas               | Igen     |
| `gmail.send`       | Email kuldes                | Igen     |
| `gmail.modify`     | Cimkek, olvasott/olvasatlan | Igen     |
| `gmail.labels`     | Cimke kezeles               | Igen     |
| `userinfo.email`   | Email cim lekerdezes        | Nem      |
| `userinfo.profile` | Profil info                 | Nem      |

## Session cookie

- **Domain:** `.mindenes.org`
- **SameSite:** None
- **Secure:** true
- **HttpOnly:** true
- Cross-subdomain mukodik: `mail.mindenes.org` ↔ `api.mindenes.org`

## Authorized JavaScript origins

- `https://mail.mindenes.org`

## Token tarolas

- OAuth tokenek: `oauth_token_store` PostgreSQL tabla (Neon)
- Titkositas: AES-256, `ENCRYPTION_KEY` env var
- Ujrainditas utan megmarad (Neon persistent)
