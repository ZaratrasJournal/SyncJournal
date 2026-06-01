// UX-audit screenshots — 7 primaire schermen × 2 thema's (sync + light).
// Output: tests/screenshots/ux-audit/{theme}-{screen}.png
// Niet bedoeld voor regressie — alleen om de auditor (Claude/UX-designer)
// visueel materiaal te geven.
const{test}=require('@playwright/test');
const path=require('path');
const fs=require('fs');
const FILE_URL='file:///'+path.resolve(__dirname,'../work/tradejournal.html').replace(/\\/g,'/');
const DATA=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../demo-dataset-1000.json'),'utf-8'));
const OUT=path.resolve(__dirname,'screenshots','ux-audit');
fs.mkdirSync(OUT,{recursive:true});

const THEMES=['sync','light']; // dark + 1 light = systemische check
const SCREENS=[
  {id:'dashboard',label:'Dashboard',tab:'Dashboard'},
  {id:'trades',label:'Trades',tab:'Trades'},
  {id:'analytics',label:'Analytics',tab:'Analytics'},
  {id:'playbook',label:'Playbook',tab:'Playbook'},
  {id:'aicoach',label:'AI-coach',tab:'AI-coach'},
  {id:'instellingen',label:'Instellingen',tab:'Instellingen'},
];

async function seed(page,theme){
  await page.addInitScript(({data,theme})=>{
    localStorage.setItem('tj_welcomed','1');
    localStorage.setItem('tj_trades',JSON.stringify(data.trades));
    localStorage.setItem('tj_playbooks',JSON.stringify(data.playbooks));
    localStorage.setItem('tj_tags',JSON.stringify(data.tagConfig));
    localStorage.setItem('tj_accounts',JSON.stringify(data.accounts));
    // Sla theme + premium-layout op via tj_config
    const cfg=JSON.parse(localStorage.getItem('tj_config')||'{}');
    cfg.theme=theme;
    cfg.layout='premium';
    cfg.trackMissedTrades=true;
    localStorage.setItem('tj_config',JSON.stringify(cfg));
    // Backup-bewaker reminder unterdrücken voor schonere shot
    localStorage.setItem('tj_backup_reminder_off','1');
    localStorage.setItem('tj_backup_onboarding_shown','1');
    localStorage.setItem('tj_last_backup_at',String(Date.now()-86400000));
  },{data:DATA,theme});
}

for(const theme of THEMES){
  test.describe(`UX-audit ${theme}`,()=>{
    for(const screen of SCREENS){
      test(`${theme} · ${screen.label}`,async({page})=>{
        await seed(page,theme);
        await page.setViewportSize({width:1440,height:900});
        await page.goto(FILE_URL,{waitUntil:'networkidle'});
        await page.waitForTimeout(1500);
        // Navigeer naar tab
        if(screen.id!=='dashboard'){
          await page.evaluate((tabLabel)=>{
            const btns=Array.from(document.querySelectorAll('.tj-tabs button.tj-tab'));
            const b=btns.find(b=>b.textContent.includes(tabLabel));
            if(b)b.click();
          },screen.tab);
          await page.waitForTimeout(900);
        }
        await page.screenshot({path:path.join(OUT,`${theme}-${screen.id}.png`),fullPage:false});
      });
    }

    // Extra: trade-form modal open
    test(`${theme} · Trade-form (modal)`,async({page})=>{
      await seed(page,theme);
      await page.setViewportSize({width:1440,height:900});
      await page.goto(FILE_URL,{waitUntil:'networkidle'});
      await page.waitForTimeout(1500);
      // Open eerste trade — klik op rij in Trades
      await page.evaluate(()=>{
        const btns=Array.from(document.querySelectorAll('.tj-tabs button.tj-tab'));
        const b=btns.find(b=>b.textContent.includes('Trades'));
        if(b)b.click();
      });
      await page.waitForTimeout(800);
      // Klik op eerste trade in lijst
      await page.evaluate(()=>{
        const rows=document.querySelectorAll('tbody tr');
        if(rows.length)rows[0].click();
      });
      await page.waitForTimeout(900);
      await page.screenshot({path:path.join(OUT,`${theme}-tradeform.png`),fullPage:false});
    });

    // Extra: AI-chat popup open op Dashboard
    test(`${theme} · Chat popup`,async({page})=>{
      await seed(page,theme);
      await page.setViewportSize({width:1440,height:900});
      await page.addInitScript(()=>{
        // Master enable + dummy API key + dummy chats
        localStorage.setItem('tj_ai_config',JSON.stringify({
          enabled:true,
          byok:{key:'sk-ant-demo',model:'claude-sonnet-4-6',connected:true,lastTest:Date.now(),lastError:''},
          features:{pretrade:true,budget:true,weekly:true,privacy:true,floatingChat:true},
          budget:{monthlyLimit:5,alertThreshold:0.8,spent:0.42,lastResetMonth:'2026-06'},
          weekly:{dayOfWeek:1,autoTrigger:true,lastGeneratedAt:Date.now()-86400000},
          privacy:{amountMode:'off',customTickers:[],logLastPrompt:true}
        }));
        localStorage.setItem('tj_ai_chats',JSON.stringify([{
          id:'demo1',title:'1H MSB BOS analyse',createdAt:Date.now()-86400000,updatedAt:Date.now()-3600000,
          messages:[
            {role:'user',content:'Wat vind je van mijn 1h MSB BOS backtests?',ts:Date.now()-7200000},
            {role:'assistant',content:'## Sterke edge\n\n- 28 backtests, WR 75%, avgWin 2.9R, expectancy +1.94R\n- **Solide setup** voor London-open sessies\n\n## Punten van aandacht\n\n- avgR ligt onder je minRR — kijk naar TP-management\n- 7 losers verdienen analyse — patroon?',cost:0.0124,ts:Date.now()-7100000}
          ]
        }]));
      });
      await page.goto(FILE_URL,{waitUntil:'networkidle'});
      await page.waitForTimeout(1500);
      // Klik FAB
      await page.evaluate(()=>{
        const b=document.querySelector('button[aria-label="Open chat"]');
        if(b)b.click();
      });
      await page.waitForTimeout(700);
      await page.screenshot({path:path.join(OUT,`${theme}-chatpopup.png`),fullPage:false});
    });
  });
}
