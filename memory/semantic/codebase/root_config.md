---
id: sem_code_root_config_001
type: semantic
domain: codebase
title: 'Root konfiguracios fajlok es scriptek'
summary: 'Monorepo root: husky pre-commit, lint-staged, Prettier, EditorConfig, Gitleaks. Scriptek: secrets sync, staged hygiene, production verify, merge helper.'
entities:
  - husky
  - prettier
  - lint-staged
  - gitleaks
  - scripts
tags:
  - codebase
  - config
  - root
  - tooling
  - scripts
importance: 0.80
confidence: 0.99
status: active
created_at: 2026-04-10T12:00:00Z
updated_at: 2026-04-10T12:00:00Z
time_scope: persistent
source_refs:
  - file:package.json
  - file:.prettierrc
  - file:.editorconfig
  - file:.gitleaks.toml
  - file:.gitignore
retrieval_hints:
  lexical:
    - config
    - prettier
    - husky
    - lint-staged
    - script
    - gitleaks
    - gitignore
  semantic:
    - project configuration
    - tooling setup
    - code quality
    - pre-commit hooks
---

# Root konfiguracio

## package.json scriptek

```json
"secrets:sync-github"   → node scripts/sync-actions-secrets.mjs
"hygiene:check-staged"  → node scripts/check-staged-hygiene.mjs
"format"                → prettier --write "**/*.{ts,tsx,js,jsx,json,md,css}"
"format:check"          → prettier --check ...
"lint"                  → cd client && npx eslint . --max-warnings 0
"prepare"               → husky
```

## Pre-commit (husky + lint-staged)

`*.{ts,tsx,js,jsx}` → eslint --fix + prettier --write
`*.{json,md,html}` → prettier --write

## Prettier (.prettierrc)

semi: true, singleQuote: true, trailingComma: all, printWidth: 100,
tabWidth: 2, endOfLine: lf, plugin: prettier-plugin-tailwindcss

## EditorConfig

charset: utf-8, indent: space/2, lf, trim trailing, final newline

## Gitleaks (.gitleaks.toml)

useDefault: true + custom regex: `(api[_-]?key|secret|password|token)\s*=\s*.{6,}`

## Gitignore

node*modules, dist, *.db, data/, .env, .env.local, .env.secrets,
\_.log, logs/, client_secret*.json, .claude/, playwright-report,
test-results, *.tsbuildinfo, \*.eslintcache

## Scriptek

| Script                             | Funkcio                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| `scripts/sync-actions-secrets.mjs` | Lokalis .env → GitHub Actions Secrets szinkron                                 |
| `scripts/check-staged-hygiene.mjs` | Pre-commit: blokkolja node_modules, dist, .next, cache, coverage, log fajlokat |
| `scripts/verify-production.py`     | Deploy smoke: /api/health, /api/auth/login, frontend /, manifest.json          |
| `scripts/merge-to-main.sh`         | Git merge helper                                                               |

## Root dependencies

- `ssh2` (dependency)
- `husky`, `lint-staged`, `prettier`, `prettier-plugin-tailwindcss` (devDependencies)
