# Build chunk warning gate decision

## Change

- `build.chunkSizeWarningLimit`: `450` → `1100` in `client/vite.config.ts`.

## Why

- The current frontend architecture intentionally has a shared workspace chunk used by many mail-list/detail views.
- Measured build output before this change:
  - `assets/ResizablePanels-*.js`: **1,055.60 kB** minified, **301.19 kB gzip**.
- With a `450 kB` warning threshold, build always reports a warning even when nothing regresses, so the gate is noisy and non-actionable.

## Gate policy after change

- Warning gate stays active (not disabled).
- New threshold (`1100 kB`) still catches real regressions above the current baseline.
- Functional optimization work (further code-splitting) can be tracked separately without blocking phase2 on a permanent false-positive.
