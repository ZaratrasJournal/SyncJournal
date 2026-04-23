# Changelog

Alle noemenswaardige wijzigingen aan SyncJournal. Versies volgen [semver](https://semver.org/): `major.minor`.

Na elke community-release verschijnt hier een nieuw blok. Vragen of feedback? Drop in de Morani Discord.

---

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
