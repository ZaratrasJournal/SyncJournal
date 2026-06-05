// v12.197: Test deriveTpLevelsFromChildren — genereert tpLevels[] uit gemergde children.
//
// Run: node tests/run-tp-from-merge.js

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const html = fs.readFileSync(path.resolve(__dirname, "..", "work", "tradejournal.html"), "utf8");
const startIdx = html.indexOf("const deriveTpLevelsFromChildren=");
const endIdx = html.indexOf("\n};", startIdx) + 2;
const code = html.slice(startIdx, endIdx);

const ctx = { console };
vm.createContext(ctx);
vm.runInContext("var " + code.slice(6) + "\nthis.deriveTpLevelsFromChildren=deriveTpLevelsFromChildren;", ctx);

let failed = 0;
function assert(cond, msg) {
  if (!cond) { console.error("  ✗", msg); failed++; }
  else { console.log("  ✓", msg); }
}

console.log("[deriveTpLevelsFromChildren]");
{
  // 4 XAUUSD long children, allemaal 0.5 lot → elk 25% van totaal
  const children = [
    { id:"m1", date:"2026-06-04", time:"09:42", closeTime:"2026-06-04T10:00:00Z", exit:"2022.00", positionSizeAsset:"0.5", status:"closed" },
    { id:"m2", date:"2026-06-04", time:"09:42", closeTime:"2026-06-04T10:15:00Z", exit:"2025.00", positionSizeAsset:"0.5", status:"closed" },
    { id:"m3", date:"2026-06-04", time:"09:42", closeTime:"2026-06-04T10:30:00Z", exit:"2028.00", positionSizeAsset:"0.5", status:"closed" },
    { id:"m4", date:"2026-06-04", time:"09:42", closeTime:"2026-06-04T10:45:00Z", exit:"2032.00", positionSizeAsset:"0.5", status:"closed" },
  ];
  const tps = ctx.deriveTpLevelsFromChildren(children);
  assert(tps.length === 4, "4 children → 4 tpLevels");
  assert(tps.every(tp => tp.pct === "25.00"), "elk TP heeft 25% size");
  assert(tps.every(tp => tp.status === "hit"), "alle children closed → status hit");
  assert(tps[0].price === "2022.00", "TP1 = vroegste exit (2022.00)");
  assert(tps[3].price === "2032.00", "TP4 = laatste exit (2032.00)");
  assert(tps.every(tp => tp.actualPrice === tp.price), "actualPrice = price (gerealiseerd)");
  assert(tps.every(tp => tp.ts), "elke TP heeft timestamp");
  assert(tps.every(tp => tp.id && tp.id.startsWith("merge_tp_")), "tpLevel-IDs zijn deterministic uit child-id");
}
{
  // Ongelijke sizes — pct moet pro-rata zijn
  const children = [
    { id:"a", date:"2026-06-01", time:"10:00", exit:"100", positionSizeAsset:"1", status:"closed" },
    { id:"b", date:"2026-06-01", time:"10:30", exit:"110", positionSizeAsset:"3", status:"closed" },
  ];
  const tps = ctx.deriveTpLevelsFromChildren(children);
  assert(tps[0].pct === "25.00", "child 1 size 1 van 4 → 25%");
  assert(tps[1].pct === "75.00", "child 2 size 3 van 4 → 75%");
}
{
  // Partial merge: 1 open child → status="open" voor die TP
  const children = [
    { id:"a", date:"2026-06-01", time:"10:00", exit:"100", positionSizeAsset:"1", status:"closed" },
    { id:"b", date:"2026-06-01", time:"10:30", exit:"", positionSizeAsset:"1", status:"open" },
  ];
  const tps = ctx.deriveTpLevelsFromChildren(children);
  assert(tps[0].status === "hit", "closed child → hit");
  assert(tps[1].status === "open", "open child → open TP");
}
{
  // Edge: lege array → []
  assert(ctx.deriveTpLevelsFromChildren([]).length === 0, "[] → []");
  assert(ctx.deriveTpLevelsFromChildren(null).length === 0, "null → []");
}
{
  // Edge: totaal size = 0 → []
  const children = [{ id:"a", exit:"100", positionSizeAsset:"0", status:"closed" }];
  assert(ctx.deriveTpLevelsFromChildren(children).length === 0, "totaal size 0 → []");
}

console.log("\n" + (failed === 0 ? "✓ All TP-from-merge tests pass" : `✗ ${failed} assertion(s) failed`));
process.exit(failed === 0 ? 0 : 1);
