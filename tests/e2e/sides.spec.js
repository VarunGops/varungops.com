import { test, expect } from '@playwright/test';

// The home page keeps a short introduction for each section; the whole section opens on its own page,
// sliding in from the side it sits on. Reduced motion keeps software WebGL from starving these tests.
test.use({ reducedMotion: 'reduce' });
const drafts = !!process.env.SHOW_DRAFTS;

const OPEN = [
  ['About', '/about/', 'right'], ['Now', '/now/', 'left'], ['Clinical Experience', '/clinical-experience/', 'right'],
  ['Research', '/research/', 'left'], ['Teaching', '/teaching/', 'right'], ['Life', '/life/', 'right'],
];

test('each section on the home page opens its own page, alternating sides', async ({ page }) => {
  await page.goto('/');
  for (const [label, path, side] of OPEN) {
    const s = page.locator(`[data-label="${label}"]`);
    await expect(s).toHaveAttribute('data-side', side);
    await expect(s.getByRole('heading', { level: 2 }).getByRole('link')).toHaveAttribute('href', path);
  }
});

test('the home page keeps only the introductions', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#about')).toContainText('A doctor working towards a life in surgery and the brain.');
  await expect(page.locator('#about')).toContainText('Full GMC registration');
  await expect(page.getByText('glued to the brain model', { exact: false })).toHaveCount(0);
  await expect(page.getByText('adaptation of the WHO Surgical Safety Checklist', { exact: false })).toHaveCount(0);
});

test('every side page has its heading, its content and a way back', async ({ page }) => {
  for (const [label, path, side] of OPEN) {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('data-side', side);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('.label').first()).toContainText(label === 'Now' ? 'Now' : label);
    const back = page.getByRole('link', { name: /Varun Gopal Rajan/ }).first();
    await expect(back).toHaveAttribute('href', new RegExp(`^/#`));
  }
});

test('About holds his paragraphs under the heart', async ({ page }) => {
  await page.goto('/about/');
  await expect(page.getByText('glued to the brain model', { exact: false })).toBeVisible();
  await expect(page.getByText('one whose work reaches further than his own operating list', { exact: false })).toBeVisible();
  await expect(page.locator('#heart')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('img.still-heart')).toHaveAttribute('alt', /heart/);
});

test('Clinical Experience holds the posts and the CV', async ({ page, request }) => {
  await page.goto('/clinical-experience/');
  await expect(page.getByText('adaptation of the WHO Surgical Safety Checklist', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: /Download my CV/ })).toHaveAttribute('href', '/Dr_Varun_Gopal_Rajan_CV.pdf');
  expect((await request.get('/Dr_Varun_Gopal_Rajan_CV.pdf')).status()).toBe(200);
});

test('a research entry opens from the Research page and leads back to it', async ({ page }) => {
  await page.goto('/research/');
  await page.getByRole('link', { name: /Mapping Half a Century of Global Brain Abscess Research/ }).click();
  await expect(page).toHaveURL(/\/research\/[a-z0-9-]+\/$/);
  await expect(page.getByRole('link', { name: 'Back to research' })).toHaveAttribute('href', '/research/');
});

test('Writing has no page while there is nothing written', async ({ page, request }) => {
  expect((await request.get('/writing/')).status()).toBe(404);
  await page.goto('/');
  await expect(page.locator('[data-label="Writing"] a')).toHaveCount(0);
});

test('Collaborate opens only once it is no longer a draft', async ({ page, request }) => {
  test.skip(drafts, 'this run shows drafts');
  expect((await request.get('/collaborate/')).status()).toBe(404);
  await page.goto('/');
  await expect(page.locator('[data-label="Collaborate"] a')).toHaveCount(0);
});

