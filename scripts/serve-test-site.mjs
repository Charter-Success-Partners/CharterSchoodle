import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const root = resolve(option('--root', '.'));
const prefix = `/${option('--prefix', '/').split('/').filter(Boolean).join('/')}`;
const mount = prefix === '/' ? '/' : `${prefix}/`;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (prefix !== '/' && pathname === prefix) {
      res.writeHead(302, { Location: mount }).end();
      return;
    }
    if (!pathname.startsWith(mount)) { res.writeHead(404).end(); return; }
    const file = resolve(root, pathname.slice(mount.length) || 'index.html');
    if (file !== root && !file.startsWith(`${root}${sep}`)) { res.writeHead(403).end(); return; }
    if (!(await stat(file)).isFile()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
server.listen(Number(option('--port', '4173')), '127.0.0.1', () => console.log(`Test site: http://127.0.0.1:${server.address().port}${mount}`));
