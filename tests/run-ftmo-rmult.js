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
// v12.196: óók de helper computeFtmoMedianLoserSlPct extracten
const helperStart = html.indexOf("function computeFtmoMedianLoserSlPct(trades){");
const rMultStart = html.indexOf("function calcRMultiple(trade,ftmoCtx){");
const rMultEnd = html.indexOf("\n}", rMultStart) + 2;
const code = html.slice(helperStart, rMultEnd);

const ctx = { console };
vm.createContext(ctx);
vm.runInContext(code + "\nthis.calcRMultiple=calcRMultiple;\nthis.computeFtmoMedianLoserSlPct=computeFtmoMedianLoserSlPct;", ctx);

let failed = 0;
function assert(cond, msg) {
  if (!cond) { console.error("  ✗", msg); failed++; }
  else { console.log("  ✓", msg); }
}
function approx(a, b, tol = 0.05) {
  return Math.abs(a - b) <= tol;
}

console.log("[calcRMultiple — FTMO source met realistic SL]");
{
  // Loser met SL geraakt op 0.4% afstand. dpp = 50/300=0.1667. risk = 300×0.1667=50. R=-1.
  const t = { source: "ftmo", entry: "73000", exit: "73300", stopLoss: "73300", pnl: "-50", direction: "short" };
  const r = ctx.calcRMultiple(t);
  assert(r !== null && approx(r, -1, 0.05), `loser SL-hit R ≈ -1 (got ${r?.toFixed(2)})`);
}
{
  // XAUUSD TP1: entry 2018.50, sl 2014.50 (4 pt = 0.2% > 0.1%), exit 2022, pnl +87.50
  // dpp = 87.50/3.5 = 25. risk = 4×25 = 100. R = +0.875
  const t = { source: "ftmo", entry: "2018.50", exit: "2022.00", stopLoss: "2014.50", pnl: "87.50" };
  const r = ctx.calcRMultiple(t);
  assert(r !== null && approx(r, 0.875, 0.01), `XAUUSD TP1 (realistic SL) R ≈ +0.875 (got ${r?.toFixed(3)})`);
}
{
  // BTC short winner met REALISTIC SL: entry 73894, sl 74400 (506 pt = 0.68% > 0.1%), exit 63375, pnl +289.76
  // dpp = 289.76/10519 = 0.02755. risk = 506 × 0.02755 = 13.94. R = +20.8
  const t = { source: "ftmo", entry: "73894.30", exit: "63375.80", stopLoss: "74400", pnl: "289.76" };
  const r = ctx.calcRMultiple(t);
  assert(r !== null && approx(r, 20.8, 0.5), `BTC big winner met realistic SL R ≈ +20.8 (got ${r?.toFixed(2)})`);
}
{
  // EURUSD met realistic SL 10 pips (0.092% van 1.08240 = onder 0.1% drempel → fallback default)
  // Met fallback 0.4%: slDistance = 1.08240 × 0.004 = 0.004330
  // dpp = 85/0.0017 = 50000. risk = 0.00433 × 50000 = 216.5. R = +0.39
  // Voor 1.7R verwachting moet SL > 0.1% staan: gebruik sl 1.075 (0.68% afstand)
  const t = { source: "ftmo", entry: "1.08240", exit: "1.08410", stopLoss: "1.07500", pnl: "85" };
  const r = ctx.calcRMultiple(t);
  // dpp = 85/0.0017 = 50000. risk = 0.00740 × 50000 = 370. R = +0.23
  assert(r !== null && approx(r, 0.23, 0.05), `EURUSD met 0.68% SL R ≈ +0.23 (got ${r?.toFixed(2)})`);
}
{
  // Edge: open trade (geen exit) → null
  const t = { source: "ftmo", entry: "73000", exit: "", stopLoss: "72800", pnl: "" };
  assert(ctx.calcRMultiple(t) === null, "geen exit → null");
}
{
  // Edge: break-even (exit = entry) → null
  const t = { source: "ftmo", entry: "73000", exit: "73000", stopLoss: "72800", pnl: "0" };
  assert(ctx.calcRMultiple(t) === null, "exit == entry → null");
}
{
  // v12.201: FTMO trade ZONDER SL — fallback op mediaan/0.4% i.p.v. null
  // Denny's BTC short: entry 77659, exit 77787 (verlies), pnl -19.62, geen SL
  // Met fallback 0.4%: slDistance = 77659 × 0.004 = 310.6
  // dpp = 19.62/127.83 ≈ 0.1535. risk = 310.6 × 0.1535 = $47.68. R = -19.62/47.68 ≈ -0.41
  const t = { source: "ftmo", entry: "77659.01", exit: "77786.84", stopLoss: "", pnl: "-19.62" };
  const r = ctx.calcRMultiple(t);
  assert(r !== null && approx(r, -0.41, 0.05), `FTMO loser zonder SL R ≈ -0.41 (fallback) (got ${r?.toFixed(2)})`);
}
{
  // FTMO winner zonder SL — entry 79086.86, exit 77195.77, pnl +166.57
  // dpp = 166.57/1891.09 ≈ 0.0881. slDistance fallback = 79086.86 × 0.004 = 316.35
  // riskDollars = 316.35 × 0.0881 = 27.87. R = +5.98
  const t = { source: "ftmo", entry: "79086.86", exit: "77195.77", stopLoss: "", pnl: "166.57" };
  const r = ctx.calcRMultiple(t);
  assert(r !== null && approx(r, 5.98, 0.1), `FTMO winner zonder SL R ≈ +5.98 (fallback) (got ${r?.toFixed(2)})`);
}
{
  // Crypto BLIJFT null als SL ontbreekt (linear formule heeft SL nodig)
  const t = { source: "blofin", entry: "73000", exit: "73500", stopLoss: "", pnl: "100", positionSize: "7300" };
  assert(ctx.calcRMultiple(t) === null, "crypto zonder SL → null (geen fallback voor linear)");
}

