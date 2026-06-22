// v12.238 — OKX Take-Profit-breakdown via fetchFills. De Worker levert RAW OKX fills-history
// records (fillPx/fillSz/side/posSide/fillPnl). ExchangeAPI.okx.fetchFills normaliseert die nu
// naar {price,size,pnl,ts} + filtert op close-fills, zodat de generieke TP-builder (fetchTPsInline
// en refresh-stap-3) er TP-niveaus van bouwt. Vóór de fix kwam er 0 geldige TP uit (veldnaam-
// mismatch + foute instId). Deze test bewijst de happy-path.
const { test, expect } = require('@playwright/test');
const path = require('path');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');

// Echte OKX fills-history-vorm: 1 open (buy) + 2 partiële closes (sell) van een long X-Perp.
// 8 contracten geopend, 2× 4 contracten gesloten op TP1/TP2. ctVal 0.0001 → 0.0008 BTC totaal.
const OKX_FILLS = [
  { instId: 'BTC-USD_UM_XPERP-040431', tradeId: 'f0', ordId: 'o0', fillPx: '62640.6', fillSz: '8', side: 'buy',  posSide: 'long', fee: '-0.025', feeCcy: 'USDC', fillPnl: '0',     ts: '1750340673000' },
  { instId: 'BTC-USD_UM_XPERP-040431', tradeId: 'f1', ordId: 'o1', fillPx: '62700.0', fillSz: '4', side: 'sell', posSide: 'long', fee: '-0.012', feeCcy: 'USDC', fillPnl: '0.024', ts: '1750340720000' },
  { instId: 'BTC-USD_UM_XPERP-040431', tradeId: 'f2', ordId: 'o2', fillPx: '62760.0', fillSz: '4', side: 'sell', posSide: 'long', fee: '-0.012', feeCcy: 'USDC', fillPnl: '0.048', ts: '1750340758000' },
  // Fill van een andere coin in hetzelfde venster → moet weggefilterd worden.
  { instId: 'ETH-USD_UM_XPERP-040431', tradeId: 'f3', ordId: 'o3', fillPx: '3000.0',  fillSz: '1', side: 'sell', posSide: 'long', fee: '-0.01',  feeCcy: 'USDC', fillPnl: '0.05',  ts: '1750340730000' },
];

test('OKX fetchFills normaliseert + filtert close-fills voor TP-breakdown', async ({ page }) => {
  await page.goto(FILE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof ExchangeAPI !== 'undefined' && !!ExchangeAPI.okx, { timeout: 15000 });

  const result = await page.evaluate(async ({ fills }) => {
    const orig = window.proxyCall;
    let sentSymbol = 'UNSET';
    window.proxyCall = async (req) => {
      if (req.action === 'fills') { sentSymbol = ('symbol' in req) ? req.symbol : undefined; return { fills }; }
      return {};
    };
    // Verse ctVal-cache → geen okx.com fetch; X-Perp ctVal 0.0001.
    ExchangeAPI.okx._ctvCache = { 'BTC-USD_UM_XPERP-040431': 0.0001, 'ETH-USD_UM_XPERP-040431': 0.001 };
    ExchangeAPI.okx._ctvCacheTs = Date.now();

    const symbol = 'BTC/USDC'.replace('/', '_'); // zoals de callers het aanleveren
    const r = await ExchangeAPI.okx.fetchFills('k', 's', 'p', symbol, 0, Date.now());
    window.proxyCall = orig;

    // Repliceer fetchTPsInline's TP-bouw (non-mexc tak): alle (al gefilterde) fills → TP-niveaus.
    const used = r.fills || [];
    const total = used.reduce((s, f) => s + Math.abs(parseFloat(f.size || f.vol || f.amount || 0)), 0) || 1;
    const newTPs = used.map((f) => ({
      price: String(f.price || f.tradePrice || f.closeAvgPrice || ''),
      pct: String(((Math.abs(parseFloat(f.size || f.vol || f.amount || 0)) / total) * 100).toFixed(1)),
      status: 'hit',
    })).filter(t => parseFloat(t.price) > 0);

    return { sentSymbol, returned: r.fills, validTPs: newTPs.length, tps: newTPs };
  }, { fills: OKX_FILLS });

  // Geen (foute) instId meer naar de Worker → client-side filtering.
  expect(result.sentSymbol).toBeUndefined();

  // 2 close-fills (BTC sell), open (buy) + andere coin (ETH) weggefilterd.
  expect(result.returned).toHaveLength(2);
  expect(parseFloat(result.returned[0].price)).toBeCloseTo(62700, 0);
  expect(parseFloat(result.returned[0].size)).toBeCloseTo(0.0004, 6); // 4 × 0.0001
  expect(parseFloat(result.returned[1].price)).toBeCloseTo(62760, 0);

  // 2 geldige TP-niveaus, elk 50% (4 van 8 contracten).
  expect(result.validTPs).toBe(2);
  expect(result.tps[0].pct).toBe('50.0');
  expect(result.tps[1].pct).toBe('50.0');
});

test('OKX fetchFills herkent short-closes (side=buy)', async ({ page }) => {
  await page.goto(FILE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof ExchangeAPI !== 'undefined' && !!ExchangeAPI.okx, { timeout: 15000 });

  const SHORT_FILLS = [
    { instId: 'BTC-USDT-SWAP', fillPx: '60000', fillSz: '5', side: 'sell', posSide: 'short', fillPnl: '0',   ts: '1' }, // open short
    { instId: 'BTC-USDT-SWAP', fillPx: '59000', fillSz: '5', side: 'buy',  posSide: 'short', fillPnl: '50',  ts: '2' }, // close short
  ];

  const fills = await page.evaluate(async ({ fills }) => {
    const orig = window.proxyCall;
    window.proxyCall = async (req) => (req.action === 'fills' ? { fills } : {});
    ExchangeAPI.okx._ctvCache = { 'BTC-USDT-SWAP': 0.01 };
    ExchangeAPI.okx._ctvCacheTs = Date.now();
    const r = await ExchangeAPI.okx.fetchFills('k', 's', 'p', 'BTC_USDT', 0, Date.now());
    window.proxyCall = orig;
    return r.fills;
  }, { fills: SHORT_FILLS });

  expect(fills).toHaveLength(1);               // alleen de close (buy)
  expect(parseFloat(fills[0].price)).toBeCloseTo(59000, 0);
  expect(parseFloat(fills[0].size)).toBeCloseTo(0.05, 4); // 5 × 0.01
});
