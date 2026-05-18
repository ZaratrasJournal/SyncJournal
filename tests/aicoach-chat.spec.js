// v12.139 — Multi-turn chat tests. Verifieert:
//  - ChatSection rendert empty-state wanneer geen active chat
//  - "Nieuwe chat" maakt een conversation in tj_ai_chats
//  - Send message → user-msg meteen zichtbaar → API call → assistant-msg gerendered
//  - Multi-turn: 2e message stuurt VOLLEDIGE history mee
//  - Cost-tracking per assistant message + recordAICost write
//  - Auto-title vanaf eerste user message (max 60 chars)
//  - Delete-knop verwijdert chat uit storage
const{test,expect}=require('@playwright/test');
const path=require('path');
const FILE_URL='file:///'+path.resolve(__dirname,'../work/tradejournal.html').replace(/\\/g,'/');

const mockReply=(text)=>({
  id:"msg_chat",
  type:"message",
  role:"assistant",
  model:"claude-sonnet-4-6",
  content:[{type:"text",text:text}],
  usage:{input_tokens:600,output_tokens:120}
});

async function seedChat(page,opts){
  const{enabled=true,chats=[]}=opts||{};
  await page.addInitScript(({enabled,chats})=>{
    localStorage.setItem('tj_welcomed','1');
    localStorage.setItem('tj_ai_flag','1');
    const now=new Date();
    const monthKey=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
    localStorage.setItem('tj_ai_config',JSON.stringify({
      enabled:enabled,
      byok:{key:"sk-ant-test",model:"claude-sonnet-4-6",connected:true,lastTest:Date.now(),lastError:""},
      features:{pretrade:true,budget:true,weekly:true,privacy:false},
      budget:{monthlyLimit:5,alertThreshold:0.8,spent:0,lastResetMonth:monthKey},
      weekly:{dayOfWeek:1,autoTrigger:true,lastGeneratedAt:0}
    }));
    localStorage.setItem('tj_ai_chats',JSON.stringify(chats));
  },{enabled,chats});
}

async function gotoChat(page){
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
  await page.waitForTimeout(200);
}

