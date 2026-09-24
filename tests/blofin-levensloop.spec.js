// Blofin: één positie-levensloop = één trade (model B, 22-09-2026). Blofin hergebruikt
// positionId per instrument en werkt een levensloop-record in-place bij; de sleutel is
// positionId + createTime. Twee echte snapshots uit Denny's account (01-05 en 04-05) spelen
// twee syncs na: één levensloop was op 01-05 deels gesloten en op 04-05 helemaal.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
let skipped = 0; const skip = n => { skipped++; console.log('  ⏭ ' + n + ' — fixture niet in deze kloon, overgeslagen'); };
const bij = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 1e-6 : tol);
const APP = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');
const lees = f => (!process.env.SJ_GEEN_FIXTURES && fs.existsSync(f)) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
const S1 = lees('tests/_fixtures/blofin-snapshot-2026-05-01.json'), S2 = lees('tests/_fixtures/blofin-snapshot.json');
const sleutel = r => r.positionId + '_' + r.createTime;

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
    await p.evaluate(() => { T = []; TRASH = []; ExchangeAPI.blofin._ctvCache = {}; ExchangeAPI.blofin._ctvCacheTs = Date.now(); });
    return { ctx, p };
  }
  // Blofin praat rechtstreeks: _direct(path) nabootsen met een "server"-staat
  const server = (p, hist, opens, fills) => p.evaluate(([h, o, f]) => {
    window.__BF = { hist: h, opens: o, fills: f, calls: [] };
    ExchangeAPI.blofin._direct = async (k, s, pp, pathName, params) => {
      const B = window.__BF; B.calls.push(pathName);
      if (/positions-history/.test(pathName)) return { data: B.hist };
      if (/fills-history/.test(pathName)) return { data: B.fills.filter(x => (!params.begin || +x.ts >= +params.begin) && (!params.end || +x.ts <= +params.end)) };
      if (/account\/positions/.test(pathName)) return { data: B.opens };
      if (/asset\/balances/.test(pathName)) return { data: [{ currency: 'USDT', balance: '123' }] };
      return { data: [] };
    };
    CONNS.blofin = { connected: true, apiKey: 'k', apiSecret: 's', passphrase: 'p', lastSync: 0, syncFrom: '2026-01-01' }; persistConns();
  }, [hist, opens, fills || []]);
  const sync = p => p.evaluate(() => syncExchange('blofin', { quiet: true }));
  const bf = p => p.evaluate(() => T.filter(t => t.exchange === 'blofin' && t.srcId && !/^blofin_open_/.test(t.srcId)).map(t => ({ srcId: t.srcId, status: t.status, pnl: +t.pnl, realized: +t.realizedPnl || 0, qty: +t.qtyAsset, open: +t.openTime, close: +t.closeTime, steps: (t.fills || []).map(f => f.kind).join(','), notes: t.notes || '' })));

  console.log('─── De sleutel ───');
  {
    const { ctx, p } = await open();
    const r = await p.evaluate(async () => {
      const rec = (o) => ({ historyId: '1', positionId: '8000000610734', instId: 'BTC-USDT', instType: 'SWAP', marginMode: 'cross', positionSide: 'net', closePositions: '0.001', maxPositions: '0.0029', liquidationPositions: '0', openAveragePrice: '80000', closeAveragePrice: '81000', createTime: '1776900000000', updateTime: '1777000000000', leverage: '10', realizedPnl: '1', fee: '0.1', ...o });
      ExchangeAPI.blofin._direct = async (k, s, pp, pathName) => ({ data: /positions-history/.test(pathName) ? window.__rows : [] });
      const t = async rows => { window.__rows = rows; return (await ExchangeAPI.blofin.fetchTrades('k', 's', 'p', 0)).map(x => x.id); };
      return { a: await t([rec({})]), b: await t([rec({ updateTime: '1777100000000', closePositions: '0.0029' })]), c: await t([rec({ createTime: '1777200000000', updateTime: '1777300000000' })]) };
    });
    ok('sleutel is positionId + createTime', r.a[0] === 'blofin_8000000610734_1776900000000', JSON.stringify(r.a));
    ok('een verdere stand van dezelfde levensloop (andere updateTime) heeft dezelfde sleutel', r.b[0] === r.a[0], JSON.stringify(r.b));
    ok('een heropening (nieuwe createTime, zelfde positionId) krijgt een andere sleutel', r.c[0] !== r.a[0] && /_1777200000000$/.test(r.c[0]), JSON.stringify(r.c));
    await ctx.close();
  }

  console.log('─── Twee echte snapshots als twee syncs ───');
  if (S1 && S2) {
    const h1 = S1.positionsHistory, h2 = S2.positionsHistory;
    const k1 = new Set(h1.map(sleutel)), k2 = new Set(h2.map(sleutel));
    const nieuw = [...k2].filter(k => !k1.has(k));
    const { ctx, p } = await open();
    await server(p, h1, S1.openPositions);
    const n1 = await sync(p); let t = await bf(p);
    ok(`sync 1 (01-05): ${k1.size} levenslopen worden ${k1.size} trades`, n1 === k1.size && t.length === k1.size, JSON.stringify({ n1, t: t.length, verwacht: k1.size }));
    ok('geen twee trades met dezelfde sleutel', new Set(t.map(x => x.srcId)).size === t.length);
    const deels = t.find(x => x.srcId === 'blofin_8000000610734_' + h1.find(r => r.historyId === '109673008').createTime);
    if (!deels) { console.log('  (rijen: ' + JSON.stringify(t.map(x => x.srcId + ':' + x.status)) + ')'); }
    // sinds 24-09-2026 is een levensloop die nog loopt één rij met status partial: het geboekte
    // deel (3,26) staat apart, de P&L blijft 0 tot hij dicht is, de grootte is de hele positie
    ok('de levensloop die op 01-05 nog deels open stond: partial, 3,26 geboekt, hele positie 0,0029',
      deels && deels.status === 'partial' && bij(deels.realized, 3.2616, 0.001) && deels.pnl === 0 && bij(deels.qty, 0.0029, 1e-9), JSON.stringify(deels));
    await p.evaluate(() => { const o = T.find(x => x.exchange === 'blofin' && x.status === 'open'); if (o) o.notes = 'open-notitie'; const d = T.find(x => /8000000610734_/.test(x.srcId) && x.status === 'partial'); if (d) d.notes = 'mijn notitie'; });

    // de update van 04-05 valt binnen het venster van een sync die er kort op volgt
    await p.evaluate(([h, o]) => { window.__BF.hist = h; window.__BF.opens = o; CONNS.blofin.lastSync = 0; persistConns(); }, [h2, S2.openPositions]);
    const n2 = await sync(p); t = await bf(p);
    ok(`sync 2 (04-05): ${nieuw.length} nieuwe levensloop, totaal ${k2.size}`, n2 === nieuw.length && t.length === k2.size, JSON.stringify({ n2, t: t.length, nieuw: nieuw.length }));
    const heel = t.find(x => x.srcId === deels.srcId);
    ok('diezelfde levensloop is bijgewerkt, niet verdubbeld: nu gesloten, P&L 4,52 en 0,0029',
      heel && heel.status === 'closed' && bij(heel.pnl, 4.5212, 0.001) && !heel.realized && bij(heel.qty, 0.0029, 1e-9), JSON.stringify(heel));
    ok('en de notitie erop is gebleven', heel && heel.notes === 'mijn notitie', JSON.stringify(heel && heel.notes));
    const n3 = await sync(p); const t3 = await bf(p);
    ok('sync 3: niets nieuws, niets veranderd', n3 === 0 && JSON.stringify(t3) === JSON.stringify(t), JSON.stringify(n3));
    await ctx.close();
  } else skip('twee echte Blofin-snapshots (01-05 en 04-05)');

  console.log('─── Stappen uit fills-history ───');
  {
    const { ctx, p } = await open();
    const cT = Date.now() - 2 * 864e5, u1 = cT + 3 * 36e5, u2 = cT + 9 * 36e5;   // recent: binnen de bewaartermijn van de stappen
    const hist = [{ historyId: '9', positionId: '8000000610734', instId: 'BTC-USDT', instType: 'SWAP', marginMode: 'cross', positionSide: 'net', closePositions: '0.003', maxPositions: '0.003', liquidationPositions: '0', openAveragePrice: '80000', closeAveragePrice: '81000', createTime: String(cT), updateTime: String(u2), leverage: '10', realizedPnl: '2.7', fee: '0.3', side: 'buy' }];
    const fills = [
      { instId: 'BTC-USDT', tradeId: '1', orderId: 'a', fillPrice: '80000', fillSize: '0.003', fillPnl: '0', positionSide: 'net', side: 'buy', fee: '0.12', ts: String(cT + 1000) },
      { instId: 'BTC-USDT', tradeId: '2', orderId: 'b', fillPrice: '80500', fillSize: '0.001', fillPnl: '0.5', positionSide: 'net', side: 'sell', fee: '0.04', ts: String(u1) },
      { instId: 'BTC-USDT', tradeId: '3', orderId: 'c', fillPrice: '81250', fillSize: '0.002', fillPnl: '2.5', positionSide: 'net', side: 'sell', fee: '0.08', ts: String(u2) },
      { instId: 'ETH-USDT', tradeId: '4', orderId: 'd', fillPrice: '3000', fillSize: '1', fillPnl: '0', positionSide: 'net', side: 'buy', fee: '0.1', ts: String(u1) },    // andere coin
      { instId: 'BTC-USDT', tradeId: '5', orderId: 'e', fillPrice: '82000', fillSize: '0.01', fillPnl: '0', positionSide: 'net', side: 'buy', fee: '0.1', ts: String(u2 + 864e5) },   // buiten het venster
    ];
    await server(p, hist, [], fills);
    const n = await sync(p); const t = await bf(p);
    const stappen = await p.evaluate(() => (T.find(x => x.exchange === 'blofin') || {}).fills || []);
    ok('de trade krijgt open, af, af — de ETH-fill en de fill buiten het venster niet', n === 1 && t[0] && t[0].steps === 'open,close,close', JSON.stringify(t));
    ok('de sleutel volgt createTime, ook hier', t[0] && t[0].srcId === 'blofin_8000000610734_' + cT, JSON.stringify(t[0] && t[0].srcId));
    ok('P&L per stap is Blofin\'s fillPnl', stappen.length === 3 && stappen[1].pnl === 0.5 && stappen[2].pnl === 2.5, JSON.stringify(stappen.map(x => x.pnl)));
    ok('en de eigen berekening staat er als controle naast', stappen.length === 3 && bij(stappen[1].pnlCalc, 0.5, 1e-9) && bij(stappen[2].pnlCalc, 2.5, 1e-9), JSON.stringify(stappen.map(x => x.pnlCalc)));
    await ctx.close();
  }

  console.log('─── Migratie v7: rij-per-sluiting wordt rij-per-levensloop ───');
  {
    const { ctx, p } = await open();
    const r = await p.evaluate(() => {
      const basis = { exchange: 'blofin', status: 'closed', kind: 'live', pair: 'BTC/USDT', dir: 'long', date: '2026-04-22', time: '16:14', entry: 80000, tags: [], tps: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] };
      T = [
        { ...basis, id: 1, srcId: 'blofin_8000000610734_1777000000000', positionId: '8000000610734', openTime: '1776900000000', closeTime: '1777000000000', exit: 80500, pnl: 3.26, qtyAsset: 0.001, notes: 'eerste TP', fills: [{ kind: 'x' }] },
        { ...basis, id: 2, srcId: 'blofin_8000000610734_1777100000000', positionId: '8000000610734', openTime: '1776900000000', closeTime: '1777100000000', exit: 81000, pnl: 4.52, qtyAsset: 0.0029, tags: ['tp2'] },
        { ...basis, id: 3, srcId: 'blofin_8000000610734_1770000000000', positionId: '8000000610734', openTime: '1769900000000', closeTime: '1770000000000', exit: 79000, pnl: -1, qtyAsset: 0.002 },   // eerdere levensloop
        { ...basis, id: 4, srcId: 'blofin_123456', positionId: '', openTime: '1769900000000', closeTime: '1770000000000', exit: 79000, pnl: -2 },   // uit de orderhistorie
        { ...basis, id: 5, srcId: 'blofin_csv_abc', openTime: '1769900000000', closeTime: '1770000000000', exit: 79000, pnl: -3 },
      ];
      TRASH = [{ ...basis, id: 6, srcId: 'blofin_8000000610734_1760000000000', openTime: '1759900000000', closeTime: '1760000000000', deletedAt: 1 }];
      CONNS.blofin = { connected: true, apiKey: 'k', apiSecret: 's', passphrase: 'p', lastSync: Date.now() };
      MIGRATIONS.find(m => m.v === 7).up();
      return { keys: T.map(t => t.srcId), n: T.length, lastSync: CONNS.blofin.lastSync, prul: TRASH.map(t => t.srcId),
        L: (() => { const t = T.find(x => x.srcId === 'blofin_8000000610734_1776900000000'); return t && { pnl: t.pnl, qty: t.qtyAsset, notes: t.notes, tags: t.tags, fills: t.fills.length }; })() };
    });
    ok('de twee tussenstanden zijn één trade onder positionId + createTime', r.keys.filter(k => k === 'blofin_8000000610734_1776900000000').length === 1 && r.n === 4, JSON.stringify(r.keys));
    ok('met de laatste stand (P&L 4,52, 0,0029) en de notitie én tags van beide', r.L && r.L.pnl === 4.52 && r.L.qty === 0.0029 && r.L.notes === 'eerste TP' && r.L.tags.includes('tp2') && r.L.fills === 0, JSON.stringify(r.L));
    ok('een eerdere levensloop blijft een eigen trade', r.keys.includes('blofin_8000000610734_1769900000000'), JSON.stringify(r.keys));
    ok('orderhistorie- en CSV-rijen blijven zoals ze zijn', r.keys.includes('blofin_123456') && r.keys.includes('blofin_csv_abc'), JSON.stringify(r.keys));
    ok('de prullenbak is mee hernoemd', r.prul[0] === 'blofin_8000000610734_1759900000000', JSON.stringify(r.prul));
    ok('de sync gaat terug tot vóór de oudste hernoemde rij', r.lastSync <= 1769900000000 - 3600e3, new Date(r.lastSync).toLocaleString('nl-NL'));
    await ctx.close();
  }

  ok('geen JS-errors totaal', errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));
  console.log(`\n=== Blofin-levensloop: ${pass}/${pass + fail}${skipped ? ' · ' + skipped + ' delen overgeslagen (fixtures niet in deze kloon)' : ''} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
