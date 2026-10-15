import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  workers: 2,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    timezoneId: 'America/New_York',
    launchOptions: {
      ...(process.env.CHARTERSCHOODLE_CHROMIUM_PATH ? { executablePath: process.env.CHARTERSCHOODLE_CHROMIUM_PATH } : {}),
      args: ['--no-sandbox'],
    },
  },
  webServer: {
    command: 'node scripts/serve-test-site.mjs --root . --prefix /',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
});
