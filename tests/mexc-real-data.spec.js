// v12.88 — MEXC real-data validatie tegen snapshot in tests/_fixtures/.
//
// Voert de echte fetchTrades-mapping + detectPartials uit op een snapshot van
// Denny's MEXC-account en verifieert:
//   1. Smoke: snapshot laadt, mapper crasht niet, output is array.
//   2. Trade-count = aantal records in snapshot.positionsHistory.
//   3. PnL-sum: Σ trades.pnl ≈ Σ snapshot.realised (binnen 1ct).
//   4. Fees-sum: Σ trades.fees ≈ Σ |snapshot.fee|.
//   5. Open positions parsing crasht niet.
//   6. detectPartials produceert valide output.
//
// Aanpak: we mocken `proxyCall` (i.p.v. echte HTTP) en pre-fillen `_ctvCache`
// met bekende MEXC contract-sizes voor de symbolen in de snapshot.
//
// Skipt automatisch als de fixture ontbreekt.
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');
const SNAPSHOT_PATH = path.resolve(__dirname, '_fixtures/mexc-snapshot.json');

// Bekende MEXC USDT-perp contract-sizes (uit public /contract/detail).
// Niet uitputtend — uitbreiden bij meer symbolen in de snapshot.
const MEXC_CONTRACT_SIZES = {
  BTC_USDT: 0.0001,
  ETH_USDT: 0.01,
  SOL_USDT: 1,
};

const hasFixture = fs.existsSync(SNAPSHOT_PATH);

test.describe('MEXC real-data pipeline (snapshot fixture)', () => {
  test.skip(!hasFixture, 'tests/_fixtures/mexc-snapshot.json ontbreekt — skip op CI');

  let snapshot;
  test.beforeAll(() => {
    snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  });

  async function parseSnapshot(page, snap, ctvCache) {
    return page.evaluate(async ({ snap, ctvCache }) => {
      // Mock proxyCall vóór fetchTrades aanroept
      const originalProxy = window.proxyCall;
      window.proxyCall = async (req) => {
        if (req.action === 'trades') return { trades: snap.positionsHistory };
        if (req.action === 'open_positions') return { positions: snap.openPositions };
        return {};
      };
      // Pre-fill contract-size cache (voorkomt CORS-fetch naar contract.mexc.com)
      Object.assign(ExchangeAPI.mexc._ctvCache, ctvCache);

      const trades = await ExchangeAPI.mexc.fetchTrades('mock', 'mock');
      const detected = ExchangeAPI.mexc.detectPartials(trades);

      window.proxyCall = originalProxy;

      return {
        rawCount: trades.length,
        detectedCount: detected.length,
        statusCounts: detected.reduce((m, t) => { m[t.status] = (m[t.status] || 0) + 1; return m; }, {}),
        sumPnl: +detected.reduce((s, t) => s + (parseFloat(t.pnl) || 0) + (parseFloat(t.realizedPnl) || 0), 0).toFixed(4),
        sumFees: +detected.reduce((s, t) => s + (parseFloat(t.fees) || 0), 0).toFixed(4),
        directions: detected.reduce((m, t) => { m[t.direction] = (m[t.direction] || 0) + 1; return m; }, {}),
        sample: trades[0],
      };
    }, { snap, ctvCache });
  }

  test('smoke — snapshot vorm + parser draait zonder crash', async ({ page }) => {
    await page.goto(FILE_URL);
    expect(snapshot.type).toBe('mexc-snapshot');
    expect(Array.isArray(snapshot.positionsHistory)).toBe(true);
    expect(snapshot.positionsHistory.length).toBeGreaterThan(0);

    const result = await parseSnapshot(page, snapshot, MEXC_CONTRACT_SIZES);
    expect(result.rawCount).toBeGreaterThan(0);
    expect(result.sample).toBeTruthy();
    expect(result.sample.source).toBe('mexc');
    expect(result.sample.status).toBe('closed');
  });

  test('trade-count = aantal records in snapshot', async ({ page }) => {
    await page.goto(FILE_URL);
    const result = await parseSnapshot(page, snapshot, MEXC_CONTRACT_SIZES);
    expect(result.rawCount).toBe(snapshot.positionsHistory.length);
  });

  test('PnL-sum NET: Σ trades.pnl = Σ realised — v12.88 (2nd fix: realised is al NET)', async ({ page }) => {
    await page.goto(FILE_URL);
    // v12.88 (2nd fix): MEXC's `realised` is al NET (gross − fee), bevestigd via:
    //   - 3-way met xlsx: xlsx ClosingPNL (gross per fill) − xlsx fees = snap realised
    //   - Empirische check op 134 records: fee=0 → realised=gross; fee≠0 → realised=gross−|fee|
    // Parser slaat realised direct op in trade.pnl. netPnl() helper retourneert dat (correct).
    const sumNetExpected = snapshot.positionsHistory.reduce((s, r) =>
      s + (parseFloat(r.realised) || 0), 0);

    const result = await parseSnapshot(page, snapshot, MEXC_CONTRACT_SIZES);

    console.log('MEXC pnl-sum:', {
      rawCount: result.rawCount,
      detectedCount: result.detectedCount,
      statusCounts: result.statusCounts,
      directions: result.directions,
      sumNetExpected: +sumNetExpected.toFixed(4),
      sumTradePnl: result.sumPnl,
      sumTradeFees: result.sumFees,
    });

    expect(Math.abs(result.sumPnl - sumNetExpected)).toBeLessThan(0.01);
  });

  test('Fees-sum: Σ trades.fees = Σ |snapshot.fee| (binnen 1ct) — v12.88 fix', async ({ page }) => {
    await page.goto(FILE_URL);
    // v12.88 fix: parser doet nu Math.abs() op fees, consistent met Blofin/Kraken/Hyperliquid.
    const sumSnapshotAbs = snapshot.positionsHistory.reduce((s, r) =>
      s + Math.abs(parseFloat(r.fee) || 0), 0);

    const result = await parseSnapshot(page, snapshot, MEXC_CONTRACT_SIZES);
    expect(Math.abs(result.sumFees - sumSnapshotAbs)).toBeLessThan(0.01);
  });

  test('open positions parser — geen crash, geldige trade-shape', async ({ page }) => {
    await page.goto(FILE_URL);
    if (!snapshot.openPositions || snapshot.openPositions.length === 0) {
      test.skip(true, 'geen open posities in snapshot');
      return;
    }

    const result = await page.evaluate(async ({ snap, ctvCache }) => {
      const originalProxy = window.proxyCall;
      window.proxyCall = async (req) => {
        if (req.action === 'open_positions') return { positions: snap.openPositions };
        return {};
      };
      Object.assign(ExchangeAPI.mexc._ctvCache, ctvCache);

      const opens = await ExchangeAPI.mexc.fetchOpenPositions('mock', 'mock');
      window.proxyCall = originalProxy;
      return { opens, count: opens.length };
    }, { snap: snapshot, ctvCache: MEXC_CONTRACT_SIZES });

    expect(result.count).toBe(snapshot.openPositions.length);
    for (const t of result.opens) {
      expect(t.source).toBe('mexc');
      expect(t.status).toBe('open');
      expect(['long', 'short']).toContain(t.direction);
      expect(parseFloat(t.entry)).toBeGreaterThan(0);
    }
  });

  test('detectPartials — produceert valid status-counts', async ({ page }) => {
    await page.goto(FILE_URL);
    const result = await parseSnapshot(page, snapshot, MEXC_CONTRACT_SIZES);

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
