// Example from docs/w2-ruwe-data.md: replay a member's "Ruwe gegevens downloaden" file through the real
// adapter and show which trades the journal makes of it. Copy this file to start a spec for a member's bug.
//   node tests/ruwe-data-voorbeeld.spec.js tests/_fixtures/ruw-okx-jarne.json
// tests/_fixtures/ is gitignored: the file holds a member's trades and never goes to GitHub.
const { chromium } = require('playwright'); const fs = require('fs');
const H = require('./helpers/dov-page'); const R = require('./helpers/ruwe-data');
const BESTAND = process.argv[2] || 'tests/_fixtures/ruwe-data.json';
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
(async () => {
  if (!fs.existsSync(BESTAND)) { console.log('SKIP: ' + BESTAND + ' ontbreekt (tests/_fixtures/ is gitignored)'); process.exit(0); }
  const d = R.laad(BESTAND);
  const b = await chromium.launch();
  // the clock on the moment of the recording: windows like "last 30 days" fall the same way
  const { p, errs } = await H.openJournal(b, { klok: new Date(d.gemaakt) });
  await R.speelAf(p, d);
  const r = await p.evaluate(async ex => {
    const n = await syncExchange(ex, { quiet: true });
    return { n, gemist: window.__ruwGemist, trades: T.filter(t => t.exchange === ex).map(t => ({ pair: t.pair, dir: t.dir, status: t.status, entry: t.entry, exit: t.exit, pnl: +t.pnl || 0, srcId: t.srcId || '' })) };
  }, d.exchange);
  console.log(`─── ${d.exchange} · opgenomen ${d.gemaakt} · app ${d.app} · ${d.aanroepen.length} aanroepen ───`);
  r.trades.forEach(t => console.log(`    ${t.pair} ${t.dir} ${t.status} ${t.entry} → ${t.exit} pnl ${t.pnl.toFixed(2)} ${t.srcId}`));
  console.log('  trades: ' + r.trades.length);
  ok('sync over het bestand lukt', r.n >= 0, 'syncExchange gaf ' + r.n);
  ok('er komen trades uit', r.trades.length > 0);
  // Reproducing a bug? Assert it here, e.g. that the two missing OKX trades are there:
  // ok('beide trades van 25-10 komen binnen', r.trades.filter(t => /2026-10-25/.test(t.date)).length === 2);
  if (r.gemist.length) console.log('  (niet in het bestand: ' + [...new Set(r.gemist)].join(', ') + ')');
  ok('geen JS-fouten', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log(`\n=== Ruwe data afspelen: ${pass}/${pass + fail} ===`); await b.close(); process.exit(fail ? 1 : 0);
})();
