import { test, expect } from '@playwright/test';

// The backgrounds behind the section pages' anatomy (#bg): their own canvas, started once the anatomy is live,
// dimmed under the words, and never able to take the anatomy down with them.
test.use({ reducedMotion: 'reduce' });                       // software WebGL: one frame, not a loop
test.describe.configure({ timeout: 240000 });

const noWebGL = () => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (k, ...a) { return /webgl/.test(k) ? null : g.call(this, k, ...a); }; };
const countRaf = () => { window.__raf = 0; const r = requestAnimationFrame; window.requestAnimationFrame = f => { window.__raf++; return r(f); }; };
const live = async page => { await expect(page.locator('html')).toHaveAttribute('data-stage', 'live', { timeout: 120000 }); await expect(page.locator('html')).toHaveAttribute('data-bg', 'live', { timeout: 60000 }); };

// pixels of #bg, scaled to a small sample: how many meet `cond`, and the brightness mean and spread, over the whole
// canvas or over a box (window CSS pixels)
const sample = (page, cond = 'false', box = null) => page.evaluate(([cond, box]) => {
  const c = document.querySelector('#bg'), k = c.width / innerWidth, w = 96, h = 48;
  const [x, y, bw, bh] = box ? [box.x * k, box.y * k, box.w * k, box.h * k] : [0, 0, c.width, c.height];
  const o = document.createElement('canvas'); o.width = w; o.height = h; const g = o.getContext('2d'); g.drawImage(c, x, y, bw, bh, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data, f = new Function('r', 'g', 'b', `return ${cond}`); let n = 0, s = 0, s2 = 0;
  const lum = [];                                            // brightness as drawn: read-back colours are un-premultiplied, so weigh by alpha
  for (let i = 0; i < d.length; i += 4) { if (f(d[i], d[i + 1], d[i + 2])) n++; const v = (d[i] + d[i + 1] + d[i + 2]) / 3 * d[i + 3] / 255; lum.push(v); s += v; s2 += v * v; }
  const m = s / (w * h); return { n, mean: m, sd: Math.sqrt(Math.max(0, s2 / (w * h) - m * m)), data: lum.filter((_, i) => i % 4 === 0) };
}, [cond, box]);
// the same patch of background with the words over it, then with the words moved off the page: the frame is fixed
// (?hage), so the only difference is the dimming under the words
const dimmedUnderWords = async page => {
  const box = await page.evaluate(() => { const r = document.querySelector('.side-body').getBoundingClientRect(), top = Math.max(0, r.top); return { x: r.left, y: top, w: r.width, h: Math.max(40, Math.min(innerHeight, r.bottom) - top) }; });
  const under = await sample(page, 'false', box);
  await page.evaluate(() => { document.querySelector('.side-body').style.transform = 'translateY(4000px)'; dispatchEvent(new Event('resize')); });
  await page.waitForTimeout(600);
  return [under.mean, (await sample(page, 'false', box)).mean];
};

test.describe('About: pulse rings', () => {
  test('draws red rings round the heart', async ({ page }) => {
    await page.goto('/about/?hage=0.3&hyaw=0'); await live(page);
    expect((await sample(page, 'r > 25 && r > 2.5 * g && r > 2.5 * b')).n).toBeGreaterThan(40);   // thin rings, averaged down in the sample: red, not bright
  });
  test('the rings move with the beat', async ({ page }) => {
    await page.goto('/about/?hage=0.1&hyaw=0'); await live(page); const a = (await sample(page)).data;
    await page.goto('/about/?hage=0.7&hyaw=0'); await live(page); const b = (await sample(page)).data;
    expect(a.filter((v, i) => Math.abs(v - b[i]) > 6).length / a.length).toBeGreaterThan(0.02);
  });
  test('the words sit on a dimmed background', async ({ page }) => {
    await page.goto('/about/?hage=5.3&hyaw=0'); await live(page);   // six beats in: rings out across the words
    const [under, bare] = await dimmedUnderWords(page);
    expect(bare).toBeGreaterThan(0.5); expect(under).toBeLessThan(bare * 0.45);
  });
  test('the heart keeps beating when the background\'s context is lost', async ({ page }) => {
    await page.goto('/about/?hage=0.3&hyaw=0'); await live(page);
    await page.evaluate(() => document.querySelector('#bg').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
    await expect(page.locator('html')).toHaveAttribute('data-bg', 'off');
    expect(await page.locator('#bg').evaluate(c => getComputedStyle(c).visibility)).toBe('hidden');
    await expect(page.locator('html')).toHaveAttribute('data-stage', 'live');
  });
  test('without WebGL 2 there is no background and the heart\'s still shows', async ({ page }) => {
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.addInitScript(noWebGL); await page.goto('/about/');
    await expect(page.locator('html')).toHaveAttribute('data-stage', 'still');
    await expect(page.locator('img.still-heart')).toBeVisible();
    expect(await page.locator('html').getAttribute('data-bg')).not.toBe('live');
    expect(errors).toEqual([]);
  });
  test('with reduced motion one frame, no loop', async ({ page }) => {
    await page.addInitScript(countRaf); await page.goto('/about/'); await live(page);
    const before = await page.evaluate(() => window.__raf); await page.waitForTimeout(1500);
    expect(await page.evaluate(() => window.__raf) - before).toBeLessThanOrEqual(1);
  });
  test('scrolled to the end, the rings stop and clear', async ({ page }) => {
    await page.goto('/about/?hage=0.3&hyaw=0'); await live(page);
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(1000);
    expect((await sample(page, 'r > 30')).n).toBe(0);
  });
  test('a resize resizes the background', async ({ page }) => {
    await page.goto('/about/?hage=0.3&hyaw=0'); await live(page);
    await page.setViewportSize({ width: 600, height: 900 }); await page.waitForTimeout(800);
    const [w, want] = await page.evaluate(() => [document.querySelector('#bg').width, Math.round(600 * Math.min(devicePixelRatio, 1.5, Math.sqrt(7e6 / (600 * 900))))]);
    expect(w).toBe(want);
  });
  test('back from home, the background is live again', async ({ page }) => {
    await page.goto('/about/'); await live(page);
    await page.locator('.side-top .home-link').click(); await page.waitForURL(/\/(#.*)?$/);
    await page.goBack(); await live(page);
  });
  test('Now has no background canvas of its own', async ({ page }) => {
    await page.goto('/now/'); await expect(page.locator('#bg')).toHaveCount(0);
  });
  test('the credit names the source', async ({ page }) => {
    await page.goto('/about/');
    await expect(page.getByRole('contentinfo')).toContainText('Pulse rings adapted from Jaume Sánchez’s DOF Tunnel (Codevember 2016), CC BY 4.0.');
  });
});

test.describe('Clinical Experience: graphite flow lines', () => {
  test('draws graphite lines', async ({ page }) => {
    await page.goto('/clinical-experience/?hage=2&hyaw=0'); await live(page);
    expect((await sample(page, 'Math.abs(r - g) < 12 && Math.abs(g - b) < 12 && r > 35')).n).toBeGreaterThan(300);
  });
  test('the lines are strokes, not a wash', async ({ page }) => {
    await page.goto('/clinical-experience/?hage=2&hyaw=0'); await live(page);
    const patch = await sample(page, 'false', { x: 24, y: 140, w: 192, h: 96 });   // a small patch at about its own resolution, clear of the words
    expect(patch.sd).toBeGreaterThan(Math.max(6, patch.mean * 0.5));
  });
  test('the words sit on a dimmed background', async ({ page }) => {
    await page.goto('/clinical-experience/?hage=2&hyaw=0'); await live(page);
    const [under, bare] = await dimmedUnderWords(page);
    expect(bare).toBeGreaterThan(0.5); expect(under).toBeLessThan(bare * 0.45);
  });
  test('the credit names the source', async ({ page }) => {
    await page.goto('/clinical-experience/');
    await expect(page.getByRole('contentinfo')).toContainText('Flow lines adapted from Jaume Sánchez’s Lines on a sphere (Codevember 2016), CC BY 4.0.');
  });
});

test('with reduced motion and no fixed moment, the flow lines survive scrolling away and back', async ({ page }) => {
  await page.goto('/clinical-experience/'); await live(page);
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(800);
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(800);
  expect((await sample(page, 'Math.abs(r - g) < 12 && Math.abs(g - b) < 12 && r > 35')).n).toBeGreaterThan(300);
});

test.describe('Life: glowing lines', () => {
  const red = 'r > 25 && r > 2.5 * g && r > 2.5 * b';
  test('draws glowing red lines', async ({ page }) => {
    await page.goto('/life/?hage=2&hyaw=0'); await live(page);
    expect((await sample(page, red)).n).toBeGreaterThan(40);
  });
  test('the lines start at the lungs: most of the glow is in or near their box', async ({ page }) => {
    await page.goto('/life/?hage=2&hyaw=0'); await live(page);
    const r = await page.evaluate(() => { const b = document.querySelector('[data-art]').getBoundingClientRect(); return { x: b.left - b.width * 0.1, y: b.top - b.height * 0.1, w: b.width * 1.2, h: b.height * 1.2 }; });
    const near = await sample(page, 'false', r), all = await sample(page);
    expect(near.mean * r.w * r.h).toBeGreaterThan(0.6 * all.mean * (await page.evaluate(() => innerWidth * innerHeight)));
  });
  test('the words sit on a dimmed background', async ({ page }) => {
    await page.goto('/life/?hage=4.2&hyaw=0'); await live(page);   // mid breath out: the echoes cross the words
    const [under, bare] = await dimmedUnderWords(page);
    expect(bare).toBeGreaterThan(0.2); expect(under).toBeLessThan(bare * 0.45);
  });
  test('with reduced motion the outline still glows', async ({ page }) => {
    await page.goto('/life/'); await live(page);
    expect((await sample(page, red)).n).toBeGreaterThan(40);
  });
  test('a resize keeps the lines', async ({ page }) => {
    await page.goto('/life/?hage=2&hyaw=0'); await live(page);
    await page.setViewportSize({ width: 600, height: 900 }); await page.waitForTimeout(800);
    expect((await sample(page, red)).n).toBeGreaterThan(40);
  });
  test('the credit names the source', async ({ page }) => {
    await page.goto('/life/');
    await expect(page.getByRole('contentinfo')).toContainText('The glowing lines are adapted from Jaume Sánchez’s Lines (Codevember 2016), CC BY 4.0.');
  });
});

// how much of the background's brightest glow lies within 24 CSS px of the lungs (their drawn silhouette on #art)
const onTheEdge = page => page.evaluate(() => {
  const w = Math.round(innerWidth / 4), h = Math.round(innerHeight / 4), grab = sel => { const c = document.querySelector(sel), o = document.createElement('canvas'); o.width = w; o.height = h; const g = o.getContext('2d'); g.drawImage(c, 0, 0, w, h); return g.getImageData(0, 0, w, h).data; };
  const art = grab('#art'), bg = grab('#bg'), lum = []; for (let i = 0; i < bg.length; i += 4) lum.push(bg[i] * bg[i + 3] / 255);
  const cut = [...lum].sort((a, b) => b - a)[Math.floor(lum.length * 0.01)];
  let n = 0, near = 0;
  for (let i = 0; i < lum.length; i++) {
    if (lum[i] < cut || lum[i] < 10) continue; n++;
    const x = i % w, y = Math.floor(i / w); let hit = false;
    for (let dy = -6; dy <= 6 && !hit; dy++) for (let dx = -6; dx <= 6 && !hit; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < w && Y < h && art[(Y * w + X) * 4 + 3] > 128) hit = true; }
    if (hit) near++;
  }
  return n ? near / n : 0;
});
test.describe('Life: the glow stays on the lungs\' edge', () => {
  test('at a fixed moment', async ({ page }) => {
    await page.goto('/life/?hage=2&hyaw=0'); await live(page);
    expect(await onTheEdge(page)).toBeGreaterThan(0.8);
  });
  test('after the page scrolls', async ({ page }) => {
    await page.goto('/life/?hage=2&hyaw=0'); await live(page);
    await page.evaluate(() => scrollTo(0, 200)); await page.waitForTimeout(600);
    expect(await onTheEdge(page)).toBeGreaterThan(0.8);
  });
  test('with a classic scrollbar taking width from the page', async ({ page }) => {
    await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = 'html{overflow-y:scroll}::-webkit-scrollbar{width:40px;background:#222}'; document.head.append(s); }));
    await page.goto('/life/?hage=2&hyaw=0'); await live(page);
    expect(await onTheEdge(page)).toBeGreaterThan(0.8);
  });
  test('a scroll does not run the whole warm-up again', async ({ page }) => {
    await page.goto('/life/?hage=2&hyaw=0'); await live(page);
    const ms = await page.evaluate(() => { const t0 = performance.now(); for (let i = 1; i <= 5; i++) { scrollTo(0, i * 4); dispatchEvent(new Event('scroll')); } return performance.now() - t0; });
    expect(ms).toBeLessThan(150);
  });
});

