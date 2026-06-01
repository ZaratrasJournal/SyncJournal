// v12.153 — Backup-bewaker: topbar-indicator + reminder + onboarding +
// soft recovery + import-timestamp. Voorkomt onbedoeld data-verlies door
// browser-wissen.
const{test,expect}=require('@playwright/test');
const path=require('path');
const FILE_URL='file:///'+path.resolve(__dirname,'../work/tradejournal.html').replace(/\\/g,'/');

const fakeTrade=(i)=>({
  id:'t'+i,date:'2026-05-1'+(i%9),time:'10:00',pair:'BTC/USDT',direction:'long',
  entry:'67000',stopLoss:'66500',takeProfit:'68000',exit:'67800',
  positionSize:'1000',pnl:'12.50',fees:'0.50',source:'blofin',status:'closed',
  setupTags:[],confirmationTags:[],timeframeTags:[],emotionTags:[],mistakeTags:[],
  customTags:[],layers:[],tpLevels:[],
});

async function seed(page,{lastBackupAt,reminderOff,snoozedAt,onboardingShown,tradeCount=10}){
  await page.addInitScript(({lastBackupAt,reminderOff,snoozedAt,onboardingShown,tradeCount})=>{
    localStorage.setItem('tj_welcomed','1');
    if(lastBackupAt!=null)localStorage.setItem('tj_last_backup_at',String(lastBackupAt));
    else localStorage.removeItem('tj_last_backup_at');
    if(reminderOff)localStorage.setItem('tj_backup_reminder_off','1');
    else localStorage.removeItem('tj_backup_reminder_off');
    if(snoozedAt)localStorage.setItem('tj_backup_reminder_snoozed_at',String(snoozedAt));
    else localStorage.removeItem('tj_backup_reminder_snoozed_at');
    if(onboardingShown)localStorage.setItem('tj_backup_onboarding_shown','1');
    else localStorage.removeItem('tj_backup_onboarding_shown');
    if(tradeCount>0){
      const arr=Array.from({length:tradeCount},(_,i)=>({
        id:'t'+i,date:'2026-05-1'+(i%9),time:'10:00',pair:'BTC/USDT',direction:'long',
        entry:'67000',stopLoss:'66500',takeProfit:'68000',exit:'67800',
        positionSize:'1000',pnl:'12.50',fees:'0.50',source:'blofin',status:'closed',
        setupTags:[],confirmationTags:[],timeframeTags:[],emotionTags:[],mistakeTags:[],
        customTags:[],layers:[],tpLevels:[],
      }));
      localStorage.setItem('tj_trades',JSON.stringify(arr));
    }
  },{lastBackupAt,reminderOff,snoozedAt,onboardingShown,tradeCount});
}

test('indicator zichtbaar — kleur "groen ✓" bij <3d',async({page})=>{
  await seed(page,{lastBackupAt:Date.now()-1*86400000}); // 1d oud
  await page.goto(FILE_URL,{waitUntil:'networkidle'});
  await page.waitForTimeout(800);
  const btn=page.locator('button[aria-label="Backup-leeftijd indicator"]');
  await expect(btn).toBeVisible();
  const txt=(await btn.textContent())||'';
  expect(txt).toContain('✓');
});

test('indicator label "8d" bij 8 dagen oud',async({page})=>{
  await seed(page,{lastBackupAt:Date.now()-8*86400000});
  await page.goto(FILE_URL,{waitUntil:'networkidle'});
  await page.waitForTimeout(800);
  const btn=page.locator('button[aria-label="Backup-leeftijd indicator"]');
  expect(await btn.textContent()).toContain('8d');
});

test('indicator label "!" wanneer nooit backup',async({page})=>{
  await seed(page,{lastBackupAt:null,tradeCount:0});
  await page.goto(FILE_URL,{waitUntil:'networkidle'});
  await page.waitForTimeout(800);
  const btn=page.locator('button[aria-label="Backup-leeftijd indicator"]');
  expect(await btn.textContent()).toContain('!');
});

test('reminder verschijnt bij ≥7d + ≥5 trades',async({page})=>{
  await seed(page,{lastBackupAt:Date.now()-8*86400000,tradeCount:10});
  await page.goto(FILE_URL,{waitUntil:'networkidle'});
  await page.waitForTimeout(1500); // IndexedDB-migratie
  await expect(page.locator('text=Tijd voor je wekelijkse backup')).toBeVisible();
});

test('reminder NIET bij <7d',async({page})=>{
  await seed(page,{lastBackupAt:Date.now()-3*86400000,tradeCount:10});
  await page.goto(FILE_URL,{waitUntil:'networkidle'});
  await page.waitForTimeout(1500);
  await expect(page.locator('text=Tijd voor je wekelijkse backup')).toHaveCount(0);
});

test('reminder NIET wanneer reminder_off=1',async({page})=>{
  await seed(page,{lastBackupAt:Date.now()-30*86400000,reminderOff:true,tradeCount:10});
  await page.goto(FILE_URL,{waitUntil:'networkidle'});
  await page.waitForTimeout(1500);
  await expect(page.locator('text=Tijd voor je wekelijkse backup')).toHaveCount(0);
});

