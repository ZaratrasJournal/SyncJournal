# SyncJournal — Backlog

Werklijst voor Denny & Sebas. Staat per status gegroepeerd. Sluit een item af door hem naar **Done** te verplaatsen met korte notitie + PR-link.

Basis kwam uit de feature-diff v4_14 → v9 onderaan. Inmiddels werken we op **v12** (Sebas' nieuwe baseline) — diff is als referentie nog handig maar niet meer leidend.

---

## 🐛 Bugs (prio — eerst fixen)

<!-- Denny stuurt bugs 1 voor 1 — elk item krijgt datum + korte reproductiestap. -->

- [ ] **Trades-pagina toont andere PnL/WR dan Dashboard** *(2026-05-02, gevonden tijdens pro-trader review — zie [docs/pro-trader-review-2026-05-02.md](docs/pro-trader-review-2026-05-02.md) §2.2)* — Met blofin-partial-state.json fixture toont Dashboard "Net P&L -€8,37 · WR 33,3% · 15 trades" (correct) maar Trades-pagina header-stat-line toont "**-$11,43 · WR 27% · 15 trades**". Drie inconsistencies tegelijk: (a) valuta $ vs €, (b) bedrag −11,43 vs −8,37, (c) WR 27% vs 33,3%. Vermoedelijke oorzaak: PARTIAL-trades verschillend geclassificeerd (Trades-pagina telt 4/15 wins, Dashboard 5/15 — verschil = de 1 PARTIAL trade) + valuta-conversie niet consistent toegepast. **Critical** — pro-trader-vertrouwen breekt bij elke discrepantie. Fix: route alle PnL-berekeningen via `netPnl()` helper (regel 1133), één canonieke valuta-formatter via `config.currency`, één win-definitie (incl. of excl. PARTIAL — kies en documenteer).

- [ ] **Floating-point precision in trade-detail modal** *(2026-05-02, gevonden tijdens pro-trader review — zie [docs/pro-trader-review-2026-05-02.md](docs/pro-trader-review-2026-05-02.md) §2.9)* — Trade Edit-modal toont rauwe float-values: Entry `2255.5805555555557` (16 decimalen), PnL `-6.749084190000000001`. Op Trades-tabel staat de prijs wel afgekapt naar `2.355,58` — dus probleem zit alleen bij display in modal. **Critical** — pro-trader die deze ruis ziet vertrouwt de hele app niet meer. Fix: gebruik bestaande `normPrice()` helper (regel 1149) bij modal-render, of formatter met instrument-relevante precisie (BTC: 2 decimalen, ETH: 2, alts: 4-6).

- [ ] **Blofin partial-close → open trade koppeling** *(2026-04-30, deferred door Denny — work-in-progress teruggedraaid naar v12.59)* — Doel: een Blofin-positie met partial closes (bv. 22-04 BTC short open op 79000, TP1-hit 0.0010 op 29-04 op 75647) verschijnt nu als 2 losse trades (1 open in /positions + 1 closed in /positions-history) i.p.v. 1 trade met TP-niveau. Onderzoek tot dusver:

  **Aanpak afgewezen** — *Aggregator op positionId* (alle close-events van zelfde positionId mergen tot 1 trade met `tpLevels[]`). Gefaald door real-world data: 1 positie kan 32 close-events hebben (averaging-out, multi-TPs, hedges). Resulteert in onhandelbare trades met 32 tps + verwarrende open-datums (24-02 ipv close-datum). Plus: niet alle 32 records zijn echte TP-hits.

  **Aanpak getest** — *Match closed records aan open trades op `(pair, direction, entry-prijs)` triplet*. Idee van Denny: exacte entry-prijs komt zelden 2× voor toevallig. **Dit werkte niet voor Denny's data**: in haar import zaten 12 closed records, geen enkele met entry=79000 (haar nog-open BTC short). Mogelijke verklaringen die we niet hebben kunnen valideren:
    - (a) Partial-close records van de 79000-positie zitten buiten haar `syncFrom`-window (default 1 april) of buiten Blofin's `limit:100` per fetch — testen door syncFrom te verleggen naar bv. 2026-01-01 en kijken of entry=79000 records dan wel verschijnen.
    - (b) Blofin's `openAveragePrice` in `/positions-history` is geen vaste waarde over alle close-events van dezelfde positie maar verschilt per record (door averaging in/out, of een andere conventie dan we vermoeden) — testen door debug-knop te runnen, "Velden in eerste record" uitklappen, en de openAveragePrice van meerdere records vergelijken voor het 32-record positionId.
    - (c) De debug fetcht `limit:50` zonder startTime-filter (zag 4 unique positionIds, 46 records totaal), terwijl de import `limit:100` mét startTime gebruikt — verschil in resultaten kan 't issue zijn.

  **ccxt-research bevestigde**: er is geen open-source journal die Blofin partial-close aggregeert. ccxt heeft alleen single-record direction-detection (geen aggregator); BloFin.Net heeft het model maar geen aggregator-logic; Blofin's eigen SDK is een pure HTTP wrapper. We staan op eigen kracht.

  **Bellafiore-onderzoek opgemerkt**: Tradezella ondersteunt "Missed Trades" als hypothetische trades. In ons geval zou de partial-close mogelijk als TP-niveau op een open trade willen verschijnen, maar het tooling-pattern voor partial closes is open onderzoek.

  **Volgende stappen wanneer we 't weer oppakken**:
    1. Verleg syncFrom naar 2026-01-01, doe re-sync, kijk of entry=79000 close-records nu wel verschijnen (verklaring a).
    2. Klik debug-knop, klap "Velden in eerste record" uit, screenshot. Vergelijk openAveragePrice tussen records van zelfde positionId (verklaring b).
    3. Op basis van data: of entry-match alsnog werkbaar maken (door bv. precision-match), of overschakelen naar positionId-aggregator met max-tps-limiet, of een soft-link UI (closed records blijven losse trades, maar krijgen visueel een badge/koppeling met de open trade).

  **Tijdens deze investigatie geleerd**:
    - Direction-detectie voor net-mode trades volgens ccxt's `parse_position`: `side="buy"` → LONG, `side="sell"` → SHORT (de `side` is de **opening-side**, niet close-fill). Geometric heuristiek `(closePrice − entryPrice) × pnl ≥ 0` is onbetrouwbaar bij kleine pnl. Deze fix is nuttig om mee te nemen wanneer we het Blofin-werk hervatten — niet weggegooid, alleen weggehouden uit deze release om de revert schoon te houden.
    - `historyId` is de unieke sleutel per record (deterministisch, betere ID dan ons huidige `positionId+closeTime`).
    - Blofin geeft geen fills-endpoint zoals OKX's `/trade/fills-history` — we moeten via positions-history werken.

  Code: huidige werk staat lokaal teruggedraaid naar v12.59 (laatste gepushte release). Eventuele console-logs / debug-knop ook gerevert. Bellafiore-demo (`playbook-bellafiore-demo.html`) blijft staan in project-root als losstaand bestand.

- [ ] **MEXC share-card: percentage-toggle laat PnL verdwijnen** *(2026-04-30, gemeld door NielsB in Discord)* — Op het MEXC share-kaart-paneel toont de PnL-waarde correct het bedrag, maar zodra de "percentage"-checkbox wordt aangevinkt, verdwijnt het PnL-cijfer in plaats van als % weergegeven te worden. Reproductie: trade share-modal openen → MEXC-stijl kaart → toggle "Percentage" aan → PnL-veld blank. Vermoedelijk een rendering-conditie die `pnl > 0` checkt zonder rekening te houden met de percentage-modus. Code: zoek in [work/tradejournal.html](work/tradejournal.html) naar share-card percentage-toggle / MexcShareCard / `fields.percentage`.

- [ ] **Hyperliquid live balance wordt niet opgehaald in BALANS bovenin** *(2026-04-24, gemeld door Denny)* — Hyperliquid `testConnection` haalt nu alleen `clearinghouseState.marginSummary.accountValue` op (perp-only equity). Te checken: (a) returnt de call überhaupt `success: true` met `balance > 0` voor Denny's wallet — debug via console of de hook hyperliquid wel oppakt; (b) `useLiveExchangeBalances` skipt mogelijk wallet-only exchanges door de check `if(ex.walletOnly){if(!cfg.walletAddress)continue;}` — of werkt die correct?; (c) als de wallet alleen spot-balance heeft (`spotClearinghouseState.balances` met USDC/USDT) telt dat nu niet mee in `accountValue` — uitbreiden met spot-fetch zou nodig zijn (zoals we eerder probeerden in een teruggedraaide v12.30 patch). Reproductie: Denny's profiel met Hyperliquid wallet ingevuld → Hyperliquid contributeert niets aan BALANS bovenin. Code: [work/tradejournal.html:1642-1647](work/tradejournal.html#L1642-L1647) (testConnection) + [work/tradejournal.html:1924-1958](work/tradejournal.html#L1924-L1958) (hook).

## 📋 Onderzocht — wacht op go (geen code geschreven)

- [ ] **Combined trades — meerdere trades als één behandelen** *(2026-05-02, onderzoek afgerond — zie [docs/combined-trades-research-2026-05-02.md](docs/combined-trades-research-2026-05-02.md))* — Feature-request van Denny: trades selecteren in TradeList → klik "Combineer" → 4 trades worden één logische trade met aggregate entry/SL/exit/PnL/fees + de 4 individuele trades als TP-niveaus. Use-case voorbeeld: 4× 0.25 BTC long met verschillende TP-targets samen behandelen als 1× 1 BTC long met 4 TPs.

  **Wat onderzocht is**:
  - **Aanname-correctie**: Denny dacht dat FTMO/MT5 geen partial TPs ondersteunt — dat klopt **niet helemaal**. MT5 hedging-mode (standaard FTMO niet-US) ondersteunt het natief. Alleen FTMO **US** (netting + FIFO) is anders. De "splits in N trades"-praktijk is dus een keuze, geen verplichting.
  - **Per-exchange status**: van de 5 geïmplementeerde exchanges hebben er 4 al auto-aggregatie (Blofin CSV, Kraken, Hyperliquid, MEXC). Alleen FTMO (geen partial-detect) en Blofin API (fragile heuristiek) hebben deze feature nodig. Plus toekomstige Bybit-parser (Denny's primaire crypto-exchange).
  - **Architectuur**: past op het bestaande v12.62 partial-systeem (`tpLevels[]`, `originalSizeAsset`, `realizedPnl`, `getConsumedSiblings`-filter). Beide systemen kunnen naast elkaar bestaan.

  **Plan-sketch in 3 sprints** (v12.75 / v12.76 / v12.77):
  - Sprint 1: `tradeGroupId` + `tradeGroupRole` + `tradeGroupLabel` velden, `combineTradesIntoGroup` / `splitTradeGroup` / `getGroupedMembers` handlers, App-niveau filter (geen UI nog).
  - Sprint 2: combine-modal in Trades-pagina (vervangt de plek waar `Tags toevoegen` verstopt is sinds v12.73), primary-display met "4 trades gegroepeerd"-badge.
  - Sprint 3: splits-action, edge-case validation (cross-pair / cross-direction blokkeren), Playwright-tests inclusief PnL-conservation sanity-check.

  **Aanbeveling in research-doc**: bouw als algemene feature, niet alleen FTMO — de datamodel is sowieso exchange-agnostisch, en Blofin API + Bybit-toekomst maken het breder bruikbaar.

  **Wacht op groen licht van Denny voordat we Sprint 1 starten.**

## 🧪 Test-scenarios — te bouwen + toekomstig

### Sinds v12.88 actief (real-data + synthetic combineren)

In [tests/](tests/) staan 4 real-data specs (`<exchange>-real-data.spec.js`) die per exchange de pipeline tegen een snapshot uit `tests/_fixtures/` valideren (smoke + count + PnL-sum + fees-sum + open-positions + detectPartials). Plus de synthetic spec [tests/blofin-pipeline-scenarios.spec.js](tests/blofin-pipeline-scenarios.spec.js) (12 scenarios A–J) en [tests/exchange-pipeline-cross.spec.js](tests/exchange-pipeline-cross.spec.js) (4 scenarios × 4 exchanges = 16 + 1 FTMO).

### Te bouwen — Scenarios K–O (synthetic, geen extra fixtures nodig)

- [x] ~~**Scenario K: Entry + SL hit (zonder TP)**~~ *(v12.88, [tests/scenarios-klmn.spec.js](tests/scenarios-klmn.spec.js))* — open positie met SL gezet, prijs raakt SL. Verifieert dat `stopLoss`-veld bewaard blijft op de merged partial trade en SL-fill wordt geregistreerd als tpLevel.
- [x] ~~**Scenario L: Manual edits behoud bij SL na TP1**~~ *(v12.88, [tests/scenarios-klmn.spec.js](tests/scenarios-klmn.spec.js))* — community-bug-variant van v12.87. Open trade met `notes` + `setupTags` + `rating` + `screenshot` + `stopLoss` + `takeProfit`. TP1 partial-close → SL. Verifieert dat ALLE user-edits behouden blijven op het samengevoegde partial-trade record (regressie-test voor v12.87 finalize-flow fix).
- [x] ~~**Scenario M: Unrealized PnL op open trade**~~ *(v12.88, [tests/scenarios-klmn.spec.js](tests/scenarios-klmn.spec.js))* — open positie zonder siblings. Verifieert `status='open'`, `unrealizedPnl` behoud, geen `realizedPnl`/`tpLevels` toegevoegd, en dat `getConsumedSiblings` 'm met rust laat.
- [x] ~~**Scenario N: getConsumedSiblings filtering na partial**~~ *(v12.88, [tests/scenarios-klmn.spec.js](tests/scenarios-klmn.spec.js))* — partial trade verbergt 2 closed siblings via `getConsumedSiblings` (consumed.size=2, visible=1). Voorkomt dubbele weergave in Trades-pagina.
- [ ] **Scenario O: Funding-fees toegepast (na funding-feature live)** — geblokkeerd op funding-feature implementatie (zie "Funding-fees per trade tracken" hierboven). Vereist een fixture met funding-events naast trade-fills + verifieer per-trade matching + aggregaat-card.

### Te noteren — Toekomstige scenarios (later, vereist fixture-uitbreiding of nieuwe schema)

- [ ] **Scenario P: Scaling-in (meerdere opens vóór 1 close)** — bv. 3× 0.01 BTC long op verschillende prijzen, dan 1 close 0.03. Hyperliquid heeft dit al via `_reconstructTrades` FIFO-logica (zie ook fee-drift bug hierboven). Andere exchanges via positionId-aggregatie. Verifieer gewogen entry-price + correcte fee-attributie.
- [ ] **Scenario Q: Direction-flip (long → short via netting)** — Blofin/MEXC net-mode: 1 BTC long → sell 2 BTC = direction flip naar 1 BTC short, niet 0 + new short. Vereist sub-fill-tracking om de flip-event te splitsen in (close 1 long) + (open 1 short). Nu skipt `_reconstructTrades` deze fills (zie regel 2168 — "MVP skip"). Niet kritiek tot er flip-trades in productie binnenkomen.
- [ ] **Scenario R: Leverage-change tijdens open positie** — user verandert leverage van 10x → 20x op een open trade. API geeft 1 record met `leverage=20`, maar de trade was deels op 10x geopend. Margin-berekeningen kloppen niet meer. Edge-case voor display-only (echte PnL klopt nog wel via `realised`).
- [ ] **Scenario S: Liquidation event** — `liquidationPositions > 0` in Blofin, of `liq` flag in Hyperliquid `dir`. Verwacht: trade krijgt `notes="⚠ Liquidated"` of equivalent flag, fees zijn liquidation-fee (hoger dan trading-fee). Niet kritiek voor users die niet liquideren, maar wel voor accurate post-mortems.
- [ ] **Scenario T: Sub-accounts / vaults** — Hyperliquid HLP-deposits, Bybit sub-accounts, Blofin sub-uids. Aparte wallets/accounts onder dezelfde user-account. Voor Hyperliquid: vault-PnL zit in `vaultEquities`, niet in `userFills`. Vereist apart endpoint en aparte trade-shape (geen entry/exit, alleen periodic equity-changes). Latere scope.

## 🚧 Hidden / work-in-progress (knop verborgen, code intact)

- [ ] **Dev-only debug-knoppen voor exchange-API's** *(2026-05-03, v12.85 — verborgen achter `?dev=1`; v12.88 — uitgebreid naar alle exchanges)* — Bij Blofin/MEXC/Kraken/Hyperliquid (Accounts → kies exchange in dev-mode) verschijnt nu een **📥 Snapshot**-knop. FTMO niet (CSV-only). Per-exchange `ExchangeAPI[ex].captureSnapshot(creds)` haalt raw API-response op en download als JSON-fixture (`<exchange>-snapshot-...json`). Bij Blofin staan ook nog de 🔍 Debug-raw + 🔬 Test-fixture knoppen (specifiek voor partial-close diagnostic). Bij Blofin (Accounts → kies Blofin in dev-mode) verschijnen 3 dev-knoppen onder de standaard-action-row:
    - **🔍 Debug raw response** — toont counts + states + fields per `positionId` van de positions-history API. Helpt partial-close logica valideren.
    - **📥 Snapshot** — download de raw API-response als JSON-fixture, voor offline iteratie zonder credentials.
    - **🔬 Test fixture** — laad een snapshot-JSON terug om de import-pipeline te runnen tegen vaste data (regressie-tests).

  Activeer in browser via `?dev=1` in URL (persisteert via `tj_dev_mode` localStorage). Deactiveer via `?dev=0`.

  **Code-locaties**:
    - 3 button-renders in [work/tradejournal.html:10378-10380](work/tradejournal.html#L10378-L10380) — wrap `{IS_DEV&&ex==="blofin"&&...}`
    - Debug-result panel in [work/tradejournal.html:10384-10430](work/tradejournal.html#L10384-L10430)
    - Fixture-result panel in [work/tradejournal.html:10433-10475](work/tradejournal.html#L10433-L10475)
    - Handler functies `debugBlofin` / `captureSnapshot` / `runFixtureTest` in [work/tradejournal.html:10012-10198](work/tradejournal.html#L10012-L10198)

  **Toekomstig uitbreiden naar andere exchanges** (bij debug-noodzaak):
    - **MEXC** — `_direct` calls op `position/list_history_positions` + `position/open_positions`. PositionId + state-counts vergelijken zoals Blofin.
    - **Kraken Futures** — `historyfills` + `openpositions` endpoints. Vergelijk `fill_id` als unique key. Kraken levert al de meeste fees uit, dus partial-close debug is anders dan Blofin.
    - **Hyperliquid** — `userFills` + `clearinghouseState`. Geen API-keys nodig (alleen wallet-adres) dus snapshot is automatisch deelbaar zonder credentials lekken.
    - **FTMO MT5** — geen API; debug-pad zou een CSV-parser-snapshot zijn (raw rows in / mapped trades out).

  **Patroon voor uitbreiding**: per-exchange `debugX()` / `captureSnapshotX()` / `runFixtureX()` met dezelfde JSON-shape `{type:"<exchange>-snapshot",version,capturedAt,...}`. Generieke fixture-loader detecteert `type` en routeert.

- [ ] **Bulk-tag knop op Trades-pagina afmaken** *(2026-05-02, knop verstopt in v12.73 — toggle-flag in [work/tradejournal.html](work/tradejournal.html) zoek `{false&&<button` regel ~3175)* — De feature werkte technisch (v12.71 + v12.72 toegevoegd) maar Denny meldde dat er nog logica mist. Knop is verborgen tot dit af is. Bij re-enable: `{false&&...}` weghalen + `test.describe.skip` → `test.describe` in `tests/bulk-tag-layered.spec.js`.

  **Wat werkt al** (v12.71 + v12.72 — handlers + UI staan in code, alleen UI-toegang dichtgezet):
    - Timeframe als 5e categorie in bulk-tag panel
    - Layer-builder (TF + setups + confirmations → "+ Voeg layer toe") met dedupe
    - Layer-aware single-tag knoppen (schrijven naar eerste layer als trade `layers[]` heeft)
    - Active-state styling + toggle (klik op actieve knop verwijdert)
    - 9 Playwright scenario's groen (skipped tot we 'm weer aanzetten)

  **Wat nog moet** (Denny zal precieze gaps later specificeren — ruwe vermoedens):
    - Edge-cases bij meerdere layers per trade (bv. waar voeg je de tag toe als er 3 layers zijn — eerste? alle? user-keuze?)
    - Een "ook layer verwijderen"-actie (nu kun je alleen tags binnen layers wijzigen, niet de layer als geheel verwijderen)
    - Mogelijk: counter/badge die laat zien hoeveel trades de tag al hebben (1/5, 3/5, 5/5)
    - UX-validatie met echte data van Denny — feedback was "we zijn er bijna, mist nog logica"

  **Code-locaties** voor de re-activering:
    - `{false&&<button ...>Tags toevoegen</button>}` in [work/tradejournal.html:3175](work/tradejournal.html#L3175)
    - `bulkTag` / `bulkUntag` / `bulkAddLayer` handlers in [work/tradejournal.html:11305-11375](work/tradejournal.html#L11305-L11375)
    - Bulk-tag panel-render in [work/tradejournal.html:3185-3220](work/tradejournal.html#L3185-L3220)
    - `test.describe.skip` in [tests/bulk-tag-layered.spec.js](tests/bulk-tag-layered.spec.js)

## 🔜 Next up (deze of volgende werksessie)

- [x] ~~**Exchange-bug-isolatie: detectPartialFromSiblings → adapter-methode**~~ *(2026-05-03, ingevoerd v12.85)* — Klein, gericht refactor om Blofin-fixes te scheiden van MEXC/Kraken/Hyperliquid/FTMO paden. Zie regel in [CLAUDE.md](CLAUDE.md) "Exchange-architectuur".

  **Geïmplementeerd:**
  - Elke `ExchangeAPI[ex]` heeft nu eigen `detectPartials(trades)` methode (Blofin/MEXC/Kraken/Hyperliquid wrappen de shared helper, FTMO is no-op).
  - 2 dispatcher-call-sites in App ([work/tradejournal.html:11510](work/tradejournal.html#L11510) en [11821](work/tradejournal.html#L11821)) routen nu via `ExchangeAPI[ex].detectPartials(...)` ipv direct shared-aanroep.
  - Regressie-test [tests/exchange-isolation.spec.js](tests/exchange-isolation.spec.js) — 5 scenario's groen, bewijst:
    - Elke exchange heeft een eigen `detectPartials` functie
    - Blofin-aanroep raakt MEXC-trades niet (en omgekeerd)
    - FTMO is daadwerkelijk no-op
    - Adapter-aanroep is functioneel identiek aan de oude shared-aanroep (gedrag-behoudend refactor)
  - Bestaande [tests/blofin-partial.spec.js](tests/blofin-partial.spec.js) + [tests/smoke.spec.js](tests/smoke.spec.js) blijven groen.

  **Was niet gedaan (bewust)**:
  - `syncTradeFlatFields`, `normalizeTrade`, `getConsumedSiblings` blijven shared — geen exchange-aannames in.
  - Snapshot-fixtures voor MEXC/Kraken/Hyperliquid: pas bouwen wanneer er een echte bug is om te debuggen. Patroon staat in BACKLOG "Hidden / dev-only debug-knoppen" sectie.


  **Stappen** (in deze volgorde):
  1. **Regressie-baseline**: snapshot-fixture maken voor MEXC + Kraken + Hyperliquid via dev-mode (`?dev=1`) — patroon van Blofin's `captureSnapshot` extenderen. Sla op in `tests/fixtures/`. Zo kunnen we vóór en ná de refactor exact dezelfde import-output verifiëren.
  2. **`ExchangeAPI[ex].detectPartials(trades)` toevoegen** als methode op elke adapter:
     - **Blofin** krijgt de huidige `detectPartialFromSiblings`-logica met al z'n aannames (positionId-hergebruik, `_rawCloseSize`, sibling-matching op entry-prijs)
     - **MEXC / Kraken / Hyperliquid** krijgen `detectPartials: trades => trades` (no-op tot we MEXC-eigen partial-logica nodig hebben)
     - **FTMO MT5** krijgt ook no-op (CSV-only, geen partial-detectie via API)
  3. **Dispatcher**: vervang `detectPartialFromSiblings(trades, ex)` calls door `ExchangeAPI[ex].detectPartials(trades)`. Zoek in App-init useEffect ([work/tradejournal.html:11489](work/tradejournal.html#L11489) e.o.) en `syncOpenPositions` handler.
  4. **De oude shared functie blijft beschikbaar** (door Blofin-adapter aangeroepen) — niet weggooien, alleen ontkoppelen van direct App-gebruik. Kan later helemaal verhuizen naar Blofin-adapter scope.
  5. **Regressie-test per exchange** in `tests/exchange-isolation.spec.js`:
     - Laad fixture-snapshot per exchange
     - Run import-pipeline
     - Verifieer trade-counts, partial-status, tpLevels, realizedPnl per fixture-sample
     - Doel: bewijs dat een Blofin-tweak (`ExchangeAPI.blofin.detectPartials`) géén MEXC/Kraken/Hyperliquid output verandert

  **Acceptatie-criteria**:
  - Alle bestaande Playwright tests groen (geen regressies)
  - Nieuwe regressie-test per exchange groen
  - Code-review: geen `if (exchange === "blofin")` meer in shared scope; alle exchange-aannames zitten in adapters
  - Documentatie: vermelding in CHANGELOG en korte note in [CLAUDE.md](CLAUDE.md) "Exchange-architectuur" met "✓ ingevoerd v12.86" o.i.d.

  **Scope-discipline**: NIET tegelijk de andere shared helpers (`syncTradeFlatFields`, `normalizeTrade`, `getConsumedSiblings`) refactoren — die hebben ZERO exchange-aannames en horen gedeeld te blijven. Alleen `detectPartialFromSiblings` is de probleem-plek.

- [x] ~~**Pro-trader review followup — 8 majors**~~ *(2026-05-02, batch uit [docs/pro-trader-review-2026-05-02.md](docs/pro-trader-review-2026-05-02.md) — afgerond in v12.66 + v12.67)* — De 2 critical bugs + 8 majors zijn uitgewerkt:
  - ✓ #1 Sample-size waarschuwing globaal — `<SampleSizeBanner>` in Dashboard/Review/Analytics (v12.66)
  - ✓ #2 Twee parallelle "rules"-systems consolideren — KPI-labels hernoemd ("Thesis-gevuld" / "SL-gedefinieerd" / "Post-trade notes") + explainer-banner over verschil met Kalender Trading Rules (v12.67)
  - ✗ #3 "Sharpe Cumulatief" mislabel — was misinterpretatie pro-trader-review, code zegt correct "Huidige cumulatief"
  - ✓ #4 "Trade Score 35/100" tooltip + breakdown — hover op gauge + ⓘ-icoon (v12.67)
  - ✓ #5 Drawdown-threshold/limit configurable — gebruikt bestaande `maxDD`-goal, top-bar toont `DD -$X / -$Y limiet` met kleurindicatie (v12.67)
  - ✗ #6 Rule-adherence prominent op Dashboard als 5e KPI — nog niet gedaan, Calendar Trading Rules + Analytics proces-KPI's zijn al duidelijk gescheiden
  - ✓ #7 Empty-state Analytics 0%-metrics — "—" met cursief uitleg ipv rauw 0% (v12.67)
  - ✗ #8 Setup Insights identieke cijfers (Breakout = Pullback) — nog te verifiëren of dit een echte bug is of multi-tag overlap
  - ✓ Critical: PnL/WR-inconsistency Dashboard ↔ Trades — `getConsumedSiblings()` op App-niveau (v12.66)
  - ✓ Critical: Floating-point precision in trade-modal — `fmtPriceDisplay()` smart decimals (v12.66)

  **Resterende items voor later:** #6 (Rule-adherence card op Dashboard) en #8 (Setup Insights audit). Plus minor #4 default name "Trader" → onboarding-vraag.

- [ ] **Pro-trader review followup — Resterende items** *(2026-05-02)* — twee items niet afgerond in v12.66/v12.67:
  - **Rule-adherence prominent op Dashboard als 5e KPI** — Calendar laat per-day-trading-rules zien, Analytics laat per-trade data-completeness zien. Een Dashboard-card "Discipline-score X%" zou een agg geven van beide. Effort: M (concept-design + UI).
  - **Setup Insights identieke cijfers verifiëren** — Analytics tabel toonde Breakout en Pullback met identieke cijfers (5 trades, 40% WR, $0,79). Mogelijk multi-tag overlap (sinds v12.53), maar verdient verificatie + tooltip met trade-IDs. Effort: S.
  - **Default account-name "Trader" → onboarding-vraag** — bij eerste gebruik Settings → Profile vragen. Effort: S. — naast de 2 critical bugs (boven) zijn er 8 major issues geïdentificeerd:
  1. **Sample-size waarschuwing globaal** — alle ratio's (PF, Expectancy, WR per setup) gegrijst onder N=30 met badge "N=15, te klein voor conclusie". Affects: Dashboard, Review, Analytics, Rapport. Best new component: `<NCheck n={...} threshold={30}/>`.
  2. **Twee parallelle "rules"-systems consolideren** — Calendar toont 5/5 trading-rules, Analytics toont 0% Plan-gevolgd voor zelfde dataset. Pro trader weet niet welke "echte" discipline meet. Fix: één canonical Discipline Score (gewogen avg van Trading Rules + tradePlan-veld + SL-veld + journal-veld), Calendar wordt per-day-detail, Analytics wordt periode-aggregaat.
  3. **"Sharpe Cumulatief −€8,37" mislabel op Review** — toont gewoon eind-equity in €. Sharpe is dimensieloze ratio. Fix: óf relabel naar "Cumulatieve P&L", óf bereken echte Sharpe (gem. daily return / stdev × √252).
  4. **"Trade Score 35/100" zonder uitleg/tooltip** op Review-gauge. Pro trader: hoe berekend? Wat is goed/slecht? Fix: tooltip + hover-breakdown van factoren.
  5. **Drawdown-threshold/limit configurable** voor FTMO/prop-firm-traders. Nu toont top-bar `DD -€20,24` zonder context. Fix: Goals-tab krijgt "Max DD limiet" veld (€/%); top-bar toont dan "DD -€20,24 / -€50 limiet".
  6. **Rule-adherence prominent op Dashboard** — als 5e KPI-card ("Discipline X%"). Pro-checklist top-5: equity / today-P&L / expectancy-R / drawdown-vs-limit / discipline.
  7. **Empty-state Analytics 0%-metrics** — fixture-trades zonder tradePlan/SL/journal-velden tonen rauw "0%" alsof het echte performance is. Fix: detect alle-velden-leeg → toon "Vul tradePlan-veld in trade-form om te activeren" badge ipv 0%.
  8. **Setup Insights identieke cijfers (Breakout = Pullback met identieke metrics)** — verdacht. Mogelijk correct door multi-tag overlap (v12.53 multi-select), maar verdient verificatie + tooltip. Fix: voeg "5 trades met deze setup-tag" hover met list van trade-IDs.

  Plus 5 minor polish-items (currency-format `-€4,66` ipv `€-4,66`, period-tab duplicate "Halfjaar/6M", mindset-banner-frequency, Dashboard "Voeg account toe" CTA terwijl Blofin-trades bestaan, default account-name "Trader" → onboarding-vraag).

  Effort: 3-5 dagen totaal voor alle 8 majors. Volgorde-suggestie: #1 (sample-size, raakt veel plekken) → #3+#4 (relabels/tooltips, snel) → #2 (rule-systems, vereist denken) → rest.

- [ ] **🥇 AI Trade Autopsy** — knop "🔍 AI Autopsy" in trade-detail. Input: screenshots (multi, sinds v12.32) + entry/exit/SL/TP + actieve Trading Rules + setup/mistake/emotion-tags + write-up. Vragen in NL: "Voldeed mijn entry aan mijn regels? Volgde ik mijn exit-plan? Welk patroon zie je? Belangrijkste verbeterpunt? Als je mijn coach was — wat zou je zeggen?". Output → `aiAutopsy` veld op trade. Stack-keuze open: (a) opt-in user-supplied API-key (privacy + geen kosten voor ons, sluit non-techies uit) of (b) gedeelde Cloudflare Worker met community-budget. Default voorstel: optie (a). Effort: 1–2 dagen. Bouwt voort op multi-screenshot uit v12.32.
- [ ] **🥈 AI Super-Prompt "Wat heeft prioriteit?"** — knop bovenaan Tendencies-tab. Aggregeert laatste 10 autopsies + huidige tendencies → 1 zin top-prioriteit + 3 concrete acties voor deze week. Voorkomt overfitting bij veel tendencies. Hangt af van Autopsy-feature (genoeg autopsies om te aggregeren). Effort: 3–4u na Autopsy.
- [ ] **Pre-Market Game Plan tab** — dagelijkse template: watchlist (pairs), bias per pair, news/catalysts, mood-check. Match later op die dag gelogde trades → "matchte je pre-market bias" / "niet". Optionele AI-laag: priority-table uit watchlist + news. Effort: 1–2 dagen.
- [ ] **Alerts Cookbook in Help-tab** — copy-paste Pine Script alert-prompts voor Claude (opening range break + volume + VWAP, etc). Pure docs, community-marketing waarde. Effort: ~2u.
- [ ] **🧠 Bellafiore — Intraday Fundamentals als playbook-veld** *(uit research 2026-04-30, deferred)* — Bellafiore's IF-stap (point #3 van zijn 9-stappen template) vertaalt voor crypto naar tag-chips: 🔓 token unlock, 🏛 regulatory, 💸 funding flip, 🌊 liquidation cascade, 🐋 whale-movement, 📅 macro event (FOMC/CPI), 📰 major news, 🌅 session open, 💀 risk-off, 🔥 risk-on. Hybrid aanpak: nieuwe `tagConfig.intradayFundamentalTags` + multi-select chips + vrij textveld op zowel playbook als trade. Mirror tussen playbook (welke IFs typisch) en trade (welke IFs nu). Analytics: per playbook breakdown op IF-tag. Effort: M. Niet meegenomen in eerste Bellafiore-release (#1: Big Picture / Tape / Intuition velden) — ligt qua scope op zichzelf en past beter in latere iteratie. Code: nieuwe sectie in PlaybookForm + TradeForm, plus tagConfig-uitbreiding.

- [ ] **🧠 Best Trade of the Week — Steenbarger ritueel** *(uit research 2026-04-28)* — wekelijks Dashboard-blok dat automatisch je top-R-trade van afgelopen 7 dagen pakt en 3 vragen stelt: (1) *Welke entry-trigger zag je?* (2) *Waarom durfde je deze size?* (3) *Wat maakte dit een pivotal moment?* Antwoorden slaan op als notitie + voeden over tijd een nieuw **"Best Practices"-tabblad**. Doel: app van problem-focused (verlies-post-mortem) naar 50/50 solution-focused trekken. Bron: Brett Steenbarger SMB Summit 2026 talk *"Positive Trading Psychology"* — *"Be more consistent in being who we already are at our best."* Effort: ~1 release (~3-4u). Storage: nieuwe key `tj_best_trade_reviews`. Aanbevolen als eerste Steenbarger-feature — kleine scope, hoge impact.
- [ ] **🧠 Strengths-onboarding + Strengths Heatmap** *(uit research 2026-04-28, larger scope)* — eenmalige onboarding waar user 3 signature strengths kiest uit VIA-lijst (Curiosity / Grit / Patience / Analytical / Decisive / Adaptive / Disciplined / etc.). Per Playbook-setup tonen of die setup hun strengths benut of er tegenin gaat (*"Deze setup vereist Patience + Decisive — past bij jouw profiel"*). Plus een **Strengths Heatmap** naast de bestaande Discipline Heatmap — "hoe vaak vandaag een strength benut" als solution-focused tegenhanger. Effort: 2-3 dagen. Vereist eerst Best Trade of the Week om data te genereren waarmee de strengths zich bewijzen.
- [ ] **🧠 2D Mindset-grid (emotional × cognitive axis)** *(uit research 2026-04-28)* — Steenbargers april-2026 update: mindset is 2D, niet 1D. Twee sliders bij elke trade-entry: **emotional axis** (calm ↔ nervous) + **cognitive axis** (focused ↔ distracted). Top-performers tonen "flexibility of perspective" — de cross-correlatie geeft veel rijker signaal dan een enkel rustig/nerveus-veld. Effort: ~half dag UI + Analytics-correlatie.
- [ ] **🧠 Decision-space-meter per trade** *(uit research 2026-04-28, out-of-the-box)* — meet hoeveel "knoppen" een trade heeft (1=mechanisch level-X long; 6=open-space met sizing/scaling/multi-TP). Routeert het review-formulier: 1-2 knoppen = problem-focused review (poker-stijl leak-plugging), 4+ knoppen = solution-focused review (Steenbarger-stijl best-trade reverse-engineering). Niemand doet dit. Effort: ~half dag.
- [ ] **🧠 Pre-Market Strengths Primer** *(uit research 2026-04-28, out-of-the-box, blocked)* — 3-min ritueel vóór eerste trade van de dag: app toont jouw top-3 best-executed trades ooit met notes erbij. Solution-focused warm-up (zoals een pianist een Bach-prelude speelt vóór het concert, niet het concertstuk zelf). **Geblokkeerd**: vereist eerst Best Trade of the Week feature om data op te bouwen, anders is er niks om te tonen.
- [ ] **Tiltmeter (emotie 1-10 per trade)** — Edgewonk's USP. Correleer met PnL. Fase 2 van proces-focus (Fase 1 is al live, Discipline Heatmap afgerond 2026-04-22).
- [ ] **Pre-trade checklist builder** — user definieert 5-10 items (entry-criteria, risk-check, bias confirmation). Per trade score → toegevoegd aan Analytics Proces-mode.
- [ ] **Checklist-streak gamification** — Duolingo-stijl streak-counter voor "checklist volledig ingevuld X dagen op rij". Loss aversion werkt.
- [ ] **Mindset-reminders fase 2** — 4 deferred contexten: risk-exceeded inline warning, heatmap-red-zone warning in TradeForm, emotion-tag tooltip (opgewonden/hebzuchtig), weekend sidebar-whisper. Fase 1 (banner + pre-trade + post-loss) live sinds 2026-04-22.
- [ ] **Dag-limiet / tilt guard** — modal bij N losses op dag. Data zit in Trading Rules.
- [ ] **Trade-voucher / shareable link** — base64 URL-fragment. Read-only modal.
- [ ] **Discord webhook** bij PnL-milestones — community leeft op Discord. Moeite: L.
- [ ] **TradingView Lightweight Charts embed** — interactieve mini-chart in trade-detail i.p.v. link. 40KB, gratis. Moeite: M.
- [ ] **Weekly performance summary** — lokaal gegenereerd, geen AI nodig voor v1. Pure aggregatie. Moeite: L.
- [ ] **MFE/MAE exit-efficiency scatter** — vereist MFE/MAE data uit exchange-fills.
- [ ] **PnL Calendar Heatmap** — 13-weken grid, GitHub-stijl.
- [ ] **Scratch segmentation donut** — "True Win-rate" los van scratch trades.
- [ ] **Funding-fees per trade tracken** *(2026-05-03, plan na Blofin-bug-sprint v12.87)* — Voor crypto-futures is funding-fee een aparte cost-component naast trade-fees (open/close commissies). Op exchanges met perpetuals (Blofin, MEXC, Bybit, Hyperliquid, Kraken Futures) wordt funding elke 1/4/8 uur afgerekend op open posities. Nu telt SyncJournal die kosten nergens mee — True PnL is dus onnauwkeurig voor swing-trades die een funding-cycle overspannen.

  **Ontwerp-keuze**: per-trade matching (niet aggregate-only). Funding-events worden gekoppeld aan de open trade die op dat moment bestond, zodat True PnL = `realizedPnl − tradeFees − fundingFees` per trade klopt. Aggregate-card "💸 Funding fees" in Analytics is bonus.

  **Implementatie-pad in 3 stappen**:
  1. **Schema + migratie** — nieuwe velden `t.fundingFees` (number, default 0) en `t.fundingEvents[]` (array van `{ts, amount, rate, intervalHours}`). Migratie backfillt naar 0 voor bestaande trades. `netPnl()` helper aanpassen: `realizedPnl − fees − fundingFees`. Display in TradeDetailModal: aparte regel "💸 Funding -€X,XX" onder fees.
  2. **Per-exchange `fetchFundingFees()` adapter** — nieuwe methode op `ExchangeAPI[ex]` per exchange die funding-events haalt vanaf `syncFrom`:
     - **Blofin** — `/api/v1/asset/bills` met `type=funding` filter, of `/api/v1/account/bills` (te onderzoeken). Velden: `ts`, `amount`, `instrument`.
     - **MEXC** — `account/history` (futures-account) met `type=FUNDING_FEE`, of dedicated funding-endpoint. Velden idem.
     - **Kraken Futures** — `accountlogs` met `info=funding`. Krijgt al fees+funding apart.
     - **Hyperliquid** — `userFunding` (info-endpoint, geen API-key nodig). Velden: `time`, `coin`, `usdc`, `szi`, `fundingRate`. Returns array per user-wallet.
     - **FTMO MT5** — n.v.t. (geen perpetuals; FX/CFD heeft swap maar dat is ander mechanisme — later).
  3. **Matching + integratie** — voor elk funding-event: zoek de trade die op `event.ts` open was op (`pair`, `direction`). Ken `event.amount` toe aan `t.fundingFees` (sum) + push naar `t.fundingEvents[]`. Edge-cases zie hieronder. Hook in op `refresh`-handler na `syncOpen` + na `detectPartials`. Analytics-card "💸 Funding fees" toont totaal + per-pair breakdown.

  **Edge-cases om te valideren met fixtures**:
  - **Twee parallelle opens op zelfde pair+direction** (bv. 2× BTC-LONG door scaling-in op verschillende prijzen): funding-event split naar rato van size? Of toewijzen aan oudste open? — *Voorstel*: pro-rata op `positionSizeAsset` met fallback naar oldest-open.
  - **Open trade nu, funding loopt nog**: tonen we cumulatieve funding live in TradeDetailModal voor open trades? — *Voorstel*: ja, "Funding tot nu: -€X,XX" naast unrealized PnL. Snapshot bij close.
  - **Funding-event valt na trade-close** (settle-lag, < 1 funding-cycle ná close): toewijzen aan laatst-gesloten matchende trade, of dropt als ghost? — *Voorstel*: assign aan laatst-gesloten als binnen 1 interval, anders aggregate-only.
  - **Funding-event zonder enkele matchende trade** (bv. user heeft positie geopend buiten SyncJournal en gesloten ervoor): aggregate-only, niet aan trade gekoppeld. Rapporteer in Analytics-card.

  **Acceptatie-criteria**:
  - True PnL formule: `realizedPnl − tradeFees − fundingFees` werkt per trade en in alle aggregate-views (Dashboard, Analytics, Rapport).
  - Backwards-compat: trades zonder funding-data tonen `fundingFees=0`, niet "—" of error.
  - Per-exchange isolatie: Blofin funding-fetcher raakt MEXC/Kraken niet. Test in `tests/exchange-isolation.spec.js` uitbreiden met funding-no-op voor exchanges zonder adapter.
  - Fixture-tests: per exchange een `<exchange>-funding.json` snapshot in `tests/_fixtures/` + spec die matching tegen scenario-trades verifieert.

  **Volgorde**: stap 1 (schema) eerst los — zonder data is dat een no-op. Daarna stap 2 per exchange in volgorde van prioriteit (Blofin → MEXC → Hyperliquid → Kraken). Stap 3 kan parallel met stap 2 omdat matching exchange-agnostisch is.

  **Effort**: stap 1 ~3-4u, stap 2 ~half dag per exchange, stap 3 ~half dag. Totaal: ~3-4 dagen voor 4 exchanges.

- [ ] **Funding & Fees Drain waterfall** — crypto-futures specifiek, onderscheidend. **Vereist** dat funding-fees-tracking eerst af is (zie hierboven). Visualisatie idee: waterfall van Gross PnL → tradeFees → fundingFees → Net PnL, kleurcodering rood (kost) vs groen (saldo). Per-pair breakdown ernaast.
- [ ] **Underwater Drawdown chart** — hedge-fund standaard.

## 📋 Quick wins (klein, geïsoleerd, laag risico)

- [ ] **Blofin — near-liquidation warning** — mark-price vs liquidationPrice check, oranje/rode badge als binnen 10% van liq. Vereist mark-price feed (extra API-call per positie of een quote-poll). Middelgroot.
- [ ] **Blofin — live "last refresh" indicator** — klein tijdje "3s geleden" badge naast open-posities om zichtbaar te maken dat auto-refresh draait. Puur UI, geen logica.
- [ ] **Blofin — R:R live berekening** — nu SL/TP meekomt van API kunnen we live R:R tonen in trade-detail. Trivial UI-toevoeging (R:R computed uit entry/SL/TP).
- [ ] **Hyperliquid toevoegen** — kan volledig client-side (public info-endpoint, geen proxy). Zie `Agent` onderzoek van 2026-04-14.
- [ ] **MAE-to-Stop ratio per setup** (idee #12) — uitbreiding op Setup Insights tabel als we MAE data hebben.
- [ ] **Parallel fetchFills bij refresh (concurrency cap)** *(2026-05-04, deferred — sequentieel werkt nu prima)* — huidige refresh-flow doet `for(t of needsTPs) await api.fetchFills(...)` sequentieel. Voor 1-5 trades neemt 1-2 sec/trade = 2-10 sec. Voor users met 20+ open MEXC trades wordt het merkbaar (40+ sec). **Fix**: parallel fetchen met max 3 concurrent (= ~3× sneller, ver onder MEXC's 20 req/sec rate-limit). Pseudocode + impact-analyse staan in conversation 2026-05-04 (Denny's vraag over rate-limit). Per-exchange refresh-knop bestaat al — geen UI-change nodig, alleen code in [work/tradejournal.html refresh-handler](work/tradejournal.html#L10643). Helper-pattern: `pMap(items, fn, concurrency=3)`.

## ⚠️ Risky (refactor of schema-migratie)

- [ ] **PDFReportModal herintroduceren** — groot component, jsPDF + html2canvas CDNs staan al geladen. Trade-shape hercontroleren vóór port.
- [ ] **Meerdere screenshots per trade** — v4_14 en v12 hebben 1 per trade. TF-breakdown (4H/15m/entry) zou datamodel + migratie vergen.

## 🔬 Onderzoek / te besluiten

- [ ] **MFE/MAE-analyse toevoegen** *(2026-05-01, onderzoek klaar — zie [docs/research-mfe-mae.md](docs/research-mfe-mae.md))* — Maximum Favorable / Adverse Excursion is de #1 metric-gap voor een serieus journal. Geen enkele crypto-native journal heeft het topnotch (Tradervue=US-aandelen, TradesViz=futures, Edgewonk=manual-only). **Wat we nu hebben:** niets behalve één CSS-comment `/* v7 NEW: MAE/MFE badge */` op [work/tradejournal.html](work/tradejournal.html#L335) regel 335. **Aanbeveling:** bouw Path A (manual entry, 2 velden in trade-form, ~2 dagen) + Path B (auto-fetch via public Binance/Bybit/Blofin klines API, ~1-2 weken) parallel. **Storage:** 2 raw velden per trade (`mfePrice`, `maePrice`), alle metrics on-the-fly. **Integratie met Trade Performance Report (v12.65):** vervangt lege R-distributie-fallback op page 5 door 4 echte MFE/MAE-cards. **Volgende stap:** demo-first — `demos/mfe-mae-demo.html` met Path A bouwen, dan iteratie met Denny voordat we naar `work/` integreren. Volledig verslag (10 secties, 30+ bronnen incl. Tradervue/TradesViz/Edgewonk docs, Binance/Bybit kline specs, Curtis Faith E-Ratio): [docs/research-mfe-mae.md](docs/research-mfe-mae.md).
- [ ] **Welke exchanges prioriteit?** — lijst afstemmen met community. Bybit, Binance, MEXC, Blofin, Kraken, Hyperliquid?
- [ ] **Later: backend ja/nee?** — pas relevant als community direct-API-sync wil. Voorlopig blijft keuze: lokaal + CSV.
- [ ] **Distributiemodel** — GitHub `/main/` folder nu. Overwegen: GitHub Pages (paid private) of Cloudflare Pages + Access (gratis, email-gate).

## ✅ Done

- [x] 2026-05-04 — **MEXC stale-open trade + 18 stale tpLevels + CORS contractSize-fallback** (v12.89) — Community-bug: gesloten positie staat nog als OPEN in app met 18 TP-niveaus uit andere posities, plus positionSize klopt niet. Drie root causes geïdentificeerd via reproductie-spec met echte IDB-export + verse API-snapshot: (1) `detectPartialFromSiblings` rebuildde `tpLevels` niet als ze al bestonden — bij elke sync stapelden nieuwe siblings bovenop oude. (2) Finalize-flow (`syncOpenPositions`) liep VÓÓR closed siblings in journal stonden — kon stale-open dus niet matchen + finalizen. (3) `contract.mexc.com` is CORS-blocked vanaf `file://`, contractSize fallback was 0 → positionSize 0. Fixes: rebuild tpLevels altijd (behoud alleen user-status≠"hit"), finalize-pass in `importTrades` (atomair na closed records), hardcoded contractSize-map voor 12 populaire pairs. Tests: [tests/mexc-stale-open.spec.js](tests/mexc-stale-open.spec.js).

- [ ] **MEXC eigen `detectPartials` op positionId** *(2026-05-04, gevonden tijdens v12.89 sprint, niet kritiek)* — De v12.89 fix gebruikt nog steeds matchKey op `(pair, direction, entry-prijs)` zoals de shared helper. Voor MEXC zou matching op `positionId` (uniek per positie volgens MEXC docs, niet hergebruikt) betrouwbaarder zijn. Vereist: nieuwe `ExchangeAPI.mexc.detectPartials` adapter-methode die positionId-match doet (geen entry-prijs match). Niet user-blocking voor de community-bug van v12.89 (die is opgelost), wel een verbetering voor edge-cases waar verschillende MEXC posities toevallig dezelfde gemiddelde entry hebben.

- [x] 2026-05-04 — **MEXC fees-sign + xlsx PnL-aggregatie convention** (v12.88) — MEXC's `fee`-veld komt negatief uit de API (uitgaand vanuit account), terwijl andere exchanges absolute fees leveren. Plus open vraag uit 3-way: was `realised` GROSS of NET? Verified via xlsx-trace op 1 BTC-positie + empirische check op 134 records: **realised is altijd NET** (fee=0 → realised=gross; fee≠0 → realised=gross−|fee|). Xlsx ClosingPNL is GROSS per fill. Beide bronnen convergeren via `xlsxNet = xlsxGross − xlsxFee = snapRealised`. Eerste v12.88 fix trok fees nóg een keer af (regressie); 2nd fix herstelde dat. Resultaat: drift voor BTC ging van $382 → $17 (boundary-fills over 127 positions). Tests: [tests/mexc-real-data.spec.js](tests/mexc-real-data.spec.js) + [tests/mexc-3way.spec.js](tests/mexc-3way.spec.js).
- [x] 2026-05-04 — **Hyperliquid scaled-in fee-duplicatie** (v12.88) — In `_reconstructTrades` partial-fill matching werd open-fee pro-rata afgesplitst maar `lot.fee` bleef onveranderd → fee-duplicatie bij volgende close-fills van dezelfde lot (~3% over-attribution gemeten). Fix: `lot.fee -= feeShare` na elke pro-rata aftrek. Drift in Denny's snapshot: 1.030× → 1.000×. Test: [tests/hyperliquid-real-data.spec.js](tests/hyperliquid-real-data.spec.js).
- [x] 2026-04-28 — **Edge-Erosion Funnel + Theoretical edge-leak UX-redesign** (v12.52) — Edge-Erosion Funnel was tabel + parallel SVG-bars met dubbele info. Vervangen door verticale stack van 3 stadium-cards met dashed connector-pills tussen rijen die het verhaal vertellen ("Hindsight-bias leak: −X%"). Theoretical edge-leak histogram (20 buckets, sparse data, hardcoded dark bg) vervangen door 3 tier-cards (≥80% / 50–79% / <50%) met adaptive headline-pill bovenaan. Dead code opgeruimd: `PlaybookMissedHistogram` + 20-bucket bins-berekening verwijderd.
- [x] 2026-04-28 — **Setup-laag UX-redesign + filled chips op alle themes** (v12.52) — wrapper `var(--bg3)` met soft elevation-shadow, pills filled (`var(--bg4)` chip) i.p.v. transparent, theme-aware gold-vars voor selected SETUP-pill, labels gelijkgetrokken (alle 9px gold uppercase). Vervolg op v12.49 contrast-fix die nog niet voldoende was.
- [x] 2026-04-28 — **Save-knop label + gradient differentiëren Backtest 🔬 / Paper 📝 / Gemist 👻** (v12.52) — was alle drie "Gemiste trade opslaan" met roze gradient. Backtest blauw, Paper paars, Gemist roze — matcht status-pills bovenin het formulier.
- [x] 2026-04-28 — **Glow rond Goals-progress-cirkel werd vierkant gerenderd** (v12.52) — drop-shadow geclipped door SVG viewport (100×100). Fix: `overflow:"visible"` op de SVG + glow-tuning (6px blur, alpha 80).
- [x] 2026-04-28 — **Export-knop crashte met `JS ERROR: Script error. Line: 0`** (v12.52) — `CURRENT_SCHEMA_VERSION` referenced in export payload maar nooit gedeclareerd → ReferenceError. Constante toegevoegd naast `APP_VERSION`.
- [x] 2026-04-28 — **Fees overal afgetrokken van PnL in stats & overzicht (quick-log scenario)** (v12.52) — vervolg op v12.49. Nieuwe centrale `netPnl(t)` helper retourneert voor manuele trades altijd `pnl − fees` en voor exchange-imports de al-netto `realizedPnl` ongewijzigd. Toegepast in trade-list cell, dashboard-tegels, Tendencies (Setup × Session matrix, sessions, holdtime, pairs-perf), Playbook-stats (compliance, edge-erosion), R-multiple `_trR()`, score-berekening en best/worst trade. Filter-checks (`!isNaN(parseFloat(t.pnl))`) blijven raw — die detecteren bestaan-van-pnl. Sim-trades (`status="missed"`) retourneren altijd 0.
- [x] 2026-04-28 — **Fees worden nu auto-verrekend in PnL bij handmatige trades** (v12.49) — useEffect in TradeForm recalculeert PnL bij wijziging van entry/exit/positionSize/fees, mits source==="manual" en "pnl" niet in manualOverrides. Zodra user PnL handmatig typt stopt auto-update. API-imports onveranderd (al netto). Commit `46c0a41`.
- [x] 2026-04-28 — **Setup-lagen tag-pills leesbaar op alle 6 themes** (v12.49) — vervangen `rgba(255,255,255,0.35)` (hardcoded) en lichte borders door `var(--text3)` + `var(--border4)` in alle drie pill-types (Timeframe / Setup / Confirmatie). Commit `46c0a41`.
- [x] 2026-04-28 — **"Indeling aanpassen" toggles zichtbaar in OFF-state op alle 6 themes** (v12.49) — toggle-track + knob OFF-state vervangen van `rgba(255,255,255,0.08)` / `rgba(255,255,255,0.25)` (wit op wit-bg = onzichtbaar) naar `var(--bg4)` track + border + `var(--text4)` knob. Commit `46c0a41`.

- [x] 2026-04-22 — **🎯 Blofin live tracking — open posities + live TP/SL + auto-refresh (v12.7 + v12.8)** — research door `exchange-integrator` agent: de gap met Tradezella/TraderSync was 90% UI, niet backend. Blofin's API bood alles al, we toonden niks. Fix:
  - Quick-win: "📡 Open posities ophalen" knop ontgrendeld voor alle exchanges met `fetchOpenPositions` (gate was hardcoded MEXC)
  - Live unrealized PnL `~+$X` (tilde = niet-gerealiseerd) in Trades-tabel PnL-kolom
  - Liquidation-price badge `LIQ $X` in amber onder Exit-kolom
  - Tweede API-call naar `/api/v1/trade/orders-tpsl-pending` — SL/TP worden automatisch gevuld, match op instId + positionSide
  - `autoRefreshOpen` config (Uit/30s/1min/2min) — silent polling, pauzeert bij inactive tab
  - Smarter merge: `ALWAYS_PROTECT` (user content) + `PROTECT_IF_INCOMING_EMPTY` (SL/TP — Blofin overwrite, MEXC keep). Manual-overrides winnen nog altijd. Commits `cb00572`, `e56e6b9`.
- [x] 2026-04-22 — **👻 Missed trades — opt-in power feature (v12.6)** — log setups die je spotte maar niet nam. Master toggle in Instellingen → Accounts (default UIT). 4 fases in 1 commit:
  - Status "missed" (3e waarde naast open/closed), `missedReasonTags` array, `hindsightExit` veld
  - TradeForm: "👻 Gemist?" toggle, conditioneel velden verbergen, Multi-select reason-tags, optionele hindsight sectie
  - TagManager: nieuwe categorie "👻 Missed-redenen" met 7 default tags, volledig bewerkbaar
  - Trades-lijst: 👻 MISS pill, opacity 0.72 voor missed rijen
  - FilterBar: `[Genomen | Gemist | Beide]` type-pill (default Genomen)
  - Command Palette: `⌘K → m` voor quick-log
  - Analytics → Proces → "👻 Edge Gap" sectie: captured-ratio per setup, reasons breakdown, theoretical edge-leak met hindsight-bias warning
  - `missed-trades-demo.html` standalone prototype. Commit `b819d9a`.
- [x] 2026-04-22 — **📋 CHANGELOG.md + Instellingen-link (v12.5)** — source-of-truth op GitHub, niet in-app tab. Keep-a-Changelog format in NL. Link vanuit Instellingen → Accounts. Commit `c3cfaf2`.
- [x] 2026-04-22 — **🔄 Update-flow in Instellingen (v12.3 → v12.4)** — manuele "🔄 Check voor updates" knop in Instellingen → Accounts (vervangt auto-banner). 4 uitkomsten: checking / up-to-date (groen) / error (rood) / newer (gold card met IS_HOSTED-aware action). Voor gehoste contexten: "↻ Update nu" = location.reload(). Voor lokale bestanden: "⬇ Download" naar GitHub raw. Commits `35017e0`, `fd1fec3`.
- [x] 2026-04-22 — **🎨 Morani branding (v12.4)** — favicon + apple-touch-icon (base64 embedded, M+candle crop), Open Graph + Twitter Card meta tags (1200×630 og-image via GitHub raw hosting), theme-color `#C9A84C`, `<title>` "SyncJournal · Morani". `assets/` folder met source PNG + generated variants. Commit `3e2a456`.
- [x] 2026-04-22 — **📦 Versie-beheer + auto-update-check (v12.1 → v12.2)** — `APP_VERSION` const bovenin HTML + `main/version.json` companion file. Semver `v12.X` formaat. Zichtbaar in Instellingen footer + Help-pagina (gold mono-font). `isNewerVersion()` semver-compare. `IS_HOSTED` detectie (file:// + localhost vs. public). Commits `a4ce4bd`, `b312b03`, `29a88e1`, `2038df1`, `eeb3035`.
- [x] 2026-04-22 — **Dashboard cleanup — van 3 naar 2 mindset-elementen** — weekly quote-kaart verwijderd van beide Dashboards omdat de top-banner sinds `5e600fa` al per tab-navigatie roteert en de kaart redundant was. Settings-toggles van 4 → 3. Stale localStorage-keys (tj_mindset_dashQuote e.a.) éénmalig opgeruimd bij load. Commit `0ce2ef8`.
- [x] 2026-04-22 — **Bug: Light themes logo + dashboard-greeting niet leesbaar** — eerste poging faalde (background-shorthand reset `background-clip: text`), definitieve fix: op light themes gradient + shimmer volledig uit → solid `var(--gold)` via `-webkit-text-fill-color` op `.tj-logo-text`, plus donkere logo-text via `--tj-text-color:var(--text)` op `.tj-logo`. Donkere themas ongewijzigd. Commits `f4bf6c8`, `2e1c005`.
- [x] 2026-04-22 — **🎯 Persoonlijke greeting + stat-based insight + milestones** — Fase 1: naam-input in Instellingen (`config.displayName`, fallback "trader") + visuele "✓ Opgeslagen" bevestiging (400ms debounce, 1.8s fade). Fase 2: 9-branch priority-chain `getDashboardInsight()` met 31 micro-copy varianten (win-streak, best-week, consistency, discipline, goal-on-track, loss-streak, idle, fresh-user, neutral). Render onder greeting met tone-colored border-left. Fase 3: 9 milestone-celebrations (10/50/100/250/500/1000 trades, win-streak-5/10, first-win) als one-time modal. Persisted in `tj_milestones_seen`. Commits `4d6caa7`, `b0936ef`, `89b9055`, `b312b03`, `29a88e1`.
- [x] 2026-04-22 — **💭 Mindset-reminders geïntegreerd (fase 1)** — 13 quotes (8× Morani-voice + 5× classics, softer tone). 4 contexten live: (1) ochtend-banner rotating per tab-navigatie, (2) pre-trade italic in TradeForm, (3) post-loss toast met 2h cooldown, (4) Dashboard weekly quote-card (beide layouts). Master + per-categorie toggles in Instellingen (`tj_mindset_prefs`). Seen-tracking (`tj_mindset_seen`) voorkomt 7-daagse herhaling. Commits `20bd386`, `58bc1a4`, `6e878af`, `5e600fa`.
- [x] 2026-04-22 — **🎯 Discipline Heatmap in Analytics** — 7×24 (of 7×5 sessies) heatmap in Proces-mode. 6-check score (SL/pre-notitie/setup-tag/binnen-risk/post-notitie/rating) met user-toggleable vinkjes (min 1, persisted in `tj_discipline_checks`). Amsterdam-tijd via `Intl.DateTimeFormat` (DST-aware). Theme-aware kleuren via `color-mix()`. Auto-insights (dag-patroon, tag-discipline, best-day). Min-sample 3 trades/cel (dashed grijs anders). Best/worst slot cards. Commit `726f02d`.
- [x] 2026-04-18 — **Bug: Proxy-sectie verbergen voor community** — `{IS_DEV && ...}` wrapper, `?dev=1` ontgrendelt (persisted). Backup-text en Help-text ontzien van Worker/CORS jargon. Commit `f9d1437`.
- [x] 2026-04-18 — **Bug: Integer-rules + spinner-pijltjes** — Trading Rules + Goals target switched naar `type="text"` + inputMode, integer/decimaal per regel-type, digits-only regex. Commit `86efdcf`.
- [x] 2026-04-18 — **Bug: Content scrolt door top-nav** — `.tj-topbar` → `var(--bg)` met per-theme overrides (sync/aurora/light/parchment/daylight). Alle 6 themas getest. Commit `c2b4d86`.
- [x] 2026-04-18 — **Bug: Trade-modal sluit bij backdrop-click + save onder zicht** — 3-delige fix: (a) backdrop onClick verwijderd, (b) save-knop `position:sticky bottom:0` met `var(--bg)` + border-top, (c) auto-draft naar `tj_trade_draft` met 48h recovery-banner bij volgende app-open. Plus: confirm-dialog "Opslaan / Sluiten zonder opslaan / Annuleren" bij dirty-state close (edit-trade snapshot + new-trade hasContent check). Commits `ad53423`, `45e91c4`, `2430ef5`.
- [x] 2026-04-18 — **MEXC TP-fetch fix + UI-plek logisch** — Worker MEXC-signing nu alfabetisch gesorteerde params (fills/`order_deals` faalde met "Confirming signature failed" omdat `URLSearchParams.toString()` insertie-volgorde behoudt; `open_positions` werkte toevallig omdat daar geen params zijn). TP-fetch knop verhuisd van zwevende TP Tijdlijn-card naar de "TAKE PROFIT NIVEAUS" section header (naast "+ TP toevoegen"), teal-kleur, alleen zichtbaar bij exchange-sourced trades met key geconfigureerd. TPTimeline nu puur visualisatie (returnt null als leeg). Commits `e4ba9e5`, `10e45a0`.
- [x] 2026-04-18 — **MEXC open posities ophalen via API** — nieuwe "📡 Open posities ophalen" knop in Accounts-hub naast "Trades importeren" (MEXC only for now). `App.syncOpenPositions` helper: upsert met behoud van user-velden (tags, notes, rating, SL/TP, manualOverrides), verwijdert "zombie" opens (trades die niet meer in de API-response staan = dichtgegaan op exchange). Toast `X nieuw · Y bijgewerkt · Z dichtgegaan`. Betere Worker MEXC error-reporting (HTTP status + raw body in foutmelding). Commits `73c92d5`, `e4ba9e5`.
- [x] 2026-04-18 — **Blofin API import fixes** — `openAveragePrice` als entry (was leeg), `closePositions` als size per close-event, direction infer uit `(exit-entry)*pnl` bij `positionSide:"net"`, unieke ID per close-event (`blofin_{positionId}_{closeTime}`) zodat partials niet collideren in dedup. Poging tot aggregatie per positionId met tpLevels teruggedraaid (commits `a902abf` → reverted door `de6c15b`/`24a6ae1`). PnL% op tradecards gefixt (was altijd +0.00% — formule deed `entry × positionSize` maar positionSize is al de USDT-notional). Commits `da9d458`, `c60074a`, `de6c15b`, `071255d`.
- [x] 2026-04-18 — **Proces-focus Analytics** (voorstel A — segmented control) — Analytics toont nu `[🧠 Proces | 💰 Winst | 📊 Beide]` pill-keuze bovenaan met Mark Douglas quote. Default Proces voor <100 trades. 4 proces KPIs (Plan gevolgd % / SL discipline % / Journal compleet % / FTMO Consistency) + Risk consistency + Fout-ratio cards. 9 PnL-only secties mode-gated met `showW&&seq()`. Gebaseerd op research 8 concurrenten + Mark Douglas / Van Tharp / Steenbarger. localStorage `tj_analytics_view`. Commits `f48ad51`, `857e852`.
- [x] 2026-04-18 — **Drag handles verplaatst naar linker gutter** — floating top-right werd raar bij grid-secties (zweefde rechts buiten content). Nu consistent 48px gouden knop links, gecentreerd, werkt uniform voor single cards, 4-col grids, 2-col grids én tabellen. Commit `464b42e`.
- [x] 2026-04-18 — **Proces research & thinking doc** — deep-research 8 journals (Edgewonk Tiltmeter/Edge Finder, Tradezella Zella Score, TraderSync Cypher AI, Tradervue tags, Chartlog strategy rules, TradesViz 600+ stats, FTMO Consistency, Topstep) → top 10 proces-metrics, 3 toggle UI-voorstellen, Mark Douglas/Van Tharp/Steenbarger bronnen.
- [x] 2026-04-18 — **2 nieuwe light themes: Parchment + Daylight** — warm cream (Linear/Notion-stijl) + koel wit (Stripe/Vercel-stijl). WCAG AA compliant, gold accent aangepast per bg (#A8832E en #B8912F). Premium layout overrides ge-scoped naar dark themes alleen. Chart.js defaults theme-aware (text/border/tooltip uit CSS vars).
- [x] 2026-04-18 — **Light-theme polish** — year heatmap empty cells (min alpha .4 op light ipv .18 voor zichtbaarheid), Review-pagina scorecard cards (rgba(42,46,57,0.3) → var(--bg4)), Analytics Long/Short cards, Capital tracking balk. Chart.js global sync via useEffect.
- [x] 2026-04-18 — **Trade cards uitgebreid met 5 meme-kaarten** — Boss (Ibiza Final Boss), Goodfellas, Giggling, OMG, Pablo. Alle via herbruikbare `ImageCard` helper (beeld rechts + fade naar links + gouden accent). Base64 embedded, html2canvas compatible. Totaal nu 9 kaart-designs.
- [x] 2026-04-18 — **Rich progressive disclosure op trade-hover** — volledig 3-rij detail (stats grid, thesis/review quotes, meta badges). `trade-detail-row` CSS + React hover state ipv fragiele tbody:hover.
- [x] 2026-04-18 — **Quick-filter bar 2 rijen** — datum van/t/m + presets + richting/resultaat/pairs (rij 1), exchange pills met icon + account-label (rij 2). Pill CSS class foundation toegevoegd.
- [x] 2026-04-18 — **Classic theme + Premium lichter** — lichtere bg (#10111a), helderder groen/rood, meer border-opacity. Classic+Premium combo met aparte gold-tinted orbs.
- [x] 2026-04-18 — **Card modal breder** — trade-card export modal nu 20px padding inset-0 (bijna volledig scherm) ipv 95vw + dynamic scaling op cards. Trade-bewerken modal 760→960px.
- [x] 2026-04-17 — **Bento KPI grid + animated counters** op DashboardPremium — hero P&L card (5fr, 44px gold-shimmer) + 3 KPI sub-cards (7fr). `AnimNum` component telt vloeiend op (800ms cubic ease-out, 60fps). Cascade stagger 70ms per card.
- [x] 2026-04-17 — **Rich progressive disclosure** op trade-hover — 3-rij detail-paneel: stats grid (SL/leverage/risk/fees/hold/PnL%/R-mult/account), gold-border thesis + review notes, meta badges (📐 layers, 🎯 TPs, ★ rating, 📎 links, 📸 screenshot, ⚠ mistakes). React hover-state ipv fragiele CSS.
- [x] 2026-04-17 — **Classic theme + Premium lichter** — achtergronden opgelicht (#0c0d12→#10111a), win/loss kleuren helderder (#5ce0a0/#ff7b7b), goud warmer (#d4b45c), borders zichtbaarder. Classic+Premium combo met aparte overrides.
- [x] 2026-04-17 — **Premium UI polish (ui-demo parity)** — Inter font, antialiased rendering, tabular-nums, button :active feedback (scale .97), gold left-border op hover-reveal notes, warm off-white tekst #E8E4DC, softer green/red.
- [x] 2026-04-17 — **Quick-filter pill bar** — altijd zichtbaar, 2 rijen: datum van/t/m + presets + richting + resultaat + pairs (rij 1), exchange pills met icoon + label (rij 2). Airbnb-stijl rounded pills met gold active state.
- [x] 2026-04-17 — **UI/UX hyper-modern CSS foundation** — gold shimmer sweep, card cascade stagger, glassmorphism hover glow + lift, skeleton shimmer, toast notifications met progress bar (slide-in + 4s countdown). Border-radius 10/14→12/16px. Alles pure CSS, geen deps.
- [x] 2026-04-17 — **Competitive research rapport** — deep-dive 8 concurrenten (Tradezella/TraderSync/Edgewonk/Tradervue/TradesViz/Chartlog/MM Platinum/Deltalytix) + user pain-points + 10 UX-verbeteringen + crypto-niche features + AI roadmap + integraties shortlist. Bevindingen verwerkt in Next up.
- [x] 2026-04-17 — **UI/UX research rapport** — trends 2026 (bento grid, view transitions, progressive disclosure, skeleton loading, animated counters), color/typography advies, 3 wow-factor CSS animaties, 5 missende UI-componenten.
- [x] 2026-04-16 — **Help page volledig herschreven** — 10 categorieën (Sneltoetsen, Data, Accounts, Trade form, Goals, Rules, Analytics, Trade cards, Themes, Versie-flow) met alle nieuwe features uitgelegd.
- [x] 2026-04-16 — **Analytics upgrade met 4 charts uit demo** — R-Multiple distributie (Chart.js histogram, vervangt custom divs), Mistake Impact (Chart.js horizontal bar met $-bedragen + callout), Rolling 20-trade edge (dual-axis line WR%+Expectancy, nieuw), Setup insights tabel (8 kolommen met auto-advies: 🏆 Edge bevestigd / 🚫 Overweeg schrappen / 🎯 Targets verhogen / ⚠ Verliezen te groot / ✓ Consistent). Commit `eb49961`.
- [x] 2026-04-16 — **Analytics demo file** (`analytics-demo.html`, gitignored) — standalone showcase van 10 chart-ideeën met 120 synthetische trades, gebaseerd op onderzoek naar Edgewonk/TraderSync/TradeZella/TradesViz/FTMO. Vervolg-analytics (MFE/MAE, Discipline Score, PnL Calendar, Underwater DD, Funding Drain, Scratch) staan als items in Next up.
- [x] 2026-04-16 — **🎯 Goals sub-tab met custom goals** — nieuwe `GOAL_METRICS` catalog (9 metrics: pnl, winRate, trades, winningDays, avgR, grossProfit, maxDD, profitFactor, expectancy) × `GOAL_PERIODS` (week/month/quarter/year/all). `computeGoalMetric()` + `migrateGoals()` (backwards-compat met oude 4-goal shape). GoalsPage met add/edit/delete + inline progress bar. GoalsRings refactored om `goals.items` te lezen. Commit `a6d7365`.
- [x] 2026-04-16 — **Account-labels + Capital-tracking** (Denny's ideeën, samen in één commit). Labels: preset-chips (Swing/Daytrade/Scalp/News trade/Test/Swing-scalp) + vrije invoer per manual-account én per exchange, gouden sub-regel onder pair in trade-lijst. Capital tracking: `transactions[]` met ➕ Storting / ➖ Opname / ✏️ Correctie per account (beide types), Capital + Equity + Return% live berekend. Correctie = absolute waarde om te syncen met exchange-balance. Commit `940bf44`.
- [x] 2026-04-16 — **Setup Ranking widget** op beide Dashboards — Top 3 / Worst 3 setups by avg R-multiple (fallback avg PnL), min 3 trades per setup, klik rij → filters.setupTags=[tag] + navigate naar Trades. Commit `940bf44`.
- [x] 2026-04-16 — **Risk-per-trade tracking** — `computeTradeRisk()` + `getCapitalForSource()` helpers. saveTrade auto-fills `riskUsd` + `riskPct` tenzij manual override. Live KPI-strip toont nu **Risk $ | Risk % | R:R | Qty** met kleur-thresholds (≤1% groen, ≤2% goud, ≤4% amber, >4% rood = tilt-signaal). Commit `940bf44`.
- [x] 2026-04-16 — **Trade-form UX quick wins** — Status-toggle bovenaan (hide Exit/PNL/Fees/post-trade notes bij Open), live KPI-strip (Risk / R:R / Qty) real-time, 3 collapsible sections via `<details>` (Setup & Psychologie, Media & Links, Notities) met localStorage-persist per sectie. Commit `26e2168`.
- [x] 2026-04-16 — **Deelbare trade-kaart** met 4 designs (Classic / Exchange Ticker / Story / Minimal), Bitcoin (Beta) watermark, statische candle silhouet, corner brackets, field-toggles voor PnL/R/entry/exit/size/hold/setup/session/anoniem. **Copy-to-clipboard** naast Download PNG — direct Ctrl+V plakken in Discord via `navigator.clipboard.write(ClipboardItem)`. Isolated sandbox-capture om parent-CSS (conic-gradient, transform:scale) te vermijden die html2canvas's `createPattern` crashte.
- [x] 2026-04-16 — **⌘K Command Palette** — keyboard-shortcut voor nav-acties + fuzzy search.
- [x] 2026-04-16 — **Goals & Progress Rings** op DashboardPremium — `tj_goals` {monthPnl, winRate, maxDD, monthTrades, enabled{}}.
- [x] 2026-04-15 — **🥈 Trading Rules module** — dedicated sub-tab in Instellingen, regels opslaan als `tj_trading_rules[]`, per-regel handmatige override, collapsible widget op dashboard, per-dag evaluatie.
- [x] 2026-04-15 — **🥉 Daily Journal / Event Log** — `tj_daily_notes` storage, 1 entry per datum met pre-market plan + mood-tags + reflection. Integreert met kalender-view.
- [x] 2026-04-15 — **Premium layout** — aparte `body.layout-premium` class, werkt met alle 4 thema's (8 combinaties). Orthogonaal aan theme. Voorbeelden gebaseerd op `premium-demo.html`.
- [x] 2026-04-15 — **Drag-drop section reordering in Analytics** — modulaire `useSortable` / `SortableSections` / `EditModeBar` helpers, sort-handle met solid bg, geen overlap met content.
- [x] 2026-04-15 — **Review-pagina charts** — zoals v4_14 (equity curve + PnL/day bar).
- [x] 2026-04-15 — **Drop-JSON box** van site weg — Export/Import nog wel via knop in Instellingen.
- [x] 2026-04-14 — **Lokale CCXT-proxy** opgezet (`proxy-local/server.js`) met Express + CCXT + CORS. Draait op `http://localhost:8787`, vervangt tijdelijk de Cloudflare Worker voor Denny + Sebas tijdens dev.
- [x] 2026-04-14 — **MEXC Contract V1 direct** — proxy roept `contract.mexc.com/api/v1/private/position/list/history_positions` aan met HMAC-SHA256 signing. Werkend, geaggregeerde posities binnen.
- [x] 2026-04-14 — **Blofin positions-history direct** — proxy roept `openapi.blofin.com/api/v1/account/positions-history` aan met ACCESS-KEY/SIGN/TIMESTAMP/PASSPHRASE/NONCE. Werkend.
- [x] 2026-04-14 — **Kraken Futures account-log** — via CCXT's `request()` naar `/api/history/v3/account-log`, met paginatie (max 20k entries) en positie-lifecycle tracking (open → partial closes → full close). Partial closes worden `tpLevels[]` in SyncJournal. Werkt globaal, TP-detectie nog te valideren.
- [x] 2026-04-14 — **SyncJournal `getProxyUrl()` bug** — localhost-URLs werden automatisch terug-reset naar Cloudflare. Fixed.
- [x] 2026-04-14 — **Sync `importTrades()` bug** — "Trades importeren" toonde preview maar sloeg niets op. Nu voegt 'ie toe aan de journal.
- [x] 2026-04-14 — **Online onderzoek exchange-API's** via `web-search-agent`: CCXT (MIT, 37k stars) dekt alle 4 crypto-exchanges. FTMO vereist CSV-import. Geen bestaande Claude-subagents voor trading.
- [x] 2026-04-14 — **MEXC Position History + Order History CSV/XLSX import** — SheetJS CDN toegevoegd, parser detecteert 2 MEXC-formats. Position History geeft entry+exit+pnl; Order History filtert op Closing PNL. Disclaimer alleen voor MEXC.
- [x] 2026-04-14 — **Blofin CSV standalone (FIFO reconstructie)** — open-lots queue per symbol, reduce-only fills trekken af, emit bij size=0. Orphan closes krijgen "⚠ partial data" flag. PnL = net (CSV pnl − fees).
- [x] 2026-04-14 — **Blofin CSV timezone fix** — CSV-tijden geïnterpreteerd als UTC, display converteert naar browser-local. Matcht nu Blofin UI.
- [x] 2026-04-14 — **Kraken CSV positie-lifecycle tracking** — zelfde algoritme als API proxy, bundelt partial fills per contract. Orphan closes → virtuele positie met partial_data flag + entry uit `new_average_entry_price`.
- [x] 2026-04-14 — **Blofin API handler** — directe call naar `/api/v1/account/positions-history` met ACCESS-KEY/SIGN/TIMESTAMP/PASSPHRASE/NONCE signing.
- [x] 2026-04-14 — **MEXC & Blofin TP's ophalen (fills)** endpoints — proxy roept order_deals (MEXC) en fills-history (Blofin) aan; client mapt naar tpLevels.
- [x] 2026-04-14 — **Snel-filter presets** — Vandaag / Deze week / Deze maand / Alles in FilterBar.
- [x] 2026-04-14 — **Voor-trade notitie** — "Waarom ga ik erin?" veld in TradeForm, apart van post-mortem notes. `entryNote` field op EMPTY_TRADE.
- [x] 2026-04-14 — **Sync vanaf default = 1e van maand** — zowel UI-display als sync() startTime.
- [x] 2026-04-14 — **Datumformaat dd-mm-yyyy** — `fmtNL()` helper, toegepast op trade-lijst, review highlights, CSV preview. Storage blijft ISO.
- [x] 2026-04-14 — **🎯 TP's ophalen knop** in TPTimeline — per exchange fills ophalen en als tpLevels mappen op trade.
- [x] 2026-04-14 — **📄 Importeer CSV/XLSX knop** verplaatst naar exchange-paneel (naast "Trades importeren") ipv tiny icoon in sidebar.
- [x] 2026-04-14 — **Cloudflare Worker gedeployed** via `wrangler` → `morani-proxy.moranitraden.workers.dev`. Code in `worker/proxy.js`. Vervangt v3.
- [x] 2026-04-14 — **MEXC + Kraken API via Worker** werkend. Position-history voor MEXC, account-log met minute-bucket aggregatie voor Kraken.
- [x] 2026-04-14 — **Kraken minute-bucket aggregatie** (reverted van position-lifecycle): partial fills binnen zelfde minuut/contract/richting → 1 trade. Simpel en betrouwbaar.
- [x] 2026-04-14 — **Blofin direct vanuit browser** — geen Worker meer nodig. Cloudflare blokkeerde Worker→Blofin (beide op Cloudflare, bot-protection). `_direct()` helper met WebCrypto HMAC-signing + ACCESS-NONCE. Werkt standalone + client-side filtering op startTime.
- [x] 2026-04-14 — **API-sync preview-flow** — "Trades importeren" toont nu hetzelfde preview-scherm als CSV/XLSX (filter long/short + win/loss, selecteren, dedup). Pas op "Importeer" klik worden trades geladen.
- [x] 2026-04-14 — **Preview-titel dynamisch** — "Import preview" voor API, "CSV / XLSX import" voor bestanden.
- [x] 2026-04-14 — **Proxy server panel verplaatst** naar Instellingen (onder Auto-sync). Was voorheen los blok rechts in exchange-paneel.
- [x] 2026-04-14 — **Light theme toegevoegd** — 4e thema (naast SyncJournal, Classic, Aurora). Wit/cream bg, donkere tekst, brons-goud accent.
- [x] 2026-04-13 — Projectopzet: `CLAUDE.md`, memory, `.gitignore`, GitHub-handleiding.
- [x] 2026-04-13 — Custom subagents aangemaakt: `html-feature-diff`, `exchange-integrator`, `pr-reviewer-nl`.
- [x] 2026-04-13 — `tradjournal_v9_morani.html` → `tradejournal.html`, titel/versielabel gezet naar `SyncJournal v9.0.0`.
- [x] 2026-04-13 — Feature-diff v4_14 vs v9 uitgevoerd (zie onderaan).
- [x] 2026-04-13 — `schemaVersion` geïntroduceerd (`tj_schema_version` key, `runSchemaMigrations()` runt bij opstart, baseline = v1).
- [x] 2026-04-13 — v12 baseline vervangen (`tradjournalv12.html` → `tradejournal.html`), titel → `SyncJournal v12`.
- [x] 2026-04-13 — `calcExpectancy` helper toegevoegd (miste in v12 → Dashboard crasht zonder).
- [x] 2026-04-13 — **TP niveaus editor** (add/remove/status-toggle, multi-TP, auto winst/R:R) geport uit v4_14 naar v12 TradeForm.
- [x] 2026-04-13 — **TradingView links** sectie geport: meerdere links per trade, met commentaar, reorder (▲▼), open-in-tab, verwijder. Screenshot-label bijgewerkt.
- [x] 2026-04-13 — **CSV-import per exchange** (MEXC/Blofin/Kraken) in Instellingen: 📄 knop per exchange, herkent Kraken log-format + generieke CSV, deduped import.
- [x] 2026-04-13 — **Auto-sync interval** toegevoegd (`config.syncInterval`, Uit/15/30/60 min). Default Uit zolang MEXC-API nog niet werkt.
- [x] 2026-04-13 — **Standaard quote asset** setting (USDT/USDC/USD) in Instellingen.
- [x] 2026-04-13 — **3 thema's** werkend: `SyncJournal` (default v12 look), `Classic` (v4_14 solid), `Aurora` (v4_14 Morani Signature hernoemd — mesh gradient orbs + glasmorfisme). Oude `theme:"morani"` waardes vallen automatisch terug op `sync`.
- [x] 2026-04-13 — **CSV-import preview UI** geport: na CSV-pick komt een preview met filter (long/short, win/loss), sorteerbare kolommen (side/pair/datum/pnl), per-rij selectie, "Selecteer gefilterde" / "Selecteer alles". Importeert alleen geselecteerde trades.
- [x] 2026-04-13 — **Analytics uitgebreid**: R:R analyse (gemiddeld gepland/gerealiseerd + per setup + per entry-timeframe), Holdtijd-buckets, Uur heatmap (24 cellen met intensiteit). Respecteert bestaande layout-gear toggles.
- [x] 2026-04-13 — **Review charts** toegevoegd: SVG equity curve, PNL/dag bars, 3 donuts (Win/Loss, Long/Short, Sessies). Self-contained (geen Chart.js dependency), responsive grid.
- [x] 2026-04-13 — **Onboarding flow** — welkom-modal heeft nu 2 keuzes (Koppel accounts / Log een trade) + "Later kiezen".
- [x] 2026-04-13 — **Backup-knop zichtbaar** in Instellingen → Accounts (Export + Import backup met counter).
- [x] 2026-04-13 — **Hash routing / deeplinks** geport uit v4_14: `#/trades/edit/:id` werkt, browser back/forward synchroniseert tab, deeplinks openen direct de juiste view.
- [x] 2026-04-13 — **Export/Import JSON geharmoniseerd**: backup bevat nu `trades + tagConfig + accounts + config` (proxy-URL, thema, quote, sync-interval, exchange-keys, `schemaVersion`). Drag-drop import herstelt alles. Filename → `syncjournal-backup-YYYY-MM-DD.json`.
- [x] 2026-04-13 — **Custom setups & confirmations** afgevinkt: v12's TagManager ondersteunt al editable tags; nu ook via backup geborgen dankzij export/import-harmonisatie. Aparte `tj_csetups`/`tj_cconfs` zijn overbodig.

---

## 📊 Feature-diff snapshot (v4_14 → v9, 2026-04-13)

> Gegenereerd door `html-feature-diff` agent. **Historisch:** v12 heeft sindsdien eigen wijzigingen. Gebruik als leidraad, niet als waarheid.

### Alleen in v4_14 (Denny) — kandidaten voor migratie
- **PDFReportModal** — volledige PDF-generator (jsPDF + html2canvas), secties selecteerbaar — [TradeJournal_v4_14.html:1549-1836](TradeJournal_v4_14.html#L1549). CDN's + `onReport`-hook staan klaar, component ontbreekt.
- **ReviewDashboard + ReviewCharts** — equity curve, PnL/day, vergelijk vorige periode — [TradeJournal_v4_14.html:1933](TradeJournal_v4_14.html#L1933).
- **Hash-based routing / deeplinks** — `#/trades/edit/:id` — [TradeJournal_v4_14.html:4327](TradeJournal_v4_14.html#L4327).
- **Onboarding flow (2 keuzes)** — [TradeJournal_v4_14.html:4567](TradeJournal_v4_14.html#L4567).
- **Custom setups/confirmations opslag** — `tj_csetups` / `tj_cconfs` met merge in tagConfig — [TradeJournal_v4_14.html:4370-4378](TradeJournal_v4_14.html#L4370).
- **Bulk Export CSV + JSON** — volgens help-doc — [TradeJournal_v4_14.html:1847](TradeJournal_v4_14.html#L1847).
- **Uitgebreide Analytics** — R:R per timeframe, heatmaps, layer-analytics — [TradeJournal_v4_14.html:2738-3266](TradeJournal_v4_14.html#L2738).

### Alleen in v9/v12 (Sebas) — houden
- **IndexedDB storage** + migratie vanuit localStorage.
- **Storage usage monitoring + `StorageWarning`**.
- **`safeSave()` met quota-error afhandeling**.
- **Configureerbare proxy URL** `tj_proxy_url`.

### Storage-schema
- Alleen in v4_14: `tj_csetups`, `tj_cconfs`, `tj_onboarded`
- Alleen in v12: `tj_welcomed`, `tj_proxy_url`, `tj_schema_version`, IndexedDB `morani_trades_v1`
- Gedeeld: `tj_trades`, `tj_config`, `tj_accounts`, `tj_tags`, `tj_layout_*`, `tj_sizeMode`, `tj_sizeInputMode`

### Verificatiepunten
- Of v4_14's Analytics écht rijker is of alleen anders gestructureerd.
- Of v12's AccountsHub een werkende JSON-export heeft (prop-shape verschilt).
- Of Calendar in beide gelijkwaardig is.
