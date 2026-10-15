import { spawn } from 'node:child_process';
import { test, expect, schools, puzzles, today } from './fixtures.js';

test('first_visit_needs_no_profile', async ({ page, game }) => {
  await game.open();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByLabel('Guess the school').fill('Academy');
  await expect(page.locator('#autocomplete-list')).toBeVisible();
});

test('storage_blocked_still_plays', async ({ page, game }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }));
  await game.open();
  await game.guess(schools[1]);
  await expect(page.locator('#guess-counter')).toHaveText('1 / 6');
  await expect(page.locator('#score-status')).toContainText(/tab|session/i);
});

test('past_puzzles_excludes_today_and_future', async ({ page, game }) => {
  await page.addInitScript(() => localStorage.setItem('charterschoodle-player:v1', JSON.stringify({ name: 'Archive Tester', school: 'Fixture School' })));
  await game.open();
  await page.getByRole('button', { name: 'Past Puzzles', exact: true }).click();
  await expect(page.locator('#archive-date')).toHaveAttribute('max', '2026-10-14');
  await expect(page.locator('#puzzle-date-heading')).toContainText('October 14, 2026');
  for (const date of [today, '2026-10-16']) {
    await page.locator('#archive-date').evaluate((el, date) => { el.value = date; el.dispatchEvent(new Event('change')); }, date);
    await expect(page.getByLabel('Guess the school')).toBeDisabled();
    await expect(page.locator('#puzzle-date-heading')).not.toContainText(/October (15|16), 2026/);
  }
});

test('no_past_puzzles_has_empty_state', async ({ page, game }) => {
  game.setPuzzles(puzzles.slice(1));
  await game.open();
  await page.getByRole('button', { name: 'Past Puzzles', exact: true }).click();
  await expect(page.locator('#status-title')).toContainText(/no past puzzles/i);
  await expect(page.locator('#archive-date')).toBeDisabled();
  await expect(page.getByLabel('Guess the school')).toBeDisabled();
});

test('missing_daily_offers_retry_and_archive', async ({ page, game }) => {
  game.setPuzzles([puzzles[0], puzzles[2]]);
  await game.open();
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
  await expect(page.getByLabel('Guess the school')).toBeDisabled();
  await page.getByRole('button', { name: 'Past Puzzles', exact: true }).click();
  await expect(page.getByLabel('Guess the school')).toBeEnabled();
});

test('failed_json_fetch_can_retry', async ({ page, game }) => {
  game.failFetch(true);
  await game.open();
  await expect(page.locator('#status-title')).toContainText(/could not load/i);
  game.failFetch(false);
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByLabel('Guess the school')).toBeEnabled();
  await game.guess(schools[1]);
  await expect(page.locator('#guess-counter')).toHaveText('1 / 6');
});

test('six_wrong_guesses_persist', async ({ page, game }) => {
  await game.open();
  for (const school of schools.slice(1, 7)) await game.guess(school);
  await page.reload();
  await expect(page.locator('#status-title')).toHaveText('Out of guesses');
  await expect(page.locator('#board-rounds .board-row--played')).toHaveCount(6);
  await expect(page.getByLabel('Guess the school')).toBeDisabled();
});

test('correct_guess_persists', async ({ page, game }) => {
  await game.open();
  await game.guess(schools[0]);
  await page.reload();
  await expect(page.locator('#status-title')).toHaveText('Solved');
  await expect(page.getByLabel('Guess the school')).toBeDisabled();
  await page.getByRole('button', { name: 'Leaderboard', exact: true }).click();
  await expect(page.locator('#score-total')).toHaveText('6');
  await expect(page.locator('#leaderboard-sync-status')).toContainText(/unavailable/i);
});

test('midnight_requires_explicit_switch', async ({ page, game }) => {
  await page.clock.setFixedTime(new Date('2026-10-16T03:59:55Z'));
  await game.open();
  await game.guess(schools[1]);
  await page.clock.setFixedTime(new Date('2026-10-16T04:00:05Z'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByRole('button', { name: /play.*today/i })).toBeVisible();
  await expect(page.locator('#puzzle-date-heading')).toContainText('October 15, 2026');
  await expect(page.locator('#guess-counter')).toHaveText('1 / 6');
  await page.getByRole('button', { name: /play.*today/i }).click();
  await expect(page.locator('#puzzle-date-heading')).toContainText('October 16, 2026');
  await expect(page.locator('#guess-counter')).toHaveText('0 / 6');
});

test('legacy_values_remain_unchanged_after_play', async ({ page, game }) => {
  const legacy = {
    'charterschoodle-player:v1': JSON.stringify({ id: 'old-player', name: 'Legacy Name', school: 'Legacy School' }),
    [`charterschoodle-progress:${today}`]: JSON.stringify({ guesses: [], revealedClues: 1, solved: false, lost: false }),
    'charterschoodle-scorebook:v1': JSON.stringify({ results: {} }),
  };
  await page.addInitScript((values) => { for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value); }, legacy);
  await game.open();
  await game.guess(schools[0]);
  const actual = await page.evaluate((keys) => Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)])), Object.keys(legacy));
  expect(actual).toEqual(legacy);
});

