// v12.202: Test getLayerTimeframeGroup + getLayerColor — pure helpers.
//
// Run: node tests/run-layer-color.js

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const html = fs.readFileSync(path.resolve(__dirname, "..", "work", "tradejournal.html"), "utf8");
const startIdx = html.indexOf("const TF_GROUPS=");
const endIdx = html.indexOf("\n}", html.indexOf("function getLayerColor")) + 2;
const code = html.slice(startIdx, endIdx);

const ctx = { console };
vm.createContext(ctx);
vm.runInContext(code.replace(/^const /m, "var ") + "\nthis.getLayerTimeframeGroup=getLayerTimeframeGroup;this.getLayerColor=getLayerColor;this.TF_GROUPS=TF_GROUPS;", ctx);

let failed = 0;
function assert(cond, msg) {
  if (!cond) { console.error("  ✗", msg); failed++; }
  else { console.log("  ✓", msg); }
}

console.log("[getLayerTimeframeGroup]");
{
  assert(ctx.getLayerTimeframeGroup("Daily") === "HTF", "Daily → HTF");
  assert(ctx.getLayerTimeframeGroup("1D") === "HTF", "1D → HTF");
  assert(ctx.getLayerTimeframeGroup("12H") === "HTF", "12H → HTF");
  assert(ctx.getLayerTimeframeGroup("4H") === "HTF", "4H → HTF");
  assert(ctx.getLayerTimeframeGroup("1W") === "HTF", "1W → HTF");
  assert(ctx.getLayerTimeframeGroup("1H") === "MTF", "1H → MTF");
  assert(ctx.getLayerTimeframeGroup("30M") === "MTF", "30M → MTF");
  assert(ctx.getLayerTimeframeGroup("15M") === "MTF", "15M → MTF");
  assert(ctx.getLayerTimeframeGroup("5M") === "LTF", "5M → LTF");
  assert(ctx.getLayerTimeframeGroup("1M") === "LTF", "1M → LTF");
  assert(ctx.getLayerTimeframeGroup("") === "OTHER", "empty → OTHER");
  assert(ctx.getLayerTimeframeGroup(null) === "OTHER", "null → OTHER");
  assert(ctx.getLayerTimeframeGroup(undefined) === "OTHER", "undefined → OTHER");
  assert(ctx.getLayerTimeframeGroup("Unknown") === "OTHER", "Unknown → OTHER");
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

console.log("\n" + (failed === 0 ? "✓ All layer-color tests pass" : `✗ ${failed} assertion(s) failed`));
process.exit(failed === 0 ? 0 : 1);