test.describe('AI-coach multi-turn chat',()=>{

  test('empty state + nieuwe chat-knop werkt',async({page})=>{
    await seedChat(page,{chats:[]});
    await gotoChat(page);
    const txt=await page.locator('#sec-chat').textContent();
    expect(txt).toMatch(/Nog geen conversaties|Nieuwe chat/);
    // Klik nieuwe chat
    await page.evaluate(()=>{
      const sec=document.getElementById('sec-chat');
      const btns=Array.from(sec.querySelectorAll('button'));
      const b=btns.find(b=>/Nieuwe chat/i.test(b.textContent));
      if(b)b.click();
    });
    await page.waitForTimeout(200);
    const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('tj_ai_chats')||'[]'));
    expect(stored.length).toBe(1);
    expect(stored[0].title).toBe('Nieuwe chat');
  });

  test('send message → user toont + API → assistant rendert + cost tracked',async({page})=>{
    await seedChat(page,{chats:[]});
    let captured=null;
    await page.route('https://api.anthropic.com/v1/messages',async(route,req)=>{
      captured=JSON.parse(req.postData()||'{}');
      route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(mockReply("Mijn antwoord op je vraag is helder en bondig."))});
    });
    await gotoChat(page);
    // Maak chat
    await page.evaluate(()=>{
      const sec=document.getElementById('sec-chat');
      const b=Array.from(sec.querySelectorAll('button')).find(b=>/Nieuwe chat/i.test(b.textContent));
      if(b)b.click();
    });
    await page.waitForTimeout(150);
    // Type message
    await page.evaluate(()=>{
      const ta=document.querySelector('#sec-chat textarea');
      const setter=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;
      setter.call(ta,'Wat is mijn beste setup deze maand?');
      ta.dispatchEvent(new Event('input',{bubbles:true}));
    });
    await page.waitForTimeout(100);
    // Verstuur
    await page.evaluate(()=>{
      const sec=document.getElementById('sec-chat');
      const b=Array.from(sec.querySelectorAll('button')).find(b=>/Verstuur/.test(b.textContent));
      if(b)b.click();
    });
    // Wacht op assistant message
    await page.waitForFunction(()=>{
      const sec=document.getElementById('sec-chat');
      return sec&&/Mijn antwoord op je vraag is helder/.test(sec.textContent);
    },{timeout:5000});

    // System prompt heeft trader-context
    expect(captured).toBeTruthy();
    expect(captured.system).toMatch(/Steenbarger|Douglas|Bellafiore/);
    expect(captured.messages.length).toBe(1);
    expect(captured.messages[0].content).toMatch(/beste setup/);

    // Storage heeft 2 messages (user + assistant)
    const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('tj_ai_chats')||'[]'));
    expect(stored.length).toBe(1);
    expect(stored[0].messages.length).toBe(2);
    expect(stored[0].messages[0].role).toBe('user');
    expect(stored[0].messages[1].role).toBe('assistant');
    expect(stored[0].messages[1].cost).toBeGreaterThan(0);
    // Auto-title vanaf eerste msg
    expect(stored[0].title).toMatch(/beste setup/);

    // Cost geboekt in budget
    const cfg=await page.evaluate(()=>JSON.parse(localStorage.getItem('tj_ai_config')||'{}'));
    expect(cfg.budget.spent).toBeGreaterThan(0);

    await page.screenshot({path:'tests/screenshots/aicoach-chat.png',fullPage:true});
  });

  test('multi-turn: 2e message stuurt volledige history',async({page})=>{
    // Start met chat met 2 existing messages
    const existing=[{
      id:'c1',title:'test chat',createdAt:Date.now()-1000,updatedAt:Date.now()-1000,
      messages:[
        {role:'user',content:'eerste vraag',ts:Date.now()-2000},
        {role:'assistant',content:'eerste antwoord',cost:0.005,ts:Date.now()-1500}
      ]
    }];
    await seedChat(page,{chats:existing});
    let captured=null;
    await page.route('https://api.anthropic.com/v1/messages',async(route,req)=>{
      captured=JSON.parse(req.postData()||'{}');
      route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(mockReply("tweede antwoord"))});
    });
    await gotoChat(page);
    await page.waitForTimeout(200);
    // Type vervolgvraag
    await page.evaluate(()=>{
      const ta=document.querySelector('#sec-chat textarea');
      const setter=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;
      setter.call(ta,'tweede vraag — verdiep op eerste antwoord');
      ta.dispatchEvent(new Event('input',{bubbles:true}));
    });
    await page.evaluate(()=>{
      const sec=document.getElementById('sec-chat');
      const b=Array.from(sec.querySelectorAll('button')).find(b=>/Verstuur/.test(b.textContent));
      if(b)b.click();
    });
    await page.waitForFunction(()=>{
      const sec=document.getElementById('sec-chat');
      return sec&&/tweede antwoord/.test(sec.textContent);
    },{timeout:5000});
    expect(captured).toBeTruthy();
    // Payload heeft 3 messages: user1, assistant1, user2 (= history + new)
    expect(captured.messages.length).toBe(3);
    expect(captured.messages[0].role).toBe('user');
    expect(captured.messages[0].content).toBe('eerste vraag');
    expect(captured.messages[1].role).toBe('assistant');
    expect(captured.messages[1].content).toBe('eerste antwoord');
    expect(captured.messages[2].role).toBe('user');
    expect(captured.messages[2].content).toMatch(/tweede vraag/);
  });

  test('delete-knop verwijdert chat',async({page})=>{
    const c1={id:'c1',title:'delete me',createdAt:Date.now(),updatedAt:Date.now(),messages:[]};
    const c2={id:'c2',title:'keep me',createdAt:Date.now()-1000,updatedAt:Date.now()-1000,messages:[]};
    await seedChat(page,{chats:[c1,c2]});
    page.on('dialog',d=>d.accept());
    await gotoChat(page);
    await page.evaluate(()=>{
      const sec=document.getElementById('sec-chat');
      // klik 1e delete-knop (✕) — onthoud: er zijn 2 chats in sidebar
      const btns=Array.from(sec.querySelectorAll('aside button'));
      const delBtn=btns.find(b=>b.textContent.trim()==='✕'&&b.title==='Verwijder');
      if(delBtn)delBtn.click();
    });
    await page.waitForTimeout(300);
    const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('tj_ai_chats')||'[]'));
    expect(stored.length).toBe(1);
    expect(stored[0].id).toBe('c2');
  });
});
