# Gmail Client - Docker környezet

## Gyors indítás

```bash
# Környezeti változók beállítása
cp server/.env.example server/.env
# Szerkeszd a server/.env fájlt és add meg a Google OAuth credentials-t!

# Build és indítás
docker-compose up -d

# Logok megtekintése
docker-compose logs -f

# Leállítás
docker-compose down
```

## Szolgáltatások

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000
- **Volume**: Adatbázis perzisztens tárolása `./server/data` mappában

## Fejlesztői mód

```bash
# Hot reload fejlesztéshez
docker-compose -f docker-compose.dev.yml up
```

## Production Build

```bash
# Optimalizált production build
docker-compose -f docker-compose.prod.yml up -d
```
