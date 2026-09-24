// Denny's profiel van 24-09-2026 (export "syncjournal-backup-2026-09-24 (1).json") stond al
// in de dubbele stand: een gesloten rij voor het geboekte deel (mét opgehaalde stappen) en een
// placeholder voor de open rest. Die twee moeten bij de eerstvolgende sync met de gerepareerde
// app vanzelf één rij worden — zonder dat de stappen of notities verloren gaan. En hetzelfde
// voor Blofin, waar de open rij van vroeger géén placeholder-vlag had.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const bij = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 1e-6 : tol);
const APP = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');
const POS = '3809943469299781632', INST = 'BTC-USD_UM_XPERP-04APR31', CT = 1790144822017, UT = 1790173343286;

// letterlijk uit de export (velden die er niet toe doen weggelaten)
const OUD_DICHT = { id: 3008, srcId: 'okx_' + POS + '_' + CT, exchange: 'okx', status: 'closed', pair: 'BTC/USDC', dir: 'short', entry: 86415, exit: 84913.84,
  size: '216.04', qtyAsset: 0.0025, pnl: 3.4562, fees: 0.1, positionId: POS, openTime: String(CT), closeTime: String(UT), date: '2026-09-23', time: '08:27', notes: 'mijn analyse', tags: ['breakout'],
  fills: [{ ts: CT, side: 'sell', kind: 'open', qty: 35, qtyAsset: 0.0035, price: 86415, fee: 0.15122625, posAfter: 35, posAfterAsset: 0.0035, dirAfter: 'short', avgEntry: 86415, pnl: null },
    { ts: 1790165866160, side: 'buy', kind: 'close', qty: 17, qtyAsset: 0.0017, price: 85270.1, fee: 0.072479585, posAfter: 18, posAfterAsset: 0.0018, dirAfter: 'short', avgEntry: 86415, pnl: 1.94633 },
    { ts: 1790173343283, side: 'buy', kind: 'close', qty: 1, qtyAsset: 0.0001, price: 84156.8, fee: 0.00420784, posAfter: 17, posAfterAsset: 0.0017, dirAfter: 'short', avgEntry: 86415, pnl: 0.22582 },
    { ts: 1790173343283, side: 'buy', kind: 'close', qty: 7, qtyAsset: 0.0007, price: 84156.8, fee: 0.02945488, posAfter: 10, posAfterAsset: 0.001, dirAfter: 'short', avgEntry: 86415, pnl: 1.58074 }] };
const OUD_PLACEHOLDER = { id: 3010, srcId: 'okx_open_' + POS + '_' + CT, exchange: 'okx', status: 'partial', placeholder: true, pair: 'BTC/USDC', dir: 'short', entry: 86415, exit: 0,
  size: '86.42', qtyAsset: 0.001, pnl: 0, realizedPnl: 3.46, unrealizedPnl: 2.497, positionId: POS, openTime: String(CT), closeTime: '', date: '2026-09-23', time: '08:27', notes: 'notitie op de open rest', fills: null };

const HIST_DEELS = { instId: INST, posId: POS, posSide: 'short', direction: 'short', settleCcy: 'USDC', type: '1', cTime: String(CT), uTime: String(UT),
  openAvgPx: '86415', closeAvgPx: '84913.84', closeTotalPos: '25', openMaxPos: '35', realizedPnl: '3.4562', fee: '-0.1', fundingFee: '0' };
const HIST_DICHT = { ...HIST_DEELS, type: '2', uTime: String(UT + 36e5), closeAvgPx: '84500', closeTotalPos: '35', realizedPnl: '5.9', fee: '-0.14' };
const OPEN = [{ instId: INST, posId: POS, posSide: 'short', cTime: String(CT), uTime: String(UT), settleCcy: 'USDC', avgPx: '86415', pos: '-10', lever: '10', upl: '2.497', liqPx: '90000', markPx: '85000' }];

