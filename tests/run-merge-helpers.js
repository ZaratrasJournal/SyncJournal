// Pure helper-tests voor merge-feature (v12.190). Geen Playwright nodig — extraheert
// de helpers via een minimal HTML eval. Faster dan een browser-test en makkelijker te
// uitbreiden bij nieuwe edge-cases.
//
// Run: node tests/run-merge-helpers.js

const fs = require("fs");
const path = require("path");
const vm = require("vm");

// Lees work/tradejournal.html en extraheer alleen de 4 pure merge-helpers.
// Plek: vlak na getConsumedSiblings (~line 1930), eindigt vóór de "// Display-formatter"
// comment. Het is een aaneengesloten pure-JS blok zonder JSX.
const html = fs.readFileSync(path.resolve(__dirname, "..", "work", "tradejournal.html"), "utf8");

const startIdx = html.indexOf("const filterMergedChildren=");
// Onze 4 helpers eindigen vlak vóór getConsumedSiblings (de oude partial-close helper)
const endMarker = "// Partial-close sibling-detector";
const endIdx = html.indexOf(endMarker, startIdx);
if (startIdx < 0 || endIdx < 0) {
  console.error("FAIL: kon merge-helpers niet vinden in work/tradejournal.html");
  console.error("  startIdx:", startIdx, "endIdx:", endIdx);
  process.exit(1);
}
const code = html.slice(startIdx, endIdx);

// vm sandbox — vervang `const X=` door `var X=` zodat de bindings global zijn in de sandbox
const codeAsVar = code.replace(/^const /gm, "var ");
const exportLine = "this.filterMergedChildren=filterMergedChildren;this.buildMergePreview=buildMergePreview;this.detectMergeConflicts=detectMergeConflicts;this.validateMerge=validateMerge;";
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(codeAsVar + "\n" + exportLine, ctx);

let failed = 0;
function assert(cond, msg) {
  if (!cond) { console.error("  ✗", msg); failed++; }
  else { console.log("  ✓", msg); }
}

// === filterMergedChildren ============================================
console.log("\n[filterMergedChildren]");
{
  const trades = [
    { id: "a", status: "closed" },
    { id: "b", status: "merged-child" },
    { id: "c", status: "open" },
    { id: "d", status: "merged-child" },
  ];
  const visible = ctx.filterMergedChildren(trades);
  assert(visible.length === 2, "filtert 2 merged-children weg");
  assert(visible.find(t => t.id === "a"), "behoudt closed trade");
  assert(visible.find(t => t.id === "c"), "behoudt open trade");
  assert(!visible.find(t => t.id === "b"), "verbergt merged-child b");
}
{
  assert(ctx.filterMergedChildren(null).length === 0, "null → []");
  assert(ctx.filterMergedChildren(undefined).length === 0, "undefined → []");
  assert(ctx.filterMergedChildren([]).length === 0, "[] → []");
}

