import { test, expect, schools } from './fixtures.js';

const publicUrl = 'https://charterschoodle.chartersuccesspartners.com/';
const winText = `CharterSchoodle Daily 2026-10-15\n🟩⬜⬜⬜⬜⬜ 1/6\n${publicUrl}`;

// Only the OS share sheet and clipboard are replaced. Real game completion,
// formatting, dialog behavior, and user feedback remain under test.
async function boundaries(page, { share = 'success', clipboard = 'success' } = {}) {
  await page.addInitScript(({ share, clipboard }) => {
    window.sharedResults = [];
    window.copiedResults = [];
    Object.defineProperty(navigator, 'share', { configurable: true, value: share === 'missing' ? undefined : async (payload) => {
      window.sharedResults.push(payload);
      if (share !== 'success') throw new DOMException('Share boundary rejected', share);
    } });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      async writeText(text) {
        if (clipboard !== 'success') throw new DOMException('Clipboard boundary rejected', 'NotAllowedError');
        window.copiedResults.push(text);
      },
    } });
  }, { share, clipboard });
}

const result = page => page.locator('#win-overlay');
const shareButton = page => result(page).getByRole('button', { name: 'Share result', exact: true });
const copyButton = page => result(page).getByRole('button', { name: 'Copy result', exact: true });

async function complete(game, outcome = 'win') {
  for (const school of outcome === 'win' ? [schools[0]] : schools.slice(1, 7)) await game.guess(school);
}

test('win_share_contains_no_answer', async ({ page, game }) => {
  await boundaries(page);
  await game.open();
  await page.evaluate(() => history.replaceState({}, '', '/?code=secret-code#access_token=secret-token'));
  await complete(game);
  await shareButton(page).click();
  expect(await page.evaluate(() => window.sharedResults)).toEqual([{ text: winText }]);
  await expect(result(page).getByRole('status')).toContainText(/shared/i);
  await expect(shareButton(page)).toBeFocused();
  expect(winText).not.toContain(schools[0].officialName);
  expect(await page.evaluate(() => window.copiedResults)).toEqual([]);
  await result(page).getByRole('button', { name: 'Past Puzzles', exact: true }).click();
  await expect(page.locator('#archive-controls')).toBeVisible();
});

test('loss_share_uses_x_of_six', async ({ page, game }) => {
  await boundaries(page);
  await game.open();
  await complete(game, 'loss');
  await expect(result(page)).toBeVisible();
  await shareButton(page).click();
  expect(await page.evaluate(() => window.sharedResults)).toEqual([{
    text: `CharterSchoodle Daily 2026-10-15\n🟥🟥🟥🟥🟥🟥 X/6\n${publicUrl}`,
  }]);
  await expect(shareButton(page)).toBeFocused();
});

test('archive_share_is_labeled', async ({ page, game }) => {
  await boundaries(page);
  await game.open();
  await page.getByRole('button', { name: 'Past Puzzles', exact: true }).click();
  await complete(game);
  await copyButton(page).click();
  expect(await page.evaluate(() => window.copiedResults)).toEqual([
    `CharterSchoodle Archive 2026-10-14\n🟩⬜⬜⬜⬜⬜ 1/6\n${publicUrl}`,
  ]);
  await expect(result(page).getByRole('status')).toContainText(/copied/i);
  await expect(copyButton(page)).toBeFocused();
});

for (const outcome of ['win', 'loss']) {
  test(`reloaded_result_can_be_shared_${outcome}`, async ({ page, game }) => {
    await boundaries(page);
    await game.open();
    await complete(game, outcome);
    await page.reload();
    const opener = page.getByRole('button', { name: 'View result', exact: true });
    await opener.click();
    await copyButton(page).click();
    const copied = await page.evaluate(() => window.copiedResults);
    expect(copied).toEqual([outcome === 'win' ? winText : `CharterSchoodle Daily 2026-10-15\n🟥🟥🟥🟥🟥🟥 X/6\n${publicUrl}`]);
    await page.keyboard.press('Escape');
    await expect(opener).toBeFocused();
    await expect(opener).toBeVisible();
  });
}

test('share_cancel_does_not_copy', async ({ page, game }) => {
  await boundaries(page, { share: 'AbortError' });
  await game.open();
  await complete(game);
  await shareButton(page).click();
  await expect(shareButton(page)).toBeFocused();
  await expect(result(page).getByRole('status')).toBeEmpty();
  await expect(page.getByLabel('Result text')).toBeHidden();
  expect(await page.evaluate(() => window.copiedResults)).toEqual([]);
});

test('share_failure_offers_copy', async ({ page, game }) => {
  await boundaries(page, { share: 'NotAllowedError' });
  await game.open();
  await complete(game);
  await shareButton(page).click();
  await expect(result(page).getByRole('status')).toContainText(/could not share.*copy result/i);
  await expect(shareButton(page)).toBeFocused();
  expect(await page.evaluate(() => window.copiedResults)).toEqual([]);
  await copyButton(page).click();
  expect(await page.evaluate(() => window.copiedResults)).toEqual([winText]);
});