(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext(); const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
  p.on('dialog', d => d.accept());
  await p.route('**/*', r => /^https?:/.test(r.request().url()) ? r.abort() : r.continue());
  await p.addInitScript(() => localStorage.setItem('sj_welcomed', 'true'));
  await p.goto(APP, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1300);

  const zet = (ex, hist, open) => p.evaluate(([ex, h, o, inst]) => {
    window.__S = { hist: h, open: o };
    ExchangeAPI.okx._ctvCache = { [inst]: 0.0001 }; ExchangeAPI.okx._ctvCacheTs = Date.now();
    ExchangeAPI.blofin._ctvCache = {}; ExchangeAPI.blofin._ctvCacheTs = Date.now();
    ExchangeAPI.blofin._direct = async (k, s, pp, pad) => {
      if (/positions-history/.test(pad)) return { data: window.__S.hist };
      if (/account\/positions/.test(pad)) return { data: window.__S.open };
      if (/asset\/balances/.test(pad)) return { data: [{ currency: 'USDT', balance: '100' }] };
      return { data: [] };
    };
    window.fetch = async (u, init) => {
      const body = JSON.parse(init.body); const a = d => ({ ok: true, status: 200, json: async () => d, text: async () => '' });
      if (body.action === 'trades') return a(ex === 'okx' ? { source: 'positions-history', trades: window.__S.hist } : { code: '0', data: window.__S.hist });
      if (body.action === 'open_positions') return a(ex === 'okx' ? { positions: window.__S.open } : { code: '0', data: window.__S.open });
      if (body.action === 'fills') return a({ fills: [] });
      if (body.action === 'test') return a({ success: true, balance: '100' });
      return a({});
    };
    CONNS[ex] = { connected: true, apiKey: 'k', apiSecret: 's', passphrase: 'p', lastSync: Date.now() - 36e5, syncFrom: '' }; persistConns();
  }, [ex, hist, open, INST]);
  const sync = ex => p.evaluate(ex => syncExchange(ex, { quiet: true }), ex);
  const rijen = ex => p.evaluate(ex => T.filter(t => t.exchange === ex).map(t => ({
    srcId: t.srcId, status: t.status, qty: +t.qtyAsset, pnl: +t.pnl, realized: +t.realizedPnl || 0, unreal: +t.unrealizedPnl || 0, ph: !!t.placeholder,
    notes: t.notes || '', tags: t.tags || [], stappen: (t.fills || []).map(f => f.kind).join(',') })), ex);

  console.log('─── OKX: het profiel van 24-09 wordt bij het openen (migratie v8) al één rij ───');
  {
    // zo komt een bestaand profiel binnen: schema 7, de twee rijen, en de historierij komt bij
    // een gewone sync niet opnieuw langs (uTime ligt vóór lastSync)
    const r = await p.evaluate(([a, b]) => {
      T = [a, b]; TRASH = []; CONNS = {}; persist(); MIGRATIONS.find(m => m.v === 8).up();
      return T.filter(t => t.exchange === 'okx').map(t => ({ srcId: t.srcId, status: t.status, qty: +t.qtyAsset, size: t.size, pnl: +t.pnl, r: t.r, realized: +t.realizedPnl || 0, unreal: +t.unrealizedPnl || 0, ph: !!t.placeholder, notes: t.notes, stappen: (t.fills || []).map(f => f.kind).join(',') }));
    }, [OUD_DICHT, OUD_PLACEHOLDER]);
    ok('één rij over, de historierij', r.length === 1 && r[0].srcId === OUD_DICHT.srcId && !r[0].ph, JSON.stringify(r.map(x => x.srcId + ':' + x.status)));
    ok('status partial; 3,46 geboekt; P&L en R op 0', r[0] && r[0].status === 'partial' && bij(r[0].realized, 3.4562, 0.001) && r[0].pnl === 0 && r[0].r === 0, JSON.stringify(r[0]));
    ok('hele positie 0,0035 (0,0025 geboekt + 0,001 rest), grootte 302,45', r[0] && bij(r[0].qty, 0.0035, 1e-9) && r[0].size === '302.45', JSON.stringify({ qty: r[0] && r[0].qty, size: r[0] && r[0].size }));
    ok('unrealized van de open rest komt mee; stappen en notitie blijven', r[0] && bij(r[0].unreal, 2.497, 0.001) && r[0].stappen === 'open,close,close,close' && r[0].notes === 'mijn analyse', JSON.stringify(r[0]));
    // een sync die de historierij NIET opnieuw levert (zo gaat het in het echt) laat alles heel
    await zet('okx', [], OPEN);
    const n = await sync('okx'); const r2 = await rijen('okx');
    ok('sync zonder nieuwe historie: nog steeds die ene rij, geen nieuwe placeholder', n === 0 && r2.length === 1 && r2[0].status === 'partial' && r2[0].stappen === 'open,close,close,close', JSON.stringify(r2.map(x => x.srcId + ':' + x.status)));
  }
  console.log('─── Blofin: oude stand (open rij zonder placeholder-vlag) via de migratie ───');
  {
    const T0 = Date.now() - 2 * 864e5, T2 = T0 + 5 * 36e5;
    const r = await p.evaluate(([T0, T2]) => {
      T = [{ id: 1, srcId: 'blofin_800_' + T0, exchange: 'blofin', status: 'closed', pair: 'ETH/USDT', dir: 'long', entry: 3000, exit: 3040, size: '3000', qtyAsset: 1, pnl: 39, r: 1.2, fees: 1, positionId: '800', openTime: String(T0), closeTime: String(T2), date: '2026-09-22', time: '10:00', notes: 'eth long', fills: [] },
        { id: 2, srcId: 'blofin_open_800', exchange: 'blofin', status: 'open', placeholder: false, pair: 'ETH/USDT', dir: 'long', entry: 3000, exit: 0, size: '3000', qtyAsset: 1, pnl: 0, r: 0, unrealizedPnl: 50, liq: 2500, positionId: '800', openTime: String(T0), closeTime: '', date: '2026-09-22', time: '10:00', notes: 'later erbij', fills: null },
        // een andere, al afgeronde levensloop op hetzelfde positionId (Blofin hergebruikt die ook) blijft met rust
        { id: 3, srcId: 'blofin_800_' + (T0 - 864e5), exchange: 'blofin', status: 'closed', pair: 'ETH/USDT', dir: 'long', entry: 2900, exit: 2950, size: '2900', qtyAsset: 1, pnl: 50, r: 1, fees: 1, positionId: '800', openTime: String(T0 - 864e5), closeTime: String(T0 - 864e5 + 36e5), date: '2026-09-21', time: '10:00', notes: '', fills: [] }];
      TRASH = []; CONNS = {}; persist(); MIGRATIONS.find(m => m.v === 8).up();
      return T.filter(t => t.exchange === 'blofin').map(t => ({ srcId: t.srcId, status: t.status, qty: +t.qtyAsset, pnl: +t.pnl, realized: +t.realizedPnl || 0, unreal: +t.unrealizedPnl || 0, liq: +t.liq || 0, notes: t.notes }));
    }, [T0, T2]);
    const lopend = r.find(x => x.srcId === 'blofin_800_' + T0), eerder = r.find(x => x.srcId === 'blofin_800_' + (T0 - 864e5));
    ok('de open rij gaat op in de lopende levensloop; de eerdere blijft apart', r.length === 2 && lopend && eerder && eerder.status === 'closed' && eerder.pnl === 50, JSON.stringify(r.map(x => x.srcId + ':' + x.status)));
    ok('partial, hele positie 2, 39 geboekt, live cijfers mee, eigen notitie wint', lopend && lopend.status === 'partial' && bij(lopend.qty, 2, 1e-9) && bij(lopend.realized, 39, 0.001) && lopend.unreal === 50 && lopend.liq === 2500 && lopend.notes === 'eth long', JSON.stringify(lopend));
  }

  console.log('─── OKX: dezelfde twee rijen, maar dan via een sync die de historie wél opnieuw levert ───');
  {
    await p.evaluate(([a, b]) => { T = [a, b]; TRASH = []; CONNS = {}; persist(); }, [OUD_DICHT, OUD_PLACEHOLDER]);
    await zet('okx', [HIST_DEELS], OPEN);
    const n = await sync('okx'); const r = await rijen('okx');
    ok('de twee rijen worden één, zonder nieuwe trade te melden', n === 0 && r.length === 1, JSON.stringify(r.map(x => x.srcId + ':' + x.status)));
    ok('die rij is de historierij (geen placeholder), status partial', r[0] && !r[0].ph && r[0].status === 'partial' && r[0].srcId === OUD_DICHT.srcId, JSON.stringify(r[0]));
    ok('hele positie 0,0035; 3,46 geboekt; P&L nog 0; unrealized van de open rest', r[0] && bij(r[0].qty, 0.0035, 1e-9) && bij(r[0].realized, 3.4562, 0.001) && r[0].pnl === 0 && bij(r[0].unreal, 2.497, 0.001), JSON.stringify(r[0]));
    ok('de opgehaalde stappen zijn er nog (open, 3× close)', r[0] && r[0].stappen === 'open,close,close,close', JSON.stringify(r[0] && r[0].stappen));
    ok('notitie en tags van de historierij blijven', r[0] && r[0].notes === 'mijn analyse' && r[0].tags.includes('breakout'), JSON.stringify({ notes: r[0] && r[0].notes, tags: r[0] && r[0].tags }));
  }
  console.log('─── en dat blijft zo, ook na herladen ───');
  {
    for (let i = 0; i < 2; i++) await sync('okx');
    const r = await rijen('okx');
    ok('na nog twee syncs nog steeds één rij', r.length === 1 && r[0].status === 'partial', JSON.stringify(r.map(x => x.srcId + ':' + x.status)));
    await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1300);
    const r2 = await rijen('okx');
    ok('na herladen: nog steeds één rij, met stappen', r2.length === 1 && r2[0].stappen === 'open,close,close,close', JSON.stringify(r2.map(x => x.srcId + ':' + x.status)));
  }
  console.log('─── de rest gaat dicht ───');
  {
    await zet('okx', [HIST_DICHT], []);
    const n = await sync('okx'); const r = await rijen('okx');
    ok('dezelfde rij wordt gesloten: P&L 5,90, geen restant', n === 0 && r.length === 1 && r[0].status === 'closed' && bij(r[0].pnl, 5.9, 0.001) && !r[0].realized, JSON.stringify(r));
    ok('de notitie staat er nog', r[0].notes === 'mijn analyse', JSON.stringify(r[0].notes));
  }
  console.log('─── als alleen de placeholder een notitie had, verhuist die mee ───');
  {
    await p.evaluate(([a, b]) => { T = [{ ...a, notes: '', tags: [] }, b]; TRASH = []; CONNS = {}; persist(); }, [OUD_DICHT, OUD_PLACEHOLDER]);
    await zet('okx', [HIST_DEELS], OPEN);
    await sync('okx'); const r = await rijen('okx');
    ok('één rij met de notitie van de open rest', r.length === 1 && r[0].notes === 'notitie op de open rest', JSON.stringify(r.map(x => x.srcId + ':' + x.notes)));
  }

  console.log('─── Blofin: oude stand, hersteld via een volledige sync (zonder migratie) ───');
  {
    const T0 = Date.now() - 2 * 864e5, T2 = T0 + 5 * 36e5;
    const hist = { historyId: '1', positionId: '800', instId: 'ETH-USDT', instType: 'SWAP', marginMode: 'cross', positionSide: 'net', side: 'buy', closePositions: '1', maxPositions: '2',
      liquidationPositions: '0', openAveragePrice: '3000', closeAveragePrice: '3040', createTime: String(T0), updateTime: String(T2), leverage: '10', realizedPnl: '39', fee: '1' };
    const open = { positionId: '800', instId: 'ETH-USDT', positionSide: 'net', positions: '1', averagePrice: '3000', markPrice: '3050', unrealizedPnl: '50', liquidationPrice: '2500', leverage: '10', createTime: String(T0), updateTime: String(T2) };
    await p.evaluate(([T0, T2]) => {
      T = [{ id: 1, srcId: 'blofin_800_' + T0, exchange: 'blofin', status: 'closed', pair: 'ETH/USDT', dir: 'long', entry: 3000, exit: 3040, size: '3000', qtyAsset: 1, pnl: 39, r: 0, fees: 1, positionId: '800', openTime: String(T0), closeTime: String(T2), date: '2026-09-22', time: '10:00', notes: 'eth long', fills: [] },
        { id: 2, srcId: 'blofin_open_800', exchange: 'blofin', status: 'open', placeholder: false, pair: 'ETH/USDT', dir: 'long', entry: 3000, exit: 0, size: '3000', qtyAsset: 1, pnl: 0, r: 0, unrealizedPnl: 50, positionId: '800', openTime: String(T0), closeTime: '', date: '2026-09-22', time: '10:00', notes: '', fills: null }];
      TRASH = []; CONNS = {}; persist();
    }, [T0, T2]);
    await zet('blofin', [hist], [open]);
    await p.evaluate(() => { CONNS.blofin.lastSync = 0; persistConns(); });   // een eerste/volledige sync: de historierij komt langs
    const n = await sync('blofin'); const r = await rijen('blofin');
    ok('ook hier worden de twee rijen één', n === 0 && r.length === 1, JSON.stringify(r.map(x => x.srcId + ':' + x.status)));
    ok('partial, hele positie 2, 39 geboekt, notitie bewaard', r[0] && r[0].status === 'partial' && bij(r[0].qty, 2, 1e-9) && bij(r[0].realized, 39, 0.001) && r[0].notes === 'eth long', JSON.stringify(r[0]));
    await sync('blofin'); const r2 = await rijen('blofin');
    ok('en blijft één rij bij de volgende sync', r2.length === 1, JSON.stringify(r2.map(x => x.srcId + ':' + x.status)));
  }

  console.log('─── Grens: een andere open positie met dezelfde entry naast een lopende partial ───');
  {
    // OKX hergebruikt posId's; een andere positie (ander posId, andere cTime) mag NIET opgaan in de partial
    await p.evaluate(([a, b]) => { T = [a, b]; TRASH = []; CONNS = {}; persist(); }, [OUD_DICHT, OUD_PLACEHOLDER]);
    const CT2 = UT + 2 * 36e5;
    await zet('okx', [HIST_DEELS], [...OPEN, { instId: INST, posId: '777', posSide: 'long', cTime: String(CT2), uTime: String(CT2), settleCcy: 'USDC', avgPx: '86415', pos: '5', lever: '10', upl: '0.1', liqPx: '1000', markPx: '86000' }]);
    await sync('okx'); const r = await rijen('okx');
    ok('twee rijen: de partial én een open rij voor de andere positie', r.length === 2 && r.filter(x => x.status === 'partial').length === 1 && r.filter(x => x.status === 'open' && x.ph).length === 1, JSON.stringify(r.map(x => x.srcId + ':' + x.status)));
  }

  ok('geen JS-errors totaal', errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));
  console.log(`\n=== Partial-herstel bestaande profielen: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
