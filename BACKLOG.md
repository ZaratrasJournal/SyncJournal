# SyncJournal — Backlog

Werklijst voor Denny & Sebas. Staat per status gegroepeerd. Sluit een item af door hem naar **Done** te verplaatsen met korte notitie + PR-link.

Basis kwam uit de feature-diff v4_14 → v9 onderaan. Inmiddels werken we op **v12** (Sebas' nieuwe baseline) — diff is als referentie nog handig maar niet meer leidend.

---

## 🔜 Next up (deze of volgende werksessie)

- [ ] **Setup ranking widget** (uit batch 2 van feature-uitbreidingen)
- [ ] **Risk-per-trade tracking**
- [ ] **Dag-limiet / tilt guard**
- [ ] **Deelbare trade-kaart met Morani logo**
- [ ] **Trade-voucher / shareable link**

## 📋 Quick wins (klein, geïsoleerd, laag risico)

- [ ] **Hyperliquid toevoegen** — kan volledig client-side (public info-endpoint, geen proxy). Zie `Agent` onderzoek van 2026-04-14.
- [ ] **Datumformaat naar dd-mm-yyyy** — storage blijft ISO (voor sortering/filter), alle DISPLAY-plekken door `fmtNL()` helper. Locaties: trade-lijst, review highlights, dashboard labels, analytics x-as labels, calendar headers.
- [ ] **Snel-filter presets** — knoppen "Vandaag / Deze week / Deze maand / Alle tijd" in FilterBar. Zet `filters.dateFrom` + `filters.dateTo` naar passende range.
- [ ] **Voor-trade notitie** — 2 velden in TradeForm i.p.v. 1: "Waarom ga ik erin?" (vóór) + "Hoe ging het?" (post-mortem). Apart `trade.entryNote` naast bestaande `trade.notes`. Schema-migratie: lege `entryNote` voor oude trades.

## 🛠 Medium (raakt shared state / UI)

- [ ] **Analytics/Review secties regrouping** — voorstel: Edge / Wat werkt / Timing / Risico & discipline groepen. Drag-drop POC in `tradejournal-dragdrop-test.html`.
- [ ] **Setup ranking widget** — Dashboard/Analytics sectie "Top 3 setups" (gemiddelde R ≥ 1.5) + "Worst 3 setups". Elke rij klikbaar → zet `filters.setupTags=[setup]` en spring naar Trades-tab. Bijbehorend: "toon alleen losers van setup X" shortcut.
- [ ] **Risk-per-trade tracking** — nieuwe velden op trade: `riskUsd` (verlies als SL geraakt) en `riskPct` (% van account-saldo). Auto-berekend als `entry + stopLoss + positionSize + account` aanwezig. Analytics-sectie "Risk consistency" — grafiek van risk-% per trade over tijd (signaleert escalerend risico).
- [ ] **Dag-limiet / tilt guard** — instelling in Instellingen: `maxLossesPerDay` (default 3). Als user vandaag ≥ N losses én opent nieuwe TradeForm: modal "Je hebt vandaag al X losses — pauze overwegen?" met "Toch doorgaan" + "Neem pauze" knoppen. `tiltGuard` boolean in config.
- [ ] **Deelbare trade-kaart** — export-knop op trade-detail: html2canvas snapshot van de trade (anoniem, zonder API-keys of account-grootte), met **Morani-logo** als watermerk, downloadbaar als PNG voor Discord. Toggle "Toon PnL %" vs "Toon PnL $" vs "Verborgen".
- [ ] **Trade-voucher / shareable link** — "Kopieer trade-link" knop: serialiseer 1 trade in base64 in URL-fragment (bijv. `#/trade/share/eyJ...`). Ontvanger opent die link → read-only modal met trade-details (géén import naar hun journal). Geen server nodig, werkt client-side.


## ⚠️ Risky (refactor of schema-migratie)

- [ ] **PDFReportModal herintroduceren** — groot component, jsPDF + html2canvas CDNs staan al geladen. Trade-shape hercontroleren vóór port.

## 🔬 Onderzoek / te besluiten

- [ ] **Welke exchanges prioriteit?** — lijst afstemmen met community. Bybit, Binance, MEXC, Blofin, Kraken, Hyperliquid?
- [ ] **Later: backend ja/nee?** — pas relevant als community direct-API-sync wil. Voorlopig blijft keuze: lokaal + CSV.
- [ ] **Distributiemodel** — hoe krijgen traders nieuwe versies? GitHub Releases + download, of gaan we toch hosten?
- [ ] **Meerdere screenshots per trade?** — v4_14 en v12 hebben 1 per trade. Overwegen of TF-breakdown (4H/15m/entry) nuttig is. Zou datamodel + migratie vergen.

## ✅ Done

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
