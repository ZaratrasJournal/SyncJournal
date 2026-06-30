// v12.238 — OKX partial-close-op-nog-open-positie. Tegen Denny's echte snapshot
// (okx-snapshot-2026-06-29-15-17): short 9 contracten geopend, 5 gesloten op TP1 (59000.1),
// 4 nog open. OKX levert dat als open-positie (pos -4) + positions-history record type:"1"
// met closeTotalPos 5 / openMaxPos 9. Bug vóór de fix: openIsPlaceholder ruimde het open
// restant op → closed-5 bleef als losse 100%-trade. Fix: _normalise markeert partial, finalize
// behoudt de placeholder, detectPartialFromSiblings linkt 'm → TP1 = 5/9 = 55,6%, size 9.
const { test, expect } = require('@playwright/test');
const path = require('path');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');
const INST = 'BTC-USD_UM_XPERP-310404';
const CTV = { [INST]: 0.0001 };

test('OKX _normalise markeert partial-close (openMaxPos > closeTotalPos)', async ({ page }) => {
  await page.goto(FILE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof ExchangeAPI !== 'undefined' && !!ExchangeAPI.okx, { timeout: 15000 });

  const out = await page.evaluate(({ inst, ctv }) => {
    ExchangeAPI.okx._ctvCache = { ...ctv };
    ExchangeAPI.okx._ctvCacheTs = Date.now();
    const partial = ExchangeAPI.okx._normalise({
      posId: 'p1', instId: inst, instType: 'FUTURES', posSide: 'net', direction: 'short',
      closeTotalPos: '5', openMaxPos: '9', openAvgPx: '59259.7', closeAvgPx: '59000.1',
      realizedPnl: '0.08838311', pnl: '0.1298', fee: '-0.04141689', fundingFee: '0',
      lever: '10', cTime: '1782743576872', uTime: '1782745916720', ccy: 'USDC',
    });
    const full = ExchangeAPI.okx._normalise({
      posId: 'p2', instId: inst, instType: 'FUTURES', posSide: 'net', direction: 'short',
      closeTotalPos: '9', openMaxPos: '9', openAvgPx: '59019.5', closeAvgPx: '59308.8',
      realizedPnl: '-0.31', pnl: '-0.26', fee: '-0.05', fundingFee: '0',
      lever: '10', cTime: '1', uTime: '2', ccy: 'USDC',
    });
    return { partial, full };
  }, { inst: INST, ctv: CTV });

  // Partial: marker gezet, _rawCloseSize = 5 × 0.0001 = 0.0005.
  expect(out.partial._okxPartialClose).toBe(true);
  expect(parseFloat(out.partial._rawCloseSize)).toBeCloseTo(0.0005, 6);
  // Full close: GEEN partial-marker (closeTotalPos == openMaxPos).
  expect(out.full._okxPartialClose).toBeUndefined();
});

test('OKX partial-open: detectPartials linkt open-restant + close → TP 55,6%, size 9', async ({ page }) => {
  await page.goto(FILE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof ExchangeAPI !== 'undefined' && !!ExchangeAPI.okx, { timeout: 15000 });

  const res = await page.evaluate(({ inst, ctv }) => {
    ExchangeAPI.okx._ctvCache = { ...ctv };
    ExchangeAPI.okx._ctvCacheTs = Date.now();

    // Open positie: 4 contracten short nog open (account/positions: pos -4).
    const open = ExchangeAPI.okx._normaliseOpen({
      posId: 'p1', instId: inst, instType: 'FUTURES', posSide: 'net', pos: '-4',
      avgPx: '59259.7', upl: '0.019', lever: '10', liqPx: '64508', cTime: '1782743576872', ccy: 'USDC',
    });
    // Gesloten 5 contracten (positions-history type:"1", partial).
    const closed = ExchangeAPI.okx._normalise({
      posId: 'p1', instId: inst, instType: 'FUTURES', posSide: 'net', direction: 'short',
      closeTotalPos: '5', openMaxPos: '9', openAvgPx: '59259.7', closeAvgPx: '59000.1',
      realizedPnl: '0.08838311', pnl: '0.1298', fee: '-0.04141689', fundingFee: '0',
      lever: '10', cTime: '1782743576872', uTime: '1782745916720', ccy: 'USDC',
    });

    const linked = ExchangeAPI.okx.detectPartials([open, closed], 'okx');
    const parent = linked.find(t => t.status === 'partial' || t.status === 'open');
    return { open, closed, parent };
  }, { inst: INST, ctv: CTV });

  // Open-restant + gesloten matchen (pair/direction/entry).
  expect(res.open.pair).toBe('BTC/USDC');
  expect(res.open.direction).toBe('short');
  expect(parseFloat(res.open.positionSizeAsset)).toBeCloseTo(0.0004, 6); // 4 × 0.0001
  expect(parseFloat(res.closed.positionSizeAsset)).toBeCloseTo(0.0005, 6); // 5 × 0.0001

  // Na detectPartials: open wordt partial, originele size = 9 contracten = 0.0009.
  expect(res.parent.status).toBe('partial');
  expect(parseFloat(res.parent.originalSizeAsset)).toBeCloseTo(0.0009, 6);

  // De hit-TP = de 5-contract close: pct = 5/9 = 55,56% (NIET 100%).
  const hit = (res.parent.tpLevels || []).filter(tp => tp.status === 'hit');
  expect(hit).toHaveLength(1);
  expect(parseFloat(hit[0].pct)).toBeCloseTo(55.56, 1);
  expect(parseFloat(hit[0].price)).toBeCloseTo(59000.1, 1);
});
