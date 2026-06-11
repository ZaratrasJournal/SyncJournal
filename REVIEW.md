# REVIEW.md — Code Review & Test Audit

**Fase 1 — Inventarisatie** · uitgevoerd 2026-06-10/11 (nacht-sessie) · branch `review/journal-audit` · basis: v12.232 (`4da2f09`)

> Doel: weten waar we staan vóór we iets aanraken. Geen code-wijzigingen in deze fase.
> Fase 2 (correctheid berekeningen) is de eerstvolgende en belangrijkste vervolg-sessie.

---

## 1. Structuur: modules, verantwoordelijkheden, datastromen

**App-type:** single-file HTML + JSX (`work/tradejournal.html`, ~20.800 regels), React 18 via Babel-in-browser. Release-mirror in `main/tradejournal.html`. Geen bundler, geen package-dependencies in de app zelf.

### 1.1 Module-kaart (regelnummers ≈ v12.232)

| Module | Regels (±) | Verantwoordelijkheid |
|---|---|---|
| Constants & storage-utils | 1243–1537 | `tj_*` localStorage helpers, IndexedDB (`morani_trades_v1`), storage-usage |
| R-multiple & PnL-helpers | 1540–1675 | `calcRMultiple`, `computeFtmoMedianLoserSlPct`, `calcTheoreticalPnl`, `calcExpectancy` |
| Partial-close detectie | 1716–1854 | `detectPartialFromSiblings(trades, sourceKey, exchangeType)` — pure, testbaar |
| Schema & normalisatie | 1918–2610 | `EMPTY_TRADE` (±45 velden), `normalizeTrade` (price-norm, SL-as-TP heal, size-reheal), `migratePlaybooks` |
| Account/kapitaal-helpers | 2870–3120 | `resolveAccountLabel/Type`, **`sourceTypeOf`/`sourceLabelOf` registry (v12.232)**, `computeAccountCapital`, `computeTotalBalance`, `getCapitalForSource`, `buildUnifiedAccounts` (migratie), `computeTradeRisk` |
| ExchangeAPI-adapters | 3373–3970 | MEXC / Blofin / Kraken / Hyperliquid / FTMO(CSV-only): `fetchTrades`, `fetchOpenPositions`, `fetchFills`, `detectPartials`, `testConnection` |
| UI-kleincomponenten & hooks | 3977–4259 | ExchangeIcon, live tickers, klok, live balances |
| TopBar | 4260–4314 | balans, daily DD, risk%, sync-status |
| Equity-chart | 4643–4743 | `tradesToEquity`, daily aggregatie, DD-overlay |
| Dashboard | 4801–5086 | KPI's, PnL-grafiek met per-account chips |
| Trades-lijst + merge | 5091–5666 | tabel, filters, bulk, MergeModal (FTMO multi-TP workaround) |
| Trade-report & share-cards | 5667–6642 | export-rendering, periodieke stats (incl. Sharpe/Sortino/Calmar) |
| TradeForm | 6824–7862 | invoer, TP-levels, layers, playbook-compliance, auto-PnL |
| FilterBar | 7864–8015 | quick-pills + geavanceerde filters (per-account sinds v12.232) |
| Kalender / Discipline / Analytics | 8017–12003 | heatmaps, tendencies, sessie-matrix, playbook-stats |
| Review-dashboard | 12978–14066 | milestones, insights |
| Accounts-hub (Instellingen) | 14067–16349 | account CRUD, CSV-import (per exchange-formaat), API-sync/refresh, backup/restore |
| AI-coach (Mori) | 17025–19141 | BYOK Claude API, privacy-modus |
| Backup-bewaker | 19244–19532 | FSA auto-backup, 7d-reminder |
| Main `App` | 19533–20805 | alle state, lifecycle, migraties, `importTrades`, `syncOpenPositions`, auto-sync |

### 1.2 Datastromen — trades

**Binnenkomst (4 routes):**
1. **Handmatig** — TradeForm → `setTrades` (App, ±20172).
2. **CSV/XLSX** — `handleCSV` (±14472): formaat-detectie op headers → per-exchange parser (Blofin FIFO-reconstructie, MEXC futures/position, Kraken log, FTMO MetriX positioneel, Hyperliquid fills-FIFO) → preview → `importTrades`. Sinds v12.231 gescoped op gekozen account (`source = account.id`).
3. **API-sync** — per account: `refresh()` (±15080) = `fetchOpenPositions` → `syncOpenPositions` → `fetchTrades` → `scopeSource` → `importTrades` → TP-fills fetch. Auto-sync elke 15/30/60 min (±19805) over alle gekoppelde accounts.
4. **Backup-restore** — drop/knop → optionele migratie → `importTrades`.

