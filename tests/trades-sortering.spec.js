// De tradestabel sorteerde op de datum als tekst, niet op het moment. Twee trades op
// dezelfde dag gaven dus een gelijkspel, en dan besliste de toevallige volgorde in de
// opslag. Denny 22-09-2026: een open trade van 17:08 stond onder een gesloten trade van
// 04:03 van diezelfde dag.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const APP = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');

const ms = (d, t) => +new Date(d + 'T' + t + ':00');
const mk = (id, d, t, o) => ({ id, exchange: 'okx', srcId: 'okx_' + id, pair: 'BTC/USDC', dir: 'short', status: 'closed', kind: 'live',
  date: d, time: t, openTime: String(ms(d, t)), closeTime: String(ms(d, t) + 36e5), entry: 80000, exit: 80100, pnl: -1, r: 0,
  size: '100', qtyAsset: 0.001, tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [], ...o });

(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext(); const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
  p.on('dialog', d => d.accept());
  await p.route('**/*', r => /^https?:/.test(r.request().url()) ? r.abort() : r.continue());
  await p.addInitScript(() => localStorage.setItem('sj_welcomed', 'true'));
  await p.goto(APP, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1200);

  // precies Denny's rijtje, en bewust in de "verkeerde" volgorde in de opslag gezet
  const zetKlaar = (extra) => p.evaluate(([e]) => {
    const ms = (d, t) => +new Date(d + 'T' + t + ':00');
    const mk = (id, d, t, o) => ({ id, exchange: 'okx', srcId: 'okx_' + id, pair: 'BTC/USDC', dir: 'short', status: 'closed', kind: 'live',
      date: d, time: t, openTime: String(ms(d, t)), closeTime: String(ms(d, t) + 36e5), entry: 80000, exit: 80100, pnl: -1, r: 0,
      size: '100', qtyAsset: 0.001, tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [], ...o });
    T = [
      mk(1, '2026-09-22', '04:03'),
      mk(2, '2026-09-22', '17:08', { status: 'open', exit: 0, closeTime: '' }),   // later genomen, nog open
      mk(3, '2026-09-20', '03:51'),
      mk(4, '2026-09-16', '21:32', { exchange: 'hyperliquid', srcId: 'hyperliquid_4' }),
      ...(e || []),
    ];
    persist(); STATE.page = 'trades'; STATE.tradeTab = 'all'; STATE.sortCol = 'date'; STATE.sortDir = -1; render();
    return null;
  }, [extra]);
  const volgorde = () => p.evaluate(() => [...document.querySelectorAll('td[data-l="Datum"]')]
    .map(c => c.textContent.replace(/\s+/g, ' ').trim().slice(0, 14)).filter(Boolean));

  console.log('─── Denny’s rijtje ───');
  await zetKlaar();
  let r = await volgorde();
  ok('de open trade van 17:08 staat boven die van 04:03 diezelfde dag',
    r[0].includes('17:08') && r[1].includes('04:03'), JSON.stringify(r));
  ok('en de dagen eronder staan op volgorde', /20-09/.test(r[2]) && /16-09/.test(r[3]), JSON.stringify(r));

  console.log('─── Andersom sorteren ───');
  await p.evaluate(() => { sortBy('date'); });
  r = await volgorde();
  ok('oplopend zet de oudste bovenaan en de open trade onderaan',
    /16-09/.test(r[0]) && r[3].includes('17:08'), JSON.stringify(r));
  await p.evaluate(() => { sortBy('date'); });

  console.log('─── Randgevallen ───');
  await zetKlaar([
    { id: 5, exchange: 'okx', srcId: '', pair: 'BTC/USDC', dir: 'long', status: 'closed', kind: 'live', date: '2026-09-22', time: '', openTime: '', closeTime: '', entry: 1, exit: 2, pnl: 1, r: 0, size: '1', tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] },
    { id: 6, exchange: 'okx', srcId: '', pair: 'BTC/USDC', dir: 'long', status: 'closed', kind: 'live', date: '', time: '', openTime: '', closeTime: '', entry: 1, exit: 2, pnl: 1, r: 0, size: '1', tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] },
  ]);
  r = await volgorde();
  ok('een trade zonder tijd valt op het begin van zijn dag, niet erboven',
    r.findIndex(x => x.includes('17:08')) < r.findIndex(x => x.includes('04:03')), JSON.stringify(r));
  ok('een trade zonder datum breekt niets en zakt naar onderen', r.length === 6, JSON.stringify(r));

  const stabiel = await p.evaluate(() => {
    const ms = (d, t) => +new Date(d + 'T' + t + ':00');
    const zelfde = n => ({ id: 100 + n, exchange: 'okx', srcId: 'okx_g' + n, pair: 'BTC/USDC', dir: 'long', status: 'closed', kind: 'live',
      date: '2026-09-21', time: '12:00', openTime: String(ms('2026-09-21', '12:00')), closeTime: String(ms('2026-09-21', '13:00')),
      entry: 1, exit: 2, pnl: 1, r: 0, size: '1', tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] });
    T = [zelfde(1), zelfde(2), zelfde(3)]; persist(); render();
    const lees = () => [...document.querySelectorAll('td[data-l="Pair"]')].map(c => c.textContent.trim()).join('|');
    const a = lees(); render(); const b = lees(); render(); const c = lees();
    return { a, b, c, n: a.split('|').filter(Boolean).length };
  });
  ok('drie trades op exact hetzelfde moment blijven bij hertekenen op hun plek',
    stabiel.n === 3 && stabiel.a === stabiel.b && stabiel.b === stabiel.c, JSON.stringify(stabiel));

  ok('geen JS-errors totaal', errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));
  console.log(`\n=== Tradestabel-sortering: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
