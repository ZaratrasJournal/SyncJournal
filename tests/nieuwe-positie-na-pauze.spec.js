// Een paar dagen niet gesynct: de vorige positie ging dicht, een nieuwe op dezelfde coin ging open.
//
// Melding Denny, 06-10-2026: zijn short van 5-10 16:24 stond in de journal op 30-09. Hyperliquid
// geeft een open positie één vaste sleutel per coin (hyperliquid_open_BTC). Bij de sync van 6-10 vond
// syncOpenTrades de open rij van de short van 30-09 (die op 1-10 dichtging zonder dat er tussendoor
// gesynct was) onder dezelfde sleutel, en schreef de nieuwe positie erin: entry en grootte van 5-10,
// datum van 30-09. Daardoor herkende de gesloten trade 30-09→1-10 zijn eigen open rij niet meer (de
// entry was overschreven), en bleef die als dubbele open rij staan, met jouw setup-lagen erop.
//
// De cijfers zijn die van Denny (Trade History op Hyperliquid), als nagemaakte fills: deze spec
// draait ook op CI. De klok staat per sync vast, zodat hij over een jaar nog hetzelfde doet.
const { chromium } = require('playwright');
const path = require('path');
const hl = require('./helpers/hl-wallet');

let pass = 0, fail = 0;
const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const WALLET = '0x' + 'b'.repeat(40);
const ms = s => Date.parse(s);   // tijden in UTC; in Amsterdam (CEST) twee uur later
const fill = (t, dir, side, sz, px, start, pnl, tid) => ({ coin: 'BTC', dir, side, px: String(px), sz: String(sz), startPosition: String(start),
  closedPnl: String(pnl), fee: '0.37', time: ms(t), tid, hash: '0x' + tid, oid: tid, crossed: true, feeToken: 'USDC' });