test('clipboard_denial_offers_selectable_text', async ({ page, game }) => {
  await boundaries(page, { clipboard: 'denied' });
  await page.setViewportSize({ width: 320, height: 900 });
  await game.open();
  await complete(game);
  await copyButton(page).click();
  const text = page.getByLabel('Result text', { exact: true });
  await expect(text).toHaveValue(winText);
  await expect(text).toBeFocused();
  expect(await text.evaluate(el => el.value.slice(el.selectionStart, el.selectionEnd))).toBe(winText);
  await expect(result(page).getByRole('status')).toContainText(/could not copy.*select.*copy/i);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Daily Puzzle', exact: true })).toBeFocused();
});

test('unavailable_native_share_offers_explicit_copy', async ({ page, game }) => {
  await boundaries(page, { share: 'missing' });
  await game.open();
  await complete(game);
  await shareButton(page).click();
  await expect(result(page).getByRole('status')).toContainText(/copy result/i);
  expect(await page.evaluate(() => window.copiedResults)).toEqual([]);
  await copyButton(page).click();
  expect(await page.evaluate(() => window.copiedResults)).toEqual([winText]);
});


for (const config of ['missing', 'invalid', 'unsafe']) {
  for (const outcome of ['win', 'loss']) {
    test(`guest_result_survives_${config}_configuration_${outcome}`, async ({ page, game }) => {
      await boundaries(page);
      await page.route('**/src/supabase-config.js', route => config === 'missing' ? route.abort() : route.fulfill({
        contentType: 'text/javascript',
        body: `window.CHARTERSCHOOLDLE_SUPABASE={leaderboardEnabled:false,publicUrl:${JSON.stringify(config === 'invalid' ? 'invalid url' : 'javascript:secret-token')}};`,
      }));
      await game.open();
      await page.evaluate(() => history.replaceState({}, '', '?code=private-code#access_token=private-token'));
      await complete(game, outcome);
      await expect(result(page)).toBeVisible();
      await shareButton(page).click();
      const text = outcome === 'win' ? winText : `CharterSchoodle Daily 2026-10-15\n🟥🟥🟥🟥🟥🟥 X/6\n${publicUrl}`;
      expect(await page.evaluate(() => window.sharedResults)).toEqual([{ text }]);
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'View result', exact: true }).click();
      await copyButton(page).click();
      expect(await page.evaluate(() => window.copiedResults)).toEqual([text]);
    });
  }
}

for (const outcome of ['win', 'loss']) {
  test(`daily_award_is_shown_for_${outcome}`, async ({ page, game }) => {
    await game.open();
    await complete(game, outcome);
    await expect(page.locator('#win-summary')).toContainText(outcome === 'win' ? 'Daily points: 6.' : 'Daily points: 0.');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'View result', exact: true }).click();
    await expect(page.locator('#win-summary')).toContainText(outcome === 'win' ? 'Daily points: 6.' : 'Daily points: 0.');
  });
}

test('archive_result_remains_unscored', async ({ page, game }) => {
  await game.open();
  await page.getByRole('button', { name: 'Past Puzzles', exact: true }).click();
  await complete(game);
  await expect(page.locator('#win-summary')).not.toContainText(/points/i);
});

for (const method of ['share', 'clipboard']) {
  for (const outcome of ['success', 'rejection']) {
    test(`old_${method}_${outcome}_cannot_change_reopened_result`, async ({ page, game }) => {
      await page.addInitScript(() => {
        window.pendingResultActions = [];
        const defer = () => new Promise((resolve, reject) => window.pendingResultActions.push({ resolve, reject }));
        Object.defineProperty(navigator, 'share', { configurable: true, value: defer });
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: defer } });
      });
      await game.open(); await complete(game);
      const action = method === 'share' ? shareButton(page) : copyButton(page);
      await action.click();
      await expect(shareButton(page)).toBeDisabled();
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'View result', exact: true }).click();
      await expect(shareButton(page)).toBeEnabled();
      await action.click();
      const close = result(page).getByRole('button', { name: 'Keep Browsing', exact: true });
      await close.focus();
      await page.evaluate(outcome => {
        const old = window.pendingResultActions[0];
        if (outcome === 'success') old.resolve(); else old.reject(new DOMException('Denied', 'NotAllowedError'));
      }, outcome);
      await expect(result(page).getByRole('status')).toBeEmpty();
      await expect(shareButton(page)).toBeDisabled();
      await expect(copyButton(page)).toBeDisabled();
      await expect(page.getByLabel('Result text')).toBeHidden();
      await expect(close).toBeFocused();
      await page.evaluate(() => window.pendingResultActions[1].resolve());
      await expect(result(page).getByRole('status')).toContainText(method === 'share' ? 'shared' : 'copied');
      await expect(action).toBeEnabled();
      await expect(action).toBeFocused();
    });
  }
}
