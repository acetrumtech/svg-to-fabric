import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  build: {
    target: 'es2022',
    // No sourcemaps in the published build: they embed the full TypeScript
    // source, which triples the package size for a consumer who will almost
    // never step through it.
    sourcemap: false,
    lib: {
      entry: {
        index: fileURLToPath(new URL('src/index.ts', import.meta.url)),
      },
      formats: ['es'],
    },
    rollupOptions: {
      // `fabric` is a peer dependency and must never end up in this bundle — a
      // second copy would break `instanceof` against the host's classes, and
      // the objects this package builds are meant to be the host's own.
      external: ['fabric'],
    },
  },
  test: {
    // Fabric's SVG parser is a browser library, and this package's own parsing
    // goes through DOMParser/XMLSerializer. jsdom supplies both.
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
});
