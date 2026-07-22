import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./dist/', import.meta.url));
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
  const decoded = decodeURIComponent(pathname).replace(/^\/+/, '');
  const candidate = normalize(join(root, decoded));
  if (!candidate.startsWith(root)) return null;
  if (!existsSync(candidate) || !statSync(candidate).isFile()) return null;
  return candidate;
}

createServer((request, response) => {
  const url = new URL(request.url || '/', 'http://localhost');
  const file = publicFile(url.pathname) || join(root, 'index.html');

  response.writeHead(200, {
    'Content-Type': contentTypes[extname(file).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': file.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable'
  });

  if (request.method === 'HEAD') return response.end();
  createReadStream(file).pipe(response);
}).listen(port, '0.0.0.0', () => {
  console.log(`Lojasite frontend ativo na porta ${port}`);
});
