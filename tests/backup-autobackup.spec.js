// v12.154 — Auto-backup fase 2: File System Access API met mock.
// FSA is niet beschikbaar in headless Chromium zonder mock — wij stubben de
// directorypicker + handle zodat de logic (UI states, due-write, rotate,
// permission-lost) end-to-end gevalideerd kan worden.
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

// Installeert een FSA-mock in window. Bestanden worden in window.__abFiles
// (Map name->content) bijgehouden. Permissies via window.__abPermission.
// inject=true zet ook window.__abInjectedHandle zodat abLoadHandle 'm vindt
// alsof folder al eerder was gekozen (overleeft reload).
async function installFSAMock(page,opts={}){
  await page.addInitScript((opts)=>{
    window.__abFiles=new Map();
    window.__abPickerCalled=0;
    window.__abPermission=opts.initialPermission||"granted";
    const mkFile=(name)=>({
      kind:"file",name,
      async createWritable(){
        return{
          async write(c){window.__abFiles.set(name,typeof c==="string"?c:String(c));},
          async close(){}
        };
      }
    });
    window.__abMockHandle={
      name:opts.folderName||"SyncJournal-backups",
      kind:"directory",
      async queryPermission(){return window.__abPermission;},
      async requestPermission(){
        if(window.__abPermission==="prompt"&&!opts.alwaysDeny){window.__abPermission="granted";}
        return window.__abPermission;
      },
      async getFileHandle(name,_o){return mkFile(name);},
      async removeEntry(name){window.__abFiles.delete(name);},
      async *entries(){
        for(const[n] of window.__abFiles)yield[n,{kind:"file",name:n}];
      }
    };
    window.showDirectoryPicker=async()=>{window.__abPickerCalled++;return window.__abMockHandle;};
    if(opts.inject)window.__abInjectedHandle=window.__abMockHandle;
    if(opts.preFiles)for(const[n,c] of Object.entries(opts.preFiles))window.__abFiles.set(n,c);
  },opts);
}

async function seedApp(page,{tradeCount=10,abEnabled=false,abFolderName,abLastWriteAt,abIntervalDays,abRotateKeep,welcomed=true,lastBackupAt}={}){
  await page.addInitScript(({tradeCount,abEnabled,abFolderName,abLastWriteAt,abIntervalDays,abRotateKeep,welcomed,lastBackupAt})=>{
    if(welcomed)localStorage.setItem('tj_welcomed','1');
    if(abEnabled)localStorage.setItem('tj_autobackup_enabled','1');
    if(abFolderName)localStorage.setItem('tj_autobackup_folder_name',abFolderName);
    if(abLastWriteAt!=null)localStorage.setItem('tj_autobackup_last_write_at',String(abLastWriteAt));
    if(abIntervalDays!=null)localStorage.setItem('tj_autobackup_interval_days',String(abIntervalDays));
    if(abRotateKeep!=null)localStorage.setItem('tj_autobackup_rotate_keep',String(abRotateKeep));
    if(lastBackupAt!=null)localStorage.setItem('tj_last_backup_at',String(lastBackupAt));
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
  },{tradeCount,abEnabled,abFolderName,abLastWriteAt,abIntervalDays,abRotateKeep,welcomed,lastBackupAt});
}

// (verouderd) IDB-seed werkt niet voor mock-handles (structured clone fail).
// Vervangen door installFSAMock(..., inject:true) die window.__abInjectedHandle zet.

async function gotoAccounts(page){
  await page.evaluate(()=>{
    const b=Array.from(document.querySelectorAll('.tj-tabs button.tj-tab')).find(b=>/Instellingen|Accounts/.test(b.textContent));
    if(b)b.click();
  });
  await page.waitForTimeout(500);
}

test('UI state "niet ondersteund" wanneer showDirectoryPicker ontbreekt',async({page})=>{
  // Geen mock installeren
  await page.addInitScript(()=>{
    delete window.showDirectoryPicker;
    localStorage.setItem('tj_welcomed','1');
  });
  await page.goto(FILE_URL,{waitUntil:'networkidle'});
  await page.waitForTimeout(800);
  await gotoAccounts(page);
  await expect(page.getByText('Auto-backup naar folder')).toBeVisible({timeout:5000});
  await expect(page.getByText('Deze browser ondersteunt het niet')).toBeVisible();
});

