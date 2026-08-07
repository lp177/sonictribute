// vitest/config re-exports Vite's defineConfig with the `test` key typed, so
// build and test settings live in one file.
import { defineConfig } from 'vitest/config';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { renderServiceWorker, type PrecacheEntry } from './src/pwa/buildSw.ts';

/**
 * Emits `sw.js` with a precache manifest built from the files that were
 * actually written. It runs in `closeBundle` (after index.html and the hashed
 * bundles are on disk) and writes the worker at a STABLE path — a hashed
 * service worker URL would never be recognised as an update.
 */
function serviceWorkerPlugin(outDir: string) {
  return {
    name: 'bolt-service-worker',
    // Build only: the dev server is meant to serve fresh code, and a worker
    // written during `vite dev` would also dirty the committed docs/ tree.
    apply: 'build' as const,
    closeBundle() {
      const walk = (dir: string): string[] =>
        readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
          e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
        );
      const entries: PrecacheEntry[] = walk(outDir)
        .map((abs) => ({
          name: relative(outDir, abs).split('\\').join('/'),
          read: () => readFileSync(abs, 'utf8'),
        }))
        // Only text assets are precached, so reading as utf8 is safe — but do
        // it lazily so the social card's bytes are never touched.
        .filter((f) => /^(?:index\.html|manifest\.webmanifest|favicon\.svg|assets\/)/.test(f.name))
        .map((f) => ({ name: f.name, content: f.read() }));

      const template = readFileSync('src/pwa/sw.template.js', 'utf8');
      writeFileSync(join(outDir, 'sw.js'), renderServiceWorker(template, entries));
    },
  };
}

const OUT_DIR = 'docs';

export default defineConfig({
  plugins: [serviceWorkerPlugin(OUT_DIR)],
  /**
   * Relative asset URLs so the same build runs from any location: a GitHub
   * Pages project site (https://user.github.io/repo/), a user site, a custom
   * domain, a sub-folder, or straight off the filesystem. Nothing here
   * depends on knowing the deploy URL.
   */
  base: './',
  build: {
    /**
     * GitHub Pages can serve "main branch /docs folder" with no CI at all, so
     * the production build lives in docs/ and is committed.
     */
    outDir: OUT_DIR,
    emptyOutDir: true,
    target: 'es2022',
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
