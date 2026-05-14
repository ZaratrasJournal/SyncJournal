// v12.130: regressie-test dat de SL-as-TP heal nog werkt voor exchange-source
// maar NIET voor manual (incl. BT/paper) trades.
const{chromium}=require("playwright");
const path=require("path");

const APP=path.resolve(__dirname,"../work/tradejournal.html");
const FILE_URL="file:///"+APP.replace(/\\/g,"/");

// Scenario 1: Blofin SHORT trade met TP-rij die eigenlijk SL-prijs is (worker-bug pre-v12.104).
// Heal MOET deze verwijderen.
const BLOFIN_TRADE={
  id:"blofin_short_buggy",date:"2026-05-12",time:"10:00",pair:"BTC/USDT",direction:"short",
  entry:"80000",exit:"",stopLoss:"",positionSize:"1000",positionSizeAsset:"0.0125",
  pnl:"",fees:"",leverage:"10",source:"blofin",status:"open",
  setupTags:[],layers:[],
  tpLevels:[
    {id:"tp1",price:"79000",pct:"50",status:"open",actualPrice:""},  // legit TP (below entry for short)
    {id:"tp2",price:"81000",pct:"50",status:"open",actualPrice:""},  // SL-as-TP (above entry for short) → moet weg
  ],
  hindsightExit:"",rating:3,manualOverrides:[],tpTemplateId:"",
};

// Scenario 2: Manual BT-trade met intentional TP-prijs op SL-niveau (user wil loss modelleren).
// Heal moet ÉCHT NIET ingrijpen.
const BT_TRADE={
  id:"bt_intentional_sl_price",date:"2026-05-12",time:"10:00",pair:"BTC/USDT",direction:"long",
  entry:"80000",exit:"",stopLoss:"79500",positionSize:"1000",positionSizeAsset:"0.0125",
  pnl:"",fees:"",leverage:"10",source:"manual",status:"missed",simType:"backtest",
  setupTags:["BOS"],layers:[],
  tpLevels:[
    {id:"tp1",price:"81000",pct:"50",status:"hit",actualPrice:"81000"},
    {id:"tp2",price:"79500",pct:"50",status:"missed",actualPrice:""},  // SL-side price, intentional
  ],
  hindsightExit:"",rating:3,manualOverrides:[],tpTemplateId:"",
};

async function loadAndInspect(trade,label){
  const browser=await chromium.launch();
  const ctx=await browser.newContext({viewport:{width:1400,height:900}});
  const page=await ctx.newPage();
  page.on("pageerror",err=>console.error("PAGE ERROR:",err.message));

  await page.addInitScript(({t})=>{
    localStorage.setItem("tj_welcomed","1");
    localStorage.setItem("tj_trades",JSON.stringify([t]));
    try{indexedDB.deleteDatabase("TradeJournalDB")}catch{}
  },{t:trade});

  await page.goto(FILE_URL,{waitUntil:"networkidle"});
  await page.waitForFunction(()=>/Dashboard/i.test(document.body.innerText),{timeout:15000});
  await page.waitForTimeout(2000);

  const result=await page.evaluate(()=>{
    const stored=JSON.parse(localStorage.getItem("tj_trades")||"[]");
    return{
      tpCount:stored[0]?.tpLevels?.length||0,
      stopLoss:stored[0]?.stopLoss,
      tps:stored[0]?.tpLevels||[],
    };
  });

  await browser.close();
  console.log(`\n=== ${label} ===`);
  console.log(`Original TPs: ${trade.tpLevels.length} | Post-load: ${result.tpCount}`);
  console.log(`Original stopLoss: "${trade.stopLoss}" | Post-load: "${result.stopLoss}"`);
  return result;
}

(async()=>{
  // Blofin: heal moet TP2 (SL-as-TP) verwijderen + stopLoss vullen
  const blofin=await loadAndInspect(BLOFIN_TRADE,"Blofin SHORT met SL-as-TP (heal MOET werken)");
  let blofinOK=true;
  if(blofin.tpCount!==1){console.log(`❌ Verwacht 1 TP, kreeg ${blofin.tpCount}`);blofinOK=false}
  if(blofin.stopLoss!=="81000"){console.log(`❌ Verwacht stopLoss="81000", kreeg "${blofin.stopLoss}"`);blofinOK=false}
  if(blofinOK)console.log("✓ Heal correct: TP2 verwijderd, stopLoss gevuld");

  // BT/manual: heal moet ÉCHT NIET ingrijpen
  const bt=await loadAndInspect(BT_TRADE,"Manual BT met intentional SL-prijs als TP (heal MOET SKIPPEN)");
  let btOK=true;
  if(bt.tpCount!==2){console.log(`❌ Verwacht 2 TPs, kreeg ${bt.tpCount} — heal heeft fout ingegrepen`);btOK=false}
  if(bt.stopLoss!=="79500"){console.log(`❌ stopLoss veranderd: "${bt.stopLoss}"`);btOK=false}
  if(btOK)console.log("✓ Heal correct geskipt: alle TPs behouden");

  process.exit(blofinOK&&btOK?0:1);
})();
