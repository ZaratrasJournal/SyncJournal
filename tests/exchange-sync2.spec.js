// Fase 2-spec: open posities & placeholders, partial-detectie (via TJ-view-shim op de
// geporte detectPartialFromSiblings), stale-open-finalize met user-veld-adoptie, en de
// Hyperliquid lone-close-algebra (entry terugrekenen uit closedPnl). Offline; Blofin-deel
// draait de ECHTE adapter-mapper over de echte snapshot (incl. echte open positie).
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const FIX = 'tests/_fixtures/blofin-snapshot.json';
(async () => {
  const fix = fs.existsSync(FIX) ? JSON.parse(fs.readFileSync(FIX, 'utf8')) : null;
  if (!fix) console.log('SKIP: ' + FIX + ' ontbreekt — Blofin-deel overgeslagen');
  const url = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
  const b = await chromium.launch(); const p = await b.newPage(); p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await p.setViewportSize({ width: 1600, height: 1000 });
  await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(600);
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(700);
  await p.evaluate(() => { try { hideWelcome() } catch (e) {} T = []; TRASH = []; persist(); persistTrash(); clearGFilter(); setFilter('kind', 'alle'); });
  ok('boot zonder JS-errors', errs.length === 0, errs.slice(0, 2).join(' | '));

  if (fix) {
    console.log('─── Blofin: echte snapshot door echte mapper (open + closed) ───');
    await p.evaluate((f) => {
      window.__fix = f;
      CONNS.blofin = { connected: true, apiKey: 'k', apiSecret: 's', passphrase: 'p', syncFrom: '2026-01-01' };
      ExchangeAPI.blofin._direct = async (k, s, pp, pathName) => {
        if (/positions-history/.test(pathName)) return { data: window.__fix.positionsHistory };
        if (/account\/positions/.test(pathName)) return { data: window.__fix.openPositions };
        if (/orders-tpsl-pending/.test(pathName)) return { data: [] };
        if (/asset\/balances/.test(pathName)) return { data: [{ currency: 'USDT', balance: '123' }] };
        return { data: [] };
      };
    }, fix);
    const n1 = await p.evaluate(() => syncExchange('blofin'));
    ok('closed trades geïmporteerd (' + n1 + ')', n1 > 0, 'n=' + n1);
    const open = await p.evaluate(() => T.find(t => t.status === 'open' && t.exchange === 'blofin'));
    ok('open positie geïmporteerd als open trade', !!open);
    ok('open: dir short + entry ≈ 79738.6 + echte openTime', open && open.dir === 'short' && Math.abs(open.entry - 79738.6) < 1 && !!open.openTime);
    ok('open: liq + unrealizedPnl + qtyAsset aanwezig', open && open.liq > 0 && isFinite(open.unrealizedPnl) && open.qtyAsset > 0);
    ok('blofin open rij is GEEN placeholder (echte rest-positie)', open && !open.placeholder);
    const counts1 = await p.evaluate(() => ({ open: T.filter(t => t.status === 'open').length, all: T.length }));
    const n2 = await p.evaluate(() => syncExchange('blofin'));
    const counts2 = await p.evaluate(() => ({ open: T.filter(t => t.status === 'open').length, all: T.length }));
    ok('re-sync: geen nieuwe closed én geen dubbele open rij', n2 === 0 && counts1.open === counts2.open && counts1.all === counts2.all, JSON.stringify({ n2, counts1, counts2 }));
    ok('unieke ids over alles', await p.evaluate(() => new Set(T.map(t => t.id)).size === T.length));

    console.log('─── Stale open → finalize met user-veld-adoptie ───');
    await p.evaluate(() => {
      const o = T.find(t => t.status === 'open' && t.exchange === 'blofin');
      o.notes = 'notitie tijdens open positie'; o.tags = ['LiveTag'];
      // synthetische sluiting in de historie (zelfde positionId + entry), positie weg bij exchange
      window.__closedRow = { positionId: o.positionId, instId: 'BTC-USDT', positionSide: 'net', updateTime: Date.now(), createTime: o.openTime, openAveragePrice: String(o.entry), closeAveragePrice: '80100', closePositions: String(o.qtyAsset), realizedPnl: '-9.22', fee: '0.05', leverage: '10' };
      window.__fix = { positionsHistory: [window.__closedRow, ...window.__fix.positionsHistory], openPositions: [] };
    });
    await p.evaluate(() => syncExchange('blofin'));
    const fin = await p.evaluate(() => { const closed = T.find(t => t.srcId && /blofin_/.test(t.srcId) && Math.abs(t.pnl - (-9.22)) < 0.5); return { openLeft: T.some(t => t.status === 'open' && t.exchange === 'blofin'), closed: !!closed, notes: closed && closed.notes, tags: closed && closed.tags }; });
    ok('open rij weg na sluiting + import', !fin.openLeft);
    ok('user-velden geadopteerd op de echte trade', fin.closed && /notitie tijdens open/.test(fin.notes || '') && (fin.tags || []).includes('LiveTag'), JSON.stringify(fin).slice(0, 200));
  }

  console.log('─── Partial-detectie (deterministisch, Kraken — Blofin is model B sinds v0.9.116) ───');
  const part = await p.evaluate(() => {
    const mk = (id, st, extra) => ({ id, srcId: 'kraken_777_' + id, date: '2026-09-01', time: '10:00', pair: 'ETH/USDT', dir: 'long', setup: '', session: 'London', status: st, kind: 'live', exchange: 'kraken', entry: 2500, exit: st === 'closed' ? 2600 : 0, stop: 0, size: '2500', qtyAsset: 0.25, _rawCloseSize: '0.25', positionId: 'pid-777', closeTime: String(1758000000000 + id), pnl: st === 'closed' ? 25 : 0, fees: 0.1, r: 0, tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] });
    // rest 1.0 + 2×0.25 gesloten → origineel 1.5; géén ghost (closed ≪ rest) → pct = 0.25/1.5 ≈ 16.67%
    const openT = mk(9101, 'open'); openT.qtyAsset = 1.0; openT.size = '2500'; openT.exit = 0;
    T.push(openT, mk(9102, 'closed'), mk(9103, 'closed')); persist();
    runPartialDetect('kraken');
    const t = T.find(x => x.id === 9101);
    return { status: t.status, realized: t.realizedPnl, pnl: t.pnl, hits: (t.tps || []).filter(x => x.hit).length, pcts: (t.tps || []).map(x => x.pct) };
  });
  ok('open + gesloten siblings → status partial', part.status === 'partial', JSON.stringify(part));
  ok('realizedPnl = som van siblings (50), eigen pnl blijft 0', Math.abs(part.realized - 50) < 0.01 && part.pnl === 0);
  ok('TP-hits opgebouwd uit siblings (2 hits, pct ≈16.7)', part.hits === 2 && part.pcts.every(x => Math.abs(x - 16.67) < 0.5), JSON.stringify(part.pcts));
  const rev = await p.evaluate(() => { T = T.filter(x => x.id !== 9102 && x.id !== 9103); runPartialDetect('kraken'); const t = T.find(x => x.id === 9101); return { status: t.status, realized: t.realizedPnl }; });
  ok('siblings weg → terug naar open, realizedPnl gewist', rev.status === 'open' && rev.realized === undefined, JSON.stringify(rev));
  await p.evaluate(() => { T = T.filter(x => x.id !== 9101); persist(); });

  console.log('─── Placeholder-finalize (round-trip-exchange) ───');
  const ph = await p.evaluate(() => {
    const phT = { id: 9201, date: '2026-09-10', time: '09:34', pair: 'BTC/USD', dir: 'long', setup: 'BOS-retest', session: 'London', status: 'open', kind: 'live', exchange: 'kraken', entry: 77695, exit: 0, stop: 61000, size: '89', qtyAsset: 0.00115, placeholder: true, positionId: '', closeTime: '', pnl: 0, fees: 0, r: 0, notes: 'placeholder-notitie', tps: [{ price: 80000, pct: 50, r: '', hit: false }], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] };
    T.push(phT);
    const real = { id: 9202, srcId: 'kraken_fill_1', date: '2026-09-10', time: '08:14', pair: 'BTC/USD', dir: 'long', setup: '', session: 'London', status: 'closed', kind: 'live', exchange: 'kraken', entry: 77695, exit: 78200, stop: 0, size: '89', qtyAsset: 0.00115, positionId: '', closeTime: '999', pnl: 0.58, fees: 0.04, r: 0, notes: '', tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] };
    T.push(real); const n = finalizePlaceholders('kraken', [real]);
    return { n, phLeft: T.some(x => x.id === 9201), notes: real.notes, stop: real.stop, userTp: (real.tps || []).filter(x => !x.hit).length, time: real.time };
  });
  ok('placeholder verwijderd, echte trade blijft (met echte tijd)', ph.n === 1 && !ph.phLeft && ph.time === '08:14');
  ok('notities + SL + user-TP geadopteerd', /placeholder-notitie/.test(ph.notes) && ph.stop === 61000 && ph.userTp === 1, JSON.stringify(ph));

  console.log('─── Hyperliquid lone-close algebra ───');
  const hl = await p.evaluate(() => {
    const lone = ExchangeAPI.hyperliquid._reconstructTrades([{ coin: 'BTC', dir: 'Close Long', px: '61491', sz: '0.00024', fee: '0.01', closedPnl: '-0.14616', ms: 1749573167000, tid: 555001, oid: 91 }], 'hl');
    const pair = ExchangeAPI.hyperliquid._reconstructTrades([
      { coin: 'BTC', dir: 'Open Long', px: '62100', sz: '0.00024', fee: '0.01', closedPnl: '0', ms: 1749557184000, tid: 555002, oid: 92 },
      { coin: 'BTC', dir: 'Close Long', px: '61491', sz: '0.00024', fee: '0.01', closedPnl: '-0.14616', ms: 1749573167000, tid: 555003, oid: 93 },
    ], 'hl');
    return { lone: lone[0], pair: pair[0] };
  });
  ok('lone close: entry exact teruggerekend (≈62100)', hl.lone && Math.abs(parseFloat(hl.lone.entry) - 62100) < 0.5, hl.lone && hl.lone.entry);
  ok('lone close: size gevuld (≈$14.90) — geen N/A meer', hl.lone && Math.abs(parseFloat(hl.lone.positionSize) - 14.9) < 0.1, hl.lone && hl.lone.positionSize);
  ok('lone close: waarschuwingsnotitie aanwezig', hl.lone && /afgeleid uit closedPnl/.test(hl.lone.notes));
  ok('normale open+close blijft exact en zonder notitie', hl.pair && Math.abs(parseFloat(hl.pair.entry) - 62100) < 1e-6 && hl.pair.notes === '' && hl.pair.time === (new Date(1749557184000).toTimeString().slice(0, 5)), JSON.stringify(hl.pair).slice(0, 300));

  console.log('─── Weergave ───');
  await p.evaluate(() => { T.push({ id: 9301, date: '2026-09-13', time: '09:00', pair: 'SOL/USDT', dir: 'long', setup: '', session: 'London', status: 'open', kind: 'live', exchange: 'blofin', entry: 200, exit: 0, stop: 0, size: '500', qtyAsset: 2.5, unrealizedPnl: 3.21, liq: 150, pnl: 0, fees: 0, r: 0, tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] }); persist(); go('trades'); });
  await p.waitForTimeout(400);
  ok('open rij toont ~unrealized P&L in de tabel', await p.evaluate(() => { const row = [...document.querySelectorAll('tbody tr')].find(r => /SOL\/USDT/.test(r.textContent)); return row && /~/.test(row.textContent); }));

  ok('geen JS-errors totaal', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== Exchange-sync fase 2: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
