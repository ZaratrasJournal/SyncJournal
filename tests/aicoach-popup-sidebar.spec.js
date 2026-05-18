// v12.148 — Popup chat-history sidebar (collapsible, links in popup).
// Verifieert:
//  - Sidebar default zichtbaar bij eerste open (popup width 560px)
//  - ☰ toggle verbergt sidebar (width terug naar 420px)
//  - Klik op chat-item in sidebar switcht active chat
//  - Delete-knop in sidebar verwijdert chat (met confirm)
//  - localStorage persist toggle-state (tj_ai_popup_history)
const{test,expect}=require('@playwright/test');
const path=require('path');
const FILE_URL='file:///'+path.resolve(__dirname,'../work/tradejournal.html').replace(/\\/g,'/');

async function seedPopup(page,chats){
  await page.addInitScript(({chats})=>{
    localStorage.setItem('tj_welcomed','1');
    localStorage.setItem('tj_ai_flag','1');
    localStorage.removeItem('tj_ai_popup_history'); // start met default
    const now=new Date();
    const monthKey=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
    localStorage.setItem('tj_ai_config',JSON.stringify({
      enabled:true,
      byok:{key:"sk-ant-test",model:"claude-sonnet-4-6",connected:true,lastTest:Date.now(),lastError:""},
      features:{pretrade:true,budget:true,weekly:true,privacy:false,floatingChat:true},
      budget:{monthlyLimit:5,alertThreshold:0.8,spent:0,lastResetMonth:monthKey},
      weekly:{dayOfWeek:1,autoTrigger:true,lastGeneratedAt:0}
    }));
    localStorage.setItem('tj_ai_chats',JSON.stringify(chats||[]));
  },{chats});
}

const TWO_CHATS=[
  {id:'c1',title:'CHAT-EEN-MARKER',createdAt:Date.now()-2000,updatedAt:Date.now()-2000,
   messages:[{role:'user',content:'eerste',ts:Date.now()-2000},
             {role:'assistant',content:'antwoord-een',cost:0.005,ts:Date.now()-1500}]},
  {id:'c2',title:'CHAT-TWEE-MARKER',createdAt:Date.now()-1000,updatedAt:Date.now()-1000,
   messages:[{role:'user',content:'tweede',ts:Date.now()-1000},
             {role:'assistant',content:'antwoord-twee',cost:0.007,ts:Date.now()-500}]}
];

test('sidebar default zichtbaar bij open + toont chat-historie',async({page})=>{
  await seedPopup(page,TWO_CHATS);
  await page.goto(FILE_URL+'?ai=1',{waitUntil:'networkidle'});
  await page.waitForTimeout(400);
  await page.click('button[aria-label="Open chat"]');
  await page.waitForTimeout(200);

  // Popup is 560px breed (met sidebar)
  const popupWidth=await page.evaluate(()=>{
    const fab=document.querySelector('button[aria-label="Sluit chat"]');
    const popup=fab&&fab.nextElementSibling||document.querySelector('div[style*="position: fixed"][style*="z-index: 997"]')||document.querySelector('div[style*="560px"]');
    if(popup)return popup.getBoundingClientRect().width;
    return null;
  });
  expect(popupWidth).toBeGreaterThan(540);
  expect(popupWidth).toBeLessThan(580);

  // Sidebar bevat beide chat-titles
  const sidebarText=await page.evaluate(()=>{
    const aside=document.querySelector('div[style*="z-index: 997"] aside');
    return aside?aside.textContent:null;
  });
  expect(sidebarText).toContain('CHAT-EEN-MARKER');
  expect(sidebarText).toContain('CHAT-TWEE-MARKER');
});

