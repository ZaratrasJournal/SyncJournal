// v12.127: privacy-mode globale toggle test.
const{test,expect}=require("@playwright/test");
const path=require("path");

const APP=path.resolve(__dirname,"../work/tradejournal.html");
const FILE_URL="file:///"+APP.replace(/\\/g,"/");

const DEMO_TRADES=[
  {id:"t1",date:"2026-05-01",time:"10:00",pair:"BTC/USDT",direction:"long",
    entry:"80000",exit:"81000",stopLoss:"79500",positionSize:"1000",positionSizeAsset:"0.0125",
    pnl:"125.50",fees:"5",leverage:"10",source:"manual",status:"closed",
    setupTags:["BOS"],layers:[],tpLevels:[],rating:4,manualOverrides:[]},
  {id:"t2",date:"2026-05-02",time:"14:00",pair:"ETH/USDT",direction:"short",
    entry:"3500",exit:"3450",stopLoss:"3550",positionSize:"500",positionSizeAsset:"0.143",
    pnl:"-25.00",fees:"3",leverage:"5",source:"manual",status:"closed",
    setupTags:["SFP"],layers:[],tpLevels:[],rating:3,manualOverrides:[]},
];

test("privacy-mode toggle maskeert bedragen op Dashboard",async({page})=>{
  await page.addInitScript(({trades})=>{
    localStorage.setItem("tj_welcomed","1");
    localStorage.setItem("tj_trades",JSON.stringify(trades));
    localStorage.setItem("tj_privacy_mode","0");
    try{indexedDB.deleteDatabase("TradeJournalDB")}catch{}
  },{trades:DEMO_TRADES});

  await page.goto(FILE_URL,{waitUntil:"networkidle"});
  await page.waitForFunction(()=>/Dashboard/i.test(document.body.innerText),{timeout:15000});
  await page.waitForTimeout(1500);

  // Topbar 👁-knop bestaat met aria-label
  const btnLocator=page.locator('button[aria-label="Verberg bedragen"]');
  await expect(btnLocator).toHaveCount(1);

  // Initial state: bedragen zichtbaar, geen masker
  const before=await page.evaluate(()=>document.body.innerText);
  expect(before).toContain("$");
  expect(before).not.toContain("$***,**");

  // DOM-click via .click() omdat Playwright's page.click() niet propageert naar
  // React's onClick in deze setup (bekend Playwright+React gedrag op file:// origin).
  await page.evaluate(()=>document.querySelector('button[aria-label="Verberg bedragen"]').click());
  await page.waitForTimeout(600);

  const persist=await page.evaluate(()=>localStorage.getItem("tj_privacy_mode"));
  expect(persist).toBe("1");
  const after=await page.evaluate(()=>document.body.innerText);
  expect(after).toContain("$***,**");

  // Toggle terug
  await page.evaluate(()=>document.querySelector('button[aria-label="Toon bedragen"]').click());
  await page.waitForTimeout(600);
  const persistOff=await page.evaluate(()=>localStorage.getItem("tj_privacy_mode"));
  expect(persistOff).toBe("0");
  const restored=await page.evaluate(()=>document.body.innerText);
  expect(restored).not.toContain("$***,**");
});
