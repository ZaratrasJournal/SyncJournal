// v12.194: Test calcRMultiple voor FTMO/MT5 lot-based trades.
// De v12.190 crypto-formule (riskUsdt = risk × size / entry) levert onzin voor FTMO
// (positionSize leeg → fallback size=1 → riskUsdt ≈ 0 → R = miljoenen).
// Nieuwe formule: leid dollars-per-point af uit pnl/price-move van de trade.
//
// Run: node tests/run-ftmo-rmult.js

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const html = fs.readFileSync(path.resolve(__dirname, "..", "work", "tradejournal.html"), "utf8");
const startIdx = html.indexOf("function calcRMultiple(trade){");
const endIdx = html.indexOf("\n}", startIdx) + 2;
const code = html.slice(startIdx, endIdx);

const ctx = { console };
vm.createContext(ctx);
vm.runInContext(code + "\nthis.calcRMultiple=calcRMultiple;", ctx);

let failed = 0;
function assert(cond, msg) {
  if (!cond) { console.error("  ✗", msg); failed++; }
  else { console.log("  ✓", msg); }
}
function approx(a, b, tol = 0.05) {
  return Math.abs(a - b) <= tol;
}

console.log("[calcRMultiple — FTMO source]");
{
  // Denny's BTC/USD short trade: entry 73895.95, exit 73897.02, pnl -1.96
  // Realistische SL: 73900 (4.05 points risk)
  // dollarsPerPoint = |-1.96| / |73897.02-73895.95| = 1.96/1.07 ≈ 1.832
  // riskDollars = |73895.95-73900| × 1.832 = 4.05 × 1.832 ≈ 7.42
  // R = -1.96 / 7.42 ≈ -0.26
  const t = { source: "ftmo", entry: "73895.95", exit: "73897.02", stopLoss: "73900", pnl: "-1.96" };
  const r = ctx.calcRMultiple(t);
  assert(r !== null && approx(r, -0.26, 0.05), `BTC/USD short losing trade R ≈ -0.26 (got ${r?.toFixed(2)})`);
}
{
  // BTC/USD short winning: entry 73894.30, exit 63375.80 (10518 points), pnl +289.76
  // SL aanname 74400 (505.70 points risk)
  // dollarsPerPoint = 289.76 / 10518.50 ≈ 0.02755
  // riskDollars = 505.70 × 0.02755 ≈ 13.93
  // R = 289.76 / 13.93 ≈ 20.80
  const t = { source: "ftmo", entry: "73894.30", exit: "63375.80", stopLoss: "74400", pnl: "289.76" };
  const r = ctx.calcRMultiple(t);
  assert(r !== null && approx(r, 20.8, 0.5), `BTC short big winner R ≈ +20.8 (got ${r?.toFixed(2)})`);
}
{
  // XAUUSD long: entry 2018.50, exit 2022.00, SL 2014.50, pnl +87.50, size 0.5 lot
  // dollarsPerPoint = 87.50/3.50 = 25
  // riskDollars = 4.00 × 25 = 100
  // R = 87.50 / 100 = +0.875
  const t = { source: "ftmo", entry: "2018.50", exit: "2022.00", stopLoss: "2014.50", pnl: "87.50" };
  const r = ctx.calcRMultiple(t);
  assert(r !== null && approx(r, 0.875, 0.01), `XAUUSD TP1 R ≈ +0.875 (got ${r?.toFixed(3)})`);
}
{
  // EURUSD long: entry 1.08240, exit 1.08410 (17 pips), SL 1.08140 (10 pip risk), pnl +85
  // dollarsPerPoint = 85 / 0.0017 = 50000
  // riskDollars = 0.001 × 50000 = 50
  // R = 85 / 50 = +1.7
  const t = { source: "ftmo", entry: "1.08240", exit: "1.08410", stopLoss: "1.08140", pnl: "85" };
  const r = ctx.calcRMultiple(t);
  assert(r !== null && approx(r, 1.7, 0.05), `EURUSD R ≈ +1.7 (got ${r?.toFixed(2)})`);
}
{
  // Edge: open trade (geen exit) → null
  const t = { source: "ftmo", entry: "73000", exit: "", stopLoss: "72800", pnl: "" };
  assert(ctx.calcRMultiple(t) === null, "geen exit → null");
}
{
  // Edge: break-even (exit = entry) → null (geen price-move om dollarsPerPoint te derive)
  const t = { source: "ftmo", entry: "73000", exit: "73000", stopLoss: "72800", pnl: "0" };
  assert(ctx.calcRMultiple(t) === null, "exit == entry → null");
}
{
  // Edge: geen SL → null (al pre-existing pad)
  const t = { source: "ftmo", entry: "73000", exit: "73500", stopLoss: "", pnl: "100" };
  assert(ctx.calcRMultiple(t) === null, "geen SL → null");
}

console.log("\n[calcRMultiple — crypto source blijft werken]");
{
  // Blofin BTC long: entry 68000, exit 68500, SL 67800 (200 risk), positionSize 6800 (USDT), pnl +50
  // risk = 200, riskUsdt = 200 × 6800 / 68000 = 20
  // R = 50 / 20 = +2.5
  const t = { source: "blofin", entry: "68000", exit: "68500", stopLoss: "67800", positionSize: "6800", pnl: "50" };
  const r = ctx.calcRMultiple(t);
  assert(r !== null && approx(r, 2.5, 0.01), `Blofin BTC R ≈ +2.5 (got ${r?.toFixed(2)})`);
}
{
  // Crypto met positionSize leeg → fallback ||1 (oude gedrag behouden voor backwards-compat)
  // Geen bedoeling om dit te fixen — crypto-trades hebben altijd positionSize bij API-import.
  const t = { source: "blofin", entry: "68000", exit: "68500", stopLoss: "67800", positionSize: "", pnl: "50" };
  const r = ctx.calcRMultiple(t);
  assert(r !== null, "crypto met lege size geeft nog steeds een waarde (legacy)");
}

console.log("\n" + (failed === 0 ? "✓ All FTMO R-mult tests pass" : `✗ ${failed} assertion(s) failed`));
process.exit(failed === 0 ? 0 : 1);
