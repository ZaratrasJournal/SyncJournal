// v12.88 — Kraken 3-way validation: CSV ↔ snapshot ↔ parser.
//
// Drie onafhankelijke bronnen:
//   1. CSV account-log (Kraken Futures export — 22 kolommen, mix van futures-trade /
//      funding-rate / conversion / interest etc rijen).
//   2. API snapshot (`captureSnapshot` /historyfills) — al positie-genormaliseerd door
//      onze proxy + `_normalise` (één record per close-event).
//   3. Parser-output (via `_normalise` op snapshot) — trade-level.
//
// Belangrijk verschil met andere exchanges:
//   - CSV bevat de hele history (Kraken accountlogs API) — kan 6+ maanden terug.
//   - Snapshot is wat onze proxy levert via /historyfills (kortere window).
//   - We vergelijken alleen op de OVERLAP window (CSV-dates ≥ min snapshot-date).
//
// Verifieert:
//   A. CSV usd-side close-rijen ≥ snapshot positie-records (TPs maken meerdere closes).
//   B. Σ realized pnl in overlap window: CSV ≈ snapshot, binnen $5.
//   C. Σ fee in overlap: CSV ≈ snapshot, binnen 30% relatief (fees-attributie verschilt
//      per fill vs per positie omdat Kraken's accountlogs alle fees apart logt).
//   D. Parser-output trade-count = snapshot.length.
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');
const SNAPSHOT_PATH = path.resolve(__dirname, '_fixtures/kraken-snapshot.json');
const CSV_PATH = path.resolve(__dirname, '_fixtures/kraken-export.csv');

const hasFixtures = fs.existsSync(SNAPSHOT_PATH) && fs.existsSync(CSV_PATH);

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

function parseKrakenCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim());
  const headers = parseCSVLine(lines[0]).map(h => h.trim().replace(/"/g, ''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const v = parseCSVLine(lines[i]).map(x => x.replace(/"/g, ''));
    const r = {}; headers.forEach((h, idx) => r[h] = v[idx] || '');
    rows.push(r);
  }
  return rows;
}

test.describe('Kraken 3-way: CSV ↔ snapshot ↔ parser', () => {
  test.skip(!hasFixtures, 'CSV en/of snapshot fixture ontbreekt — skip op CI');

  let snapshot, csvRows;
  test.beforeAll(() => {
    snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
    csvRows = parseKrakenCsv(fs.readFileSync(CSV_PATH, 'utf8'));
  });

  test('A: CSV usd-side close-rijen in overlap window ≥ snapshot positie-records', async () => {
    // CSV bevat hele history (6+ maanden), snapshot kortere window (~6 weken).
    // Vergelijk alleen op overlap-periode.
    const snapDates = snapshot.positionsHistory.map(r => new Date(r.fillTime).getTime()).filter(t => t > 0);
    const snapStart = Math.min(...snapDates);

    const usdClosesAll = csvRows.filter(r =>
      r.type === 'futures trade' && r.symbol === 'usd' && parseFloat(r['realized pnl']) !== 0
    );
    const usdClosesOverlap = usdClosesAll.filter(r =>
      new Date(r.dateTime).getTime() >= snapStart
    );

    const snapPositions = snapshot.positionsHistory.length;
    expect(usdClosesOverlap.length).toBeGreaterThanOrEqual(snapPositions);
    // Sanity: niet meer dan 5× position-count (TPs + SL maken meerdere closes per positie)
    expect(usdClosesOverlap.length).toBeLessThanOrEqual(snapPositions * 5);
  });

  test('B: Σ realized pnl in overlap window — CSV ≈ snapshot binnen $5', async () => {
    const snapDates = snapshot.positionsHistory
      .map(r => new Date(r.fillTime).getTime())
      .filter(t => t > 0);
    const snapStart = Math.min(...snapDates);

    const usdCloses = csvRows.filter(r =>
      r.type === 'futures trade' &&
      r.symbol === 'usd' &&
      parseFloat(r['realized pnl']) !== 0 &&
      new Date(r.dateTime).getTime() >= snapStart
    );

    const csvSumPnl = usdCloses.reduce((s, r) => s + (parseFloat(r['realized pnl']) || 0), 0);
    const snapSumPnl = snapshot.positionsHistory.reduce((s, r) => s + (parseFloat(r.pnl) || 0), 0);

    console.log('Kraken overlap-window:', {
      csvWindowStart: new Date(snapStart).toISOString().slice(0, 10),
      csvOverlapCloses: usdCloses.length,
      snapPositions: snapshot.positionsHistory.length,
      csvSumPnl: +csvSumPnl.toFixed(4),
      snapSumPnl: +snapSumPnl.toFixed(4),
      pnlDrift: +(csvSumPnl - snapSumPnl).toFixed(4),
    });

    // Tolerantie $5: drift door boundary-fills + sub-fill aggregatie verschillen
    expect(Math.abs(csvSumPnl - snapSumPnl)).toBeLessThan(5);
  });

  test('C: Σ fee in overlap — CSV ≈ snapshot binnen 30% relatief', async () => {
    const snapDates = snapshot.positionsHistory.map(r => new Date(r.fillTime).getTime()).filter(t => t > 0);
    const snapStart = Math.min(...snapDates);

    const usdCloses = csvRows.filter(r =>
      r.type === 'futures trade' &&
      r.symbol === 'usd' &&
      parseFloat(r['realized pnl']) !== 0 &&
      new Date(r.dateTime).getTime() >= snapStart
    );

    const csvSumFee = usdCloses.reduce((s, r) => s + Math.abs(parseFloat(r.fee) || 0), 0);
    const snapSumFee = snapshot.positionsHistory.reduce((s, r) => s + Math.abs(parseFloat(r.fee) || 0), 0);

    // 30% tolerantie: Kraken's accountlogs registreert fees per fill (incl. opens),
    // snapshot heeft alleen close-positie fees → verschil verwacht maar bounded.
    const drift = Math.abs(csvSumFee - snapSumFee);
    const driftPct = drift / Math.max(csvSumFee, snapSumFee);
    expect(driftPct).toBeLessThan(0.30);
  });

  test('D: parser-output trade-count = snapshot.length', async ({ page }) => {
    await page.goto(FILE_URL);
    const result = await page.evaluate((snap) => {
      const filtered = snap.positionsHistory.filter(t =>
        t.pair_clean || t.symbol || t.direction
      );
      const trades = filtered.map(t => ExchangeAPI.kraken._normalise(t));
      return { count: trades.length };
    }, snapshot);
    expect(result.count).toBe(snapshot.positionsHistory.length);
  });
});
