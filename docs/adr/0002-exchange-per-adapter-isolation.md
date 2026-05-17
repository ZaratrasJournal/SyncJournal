# 0002 — Exchange-architectuur: per-adapter isolation

**Status**: Accepted (geïntroduceerd v12.85, gehandhaafd in alle latere versies)

**Datum**: 2026-05-03

## Context

We ondersteunen 5 exchanges met sterk verschillende data-shapes en aannames:
- **Blofin** — heeft `positionId` hergebruik na full-close, `closePositions` soms in contracts/soms in base currency, partial-close detectie via siblings
- **MEXC** — `dealVol` in contracts (vereist `contractSize` lookup), pending stop-orders kunnen als TPs binnenkomen (Worker-bug)
- **Kraken Futures** — account-log architectuur (server-side reconstructie uit fills), géén `positionId` per trade
- **Hyperliquid** — wallet-only, public on-chain data, geen API-keys, ander fee-model
- **FTMO MT5** — CSV-only, geen API, FX/CFD i.p.v. crypto, swap-fees i.p.v. funding

**Probleem dat zich voordeed**: in pre-v12.85 stond `detectPartialFromSiblings(trades, exchange)` als shared helper met `if(exchange === "blofin") { /* speciale logica */ }` switches. Een bug-fix voor Blofin's `_rawCloseSize`-veld trok de Blofin-aannames per ongeluk over MEXC's pad heen → MEXC partial-close logica brak in productie zonder dat onze Blofin-tests dat detecteerden.

Het commit-message *"fix Blofin partial-close"* terwijl je een shared helper wijzigt = misleidend én gevaarlijk. Een Blofin-bug raakt MEXC-users.

## Decision

**Per-exchange adapter-objects** met identieke method-signatures. Shared scope bevat ZERO exchange-aannames.

### Structuur

```js
const ExchangeAPI = {
  blofin: {
    name: "Blofin",
    color: "#6366f1",
    needsPassphrase: true,
    async fetchTrades(...) { ... },
    async fetchOpenPositions(...) { ... },
    async fetchFills(...) { ... },
    detectPartials(trades) { return detectPartialFromSiblings(trades, "blofin"); },
    captureSnapshot(creds) { ... },
  },
  mexc: { /* idem */ },
  kraken: { /* idem */ },
  hyperliquid: { walletOnly: true, /* idem */ },
  ftmo: { csvOnly: true, detectPartials: t => t /* no-op */ },
};
```

**Dispatcher in App-code**:
```js
// CORRECT — via adapter
const updated = ExchangeAPI[ex]?.detectPartials?.(trades) ?? trades;

// INCORRECT — direct shared aanroep
const updated = detectPartialFromSiblings(trades, ex);
```

### Wat blijft shared

Pure utilities zonder exchange-aannames mogen gedeeld blijven:
- `syncTradeFlatFields(t)` — derive flat tags uit layers[]
- `normalizeTrade(t)` — price-precisie fix, screenshot-migratie
- `getConsumedSiblings(trades)` — algemene matchKey-based dedup

**Toetspunt**: bevat de code een `if (exchange === ...)` of impliciete exchange-aanname? Zo ja → moet naar adapter.

### Nieuwe exchange toevoegen

Vol-formuleerd adapter-object met ALLE methods, incl. no-ops voor wat niet relevant is:
```js
ExchangeAPI.bybit = {
  name: "Bybit",
  fetchTrades: async (...) => { /* ... */ },
  fetchOpenPositions: async (...) => { /* ... */ },
  detectPartials: t => t,  // no-op tot we Bybit-specifieke partial-logica nodig hebben
  captureSnapshot: async (...) => { /* ... */ },
};
```

Dispatcher in App roept altijd `ExchangeAPI[ex].method(...)`, nooit een if/else op exchange-naam.

## Consequences

### Positief
- ✓ **Blofin-bug raakt MEXC niet** — bewezen via `tests/exchange-isolation.spec.js`
- ✓ **PR-review** kan per adapter focussen, geen cross-exchange impact-analyse nodig
- ✓ **Snapshot-pattern** standaardiseerbaar per exchange (`captureSnapshot` adapter-method)
- ✓ **Nieuwe exchange** = nieuw adapter-object, geen aanpassingen in App-niveau code
- ✓ **Worker-bug fixes** (zoals SL-as-TP heal in `normalizeTrade`) scopen makkelijk via `ExchangeAPI[source]` check

### Negatief / acceptabel
- 😐 Lichte code-duplicatie tussen adapters (vooral utility-functies zoals `_normalise`)
- 😐 Nieuwe shared helper toevoegen vereist discipline om geen exchange-aannames in te bouwen
- 😐 Tests per adapter nodig (geen 1 universele exchange-test mogelijk)

### Implicaties voor coding
- **`source !== "manual"` is GEEN goede scope-check** voor exchange-only logica (custom account-names hebben source != "manual"). Gebruik `ExchangeAPI[source]` check (zie ADR consequenses van v12.133).
- **Per-exchange snapshot-knoppen** worden gerendered via `ExchangeAPI[ex].captureSnapshot` — toevoegen aan nieuwe exchange = automatisch zichtbaar in dev-mode
- **Refactor-discipline**: bij twijfel of helper exchange-aannames heeft, splits 'm bij de eerste bug-fix (niet patchen met `if`-statement)

### Wanneer heroverwegen
- Als exchange-aantallen > 10 en code-duplicatie tussen adapters > 50% — overweeg een `BaseAdapter` class met override-pattern
- Als shared helpers > 5 en ze allemaal `if (exchange === ...)` switches krijgen — herzie scope-grens

## Anti-patterns (vermijd)

```js
// ❌ if-statement op exchange in shared scope
function syncOpenPositions(ex, opens) {
  if (ex === "blofin") {
    // Blofin-specifiek
  }
}

// ❌ source !== "manual" als scope voor exchange-only logica
if (trade.source !== "manual") {
  // dit raakt ook custom accounts ("Bybit Demo") = NIET wat je wilt
}

// ✅ Adapter-dispatch
const updated = ExchangeAPI[ex]?.detectPartials?.(trades) ?? trades;

// ✅ Exchange-API check voor scope
const isExchangeSrc = ExchangeAPI[trade.source];
if (isExchangeSrc) {
  // alleen voor echte exchange-imports
}
```

## Referenties

- [CLAUDE.md](../../CLAUDE.md) "Exchange-architectuur" sectie
- [CONTEXT.md](../../CONTEXT.md) "Exchange-architectuur (per-adapter isolation)" + "Source-architectuur"
- [tests/exchange-isolation.spec.js](../../tests/exchange-isolation.spec.js) — regressie-test dat een Blofin-aanroep geen MEXC-trades raakt
- ADR [0001-single-file-html](0001-single-file-html.md) — context waarom we niet voor een meer-module architectuur kiezen
