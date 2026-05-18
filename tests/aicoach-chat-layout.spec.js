// v12.145 — Verifieer dat na een LANGE markdown-response (groter dan
// chat-pane height van 540px) de input-area zichtbaar blijft en de
// scroll-div binnen 540px scrollt. Voorheen: lange response duwde de
// input out-of-view door missing minHeight:0 op flex children.
const{test,expect}=require('@playwright/test');
const path=require('path');
const FILE_URL='file:///'+path.resolve(__dirname,'../work/tradejournal.html').replace(/\\/g,'/');

// Lange markdown reply die >540px in beslag neemt
const LONG_REPLY=Array.from({length:30},(_,i)=>
  `## Sectie ${i+1}\n\nDit is sectie ${i+1} met **bold tekst** en wat extra woorden om de hoogte op te bouwen. Lorem ipsum dolor sit amet consectetur.\n\n- bullet 1\n- bullet 2\n- bullet 3\n`
).join("\n");

test('lange markdown response → input area zichtbaar + scroll werkt',async({page})=>{
  await page.addInitScript(()=>{
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
    localStorage.setItem('tj_ai_chats',JSON.stringify([]));
  });

  await page.route('https://api.anthropic.com/v1/messages',(route,req)=>{
    route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      content:[{type:"text",text:LONG_REPLY}],
      usage:{input_tokens:200,output_tokens:800}
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

  // Nieuwe chat + verstuur message
  await page.evaluate(()=>{
    const sec=document.getElementById('sec-chat');
    const b=Array.from(sec.querySelectorAll('button')).find(b=>/Nieuwe chat/i.test(b.textContent));
    if(b)b.click();
  });
  await page.waitForTimeout(100);
  await page.evaluate(()=>{
    const ta=document.querySelector('#sec-chat textarea');
    const setter=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;
    setter.call(ta,'analyse');
    ta.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.evaluate(()=>{
    const sec=document.getElementById('sec-chat');
    const b=Array.from(sec.querySelectorAll('button')).find(b=>/Verstuur/.test(b.textContent));
    if(b)b.click();
  });
  await page.waitForFunction(()=>{
    const sec=document.getElementById('sec-chat');
    return sec&&/Sectie 30/.test(sec.textContent);
  },{timeout:5000});

  // ── KRITIEKE CHECKS ──

  // 1. Chat-shell respecteert 540px (overflow:hidden + minHeight:0 op children)
  const shellHeight=await page.evaluate(()=>{
    const shell=document.querySelector('#sec-chat > div > div > div[style*="540"]')||
                document.querySelector('#sec-chat div[style*="height: 540px"]');
    return shell?shell.getBoundingClientRect().height:null;
  });
  expect(shellHeight).toBeGreaterThanOrEqual(530);
  expect(shellHeight).toBeLessThanOrEqual(560);

  // 2. Input textarea is zichtbaar in viewport (niet uit beeld door content)
  const taVisible=await page.evaluate(()=>{
    const ta=document.querySelector('#sec-chat textarea');
    if(!ta)return null;
    const rect=ta.getBoundingClientRect();
    const vh=window.innerHeight;
    return{top:rect.top,bottom:rect.bottom,visible:rect.top<vh&&rect.bottom>0,width:rect.width,height:rect.height};
  });
  expect(taVisible).toBeTruthy();
  expect(taVisible.width).toBeGreaterThan(100);
  expect(taVisible.height).toBeGreaterThan(20);

  // 3. Verstuur-knop zichtbaar
  const btnVisible=await page.evaluate(()=>{
    const sec=document.getElementById('sec-chat');
    const b=Array.from(sec.querySelectorAll('button')).find(b=>/Verstuur|⏳/.test(b.textContent));
    if(!b)return null;
    const rect=b.getBoundingClientRect();
    return{visible:rect.width>0&&rect.height>0,width:rect.width};
  });
  expect(btnVisible).toBeTruthy();
  expect(btnVisible.width).toBeGreaterThan(20);

  // 4. Scroll-div heeft scrollbar (scrollHeight > clientHeight)
  const scrollState=await page.evaluate(()=>{
    const main=document.querySelector('#sec-chat main');
    const scrollDiv=main.querySelector('div[style*="overflowY"]')||main.firstElementChild;
    return{
      scrollHeight:scrollDiv.scrollHeight,
      clientHeight:scrollDiv.clientHeight,
      hasOverflow:scrollDiv.scrollHeight>scrollDiv.clientHeight
    };
  });
  expect(scrollState.hasOverflow).toBe(true);
  // clientHeight moet < 540 (inner van pane minus input area)
  expect(scrollState.clientHeight).toBeLessThan(540);

  await page.screenshot({path:'tests/screenshots/aicoach-chat-long.png',fullPage:false});
});
