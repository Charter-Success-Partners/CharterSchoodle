import { test, expect, schools, puzzles } from './fixtures.js';

async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
async function touchSize(locator) {
  const box = await locator.boundingBox();
  expect(Math.round(box.width * 100) / 100).toBeGreaterThanOrEqual(44);
  expect(Math.round(box.height * 100) / 100).toBeGreaterThanOrEqual(44);
}

for (const width of [320, 390, 768, 1440]) {
  test(`rounds_do_not_overflow_at_${width}`, async ({ page, game }) => {
    await page.setViewportSize({ width, height: 900 });
    await game.open();
    await noOverflow(page);
    await expect(page.locator('#board-rounds > li')).toHaveCount(6);
    await touchSize(page.getByRole('button', { name: 'Submit', exact: true }));
    await touchSize(page.getByRole('button', { name: 'How to play', exact: true }));
    expect(await page.getByLabel('Guess the school').evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    await game.guess(schools[1]);
    await expect(page.getByLabel('Guess the school')).toBeFocused();
    await expect(page.getByRole('group', { name: 'Round 1 feedback' })).toContainText(/Size|Grades|Direction/);
    await noOverflow(page);
    await page.getByRole('button', { name: 'Map', exact: true }).click();
    for (const name of ['Zoom in', 'Zoom out', 'Reset map view']) await touchSize(page.getByRole('button', { name, exact: true }));
    const pin = page.locator('[data-map-school-id]').first();
    await pin.focus();
    await page.keyboard.press('Enter');
    await expect(pin).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await expect(pin).toHaveAttribute('aria-pressed', 'false');
    await noOverflow(page);
  });
}

test('long_names_remain_readable', async ({ page, game }) => {
  const school = { ...schools[1], officialName: 'A Very Long North Carolina Charter School Name '.repeat(4).trim() };
  await page.route('**/data/schools.json', route => route.fulfill({ json: [schools[0], school] }));
  await page.setViewportSize({ width: 320, height: 900 });
  await game.open();
  await game.guess(school);
  const guess = page.locator('#board-rounds .board-guess').first();
  await expect(guess).toContainText(school.officialName.trim());
  expect(await guess.evaluate(el => el.scrollWidth <= el.clientWidth && getComputedStyle(el).overflow !== 'hidden')).toBe(true);
  await noOverflow(page);
});

test('markup_is_rendered_as_text', async ({ page, game }) => {
  const markup = '<img src=x onerror="window.injected=true">';
  const school = { ...schools[1], officialName: markup };
  game.setPuzzles(puzzles.map(puzzle => ({ ...puzzle, clues: puzzle.clues.map(clue => ({ ...clue, text: markup })) })));
  await page.route('**/data/schools.json', route => route.fulfill({ json: [schools[0], school] }));
  await game.open();
  await game.guess(school);
  await expect(page.locator('#board-rounds .board-clue').first()).toContainText(markup);
  await expect(page.locator('#board-rounds .board-guess').first()).toContainText(markup);
  await expect(page.locator('#board-rounds img')).toHaveCount(0);
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
});

test('dialog_traps_focus_and_restores_opener', async ({ page, game }) => {
  await game.open();
  const opener = page.getByRole('button', { name: 'How to play', exact: true });
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'How to play', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close help' })).toBeFocused();
  await page.keyboard.press('Tab');
  expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Shift+Tab');
  expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  await dialog.getByRole('button', { name: 'Close help' }).click();
  await expect(opener).toBeFocused();
});

// The real profile flow and its Escape coverage belong to Task 9.
test('escape_closes_help_and_result', async ({ page, game }) => {
  await game.open();
  await page.getByRole('button', { name: 'How to play', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('button', { name: 'How to play', exact: true })).toBeFocused();
  await game.guess(schools[0]);
  await expect(page.getByRole('dialog', { name: 'Congrats!' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Daily Puzzle', exact: true })).toBeFocused();
});

test('combobox_announces_selection', async ({ page, game }) => {
  await game.open();
  const input = page.getByRole('combobox', { name: 'Guess the school' });
  await expect(input).toHaveAttribute('aria-expanded', 'false');
  await input.fill('a');
  await expect(input).toHaveAttribute('aria-expanded', 'true');
  const first = await input.getAttribute('aria-activedescendant');
  await expect(page.locator(`#${first}`)).toHaveAttribute('aria-selected', 'true');
  await input.press('ArrowDown');
  const second = await input.getAttribute('aria-activedescendant');
  expect(second).not.toBe(first);
  await expect(page.locator(`#${second}`)).toHaveAttribute('aria-selected', 'true');
  const name = await page.locator(`#${second}`).textContent();
  await input.press('Enter');
  await expect(input).toHaveValue(name.trim());
  await expect(input).toHaveAttribute('aria-expanded', 'false');
  await expect(input).not.toHaveAttribute('aria-activedescendant');
});

test.describe('touch input', () => {
  test.use({ hasTouch: true });
  test('touch_selection_works', async ({ page, game }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await game.open();
    const input = page.getByLabel('Guess the school');
    await input.fill('Academy');
    const option = page.getByRole('option').first();
    await touchSize(option);
    const name = await option.textContent();
    await option.tap();
    await expect(input).toHaveValue(name.trim());
    await expect(input).toBeFocused();
    await expect(input).toHaveAttribute('aria-expanded', 'false');
  });
});

test('no_results_is_announced', async ({ page, game }) => {
  await game.open();
  const input = page.getByLabel('Guess the school');
  await input.fill('NoSuchSchoolXYZ');
  await expect(page.locator('#suggestion-status')).toHaveAttribute('role', 'status');
  await expect(page.locator('#suggestion-status')).toContainText(/no.*schools/i);
  await expect(input).toHaveAttribute('aria-expanded', 'false');
});

test('reduced_motion_has_static_feedback', async ({ page, game }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await game.open();
  await game.guess(schools[1]);
  expect(await page.locator('.panel--primary').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  await expect(page.getByRole('group', { name: 'Round 1 feedback' })).toContainText('Wrong school');
  await game.guess(schools[0]);
  await expect(page.getByRole('dialog', { name: 'Congrats!' })).toBeVisible();
  await expect(page.locator('.confetti-piece')).toHaveCount(0);
});

test('recovery_controls_fit_and_have_touch_targets', async ({ page, game }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  game.failFetch(true);
  await game.open();
  await expect(page.locator('#retry-data')).toBeVisible();
  await touchSize(page.locator('#retry-data'));
  await noOverflow(page);
  game.failFetch(false);
  await page.locator('#retry-data').click();
  await page.clock.setFixedTime(new Date('2026-10-16T04:00:05Z'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.locator('#new-daily-notice')).toBeVisible();
  await touchSize(page.locator('#new-daily-button'));
  await noOverflow(page);
});

test('normal_guess_announces_outcome_and_next_clue', async ({ page, game }) => {
  await game.open();
  await game.guess(schools[1]);
  await expect(page.locator('#status-message')).toContainText(schools[1].officialName);
  await expect(page.locator('#status-message')).toContainText(/clue 2/i);
  await expect(page.locator('#status-message').locator('xpath=ancestor::*[@role="status"]')).toBeVisible();
});
