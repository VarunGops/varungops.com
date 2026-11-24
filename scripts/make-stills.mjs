// Renders the still images shown before the live stage starts, and in its place without WebGL or with reduced data.
// Builds nothing: run `npm run build` first. usage: node scripts/make-stills.mjs
import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const PORT = 4399, base = `http://localhost:${PORT}`;
const server = spawn(process.execPath, ['scripts/serve-dist.mjs'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
try {
  await new Promise(ok => setTimeout(ok, 600));
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const ready = () => page.waitForFunction(() => document.documentElement.dataset.stage === 'live', null, { timeout: 180000 });
  // export a canvas region as WebP on black, at the canvas's own resolution
  const grab = (sel, cssW, cssH, outW, outH) => page.evaluate(([sel, cssW, cssH, outW, outH]) => {
    const c = document.querySelector(sel), s = c.width / c.clientWidth, o = document.createElement('canvas');
    o.width = outW; o.height = outH; const x = o.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, outW, outH);
    x.drawImage(c, 0, 0, cssW * s, cssH * s, 0, 0, outW, outH);
    return o.toDataURL('image/webp', 0.86);
  }, [sel, cssW, cssH, outW, outH]);
  const save = async (name, url) => { await writeFile(`public/still/${name}.webp`, Buffer.from(url.split(',')[1], 'base64')); console.log('wrote public/still/' + name + '.webp'); };
  await mkdir('public/still', { recursive: true });

  await page.goto(`${base}/?age=4.38&yaw=0.2&smoke=0`); await ready();
  await save('brain', await grab('#stage', 1280, 800, 1280, 800));

  await page.goto(`${base}/?hage=0.3&hyaw=0&age=4.38&yaw=0.2&smoke=0`); await ready();
  await page.locator('#heart').scrollIntoViewIfNeeded(); await page.waitForTimeout(500);
  const { w, h } = await page.evaluate(() => { const r = document.querySelector('#heart').getBoundingClientRect(); return { w: r.width, h: r.height }; });
  await save('heart', await grab('#heart', w, h, 800, 1000));

  // the section pages' wider art, at the review moments the tests use: the eyes looking ahead, the hands mid-drift
  for (const [name, url] of [['eyes', '/now/?hage=0.3&hyaw=0'], ['hands', '/clinical-experience/?hage=7&hyaw=0']]) {
    await page.goto(base + url); await ready(); await page.waitForTimeout(300);
    const r = await page.evaluate(() => { const b = document.querySelector('#art').getBoundingClientRect(); return { w: b.width, h: b.height }; });
    await save(name, await grab('#art', r.w, r.h, 1280, Math.round(1280 * r.h / r.w)));
  }
  // and as a phone draws them: a narrower box, the eyes and hands framed larger
  const phone = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  for (const [name, url] of [['eyes', '/now/?hage=0.3&hyaw=0'], ['hands', '/clinical-experience/?hage=7&hyaw=0']]) {
    await phone.goto(base + url); await phone.waitForFunction(() => document.documentElement.dataset.stage === 'live', null, { timeout: 180000 }); await phone.waitForTimeout(300);
    const url2 = await phone.evaluate(() => { const c = document.querySelector('#art'), o = document.createElement('canvas'); o.width = c.width; o.height = c.height; const x = o.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, o.width, o.height); x.drawImage(c, 0, 0); return o.toDataURL('image/webp', 0.86); });
    await save(`${name}-phone`, url2);
  }

  // the social preview: the first screen at 1200 x 630, brain and name
  const og = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await og.goto(`${base}/?age=4.38&yaw=0.2&smoke=0`);
  await og.waitForFunction(() => document.documentElement.dataset.stage === 'live', null, { timeout: 180000 });
  await og.waitForTimeout(300);
  await og.screenshot({ path: 'public/og.png' }); console.log('wrote public/og.png');
} finally {
  await browser.close(); server.kill();
}
