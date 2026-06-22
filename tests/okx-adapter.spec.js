// OKX perp-adapter unit-test (v12.236). Draait de ECHTE ExchangeAPI.okx in page-context met een
// gemockte proxyCall (geen Worker/credentials nodig) + voorgevulde ctVal-cache (geen okx.com fetch).
// Verifieert: contracts→base via ctVal, netto-PnL = gross + fee + funding, direction (posSide + net-mode
// fallback), pair-mapping, en de adapter-registratie (needsPassphrase / openIsPlaceholder / detectPartials).
const { test, expect } = require('@playwright/test');
const path = require('path');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');

// ctVal: 1 BTC-USDT-SWAP = 0.01 BTC, ETH = 0.1, SOL = 1.
const CTV = { 'BTC-USDT-SWAP': 0.01, 'ETH-USDT-SWAP': 0.1, 'SOL-USDT-SWAP': 1 };

// OKX positions-history fixture (raw v5 velden).
// OKX `realizedPnl` = pnl + fee + fundingFee (NETTO). De fixtures zetten dus de netto-waarde.
const POSHIST = [
  { posId: 'p1', instId: 'BTC-USDT-SWAP', posSide: 'long',  openAvgPx: '60000', closeAvgPx: '62000', closeTotalPos: '5',  realizedPnl: '99.3', fee: '-0.6', fundingFee: '-0.1', lever: '10', cTime: '1718600000000', uTime: '1718610000000' },
  { posId: 'p2', instId: 'ETH-USDT-SWAP', posSide: 'short', openAvgPx: '3000',  closeAvgPx: '2900',  closeTotalPos: '10', realizedPnl: '99.7', fee: '-0.3', fundingFee: '0',   lever: '5',  cTime: '1718620000000', uTime: '1718630000000' },
  // net-mode: posSide leeg/"net" → richting uit `direction`-veld.
  { posId: 'p3', instId: 'SOL-USDT-SWAP', posSide: 'net', direction: 'long', openAvgPx: '100', closeAvgPx: '110', closeTotalPos: '2', realizedPnl: '20', fee: '-0.1', fundingFee: '0', lever: '3', cTime: '1718640000000', uTime: '1718650000000' },
];

const OPENPOS = [
  { posId: 'o1', instId: 'BTC-USDT-SWAP', posSide: 'long', avgPx: '60000', markPx: '61000', pos: '5', upl: '50', lever: '10', liqPx: '50000', cTime: '1718660000000' },
];

test('OKX fetchTrades normaliseert positions-history correct', async ({ page }) => {
  await page.goto(FILE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof ExchangeAPI !== 'undefined' && !!ExchangeAPI.okx, { timeout: 15000 });

  const trades = await page.evaluate(async ({ poshist, ctv }) => {
    const orig = window.proxyCall;
    window.proxyCall = async (req) => (req.action === 'trades' ? { trades: poshist } : {});
    ExchangeAPI.okx._ctvCache = { ...ctv };
    ExchangeAPI.okx._ctvCacheTs = Date.now(); // verse cache → geen okx.com fetch
    const out = await ExchangeAPI.okx.fetchTrades('k', 's', 'p', null);
    window.proxyCall = orig;
    return out;
  }, { poshist: POSHIST, ctv: CTV });

  expect(trades).toHaveLength(3);

  const btc = trades.find(t => t.pair === 'BTC/USDT');
  expect(btc).toBeTruthy();
  expect(btc.direction).toBe('long');
  expect(parseFloat(btc.entry)).toBeCloseTo(60000, 0);
  expect(parseFloat(btc.exit)).toBeCloseTo(62000, 0);
  expect(parseFloat(btc.positionSizeAsset)).toBeCloseTo(0.05, 4);   // 5 contracts × 0.01
  expect(parseFloat(btc.positionSize)).toBeCloseTo(3000, 0);        // 0.05 × 60000
  expect(parseFloat(btc.pnl)).toBeCloseTo(99.3, 2);                 // realizedPnl = netto
  expect(parseFloat(btc.fees)).toBeCloseTo(0.7, 4);                 // |fee| + |funding|
  expect(btc.status).toBe('closed');
  expect(btc.source).toBe('okx');

  const eth = trades.find(t => t.pair === 'ETH/USDT');
  expect(eth.direction).toBe('short');
  expect(parseFloat(eth.positionSizeAsset)).toBeCloseTo(1, 4);      // 10 × 0.1
  expect(parseFloat(eth.pnl)).toBeCloseTo(99.7, 2);                 // realizedPnl = netto

  const sol = trades.find(t => t.pair === 'SOL/USDT');
  expect(sol.direction).toBe('long');                              // net-mode → direction-veld
  expect(parseFloat(sol.positionSizeAsset)).toBeCloseTo(2, 4);
});

