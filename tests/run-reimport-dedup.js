// v12.192: Test re-import dedup-logic. Simuleert importTrades' dedup-keys op een
// representatieve trades-state. Geen browser nodig — pure logic-test.
//
// Run: node tests/run-reimport-dedup.js

let failed = 0;
function assert(cond, msg) {
  if (!cond) { console.error("  ✗", msg); failed++; }
  else { console.log("  ✓", msg); }
}

// === Setup: state met master + 4 children (gemerged) ===================
const stableId = (ticket, ts) => `ftmo_csv_${ticket}_${ts.replace(/[^\d]/g, "")}`;

const master = {
  id: "master-xyz",
  source: "ftmo",
  pair: "XAUUSD",
  mergedFrom: [
    stableId("100001", "2026-06-04 09:42:18"),
    stableId("100002", "2026-06-04 09:42:29"),
    stableId("100003", "2026-06-04 09:42:42"),
    stableId("100004", "2026-06-04 09:42:51"),
  ],
};

const children = master.mergedFrom.map((id, i) => ({
  id,
  source: "ftmo",
  positionId: String(100001 + i),
  openTime: ["2026-06-04 09:42:18", "2026-06-04 09:42:29", "2026-06-04 09:42:42", "2026-06-04 09:42:51"][i],
  status: "merged-child",
  mergedInto: master.id,
  pair: "XAUUSD",
}));

const currentState = [master, ...children];

// === Test 1: re-import met stable IDs (zelfde) → alle 4 geskipped =====
console.log("\n[Test 1] Re-import met stable IDs (zelfde als in mergedFrom)");
{
  const mergedChildIds = new Set();
  currentState.forEach((t) => {
    if (Array.isArray(t.mergedFrom)) t.mergedFrom.forEach((cid) => mergedChildIds.add(cid));
  });

  const incoming = [
    { id: stableId("100001", "2026-06-04 09:42:18"), source: "ftmo", positionId: "100001", openTime: "2026-06-04 09:42:18" },
    { id: stableId("100002", "2026-06-04 09:42:29"), source: "ftmo", positionId: "100002", openTime: "2026-06-04 09:42:29" },
    { id: stableId("100003", "2026-06-04 09:42:42"), source: "ftmo", positionId: "100003", openTime: "2026-06-04 09:42:42" },
    { id: stableId("100004", "2026-06-04 09:42:51"), source: "ftmo", positionId: "100004", openTime: "2026-06-04 09:42:51" },
  ];

  let alreadyMergedCount = 0;
  let freshCount = 0;
  incoming.forEach((t) => {
    if (mergedChildIds.has(t.id)) { alreadyMergedCount++; return; }
    freshCount++;
  });

  assert(alreadyMergedCount === 4, "alle 4 herkend als 'al samengevoegd'");
  assert(freshCount === 0, "geen fresh trades (perfect dedup)");
}

// === Test 2: re-import met OUDE random-IDs → compound-fallback skip ===
console.log("\n[Test 2] Legacy state met random-IDs + re-import met nieuwe stable-IDs");
{
  // Legacy state: 4 random-ID trades (voor v12.192 stable-id-fix)
  const legacyChildren = [
    { id: "ftmo_csv_oldrandom1", source: "ftmo", positionId: "100001", openTime: "2026-06-04 09:42:18", status: "merged-child", mergedInto: master.id },
    { id: "ftmo_csv_oldrandom2", source: "ftmo", positionId: "100002", openTime: "2026-06-04 09:42:29", status: "merged-child", mergedInto: master.id },
    { id: "ftmo_csv_oldrandom3", source: "ftmo", positionId: "100003", openTime: "2026-06-04 09:42:42", status: "merged-child", mergedInto: master.id },
    { id: "ftmo_csv_oldrandom4", source: "ftmo", positionId: "100004", openTime: "2026-06-04 09:42:51", status: "merged-child", mergedInto: master.id },
  ];
  const legacyMaster = { ...master, mergedFrom: legacyChildren.map((c) => c.id) };
  const legacyState = [legacyMaster, ...legacyChildren];

  // Compound map: (source, positionId, openTime) → trade
  const existingFtmoByCompound = new Map(
    legacyState.filter((t) => t.source === "ftmo" && t.positionId).map((t) => [`ftmo|${t.positionId}|${t.openTime || ""}`, t])
  );
  const mergedChildIds = new Set();
  legacyState.forEach((t) => {
    if (Array.isArray(t.mergedFrom)) t.mergedFrom.forEach((cid) => mergedChildIds.add(cid));
  });
  const existingById = new Map(legacyState.map((t) => [t.id, t]));

  // Re-import: nieuwe stable-IDs (post-fix), zelfde positionIds
  const incoming = [
    { id: stableId("100001", "2026-06-04 09:42:18"), source: "ftmo", positionId: "100001", openTime: "2026-06-04 09:42:18" },
    { id: stableId("100002", "2026-06-04 09:42:29"), source: "ftmo", positionId: "100002", openTime: "2026-06-04 09:42:29" },
    { id: stableId("100003", "2026-06-04 09:42:42"), source: "ftmo", positionId: "100003", openTime: "2026-06-04 09:42:42" },
    { id: stableId("100004", "2026-06-04 09:42:51"), source: "ftmo", positionId: "100004", openTime: "2026-06-04 09:42:51" },
  ];

  let alreadyMergedCount = 0, dupCount = 0, freshCount = 0;
  incoming.forEach((t) => {
    // Stap 1: id match in mergedChildIds?
    if (mergedChildIds.has(t.id)) { alreadyMergedCount++; return; }
    // Stap 2: FTMO compound fallback
    if (t.source === "ftmo" && t.positionId && !existingById.has(t.id)) {
      const k = `ftmo|${t.positionId}|${t.openTime || ""}`;
      const old = existingFtmoByCompound.get(k);
      if (old) {
        if (mergedChildIds.has(old.id)) { alreadyMergedCount++; return; }
        dupCount++;
        return;
      }
    }
    if (!existingById.has(t.id)) { freshCount++; return; }
    dupCount++;
  });

  assert(alreadyMergedCount === 4, "compound-fallback herkent legacy random-IDs als al samengevoegd");
  assert(freshCount === 0, "geen fresh trades, alle 4 herkend");
  assert(dupCount === 0, "geen losse dup-tellers — gemerged neemt 'm");
}

