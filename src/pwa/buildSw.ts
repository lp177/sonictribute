/**
 * Build-time generation of the service worker's precache manifest.
 *
 * The bundle filenames are content-hashed by Rolldown, so the precache list
 * can only be correct if it is written at build time from what was actually
 * emitted. Hand-maintaining it would go stale silently — the exact failure
 * mode this whole feature exists to fix.
 *
 * Pure functions with no filesystem access, so the interesting part is unit
 * tested; `vite.config.ts` supplies the real file list and writes the result.
 */

export interface PrecacheEntry {
  /** Path relative to the deploy root, e.g. `assets/index-CpomLnWb.js`. */
  name: string;
  /** File contents, used for the version fingerprint. */
  content: string;
}

/**
 * What the app needs to boot and play offline. Deliberately excludes the
 * social card: it is ~250 kB that only link scrapers ever request, and making
 * every player download it to install the app would be a poor trade.
 */
const PRECACHE_PATTERN = /^(?:index\.html|manifest\.webmanifest|favicon\.svg|assets\/[^/]+\.(?:js|css))$/;

/** The precachable subset of the built files, sorted for a stable build. */
export function selectPrecache(names: readonly string[]): string[] {
  return names.filter((n) => PRECACHE_PATTERN.test(n)).sort();
}

/**
 * A version string that changes exactly when the precached bytes change.
 *
 * Hashing the *contents* rather than the filenames matters: `index.html` is
 * not content-hashed, so a build that only edits a meta tag would otherwise
 * reuse the old version and never reach players.
 *
 * FNV-1a — this is cache invalidation, not security.
 */
export function fingerprint(entries: readonly PrecacheEntry[]): string {
  let h = 0x811c9dc5;
  const mix = (s: string): void => {
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  };
  for (const e of [...entries].sort((a, b) => (a.name < b.name ? -1 : 1))) {
    mix(e.name);
    mix('\0');
    mix(e.content);
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Substitute the manifest and version into the service worker template.
 * Throws rather than emitting a worker that would precache nothing or ship an
 * unreplaced placeholder — a silently empty precache is worse than no worker.
 */
export function renderServiceWorker(template: string, entries: readonly PrecacheEntry[]): string {
  const files = selectPrecache(entries.map((e) => e.name));
  if (!files.includes('index.html')) {
    throw new Error('service worker: index.html missing from the build output');
  }
  if (!files.some((f) => f.endsWith('.js'))) {
    throw new Error('service worker: no JS bundle found to precache');
  }
  const kept = entries.filter((e) => files.includes(e.name));
  // replaceAll, not replace: a placeholder mentioned in the template's own
  // prose would otherwise consume the substitution and leave the real constant
  // untouched — which is exactly what the guard below caught in development.
  const version = fingerprint(kept);
  const out = template
    .replaceAll('__VERSION__', () => version)
    .replaceAll('__PRECACHE__', () => JSON.stringify(files, null, 2));
  if (out.includes('__VERSION__') || out.includes('__PRECACHE__')) {
    throw new Error('service worker: template placeholder left unreplaced');
  }
  return out;
}
