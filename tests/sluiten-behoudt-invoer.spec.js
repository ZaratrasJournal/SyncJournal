// Als een open trade gesloten wordt, blijft alles wat jij invulde staan.
//
// Denny 29-09-2026, Hyperliquid: na het sluiten verscheen "Zo is deze positie gelopen", maar de
// setup-lagen waren weg (en daarmee MSB en 1H in de Tags-kolom). De emotie Geduldig bleef wél.
// Oorzaak: de open rij maakt plaats voor de gesloten trade van de exchange, en adoptUserFieldsSJ
// zet dan alleen de velden uit SJ_USER_FIELDS over. Daar ontbraken layers, timeframe, market,
// mae/mfe, missedReasons, reviewed en planRef. Die lijst is gedeeld: via finalizeStaleOpens,
// finalizePlaceholders en de Kraken- en Hyperliquid-adapter raakte het alle exchanges.
const { chromium } = require('playwright');
const path = require('path');

let pass = 0, fail = 0;
const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

// Wat jij in het formulier invulde (alle soorten die het formulier opslaat als eigen invoer)
const JOUW = {
  layers: [{ timeframe: '1H', bias: 'Bullish', setups: ['MSB'], confirmations: ['OB'] }],
  timeframe: '1H', market: 'Trending', setup: '1H MSB/BOS', grade: 'A',
  emotions: ['Geduldig'], emotion: 'Geduldig', mistakes: ['Te vroeg in'], mistake: 'Te vroeg in',
  tags: ['nieuwsdag'], notes: 'mooie retest', lessons: 'geduld loont',
  stop: 82500, risk: 1, rrPlanned: 2, mae: 0.4, mfe: 1.8, reviewed: true, planRef: 'dag-2026-09-28',
};
const VELDEN = Object.keys(JOUW);

(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(600);
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(800);
  await p.evaluate(() => { try { hideWelcome(); } catch (e) {} });
  ok('boot zonder JS-fouten', errs.length === 0, errs[0]);

  const r = await p.evaluate(({ JOUW, VELDEN }) => {
    const uit = {};
    const B = { pair: 'BTC/USDC', dir: 'long', date: '2026-09-28', time: '17:40', openTime: Date.parse('2026-09-28T17:40:00') };
    const kopie = o => JSON.parse(JSON.stringify(o));

    // ── Route 1: finalizeStaleOpens (algemeen; zo sluit een Hyperliquid-positie via de sync) ──
    T = [
      { ...EMPTY_TRADE, ...B, ...kopie(JOUW), id: 'open1', exchange: 'hyperliquid', status: 'open', _stale: true, positionId: 'p1', entry: 83228, size: '707.44' },
      { ...EMPTY_TRADE, ...B, id: 'dicht1', exchange: 'hyperliquid', status: 'closed', positionId: 'p1', entry: 83227.99, exit: 83356, pnl: 0.45, fees: 0.64,
        closeTime: Date.parse('2026-09-29T17:13:00'), layers: [], emotions: [], tags: [] },
    ];
    finalizeStaleOpens('hyperliquid');
    uit.r1 = { aantal: T.length, t: kopie(T[0] || {}) };

    // ── Route 2: finalizePlaceholders (exchanges met een placeholder voor open posities) ──
    const phEx = ['okx', 'kraken', 'blofin', 'hyperliquid'].find(ex => ExchangeAPI[ex] && ExchangeAPI[ex].openIsPlaceholder);
    uit.phEx = phEx || null;
    if (phEx) {
      const ph = { ...EMPTY_TRADE, ...B, ...kopie(JOUW), id: 'ph1', exchange: phEx, status: 'open', placeholder: true, entry: 83365.8, size: '225.09' };
      const echt = { ...EMPTY_TRADE, ...B, id: 'echt1', exchange: phEx, status: 'closed', entry: 83365.8, exit: 83500, pnl: 1.2,
        closeTime: Date.parse('2026-09-29T16:00:00'), layers: [], emotions: [], tags: [] };
      T = [ph, echt];
      finalizePlaceholders(phEx, [echt]);
      uit.r2 = { aantal: T.length, t: kopie(T.find(t => t.id === 'echt1') || {}) };
    }

    // ── En zichtbaar: de Tags-kolom van de gesloten trade na route 1 ──
    T = [uit.r1.t]; persist(); clearGFilter(); setFilter('kind', 'alle'); go('trades');
    uit.cel = [...document.querySelectorAll('td[data-l="Tags"] .tagchip')].map(c => c.textContent.trim());
    return uit;
  }, { JOUW, VELDEN });

  const gelijk = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  for (const [naam, route] of [['Route 1 · sluiten via de sync (zoals bij Hyperliquid)', r.r1], ['Route 2 · placeholder maakt plaats (' + r.phEx + ')', r.r2]]) {
    console.log('─── ' + naam + ' ───');
    if (!route) { ok('route beschikbaar', false, 'geen exchange met openIsPlaceholder'); continue; }
    ok('er blijft één trade over', route.aantal === 1, 'aantal: ' + route.aantal);
    ok('en die is gesloten', route.t.status === 'closed', route.t.status);
    for (const k of VELDEN) ok(`${k} blijft staan`, gelijk(route.t[k], JOUW[k]), `${JSON.stringify(route.t[k])} ≠ ${JSON.stringify(JOUW[k])}`);
  }

  console.log('─── De cijfers van de exchange winnen ───');
  ok('entry komt van de gesloten trade, niet van de open rij', r.r1.t.entry === 83227.99, String(r.r1.t.entry));
  ok('exit en P&L komen van de exchange', r.r1.t.exit === 83356 && r.r1.t.pnl === 0.45, `${r.r1.t.exit} / ${r.r1.t.pnl}`);

  console.log('─── Wat je in het overzicht ziet ───');
  ['MSB', '1H', 'OB', 'Geduldig'].forEach(x => ok(`"${x}" staat na het sluiten in de Tags-kolom`, r.cel.includes(x), JSON.stringify(r.cel)));

  ok('geen nieuwe JS-fouten', errs.length === 0, errs[0]);
  console.log(`\n=== Sluiten behoudt invoer: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
