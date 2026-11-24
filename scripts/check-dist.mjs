// Checks the finished build before it can go live: Vercel runs this as part of `npm run check`.
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { STOPS } from '../src/lib/stops.js';

const dist = 'dist', problems = [];
const walk = async d => (await Promise.all((await readdir(d, { withFileTypes: true })).map(e => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]))).flat();
const exists = async p => { try { await stat(p); return true; } catch { return false; } };

if (!(await exists(dist))) { console.error('no dist/ folder: run npm run build first'); process.exit(1); }
const files = await walk(dist), rel = files.map(f => relative(dist, f));
if (!rel.includes('index.html')) problems.push('missing dist/index.html');

const DATA = ['brain', 'tracts', 'tracts-lite', 'heart'].flatMap(n => [`data/${n}.bin`, `data/${n}.json`]);
for (const d of DATA) if (!rel.includes(d)) problems.push(`missing dist/${d}`);
for (const r of rel) if (/^(mockup|prep)\//.test(r)) problems.push(`dist/${r} should not be published`);

// every link and asset beginning with / must resolve to a file in dist
for (const f of files.filter(f => f.endsWith('.html'))) {
  const html = await readFile(f, 'utf8');
  for (const [, url] of html.matchAll(/(?:href|src)="(\/[^"#?]*)/g)) {
    if (url.startsWith('//')) continue;
    const p = join(dist, decodeURIComponent(url)), ok = (await exists(p)) && ((await stat(p)).isFile() || (await exists(join(p, 'index.html'))));
    if (!ok) problems.push(`${relative(dist, f)} links to ${url}, which is not in the build`);
  }
}

const size = async r => (await exists(join(dist, r))) ? (await stat(join(dist, r))).size : 0;
const mb = n => (n / 1048576).toFixed(2) + ' MB';
const bins = rel.filter(r => r.startsWith('data/') && r.endsWith('.bin'));
let all = 0; for (const b of bins) { const s = await size(b); all += s; console.log(`  ${b.padEnd(24)} ${mb(s)}`); }
const core = (await size('data/brain.bin')) + (await size('data/heart.bin'));
const desktop = core + (await size('data/tracts.bin')), phone = core + (await size('data/tracts-lite.bin'));
console.log(`  all anatomy data         ${mb(all)}\n  a desktop loads          ${mb(desktop)}\n  a phone loads            ${mb(phone)}`);
if (desktop >= 9 * 1048576) problems.push(`a desktop would load ${mb(desktop)}, over the 9 MB limit`);
if (phone >= 7 * 1048576) problems.push(`a phone would load ${mb(phone)}, over the 7 MB limit`);

// a section page loads only its own art: at most 3 MB on a desktop and 2 MB on a phone (its -lite file where there is one),
// and every piece has a still image to show before it draws and in its place when it cannot
for (const { art, path } of STOPS.filter(s => s.art)) {
  const full = await size(`data/${art}.bin`), lite = (await exists(join(dist, `data/${art}-lite.bin`))) ? await size(`data/${art}-lite.bin`) : full;
  console.log(`  ${path.padEnd(24)} ${mb(full)} desktop, ${mb(lite)} phone`);
  if (full >= 3 * 1048576) problems.push(`${path} would load ${mb(full)} on a desktop, over the 3 MB page limit`);
  if (lite >= 2 * 1048576) problems.push(`${path} would load ${mb(lite)} on a phone, over the 2 MB page limit`);
  if (!rel.includes(`still/${art}.webp`)) problems.push(`no still image for the ${art} (public/still/${art}.webp): run npm run stills`);
}

if (problems.length) { for (const p of [...new Set(problems)]) console.error('✘ ' + p); process.exit(1); }
console.log('✓ dist checks passed');
