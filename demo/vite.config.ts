import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const repo = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  root,
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