test('UI state "niet actief" wanneer browser ondersteunt + geen folder',async({page})=>{
  await installFSAMock(page);
  await seedApp(page,{tradeCount:5,abEnabled:false,lastBackupAt:Date.now()-1*86400000});
  await page.goto(FILE_URL,{waitUntil:'networkidle'});
  await page.waitForTimeout(800);
  await gotoAccounts(page);
  await expect(page.getByText('Auto-backup naar folder')).toBeVisible({timeout:5000});
  await expect(page.locator('text=niet actief')).toBeVisible();
  await expect(page.getByRole('button',{name:/Kies auto-backup folder/})).toBeVisible();
});

test('Kies folder → handle in IDB + status "actief"',async({page})=>{
  await installFSAMock(page);
  await seedApp(page,{tradeCount:5,lastBackupAt:Date.now()-1*86400000});
  await page.goto(FILE_URL,{waitUntil:'networkidle'});
  await page.waitForTimeout(800);
  await gotoAccounts(page);
  // Klik kies folder
  await page.evaluate(()=>{
    const b=document.querySelector('button[aria-label="Kies auto-backup folder"]');
    if(b)b.click();
  });
  await page.waitForTimeout(600);
  // Status "actief"
  await expect(page.locator('text=✓ actief')).toBeVisible({timeout:5000});
  // Picker is precies 1× aangeroepen
  const calls=await page.evaluate(()=>window.__abPickerCalled);
  expect(calls).toBe(1);
  // localStorage enabled=1, folder_name=SyncJournal-backups
  const ls=await page.evaluate(()=>({
    en:localStorage.getItem('tj_autobackup_enabled'),
    name:localStorage.getItem('tj_autobackup_folder_name'),
  }));
  expect(ls.en).toBe('1');
  expect(ls.name).toBe('SyncJournal-backups');
});

test('Auto-write bij app-open wanneer due',async({page})=>{
  await installFSAMock(page,{inject:true});
  await seedApp(page,{
    tradeCount:10,
    abEnabled:true,
    abFolderName:'SyncJournal-backups',
    abLastWriteAt:Date.now()-8*86400000, // 8d geleden = due
    abIntervalDays:7,
    abRotateKeep:4,
    lastBackupAt:Date.now()-8*86400000,
  });
  await page.goto(FILE_URL,{waitUntil:'networkidle'});
  await page.waitForTimeout(2500);
  const files=await page.evaluate(()=>Array.from(window.__abFiles.keys()));
  expect(files.length).toBeGreaterThanOrEqual(1);
  expect(files.some(n=>/syncjournal-backup-\d{4}-\d{2}-\d{2}\.json/.test(n))).toBe(true);
  const ls=await page.evaluate(()=>({
    abLast:parseInt(localStorage.getItem('tj_autobackup_last_write_at')||'0',10),
    bLast:parseInt(localStorage.getItem('tj_last_backup_at')||'0',10),
  }));
  expect(ls.abLast).toBeGreaterThan(Date.now()-30000);
  expect(ls.bLast).toBeGreaterThan(Date.now()-30000);
});

test('Auto-write NIET wanneer interval niet due',async({page})=>{
  await installFSAMock(page,{inject:true});
  await seedApp(page,{
    tradeCount:10,
    abEnabled:true,
    abLastWriteAt:Date.now()-2*86400000, // 2d geleden, interval=7d → niet due
    abIntervalDays:7,
    lastBackupAt:Date.now()-2*86400000,
  });
  await page.goto(FILE_URL,{waitUntil:'networkidle'});
  await page.waitForTimeout(2000);
  const files=await page.evaluate(()=>Array.from(window.__abFiles.keys()));
  expect(files.length).toBe(0);
});

test('Auto-write NIET wanneer disabled',async({page})=>{
  await installFSAMock(page,{inject:true});
  await seedApp(page,{
    tradeCount:10,
    abEnabled:false,
    abLastWriteAt:Date.now()-30*86400000,
    lastBackupAt:Date.now()-30*86400000,
  });
  await page.goto(FILE_URL,{waitUntil:'networkidle'});
  await page.waitForTimeout(2000);
  const files=await page.evaluate(()=>Array.from(window.__abFiles.keys()));
  expect(files.length).toBe(0);
});

