// OKX-adapter: de ruwe positions-history en open posities van OKX worden goed omgezet.
// Draait de echte ExchangeAPI.okx met een gemockte proxyCall en een voorgevulde ctVal-cache.
// Toetst: contracten → coins via ctVal, P&L is netto (realizedPnl = pnl + fee + funding), fees =
// |fee| + |funding|, richting uit posSide én uit het direction-veld bij net-mode, EEA X-Perps
// (USDC, eigen ctVal) en de registratie van de adapter (levensloop-model: geen sibling-detectie).
//
// Herschreven in T2 (24-10-2026): de oude spec laadde de bevroren oude app. De levenslopen,
// partials en stappen van OKX toetsen okx-levensloop, okx-partial en okx-subtype.
const { chromium } = require('playwright');
const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const bij = (a, b, tol) => Math.abs(parseFloat(a) - b) <= (tol || 1e-6);

// ctVal: 1 BTC-USDT-SWAP = 0.01 BTC, ETH = 0.1, SOL = 1, X-Perp BTC = 0.0001
const CTV = { 'BTC-USDT-SWAP': 0.01, 'ETH-USDT-SWAP': 0.1, 'SOL-USDT-SWAP': 1, 'BTC-USD_UM_XPERP-040431': 0.0001 };
const POSHIST = [
  { posId: 'p1', instId: 'BTC-USDT-SWAP', posSide: 'long', openAvgPx: '60000', closeAvgPx: '62000', closeTotalPos: '5', realizedPnl: '99.3', fee: '-0.6', fundingFee: '-0.1', lever: '10', cTime: '1718600000000', uTime: '1718610000000' },
  { posId: 'p2', instId: 'ETH-USDT-SWAP', posSide: 'short', openAvgPx: '3000', closeAvgPx: '2900', closeTotalPos: '10', realizedPnl: '99.7', fee: '-0.3', fundingFee: '0', lever: '5', cTime: '1718620000000', uTime: '1718630000000' },
  // net-mode: posSide "net" → richting uit het direction-veld
  { posId: 'p3', instId: 'SOL-USDT-SWAP', posSide: 'net', direction: 'long', openAvgPx: '100', closeAvgPx: '110', closeTotalPos: '2', realizedPnl: '20', fee: '-0.1', fundingFee: '0', lever: '3', cTime: '1718640000000', uTime: '1718650000000' },
];
// Echte OKX EEA X-Perp-vorm (Denny's trade: 0,0008 BTC, USDC-settled, realizedPnl netto −0,06)
const XPERP = [{ posId: 'xp1', instId: 'BTC-USD_UM_XPERP-040431', instType: 'FUTURES', settleCcy: 'USDC', posSide: 'long', openAvgPx: '62640.6', closeAvgPx: '62640.5',
  closeTotalPos: '8', realizedPnl: '-0.06', pnl: '-0.01', fee: '-0.05011244', fundingFee: '0', lever: '10', cTime: '1750340673000', uTime: '1750340758000' }];
const OPENPOS = [{ posId: 'o1', instId: 'BTC-USDT-SWAP', posSide: 'long', avgPx: '60000', markPx: '61000', pos: '5', upl: '50', lever: '10', liqPx: '50000', cTime: '1718660000000' }];