// The browser drops a page transition when the next page is slow to show, and software WebGL in the test browser
// is slow; with WebGL off the stage shows its stills, and what is left to test is which way each page moves.
test('the pages slide: in from the right for About, and back out to the left, returning to the same place', async ({ page }) => {
  const seen = [];
  page.on('console', m => { const t = m.text(); if (t.startsWith('vt ')) seen.push(t.slice(3)); });
  await page.addInitScript(() => {
    const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (k, ...a) { return /webgl/.test(k) ? null : g.call(this, k, ...a); };
    addEventListener('pagereveal', e => { if (e.viewTransition) setTimeout(() => console.log('vt ' + location.pathname + ' ' + document.documentElement.dataset.vt), 0); });
  });
  await page.goto('/about/'); await page.goto('/');           // warm the cache: a cold first page can miss the transition
  await page.locator('#about h2 a').click();
  await expect(page).toHaveURL(/\/about\/$/);
  await expect.poll(() => seen).toContain('/about/ from-right');
  await page.getByRole('link', { name: /Varun Gopal Rajan/ }).first().click();
  await expect(page).toHaveURL(/:\d+\/$/);                    // history.back(): the home page as it was left
  await expect.poll(() => seen).toContain('/ from-left');
});
test('between home and Now the slide runs the other way', async ({ page }) => {
  const seen = [];
  page.on('console', m => { const t = m.text(); if (t.startsWith('vt ')) seen.push(t.slice(3)); });
  await page.addInitScript(() => {
    const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (k, ...a) { return /webgl/.test(k) ? null : g.call(this, k, ...a); };
    addEventListener('pagereveal', e => { if (e.viewTransition) setTimeout(() => console.log('vt ' + location.pathname + ' ' + document.documentElement.dataset.vt), 0); });
  });
  await page.goto('/now/'); await page.goto('/');
  await page.locator('#now h2 a').click();
  await expect(page).toHaveURL(/\/now\/$/);
  await expect.poll(() => seen).toContain('/now/ from-left');
});

test('side pages have no sideways scroll at 320 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const [, path] of OPEN) { await page.goto(path); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320); }
});

test.describe('with JavaScript off', () => {
  test.use({ javaScriptEnabled: false });
  test('every section still opens and reads', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-label="Clinical Experience"] h2 a').click();
    await expect(page.getByText('adaptation of the WHO Surgical Safety Checklist', { exact: false })).toBeVisible();
    await page.goto('/research/');
    await expect(page.getByRole('link', { name: /doi:10\.7759\/cureus\.114519/ })).toBeVisible();
  });
});

test.describe('the About heart', () => {
  test.describe.configure({ timeout: 240000 });
  test('beats on its own and draws something', async ({ page }) => {
    await page.goto('/about/?hage=0.3&hyaw=0');                // a fixed moment keeps the frame readable
    await expect(page.locator('html')).toHaveAttribute('data-stage', 'live', { timeout: 120000 });
    const lit = await page.evaluate(() => { const c = document.querySelector('#heart'), o = document.createElement('canvas'); o.width = 64; o.height = 80; const x = o.getContext('2d'); x.drawImage(c, 0, 0, 64, 80); return [...x.getImageData(0, 0, 64, 80).data].filter((v, i) => i % 4 === 0 && v > 40).length; });
    expect(lit).toBeGreaterThan(40);
  });
  test('without WebGL 2 its still image shows', async ({ page }) => {
    await page.addInitScript(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (k, ...a) { return /webgl/.test(k) ? null : g.call(this, k, ...a); }; });
    await page.goto('/about/');
    await expect(page.locator('html')).toHaveAttribute('data-stage', 'still');
    await expect(page.locator('img.still-heart')).toBeVisible();
  });
});

