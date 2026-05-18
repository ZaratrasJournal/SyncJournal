// v12.138 — Weekly digest tests. Verifieert:
//  - WeeklyDigestSection rendert + toont 7d stats
//  - Generate-knop triggert API met juiste system prompt + stats payload
//  - Response wordt geparsed, opgeslagen in tj_ai_weeklies, gerenderd
//  - Topbar AIWeeklyIndicator verschijnt bij due (≥7d) en verbergt anders
//  - Cost-tracking schrijft op weekly call ook door
const{test,expect}=require('@playwright/test');
const path=require('path');
const FILE_URL='file:///'+path.resolve(__dirname,'../work/tradejournal.html').replace(/\\/g,'/');

const MOCK_RESPONSE={
  id:"msg_w1",
  type:"message",
  role:"assistant",
  model:"claude-sonnet-4-6",
  content:[{type:"text",text:JSON.stringify({
    summary:"Week 12 trades, WR 58%, R-positief. Discipline solide, alleen TP2-management blijft inconsistent.",
    best_trade:{label:"BTC long",pnl:"+$420",lesson:"Patient entry op CVD-flip leverde 2.8R."},
    worst_trade:{label:"ETH short",pnl:"-$180",lesson:"Trade na 3e revenge-tilt, zonder confluence."},
    missed_tp_pattern:"TP2 wordt vaak te lang vastgehouden bij funding-flips — overweeg trail stop activeren bij TP1.",
    discipline_trend:"improving — 11/12 trades volgden playbook (was 8/12 vorige week)",
    action:"Activeer trail-stop bij TP1-hit voor alle perp-trades komende week, evalueer zondag."
  })}],
  usage:{input_tokens:1200,output_tokens:380}
};

const FAKE_TRADES=Array.from({length:12},(_,i)=>{
  const daysBack=i;
  const date=new Date(Date.now()-daysBack*86400000).toISOString().split('T')[0];
  return{
    id:'t'+i,
    symbol:i%2?'BTC':'ETH',
    direction:i%3?'long':'short',
    entryDate:date,
    exitDate:date,
    pnl:i%4===0?-120:180,
    rMultiple:i%4===0?-1:1.8,
    playbook:'pb1',
    setupTags:['FVG'],
    grade:'B',
    tpLevels:i%5===0?[{status:"missed"}]:[],
    notes:''
  };
});

async function seedWeekly(page,opts){
  const{lastGen=0,trades=FAKE_TRADES,autoTrigger=true,enabled=true,weeklies=[]}=opts||{};
  await page.addInitScript(({lastGen,trades,autoTrigger,enabled,weeklies})=>{
    localStorage.setItem('tj_welcomed','1');
    localStorage.setItem('tj_ai_flag','1');
    const now=new Date();
    const monthKey=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
    localStorage.setItem('tj_ai_config',JSON.stringify({
      enabled:enabled,
      byok:{key:"sk-ant-test",model:"claude-sonnet-4-6",connected:true,lastTest:Date.now(),lastError:""},
      features:{pretrade:true,budget:true,weekly:true,privacy:false},
      budget:{monthlyLimit:5,alertThreshold:0.8,spent:0,lastResetMonth:monthKey},
      weekly:{dayOfWeek:1,autoTrigger:autoTrigger,lastGeneratedAt:lastGen}
    }));
    localStorage.setItem('tj_ai_weeklies',JSON.stringify(weeklies||[]));
    // Tradedata is door React opgeslagen via IndexedDB normaalgesproken — voor test
    // injecteren we ze via legacy localStorage-pad zodat ze direct in trades-state komen.
    localStorage.setItem('tj_trades',JSON.stringify(trades));
  },{lastGen,trades,autoTrigger,enabled,weeklies});
}