**Identiteit & dedup:** stable trade-ids per exchange (`blofin_<posId>_<ts>`, `ftmo_csv_<ticket>_<ts>`, …); `importTrades` dedupt op id + FTMO compound-key (positionId+openTime) + merge-aware skip (`mergedFrom`). Open posities krijgen account-genamespacede ids (`scopeToAccount`), closed bewust niet (`scopeSource`) — dedup-historie zit in CHANGELOG v12.231.

**Opslag:**
- **IndexedDB** `morani_trades_v1` — primair voor trades (geen quota-probleem).
- **localStorage** `tj_trades` — backup-kopie zonder screenshots; `tj_config`, `tj_accounts`, `tj_playbooks`, `tj_goals`, + ~20 feature-keys.
- Load-volgorde (±19542): IDB → leeg? → localStorage-migratie → `normalizeTrade` op alles → `tradesLoaded=true` → daarna pas migratie-effecten.
- **File System Access** auto-backup (7 dagen, 4 nieuwste bewaard).

**Afgeleide cijfers (consumenten):** TopBar-balans, Dashboard-KPI's, Analytics (±8599–12003), TradeReport, Playbook-stats, Goals, AI-coach context.

### 1.3 Schema & migraties

| Migratie | Waar | Wat |
|---|---|---|
| `CURRENT_SCHEMA_VERSION = 12` | 1685 | export-payload marker |
| `normalizeTrade` | 2453–2610 | price-normalisatie, screenshot→screenshots[], SL-als-TP heal, size-reheal via PnL-math |
| `migratePlaybooks` | 1918–1964 | tags → layers-model |
| `migrateGoals` | 3098 | legacy goals → items[] |
| **Multi-account migratie** (v12.231/232) | `buildUnifiedAccounts` ±3000 + effect ±20015 | `config.exchanges` + losse accounts → unified `accounts[]`; `trade.source` → `account.id`; pre-migratie-backup in `tj_premigration_backup`; v12.232: reparatie-pass voor legacy type-string sources |

---

## 2. Testsuite-inventarisatie

**Tooling:** uitsluitend Playwright E2E-specs (headless Chromium) tegen `work/tradejournal.html` via `file://`, met localStorage-seeding (`tests/helpers/seed.js`) en JSON-fixtures. **Er is géén unit-test-runner voor pure functies** — formules worden alleen indirect (via de UI of localStorage-assertions) of ad-hoc (`node -e`, `tests/run-adhoc.js`) getest.

**Omvang:** 76 spec-files, **370 tests** (`npx playwright test --list`).

**Clusters (globaal):**
- Exchange-pipelines: `blofin-*` (5), `mexc-*` (10), `kraken-*` (2), `hyperliquid-*` (2), `exchange-*` (3), `scenarios-klmn`, `walletonly-source` — grootste en sterkste cluster; gebruikt real-data snapshots en 3-way vergelijkingen.
- Multi-account: `multi-account-*` (4, waarvan `multi-account-sources` nieuw in v12.232), `account-*` (2).
- Balans/PnL-weergave: `dashboard-balance`, `dashboard-orphan-pnl`, `balance-no-open-doublecount`, `pnl-calc-button`, `merged-rr`.
- Merge: `merge-trades`, `merge-manual-account`.
- AI-coach: 13 specs. Backup: 2. Thema's/design: `themes`, `design-review` (pixel-diff baseline), `lesson-*`, `theme-toggle`. A11y: `a11y` (axe-core, alleen `critical` blokkeert). Overig UI: ~10.
- `smoke.spec.js` — laadt app, versie-check, geen JS-errors.

**Volledige run (deze sessie, na v12.232):** zie §2.1 hieronder.

### 2.1 Testrun-resultaat (volledige suite, 2026-06-10 nacht, v12.232)

```
npx playwright test   →   311 passed · 12 skipped · 0 failed   (1.0 uur, exit 0)
```

