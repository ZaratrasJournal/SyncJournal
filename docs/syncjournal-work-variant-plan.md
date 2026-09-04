# SyncJournal → volledige work-variant — analyse & plan

**Datum:** 2026-09-04
**Doel:** `demos/syncjournal-app-demo.html` promoveren tot een volwaardige work-variant die Denny **dagelijks met echte data** kan gebruiken voor een volledige test — **naast** de bestaande `work/tradejournal.html` (die blijft bestaan en ongemoeid).

---

## 1. Huidige staat van de demo

Wat de demo al volledig kan (159 Playwright-tests groen, licht + donker):

- **Single-file, self-contained**: React + Recharts inline gevendord → werkt als één bestand (Slack/offline). Build-stap: `scripts/inline-vendor.js`.
- **Schermen**: Dashboard · Trades (13 kolommen, sorteren, filters, bulk) · Analytics (KPI's, equity, R-verdeling, grade-analyse, donuts, trade-score, reeks/vorm, uur-heatmap) · Tendencies (radar per dimensie incl. grade) · Kalender (**jaarheatmap** + maandweergave) · **Playbook** (grid + detailpagina + volledige editor: lagen/criteria/anti-criteria/status/grade/risk/markt-context/voorbeeld-charts/links) · Review (lijst + detail + screenshots + gereviewd-markering) · Instellingen (Accounts/Weergave/Dashboard/Tags/Data/**Updates**/Wissen) · FAQ · AI-coach (demo).
- **Trade-formulier**: 6 secties, auto-calc, TP-niveaus, setup-lagen (TF-chips + bias-pills + setups/confirmaties), emoties/fouten (pill-chips), **setup-grade A/B/C (optioneel)**, screenshot-upload/plak.
- **Opslag**: localStorage prefix `sjdemo_`, `SCHEMA_VERSION=1`, migratie-hook aanwezig.
- **Thema's**: light + dark.

## 2. Gap-analyse: wat ontbreekt voor een work-variant

| Onderwerp | Nu (demo) | Nodig voor work |
|---|---|---|
| **Data-veiligheid** | Reseed overschrijft `trades` bij SEEDVER-bump | **Nooit** auto-overschrijven; seed alleen bij lege eerste-start |
| **Backup/restore** | Export mist `pbook` (playbooks) + `sections`/state | Volledige backup van álle keys |
| **Opslagcapaciteit** | Screenshots = base64 in localStorage (~5MB limiet) | IndexedDB voor afbeeldingen |
| **Echte exchange-data** | Koppelingen zijn mock | CSV-import (alle exchanges) of live API |
| **Historie meenemen** | Alleen JSON-import van eigen formaat | Optioneel: migratie-import uit de oude app (`tj_`) |
| **Thema's** | 2 | 6 (optioneel voor pariteit) |
| **Versie/updates** | `v0.9.0-demo`, mock update-banner | Echte versie + `version.json` |

## 3. Kritieke risico's (blokkeren echt gebruik)

1. **Dataverlies bij reseed** — regel 1211-1212: `else { T=SEED; save }`. Zodra we een feature toevoegen die SEEDVER bumpt, is de gebruiker z'n trades kwijt. **Must fix vóór echt gebruik.**
2. **localStorage 5MB** — een handvol echte trade-screenshots vult localStorage; daarna faalt opslaan stil. **Must fix vóór screenshot-gebruik.**
3. **Incomplete backup** — playbooks vallen buiten export → verlies bij browserwissel/cache-clear.

---

## 4. Gefaseerd plan

Legenda: **[MUST]** = nodig voor een veilige volledige test · **[SHOULD]** = sterk aanbevolen · **[LATER]** = groot/optioneel.

### Fase 1 — Promotie tot work-variant + data-veiligheid **[MUST]**
- Nieuw bestand: **`work/syncjournal.html`** (naast `work/tradejournal.html`).
- Nieuwe localStorage-prefix **`sj_`** (geen collision met demo `sjdemo_` of oude app `tj_`).
- **Reseed uitzetten**: seed uitsluitend bij een écht lege eerste-start; bij bestaande data nooit overschrijven. "Voorbeelddata laden" en "Alles wissen" blijven bewuste user-acties.
- `APP_VERSION` → echte semver (bv. `v0.9.0`), eigen `version.json`.
- **Volledige backup/restore**: export/import dekt trades, tagConfig, **pbook**, conns, manual, sync, sections, discipline/state. Round-trip-test.
- Migratie-hook activeren voor toekomstige schema-wijzigingen.

### Fase 2 — Opslagcapaciteit (IndexedDB) **[MUST]**
- Trade-screenshots + playbook-voorbeeld-charts naar **IndexedDB**; trades/config blijven in localStorage.
- Waarschuwing bij naderende opslaglimiet.

### Fase 3 — Echte data erin krijgen **[MUST — minstens één route]**
- **3a. JSON-backup** van de nieuwe variant (al aanwezig, na Fase 1 compleet).
- **3b. Migratie-import uit de oude app**: `tradejournal.html`-export → veld-mapping naar het SyncJournal-schema. Nodig als je je bestaande historie wil meenemen.

### Fase 4 — Exchange-data via CSV **[SHOULD]**
- CSV-import per exchange (Blofin/MEXC/OKX/Hyperliquid/Kraken/FTMO) → echte trades zonder backend/keys.
- Werk voor de `exchange-integrator`-agent; snapshot-fixture-tests per exchange.

### Fase 5 — Live API-sync **[LATER — groot]**
- Read-only keys via de online Cloudflare Worker + client-side adapters. Worker wordt extern beheerd. **Niet nodig** voor de eerste volledige test — CSV/manueel volstaat.

### Fase 6 — Thema's & polish **[LATER]**
- 4 extra thema's (classic/aurora/parchment/daylight) voor pariteit met de oude app.

### Fase 7 — Test-hardening **[SHOULD, doorlopend]**
- Playwright-suite uitbreiden richting echte-data-flows (import → gebruik → export round-trip).
- `/design-review` over schermen × thema's; a11y-check.
- Distributie via `inline-vendor.js` (één self-contained bestand).

---

## 5. Kortste pad naar "volledig testen"

**Fase 1 + Fase 2 + (Fase 3b óf Fase 4)** = veilig, met je echte data, zonder dataverlies-risico. Live API (Fase 5) is een aparte, latere klus.

## 6. Vastgelegde beslissingen (2026-09-04)
1. **Data-route:** migratie uit de oude app (`tradejournal.html`-export → nieuw schema). → **Fase 3b is de primaire data-route.** CSV-import (Fase 4) blijft SHOULD/later.
2. **Live API-sync:** later (Fase 5). Niet in deze testronde.
3. **Opzet:** akkoord — nieuw bestand **`work/syncjournal.html`**, prefix **`sj_`**, oude app blijft ongemoeid.

## 7. Vastgelegd testpad (uitvoervolgorde)
1. ✅ **Fase 1** — `work/syncjournal.html` afgesplitst · prefix `sj_` · reseed uit · complete backup · echte versie.
2. ✅ **Fase 2** — trades + playbooks (mét screenshots) naar **IndexedDB** (`sj_db`, store `kv`); config/tags/settings blijven in localStorage. `boot()` laadt async + migreert eenmalig vanuit het Fase-1 localStorage-model. Tests: **6/6** (`fase2-idb.js`) + work-suite **158/158** + safety **7/7**.
3. ✅ **Fase 3b** — migratie-importer: `importJSON` detecteert oude TradeJournal-export (`{version, trades:[...]}`) en mapt naar het SyncJournal-schema. Veld-mapping: `direction→dir`, `stopLoss→stop`, `takeProfit→tp`, `positionSize→size`, `tradeGrade A+→grade A`, `simType→kind` (missed/backtest/paper→live), `source→exchange`, sessie afgeleid uit tijd, **R afgeleid** uit entry/stop/size, emotie/fout/tags gemapt, layers behouden, `entryNote→lessons`. Merge't referentie-tags in `tagConfig`. Tests: **19/19** (`fase3-migrate.js`).
   - ⚠️ **Best-effort uit broncode** — valideren tegen een échte oude-app-export; velden als `mae/mfe` (oud: prijzen, nieuw: R-multiples) en exacte sessie-grenzen kunnen dan nog bijgesteld worden.
4. → ✅ **TESTNIVEAU 1 KLAAR.** Denny kan nu: oude export importeren → héle historie migreert → volledige UX/analytics testen met echte data. (Fase 4 CSV, Fase 5 live-API, Fase 6 thema's = daarna.)
5. ✅ **Distributie met vooraf ingebakken dataset** — één self-contained HTML-bestand delen mét dataset erin, zodat andere gebruikers direct een gevulde app zien.
   - **Mechanisme:** `<script type="application/json" id="sj-bundled">` blok in `work/syncjournal.html` (standaard `null`). `boot()` laadt dit **alleen** bij een écht lege eerste-start (geen IDB-data én geen `sj_inited`-flag) via `readBundled()`/`seedBundled()`, zet dan `inited=true`. Ondersteunt zowel SyncJournal- als oude TradeJournal-exports (hergebruikt `looksOldExport`/`migrateOldTrade`). **Wist de gebruiker later z'n data, dan komt de bundel NIET terug** (inited blijft) — het is een startpunt, geen dwang.
   - **Build:** `node scripts/bundle-dataset.js <export.json> [uitvoer.html]` injecteert de JSON in het blok en schrijft naar `dist/` (gitignored build-artefact). Vendor is al inline → volledig draagbaar.
   - **Tests:** `bundled-seed.js` **7/7** (seed bij lege start, inited-flag, IDB-persist, old-format-migratie, geen JS-errors, analytics rendert, géén her-seed na wissen) + fase1-safety **7/7** blijft groen (kale variant start nog steeds leeg).

### Fase 1 — ✅ AFGEROND (2026-09-04)
- ✅ `work/syncjournal.html` afgesplitst (kopie van demo); oude `tradejournal.html` ongemoeid.
- ✅ Prefix `sjdemo_` → `sj_`.
- ✅ **Reseed-wipe verwijderd** — app start leeg (`T=DB.load('trades',[])`), nooit auto-overschrijven. `loadDemoData()` + "Voorbeelddata laden"-knop als bewuste actie.
- ✅ `APP_VERSION` → `v0.9.0`; update-check toont eerlijk "up-to-date".
- ✅ `exportJSON`/`importJSON` compleet: trades + tagConfig + **pbook** + conns + manual + sync + sections + settings (thema/valuta/priv/density). Import normaliseert oude playbook-arrays.
- ✅ Tests: work-suite **158/158** (`suite-work.js`, seedt via `loadDemoData`) + **7/7** data-veiligheidstests (`fase1-safety.js`: leeg starten, geen reseed-wipe, complete backup).

**Openstaand voor later in Fase 1 (klein):** eigen `version.json` + hardcoded `ACCT=24663` (top-bar-balans) vervangen door echt/afgeleid saldo.
