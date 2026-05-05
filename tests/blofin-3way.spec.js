// v12.88 — Blofin 3-way validation: CSV ↔ snapshot ↔ parser.
//
// Drie onafhankelijke bronnen:
//   1. CSV order-history export (fill-level, opens+closes als losse rijen).
//   2. API snapshot (`captureSnapshot` /positions-history) — al positie-level
//      geaggregeerd door Blofin server.
//   3. Parser-output (via fetchTrades op snapshot) — trade-level.
//
// Verifieert:
//   A. Counts plausibel: CSV close-orders ≈ snapshot positie-records (orders kunnen
//      meerdere TPs/SL hebben per positie).
//   B. Per-pair NET PnL: CSV (Σ PNL − Σ Fee) = Snapshot Σ realizedPnl, binnen tolerantie.
//      Drift komt van open-fees die buiten snapshot-window vallen (CSV ziet alle fills
//      sinds export-startdatum; snapshot heeft cap op recente positions).
//   C. Parser produceert trade-count = snapshot.positionsHistory.length.
//
// Belangrijke conventies:
//   - CSV PNL kolom = GROSS PnL per close-fill (excl. fees).
//   - Snapshot realizedPnl = NET PnL per positie (incl. fees, verified v12.87).
//   - Beide convergeren via: NET = Σ PNL − Σ Fee (op CSV) = Σ realizedPnl (op snap).
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');
const SNAPSHOT_PATH = path.resolve(__dirname, '_fixtures/blofin-snapshot.json');
const CSV_PATH = path.resolve(__dirname, '_fixtures/blofin-export.csv');

const hasFixtures = fs.existsSync(SNAPSHOT_PATH) && fs.existsSync(CSV_PATH);