test('Rotate: bij keep=2 worden oudere bestanden gewist',async({page})=>{
  await installFSAMock(page,{
    inject:true,
    preFiles:{
      'syncjournal-backup-2025-12-01.json':'old',
      'syncjournal-backup-2026-01-15.json':'old',
      'syncjournal-backup-2026-03-20.json':'old',
    },
  });
  await seedApp(page,{
    tradeCount:10,
    abEnabled:true,
    abFolderName:'SyncJournal-backups',
    abLastWriteAt:Date.now()-8*86400000,
    abIntervalDays:7,
    abRotateKeep:2,
    lastBackupAt:Date.now()-8*86400000,
  });
  await page.goto(FILE_URL,{waitUntil:'networkidle'});
  await page.waitForTimeout(2500);
  const files=await page.evaluate(()=>Array.from(window.__abFiles.keys()).sort());
  // Eerste 2 (oudste) zijn weg, laatste 2 (incl. nieuwe van vandaag) blijven
  expect(files.length).toBe(2);
});

test('Permission "prompt" tijdens trigger → toast + last-error gezet',async({page})=>{
  await installFSAMock(page,{inject:true,initialPermission:'prompt',alwaysDeny:true});
  await seedApp(page,{
    tradeCount:10,
    abEnabled:true,
    abFolderName:'SyncJournal-backups',
    abLastWriteAt:Date.now()-8*86400000,
    abIntervalDays:7,
    lastBackupAt:Date.now()-8*86400000,
  });
  await page.goto(FILE_URL,{waitUntil:'networkidle'});
  await page.waitForTimeout(2000);
  const files=await page.evaluate(()=>Array.from(window.__abFiles.keys()));
  expect(files.length).toBe(0);
  const err=await page.evaluate(()=>localStorage.getItem('tj_autobackup_last_error'));
  expect(err).toMatch(/permissie/i);
});

test('Test-knop in UI schrijft een test-backup',async({page})=>{
  await installFSAMock(page,{inject:true});
  await seedApp(page,{
    tradeCount:5,
    abEnabled:true,
    abFolderName:'SyncJournal-backups',
    abLastWriteAt:Date.now()-1*86400000,
    abIntervalDays:30,
    lastBackupAt:Date.now()-1*86400000,
  });
  await page.goto(FILE_URL,{waitUntil:'networkidle'});
  await page.waitForTimeout(800);
  await gotoAccounts(page);
  await expect(page.locator('text=✓ actief')).toBeVisible({timeout:5000});
  // Klik test-knop
  await page.evaluate(()=>{
    const b=document.querySelector('button[aria-label="Test auto-backup nu"]');
    if(b)b.click();
  });
  await page.waitForTimeout(800);
  const files=await page.evaluate(()=>Array.from(window.__abFiles.keys()));
  expect(files.some(n=>/syncjournal-backup-\d{4}-\d{2}-\d{2}\.json/.test(n))).toBe(true);
});

test('Verwijder koppeling: handle weg + UI terug naar "niet actief"',async({page})=>{
  await installFSAMock(page,{inject:true});
  await seedApp(page,{
    tradeCount:5,
    abEnabled:true,
    abFolderName:'SyncJournal-backups',
    abLastWriteAt:Date.now()-1*86400000,
    abIntervalDays:30,
    lastBackupAt:Date.now()-1*86400000,
  });
  await page.goto(FILE_URL,{waitUntil:'networkidle'});
  await page.waitForTimeout(800);
  await gotoAccounts(page);
  await expect(page.locator('text=✓ actief')).toBeVisible({timeout:5000});
  page.on('dialog',d=>d.accept());
  // Klik delete (eerste delete-knop binnen auto-backup blokje)
  await page.evaluate(()=>{
    const btns=Array.from(document.querySelectorAll('button'));
    const b=btns.find(b=>/Verwijder koppeling/.test(b.textContent));
    if(b)b.click();
  });
  await page.waitForTimeout(800);
  await expect(page.locator('text=niet actief')).toBeVisible({timeout:5000});
  const stored=await page.evaluate(()=>localStorage.getItem('tj_autobackup_folder_name'));
  expect(stored).toBeNull();
});
