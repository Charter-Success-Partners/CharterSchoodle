import { test, expect, schools, accountFixture } from './fixtures.js';
import { readFile } from 'node:fs/promises';
const realPuzzles = JSON.parse(await readFile(new URL('../../data/puzzles.json', import.meta.url), 'utf8')).puzzles;

for (const width of [320, 390]) test(`first_guess_and_real_clue_share_phone_viewport_${width}`, async ({page, game}) => {
  await page.setViewportSize({width, height: 800});
  const real = realPuzzles.find(p => p.date === '2026-10-15');
  game.setPuzzles([{...real, answerSchoolId: schools[0].id}]);
  await game.open();
  const input = page.getByLabel('Guess the school');
  await expect(input).toBeEnabled();
  const clue = page.locator('#active-clue');
  await expect(clue).toContainText(real.clues[0].text);
  for (const control of [clue, input, page.getByRole('button', {name:'Submit',exact:true})]) {
    const box = await control.boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(800);
  }
  await expect(page.locator('#board-rounds > li')).toHaveCount(0);
  await expect(page.locator('#attempt-progress > li')).toHaveCount(6);
  await game.guess(schools[1]);
  await expect(clue).toContainText(real.clues[1].text);
  await expect(page.locator('#board-rounds > li')).toHaveCount(1);
  await expect(page.getByRole('group',{name:'Round 1 feedback'})).toContainText('Wrong school');
  await expect(input).toBeFocused();
});

test('current_mode_is_exposed_to_assistive_technology', async ({page,game}) => {
  await game.open();
  for (const mode of ['Daily Puzzle','Map','Leaderboard','Past Puzzles']) {
    const button=page.getByRole('button',{name:mode,exact:true});
    await button.click(); await expect(button).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('[data-mode][aria-pressed="true"]')).toHaveCount(1);
  }
});

for (const width of [320,390]) test(`rankings_keep_identity_metric_and_keyboard_details_${width}`,async({page,game})=>{
 await page.setViewportSize({width,height:800});
 const fixture=await accountFixture(page,game);
 const displayName='North Carolina Charter School Community Member';
 const school='Example Academy of North Carolina';
 await page.route('**/rest/v1/rpc/charterschoodle_leaderboard_page_v2',route=>route.fulfill({json:{rows:[{publicId:'public-person',displayName,school,rank:1,points:42,played:8,solved:7,winStreak:4,attemptStreak:8,average:2.1}],total:1,page:1,pageSize:5}}));
 await game.open(); await page.getByRole('button',{name:'Leaderboard',exact:true}).click();
 const row=page.locator('.leaderboard-entry').first();
 await expect(row).toContainText(displayName); await expect(row).toContainText(school);
 for (const [sort,value,label] of [['Points','42','Points'],['Win Streak','4','Win streak'],['Attempt Streak','8','Attempt streak']]) {
  await page.getByRole('button',{name:sort,exact:true}).click();
  await expect(row.locator('.ranking-metric')).toContainText(value);
  await expect(row.locator('.ranking-metric')).toContainText(label);
 }
 const identity=row.locator('.ranking-identity');
 expect((await identity.boundingBox()).width).toBeGreaterThan(140);
 expect(await identity.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const details=row.locator('summary'); await details.focus(); await page.keyboard.press('Enter');
 await expect(row.locator('.ranking-details')).toHaveAttribute('open','');
 await expect(row.locator('.ranking-stats')).toContainText('7 / 8'); fixture.assertSafe();
});

test('map_search_keyboard_selection_and_geography_survive_mobile_reflow',async({page,game})=>{
 await game.open(); await page.getByRole('button',{name:'Map',exact:true}).click();
 const search=page.getByRole('searchbox',{name:'Find a school'});
 await search.fill(schools[1].officialName);
 const result=page.locator('#map-results button').first(); await expect(result).toContainText(schools[1].officialName);
 await search.press('Tab'); await expect(result).toBeFocused(); await page.keyboard.press('Enter');
 await expect(page.locator('#map-selection')).toContainText(schools[1].officialName);
 await expect(page.locator(`.nc-map-pin[data-map-school-id="${schools[1].id}"]`)).toHaveAttribute('aria-pressed','true');
 const ratios=[];
 for(const width of [320,390,1440]) {
  await page.setViewportSize({width,height:800});
  const box=await page.locator('.nc-map-frame').boundingBox();ratios.push(box.width/box.height);
  expect(box.width/box.height).toBeGreaterThan(2.3); expect(box.width/box.height).toBeLessThan(2.8);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 expect(Math.max(...ratios)-Math.min(...ratios)).toBeLessThan(.02);
 await search.fill('NoSuchSchool'); await expect(page.locator('#map-result-status')).toContainText(/no schools/i);
});
