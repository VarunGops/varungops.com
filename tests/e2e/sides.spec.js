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
