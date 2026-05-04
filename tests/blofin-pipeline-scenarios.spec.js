// v12.87 — uitgebreide scenario-suite voor Blofin partial-close pipeline.
//
// Roept de echte module-scope helpers (`detectPartialFromSiblings`,
// `getConsumedSiblings`) direct aan op gefabrieerde post-parser trade-objects.
// Test 10 verschillende scenario's die de community-bug paths én normale
// partial-close flows dekken.
//
// Doel: als regressie-baseline bij elke wijziging in detectPartialFromSiblings
// of de Blofin parser. Laat onmiddellijk zien als netPnl/fees/originalSize
// drift in een scenario dat eerder klopte.
const { test, expect } = require('@playwright/test');
const path = require('path');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');

// ─── Helpers: bouw post-parser trade-objects ──────────────────────────────────
function closedTrade({ id, posId, openTime, closeTime, entry, exit, sizeAsset, pnl, fee, dir = 'long', pair = 'BTC/USDT' }) {
  const entryN = parseFloat(entry);
  const sizeUsdt = (entryN * sizeAsset).toFixed(2);
  return {
    id, positionId: String(posId), source: 'blofin', status: 'closed',
    pair, direction: dir,
    entry: String(entry), exit: String(exit),
    positionSize: sizeUsdt, positionSizeAsset: String(sizeAsset),
    pnl: String(pnl), fees: String(Math.abs(parseFloat(fee))), leverage: '10',
    setupTags: [], confirmationTags: [], timeframeTags: [], emotionTags: [], mistakeTags: [], customTags: [],
    notes: '', rating: 0, screenshot: null, links: [], layers: [],
    stopLoss: '', takeProfit: '', highestPrice: '', lowestPrice: '',
    openTime: String(openTime), closeTime: String(closeTime),
    _rawCloseSize: String(sizeAsset),
  };
}

function openTrade({ posId, openTime, entry, sizeAsset, dir = 'long', pair = 'BTC/USDT', sl = '', tp = '', edits = {} }) {
  const entryN = parseFloat(entry);
  const sizeUsdt = (entryN * sizeAsset).toFixed(2);
  return {
    id: 'blofin_open_' + posId, positionId: String(posId), source: 'blofin', status: 'open',
    pair, direction: dir,
    entry: String(entry), exit: '',
    positionSize: sizeUsdt, positionSizeAsset: String(sizeAsset),
    pnl: '', fees: '0', leverage: '10',
    setupTags: edits.setupTags || [],
    confirmationTags: edits.confirmationTags || [],
    timeframeTags: [], emotionTags: edits.emotionTags || [], mistakeTags: [], customTags: [],
    notes: edits.notes || '', rating: edits.rating || 0,
    screenshot: edits.screenshot || null,
    links: [], layers: [],
    stopLoss: sl, takeProfit: tp,
    highestPrice: '', lowestPrice: '',
    openTime: String(openTime), closeTime: '',
  };
}

// Run de pipeline + bereken visible-summary in 1 evaluate
async function runScenario(page, trades) {
  return page.evaluate((trades) => {
    const detected = detectPartialFromSiblings(trades, 'blofin');
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
      consumedCount: consumed.size,
      netPnl: +(totalRealized + totalClosedPnl).toFixed(4),
      totalFees: +totalFees.toFixed(4),
      visible: visible.map(t => ({
        id: t.id, status: t.status, sizeAsset: t.positionSizeAsset,
        origSize: t.originalSizeAsset || '', pnl: t.pnl, realizedPnl: t.realizedPnl || '',
        fees: t.fees, tpLevels: (t.tpLevels || []).length,
      })),
    };
  }, trades);
}