- **Geen harde failures.** Wel een **flaky cluster** dat alleen op retry slaagde en bij losse runs reproduceerbaar faalt:
  - `tag-delete-modal.spec.js` (5 van 7 tests), `tendencies-untagged.spec.js` (2), `merge-manual-account.spec.js` (1, "zombie-protect"), en ~20 `design-review.spec.js` combinaties.
  - **Oorzaak (geverifieerd):** click-timeout — *"`<div>…</div>` intercepts pointer events"*. Een overlay (vermoedelijk de milestone-popup "Eerste winst!" en/of een modal uit de v12.231 accounts-redesign) ligt over de UI wanneer de seed-data winnende trades bevat en `tj_milestones_seen` leeg is. **Pre-existing**: reproduceert identiek op v12.231 (`ec6efc3`), dus geen v12.232-regressie.
  - **Aanbeveling:** seed-helper standaard `tj_milestones_seen` laten vullen (of milestone-popup dismissen in een gedeelde test-setup) — quick win die ~28 flaky tests stabiliseert. Hoort bij fase 3.
- 12 skipped = bewuste skips (o.a. specs die een ontbrekende fixture/baseline detecteren).
- Een eerdere zwakte vandaag al gevonden: `blofin-partial.spec.js` test 2 asserde op `page.content()` dat ook de broncode matcht (altijd-groen assertie); test 1 is in v12.232 aangescherpt naar het account-id-model.

**Bekende beperkingen van de suite:**
- E2E-only: een formule-bug die "plausibele" cijfers oplevert valt niet op zonder handmatig geverifieerde verwachtingswaardes.
- ~5s Babel-compile per pageload maakt de suite traag (370 tests ≈ 25–45 min) → wordt zelden integraal gedraaid.
- Sommige oudere specs asserten op brede signalen (bv. `page.content()` bevat "PARTIAL" — matcht ook de broncode in het script-blok, dus altijd groen). Voorbeeld: `blofin-partial.spec.js` test 2.
- Geen live-API-tests (bewust: credentials bij Denny; snapshot-fixture-patroon is de brug).

---

## 3. Financiële berekeningen — inventaris + dekking

Legenda dekking: ✅ directe test · 🟡 indirect (E2E raakt het pad, geen waarde-assertie met handmatig geverifieerde verwachting) · ❌ geen test.

### 3.1 PnL

| Berekening | Functie | Regels | Dekking | Notitie |
|---|---|---|---|---|
| Netto PnL per trade | `netPnl(t)` | 2005–2028 | 🟡 (balance-specs, 3-way specs) | **Kern van bijna alles.** Manual-type: `pnl − fees`; exchange: `pnl` as-is; missed/BT: theoretisch. v12.232: type-check via `sourceTypeOf`. |
| Theoretische PnL (missed/BT/paper) | `calcTheoreticalPnl` | 1654–1663 | ❌ | TP-gewogen exit of hindsightExit. |
| Auto-PnL knop (manual) | TradeForm ±7242 | 🟡 `pnl-calc-button.spec` | `(exit−entry)×size/entry − fees`, richting-bewust. |
| TP-sluit-suggestie | TradeForm ±7357–7400 | ❌ | gewogen exit uit hit-TPs; alleen manual-type. |

### 3.2 R-multiple & R:R

| Berekening | Functie | Regels | Dekking | Notitie |
|---|---|---|---|---|
| R-multiple | `calcRMultiple(trade, ftmoCtx)` | 1567–1640 | ❌ (alleen `merged-rr.spec` voor merged-trades-pad) | Twee paden: FTMO (dollars-per-point + 3-traps SL-fallback: CSV-SL → mediaan-loser-SL → 0.4%) en crypto (`risk×size/entry`). Complexste financiële functie in de app. |
| Mediaan loser-SL% | `computeFtmoMedianLoserSlPct` | 1546–1562 | ❌ | <3 losers → null; outliers >5% uitgefilterd. |
| R:R per trade/TP | `trGetR` ±6179, TP-RR ±7457, analytics ±12677 | ❌ | drie aparte inline-implementaties. |

### 3.3 Aggregaten (win rate, expectancy, PF, Sharpe…)

