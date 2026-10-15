import { test, expect, accountFixture, userA, userB, schools, puzzles, today } from './fixtures.js';
const result=(date=today,user_id=userA)=>({user_id,puzzle_date:date,answer_school_id:schools[0].id,guessed_school_ids:[schools[0].id],status:'solved'});

test('second_device_restores_unlisted_lifetime_history_and_daily_game',async({page,game})=>{
 const fixture=await accountFixture(page,game,{history:[result('2026-10-14'),result()]});
 await game.open(); await expect(page.locator('#status-title')).toHaveText('Solved');
 await page.getByRole('button',{name:'Leaderboard',exact:true}).click();
 await expect(page.locator('#score-total')).toHaveText('12');
 await expect(page.locator('#leaderboard-body tr')).toHaveCount(5);
 await page.getByRole('button',{name:'Next',exact:true}).click();
 await expect(page.locator('#leaderboard-body')).toContainText('Player 6');
 fixture.assertSafe();
});

test('profile_escape_and_close_restore_opener_focus',async({page,game})=>{
 const fixture=await accountFixture(page,game); await game.open();
 const opener=page.getByRole('button',{name:'Edit profile',exact:true}); await opener.click();
 await expect(page.getByRole('dialog',{name:'Your leaderboard profile'})).toBeVisible();
 await page.keyboard.press('Escape'); await expect(opener).toBeFocused();
 await opener.click(); await page.getByRole('button',{name:'Close profile',exact:true}).click(); await expect(opener).toBeFocused();
 await game.guess(schools[1]); await expect(page.locator('#guess-counter')).toHaveText('1 / 6'); fixture.assertSafe();
});

