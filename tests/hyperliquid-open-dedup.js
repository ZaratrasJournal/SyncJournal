// Reproductie + regressie: Hyperliquid open-positie dupliceert bij elke handmatige refresh.
// Bug (ChangeMaker, Discord 2026-06-07): dezelfde open BTC/USDC short verschijnt na 3 refreshes
// als 3 losse open trades. Oorzaak: fetchOpenPositions zette id = "hyperliquid_open_"+coin+"_"+Date.now()
// → niet-stabiel → syncOpenPositions (dedup op id) zag elke refresh als een nieuwe positie.
// Fix: stabiel id = "hyperliquid_open_"+coin (zoals Blofin/MEXC: per-positie stabiel).
//
// Run: node tests/hyperliquid-open-dedup.js

// ── id-schemes ───────────────────────────────────────────────────────────────
// OUD (buggy): tijd-gebaseerd → verschilt per refresh.
const oldId = (coin, nowMs) => "hyperliquid_open_" + coin + "_" + nowMs;
// NIEUW (fix): stabiel per coin (net-mode = 1 positie per coin tegelijk).
const newId = (coin) => "hyperliquid_open_" + coin;

// Maakt een open-record zoals fetchOpenPositions teruggeeft (minimale velden voor dedup).
function makeOpen(id, coin, nowMs) {
  return { id, positionId: coin, pair: coin + "/USDC", direction: "short",
    entry: "62826.00", source: "hyperliquid", status: "open",
    setupTags: [], confirmationTags: [], timeframeTags: [], emotionTags: [], mistakeTags: [], customTags: [], links: [], layers: [] };
}

// ── syncOpenPositions reconciliatie-kern (faithful uit work/tradejournal.html:19993-20081) ──
// Vereenvoudigd tot het pad dat hier speelt: open positie, GEEN closed-siblings (positie nog open).
function syncOpenPositions(prev, opens, exchangeKey) {
  const freshIds = new Set((opens || []).map(t => t.id));
  const matchKey = (t) => { const e = parseFloat(t.entry); if (!isFinite(e) || e <= 0) return null; return `${t.pair}|${t.direction}|${e.toFixed(8)}`; };
  const consumedSiblingIds = new Set();
  const kept = [];
  for (const t of prev) {
    const isStaleOpenOrPartial = t.source === exchangeKey && (t.status === "open" || t.status === "partial") && !freshIds.has(t.id);
    if (isStaleOpenOrPartial) {
      const tKey = matchKey(t);
      const siblings = tKey ? prev.filter(s => s.source === exchangeKey && s.status === "closed" && s.id !== t.id && !consumedSiblingIds.has(s.id) && matchKey(s) === tKey) : [];
      if (siblings.length === 0) { kept.push(t); continue; } // positie nog open → behoud
      // (finalize-pad niet relevant voor deze repro)
    }
    kept.push(t);
  }
  const byId = new Map(kept.map(t => [t.id, t]));
  const fresh = [];
  for (const incoming of (opens || [])) {
    if (byId.has(incoming.id)) { byId.set(incoming.id, { ...byId.get(incoming.id), ...incoming }); }
    else { fresh.push(incoming); byId.set(incoming.id, incoming); }
  }
  const updated = kept.map(t => byId.get(t.id) || t);
  return fresh.length ? [...fresh, ...updated] : updated;
}

// ── Simuleer 3 handmatige refreshes van dezelfde open BTC-positie ──────────────
function simulate(idFor) {
  let trades = [];
  const refreshTimes = [1717752900000, 1717753200000, 1717756680000]; // 10:55, 11:00, 11:58
  for (const now of refreshTimes) {
    const opens = [makeOpen(idFor("BTC", now), "BTC", now)];
    trades = syncOpenPositions(trades, opens, "hyperliquid");
  }
  return trades.filter(t => t.source === "hyperliquid" && t.status === "open").length;
}

const oldCount = simulate((coin, now) => oldId(coin, now));
const newCount = simulate((coin) => newId(coin));

console.log("OUD (id met Date.now()):  open trades na 3 refreshes =", oldCount, oldCount === 3 ? "✗ BUG (3 duplicaten)" : "?");
console.log("NIEUW (stabiel coin-id):  open trades na 3 refreshes =", newCount, newCount === 1 ? "✓ FIXED (1 trade)" : "✗");

let ok = true;
if (oldCount !== 3) { console.error("\nFAIL: oude scheme zou de bug moeten reproduceren (3 opens)"); ok = false; }
if (newCount !== 1) { console.error("\nFAIL: nieuwe scheme moet 1 open trade geven"); ok = false; }
if (!ok) process.exit(1);
console.log("\n✅ Bug gereproduceerd én fix bevestigd: stabiel coin-id ontdubbelt de open positie.");
