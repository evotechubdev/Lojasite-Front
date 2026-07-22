import { defineConfig } from 'vite';
import { copyFileSync, cpSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  server: { host: true },
  build: { target: 'es2022' },
  plugins: [{
    name: 'github-pages-spa-fallback',
    closeBundle() {
      copyFileSync(`${root}dist/index.html`, `${root}dist/404.html`);
      if (existsSync(`${root}imagens`)) cpSync(`${root}imagens`, `${root}dist/imagens`, { recursive: true });
    }
  }]
});
