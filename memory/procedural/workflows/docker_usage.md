---
id: proc_docker_001
type: procedural
domain: workflow
title: 'Docker hasznalat'
summary: 'Docker kontenererizacio: docker-compose.yml (prod), docker-compose.dev.yml (hot reload). Frontend :5173, Backend :5000.'
entities:
  - Docker
  - docker-compose
tags:
  - docker
  - containerization
  - development
  - workflow
importance: 0.75
confidence: 0.99
status: active
owner: system
created_at: 2026-04-10T10:00:00Z
updated_at: 2026-04-10T10:00:00Z
time_scope: persistent
source_refs:
  - file:DOCKER.md
  - file:docker-compose.yml
  - file:docker-compose.dev.yml
retrieval_hints:
  lexical:
    - Docker
    - docker-compose
    - container
    - kontenner
  semantic:
    - containerization
    - local development
    - docker setup
---

# Docker hasznalat

## Elokeszulet

```bash
cp server/.env.example server/.env
# Szerkeszd: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, stb.
```

## Production

```bash
docker-compose up -d          # Inditas
docker-compose logs -f        # Logok
docker-compose down           # Leallitas
```

## Fejlesztoi mod (hot reload)

```bash
docker-compose -f docker-compose.dev.yml up
```

## Portok

- **Frontend:** http://localhost:5173
- **Backend:** http://localhost:5000
- **Volume:** `./server/data` (adatbazis perzisztens)

## Fajlok

- `docker-compose.yml` — production konfiguracio
- `docker-compose.dev.yml` — fejlesztoi hot reload
- `server/Dockerfile` — Node.js backend
- `client/Dockerfile` — Nginx frontend
