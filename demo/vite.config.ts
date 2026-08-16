import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const repo = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  root,
  /*
   * GitHub Pages serves a project site from `/<repo>/`, not from the domain
   * root, so a build made for it has to know its own prefix or every asset URL
   * comes back 404. It is an env var rather than a constant because local dev
   * and `npm run demo:build` are served from `/` — hard-coding the repo name
   * would break the one thing that gets run most.
   */
  base: process.env.DEMO_BASE ?? '/',
  // JSX without @vitejs/plugin-react: esbuild handles .tsx on its own, and the
  // plugin currently requires Vite 8 while the library builds on Vite 7.
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      // Point at source, not dist, so the demo reloads on library edits — and
      // so what is exercised in the browser is the code being worked on.
      '@acetrumtech/svg-to-fabric': fileURLToPath(new URL('../src/index.ts', import.meta.url)),
    },
  },
  server: {
    fs: { allow: [repo] },
  },
  build: {
    outDir: fileURLToPath(new URL('dist', import.meta.url)),
    emptyOutDir: true,
  },
});