| Berekening | Waar | Regels | Dekking |
|---|---|---|---|
| Win rate | inline op ≥3 plekken | 3086, 6210, 12135 | ❌ (waarde), 🟡 (rendering) |
| Expectancy | `calcExpectancy` | 1664–1675 | ❌ |
| Profit factor | inline | 3092, 6211 | ❌ (let op `Infinity`-pad bij 0 verlies) |
| Sharpe / Sortino / Calmar | inline in TradeReport | ±6253–6254 | ❌ (annualisatie ×√252; deling-door-nul guards aanwezig) |
| Max drawdown | inline op ≥3 plekken | 3091, 6220–6222, 12153 | ❌ — drie duplicaten van hetzelfde peak-to-trough loopje |

### 3.4 Risico & kapitaal

| Berekening | Functie | Regels | Dekking |
|---|---|---|---|
| Risk per trade | `computeTradeRisk` | 3110–3119 | ❌ — `riskUsd = |entry−SL|×size/entry`, `riskPct = riskUsd/capital` |
| Account-kapitaal | `computeAccountCapital` | 2934–2944 | 🟡 (multi-account specs) — correction = absolute setpoint |
| Totale balans (TopBar/Dashboard) | `computeTotalBalance` | 2968–3050 | ✅/🟡 `dashboard-balance`, `balance-no-open-doublecount`, `dashboard-orphan-pnl` |
| Kapitaal per source | `getCapitalForSource` | 2952–2961 | 🟡 |
| Dag-risico % | TopBar ±4286 | ❌ |

### 3.5 Partial-close & reconstructie (raakt PnL/fees direct)

| Berekening | Functie | Regels | Dekking |
|---|---|---|---|
| Partial-detectie + fee/TP-aggregatie | `detectPartialFromSiblings` | 1716–1854 | ✅ `blofin-partial`, `mexc-*`, `scenarios-klmn`, 3-way specs |
| Stale-open finalize (2 duplicaten!) | `importTrades` ±20260; `syncOpenPositions` ±20348 | 🟡 — zelfde aggregatie-logica 2× gekopieerd naast de pure functie |
| Size-reheal via PnL-math | `normalizeTrade` | 2535–2572 | ✅ `mexc-size-rehel*.spec` |
| FIFO CSV-reconstructie | `handleCSV` per exchange | 14472–14834 | 🟡 (real-data specs dekken API-pad beter dan CSV-pad) |

### 3.6 Floating-point & precisie-observaties (input voor fase 2)

- Geld rekent overal in JS-floats; afronding via `toFixed(2/4)` op **strings** die later weer geparsed worden (`pnl:"16.6700"` → parseFloat). Cumulatieve sommen (equity, balans) ronden niet tussentijds — goed — maar vergelijkingen als `Math.abs(cur−net)>0.01` (±6938) en `>$1 drift` (TP-suggestie) zijn impliciete toleranties.
- `parseFloat` op lege strings → NaN; meestal gefilterd, maar elk nieuw aggregaat moet dit zelf onthouden (geen centrale `money()`-helper).
- Deling-door-nul guards zijn aanwezig maar per-plek (entry===SL, stdev>0, `Math.max(peak,1)`); drie gedupliceerde drawdown-loops kunnen uiteenlopen.

---

## 4. Top 5 risicogebieden

Criteria: complex × ongetest × directe invloed op trading-beslissingen.

1. **`calcRMultiple` + FTMO-fallback-keten (1546–1640)** — ❌ geen enkele directe test; drie fallback-niveaus met magic numbers (0.1% trail-drempel, 0.4% default, 5% outlier-cap). R-multiple stuurt playbook-stats, grading en Denny's FTMO-evaluatie. Een stille fout hier verandert welke setups "werken". *(Vandaag nog bewezen kwetsbaar: het hele FTMO-pad was sinds v12.231 dood door de source→account-id wissel — zichtbaar geworden als cosmetische chip-bug, maar feitelijk rekende elke FTMO-trade met de crypto-formule.)*
2. **`netPnl` manual-vs-exchange fee-semantiek (2005–2028)** — de aanname "exchange-PnL is al netto, manual niet" is nergens als test vastgelegd terwijl élk statistiekgetal erdoorheen loopt. v12.231 brak dit voor manual-accounts (fees niet afgetrokken); v12.232 fixt het, maar zonder unit-test kan het opnieuw stilletjes breken.
3. **Stale-open finalize-duplicaten (importTrades ±20260 én syncOpenPositions ±20348 naast `detectPartialFromSiblings`)** — drie kopieën van fee/TP/size-aggregatie die synchroon moeten blijven; muteren trades destructief (siblings worden verwijderd). Een divergentie = dubbele of verdwenen trades/fees. De v12.231 dup-bug kwam precies uit deze hoek.
4. **Multi-account migratie + reparatie-pass (±3000, ±20015)** — herschrijft `trade.source` van de volledige dataset bij load; one-shot met `tj_premigration_backup` als vangnet, maar het restore-pad van die backup is ongetest en de migratie bleek al twee bugs te bevatten (orphan→"manual" attributieverlies; race die partial-detectie overschreef — beide gefixt in v12.232).
5. **Inline aggregaat-duplicaten in Analytics/TradeReport (winrate/PF/maxDD/Sharpe, ±6200–6260 en ±12100–12160)** — zelfde formules 2–3× gekopieerd zonder tests; schermen kunnen van elkaar gaan afwijken zonder dat iemand het merkt ("Dashboard zegt PF 1.8, Report zegt 1.6").

