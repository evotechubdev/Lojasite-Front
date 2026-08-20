import { defineConfig } from 'vite';
import { copyFileSync, cpSync, existsSync, mkdirSync } from 'node:fs';
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
      mkdirSync(`${root}dist/evotechub`, { recursive: true });
      copyFileSync(`${root}dist/index.html`, `${root}dist/evotechub/index.html`);
      // Formulários públicos são páginas independentes, não slugs de lojas.
      // Mantém tanto /formularios/... quanto /public/formularios/... acessíveis.
      if (existsSync(`${root}dist/formularios`)) {
        mkdirSync(`${root}dist/public`, { recursive: true });
        cpSync(`${root}dist/formularios`, `${root}dist/public/formularios`, { recursive: true });
      }
      if (existsSync(`${root}imagens_org`)) cpSync(`${root}imagens_org`, `${root}dist/imagens_org`, { recursive: true });
    }
  }]
});
