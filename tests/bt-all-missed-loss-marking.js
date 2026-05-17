// User scenario:
// - BT-trade LONG, entry=80000, SL=79500
// - TP1=81000 (winst, eerst hit)
// - TP2=79500 (= SL-prijs, voor "SL hit" modellering)
// - Klik "Mark als verlies" → beide TPs nu status="missed"
// - Reload → TP2 verdwijnt, loss-markering weg
const{chromium}=require("playwright");
const path=require("path");

const APP=path.resolve(__dirname,"../work/tradejournal.html");
const FILE_URL="file:///"+APP.replace(/\\/g,"/");

const BT_TRADE={
  id:"bt_all_missed",date:"2026-05-12",time:"10:00",pair:"BTC/USDT",direction:"long",
  entry:"80000",exit:"",stopLoss:"79500",positionSize:"1000",positionSizeAsset:"0.0125",
  pnl:"",fees:"",leverage:"10",
  source:"manual",   // ← echt letterlijk "manual"
  status:"missed",simType:"backtest",
  setupTags:["BOS"],layers:[],
  // BEIDE TPs missed (na "Mark als verlies" knop click)
  tpLevels:[
    {id:"tp1",price:"81000",pct:"50",status:"missed",actualPrice:""},
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
    try{indexedDB.deleteDatabase("TradeJournalDB")}catch{}
  },{trade:BT_TRADE});

  console.log("=== Seed: source='manual', beide TPs missed ===");
  console.log("TPs voor load:",BT_TRADE.tpLevels.map(tp=>`${tp.price} (${tp.status})`).join(" + "));

  await page.goto(FILE_URL,{waitUntil:"networkidle"});
  await page.waitForFunction(()=>/Dashboard/i.test(document.body.innerText),{timeout:15000});
  await page.waitForTimeout(2000);

  const after=await page.evaluate(()=>{
    const stored=JSON.parse(localStorage.getItem("tj_trades")||"[]");
    return{
      source:stored[0]?.source,status:stored[0]?.status,simType:stored[0]?.simType,
      stopLoss:stored[0]?.stopLoss,
      tps:stored[0]?.tpLevels||[],
    };
  });

  console.log("\n=== Na load ===");
  console.log("source:",after.source,"| status:",after.status,"| simType:",after.simType);
  console.log("stopLoss:",after.stopLoss);
  console.log("TPs (",after.tps.length,"):",after.tps.map(tp=>`${tp.price} (${tp.status})`).join(" + ")||"(geen)");

  // Allmissed-check (= loss-markering pill conditie)
  const allMissed=after.tps.length>0&&after.tps.every(tp=>tp.status==="missed");
  console.log("\nallMissed (loss-markering pill):",allMissed);

  if(after.tps.length===2&&allMissed){
    console.log("✓ Bug niet gereproduceerd — alle 2 TPs missed, loss-markering blijft");
  }else if(after.tps.length<2){
    console.log(`❌ Bug gereproduceerd — ${2-after.tps.length} TPs verloren bij load`);
  }else if(!allMissed){
    console.log("❌ Bug gereproduceerd — status van een TP veranderd, loss-markering weg");
  }

  await browser.close();
})();