// === buildMergePreview ===============================================
console.log("\n[buildMergePreview]");
{
  const children = [1, 2, 3, 4].map((i) => ({
    id: `m${i}`, date: "2026-06-04", time: `09:42:${10 + i * 10}`,
    pair: "XAUUSD", direction: "long",
    entry: "2018.50", exit: String(2022 + (i - 1) * 3.5),
    stopLoss: "2014.50",
    positionSize: "1009.25", positionSizeAsset: "0.5",
    pnl: String([87.5, 162.5, 237.5, 337.5][i - 1]),
    fees: "1.50",
    status: "closed",
    source: "ftmo",
    tradeGrade: ["A+", "A", "A+", "B"][i - 1],
    playbookId: i < 4 ? "london-breakout-long" : "",
    notes: i === 1 ? "Clean ICT breakout" : (i === 4 ? "Runner tot LDN close" : ""),
    entryNote: "",
    setupTags: ["London Breakout"], confirmationTags: [], timeframeTags: ["1H"],
    emotionTags: [], mistakeTags: [], customTags: [],
  }));
  const preview = ctx.buildMergePreview(children, {});
  assert(preview.pair === "XAUUSD", "pair = XAUUSD");
  assert(preview.direction === "long", "direction = long");
  assert(parseFloat(preview.entry) === 2018.5, "gewogen entry = 2018.50 (alle children zelfde)");
  assert(parseFloat(preview.pnl) === 825.0, "Σ pnl = 825.00");
  assert(parseFloat(preview.fees) === 6.0, "Σ fees = 6.00");
  assert(parseFloat(preview.positionSizeAsset) === 2.0, "Σ size asset = 2.00");
  assert(parseFloat(preview.stopLoss) === 2014.5, "SL = conservatiefst voor long = max = 2014.50");
  assert(preview.status === "closed", "status = closed (alle children closed)");
  assert(preview.realizedPnl === "", "geen realizedPnl bij allClosed");
  assert(preview.childCount === 4 && preview.closedCount === 4, "child- en closed-count = 4");
  // Default conflict-resolutie: meest voorkomende non-empty
  assert(preview.tradeGrade === "A+", "meest voorkomende grade = A+ (2x)");
  assert(preview.playbookId === "london-breakout-long", "playbookId = meest voorkomende non-empty");
}
{
  // Met conflictChoices override
  const children = [
    { id: "a", date: "2026-06-01", time: "10:00", pair: "EURUSD", direction: "long",
      entry: "1.08", exit: "1.09", stopLoss: "1.07", positionSize: "1000", positionSizeAsset: "1000",
      pnl: "10", fees: "0.5", status: "closed", source: "ftmo",
      tradeGrade: "A", playbookId: "pb1", notes: "note A",
      setupTags: [], confirmationTags: [], timeframeTags: [], emotionTags: [], mistakeTags: [], customTags: [] },
    { id: "b", date: "2026-06-01", time: "10:30", pair: "EURUSD", direction: "long",
      entry: "1.08", exit: "1.10", stopLoss: "1.07", positionSize: "1000", positionSizeAsset: "1000",
      pnl: "20", fees: "0.5", status: "closed", source: "ftmo",
      tradeGrade: "B", playbookId: "pb2", notes: "note B",
      setupTags: [], confirmationTags: [], timeframeTags: [], emotionTags: [], mistakeTags: [], customTags: [] },
  ];
  const preview = ctx.buildMergePreview(children, { tradeGrade: "b", notes: "concat" });
  assert(preview.tradeGrade === "B", "user-keuze override → grade = B");
  assert(preview.notes.includes("note A") && preview.notes.includes("note B"), "concat = beide notes");
  assert(preview.notes.includes("———"), "concat scheidingslijn aanwezig");
}
{
  // Partial: 3 closed + 1 open
  const children = [
    { id: "a", date: "2026-06-01", time: "10:00", pair: "XAUUSD", direction: "long",
      entry: "2000", exit: "2010", stopLoss: "1990", positionSize: "1000", positionSizeAsset: "0.5",
      pnl: "10", fees: "0.5", status: "closed", source: "ftmo",
      tradeGrade: "", playbookId: "", notes: "",
      setupTags: [], confirmationTags: [], timeframeTags: [], emotionTags: [], mistakeTags: [], customTags: [] },
    { id: "b", date: "2026-06-01", time: "10:30", pair: "XAUUSD", direction: "long",
      entry: "2000", exit: "", stopLoss: "1990", positionSize: "1000", positionSizeAsset: "0.5",
      pnl: "", fees: "0", status: "open", source: "ftmo",
      tradeGrade: "", playbookId: "", notes: "",
      setupTags: [], confirmationTags: [], timeframeTags: [], emotionTags: [], mistakeTags: [], customTags: [] },
  ];
  const preview = ctx.buildMergePreview(children, {});
  assert(preview.status === "partial", "1 open child → master status = partial");
  assert(preview.realizedPnl === "10.00", "realizedPnl = Σ closed pnl");
  assert(preview.closedCount === 1 && preview.childCount === 2, "counts correct");
}

