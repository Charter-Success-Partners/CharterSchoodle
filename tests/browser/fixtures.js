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
      async open() { await page.goto('./'); },
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

export const userA = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
export const userB = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
export async function accountFixture(page, game, { user = userA, listed = false, history = [], existing = true } = {}) {
  const origin = 'https://psashnygmlwkuvblbpzk.supabase.co';
  const state = { user, profiles: existing ? [{ user_id: user, public_id: `public-${user}`, display_name: 'Same Name', school: '', listed }] : [], history, sent: [], fail: '', pageCalls: [] };
  const unexpected = [];
  await page.route('**/src/supabase-config.js', route => route.fulfill({ contentType: 'text/javascript', body: `window.CHARTERSCHOOLDLE_SUPABASE={url:${JSON.stringify(origin)},anonKey:'sb_publishable_fixture',leaderboardEnabled:true,publicUrl:${JSON.stringify(test.info().project.use.baseURL)}};` }));
  if (user) await page.addInitScript(user => {
    localStorage.setItem('charterschoodle-auth:v2', JSON.stringify({ access_token: 'fixture-token', refresh_token: 'fixture-refresh', expires_at: 1999999999, token_type: 'bearer', user: { id: user, email: 'fixture@example.test' } }));
  }, user);
  await page.route(`${origin}/**`, async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    const reply = (json, status = 200) => route.fulfill({ status, json, headers: { 'access-control-allow-origin': '*' } });
    const known = ['/auth/v1/user','/auth/v1/otp','/auth/v1/logout','/rest/v1/charterschoodle_profiles_v2','/rest/v1/charterschoodle_results_v2','/rest/v1/rpc/charterschoodle_leaderboard_page_v2'];
    if (!known.includes(path)) { unexpected.push(`${request.method()} ${url.href}`); return route.abort(); }
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS' } });
    state.sent.push({ path, method: request.method(), data: request.postDataJSON() });
    if (state.fail && path.includes(state.fail)) return reply({ message: 'Fixture unavailable' }, 503);
    if (path === '/auth/v1/user') return reply({ id: state.user, email: 'fixture@example.test' });
    if (path === '/auth/v1/otp' || path === '/auth/v1/logout') return reply({});
    if (path.endsWith('/charterschoodle_leaderboard_page_v2')) { const params=request.postDataJSON(); state.pageCalls.push(params); return reply({ rows: Array.from({length: params.p_page === 1 ? 5 : 1}, (_,i)=>({publicId:`public-${i}`,displayName:`Player ${i+1+(params.p_page-1)*5}`,school:'',rank:i+1+(params.p_page-1)*5,points:6,played:1,solved:1,winStreak:1,attemptStreak:1,average:1})), total:6,page:params.p_page,pageSize:5 }); }
    const profiles = path.endsWith('profiles_v2');
    const values = profiles ? state.profiles : state.history;
    if (request.method() === 'POST') {
      const data=request.postDataJSON();
      const value=profiles?{public_id:`public-${data.user_id}`,...values.find(x=>x.user_id===data.user_id),...data}:data;
      const index=values.findIndex(x=>x.user_id===value.user_id&&(profiles||x.puzzle_date===value.puzzle_date));
      if(index<0) values.push(value); else values[index]=value;
      return reply(request.headers().accept?.includes('object')?value:[value]);
    }
    const owner=url.searchParams.get('user_id')?.replace('eq.','');
    let rows=values.filter(x=>x.user_id===owner);
    const date=url.searchParams.get('puzzle_date')?.replace('eq.',''); if(date)rows=rows.filter(x=>x.puzzle_date===date);
    const offset=Number(url.searchParams.get('offset')||0); rows=rows.slice(offset,offset+1);
    return reply(request.headers().accept?.includes('object')?(rows[0]||null):rows);
  });
  return { state, assertSafe() { expect(unexpected,'Only exact v2/Auth/RPC fixture endpoints are permitted').toEqual([]); }, game };
}
