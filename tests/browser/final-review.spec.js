import { test, expect, schools, today, userA, accountFixture } from './fixtures.js';

test('enlarged_text_reflows_brand_navigation_header_and_feedback_at_320', async ({page,game}) => {
  await page.setViewportSize({width:320,height:900});
  await game.open(); await page.evaluate(()=>document.documentElement.style.fontSize='200%');
  await game.guess(schools[1]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  const labels=page.locator('h1, .mode-button, .puzzle-title, #guess-summary, #attempt-progress li, .round-feedback > div');
  for (const el of await labels.all()) {
    const geometry=await el.evaluate(node=>{
      const box=node.getBoundingClientRect();
      const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);
      const rects=[];
      while(walker.nextNode()) {
        const text=walker.currentNode;
        if(!text.textContent.trim()||text.parentElement.closest('.sr-only'))continue;
        const range=document.createRange();range.selectNodeContents(text);
        rects.push(...[...range.getClientRects()].filter(rect=>rect.width&&rect.height));
      }
      return {fits:node.scrollWidth<=node.clientWidth+1,inside:rects.every(r=>r.left>=box.left-1&&r.right<=box.right+1),left:box.left,right:box.right};
    });
    expect(geometry.fits).toBe(true); expect(geometry.inside).toBe(true);
    expect(geometry.left).toBeGreaterThanOrEqual(0); expect(geometry.right).toBeLessThanOrEqual(320);
  }
  const buttons=await page.locator('[data-mode]').evaluateAll(nodes=>nodes.map(n=>{const b=n.getBoundingClientRect();return{x:b.x,y:b.y,r:b.right,b:b.bottom};}));
  for(let i=0;i<buttons.length;i++)for(let j=i+1;j<buttons.length;j++) {
    const a=buttons[i],b=buttons[j];expect(a.r<=b.x||b.r<=a.x||a.b<=b.y||b.b<=a.y).toBe(true);
  }
});

for (const scenario of [
  {name:'public',options:{listed:true},expected:/play today.*first score/i,forbidden:/join the leaderboard/i},
  {name:'private',options:{listed:false},expected:/edit profile.*public|public.*edit profile/i,forbidden:/join the leaderboard/i},
  {name:'guest',options:{user:null,existing:false},expected:/join the leaderboard/i},
  {name:'profileless',options:{existing:false},expected:/join the leaderboard/i},
]) test(`empty_rankings_guidance_matches_${scenario.name}_account`,async({page,game})=>{
  const fixture=await accountFixture(page,game,scenario.options);
  await page.route('**/rest/v1/rpc/charterschoodle_leaderboard_page_v2',route=>route.fulfill({json:{rows:[],total:0,page:1,pageSize:5}}));
  await game.open();
  await expect(page.locator('#account-button')).toBeEnabled();
  if(scenario.name==='public'||scenario.name==='private')await expect(page.locator('#account-button')).toHaveText('Edit profile');
  await page.getByRole('button',{name:'Leaderboard',exact:true}).click();
  await expect(page.locator('.leaderboard-empty')).toContainText(scenario.expected);
  if(scenario.forbidden)await expect(page.locator('.leaderboard-empty')).not.toContainText(scenario.forbidden);
  fixture.assertSafe();
});

test('direct_verified_join_refreshes_the_open_rankings_after_guest_import',async({page,game})=>{
  const fixture=await accountFixture(page,game,{existing:false});
  await page.addInitScript(({date,id})=>localStorage.setItem('charterschoodle:v2:guest:results',JSON.stringify([{date,answerSchoolId:id,guessedSchoolIds:[id],status:'solved'}])),{date:today,id:schools[0].id});
  await page.route('**/rest/v1/rpc/charterschoodle_leaderboard_page_v2',route=>{
    const profile=fixture.state.profiles.find(p=>p.user_id===userA&&p.listed);
    const result=fixture.state.history.find(r=>r.user_id===userA);
    const rows=profile&&result?[{publicId:profile.public_id,displayName:profile.display_name,school:profile.school,rank:1,points:7-result.guessed_school_ids.length,played:1,solved:1,winStreak:1,attemptStreak:1,average:1}]:[];
    return route.fulfill({json:{rows,total:rows.length,page:1,pageSize:5}});
  });
  await game.open(); await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Leaderboard',exact:true}).click();
  await expect(page.locator('.leaderboard-empty')).toContainText('No public scores yet');
  await page.locator('#account-button').click();
  await page.getByLabel('Your display name',{exact:true}).fill('New Community Player');
  await page.locator('#email-submit').click();
  await expect(page.locator('#account-button')).toHaveText('Edit profile');
  await expect.poll(()=>fixture.state.history.length).toBe(1);
  await expect(page.locator('.leaderboard-entry')).toContainText('New Community Player');
  await expect(page.locator('.ranking-metric')).toContainText('6');
  expect(fixture.state.sent.filter(x=>x.path.endsWith('/otp'))).toEqual([]);fixture.assertSafe();
});

test('feedback_help_and_map_use_drawn_decorative_icons_with_text_labels',async({page,game})=>{
  await game.open(); await game.guess(schools[1]);
  for(const icon of await page.locator('.round-feedback .board-icon').all()) {
    await expect(icon.locator('svg')).toHaveAttribute('aria-hidden','true');
    await expect(icon.locator('svg path, svg circle, svg line, svg g')).not.toHaveCount(0);
    expect(await icon.textContent()).toBe('');
  }
  await expect(page.getByRole('group',{name:'Round 1 feedback'})).toContainText('Wrong school');
  await page.getByRole('button',{name:'How to play',exact:true}).click();
  for(const text of ['Same band','Same span']) {
    const key=page.locator('.key-row').filter({hasText:text});
    await expect(key.locator('svg')).toBeVisible(); await expect(key).toContainText(text);
  }
  await page.keyboard.press('Escape'); await page.getByRole('button',{name:'Map',exact:true}).click();
  for(const name of ['Zoom in','Zoom out','Reset map view'])await expect(page.getByRole('button',{name,exact:true}).locator('svg')).toHaveAttribute('aria-hidden','true');
});
