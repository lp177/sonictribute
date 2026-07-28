// vitest/config re-exports Vite's defineConfig with the `test` key typed, so
// build and test settings live in one file.
import { defineConfig } from 'vitest/config';

export default defineConfig({
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
    outDir: 'docs',
    emptyOutDir: true,
    target: 'es2022',
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
