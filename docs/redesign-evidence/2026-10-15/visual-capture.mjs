import { pathToFileURL } from 'node:url';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const root=process.env.CHARTERSCHOODLE_CAPTURE_ROOT || process.cwd();
const { chromium }=await import(pathToFileURL(`${root}/node_modules/playwright/index.mjs`).href);
const out=process.env.CAPTURE_OUT || '/tmp/charterschoodle-redesign-captures';
const base='http://127.0.0.1:4293/';
const schools=JSON.parse(await readFile(`${root}/data/schools.json`,'utf8'));
const puzzles=JSON.parse(await readFile(`${root}/data/puzzles.json`,'utf8')).puzzles;
const answer=schools.find(s=>s.id===puzzles.find(p=>p.date==='2026-10-15').answerSchoolId);
const wrong=schools.find(s=>s.id!==answer.id);
const origin='https://fixture.supabase.invalid', user='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const evidence={fixture:true,base,realSchools:schools.length,captures:[],contexts:[]};
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/home/space/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',headless:true,args:['--no-sandbox']});
async function setup({signed=false,profile=false}={}) {
 const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'America/New_York',reducedMotion:'reduce',ignoreHTTPSErrors:true});
 const page=await context.newPage();
 const fixture={signed,profile,requests:[],blocked:[],errors:[],rankMode:'normal',failSave:false,profiles:profile?[{user_id:user,public_id:'public-fixture',display_name:'Charter Community Member',school:'Example Academy',listed:true}]:[],results:[]};
 evidence.contexts.push(fixture);
 page.on('pageerror',error=>fixture.errors.push(error.message));
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.hostname==='127.0.0.1') {
   if(url.pathname==='/src/supabase-config.js') return route.fulfill({contentType:'text/javascript',body:`window.CHARTERSCHOOLDLE_SUPABASE={url:${JSON.stringify(origin)},anonKey:'sb_publishable_fixture',leaderboardEnabled:true,publicUrl:${JSON.stringify(base)}};`});
   return route.continue();
  }
  if(url.origin===origin) {
   const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,OPTIONS'};
   const reply=(json,status=200)=>route.fulfill({status,json,headers});
   if(req.method()==='OPTIONS') return route.fulfill({status:204,headers});
   const path=url.pathname;fixture.requests.push({path,method:req.method()});
   if(path==='/auth/v1/user') return reply({id:user,email:'fixture@example.test'});
   if(path==='/auth/v1/token') return reply({access_token:'fixture-token',refresh_token:'fixture-refresh',expires_in:3600,token_type:'bearer',user:{id:user,email:'fixture@example.test'}});
   if(path==='/auth/v1/otp'||path==='/auth/v1/logout') return reply({});
   if(path.endsWith('/charterschoodle_leaderboard_page_v2')) {
    const params=req.postDataJSON();
    if(fixture.rankMode==='error') return reply({message:'Fixture unavailable'},503);
    if(fixture.rankMode==='empty') return reply({rows:[],total:0,page:1,pageSize:5});
    const names=['North Carolina Charter School Community Member','Charter Community Member','School Staff Member','Education Partner','Charter Friend'];
    return reply({rows:names.map((name,i)=>({publicId:i===1?'public-fixture':`public-${i}`,displayName:name,school:i===0?'A North Carolina charter school and community partner':i%2?'Example Academy':'',rank:i+1,points:42-i*6,played:8-i,solved:7-i,winStreak:4-i%4,attemptStreak:5-i,average:2.4+i*.2})),total:5,page:params.p_page,pageSize:5});
   }
   if(path.endsWith('/charterschoodle_profiles_v2')||path.endsWith('/charterschoodle_results_v2')) {
    const isProfile=path.endsWith('profiles_v2'),values=isProfile?fixture.profiles:fixture.results;
    if(req.method()==='POST') {
     if(fixture.failSave&&isProfile)return reply({message:'Fixture save unavailable'},503);
     const data=req.postDataJSON();
     if(isProfile) {if(!values.length) values.push({public_id:'public-fixture',...data});}
     else { const row=values.findIndex(x=>x.puzzle_date===data.puzzle_date);if(row<0)values.push(data);else values[row]=data; }
     return reply(req.headers().accept?.includes('object')?values[0]:values);
    }
    if(req.method()==='PATCH') {Object.assign(values[0],req.postDataJSON());return reply(values[0]);}
    const owner=url.searchParams.get('user_id')?.replace('eq.','');
    let rows=values.filter(x=>!owner||x.user_id===owner);
    const date=url.searchParams.get('puzzle_date')?.replace('eq.','');
    if(date)rows=rows.filter(x=>x.puzzle_date===date);
    const offset=Number(url.searchParams.get('offset')||0);
    rows=rows.slice(offset,offset+500);
    return reply(req.headers().accept?.includes('object')?(rows[0]||null):rows);
   }
   fixture.blocked.push({url:url.href,method:req.method(),unexpectedFixture:true});return route.abort();
  }
  if(/^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname))return route.continue();
  fixture.blocked.push({url:url.href,method:req.method()});return route.abort();
 });
 if(signed)await page.addInitScript(user=>localStorage.setItem('charterschoodle-auth:v2',JSON.stringify({access_token:'fixture-token',refresh_token:'fixture-refresh',expires_at:1999999999,token_type:'bearer',user:{id:user,email:'fixture@example.test'}})),user);
 await page.clock.install({time:new Date('2026-10-15T16:00:00Z')});
 await page.goto(base);
 await page.waitForFunction(()=>document.querySelector('#school-guess')&&!document.querySelector('#school-guess').disabled);
 await page.evaluate(()=>document.fonts.ready);
 return {page,context,fixture};
}
async function capture(page,name,width=390,{height=900,dialog=false}={}) {
 await page.setViewportSize({width,height});
 await page.evaluate(()=>scrollTo(0,0));
 await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:`${out}/${name}.png`,fullPage:!dialog});
 const metrics=await page.evaluate(()=>{
  const rect=el=>{if(!el)return null;const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom};};
  const visible=el=>el&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden';
  return {viewport:{width:innerWidth,height:innerHeight},pageHeight:document.documentElement.scrollHeight,scrollWidth:document.documentElement.scrollWidth,fontLoaded:document.fonts.check('16px "Open Sans"'),scrollY,guess:rect(document.querySelector('#guess-form')),activeClue:rect(document.querySelector('#active-clue')||document.querySelector('.active-clue')),map:rect(document.querySelector('.nc-map-frame')),account:document.querySelector('#account-status')?.textContent,openDialogs:[...document.querySelectorAll('dialog[open]')].map(el=>({id:el.id,rect:rect(el),scrollHeight:el.scrollHeight,clientHeight:el.clientHeight})),visibleButtons:[...document.querySelectorAll('button')].filter(visible).map(el=>({text:el.getAttribute('aria-label')||el.textContent.trim(),...rect(el)}))};
 });
 evidence.captures.push({name,...metrics});
}
async function guess(page,school){await page.getByLabel('Guess the school',{exact:true}).fill(school.officialName);await page.locator('#autocomplete-list [data-school-id]').first().click();await page.getByRole('button',{name:'Submit',exact:true}).click();}
async function mode(page,name){await page.getByRole('button',{name,exact:true}).click();}
async function join(page,name='Charter Community Member'){
 await mode(page,'Join leaderboard');
 await page.getByLabel('Your display name',{exact:true}).fill(name);
 await page.getByLabel('Your school or organization (optional)',{exact:true}).fill('Example Academy');
 await page.getByLabel('Email address',{exact:true}).fill('fixture@example.test');
}
try {
 if(process.env.RUN_CAPTURE!=='1')throw new Error('Use RUN_CAPTURE=1 only after full implementation');
 const guest=await setup(),p=guest.page;
 for(const width of [1440,768,390,320])await capture(p,width===1440?'desktop':width===390?'mobile':`guest-${width}`,width,{height:width===1440?1000:900});
 await guess(p,wrong);await capture(p,'wrong-390');
 await mode(p,'Leaderboard');await p.locator('.leaderboard-entry').first().waitFor();
 for(const width of [1440,390,320])await capture(p,`rankings-${width}`,width,{height:width===1440?1000:900});
 await p.locator('.leaderboard-entry summary').first().click();await capture(p,'rankings-details-390');
 await mode(p,'Win Streak');await p.waitForFunction(()=>document.querySelector('.ranking-metric')?.textContent.toLowerCase().includes('win streak'));await capture(p,'rankings-streak-390');
 await join(p);
 await capture(p,'join-390',390,{dialog:true});await capture(p,'join-320',320,{dialog:true});
 await p.locator('#email-submit').click();await p.waitForFunction(()=>document.querySelector('#email-status').textContent.toLowerCase().includes('check your email'));
 await capture(p,'check-email-390',390,{dialog:true});
 await p.goto(`${base}?code=fixture-confirmation`);await p.waitForFunction(()=>/joined|ready/i.test(document.querySelector('#account-status').textContent));
 await p.waitForFunction(()=>document.querySelector('#guess-counter').textContent.includes('1 / 6'));
 await capture(p,'join-ready-390');
 await mode(p,'Edit profile');await capture(p,'profile-390',390,{dialog:true});await p.keyboard.press('Escape');
 await mode(p,'Daily Puzzle');await guess(p,answer);await p.locator('#win-overlay[open]').waitFor();await capture(p,'result-390',390,{dialog:true});await p.keyboard.press('Escape');
 await mode(p,'How to play');await capture(p,'help-390',390,{dialog:true});await p.keyboard.press('Escape');
 await mode(p,'Past Puzzles');await capture(p,'archive-390');
 await mode(p,'Map');await p.locator('.nc-map-frame').waitFor();
 await capture(p,'map-1440',1440,{height:1000});await capture(p,'map-390');
 await p.locator('#map-search').fill(schools[1].officialName);await p.locator('#map-results button').first().focus();await p.keyboard.press('Enter');await p.locator('#map-selection-title').waitFor();await capture(p,'map-selected-390');
 await p.locator('#map-search').fill('NoSuchSchool');await p.waitForFunction(()=>/no schools/i.test(document.querySelector('#map-result-status').textContent));await capture(p,'map-no-results-390');
 guest.fixture.rankMode='empty';await mode(p,'Leaderboard');await p.waitForFunction(()=>/no public|first/i.test(document.querySelector('#leaderboard-body').textContent));await capture(p,'rankings-empty-390');
 guest.fixture.rankMode='error';await mode(p,'Daily Puzzle');await mode(p,'Leaderboard');await p.waitForFunction(()=>/unavailable/i.test(document.querySelector('#leaderboard-body').textContent));await capture(p,'rankings-unavailable-390');
 await guest.context.close();
 const retry=await setup(),r=retry.page;
 await guess(r,wrong);await join(r,'Retained Player');await r.locator('#email-submit').click();await r.waitForFunction(()=>/check your email/i.test(document.querySelector('#email-status').textContent));
 retry.fixture.failSave=true;await r.goto(`${base}?code=fixture-confirmation`);await r.waitForFunction(()=>/could not finish|could not load/i.test(document.querySelector('#account-status').textContent));await capture(r,'join-retry-390');
 retry.fixture.failSave=false;await mode(r,'Retry account sync');await r.waitForFunction(()=>/joined|ready/i.test(document.querySelector('#account-status').textContent));
 await r.setViewportSize({width:320,height:900});await r.addStyleTag({content:'html{font-size:200% !important}'});await capture(r,'text-200-percent-320',320);
 await retry.context.close();
 if(evidence.contexts.some(x=>x.errors.length||x.blocked.some(y=>y.unexpectedFixture||/supabase/.test(y.url))))throw new Error('Capture safety/page-error failure; see evidence');
 console.log(JSON.stringify({captures:evidence.captures.map(x=>({name:x.name,viewport:x.viewport,scrollWidth:x.scrollWidth,fontLoaded:x.fontLoaded,guess:x.guess,activeClue:x.activeClue,map:x.map})),fixtureRequests:evidence.contexts.map(x=>x.requests),errors:evidence.contexts.flatMap(x=>x.errors)},null,2));
} finally {
 await writeFile(`${out}/evidence.json`,JSON.stringify(evidence,null,2)+'\n');
 await browser.close();
}
