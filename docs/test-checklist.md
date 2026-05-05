# SyncJournal — Test & Bug Checklist

Voor Denny + Sebas + community. Gebruik deze checklist:

- **Voor een bug-rapport** — vul het template onderaan in en stuur het in Discord
- **Na een release** — loop de smoke-check door om te zien of basics nog werken
- **Bij twijfel of cijfers kloppen** — gebruik de exchange-specifieke scenarios

Wat de app doet wordt al automatisch getest in `tests/` — scenarios met ✓ in de "Auto"-kolom hoeven door jou niet handmatig getest te worden bij elke release.

---

## 🚨 Bug-rapport template

Plak dit blok in Discord wanneer je een bug ziet — alle 6 velden invullen helpt enorm bij reproductie:

```
**Versie**: vX.YZ (zie "Instellingen → Accounts → Versie")
**Exchange**: Blofin / MEXC / Kraken / Hyperliquid / FTMO / CSV-import
**Browser + OS**: Chrome op Windows / Safari op Mac / etc
**Wat verwachtte je**: [bv. "Dashboard PnL toont -€8,37"]
**Wat zie je**: [bv. "Dashboard toont -€11,43, Trades-pagina toont -€8,37"]
**Stappen om te reproduceren**:
  1. ...
  2. ...
  3. ...
**Screenshot of snapshot** (optioneel maar zeer welkom):
  - Snapshot via "📥 Snapshot"-knop in dev-mode (`?dev=1` in URL).
  - Privé houden — niet posten in publieke chat.
```

---

## ⚡ 5-minuten smoke check (na elke release)

| # | Check | Auto |
|---|---|---|
| 1 | App opent op localhost zonder JS-errors in console (F12) | ✓ |
| 2 | Versie-nummer in Instellingen klopt met release | ✓ |
| 3 | Klik door alle 6 themes — geen "wrong-theme" kleuren | ✓ |
| 4 | Dashboard / Trades / Analytics / Review tabs openen zonder crash | ✓ |
| 5 | Dashboard "Net P&L" = optelsom van zichtbare trades op Trades-pagina | — |
| 6 | Win-rate Dashboard = win-rate Trades-pagina (zelfde definitie) | — |
| 7 | Valuta consistent op alle pagina's ($, € of beide) | — |
| 8 | Trade-detail-modal toont prijzen met juiste precisie (geen 2255.5805555555557) | ✓ |

Als 1-4 faalt: app is stuk, log een critical-bug. 5-8: log gewoon een bug-rapport.

---

## 🔌 Connect-flow per exchange

### Blofin
- [ ] Instellingen → Accounts → Blofin → Verbinden vraagt API-key + secret + passphrase
- [ ] "Test verbinding" → balans verschijnt rechtsboven
- [ ] "🔄 Refresh trades" → trades verschijnen op Trades-pagina (let op count)
- [ ] Open posities verschijnen in Dashboard "Open posities" sectie

### MEXC
- [ ] API-key + secret invullen → test verbinding succeeds (vereist proxy actief op localhost)
- [ ] Refresh trades → MEXC-trades komen binnen
- [ ] Open positie wordt zichtbaar als je een open trade hebt

### Kraken Futures
- [ ] API-key + secret → test (vereist proxy)
- [ ] Refresh trades → Kraken-trades komen binnen
- [ ] Open positie zichtbaar

### Hyperliquid
- [ ] Wallet-adres invullen (0x… 40 hex chars) — geen API-key nodig
- [ ] Test verbinding → balans van wallet verschijnt
- [ ] Refresh trades → Hyperliquid-trades komen binnen

### FTMO (MT5)
- [ ] CSV-only — geen API. Upload MT5 MetriX CSV via Trades-pagina → "CSV import"
- [ ] Trades verschijnen, EUR/USD pair-naming klopt

---

## 📊 Cross-exchange consistency-checks

Deze zou op alle exchanges moeten kloppen — als één afwijkt, log een bug:

