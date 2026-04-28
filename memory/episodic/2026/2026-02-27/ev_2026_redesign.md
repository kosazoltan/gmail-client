---
id: ev_2026_02_27_001
type: episodic
domain: feature
title: '2026 Redesign — code splitting, Tailwind 4, design system'
summary: '84% code splitting csokkenes (1554KB → 248KB), Tailwind 4 dark mode fix, teljes CSS modernizalas, animaciok, PWA javitasok.'
entities:
  - code splitting
  - Tailwind 4
  - dark mode
  - design system
  - PWA
tags:
  - redesign
  - performance
  - frontend
  - CSS
  - dark-mode
importance: 0.88
confidence: 0.99
status: active
created_at: 2026-04-10T10:00:00Z
event_time: 2026-02-27T00:00:00Z
time_scope: event
source_refs:
  - file:CHANGELOG.md
links:
  relates_to:
    - sem_arch_stack_001
retrieval_hints:
  lexical:
    - redesign
    - code splitting
    - Tailwind 4
    - dark mode
    - performance
    - CSS
  semantic:
    - frontend redesign
    - performance optimization
    - design system overhaul
---

# 2026 Redesign (2026-02-27)

## Performance

- **Code splitting:** Lazy loading 20 view-ra (React.lazy + Suspense)
- Index chunk: **1554KB → 248KB (84% csokkenes!)**
- Minden view kulon chunk, csak szukseg eseten toltodik
- Vendor chunks: vendor-react, vendor-query, vendor-ui, vendor-sanitize

## Tailwind 4 dark mode fix

- `@custom-variant dark` hozzaadva index.css-ben
- TW4 alapertelmezetten media query-t hasznal, nem class-t
- Class-based dark mode-hoz explicit konfiguracio kellett

## Design system

- Custom @theme valtozok (dark mode szinpaletta)
- Modern font stack (Inter, system fonts)
- Font feature settings (tabular nums, cv02-cv11)
- 6px scrollbar dizajn
- Smooth transitions
- Focus visible outline (accessibility)
- Animaciok: slide-up, slide-in, scale-in, fade-in

## Dark mode email tartalom

- Fekete/sotet szovegszinek vilagositasa
- Feher hatterek felulirasa
- Google email kompatibilitas (#5f6368, rgb szinek)
- Input mezok + scrollbar sotet stilusa

## Build eredmenyek

- Index chunk: 248KB (gzip: 75KB)
- CSS: 72KB (gzip: 12KB)
- Build ido: ~4.3s