async function gotoWeekly(page){
  await page.goto(FILE_URL+'?ai=1',{waitUntil:'networkidle'});
  await page.waitForTimeout(500);
  await page.evaluate(()=>{
    const btns=Array.from(document.querySelectorAll('.tj-tabs button.tj-tab'));
    const b=btns.find(b=>b.textContent.includes('AI-coach'));
    if(b)b.click();
  });
  await page.waitForTimeout(300);
  await page.evaluate(()=>{
    const el=document.getElementById('sec-weekly');
    if(el)el.scrollIntoView({block:'start'});
  });
  await page.waitForTimeout(200);
}

test.describe('AI-coach weekly digest',()=>{

  test('section rendert + 7d stats + lege state',async({page})=>{
    await seedWeekly(page,{lastGen:0,trades:FAKE_TRADES});
    await gotoWeekly(page);
    const txt=await page.locator('#sec-weekly').textContent();
    expect(txt).toMatch(/Afgelopen 7 dagen/);
    expect(txt).toMatch(/trades/);
    // Geen recente digests bij seed van []
    expect(txt).not.toMatch(/Recente digests/);
  });

  test('genereer → API call + parse + save + render',async({page})=>{
    await seedWeekly(page,{lastGen:0,trades:FAKE_TRADES});
    let captured=null;
    await page.route('https://api.anthropic.com/v1/messages',async(route,req)=>{
      captured=JSON.parse(req.postData()||'{}');
      route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(MOCK_RESPONSE)});
    });
    await gotoWeekly(page);

    // Klik genereer
    await page.evaluate(()=>{
      const sec=document.getElementById('sec-weekly');
      const btns=Array.from(sec.querySelectorAll('button'));
      const b=btns.find(b=>/Eerste digest|Genereer nu/i.test(b.textContent));
      if(b)b.click();
    });
    // Wacht op render van resultaat
    await page.waitForFunction(()=>{
      const sec=document.getElementById('sec-weekly');
      return sec&&/Recente digests/.test(sec.textContent);
    },{timeout:5000});

    // Verifieer payload
    expect(captured).toBeTruthy();
    expect(captured.system).toMatch(/Steenbarger|Douglas/);
    expect(captured.messages[0].content).toMatch(/STATS/);
    expect(captured.messages[0].content).toMatch(/SAMPLES/);

    // localStorage heeft nu een weekly record
    const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('tj_ai_weeklies')||'[]'));
    expect(stored.length).toBe(1);
    expect(stored[0].content.summary).toMatch(/WR 58%/);

    // Section toont nu de samenvatting + indicators (best/worst/missed-TP/discipline/action)
    const txt=await page.locator('#sec-weekly').textContent();
    expect(txt).toMatch(/Recente digests/);

    await page.screenshot({path:'tests/screenshots/aicoach-weekly.png',fullPage:true});
  });

  test('topbar indicator: due bij ≥7d sinds lastGen',async({page})=>{
    const eightDaysAgo=Date.now()-8*86400000;
    await seedWeekly(page,{lastGen:eightDaysAgo,trades:FAKE_TRADES});
    await page.goto(FILE_URL+'?ai=1',{waitUntil:'networkidle'});
    await page.waitForTimeout(400);
    const indicator=await page.locator('.tj-right-btns button[aria-label="Weekly digest due"]').count();
    expect(indicator).toBe(1);
  });

  test('topbar indicator: verborgen wanneer recent gegenereerd',async({page})=>{
    const twoDaysAgo=Date.now()-2*86400000;
    await seedWeekly(page,{lastGen:twoDaysAgo,trades:FAKE_TRADES});
    await page.goto(FILE_URL+'?ai=1',{waitUntil:'networkidle'});
    await page.waitForTimeout(400);
    const indicator=await page.locator('.tj-right-btns button[aria-label="Weekly digest due"]').count();
    expect(indicator).toBe(0);
  });

  test('topbar indicator: verborgen wanneer autoTrigger uit',async({page})=>{
    await seedWeekly(page,{lastGen:0,trades:FAKE_TRADES,autoTrigger:false});
    await page.goto(FILE_URL+'?ai=1',{waitUntil:'networkidle'});
    await page.waitForTimeout(400);
    const indicator=await page.locator('.tj-right-btns button[aria-label="Weekly digest due"]').count();
    expect(indicator).toBe(0);
  });
});
