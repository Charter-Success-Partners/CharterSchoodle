import { test as base, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const sourceSchools = JSON.parse(await readFile(new URL('../../data/schools.json', import.meta.url), 'utf8'));
export const schools = sourceSchools.slice(0, 8);
export const today = '2026-10-15';
export const puzzles = ['2026-10-14', today, '2026-10-16'].map((date) => ({
  date, answerSchoolId: schools[0].id,
  clues: Array.from({ length: 6 }, (_, i) => ({ text: `Fixture clue ${i + 1}`, difficulty: 6 - i })),
}));

export const test = base.extend({
  game: async ({ page, context }, use) => {
    const remoteRequests = [];
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
        if (url.hostname.includes('supabase')) remoteRequests.push({ url: url.href, method: route.request().method() });
        await route.abort();
        return;
      }
      await route.continue();
    });
    await page.clock.install({ time: new Date('2026-10-15T16:00:00Z') });
    let calendar = puzzles;
    let fail = false;
    await page.route('**/data/puzzles.json', (route) => fail
      ? route.fulfill({ status: 503, json: { error: 'unavailable' } })
      : route.fulfill({ json: { generatedAt: today, puzzles: calendar } }));
    await page.route('**/data/schools.json', (route) => route.fulfill({ json: schools }));
    await use({
      setPuzzles(value) { calendar = value; },
      failFetch(value) { fail = value; },
      async open() { await page.goto('/'); },
      async guess(school) {
        await page.getByLabel('Guess the school').fill(school.officialName);
        await page.locator('#autocomplete-list [data-school-id]').first().click();
        await page.getByRole('button', { name: 'Submit', exact: true }).click();
      },
      remoteRequests,
    });
    expect(remoteRequests, 'No production Supabase requests, including score writes').toEqual([]);
    expect(pageErrors, 'Guest flow has no uncaught browser exceptions').toEqual([]);
  },
});
export { expect };
