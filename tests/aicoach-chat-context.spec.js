// v12.140 — Verifieert dat chat-system-prompt de rijke trader-data context bevat:
//  - Per-playbook breakdown met real/backtest/paper split
//  - Recente trades sample met type-tags ([BT]/[PAPER]/etc)
//  - Stelt vraag "wat vind je van mijn 1h MSB BOS backtest" en checkt dat de
//    payload data heeft zodat AI niet hoeft te zeggen "ik heb geen data"
const{test,expect}=require('@playwright/test');
const path=require('path');
const FILE_URL='file:///'+path.resolve(__dirname,'../work/tradejournal.html').replace(/\\/g,'/');

// Mock trades: 3 backtest + 2 real + 1 paper, allemaal binnen "1h MSB BOS" playbook
const mkTrade=(i,opts)=>({
  id:'t'+i,
  symbol:opts.sym||'BTC',
  direction:opts.dir||'long',
  entryDate:opts.date,
  exitDate:opts.date,
  pnl:opts.pnl,
  rMultiple:opts.r,
  playbookId:opts.pb!==undefined?opts.pb:'pb1',
  setupTags:['MSB','BOS'],
  grade:opts.grade||'B',
  status:opts.status||'closed',
  simType:opts.sim||'',
  tpLevels:[],
  notes:opts.notes||''
});

const FAKE_TRADES=[
  // Backtest trades — 3 winners, 1 loser
  mkTrade(1,{date:'2026-05-10',pnl:120,r:1.5,status:'missed',sim:'backtest',grade:'A'}),
  mkTrade(2,{date:'2026-05-11',pnl:180,r:2.0,status:'missed',sim:'backtest',grade:'A'}),
  mkTrade(3,{date:'2026-05-12',pnl:-90,r:-1.0,status:'missed',sim:'backtest',grade:'B'}),
  mkTrade(4,{date:'2026-05-13',pnl:240,r:2.2,status:'missed',sim:'backtest',grade:'A',sym:'ETH'}),
  // Real trades
  mkTrade(5,{date:'2026-05-14',pnl:60,r:0.8,status:'closed'}),
  mkTrade(6,{date:'2026-05-15',pnl:-50,r:-0.6,status:'closed',sym:'ETH'}),
  // Paper trade
  mkTrade(7,{date:'2026-05-16',pnl:100,r:1.2,status:'missed',sim:'paper'})
];

const FAKE_PLAYBOOKS=[{
  id:'pb1',name:'1h MSB BOS',oneLiner:'1h timeframe MSB+BOS retest',
  defaultGrade:'A',minRR:'2',layers:[],setupTags:['MSB','BOS'],
  timeframes:['1h'],confirmations:[],pairs:[],sessions:[],
  criteria:[],antiCriteria:[],bigPictureEnabled:false
}];

async function seedRich(page){
  await page.addInitScript(({trades,playbooks})=>{
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
    localStorage.setItem('tj_playbooks',JSON.stringify(playbooks));
    localStorage.setItem('tj_trades',JSON.stringify(trades));
  },{trades:FAKE_TRADES,playbooks:FAKE_PLAYBOOKS});
}

