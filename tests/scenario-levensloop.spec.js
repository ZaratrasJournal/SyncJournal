// Scenario's die zo echt mogelijk lijken, plus bewust kapotte invoer (Denny 22-09-2026:
// "boots imports na, klopt data. boots ook fouten na"). Loopt door de échte sync-flow
// (syncExchange), met de exchange-API nagebootst: Hyperliquid rechtstreeks (_post), OKX via
// de proxy (fetch). Daarna back-up, CSV en een corrupte back-up.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const bij = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 1e-6 : tol);
const APP = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');
const CSV = path.resolve('tests/_fixtures/hyperliquid-export.csv');
const NU = Date.now(), UUR = 36e5, DAG = 864e5;
const WALLET = '0x' + 'a'.repeat(40);

/* ── Hyperliquid-fills bouwen zoals de API ze geeft ──
   orders: {t, coin, dir, px, sz, split?}. startPosition, closedPnl (bruto, tegen de gewogen
   entry), fee (0,045 % taker) en side (B/A) worden hier uitgerekend; sub-fills (split) krijgen
   opeenvolgende startPositions en tids, maar kunnen in willekeurige volgorde binnenkomen. */
function maakFills(orders) {
  const pos = {}; const out = []; let tid = 5_000_000;
  for (const o of orders.slice().sort((a, b) => a.t - b.t)) {
    const st = pos[o.coin] || (pos[o.coin] = { p: 0, avg: 0 });
    const buy = /Open Long|Close Short|Buy/.test(o.dir);
    const delen = o.split ? [o.sz * 0.3, o.sz * 0.7] : [o.sz];
    for (const sz of delen) {
      const sluit = /Close/.test(o.dir);
      const richting = st.p >= 0 ? 1 : -1;
      const pnl = sluit ? (o.px - st.avg) * sz * (st.p > 0 ? 1 : -1) : 0;
      out.push({ coin: o.coin, px: String(o.px), sz: String(+sz.toFixed(8)), side: buy ? 'B' : 'A', time: o.t, startPosition: String(+st.p.toFixed(8)),
        dir: o.dir, closedPnl: String(+pnl.toFixed(6)), hash: '0x' + (tid).toString(16), oid: tid, crossed: true, fee: String(+(o.px * sz * 0.00045).toFixed(6)), tid: tid++, feeToken: 'USDC' });
      if (!sluit) { const n = Math.abs(st.p) + sz; st.avg = (st.avg * Math.abs(st.p) + o.px * sz) / n; }
      st.p += buy ? sz : -sz; if (Math.abs(st.p) < 1e-9) { st.p = 0; st.avg = 0; }
    }
  }
  return out;
}
const netto = fills => fills.reduce((a, f) => a + (+f.closedPnl) - (+f.fee), 0);

