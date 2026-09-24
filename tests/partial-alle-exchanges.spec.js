// Denny 24-09-2026: "hebben de andere exchanges er ook last van? sloopt dit de verwerking op
// andere exchanges niet?" Dit is het antwoord, per exchange, in hetzelfde scenario:
//   1. een positie opent en wordt deels gesloten  → precies één rij, ook na herhaalde syncs
//   2. de rest gaat dicht                          → nog steeds één rij, nu gesloten
//   3. een nieuwe positie op hetzelfde instrument  → een tweede rij, de eerste blijft heel
// Voor OKX en Blofin (positiegeschiedenis) toont die ene rij het geboekte deel als partial.
// Voor Hyperliquid en Kraken (levensloop uit fills/gebeurtenissen) is de lopende positie een
// open rij; het geboekte deel wordt pas zichtbaar wanneer de levensloop klaar is. Dat is een
// bekend gat, geen dubbeltelling — en die grens staat hier expliciet in de assertie.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const bij = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 1e-6 : tol);
const APP = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');
const NU = Date.now(), UUR = 36e5, DAG = 864e5;
// open en deels dicht: twee dagen terug (eerste sync haalt 30 dagen); de rest en de nieuwe
// positie: vlak voor "nu", want die komen in het echt ook ná de vorige sync binnen
const T0 = NU - 2 * DAG, T1 = T0 + 2 * UUR, T2 = T0 + 5 * UUR, T3 = NU - 40 * 60e3, T4 = NU - 25 * 60e3, T5 = NU - 10 * 60e3;

