# SyncJournal — Exchange-sync fase 2 (plan + uitgangssituatie)

**Datum:** 2026-09-14 · **Baseline:** commit `5bec159` (v0.9.44) — `work/syncjournal.html` schoon gecommit.
**Afspraak:** oude `work/tradejournal.html` is bevroren; alles hieronder landt alleen in SyncJournal.

## Hoe het was (fase 1, v0.9.43–44)

- Zes adapters geport uit tradejournal v12.235 (MEXC/Blofin/Kraken/Hyperliquid/OKX/FTMO) + proxyCall/rate-limit + detectPartialFromSiblings (nog ongebruikt).
- Sync haalt alleen **gesloten** trades op; dedupe op bron-id (`srcId`); prullenbak-guard; incrementeel venster (lastSync − 1u).
- MEXC deprecated (geen live koppeling; trades blijven; CSV/back-up-route). Kraken Futures toegevoegd.
- Open posities, partial-detectie, TP-backfill: **niet** aanwezig.
- Spec: `tests/exchange-sync.spec.js` (23 checks, echte Kraken-snapshot offline).

## Fase 2 — scope

1. **Open posities & placeholders** — `syncOpenTrades` per exchange; open rijen met entry/size/SL/TP; voor round-trip-exchanges (HL/Kraken/OKX) is de open rij een placeholder die bij binnenkomst van de echte trade wordt vervangen (v12.235-mechanisme: echte trade wint, user-velden verhuizen mee).
2. **Partial closes & TP-detectie** — geporte `detectPartialFromSiblings` aansluiten via een TJ-view-shim op SJ-trades; status `partial` + realizedPnl + opgebouwde TP-hits. Partial-eigen pnl blijft 0 (siblings dragen de gerealiseerde PnL in stats → geen dubbeltelling).
3. **Hyperliquid-reconstructie v2** — lone-close algebraïsch: `entry = px − richting × closedPnl/sz` (onderzoek 2026-09-14, live geverifieerd); geen N/A-trades meer. `dir`-strings → `startPosition`-rekenkunde en placeholder-open-tijd uit fills: vervolgstappen.
4. **OKX EEA** — `eea.okx.com` + X-Perps (`instType=FUTURES`); adapter + Worker-diff voor Denny (deploy extern).
5. **Sync-hardening** — cooldown, Kraken 200-met-error-envelop, history-pool-throttle.

Bouwvolgorde 1→2→3, daarna 4→5. Elke stap: eigen spec (snapshot-fixtures, offline) + volledige suite groen + commit.

## Expliciet buiten scope

MEXC live (deprecated) · CSV-import (los traject) · oude app (bevroren) · coach-feedback-ronde.
