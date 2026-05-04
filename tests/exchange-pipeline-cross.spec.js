// v12.87 — cross-exchange pipeline regressie-suite.
//
// Loopt 4 kern-scenario's (TP1+SL, TP1+TP2, full-close, net-account) door voor
// élke ondersteunde exchange (Blofin/MEXC/Kraken/Hyperliquid). FTMO is CSV-only
// dus geen partial-detect pipeline.
//
// Waarom: zorgen dat een fix voor één exchange (bv. Blofin v12.87 finalize-flow)
// niet stilletjes regressies veroorzaakt op andere exchanges. Aanvullend op
// exchange-isolation.spec.js: die test alleen ISOLATIE, deze test GEDRAG.
//
// Voor diepgaande Blofin-specifieke scenarios (12 stuks): zie
// blofin-pipeline-scenarios.spec.js — die test edge-cases zoals missing
// _rawCloseSize, scaling-in, etc.
const { test, expect } = require('@playwright/test');
const path = require('path');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');

const EXCHANGES = ['blofin', 'mexc', 'kraken', 'hyperliquid'];

// ─── Generieke fixture-builder — werkt voor alle 4 exchanges ─────────────────
// Post-parser shape is shared across exchanges (source-veld is enige verschil).
function closedTrade({ source, id, posId, openTime, closeTime, entry, exit, sizeAsset, pnl, fee, dir = 'long', pair = 'BTC/USDT' }) {
  const entryN = parseFloat(entry);
  return {
    id, positionId: String(posId), source, status: 'closed',
    pair, direction: dir,
    entry: String(entry), exit: String(exit),
    positionSize: (entryN * sizeAsset).toFixed(2),
    positionSizeAsset: String(sizeAsset),
    pnl: String(pnl), fees: String(Math.abs(parseFloat(fee))), leverage: '10',
    setupTags: [], confirmationTags: [], timeframeTags: [], emotionTags: [], mistakeTags: [], customTags: [],
    notes: '', rating: 0, screenshot: null, links: [], layers: [],
    stopLoss: '', takeProfit: '', highestPrice: '', lowestPrice: '',
    openTime: String(openTime), closeTime: String(closeTime),
    _rawCloseSize: String(sizeAsset),
  };
}

function openTrade({ source, posId, openTime, entry, sizeAsset, dir = 'long', pair = 'BTC/USDT' }) {
  const entryN = parseFloat(entry);
  return {
    id: source + '_open_' + posId, positionId: String(posId), source, status: 'open',
    pair, direction: dir,
    entry: String(entry), exit: '',
    positionSize: (entryN * sizeAsset).toFixed(2),
    positionSizeAsset: String(sizeAsset),
    pnl: '', fees: '0', leverage: '10',
    setupTags: [], confirmationTags: [], timeframeTags: [], emotionTags: [], mistakeTags: [], customTags: [],
    notes: '', rating: 0, screenshot: null, links: [], layers: [],
    stopLoss: '', takeProfit: '', highestPrice: '', lowestPrice: '',
    openTime: String(openTime), closeTime: '',
  };
}

async function runScenario(page, exchange, trades) {
  return page.evaluate(({ ex, trades }) => {
    const adapter = ExchangeAPI[ex];
    const detected = adapter && adapter.detectPartials ? adapter.detectPartials(trades) : trades;
    const consumed = getConsumedSiblings(detected);
    const visible = detected.filter(t => !consumed.has(t.id));
    let totalRealized = 0, totalClosedPnl = 0, totalFees = 0;
    for (const t of visible) {
      if (t.status === 'partial' || t.status === 'open') {
        totalRealized += parseFloat(t.realizedPnl || '0') || 0;
      } else if (t.status === 'closed') {
        totalClosedPnl += parseFloat(t.pnl || '0') || 0;
      }
      totalFees += parseFloat(t.fees || '0') || 0;
    }
    return {
      visibleCount: visible.length,
      netPnl: +(totalRealized + totalClosedPnl).toFixed(4),
      totalFees: +totalFees.toFixed(4),
    };
  }, { ex: exchange, trades });
}

