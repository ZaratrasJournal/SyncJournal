# Changelog

Alle noemenswaardige wijzigingen aan SyncJournal. Versies volgen [semver](https://semver.org/): `major.minor`.

Na elke community-release verschijnt hier een nieuw blok. Vragen of feedback? Drop in de Morani Discord.

---

## [v12.24] — 2026-04-24

### Gewijzigd
- **`Sparkline` component is nu responsive** — gebruikte een hardcoded 60×24 viewport en renderde daardoor als een minuscuul icoontje in de nieuwe brede BTC-card. Nu: `width="100%"` + `viewBox="0 0 600 H"` + `preserveAspectRatio="none"` + `vectorEffect="non-scaling-stroke"` → de svg rekt zich horizontaal tot de beschikbare container-breedte, lijn-dikte blijft constant, height prop stuurt verticale maat (default 60). Alleen gebruikt in DashboardPremium BTC-card op dit moment, dus geen risico voor andere plekken.

## [v12.23] — 2026-04-24

### Gewijzigd
- **Content vult nu de volledige breedte** (horizontaal + verticaal). v12.22 maakte de layout verticaal viewport-vullend, maar de content bleef gecentreerd op `maxWidth: 1520px` op brede schermen. Die cap is weg — `tj-content` heeft nu alleen `padding: 28px 40px` en strekt over de volle vensterbreedte, net als de SyncJournal-demo.

## [v12.22] — 2026-04-24

### Gewijzigd
- **Viewport-vullende layout** voor alle tabs (zelfde patroon als SyncJournal-demo). `html/body` staan nu op `height:100%` + `overflow:hidden` — browser-scroll is uit. De root-container is een flex-column van 100vh hoog. De **topbar blijft altijd zichtbaar** bovenaan (geen sticky meer nodig want flex-child). Daaronder een **scroll-wrapper** (`flex:1, overflow:auto, minHeight:0`) die alle content + footer-hint bevat. Modals (Welcome, closeConfirm, mindsetToast, draft-recovery banner) blijven `position:fixed` — niet geraakt.
- **Gevolg**: geen meer "overall page scroll" met topbar die meeglipt. Elke tab heeft z'n eigen scroll-positie intern. Bij veel content (lange Trades-lijst, Analytics, Help-FAQ) scrollt alleen het content-gebied, niet de hele pagina.

## [v12.21] — 2026-04-24

### Toegevoegd
- **Real-time BTC-ticker via Binance public WebSocket** — nieuwe herbruikbare `useBtcTicker()` hook. Directe verbinding naar `wss://stream.binance.com:9443/ws/btcusdt@ticker` (geen auth, CORS-enabled). Levert live price, 24h change $/%, 24h high/low/volume, directional flash (up/down). Auto-reconnect bij disconnect (3s delay). Status-veld voor UI-feedback: `connecting` / `live` / `reconnecting` / `error`.
- **Dashboard (premium-layout) — volledige overhaul naar SyncJournal "premium terminal"-stijl**:
  - Hero: Terminal-subtitle + "Goedemorgen, {naam}" met gold-shimmer, insight-line, month/trades/WR/streak-samenvatting, rechts period selector (1D/1W/1M/3M/YTD/ALL) + Sync + Nieuwe trade knoppen.
  - **BTC Live Feed card**: grote live prijs (kleurwissel bij up/down), Sparkline over laatste 60 ticks, 24H high/low/volume, "Trade BTC" shortcut (opent Nieuwe Trade met pair=BTC/USDT), "LIVE BINANCE" status indicator.
  - **Equity Curve card** (bestaand `EquityCurveChart`, nu met HIGH / END headers).
  - **Trade Tape** (laatste 10 trades, compact tabel met Tijd/Pair/Dir/PnL/Rating) + **Pairs MTD** (top 6 pairs deze maand, horizontale bar per pair met + en − breedte-splits), side-by-side.
  - **Key Metrics sidebar** (9 rijen: WR / PF / Expectancy / Avg R:R / Avg Win / Avg Loss / Streak / Total / Net P&L).
  - **AI Insight card** (dynamisch — toont beste setup > 3 trades met WR + PnL).
  - **Risk Alert card** (verschijnt alleen bij ≥3 emotionele trades met negatief netto — FOMO / Gehaast / Tilt / Revenge tags).
  - **Trading Rules compliance widget** verhuisd naar sidebar (compact).
  - **Daily Journal** compact in sidebar (plan + mood-tags, openen → Calendar).

### Verwijderd uit Dashboard-premium (verplaatst of niet langer getoond)
- Oude "BENTO KPI" grid (Net P&L hero + 3 kleinere KPIs) — vervangen door Key Metrics sidebar.
- `SetupRankingWidget` (Top 3 / Worst 3 setups op dashboard) — blijft bestaan als component, niet meer op Dashboard maar wel via Analytics-tab.
- Oude "Top Setups" zijblok + 3-kolom grid — vervangen door AI Insight + Pairs MTD.

### Niet veranderd
- Standard-layout (`config.layout !== "premium"`) blijft intact voor users die minimalistisch willen.
- `GoalsRings` blijft bovenaan dashboard als goals geconfigureerd zijn.
- Mindset-ochtendbanner (`morningQuote`) rendert globaal op elke tab — niet aangeraakt.
- Alle helpers (`AnimNum`, `Sparkline`, `EquityCurveChart`, `TradingRulesWidget`, `buildInsightContext`, `getDashboardInsight`) hergebruikt.

### Ook
- Binance-hook wordt momenteel alleen in tradejournal.html Dashboard gebruikt. Syncjournal.html kreeg dezelfde hook voor z'n BTC-card + status bar (tweede commit in deze release).

## [v12.20] — 2026-04-24

### Toegevoegd
- **Setup Edge** (nieuwe Analytics-widget) — compacte tabel in SyncJournal-stijl met per setup-tag: aantal trades, win-rate, totaal PnL, en progress-bar (WR-breedte, groen bij positieve PnL / rood bij negatieve). Klik een rij om in Trades te filteren op die setup. Gebruikt inline aggregatie op `(t.setupTags||[])`. Toggle-baar via Analytics-settings (`lp.setupEdge`), zichtbaar direct na "Setup insights" in de default-volgorde.

### Gewijzigd
- **Emotie impact op PNL** — visuele overhaul naar SyncJournal-stijl 2-kolom kaart-grid. Elke kaart toont per emotie: de emotie-naam + POS/NEG badge, netto PnL (groot mono getal), en "n trades · X% WR" subregel. Kleur-accent (green/red border) op basis van PnL-sign. Vervangt de oude bar-row layout. Datasource en toggle-key (`emotionImpact`) onveranderd — bestaande user-prefs blijven werken.

### Research-basis
Beide widgets komen 1:1 uit de SyncJournal design-handoff demo (`work/syncjournal.html`) zodat de visuele taal van tradejournal.html stap-voor-stap richting de nieuwe look groeit. Pad A (dashboard-vervanging) volgt in een latere release.

## [v12.19] — 2026-04-24

### Gewijzigd
- **Feature-referentie groepen zijn nu inklapbaar** (accordeon, zelfde patroon als de FAQ). Elke groep-header toont item-count en een +/− toggle. Standaard dicht; klik om te openen. "Alles open" + "Alles dicht" knoppen rechtsboven de referentie voor bulk-toggle.
- **"🌳 Versie-flow" groep verwijderd uit Feature-referentie** — dev-interne informatie (work/ vs main/ workflow tussen Denny + Sebas) hoort niet in user-gerichte help. Update-pad is nu volledig gedekt door de FAQ-entry "Hoe check ik of er een update is?" die zelfstandig leest.

## [v12.18] — 2026-04-24

### Gewijzigd
- **FAQ + Feature-referentie ontdubbeld** — v12.17 bracht FAQ én bestaande feature-secties naast elkaar, met behoorlijke overlap. Opschoning per onderwerp (één plek per onderwerp):
  - **FAQ als primary** voor user-gerichte vragen (zoekbalk + Q&A-stijl).
  - **Feature-referentie** behoudt alleen unieke feature-details die geen natuurlijke Q&A vormen.
- **Uit Feature-referentie verwijderd** (staat in FAQ):
  - Hele groep "⌨️ Sneltoetsen" — volledig in FAQ "Waar vind ik sneltoetsen?"
  - "Automatische opslag" + "JSON export/import" + "Drag & drop import" — FAQ "Data & privacy" en "Backup & versies" dekken dit.
  - "Capital tracking" + "Equity & Return %" — FAQ "Capital vs Equity".
  - "API koppeling" + "CSV / XLSX import" — FAQ per-exchange entries.
- **Feature-referentie behoudt**: Storage-limiet (legacy localStorage), Account-labels, Trade form details, Goals, Trading Rules, Analytics feature-uitleg, Trade cards, Themes & layouts, Versie-flow.
- **Uit FAQ verwijderd**: "Hoe check ik of er een update is?" → samengevat + verwijst naar Feature-referentie (daar staat het gedetailleerde update-pad). "Wat is het verschil tussen work/ en main/?" → Feature-referentie "Versie-flow" dekt dit completer.

## [v12.17] — 2026-04-24

### Toegevoegd
- **Demo-modus voor sceptische eerste-sessie users** — nieuwe derde knop "📊 Probeer met demo" in de Welcome-modal. Laadt 10 realistische fake trades (mix BTC + ETH + FTMO, win/loss, met tags/entry-notes/TP-levels) zodat Analytics, Dashboard, Heatmap en Charts direct laten zien wat de app kan zónder API-sync of handmatige invoer. Blauwe banner bovenaan met "🗑 Wis demo-data"-knop zolang demo-modus actief is. `buildDemoTrades()` helper bovenin, state via `localStorage.tj_demo_mode="1"`. Inspired by TraderSync's "onboarding game" pattern.
- **Startersguide bovenaan Help-pagina** — 3-path keuze (Exchange sync / CSV-MT5 / Demo) met elk een 3-stappen flow. Oriëntatie voor nieuwe users, bevestiging voor ervaren users.
- **FAQ-accordeon met zoekbalk** (~30 Q&A's in 6 categorieën) — Aan de slag, Data & privacy, Exchange-koppeling, Features, Problemen oplossen, Backup & versies. Zoekbalk filtert op substring in vraag + antwoord + categorie. Accordeon-items onthouden hun open-state binnen de sessie. Data-array `FAQ_ENTRIES` bovenin de HTML zodat elke release de FAQ in dezelfde PR kan bijwerken.

### Gewijzigd
- **Welcome-modal**: grid van 2 → 3 kolommen, compactere padding zodat 3 paden netjes passen naast elkaar. Nieuwe "Probeer met demo" gebruikt Hyperliquid-blauw (`#00c2ff`) om op te vallen als de "speelse" route.
- **HelpPage-structuur**: bestaande 10 feature-secties behouden, nu onder een duidelijke "📚 Feature-referentie"-kop. Top van de pagina is nu onboarding-first (startersguide → FAQ → referentie).

### Research-basis
Aanpak is op onderzoek gebaseerd naar hoe TraderSync, TradesViz, Edgewonk en Tradezella onboarden. Key inzichten: (1) **"laat sceptici eerst spelen"** (TraderSync demo-data), (2) **per-broker mini-guides** (TradesViz), (3) **FAQ-accordion als primary** (niet externe docs-site bij kleine community), (4) **data-array in code** voor lage onderhoudslast bij single-file HTML.

## [v12.16] — 2026-04-23

### Fixed
- **Hyperliquid API-import: sub-fill aggregatie + juiste `closedPnl`-conventie** — bij diepgaandere vergelijking van API vs CSV tegen een echt wallet-adres bleken twee problemen, die samen de netto-PnL structureel lieten afwijken:
  1. **Sub-fills**: Hyperliquid's API levert soms meerdere fills op dezelfde ms (bv. `0.00017 + 0.00207 = 0.00224 BTC`) voor één logisch order. Hun eigen CSV-export consolideert die server-side tot één regel. Onze parser emit per close-fill een trade → API-route kreeg hierdoor "extra" duplicate trades. Fix: nieuwe `_aggregateSubFills` stap vóór FIFO die sub-fills op `(ms, coin, dir)` samenvoegt met size-weighted average px + gesommeerde fee + closedPnl.
  2. **`closedPnl` convention mismatch**: de API retourneert `closedPnl` als **gross PnL** (geen fees afgetrokken), de CSV als `gross − close_fee`. Mijn v12.15 helper nam de CSV-conventie aan voor beide, waardoor API-netto telkens te gunstig was (alleen open-fees werden afgetrokken, close-fee werd gemist). Fix: helper hanteert nu API-conventie als intern formaat (`closedPnl = gross`), CSV-parser normaliseert naar die stijl door `+ fee` op elke rij; helperformule is `netPnl = closedPnl − (close_fee + Σ open_fees)` = `pnlN − totalFee`.

### Verificatie
Gevalideerd tegen live wallet `0x1Bd6519AedE0A6cB8ecB37B4C94bA9f0AC3911Be` (72 API-fills, 68 CSV-regels in zelfde tijdrange):
- API: 33 trades, Σ netto PnL −$8.3548, Σ fees $3.6207
- CSV: 33 trades, Σ netto PnL −$8.3548, Σ fees $3.6207
- Per-trade diffs > $0.001: **0**

### Leermoment
De v12.15 research-agent interpreteerde Hyperliquid's docs-formule `closedPnl = fee_close + side*(exit−entry)*sz` verkeerd (las het als "gross − fee"). Directe meting tegen live data liet de juiste conventie zien. Docs blindelings vertrouwen < echte response inspecteren.

## [v12.15] — 2026-04-23

### Fixed
- **Hyperliquid API-import miste entry-prijzen + rekende open-fees niet bij PnL** — de v12.12 API-parser filterde alleen close-fills en nam `netPnl = closedPnl − close_fee`. Maar Hyperliquid's `closedPnl` op een close-fill is al `gross − close_fee`, en de fees van de bijbehorende opens moeten er ook nog af. Gevolg: entry toonde "N/A", PnL was systematisch iets te gunstig, en `date/time` was de close-tijd in plaats van de open-tijd (inconsistent met de CSV-route en met TradesViz/TraderSync-conventie).
- **Fix via gedeelde FIFO-helper** `ExchangeAPI.hyperliquid._reconstructTrades(fills, idPrefix)`. Zowel `fetchTrades` (API) als de CSV-parser (`isHyperliquidFills` branch) sturen nu hun fills door deze ene helper. Gewogen-gemiddelde entry-prijs over alle opens die een close dekken, `netPnl = close.closedPnl − Σ(open_fees)`, date/time op open-tijd. Identieke output van beide paden gevalideerd met 67-fill sample: 33 trades, netto −$8.35, fees $3.62.
- **Research-bevestiging**: FIFO-matching is industrie-standaard (TraderSync biedt FIFO/LIFO/Weighted keuze, CoinLedger gebruikt FIFO by default, Hyperliquid's eigen docs definiëren entry als position-size-weighted gemiddelde). Flip-fills `Long > Short`/`Short > Long` blijven in MVP overgeslagen.
- **Dedup verbeterd**: API gebruikt `tid` (Hyperliquid's unieke fill-ID) als dedup-sleutel → stabiel bij re-sync. CSV gebruikt `openMs_coin_side_closeMs` fingerprint. Prefixes `hyperliquid_` vs `hyperliquid_csv_` voorkomen botsing tussen de twee routes.

## [v12.14] — 2026-04-23

### Toegevoegd
- **Hyperliquid CSV-import** — complementeert de v12.12 API-route voor oudere trades (API levert max 10.000 recente fills). Het compacte export-format van Hyperliquid is `time,coin,dir,px,sz,ntl,fee,closedPnl`. Parser doet FIFO-matching: opens worden per `coin+direction` in een queue geduwd, closes poppen matching opens in chronologische volgorde met gewogen entry-prijs bij partial fills. PnL-berekening: close's `closedPnl` is al (gross − close-fee); open-fees worden er nog van afgetrokken voor echte netto. Open fills zonder matching close (open posities aan einde van export) worden overgeslagen.
- **Hyperliquid instructieblok** nu twee-opties: A) wallet-adres live sync, B) CSV-import — met stappenplan per route.
- **Datum-parser** `D-M-YYYY - HH:MM:SS` (Hyperliquid's eigen format) → ISO `YYYY-MM-DD HH:MM:SS` voor ons schema.
- **Auto-detect header**: `time[0] + coin + closedPnl + dir + ntl` is uniek voor Hyperliquid CSV (onderscheid met FTMO, Blofin, MEXC, Kraken).

### Known limitations
- Flip-fills `Long > Short` / `Short > Long` worden overgeslagen (zeldzaam, MVP keeps parser simple).
- Spot asset-namen met `@ID`-notatie worden getoond als `@ID (spot)` (spotMeta-lookup komt fase 2).
- Geen funding-correctie (Hyperliquid levert funding via apart endpoint/bestand — fase 2).

## [v12.13] — 2026-04-23

### Gewijzigd
- **Hyperliquid wallet-adres gemaskeerd on-blur** — na invoer toont het veld `0x628Dbd…E888` i.p.v. het volledige 42-char adres. Klik in het veld → volledig adres terug, om te bewerken. Beschermt tegen shoulder-surfen wanneer je je journal aan iemand laat zien. Disclaimer is ook strakker gemaakt: "Je Hyperliquid-trades zijn public on-chain. Iedereen met je wallet-adres kan ze inzien."

## [v12.12] — 2026-04-23

### Toegevoegd
- **Hyperliquid API-integratie** (fase 1) — nieuwe "Hyperliquid" exchange in Instellingen → Accounts. Geen API-key nodig, alleen wallet-adres (0x… 40-hex). Directe browser-calls naar `https://api.hyperliquid.xyz/info` (CORS-enabled, geen Worker, geen signing). Ondersteunt:
  - **Trades importeren** — pagineert `userFillsByTime` in batches van 2000, filtert op close-fills (`Close Long`/`Close Short`/flip/`Sell`-spot), dedup via `tid`. Default sync-window 90 dagen, configureerbaar via "Sync vanaf".
  - **Open posities ophalen** — `clearinghouseState` → `assetPositions` → direction + entry + size + uPnL + liquidation price.
  - **Verbinding testen** — valideert adres (regex) + toont `marginSummary.accountValue`.
- **Nieuwe `walletOnly` flag** in `ExchangeAPI`-registry. UI toont "Wallet-adres" input i.p.v. API Key/Secret, plus een gele privacy-disclaimer ("je wallet-adres is publiek — iedereen kan je trades zien"). `test` / `sync` / `syncOpen` handlers pass `walletAddress` als eerste argument door naar `fetchTrades(walletAddress, null, null, startTime)`.
- **Hyperliquid instructieblok** in Instellingen — 3-stappen uitleg + fase-1 kanttekeningen (perps only, geen funding-correctie, spot-pairs tonen als `@ID (spot)` zolang spotMeta-lookup ontbreekt).

### Known limitations (fase 1)
- Entry-prijs niet afgeleid uit losse close-fills (zou per-position aggregatie vereisen). Getoond als leeg; user kan handmatig invullen.
- Funding-betalingen niet inbegrepen in PnL (HL levert die via apart `userFunding`-endpoint — fase 2).
- Spot `@ID` asset-naam niet vertaald (lookup via `spotMeta` — fase 2).
- API-limiet: laatste 10.000 fills. Voor oudere history komt CSV-import later.
- "Long > Short" / "Short > Long" flip-fills worden als 1 trade geregistreerd met een waarschuwingsnotitie — technisch is het een close + nieuwe entry in één order.

## [v12.11] — 2026-04-23

### Fixed
- **Blofin: positie-size was 1000× te groot voor API-imports** — Blofin's `/positions` en `/positions-history` endpoints leveren quantity in **contracts**, niet in base currency. 1 BTC-USDT contract = 0.001 BTC (via Blofin's `/market/instruments` endpoint, veld `contractValue`). Voor 2.9 contracten werd `positionSize=2.9 BTC` opgeslagen waar `0.0029 BTC` correct was — factor 1000. Fix: `ExchangeAPI.blofin._getContractValue(instId)` fetcht het instruments-endpoint één keer per 15 min en cachet de map. `fetchOpenPositions` en `fetchTrades(positions-history)` vermenigvuldigen `positions × contractValue` → echte asset-qty, vervolgens `× entry` → USD notional. Werkt voor alle Blofin perps (BTC=0.001, ETH=0.01, SOL=1, DOGE=1000, PEPE=10.000.000 etc.).
- **v12.10 size-swap heuristiek gereverteerd** — de heuristiek `positionSizeAsset="" + entry > positionSize*10` kon API-contracts (positionSize=2.9) niet onderscheiden van CSV-qty (positionSize=0.0028) en maakte API-geïmporteerde Blofin-trades juist 1000× te groot. `normalizeTrade()` doet nu alleen nog prijs-normalisatie (trailing zeros). Correctheid van size-data wordt aan de bron geregeld (API + CSV-parser).

### Gewijzigd
- **Actie voor Blofin-gebruikers**: trades die via de API zijn ingeladen onder v12.10 hebben corrupte `positionSize` / `positionSizeAsset`. Fix: Instellingen → Accounts → Blofin → klik opnieuw **Trades importeren** (overschrijft op trade-ID) én **Open posities ophalen**. Nieuwe data is correct. Bij CSV-imports blijft alles werken — CSV bevat al asset-qty met unit (bv. `"0.0028 BTC"`) en heeft de contract-conversie niet nodig.

## [v12.10] — 2026-04-23

### Fixed
- **Blofin: trailing-zero rommel in entry / SL / TP / exit** — prices als `2355.000000000000000000` (floating-point string-representatie vanuit de Blofin API / CSV) worden nu bij import én bij laden uit IndexedDB genormaliseerd naar `2355`. Nieuwe `normPrice()` helper gebruikt `String(parseFloat(v))` voor minimale representatie. Geldt voor fetchTrades, fetchOpenPositions (inclusief stopLoss/takeProfit/unrealizedPnl/liquidationPrice), en CSV-import (entry/exit/TP-levels).
- **Blofin CSV: positie-size viel op de verkeerde plek** — asset-qty (bv `0.12` BTC) werd opgeslagen in `positionSize` (bedoeld voor USD-notional) en `positionSizeAsset` bleef leeg. Form toonde `$0.12` of niks. Nu: `positionSize` = avgEntry × qty (USD), `positionSizeAsset` = qty. Zelfde split voor orphan-close-rijen en open posities via API.

### Gewijzigd
- **Trade-migratie bij laden** — elke trade wordt bij read uit IndexedDB of localStorage door `normalizeTrade()` gehaald. Fixt bestaande Blofin-imports retroactief: trailing zeros verdwijnen, en size wordt geswapt wanneer `source="blofin"` + `positionSizeAsset` leeg + `entry > positionSize*10` (heuristiek voor qty-in-size-veld).

## [v12.9] — 2026-04-23

### Toegevoegd
- **FTMO (MT5) CSV-import** — nieuwe exchange "FTMO (MT5)" in Instellingen → Accounts. Geschikt voor elke MT5-broker die het MetriX-kolomformaat exporteert (Ticket, Open, Type, Volume, Symbol, Price, SL, TP, Close, Price, Swap, Commissions, Profit, Pips, Trade duration). Positioneel parsen lost de dubbele "Price"-kolom op. Swap + commissie worden als fees opgeslagen, Profit wordt naar netto PnL genormaliseerd voor consistentie met andere exchange-parsers. Symbol-formatting naar `X/USD`, `X/EUR`, `X/JPY` etc. afhankelijk van quote-currency.
- **`csvOnly` flag voor exchanges** — nieuwe flag in `ExchangeAPI`-registry. Bij gezet verbergt de UI de API-key/secret velden en Test/Sync-knoppen. FTMO gebruikt deze flag omdat er bewust geen API-koppeling is (FTMO heeft geen publieke API, MetaApi-route schaalt niet gratis naar community).

### Waarom geen FTMO auto-sync
MT5 heeft geen publieke REST API. Third-party bruggen zoals MetaApi.cloud werken wel (read-only investor password route), maar schalen niet gratis boven 1-2 accounts. CSV-route werkt voor iedereen zonder externe dependencies of maandelijkse kosten. Als later een betaald model haalbaar is, kan MetaApi-integratie in de bestaande `proxy-local/worker.js` bijgebouwd worden.

## [v12.8] — 2026-04-22

### Toegevoegd
- **Blofin SL/TP live meekomen met open posities** — tweede API-call naar `/api/v1/trade/orders-tpsl-pending` na ophalen van open posities. SL/TP worden automatisch geladen, gematched per instrument + positie-side. Verschijnen direct in je trade-detail bij een open Blofin-trade. Werkt silent — faalt de tweede call dan zijn de posities nog steeds bruikbaar zonder SL/TP.
- **🔄 Live auto-refresh voor open posities** — nieuwe pill-row in Instellingen → Accounts (onder Auto-sync): `[Uit][30 sec][1 min][2 min]`. Default Uit. Ververst elke interval alle gekoppelde exchanges (MEXC + Blofin + Kraken) op open posities inclusief unrealized PnL, SL/TP, liquidation price. Silent — geen toasts. Pauzeert wanneer browser-tab inactief is. Tradezella-niveau live-tracking zonder backend/WebSocket.

### Gewijzigd
- **Smarter merge-logica in `syncOpenPositions`**: `stopLoss` en `takeProfit` worden nu overschreven door een niet-lege API-waarde (Blofin SL/TP verschuift → journal volgt). Manual-overrides (via `manualOverrides` array) blijven altijd winnen. Andere user-velden (notes, tags, rating) zijn nog altijd volledig beschermd.

## [v12.7] — 2026-04-22

### Toegevoegd
- **📡 Open posities ophalen — nu voor Blofin (+ Kraken)** — de knop in Instellingen → Accounts verschijnt nu automatisch voor elke exchange die `fetchOpenPositions` ondersteunt. Gap onderzocht t.o.v. Tradezella/TraderSync/Edgewonk.
- **Live unrealized PnL** in de Trades-tabel voor open Blofin-posities: `~+$X` markering in de PnL-kolom (tilde = niet-gerealiseerd, live). Komt uit Blofin's `/api/v1/account/positions` response.
- **Liquidation-price** als amber subtiel label onder de exit-prijs voor open trades: `LIQ $X`. Snel zichtbaar hoe dicht je bij je liq zit zonder naar Blofin te hoeven.

### Gewijzigd
- Button-gate voor "Open posities ophalen" was hardcoded op MEXC, nu dynamisch via `ExchangeAPI[ex]?.fetchOpenPositions` — automatisch voor Blofin en Kraken zichtbaar.

## [v12.6] — 2026-04-22

### Toegevoegd
- **👻 Gemiste trades** (opt-in power feature) — log setups die je spotte maar niet nam. Master toggle in Instellingen → Accounts, default UIT. Features wanneer aan:
  - **TradeForm**: "👻 Gemist?" knop naast Status-pill. Toggle aan → Exit/PnL/Fees/Size verdwijnen, Entry/SL/TP blijven als *planned*, nieuwe "Waarom niet genomen?" multi-select tag-sectie, optionele Hindsight-exit sectie.
  - **TagManager**: nieuwe categorie "👻 Missed-redenen" met 7 default tags (🧠 Durf, 📏 Buiten regels, ⏰ Te laat gespot, 💰 Kapitaal vol, 👀 Onduidelijk, ⏸ Bewuste skip, 🚪 Offline). Volledig bewerkbaar zoals andere tag-categorieën.
  - **Trades-lijst**: missed-rijen tonen met 👻 MISS pill, opacity 0.72. Filter-pill "Genomen / Gemist / Beide" in FilterBar (default Genomen — geen impact op bestaande views).
  - **Command Palette (⌘K)**: `m` entry voor quick-log van gemiste trade.
  - **Analytics → Proces-mode → "👻 Edge Gap" sectie**: captured-ratio per setup (min 3 trades), reasons breakdown met bars, theoretical edge-leak met hindsight-bias waarschuwing.
- Alle UI-elementen volledig verborgen wanneer master toggle UIT. Bestaande data blijft bij toggle-off (verborgen, niet gewist). Telt nooit mee in echte P&L/win-rate.

## [v12.5] — 2026-04-22

### Toegevoegd
- **📋 Changelog** — deze file. Link vanuit Instellingen → Accounts (onder de versie-regel). Opent op GitHub in een nieuwe tab.

---

## [v12.4] — 2026-04-22

### Toegevoegd
- **Morani branding in de browser** — favicon en apple-touch-icon (M+candle icoon) base64-embedded, zichtbaar in browser tab, bookmarks en iOS home-screen.
- **Social link previews** — Open Graph + Twitter Card tags. Als je een link naar SyncJournal deelt in Discord / WhatsApp / X zie je nu een preview met het Morani-logo.
- **theme-color** — browser-chrome kleurt nu gold.

### Gewijzigd
- `<title>`: "SyncJournal v12" → "SyncJournal · Morani".

---

## [v12.3] — 2026-04-22

### Gewijzigd
- **Update-flow verhuisd naar Instellingen** — geen groene banner meer bovenaan elke pagina. In plaats daarvan een "🔄 Check voor updates" knop onderaan Instellingen → Accounts. Manueel, rustig, geen spam.
- 4 mogelijke uitkomsten van de check: up-to-date (groen ✓), nieuwere versie (gold kaart met download-link), error (rood met reden), idle.

### Verwijderd
- Auto-check bij elke app-open.

---

## [v12.2] — 2026-04-22

### Toegevoegd
- **Slimme Update-knop** — detecteer of je de app lokaal draait (file:// of localhost) of via een gehoste URL. Gehost: 1-klik `↻ Update nu`. Lokaal: `⬇ Download` + instructie.

*(Interim-release, flow is herzien in v12.3.)*

---

## [v12.1] — 2026-04-22

### Toegevoegd
- **Versienummer zichtbaar** — in Instellingen → Accounts footer en op Help-pagina.
- **Auto-update check** — bij elke app-open wordt `main/version.json` op GitHub gecheckt. Als nieuwer beschikbaar, groene banner bovenaan met download-link.

### Gewijzigd
- Semver-formaat `v12.1`, `v12.2` i.p.v. datum-based `v12 · 2026-04-22`.
- Versie niet meer in de logo-regel bovenin (was te druk).
- Release date zichtbaar als hover-tooltip.

---

## [v12.0] — 2026-04-22

Grote release met alle features uit de sprints van 13-22 april. Highlights:

### 🎯 Personalized Dashboard
- **Naam-input** in Instellingen → Accounts. Dashboard begroet je met "Goedemiddag, {naam}".
- **Stat-based insight-regel** onder de greeting: 9-branch priority-chain met 31 micro-copy varianten (win-streak, best-week, consistency, discipline, goal-on-track, loss-streak, idle, fresh-user, neutral).
- **9 milestone celebration-toasts** bij mijlpalen: 10/50/100/250/500/1000 trades, 5/10-dagen winning streak, eerste winst.
- **✓ Opgeslagen** visuele bevestiging bij auto-save van naam.

### 💭 Mindset Reminders
- **13 quotes** — 8× Morani-voice + 5× classics (Seykota, Livermore, Paul Tudor Jones, Mark Douglas, Steenbarger), supportieve toon.
- **3 contexten live**:
  - ☀️ Quote-banner bovenaan — rotateert per tab-navigatie
  - 🧘 Pre-trade italic in Nieuwe trade form
  - 💪 Post-loss toast (2h cooldown)
- **Settings**: master aan/uit + per-categorie toggles in Instellingen.
- **Seen-tracking** voorkomt 7-daagse herhaling.

### 📊 Discipline Heatmap (Analytics → Proces-mode)
- **7×24 of 7×5 sessies** grid — Amsterdam-tijd (DST-aware via `Intl.DateTimeFormat`).
- **6 discipline-checks** met user-toggleable vinkjes (min 1 aan): stop-loss gezet, pre-notitie, setup-tag, binnen risk-regel, post-notitie, rating.
- **Auto-insights**: worst/best dag-patroon, tag-discipline flag.
- **Min-sample 3 trades/cel** (dashed grijs anders). Best/worst slot cards.

### 🎨 Light theme polish
- Logo "TRADING JOURNAL" + subtitle nu donker leesbaar op parchment/daylight/light (in plaats van bijna-onzichtbare gold).
- Dashboard greeting shimmer op "{naam}" — solide gold i.p.v. white-gold-white gradient die op light bg verdween.

### 🐛 Community bugs (Discord feedback 2026-04-18)
- **Proxy-sectie verborgen** voor community (was verwarrend, sinds `f9d1437`). Ontgrendelbaar met `?dev=1` in URL.
- **Integer validation** op Trading Rules + Goals target (geen rare decimalen, geen spinner-pijltjes meer).
- **Top-nav opacity** — content scrolt niet meer door de tabs heen (alle 6 thema's).
- **Trade-modal sluit bij backdrop-click** gefixt. Save-knop sticky onderin. Auto-draft in `tj_trade_draft` met 48h recovery banner. Confirm-dialog "Opslaan / Sluiten zonder opslaan / Annuleren" bij wijzigingen.

### 🔧 Technisch
- **IndexedDB** als primaire trade-storage (localStorage als fallback).
- **`schemaVersion`** voor toekomstige migraties.
- **Backup export/import** — volledige JSON met trades + tags + accounts + config + goals + rules.
- **6 thema's**: sync (default) / classic / aurora / light / parchment / daylight.

---

## Conventie

**Toevoegd** = nieuwe feature · **Gewijzigd** = gedrag of UI aangepast · **Verwijderd** = weggehaald · **Fixed** = bug-fix

Elke release heeft een versie-nummer + datum + korte toelichting. Grote commits krijgen een kopje met emoji. Niet elke commit komt hier — alleen wat de user merkt.
