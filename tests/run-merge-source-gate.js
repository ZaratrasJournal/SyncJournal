// v12.211: Test canMergeSource + getSourceLabel — pure helpers voor merge-uitbreiding
// naar handmatige accounts (+ generieke "manual" source).
//
// Run: node tests/run-merge-source-gate.js

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const html = fs.readFileSync(path.resolve(__dirname, "..", "work", "tradejournal.html"), "utf8");
const startIdx = html.indexOf("function canMergeSource(");
const endIdx = html.indexOf("\nconst validateMerge=", startIdx);
const code = html.slice(startIdx, endIdx);

const ctx = { console };
vm.createContext(ctx);
vm.runInContext(code + "\nthis.canMergeSource=canMergeSource;this.getSourceLabel=getSourceLabel;", ctx);

let failed = 0;
function assert(cond, msg) {
  if (!cond) { console.error("  ✗", msg); failed++; }
  else { console.log("  ✓", msg); }
}

console.log("[canMergeSource]");
{
  // Whitelist matches
  assert(ctx.canMergeSource("ftmo", []) === true, "ftmo → true");
  assert(ctx.canMergeSource("manual", []) === true, "manual → true (geen accounts nodig)");
  assert(ctx.canMergeSource("manual", null) === true, "manual + null accounts → true");
  assert(ctx.canMergeSource("MyDemoAccount", [{ name: "MyDemoAccount" }]) === true, "matched account-name → true");
  assert(ctx.canMergeSource("FTMO Funded 100k", [{ name: "FTMO Funded 100k" }]) === true, "naam met spaties + getallen → true");

  // Crypto-exchanges = excluded
  assert(ctx.canMergeSource("blofin", []) === false, "blofin → false (auto-partial)");
  assert(ctx.canMergeSource("mexc", []) === false, "mexc → false");
  assert(ctx.canMergeSource("kraken", []) === false, "kraken → false");
  assert(ctx.canMergeSource("hyperliquid", []) === false, "hyperliquid → false");

  // Edge case: user heeft account met dezelfde naam als crypto-exchange
  assert(ctx.canMergeSource("mexc", [{ name: "mexc" }]) === true, "mexc + account met die naam → true (user owns naam)");

  // Niet-bestaand account → block (anti-zombie)
  assert(ctx.canMergeSource("VerwijderdAccount", [{ name: "AnderAccount" }]) === false, "niet-bestaand account → false (zombie-protect)");
  assert(ctx.canMergeSource("XYZ", []) === false, "onbekend + lege accounts → false");

  // Invalid input
  assert(ctx.canMergeSource("", []) === false, "lege string → false");
  assert(ctx.canMergeSource(null, []) === false, "null → false");
  assert(ctx.canMergeSource(undefined, []) === false, "undefined → false");
  assert(ctx.canMergeSource(123, []) === false, "non-string → false");
  assert(ctx.canMergeSource("manual", "not-array") === true, "non-array accounts + manual → true (manual werkt zonder)");
  assert(ctx.canMergeSource("MyAccount", "not-array") === false, "non-array accounts + unknown source → false");
}

console.log("\n[getSourceLabel]");
{
  assert(ctx.getSourceLabel("ftmo", []) === "FTMO", "ftmo → 'FTMO'");
  assert(ctx.getSourceLabel("manual", []) === "handmatige trades", "manual → human label");
  assert(ctx.getSourceLabel("Demo Funded", [{ name: "Demo Funded" }]) === "Demo Funded", "account-name → exact terug");
  assert(ctx.getSourceLabel("blofin", []) === "blofin", "fallback to raw source");
  assert(ctx.getSourceLabel("", []) === "", "empty → empty");
  assert(ctx.getSourceLabel(null, []) === "", "null → empty");
}

console.log("\n" + (failed === 0 ? "✓ All merge-source-gate tests pass" : `✗ ${failed} assertion(s) failed`));
process.exit(failed === 0 ? 0 : 1);
