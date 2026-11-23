// Serves dist/ the way Vercel serves a static Astro build: index.html per folder, 404.html for anything missing.
// Used by the browser tests, because `astro preview` detaches into the background when run by an agent.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = join(process.cwd(), 'dist'), port = +(process.env.PORT || 4321);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff', '.xml': 'application/xml', '.txt': 'text/plain', '.bin': 'application/octet-stream' };
const file = async p => { try { const s = await stat(p); if (s.isDirectory()) return file(join(p, 'index.html')); return p; } catch { return null; } };

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const hit = await file(join(root, path));
  const target = hit || join(root, '404.html');
  try {
    const body = await readFile(target);
    res.writeHead(hit ? 200 : 404, { 'content-type': types[extname(target)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404).end('not found'); }
}).listen(port, '127.0.0.1', () => console.log(`serving dist on http://localhost:${port}`));
