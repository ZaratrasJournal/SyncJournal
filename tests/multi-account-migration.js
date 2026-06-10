// Regressie: multi-account migratie (oud model → unified accounts[] + trade.source-remap).
// REPLICA van buildUnifiedAccounts in work/tradejournal.html — bij wijziging dáár, hier mee-updaten.
// Bewijst: geen orphans, correcte types/creds, manual-id behoud, FTMO-merge intact, idempotent.
//
// Run: node tests/multi-account-migration.js
let _n = 0;
const uid = () => "u" + (++_n);

function buildUnifiedAccounts(config, accounts, trades, genId) {
  const mkId = genId || (() => "acc_" + uid());
  const out = []; const sourceMap = {};
  Object.entries(config?.exchanges || {}).forEach(([type, cfg]) => {
    if (!cfg) return;
    const id = mkId();
    out.push({ id, type, label: cfg.label || "", apiKey: cfg.apiKey || "", apiSecret: cfg.apiSecret || "", passphrase: cfg.passphrase || "", walletAddress: cfg.walletAddress || "", syncFrom: cfg.syncFrom || "", transactions: Array.isArray(cfg.transactions) ? cfg.transactions : [] });
    sourceMap[type] = id; sourceMap[id] = id;
  });
  (accounts || []).forEach(a => {
    const id = a.id || mkId();
    out.push({ id, type: "manual", label: a.label || a.name || "", name: a.name || "", transactions: Array.isArray(a.transactions) ? a.transactions : [], balance: a.balance });
    if (a.name && !(a.name in sourceMap)) sourceMap[a.name] = id;
    sourceMap[id] = id;
  });
  const knownIds = new Set(out.map(a => a.id));
  const newTrades = (trades || []).map(t => {
    const src = t.source || "manual";
    if (src === "manual") return t;
    if (knownIds.has(src)) return t;
    const mapped = sourceMap[src];
    return mapped ? { ...t, source: mapped } : { ...t, source: "manual" };
  });
  return { accounts: out, trades: newTrades, sourceMap };
}

// ── Fixture: oud model ───────────────────────────────────────────────────────
const config = { exchanges: {
  hyperliquid: { walletAddress: "0xabc", label: "Main", transactions: [{ id: "tx1", type: "deposit", amount: "15" }] },
  mexc: { apiKey: "k", apiSecret: "s", label: "Scalp" },
  ftmo: { label: "Prop" },
} };
const accounts = [
  { id: "man_keep_1", name: "Reserve", label: "Off-platform", transactions: [{ id: "tx2", type: "deposit", amount: "2000" }] },
];
const trades = [
  { id: "t1", source: "hyperliquid", pnl: "10" },
  { id: "t2", source: "mexc", pnl: "-5" },
  { id: "t3", source: "Reserve", pnl: "3" },          // manual via NAAM
  { id: "t4", source: "manual", pnl: "1" },            // gereserveerd literal
  { id: "t5", source: "kraken", pnl: "7" },            // onbekend (geen config) → fallback "manual"
  // FTMO merge: master + 2 children (allemaal source=ftmo)
  { id: "m1", source: "ftmo", pnl: "20", mergedFrom: ["c1", "c2"] },
  { id: "c1", source: "ftmo", pnl: "12", mergedInto: "m1", status: "merged-child" },
  { id: "c2", source: "ftmo", pnl: "8", mergedInto: "m1", status: "merged-child" },
];

const r = buildUnifiedAccounts(config, accounts, trades);
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log("✗", m); } else console.log("✓", m); };

// 1. Account-count = #exchange-configs (3) + #manual (1) = 4
ok(r.accounts.length === 4, `4 accounts (3 exchange + 1 manual), kreeg ${r.accounts.length}`);
// 2. Types correct
const byType = t => r.accounts.filter(a => a.type === t);
ok(byType("hyperliquid").length === 1 && byType("hyperliquid")[0].walletAddress === "0xabc", "hyperliquid-account met walletAddress");
ok(byType("mexc")[0]?.apiKey === "k", "mexc-account met apiKey");
ok(byType("manual")[0]?.id === "man_keep_1", "manual account behoudt bestaande id");
// 3. Capital-tracker meegemigreerd
ok(byType("hyperliquid")[0].transactions.length === 1, "hyperliquid capital-tracker mee");
// 4. trade.source remap — 0 orphans
const acctIds = new Set(r.accounts.map(a => a.id));
const orphans = r.trades.filter(t => t.source !== "manual" && !acctIds.has(t.source));
ok(orphans.length === 0, `0 orphans (source wijst naar geldige account.id of "manual"), kreeg ${orphans.length}`);
const tById = id => r.trades.find(t => t.id === id);
ok(tById("t1").source === byType("hyperliquid")[0].id, "HL-trade → HL-account.id");
ok(tById("t3").source === "man_keep_1", "manual-NAAM-trade → manual account.id");
ok(tById("t4").source === "manual", "'manual' blijft gereserveerd literal");
ok(tById("t5").source === "manual", "onbekende source (kraken) → 'manual' fallback");
// 5. FTMO merge intact: master + children zelfde ftmo-account, merge-velden ongewijzigd
const ftmoId = byType("ftmo")[0].id;
ok(tById("m1").source === ftmoId && tById("c1").source === ftmoId && tById("c2").source === ftmoId, "FTMO master+children → zelfde ftmo-account.id");
ok(JSON.stringify(tById("m1").mergedFrom) === JSON.stringify(["c1", "c2"]) && tById("c1").mergedInto === "m1", "merge-structuur (mergedFrom/mergedInto) ongewijzigd");
// 6. PnL-invariant
const sum = arr => arr.reduce((s, t) => s + parseFloat(t.pnl || 0), 0);
ok(sum(trades) === sum(r.trades), "som PnL ongewijzigd vóór/na migratie");
// 7. Idempotent: tweede run op gemigreerde output verandert niets aan source
const r2 = buildUnifiedAccounts({ exchanges: {} }, r.accounts, r.trades);
const stable = r.trades.every(t => r2.trades.find(x => x.id === t.id).source === t.source);
ok(stable, "idempotent: trade.source stabiel bij 2e migratie");

console.log(fail ? `\n${fail} FAIL` : "\n✅ Migratie correct: geen orphans, types/creds kloppen, FTMO-merge intact, idempotent.");
process.exit(fail ? 1 : 0);
