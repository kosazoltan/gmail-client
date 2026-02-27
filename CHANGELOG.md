# CHANGELOG.md - Gmail Client 2026 Redesign

## [2026-02-27] feature/2026-redesign

### Performance
- **Code splitting:** Lazy loading alkalmazva mind a 20 view-ra (React.lazy + Suspense)
  - Index chunk: 1554KB -> 248KB (84% csokkenes!)
  - Minden view kulon chunk-ba kerul, csak szukseg eseten toltodik be
- **Vite config:** Optimalizalt manualChunks (vendor-react, vendor-query, vendor-ui, vendor-sanitize)
- **Viewer-ek:** PDF, Office, Spreadsheet naturally lazy loaded

### Design System
- **CSS modernizalas:** Teljes index.css ujrairas
  - Custom @theme valtozok (dark mode szinpaletta)
  - Modern font stack (Inter, system fonts)
  - Font feature settings (tabular nums, cv02-cv11)
  - Minimal 6px scrollbar dizajn
  - Smooth transitions (background-color, border-color)
  - Focus visible outline (accessibility, accent szin)
  - Selection szinek (accent alapu)
  - Scroll behavior smooth
- **Animaciok:** slide-up, slide-in, scale-in, fade-in
- **Dark mode:** Teljes email content fix
  - Fekete/sotet szovegszinek vilagositasa
  - Feher hatterek felulirasa
  - Google email kompatibilitas (#5f6368, rgb szinek)
  - Input mezok sotet stilusa
  - Scrollbar sotet tema
- **PWA:** Safe area padding (iOS notch), standalone mode

### Dependencies
- @tanstack/react-query: 5.64.2 -> 5.90.21
- @tanstack/react-query-devtools hozzaadva
- @tailwindcss/forms, @tailwindcss/typography hozzaadva
- eslint-plugin-react, eslint-plugin-security hozzaadva
- @types/react: 19.2.10 -> 19.2.14

### Build eredmenyek
- Index chunk: 248KB (gzip: 75KB)
- CSS: 72KB (gzip: 12KB)
- Build ido: ~4.3s
- Server build: SIKERES
- Client build: SIKERES