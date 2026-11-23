import { test, expect } from '@playwright/test';

test.describe.configure({ timeout: 240000 });   // software WebGL in the test browser is slow
const live = page => expect(page.locator('html')).toHaveAttribute('data-stage', 'live', { timeout: 120000 });
const frozen = '/?age=0.35&yaw=0.2';

test('the stage goes live and draws something', async ({ page }) => {
  await page.goto(frozen); await live(page);
  const lit = await page.evaluate(() => { const c = document.querySelector('#stage'), o = document.createElement('canvas'); o.width = 64; o.height = 64; const x = o.getContext('2d'); x.drawImage(c, 0, 0, 64, 64); return [...x.getImageData(0, 0, 64, 64).data].filter((v, i) => i % 4 !== 3 && v > 40).length; });
  expect(lit).toBeGreaterThan(300);
});
test('frozen frames match the approved mockup', async ({ page }) => {
  for (const [name, url] of [['rest', '/?age=4.38&yaw=0.2&smoke=0'], ['impulse', '/?age=-0.17&yaw=0.2'], ['launch', '/?age=0.03&yaw=0.2'], ['burst', '/?age=0.35&yaw=0.2']]) {
    await page.goto(url); await live(page);
    await expect(page).toHaveScreenshot(`${name}.png`, { maxDiffPixelRatio: 0.02 });
  }
});
test('the smoke starts at the outline, not over the brain', async ({ page }) => {
  await page.goto('/?age=0.03&yaw=0.2&mesh=0&tracts=0'); await live(page);
  const a = await page.evaluate(() => { const c = document.querySelector('#smoke'), o = document.createElement('canvas'); o.width = c.width; o.height = c.height; const x = o.getContext('2d'); x.drawImage(c, 0, 0); const at = (fx, fy) => x.getImageData(Math.round(c.width * fx), Math.round(c.height * fy), 1, 1).data[3]; const H = innerHeight / c.clientHeight; return { centre: at(0.5, 0.47 * H), far: at(0.03, 0.47 * H) }; });
  expect(a.centre).toBe(0); expect(a.far).toBe(0);
});
test('the heart is drawn and the line runs behind it', async ({ page }) => {
  await page.goto('/?hage=0.3&hyaw=0&age=4.38&yaw=0.2&smoke=0'); await live(page); await page.locator('#heart').scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
  await expect(page.locator('#about')).toHaveScreenshot('heart.png', { maxDiffPixelRatio: 0.02 });
});
test('canvases stay within their pixel caps on a large dense screen', async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 2 })).newPage();
  await page.goto(frozen); await live(page);
  const px = await page.evaluate(() => [...document.querySelectorAll('canvas')].map(c => c.width * c.height));
  for (const p of px) expect(p).toBeLessThanOrEqual(7.1e6);
});
test('after rotation the cord still reaches the heart and the dot is on the line', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 }); await page.goto(frozen); await live(page);
  await page.setViewportSize({ width: 812, height: 375 }); await page.waitForTimeout(400);
  const g = await page.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect(), y = scrollY; return { stageBottom: r('#stage').bottom + y, heartTop: r('#heart').top + y, heartBottom: r('#heart').bottom + y, trackLeft: r('.track').left, mid: innerWidth / 2, sw: document.documentElement.scrollWidth }; });
  expect(g.stageBottom).toBeGreaterThan(g.heartTop); expect(g.stageBottom).toBeLessThan(g.heartBottom); expect(Math.abs(g.trackLeft - g.mid)).toBeLessThan(1); expect(g.sw).toBe(812);
});
test('a phone address bar hiding does not rebuild the stage', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 752 }); await page.goto(frozen); await live(page);
  const before = await page.evaluate(() => document.querySelector('#stage').height);
  await page.setViewportSize({ width: 375, height: 812 }); await page.waitForTimeout(400);
  expect(await page.evaluate(() => document.querySelector('#stage').height)).toBe(before);
});
test('nothing is drawn once the stage and heart are scrolled away', async ({ page }) => {
  await page.addInitScript(() => { window.__draws = 0; for (const k of ['drawArrays', 'drawElements', 'drawArraysInstanced']) { const f = WebGL2RenderingContext.prototype[k]; WebGL2RenderingContext.prototype[k] = function (...a) { window.__draws++; return f.apply(this, a); }; } });
  await page.goto('/'); await live(page);
  await page.locator('#last').scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
  const before = await page.evaluate(() => window.__draws); await page.waitForTimeout(1000);
  expect(await page.evaluate(() => window.__draws)).toBe(before);
});
