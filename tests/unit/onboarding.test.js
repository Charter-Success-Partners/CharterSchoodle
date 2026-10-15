import test from 'node:test';
import assert from 'node:assert/strict';
import { createSafeStorage, createGameStore } from '../../src/storage.js';
import { createOnboardingController } from '../../src/onboarding.js';
import { createLeaderboardController } from '../../src/leaderboard.js';
const A = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const date = '2026-10-15', instant = Date.parse('2026-10-15T16:00:00Z');
const fields = { email: ' PERSON@Example.test ', displayName: ' Player ', school: ' School ' };
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };

// The external boundary is an in-memory database; onboarding and owner controllers stay real.
async function setup() {
  const values = new Map(), backing = { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) };
  const storage = createSafeStorage(() => backing), stores = new Map();
  const storeFor = subject => {
    if (!stores.has(subject)) stores.set(subject, createGameStore({ kv: storage, subject, schools: [{id:'a'},{id:'b'}], puzzles: [{date,answerSchoolId:'a'},{date:'2026-10-14',answerSchoolId:'a'}] }));
    return stores.get(subject);
  };
  const db = { profiles: [], results: [], writes: [], fail: '', hold: null };
  const client = { from(table) {
    let payload, insert = false, single = false; const filters = {};
    const q = { select() { return q; }, eq(k,v) { filters[k]=v; return q; }, single() { single=true; return q; }, maybeSingle() { single=true; return q; }, insert(v) { payload=v; insert=true; return q; }, upsert(v) { payload=v; return q; },
      then(resolve,reject) { return (async () => {
        const rows = table.includes('profiles') ? db.profiles : db.results;
        if (!payload) { if (db.readHold && table.includes('results')) { db.readStarted?.(); await db.readHold.promise; } const result=rows.filter(x=>Object.entries(filters).every(([k,v])=>x[k]===v)); return {data: single ? result[0] || null : result,error:null}; }
        db.writes.push({table,payload}); if(db.hold) await db.hold.promise;
        if(db.fail && table.includes(db.fail)) return {error:{message:'outage'},status:503};
        const index=rows.findIndex(x=>x.user_id===payload.user_id && (table.includes('profiles') || x.puzzle_date===payload.puzzle_date));
        if(insert && index>=0) return {error:{code:'23505',message:'existing'},status:409};
        const row=table.includes('profiles')?{public_id:'public-player',...payload}:payload;
        if(index>=0)rows[index]=row;else rows.push(row); if (db.loseProfileResponse && table.includes('profiles')) throw new Error('response lost after commit'); return {data:single?row:[row],error:null};
      })().then(resolve,reject); }
    }; return q;
  } };
  let identity = null, clock = instant;
  const auth = { getVerifiedIdentity: () => identity, async sendLink(email, options) { auth.request={email,...options}; }, clearJoinRequest() {} };
  const leaderboard = createLeaderboardController({getClient:()=>client,storeFor,getPuzzle:d=>({date:d,answerSchoolId:'a'}),schoolIds:new Set(['a','b']),now:()=>new Date(clock)});
  const make = () => createOnboardingController({storage,auth,leaderboard,guestStore:storeFor('guest'),ownerStore:()=>storeFor(identity?.userId || 'guest'),now:()=>clock,today:()=>date});
  let onboarding=make();
  return {storage,backing,db,auth,leaderboard,storeFor,make,get onboarding(){return onboarding;},reload(){onboarding=make();},advance(ms){clock+=ms;},verify(userId=A,email='person@example.test',requestId=auth.request?.requestId){identity={userId,email,requestId};leaderboard.setSubject(userId);},clear(){identity=null;leaderboard.setSubject('guest');}};
}