test('archive_play_never_records_daily_result', async ({ page, game }) => {
  await game.open();
  await page.getByRole('button', { name: 'Past Puzzles', exact: true }).click();
  await game.guess(schools[0]);
  await page.getByRole('button', { name: 'Keep Browsing', exact: true }).click();
  await page.getByRole('button', { name: 'Leaderboard', exact: true }).click();
  await expect(page.locator('#score-total')).toHaveText('0');
  await expect(page.locator('#score-status')).toContainText(/daily results only/i);
});

test('data_timeout_can_retry', async ({ page, game }) => {
  await page.route('**/data/puzzles.json', () => {});
  await game.open();
  await expect(page.locator('#status-title')).toHaveText('Loading puzzles');
  await page.clock.fastForward(10_001);
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
  await page.unroute('**/data/puzzles.json');
  await page.route('**/data/puzzles.json', (route) => route.fulfill({ json: { puzzles } }));
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByLabel('Guess the school')).toBeEnabled();
});

test('malformed_json_can_retry', async ({ page, game }) => {
  await page.route('**/data/puzzles.json', (route) => route.fulfill({ contentType: 'application/json', body: '{broken' }));
  await game.open();
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
  await page.unroute('**/data/puzzles.json');
  await page.route('**/data/puzzles.json', (route) => route.fulfill({ json: { puzzles } }));
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByLabel('Guess the school')).toBeEnabled();
});

test('midnight_timer_preserves_original_result_date', async ({ page, game }) => {
  await page.clock.setFixedTime(new Date('2026-10-16T03:59:55Z'));
  await game.open();
  await page.clock.setFixedTime(new Date('2026-10-16T04:00:05Z'));
  await page.clock.fastForward(30_001);
  await expect(page.getByRole('button', { name: /play.*today/i })).toBeVisible();
  await game.guess(schools[1]);
  await expect(page.locator('#puzzle-date-heading')).toContainText('October 15, 2026');
  const results = await page.evaluate(() => JSON.parse(localStorage.getItem('charterschoodle:v2:guest:results')));
  expect(results).toMatchObject([{ date: '2026-10-15', status: 'attempted', guessedSchoolIds: [schools[1].id] }]);
});

test('map_and_daily_navigation_preserve_guest_progress', async ({ page, game }) => {
  await game.open();
  await game.guess(schools[1]);
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(page.locator('[data-map-zoom-status]')).toHaveText('135%');
  await page.getByRole('button', { name: 'Daily Puzzle', exact: true }).click();
  await expect(page.locator('#guess-counter')).toHaveText('1 / 6');
});


test('test_server_serves_real_assets_under_a_project_prefix', async ({ page, game }) => {
  // Request the game fixture to retain its external-network block and error checks.
  void game;
  await page.unroute('**/data/puzzles.json');
  await page.unroute('**/data/schools.json');
  const server = spawn(process.execPath, ['scripts/serve-test-site.mjs', '--root', '.', '--prefix', '/charterschoodle', '--port', '0']);
  try {
    const address = await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.once('exit', (code) => reject(new Error(`Test server exited: ${code}`)));
      server.stdout.once('data', (chunk) => resolve(chunk.toString().trim().replace('Test site: ', '')));
    });
    await page.goto(address);
    await expect(page.getByLabel('Guess the school')).toBeEnabled();
    await expect(page.locator('#puzzle-date-heading')).toContainText('October 15, 2026');
    await page.getByRole('button', { name: 'Map', exact: true }).click();
    await expect(page.locator('#map-summary')).toContainText(/mapped schools in North Carolina/);
    await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeVisible();
  } finally {
    server.kill();
  }
});

for (const scenario of [
  { name: 'unplayed', initialSchool: null, counter: '0 / 6', nextGuesses: [schools[2].id] },
  { name: 'attempted', initialSchool: schools[1], counter: '1 / 6', nextGuesses: [schools[1].id, schools[2].id] },
]) {
  test(`midnight_archive_completion_preserves_${scenario.name}_daily_game`, async ({ page, game }) => {
    await page.clock.setFixedTime(new Date('2026-10-16T03:59:55Z'));
    await game.open();
    if (scenario.initialSchool) await game.guess(scenario.initialSchool);
    const originalResults = await page.evaluate(() => localStorage.getItem('charterschoodle:v2:guest:results'));

    await page.clock.setFixedTime(new Date('2026-10-16T04:00:05Z'));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.getByRole('button', { name: 'Past Puzzles', exact: true }).click();
    await page.locator('#archive-date').fill('2026-10-15');
    await expect(page.locator('#puzzle-date-heading')).toContainText('October 15, 2026');
    await game.guess(schools[0]);
    await page.getByRole('button', { name: 'Keep Browsing', exact: true }).click();
    await page.getByRole('button', { name: 'Daily Puzzle', exact: true }).click();

    // Returning to the retained daily game cannot import archive guesses or scores.
    expect(await page.evaluate(() => localStorage.getItem('charterschoodle:v2:guest:results'))).toBe(originalResults);
    await expect(page.locator('#guess-counter')).toHaveText(scenario.counter);
    await expect(page.getByLabel('Guess the school')).toBeEnabled();
    await game.guess(schools[2]);
    const results = await page.evaluate(() => JSON.parse(localStorage.getItem('charterschoodle:v2:guest:results')));
    expect(results).toMatchObject([{
      date: '2026-10-15', status: 'attempted', points: 0, guessedSchoolIds: scenario.nextGuesses,
    }]);
  });
}