// === Test 3: niet-gemergde trades → gewone dup-detectie ===============
console.log("\n[Test 3] State zonder merge, re-import zelfde trades → dup");
{
  const state = [
    { id: stableId("200001", "2026-06-05 10:00:00"), source: "ftmo", positionId: "200001", openTime: "2026-06-05 10:00:00", status: "closed" },
    { id: stableId("200002", "2026-06-05 11:00:00"), source: "ftmo", positionId: "200002", openTime: "2026-06-05 11:00:00", status: "closed" },
  ];

  const existingById = new Map(state.map((t) => [t.id, t]));
  const mergedChildIds = new Set();

  const incoming = state.map((t) => ({ ...t })); // zelfde data

  let freshCount = 0, dupCount = 0;
  incoming.forEach((t) => {
    if (mergedChildIds.has(t.id)) return;
    if (!existingById.has(t.id)) { freshCount++; return; }
    dupCount++;
  });

  assert(freshCount === 0, "geen fresh");
  assert(dupCount === 2, "beide trades herkend als duplicate");
}

// === Test 4: nieuwe trade tussen oude → alleen die wordt fresh =========
console.log("\n[Test 4] Mixed re-import: 4 oude + 1 nieuwe FTMO-trade");
{
  const state = [
    { id: stableId("300001", "2026-06-05 10:00:00"), source: "ftmo", positionId: "300001", openTime: "2026-06-05 10:00:00" },
    { id: stableId("300002", "2026-06-05 11:00:00"), source: "ftmo", positionId: "300002", openTime: "2026-06-05 11:00:00" },
  ];
  const existingById = new Map(state.map((t) => [t.id, t]));
  const existingFtmoByCompound = new Map(state.map((t) => [`ftmo|${t.positionId}|${t.openTime}`, t]));
  const mergedChildIds = new Set();

  const incoming = [
    ...state,
    { id: stableId("300003", "2026-06-05 12:00:00"), source: "ftmo", positionId: "300003", openTime: "2026-06-05 12:00:00" }, // NIEUW
  ];

  let freshCount = 0, dupCount = 0, alreadyMergedCount = 0;
  incoming.forEach((t) => {
    if (mergedChildIds.has(t.id)) { alreadyMergedCount++; return; }
    if (t.source === "ftmo" && t.positionId && !existingById.has(t.id)) {
      const k = `ftmo|${t.positionId}|${t.openTime || ""}`;
      if (existingFtmoByCompound.get(k)) { dupCount++; return; }
    }
    if (!existingById.has(t.id)) { freshCount++; return; }
    dupCount++;
  });

  assert(freshCount === 1, "alleen 300003 is fresh");
  assert(dupCount === 2, "300001 + 300002 zijn duplicates");
  assert(alreadyMergedCount === 0, "geen merge-overlap");
}

console.log("\n" + (failed === 0 ? "✓ All re-import dedup tests pass" : `✗ ${failed} assertion(s) failed`));
process.exit(failed === 0 ? 0 : 1);
