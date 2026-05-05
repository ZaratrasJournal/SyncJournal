// v12.88 — Kraken real-data validatie tegen snapshot in tests/_fixtures/.
//
// Voert _normalise + detectPartials uit op een snapshot van Denny's Kraken-
// account en verifieert:
//   1. Smoke: snapshot laadt, mapper crasht niet, output is array.
//   2. Trade-count: alle records met pair_clean/symbol/direction worden trades.
//   3. PnL-sum: Σ trades.pnl ≈ Σ snapshot.pnl (closed trades).
//   4. Fees-sum: Σ trades.fees ≈ Σ |snapshot.fee|.
//   5. Open positions parsing crasht niet (skip indien leeg).
//   6. detectPartials produceert valide output.
//
// Skipt automatisch als de fixture ontbreekt.
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');
const SNAPSHOT_PATH = path.resolve(__dirname, '_fixtures/kraken-snapshot.json');

const hasFixture = fs.existsSync(SNAPSHOT_PATH);

test.describe('Kraken real-data pipeline (snapshot fixture)', () => {
  test.skip(!hasFixture, 'tests/_fixtures/kraken-snapshot.json ontbreekt — skip op CI');

  let snapshot;
  test.beforeAll(() => {
    snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  });

  async function parseSnapshot(page, snap) {
    return page.evaluate((snap) => {
      // Kraken's _normalise verwacht raw proxy-respons (die de snapshot opslaat).
      // Filter is identiek aan fetchTrades: t.pair_clean||t.symbol||t.direction.
      const filtered = snap.positionsHistory.filter(t => t.pair_clean || t.symbol || t.direction);
      const trades = filtered.map(t => ExchangeAPI.kraken._normalise(t));
      const detected = ExchangeAPI.kraken.detectPartials(trades);

      return {
        rawInput: snap.positionsHistory.length,
        filteredCount: filtered.length,
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
    expect(snapshot.type).toBe('kraken-snapshot');
    expect(Array.isArray(snapshot.positionsHistory)).toBe(true);
    expect(snapshot.positionsHistory.length).toBeGreaterThan(0);

    const result = await parseSnapshot(page, snapshot);
    expect(result.detectedCount).toBeGreaterThan(0);
    expect(result.sample).toBeTruthy();
    expect(result.sample.source).toBe('kraken');
  });

  test('trade-count = aantal records met pair_clean/symbol/direction', async ({ page }) => {
    await page.goto(FILE_URL);
    const expectedCount = snapshot.positionsHistory.filter(t =>
      t.pair_clean || t.symbol || t.direction
    ).length;

    const result = await parseSnapshot(page, snapshot);
    expect(result.filteredCount).toBe(expectedCount);
    expect(result.detectedCount).toBe(expectedCount);
  });

  test('PnL-sum: Σ trades.pnl = Σ snapshot.pnl (binnen 1ct)', async ({ page }) => {
    await page.goto(FILE_URL);
    const sumSnapshotPnl = snapshot.positionsHistory
      .filter(t => (t.status || 'closed') === 'closed')
      .reduce((s, r) => s + (parseFloat(r.pnl) || 0), 0);

    const result = await parseSnapshot(page, snapshot);

    console.log('Kraken pnl-sum:', {
      rawInput: result.rawInput,
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

    const result = await page.evaluate((snap) => {
      const opens = snap.openPositions.map(t =>
        ({ ...ExchangeAPI.kraken._normalise({ ...t, status: 'open' }), status: 'open' })
      );
      return { opens, count: opens.length };
    }, snapshot);

    expect(result.count).toBe(snapshot.openPositions.length);
    for (const t of result.opens) {
      expect(t.source).toBe('kraken');
      expect(t.status).toBe('open');
      expect(['long', 'short']).toContain(t.direction);
    }
  });

  test('detectPartials — produceert valid status-counts', async ({ page }) => {
    await page.goto(FILE_URL);
    const result = await parseSnapshot(page, snapshot);

    for (const status of Object.keys(result.statusCounts)) {
      expect(['closed', 'partial', 'open']).toContain(status);
    }
    const total = Object.values(result.statusCounts).reduce((a, b) => a + b, 0);
    expect(total).toBe(result.detectedCount);

    for (const dir of Object.keys(result.directions)) {
      expect(['long', 'short']).toContain(dir);
    }
  });
});
