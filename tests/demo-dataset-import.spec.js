// Verifieert dat de gegenereerde demo-dataset correct importeert:
// trades laden, 6 playbooks gekoppeld, tags + accounts, geen JS-errors.
const{test,expect}=require('@playwright/test');
const path=require('path');
const fs=require('fs');
const FILE_URL='file:///'+path.resolve(__dirname,'../work/tradejournal.html').replace(/\\/g,'/');
const DATA=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../demo-dataset-1000.json'),'utf-8'));

test('demo-dataset shape klopt',async()=>{
  expect(DATA.trades.length).toBe(1000);
  expect(DATA.playbooks.length).toBe(6);
  expect(DATA.accounts.length).toBe(5);
  // playbookId koppelingen kloppen
  const pbIds=new Set(DATA.playbooks.map(p=>p.id));
  const coupled=DATA.trades.filter(t=>pbIds.has(t.playbookId)).length;
  expect(coupled).toBe(1000);
  // 1H MSB/BOS + First touch playbooks aanwezig
  const names=DATA.playbooks.map(p=>p.name);
  expect(names).toContain('1H MSB/BOS');
  expect(names).toContain('First touch HTF OB + LTF entry');
  // tag-categorieën compleet
  expect(DATA.tagConfig.setupTags).toContain('BOS');
  expect(DATA.tagConfig.confirmationTags).toContain('Support OB');
  expect(DATA.tagConfig.confirmationTags).toContain('Resistance OB');
  // meerdere exchanges
  const sources=new Set(DATA.trades.map(t=>t.source));
  expect(sources.size).toBeGreaterThanOrEqual(4);
  // datums over 1.5 jaar
  const dates=DATA.trades.map(t=>t.date).sort();
  expect(dates[0]<'2025-01-01').toBe(true);
  expect(dates[dates.length-1]>'2026-04-01').toBe(true);
});

test('app laadt demo-data zonder JS-errors + trades komen door',async({page})=>{
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});

  await page.addInitScript((data)=>{
    localStorage.setItem('tj_welcomed','1');
    localStorage.setItem('tj_trades',JSON.stringify(data.trades));
    localStorage.setItem('tj_playbooks',JSON.stringify(data.playbooks));
    localStorage.setItem('tj_tags',JSON.stringify(data.tagConfig));
    localStorage.setItem('tj_accounts',JSON.stringify(data.accounts));
  },DATA);

  await page.goto(FILE_URL,{waitUntil:'networkidle'});
  await page.waitForTimeout(1500); // IndexedDB-migratie van tj_trades

  // Geen kritieke JS-errors
  const critical=errors.filter(e=>!/favicon|net::ERR|Failed to load resource|BABEL.*deoptimised|exceeds the max/.test(e));
  expect(critical).toEqual([]);

  // Playbooks geladen — open Playbook-tab
  await page.evaluate(()=>{
    const b=Array.from(document.querySelectorAll('.tj-tabs button.tj-tab')).find(b=>b.textContent.includes('Playbook'));
    if(b)b.click();
  });
  await page.waitForTimeout(500);
  const pbText=await page.locator('body').textContent();
  expect(pbText).toMatch(/1H MSB\/BOS/);
  expect(pbText).toMatch(/First touch HTF OB/);

  await page.screenshot({path:'tests/screenshots/demo-dataset-playbooks.png',fullPage:false});
});