// Break: publishing before verification, dropping the draft on navigation, or importing older dates.
test('prepared_join_survives_callback_reload_and_imports_only_today_once', async () => {
 const s=await setup(); s.storeFor('guest').writeResult({date,answerSchoolId:'a',guessedSchoolIds:['b'],status:'attempted'});
 s.storeFor('guest').writeResult({date:'2026-10-14',answerSchoolId:'a',guessedSchoolIds:['a'],status:'solved'});
 await s.onboarding.request(fields); assert.equal((await s.onboarding.finish()).status,'none'); assert.deepEqual(s.db.writes,[]);
 s.reload(); s.verify(); const joined=await s.onboarding.finish(); assert.equal(joined.status,'joined');
 assert.deepEqual(s.db.profiles.map(x=>[x.user_id,x.display_name,x.school,x.listed]),[[A,'Player','School',true]]);
 assert.deepEqual(s.db.results.map(x=>[x.user_id,x.puzzle_date,x.guessed_school_ids]),[[A,date,['b']]]);
 s.reload(); await s.onboarding.finish(); assert.equal(s.db.writes.length,2); assert.equal(s.onboarding.pending,null);
});
// Break: a name, cached email, wrong request, or a different verified account claims the draft.
test('join_requires_matching_verified_email_request_and_bound_owner', async () => {
 for(const identity of [[A,'other@example.test'],[A,null],[A,'person@example.test','wrong-request']]) {
  const s=await setup(); await s.onboarding.request(fields); s.verify(...identity); assert.equal((await s.onboarding.finish()).status,'none'); assert.deepEqual(s.db.writes,[]);
 }
 const s=await setup(); await s.onboarding.request(fields); s.verify(); s.db.fail='profiles'; await assert.rejects(s.onboarding.finish());
 s.verify(B); s.db.fail=''; assert.equal((await s.onboarding.finish()).status,'none'); assert.deepEqual(s.db.profiles,[]);
});
// Break: preserving an existing hidden profile drops separately consented guest carryover.
test('explicit_join_preserves_existing_fields_and_privacy_and_imports_today', async () => {
 const s=await setup(); s.storeFor('guest').writeResult({date,answerSchoolId:'a',guessedSchoolIds:['a'],status:'solved'});
 await s.onboarding.request(fields); s.verify(); s.db.profiles.push({user_id:A,public_id:'old',display_name:'Existing',school:'Old School',listed:false});
 const result=await s.onboarding.finish(); assert.equal(result.profile.displayName,'Existing'); assert.equal(result.profile.school,'Old School'); assert.equal(result.profile.listed,false);
 assert.deepEqual(s.db.results.map(x=>[x.user_id,x.puzzle_date,x.guessed_school_ids]),[[A,date,['a']]]);
 assert.equal(s.db.writes.filter(x=>x.table.includes('profiles')).length,0); assert.equal(s.onboarding.pending,null);
});
// Break: failures lose fields, duplicate profile creation, or report completion before result persistence.
test('profile_and_result_failures_retry_without_another_link_or_retyping', async () => {
 for(const table of ['profiles','results']) {
 const s=await setup(); s.storeFor('guest').writeResult({date,answerSchoolId:'a',guessedSchoolIds:['a'],status:'solved'});
 await s.onboarding.request(fields); const request=s.auth.request; s.verify(); s.db.fail=table;
 await assert.rejects(s.onboarding.finish()); assert.equal(s.onboarding.pending.displayName,'Player');
 s.reload(); s.verify(A,'person@example.test',null); s.db.fail=''; assert.equal((await s.onboarding.finish()).status,'joined'); assert.equal(s.auth.request,request);
 assert.equal(s.db.profiles.length,1); assert.equal(s.db.results.length,1); assert.equal(s.onboarding.pending,null);
 }
});
// Break: stale draft completions import after signout, replacement, or a second auth event.
test('concurrent_completion_and_account_switch_never_cross_owners', async () => {
 const s=await setup(); await s.onboarding.request(fields); s.verify(); s.db.hold=deferred();
 const first=s.onboarding.finish(), second=s.onboarding.finish();
 while(!s.db.writes.length) await new Promise(r=>setImmediate(r));
 s.verify(B); s.db.hold.resolve(); await assert.rejects(first,{name:'AbortError'}); await assert.rejects(second,{name:'AbortError'});
 assert.equal(s.db.writes.length,1); assert.equal(s.db.writes[0].payload.user_id,A); assert.deepEqual(s.db.results,[]);
});
// Break: expired/corrupt fields or failed storage can still request an unusable link.
test('invalid_expired_and_unpersistable_intents_do_not_join', async () => {
 const s=await setup(); await assert.rejects(s.onboarding.request({...fields,displayName:'  '})); assert.equal(s.auth.request,undefined);
 await s.onboarding.request(fields); s.advance(25*60*60*1000); s.verify(); assert.equal((await s.onboarding.finish()).status,'none'); assert.equal(s.onboarding.pending,null);
 const blocked=await setup(); blocked.backing.setItem=()=>{throw new Error('quota');}; await assert.rejects(blocked.onboarding.request(fields),/storage/i); assert.equal(blocked.auth.request,undefined);
});
// Break: already verified players without profiles must request another link to finish joining.
test('verified_profileless_account_can_join_directly_with_explicit_consent', async () => {
 const s=await setup(); s.verify(); s.onboarding.prepare({displayName:'Already verified',school:''},{active:true});
 assert.equal((await s.onboarding.finish()).status,'joined'); assert.equal(s.auth.request,undefined); assert.equal(s.db.profiles[0].listed,true);
});

