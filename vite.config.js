import { defineConfig } from 'vite';
import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  base: '/Lojasite-Front/',
  server: { host: true },
  build: { target: 'es2022' },
  plugins: [{
    name: 'github-pages-spa-fallback',
    closeBundle() {
      copyFileSync(`${root}dist/index.html`, `${root}dist/404.html`);
    }
  }]
});
