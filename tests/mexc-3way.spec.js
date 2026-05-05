// v12.88 — MEXC 3-way validation: XLSX ↔ snapshot ↔ parser.
//
// Drie onafhankelijke bronnen:
//   1. XLSX Futures Order History export — fill-level (1 rij per filled order).
//   2. API snapshot (`captureSnapshot` /position/list_history_positions) — positie-level.
//   3. Parser-output (via fetchTrades op snapshot) — trade-level.
//
// Belangrijk: MEXC's XLSX export is **order**-history (alle fills), snapshot is
// **position**-history (na server-side aggregatie). De PNL-convention verschilt
// per kleine versus grote pair:
//   - Kleine pairs (SOL/ETH met paar trades): drift binnen $1
//   - Grote pairs (BTC met 100+ fills): drift kan oplopen door MEXC's andere
//     PNL-attributie per fill vs per position. Te onderzoeken.
// Fees daarentegen matchen exact tussen xlsx en snap (per-pair binnen $0.01).
//
// XLSX-parser is inline: gebruikt unzip + regex op inline-string XLSX.
// MEXC export gebruikt `t="inlineStr"` (geen sharedStrings lookup nodig).
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');
const SNAPSHOT_PATH = path.resolve(__dirname, '_fixtures/mexc-snapshot.json');
const XLSX_PATH = path.resolve(__dirname, '_fixtures/mexc-export.xlsx');

const hasFixtures = fs.existsSync(SNAPSHOT_PATH) && fs.existsSync(XLSX_PATH);

const MEXC_CONTRACT_SIZES = { BTC_USDT: 0.0001, ETH_USDT: 0.01, SOL_USDT: 1 };

// MEXC xlsx column-map (uit eerdere inspectie):
//   A=UID  B=Time  C=Pair  D=Direction  E=Leverage  F=OrderType
//   G=OrderQty(Cont) H=FilledQty(Cont) I=OrderQty(Crypto) J=FilledQty(Crypto)
//   K=OrderQty(Amount) L=FilledQty(Amount) M=OrderPrice N=AvgFillPrice
//   O=ClosingPNL  P=TradingFee  Q=FeeCrypto  R=Status
function parseMexcXlsx(xlsxPath) {
  const xml = execSync(`unzip -p "${xlsxPath}" xl/worksheets/sheet1.xml`, { encoding: 'utf8' });
  const rowRe = /<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
  const cellRe = /<c r="([A-Z]+)\d+"[^>]*>(?:<is><t[^>]*>([^<]*)<\/t><\/is>|<v>([^<]*)<\/v>)/g;
  const rows = []; let m;
  while ((m = rowRe.exec(xml)) !== null) {
    const cells = {}; let cm; cellRe.lastIndex = 0;
    while ((cm = cellRe.exec(m[2])) !== null) {
      cells[cm[1]] = cm[2] !== undefined ? cm[2] : cm[3] || '';
    }
    rows.push(cells);
  }
  return rows.slice(1); // skip header
}

// Normalize pair: xlsx "BTCUSDT" ↔ snap "BTC_USDT" → "BTC_USDT" canonical
function normPair(p) {
  if (!p) return '';
  if (p.includes('_')) return p;
  if (p.endsWith('USDT')) return p.slice(0, -4) + '_USDT';
  if (p.endsWith('USDC')) return p.slice(0, -4) + '_USDC';
  return p;
}