**Bubbelend onder de top-5:** CSV-parsers (FIFO-reconstructie Blofin/Hyperliquid — complexe state-machines, alleen happy-path gedekt), `computeTotalBalance` (cascade van live-balances/tx/orphans), en het ontbreken van een centrale geld-helper.

---

## Aanbevolen aanpak fase 2 (vooruitblik, geen actie nu)

1. Pure functies zijn al goed geïsoleerd (`calcRMultiple`, `netPnl`, `calcExpectancy`, `detectPartialFromSiblings`, `computeAccountCapital`, `computeTradeRisk`) → extraheer ze in de testcontext door het script-blok in Node te evalueren (of via een kleine Playwright-`page.evaluate` harness) en schrijf **waarde-asserties met handmatig narekenbare voorbeelden** (long/short, winst/verlies/break-even, 0/1/n trades, entry==exit, lege velden).
2. Schrijf de fee-semantiek (netPnl) en de FTMO R-keten als eerste vast — hoogste impact.
3. Eén gedeelde drawdown/aggregaat-helper afdwingen kan pas in fase 4 (refactor), maar fase 2 kan de drie duplicaten alvast tegen elkaar testen (zelfde input → zelfde output).

---

## Fase 2 — resultaat (2026-06-11)

**Aanpak:** nieuwe spec [tests/calc-unit.spec.js](tests/calc-unit.spec.js) — 30 unit-tests die de pure reken-functies rechtstreeks in de geladen app aanroepen (één pageload, `page.evaluate`), met **handmatig narekende verwachtingswaardes** (berekening per case in de comments). Dekt: `netPnl`, `calcRMultiple` (crypto- én FTMO-pad incl. alle drie SL-fallback-niveaus), `computeFtmoMedianLoserSlPct`, `calcTheoreticalR/Pnl` (hit/missed/mix-TPs), `calcExpectancy`, `computeAccountCapital`, `computeTradeRisk`, `sourceTypeOf` en de aggregatie-math van `detectPartialFromSiblings` (incl. ghost-geval). Edge-cases: 0/1/n trades, long vs short, break-even, entry==SL, lege/ongeldige velden, ontbrekende size.

### Gevonden bugs (test eerst rood → analyse → fix → groen)

| # | Bug | Waar | Analyse & impact op cijfers tot nu toe |
|---|---|---|---|
| 1 | **`calcRMultiple`: `size \|\| 1`-fallback** | ±1598 | Trade zonder positionSize kreeg R = pnl/(risk×1/entry) → waardes in de duizenden. Vervuilde avgR, R-distributie en playbook-stats zodra een (meestal handmatige) trade size miste. Nu: geen size → `null` ("—"), consistent met ontbrekende SL. |
| 2 | **`calcExpectancy`: break-evens gewogen als verliezers** | ±1668 | Klassieke formule `(WR×avgWin)−((1−WR)×avgLoss)` stopt break-even trades in de verlieskans mét avgLoss-gewicht: [+100, 0, −50] gaf 0 i.p.v. 16.67. Week ook af van de GOAL_METRICS-definitie ("gemiddelde PnL per trade") én van de goals-compute die al som/n deed. Nu som/n — wiskundig identiek zodra er geen break-evens zijn, dus bestaande cijfers zonder BE-trades veranderen niet. |
| 3 | **Ghost-partial heuristiek nulde runners weg** | ±1770 | `closedAsset ≥ rest×0.99` vuurde ook bij legitiem >50% gesloten posities (TP1 50% + TP2 25% hit, 25% runner open) → `originalSizeAsset` te klein en TP-percentages opgeblazen (66.7/33.3 i.p.v. 50/25). Geld (realizedPnl/fees/status) was correct; de TP-breakdown-weergave niet. Nu alleen ghost bij ≈gelijkheid (±1% band); exact-50%-dicht blijft inherent ambigu → bewust ghost-interpretatie (gedocumenteerd in test + comment). |
| 4 | **Review-dashboard maxDD: `peak = −Infinity`** | ±13923 | Wanneer de periode met netto verlies begint werd het eerste dal zelf de peak → drawdown onderschat (bv. −100, −50 → DD 50 i.p.v. 150). De andere 5 maxDD-implementaties starten op 0 (= equity vóór de eerste trade). Nu consistent. |
| 5 | **TradeReport per-account tabel las niet-bestaande velden** | ±6240 | Bucketing op `t.accountId`/`t.exchange` — velden die niet op het trade-schema bestaan → álles werd "Manual". Tabel was feitelijk dood. Nu via `sourceDisplayName(t.source)`. |

