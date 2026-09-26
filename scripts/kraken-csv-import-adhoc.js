// Usage: NODE_PATH=./node_modules node scripts/kraken-csv-import-adhoc.js <account-log.csv> <out.json> <screenshot.png>
// Ad-hoc: upload Denny's real Kraken account-log CSV into work/syncjournal.html and read back what the importer produced.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const APP = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');
  const CSV = path.resolve(process.argv[2]);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  page.on('dialog', async d => { console.log('dialog:', d.type(), d.message().slice(0, 300)); await d.accept(); });
  await page.goto(APP);
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: 'Instellingen', exact: true }).first().click();
  await page.waitForTimeout(1500);
  if (!(await page.locator('#csvFileInp').count())) {
    for (const re of [/Accounts/, /Import/i, /Data/, /Koppelingen/]) {
      const b = page.getByRole('button', { name: re }).first();
      if (await b.count()) { await b.click(); await page.waitForTimeout(1200); if (await page.locator('#csvFileInp').count()) break; }
    }
  }
  const subs = await page.evaluate(() => Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t && t.length < 25).slice(0, 30));
  console.log('buttons now:', subs.join(' | '));
  console.log('csv input present:', await page.locator('#csvFileInp').count());
  await page.locator('#csvFileInp').setInputFiles(CSV);
  await page.waitForTimeout(6000);
  const modalTxt = await page.evaluate(() => Array.from(document.querySelectorAll('.modal, [role=dialog], .toast, .panel')).map(e => e.innerText.slice(0, 240)).filter(t => /kraken|import|trades|inlezen|overslaan|gevonden/i.test(t)).slice(0, 6));
  console.log('ui texts:', JSON.stringify(modalTxt, null, 1));
  for (const label of [/^Importeer/i, /^Importeren/i, /^Inlezen/i, /^Toevoegen/i, /^Bevestig/i, /^OK$/]) {
    const btn = page.getByRole('button', { name: label }).first();
    if (await btn.count()) { try { await btn.click({ timeout: 1500 }); console.log('clicked', String(label)); await page.waitForTimeout(3000); break; } catch (e) {} }
  }
  const res = await page.evaluate(async () => {
    const out = {};
    try { out.lsTrades = JSON.parse(localStorage.getItem('tj_trades') || '[]').length; } catch (e) { out.lsErr = String(e); }
    try {
      const db = await new Promise((ok, no) => { const r = indexedDB.open('sj_db', 1); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
      out.stores = Array.from(db.objectStoreNames);
      for (const s of out.stores) {
        const all = await new Promise((ok, no) => { const tx = db.transaction(s, 'readonly').objectStore(s).getAll(); tx.onsuccess = () => ok(tx.result); tx.onerror = () => no(tx.error); });
        out['idb_' + s] = all.length;
        const flat = all.flatMap(x => Array.isArray(x) ? x : (x && Array.isArray(x.trades) ? x.trades : (x && Array.isArray(x.value) ? x.value : [x])));
        const kr = flat.filter(t => t && typeof t === 'object' && (t.exchange === 'kraken' || t.source === 'kraken' || /kraken/i.test(String(t.id || ''))));
        if (kr.length) {
          out.krakenCount = (out.krakenCount || 0) + kr.length;
          out.krakenTrades = (out.krakenTrades || []).concat(kr.map(t => ({ id: t.id, date: t.date, time: t.time, pair: t.pair, dir: t.dir || t.direction, entry: +t.entry, exit: +t.exit, size: t.size || t.positionSize, pnl: +t.pnl, status: t.status, fills: (t.fills || []).length, tps: (t.tps || t.tpLevels || []).length, openTime: t.openTime, closeTime: t.closeTime })));
        }
      }
    } catch (e) { out.idbErr = String(e); }
    try { out.lsKeys = Object.keys(localStorage).filter(k => /^tj_|^sj_/.test(k)).slice(0, 30); } catch (e) {}
    return out;
  });
  console.log('pageerrors:', errors.slice(0, 5));
  const { krakenTrades, ...rest } = res;
  console.log(JSON.stringify(rest, null, 1));
  if (krakenTrades) { require('fs').writeFileSync(process.argv[3], JSON.stringify(krakenTrades, null, 1)); console.log('sample:', JSON.stringify(krakenTrades.slice(0, 3))); }
  await page.screenshot({ path: process.argv[4] });
  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
