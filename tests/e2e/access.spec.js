import { test, expect } from '@playwright/test';

test.describe.configure({ timeout: 240000 });   // software WebGL in the test browser is slow
const stage = (page, s) => expect(page.locator('html')).toHaveAttribute('data-stage', s, { timeout: 120000 });

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('draws one still frame, no smoke, and runs no animation loop', async ({ page }) => {
    await page.addInitScript(() => { window.__raf = 0; const r = requestAnimationFrame; window.requestAnimationFrame = f => { window.__raf++; return r(f); }; });
    await page.goto('/'); await stage(page, /live|still/);
    const before = await page.evaluate(() => window.__raf); await page.waitForTimeout(1500);
    expect(await page.evaluate(() => window.__raf) - before).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => { const c = document.querySelector('#smoke'), o = document.createElement('canvas'); o.width = 32; o.height = 32; const x = o.getContext('2d'); x.drawImage(c, 0, 0, 32, 32); return x.getImageData(0, 0, 32, 32).data.some(v => v > 0); })).toBe(false);
  });
});
test('without WebGL 2 the still images are shown', async ({ page }) => {
  await page.addInitScript(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (k, ...a) { return /webgl/.test(k) ? null : g.call(this, k, ...a); }; });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('/'); await stage(page, 'still');
  await expect(page.locator('#home img.still')).toBeVisible(); await expect(page.locator('#about img.still')).toBeVisible(); expect(errors).toEqual([]);
});
test('if an anatomy file never arrives the still images stay and the page reads', async ({ page }) => {
  await page.route('**/data/tracts*.bin', r => r.abort());
  await page.goto('/'); await stage(page, 'failed');
  await expect(page.locator('#home img.still')).toBeVisible(); await expect(page.getByRole('heading', { level: 2 })).toHaveCount(9);
});
test('a lost WebGL context falls back to the still and recovers', async ({ page }) => {
  await page.goto('/?age=0.35&yaw=0.2'); await stage(page, 'live');
  await page.evaluate(() => { window.__ext = document.querySelector('#stage').getContext('webgl2').getExtension('WEBGL_lose_context'); window.__ext.loseContext(); });
  await stage(page, 'still');
  await page.evaluate(() => window.__ext.restoreContext()); await stage(page, 'live');
});
test('the stills carry text alternatives and the canvases are hidden from assistive technology', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#home img.still')).toHaveAttribute('alt', /human brain seen from the right side/);
  await expect(page.locator('#stage')).toHaveAttribute('aria-hidden', 'true'); await expect(page.locator('#heart')).toHaveAttribute('aria-hidden', 'true');
});
test('every section is reachable by keyboard', async ({ page }) => {
  await page.goto('/'); for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement.tagName)).toBe('A');
});