test.describe('Cross-exchange pipeline scenarios (v12.87)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => typeof detectPartialFromSiblings === 'function', { timeout: 15_000 });
  });

  for (const ex of EXCHANGES) {
    test.describe(`${ex} pipeline`, () => {
      test(`TP1 + SL: netPnl correct (community-bug scenario)`, async ({ page }) => {
        const t0 = 1700000000000;
        const r = await runScenario(page, ex, [
          openTrade({ source: ex, posId: 9001, openTime: t0, entry: '70000', sizeAsset: 0.001 }),
          closedTrade({ source: ex, id: ex + '_a', posId: 9001, openTime: t0, closeTime: t0+1e6, entry: '70000', exit: '71000', sizeAsset: 0.0005, pnl: '0.50', fee: '0.05' }),
          closedTrade({ source: ex, id: ex + '_b', posId: 9001, openTime: t0, closeTime: t0+2e6, entry: '70000', exit: '69500', sizeAsset: 0.0005, pnl: '-0.25', fee: '0.05' }),
        ]);
        expect(r.netPnl).toBeCloseTo(0.25, 4);
        expect(r.visibleCount).toBe(1);
        expect(r.totalFees).toBeCloseTo(0.10, 4);  // bug 2 fix: fees aggregeren naar partial
      });

      test(`TP1 + TP2: 2 winsten netPnl correct`, async ({ page }) => {
        const t0 = 1700100000000;
        const r = await runScenario(page, ex, [
          openTrade({ source: ex, posId: 9002, openTime: t0, entry: '70000', sizeAsset: 0.002 }),
          closedTrade({ source: ex, id: ex + '_c', posId: 9002, openTime: t0, closeTime: t0+1e6, entry: '70000', exit: '71000', sizeAsset: 0.001, pnl: '1.00', fee: '0.10' }),
          closedTrade({ source: ex, id: ex + '_d', posId: 9002, openTime: t0, closeTime: t0+2e6, entry: '70000', exit: '72000', sizeAsset: 0.001, pnl: '2.00', fee: '0.10' }),
        ]);
        expect(r.netPnl).toBeCloseTo(3.0, 4);
        expect(r.visibleCount).toBe(1);
      });

      test(`Directe full close: open + 1 sibling die hele positie dekt`, async ({ page }) => {
        const t0 = 1700400000000;
        const r = await runScenario(page, ex, [
          openTrade({ source: ex, posId: 9003, openTime: t0, entry: '70000', sizeAsset: 0.001 }),
          closedTrade({ source: ex, id: ex + '_e', posId: 9003, openTime: t0, closeTime: t0+1e6, entry: '70000', exit: '72000', sizeAsset: 0.001, pnl: '2.00', fee: '0.10' }),
        ]);
        expect(r.netPnl).toBeCloseTo(2.0, 4);
        expect(r.visibleCount).toBe(1);
      });

      test(`PositionId-hergebruik: 4 zelfstandige trades NIET als één positie`, async ({ page }) => {
        const t0 = 1700300000000;
        const r = await runScenario(page, ex, [
          closedTrade({ source: ex, id: ex + '_f', posId: 9004, openTime: t0,    closeTime: t0+1e6, entry: '70000', exit: '71000', sizeAsset: 0.001, pnl: '1.00',  fee: '0.10' }),
          closedTrade({ source: ex, id: ex + '_g', posId: 9004, openTime: t0+2e6, closeTime: t0+3e6, entry: '72000', exit: '71500', sizeAsset: 0.001, pnl: '-0.50', fee: '0.10' }),
          closedTrade({ source: ex, id: ex + '_h', posId: 9004, openTime: t0+4e6, closeTime: t0+5e6, entry: '68000', exit: '69000', sizeAsset: 0.001, pnl: '1.00',  fee: '0.10' }),
          closedTrade({ source: ex, id: ex + '_i', posId: 9004, openTime: t0+6e6, closeTime: t0+7e6, entry: '75000', exit: '74000', sizeAsset: 0.001, pnl: '-1.00', fee: '0.10' }),
        ]);
        expect(r.netPnl).toBeCloseTo(0.5, 4);
        expect(r.visibleCount).toBe(4);
      });
    });
  }

  // FTMO heeft geen partial-detect pipeline (CSV-only) — bevestig dat detectPartials no-op is
  test('FTMO: detectPartials is no-op (CSV-only, geen API-side partial)', async ({ page }) => {
    const t0 = 1700000000000;
    const trades = [
      openTrade({ source: 'ftmo', posId: 9999, openTime: t0, entry: '1.0850', sizeAsset: 1, pair: 'EURUSD' }),
      closedTrade({ source: 'ftmo', id: 'ftmo_a', posId: 9999, openTime: t0, closeTime: t0+1e6, entry: '1.0850', exit: '1.0900', sizeAsset: 1, pnl: '50', fee: '2', pair: 'EURUSD' }),
    ];
    const result = await page.evaluate((trades) => {
      const before = JSON.stringify(trades);
      const after = ExchangeAPI.ftmo.detectPartials(trades);
      return { unchanged: JSON.stringify(after) === before, count: after.length };
    }, trades);
    expect(result.unchanged, 'FTMO detectPartials moet input ongewijzigd terugstuurt').toBe(true);
    expect(result.count).toBe(2);
  });
});
