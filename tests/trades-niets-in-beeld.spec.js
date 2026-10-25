// Trades-lijst: "leeg" en "niets in beeld" zijn twee verschillende toestanden (CLAUDE.md,
// "Toestanden benoemen"). Een lege journal vraagt om je eerste trade; een filter of zoekopdracht
// die niets overlaat zegt dat, met een knop om de filters te wissen. En van gevuld → niets →
// weer gevuld gaat zonder fout.
//
// Vervangt tradelist-hooks.spec.js (T2, 24-10-2026): die bewaakte een React hook-fout (#310)
// bij precies die overgang in de oude app. SyncJournal heeft geen React-lijst meer, de
// overgang zelf blijft het toetsen waard.
const { chromium } = require('playwright');
const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const T0 = { time: '10:00', dir: 'long', status: 'closed', kind: 'live', entry: 100, exit: 110, stop: 95, size: '1000', pnl: 10, exchange: '' };
const SET = [{ ...T0, id: 1, date: '2026-10-01', pair: 'BTC/USDT' }, { ...T0, id: 2, date: '2026-10-02', pair: 'ETH/USDT' }, { ...T0, id: 3, date: '2026-10-03', pair: 'SOL/USDT' }];

const stand = () => ({
  rijen: document.querySelectorAll('#main tbody tr.mrow').length,
  kop: ((document.querySelector('#main .empty-h') || {}).textContent || ''),
  knop: ((document.querySelector('#main .empty .btn') || {}).textContent || ''),
  badge: document.getElementById('gfBadge').hidden ? '' : document.getElementById('gfBadge').textContent,
});

(async () => {
  const b = await chromium.launch(); const { p, errs } = await H.openJournal(b);
  await H.go(p, 'trades');
  let s = await p.evaluate(stand);
  ok('lege journal: "Nog geen trades" met een knop naar Accounts', s.rijen === 0 && /Nog geen trades/.test(s.kop) && /Naar Accounts/.test(s.knop), JSON.stringify(s));

  await H.seedTrades(p, SET);
  await H.go(p, 'trades');
  s = await p.evaluate(stand);
  ok('gevuld: 3 rijen, geen lege staat, geen filtermelding', s.rijen === 3 && !s.kop && !s.badge, JSON.stringify(s));

  await p.evaluate(() => setDateFrom('2030-01-01'));
  s = await p.evaluate(stand);
  ok('datumfilter laat niets over: "Geen trades in deze periode", niet "Nog geen trades"', s.rijen === 0 && /Geen trades in deze periode/.test(s.kop), JSON.stringify(s));
  ok('met een knop "Filter uitzetten" en de melding "0 van 3 trades" bovenaan', /Filter uitzetten/.test(s.knop) && /0 van 3/.test(s.badge), JSON.stringify(s));
  await p.click('#main .empty .btn');
  s = await p.evaluate(stand);
  ok('knop wist het filter: weer 3 rijen, melding weg', s.rijen === 3 && !s.kop && !s.badge, JSON.stringify(s));

  await p.fill('#trSearch', 'XRP');
  await p.waitForFunction(() => STATE.query === 'XRP' && !!document.querySelector('#main .empty-h'), null, { timeout: 3000 });
  s = await p.evaluate(stand);
  ok('zoekopdracht zonder resultaat: "Geen trades voor deze zoekopdracht"', s.rijen === 0 && /Geen trades voor deze zoekopdracht/.test(s.kop), JSON.stringify(s));
  await p.click('#main .empty .btn');
  s = await p.evaluate(stand);
  ok('wissen haalt ook de zoekopdracht weg: 3 rijen', s.rijen === 3 && await p.evaluate(() => STATE.query === ''), JSON.stringify(s));

  await p.evaluate(() => { STATE.tradeTab = 'open'; render(); });
  s = await p.evaluate(stand);
  ok('tabblad Open/partial zonder open trades: "Geen trades in dit tabblad"', s.rijen === 0 && /Geen trades in dit tabblad/.test(s.kop), JSON.stringify(s));
  await p.evaluate(() => { STATE.tradeTab = 'all'; render(); });
  ok('terug naar Alle: 3 rijen', (await p.evaluate(stand)).rijen === 3);

  ok('geen JS-fouten bij de overgangen', errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n=== Trades niets in beeld: ${pass}/${pass + fail} ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
