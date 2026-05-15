// Research: visualiseer huidige truncatie van Setup-lagen labels + meet hoe breed
// een leesbare versie moet zijn voor de typische layer-pattern strings.
const{chromium}=require("playwright");
const path=require("path");

const APP=path.resolve(__dirname,"../work/tradejournal.html");
const FILE_URL="file:///"+APP.replace(/\\/g,"/");

// Trades met multi-layer setups — produceert layer-pattern labels.
const TRADES=[];
const layerCombos=[
  [{timeframe:"Daily",setups:["BOS"]},{timeframe:"1H",setups:["BOS","SFP"]}],
  [{timeframe:"4H",setups:["SFP"]},{timeframe:"1H",setups:["BOS","OB"]}],
  [{timeframe:"Daily",setups:["SFP"]},{timeframe:"15M",setups:["BOS"]}],
  [{timeframe:"1H",setups:["BOS"]}],
  [{timeframe:"Daily",setups:["MSB"]},{timeframe:"1H",setups:["BOS"]}],
];
for(let i=0;i<5;i++){
  TRADES.push({
    id:`t${i}`,date:"2026-05-12",time:"10:00",pair:"BTC/USDT",direction:"long",
    entry:"80000",exit:i%2?"81000":"79500",stopLoss:"79500",
    positionSize:"1000",positionSizeAsset:"0.0125",
    pnl:i%2?"125.50":"-65.00",fees:"5",leverage:"10",
    source:"manual",status:"closed",
    setupTags:["BOS"],layers:layerCombos[i].map((l,j)=>({id:`l${j}`,...l,confirmations:[]})),
    tpLevels:[],rating:3,manualOverrides:[],tpTemplateId:"",
  });
}

(async()=>{
  const browser=await chromium.launch();
  const ctx=await browser.newContext({viewport:{width:1400,height:1100}});
  const page=await ctx.newPage();

  await page.addInitScript(({trades})=>{
    localStorage.setItem("tj_welcomed","1");
    localStorage.setItem("tj_trades",JSON.stringify(trades));
    try{indexedDB.deleteDatabase("TradeJournalDB")}catch{}
  },{trades:TRADES});

  await page.goto(FILE_URL,{waitUntil:"networkidle"});
  await page.waitForFunction(()=>/Dashboard/i.test(document.body.innerText),{timeout:15000});
  await page.waitForTimeout(1500);

  await page.evaluate(()=>{
    const btn=[...document.querySelectorAll("button")].find(b=>/Analytics/.test(b.textContent)&&b.className.includes("tj-tab"));
    if(btn)btn.click();
  });
  await page.waitForTimeout(1000);

  // Meet de daadwerkelijke breedte die layer-labels nodig zouden hebben.
  const labelInfo=await page.evaluate(()=>{
    // Vind Setup lagen performance sectie
    const headers=[...document.querySelectorAll("div")].filter(d=>/Setup lagen performance/i.test(d.textContent));
    if(!headers.length)return{found:false};
    // Pak de bar-rows binnen die sectie (parent → siblings)
    const section=headers[0].closest("[style*='border']")||headers[0].parentElement;
    const labelDivs=[...section.querySelectorAll("div")].filter(d=>{
      const style=getComputedStyle(d);
      return style.textOverflow==="ellipsis"&&style.whiteSpace==="nowrap";
    });
    // Voor elk label-div: meet wat scrollWidth zou zijn zonder truncatie
    const measurements=labelDivs.map(d=>({
      visibleText:d.innerText,
      title:d.getAttribute("title"),
      currentWidth:d.offsetWidth,
      scrollWidth:d.scrollWidth,
      truncated:d.scrollWidth>d.offsetWidth,
    }));
    return{found:true,count:labelDivs.length,measurements};
  });

  console.log("\n=== Setup-lagen labels — current state ===");
  if(!labelInfo.found){
    console.log("Sectie niet gevonden — mogelijk geen trades met layers");
  }else{
    console.log(`Aantal label-divs: ${labelInfo.count}`);
    labelInfo.measurements.forEach((m,i)=>{
      console.log(`  ${i+1}. "${m.title||m.visibleText}" — current ${m.currentWidth}px, needed ${m.scrollWidth}px ${m.truncated?"⚠ TRUNCATED":""}`);
    });
    const maxNeeded=Math.max(...labelInfo.measurements.map(m=>m.scrollWidth),0);
    console.log(`\nMax breedte nodig voor volledig leesbaar: ${maxNeeded}px (huidige: 70px)`);
  }

  await page.screenshot({path:path.join(__dirname,"screenshots","setup-layer-labels-current.png"),fullPage:true});
  console.log("\nScreenshot:",path.join(__dirname,"screenshots","setup-layer-labels-current.png"));

  await browser.close();
})();