test.describe('Blofin pipeline scenarios (v12.87 baseline)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => typeof detectPartialFromSiblings === 'function', { timeout: 15_000 });
  });

  test('A: TP1 + SL — community bug scenario, netPnl correct', async ({ page }) => {
    const t0 = 1700000000000;
    const trades = [
      openTrade({ posId: 999001, openTime: t0, entry: '70000', sizeAsset: 0.001 }),
      closedTrade({ id: 'tA1', posId: 999001, openTime: t0, closeTime: t0+1e6, entry: '70000', exit: '71000', sizeAsset: 0.0005, pnl: '0.50', fee: '0.05' }),
      closedTrade({ id: 'tA2', posId: 999001, openTime: t0, closeTime: t0+2e6, entry: '70000', exit: '69500', sizeAsset: 0.0005, pnl: '-0.25', fee: '0.05' }),
    ];
    const r = await runScenario(page, trades);
    expect(r.netPnl).toBeCloseTo(0.25, 4);
    expect(r.visibleCount).toBe(1);
  });

  test('B: TP1 + TP2 — winst via 2 TPs, netPnl + count correct', async ({ page }) => {
    const t0 = 1700100000000;
    const trades = [
      openTrade({ posId: 999002, openTime: t0, entry: '70000', sizeAsset: 0.002 }),
      closedTrade({ id: 'tB1', posId: 999002, openTime: t0, closeTime: t0+1e6, entry: '70000', exit: '71000', sizeAsset: 0.001, pnl: '1.00', fee: '0.10' }),
      closedTrade({ id: 'tB2', posId: 999002, openTime: t0, closeTime: t0+2e6, entry: '70000', exit: '72000', sizeAsset: 0.001, pnl: '2.00', fee: '0.10' }),
    ];
    const r = await runScenario(page, trades);
    expect(r.netPnl).toBeCloseTo(3.0, 4);
    expect(r.visibleCount).toBe(1);
  });

  test('C: 3 partial closes — netPnl + count correct', async ({ page }) => {
    const t0 = 1700200000000;
    const trades = [
      openTrade({ posId: 999003, openTime: t0, entry: '70000', sizeAsset: 0.003 }),
      closedTrade({ id: 'tC1', posId: 999003, openTime: t0, closeTime: t0+1e6, entry: '70000', exit: '71000', sizeAsset: 0.001, pnl: '1.00', fee: '0.10' }),
      closedTrade({ id: 'tC2', posId: 999003, openTime: t0, closeTime: t0+2e6, entry: '70000', exit: '72000', sizeAsset: 0.001, pnl: '2.00', fee: '0.10' }),
      closedTrade({ id: 'tC3', posId: 999003, openTime: t0, closeTime: t0+3e6, entry: '70000', exit: '73000', sizeAsset: 0.001, pnl: '3.00', fee: '0.10' }),
    ];
    const r = await runScenario(page, trades);
    expect(r.netPnl).toBeCloseTo(6.0, 4);
    expect(r.visibleCount).toBe(1);
  });

  test('D: Net-account positionId-hergebruik — 4 zelfstandige trades NIET gemerged', async ({ page }) => {
    const t0 = 1700300000000;
    const trades = [
      closedTrade({ id: 'tD1', posId: 999004, openTime: t0,    closeTime: t0+1e6, entry: '70000', exit: '71000', sizeAsset: 0.001, pnl: '1.00',  fee: '0.10' }),
      closedTrade({ id: 'tD2', posId: 999004, openTime: t0+2e6, closeTime: t0+3e6, entry: '72000', exit: '71500', sizeAsset: 0.001, pnl: '-0.50', fee: '0.10' }),
      closedTrade({ id: 'tD3', posId: 999004, openTime: t0+4e6, closeTime: t0+5e6, entry: '68000', exit: '69000', sizeAsset: 0.001, pnl: '1.00',  fee: '0.10' }),
      closedTrade({ id: 'tD4', posId: 999004, openTime: t0+6e6, closeTime: t0+7e6, entry: '75000', exit: '74000', sizeAsset: 0.001, pnl: '-1.00', fee: '0.10' }),
    ];
    const r = await runScenario(page, trades);
    expect(r.visibleCount).toBe(4);
    expect(r.netPnl).toBeCloseTo(0.5, 4);
    expect(r.totalFees).toBeCloseTo(0.4, 4);
  });

  test('E: Directe full close — open + 1 sibling', async ({ page }) => {
    const t0 = 1700400000000;
    const trades = [
      openTrade({ posId: 999005, openTime: t0, entry: '70000', sizeAsset: 0.001 }),
      closedTrade({ id: 'tE1', posId: 999005, openTime: t0, closeTime: t0+1e6, entry: '70000', exit: '72000', sizeAsset: 0.001, pnl: '2.00', fee: '0.10' }),
    ];
    const r = await runScenario(page, trades);
    expect(r.netPnl).toBeCloseTo(2.0, 4);
    expect(r.visibleCount).toBe(1);
  });

  test('F: Open trade zonder fills', async ({ page }) => {
    const t0 = 1700500000000;
    const trades = [openTrade({ posId: 999006, openTime: t0, entry: '70000', sizeAsset: 0.001 })];
    const r = await runScenario(page, trades);
    expect(r.netPnl).toBe(0);
    expect(r.visibleCount).toBe(1);
    expect(r.visible[0].status).toBe('open');
  });

  test('G: Mix — TP1+SL (BTC) + unrelated ETH trade', async ({ page }) => {
    const t0 = 1700600000000;
    const trades = [
      openTrade({ posId: 999007, openTime: t0, entry: '70000', sizeAsset: 0.001 }),
      closedTrade({ id: 'tG1', posId: 999007, openTime: t0, closeTime: t0+1e6, entry: '70000', exit: '71000', sizeAsset: 0.0005, pnl: '0.50', fee: '0.05' }),
      closedTrade({ id: 'tG2', posId: 999007, openTime: t0, closeTime: t0+2e6, entry: '70000', exit: '69500', sizeAsset: 0.0005, pnl: '-0.25', fee: '0.05' }),
      closedTrade({ id: 'tG3', posId: 888888, openTime: t0, closeTime: t0+3e6, entry: '3500', exit: '3550', sizeAsset: 0.1, pnl: '5.00', fee: '0.50', pair: 'ETH/USDT' }),
    ];
    const r = await runScenario(page, trades);
    expect(r.netPnl).toBeCloseTo(5.25, 4);
    expect(r.visibleCount).toBe(2);
  });

  test('H: Volledige close zonder open trade in journal — 2 losse closeds', async ({ page }) => {
    const t0 = 1700700000000;
    const trades = [
      closedTrade({ id: 'tH1', posId: 999008, openTime: t0, closeTime: t0+1e6, entry: '70000', exit: '71000', sizeAsset: 0.0005, pnl: '0.50', fee: '0.05' }),
      closedTrade({ id: 'tH2', posId: 999008, openTime: t0, closeTime: t0+2e6, entry: '70000', exit: '69500', sizeAsset: 0.0005, pnl: '-0.25', fee: '0.05' }),
    ];
    const r = await runScenario(page, trades);
    expect(r.netPnl).toBeCloseTo(0.25, 4);
    expect(r.visibleCount).toBe(2);
  });

  test('I: Missing _rawCloseSize — legacy fallback path', async ({ page }) => {
    const t0 = 1700800000000;
    const tp1 = closedTrade({ id: 'tI1', posId: 999009, openTime: t0, closeTime: t0+1e6, entry: '70000', exit: '71000', sizeAsset: 0.0005, pnl: '0.50', fee: '0.05' });
    const sl  = closedTrade({ id: 'tI2', posId: 999009, openTime: t0, closeTime: t0+2e6, entry: '70000', exit: '69500', sizeAsset: 0.0005, pnl: '-0.25', fee: '0.05' });
    delete tp1._rawCloseSize; delete sl._rawCloseSize;
    const r = await runScenario(page, [openTrade({ posId: 999009, openTime: t0, entry: '70000', sizeAsset: 0.001 }), tp1, sl]);
    expect(r.netPnl).toBeCloseTo(0.25, 4);
    expect(r.visibleCount).toBe(1);
  });

  test('J: Stale open (sizeAsset=0) — origSize correct gerekend', async ({ page }) => {
    const t0 = 1700900000000;
    const trades = [
      openTrade({ posId: 999010, openTime: t0, entry: '70000', sizeAsset: 0 }),
      closedTrade({ id: 'tJ1', posId: 999010, openTime: t0, closeTime: t0+1e6, entry: '70000', exit: '71000', sizeAsset: 0.0005, pnl: '0.50', fee: '0.05' }),
      closedTrade({ id: 'tJ2', posId: 999010, openTime: t0, closeTime: t0+2e6, entry: '70000', exit: '69500', sizeAsset: 0.0005, pnl: '-0.25', fee: '0.05' }),
    ];
    const r = await runScenario(page, trades);
    expect(r.netPnl).toBeCloseTo(0.25, 4);
    // Wanneer rest=0, origSize = som van siblings = 0.001 (de échte positie)
    expect(r.visible[0].origSize).toBe('0.001');
  });

  // ─── BUG-VALIDATIE — deze tests verwachten WAT KLOPT (zullen falen tot fixes) ─

  test('BUG#1: originalSizeAsset niet 2× te groot bij stale open (klopt = pos-size)', async ({ page }) => {
    const t0 = 1700000000000;
    const trades = [
      openTrade({ posId: 999001, openTime: t0, entry: '70000', sizeAsset: 0.001 }),
      closedTrade({ id: 'tA1', posId: 999001, openTime: t0, closeTime: t0+1e6, entry: '70000', exit: '71000', sizeAsset: 0.0005, pnl: '0.50', fee: '0.05' }),
      closedTrade({ id: 'tA2', posId: 999001, openTime: t0, closeTime: t0+2e6, entry: '70000', exit: '69500', sizeAsset: 0.0005, pnl: '-0.25', fee: '0.05' }),
    ];
    const r = await runScenario(page, trades);
    // Echte positie was 0.001; rest (0.001) + 2 fills van 0.0005 = som niet 0.002 maar 0.001 (rest IS de fills bij volledig dichte positie)
    // Voor nu falen we hier tot Bug 1 gefixt is. Bij volledig dichte positie zou rest=0 moeten zijn.
    expect(parseFloat(r.visible[0].origSize)).toBeCloseTo(0.001, 4);
  });

  test('BUG#2: fees worden geaggregeerd naar partial (TP1+SL fees komen mee)', async ({ page }) => {
    const t0 = 1700000000000;
    const trades = [
      openTrade({ posId: 999001, openTime: t0, entry: '70000', sizeAsset: 0.001 }),
      closedTrade({ id: 'tA1', posId: 999001, openTime: t0, closeTime: t0+1e6, entry: '70000', exit: '71000', sizeAsset: 0.0005, pnl: '0.50', fee: '0.05' }),
      closedTrade({ id: 'tA2', posId: 999001, openTime: t0, closeTime: t0+2e6, entry: '70000', exit: '69500', sizeAsset: 0.0005, pnl: '-0.25', fee: '0.05' }),
    ];
    const r = await runScenario(page, trades);
    // Fees van TP1 (0.05) + SL (0.05) = 0.10. Partial trade zou dit moeten aggregeren.
    expect(r.totalFees).toBeCloseTo(0.10, 4);
  });
});
