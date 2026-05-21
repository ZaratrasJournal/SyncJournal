// v12.152 — Verifieert dat de Backup-knop (handleBackup) nu OOK playbooks
// importeert (was alleen drag-drop). Test de ECHTE import-flow via file-upload,
// niet localStorage-seed.
const{test,expect}=require('@playwright/test');
const path=require('path');
const FILE_URL='file:///'+path.resolve(__dirname,'../work/tradejournal.html').replace(/\\/g,'/');
const DATA_PATH=path.resolve(__dirname,'../demo-dataset-1000.json');

test('Backup-knop importeert trades + playbooks + tags + accounts',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('tj_welcomed','1'));
  await page.goto(FILE_URL,{waitUntil:'networkidle'});
  await page.waitForTimeout(600);

  // Naar Accounts (Instellingen)
  await page.evaluate(()=>{
    const b=Array.from(document.querySelectorAll('.tj-tabs button.tj-tab')).find(b=>/Instellingen/.test(b.textContent))
      ||Array.from(document.querySelectorAll('.tj-tabs button')).find(b=>/Instellingen|Accounts/.test(b.textContent));
    if(b)b.click();
  });
  await page.waitForTimeout(500);

  // Upload via de verborgen backup file-input (accept=".json")
  const input=page.locator('input[type="file"][accept=".json"]');
  await input.setInputFiles(DATA_PATH);
  await page.waitForTimeout(2000); // import + IndexedDB

  // localStorage moet nu 6 playbooks hebben
  const pbCount=await page.evaluate(()=>{
    try{return JSON.parse(localStorage.getItem('tj_playbooks')||'[]').length;}catch{return 0;}
  });
  expect(pbCount).toBe(6);

  // tagConfig + accounts ook hersteld
  const state=await page.evaluate(()=>({
    tags:JSON.parse(localStorage.getItem('tj_tags')||'{}'),
    accounts:JSON.parse(localStorage.getItem('tj_accounts')||'[]'),
  }));
  expect(state.tags.confirmationTags).toContain('Support OB');
  expect(state.accounts.length).toBe(5);

  // Playbook-pagina toont de namen
  await page.evaluate(()=>{
    const b=Array.from(document.querySelectorAll('.tj-tabs button.tj-tab')).find(b=>/Playbook/.test(b.textContent));
    if(b)b.click();
  });
  await page.waitForTimeout(600);
  const txt=await page.locator('body').textContent();
  expect(txt).toMatch(/1H MSB\/BOS/);
  expect(txt).toMatch(/First touch HTF OB/);
  expect(txt).toMatch(/SFP Liquidity Reversal/);
});