// ---------- the art on Now and Clinical Experience ----------
const bright = async (page, sel, cond) => page.evaluate(([sel, cond]) => {
  const c = document.querySelector(sel), o = document.createElement('canvas'); o.width = 96; o.height = 48;
  const x = o.getContext('2d'); x.drawImage(c, 0, 0, 96, 48); const d = x.getImageData(0, 0, 96, 48).data; let n = 0;
  const f = new Function('r', 'g', 'b', `return ${cond}`);
  for (let i = 0; i < d.length; i += 4) if (f(d[i], d[i + 1], d[i + 2])) n++;
  return n;
}, [sel, cond]);
const noWebGL = () => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (k, ...a) { return /webgl/.test(k) ? null : g.call(this, k, ...a); }; };
const countRaf = () => { window.__raf = 0; const r = requestAnimationFrame; window.requestAnimationFrame = f => { window.__raf++; return r(f); }; };

for (const [name, path, still, credit, lit] of [
  ['eyes', '/now/', /eyes/i, /Eyes adapted from the Human Reference Atlas[\s\S]*Visible Human Male/, 'r > 70 || g > 70 || b > 70'],   // anything clearly lit above the warm dark (#261b1f): the eyes, the embers
  ['hands', '/clinical-experience/', /hands/i, /Hands adapted from 3D scans of plaster casts of Abraham Lincoln[\s\S]*CC0/, 'Math.abs(r - g) < 20 && Math.abs(g - b) < 20 && r > 60'],
  ['neuron', '/research/', /neuron/i, /Neuron and cell positions from the H01 dataset[\s\S]*CC BY 4\.0/, 'r + g + b > 150'],
  ['lungs', '/life/', /lungs/i, /Lungs adapted from the Human Reference Atlas[\s\S]*Visible Human Female/, 'r > 70 && g < 60 && b < 70'],
]) {
  test.describe(`the ${name}`, () => {
    test.describe.configure({ timeout: 240000 });
    test('go live and draw', async ({ page }) => {
      await page.goto(`${path}?hage=2&hyaw=0`);
      await expect(page.locator('html')).toHaveAttribute('data-stage', 'live', { timeout: 120000 });
      expect(await bright(page, '#art', lit)).toBeGreaterThan(40);
      if (name === 'hands') expect(await bright(page, '#art', 'r > 150 && g < 90 && b < 90')).toBeGreaterThan(3);   // the red strings
    });
    test('show their still without WebGL 2', async ({ page }) => {
      await page.addInitScript(noWebGL);
      await page.goto(path);
      await expect(page.locator('html')).toHaveAttribute('data-stage', 'still');
      await expect(page.locator('img.still-art')).toBeVisible();
      await expect(page.locator('img.still-art')).toHaveAttribute('alt', still);
    });
    test('with reduced motion draw once and run no loop', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript(countRaf);
      await page.goto(path);
      await expect(page.locator('html')).toHaveAttribute('data-stage', 'live', { timeout: 120000 });
      const before = await page.evaluate(() => window.__raf); await page.waitForTimeout(1500);
      expect(await page.evaluate(() => window.__raf) - before).toBeLessThanOrEqual(1);
    });
    test('fall back to the still when the context is lost, and come back', async ({ page }) => {
      await page.goto(`${path}?hage=2&hyaw=0`);
      await expect(page.locator('html')).toHaveAttribute('data-stage', 'live', { timeout: 120000 });
      await page.evaluate(() => { window.__ext = document.querySelector('#art').getContext('webgl2').getExtension('WEBGL_lose_context'); window.__ext.loseContext(); });
      await expect(page.locator('html')).toHaveAttribute('data-stage', 'still');
      expect(await page.locator('#art').evaluate(c => getComputedStyle(c).visibility)).toBe('hidden');
      await page.evaluate(() => window.__ext.restoreContext());
      await expect(page.locator('html')).toHaveAttribute('data-stage', 'live', { timeout: 120000 });
    });
    test('fit a phone, load the lighter data and credit their source', async ({ page }) => {
      const asked = []; page.on('request', r => { if (r.url().includes('/data/')) asked.push(new URL(r.url()).pathname); });
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(path);
      await expect(page.locator('html')).toHaveAttribute('data-stage', /live|still|failed/, { timeout: 120000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
      expect(asked).toContain(`/data/${name}-lite.bin`);
      expect(await page.locator('img.still-art').evaluate(i => i.currentSrc)).toContain(`/still/${name}-phone.webp`);   // framed as the phone draws it
      await expect(page.getByRole('contentinfo')).toContainText(credit);
    });
  });
}
test('the eyes take no harm from a pointer that moves and leaves', async ({ page }) => {
  test.setTimeout(240000);
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('/now/');
  await expect(page.locator('html')).toHaveAttribute('data-stage', 'live', { timeout: 120000 });
  await page.mouse.move(100, 100); await page.mouse.move(900, 500);
  await page.evaluate(() => document.documentElement.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true })));
  await page.mouse.move(-10, -10); await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