test('snooze: na klik "Herinner morgen" verdwijnt modal + snooze localStorage',async({page})=>{
  await seed(page,{lastBackupAt:Date.now()-10*86400000,tradeCount:10});
  await page.goto(FILE_URL,{waitUntil:'networkidle'});
  await expect(page.getByText('Tijd voor je wekelijkse backup')).toBeVisible({timeout:5000});
  await page.evaluate(()=>{
    const b=Array.from(document.querySelectorAll('button')).find(b=>/Herinner morgen/.test(b.textContent));
    if(b)b.click();
  });
  await page.waitForTimeout(200);
  await expect(page.getByText('Tijd voor je wekelijkse backup')).toHaveCount(0);
  const snoozed=await page.evaluate(()=>localStorage.getItem('tj_backup_reminder_snoozed_at'));
  expect(parseInt(snoozed,10)).toBeGreaterThan(Date.now()-5000);
});

test('reminder NIET wanneer net gesnoozed (<24u)',async({page})=>{
  await seed(page,{lastBackupAt:Date.now()-10*86400000,snoozedAt:Date.now()-3600000,tradeCount:10}); // 1h ago
  await page.goto(FILE_URL,{waitUntil:'networkidle'});
  await page.waitForTimeout(1500);
  await expect(page.locator('text=Tijd voor je wekelijkse backup')).toHaveCount(0);
});

test('download-knop in reminder triggert export + zet timestamp',async({page})=>{
  await seed(page,{lastBackupAt:Date.now()-10*86400000,tradeCount:10});
  await page.goto(FILE_URL,{waitUntil:'networkidle'});
  await expect(page.getByText('Tijd voor je wekelijkse backup')).toBeVisible({timeout:5000});
  const dlPromise=page.waitForEvent('download',{timeout:8000});
  await page.evaluate(()=>{
    const b=document.querySelector('button[aria-label="Download backup nu"]');
    if(b)b.click();
  });
  const dl=await dlPromise;
  expect(dl.suggestedFilename()).toMatch(/syncjournal-backup.*\.json/);
  await expect(page.getByText('Tijd voor je wekelijkse backup')).toHaveCount(0);
  const ts=await page.evaluate(()=>parseInt(localStorage.getItem('tj_last_backup_at')||'0',10));
  expect(ts).toBeGreaterThan(Date.now()-10000);
});

test('onboarding modal verschijnt eenmalig (≥5 trades, nooit backup)',async({page})=>{
  await seed(page,{lastBackupAt:null,tradeCount:6});
  await page.goto(FILE_URL,{waitUntil:'networkidle'});
  await expect(page.getByText('Even iets belangrijks')).toBeVisible({timeout:5000});
  await page.evaluate(()=>{
    const b=Array.from(document.querySelectorAll('button')).find(b=>/Begrepen/.test(b.textContent));
    if(b)b.click();
  });
  await page.waitForTimeout(200);
  const flag=await page.evaluate(()=>localStorage.getItem('tj_backup_onboarding_shown'));
  expect(flag).toBe('1');
});

test('onboarding NIET wanneer al getoond',async({page})=>{
  await seed(page,{lastBackupAt:null,onboardingShown:true,tradeCount:6});
  await page.goto(FILE_URL,{waitUntil:'networkidle'});
  await page.waitForTimeout(1500);
  await expect(page.locator('text=Even iets belangrijks')).toHaveCount(0);
});

test('soft recovery: destructive import vraagt confirmation',async({page})=>{
  await seed(page,{lastBackupAt:Date.now()-2*86400000,tradeCount:50});
  // Accept de confirm dialog
  let confirmText='';
  page.on('dialog',d=>{confirmText=d.message();d.dismiss();});
  await page.goto(FILE_URL,{waitUntil:'networkidle'});
  await page.waitForTimeout(1500);
  // Navigeer naar Accounts en upload een klein backup-bestand
  await page.evaluate(()=>{
    const b=Array.from(document.querySelectorAll('.tj-tabs button.tj-tab')).find(b=>/Instellingen|Accounts/.test(b.textContent));
    if(b)b.click();
  });
  await page.waitForTimeout(500);
  // Maak een mini-backup met 3 trades
  const smallBackup=JSON.stringify({
    version:12,schemaVersion:12,exportDate:new Date().toISOString(),
    trades:[{id:'x1',pair:'BTC/USDT',direction:'long',date:'2026-05-01',pnl:'10'},
            {id:'x2',pair:'ETH/USDT',direction:'short',date:'2026-05-02',pnl:'-5'},
            {id:'x3',pair:'SOL/USDT',direction:'long',date:'2026-05-03',pnl:'7'}],
  });
  // Schrijf naar tijdelijk pad en upload via de backup file-input
  const tmpPath=path.join(__dirname,'tmp-small-backup.json');
  require('fs').writeFileSync(tmpPath,smallBackup,'utf-8');
  await page.locator('input[type="file"][accept=".json"]').setInputFiles(tmpPath);
  await page.waitForTimeout(500);
  require('fs').unlinkSync(tmpPath);
  // Confirm-dialog moet vragen om bevestiging met juiste tekst
  expect(confirmText).toMatch(/50 trades vervangen door 3/);
});