(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext(); const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
  p.on('dialog', d => d.accept());
  await p.route('**/*', r => /^https?:/.test(r.request().url()) ? r.abort() : r.continue());
  await p.addInitScript(() => localStorage.setItem('sj_welcomed', 'true'));
  await p.goto(APP, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1300);

  // ── één "server" per exchange, met drie standen: deels dicht, helemaal dicht, nieuwe positie ──
  await p.evaluate(([T0, T1, T2, T3, T4, T5]) => {
    const S = window.__S = { fase: 'deels' };
    const okxInst = 'BTC-USD_UM_XPERP-04APR31';
    ExchangeAPI.okx._ctvCache = { [okxInst]: 0.0001 }; ExchangeAPI.okx._ctvCacheTs = Date.now();
    ExchangeAPI.blofin._ctvCache = {}; ExchangeAPI.blofin._ctvCacheTs = Date.now();

    // OKX
    const okxRec = (o) => ({ instId: okxInst, posId: '900', posSide: 'short', direction: 'short', settleCcy: 'USDC', type: '1',
      cTime: String(T0), uTime: String(T2), openAvgPx: '86415', closeAvgPx: '84913.84', closeTotalPos: '25', openMaxPos: '35',
      realizedPnl: '3.4562', fee: '-0.1', fundingFee: '0', ...o });
    S.okx = {
      deels: { hist: [okxRec({})], open: [{ instId: okxInst, posId: '900', posSide: 'short', cTime: String(T0), uTime: String(T2), settleCcy: 'USDC', avgPx: '86415', pos: '-10', lever: '10', upl: '1.2', liqPx: '90000', markPx: '85000' }] },
      dicht: { hist: [okxRec({ type: '2', uTime: String(T3), closeAvgPx: '84500', closeTotalPos: '35', realizedPnl: '5.9', fee: '-0.14' })], open: [] },
      nieuw: { hist: [okxRec({ type: '2', uTime: String(T3), closeAvgPx: '84500', closeTotalPos: '35', realizedPnl: '5.9', fee: '-0.14' }),
        okxRec({ type: '2', cTime: String(T4), uTime: String(T5), openAvgPx: '85000', closeAvgPx: '84800', closeTotalPos: '10', openMaxPos: '10', realizedPnl: '0.2', fee: '-0.05' })], open: [] },
    };
    // Blofin
    const bfRec = (o) => ({ historyId: '1', positionId: '800', instId: 'ETH-USDT', instType: 'SWAP', marginMode: 'cross', positionSide: 'net', side: 'buy',
      closePositions: '1', maxPositions: '2', liquidationPositions: '0', openAveragePrice: '3000', closeAveragePrice: '3040',
      createTime: String(T0), updateTime: String(T2), leverage: '10', realizedPnl: '39', fee: '1', ...o });
    S.blofin = {
      deels: { hist: [bfRec({})], open: [{ positionId: '800', instId: 'ETH-USDT', positionSide: 'net', positions: '1', averagePrice: '3000', markPrice: '3050', unrealizedPnl: '50', liquidationPrice: '2500', leverage: '10', createTime: String(T0), updateTime: String(T2) }] },
      dicht: { hist: [bfRec({ updateTime: String(T3), closePositions: '2', closeAveragePrice: '3045', realizedPnl: '88', fee: '2' })], open: [] },
      nieuw: { hist: [bfRec({ updateTime: String(T3), closePositions: '2', closeAveragePrice: '3045', realizedPnl: '88', fee: '2' }),
        bfRec({ historyId: '2', createTime: String(T4), updateTime: String(T5), closePositions: '1', maxPositions: '1', openAveragePrice: '3100', closeAveragePrice: '3090', realizedPnl: '-11', fee: '1' })], open: [] },
    };
    // Hyperliquid
    const hlFill = (t, dir, sz, px, sp, pnl, tid) => ({ coin: 'SOL', dir, side: /Open Long|Close Short/.test(dir) ? 'B' : 'A', startPosition: String(sp), px: String(px), sz: String(sz), fee: '0.02', closedPnl: String(pnl), time: t, tid });
    S.hyperliquid = {
      deels: { fills: [hlFill(T0, 'Open Long', 10, 150, 0, 0, 1), hlFill(T1, 'Close Long', 4, 155, 10, 20, 2)],
        open: [{ position: { coin: 'SOL', szi: '6', entryPx: '150', leverage: { value: 5 }, unrealizedPnl: '30', liquidationPx: '100' } }] },
      dicht: { fills: [hlFill(T0, 'Open Long', 10, 150, 0, 0, 1), hlFill(T1, 'Close Long', 4, 155, 10, 20, 2), hlFill(T3, 'Close Long', 6, 160, 6, 60, 3)], open: [] },
      nieuw: { fills: [hlFill(T0, 'Open Long', 10, 150, 0, 0, 1), hlFill(T1, 'Close Long', 4, 155, 10, 20, 2), hlFill(T3, 'Close Long', 6, 160, 6, 60, 3),
        hlFill(T4, 'Open Long', 2, 160, 0, 0, 4), hlFill(T5, 'Close Long', 2, 158, 2, -4, 5)], open: [] },
    };
    // Kraken (met gebeurtenissen)
    const krEv = (t, oud, nieuw, wissel, px, pnl, uid) => ({ uid, timestamp: t, event: { PositionUpdate: { tradeable: 'PF_XBTUSD', oldPosition: String(oud), newPosition: String(nieuw),
      newAverageEntryPrice: '80000', fillTime: t, fee: '0.2', realizedPnL: String(pnl), realizedFunding: '0', positionChange: wissel, executionUid: 'e' + uid,
      executionPrice: String(px), executionSize: String(Math.abs(nieuw - oud)), tradeType: 'userExecution', timestamp: t, updateReason: 'trade' } } });
    S.kraken = {
      deels: { events: [krEv(T0, 0, 0.01, 'open', 80000, 0, 'k1'), krEv(T1, 0.01, 0.004, 'decrease', 80700, 4, 'k2')], open: [{ symbol: 'PF_XBTUSD', side: 'long', size: 0.004, price: 80000, unrealizedPnl: 2, fillTime: new Date(T0).toISOString() }] },
      dicht: { events: [krEv(T0, 0, 0.01, 'open', 80000, 0, 'k1'), krEv(T1, 0.01, 0.004, 'decrease', 80700, 4, 'k2'), krEv(T3, 0.004, 0, 'close', 80500, 3, 'k3')], open: [] },
      nieuw: { events: [krEv(T0, 0, 0.01, 'open', 80000, 0, 'k1'), krEv(T1, 0.01, 0.004, 'decrease', 80700, 4, 'k2'), krEv(T3, 0.004, 0, 'close', 80500, 3, 'k3'),
        krEv(T4, 0, 0.002, 'open', 81000, 0, 'k4'), krEv(T5, 0.002, 0, 'close', 80900, -0.2, 'k5')], open: [] },
    };

    window.fetch = async (u, init) => {
      const body = JSON.parse(init.body || '{}'); const a = d => ({ ok: true, status: 200, json: async () => d, text: async () => '' });
      const st = (S[body.exchange] || {})[S.fase] || {};
      if (body.exchange === 'okx') {
        if (body.action === 'trades') return a({ source: 'positions-history', trades: st.hist || [] });
        if (body.action === 'open_positions') return a({ positions: st.open || [] });
        if (body.action === 'fills') return a({ fills: [] });
        return a({ success: true, balance: '100' });
      }
      if (body.exchange === 'kraken') {
        if (body.action === 'trades') return a({ source: 'position_updates', trades: [], events: st.events || [] });
        if (body.action === 'open_positions') return a({ positions: st.open || [] });
        return a({ success: true, balance: '100' });
      }
      return a({});
    };
    ExchangeAPI.blofin._direct = async (k, s, pp, pad, params) => {
      const st = S.blofin[S.fase];
      if (/positions-history/.test(pad)) return { data: st.hist };
      if (/fills-history/.test(pad)) return { data: [] };
      if (/account\/positions/.test(pad)) return { data: st.open };
      if (/asset\/balances/.test(pad)) return { data: [{ currency: 'USDT', balance: '100' }] };
      return { data: [] };
    };
    ExchangeAPI.hyperliquid._post = async body => {
      const st = S.hyperliquid[S.fase];
      if (body.type === 'clearinghouseState') return { marginSummary: { accountValue: '100' }, assetPositions: st.open };
      if (body.type === 'spotClearinghouseState') return { balances: [] };
      if (body.type === 'userFillsByTime') return st.fills.filter(f => f.time >= body.startTime && (!body.endTime || f.time <= body.endTime));
      return [];
    };
  }, [T0, T1, T2, T3, T4, T5]);

  const EX = ['okx', 'blofin', 'hyperliquid', 'kraken'];
  const start = () => p.evaluate(() => {
    T = []; TRASH = []; persist();
    CONNS = { okx: { connected: true, apiKey: 'k', apiSecret: 's', passphrase: 'p', lastSync: 0, syncFrom: '' },
      blofin: { connected: true, apiKey: 'k', apiSecret: 's', passphrase: 'p', lastSync: 0, syncFrom: '' },
      hyperliquid: { connected: true, wallet: '0x' + 'a'.repeat(40), lastSync: 0, syncFrom: '' },
      kraken: { connected: true, apiKey: 'k', apiSecret: 's', lastSync: 0, syncFrom: '' } };
    persistConns();
  });
  const fase = f => p.evaluate(f => { window.__S.fase = f; }, f);
  const syncAlle = async () => { for (const ex of EX) await p.evaluate(ex => syncExchange(ex, { quiet: true }), ex); };
  const stand = () => p.evaluate(() => {
    const per = {};
    ['okx', 'blofin', 'hyperliquid', 'kraken'].forEach(ex => {
      per[ex] = T.filter(t => t.exchange === ex).map(t => ({ status: t.status, ph: !!t.placeholder, pnl: +t.pnl || 0, realized: +t.realizedPnl || 0, notes: t.notes || '', steps: (t.fills || []).length }));
    });
    return per;
  });

  console.log('─── 1. Deels gesloten, vier syncs achter elkaar ───');
  await start(); await fase('deels');
  for (let i = 0; i < 4; i++) await syncAlle();
  await p.evaluate(() => { T.forEach(t => { t.notes = 'notitie ' + t.exchange; }); persist(); });
  await syncAlle();
  let s = await stand();
  EX.forEach(ex => ok(`${ex}: precies één rij, ook na vijf syncs`, s[ex].length === 1, JSON.stringify(s[ex])));
  ok('OKX en Blofin: die rij is partial met het geboekte deel apart',
    s.okx[0].status === 'partial' && bij(s.okx[0].realized, 3.4562, 1e-3) && s.okx[0].pnl === 0 &&
    s.blofin[0].status === 'partial' && bij(s.blofin[0].realized, 39, 1e-3) && s.blofin[0].pnl === 0, JSON.stringify({ okx: s.okx[0], blofin: s.blofin[0] }));
  ok('Hyperliquid en Kraken: de lopende positie is een open rij (bekend gat: het geboekte deel wacht op de sluiting)',
    s.hyperliquid[0].status === 'open' && s.kraken[0].status === 'open', JSON.stringify({ hl: s.hyperliquid[0], kr: s.kraken[0] }));
  ok('en niemand heeft zijn notitie verloren', EX.every(ex => s[ex][0].notes === 'notitie ' + ex), JSON.stringify(EX.map(ex => s[ex][0].notes)));

  console.log('─── 2. De rest gaat dicht ───');
  await fase('dicht'); await syncAlle(); await syncAlle();
  s = await stand();
  EX.forEach(ex => ok(`${ex}: nog steeds één rij, nu gesloten`, s[ex].length === 1 && s[ex][0].status === 'closed' && !s[ex][0].ph, JSON.stringify(s[ex])));
  ok('OKX 5,90 · Blofin 88 · Hyperliquid 79,94 · Kraken 6,40',
    bij(s.okx[0].pnl, 5.9, 1e-3) && bij(s.blofin[0].pnl, 88, 1e-3) && bij(s.hyperliquid[0].pnl, 80 - 0.06, 1e-3) && bij(s.kraken[0].pnl, 7 - 0.6, 1e-3),
    JSON.stringify(EX.map(ex => ex + '=' + s[ex][0].pnl)));
  ok('het gerealiseerd-deel is overal weer leeg', EX.every(ex => !s[ex][0].realized), JSON.stringify(EX.map(ex => s[ex][0].realized)));
  ok('en de notities overleefden de sluiting', EX.every(ex => s[ex][0].notes === 'notitie ' + ex), JSON.stringify(EX.map(ex => s[ex][0].notes)));
  ok('Hyperliquid en Kraken hebben nu hun stappen (Blofin/OKX halen die apart op)', s.hyperliquid[0].steps === 3 && s.kraken[0].steps === 3, JSON.stringify({ hl: s.hyperliquid[0].steps, kr: s.kraken[0].steps }));

  console.log('─── 3. Een nieuwe positie op hetzelfde instrument ───');
  await fase('nieuw'); await syncAlle(); await syncAlle();
  s = await stand();
  EX.forEach(ex => ok(`${ex}: twee rijen, allebei gesloten`, s[ex].length === 2 && s[ex].every(x => x.status === 'closed'), JSON.stringify(s[ex].map(x => x.status + ':' + x.pnl))));
  ok('de eerste positie is niet aangeraakt', bij(s.okx[0].pnl, 5.9, 1e-3) && bij(s.blofin[0].pnl, 88, 1e-3) && s.okx[0].notes === 'notitie okx', JSON.stringify({ okx: s.okx[0], blofin: s.blofin[0] }));

  ok('geen JS-errors totaal', errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));
  console.log(`\n=== Partial op alle exchanges: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
