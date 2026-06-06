// v12.202: Test getLayerTimeframeGroup + getLayerColor — pure helpers.
//
// Run: node tests/run-layer-color.js

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const html = fs.readFileSync(path.resolve(__dirname, "..", "work", "tradejournal.html"), "utf8");
// v12.203: range-based parser i.p.v. whitelist — extract parseTimeframeMinutes + TF_CUTOFFS + groups + color
// v12.204: óók getLayerCardTint + getBiasIcon + getBiasColor (eindigt na getBiasColor)
const startIdx = html.indexOf("function parseTimeframeMinutes(");
const endIdx = html.indexOf("\n}", html.indexOf("function getBiasColor")) + 2;
const code = html.slice(startIdx, endIdx);

const ctx = { console };
vm.createContext(ctx);
vm.runInContext(code.replace(/^const /gm, "var ") + "\nthis.parseTimeframeMinutes=parseTimeframeMinutes;this.getLayerTimeframeGroup=getLayerTimeframeGroup;this.getLayerColor=getLayerColor;this.getLayerCardTint=getLayerCardTint;this.getBiasIcon=getBiasIcon;this.getBiasColor=getBiasColor;this.TF_CUTOFFS=TF_CUTOFFS;", ctx);

let failed = 0;
function assert(cond, msg) {
  if (!cond) { console.error("  ✗", msg); failed++; }
  else { console.log("  ✓", msg); }
}

console.log("[parseTimeframeMinutes]");
{
  assert(ctx.parseTimeframeMinutes("1m") === 1, "1m → 1");
  assert(ctx.parseTimeframeMinutes("5M") === 5, "5M → 5");
  assert(ctx.parseTimeframeMinutes("15min") === 15, "15min → 15");
  assert(ctx.parseTimeframeMinutes("30 min") === 30, "'30 min' → 30");
  assert(ctx.parseTimeframeMinutes("1h") === 60, "1h → 60");
  assert(ctx.parseTimeframeMinutes("2H") === 120, "2H → 120");
  assert(ctx.parseTimeframeMinutes("4h") === 240, "4h → 240");
  assert(ctx.parseTimeframeMinutes("1d") === 1440, "1d → 1440");
  assert(ctx.parseTimeframeMinutes("Daily") === 1440, "Daily → 1440");
  assert(ctx.parseTimeframeMinutes("1w") === 10080, "1w → 10080");
  assert(ctx.parseTimeframeMinutes("Weekly") === 10080, "Weekly → 10080");
  assert(ctx.parseTimeframeMinutes("") === null, "empty → null");
  assert(ctx.parseTimeframeMinutes(null) === null, "null → null");
  assert(ctx.parseTimeframeMinutes("hallo") === null, "garbage → null");
}

