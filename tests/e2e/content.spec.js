import { test, expect } from '@playwright/test';

// These tests are about the written content. Reduced motion draws the stage once instead of animating it,
// which keeps software WebGL in the test browser from starving them.
test.use({ reducedMotion: 'reduce' });

test('home page loads with the name and no console errors', async ({ page }) => {
  const errors = []; page.on('console', m => m.type() === 'error' && errors.push(m.text())); page.on('pageerror', e => errors.push(String(e)));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Varun Gopal Rajan');
  await expect(page).toHaveTitle('Varun Gopal Rajan');
  expect(errors).toEqual([]);
});

test('nothing is fetched from another origin', async ({ page }) => {
  const foreign = []; page.on('request', r => { if (new URL(r.url()).origin !== 'http://localhost:4321') foreign.push(r.url()); });
  await page.goto('/'); await page.waitForLoadState('networkidle');
  expect(foreign).toEqual([]);
});

const ORDER = ['About', 'Now', 'Clinical Experience', 'Research', 'Teaching', 'Writing', 'Life', 'Collaborate', 'Contact'];
test('the nine sections are present in order', async ({ page }) => {
  await page.goto('/');
  expect(await page.locator('[data-label]').evaluateAll(els => els.map(e => e.dataset.label))).toEqual(ORDER);
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(9);
});
test('there is no sideways scroll at 320 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 }); await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});
test('the dot names the section it has reached', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-label="Research"]').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 300));
  await expect(page.locator('#mlabel')).toHaveText(/Research|Teaching/);
});
test.describe('with JavaScript off', () => {
  test.use({ javaScriptEnabled: false });
  test('the content still reads', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(9);
    await expect(page.getByText('adaptation of the WHO Surgical Safety Checklist', { exact: false })).toBeVisible();
    await expect(page.getByRole('link', { name: 'drvarungopal@outlook.com' })).toHaveAttribute('href', 'mailto:drvarungopal@outlook.com');
    await expect(page.getByRole('link', { name: /doi:10\.7759\/cureus\.114519/ })).toBeVisible();
  });
});

test('each research entry has its own page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Mapping Half a Century of Global Brain Abscess Research/ }).click();
  await expect(page).toHaveURL(/\/research\/[a-z0-9-]+\/$/);
  await expect(page.getByRole('link', { name: /doi:10\.7759\/cureus\.114519/ })).toHaveAttribute('href', 'https://doi.org/10.7759/cureus.114519');
  await expect(page.getByRole('link', { name: 'Varun Gopal Rajan' })).toHaveAttribute('href', '/');
});
test('the feed and sitemap exist', async ({ request }) => {
  expect((await request.get('/rss.xml')).status()).toBe(200);
  expect((await request.get('/sitemap-index.xml')).status()).toBe(200);
});
test('an unknown address shows the 404 page', async ({ page }) => {
  const r = await page.goto('/nothing-here/'); expect(r.status()).toBe(404);
  await expect(page.getByRole('link', { name: 'Varun Gopal Rajan' })).toBeVisible();
});

test('the page describes itself for search and sharing', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://varungops.com/og.png');
  const ld = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
  expect(ld['@type']).toBe('Person'); expect(ld.name).toBe('Varun Gopal Rajan'); expect(ld.sameAs).toContain('https://www.linkedin.com/in/varun-g-rajan-a4a80a213'); expect(ld.sameAs).toContain('https://orcid.org/0009-0001-4362-1531');
});
test('the footer credits all three anatomy sources', async ({ page }) => {
  await page.goto('/'); const f = page.getByRole('contentinfo');
  for (const s of ['MNI ICBM 152 2009c', 'HCP-1065 tractography atlas', 'Human Connectome Project', 'BodyParts3D', 'CC BY-SA 4.0']) await expect(f).toContainText(s);
});

test('the CV can be downloaded as a PDF', async ({ page, request }) => {
  await page.goto('/');
  const link = page.getByRole('link', { name: /Download my CV/ });
  await expect(link).toHaveAttribute('href', '/Dr_Varun_Gopal_Rajan_CV.pdf');
  const r = await request.get('/Dr_Varun_Gopal_Rajan_CV.pdf');
  expect(r.status()).toBe(200); expect((await r.body()).subarray(0, 4).toString()).toBe('%PDF');
});
