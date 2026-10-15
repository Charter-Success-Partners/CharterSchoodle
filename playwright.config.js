import { defineConfig } from '@playwright/test';

const siteRoot = process.env.CHARTERSCHOODLE_TEST_ROOT || '.';
const prefix = `/${(process.env.CHARTERSCHOODLE_TEST_PREFIX || '/').split('/').filter(Boolean).join('/')}`;
const mount = prefix === '/' ? '/' : `${prefix}/`;
const port = Number(process.env.CHARTERSCHOODLE_TEST_PORT || 4173);
const baseURL = `http://127.0.0.1:${port}${mount}`;

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  workers: 2,
  use: {
    baseURL,
    timezoneId: 'America/New_York',
    launchOptions: {
      ...(process.env.CHARTERSCHOODLE_CHROMIUM_PATH ? { executablePath: process.env.CHARTERSCHOODLE_CHROMIUM_PATH } : {}),
      args: ['--no-sandbox'],
    },
  },
  webServer: {
    command: `node scripts/serve-test-site.mjs --root ${siteRoot} --prefix ${mount} --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
  },
});
