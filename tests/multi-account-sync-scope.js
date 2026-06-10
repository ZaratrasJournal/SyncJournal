// Regressie: scopeToAccount() voorkomt id-/source-collisions tussen accounts van hetzelfde type.
// REPLICA van scopeToAccount in work/tradejournal.html — bij wijziging dáár, hier mee-updaten.
// Run: node tests/multi-account-sync-scope.js

function scopeToAccount(records, account) {
  if (!account || typeof account !== "object") return records || [];
  return (records || []).map(r => ({ ...r, source: account.id, id: account.id + "_" + (r.id || "") }));
}

// Twee Hyperliquid-accounts, beide met een open BTC-positie (zelfde raw adapter-id).
const hlA = { id: "acc_main", type: "hyperliquid" };
const hlB = { id: "acc_degen", type: "hyperliquid" };
const rawOpenA = [{ id: "hyperliquid_open_BTC", source: "hyperliquid", pair: "BTC/USDC", direction: "long" }];
const rawOpenB = [{ id: "hyperliquid_open_BTC", source: "hyperliquid", pair: "BTC/USDC", direction: "short" }];

const a = scopeToAccount(rawOpenA, hlA)[0];
const b = scopeToAccount(rawOpenB, hlB)[0];

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log("✗", m); } else console.log("✓", m); };

ok(a.source === "acc_main", `A.source = account.id (${a.source})`);
ok(b.source === "acc_degen", `B.source = account.id (${b.source})`);
ok(a.id !== b.id, `geen id-collision: ${a.id} ≠ ${b.id}`);
ok(a.id === "acc_main_hyperliquid_open_BTC", `A.id genamespaced (${a.id})`);
// idempotent-ish: re-scope van dezelfde fetch geeft dezelfde id (→ dedup blijft werken)
const a2 = scopeToAccount(rawOpenA, hlA)[0];
ok(a2.id === a.id, "zelfde raw-fetch → zelfde scoped id (dedup-veilig)");
// legacy string-account → ongewijzigd (backwards-compat)
const legacy = scopeToAccount(rawOpenA, "hyperliquid");
ok(legacy[0].id === "hyperliquid_open_BTC" && legacy[0].source === "hyperliquid", "legacy string → records ongewijzigd");

console.log(fail ? `\n${fail} FAIL` : "\n✅ Scoping correct: per-account source+id, geen collisions, dedup-veilig, legacy-compat.");
process.exit(fail ? 1 : 0);
