// v12.136 — Pre-trade validation flow, fetch mocked om Claude API te simuleren.
// Verifieert:
//  - PreTradeSection rendert wanneer master + pretrade-toggle aan
//  - Form input + submit → fetch wordt aangeroepen met juiste headers/body
//  - Severity-output rendert correct (positive/warning/severe styling)
//  - Cost-tracking schrijft naar tj_ai_config.budget.spent
//  - Privacy-filter (mask) wordt toegepast op outgoing payload
const{test,expect}=require('@playwright/test');
const path=require('path');
const FILE_URL='file:///'+path.resolve(__dirname,'../work/tradejournal.html').replace(/\\/g,'/');

const MOCK_RESPONSE={
  id:"msg_test",
  type:"message",
  role:"assistant",
  model:"claude-sonnet-4-6",
  content:[{type:"text",text:JSON.stringify({
    severity:"warning",
    headline:"Trade past mits je TP1 reduceert",
    advice:"Risk is hoog voor London-open. Reduceer naar 0.5%. Wacht op CVD-bevestiging vóór entry.",
    bellafiore:{
      intel_edge:"3 — bekend setup",
      tape:"2 — geen CVD-flip nog",
      story:"4 — past in dagelijks plan",
      risk:"3 — 1% maar wijde stop",
      execution:"3 — duidelijk entry-trigger"
    },
    playbook_fit:7,
    concerns:["Funding +0.02% kan reverse triggeren","Geen LTF confluence beschreven"]
  })}],
  usage:{input_tokens:850,output_tokens:220}
};

async function seedConfig(page){
  await page.addInitScript(()=>{
    localStorage.setItem('tj_welcomed','1');
    localStorage.setItem('tj_ai_flag','1');
    localStorage.setItem('tj_ai_config',JSON.stringify({
      enabled:true,
      byok:{key:"sk-ant-test-12345",model:"claude-sonnet-4-6",connected:true,lastTest:Date.now(),lastError:""},
      features:{pretrade:true,budget:true,weekly:true,privacy:false},
      budget:{monthlyLimit:5,alertThreshold:0.8,spent:0,lastResetMonth:""}
    }));
  });
}

async function gotoPreTrade(page){
  await page.goto(FILE_URL+'?ai=1',{waitUntil:'networkidle'});
  await page.waitForTimeout(400);
  await page.evaluate(()=>{
    const btns=Array.from(document.querySelectorAll('.tj-tabs button.tj-tab'));
    const b=btns.find(b=>b.textContent.includes('AI-coach'));
    if(b)b.click();
  });
  await page.waitForTimeout(300);
  // Scroll pre-trade in view
  await page.evaluate(()=>{
    const el=document.getElementById('sec-pretrade');
    if(el)el.scrollIntoView({block:'start'});
  });
  await page.waitForTimeout(200);
}