(async () => {
  const b = await chromium.launch(); const errs = [];
  async function open() {
    const ctx = await b.newContext(); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
    p.on('dialog', d => d.accept());
    await p.route('**/*', r => /^https?:/.test(r.request().url()) ? r.abort() : r.continue());
    await p.addInitScript(() => localStorage.setItem('sj_welcomed', 'true'));
    await p.goto(APP, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1200);
    await p.evaluate(() => { T = []; TRASH = []; });
    return { ctx, p };
  }
  // de Hyperliquid-API nabootsen: window.__HL houdt de "server"-staat
  const hlServer = (p, fills, positions, wallet) => p.evaluate(([fs, ps, w]) => {
    window.__HL = { fills: fs, positions: ps, calls: [], failOn: null };
    ExchangeAPI.hyperliquid._post = async body => {
      const H = window.__HL; H.calls.push(body);
      if (H.failOn === 'alles') throw new Error('Hyperliquid HTTP 503');
      if (body.type === 'clearinghouseState') return { marginSummary: { accountValue: '100' }, assetPositions: H.positions };
      if (body.type === 'spotClearinghouseState') return { balances: [] };
      if (body.type === 'userFillsByTime') {
        if (H.failOn === 'fills') throw new Error('Hyperliquid HTTP 429');
        if (H.failOn === 'lookback' && body.endTime) throw new Error('Hyperliquid HTTP 500');
        return H.fills.filter(f => f.time >= body.startTime && (!body.endTime || f.time <= body.endTime)).sort((a, b) => a.time - b.time);
      }
      return [];
    };
    CONNS.hyperliquid = { connected: true, wallet: w, lastSync: 0, syncFrom: '' }; persistConns();
  }, [fills, positions, wallet || WALLET]);
  const hlSync = p => p.evaluate(async () => { const n = await syncExchange('hyperliquid', { quiet: true }); return { n, calls: window.__HL.calls.map(c => c.type + (c.endTime ? '(terug)' : '')) }; });
  const hl = p => p.evaluate(() => T.filter(t => t.exchange === 'hyperliquid').map(t => ({ srcId: t.srcId, status: t.status, pair: t.pair, dir: t.dir, entry: +t.entry, exit: +t.exit, pnl: +t.pnl, qty: +t.qtyAsset,
    steps: (t.fills || []).map(f => f.kind + (f.synthetic ? '≈' : '')).join(','), notes: t.notes || '' })));

  console.log('─── Hyperliquid: twee dagen handelen, drie syncs ───');
  {
    const d1 = NU - 5 * DAG;
    const dag1 = [
      { t: d1 + 10 * UUR, coin: 'BTC', dir: 'Open Long', px: 80000, sz: 0.002, split: true },
      { t: d1 + 11 * UUR, coin: 'BTC', dir: 'Open Long', px: 79500, sz: 0.001 },
      { t: d1 + 13 * UUR, coin: 'BTC', dir: 'Close Long', px: 81000, sz: 0.0015 },
      { t: d1 + 14 * UUR, coin: 'BTC', dir: 'Close Long', px: 82000, sz: 0.0015 },
      { t: d1 + 15 * UUR, coin: 'ETH', dir: 'Open Short', px: 3000, sz: 0.1 },
    ];
    const dag2 = [
      { t: NU - 30 * 60e3, coin: 'ETH', dir: 'Close Short', px: 2900, sz: 0.05 },
      { t: NU - 20 * 60e3, coin: 'ETH', dir: 'Close Short', px: 2950, sz: 0.05 },
    ];
    const f1 = maakFills(dag1), f2 = maakFills([...dag1, ...dag2]);
    const { ctx, p } = await open();
    await hlServer(p, f1, [{ position: { coin: 'ETH', szi: '-0.1', entryPx: '3000', leverage: { value: 5 }, unrealizedPnl: '1', liquidationPx: '4000' } }]);
    const s1 = await hlSync(p); let t = await hl(p);
    const btc = t.find(x => x.pair === 'BTC/USDC'), ethOpen = t.find(x => x.pair === 'ETH/USDC');
    ok('sync 1: één gesloten BTC-trade en een open ETH-positie', s1.n === 1 && t.length === 2 && btc && btc.status === 'closed' && ethOpen && ethOpen.status === 'open', JSON.stringify({ s1, t }));
    ok('BTC: open, bij, af, af — de twee sub-fills zijn één instap', btc && btc.steps === 'open,add,close,close', btc && btc.steps);
    ok('BTC: gewogen entry 79.833,33, exit 81.500, size 0,003', btc && bij(btc.entry, 79833.33, 0.01) && bij(btc.exit, 81500, 0.01) && bij(btc.qty, 0.003, 1e-9), JSON.stringify(btc));
    ok('BTC: netto P&L = Σ closedPnl − fees', btc && bij(btc.pnl, netto(f1.filter(f => f.coin === 'BTC')), 0.0001), `${btc && btc.pnl} vs ${netto(f1.filter(f => f.coin === 'BTC')).toFixed(4)}`);
    ok('geen terugkijk-aanroep: alles begon op nul', !s1.calls.some(c => /terug/.test(c)), JSON.stringify(s1.calls));

    await p.evaluate(fs => { window.__HL.fills = fs; window.__HL.positions = []; window.__HL.calls = []; }, f2);
    const s2 = await hlSync(p); t = await hl(p);
    const eth = t.find(x => x.pair === 'ETH/USDC');
    ok('sync 2: de ETH-short is gesloten en vervangt de open positie', s2.n === 1 && t.length === 2 && eth && eth.status === 'closed' && !t.some(x => x.status === 'open'), JSON.stringify({ s2: s2.n, t }));
    ok('het venster had alleen de sluitingen; de sync keek terug en vond de instap', s2.calls.some(c => /terug/.test(c)) && eth && eth.steps === 'open,close,close', JSON.stringify({ calls: s2.calls, steps: eth && eth.steps }));
    ok('ETH: entry 3.000, exit 2.925, P&L klopt', eth && bij(eth.entry, 3000, 0.01) && bij(eth.exit, 2925, 0.01) && bij(eth.pnl, netto(f2.filter(f => f.coin === 'ETH')), 0.0001), JSON.stringify(eth));
    ok('de BTC-trade is niet aangeraakt', JSON.stringify(t.find(x => x.pair === 'BTC/USDC')) === JSON.stringify(btc));

    const s3 = await hlSync(p); const t3 = await hl(p);
    ok('sync 3: niets nieuws, niets veranderd', s3.n === 0 && JSON.stringify(t3) === JSON.stringify(t), JSON.stringify(s3.n));

    // back-up mee naar een vers profiel
    const backup = await p.evaluate(() => snapshotPayload());
    await ctx.close();
    const vers = await open();
    const na = await vers.p.evaluate(async d => { applyBackup(d); await new Promise(x => setTimeout(x, 1500)); return { schema: DB.load('schema', 0), t: T.filter(x => x.exchange === 'hyperliquid').map(x => ({ srcId: x.srcId, steps: (x.fills || []).length, pnl: +x.pnl })) }; }, backup);
    ok('back-up op een vers profiel: trades én stappen intact', na.t.length === 2 && na.t.every(x => x.steps >= 3) && bij(na.t.reduce((a, x) => a + x.pnl, 0), t3.reduce((a, x) => a + x.pnl, 0), 1e-6), JSON.stringify(na));
    const form = await vers.p.evaluate(() => { const t = T.find(x => x.exchange === 'hyperliquid'); openForm(t.id); const el = document.querySelector('.exwrap'); const r = { tabel: !!el && !!el.querySelector('table'), tpBouwer: !!document.getElementById('tpbuilder') }; closeForm(); return r; });
    ok('het formulier toont de stappentabel', form.tabel, JSON.stringify(form));
    await vers.ctx.close();
  }

  console.log('─── Hyperliquid: bewust kapot ───');
  {
    const d1 = NU - 2 * DAG;
    const basis = [
      { t: d1, coin: 'SOL', dir: 'Open Long', px: 150, sz: 2 }, { t: d1 + UUR, coin: 'SOL', dir: 'Close Long', px: 155, sz: 1 }, { t: d1 + 2 * UUR, coin: 'SOL', dir: 'Close Long', px: 160, sz: 1 },
    ];
    const goed = maakFills(basis);
    // 1. de API valt uit
    {
      const { ctx, p } = await open();
      await hlServer(p, goed, []);
      await p.evaluate(() => { window.__HL.failOn = 'fills'; });
      const s = await hlSync(p); const t = await hl(p);
      ok('API-fout bij fills: sync meldt mislukt, journal blijft leeg', s.n === -1 && t.length === 0, JSON.stringify({ n: s.n, t: t.length }));
      await p.evaluate(() => { window.__HL.failOn = 'alles'; });
      const s2 = await hlSync(p);
      ok('alles down: ook dan geen crash en geen halve data', s2.n === -1 && (await hl(p)).length === 0, JSON.stringify(s2.n));
      await p.evaluate(() => { window.__HL.failOn = null; });
      const s3 = await hlSync(p); const t3 = await hl(p);
      ok('daarna herstelt de sync zich gewoon', s3.n === 1 && t3.length === 1 && t3[0].steps === 'open,close,close', JSON.stringify(t3));
      await ctx.close();
    }
    // 2. alleen sluitingen in het venster en het terugkijken mislukt
    {
      const { ctx, p } = await open();
      await hlServer(p, goed, []);
      await p.evaluate(t0 => { CONNS.hyperliquid.lastSync = t0 + 90 * 60e3; persistConns(); window.__HL.failOn = 'lookback'; }, d1);   // venster = lastSync − 1 uur = na de instap, vóór de sluitingen
      const s = await hlSync(p); const t = await hl(p);
      ok('terugkijken mislukt: de trade komt tóch, met een afgeleide instap', s.n === 1 && t.length === 1 && t[0].steps === 'open≈,close,close', JSON.stringify({ n: s.n, t }));
      ok('en die instap is de echte 150', t[0] && bij(t[0].entry, 150, 0.01) && /afgeleid/.test(t[0].notes), JSON.stringify(t[0]));
      await ctx.close();
    }
    // 3. rommel in de fills
    {
      const rommel = [
        ...goed,
        { ...goed[0], tid: goed[0].tid },                                             // exacte dubbele
        { coin: 'SOL', px: 'abc', sz: '1', side: 'B', time: d1 + 3 * UUR, dir: 'Open Long', closedPnl: '0', fee: '0', tid: 1 },   // prijs onleesbaar
        { coin: 'SOL', px: '150', sz: '0', side: 'B', time: d1 + 3 * UUR, dir: 'Open Long', closedPnl: '0', fee: '0', tid: 2 },   // grootte nul
        { coin: 'DOGE', px: '0.1', sz: '100', time: d1 + 3 * UUR, dir: 'Gefeliciteerd', closedPnl: '0', fee: '0', tid: 3 },       // onbekende richting, geen side
        { coin: 'PEPE', px: '0.00001', sz: '1000000', side: 'B', time: 'gisteren', dir: 'Open Long', closedPnl: '0', fee: '0.01', tid: 4 },   // tijd onleesbaar
        { coin: 'SOL', px: '170', sz: '1', side: 'A', time: d1 + 4 * UUR, dir: 'Close Long', closedPnl: '5', fee: '0.1', tid: 5 },  // sluiting zonder open (positie 0 → wordt afgeleid)
      ];
      const { ctx, p } = await open();
      await hlServer(p, rommel, []);
      const s = await hlSync(p); const t = await hl(p);
      ok('rommel breekt de sync niet', s.n >= 1 && t.length >= 1, JSON.stringify({ n: s.n, t: t.length }));
      const sol = t.find(x => x.pair === 'SOL/USDC' && x.steps === 'open,close,close');
      ok('de goede SOL-trade komt er ongeschonden uit', !!sol && bij(sol.pnl, netto(goed), 0.0001), JSON.stringify(t));
      ok('de dubbele fill telt niet dubbel', sol && sol.steps.split(',').length === 3);
      ok('onleesbare prijs, grootte nul, onbekende richting en onleesbare tijd zijn genegeerd', !t.some(x => /DOGE|PEPE/.test(x.pair)), JSON.stringify(t.map(x => x.pair)));
      const los = t.find(x => x.pair === 'SOL/USDC' && /≈/.test(x.steps));
      ok('een sluiting zonder bekende instap wordt een trade met afgeleide instap (165)', !!los && bij(los.entry, 165, 0.01), JSON.stringify(los));
      // door elkaar aangeleverd
      await p.evaluate(fs => { window.__HL.fills = fs.slice().reverse(); T = []; CONNS.hyperliquid.lastSync = 0; }, rommel);
      const t2 = await (async () => { await hlSync(p); return hl(p); })();
      ok('in omgekeerde volgorde aangeleverd: zelfde uitkomst', JSON.stringify(t2.map(x => x.steps + x.pnl).sort()) === JSON.stringify(t.map(x => x.steps + x.pnl).sort()), JSON.stringify(t2));
      await ctx.close();
    }
    // 4. verkeerd wallet-adres
    {
      const { ctx, p } = await open();
      await hlServer(p, goed, [], '0xNIETGELDIG');
      const s = await hlSync(p);
      ok('ongeldig wallet-adres: nette weigering, geen crash', s.n === -1 && (await hl(p)).length === 0, JSON.stringify(s.n));
      await ctx.close();
    }
  }

  console.log('─── OKX via de proxy: sync, heropening, en dan kapot ───');
  {
    const POS = '3809943469299781632', INST = 'BTC-USD_UM_XPERP-04APR31';
    const rec = (cT, uT, o) => ({ instId: INST, posId: POS, posSide: 'short', direction: 'short', settleCcy: 'USDC', type: '2', cTime: String(cT), uTime: String(uT), ...o });
    const L1 = rec(NU - 4 * DAG, NU - 3 * DAG, { openAvgPx: '81029.3244', closeAvgPx: '82039.3078', closeTotalPos: '90', openMaxPos: '52', realizedPnl: '-9.7626', fee: '-0.7279', fundingFee: '0' });
    const L2 = rec(NU - 2 * UUR, NU - 10 * 60e3, { openAvgPx: '85551.6', closeAvgPx: '86290.1', closeTotalPos: '19', openMaxPos: '19', realizedPnl: '-1.5627', fee: '-0.1633', fundingFee: '0' });
    const fill = (ts, side, sz, px, fee, pnl) => ({ instId: INST, posSide: 'short', ts: String(ts), fillTime: String(ts), side, fillSz: String(sz), fillPx: String(px), fee: String(-fee), fillPnl: String(pnl || 0), tradeId: String(ts), ordId: 'o' + ts, subType: side === 'sell' ? '4' : '6' });
    const F1 = [fill(NU - 4 * DAG + 1000, 'sell', 38, 81008.9, 0.15), fill(NU - 4 * DAG + 2000, 'sell', 13, 81011.7, 0.05), fill(NU - 4 * DAG + UUR, 'buy', 25, 80378.5, 0.10, 1.58), fill(NU - 3 * DAG - UUR, 'buy', 13, 81403.1, 0.05, -0.51), fill(NU - 3 * DAG - 1000, 'buy', 13, 85888.6, 0.02, -6.30)];
    const F2 = [fill(NU - 2 * UUR + 1000, 'sell', 19, 85551.6, 0.08), fill(NU - 10 * 60e3 - 1000, 'buy', 19, 86290.1, 0.08, -1.40)];
    const okxServer = (p, hist, fills, opts) => p.evaluate(([h, f, o]) => {
      window.__OKX = { hist: h, fills: f, calls: [], ...o };
      ExchangeAPI.okx._ctvCache = { 'BTC-USD_UM_XPERP-04APR31': 0.0001 }; ExchangeAPI.okx._ctvCacheTs = Date.now();
      window.fetch = async (url, init) => {
        const antwoord = d => ({ ok: true, status: 200, json: async () => d, text: async () => JSON.stringify(d) });
        if (!/workers\.dev/.test(String(url))) return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
        const body = JSON.parse(init.body); const S = window.__OKX; S.calls.push(body.action);
        if (S.fout === body.action) return antwoord({ error: 'OKX /api/v5/account/positions-history: Invalid OK-ACCESS-KEY' });
        if (body.action === 'test') return antwoord({ success: true, balance: '42.83' });
        if (body.action === 'open_positions') return antwoord({ positions: [] });
        if (body.action === 'trades') return antwoord({ source: 'positions-history', trades: S.hist.filter(r => +r.uTime >= +body.startTime) });
        if (body.action === 'fills') return antwoord({ fills: S.fills.filter(x => +x.ts >= +body.startTime && +x.ts <= +body.endTime), _okxDebug: {} });
        return antwoord({});
      };
      CONNS.okx = { connected: true, apiKey: 'k', apiSecret: 's', passphrase: 'p', lastSync: 0, syncFrom: '' }; persistConns();
    }, [hist, fills, opts || {}]);
    const okxSync = p => p.evaluate(async () => { const n = await syncExchange('okx', { quiet: true }); return { n, calls: window.__OKX.calls.slice() }; });
    const okx = p => p.evaluate(() => T.filter(t => t.exchange === 'okx').map(t => ({ srcId: t.srcId, pnl: +t.pnl, exit: +t.exit, steps: (t.fills || []).map(f => f.kind).join(','), fillsNone: !!t.fillsNone })));

    const { ctx, p } = await open();
    await okxServer(p, [L1], F1);
    const s1 = await okxSync(p); let t = await okx(p);
    ok('sync 1: één trade met vijf stappen', s1.n === 1 && t.length === 1 && t[0].steps === 'open,add,close,close,close', JSON.stringify({ s1, t }));
    ok('de fills zijn per positie opgevraagd (één fills-aanroep)', s1.calls.filter(c => c === 'fills').length === 1, JSON.stringify(s1.calls));

    await p.evaluate(([h, f]) => { window.__OKX.hist = h; window.__OKX.fills = f; window.__OKX.calls = []; }, [[L1, L2], [...F1, ...F2]]);
    const s2 = await okxSync(p); t = await okx(p);
    ok('sync 2: de heropening met hetzelfde posId wordt een tweede trade', s2.n === 1 && t.length === 2, JSON.stringify(t.map(x => x.srcId)));
    ok('de eerste houdt zijn P&L en zijn vijf stappen', t[0] && t[0].pnl === -9.7626 && t[0].steps === 'open,add,close,close,close', JSON.stringify(t[0]));
    ok('de tweede krijgt zijn eigen twee stappen', t[1] && t[1].pnl === -1.5627 && t[1].steps === 'open,close', JSON.stringify(t[1]));

    // kapot: sleutel geweigerd
    await p.evaluate(() => { window.__OKX.fout = 'trades'; window.__OKX.calls = []; });
    const s3 = await okxSync(p); const t3 = await okx(p);
    ok('sleutel geweigerd: sync mislukt netjes, trades onaangeroerd', s3.n === -1 && JSON.stringify(t3) === JSON.stringify(t), JSON.stringify(s3.n));
    // kapot: fills van een ander instrument / rommel
    await p.evaluate(([f]) => { window.__OKX.fout = null; window.__OKX.hist.push({ ...window.__OKX.hist[1], cTime: String(Date.now() - 30 * 60e3), uTime: String(Date.now() - 60e3), realizedPnl: '2.5' }); window.__OKX.fills = f; window.__OKX.calls = []; },
      [[{ instId: 'ETH-USDT-SWAP', posSide: 'long', ts: String(NU - 20 * 60e3), side: 'buy', fillSz: '1', fillPx: '2000', fee: '-0.1' }, { instId: INST, posSide: 'short', ts: String(NU - 10 * 60e3), side: 'sell', fillSz: 'NaN', fillPx: '-5', fee: 'x' }]]);
    const s4 = await okxSync(p); const t4 = await okx(p);
    const derde = t4.find(x => x.pnl === 2.5);
    ok('nieuwe positie, maar de fills kloppen niet: trade komt zonder stappen, geen crash', s4.n === 1 && derde && derde.steps === '' && derde.fillsNone, JSON.stringify(derde));
    await p.evaluate(() => { window.__OKX.calls = []; });
    const s5 = await okxSync(p);
    ok('en de volgende sync vraagt die fills niet opnieuw op', !s5.calls.includes('fills'), JSON.stringify(s5.calls));
    await ctx.close();
  }

  console.log('─── CSV-import van de echte Hyperliquid-export ───');
  if (fs.existsSync(CSV)) {
    const tekst = fs.readFileSync(CSV, 'utf8');
    // onafhankelijk: per coin de positie uit de rijen, netto = Σ closedPnl van de CSV (die is al na fees)
    const rijen = tekst.trim().split(/\r?\n/).slice(1).map(l => l.split(',')).map(v => ({ coin: v[1], dir: v[2], sz: +v[4], pnl: +v[7] }));
    const pos = {}; let loops = 0, net = 0, lopend = 0;
    for (const r of rijen) { const st = pos[r.coin] || (pos[r.coin] = { p: 0, pnl: 0 }); st.p += /Open Long|Close Short/.test(r.dir) ? r.sz : -r.sz; st.pnl += r.pnl; if (Math.abs(st.p) < 1e-9) { loops++; net += st.pnl; st.pnl = 0; } }
    lopend = Object.values(pos).filter(s => Math.abs(s.p) > 1e-9).length;
    const { ctx, p } = await open();
    const r = await p.evaluate(async txt => { sjImportCsvText(txt, ''); await new Promise(x => setTimeout(x, 800)); const a = T.length; sjImportCsvText(txt, ''); await new Promise(x => setTimeout(x, 800));
      return { a, b: T.length, pnl: T.reduce((s, t) => s + (+t.pnl || 0), 0), steps: T.filter(t => t.fills && t.fills.length >= 2).length, srcIds: T.map(t => t.srcId) }; }, tekst);
    ok(`${rijen.length} rijen worden ${loops} posities (${lopend} nog open)`, r.a === loops, `${r.a} vs ${loops}`);
    ok('Σ P&L = Σ closedPnl uit de CSV', bij(r.pnl, net, 0.01), `${r.pnl.toFixed(4)} vs ${net.toFixed(4)}`);
    ok('elke trade heeft zijn stappen', r.steps === r.a, `${r.steps} vs ${r.a}`);
    ok('dezelfde CSV nog eens importeren voegt niets toe', r.b === r.a, `${r.b} vs ${r.a}`);
    await ctx.close();
  } else ok('HL-export fixture aanwezig', false);

  console.log('─── Corrupte back-up en oude schema’s ───');
  {
    const { ctx, p } = await open();
    const r = await p.evaluate(async () => {
      const basis = { exchange: 'hyperliquid', status: 'closed', kind: 'live', pair: 'BTC/USDC', dir: 'long', date: '2026-05-01', time: '10:00', entry: 100, exit: 110, pnl: 1, tags: [], tps: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] };
      const d = { app: 'SyncJournal', schemaVersion: 2, trades: [
        { ...basis, id: 1, srcId: 'hyperliquid_111', openTime: '1777000000000', closeTime: '1777003600000', fills: 'geen array' },
        { ...basis, id: 2, srcId: 'hyperliquid_222', openTime: '', closeTime: '', fills: [{}, { kind: 'close' }, null] },
        { ...basis, id: 3, srcId: 'okx_123', exchange: 'okx', openTime: 'abc', closeTime: '1777003600000', fills: [{ ts: 1, side: 'buy', qty: 1, price: 'x' }] },
        { ...basis, id: 4, srcId: 'okx_124_1777003600000', exchange: 'okx', openTime: '1777000000000', closeTime: '1777003600000', notes: 'blijft' },
        { ...basis, id: 5, srcId: 'okx_124_1777000000000', exchange: 'okx', openTime: '1777000000000', closeTime: '1777000000000' },
        { ...basis, id: 6, exchange: 'manual', srcId: '', entry: 'NaN', pnl: 'x' },
        null, 'geen trade', 42,
      ], trash: [{ ...basis, id: 7, srcId: 'okx_555', exchange: 'okx', openTime: '1777000000000', deletedAt: 1 }, null], conns: { okx: { connected: true, apiKey: 'k', lastSync: 5 } } };
      applyBackup(d); await new Promise(x => setTimeout(x, 2000));
      const uit = { schema: DB.load('schema', 0), n: T.length, ids: T.map(t => t.srcId), prul: TRASH.map(t => t && t.srcId), okxLast: CONNS.okx && CONNS.okx.lastSync, fouten: [] };
      for (const t of T) { try { openForm(t.id); closeForm(); } catch (e) { uit.fouten.push(t.id + ': ' + e.message); } }
      try { render(); } catch (e) { uit.fouten.push('render: ' + e.message); }
      return uit;
    });
    ok('een back-up met rommel laadt, en de migraties 4→6 lopen door', r.schema >= 6, JSON.stringify(r));
    ok('OKX: de twee tussenstanden zijn één trade, met de sleutel per positie', r.ids.filter(k => /^okx_124_/.test(k)).length === 1 && r.ids.includes('okx_124_1777000000000'), JSON.stringify(r.ids));
    ok('de OKX-rij zonder leesbare openTime valt terug op de sluittijd', r.ids.includes('okx_123_1777003600000'), JSON.stringify(r.ids));
    ok('de prullenbak is mee hernoemd, null-rijen deren niet', r.prul.includes('okx_555_1777000000000'), JSON.stringify(r.prul));
    ok('elk formulier opent en sluit zonder fout, ook met kapotte stappen', r.fouten.length === 0, JSON.stringify(r.fouten));
    ok('de OKX-sync is teruggezet', r.okxLast < 1777000000000, JSON.stringify(r.okxLast));
    await ctx.close();
  }

  ok('geen JS-errors totaal', errs.length === 0, [...new Set(errs)].slice(0, 4).join(' | '));
  console.log(`\n=== Scenario’s levensloop: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