// === validateMerge ===================================================
console.log("\n[validateMerge]");
{
  // Mixed pairs = fail
  const checks = ctx.validateMerge([
    { pair: "BTC", direction: "long", source: "ftmo", status: "closed", date: "2026-06-01", time: "10:00" },
    { pair: "ETH", direction: "long", source: "ftmo", status: "closed", date: "2026-06-01", time: "10:00" },
  ]);
  assert(checks.some(c => c.level === "fail" && /pairs/i.test(c.msg)), "mixed pairs blokt merge");
}
{
  // Long+short = fail
  const checks = ctx.validateMerge([
    { pair: "BTC", direction: "long", source: "ftmo", status: "closed", date: "2026-06-01", time: "10:00" },
    { pair: "BTC", direction: "short", source: "ftmo", status: "closed", date: "2026-06-01", time: "10:00" },
  ]);
  assert(checks.some(c => c.level === "fail" && /directions/i.test(c.msg)), "mixed directions blokt merge");
}
{
  // Alle OK
  const checks = ctx.validateMerge([
    { pair: "BTC", direction: "long", source: "ftmo", status: "closed", date: "2026-06-01", time: "10:00" },
    { pair: "BTC", direction: "long", source: "ftmo", status: "closed", date: "2026-06-01", time: "10:05" },
  ]);
  assert(!checks.some(c => c.level === "fail"), "alle compatibel = geen fail");
  assert(checks.some(c => c.level === "ok"), "ok-signalen aanwezig");
}
{
  // Reeds gemerged child = fail
  const checks = ctx.validateMerge([
    { pair: "BTC", direction: "long", source: "ftmo", status: "merged-child", mergedInto: "x", date: "2026-06-01", time: "10:00" },
    { pair: "BTC", direction: "long", source: "ftmo", status: "closed", date: "2026-06-01", time: "10:05" },
  ]);
  assert(checks.some(c => c.level === "fail" && /al gemerged/i.test(c.msg)), "merged-child in selectie blokt merge");
}
{
  // Master in selectie = fail
  const checks = ctx.validateMerge([
    { pair: "BTC", direction: "long", source: "ftmo", status: "closed", mergedFrom: ["a", "b"], date: "2026-06-01", time: "10:00" },
    { pair: "BTC", direction: "long", source: "ftmo", status: "closed", date: "2026-06-01", time: "10:05" },
  ]);
  assert(checks.some(c => c.level === "fail" && /master/i.test(c.msg)), "master in selectie blokt merge");
}

// === detectMergeConflicts ============================================
console.log("\n[detectMergeConflicts]");
{
  const children = [
    { id: "a", tradeGrade: "A+", playbookId: "pb1", notes: "n1", entryNote: "" },
    { id: "b", tradeGrade: "A", playbookId: "pb1", notes: "n2", entryNote: "" },
  ];
  const conflicts = ctx.detectMergeConflicts(children);
  const fields = conflicts.map(c => c.field);
  assert(fields.includes("tradeGrade"), "tradeGrade conflict gedetecteerd");
  assert(fields.includes("notes"), "notes conflict gedetecteerd");
  assert(!fields.includes("playbookId"), "playbookId NIET in conflict (zelfde waarde)");
  assert(!fields.includes("entryNote"), "entryNote NIET in conflict (beide leeg)");
}
{
  // 1 child → geen conflicts
  const conflicts = ctx.detectMergeConflicts([{ id: "x" }]);
  assert(conflicts.length === 0, "1 child → geen conflicts");
}

console.log("\n" + (failed === 0 ? "✓ All helper tests pass" : `✗ ${failed} assertion(s) failed`));
process.exit(failed === 0 ? 0 : 1);
