# SyncJournal — Exchange-sync fase 2 (plan + status)

**Datum plan:** 2026-09-14 · **Baseline:** commit `5bec159` (v0.9.44).
**Status bijgewerkt:** 2026-09-25 (v0.9.135) — fase 2 is afgerond, op één praktijkcheck na.
**Afspraak:** oude `work/tradejournal.html` is bevroren; alles hieronder landt alleen in SyncJournal.

## Hoe het was (fase 1, v0.9.43–44)

- Zes adapters geport uit tradejournal v12.235 (MEXC/Blofin/Kraken/Hyperliquid/OKX/FTMO) + proxyCall/rate-limit + detectPartialFromSiblings (nog ongebruikt).
- Sync haalt alleen **gesloten** trades op; dedupe op bron-id (`srcId`); prullenbak-guard; incrementeel venster (lastSync − 1u).
- MEXC deprecated (geen live koppeling; trades blijven; CSV/back-up-route). Kraken Futures toegevoegd.
- Open posities, partial-detectie, TP-backfill: **niet** aanwezig.
- Spec: `tests/exchange-sync.spec.js` (23 checks, echte Kraken-snapshot offline).

## Fase 2 — scope en status

| # | Onderdeel | Status | Waar het zit |
|---|-----------|--------|--------------|
| 1 | **Open posities & placeholders** — `syncOpenTrades` per exchange; open rijen met entry/size/SL/TP; voor round-trip-exchanges (HL/Kraken/OKX, Blofin sinds v0.9.128) is de open rij een placeholder die door de echte trade uit de historie wordt vervangen, user-velden verhuizen mee. | ✅ klaar | `syncExchange` → `syncOpenTrades` → `finalizePlaceholders`; `openIsPlaceholder` per adapter; specs `okx-positie`, `hl-open-tijd`, `blofin-levensloop`, `okx-partial-herstel` |
| 2 | **Partial closes & TP-detectie** — status `partial` met stappen; deels gesloten positie is één rij (v0.9.128, schema-migratie v8 voor bestaande profielen); partial-detectie via de adapter van de exchange zelf. | ✅ klaar | `ExchangeAPI[ex].detectPartials`, `zelfdePositieSJ`, `herlabel`-guard in `refreshFromSync`; specs `okx-partial`, `partial-alle-exchanges` |
| 3 | **Hyperliquid-reconstructie v2** — "Model B" (v0.9.113): één positie-levensloop = één trade, alle fills als stappen. Begint een levensloop met een sluiting (open-fill buiten het sync-venster), dan wordt de instap afgeleid: `entry = px − richting × closedPnl/sz`, getoond als synthetische stap (≈) met notitie. Geen N/A-trades meer. Zelfde model daarna voor Blofin (v0.9.116) en Kraken (v0.9.119). | ✅ klaar | `ExchangeAPI.hyperliquid._reconstructTrades` (`synthetic:true`, `voorstuk`); specs `hyperliquid-levensloop`, `hl-open-tijd` |
| 4 | **OKX EEA** — `eea.okx.com` + X-Perps (`instType=FUTURES`); adapter + Worker-diff (deploy extern door Denny). | ✅ klaar | `ExchangeAPI.okx` (EEA-host in de adapter), Worker-code in `docs/worker-okx-complete.js`; specs `okx-levensloop`, `okx-subtype` |
| 5 | **Sync-hardening** — oplopende cooldown per exchange bij 429 / Cloudflare 1015 met proactief overslaan tijdens de backoff; een 200-antwoord met `error`-veld wordt als fout behandeld (en als rate-limit herkend); Kraken haalt zijn stappen expliciet uit de positie-gebeurtenissen (v0.9.126–127); fills per sync gemaximeerd (`FILL_MAX_PER_SYNC=8`, retentie 90 dagen, herkansing na een week). | ✅ klaar | `_rlBackoff`/`proxyCall`, `FILL_*`-constanten bij `backfillFills`; specs `auto-sync`, `robustness`, `kraken-levensloop` |

## Nog open

- **Praktijkcheck Hyperliquid auto-sync.** De melding van 2026-09-03 ("gesloten trade blijft open zolang alleen de auto-sync draait") kwam uit de oude TradeJournal. In SyncJournal loopt de auto-sync (`autoSyncRun`) door exact hetzelfde pad als de handmatige refresh (`syncExchange`: open posities, dan volledige historie, dan placeholder-afronding), dus het scope-verschil dat de bug veroorzaakte bestaat hier niet. Te bevestigen door Denny: een HL-positie sluiten en alleen de auto-sync laten lopen. Sluit hij, dan is dit punt weg.

## Expliciet buiten scope

MEXC live (deprecated; MEXC vertrekt uit NL op 16-11-2026, history exporteren vóór 31-10) · CSV-import (los traject) · oude app (bevroren) · coach-feedback-ronde.

## Vervolg (niet fase 2, wacht op go)

- Funding-fees per exchange (onderzoek klaar; volgorde HL → Kraken → Blofin).
- Bybit EU (verkennend; perps daar nog niet live).
