// Een prijs die er (nog) niet is, toont een streepje — geen "0".
//
// Denny 29-09-2026: in de Trades-tabel stond bij backtests zonder exit overal "0", en bij zijn
// open OKX- en Hyperliquid-trades ook. De helper numOrDash gaf alleen een streepje bij "geen
// getal", en 0 is een getal. Een koers van 0 bestaat niet, dus 0 betekent hier "onbekend".
const { chromium } = require('playwright');
const path = require('path');

let pass = 0, fail = 0;
const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const B = { pair: 'BTC/USDC', dir: 'long', size: '100', date: '2026-09-28', entry: 83365.8 };
const RIJEN = [
  { ...B, id: 'open', exchange: 'okx', kind: 'live', status: 'open', time: '16:14', exit: 0, pnl: 0 },
  { ...B, id: 'bt', kind: 'backtest', status: 'closed', time: '09:00', date: '2026-06-15', exit: 0, pnl: 25.22 },
  { ...B, id: 'dicht', exchange: 'okx', kind: 'live', status: 'closed', time: '12:00', exit: 84000, pnl: 1 },
];

(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await p.setViewportSize({ width: 1600, height: 1000 });
  await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(600);
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(800);
  await p.evaluate(() => { try { hideWelcome(); } catch (e) {} });
  ok('boot zonder JS-fouten', errs.length === 0, errs[0]);

  const r = await p.evaluate(rijen => {
    T = rijen.map(x => ({ ...EMPTY_TRADE, ...x })); persist(); clearGFilter(); setFilter('kind', 'alle');
    try { VIEW.v = { ...(VIEW.v || {}), tEntryExit: 1 }; } catch (e) {}
    go('trades');
    const uit = {};
    document.querySelectorAll('tbody tr').forEach(tr => {
      const tijd = (tr.textContent.match(/\d\d:\d\d/) || [''])[0];
      const exit = tr.querySelector('td[data-l="Exit"]'), entry = tr.querySelector('td[data-l="Entry"]');
      if (exit) uit[tijd] = { exit: exit.textContent.trim(), entry: entry.textContent.trim() };
    });
    // het detailscherm (Plan vs. uitvoering) van de open trade
    STATE.revSel = 'open'; go('review');
    const plan = [...document.querySelectorAll('.plangrid > *')].map(x => x.textContent.replace(/\s+/g, ' ').trim());
    return { tabel: uit, plan };
  }, RIJEN);

  console.log('─── Trades-tabel ───');
  ok('open trade: exit toont een streepje', (r.tabel['16:14'] || {}).exit === '—', JSON.stringify(r.tabel['16:14']));
  ok('backtest zonder exit: streepje', (r.tabel['09:00'] || {}).exit === '—', JSON.stringify(r.tabel['09:00']));
  ok('gesloten trade: exit gewoon als getal', (r.tabel['12:00'] || {}).exit === '84.000', JSON.stringify(r.tabel['12:00']));
  ok('entry blijft een getal', (r.tabel['16:14'] || {}).entry === '83.365,8', JSON.stringify(r.tabel['16:14']));

  console.log('─── Detailscherm ───');
  const exitVak = r.plan.find(x => /^Exit/.test(x)) || '';
  ok('"Exit" in Plan vs. uitvoering toont een streepje', /—/.test(exitVak) && !/\b0\b/.test(exitVak.replace('Exit', '')), exitVak);

  ok('geen nieuwe JS-fouten', errs.length === 0, errs[0]);
  console.log(`\n=== Prijs-streepje: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
