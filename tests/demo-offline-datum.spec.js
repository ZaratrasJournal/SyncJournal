// The built-in demo data (genTrades → SEED, loaded by resetDemo when the full dataset is not reachable) put its trades
// a day early in a Dutch browser: the trading days were local midnights turned into a date with toISOString(), which
// is the UTC day, so Monday became Sunday and Friday Thursday. Same pattern as B9. The demo is meant to trade on
// weekdays only, and a trade's date must be the Amsterdam day of its own time.
const { chromium } = require('playwright');
const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const meet = p => p.evaluate(async () => {
  window.fetchDemoDataset = async () => null;   // offline: resetDemo falls back to the built-in compact set
  T = []; await resetDemo();
  const dag = d => new Date(d + 'T12:00:00Z').getUTCDay();   // weekday of a date string, independent of the browser's zone
  return { n: T.length, toast: document.getElementById('toasts').innerText,
    weekend: T.filter(t => [0, 6].includes(dag(t.date))).map(t => t.date + ' ' + t.time),
    seedWeekend: SEED.filter(t => [0, 6].includes(dag(t.date))).length,
    anders: T.filter(t => +t.openTime > 0 && amsDateTime(+t.openTime).date !== t.date).map(t => t.date + ' ' + t.time + ' → ' + amsDateTime(+t.openTime).date).slice(0, 3) };
});

(async () => {
  const b = await chromium.launch();
  for (const [zone, label] of [['Europe/Amsterdam', 'Nederland'], ['UTC', 'UTC']]) {
    console.log(`─── Browser in ${label} ───`);
    const { p, errs } = await H.openJournal(b, { timezoneId: zone });
    const r = await meet(p);
    ok(`${label}: de compacte demo is geladen (${r.n} trades)`, r.n > 0 && /compacte set/.test(r.toast), JSON.stringify({ n: r.n, toast: r.toast.slice(0, 120) }));
    ok(`${label}: geen demo-trade op zaterdag of zondag`, r.weekend.length === 0 && r.seedWeekend === 0, JSON.stringify(r.weekend.slice(0, 5)) + ' · in SEED: ' + r.seedWeekend);
    if (zone === 'Europe/Amsterdam') ok(`${label}: de datum van elke trade is de Amsterdamse dag van zijn tijd`, r.anders.length === 0, JSON.stringify(r.anders));
    ok(`${label}: geen JS-fouten`, errs.length === 0, errs.slice(0, 3).join(' | '));
    await p.context().close();
  }
  console.log(`\n=== Demo offline datum: ${pass}/${pass + fail} ===`);
  await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  ✗ crash: ' + String(e).split('\n')[0]); process.exit(1); });
