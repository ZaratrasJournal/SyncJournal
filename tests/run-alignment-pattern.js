// v12.205: Test getTradeAlignmentPattern classifier.
// Run: node tests/run-alignment-pattern.js

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const html = fs.readFileSync(path.resolve(__dirname, "..", "work", "tradejournal.html"), "utf8");
const startIdx = html.indexOf("function parseTimeframeMinutes(");
const endIdx = html.indexOf("\n}", html.indexOf("function getPatternLabel")) + 2;
const code = html.slice(startIdx, endIdx);

const ctx = { console };
vm.createContext(ctx);
vm.runInContext(code.replace(/^const /gm, "var ") + "\nthis.getTradeAlignmentPattern=getTradeAlignmentPattern;this.TRADE_PATTERNS=TRADE_PATTERNS;this.biasMatchesDirection=biasMatchesDirection;", ctx);

let failed = 0;
function assert(cond, msg) {
  if (!cond) { console.error("  ✗", msg); failed++; }
  else { console.log("  ✓", msg); }
}

const mkLayer = (tf, bias) => ({ timeframe: tf, bias });
const mkTrade = (direction, layers) => ({ direction, layers });

console.log("[biasMatchesDirection]");
{
  assert(ctx.biasMatchesDirection("bullish", "long") === true, "bullish + long → true");
  assert(ctx.biasMatchesDirection("bullish", "short") === false, "bullish + short → false");
  assert(ctx.biasMatchesDirection("bearish", "long") === false, "bearish + long → false");
  assert(ctx.biasMatchesDirection("bearish", "short") === true, "bearish + short → true");
  assert(ctx.biasMatchesDirection("neutral", "long") === null, "neutral → null (ignored)");
  assert(ctx.biasMatchesDirection("", "long") === null, "empty → null");
}

console.log("\n[getTradeAlignmentPattern — happy paths]");
{
  // Continuation: HTF bull + LTF bull + long
  const t = mkTrade("long", [mkLayer("4H", "bullish"), mkLayer("5M", "bullish")]);
  assert(ctx.getTradeAlignmentPattern(t) === "Continuation", "HTF+LTF aligned long → Continuation");
}
{
  // Pullback: HTF aligned, LTF against
  const t = mkTrade("long", [mkLayer("Daily", "bullish"), mkLayer("5M", "bearish")]);
  assert(ctx.getTradeAlignmentPattern(t) === "Pullback", "HTF bull + LTF bear + long → Pullback");
}
{
  // Reversal: HTF against, LTF aligned
  const t = mkTrade("long", [mkLayer("4H", "bearish"), mkLayer("5M", "bullish")]);
  assert(ctx.getTradeAlignmentPattern(t) === "Reversal", "HTF bear + LTF bull + long → Reversal");
}
{
  // Counter: both against
  const t = mkTrade("long", [mkLayer("4H", "bearish"), mkLayer("5M", "bearish")]);
  assert(ctx.getTradeAlignmentPattern(t) === "Counter", "HTF+LTF both bear + long → Counter");
}
{
  // Short trade: Continuation
  const t = mkTrade("short", [mkLayer("Daily", "bearish"), mkLayer("5M", "bearish")]);
  assert(ctx.getTradeAlignmentPattern(t) === "Continuation", "HTF+LTF aligned short → Continuation");
}

console.log("\n[getTradeAlignmentPattern — edge cases]");
{
  assert(ctx.getTradeAlignmentPattern(null) === "Unclassified", "null trade → Unclassified");
  assert(ctx.getTradeAlignmentPattern({}) === "Unclassified", "empty trade → Unclassified");
  assert(ctx.getTradeAlignmentPattern({ direction: "long", layers: [] }) === "Unclassified", "no layers → Unclassified");
  assert(ctx.getTradeAlignmentPattern({ layers: [mkLayer("4H", "bullish")] }) === "Unclassified", "no direction → Unclassified");
}
{
  // No bias at all
  const t = mkTrade("long", [mkLayer("4H", ""), mkLayer("5M", "")]);
  assert(ctx.getTradeAlignmentPattern(t) === "Unclassified", "no bias on any layer → Unclassified");
}
{
  // Only MTF — geen HTF noch LTF → Unclassified
  const t = mkTrade("long", [mkLayer("1H", "bullish"), mkLayer("30M", "bullish")]);
  assert(ctx.getTradeAlignmentPattern(t) === "Unclassified", "only MTF layers → Unclassified");
}
{
  // Single HTF aligned
  const t = mkTrade("long", [mkLayer("Daily", "bullish")]);
  assert(ctx.getTradeAlignmentPattern(t) === "Continuation", "single HTF aligned → Continuation");
}
{
  // Single HTF against
  const t = mkTrade("long", [mkLayer("Daily", "bearish")]);
  assert(ctx.getTradeAlignmentPattern(t) === "Counter", "single HTF against → Counter");
}
{
  // Single LTF aligned
  const t = mkTrade("long", [mkLayer("5M", "bullish")]);
  assert(ctx.getTradeAlignmentPattern(t) === "Continuation", "single LTF aligned → Continuation");
}
{
  // Mixed HTF (one bull, one bear) → Unclassified
  const t = mkTrade("long", [mkLayer("Daily", "bullish"), mkLayer("4H", "bearish"), mkLayer("5M", "bullish")]);
  assert(ctx.getTradeAlignmentPattern(t) === "Unclassified", "mixed HTF → Unclassified");
}
{
  // Neutral on HTF only → telt niet, alleen LTF aligned → Continuation
  const t = mkTrade("long", [mkLayer("4H", "neutral"), mkLayer("5M", "bullish")]);
  assert(ctx.getTradeAlignmentPattern(t) === "Continuation", "HTF neutral + LTF aligned → Continuation");
}
{
  // 2H is MTF → wordt geskipt, alleen HTF/LTF tellen
  const t = mkTrade("long", [mkLayer("Daily", "bullish"), mkLayer("2H", "bearish"), mkLayer("5M", "bullish")]);
  // HTF bullish + LTF bullish → Continuation (MTF wordt genegeerd voor classificatie)
  assert(ctx.getTradeAlignmentPattern(t) === "Continuation", "MTF bias wordt genegeerd voor pattern");
}

console.log("\n[TRADE_PATTERNS]");
{
  assert(ctx.TRADE_PATTERNS.length === 5, "5 patterns gedefinieerd");
  assert(ctx.TRADE_PATTERNS.includes("Continuation"), "incl. Continuation");
  assert(ctx.TRADE_PATTERNS.includes("Pullback"), "incl. Pullback");
  assert(ctx.TRADE_PATTERNS.includes("Reversal"), "incl. Reversal");
  assert(ctx.TRADE_PATTERNS.includes("Counter"), "incl. Counter");
  assert(ctx.TRADE_PATTERNS.includes("Unclassified"), "incl. Unclassified");
}

console.log("\n" + (failed === 0 ? "✓ All alignment-pattern tests pass" : `✗ ${failed} assertion(s) failed`));
process.exit(failed === 0 ? 0 : 1);
