import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLeaderboardController } from '../../src/leaderboard.js';
import { createGameStore, createSafeStorage } from '../../src/storage.js';
const A = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const date = '2026-10-15';
const schools = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(id => ({ id }));
const puzzles = ['2026-10-13', '2026-10-14', date].map(date => ({ date, answerSchoolId: 'a' }));
const progress = (...ids) => ({ guesses: ids.map(schoolId => ({ schoolId })) });
const raw = (user_id = A, puzzle_date = date, ids = ['a']) => ({ user_id, puzzle_date, answer_school_id: 'a', guessed_school_ids: ids, status: ids.at(-1) === 'a' ? 'solved' : 'attempted' });
const profile = user_id => ({ user_id, public_id: `public-${user_id}`, display_name: 'Same Name', school: '', listed: false });
function deferred() { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; }
function setup() {
  const kv = createSafeStorage(() => null), stores = new Map(), calls = [];
  const state = { profiles: [profile(A), profile(B)], rows: [], pageLimit: 1, write: null, read: null, rpc: null };
  const storeFor = subject => { if (!stores.has(subject)) stores.set(subject, createGameStore({ kv, subject, schools, puzzles })); return stores.get(subject); };
  const client = {
    from(table) {
      const q = { table, filters: {}, first: 0, last: Infinity, payload: null };
      const chain = {
        select() { return chain; }, eq(k, v) { q.filters[k] = v; return chain; }, order() { return chain; }, range(a,b) { q.first = a; q.last = b; return chain; }, maybeSingle() { q.single = true; return chain; }, single() { q.single = true; return chain; }, upsert(payload) { q.payload = structuredClone(payload); return chain; },
        then(resolve, reject) { return (async () => {
          calls.push(structuredClone(q));
          if (q.payload && state.write) return state.write(q);
          if (!q.payload && state.read) { const response = await state.read(q); if (response) return response; }
          const values = table.includes('profiles') ? state.profiles : state.rows;
          if (q.payload) {
            const index = values.findIndex(x => x.user_id === q.payload.user_id && (table.includes('profiles') || x.puzzle_date === q.payload.puzzle_date));
            const value = table.includes('profiles') ? { ...profile(q.payload.user_id), ...q.payload } : q.payload;
            if (index >= 0) values[index] = value; else values.push(value);
            return { data: q.single ? value : [value], error: null };
          }
          const filtered = values.filter(row => Object.entries(q.filters).every(([k,v]) => row[k] === v));
          const data = filtered.slice(q.first, Math.min(q.last + 1, q.first + state.pageLimit));
          return { data: q.single ? data[0] || null : data, error: null };
        })().then(resolve, reject); },
      }; return chain;
    },
    async rpc(name, params) { calls.push({ name, params }); return state.rpc ? state.rpc(params) : { data: { rows: [], total: 0, page: params.p_page, pageSize: 5 }, error: null }; },
  };
  const controller = createLeaderboardController({ getClient: () => client, storeFor, getPuzzle: d => puzzles.find(p => p.date === d), schoolIds: new Set(schools.map(x => x.id)), now: () => new Date('2026-10-15T16:00:00Z') });
  const queue = (ids = ['a'], mode = 'daily') => controller.queueDailyResult({ date, progress: progress(...ids), answerSchoolId: 'a', mode });
  const join = async (subject = A) => { controller.setSubject(subject); await controller.readProfile(); };
  return { controller, storeFor, state, calls, queue, join };
}