const FILLS = [
  fill('2026-09-30T17:25:44Z', 'Open Short', 'A', 0.00991, 84077, 0, 0, 1),               // A: 30-09 19:25
  fill('2026-10-01T17:42:01Z', 'Close Short', 'B', 0.00991, 85003, -0.00991, -9.18666, 2), // A dicht: 01-10 19:42
  fill('2026-10-05T14:24:15Z', 'Open Short', 'A', 0.00447, 86303, 0, 0, 3),               // B: 05-10 16:24, loopt nog
];
const ACC = { wallet: WALLET, fills: FILLS, clearinghouseState: { marginSummary: { accountValue: '111' }, assetPositions: [] }, spotClearinghouseState: { balances: [] } };
const SYNC1 = ms('2026-09-30T20:00:00Z'), SYNC2 = ms('2026-10-06T19:16:00Z');
const JOUW = { layers: [{ timeframe: '1H', bias: 'Bearish', setups: ['MSB'], confirmations: [] }], notes: 'short op de retest' };

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ timezoneId: 'Europe/Amsterdam', locale: 'nl-NL' });
  const p = await ctx.newPage();
  p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const klok = { nu: SYNC1 };
  await hl.speelAf(p, ACC, klok);
  await p.clock.setFixedTime(new Date(SYNC1));
  await p.goto('file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/'), { waitUntil: 'load' });
  await p.waitForTimeout(600);
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(800);
  await p.evaluate(() => { try { hideWelcome(); } catch (e) {} });

  const rijen = () => p.evaluate(() => T.filter(t => t.exchange === 'hyperliquid').map(t => ({ id: t.id, status: t.status, srcId: t.srcId,
    date: t.date, time: t.time, entry: +t.entry, exit: +t.exit, openTime: +t.openTime, layers: t.layers || [], notes: t.notes || '' })));
  const sync = (nu, reset) => p.evaluate(async ({ wallet, reset }) => {
    if (reset) { T = []; TRASH = []; persist(); }
    CONNS.hyperliquid = { ...(CONNS.hyperliquid || {}), connected: true, wallet, hint: wallet.slice(-4), syncFrom: '2026-09-29' }; persistConns();
    return syncExchange('hyperliquid', { quiet: true });
  }, { wallet: WALLET, reset });
  const naar = async nu => { klok.nu = nu; await p.clock.setFixedTime(new Date(nu)); };
  const controleer = async (t, kop) => {
    const open = t.filter(x => x.status !== 'closed'), A = t.find(x => x.status === 'closed' && x.entry === 84077);
    ok(`${kop}: precies één open rij`, open.length === 1, JSON.stringify(open.map(x => [x.date, x.time, x.entry])));
    ok(`${kop}: die open rij is de short van 05-10 16:24, entry 86.303`, open.length === 1 && open[0].date === '2026-10-05' && open[0].time === '16:24' && open[0].entry === 86303,
      JSON.stringify(open[0]));
    ok(`${kop}: de short van 30-09 staat als gesloten trade, 30-09 19:25 → exit 85.003`, !!A && A.date === '2026-09-30' && A.time === '19:25' && A.exit === 85003, JSON.stringify(A));
    return { open, A };
  };

  console.log('─── 30-09, 22:00: de short van 30-09 loopt, je vult je setup in ───');
  await sync(SYNC1, true);
  const t1 = await rijen();
  const openA = t1.find(x => x.status !== 'closed');
  ok('de short van 30-09 staat open, met zijn eigen datum', !!openA && openA.date === '2026-09-30' && openA.time === '19:25' && openA.entry === 84077, JSON.stringify(openA));
  await p.evaluate(({ id, JOUW }) => { const t = T.find(x => x.id === id); t.layers = JOUW.layers; t.notes = JOUW.notes; persist(); }, { id: openA && openA.id, JOUW });

  console.log('─── 06-10: dagen niet gesynct; 30-09 ging op 01-10 dicht, op 05-10 een nieuwe short ───');
  await naar(SYNC2);
  await sync(SYNC2);
  const { open, A } = await controleer(await rijen(), 'na de sync');
  ok('je setup-lagen en notitie staan bij de short van 30-09', !!A && JSON.stringify(A.layers) === JSON.stringify(JOUW.layers) && A.notes === JOUW.notes, JSON.stringify(A && [A.layers, A.notes]));
  ok('en niet bij de nieuwe short van 05-10', open.length === 1 && !open[0].layers.length && !open[0].notes, JSON.stringify(open[0] && [open[0].layers, open[0].notes]));
  await sync(SYNC2);
  await controleer(await rijen(), 'nog een keer syncen');

  console.log('─── Een journal die het al mis had (zoals Denny\'s export van 06-10) herstelt bij de volgende sync ───');
  await p.evaluate(({ JOUW }) => {
    const basis = { exchange: 'hyperliquid', kind: 'live', pair: 'BTC/USDC', dir: 'short', positionId: 'BTC' };
    T = [
      { ...EMPTY_TRADE, ...basis, id: 43, srcId: 'hyperliquid_open_BTC', status: 'open', placeholder: true, date: '2026-09-30', time: '19:25',
        openTime: '1790789144408', entry: 86303, size: '385.77', qtyAsset: 0.00447, layers: JOUW.layers, notes: JOUW.notes },
      { ...EMPTY_TRADE, ...basis, id: 45, srcId: 'hyperliquid_656941860134266', status: 'closed', date: '2026-09-30', time: '19:25',
        openTime: '1790789144408', closeTime: '1790876521606', entry: 84077, exit: 85003, size: '833.2', qtyAsset: 0.00991, pnl: -9.9307 },
    ];
    persist(); CONNS.hyperliquid = { ...CONNS.hyperliquid, lastSync: Date.now() - 3600e3 }; persistConns();
  }, { JOUW });
  await sync(SYNC2);
  const h = await controleer(await rijen(), 'na herstel');
  ok('de verkeerde rij is weg, en je invoer zit bij de short van 30-09', !!h.A && JSON.stringify(h.A.layers) === JSON.stringify(JOUW.layers) && h.A.notes === JOUW.notes,
    JSON.stringify(h.A && [h.A.layers, h.A.notes]));

  ok('geen JS-fouten', errs.length === 0, errs[0]);
  console.log(`\n=== Nieuwe positie na pauze: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