test('editing_and_hiding_preserves_identity',async({page,game})=>{
 const fixture=await accountFixture(page,game,{listed:true}); await game.open();
 await page.getByRole('button',{name:'Edit profile',exact:true}).click();
 await page.getByLabel('Display name',{exact:true}).fill('Edited Name'); await page.getByLabel('School or organization (optional)',{exact:true}).fill('Example School');
 await page.getByLabel('Show my profile and daily scores on the public leaderboard',{exact:true}).uncheck();
 await page.getByRole('button',{name:'Save profile',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeHidden();
 expect(fixture.state.profiles[0]).toMatchObject({user_id:userA,public_id:`public-${userA}`,display_name:'Edited Name',listed:false}); fixture.assertSafe();
});

test('same_display_name_never_restores_other_account_history',async({page,game})=>{
 const fixture=await accountFixture(page,game,{user:userB,history:[result()]}); await game.open();
 await expect(page.getByRole('button',{name:'Edit profile',exact:true})).toBeVisible();
 await expect(page.locator('#guess-counter')).toHaveText('0 / 6');
 await page.getByRole('button',{name:'Leaderboard',exact:true}).click(); await expect(page.locator('#score-total')).toHaveText('0'); fixture.assertSafe();
});

test('email_failure_and_dismissal_keep_guest_play_available',async({page,game})=>{
 const fixture=await accountFixture(page,game,{user:null}); fixture.state.fail='/otp'; await game.open();
 await page.getByRole('button',{name:'Join leaderboard',exact:true}).click();
 await page.getByLabel('Email address',{exact:true}).fill('fixture@example.test'); await page.getByRole('button',{name:'Send sign-in link',exact:true}).click();
 await expect(page.locator('#email-status')).toContainText(/could not|try again/i);
 await page.keyboard.press('Escape'); await game.guess(schools[1]); await expect(page.locator('#guess-counter')).toHaveText('1 / 6'); fixture.assertSafe();
});

test('failed_verification_never_reads_owner_data',async({page,game})=>{
 const fixture=await accountFixture(page,game); fixture.state.fail='/user'; await game.open();
 await expect(page.locator('#account-status')).toContainText(/could not be verified/i);
 await game.guess(schools[1]); expect(fixture.state.sent.filter(x=>/profiles_v2|results_v2/.test(x.path))).toEqual([]); fixture.assertSafe();
});

test('leaderboard_failure_is_public_only',async({page,game})=>{
 const fixture=await accountFixture(page,game,{history:[result()]}); fixture.state.fail='/rpc/'; await game.open();
 await expect(page.locator('#status-title')).toHaveText('Solved'); await page.getByRole('button',{name:'Leaderboard',exact:true}).click();
 await expect(page.locator('#leaderboard-body')).toContainText(/unavailable/i); await expect(page.locator('#score-total')).toHaveText('6'); fixture.assertSafe();
});

test('signout_failure_clears_identity_and_returns_to_guest',async({page,game})=>{
 const fixture=await accountFixture(page,game,{history:[result()]}); fixture.state.fail='/logout'; await game.open();
 await expect(page.locator('#status-title')).toHaveText('Solved'); await page.getByRole('button',{name:'Sign out',exact:true}).click();
 await expect(page.locator('#guess-counter')).toHaveText('0 / 6'); await expect(page.getByRole('button',{name:'Join leaderboard',exact:true})).toBeVisible();
 await game.guess(schools[1]); expect(fixture.state.sent.filter(x=>x.path.endsWith('results_v2')&&x.method==='POST')).toEqual([]); fixture.assertSafe();
});

test('pending_score_outage_has_persistent_status_and_working_retry',async({page,game})=>{
 const fixture=await accountFixture(page,game); await game.open();
 await expect(page.getByRole('button',{name:'Edit profile',exact:true})).toBeVisible();
 fixture.state.fail='results_v2'; await game.guess(schools[1]);
 await expect(page.locator('#account-status')).toContainText(/could not sync/i);
 await page.clock.fastForward(2000);
 await expect(page.locator('#account-status')).toContainText(/could not sync/i);
 fixture.state.fail=''; await page.getByRole('button',{name:'Retry account sync',exact:true}).click();
 await expect.poll(()=>fixture.state.history.length).toBe(1);
 expect(fixture.state.history[0]).toMatchObject({user_id:userA,guessed_school_ids:[schools[1].id]}); fixture.assertSafe();
});

for(const include of [false,true]) test(`new_profile_import_is_explicit_${include}`,async({page,game})=>{
 const fixture=await accountFixture(page,game,{existing:false});
 await page.addInitScript(({date,id})=>localStorage.setItem('charterschoodle:v2:guest:results',JSON.stringify([{date,answerSchoolId:id,guessedSchoolIds:[id],status:'solved'}])),{date:today,id:schools[0].id});
 await game.open(); await page.getByRole('button',{name:'Create profile',exact:true}).click();
 await expect(page.getByLabel('Show my profile and daily scores on the public leaderboard',{exact:true})).not.toBeChecked();
 await expect(page.getByLabel('Include today’s guest result from this browser',{exact:true})).not.toBeChecked();
 await page.getByLabel('Display name',{exact:true}).fill('New Player');
 if(include)await page.getByLabel('Include today’s guest result from this browser',{exact:true}).check();
 await page.getByRole('button',{name:'Save profile',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeHidden();
 if(include){await expect(page.locator('#status-title')).toHaveText('Solved');await expect.poll(()=>fixture.state.history.length).toBe(1);}
 else {await expect(page.locator('#guess-counter')).toHaveText('0 / 6');expect(fixture.state.history).toEqual([]);}
 expect(fixture.state.profiles[0].listed).toBe(false); fixture.assertSafe();
});

test('successful_sync_keeps_new_result_dialog_open',async({page,game})=>{
 const fixture=await accountFixture(page,game); await game.open();
 await expect(page.getByRole('button',{name:'Edit profile',exact:true})).toBeVisible();
 await game.guess(schools[0]); await expect.poll(()=>fixture.state.history.length).toBe(1);
 await expect(page.locator('#account-status')).toContainText(/saved privately/i);
 await expect(page.getByRole('dialog',{name:'Congrats!',exact:true})).toBeVisible(); fixture.assertSafe();
});

test('remote_conflict_refreshes_daily_session_and_retains_local_evidence',async({page,game})=>{
 const fixture=await accountFixture(page,game); await game.open();
 await expect(page.getByRole('button',{name:'Edit profile',exact:true})).toBeVisible();
 fixture.state.history.push(result());
 await page.route('**/rest/v1/charterschoodle_results_v2*',async route=>route.request().method()==='POST'?route.fulfill({status:409,json:{code:'23514',message:'Terminal results are immutable'},headers:{'access-control-allow-origin':'*'}}):route.fallback());
 await game.guess(schools[1]); await expect(page.locator('#status-title')).toHaveText('Solved');
 await page.getByRole('button',{name:'Map',exact:true}).click(); await page.getByRole('button',{name:'Daily Puzzle',exact:true}).click();
 await expect(page.locator('#board-rounds')).toContainText(schools[0].officialName);
 expect(await page.evaluate(user=>JSON.parse(localStorage.getItem(`charterschoodle:v2:${user}:pending`)).values,userA)).toMatchObject([{guessedSchoolIds:[schools[1].id]}]); fixture.assertSafe();
});

test('public_rankings_remain_available_after_signout',async({page,game})=>{
 const fixture=await accountFixture(page,game); await game.open();
 await expect(page.getByRole('button',{name:'Edit profile',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Sign out',exact:true}).click();
 await expect(page.getByRole('button',{name:'Join leaderboard',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Leaderboard',exact:true}).click();
 await expect(page.locator('#leaderboard-body tr')).toHaveCount(5);
 await page.getByRole('button',{name:'Next',exact:true}).click();
 await expect(page.locator('#leaderboard-body')).toContainText('Player 6'); fixture.assertSafe();
});

for (const mode of ['daily', 'archive']) test(`first_profile_queues_only_owned_daily_progress_${mode}`, async ({ page, game }) => {
  const fixture = await accountFixture(page, game, { existing: false });
  await game.open();
  await expect(page.getByRole('button', { name: 'Create profile', exact: true })).toBeVisible();
  if (mode === 'archive') await page.getByRole('button', { name: 'Past Puzzles', exact: true }).click();
  await game.guess(schools[0]);
  await page.getByRole('button', { name: 'Keep Browsing', exact: true }).click();
  expect(fixture.state.history).toEqual([]);
  // Joining from another view must use daily score provenance, not the active board.
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await page.getByRole('button', { name: 'Create profile', exact: true }).click();
  await page.getByLabel('Display name', { exact: true }).fill('First Profile');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('#account-status')).toContainText(/saved privately/i);
  if (mode === 'daily') {
    await expect.poll(() => fixture.state.history.length).toBe(1);
    expect(fixture.state.history[0]).toMatchObject(result());
    await page.evaluate(user => {
      for (const key of Object.keys(localStorage)) if (key.startsWith(`charterschoodle:v2:${user}:`)) localStorage.removeItem(key);
    }, userA);
    await page.reload();
    await expect(page.locator('#status-title')).toHaveText('Solved');
  } else {
    expect(fixture.state.history).toEqual([]);
  }
  fixture.assertSafe();
});

test('pending_profile_save_preserves_captured_consent_and_reopened_form', async ({ page, game }) => {
  const fixture = await accountFixture(page, game, { existing: false });
  await page.addInitScript(({ date, id }) => localStorage.setItem('charterschoodle:v2:guest:results', JSON.stringify([
    { date, answerSchoolId: id, guessedSchoolIds: [id], status: 'solved' },
  ])), { date: today, id: schools[0].id });
  let release, dispatched;
  const held = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { dispatched = resolve; });
  await page.route('**/rest/v1/charterschoodle_profiles_v2*', async route => {
    if (route.request().method() === 'POST') { dispatched(); await held; }
    await route.fallback();
  });
  await game.open();
  await page.getByRole('button', { name: 'Create profile', exact: true }).click();
  await page.getByLabel('Display name', { exact: true }).fill('Submitted Profile');
  await page.getByLabel('Include today’s guest result from this browser', { exact: true }).check();
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await started;
  await page.getByRole('button', { name: 'Close profile', exact: true }).click();
  await page.getByRole('button', { name: 'Create profile', exact: true }).click();
  await page.getByLabel('Display name', { exact: true }).fill('Reopened Draft');
  await page.getByLabel('School or organization (optional)', { exact: true }).fill('Draft School');
  release();
  await expect(page.locator('#account-status')).toContainText(/saved privately/i);
  await expect.soft(page.getByRole('dialog', { name: 'Your leaderboard profile' })).toBeVisible();
  await expect.soft(page.getByLabel('Display name', { exact: true })).toHaveValue('Reopened Draft');
  await expect.soft(page.getByLabel('School or organization (optional)', { exact: true })).toBeFocused();
  await expect.poll(() => fixture.state.history.length).toBe(1);
  expect(fixture.state.profiles[0].display_name).toBe('Submitted Profile');
  expect(await page.evaluate(user => JSON.parse(localStorage.getItem(`charterschoodle:v2:${user}:guest-imports`)), userA)).toMatchObject({ subject: userA, values: [today] });
  await expect(page.getByRole('button', { name: 'Save profile', exact: true })).toBeEnabled();
  fixture.assertSafe();
});