console.log("\n[v12.196 — getrailede SL valt terug op mediaan-loser-SL%]");
{
  // Bouw een dataset met 3 losers (initial SL = 0.4% van entry) + 1 winner met getrailede SL (0.01%)
  const trades = [
    // 3 losers, allemaal SL geraakt op 0.4% afstand
    { source: "ftmo", entry: "73000", stopLoss: "73292", exit: "73292", pnl: "-40", direction: "short" },
    { source: "ftmo", entry: "74000", stopLoss: "74296", exit: "74296", pnl: "-40", direction: "short" },
    { source: "ftmo", entry: "75000", stopLoss: "75300", exit: "75300", pnl: "-40", direction: "short" },
  ];
  const medianPct = ctx.computeFtmoMedianLoserSlPct(trades);
  // Verwacht ~0.004 (0.4%)
  assert(medianPct !== null && approx(medianPct, 0.004, 0.0001), `mediaan loser SL% ≈ 0.4% (got ${(medianPct*100).toFixed(3)}%)`);

  // Winner met getrailede SL (0.01% afstand) — moet fallback gebruiken op mediaan
  const winner = { source: "ftmo", entry: "73894", stopLoss: "73901", exit: "59987", pnl: "545.61", direction: "short" };
  const rWithCtx = ctx.calcRMultiple(winner, { medianLoserSlPct: medianPct });
  // Met mediaan 0.004: slDistance = 73894 × 0.004 = 295.58, dpp = 545.61/13907 = 0.0392
  // riskDollars = 295.58 × 0.0392 = 11.59. R = 545.61/11.59 ≈ +47R
  assert(rWithCtx !== null && approx(rWithCtx, 47, 2), `winner met trail-SL + mediaan-fallback R ≈ +47 (got ${rWithCtx?.toFixed(1)})`);

  // Zonder ftmoCtx: fallback naar 0.4% default — zelfde resultaat
  const rNoCtx = ctx.calcRMultiple(winner);
  assert(rNoCtx !== null && approx(rNoCtx, 47, 2), `winner zonder ctx valt terug op default 0.4% R ≈ +47 (got ${rNoCtx?.toFixed(1)})`);

  // Verlies trade met realistic SL: blijft werken zoals voorheen
  const loser = trades[0]; // entry 73000, sl 73292, exit 73292, pnl -40
  const rLoser = ctx.calcRMultiple(loser, { medianLoserSlPct: medianPct });
  assert(rLoser !== null && approx(rLoser, -1, 0.05), `loser met realistic SL R ≈ -1 (got ${rLoser?.toFixed(2)})`);
}
{
  // Edge: <3 losers → mediaan = null
  const trades = [
    { source: "ftmo", entry: "73000", stopLoss: "73300", exit: "73300", pnl: "-40", direction: "short" },
  ];
  const m = ctx.computeFtmoMedianLoserSlPct(trades);
  assert(m === null, "< 3 losers → mediaan null");
}
{
  // Edge: alleen winners → mediaan null
  const trades = [
    { source: "ftmo", entry: "73000", stopLoss: "73005", exit: "60000", pnl: "500", direction: "short" },
  ];
  const m = ctx.computeFtmoMedianLoserSlPct(trades);
  assert(m === null, "alleen winners → mediaan null");
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
