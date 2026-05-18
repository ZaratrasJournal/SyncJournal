// v12.149 — Privacy-sectie: live preview, custom tickers, amount-mask modes,
// last-prompt logger.
const{test,expect}=require('@playwright/test');
const path=require('path');
const FILE_URL='file:///'+path.resolve(__dirname,'../work/tradejournal.html').replace(/\\/g,'/');

async function seedPrivacy(page,overrides){
  await page.addInitScript(({overrides})=>{
    localStorage.setItem('tj_welcomed','1');
    localStorage.setItem('tj_ai_flag','1');
    const now=new Date();
    const monthKey=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
    const cfg={
      enabled:true,
      byok:{key:"sk-ant-test",model:"claude-sonnet-4-6",connected:true,lastTest:Date.now(),lastError:""},
      features:{pretrade:true,budget:true,weekly:true,privacy:true,floatingChat:true},
      budget:{monthlyLimit:5,alertThreshold:0.8,spent:0,lastResetMonth:monthKey},
      weekly:{dayOfWeek:1,autoTrigger:true,lastGeneratedAt:0},
      privacy:{amountMode:"off",customTickers:[],logLastPrompt:true,...(overrides||{})}
    };
    localStorage.setItem('tj_ai_config',JSON.stringify(cfg));
    localStorage.setItem('tj_ai_chats',JSON.stringify([]));
  },{overrides});
}

async function gotoPrivacy(page){
  await page.goto(FILE_URL+'?ai=1',{waitUntil:'networkidle'});
  await page.waitForTimeout(300);
  await page.evaluate(()=>{
    const btns=Array.from(document.querySelectorAll('.tj-tabs button.tj-tab'));
    const b=btns.find(b=>b.textContent.includes('AI-coach'));
    if(b)b.click();
  });
  await page.waitForTimeout(300);
  await page.evaluate(()=>{
    const el=document.getElementById('sec-privacy');
    if(el)el.scrollIntoView({block:'start'});
  });
  await page.waitForTimeout(200);
}

test('PrivacySection rendert + status-blok toont "actief"',async({page})=>{
  await seedPrivacy(page);
  await gotoPrivacy(page);
  const txt=await page.locator('#sec-privacy').textContent();
  expect(txt).toMatch(/Ticker-mask actief/);
  expect(txt).toMatch(/standaard tickers/);
  expect(txt).toMatch(/Live preview/i);
});

test('live preview toont gemaskeerd resultaat met BTC + ETH',async({page})=>{
  await seedPrivacy(page);
  await gotoPrivacy(page);
  // Default preview-input bevat al BTC en ETH
  const sentLine=await page.evaluate(()=>{
    const sec=document.getElementById('sec-privacy');
    // De mono-output zit in een div met font-family mono na "naar Anthropic gaat"
    const all=Array.from(sec.querySelectorAll('div')).map(d=>d.textContent);
    return all.find(t=>/COIN_/.test(t))||"";
  });
  expect(sentLine).toMatch(/COIN_[AB]/);
  // BTC moet niet meer in preview-output zitten (wel in input-area)
});

test('amount-mask labels mode: $340 wordt $X1',async({page})=>{
  await seedPrivacy(page,{amountMode:"labels"});
  await gotoPrivacy(page);
  // Klik direct labels mode (default in seed)
  const sent=await page.evaluate(()=>{
    const sec=document.getElementById('sec-privacy');
    const monos=Array.from(sec.querySelectorAll('div[style*="mono"]'));
    return monos.map(m=>m.textContent).join(" | ");
  });
  // Default preview heeft +$420 en -$180
  expect(sent).toMatch(/\$X\d/);
  expect(sent).not.toMatch(/\$420/);
});

test('amount-mask buckets mode: $340 wordt $middel',async({page})=>{
  await seedPrivacy(page,{amountMode:"buckets"});
  await gotoPrivacy(page);
  const sent=await page.evaluate(()=>{
    const sec=document.getElementById('sec-privacy');
    const monos=Array.from(sec.querySelectorAll('div[style*="mono"]'));
    return monos.map(m=>m.textContent).join(" | ");
  });
  expect(sent).toMatch(/\$middel|\$klein/);
  expect(sent).not.toMatch(/\$420/);
});

test('custom ticker toevoegen → bij mask wordt vervangen',async({page})=>{
  await seedPrivacy(page);
  await gotoPrivacy(page);
  // Voeg HYPE toe
  await page.evaluate(()=>{
    const sec=document.getElementById('sec-privacy');
    const inp=Array.from(sec.querySelectorAll('input[type="text"], input:not([type])')).find(i=>(i.placeholder||"").includes("HYPE"));
    if(inp){
      const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
      setter.call(inp,'HYPE');
      inp.dispatchEvent(new Event('input',{bubbles:true}));
      const btn=Array.from(sec.querySelectorAll('button')).find(b=>/Voeg toe/.test(b.textContent));
      if(btn)btn.click();
    }
  });
  await page.waitForTimeout(150);
  const cfg=await page.evaluate(()=>JSON.parse(localStorage.getItem('tj_ai_config')||'{}'));
  expect(cfg.privacy.customTickers).toContain('HYPE');
  // Verifieer dat preview met HYPE input dit maskeert
  await page.evaluate(()=>{
    const sec=document.getElementById('sec-privacy');
    const ta=sec.querySelector('textarea');
    const setter=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;
    setter.call(ta,'Wat denk je van HYPE long?');
    ta.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.waitForTimeout(150);
  const sentTxt=await page.evaluate(()=>document.getElementById('sec-privacy').textContent);
  expect(sentTxt).toMatch(/COIN_/);
});

test('last-prompt log: na chat-send is preview beschikbaar',async({page})=>{
  await seedPrivacy(page);
  await page.route('https://api.anthropic.com/v1/messages',(route)=>{
    route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      content:[{type:"text",text:"ok"}],usage:{input_tokens:100,output_tokens:10}
    })});
  });
  await gotoPrivacy(page);
  // Open AI-chat tab → maak chat → verstuur
  await page.evaluate(()=>{
    const el=document.getElementById('sec-chat');
    if(el)el.scrollIntoView({block:'start'});
  });
  await page.evaluate(()=>{
    const sec=document.getElementById('sec-chat');
    const b=Array.from(sec.querySelectorAll('button')).find(b=>/Nieuwe chat/i.test(b.textContent));
    if(b)b.click();
  });
  await page.waitForTimeout(150);
  await page.evaluate(()=>{
    const ta=document.querySelector('#sec-chat textarea');
    const setter=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;
    setter.call(ta,'test prompt voor log');
    ta.dispatchEvent(new Event('input',{bubbles:true}));
    const b=Array.from(document.querySelectorAll('#sec-chat button')).find(b=>/Verstuur/.test(b.textContent));
    if(b)b.click();
  });
  await page.waitForFunction(()=>document.body.textContent.includes('AI-COACH')||document.body.textContent.match(/Mori[\s\S]+ok/),{timeout:5000});

  // Last-prompt is opgeslagen
  const rec=await page.evaluate(()=>JSON.parse(localStorage.getItem('tj_ai_last_prompt')||'null'));
  expect(rec).toBeTruthy();
  expect(rec.model).toBe('claude-sonnet-4-6');
  expect(rec.messages.length).toBeGreaterThanOrEqual(1);
  expect(rec.messages[0].content).toContain('test prompt voor log');
});
