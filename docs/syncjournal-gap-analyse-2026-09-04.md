# Feature gap-analyse — SyncJournal (demo) vs TradeJournal (work)

**Datum:** 2026-09-04
**Vergeleken:** `work/tradejournal.html` (A — mature productie-app, 21.314 regels) vs `demos/syncjournal-app-demo.html` (B — nieuwe variant, ~1.580 regels app-code + inline-vendor).

## Kernconclusie

B is **géén wireframe** — het is een verrassend volwassen herbouw met moderne architectuur (vanilla-JS shell + React/Recharts alleen voor charts, geen Babel-runtime). Maar op drie cruciale plekken is het een **UI-schil zonder motor**:

1. **Exchange-koppelingen zijn nep** — geen enkele API-call; "Verbinden" schrijft alleen `connected:true` lokaal, `syncNow()` toont letterlijk "0 nieuwe trades (demo)".
2. **AI-coach is een regex-speeltje** — keyword-gebaseerde canned responses, geen echte Claude-API zoals Mori in A.
3. **Discipline-systeem ontbreekt** — geen Trading Rules, geen discipline-heatmap/-score, geen goals/milestones/mindset.

Daarnaast mist B een reeks ondersteunende systemen (IndexedDB, auto-backup, share-cards, 6 thema's, multi-account-datamodel, funding-fees).

> **Belangrijk:** B is een **andere architectuur** dan A, geen kleinere kopie. Merge = herbouw, niet copy-paste.

---

## Gaps per categorie (S/M/L = bouwomvang)

### 1. Pagina's/navigatie
- **Help-tab** (A: tientallen Q&A's) → B heeft een dunne FAQ. **S**
- **AI-coach als volwaardige tab** (A: 5 subsecties) → B: kleine chat-widget. **L** (zie §10)
- Accounts/Tags zijn in A top-nav, in B sub-tabs onder Instellingen — UX-keuze. **S**

### 2. Trade-formulier
- **Risk-based sizing-calculator** (A: contracts/USD/coin, reverse uit risk% + stopafstand). B rekent alleen P&L/R uit vaste velden + **hardcoded saldo** (`ACCT=24663`). **M**
- **TP-breakdown uit echte fills** + opslagbare TP-templates (A). B heeft handmatige TP-builder, geen fill-koppeling. **L**
- **Playbook→formulier auto-fill + compliance-score** (A). Afwezig in B. **M**
- B heeft wél al: layers, emoties/fouten, missed-reden, screenshots+plak+compressie, live calc-preview. Goede basis.

### 3. Analytics
- **Setup×Sessie matrix**, **playbook-layer-aware analytics + auto-insights**, **MFE/MAE-widget**, **discipline-heatmap/-score** → afwezig in B. **M–L**
- B heeft wél: R-histogram, grade-stack, donuts, radar, uur-heatmap, jaar-heatmap, trade-score, reeks/vorm. Behoorlijk compleet.

### 4. Exchange-integraties — **grootste gap**
- A: `ExchangeAPI` (~800 regels) met echte adapters voor **MEXC, Blofin, Kraken Futures, Hyperliquid, OKX, FTMO/MT5** — fetchTrades, testConnection, fills, partial-close-detectie, contract-sizes.
- B: exchanges puur decoratief; connect-flow + sync zijn mock. **Funding-fees**: A verwerkt `fundingFee` in netPnl; B kent het concept niet.
- **L** (5 adapters + proxy + fill-parsing + partial-close).

### 5. Data/opslag
- **IndexedDB** (A, tegen 5MB-limiet) → B is localStorage-only; met screenshots (base64) loopt dat vol. **M**
- **Multi-account datamodel** (A: `accounts[]` + migratie) → B: hardcoded seed-accounts + handmatige. **M**
- **Schema**: A op v12 met jaren migraties; B op v1. Geen migratiepad A→B. **L**

### 6. Delen/export
- **PNG share-cards** (html2canvas) → afwezig in B. **M**
- **Playbook delen/importeren** (JSON tussen users) → afwezig in B. **M**
- **CSV-export** (selectief) → B heeft alleen full-JSON (wél werkend). **S**

### 7. Instellingen
- Ontbreekt in B: **Trading Rules**, **Goals**, **Validatie**-tab.
- **Dashboard-config**: A heeft per-widget toggles + drag-herordenen (SortableJS, 15+ dashboard / 7 review / 15 analytics); B heeft 6 vaste sectie-toggles. **M**
- B-only (netjes): Weergave, Updates, Wissen, valuta-toggle.

### 8. Psychologie/discipline — **tweede grote gap**
- **Trading Rules** (definiëren + auto-evalueren) → afwezig; B heeft 5 hardcoded checklist-booleans. **L**
- **Discipline-heatmap + score** → afwezig. **L**
- **Mindset** (quotes/prefs/seen), **Milestones** (gamification), **Goals** (rings/metrics) → alle afwezig. **M** elk.
- B heeft wél een nette review-flow (rating, emotie, notities, done-filter) — goede basis om Trading Rules op te bouwen.

### 9. Onboarding/UX
- **Thema's**: A heeft 6 (sync/classic/aurora/light/parchment/daylight), B heeft 2 (light/dark). **L**
- **Keyboard shortcuts**: A ~22, B ~4. **S–M**
- **Dev-mode** (`?dev=1`, snapshot-fixture-workflow) → afwezig in B. **S** (wel nodig zodra B live-integraties krijgt)
- Privacy-masking + welcome-flow: beide aanwezig, vergelijkbaar.

### 10. AI-coach & backup
- **Mori (echte Claude-API, BYOK)** — pre-trade-validatie, weekly digest, multi-turn chat met cross-feature-context, budget-cap, 3-laags privacy-filter, floating popup. B: regex canned responses. **L**
- **Auto-backup** (File System Access API + reminders + rotatie) → B alleen handmatige export. **M**

---

## Top-10 gaps (grootste impact)

| # | Gap | Omvang |
|---|-----|--------|
| 1 | Echte exchange-integraties (6 exchanges) | **L** |
| 2 | Mori AI-coach (echte Claude-API) | **L** |
| 3 | Trading Rules + discipline-heatmap/-score | **L** |
| 4 | Auto-backup + reminders | **M** |
| 5 | IndexedDB voor trades/screenshots | **M** |
| 6 | PNG share-cards + playbook delen | **M** |
| 7 | 6 thema's i.p.v. 2 | **L** |
| 8 | Playbook-layer-analytics + Setup×Sessie matrix | **L** |
| 9 | Goals + Milestones + Mindset | **M** |
| 10 | Multi-account datamodel + funding-fees | **M** |

## Waar B vooruitloopt op A
- Lichtere architectuur (geen Babel-in-browser), snellere init, makkelijker debuggen.
- Recharts/shadcn-charts (moderner) i.p.v. Chart.js.
- Compacte state/opslag (1 `STATE` + `DB`-wrapper vs 63 losse `tj_`-keys).
- Unified accounts-array vanaf de start.
- Leesbaardere codebase (~1.580 vs 20.000+ regels).
- Valuta-toggle (EUR/USD) als eersteklas instelling.

---

## Implicaties voor het work-variant-plan

De eerdere data-veiligheids-fixes (reseed uit, IndexedDB, complete backup, migratie) zijn **noodzakelijk maar niet voldoende** voor een "volwaardige" work-app. De drie grote motoren — **exchange-sync, echte AI, discipline-systeem** — zijn elk een L-klus.

**Aanbevolen herijking van "volledig testen":**
- **Testniveau 1 (haalbaar snel):** data-veilige variant + IndexedDB + migratie-import uit de oude app → je test de **UI/workflow/analytics** met je échte historie. Exchange-sync/AI/discipline nog niet.
- **Testniveau 2 (volwaardig):** + Trading Rules/discipline + auto-backup + share-cards + resterende thema's.
- **Testniveau 3 (vervanger):** + echte exchange-integraties + Mori AI. Dit maakt B pas een echte vervanger van A.

Zonder minstens één werkende dataroute (migratie of CSV) test je alleen op demo-data. Migratie-import uit de oude app (gekozen route) geeft testniveau 1 het snelst.
