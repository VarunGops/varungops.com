import { test, expect } from '@playwright/test';

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
