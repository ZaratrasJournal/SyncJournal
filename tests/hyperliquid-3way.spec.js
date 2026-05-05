// v12.88 — Hyperliquid 3-way validation: CSV ↔ snapshot ↔ parser.
//
// Drie onafhankelijke bronnen kruisvalideren:
//   1. CSV export (web-portfolio download) — fill-level, server-side sub-fill aggregated.
//   2. API snapshot (`captureSnapshot`) — fill-level, sub-fills 1-op-1 zoals API teruggeeft.
//   3. Parser-output (`_reconstructTrades`) — trade-level, na FIFO-matching.
//
// Verifieert:
//   A. CSV en snapshot leveren identieke data (na sub-fill aggregatie).
//   B. CSV's `closedPnl` (gross − close_fee) → API's `closedPnl` (gross) exact (na |fee| optellen).
//   C. Parser-output op CSV-input ≡ parser-output op snapshot-input (zelfde count + sums).
//
// Skipt automatisch als CSV of snapshot ontbreekt.
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');
const SNAPSHOT_PATH = path.resolve(__dirname, '_fixtures/hyperliquid-snapshot.json');
const CSV_PATH = path.resolve(__dirname, '_fixtures/hyperliquid-export.csv');

const hasFixtures = fs.existsSync(SNAPSHOT_PATH) && fs.existsSync(CSV_PATH);

