// v12.88 — Blofin real-data validatie tegen snapshot in tests/_fixtures/.
//
// Voert de echte fetchTrades-mapping + detectPartials uit op een snapshot van
// Denny's Blofin-account en verifieert:
//   1. Smoke: snapshot laadt, mapper crasht niet, output is array.
//   2. Trade-count: alle records met pnl≠0 of size>0 worden trades.
//   3. PnL-sum: Σ trades.pnl ≈ Σ snapshot.realizedPnl (binnen 1ct tolerance).
//   4. Fees-sum: Σ trades.fees ≈ Σ |snapshot.fee|.
//   5. Open positions parsing crasht niet.
//   6. detectPartials produceert valide output (closed/partial/open).
//
// Aanpak: we mocken `_direct` en `_getContractValue` vóór we `fetchTrades`
// aanroepen — geen echte HTTP calls.
//
// Skipt automatisch als de fixture ontbreekt.
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');
const SNAPSHOT_PATH = path.resolve(__dirname, '_fixtures/blofin-snapshot.json');

const hasFixture = fs.existsSync(SNAPSHOT_PATH);

test.describe('Blofin real-data pipeline (snapshot fixture)', () => {
  test.skip(!hasFixture, 'tests/_fixtures/blofin-snapshot.json ontbreekt — skip op CI');

  let snapshot;
  test.beforeAll(() => {
    snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  });

  // Helper: setup mocks + run fetchTrades against snapshot in browser context
  async function parseSnapshot(page, snap) {
    return page.evaluate(async (snap) => {
      // Mock _direct to feed snapshot data instead of real HTTP call
      const originalDirect = ExchangeAPI.blofin._direct;
      ExchangeAPI.blofin._direct = async (apiKey, apiSecret, passphrase, path) => {
        if (path.includes('positions-history')) return { data: snap.positionsHistory, code: '0' };
        if (path.includes('positions')) return { data: snap.openPositions, code: '0' };
        return { data: [], code: '0' };
      };
      // Mock contractValue cache (1.0 for BTC-USDT, ETH-USDT — Blofin levert qty al in base currency,
      // niet in contracts, in deze API-respons)
      ExchangeAPI.blofin._ctvCache = { 'BTC-USDT': 1, 'ETH-USDT': 1 };
      ExchangeAPI.blofin._ctvCacheTs = Date.now();

      const trades = await ExchangeAPI.blofin.fetchTrades('mock', 'mock', 'mock');
      const detected = ExchangeAPI.blofin.detectPartials(trades);

      // Restore
      ExchangeAPI.blofin._direct = originalDirect;

      return {
        rawCount: trades.length,
        detectedCount: detected.length,
        statusCounts: detected.reduce((m, t) => { m[t.status] = (m[t.status] || 0) + 1; return m; }, {}),
        sumPnl: +detected.reduce((s, t) => s + (parseFloat(t.pnl) || 0) + (parseFloat(t.realizedPnl) || 0), 0).toFixed(4),
        sumFees: +detected.reduce((s, t) => s + (parseFloat(t.fees) || 0), 0).toFixed(4),
        directions: detected.reduce((m, t) => { m[t.direction] = (m[t.direction] || 0) + 1; return m; }, {}),
        sample: trades[0],
      };
    }, snap);
  }

  test('smoke — snapshot vorm + parser draait zonder crash', async ({ page }) => {
    await page.goto(FILE_URL);
    expect(snapshot.type).toBe('blofin-snapshot');
    expect(Array.isArray(snapshot.positionsHistory)).toBe(true);
    expect(snapshot.positionsHistory.length).toBeGreaterThan(0);

    const result = await parseSnapshot(page, snapshot);
    expect(result.rawCount).toBeGreaterThan(0);
    expect(result.sample).toBeTruthy();
    expect(result.sample.source).toBe('blofin');
    expect(result.sample.status).toBe('closed');
  });

  test('trade-count = aantal records met pnl≠0 of size>0', async ({ page }) => {
    await page.goto(FILE_URL);
    const expectedCount = snapshot.positionsHistory.filter(r => {
      const pnl = parseFloat(r.realizedPnl || r.pnl || '0');
      const sz = Math.abs(parseFloat(r.closePositions || r.closeTotalPos || '0'));
      return pnl !== 0 || sz > 0;
    }).length;

    const result = await parseSnapshot(page, snapshot);
    expect(result.rawCount).toBe(expectedCount);
  });

  test('PnL-sum: Σ trades.pnl = Σ snapshot.realizedPnl (binnen 1ct)', async ({ page }) => {
    await page.goto(FILE_URL);
    const sumSnapshotPnl = snapshot.positionsHistory.reduce((s, r) =>
      s + (parseFloat(r.realizedPnl || r.pnl || '0') || 0), 0);

    const result = await parseSnapshot(page, snapshot);

    console.log('Blofin pnl-sum:', {
      rawCount: result.rawCount,
      detectedCount: result.detectedCount,
      statusCounts: result.statusCounts,
      directions: result.directions,
      sumSnapshotPnl: +sumSnapshotPnl.toFixed(4),
      sumTradePnl: result.sumPnl,
      sumTradeFees: result.sumFees,
    });

    expect(Math.abs(result.sumPnl - sumSnapshotPnl)).toBeLessThan(0.01);
  });

  test('Fees-sum: Σ trades.fees ≈ Σ |snapshot.fee| (binnen 1ct)', async ({ page }) => {
    await page.goto(FILE_URL);
    const sumSnapshotFees = snapshot.positionsHistory.reduce((s, r) =>
      s + Math.abs(parseFloat(r.fee || '0') || 0), 0);

    const result = await parseSnapshot(page, snapshot);
    expect(Math.abs(result.sumFees - sumSnapshotFees)).toBeLessThan(0.01);
  });

  test('open positions parser — geen crash, geldige trade-shape', async ({ page }) => {
    await page.goto(FILE_URL);
    if (!snapshot.openPositions || snapshot.openPositions.length === 0) {
      test.skip(true, 'geen open posities in snapshot');
      return;
    }

    const result = await page.evaluate(async (snap) => {
      const originalDirect = ExchangeAPI.blofin._direct;
      ExchangeAPI.blofin._direct = async (apiKey, apiSecret, passphrase, path) => {
        return { data: snap.openPositions, code: '0' };
      };
      ExchangeAPI.blofin._ctvCache = { 'BTC-USDT': 1, 'ETH-USDT': 1 };
      ExchangeAPI.blofin._ctvCacheTs = Date.now();

      const opens = await ExchangeAPI.blofin.fetchOpenPositions('mock', 'mock', 'mock');

      ExchangeAPI.blofin._direct = originalDirect;
      return { opens, count: opens.length };
    }, snapshot);

    expect(result.count).toBe(snapshot.openPositions.length);
    for (const t of result.opens) {
      expect(t.source).toBe('blofin');
      expect(t.status).toBe('open');
      expect(['long', 'short']).toContain(t.direction);
      expect(parseFloat(t.entry)).toBeGreaterThan(0);
      expect(parseFloat(t.positionSizeAsset)).toBeGreaterThan(0);
    }
  });

  test('detectPartials — produceert valid status-counts', async ({ page }) => {
    await page.goto(FILE_URL);
    const result = await parseSnapshot(page, snapshot);

    // Alle statussen moeten valid zijn
    for (const status of Object.keys(result.statusCounts)) {
      expect(['closed', 'partial', 'open']).toContain(status);
    }
    // Som van status-counts = totaal trades
    const total = Object.values(result.statusCounts).reduce((a, b) => a + b, 0);
    expect(total).toBe(result.detectedCount);

    // Geen crash → directions zijn 'long' of 'short'
    for (const dir of Object.keys(result.directions)) {
      expect(['long', 'short']).toContain(dir);
    }
  });
});
