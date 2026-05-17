// v12.130 fix scopte heal naar source!=="manual" — maar custom accounts hebben
// source = account.name (bv. "Bybit Demo"), niet "manual". Heal triggert dan nog.
const{chromium}=require("playwright");
const path=require("path");

const APP=path.resolve(__dirname,"../work/tradejournal.html");
const FILE_URL="file:///"+APP.replace(/\\/g,"/");

// Scenario: BT-trade aangemaakt met source="Mijn BT Account" (custom account-naam)
const BT_TRADE_CUSTOM_ACCOUNT={
  id:"bt_acct",date:"2026-05-12",time:"10:00",pair:"BTC/USDT",direction:"long",
  entry:"80000",exit:"",stopLoss:"79500",positionSize:"1000",positionSizeAsset:"0.0125",
  pnl:"",fees:"",leverage:"10",
  source:"Mijn BT Account",// ← custom account-naam, NIET "manual"
  status:"missed",simType:"backtest",
  setupTags:["BOS"],layers:[],
  tpLevels:[
    {id:"tp1",price:"81000",pct:"50",status:"hit",actualPrice:"81000"},
    {id:"tp2",price:"79500",pct:"50",status:"missed",actualPrice:""},
  ],
  hindsightExit:"",rating:3,manualOverrides:[],tpTemplateId:"",
};

(async()=>{
  const browser=await chromium.launch();
  const ctx=await browser.newContext({viewport:{width:1400,height:900}});
  const page=await ctx.newPage();
  page.on("pageerror",err=>console.error("PAGE ERROR:",err.message));

  await page.addInitScript(({trade})=>{
    localStorage.setItem("tj_welcomed","1");
    localStorage.setItem("tj_trades",JSON.stringify([trade]));
    localStorage.setItem("tj_accounts",JSON.stringify([{id:"acc1",name:"Mijn BT Account",balance:1000}]));
    try{indexedDB.deleteDatabase("TradeJournalDB")}catch{}
  },{trade:BT_TRADE_CUSTOM_ACCOUNT});

  console.log("=== Seed: BT trade met source='Mijn BT Account' ===");
  console.log("TPs voor load:",BT_TRADE_CUSTOM_ACCOUNT.tpLevels.map(tp=>`${tp.price} (${tp.status})`).join(" + "));

  await page.goto(FILE_URL,{waitUntil:"networkidle"});
  await page.waitForFunction(()=>/Dashboard/i.test(document.body.innerText),{timeout:15000});
  await page.waitForTimeout(2000);

  const after=await page.evaluate(()=>{
    const stored=JSON.parse(localStorage.getItem("tj_trades")||"[]");
    return{
      source:stored[0]?.source,
      tpCount:stored[0]?.tpLevels?.length||0,
      stopLoss:stored[0]?.stopLoss,
      tps:stored[0]?.tpLevels||[],
    };
  });

  console.log("\n=== Na load ===");
  console.log("source:",after.source);
  console.log("stopLoss:",after.stopLoss);
  console.log("TPs na load:",after.tps.map(tp=>`${tp.price} (${tp.status})`).join(" + "));
  console.log("TP-count:",after.tpCount);

  if(after.tpCount===2)console.log("\n✓ Alle TPs behouden");
  else console.log(`\n❌ ${2-after.tpCount} TPs verloren — heal triggerde voor non-manual source`);

  await browser.close();
})();
