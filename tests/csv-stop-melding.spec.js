// After a CSV import: say it when the export has no stop-loss (v1.18.1, found by Zaratras).
// Most exports (Hyperliquid, Blofin, OKX, MEXC) carry no stop, so without a link such a trade has no stop and no R.
// The import message then gets one line; FTMO MetriX has an SL column and gets none.
//
// Draai: node tests/csv-stop-melding.spec.js
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const lees = f => fs.readFileSync(path.join('tests', 'fixtures-csv', f), 'utf8');
const ZIN = 'Deze export bevat geen stop-loss';

(async () => {
  const b = await chromium.launch(); const alleFouten = [];
  for (const thema of ['light', 'dark']) {
    console.log(`─── ${thema} ───`);
    const { ctx, p, errs } = await H.openJournal(b, { timezoneId: 'Europe/Amsterdam', viewport: { width: 390, height: 800 } });
    await p.evaluate(t => { setTheme(t); T = []; TRASH = []; }, thema);
    // the last toast's text, then clear the stack
    const melding = async (tekst, ex) => p.evaluate(([t, e]) => { document.getElementById('toasts').innerHTML = ''; const n = sjImportCsvText(t, e);
      const el = [...document.querySelectorAll('#toasts .toast')].pop(); return { n, tekst: el ? el.innerText : '' }; }, [tekst, ex]);

    let m = await melding(lees('hyperliquid-fills.csv'), 'hyperliquid');
    ok(`${thema}: Hyperliquid zonder koppeling → de regel over de stop-loss, met "koppel je exchange"`, m.n === 2 && m.tekst.includes(ZIN) && /Vul hem per trade in, of koppel je exchange/.test(m.tekst), JSON.stringify(m));
    ok(`${thema}: die regel staat op een eigen regel`, /\n.*Deze export bevat geen stop-loss/.test(m.tekst), JSON.stringify(m.tekst));
    if (thema === 'light') {
      // the toast fits a phone screen
      const breed = await p.evaluate(() => { const el = [...document.querySelectorAll('#toasts .toast')].pop(); return el ? el.getBoundingClientRect().right : 0; });
      ok('de melding past op een telefoon (390 px)', breed > 0 && breed <= 390, String(breed));
    }
    m = await melding(lees('hyperliquid-fills.csv'), 'hyperliquid');
    ok(`${thema}: nog een keer inlezen (niets nieuw) → geen regel over de stop-loss`, m.n === 0 && !m.tekst.includes(ZIN), JSON.stringify(m));
    m = await melding(lees('ftmo-metrix.csv'), 'ftmo');
    ok(`${thema}: FTMO met SL-kolom → geen regel over de stop-loss`, m.n > 0 && !m.tekst.includes(ZIN), JSON.stringify(m));
    // with a link the second half makes no sense
    await p.evaluate(() => { T = []; CONNS.blofin = { connected: true, apiKey: 'k', apiSecret: 's', passphrase: 'p' }; });
    m = await melding(lees('blofin-orderhistorie.csv'), 'blofin');
    ok(`${thema}: Blofin met koppeling → wel de regel, zonder "koppel je exchange"`, m.n > 0 && m.tekst.includes(ZIN) && !/koppel je exchange/.test(m.tekst), JSON.stringify(m));
    alleFouten.push(...errs); await ctx.close();
  }
  ok('geen JS-fouten', alleFouten.length === 0, [...new Set(alleFouten)].slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n=== CSV-melding stop-loss: ${pass}/${pass + fail} ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