test('OKX EEA X-Perp (instType=FUTURES, BTC-USD_UM_XPERP) normaliseert correct', async ({ page }) => {
  await page.goto(FILE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof ExchangeAPI !== 'undefined' && !!ExchangeAPI.okx, { timeout: 15000 });

  // Echte OKX EEA X-Perp-vorm (Denny's trade: 0.0008 BTC, USDC-settled, realizedPnl = netto -0.06).
  // closeTotalPos = contracten (8), ctVal 0.0001 → 0.0008 BTC. PnL-heuristiek mag NIET overschrijven.
  const xperp = [{
    posId: 'xp1', instId: 'BTC-USD_UM_XPERP-040431', instType: 'FUTURES', settleCcy: 'USDC',
    posSide: 'long', openAvgPx: '62640.6', closeAvgPx: '62640.5', closeTotalPos: '8',
    realizedPnl: '-0.06', pnl: '-0.01', fee: '-0.05011244', fundingFee: '0', lever: '10',
    cTime: '1750340673000', uTime: '1750340758000',
  }];
  const ctv = { 'BTC-USD_UM_XPERP-040431': 0.0001 }; // ctVal per contract

  const trades = await page.evaluate(async ({ xperp, ctv }) => {
    const orig = window.proxyCall;
    window.proxyCall = async (req) => (req.action === 'trades' ? { trades: xperp } : {});
    ExchangeAPI.okx._ctvCache = { ...ctv };
    ExchangeAPI.okx._ctvCacheTs = Date.now();
    const out = await ExchangeAPI.okx.fetchTrades('k', 's', 'p', null);
    window.proxyCall = orig;
    return out;
  }, { xperp, ctv });

  expect(trades).toHaveLength(1);
  const t = trades[0];
  expect(t.pair).toBe('BTC/USDC');                       // _UM_XPERP → base + settleCcy
  expect(t.direction).toBe('long');
  expect(parseFloat(t.positionSizeAsset)).toBeCloseTo(0.0008, 6); // 8 contracts × 0.0001 (geen PnL-override!)
  expect(parseFloat(t.pnl)).toBeCloseTo(-0.06, 2);       // realizedPnl is al netto
  expect(parseFloat(t.fees)).toBeCloseTo(0.0501, 3);
  expect(t.source).toBe('okx');
});

test('OKX fetchOpenPositions normaliseert open posities', async ({ page }) => {
  await page.goto(FILE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof ExchangeAPI !== 'undefined' && !!ExchangeAPI.okx, { timeout: 15000 });

  const pos = await page.evaluate(async ({ openpos, ctv }) => {
    const orig = window.proxyCall;
    window.proxyCall = async (req) => (req.action === 'open_positions' ? { positions: openpos } : {});
    ExchangeAPI.okx._ctvCache = { ...ctv };
    ExchangeAPI.okx._ctvCacheTs = Date.now();
    const out = await ExchangeAPI.okx.fetchOpenPositions('k', 's', 'p');
    window.proxyCall = orig;
    return out;
  }, { openpos: OPENPOS, ctv: CTV });

  expect(pos).toHaveLength(1);
  expect(pos[0].pair).toBe('BTC/USDT');
  expect(pos[0].direction).toBe('long');
  expect(pos[0].status).toBe('open');
  expect(parseFloat(pos[0].positionSizeAsset)).toBeCloseTo(0.05, 4);
  expect(parseFloat(pos[0].unrealizedPnl)).toBeCloseTo(50, 0);
});

test('OKX adapter is correct geregistreerd', async ({ page }) => {
  await page.goto(FILE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof ExchangeAPI !== 'undefined' && !!ExchangeAPI.okx, { timeout: 15000 });

  const reg = await page.evaluate(() => ({
    needsPassphrase: ExchangeAPI.okx.needsPassphrase,
    openIsPlaceholder: ExchangeAPI.okx.openIsPlaceholder,
    hasDetectPartials: typeof ExchangeAPI.okx.detectPartials === 'function',
    hasCaptureSnapshot: typeof ExchangeAPI.okx.captureSnapshot === 'function',
    name: ExchangeAPI.okx.name,
  }));

  expect(reg.needsPassphrase).toBe(true);
  expect(reg.openIsPlaceholder).toBe(true);
  expect(reg.hasDetectPartials).toBe(true);
  expect(reg.hasCaptureSnapshot).toBe(true);
  expect(reg.name).toBe('OKX');
});
