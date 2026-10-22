// Hyperliquid: a partly closed position stays one partial row, sync after sync (Denny 22-10-2026).
//
// His short of 22-10 (0.00949 @ 81.621, TP 0.00341 @ 80.936 at 18:53) showed as a plain open row: no booked
// +$2.34, no R. Cause: Hyperliquid's own entry for the open position (81620.9) differs from the fill average
// (81621), so syncOpenTrades did not see the partial row as the same position, marked it stale and
// finalizeStaleOpens removed it. Once the TP was more than an hour before the last sync, the window
// (lastSync − 1 h) no longer held it and the partial row never came back. Same pattern as Kraken (v1.13).
// Review 22-10: a new position on the same coin must not take an old partial's id (P&L counted again every
// sync), and the wider window must not wipe the TPs you planned or the leverage you typed.
const { chromium } = require('playwright'); const path = require('path');
const hl = require('./helpers/hl-wallet');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const bij = (a, b, tol = 1e-3) => Math.abs(+a - b) <= tol;

const WALLET = '0x' + 'd'.repeat(40);
const ms = s => Date.parse(s);
const fill = (t, dir, side, sz, px, start, pnl, fee, tid, coin = 'BTC') => ({ coin, dir, side, px: String(px), sz: String(sz), startPosition: String(start),
  closedPnl: String(pnl), fee: String(fee), time: ms(t), tid, hash: '0x' + tid, oid: tid, crossed: true, feeToken: 'USDC' });
const acc = (fills, entryPx) => ({ wallet: WALLET, fills, entryPx, clearinghouseState: { marginSummary: { accountValue: '300' }, assetPositions: [] }, spotClearinghouseState: { balances: [] } });
// an earlier BTC trade, closed: finalizeStaleOpens found it as a "sibling" of the vanished row
const VORIGE = [fill('2026-10-20T08:00:00Z', 'Open Long', 'B', 0.001, 80000, 0, 0, 0.03, 21), fill('2026-10-20T10:00:00Z', 'Close Long', 'A', 0.001, 80500, 0.001, 0.5, 0.03, 22)];
const OPEN = fill('2026-10-22T14:07:01Z', 'Open Short', 'A', 0.00949, 81621, 0, 0, 0.43, 31);              // 16:07
const TP = fill('2026-10-22T16:53:05Z', 'Close Short', 'B', 0.00341, 80936, -0.00949, 2.33585, 0.12, 32);   // 18:53
// an ETH trade that closes inside the wider window
const ETH = [fill('2026-10-22T15:00:00Z', 'Open Long', 'B', 0.1, 3000, 0, 0, 0.1, 41, 'ETH'), fill('2026-10-22T15:30:00Z', 'Close Long', 'A', 0.1, 3050, 0.1, 5, 0.1, 42, 'ETH')];
const GEBOEKT = 2.33585 - 0.43 - 0.12;