test('untagged trades (geen playbookId) verschijnen ook in prompt',async({page})=>{
  // Scenario: 10 trades zonder playbookId — moeten samen in "untagged" bucket
  const untaggedTrades=Array.from({length:10},(_,i)=>mkTrade('u'+i,{
    date:'2026-05-1'+(i%9),pnl:i%2?-50:80,r:i%2?-0.5:1.2,pb:'',
    status:i%3===0?'missed':'closed',sim:i%3===0?'backtest':''
  }));
  await page.addInitScript(({trades,playbooks})=>{
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
    localStorage.setItem('tj_playbooks',JSON.stringify(playbooks));
    localStorage.setItem('tj_trades',JSON.stringify(trades));
  },{trades:untaggedTrades,playbooks:FAKE_PLAYBOOKS});

  let captured=null;
  await page.route('https://api.anthropic.com/v1/messages',async(route,req)=>{
    captured=JSON.parse(req.postData()||'{}');
    route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      content:[{type:"text",text:"ok"}],usage:{input_tokens:100,output_tokens:10}
    })});
  });

  await page.goto(FILE_URL+'?ai=1',{waitUntil:'networkidle'});
  await page.waitForTimeout(500);
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
  await page.evaluate(()=>{
    const sec=document.getElementById('sec-chat');
    const b=Array.from(sec.querySelectorAll('button')).find(b=>/Nieuwe chat/i.test(b.textContent));
    if(b)b.click();
  });
  await page.waitForTimeout(150);
  await page.evaluate(()=>{
    const ta=document.querySelector('#sec-chat textarea');
    const setter=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;
    setter.call(ta,'analyse mijn trades');
    ta.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.evaluate(()=>{
    const sec=document.getElementById('sec-chat');
    const b=Array.from(sec.querySelectorAll('button')).find(b=>/Verstuur/.test(b.textContent));
    if(b)b.click();
  });
  await page.waitForFunction(()=>{
    const sec=document.getElementById('sec-chat');
    return sec&&/ok/.test(sec.textContent);
  },{timeout:5000});

  const sys=captured.system||'';
  // Untagged trades moeten als (geen playbook gekoppeld) verschijnen
  expect(sys).toMatch(/geen playbook gekoppeld/);
  // Splits: i%3===0 → backtest (i=0,3,6,9 = 4 trades), rest real (= 6)
  expect(sys).toMatch(/real:\s*6t/);
  expect(sys).toMatch(/backtest:\s*4t/);
});

test('chat system prompt bevat per-playbook backtest-data',async({page})=>{
  await seedRich(page);
  let captured=null;
  await page.route('https://api.anthropic.com/v1/messages',async(route,req)=>{
    captured=JSON.parse(req.postData()||'{}');
    route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      content:[{type:"text",text:"Op basis van je backtests scoor je mooi op MSB BOS."}],
      usage:{input_tokens:200,output_tokens:50}
    })});
  });

  await page.goto(FILE_URL+'?ai=1',{waitUntil:'networkidle'});
  await page.waitForTimeout(500);
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
  // Nieuwe chat + stuur de vraag
  await page.evaluate(()=>{
    const sec=document.getElementById('sec-chat');
    const b=Array.from(sec.querySelectorAll('button')).find(b=>/Nieuwe chat/i.test(b.textContent));
    if(b)b.click();
  });
  await page.waitForTimeout(150);
  await page.evaluate(()=>{
    const ta=document.querySelector('#sec-chat textarea');
    const setter=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;
    setter.call(ta,'wat vind je van de backtest trades van de 1h MSB BOS playbook?');
    ta.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.evaluate(()=>{
    const sec=document.getElementById('sec-chat');
    const b=Array.from(sec.querySelectorAll('button')).find(b=>/Verstuur/.test(b.textContent));
    if(b)b.click();
  });
  await page.waitForFunction(()=>{
    const sec=document.getElementById('sec-chat');
    return sec&&/Op basis van je backtests/.test(sec.textContent);
  },{timeout:5000});

  expect(captured).toBeTruthy();
  const sys=captured.system||'';

  // Per-playbook breakdown moet aanwezig zijn
  expect(sys).toMatch(/per playbook/i);
  expect(sys).toMatch(/1h MSB BOS/);
  // Backtest-count voor deze playbook (4 backtest trades)
  expect(sys).toMatch(/backtest:\s*4t/);
  // Real count (2 real)
  expect(sys).toMatch(/real:\s*2t/);
  // Paper count (1 paper)
  expect(sys).toMatch(/paper:\s*1t/);

  // Recente trades sample moet aanwezig zijn met type-tags
  expect(sys).toMatch(/Recente trades/);
  expect(sys).toMatch(/\[BT\]/);
  expect(sys).toMatch(/\[PAPER\]/);
});