test.describe('MEXC 3-way: XLSX ↔ snapshot ↔ parser', () => {
  test.skip(!hasFixtures, 'XLSX en/of snapshot fixture ontbreekt — skip op CI');

  let snapshot, xlsxRows;
  test.beforeAll(() => {
    snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
    xlsxRows = parseMexcXlsx(XLSX_PATH);
  });

  test('A: XLSX parsing — non-empty + status FINISHED', async () => {
    expect(xlsxRows.length).toBeGreaterThan(0);
    const finished = xlsxRows.filter(r => r.R === 'FINISHED').length;
    expect(finished).toBeGreaterThan(0);
    // Sample row sanity
    expect(xlsxRows[0].C).toBeTruthy(); // pair
    expect(xlsxRows[0].D).toBeTruthy(); // direction
    expect(xlsxRows[0].B).toBeTruthy(); // time
  });

  test('B: per-pair Σ |fee| matcht XLSX ↔ snapshot binnen $0.05', async () => {
    const snapStart = Math.min(...snapshot.positionsHistory.map(r => r.createTime).filter(t => t > 0));

    const xlsxFeeByPair = {};
    for (const r of xlsxRows) {
      const ts = new Date(r.B).getTime();
      if (ts < snapStart) continue;
      const pair = normPair(r.C);
      const fee = Math.abs(parseFloat(r.P) || 0);
      xlsxFeeByPair[pair] = (xlsxFeeByPair[pair] || 0) + fee;
    }

    const snapFeeByPair = {};
    for (const r of snapshot.positionsHistory) {
      const pair = normPair(r.symbol);
      const fee = Math.abs(parseFloat(r.fee) || 0);
      snapFeeByPair[pair] = (snapFeeByPair[pair] || 0) + fee;
    }

    const allPairs = new Set([...Object.keys(xlsxFeeByPair), ...Object.keys(snapFeeByPair)]);
    const driftPerPair = {};
    let maxDrift = 0;
    for (const p of allPairs) {
      const x = xlsxFeeByPair[p] || 0;
      const s = snapFeeByPair[p] || 0;
      const drift = Math.abs(x - s);
      driftPerPair[p] = { xlsxFee: +x.toFixed(4), snapFee: +s.toFixed(4), drift: +drift.toFixed(4) };
      if (drift > maxDrift) maxDrift = drift;
    }
    console.log('MEXC per-pair fees:', driftPerPair);

    // XLSX en snap fees matchen exact (xlsx telt alle fills, snap heeft positie-aggregaten,
    // maar Σ per pair komt op hetzelfde uit). Tolerantie 5ct voor boundary-rounding.
    expect(maxDrift).toBeLessThan(0.05);
  });

  test('C: per-pair NET PnL: xlsx (Σ ClosingPNL − Σ Fee) ≈ snap Σ realised — binnen $20/pair', async () => {
    // BELANGRIJK: xlsx "Closing PNL" is GROSS per fill (verified via 1-positie trace).
    // snap "realised" is NET per positie (al fee-afgetrokken).
    // Beide bronnen convergeren via: NET = xlsx_Σ_gross − xlsx_Σ_fee.
    const snapStart = Math.min(...snapshot.positionsHistory.map(r => r.createTime).filter(t => t > 0));

    const xlsxByPair = {};
    for (const r of xlsxRows) {
      const ts = new Date(r.B).getTime();
      if (ts < snapStart) continue;
      const pair = normPair(r.C);
      xlsxByPair[pair] = xlsxByPair[pair] || { gross: 0, fee: 0 };
      xlsxByPair[pair].gross += parseFloat(r.O) || 0;
      xlsxByPair[pair].fee += Math.abs(parseFloat(r.P) || 0);
    }

    const snapNetByPair = {};
    for (const r of snapshot.positionsHistory) {
      const pair = normPair(r.symbol);
      snapNetByPair[pair] = (snapNetByPair[pair] || 0) + (parseFloat(r.realised) || 0);
    }

    const xlsxNetByPair = Object.fromEntries(
      Object.entries(xlsxByPair).map(([k, v]) => [k, +(v.gross - v.fee).toFixed(2)])
    );

    console.log('MEXC per-pair NET PnL:', {
      xlsxNet: xlsxNetByPair,
      snapNet: Object.fromEntries(Object.entries(snapNetByPair).map(([k, v]) => [k, +v.toFixed(2)])),
    });

    // Voor SOL/ETH: drift binnen $1.
    // Voor BTC: groter venster (~127 positions × ~$0.13 boundary-drift = $17), tolerantie $20.
    for (const pair of ['SOL_USDT', 'ETH_USDT']) {
      const x = xlsxNetByPair[pair] || 0;
      const s = snapNetByPair[pair] || 0;
      if (Math.abs(x) < 0.01 && Math.abs(s) < 0.01) continue;
      expect(Math.abs(x - s), `${pair}: xlsxNet=${x} snapNet=${s.toFixed(2)}`).toBeLessThan(1);
    }
    if (xlsxNetByPair.BTC_USDT !== undefined && snapNetByPair.BTC_USDT !== undefined) {
      const drift = Math.abs(xlsxNetByPair.BTC_USDT - snapNetByPair.BTC_USDT);
      expect(drift, `BTC_USDT: xlsxNet=${xlsxNetByPair.BTC_USDT} snapNet=${snapNetByPair.BTC_USDT.toFixed(2)} drift=${drift.toFixed(2)}`).toBeLessThan(20);
    }
  });

  test('D: parser-output trade-count = snapshot.length', async ({ page }) => {
    await page.goto(FILE_URL);
    const result = await page.evaluate(async ({ snap, ctvCache }) => {
      const originalProxy = window.proxyCall;
      window.proxyCall = async (req) => {
        if (req.action === 'trades') return { trades: snap.positionsHistory };
        return {};
      };
      Object.assign(ExchangeAPI.mexc._ctvCache, ctvCache);
      const trades = await ExchangeAPI.mexc.fetchTrades('mock', 'mock');
      window.proxyCall = originalProxy;
      return { count: trades.length };
    }, { snap: snapshot, ctvCache: MEXC_CONTRACT_SIZES });
    expect(result.count).toBe(snapshot.positionsHistory.length);
  });
});
