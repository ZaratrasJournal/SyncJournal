// Melding van een member (via Denny, 23-09-2026): een open Hyperliquid-positie stond in de
// journal op 23-09 15:02, terwijl hij op Hyperliquid om 14:49:31 was geopend. 15:02 was het
// moment van de sync. Hyperliquid geeft bij een open positie geen opentijd; die moet uit de
// fills komen — de positie begon bij de eerste uitvoering nadat hij voor het laatst vlak stond.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const APP = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');
const WALLET = '0x' + 'a'.repeat(40);
// de echte cijfers uit zijn schermafbeelding
const GEOPEND = +new Date('2026-09-23T14:49:31'), SYNC = +new Date('2026-09-23T15:02:00');

(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext(); const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
  p.on('dialog', d => d.accept());
  await p.route('**/*', r => /^https?:/.test(r.request().url()) ? r.abort() : r.continue());
  await p.addInitScript(() => localStorage.setItem('sj_welcomed', 'true'));
  await p.goto(APP, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1300);

  const fill = (ts, dir, sz, px, sp, tid) => ({ coin: 'BTC', dir, side: /Open Long|Close Short/.test(dir) ? 'B' : 'A',
    startPosition: String(sp), px: String(px), sz: String(sz), fee: '0.01', closedPnl: '0', time: ts, tid });

  const sync = (fills, posities) => p.evaluate(async ([f, pos, w]) => {
    T = []; TRASH = []; persist();
    window.__HL = { fills: f, posities: pos, calls: [] };
    ExchangeAPI.hyperliquid._post = async body => {
      const H = window.__HL; H.calls.push(body.type);
      if (body.type === 'clearinghouseState') return { marginSummary: { accountValue: '111' }, assetPositions: H.posities };
      if (body.type === 'spotClearinghouseState') return { balances: [] };
      if (body.type === 'userFillsByTime') return H.fills.filter(x => x.time >= body.startTime && (!body.endTime || x.time <= body.endTime));
      return [];
    };
    CONNS.hyperliquid = { connected: true, wallet: w, lastSync: 0, syncFrom: '' }; persistConns();
    await syncExchange('hyperliquid', { quiet: true });
    const t = T.find(x => x.status === 'open');
    return t ? { open: +t.openTime || 0, date: t.date, time: t.time, entry: +t.entry, dir: t.dir,
      regel: (tradeTimeline(t) || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() } : null;
  }, [fills, posities, WALLET]);

  const POSITIE = [{ position: { coin: 'BTC', szi: '0.00017', entryPx: '85568', leverage: { value: 5 }, unrealizedPnl: '0', liquidationPx: '0' } }];

  console.log('─── Precies zijn geval: één open long, eerder die dag geopend ───');
  {
    const r = await sync([
      fill(+new Date('2026-09-18T15:38:38'), 'Open Short', 0.0007, 78560, 0, 1),
      fill(+new Date('2026-09-18T15:51:08'), 'Close Short', 0.0007, 80218, -0.0007, 2),
      fill(GEOPEND, 'Open Long', 0.00017, 85568, 0, 3),
    ], POSITIE);
    ok('de opentijd is 14:49, niet het sync-moment', r && r.open === GEOPEND, JSON.stringify(r && new Date(r.open).toLocaleString('nl-NL')));
    ok('en dat staat ook zo in de datum- en tijdkolom', r && r.date === '2026-09-23' && r.time === '14:49', JSON.stringify(r && { d: r.date, t: r.time }));
    ok('de regel onder de trade zegt hetzelfde', r && /14:49/.test(r.regel) && !/15:02/.test(r.regel), JSON.stringify(r && r.regel).slice(0, 100));
    ok('de positie zelf klopt nog: long op 85.568', r && r.dir === 'long' && r.entry === 85568, JSON.stringify(r && { d: r.dir, e: r.entry }));
  }

  console.log('─── Een positie die in stappen is opgebouwd ───');
  {
    const t0 = +new Date('2026-09-23T09:00'), t1 = +new Date('2026-09-23T10:30'), t2 = +new Date('2026-09-23T11:45');
    const r = await sync([
      fill(t0, 'Open Long', 0.001, 85000, 0, 10),
      fill(t1, 'Open Long', 0.002, 85200, 0.001, 11),
      fill(t2, 'Close Long', 0.001, 85600, 0.003, 12),
    ], [{ position: { coin: 'BTC', szi: '0.002', entryPx: '85133', leverage: { value: 5 }, unrealizedPnl: '1', liquidationPx: '0' } }]);
    ok('de opentijd is die van de eerste instap, niet van de laatste bijkoop', r && r.open === t0, JSON.stringify(r && new Date(r.open).toLocaleTimeString('nl-NL')));
  }

  console.log('─── Een positie die eerder dicht ging en opnieuw is geopend ───');
  {
    const eerste = +new Date('2026-09-22T09:00'), dicht = +new Date('2026-09-22T12:00'), opnieuw = +new Date('2026-09-23T08:15');
    const r = await sync([
      fill(eerste, 'Open Long', 0.001, 84000, 0, 20),
      fill(dicht, 'Close Long', 0.001, 84500, 0.001, 21),
      fill(opnieuw, 'Open Long', 0.00017, 85568, 0, 22),
    ], POSITIE);
    ok('hij pakt de nieuwe positie, niet de afgesloten', r && r.open === opnieuw, JSON.stringify(r && new Date(r.open).toLocaleString('nl-NL')));
  }

  console.log('─── Wanneer we het niet kunnen weten ───');
  {
    // de positie liep al vóór het venster: de eerste fill heeft een stand die niet nul is
    const r = await sync([fill(+new Date('2026-09-23T10:00'), 'Open Long', 0.00007, 85000, 0.0001, 30)], POSITIE);
    ok('geen opentijd verzonnen', r && r.open === 0, JSON.stringify(r && r.open));
    ok('en ook geen tijd die niet klopt in de kolom', r && r.time === '', JSON.stringify(r && r.time));
    ok('wel een datum, zodat de trade gewoon in je lijst staat', r && /^\d{4}-\d{2}-\d{2}$/.test(r.date), JSON.stringify(r && r.date));
    const geen = await sync([], POSITIE);
    ok('zonder fills valt hij hier ook netjes op terug', geen && geen.open === 0 && geen.time === '', JSON.stringify(geen));
  }

  console.log('─── De extra aanroep gebeurt alleen wanneer het nodig is ───');
  {
    const zonder = await p.evaluate(async w => {
      T = []; persist();
      window.__HL = { fills: [], posities: [], calls: [] };
      ExchangeAPI.hyperliquid._post = async body => {
        const H = window.__HL; H.calls.push(body.type);
        if (body.type === 'clearinghouseState') return { marginSummary: { accountValue: '0' }, assetPositions: [] };
        if (body.type === 'spotClearinghouseState') return { balances: [] };
        return [];
      };
      CONNS.hyperliquid = { connected: true, wallet: w, lastSync: 0, syncFrom: '' }; persistConns();
      await ExchangeAPI.hyperliquid.fetchOpenPositions(w);
      return window.__HL.calls.filter(c => c === 'userFillsByTime').length;
    }, WALLET);
    ok('geen open posities, geen extra fills-aanroep', zonder === 0, JSON.stringify(zonder));
  }

  console.log('─── De bestaande, foute rij heelt zichzelf bij de volgende sync ───');
  {
    const r = await p.evaluate(async ([w, geopend, sync]) => {
      // zoals hij nu in zijn journal staat: gestempeld op het sync-moment
      T = [{ id: 1, exchange: 'hyperliquid', srcId: 'hyperliquid_open_BTC', positionId: 'BTC', pair: 'BTC/USDC', dir: 'long',
        status: 'open', kind: 'live', date: '2026-09-23', time: '15:02', openTime: '', closeTime: '',
        entry: 85568, exit: 0, pnl: 0, r: 0, size: '14.55', qtyAsset: 0.00017, fees: 0, notes: 'mijn notitie',
        tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] }];
      persist();
      window.__HL = { fills: [{ coin: 'BTC', dir: 'Open Long', side: 'B', startPosition: '0', px: '85568', sz: '0.00017', fee: '0.01', closedPnl: '0', time: geopend, tid: 3 }],
        posities: [{ position: { coin: 'BTC', szi: '0.00017', entryPx: '85568', leverage: { value: 5 }, unrealizedPnl: '0', liquidationPx: '0' } }], calls: [] };
      ExchangeAPI.hyperliquid._post = async body => {
        const H = window.__HL;
        if (body.type === 'clearinghouseState') return { marginSummary: { accountValue: '111' }, assetPositions: H.posities };
        if (body.type === 'spotClearinghouseState') return { balances: [] };
        if (body.type === 'userFillsByTime') return H.fills.filter(x => x.time >= body.startTime);
        return [];
      };
      CONNS.hyperliquid = { connected: true, wallet: w, lastSync: 0, syncFrom: '' }; persistConns();
      await syncExchange('hyperliquid', { quiet: true });
      const t = T.find(x => x.status === 'open');
      return { n: T.length, open: +t.openTime || 0, date: t.date, time: t.time, notes: t.notes };
    }, [WALLET, GEOPEND, SYNC]);
    ok('geen dubbele rij, dezelfde trade', r.n === 1, JSON.stringify(r.n));
    ok('de tijd is stilletjes gecorrigeerd naar 14:49', r.open === GEOPEND && r.time === '14:49', JSON.stringify({ t: r.time }));
    ok('en zijn notitie staat er nog', r.notes === 'mijn notitie', JSON.stringify(r.notes));
  }

  ok('geen JS-errors totaal', errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));
  console.log(`\n=== Hyperliquid open-tijd: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