test('☰ toggle verbergt sidebar + width shrinkt naar 420px',async({page})=>{
  await seedPopup(page,TWO_CHATS);
  await page.goto(FILE_URL+'?ai=1',{waitUntil:'networkidle'});
  await page.waitForTimeout(400);
  await page.click('button[aria-label="Open chat"]');
  await page.waitForTimeout(200);

  // Klik ☰ toggle
  await page.click('button[aria-label="Toggle chat-historie"]');
  await page.waitForTimeout(250); // wacht op transition

  const widthAfter=await page.evaluate(()=>{
    const popup=document.querySelector('div[style*="z-index: 997"]');
    return popup?popup.getBoundingClientRect().width:null;
  });
  expect(widthAfter).toBeGreaterThan(400);
  expect(widthAfter).toBeLessThan(440);

  // Sidebar weg
  const aside=await page.locator('div[style*="z-index: 997"] aside').count();
  expect(aside).toBe(0);

  // localStorage persist
  const persisted=await page.evaluate(()=>localStorage.getItem('tj_ai_popup_history'));
  expect(persisted).toBe('0');
});

test('klik chat-item in sidebar → switch active',async({page})=>{
  await seedPopup(page,TWO_CHATS);
  await page.goto(FILE_URL+'?ai=1',{waitUntil:'networkidle'});
  await page.waitForTimeout(400);
  await page.click('button[aria-label="Open chat"]');
  await page.waitForTimeout(200);

  // Default actieve = chat 0 (eerste in array), maar onze localStorage volgorde
  // had c1 eerst. Pak laatste assistant-msg uit main pane.
  let mainText=await page.evaluate(()=>{
    const main=document.querySelector('div[style*="z-index: 997"] main');
    return main?main.textContent:null;
  });
  expect(mainText).toContain('antwoord-een');

  // Klik op chat 2 in sidebar
  await page.evaluate(()=>{
    const aside=document.querySelector('div[style*="z-index: 997"] aside');
    const items=Array.from(aside.querySelectorAll('div[style*="cursor"]'));
    const target=items.find(d=>/CHAT-TWEE-MARKER/.test(d.textContent));
    if(target)target.click();
  });
  await page.waitForTimeout(200);

  mainText=await page.evaluate(()=>{
    const main=document.querySelector('div[style*="z-index: 997"] main');
    return main?main.textContent:null;
  });
  expect(mainText).toContain('antwoord-twee');
  expect(mainText).not.toContain('antwoord-een');
});

test('delete chat via sidebar ✕ knop',async({page})=>{
  await seedPopup(page,TWO_CHATS);
  await page.goto(FILE_URL+'?ai=1',{waitUntil:'networkidle'});
  await page.waitForTimeout(400);
  page.on('dialog',d=>d.accept());
  await page.click('button[aria-label="Open chat"]');
  await page.waitForTimeout(200);

  await page.evaluate(()=>{
    const aside=document.querySelector('div[style*="z-index: 997"] aside');
    const delBtn=Array.from(aside.querySelectorAll('button')).find(b=>b.title==='Verwijder');
    if(delBtn)delBtn.click();
  });
  await page.waitForTimeout(300);

  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('tj_ai_chats')||'[]'));
  expect(stored.length).toBe(1);
});

test('toggle-state is persistent over re-open',async({page})=>{
  await seedPopup(page,TWO_CHATS);
  await page.goto(FILE_URL+'?ai=1',{waitUntil:'networkidle'});
  await page.waitForTimeout(400);
  await page.click('button[aria-label="Open chat"]');
  await page.waitForTimeout(200);
  // Verberg sidebar
  await page.click('button[aria-label="Toggle chat-historie"]');
  await page.waitForTimeout(200);
  // Sluit popup
  await page.click('button[aria-label="Sluit chat-popup"]');
  await page.waitForTimeout(150);
  // Open opnieuw
  await page.click('button[aria-label="Open chat"]');
  await page.waitForTimeout(200);
  // Sidebar nog steeds verborgen
  const aside=await page.locator('div[style*="z-index: 997"] aside').count();
  expect(aside).toBe(0);
});
