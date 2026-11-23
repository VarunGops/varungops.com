import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60000,
  workers: process.env.CI ? 1 : 2,   // the stage is software-rendered in the test browser; more workers starve each other
  expect: { timeout: 10000 },
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4321', launchOptions: { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] } },
  webServer: { command: 'npm run build && npm run serve', port: 4321, reuseExistingServer: false, timeout: 180000, env: { SHOW_DRAFTS: process.env.SHOW_DRAFTS || '' } },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'phone', use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true } },
  ],
});