// ---------- the art reaches across the whole screen ----------
// counts pixels matching `cond` on the full-screen canvas, below the box the anatomy sits in
const belowBox = (page, cond) => page.evaluate(cond => {
  const c = document.querySelector('#art'), b = document.querySelector('.art-wide').getBoundingClientRect();
  const o = document.createElement('canvas'); o.width = 160; o.height = 100; const x = o.getContext('2d'); x.drawImage(c, 0, 0, 160, 100);
  const d = x.getImageData(0, 0, 160, 100).data, y0 = Math.ceil((b.bottom + 10) / innerHeight * 100), f = new Function('r', 'g', 'b', `return ${cond}`);
  let n = 0; for (let y = y0; y < 100; y++) for (let i = 0; i < 160; i++) { const k = (y * 160 + i) * 4; if (f(d[k], d[k + 1], d[k + 2])) n++; }
  return n;
}, cond);
test.describe('beyond the box', () => {
  test.describe.configure({ timeout: 240000 });
  test.use({ viewport: { width: 1280, height: 900 } });
  test('the strings run on past the hands, across the screen', async ({ page }) => {
    await page.goto('/clinical-experience/?hage=7&hyaw=0');
    await expect(page.locator('html')).toHaveAttribute('data-stage', 'live', { timeout: 120000 });
    const atEdges = await page.evaluate(() => {           // red in the outer tenth of the screen each side, read at full size: the strings are a pixel wide
      const c = document.querySelector('#art'), o = document.createElement('canvas'); o.width = c.width; o.height = c.height; const x = o.getContext('2d'); x.drawImage(c, 0, 0);
      const w = Math.round(c.width * 0.1); let n = 0;
      for (const x0 of [0, c.width - w]) { const d = x.getImageData(x0, 0, w, c.height).data; for (let k = 0; k < d.length; k += 4) if (d[k] > 80 && d[k + 1] < 60 && d[k + 2] < 70) n++; }
      return n;
    });
    expect(atEdges).toBeGreaterThan(40);
  });
  test('the fibres from the eyes sweep out across the screen', async ({ page }) => {
    await page.goto('/now/?hage=38&hyaw=0');                    // a moment when the scan points down and to the right
    await expect(page.locator('html')).toHaveAttribute('data-stage', 'live', { timeout: 120000 });
    expect(await belowBox(page, 'r + g + b > 40')).toBeGreaterThan(30);
  });
  test('the eyes scan on their own and take no notice of the pointer', async ({ page }) => {
    await page.goto('/now/?hage=14&hyaw=0');
    await expect(page.locator('html')).toHaveAttribute('data-stage', 'live', { timeout: 120000 });
    const sum = () => page.evaluate(() => { const c = document.querySelector('#art'), o = document.createElement('canvas'); o.width = 64; o.height = 40; const x = o.getContext('2d'); x.drawImage(c, 0, 0, 64, 40); return x.getImageData(0, 0, 64, 40).data.reduce((a, v) => a + v, 0); });
    const before = await sum();
    await page.mouse.move(50, 50); await page.mouse.move(1200, 800); await page.waitForTimeout(400);
    expect(await sum()).toBe(before);
  });
});