// Break: consent to include guest progress replaces today's existing local account game.
test('joining_preserves_owned_daily_progress_ahead_of_guest_import', async () => {
 const s=await setup(); s.verify();
 s.storeFor(A).writeResult({date,answerSchoolId:'a',guessedSchoolIds:['b'],status:'attempted'});
 s.storeFor('guest').writeResult({date,answerSchoolId:'a',guessedSchoolIds:['a'],status:'solved'});
 s.onboarding.prepare({displayName:'Owner'},{active:true}); await s.onboarding.finish();
 assert.deepEqual(s.db.results.map(x=>x.guessed_school_ids),[['b']]);
});

// Break: two tabs sharing an intent race creation and one clears the other's import.
test('two_controllers_sharing_a_join_finish_profile_and_import_once', async () => {
 const s=await setup(); s.storeFor('guest').writeResult({date,answerSchoolId:'a',guessedSchoolIds:['a'],status:'solved'});
 await s.onboarding.request(fields); s.verify(); const other=s.make();
 const results=await Promise.all([s.onboarding.finish(),other.finish()]);
 assert.equal(results.filter(x=>x.status==='joined').length,1);
 assert.equal(s.db.profiles.length,1); assert.equal(s.db.results.length,1);
 assert.equal(s.db.writes.filter(x=>x.table.includes('profiles')).length,1);
 assert.equal(s.db.writes.filter(x=>x.table.includes('results')).length,1);
});

// Break: a confirmation is still valid, but retained details expire after only minutes.
test('retained_join_finishes_hours_later_without_importing_a_new_days_guest_game', async () => {
 const s=await setup(); s.storeFor('guest').writeResult({date,answerSchoolId:'a',guessedSchoolIds:['a'],status:'solved'});
 await s.onboarding.request(fields); s.advance(12*60*60*1000); s.verify();
 assert.equal((await s.onboarding.finish()).status,'joined'); assert.equal(s.db.profiles[0].display_name,'Player'); assert.equal(s.db.results.length,0);
});

// Break: a concurrent existing profile is overwritten, republished, or receives guest progress.
test('profile_created_elsewhere_during_join_keeps_its_fields_and_privacy', async () => {
 const s=await setup(); s.storeFor('guest').writeResult({date,answerSchoolId:'a',guessedSchoolIds:['a'],status:'solved'});
 await s.onboarding.request(fields); s.verify(); s.db.hold=deferred();
 const joining=s.onboarding.finish(); while(!s.db.writes.length) await new Promise(r=>setImmediate(r));
 s.db.profiles.push({user_id:A,public_id:'existing',display_name:'Existing Owner',school:'Original',listed:false});
 s.db.hold.resolve(); const outcome=await joining;
 assert.equal(outcome.status,'existing'); assert.equal(outcome.profile.displayName,'Existing Owner'); assert.equal(outcome.profile.listed,false);
 assert.deepEqual(s.db.results.map(x=>x.guessed_school_ids),[['a']]); assert.equal(s.onboarding.pending,null);
});

