// v12.146 — Floating chat popup: FAB rechtsonder + popup window.
// Verifieert:
//  - FAB verschijnt alleen bij IS_AI + master + features.floatingChat
//  - FAB verborgen wanneer feature uit
//  - FAB werkt op WILLEKEURIGE pagina (Dashboard, Trades, etc.) — niet alleen AI-coach
//  - Klik FAB → popup opent met header + dropdown + chat-pane + input
//  - Send-message flow werkt vanuit popup (deelt storage met ChatSection)
//  - Sluit-knop sluit popup
const{test,expect}=require('@playwright/test');
const path=require('path');
const FILE_URL='file:///'+path.resolve(__dirname,'../work/tradejournal.html').replace(/\\/g,'/');

async function seedPopup(page,opts){
  const{floatingChat=true,enabled=true}=opts||{};
  await page.addInitScript(({floatingChat,enabled})=>{
    localStorage.setItem('tj_welcomed','1');
    localStorage.setItem('tj_ai_flag','1');
    const now=new Date();
    const monthKey=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
    localStorage.setItem('tj_ai_config',JSON.stringify({
      enabled:enabled,
      byok:{key:"sk-ant-test",model:"claude-sonnet-4-6",connected:true,lastTest:Date.now(),lastError:""},
      features:{pretrade:true,budget:true,weekly:true,privacy:false,floatingChat:floatingChat},
      budget:{monthlyLimit:5,alertThreshold:0.8,spent:0,lastResetMonth:monthKey},
      weekly:{dayOfWeek:1,autoTrigger:true,lastGeneratedAt:0}
    }));
    localStorage.setItem('tj_ai_chats',JSON.stringify([]));
  },{floatingChat,enabled});
}

test('FAB zichtbaar op Dashboard wanneer feature aan',async({page})=>{
  await seedPopup(page);
  await page.goto(FILE_URL+'?ai=1',{waitUntil:'networkidle'});
  await page.waitForTimeout(400);
  // Default tab is dashboard
  const fab=await page.locator('button[aria-label="Open chat"]').count();
  expect(fab).toBe(1);
});

test('FAB verborgen wanneer features.floatingChat uit',async({page})=>{
  await seedPopup(page,{floatingChat:false});
  await page.goto(FILE_URL+'?ai=1',{waitUntil:'networkidle'});
  await page.waitForTimeout(400);
  const fab=await page.locator('button[aria-label="Open chat"]').count();
  expect(fab).toBe(0);
});

test('FAB verborgen wanneer master uit',async({page})=>{
  await seedPopup(page,{enabled:false});
  await page.goto(FILE_URL+'?ai=1',{waitUntil:'networkidle'});
  await page.waitForTimeout(400);
  const fab=await page.locator('button[aria-label="Open chat"]').count();
  expect(fab).toBe(0);
});

test('FAB verborgen wanneer ?ai=1 niet aan',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('tj_welcomed','1');
    // Geen tj_ai_flag set
    localStorage.setItem('tj_ai_config',JSON.stringify({
      enabled:true,
      byok:{key:"sk-ant-test"},
      features:{floatingChat:true}
    }));
  });
  await page.goto(FILE_URL,{waitUntil:'networkidle'});
  await page.waitForTimeout(400);
  const fab=await page.locator('button[aria-label="Open chat"]').count();
  expect(fab).toBe(0);
});

test('klik FAB → popup opent + send-flow werkt',async({page})=>{
  await seedPopup(page);
  await page.route('https://api.anthropic.com/v1/messages',(route)=>{
    route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      content:[{type:"text",text:"POPUP-RESPONSE-MARKER"}],
      usage:{input_tokens:100,output_tokens:20}
    })});
  });
  await page.goto(FILE_URL+'?ai=1',{waitUntil:'networkidle'});
  await page.waitForTimeout(400);

  // Klik FAB
  await page.click('button[aria-label="Open chat"]');
  await page.waitForTimeout(200);

  // Popup zichtbaar: textarea aanwezig (popup heeft eigen textarea)
  const popupTextarea=await page.locator('textarea[placeholder*="Typ je vraag"]').count();
  expect(popupTextarea).toBeGreaterThanOrEqual(1);

  // Verstuur vraag via popup
  await page.evaluate(()=>{
    // Find the LAATSTE textarea (popup is laatst gemount, sectie staat boven)
    const tas=document.querySelectorAll('textarea[placeholder*="Typ je vraag"]');
    const ta=tas[tas.length-1];
    const setter=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;
    setter.call(ta,'vraag-uit-popup');
    ta.dispatchEvent(new Event('input',{bubbles:true}));
    // De ↑ verstuur-knop is broer van textarea
    const btn=ta.parentElement.querySelector('button');
    btn.click();
  });
  // Wacht op response
  await page.waitForFunction(()=>document.body.textContent.includes('POPUP-RESPONSE-MARKER'),{timeout:5000});

  // Storage: 1 chat, 2 messages
  const chats=await page.evaluate(()=>JSON.parse(localStorage.getItem('tj_ai_chats')||'[]'));
  expect(chats.length).toBe(1);
  expect(chats[0].messages.length).toBe(2);
  expect(chats[0].messages[0].content).toBe('vraag-uit-popup');
  expect(chats[0].messages[1].content).toContain('POPUP-RESPONSE-MARKER');

  await page.screenshot({path:'tests/screenshots/aicoach-popup.png',fullPage:false});

  // Sluit popup
  await page.click('button[aria-label="Sluit chat-popup"]');
  await page.waitForTimeout(150);
  // Popup-textarea is weg
  const taAfterClose=await page.locator('textarea[placeholder*="Typ je vraag"]').count();
  expect(taAfterClose).toBe(0);
});

test('FAB beschikbaar op Trades-tab (overal in app)',async({page})=>{
  await seedPopup(page);
  await page.goto(FILE_URL+'?ai=1',{waitUntil:'networkidle'});
  await page.waitForTimeout(400);
  // Switch naar Trades tab
  await page.evaluate(()=>{
    const b=Array.from(document.querySelectorAll('.tj-tabs button.tj-tab')).find(b=>b.textContent.includes('Trades'));
    if(b)b.click();
  });
  await page.waitForTimeout(200);
  // FAB nog steeds zichtbaar
  const fab=await page.locator('button[aria-label="Open chat"]').count();
  expect(fab).toBe(1);
});