// CSV-line splitter die quoted commas respecteert.
function parseCSVLine(line) {
  const out = []; let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQ = !inQ;
    else if (c === ',' && !inQ) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

// Helper: pak numerieke value uit "123.45 USDT" of "0.0255 BTC"
const stripUnit = s => String(s || '').replace(/"/g, '').split(/\s+/)[0].replace(/,/g, '');

function parseCsvFills(csvText) {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim());
  const headers = parseCSVLine(lines[0]).map(h => h.trim().replace(/"/g, ''));
  const fills = [];
  for (let i = 1; i < lines.length; i++) {
    const v = parseCSVLine(lines[i]);
    const r = {}; headers.forEach((h, idx) => r[h] = v[idx] || '');
    if ((r['Status'] || '').toLowerCase() !== 'filled') continue;
    fills.push({
      symbol: r['Underlying Asset'] || '',
      side: (r['Side'] || '').toLowerCase(),
      reduceOnly: (r['Reduce-only'] || '').toLowerCase() === 'y',
      price: parseFloat(stripUnit(r['Avg Fill'])) || 0,
      size: parseFloat(stripUnit(r['Filled'])) || 0,
      pnl: parseFloat(stripUnit(r['PNL'])) || 0,  // GROSS per close-fill
      fee: Math.abs(parseFloat(stripUnit(r['Fee'])) || 0),
    });
  }
  return fills;
}

test.describe('Blofin 3-way: CSV ↔ snapshot ↔ parser', () => {
  test.skip(!hasFixtures, 'CSV en/of snapshot fixture ontbreekt — skip op CI');

  let snapshot, csvFills;
  test.beforeAll(() => {
    snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
    csvFills = parseCsvFills(fs.readFileSync(CSV_PATH, 'utf8'));
  });

  test('A: CSV close-orders ≥ snapshot positie-records (TPs/SL maken meerdere closes per positie)', async () => {
    const csvCloses = csvFills.filter(f => f.reduceOnly).length;
    const snapPositions = snapshot.positionsHistory.length;
    expect(csvCloses).toBeGreaterThanOrEqual(snapPositions);
    // Sanity: niet absurd veel meer (3× positie-count zou raar zijn)
    expect(csvCloses).toBeLessThanOrEqual(snapPositions * 3);
  });

  test('B: per-pair NET PnL: Σ_CSV(PNL−Fee) ≈ Σ_Snap(realizedPnl) — binnen $5/pair', async () => {
    // CSV per pair
    const csvPair = {};
    for (const f of csvFills) {
      csvPair[f.symbol] = csvPair[f.symbol] || { pnl: 0, fee: 0 };
      csvPair[f.symbol].pnl += f.pnl;
      csvPair[f.symbol].fee += f.fee;
    }

    // Snap per pair (instId "BTC-USDT" → "BTCUSDT")
    const snapPair = {};
    for (const r of snapshot.positionsHistory) {
      const sym = String(r.instId || '').replace('-', '');
      snapPair[sym] = snapPair[sym] || { pnl: 0, fee: 0 };
      snapPair[sym].pnl += parseFloat(r.realizedPnl) || 0;
      snapPair[sym].fee += Math.abs(parseFloat(r.fee) || 0);
    }

    const allPairs = new Set([...Object.keys(csvPair), ...Object.keys(snapPair)]);
    const driftPerPair = {};
    let maxDrift = 0;
    for (const sym of allPairs) {
      const c = csvPair[sym] || { pnl: 0, fee: 0 };
      const s = snapPair[sym] || { pnl: 0, fee: 0 };
      const csvNet = c.pnl - c.fee;
      const snapNet = s.pnl;
      const drift = Math.abs(csvNet - snapNet);
      driftPerPair[sym] = { csvNet: +csvNet.toFixed(2), snapNet: +snapNet.toFixed(2), drift: +drift.toFixed(2) };
      if (drift > maxDrift) maxDrift = drift;
    }

    console.log('Blofin per-pair NET PnL:', driftPerPair);

    // Tolerantie $5: drift komt van open-fees op posities buiten snapshot-window
    // (snapshot heeft cap op recente posities, CSV ziet alles sinds export-start).
    expect(maxDrift).toBeLessThan(5);
  });

  test('C: Σ totalen — CSV NET ≈ Snap NET, Σ Fee binnen 5%', async () => {
    const sumCsvPnl = csvFills.reduce((s, f) => s + f.pnl, 0);
    const sumCsvFee = csvFills.reduce((s, f) => s + f.fee, 0);
    const csvNet = sumCsvPnl - sumCsvFee;

    const sumSnapPnl = snapshot.positionsHistory.reduce((s, r) => s + (parseFloat(r.realizedPnl) || 0), 0);
    const sumSnapFee = snapshot.positionsHistory.reduce((s, r) => s + Math.abs(parseFloat(r.fee) || 0), 0);

    console.log('Blofin totalen:', {
      csvFills: csvFills.length,
      snapPositions: snapshot.positionsHistory.length,
      csvSumPnlGross: +sumCsvPnl.toFixed(2),
      csvSumFee: +sumCsvFee.toFixed(2),
      csvNet: +csvNet.toFixed(2),
      snapSumRealizedPnlNet: +sumSnapPnl.toFixed(2),
      snapSumFee: +sumSnapFee.toFixed(2),
      netDrift: +Math.abs(csvNet - sumSnapPnl).toFixed(2),
      feeDrift: +Math.abs(sumCsvFee - sumSnapFee).toFixed(2),
    });

    // CSV NET en Snap NET binnen $5 (drift door open-fees buiten snapshot-window)
    expect(Math.abs(csvNet - sumSnapPnl)).toBeLessThan(5);
    // Σ Fee binnen 5% relatieve tolerantie
    expect(Math.abs(sumCsvFee - sumSnapFee) / sumCsvFee).toBeLessThan(0.05);
  });

  test('D: parser produceert trade-count = snapshot.positionsHistory.length', async ({ page }) => {
    await page.goto(FILE_URL);
    const result = await page.evaluate(async (snap) => {
      const originalDirect = ExchangeAPI.blofin._direct;
      ExchangeAPI.blofin._direct = async (apiKey, apiSecret, passphrase, path) => {
        if (path.includes('positions-history')) return { data: snap.positionsHistory, code: '0' };
        return { data: [], code: '0' };
      };
      ExchangeAPI.blofin._ctvCache = { 'BTC-USDT': 1, 'ETH-USDT': 1 };
      ExchangeAPI.blofin._ctvCacheTs = Date.now();
      const trades = await ExchangeAPI.blofin.fetchTrades('mock', 'mock', 'mock');
      ExchangeAPI.blofin._direct = originalDirect;
      return { count: trades.length };
    }, snapshot);

    expect(result.count).toBe(snapshot.positionsHistory.length);
  });
});