- [ ] Trade-fees worden positief weergegeven (geen `-0.5` ergens)
- [ ] Sluiting-tijd in trade is in jouw lokale tijdzone
- [ ] Net P&L per trade = `pnl − fees − funding` (na funding-feature)
- [ ] Σ trades per pair = position size aan top
- [ ] Equity-curve gaat over hele periode, geen gaten

---

## 🎯 Scenario's per exchange (geverifieerd in v12.88)

Elk scenario heeft een verwacht resultaat. Loop deze door bij twijfel of doe een snapshot vóór je de feature gebruikt en daarna en vergelijk.

### Blofin
| # | Scenario | Verwacht resultaat | Auto |
|---|---|---|---|
| B1 | Open BTC long → TP1 hit (50%) → SL hit (rest) | 1 zichtbare trade `partial→closed` met TP1+SL als levels, fees gesommeerd | ✓ A,K |
| B2 | Open BTC short → TP1 + TP2 (beide winst) | 1 trade met 2 TP-levels, geen SL, netto winst | ✓ B |
| B3 | Open + directe full close | 1 trade `closed`, geen partial-flag | ✓ E |
| B4 | Net-account: 4 onafhankelijke BTC long trades op zelfde positionId | 4 zichtbare trades, NIET gemerged tot 1 | ✓ D |
| B5 | Manual edits (notes, setupTags, screenshot, rating) op open trade → TP1 → SL | Edits blijven behouden op uiteindelijke trade | ✓ L |
| B6 | Open trade zonder closes | 1 zichtbare trade `open`, geen tpLevels | ✓ F,M |
| B7 | Σ trades.pnl op Dashboard = som van handmatig optellen op Trades-pagina | Bedragen exact gelijk | — |
| B8 | CSV-import vs API-sync van zelfde periode | Trades komen identiek binnen (na partial-aggregatie) | ✓ 3way |

### MEXC
| # | Scenario | Verwacht resultaat | Auto |
|---|---|---|---|
| M1 | Open positie → close in 1 keer | 1 trade `closed`, pnl = realised, fees absoluut (geen minteken) | ✓ |
| M2 | Trade met TP-laddered exits | 1 trade met meerdere close-prijzen, fees gesommeerd | ✓ |
| M3 | Verzin een mini-trade (€10 size) → check of getal klopt | Berekening klopt op 0.01 nauwkeurig | — |
| M4 | xlsx-export van MEXC web → import in app | Trade-counts ≈ API-count, fees identiek per pair | ✓ 3way |
| M5 | Σ trades.pnl op Dashboard ≈ Σ realised in MEXC web | Binnen $20 over een maand (drift = boundary) | ✓ |

### Kraken Futures
| # | Scenario | Verwacht resultaat | Auto |
|---|---|---|---|
| K1 | Refresh trades → trades vanaf laatste sync verschijnen | Geen duplicates, nieuwe trades na bovenkant | ✓ |
| K2 | Account-log CSV import (web export) | Alleen "futures trade" rijen worden trades, funding-rijen genegeerd | ✓ 3way |
| K3 | Σ trades.pnl in app ≈ realized PnL op Kraken web (zelfde periode) | Drift < $5 per maand (boundary fills) | ✓ |
| K4 | XBT pair → wordt getoond als BTC/USD | Naam-conversie klopt | ✓ |

### Hyperliquid
| # | Scenario | Verwacht resultaat | Auto |
|---|---|---|---|
| H1 | Wallet zonder credentials → balans en trades komen binnen | Werkt zonder proxy | ✓ |
| H2 | Scaling-in: 3× open op verschillende prijzen → 1 close | 1 trade met gewogen entry-prijs | — |
| H3 | CSV-export uit Portfolio → import vs API-sync | Identieke trades (na sub-fill aggregatie) | ✓ 3way |
| H4 | Spot-token (bv "GOLD") | Wordt herkend, prijs klopt | — |
| H5 | Funding-fee impact (later, na funding-feature) | Per trade getoond als aparte regel | BACKLOG |

