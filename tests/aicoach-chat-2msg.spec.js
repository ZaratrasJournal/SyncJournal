// v12.144 — Reproduceer Denny's bug 1: na 1 antwoord kan hij niets meer typen.
// Stuur 2 messages na elkaar — input moet enabled blijven, en de scroll-pane
// moet de 2e response tonen.
const{test,expect}=require('@playwright/test');
const path=require('path');
const FILE_URL='file:///'+path.resolve(__dirname,'../work/tradejournal.html').replace(/\\/g,'/');

async function seedChat(page){
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

test('2 messages na elkaar — input blijft enabled, scroll werkt',async({page})=>{
  await seedChat(page);
  let callCount=0;
  await page.route('https://api.anthropic.com/v1/messages',async(route)=>{
    callCount++;
    // Response markdown lang (simuleer Denny's situatie)
    const mdResponse=`# Antwoord ${callCount}\n\n## Wat de data zegt\n\n**Punt 1**: dit is een lange respons om scroll-positie te testen.\n\n- bullet 1\n- bullet 2\n- bullet 3\n\n> Belangrijke quote die ruimte inneemt\n\nNog meer paragraaf-tekst. Lorem ipsum dolor sit amet. Consectetur adipiscing elit. Sed do eiusmod tempor.\n\n## Conclusie ${callCount}\n\nResponse-${callCount}-MARKER`;
    route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      content:[{type:"text",text:mdResponse}],
      usage:{input_tokens:200,output_tokens:300}
    })});
  });
  await gotoChat(page);

  // Maak chat
  await page.evaluate(()=>{
    const sec=document.getElementById('sec-chat');
    const b=Array.from(sec.querySelectorAll('button')).find(b=>/Nieuwe chat/i.test(b.textContent));
    if(b)b.click();
  });
  await page.waitForTimeout(150);

  // ─── Message 1 ───
  await page.evaluate(()=>{
    const ta=document.querySelector('#sec-chat textarea');
    const setter=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;
    setter.call(ta,'eerste vraag');
    ta.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.evaluate(()=>{
    const sec=document.getElementById('sec-chat');
    const b=Array.from(sec.querySelectorAll('button')).find(b=>/Verstuur/.test(b.textContent));
    if(b)b.click();
  });
  await page.waitForFunction(()=>{
    const sec=document.getElementById('sec-chat');
    return sec&&/Response-1-MARKER/.test(sec.textContent);
  },{timeout:5000});

  // CHECK na response 1: input ENABLED + leeg + Verstuur-knop juist disabled (geen text)
  const ta1State=await page.evaluate(()=>{
    const ta=document.querySelector('#sec-chat textarea');
    return{disabled:ta.disabled,value:ta.value};
  });
  expect(ta1State.disabled).toBe(false);
  expect(ta1State.value).toBe('');

  // ─── Message 2 ───
  await page.evaluate(()=>{
    const ta=document.querySelector('#sec-chat textarea');
    const setter=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;
    setter.call(ta,'tweede vervolgvraag');
    ta.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.waitForTimeout(100);

  // Verstuur-knop moet enabled zijn nu (text ingevuld + loading=false)
  const btnState=await page.evaluate(()=>{
    const sec=document.getElementById('sec-chat');
    const b=Array.from(sec.querySelectorAll('button')).find(b=>/Verstuur/.test(b.textContent));
    return b?{disabled:b.disabled,text:b.textContent.trim()}:null;
  });
  expect(btnState).toBeTruthy();
  expect(btnState.disabled).toBe(false);

  // Verstuur
  await page.evaluate(()=>{
    const sec=document.getElementById('sec-chat');
    const b=Array.from(sec.querySelectorAll('button')).find(b=>/Verstuur/.test(b.textContent));
    if(b)b.click();
  });
  await page.waitForFunction(()=>{
    const sec=document.getElementById('sec-chat');
    return sec&&/Response-2-MARKER/.test(sec.textContent);
  },{timeout:5000});

  // CHECK chat heeft nu 4 messages
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('tj_ai_chats')||'[]'));
  expect(stored.length).toBe(1);
  expect(stored[0].messages.length).toBe(4);
  // history: user1, asst1, user2, asst2
  expect(stored[0].messages[0].content).toBe('eerste vraag');
  expect(stored[0].messages[2].content).toBe('tweede vervolgvraag');
  expect(stored[0].messages[3].content).toMatch(/Response-2-MARKER/);

  // Input opnieuw enabled + leeg
  const ta2State=await page.evaluate(()=>{
    const ta=document.querySelector('#sec-chat textarea');
    return{disabled:ta.disabled,value:ta.value};
  });
  expect(ta2State.disabled).toBe(false);
  expect(ta2State.value).toBe('');

  // Scroll-pane: scrollTop moet ≈ scrollHeight - clientHeight (gescrold naar bottom)
  const scrollState=await page.evaluate(()=>{
    const main=document.querySelector('#sec-chat main');
    const scrollDiv=main.querySelector('div[style*="overflowY"]')||main.firstElementChild;
    return{
      scrollTop:scrollDiv.scrollTop,
      scrollHeight:scrollDiv.scrollHeight,
      clientHeight:scrollDiv.clientHeight,
      gap:scrollDiv.scrollHeight-scrollDiv.clientHeight-scrollDiv.scrollTop
    };
  });
  // Verwacht: gescrold naar bottom (gap dichtbij 0)
  expect(scrollState.gap).toBeLessThan(20);

  await page.screenshot({path:'tests/screenshots/aicoach-chat-2msg.png',fullPage:true});
});