(async () => {
  const b = await chromium.launch(); const errs = [];
  async function start(rekening, nu0) {
    const ctx = await b.newContext({ timezoneId: 'Europe/Amsterdam', locale: 'nl-NL' }); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(String(e)));
    await p.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
    const klok = { nu: nu0 }; await hl.speelAf(p, rekening, klok);
    const naar = async nu => { klok.nu = nu; await p.clock.setFixedTime(new Date(nu)); };
    await naar(nu0);
    await p.goto('file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/'), { waitUntil: 'load' }); await p.waitForTimeout(600);
    await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
    await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(800);
    await p.evaluate(() => { try { hideWelcome(); } catch (e) {} });
    const sync = () => p.evaluate(async w => { CONNS.hyperliquid = { ...(CONNS.hyperliquid || {}), connected: true, wallet: w, hint: w.slice(-4), syncFrom: '2026-10-15' }; persistConns();
      return syncExchange('hyperliquid', { quiet: true }); }, WALLET);
    const rijen = () => p.evaluate(() => T.filter(t => t.exchange === 'hyperliquid').map(t => ({ id: t.id, src: t.srcId, status: t.status, pair: t.pair, qty: +t.qtyAsset, pnl: +t.pnl,
      real: +t.realizedPnl || 0, notes: t.notes || '', stale: !!t._stale, ph: !!t.placeholder, r: tradeROrNull(t), stappen: (t.fills || []).length,
      lev: String(t.leverage || ''), gepland: (t.tps || []).filter(x => !x.hit).map(x => +x.price) })));
    return { p, naar, sync, rijen, ctx };
  }
  const uniek = t => { const s = t.map(x => x.src).filter(Boolean); return s.length === new Set(s).size; };

  console.log('─── Jouw short van 22-10 (Hyperliquid zegt entry 81.620,9) ───');
  {
    const { p, naar, sync, rijen, ctx } = await start(acc([...VORIGE, OPEN, ...ETH, TP], { BTC: '81620.9' }), ms('2026-10-22T13:00:00Z'));
    await sync();
    await naar(ms('2026-10-22T14:30:00Z')); await sync();
    await p.evaluate(() => { const t = T.find(x => x.exchange === 'hyperliquid' && x.status === 'open'); if (t) { t.notes = 'mijn short'; t.stop = 82300; } persist(); });
    let eerste = true;
    for (const [label, iso] of [['19:00, na de TP', '2026-10-22T17:00:00Z'], ['19:15', '2026-10-22T17:15:00Z'], ['19:30', '2026-10-22T17:30:00Z'], ['20:30, TP ruim een uur geleden', '2026-10-22T18:30:00Z'], ['22:20', '2026-10-22T20:20:00Z']]) {
      if (iso === '2026-10-22T17:15:00Z') await p.evaluate(() => {   // an old CSV partial from July: must not drag the window back
        T.push({ ...EMPTY_TRADE, id: 900, exchange: 'hyperliquid', kind: 'live', srcId: 'hyperliquid_csv_oud', status: 'partial', pair: 'SOL/USDC', dir: 'long', positionId: 'SOL',
          date: '2026-07-01', time: '10:00', openTime: String(Date.parse('2026-07-01T08:00:00Z')), entry: 150, qtyAsset: 1 }); persist();
        window.__van = []; const h = ExchangeAPI.hyperliquid, ft = h.fetchTrades.bind(h), po = h._post.bind(h);
        h._post = async body => { if (window.__inFetch && body.type === 'userFillsByTime') window.__van.push(+body.startTime); return po(body); };
        h.fetchTrades = async (...a) => { window.__inFetch = true; try { return await ft(...a); } finally { window.__inFetch = false; } }; });
      await naar(ms(iso)); await sync();
      if (iso === '2026-10-22T17:15:00Z') {
        const van = await p.evaluate(() => { const v = window.__van; T = T.filter(t => t.srcId !== 'hyperliquid_csv_oud'); persist(); return v; });
        ok('een oude CSV-partial uit juli trekt het venster niet terug (vanaf de opening van je short −1 u)', van.length > 0 && Math.min(...van) >= ms('2026-10-22T13:00:00Z'), JSON.stringify(van.map(x => new Date(x).toISOString())));
      }
      const t = await rijen(), lopend = t.filter(x => x.status !== 'closed' && x.pair === 'BTC/USDC'), r = lopend[0] || {};
      ok(`${label}: één rij, partial, volle grootte 0,00949, geboekt ${GEBOEKT.toFixed(2)}`, lopend.length === 1 && r.status === 'partial' && bij(r.qty, 0.00949, 1e-9) && bij(r.real, GEBOEKT) && !r.stale && !r.ph,
        JSON.stringify(lopend));
      ok(`${label}: je notitie staat erop, de vorige trade houdt de zijne; geen dubbele bron-id`, r.notes === 'mijn short' && t.filter(x => x.status === 'closed').every(x => x.notes === '') && uniek(t),
        JSON.stringify(t.map(x => [x.src, x.status, x.notes])));
      if (eerste) {   // your own plans: a TP on the running short, a TP and leverage on the ETH trade that closed inside the window
        eerste = false;
        await p.evaluate(() => { const s = T.find(x => x.exchange === 'hyperliquid' && x.status === 'partial'), e = T.find(x => x.exchange === 'hyperliquid' && x.pair === 'ETH/USDC');
          s.tps = [...(s.tps || []), { price: 80000, pct: 50, r: '', hit: false, ts: 0 }]; e.tps = [...(e.tps || []), { price: 3100, pct: 100, r: '', hit: false, ts: 0 }]; e.leverage = 10; persist(); });
      } else {
        const s = t.find(x => x.status === 'partial') || {}, e = t.find(x => x.pair === 'ETH/USDC') || {};
        ok(`${label}: je geplande TP's en je leverage blijven staan`, s.gepland && s.gepland.includes(80000) && e.gepland && e.gepland.includes(3100) && e.lev === '10', JSON.stringify([s.gepland, e.gepland, e.lev]));
      }
    }
    const r1 = (await rijen()).find(x => x.status === 'partial') || {};
    ok('de partial heeft een R (stop 82.300)', r1.r != null && r1.r > 0, JSON.stringify(r1));

    console.log('─── Zoals in je export van 22:21: alleen nog de open placeholder ───');
    await p.evaluate(async () => {
      const vorige = T.filter(x => x.exchange === 'hyperliquid' && x.status === 'closed');
      T = [...vorige, { ...EMPTY_TRADE, id: 105, exchange: 'hyperliquid', kind: 'live', srcId: 'hyperliquid_open_BTC', status: 'open', placeholder: true, pair: 'BTC/USDC', dir: 'short',
        positionId: 'BTC', date: '2026-10-22', time: '16:07', openTime: String(Date.parse('2026-10-22T14:07:01Z')), entry: 81620.9, size: '496.26', qtyAsset: 0.00608, stop: 82300, stopBron: 'hyperliquid', notes: 'mijn short' }];
      persist(); CONNS.hyperliquid = { ...CONNS.hyperliquid, lastSync: Date.parse('2026-10-22T20:20:18Z') }; persistConns(); });
    await naar(ms('2026-10-22T20:35:00Z')); await sync();
    const h = (await rijen()).filter(x => x.status !== 'closed');
    ok('na de update: de volgende sync maakt er weer één partial-rij van, met de TP en je notitie', h.length === 1 && h[0].status === 'partial' && bij(h[0].real, GEBOEKT) && h[0].stappen === 2 && h[0].notes === 'mijn short',
      JSON.stringify(h));
    await ctx.close();
  }

  console.log('─── Review C1: partial dicht terwijl de app uit staat, daarna een nieuwe short op BTC ───');
  {
    const P1 = [fill('2026-10-23T08:00:00Z', 'Open Short', 'A', 0.002, 81000, 0, 0, 0.05, 51), fill('2026-10-23T09:00:00Z', 'Close Short', 'B', 0.001, 80000, -0.002, 1, 0.02, 52),
      fill('2026-10-23T12:00:00Z', 'Close Short', 'B', 0.001, 79500, -0.001, 1.5, 0.02, 53)];
    const P2 = fill('2026-10-23T13:00:00Z', 'Open Short', 'A', 0.003, 80500, 0, 0, 0.06, 61);
    const { naar, sync, rijen, ctx } = await start(acc([...P1, P2], { BTC: '80999.9' }), ms('2026-10-23T09:30:00Z'));
    await sync();
    ok('09:30: P1 deels dicht, één partial-rij', (await rijen()).filter(x => x.status === 'partial').length === 1, JSON.stringify(await rijen()));
    for (const iso of ['2026-10-23T14:00:00Z', '2026-10-23T14:15:00Z', '2026-10-23T14:30:00Z']) {
      await naar(ms(iso)); await sync();
      const t = await rijen(), dicht = t.filter(x => x.status === 'closed'), lopend = t.filter(x => x.status !== 'closed');
      ok(`${iso.slice(11, 16)} UTC: P1 één keer gesloten (+2,41 = 1 + 1,5 − 0,09 fees), P2 open met 0,003, geen dubbele bron-id`,
        dicht.length === 1 && bij(dicht[0].pnl, 2.41, 0.005) && lopend.length === 1 && bij(lopend[0].qty, 0.003, 1e-9) && uniek(t), JSON.stringify(t.map(x => [x.src, x.status, x.qty, x.pnl])));
    }
    await ctx.close();
  }

  console.log('─── Review M1: de opening van de open positie is onbekend (fills-aanroep mislukt) ───');
  {
    const { p, naar, sync, rijen, ctx } = await start(acc([...VORIGE, OPEN, TP], { BTC: '81620.9' }), ms('2026-10-22T14:30:00Z'));
    await p.evaluate(() => { ExchangeAPI.hyperliquid._openBegin = () => ({}); });
    await sync();
    for (const iso of ['2026-10-22T17:00:00Z', '2026-10-22T17:15:00Z', '2026-10-22T18:30:00Z']) {
      await naar(ms(iso)); await sync();
      const t = await rijen(), lopend = t.filter(x => x.status !== 'closed');
      ok(`${iso.slice(11, 16)} UTC: één partial-rij, geen dubbele bron-id`, lopend.length === 1 && lopend[0].status === 'partial' && uniek(t), JSON.stringify(t.map(x => [x.src, x.status])));
    }
    await ctx.close();
  }

  ok('geen JS-fouten', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log(`\n=== HL partial blijft: ${pass}/${pass + fail} ===`); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  ✗ crash: ' + String(e).split('\n')[0]); process.exit(1); });
