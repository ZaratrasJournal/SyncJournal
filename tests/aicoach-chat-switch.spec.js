// v12.142 debug — Reproduceer: kan ik tussen chats switchen via sidebar-click?
const{test,expect}=require('@playwright/test');
const path=require('path');
const FILE_URL='file:///'+path.resolve(__dirname,'../work/tradejournal.html').replace(/\\/g,'/');

test('klik op andere chat in sidebar → activeId verandert + main pane toont juiste msgs',async({page})=>{
  const c1={id:'c1',title:'eerste chat',createdAt:Date.now()-2000,updatedAt:Date.now()-2000,
    messages:[{role:'user',content:'EERSTE-VRAAG-MARKER',ts:Date.now()-2000},
              {role:'assistant',content:'eerste antwoord',cost:0.005,ts:Date.now()-1500}]};
  const c2={id:'c2',title:'tweede chat',createdAt:Date.now()-1000,updatedAt:Date.now()-1000,
    messages:[{role:'user',content:'TWEEDE-VRAAG-MARKER',ts:Date.now()-1000},
              {role:'assistant',content:'tweede antwoord',cost:0.007,ts:Date.now()-500}]};
  await page.addInitScript(({c1,c2})=>{
    localStorage.setItem('tj_welcomed','1');
    localStorage.setItem('tj_ai_flag','1');
    const now=new Date();
    const monthKey=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
    localStorage.setItem('tj_ai_config',JSON.stringify({
      enabled:true,
      byok:{key:"sk-ant-test",model:"claude-sonnet-4-6",connected:true,lastTest:Date.now(),lastError:""},
      features:{pretrade:true,budget:true,weekly:true,privacy:false},
      budget:{monthlyLimit:5,alertThreshold:0.8,spent:0,lastResetMonth:monthKey},
      weekly:{dayOfWeek:1,autoTrigger:true,lastGeneratedAt:0}
    }));
    localStorage.setItem('tj_ai_chats',JSON.stringify([c1,c2]));
  },{c1,c2});

  await page.goto(FILE_URL+'?ai=1',{waitUntil:'networkidle'});
  await page.waitForTimeout(400);
  await page.evaluate(()=>{
    const btns=Array.from(document.querySelectorAll('.tj-tabs button.tj-tab'));
    const b=btns.find(b=>b.textContent.includes('AI-coach'));
    if(b)b.click();
  });
  await page.waitForTimeout(300);
  await page.evaluate(()=>{
    const el=document.getElementById('sec-chat');
    if(el)el.scrollIntoView({block:'start'});
  });

  // First chat is active by default — verify
  let mainText=await page.locator('#sec-chat main').textContent();
  expect(mainText).toMatch(/EERSTE-VRAAG-MARKER/);
  expect(mainText).not.toMatch(/TWEEDE-VRAAG-MARKER/);

  // Klik op chat 2 in sidebar — gebruik de tweede sidebar item (eerste is active)
  await page.evaluate(()=>{
    const sidebar=document.querySelector('#sec-chat aside');
    const items=Array.from(sidebar.querySelectorAll('div[style*="cursor"]'));
    // Find the one with "tweede chat" text
    const target=items.find(d=>/tweede chat/.test(d.textContent));
    if(target)target.click();
  });
  await page.waitForTimeout(300);

  mainText=await page.locator('#sec-chat main').textContent();
  expect(mainText).toMatch(/TWEEDE-VRAAG-MARKER/);
  expect(mainText).not.toMatch(/EERSTE-VRAAG-MARKER/);
});
