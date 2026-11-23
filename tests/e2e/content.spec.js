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
