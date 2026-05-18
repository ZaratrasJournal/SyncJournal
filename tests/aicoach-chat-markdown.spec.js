// v12.143 — Verifieer dat assistant-messages markdown gerenderd worden:
//  - ## header → bold heading-div
//  - **bold** → <strong>
//  - bullet list → <ul><li>
//  - > quote → <blockquote>
//  - `code` → <code>
// User-messages BLIJVEN raw (geen markdown processing — security).
const{test,expect}=require('@playwright/test');
const path=require('path');
const FILE_URL='file:///'+path.resolve(__dirname,'../work/tradejournal.html').replace(/\\/g,'/');

const MD_REPLY=`# 1H MSB/BOS Backtest — Analyse

## Wat de data zegt

Ik heb **20 backtests**: WR 75%, gem 1.8R.

> Break-even WR = 1/(1+RR) = 25%

**Dit playbook is winstgevend.**

- Beste setups: \`MSB+BOS\` op London-open
- Zwakste: late NY-sessie
- Verbetering: trail-stop na TP1

\`\`\`
risk = 1% per trade
target = 2R
\`\`\``;

test('assistant message rendert markdown als HTML',async({page})=>{
  const seedChat={id:'c1',title:'md test',createdAt:Date.now(),updatedAt:Date.now(),messages:[]};
  await page.addInitScript(({c})=>{
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
    localStorage.setItem('tj_ai_chats',JSON.stringify([c]));
  },{c:seedChat});

  await page.route('https://api.anthropic.com/v1/messages',(route)=>{
    route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      content:[{type:"text",text:MD_REPLY}],
      usage:{input_tokens:100,output_tokens:200}
    })});
  });

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
  // Verstuur een vraag
  await page.evaluate(()=>{
    const ta=document.querySelector('#sec-chat textarea');
    const setter=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;
    setter.call(ta,'analyseer');
    ta.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.evaluate(()=>{
    const sec=document.getElementById('sec-chat');
    const b=Array.from(sec.querySelectorAll('button')).find(b=>/Verstuur/.test(b.textContent));
    if(b)b.click();
  });
  await page.waitForFunction(()=>{
    const sec=document.getElementById('sec-chat');
    return sec&&/winstgevend/.test(sec.textContent);
  },{timeout:5000});

  // Verifieer dat assistant-message HTML-elementen heeft (niet raw markdown)
  const mainHtml=await page.locator('#sec-chat main').innerHTML();

  // Markdown geconverteerd naar HTML
  expect(mainHtml).toContain('<strong>20 backtests</strong>');
  expect(mainHtml).toContain('<blockquote');  // > quote
  expect(mainHtml).toContain('<ul');           // - lists
  expect(mainHtml).toContain('<li>');
  expect(mainHtml).toContain('<code');         // `code`
  expect(mainHtml).toContain('<pre');          // ```...```

  // Raw markdown literal-tekst moet NIET zichtbaar zijn (de tekstcontent
  // van de bubble; HTML-attributes mogen 'em wel bevatten in styles).
  const txt=await page.locator('#sec-chat main').textContent();
  expect(txt).not.toContain('**20 backtests**');
  expect(txt).not.toContain('## Wat de data zegt');

  // Screenshot ter visuele check
  await page.screenshot({path:'tests/screenshots/aicoach-chat-md.png',fullPage:true});
});

test('user message blijft raw (geen markdown rendering)',async({page})=>{
  const seedChat={id:'c1',title:'usr test',createdAt:Date.now(),updatedAt:Date.now(),
    messages:[{role:'user',content:'**bold-msg**\n## not-a-header',ts:Date.now()},
              {role:'assistant',content:'ok',cost:0.001,ts:Date.now()}]};
  await page.addInitScript(({c})=>{
    localStorage.setItem('tj_welcomed','1');
    localStorage.setItem('tj_ai_flag','1');
    const now=new Date();
    const monthKey=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
    localStorage.setItem('tj_ai_config',JSON.stringify({
      enabled:true,
      byok:{key:"sk-ant-test",model:"claude-sonnet-4-6",connected:true,lastTest:0,lastError:""},
      features:{pretrade:true,budget:true,weekly:true,privacy:false},
      budget:{monthlyLimit:5,alertThreshold:0.8,spent:0,lastResetMonth:monthKey},
      weekly:{dayOfWeek:1,autoTrigger:true,lastGeneratedAt:0}
    }));
    localStorage.setItem('tj_ai_chats',JSON.stringify([c]));
  },{c:seedChat});
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
  // User message moet de raw text tonen (geen <strong>)
  const txt=await page.locator('#sec-chat main').textContent();
  expect(txt).toContain('**bold-msg**');
  expect(txt).toContain('## not-a-header');
});
