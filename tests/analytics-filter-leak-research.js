// Research: welke Analytics-secties respecteren de date-filter, en welke niet?
// Seed 10 trades: 5 vorige week + 5 deze week. Filter op "Deze week". Verifieer welke
// counts/aggregates de filter respecteren.
const{chromium}=require("playwright");
const path=require("path");

const APP=path.resolve(__dirname,"../work/tradejournal.html");
const FILE_URL="file:///"+APP.replace(/\\/g,"/");

function dateOffset(days){
  const d=new Date();
  d.setDate(d.getDate()-days);
  return d.toISOString().split("T")[0];
}

// 5 trades vorige week + 5 deze week. Mix wins/losses.
const TRADES=[];
for(let i=0;i<10;i++){
  const isThisWeek=i>=5;
  const offset=isThisWeek?i-5:7+(i-0); // 0-4 = 7-11 days ago, 5-9 = 0-4 days ago
  const win=i%2===0;
  TRADES.push({
    id:`t${i}`,
    date:dateOffset(offset),time:"10:00",
    pair:"BTC/USDT",direction:"long",
    entry:"80000",exit:win?"81000":"79500",stopLoss:"79500",
    positionSize:"1000",positionSizeAsset:"0.0125",
    pnl:win?"125.50":"-65.00",fees:"5",leverage:"10",
    source:"manual",status:"closed",
    setupTags:["BOS"],layers:[],tpLevels:[],
    rating:3,manualOverrides:[],tpTemplateId:"",
  });
}

(async()=>{
  const browser=await chromium.launch();
  const ctx=await browser.newContext({viewport:{width:1400,height:1100}});
  const page=await ctx.newPage();
  page.on("pageerror",err=>console.error("PAGE ERROR:",err.message));

  await page.addInitScript(({trades})=>{
    localStorage.setItem("tj_welcomed","1");
    localStorage.setItem("tj_trades",JSON.stringify(trades));
    try{indexedDB.deleteDatabase("TradeJournalDB")}catch{}
  },{trades:TRADES});

  await page.goto(FILE_URL,{waitUntil:"networkidle"});
  await page.waitForFunction(()=>/Dashboard/i.test(document.body.innerText),{timeout:15000});
  await page.waitForTimeout(1500);

  // Naar Analytics
  await page.evaluate(()=>{
    const btn=[...document.querySelectorAll("button")].find(b=>/Analytics/.test(b.textContent)&&b.className.includes("tj-tab"));
    if(btn)btn.click();
  });
  await page.waitForTimeout(1000);

  // STATE A: zonder filter
  const stateA=await page.evaluate(()=>{
    return{
      textBeforeFilter:document.body.innerText.slice(0,6000),
    };
  });

  // Klap geavanceerde filters open en zet "Deze week"
  await page.evaluate(()=>{
    const btn=[...document.querySelectorAll("div,span")].find(el=>el.textContent==="Geavanceerde filters");
    if(btn)btn.click();
  });
  await page.waitForTimeout(400);
  await page.evaluate(()=>{
    const btn=[...document.querySelectorAll("button")].find(b=>b.textContent.trim()==="Deze week");
    if(btn)btn.click();
  });
  await page.waitForTimeout(1500);

  const stateB=await page.evaluate(()=>{
    return{
      textWithFilter:document.body.innerText.slice(0,6000),
    };
  });

  // Extract counts from texts
  const extract=(txt,pattern)=>{
    const m=txt.match(pattern);
    return m?m[1]:"(geen match)";
  };

  console.log("\n=== STATE A: Analytics zonder filter ===");
  // Extract patterns
  console.log("Sample-size hint:",extract(stateA.textBeforeFilter,/Over (\d+) trades is je overall/));
  console.log("Sample-size waarschuwing:",extract(stateA.textBeforeFilter,/(\d+ trades) — onder de 30/));
  // Find specific PnL totaal
  const netA=stateA.textBeforeFilter.match(/Netto PNL[\s\S]{0,150}(\+?\-?\$[\d.,]+)/);
  console.log("Net PnL display:",netA?netA[1]:"(niet gevonden)");

  console.log("\n=== STATE B: Analytics met 'Deze week' filter ===");
  console.log("Sample-size hint:",extract(stateB.textWithFilter,/Over (\d+) trades is je overall/));
  console.log("Sample-size waarschuwing:",extract(stateB.textWithFilter,/(\d+ trades) — onder de 30/));
  const netB=stateB.textWithFilter.match(/Netto PNL[\s\S]{0,150}(\+?\-?\$[\d.,]+)/);
  console.log("Net PnL display:",netB?netB[1]:"(niet gevonden)");

  // Save full screenshots
  await page.screenshot({path:path.join(__dirname,"screenshots","analytics-filter-leak-A.png"),fullPage:true});
  console.log("\nScreenshot State B (met filter):",path.join(__dirname,"screenshots","analytics-filter-leak-A.png"));

  await browser.close();
})();
