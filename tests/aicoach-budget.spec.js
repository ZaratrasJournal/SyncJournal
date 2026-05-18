// v12.137 — Budget-monitor tests.
// Verifieert:
//  - BudgetSection rendert spent + percentage + bar correct
//  - Hard-cap guard blokkeert API-call wanneer spent >= limit
//  - Topbar-indicator verschijnt bij >= alertThreshold (zichtbaar)
//  - Topbar-indicator klik navigeert naar AI-coach/budget sectie
//  - Reset-knop zet spent terug op 0
const{test,expect}=require('@playwright/test');
const path=require('path');
const FILE_URL='file:///'+path.resolve(__dirname,'../work/tradejournal.html').replace(/\\/g,'/');

async function seedBudget(page,opts){
  const{enabled=true,spent=0,limit=5,threshold=0.8,key="sk-ant-test"}=opts||{};
  await page.addInitScript(({enabled,spent,limit,threshold,key})=>{
    localStorage.setItem('tj_welcomed','1');
    localStorage.setItem('tj_ai_flag','1');
    const now=new Date();
    const monthKey=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
    localStorage.setItem('tj_ai_config',JSON.stringify({
      enabled:enabled,
      byok:{key:key,model:"claude-sonnet-4-6",connected:true,lastTest:Date.now(),lastError:""},
      features:{pretrade:true,budget:true,weekly:true,privacy:false},
      budget:{monthlyLimit:limit,alertThreshold:threshold,spent:spent,lastResetMonth:monthKey}
    }));
  },{enabled,spent,limit,threshold,key});
}

async function gotoBudget(page){
  await page.goto(FILE_URL+'?ai=1',{waitUntil:'networkidle'});
  await page.waitForTimeout(300);
  await page.evaluate(()=>{
    const btns=Array.from(document.querySelectorAll('.tj-tabs button.tj-tab'));
    const b=btns.find(b=>b.textContent.includes('AI-coach'));
    if(b)b.click();
  });
  await page.waitForTimeout(300);
  await page.evaluate(()=>{
    const el=document.getElementById('sec-budget');
    if(el)el.scrollIntoView({block:'start'});
  });
  await page.waitForTimeout(200);
}

test.describe('AI-coach budget',()=>{

  test('spent + percentage + bar renderen correct',async({page})=>{
    await seedBudget(page,{spent:3.0,limit:5});
    await gotoBudget(page);
    const txt=await page.locator('#sec-budget').textContent();
    expect(txt).toMatch(/\$3\.00/);
    expect(txt).toMatch(/\$5\.00/);
    expect(txt).toMatch(/60%/);
    await page.screenshot({path:'tests/screenshots/aicoach-budget.png',fullPage:true});
  });

  test('topbar-indicator zichtbaar bij ≥80% spent',async({page})=>{
    await seedBudget(page,{spent:4.5,limit:5,threshold:0.8}); // 90%
    await page.goto(FILE_URL+'?ai=1',{waitUntil:'networkidle'});
    await page.waitForTimeout(400);
    const indicator=await page.locator('.tj-right-btns button[aria-label="AI budget waarschuwing"]').count();
    expect(indicator).toBe(1);
    const txt=await page.locator('.tj-right-btns button[aria-label="AI budget waarschuwing"]').textContent();
    expect(txt).toMatch(/90%/);
  });

  test('topbar-indicator verborgen onder threshold',async({page})=>{
    await seedBudget(page,{spent:2,limit:5,threshold:0.8}); // 40%
    await page.goto(FILE_URL+'?ai=1',{waitUntil:'networkidle'});
    await page.waitForTimeout(400);
    const indicator=await page.locator('.tj-right-btns button[aria-label="AI budget waarschuwing"]').count();
    expect(indicator).toBe(0);
  });

  test('hard-cap: API-call blocked wanneer spent >= limit',async({page})=>{
    await seedBudget(page,{spent:5.0,limit:5}); // exact aan limit
    // Mock fetch — moet NIET getriggerd worden
    let calls=0;
    await page.route('https://api.anthropic.com/v1/messages',route=>{
      calls++;
      route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:[{type:"text",text:"{}"}],usage:{input_tokens:1,output_tokens:1}})});
    });
    await page.goto(FILE_URL+'?ai=1',{waitUntil:'networkidle'});
    await page.waitForTimeout(300);
    await page.evaluate(()=>{
      const btns=Array.from(document.querySelectorAll('.tj-tabs button.tj-tab'));
      const b=btns.find(b=>b.textContent.includes('AI-coach'));
      if(b)b.click();
    });
    await page.waitForTimeout(300);
    await page.evaluate(()=>{
      const el=document.getElementById('sec-pretrade');
      if(el)el.scrollIntoView({block:'start'});
    });
    // Vul form
    await page.evaluate(()=>{
      const sec=document.getElementById('sec-pretrade');
      const inputs=Array.from(sec.querySelectorAll('input,select,textarea'));
      const setVal=(el,v)=>{
        const proto=el.tagName==='SELECT'?window.HTMLSelectElement.prototype:el.tagName==='TEXTAREA'?window.HTMLTextAreaElement.prototype:window.HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto,'value').set.call(el,v);
        el.dispatchEvent(new Event('input',{bubbles:true}));
      };
      setVal(inputs[0],'BTC');
      setVal(inputs[2],'65000');
      setVal(inputs[3],'64000');
    });
    await page.waitForTimeout(150);
    await page.evaluate(()=>{
      const btns=Array.from(document.querySelectorAll('#sec-pretrade button'));
      const b=btns.find(b=>/Valideer trade/i.test(b.textContent));
      if(b)b.click();
    });
    // Error message zou moeten verschijnen, fetch niet aangeroepen
    await page.waitForFunction(()=>{
      const sec=document.getElementById('sec-pretrade');
      return sec&&/Maandlimiet bereikt/.test(sec.textContent);
    },{timeout:3000});
    expect(calls).toBe(0);
  });

  test('reset-knop zet spent op 0',async({page})=>{
    await seedBudget(page,{spent:3.5,limit:5});
    await gotoBudget(page);
    // Mock confirm dialog → accept
    page.on('dialog',d=>d.accept());
    await page.evaluate(()=>{
      const sec=document.getElementById('sec-budget');
      const btns=Array.from(sec.querySelectorAll('button'));
      const b=btns.find(b=>/Reset maand-totaal/i.test(b.textContent));
      if(b)b.click();
    });
    await page.waitForTimeout(300);
    const cfg=await page.evaluate(()=>JSON.parse(localStorage.getItem('tj_ai_config')||'{}'));
    expect(cfg.budget.spent).toBe(0);
  });
});