### Bewust NIET gewijzigd (gedocumenteerde quirks)

- **Sharpe/Sortino in TradeReport (±6264)**: daily returns over álle kalenderdagen in het venster (niet-handelsdagen = 0) gecombineerd met √252-annualisatie — definitie is "rough" (eigen comment) en wijzigen verschuift user-zichtbare cijfers zonder bug-bewijs. Genoteerd voor evt. fase 4.
- **Calmar (±6264)**: `net ($) / maxDD (%)` — eenheden kloppen formeel niet (ratio-score, geen echte Calmar). Zelfde afweging.
- **FTMO break-even (pnl=0)**: R = `null` i.p.v. 0 — dollars-per-point is niet afleidbaar zonder pnl; inherente beperking van de afleiding (test gedocumenteerd).
- **`computeTradeRisk` rondt riskUsd af vóór riskPct** — afwijking < $0.005, verwaarloosbaar.

### Teststand na fase 2

- `calc-unit.spec.js`: **30/30 groen**.
- Regressie op alle financieel-relevante clusters: blofin (4 specs), mexc (4), kraken/hyperliquid 3-way, scenarios-klmn, balance (3), merged-rr, pnl-calc-button, multi-account-sources, smoke → **97/97 groen**.
- Ghost-band-wijziging (bug 3) expliciet geregresseerd tegen alle exchange-pipeline specs — geen gedragsverschil buiten het gefixte pad.

**Release-notitie:** fixes staan op branch `review/journal-audit`. Version-bump (v12.233) + CHANGELOG + `cp work → main` volgens release-flow uitvoeren **bij merge naar main** — niet vanaf deze branch.

---

## Fase 3 — resultaat (2026-06-11)

**Aanpak:** twee parallelle audits (datum/tijdzone-gebruik; opslag/error-handling/data-integriteit) over de hele file, daarna fixes op de dataverlies- en verkeerde-dag-categorie met nieuwe spec [tests/integrity-edge.spec.js](tests/integrity-edge.spec.js) (3 tests, o.a. met gemockte klok op 00:30 lokale tijd).

### Gevonden & gefixt