test('guest_cannot_queue_remote_results', async () => { const s = setup(); s.queue(); await s.controller.flush(); assert.deepEqual(s.calls, []); });
test('archive_never_queues', async () => { const s = setup(); await s.join(); s.queue(['a'], 'archive'); assert.equal(s.storeFor(A).readPending().length, 0); });
test('joining_does_not_import_old_guest_history', async () => { const s = setup(); s.storeFor('guest').writeResult({ date: '2026-10-14', answerSchoolId: 'a', guessedSchoolIds: ['a'], status: 'solved' }); await s.join(); await s.controller.flush(); assert.equal(s.storeFor(A).readResults().length, 0); assert.equal(s.state.rows.length, 0); });
test('matching_public_name_never_claims_history', async () => { const s = setup(); s.state.rows = [raw(A)]; await s.join(B); assert.deepEqual(await s.controller.readOwnerResults(), []); assert.equal(s.calls.filter(c => c.table?.includes('results'))[0].filters.user_id, B); });
test('guest_import_requires_confirmation', async () => { const s = setup(); await s.join(); const guestStore = s.storeFor('guest'); guestStore.writeResult({ date, answerSchoolId:'a', guessedSchoolIds:['a'], status:'solved' }); assert.equal(await s.controller.adoptTodayGuest({ confirmed:false, guestStore, date }), false); assert.equal(s.storeFor(A).readPending().length,0); assert.equal(await s.controller.adoptTodayGuest({ confirmed:true, guestStore, date }), true); assert.equal(s.storeFor(A).readPending().length,1); });
test('same_date_import_has_one_receipt_per_account', async () => { const s = setup(); await s.join(); const guestStore = s.storeFor('guest'); guestStore.writeResult({ date, answerSchoolId:'a', guessedSchoolIds:['a'], status:'solved' }); assert.equal(await s.controller.adoptTodayGuest({ confirmed:true, guestStore, date }),true); assert.equal(await s.controller.adoptTodayGuest({ confirmed:true, guestStore, date }),false); await s.join(B); assert.equal(await s.controller.adoptTodayGuest({ confirmed:true, guestStore, date }),true); });
test('numeric_legacy_and_existing_remote_block_import', async () => { const s = setup(); await s.join(); const guestStore=s.storeFor('guest'); guestStore.writeResult({date,answerSchoolId:'a',guesses:1,status:'solved'}); assert.equal(await s.controller.adoptTodayGuest({confirmed:true,guestStore,date}),false); guestStore.writeResult({date,answerSchoolId:'a',guessedSchoolIds:['a'],status:'solved'}); s.state.rows=[raw(A,date,['b'])]; assert.equal(await s.controller.adoptTodayGuest({confirmed:true,guestStore,date}),false); });
test('account_switch_drops_stale_responses', async () => { const s = setup(); await s.join(); const wait=deferred(); s.state.read=() => wait.promise; const reading=s.controller.readOwnerResults(); await Promise.resolve(); s.controller.setSubject(B); wait.resolve({data:[raw(A)],error:null}); await assert.rejects(reading,{name:'AbortError'}); assert.equal(s.storeFor(B).readResults().length,0); });
test('pending_a_never_dispatches_as_b', async () => { const s = setup(); await s.join(); s.queue(); const wait=deferred(), dispatched=deferred(); let sentToServer; s.state.write=q=>{sentToServer=q.payload; dispatched.resolve(); return wait.promise;}; const flushing=s.controller.flush(); await dispatched.promise; s.controller.setSubject(B); wait.resolve({error:{message:'offline'}}); await assert.rejects(flushing); assert.equal(sentToServer.user_id,A); assert.equal(s.storeFor(B).readResults().length,0); assert.equal(s.storeFor(A).readPending().length,1); });
test('conflicting_terminal_result_restores_remote', async () => { const s = setup(); await s.join(); s.queue(['b','a']); s.state.rows=[raw(A)]; s.state.write=()=>({status:409,error:{code:'23514',message:'Terminal results are immutable'}}); await s.controller.flush(); assert.deepEqual(s.storeFor(A).readProgress(date).guesses,[{schoolId:'a',correct:true}]); assert.deepEqual(s.storeFor(A).readPending()[0].guessedSchoolIds,['b','a']); });
test('bad_remote_progress_cannot_crash', async () => { const s=setup(); await s.join(); s.state.rows=[raw(A,date,['missing']),raw(A,'2026-10-14',['b','b'])]; assert.deepEqual(await s.controller.readOwnerResults(),[]); assert.equal(await s.controller.loadOwnerProgress(date),null); });
test('outage_retains_pending_results', async () => {const s=setup(); await s.join(); s.queue(); s.state.write=()=>({error:{message:'offline'},status:503}); await assert.rejects(s.controller.flush()); assert.equal(s.storeFor(A).readPending().length,1);});
test('unlisted_profile_stays_private', async () => {const s=setup(); await s.join(); const saved=await s.controller.saveProfile({displayName:'Edited',school:'School',listed:false}); assert.equal(saved.listed,false); assert.equal(saved.publicId,`public-${A}`); s.queue(); await s.controller.flush(); assert.equal(s.state.rows[0].user_id,A); assert.equal(s.storeFor(A).readPending().length,0);});
test('personal_history_reads_all_server_pages', async () => {const s=setup(); await s.join(); s.state.rows=puzzles.map(p=>raw(A,p.date)); const entries=await s.controller.readOwnerResults(); assert.equal(entries.length,3); assert.equal(s.storeFor(A).readResults().reduce((sum,e)=>sum+e.points,0),18); assert.deepEqual(s.calls.filter(c=>c.table?.includes('results')).map(c=>c.first),[0,1,2,3]);});
test('sort_race_cannot_overwrite_latest_page', async () => {const s=setup(); const wait=deferred(); s.state.rpc=p=>p.p_sort==='points'?wait.promise:{data:{rows:[{publicId:'latest-player'}],total:1,page:1,pageSize:5},error:null}; const old=s.controller.refresh({sort:'points',page:1}); const latest=await s.controller.refresh({sort:'winStreak',page:1}); wait.resolve({data:{rows:[{publicId:'old-player'}],total:1,page:1,pageSize:5},error:null}); await assert.rejects(old,{name:'AbortError'}); assert.equal(latest.rows[0].publicId,'latest-player');});
test('remote_prefix_cannot_erase_more_advanced_pending', async()=>{const s=setup(); await s.join(); s.queue(['b','c']); s.storeFor(A).writeProgress(date,progress('b','c')); s.state.rows=[raw(A,date,['b'])]; assert.equal((await s.controller.loadOwnerProgress(date)).guesses.length,2);});
test('successful_old_write_cannot_acknowledge_newer_guess',async()=>{const s=setup(); await s.join(); s.queue(['b']); const wait=deferred(), dispatched=deferred(); s.state.write=()=>{dispatched.resolve();return wait.promise;}; const flushing=s.controller.flush(); await dispatched.promise; s.queue(['b','a']); wait.resolve({data:null,error:null}); await flushing; assert.deepEqual(s.storeFor(A).readPending()[0].guessedSchoolIds,['b','a']);});