### FTMO (MT5)
| # | Scenario | Verwacht resultaat | Auto |
|---|---|---|---|
| F1 | MT5 MetriX CSV upload | Alle "Trade" rijen worden trades, deals/balance genegeerd | — |
| F2 | EURUSD trade → pair = EUR/USD | Forex pair-naming klopt | — |
| F3 | Profit + Swap + Commissions → netto pnl | Σ correct gesommeerd | — |
| F4 | Open trade zonder close → in Open Posities sectie | Niet als closed trade getoond | — |

---

## 🔍 Field-behoud bij sync (regressie-check)

Als je manual edits doet op een trade en daarna refresht, moeten deze velden behouden blijven:

- [ ] **Notes** — notitie tekst blijft
- [ ] **Setup tags** — chips blijven
- [ ] **Confirmation tags** — chips blijven
- [ ] **Emotion tags** — chips blijven
- [ ] **Mistake tags** — chips blijven
- [ ] **Rating** (1-5 sterren) — blijft
- [ ] **Screenshot** — blijft (kan groot zijn, dus backup-export aanraden)
- [ ] **Custom tags** — blijven
- [ ] **Stop loss + Take profit prijzen** — blijven
- [ ] **TP-levels (bij partial trades)** — blijven

Auto-getest: scenario L in [tests/scenarios-klmn.spec.js](../tests/scenarios-klmn.spec.js).

---

## 🧪 CSV-import checks

| Exchange | Format | Regels | Verwacht resultaat |
|---|---|---|---|
| Blofin | Order History CSV | `Underlying Asset,Margin Mode,...` 15 kolommen | FIFO match → trades reconstrueert |
| MEXC | Futures Order History XLSX | 18 kolommen, FINISHED status filter | Closes met PNL≠0 worden trades |
| Kraken | Account Log CSV | 22 kolommen, "futures trade" rows | Lifecycle per contract → trades |
| Hyperliquid | Trade History CSV | 8 kolommen `time,coin,dir,...` | FIFO zoals API |
| FTMO MT5 | MetriX CSV | 15+ kolommen, Type=buy/sell | Forex/CFD trades |

Test bij elke CSV-import:
- [ ] Trade-count is plausibel (ongeveer wat je verwacht)
- [ ] Σ pnl in app ≈ Σ pnl op exchange-website
- [ ] Σ fees absoluut (geen mintekens)
- [ ] Geen duplicates met bestaande trades (dedup op trade-id of timestamp)

---

## 🏷 Wat doet "auto" in de tabel?

Gebruikte test-bestanden voor de Auto-kolom:
- **A-J**: [tests/blofin-pipeline-scenarios.spec.js](../tests/blofin-pipeline-scenarios.spec.js) — 12 synthetic Blofin scenarios
- **K-N**: [tests/scenarios-klmn.spec.js](../tests/scenarios-klmn.spec.js) — 4 field-behoud scenarios
- **3way**: [tests/{exchange}-3way.spec.js](../tests/) — CSV ↔ snapshot ↔ parser cross-validation per exchange
- **real-data**: [tests/{exchange}-real-data.spec.js](../tests/) — 4 specs tegen echte snapshot-fixtures

Total: ~74 automatische tests in `tests/`, die in 8 minuten elke release valideren.

Wat NIET automatisch gedekt:
- Subjective UX ("voelt premium genoeg")
- Klik-flows die niet in een spec staan (bv. drag & drop, share-modal genereren)
- OAuth / live exchange API met echte credentials
- Veel mobiele browser quirks

Voor die dingen blijft jouw + community ogen-check belangrijk.

---

## 💡 Tips voor reproductie

- **Snapshot-knop** (`?dev=1` in URL) maakt JSON van de raw exchange API-respons. Sla op, deel met Denny privé. Geen credentials in snapshot.
- **Console open houden** (F12 → Console tab) — JS-errors verschijnen daar als rode regels.
- **Backup vóór experimenten** — Instellingen → Data → "JSON export". Zo kun je terug.
- **Localhost serveren** — niet `file://` openen (sommige features falen door browser-security restricties).
