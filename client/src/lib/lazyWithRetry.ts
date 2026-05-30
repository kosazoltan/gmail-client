import { ComponentType, lazy, LazyExoticComponent } from 'react';

/**
 * lazyWithRetry — robust wrapper around React.lazy() that handles stale chunk errors.
 *
 * Vite/Rollup code-splitting hashes asset filenames. After a new deploy, any client that
 * still holds an old index-*.js will try to import old chunk hashes that no longer exist
 * on the server, raising:
 *   - "Failed to fetch dynamically imported module"
 *   - ChunkLoadError
 *   - "Importing a module script failed"
 *
 * Standard remedy: do a single hard reload to fetch the fresh index.html and matching
 * chunk hashes. We guard against an infinite reload loop using sessionStorage:
 *   - If reload was not yet attempted in this session, mark the flag and reload.
 *   - If reload was already attempted, let the error propagate to ErrorBoundary.
 *
 * Successful chunk load clears the flag so a future stale-chunk event can recover again.
 */

const RELOAD_FLAG_PREFIX = 'lazyWithRetry:reloaded:';
const CHUNK_ERROR_PATTERNS: readonly RegExp[] = [
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /ChunkLoadError/i,
  /Loading chunk [\d]+ failed/i,
  /Loading CSS chunk [\d]+ failed/i,
];

export function isChunkLoadError(err: unknown): boolean {
  if (!err) return false;
  const message =
    err instanceof Error ? `${err.name}: ${err.message}` : typeof err === 'string' ? err : '';
  if (!message) return false;
  return CHUNK_ERROR_PATTERNS.some((re) => re.test(message));
}

function getStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Wraps a dynamic `import(...)` factory with stale-chunk reload recovery.
 *
 * Generic bound is `ComponentType<any>` (matching React.lazy's own signature)
 * because Suspense-loaded components carry their own props, not a fixed shape.
 *
 * @param factory  Same shape as React.lazy() expects: () => Promise<{ default: T }>
 * @param key      Stable cache key per chunk so different routes do not share the
 *                 same "already reloaded" flag. Defaults to the factory's source text.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  key?: string,
): LazyExoticComponent<T> {
  const storageKey = `${RELOAD_FLAG_PREFIX}${key ?? factory.toString().slice(0, 120)}`;

  return lazy(async () => {
    try {
      const mod = await factory();
      // Successful load — clear any stale reload marker so next deploy can recover too.
      const storage = getStorage();
      try {
        storage?.removeItem(storageKey);
      } catch {
        /* ignore */
      }
      return mod;
    } catch (err) {
      if (!isChunkLoadError(err)) {
        throw err;
      }

      const storage = getStorage();
      const alreadyReloaded = storage?.getItem(storageKey) === '1';

      if (alreadyReloaded || !storage || typeof window === 'undefined') {
        // We already tried a reload once, or storage is unavailable.
        // Surface the error to ErrorBoundary instead of looping.
        throw err;
      }

      try {
        storage.setItem(storageKey, '1');
      } catch {
        // If the guard flag cannot be saved (e.g. storage quota exceeded or blocked),
        // do NOT reload — without the guard we cannot prevent an infinite reload loop.
        throw err;
      }

      // reload() fetches the fresh index.html; no new history entry is created.
      window.location.reload();

      // Return a never-resolving promise so React keeps showing the Suspense fallback
      // until the page actually reloads.
      return new Promise<{ default: T }>(() => {
        /* intentional: page is reloading */
      });
    }
  });
}