// CSV-row → fill in API-shape. Spiegelt de logica in [work/tradejournal.html:10285-10306].
function parseCsvFills(csvText) {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim());
  const parseHLDateMs = (s) => {
    const m = String(s || '').match(/^(\d{1,2})-(\d{1,2})-(\d{4})\s*-\s*(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return 0;
    return new Date(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}T${m[4]}:${m[5]}:${m[6] || '00'}`).getTime();
  };
  const fills = [];
  for (let i = 1; i < lines.length; i++) {
    const v = lines[i].split(',').map(x => x.replace(/"/g, '').trim());
    if (v.length < 8) continue;
    const feeVal = Math.abs(parseFloat(v[6]) || 0);
    // Normaliseer CSV's closedPnl (gross − close_fee) naar API-stijl (gross): + |fee|.
    const pnlNorm = String((parseFloat(v[7]) || 0) + feeVal);
    fills.push({
      coin: v[1],
      dir: v[2],
      px: v[3],
      sz: v[4],
      fee: v[6],
      closedPnl: pnlNorm,
      ms: parseHLDateMs(v[0]),
    });
  }
  return fills;
}

// Coin-naam normaliseren: spot-tokens worden anders getoond in CSV vs API.
//   API: "xyz:GOLD" → CSV: "GOLD (xyz)" — refer to same instrument.
function normalizeCoin(coin) {
  if (!coin) return '';
  const m = String(coin).match(/^(\w+)\s*\((\w+)\)$/);
  if (m) return m[2] + ':' + m[1]; // "GOLD (xyz)" → "xyz:GOLD"
  return coin;
}

// Aggregate fills per (sec-bucket, coin, dir) — neutraliseert sub-fill-aggregatie verschillen.
function aggregateFills(fills) {
  const m = new Map();
  for (const f of fills) {
    const sec = Math.floor((Number(f.ms) || Number(f.time) || 0) / 1000);
    const coin = normalizeCoin(f.coin);
    const k = sec + '|' + coin + '|' + f.dir;
    const cur = m.get(k) || { sec, coin, dir: f.dir, sz: 0, fee: 0, closedPnl: 0, count: 0 };
    cur.sz += Math.abs(parseFloat(f.sz) || 0);
    cur.fee += Math.abs(parseFloat(f.fee) || 0);
    cur.closedPnl += parseFloat(f.closedPnl) || 0;
    cur.count++;
    m.set(k, cur);
  }
  return m;
}

test.describe('Hyperliquid 3-way: CSV ↔ snapshot ↔ parser', () => {
  test.skip(!hasFixtures, 'CSV en/of snapshot fixture ontbreekt — skip op CI');

  let snapshot, csvFills;
  test.beforeAll(() => {
    snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
    csvFills = parseCsvFills(fs.readFileSync(CSV_PATH, 'utf8'));
  });

  test('A1: CSV-fills en snapshot-fills hebben identieke (sec,coin,dir)-aggregaten', async () => {
    const csvAgg = aggregateFills(csvFills);
    const snapAgg = aggregateFills(snapshot.positionsHistory);

    // Aantal unieke groepen moet matchen
    expect(csvAgg.size).toBe(snapAgg.size);

    // Per-groep: sz + fee + closedPnl moet binnen 0.0001 matchen
    let szDriftMax = 0, feeDriftMax = 0, pnlDriftMax = 0;
    let unmatched = [];
    for (const [k, c] of csvAgg) {
      const s = snapAgg.get(k);
      if (!s) { unmatched.push(k); continue; }
      szDriftMax = Math.max(szDriftMax, Math.abs(c.sz - s.sz));
      feeDriftMax = Math.max(feeDriftMax, Math.abs(c.fee - s.fee));
      pnlDriftMax = Math.max(pnlDriftMax, Math.abs(c.closedPnl - s.closedPnl));
    }
    expect(unmatched).toEqual([]);
    expect(szDriftMax).toBeLessThan(0.0001);
    expect(feeDriftMax).toBeLessThan(0.0001);
    expect(pnlDriftMax).toBeLessThan(0.0001);
  });

  test('A2: Σ fees en Σ closedPnl (na CSV→API normalisatie) matchen exact', async () => {
    const sumCsvFee = csvFills.reduce((s, f) => s + Math.abs(parseFloat(f.fee) || 0), 0);
    const sumSnapFee = snapshot.positionsHistory.reduce((s, f) => s + Math.abs(parseFloat(f.fee) || 0), 0);
    expect(Math.abs(sumCsvFee - sumSnapFee)).toBeLessThan(0.0001);

    const sumCsvPnl = csvFills.reduce((s, f) => s + (parseFloat(f.closedPnl) || 0), 0);
    const sumSnapPnl = snapshot.positionsHistory.reduce((s, f) => s + (parseFloat(f.closedPnl) || 0), 0);
    expect(Math.abs(sumCsvPnl - sumSnapPnl)).toBeLessThan(0.0001);

    console.log('Hyperliquid 3-way aggregaten:', {
      csvFills: csvFills.length,
      snapFills: snapshot.positionsHistory.length,
      sumFee: +sumCsvFee.toFixed(4),
      sumGrossPnl: +sumCsvPnl.toFixed(4),
    });
  });

  test('B: parser produceert identieke trade-output op CSV-fills vs snapshot-fills', async ({ page }) => {
    await page.goto(FILE_URL);

    const result = await page.evaluate(({ csvFills, snapFills }) => {
      const fromCsv = ExchangeAPI.hyperliquid._reconstructTrades(csvFills, 'hyperliquid_csv');
      const fromApi = ExchangeAPI.hyperliquid._reconstructTrades(
        snapFills.map(f => ({
          coin: f.coin, dir: f.dir, px: f.px, sz: f.sz,
          fee: f.fee, closedPnl: f.closedPnl,
          ms: Number(f.time) || 0, tid: f.tid,
        })),
        'hyperliquid'
      );
      const sumOf = (trades) => ({
        count: trades.length,
        sumPnl: +trades.reduce((s, t) => s + (parseFloat(t.pnl) || 0), 0).toFixed(4),
        sumFees: +trades.reduce((s, t) => s + (parseFloat(t.fees) || 0), 0).toFixed(4),
      });
      return { csv: sumOf(fromCsv), api: sumOf(fromApi) };
    }, { csvFills, snapFills: snapshot.positionsHistory });

    console.log('Parser-output 3-way:', result);

    // Trade-count moet identiek zijn (dezelfde fills, dezelfde FIFO).
    expect(result.csv.count).toBe(result.api.count);
    // Net-PnL en fees mogen ≤ 0.01 verschillen (rounding op fee-share).
    expect(Math.abs(result.csv.sumPnl - result.api.sumPnl)).toBeLessThan(0.01);
    expect(Math.abs(result.csv.sumFees - result.api.sumFees)).toBeLessThan(0.01);
  });
});