| # | Bug | Ernst | Details |
|---|---|---|---|
| 1 | **Kalender structureel één dag verschoven** | Hoog | Jaar-heatmap + maandkalender bouwden dag-keys via `new Date(j,m,d).toISOString()` → voor elke tijdzone oost van UTC (heel NL) droeg cel "11 juni" de key van 10 juni: dag-PnL onder het verkeerde dagnummer, "vandaag"-highlight op morgen. Geverifieerd met Node vóór de fix. |
| 2 | **"Vandaag" was de UTC-dag** | Hoog | `new Date().toISOString().split("T")[0]` op ±14 plekken (EMPTY_TRADE-default, `newEmptyTrade`, FilterBar Vandaag/Week/Maand-pills, Dashboard/TopBar dag-stats, goals, kapitaal-transacties, rapport-bereik, backup-bestandsnamen): tussen 00:00 en 01:00/02:00 lokale tijd werden trades op GISTEREN geboekt en pakten dag-filters de verkeerde dag. Nieuwe helpers `localDateISO()`/`localTimeHM()` (±1424), overal doorgevoerd. |
| 3 | **`ts2date`/`ts2time` inconsistent paar** | Hoog | date was UTC, time was lokaal → een exchange-fill om 23:30Z kreeg `date=gisteren` met `time=01:30`. Nu beide lokaal (zelfde patroon als de CSV-import-paden al deden). Raakt Blofin/Kraken API-imports; bestaande trades behouden hun opgeslagen datum (geen migratie — alleen nieuwe imports). |
| 4 | **Backup-import accepteerde rommel** | Hoog | Een JSON-array met niet-trade items (`[1,"x",null]`) werd over `EMPTY_TRADE` gespread → lege "vandaag"-trades in de journal. Nieuwe pure helper `sanitizeBackupTrades()` in beide restore-paden (drag-drop + Instellingen-knop): filtert, rapporteert geskipte regels, weigert bestanden zonder één geldige trade. |
| 5 | **IndexedDB-save faalde stil** | Hoog | `idbSaveAllTrades` → `false` → alleen `console.warn`; localStorage-fallback faalt óók stil bij quota. User dacht dat alles opgeslagen was. Nu één duidelijke toast ("maak nu een backup") bij de eerste failure, zonder spam (ref-guard, reset bij herstel). |
| 6 | **Dubbel-klik op Opslaan → trade 2× in state** | Midden | `isNew` werd buiten de state-updater berekend op een stale closure. Insert is nu idempotent op id bínnen de updater. |
| 7 | **Draft-restore zonder normalize/id** | Midden | Een crash-draft kon zonder id en met floating-point-ruis de journal in. Draft gaat nu door `normalizeTrade` + id-garantie vóór de restore-prompt. |

### Bewust uitgesteld (genoteerd, geen fix nu)

- **CSV-`source:"csv"` vs API-id dedup-gat** (zelfde positie via generieke CSV én API = mogelijk dubbel) — niche-pad; vereist per-exchange compound-keys. → backlog.
- **Multi-step restore niet atomair** (trades/tags/accounts via losse setters) — laag praktisch risico (sync setters in één handler), grote refactor. → fase 4-kandidaat.
- **Week-start/`setDate`-iteraties rond DST** — max 1 uur/jaar effect, cosmetisch in rapport-buckets.
- **Auto-backup FSA-write**: `createWritable()` staget al en commit pas op `close()` — half-geschreven-file-risico is kleiner dan de audit suggereerde; error-pad zit in bestaande try/catch van de bewaker.
- **ErrorBoundary dekt geen event-handlers/effects** — inherent aan React; crash-melding komt via console. → documentatie.

### Teststand na fase 3

- `integrity-edge.spec.js`: **3/3 groen** — middernacht-klok (00:30 lokaal: EMPTY_TRADE/kalender/ts2date allemaal 11 juni terwijl UTC nog 10 juni zegt), sanitize-unit, en E2E garbage-import (3 geseedde trades blijven onaangeroerd + fout-toast).
- Brede regressie over smoke, calc-unit, exchange real-data (blofin/kraken/HL/mexc), backup-specs, multi-account, AI-coach weekly: zie Run-log.

**Flaky-cluster quick-win uit fase 1 (milestone-popup blokkeert clicks in specs) is NIET in deze fase opgepakt** — aparte, puur test-infrastructurele wijziging; staat op de fase-4 lijst.

---

## Run-log

- 2026-06-10 (avond): v12.232 gereleased (lokaal, niet gepusht) met multi-account source-fixes; `smoke`, `themes` (6), `blofin-partial` (2), `multi-account-sources` (1) groen.
- 2026-06-10 (nacht): volledige suite — **311 passed / 12 skipped / 0 failed in 1.0 uur** (zie §2.1, incl. flaky-cluster-analyse).
- Flaky-verificatie: `tag-delete-modal` Pad A faalt reproduceerbaar standalone op zowel v12.232 als v12.231 → pre-existing overlay-probleem, geen regressie.
- 2026-06-11 (fase 3): regressie na datum/integriteit-fixes — **84 passed / 2 skipped** over smoke, calc-unit, exchange real-data (blofin/kraken/HL/mexc), backup-specs, multi-account, integrity-edge. Eén failure: `aicoach-weekly` "topbar indicator due" — **pre-existing** (reproduceert identiek op pre-fase-3 commit), staat los van de datum-fixes.
