import { test, expect, accountFixture } from './fixtures.js';

test('packaged_metadata_uses_configured_public_url_and_real_social_image', async ({ page, game }) => {
  await game.open();
  const publicUrl = await page.evaluate(() => window.CHARTERSCHOOLDLE_SUPABASE.publicUrl);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', publicUrl);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', publicUrl);
  const imageUrl = new URL('assets/social-card.png', publicUrl).href;
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', imageUrl);
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', imageUrl);
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1200');
  await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute('content', '630');
  const dimensions = await page.evaluate(async () => {
    const image = new Image();
    image.src = new URL('./assets/social-card.png', location.href).href;
    await image.decode();
    return [image.naturalWidth, image.naturalHeight];
  });
  expect(dimensions).toEqual([1200, 630]);
});

test('callback_entry_cleans_private_query_and_preserves_mount_and_guest_play', async ({ page, game, baseURL }) => {
  const fixture = await accountFixture(page, game, { user: null });
  await page.goto(new URL('./?error=access_denied&error_code=otp_expired&error_description=Expired', baseURL).href);
  await expect(page.locator('#account-status')).toContainText(/could not be used/i);
  await expect(page.getByLabel('Guess the school')).toBeEnabled();
  await expect(page).toHaveURL(baseURL);
  fixture.assertSafe();
});
