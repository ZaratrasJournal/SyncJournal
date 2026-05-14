// Repro: BT-trade met TP1=hit + TP2=missed → reload → wat overleeft?
// Denny's klacht: 2e missed-TP verdwijnt + loss-marking gaat verloren.
const{chromium}=require("playwright");
const path=require("path");

const APP=path.resolve(__dirname,"../work/tradejournal.html");
const FILE_URL="file:///"+APP.replace(/\\/g,"/");

// BT-trade met mixed TPs zoals user beschrijft. Scenario: TP2 prijs gezet op SL-niveau
// (LONG entry=80000, TP2 op 79500 = SL-prijs) om de "loss" trade te modelleren.
const BT_TRADE={
  id:"bt_mixed",date:"2026-05-12",time:"10:00",pair:"BTC/USDT",direction:"long",
  entry:"80000",exit:"",stopLoss:"79500",positionSize:"1000",positionSizeAsset:"0.0125",
  pnl:"",fees:"",leverage:"10",source:"manual",status:"missed",simType:"backtest",
  setupTags:["BOS"],layers:[],
  // TP1=hit (winst), TP2=missed met prijs op SL-niveau (79500 < entry 80000 voor LONG)
  tpLevels:[
    {id:"tp1",price:"81000",pct:"50",status:"hit",actualPrice:"81000"},
    {id:"tp2",price:"79500",pct:"50",status:"missed",actualPrice:""},
  ],
  hindsightExit:"",rating:3,manualOverrides:[],
  tpTemplateId:"",
};

(async()=>{
  const browser=await chromium.launch();
  const ctx=await browser.newContext({viewport:{width:1400,height:900}});
  const page=await ctx.newPage();
  page.on("pageerror",err=>console.error("PAGE ERROR:",err.message));
  page.on("console",msg=>{if(msg.type()==="error"&&!/BABEL|favicon/.test(msg.text()))console.error("CONSOLE:",msg.text())});

  await page.addInitScript(({trade})=>{
    localStorage.setItem("tj_welcomed","1");
    localStorage.setItem("tj_trades",JSON.stringify([trade]));
    try{indexedDB.deleteDatabase("TradeJournalDB")}catch{}
  },{trade:BT_TRADE});

  console.log("\n=== STAP 1: Eerste load ===");
  await page.goto(FILE_URL,{waitUntil:"networkidle"});
  await page.waitForFunction(()=>/Dashboard/i.test(document.body.innerText),{timeout:15000});
  await page.waitForTimeout(2000);

  const initial=await page.evaluate(()=>{
    const stored=JSON.parse(localStorage.getItem("tj_trades")||"[]");
    return{
      count:stored.length,
      tpLevels:stored[0]?.tpLevels||[],
      status:stored[0]?.status,
      pnl:stored[0]?.pnl,
    };
  });
  console.log("Trade na eerste load:");
  console.log("  status:",initial.status,"| pnl:",JSON.stringify(initial.pnl));
  console.log("  tpLevels (",initial.tpLevels.length,"):",JSON.stringify(initial.tpLevels,null,2));

  console.log("\n=== STAP 2: Reload ===");
  await page.reload({waitUntil:"networkidle"});
  await page.waitForFunction(()=>/Dashboard/i.test(document.body.innerText),{timeout:15000});
  await page.waitForTimeout(2000);

  const afterReload=await page.evaluate(()=>{
    const stored=JSON.parse(localStorage.getItem("tj_trades")||"[]");
    return{
      count:stored.length,
      tpLevels:stored[0]?.tpLevels||[],
      status:stored[0]?.status,
      pnl:stored[0]?.pnl,
    };
  });
  console.log("Trade na reload:");
  console.log("  status:",afterReload.status,"| pnl:",JSON.stringify(afterReload.pnl));
  console.log("  tpLevels (",afterReload.tpLevels.length,"):",JSON.stringify(afterReload.tpLevels,null,2));

  console.log("\n=== DIFF ===");
  const lost=initial.tpLevels.length-afterReload.tpLevels.length;
  if(lost>0)console.log(`❌ ${lost} TPs verloren na reload`);
  else console.log("✓ Alle TPs behouden");
  const initialMissed=initial.tpLevels.filter(t=>t.status==="missed").length;
  const reloadMissed=afterReload.tpLevels.filter(t=>t.status==="missed").length;
  if(reloadMissed<initialMissed)console.log(`❌ ${initialMissed-reloadMissed} 'missed' TPs gewist`);

  await browser.close();
})();