(async () => {
  const b = await chromium.launch(); const { p, errs } = await H.openJournal(b);
  const metMock = (actie, antwoord, roep) => p.evaluate(async ({ actie, antwoord, ctv, roep }) => {
    const orig = window.proxyCall;
    window.proxyCall = async req => (req.action === actie ? antwoord : {});
    ExchangeAPI.okx._ctvCache = { ...ctv }; ExchangeAPI.okx._ctvCacheTs = Date.now();   // verse cache: geen okx.com-fetch
    try { return roep === 'open' ? await ExchangeAPI.okx.fetchOpenPositions('k', 's', 'p') : await ExchangeAPI.okx.fetchTrades('k', 's', 'p', null); }
    finally { window.proxyCall = orig; }
  }, { actie, antwoord, ctv: CTV, roep });

  console.log('─── positions-history ───');
  const tr = await metMock('trades', { trades: POSHIST }, 'trades');
  ok('drie trades', tr.length === 3, String(tr.length));
  const btc = tr.find(t => t.pair === 'BTC/USDT') || {}, eth = tr.find(t => t.pair === 'ETH/USDT') || {}, sol = tr.find(t => t.pair === 'SOL/USDT') || {};
  ok('BTC long: entry 60.000, exit 62.000, gesloten, bron okx', btc.direction === 'long' && bij(btc.entry, 60000) && bij(btc.exit, 62000) && btc.status === 'closed' && btc.source === 'okx', JSON.stringify(btc).slice(0, 200));
  ok('BTC: 5 contracten × 0,01 = 0,05 BTC, ≈ $3.000', bij(btc.positionSizeAsset, 0.05) && bij(btc.positionSize, 3000, 1), btc.positionSizeAsset + ' / ' + btc.positionSize);
  ok('BTC: P&L is netto (99,3), fees = |fee| + |funding| = 0,7', bij(btc.pnl, 99.3, 0.005) && bij(btc.fees, 0.7, 1e-4), btc.pnl + ' / ' + btc.fees);
  ok('ETH short: 10 × 0,1 = 1 ETH, P&L 99,7', eth.direction === 'short' && bij(eth.positionSizeAsset, 1) && bij(eth.pnl, 99.7, 0.005), JSON.stringify(eth).slice(0, 160));
  ok('SOL net-mode: richting uit het direction-veld (long), 2 SOL', sol.direction === 'long' && bij(sol.positionSizeAsset, 2), JSON.stringify(sol).slice(0, 160));

  console.log('─── EEA X-Perp ───');
  const xp = (await metMock('trades', { trades: XPERP }, 'trades'))[0] || {};
  ok('pair BTC/USDC (base + settleCcy)', xp.pair === 'BTC/USDC', xp.pair);
  ok('8 contracten × 0,0001 = 0,0008 BTC (geen P&L-heuristiek eroverheen)', bij(xp.positionSizeAsset, 0.0008, 1e-9), xp.positionSizeAsset);
  ok('P&L netto −0,06, fees 0,0501', bij(xp.pnl, -0.06, 0.005) && bij(xp.fees, 0.0501, 1e-3), xp.pnl + ' / ' + xp.fees);

  console.log('─── open posities ───');
  const op = await metMock('open_positions', { positions: OPENPOS }, 'open');
  ok('één open BTC-long van 0,05 BTC met unrealized +50', op.length === 1 && op[0].pair === 'BTC/USDT' && op[0].direction === 'long' && op[0].status === 'open' && bij(op[0].positionSizeAsset, 0.05) && bij(op[0].unrealizedPnl, 50, 0.5), JSON.stringify(op).slice(0, 200));

  console.log('─── registratie ───');
  const reg = await p.evaluate(() => ({ naam: ExchangeAPI.okx.name, pp: ExchangeAPI.okx.needsPassphrase, dp: ExchangeAPI.okx.detectPartials, snap: typeof ExchangeAPI.okx.captureSnapshot,
    fills: typeof ExchangeAPI.okx.fetchFills, stappen: typeof ExchangeAPI.okx.stepsForTrade }));
  ok('naam OKX, passphrase nodig', reg.naam === 'OKX' && reg.pp === true, JSON.stringify(reg));
  ok('levensloop-model: geen sibling-detectie (detectPartials = null)', reg.dp === null, String(reg.dp));
  ok('stappen via fetchFills + stepsForTrade, snapshot-functie aanwezig', reg.fills === 'function' && reg.stappen === 'function' && reg.snap === 'function', JSON.stringify(reg));

  ok('geen JS-fouten', errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n=== OKX-adapter: ${pass}/${pass + fail} ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