test.describe('AI-coach pre-trade validatie',()=>{

  test('form rendert + submit → fetch met juiste payload',async({page})=>{
    await seedConfig(page);
    // Mock Claude API fetch
    await page.route('https://api.anthropic.com/v1/messages',route=>{
      route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(MOCK_RESPONSE)});
    });
    await gotoPreTrade(page);

    // Vul form
    await page.evaluate(()=>{
      const sec=document.getElementById('sec-pretrade');
      const inputs=sec.querySelectorAll('input,select,textarea');
      const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
      const setVal=(el,v)=>{
        const proto=el.tagName==='SELECT'?window.HTMLSelectElement.prototype:el.tagName==='TEXTAREA'?window.HTMLTextAreaElement.prototype:window.HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto,'value').set.call(el,v);
        el.dispatchEvent(new Event('input',{bubbles:true}));
        el.dispatchEvent(new Event('change',{bubbles:true}));
      };
      // input[0]=ticker, select[0]=direction, input[1]=entry, input[2]=stop, input[3]=tp1...
      const order=Array.from(inputs);
      // Eerste 4: ticker / direction / entry / stop
      setVal(order[0],'BTC');
      setVal(order[2],'65000');
      setVal(order[3],'64200');
      // tp1, tp2, riskPct, playbook (select)
      setVal(order[4],'66200');
      setVal(order[6],'1.0');
    });
    await page.waitForTimeout(100);

    // Klik "Valideer trade"
    let requestPayload=null;
    await page.route('https://api.anthropic.com/v1/messages',async(route,req)=>{
      requestPayload=JSON.parse(req.postData()||'{}');
      route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(MOCK_RESPONSE)});
    });
    await page.evaluate(()=>{
      const btns=Array.from(document.querySelectorAll('#sec-pretrade button'));
      const b=btns.find(b=>/Valideer trade/i.test(b.textContent));
      if(b)b.click();
    });
    // Wacht op response render
    await page.waitForFunction(()=>{
      const sec=document.getElementById('sec-pretrade');
      return sec&&/Trade past/.test(sec.textContent);
    },{timeout:5000});

    // Check request had juiste headers + body
    expect(requestPayload).toBeTruthy();
    expect(requestPayload.model).toBe('claude-sonnet-4-6');
    expect(requestPayload.messages[0].content).toMatch(/BTC/);
    expect(requestPayload.messages[0].content).toMatch(/65000/);
    expect(requestPayload.system).toMatch(/Bellafiore/);

    // Severity warning class moet zichtbaar zijn (amber)
    const out=await page.locator('#sec-pretrade').textContent();
    expect(out).toMatch(/Waarschuwing/);
    expect(out).toMatch(/Trade past/);
    expect(out).toMatch(/Bellafiore/);
    expect(out).toMatch(/7\/10/);

    // Cost-tracking schreef naar localStorage
    const cfg=await page.evaluate(()=>JSON.parse(localStorage.getItem('tj_ai_config')||'{}'));
    expect(cfg.budget.spent).toBeGreaterThan(0);
    // 850 in + 220 out @ Sonnet (3/15 per M) = (850*3 + 220*15)/1e6 = 0.00585
    expect(cfg.budget.spent).toBeCloseTo(0.00585,4);

    await page.screenshot({path:'tests/screenshots/aicoach-pretrade.png',fullPage:true});
  });

  test('privacy-filter: ticker wordt gemaskeerd in outgoing payload',async({page})=>{
    await page.addInitScript(()=>{
      localStorage.setItem('tj_welcomed','1');
      localStorage.setItem('tj_ai_flag','1');
      localStorage.setItem('tj_ai_config',JSON.stringify({
        enabled:true,
        byok:{key:"sk-ant-test-12345",model:"claude-sonnet-4-6",connected:true,lastTest:Date.now(),lastError:""},
        features:{pretrade:true,budget:true,weekly:true,privacy:true}, // privacy AAN
        budget:{monthlyLimit:5,alertThreshold:0.8,spent:0,lastResetMonth:""}
      }));
    });

    let captured=null;
    await page.route('https://api.anthropic.com/v1/messages',async(route,req)=>{
      captured=JSON.parse(req.postData()||'{}');
      route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(MOCK_RESPONSE)});
    });
    await gotoPreTrade(page);

    // Vul form met ETH
    await page.evaluate(()=>{
      const sec=document.getElementById('sec-pretrade');
      const inputs=sec.querySelectorAll('input,select,textarea');
      const order=Array.from(inputs);
      const setVal=(el,v)=>{
        const proto=el.tagName==='SELECT'?window.HTMLSelectElement.prototype:el.tagName==='TEXTAREA'?window.HTMLTextAreaElement.prototype:window.HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto,'value').set.call(el,v);
        el.dispatchEvent(new Event('input',{bubbles:true}));
        el.dispatchEvent(new Event('change',{bubbles:true}));
      };
      setVal(order[0],'ETH');
      setVal(order[2],'3200');
      setVal(order[3],'3150');
    });
    await page.waitForTimeout(100);

    await page.evaluate(()=>{
      const btns=Array.from(document.querySelectorAll('#sec-pretrade button'));
      const b=btns.find(b=>/Valideer trade/i.test(b.textContent));
      if(b)b.click();
    });
    await page.waitForFunction(()=>{
      const sec=document.getElementById('sec-pretrade');
      return sec&&/Trade past|denkt na/.test(sec.textContent)===true;
    },{timeout:5000});
    // wacht op response
    await page.waitForTimeout(300);

    expect(captured).toBeTruthy();
    const payloadText=JSON.stringify(captured);
    // ETH mag NIET in payload zitten (gemaskeerd)
    expect(payloadText).not.toMatch(/\bETH\b/);
    // Een mask-token moet er wel zijn
    expect(payloadText).toMatch(/COIN_[A-Z]/);
  });

  test('zonder API-key: helpful state ipv form',async({page})=>{
    await page.addInitScript(()=>{
      localStorage.setItem('tj_welcomed','1');
      localStorage.setItem('tj_ai_flag','1');
      localStorage.setItem('tj_ai_config',JSON.stringify({
        enabled:true,
        byok:{key:"",model:"claude-sonnet-4-6",connected:false,lastTest:0,lastError:""},
        features:{pretrade:true,budget:true,weekly:true,privacy:true},
        budget:{monthlyLimit:5,alertThreshold:0.8,spent:0,lastResetMonth:""}
      }));
    });
    await gotoPreTrade(page);
    const txt=await page.locator('#sec-pretrade').textContent();
    expect(txt).toMatch(/Geen API-key|Vul je Anthropic key/i);
  });
});
