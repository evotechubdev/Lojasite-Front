import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('./dist/', import.meta.url)));
const port = Number(process.env.PORT) || 4173;

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.ico': 'image/x-icon',
  '.html': 'text/html; charset=utf-8',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

function publicFile(pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname).replace(/^\/+/, ''); }
  catch { return null; }
  const candidate = resolve(root, decoded);
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) return null;
  if (!existsSync(candidate) || !statSync(candidate).isFile()) return null;
  return candidate;
}

createServer((request, response) => {
  const url = new URL(request.url || '/', 'http://localhost');
  const requestedFile = publicFile(url.pathname);
  const acceptsHtml = String(request.headers.accept || '').includes('text/html');
  const spaRequest = request.method === 'GET' && acceptsHtml && !extname(url.pathname);
  const file = requestedFile || (spaRequest ? join(root, 'index.html') : null);
  if (!file) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
    return response.end('Not found');
  }

  response.writeHead(200, {
    'Content-Type': contentTypes[extname(file).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': file.endsWith('index.html') || file.endsWith('config-pub-sistema.json') ? 'no-store' : 'public, max-age=31536000, immutable',
    'Content-Security-Policy': "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://lojasite-back.onrender.com; frame-src https://www.google.com; form-action 'self'; upgrade-insecure-requests",
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    'Permissions-Policy': 'camera=(self), geolocation=(), microphone=()',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
  });

  if (request.method === 'HEAD') return response.end();
  createReadStream(file).pipe(response);
}).listen(port, '0.0.0.0', () => {
  console.log(`Lojasite frontend ativo na porta ${port}`);
});