test.describe('Research: the deep field of real cells', () => {
  test('draws soft points round the neuron', async ({ page }) => {
    await page.goto('/research/?hage=2&hyaw=0.1'); await live(page);
    expect((await sample(page, 'r + g + b > 60')).n).toBeGreaterThan(60);
  });
  test('the words sit on a dimmed background', async ({ page }) => {
    await page.goto('/research/?hage=2&hyaw=0.1'); await live(page);
    const [under, bare] = await dimmedUnderWords(page);
    expect(bare).toBeGreaterThan(0.02); expect(under).toBeLessThan(bare * 0.45);   // the field is faint and fades out before the words: little to dim, but measurable
  });
  test('with reduced motion the field still shows', async ({ page }) => {
    await page.goto('/research/'); await live(page);
    expect((await sample(page, 'r + g + b > 60')).n).toBeGreaterThan(60);
  });
  test('the credit names the source', async ({ page }) => {
    await page.goto('/research/');
    await expect(page.getByRole('contentinfo')).toContainText('The deep field follows Jaume Sánchez’s Starfield (Codevember 2016), CC BY 4.0.');
  });
});

test.describe('Teaching: the particle stream', () => {
  test('draws a stream across the page', async ({ page }) => {
    await page.goto('/teaching/?hage=1.4&hyaw=0.1'); await live(page);
    expect((await sample(page, 'r + g + b > 60')).n).toBeGreaterThan(40);
  });
  test('the words sit on a dimmed background', async ({ page }) => {
    await page.goto('/teaching/?hage=1.4&hyaw=0.1'); await live(page);
    const [under, bare] = await dimmedUnderWords(page);
    expect(bare).toBeGreaterThan(0.02); expect(under).toBeLessThan(bare * 0.45);
  });
  test('with reduced motion the stream still shows', async ({ page }) => {
    await page.goto('/teaching/'); await live(page);
    expect((await sample(page, 'r + g + b > 60')).n).toBeGreaterThan(40);
  });
  test('the credit names the source', async ({ page }) => {
    await page.goto('/teaching/');
    await expect(page.getByRole('contentinfo')).toContainText('The particle stream follows Jaume Sánchez’s Plasma waves (Codevember 2017), CC BY 4.0.');
  });
});

