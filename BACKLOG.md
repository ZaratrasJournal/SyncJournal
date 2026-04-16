# SyncJournal — Backlog

Werklijst voor Denny & Sebas. Staat per status gegroepeerd. Sluit een item af door hem naar **Done** te verplaatsen met korte notitie + PR-link.

Basis kwam uit de feature-diff v4_14 → v9 onderaan. Inmiddels werken we op **v12** (Sebas' nieuwe baseline) — diff is als referentie nog handig maar niet meer leidend.

---

## 🔜 Next up (deze of volgende werksessie)

- [ ] **🥇 AI trade-review** — knop "Analyseer mijn laatste N trades" die via user's eigen API-key (OpenAI/Claude) patronen samenvat uit trades + tags + voor/na notities. Bijv: "Je verliest 65% van trades met 'FOMO' tag". Past bij single-file model: geen backend, user brengt eigen key. **Grootste differentiator vs concurrenten** — nu de top-prioriteit.
- [ ] **Handmatige balance / capital-tracking per account** _(💡 Denny)_ — per account (exchange + handmatig) houd je je **ingelegd kapitaal** bij, niet een live exchange-balance. 3 knoppen per account: ➕ Storting / ➖ Opname / ✏️ Correctie. Dashboard toont per account: `Capital`, `Equity`, `Return %`. Koppelt aan Risk-per-trade.
- [ ] **Account-labels per exchange** _(💡 Denny)_ — per exchange/account eigen naam (bijv. "Kraken Swing", "Blofin Scalp"). UI: vrije invoer + preset-suggesties. Tonen in trade-lijst, filter-bar, dashboard ("Top strategy" widget).
- [ ] **Setup ranking widget** — Dashboard/Analytics sectie "Top 3 setups" (gem. R ≥ 1.5) + "Worst 3 setups". Klikbaar → filter trades op setup.
- [ ] **Risk-per-trade tracking** — `riskUsd` + `riskPct` op trade, auto-berekend. Analytics "Risk consistency" grafiek (signaleert escalerend risico).
- [ ] **Dag-limiet / tilt guard** — `maxLossesPerDay` setting. Bij N losses op dag → modal "Neem pauze?".
- [ ] **Trade-voucher / shareable link** — serialiseer 1 trade in base64 URL-fragment. Ontvanger → read-only modal. Geen server nodig.

## 📋 Quick wins (klein, geïsoleerd, laag risico)

- [ ] **Hyperliquid toevoegen** — kan volledig client-side (public info-endpoint, geen proxy). Zie `Agent` onderzoek van 2026-04-14.

## ⚠️ Risky (refactor of schema-migratie)

- [ ] **PDFReportModal herintroduceren** — groot component, jsPDF + html2canvas CDNs staan al geladen. Trade-shape hercontroleren vóór port.
- [ ] **Meerdere screenshots per trade** — v4_14 en v12 hebben 1 per trade. TF-breakdown (4H/15m/entry) zou datamodel + migratie vergen.

## 🔬 Onderzoek / te besluiten

- [ ] **Welke exchanges prioriteit?** — lijst afstemmen met community. Bybit, Binance, MEXC, Blofin, Kraken, Hyperliquid?
- [ ] **Later: backend ja/nee?** — pas relevant als community direct-API-sync wil. Voorlopig blijft keuze: lokaal + CSV.
- [ ] **Distributiemodel** — hoe krijgen traders nieuwe versies? GitHub Releases + download, of gaan we toch hosten?

## ✅ Done

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
