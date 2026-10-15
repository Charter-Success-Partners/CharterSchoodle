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
 await page.getByLabel('Your display name',{exact:true}).fill('New Player'); await page.getByLabel('Email address',{exact:true}).fill('fixture@example.test'); await page.locator('#email-submit').click();
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

test('verified_profileless_player_joins_publicly_in_one_form_with_today_notice',async({page,game})=>{
 const fixture=await accountFixture(page,game,{existing:false});
 await page.addInitScript(({date,id})=>localStorage.setItem('charterschoodle:v2:guest:results',JSON.stringify([{date,answerSchoolId:id,guessedSchoolIds:[id],status:'solved'}])),{date:today,id:schools[0].id});
 await game.open(); await page.getByRole('button',{name:'Join leaderboard',exact:true}).click();
 await expect(page.locator('#join-notice')).toContainText(/makes.*public/i);
 await expect(page.getByLabel('Email address',{exact:true})).toBeHidden();
 await page.getByLabel('Your display name',{exact:true}).fill('New Player');
 await page.locator('#email-submit').click();
 await expect(page.locator('#email-dialog')).toBeHidden();
 await expect(page.locator('#status-title')).toHaveText('Solved');
 await expect.poll(()=>fixture.state.history.length).toBe(1);
 expect(fixture.state.profiles[0].listed).toBe(true);
 expect(fixture.state.sent.filter(x=>x.path.endsWith('/otp'))).toEqual([]); fixture.assertSafe();
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
  await expect(page.getByRole('button', { name: 'Join leaderboard', exact: true })).toBeVisible();
  if (mode === 'archive') await page.getByRole('button', { name: 'Past Puzzles', exact: true }).click();
  await game.guess(schools[0]);
  await page.getByRole('button', { name: 'Keep Browsing', exact: true }).click();
  expect(fixture.state.history).toEqual([]);
  // Joining from another view must use daily score provenance, not the active board.
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await page.getByRole('button', { name: 'Join leaderboard', exact: true }).click();
  await page.getByLabel('Your display name', { exact: true }).fill('First Profile');
  await page.locator('#email-submit').click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('#account-status')).toContainText(/joined|ready/i);
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
  const fixture = await accountFixture(page, game, { listed: false });
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
  await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
  await page.getByLabel('Display name', { exact: true }).fill('Submitted Profile');
  await page.getByLabel('Include today’s guest result from this browser', { exact: true }).check();
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await started;
  await page.getByRole('button', { name: 'Close profile', exact: true }).click();
  await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
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


test('latest_hide_submission_wins_over_pending_public_consent_after_reopening', async ({ page, game }) => {
  const fixture = await accountFixture(page, game, { listed: false });
  let release, started;
  const held = new Promise(resolve => release = resolve);
  const dispatched = new Promise(resolve => started = resolve);
  let posts = 0;
  await page.route('**/rest/v1/charterschoodle_profiles_v2*', async route => {
    if (route.request().method() === 'POST' && ++posts === 1) { started(); await held; }
    await route.fallback();
  });
  await game.open();
  const edit = page.getByRole('button', { name: 'Edit profile', exact: true });
  const listed = page.getByLabel('Show my profile and daily scores on the public leaderboard', { exact: true });
  const save = page.getByRole('button', { name: 'Save profile', exact: true });
  await edit.click(); await listed.check(); await save.click(); await dispatched;
  await page.getByRole('button', { name: 'Close profile', exact: true }).click();
  await edit.click(); await listed.uncheck(); await save.click();
  // A bounded dispatch window exposes overlapping requests while the old POST is held.
  await new Promise(resolve => setTimeout(resolve, 100));
  const postsBeforeRelease = posts;
  release();
  await expect.poll(() => fixture.state.sent.filter(x => x.path.endsWith('profiles_v2') && x.method === 'POST').length).toBe(2);
  await expect(page.locator('#profile-dialog')).toBeHidden();
  await expect.soft(page.locator('#account-status')).toContainText('privately');
  expect.soft(fixture.state.profiles[0].listed).toBe(false);
  expect(postsBeforeRelease).toBe(1);
  await edit.click(); await expect(listed).not.toBeChecked();
  fixture.assertSafe();
});

// Break caught: a confirmed join still needs a separate profile form or drops today's guest game.
test('guest_join_finishes_on_fresh_verified_callback_without_a_second_form', async ({ page, game }) => {
  const fixture = await accountFixture(page, game, { user: null, existing: false });
  await game.open(); await game.guess(schools[1]);
  await page.getByRole('button', { name: 'Join leaderboard', exact: true }).click();
  await page.getByLabel('Your display name', { exact: true }).fill('New Player');
  await page.getByLabel('Your school or organization (optional)', { exact: true }).fill('Example School');
  await page.getByLabel('Email address', { exact: true }).fill('fixture@example.test');
  await expect(page.locator('#join-notice')).toContainText(/today.*guest game/i);
  await page.locator('#email-submit').click();
  await expect(page.locator('#email-status')).toContainText(/check your email/i);
  await expect(page.locator('#email-status')).toContainText('fixture@example.test');
  expect(fixture.state.profiles).toEqual([]);
  fixture.state.user = userA;
  await page.goto('./?code=fixture-confirmation');
  await expect(page.locator('#account-status')).toContainText(/joined|ready/i);
  await expect(page.locator('#email-dialog')).toBeHidden();
  await expect(page.locator('#profile-dialog')).toBeHidden();
  await expect.poll(() => fixture.state.history.length).toBe(1);
  expect(fixture.state.profiles).toMatchObject([{ user_id: userA, display_name: 'New Player', school: 'Example School', listed: true }]);
  expect(fixture.state.history[0]).toMatchObject({ user_id: userA, puzzle_date: today, guessed_school_ids: [schools[1].id] });
  const writes = fixture.state.sent.filter(x => x.method === 'POST' && /profiles_v2|results_v2/.test(x.path));
  await page.reload();
  await expect(page.getByRole('button', { name: 'Edit profile', exact: true })).toBeVisible();
  expect(fixture.state.sent.filter(x => x.method === 'POST' && x.path.endsWith('profiles_v2'))).toHaveLength(1);
  expect(writes).toHaveLength(2);
  fixture.assertSafe();
});

async function requestGuestJoin(page, game, fixture) {
 await game.open(); await game.guess(schools[1]);
 await page.getByRole('button',{name:'Join leaderboard',exact:true}).click();
 await page.getByLabel('Your display name',{exact:true}).fill('Retained Player');
 await page.getByLabel('Email address',{exact:true}).fill('fixture@example.test');
 await page.locator('#email-submit').click();
 await expect(page.locator('#email-status')).toContainText(/check your email/i);
 fixture.state.user=userA;
}

for (const table of ['profiles_v2','results_v2']) test(`confirmation_save_failure_retains_details_and_retry_${table}`,async({page,game})=>{
 const fixture=await accountFixture(page,game,{user:null,existing:false});
 await requestGuestJoin(page,game,fixture); fixture.state.fail=table; fixture.state.failMethod='POST';
 await page.goto('./?code=fixture-confirmation');
 await expect(page.locator('#account-status')).toContainText(/could not finish|could not load/i);
 await expect(page.getByRole('button',{name:'Retry account sync',exact:true})).toBeVisible();
 const otpCount=fixture.state.sent.filter(x=>x.path.endsWith('/otp')).length;
 // Reload also has to retain the bound owner and fields after PKCE is consumed.
 await page.reload(); await expect(page.locator('#account-status')).toContainText(/could not finish|could not load/i);
 fixture.state.fail=''; await page.getByRole('button',{name:'Retry account sync',exact:true}).click();
 await expect(page.locator('#account-status')).toContainText(/joined|ready/i);
 expect(fixture.state.profiles).toMatchObject([{display_name:'Retained Player',listed:true}]);
 expect(fixture.state.history).toMatchObject([{user_id:userA,guessed_school_ids:[schools[1].id]}]);
 expect(fixture.state.sent.filter(x=>x.path.endsWith('/otp'))).toHaveLength(otpCount);
 await expect(page.getByRole('button',{name:'Retry account sync',exact:true})).toBeHidden(); fixture.assertSafe();
});

test('prepared_join_cannot_publish_for_a_different_verified_email',async({page,game})=>{
 const fixture=await accountFixture(page,game,{user:null,existing:false}); await requestGuestJoin(page,game,fixture);
 fixture.state.email='different@example.test'; await page.goto('./?code=fixture-confirmation');
 await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeVisible();
 expect(fixture.state.profiles).toEqual([]); expect(fixture.state.history).toEqual([]); fixture.assertSafe();
});

test('prepared_join_keeps_an_existing_hidden_profile_and_does_not_import',async({page,game})=>{
 const fixture=await accountFixture(page,game,{user:null,existing:false}); await requestGuestJoin(page,game,fixture);
 fixture.state.profiles.push({user_id:userA,public_id:'existing-public-id',display_name:'Existing Player',school:'Original School',listed:false});
 await page.goto('./?code=fixture-confirmation');
 await expect(page.locator('#account-status')).toContainText(/private|privacy/i);
 expect(fixture.state.profiles[0]).toMatchObject({display_name:'Existing Player',school:'Original School',listed:false});
 expect(fixture.state.history).toEqual([]);
 expect(fixture.state.sent.filter(x=>x.method==='POST'&&x.path.endsWith('profiles_v2'))).toEqual([]); fixture.assertSafe();
});

test('returning_signin_uses_email_only_and_restores_privacy_without_guest_import',async({page,game})=>{
 const fixture=await accountFixture(page,game,{user:null,existing:false}); await game.open(); await game.guess(schools[1]);
 await page.getByRole('button',{name:'Join leaderboard',exact:true}).click(); await page.getByRole('button',{name:'Already joined? Sign in',exact:true}).click();
 await expect(page.getByLabel('Your display name',{exact:true})).toBeHidden();
 await page.getByLabel('Email address',{exact:true}).fill('fixture@example.test'); await page.getByRole('button',{name:'Send sign-in link',exact:true}).click();
 await expect(page.locator('#email-status')).toContainText(/check your email/i);
 fixture.state.user=userA; fixture.state.profiles.push({user_id:userA,public_id:'original',display_name:'Private Player',school:'',listed:false});
 await page.goto('./?code=fixture-confirmation');
 await expect(page.getByRole('button',{name:'Edit profile',exact:true})).toBeVisible();
 expect(fixture.state.history).toEqual([]); expect(fixture.state.profiles[0].listed).toBe(false); fixture.assertSafe();
});

test('unpersistable_join_details_block_the_email_request_and_keep_guest_play',async({page,game})=>{
 const fixture=await accountFixture(page,game,{user:null,existing:false}); await game.open();
 await page.evaluate(()=>{ const set=Storage.prototype.setItem; Storage.prototype.setItem=function(k,v){if(k==='charterschoodle-join:v1')throw new DOMException('Quota','QuotaExceededError');return set.call(this,k,v);}; });
 await page.getByRole('button',{name:'Join leaderboard',exact:true}).click();
 await page.getByLabel('Your display name',{exact:true}).fill('Player'); await page.getByLabel('Email address',{exact:true}).fill('fixture@example.test'); await page.locator('#email-submit').click();
 await expect(page.locator('#email-status')).toContainText(/storage/i);
 expect(fixture.state.sent.filter(x=>x.path.endsWith('/otp'))).toEqual([]);
 await page.keyboard.press('Escape'); await game.guess(schools[1]); await expect(page.locator('#guess-counter')).toHaveText('1 / 6'); fixture.assertSafe();
});

test('requesting_and_callback_tabs_complete_one_profile_and_one_guest_import',async({page,game,context})=>{
 const fixture=await accountFixture(page,game,{user:null,existing:false}); await requestGuestJoin(page,game,fixture);
 const callback=await context.newPage();
 await callback.clock.install({time:new Date(await page.evaluate(()=>Date.now()))});
 await callback.route('**/data/puzzles.json',route=>route.fulfill({json:{generatedAt:today,puzzles}}));
 await callback.route('**/data/schools.json',route=>route.fulfill({json:schools}));
 const other=await accountFixture(callback,game,{user:null,existing:false,sharedState:fixture.state});
 await callback.goto('./?code=fixture-confirmation');
 await expect(callback.getByRole('button',{name:'Edit profile',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Edit profile',exact:true})).toBeVisible();
 await expect.poll(()=>fixture.state.history.length).toBe(1);
 expect(fixture.state.sent.filter(x=>x.method==='POST'&&x.path.endsWith('profiles_v2'))).toHaveLength(1);
 expect(fixture.state.sent.filter(x=>x.method==='POST'&&x.path.endsWith('results_v2'))).toHaveLength(1);
 expect(fixture.state.history[0]).toMatchObject({user_id:userA,guessed_school_ids:[schools[1].id]});
 fixture.assertSafe(); other.assertSafe(); await callback.close();
});

test('check_email_countdown_allows_address_and_details_correction_before_resend',async({page,game})=>{
 const fixture=await accountFixture(page,game,{user:null,existing:false}); await game.open();
 await page.getByRole('button',{name:'Join leaderboard',exact:true}).click();
 await page.getByLabel('Your display name',{exact:true}).fill('First draft'); await page.getByLabel('Email address',{exact:true}).fill('first@example.test'); await page.locator('#email-submit').click();
 await expect(page.locator('#email-status')).toContainText('first@example.test'); await expect(page.locator('#email-submit')).toBeDisabled();
 await expect(page.locator('#email-submit')).toContainText(/resend.*\d+s/i);
 await page.getByRole('button',{name:'Edit details or email',exact:true}).click();
 await page.getByLabel('Your display name',{exact:true}).fill('Corrected Player'); await page.getByLabel('Email address',{exact:true}).fill('corrected@example.test');
 await page.clock.fastForward(61000); await expect(page.locator('#email-submit')).toBeEnabled(); await page.locator('#email-submit').click();
 await expect(page.locator('#email-status')).toContainText('corrected@example.test');
 fixture.state.user=userA; fixture.state.email='corrected@example.test'; await page.goto('./?code=fixture-confirmation');
 await expect(page.locator('#account-status')).toContainText(/joined|ready/i);
 expect(fixture.state.profiles).toMatchObject([{display_name:'Corrected Player',listed:true}]);
 expect(fixture.state.sent.filter(x=>x.path.endsWith('/otp')).map(x=>x.data.email)).toEqual(['first@example.test','corrected@example.test']); fixture.assertSafe();
});