// Break: an old save completion erases newer prepared fields or imports after cancellation.
test('replacing_a_pending_join_invalidates_old_async_completion', async () => {
 const s=await setup(); await s.onboarding.request(fields); s.verify(); s.db.hold=deferred();
 const joining=s.onboarding.finish(); while(!s.db.writes.length) await new Promise(r=>setImmediate(r));
 s.onboarding.prepare({displayName:'New consent',school:'New School'},{active:true});
 s.db.hold.resolve(); await assert.rejects(joining,{name:'AbortError'});
 assert.equal(s.onboarding.pending.displayName,'New consent'); assert.equal(s.db.results.length,0);
 s.onboarding.cancel(); assert.equal(s.onboarding.pending,null);
});

// Break: a small device-clock correction between requesting and confirming drops valid details.
test('small_clock_correction_keeps_a_prepared_join_usable', async () => {
 const s=await setup(); await s.onboarding.request(fields); s.advance(-30000); s.verify();
 assert.equal((await s.onboarding.finish()).status,'joined'); assert.equal(s.db.profiles[0].display_name,'Player');
});

// Break: a committed profile whose response is lost causes retry to discard carryover.
test('committed_profile_with_lost_response_retries_consented_game_after_reload', async () => {
 const s=await setup(); s.storeFor('guest').writeResult({date,answerSchoolId:'a',guessedSchoolIds:['a'],status:'solved'});
 await s.onboarding.request(fields); s.verify(); s.db.loseProfileResponse=true;
 await assert.rejects(s.onboarding.finish(),/response lost/); assert.equal(s.db.profiles.length,1); assert.equal(s.onboarding.pending.displayName,'Player');
 s.db.loseProfileResponse=false; s.reload(); s.verify(A,'person@example.test',null);
 await s.onboarding.finish(); assert.equal(s.db.profiles.length,1);
 assert.deepEqual(s.db.results.map(x=>[x.user_id,x.guessed_school_ids]),[[A,['a']]]); assert.equal(s.onboarding.pending,null);
});

// Break: explicit carryover replaces the owner's already-saved game.
test('explicit_join_with_existing_profile_keeps_existing_owner_result', async () => {
 const s=await setup(); s.storeFor('guest').writeResult({date,answerSchoolId:'a',guessedSchoolIds:['a'],status:'solved'});
 s.db.profiles.push({user_id:A,public_id:'old',display_name:'Private Owner',school:'Original',listed:false});
 s.db.results.push({user_id:A,puzzle_date:date,answer_school_id:'a',guessed_school_ids:['b'],status:'attempted'});
 await s.onboarding.request(fields); s.verify(); await s.onboarding.finish();
 assert.deepEqual(s.db.results.map(x=>x.guessed_school_ids),[['b']]); assert.equal(s.db.writes.length,0); assert.equal(s.db.profiles[0].listed,false);
});

// Break: stale consent still queues, receipts, or restores a guest game after an async read.
for (const change of ['cancel','replace']) test(`${change}_during_adoption_read_prevents_all_import_mutations`, async () => {
 const s=await setup(); s.storeFor('guest').writeResult({date,answerSchoolId:'a',guessedSchoolIds:['a'],status:'solved'});
 await s.onboarding.request(fields); s.verify(); const started=deferred(); s.db.readHold=deferred(); s.db.readStarted=started.resolve;
 const work=s.onboarding.finish(); await started.promise;
 if(change==='cancel') s.onboarding.cancel(); else s.onboarding.prepare({displayName:'Replacement',school:''},{active:true});
 s.db.readHold.resolve(); await assert.rejects(work,{name:'AbortError'});
 assert.deepEqual(s.storeFor(A).readPending(),[]); assert.equal(s.storeFor(A).hasGuestImport(date),false);
 assert.deepEqual(s.storeFor(A).readResults(),[]); assert.equal(s.storeFor(A).readProgress(date),null); assert.deepEqual(s.db.results,[]);
 assert.equal(s.onboarding.pending?.displayName ?? null,change==='cancel'?null:'Replacement');
});
