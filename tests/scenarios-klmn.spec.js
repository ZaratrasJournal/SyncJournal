// v12.88 — Scenarios K, L, M, N (uitbreiding op blofin-pipeline-scenarios.spec.js).
//
// Focus: niet de aggregaten (netPnl/totalFees, al gedekt door A-J) maar het
// BEHOUD VAN VELDEN op de visible trade na detectPartialFromSiblings.
// Concrete bug-vectors:
//   K: stopLoss-veld op open trade moet bewaard blijven na merge met SL-fill
//   L: notes/setupTags/rating/screenshot blijven na TP1+SL merge (community-bug v12.87)
//   M: open trade met unrealizedPnl behoudt status='open' + veld als geen siblings
//   N: getConsumedSiblings filtert closed siblings uit als ze geconsumeerd zijn
//      door een partial — voorkomt dubbele weergave in Trades-pagina.
const { test, expect } = require('@playwright/test');
const path = require('path');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');

function closedTrade({ id, posId, openTime, closeTime, entry, exit, sizeAsset, pnl, fee, dir = 'long', pair = 'BTC/USDT' }) {
  const entryN = parseFloat(entry);
  return {
    id, positionId: String(posId), source: 'blofin', status: 'closed',
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

function openTrade({ posId, openTime, entry, sizeAsset, dir = 'long', pair = 'BTC/USDT', sl = '', tp = '', edits = {} }) {
  const entryN = parseFloat(entry);
  return {
    id: 'blofin_open_' + posId, positionId: String(posId), source: 'blofin', status: 'open',
    pair, direction: dir,
    entry: String(entry), exit: '',
    positionSize: (entryN * sizeAsset).toFixed(2),
    positionSizeAsset: String(sizeAsset),
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
    unrealizedPnl: edits.unrealizedPnl || '',
  };
}

// Variant van runScenario die FULL visible objecten retourneert i.p.v. summary —
// nodig om field-behoud te checken (stopLoss, notes, setupTags, etc).
async function runFullScenario(page, trades) {
  return page.evaluate((trades) => {
    const detected = detectPartialFromSiblings(trades, 'blofin');
    const consumed = getConsumedSiblings(detected);
    const visible = detected.filter(t => !consumed.has(t.id));
    return {
      visibleCount: visible.length,
      consumedIds: [...consumed],
      detectedCount: detected.length,
      visible: visible.map(t => ({
        id: t.id, status: t.status,
        positionSizeAsset: t.positionSizeAsset,
        originalSizeAsset: t.originalSizeAsset || '',
        pnl: t.pnl || '',
        realizedPnl: t.realizedPnl || '',
        unrealizedPnl: t.unrealizedPnl || '',
        fees: t.fees,
        stopLoss: t.stopLoss || '',
        takeProfit: t.takeProfit || '',
        notes: t.notes || '',
        setupTags: t.setupTags || [],
        rating: t.rating || 0,
        screenshot: t.screenshot,
        tpLevelsCount: (t.tpLevels || []).length,
      })),
    };
  }, trades);
}

test.describe('Scenarios K, L, M, N — field-behoud + edge-cases (v12.88)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => typeof detectPartialFromSiblings === 'function', { timeout: 15_000 });
  });

  test('K: SL hit zonder TP — stopLoss-veld blijft op merged partial', async ({ page }) => {
    const t0 = 1701000000000;
    const trades = [
      openTrade({
        posId: 999011, openTime: t0, entry: '70000', sizeAsset: 0.001,
        sl: '69000', // user heeft SL gezet op 69000
      }),
      // SL hit — exit op 69000, volledige size, negatieve pnl
      closedTrade({ id: 'tK1', posId: 999011, openTime: t0, closeTime: t0+1e6,
        entry: '70000', exit: '69000', sizeAsset: 0.001, pnl: '-1.00', fee: '0.10' }),
    ];
    const r = await runFullScenario(page, trades);

    expect(r.visibleCount).toBe(1);
    const trade = r.visible[0];
    expect(trade.status).toBe('partial'); // detectPartialFromSiblings switcht naar partial
    expect(trade.stopLoss).toBe('69000'); // SL-veld blijft behouden
    expect(parseFloat(trade.realizedPnl)).toBeCloseTo(-1.0, 4);
    expect(trade.tpLevelsCount).toBe(1); // SL-fill wordt als tpLevel geregistreerd
  });

  test('L: Manual edits behoud bij TP1+SL — notes/setupTags/rating/screenshot blijven', async ({ page }) => {
    const t0 = 1701100000000;
    const trades = [
      openTrade({
        posId: 999012, openTime: t0, entry: '70000', sizeAsset: 0.001,
        sl: '69000', tp: '72000',
        edits: {
          notes: 'Strong breakout setup, expected continuation',
          setupTags: ['breakout', 'volume-spike'],
          confirmationTags: ['MA-cross'],
          rating: 4,
          screenshot: 'data:image/png;base64,iVBORw0KG...', // dummy
          emotionTags: ['focused'],
        },
      }),
      // TP1 partial — 50% op 71000
      closedTrade({ id: 'tL1', posId: 999012, openTime: t0, closeTime: t0+1e6,
        entry: '70000', exit: '71000', sizeAsset: 0.0005, pnl: '0.50', fee: '0.05' }),
      // SL hit — rest 50% op 69000
      closedTrade({ id: 'tL2', posId: 999012, openTime: t0, closeTime: t0+2e6,
        entry: '70000', exit: '69000', sizeAsset: 0.0005, pnl: '-0.50', fee: '0.05' }),
    ];
    const r = await runFullScenario(page, trades);

    expect(r.visibleCount).toBe(1);
    const trade = r.visible[0];
    expect(trade.status).toBe('partial');
    // Alle user-edits behouden
    expect(trade.notes).toBe('Strong breakout setup, expected continuation');
    expect(trade.setupTags).toEqual(['breakout', 'volume-spike']);
    expect(trade.rating).toBe(4);
    expect(trade.screenshot).toBe('data:image/png;base64,iVBORw0KG...');
    expect(trade.stopLoss).toBe('69000');
    expect(trade.takeProfit).toBe('72000');
    // Pipeline-aggregaten kloppen ook
    expect(parseFloat(trade.realizedPnl)).toBeCloseTo(0.0, 4); // +0.50 + -0.50 = 0
    expect(parseFloat(trade.fees)).toBeCloseTo(0.10, 4); // bug 2 fix: fees aggregeren
  });

  test('M: Open trade met unrealizedPnl, geen siblings — status=open, unrealizedPnl behouden', async ({ page }) => {
    const t0 = 1701200000000;
    const trades = [
      openTrade({
        posId: 999013, openTime: t0, entry: '70000', sizeAsset: 0.001,
        sl: '69000', tp: '72000',
        edits: {
          unrealizedPnl: '15.50',
          notes: 'Running winner, leaving runner',
        },
      }),
    ];
    const r = await runFullScenario(page, trades);

    expect(r.visibleCount).toBe(1);
    const trade = r.visible[0];
    // Geen siblings → status blijft 'open' (niet partial)
    expect(trade.status).toBe('open');
    expect(trade.unrealizedPnl).toBe('15.50');
    expect(trade.notes).toBe('Running winner, leaving runner');
    expect(trade.stopLoss).toBe('69000');
    expect(trade.takeProfit).toBe('72000');
    // Geen realizedPnl, geen tpLevels
    expect(trade.realizedPnl).toBe('');
    expect(trade.tpLevelsCount).toBe(0);
  });

  test('N: getConsumedSiblings filtert closed-siblings uit na partial-merge', async ({ page }) => {
    // Sanity: zonder de filter zouden de closed siblings ook in de visible-lijst staan
    // → dubbele weergave in Trades-pagina (de partial + de individuele closes).
    const t0 = 1701300000000;
    const trades = [
      openTrade({ posId: 999014, openTime: t0, entry: '70000', sizeAsset: 0.002 }),
      closedTrade({ id: 'tN1', posId: 999014, openTime: t0, closeTime: t0+1e6,
        entry: '70000', exit: '71000', sizeAsset: 0.001, pnl: '1.00', fee: '0.10' }),
      closedTrade({ id: 'tN2', posId: 999014, openTime: t0, closeTime: t0+2e6,
        entry: '70000', exit: '72000', sizeAsset: 0.001, pnl: '2.00', fee: '0.10' }),
    ];
    const r = await runFullScenario(page, trades);

    // Pipeline detecteert 3 trades (open→partial + 2 closed siblings)
    expect(r.detectedCount).toBe(3);
    // Maar visible = 1 (de partial), de 2 siblings zijn consumed
    expect(r.visibleCount).toBe(1);
    expect(r.consumedIds).toEqual(expect.arrayContaining(['tN1', 'tN2']));
    expect(r.consumedIds.length).toBe(2);

    const trade = r.visible[0];
    expect(trade.status).toBe('partial');
    expect(trade.tpLevelsCount).toBe(2); // beide siblings als tpLevels
    expect(parseFloat(trade.realizedPnl)).toBeCloseTo(3.0, 4);
  });
});
