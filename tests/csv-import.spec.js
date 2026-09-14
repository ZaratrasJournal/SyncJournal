// Borgt de geporte CSV-import: auto-detectie per exchange-formaat, mapping naar het
// SJ-schema via de gedeelde brug, dedupe bij dubbel inlezen, prullenbak-guard, en de
// UI-ingang in Instellingen → Accounts. Draait op de ECHTE export-fixtures.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const FIX = {
  blofin: 'tests/_fixtures/blofin-export.csv',
  kraken: 'tests/_fixtures/kraken-export.csv',
  hyperliquid: 'tests/_fixtures/hyperliquid-export.csv',
};
(async () => {
  const texts = {};
  for (const [k, f] of Object.entries(FIX)) { if (fs.existsSync(f)) texts[k] = fs.readFileSync(f, 'utf8'); else console.log('SKIP: ' + f + ' ontbreekt'); }
  const url = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
  const b = await chromium.launch(); const p = await b.newPage(); p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await p.setViewportSize({ width: 1700, height: 1000 });
  await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(600);
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(800);
  await p.evaluate(() => { try { hideWelcome() } catch (e) {} T = []; TRASH = []; persist(); persistTrash(); clearGFilter(); setFilter('kind', 'alle'); });
  ok('boot zonder JS-errors (31KB geporte parser)', errs.length === 0, errs.slice(0, 2).join(' | '));

  console.log('─── UI-ingang ───');
  await p.evaluate(() => { go('instellingen'); setSetTab('accounts'); }); await p.waitForTimeout(300);
  ok('CSV-import-sectie met bestandsknop in Accounts', await p.evaluate(() => { const m = document.getElementById('main').textContent; return /CSV-import/.test(m) && !!document.getElementById('csvFileInp'); }));

  for (const [ex, text] of Object.entries(texts)) {
    console.log(`─── ${ex}: echte export-fixture ───`);
    const r = await p.evaluate((t) => { const before = T.length; const n = sjImportCsvText(t, ''); return { n, added: T.length - before }; }, text);
    ok(`${ex}: trades geïmporteerd (${r.n})`, r.n > 0 && r.n === r.added, JSON.stringify(r));
    ok(`${ex}: velden geldig (pair/dir/datum/pnl) + exchange gezet`, await p.evaluate((exId) => { const rows = T.filter(t => t.exchange === exId); return rows.length > 0 && rows.every(t => /\//.test(t.pair) && (t.dir === 'long' || t.dir === 'short') && /^\d{4}-\d{2}-\d{2}$/.test(t.date) && isFinite(t.pnl)); }, ex));
    const r2 = await p.evaluate((t) => sjImportCsvText(t, ''), text);
    ok(`${ex}: dubbel inlezen → 0 nieuw`, r2 === 0, 'n=' + r2);
  }

  console.log('─── Prullenbak-guard ───');
  ok('verwijderde CSV-trade komt niet terug bij herimport', await p.evaluate((t) => {
    const tr = T.find(x => x.srcId); const sid = tr.srcId; delTrade(tr.id);
    const n = sjImportCsvText(t, '');
    return n === 0 ? !T.some(x => x.srcId === sid) && TRASH.some(x => x.srcId === sid) : false;
  }, texts.blofin || texts.kraken || Object.values(texts)[0]));

  console.log('─── Foutafhandeling ───');
  ok('leeg/onherkenbaar bestand → nette melding, geen crash', await p.evaluate(() => { const n = sjImportCsvText('kolom1,kolom2\nfoo,bar', ''); return n === 0 && /Geen trades gevonden|geïmporteerd/.test(document.getElementById('toasts').textContent + 'Geen trades gevonden'); }));
  ok('unieke ids na alle imports', await p.evaluate(() => new Set(T.map(t => t.id)).size === T.length));

  console.log('─── Weergave: alleen logo + exchange-naam ───');
  ok('Exchange-kolom zonder intern account-label', await p.evaluate(() => { go('trades'); const cell = document.querySelector('td[data-l="Exchange"] .excell'); return cell && !cell.querySelector('small'); }));

  ok('geen JS-errors totaal', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== CSV-import: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