console.log("\n[getLayerTimeframeGroup — range-based]");
{
  // HTF (≥3h = 180 min)
  assert(ctx.getLayerTimeframeGroup("Daily") === "HTF", "Daily → HTF");
  assert(ctx.getLayerTimeframeGroup("1D") === "HTF", "1D → HTF");
  assert(ctx.getLayerTimeframeGroup("12H") === "HTF", "12H → HTF");
  assert(ctx.getLayerTimeframeGroup("4H") === "HTF", "4H → HTF");
  assert(ctx.getLayerTimeframeGroup("3H") === "HTF", "3H → HTF (boundary)");
  assert(ctx.getLayerTimeframeGroup("1W") === "HTF", "1W → HTF");
  // MTF (16-179 min)
  assert(ctx.getLayerTimeframeGroup("1H") === "MTF", "1H → MTF");
  assert(ctx.getLayerTimeframeGroup("2H") === "MTF", "2H → MTF (Denny's case)");
  assert(ctx.getLayerTimeframeGroup("90M") === "MTF", "90M → MTF (custom)");
  assert(ctx.getLayerTimeframeGroup("45M") === "MTF", "45M → MTF (custom)");
  assert(ctx.getLayerTimeframeGroup("30M") === "MTF", "30M → MTF");
  // LTF (≤15 min) — v12.208: 15M valt nu onder LTF (Denny's wens)
  assert(ctx.getLayerTimeframeGroup("15M") === "LTF", "15M → LTF (v12.208 wijziging)");
  assert(ctx.getLayerTimeframeGroup("10M") === "LTF", "10M → LTF");
  assert(ctx.getLayerTimeframeGroup("5M") === "LTF", "5M → LTF");
  assert(ctx.getLayerTimeframeGroup("1M") === "LTF", "1M → LTF");
  // Edge cases
  assert(ctx.getLayerTimeframeGroup("") === "OTHER", "empty → OTHER");
  assert(ctx.getLayerTimeframeGroup(null) === "OTHER", "null → OTHER");
  assert(ctx.getLayerTimeframeGroup(undefined) === "OTHER", "undefined → OTHER");
  assert(ctx.getLayerTimeframeGroup("Unknown") === "OTHER", "garbage → OTHER");
  // Case-insensitive
  assert(ctx.getLayerTimeframeGroup("1h") === "MTF", "1h (lowercase) → MTF");
  assert(ctx.getLayerTimeframeGroup("daily") === "HTF", "daily (lowercase) → HTF");
  // Whitespace-insensitive
  assert(ctx.getLayerTimeframeGroup(" 5M ") === "LTF", "' 5M ' (whitespace) → LTF");
}

console.log("\n[getLayerColor]");
{
  assert(ctx.getLayerColor({ timeframe: "Daily" }) === "var(--layer-htf)", "Daily → var(--layer-htf)");
  assert(ctx.getLayerColor({ timeframe: "1H" }) === "var(--layer-mtf)", "1H → var(--layer-mtf)");
  assert(ctx.getLayerColor({ timeframe: "5M" }) === "var(--layer-ltf)", "5M → var(--layer-ltf)");
  assert(ctx.getLayerColor({ timeframe: "" }) === "var(--text3)", "empty → var(--text3)");
  assert(ctx.getLayerColor({}) === "var(--text3)", "no timeframe → var(--text3)");
  assert(ctx.getLayerColor(null) === "var(--text3)", "null layer → var(--text3)");
}

console.log("\n[v12.204 getLayerCardTint]");
{
  assert(ctx.getLayerCardTint({ timeframe: "4H" }) === "var(--layer-htf-tint)", "4H → htf-tint");
  assert(ctx.getLayerCardTint({ timeframe: "2H" }) === "var(--layer-mtf-tint)", "2H → mtf-tint");
  assert(ctx.getLayerCardTint({ timeframe: "5M" }) === "var(--layer-ltf-tint)", "5M → ltf-tint");
  assert(ctx.getLayerCardTint({ timeframe: "" }) === null, "leeg → null (geen tint)");
  assert(ctx.getLayerCardTint({}) === null, "no timeframe → null");
}

console.log("\n[v12.204 bias helpers]");
{
  assert(ctx.getBiasIcon("bullish") === "▲", "bullish → ▲");
  assert(ctx.getBiasIcon("bearish") === "▼", "bearish → ▼");
  assert(ctx.getBiasIcon("neutral") === "●", "neutral → ●");
  assert(ctx.getBiasIcon("") === "", "leeg → empty string");
  assert(ctx.getBiasIcon(undefined) === "", "undefined → empty");
  assert(ctx.getBiasColor("bullish") === "var(--green)", "bullish → green token");
  assert(ctx.getBiasColor("bearish") === "var(--red)", "bearish → red token");
  assert(ctx.getBiasColor("neutral") === "var(--text3)", "neutral → text3");
  assert(ctx.getBiasColor("") === null, "leeg → null");
}

console.log("\n" + (failed === 0 ? "✓ All layer-color tests pass" : `✗ ${failed} assertion(s) failed`));
process.exit(failed === 0 ? 0 : 1);
