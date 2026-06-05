# Handmatige controle — Trades samenvoegen (v12.190+)

Checklist voor handmatige UI-validatie van de merge-feature. Geen testen worden geskipt — deze lijst beantwoordt wat geautomatiseerde tests niet kunnen vangen: visueel layout, theme-consistentie, klikflow, copy-toon, edge-cases.

**Tijd**: ~15-20 min voor volledige doorloop. **Stuck?** Verwijder seed-data via Settings → Backup & Restore → "Wis alles".

---

## 0. Voorbereiding — seed-data inladen

We gebruiken een vaste set van 4 FTMO XAUUSD-trades + 4 crypto-trades (Blofin) zodat we beide paden testen.

**Stap 0.1** — Open `work/tradejournal.html` (lokaal serveren via `python -m http.server` of vergelijkbaar; niet `file://`).

**Stap 0.2** — Open DevTools console (F12 → Console-tab) en plak:

```js
localStorage.setItem("tj_trades", JSON.stringify([
  // === 4 FTMO XAUUSD trades — bedoeld als 1 partial-positie met 4 TPs ===
  {id:"ftmo_csv_100001_2026060409421800", date:"2026-06-04", time:"09:42", pair:"XAUUSD", direction:"long",
    entry:"2018.50", exit:"2022.00", stopLoss:"2014.50", positionSize:"1009.25", positionSizeAsset:"0.5",
    pnl:"87.50", fees:"1.50", status:"closed", source:"ftmo", positionId:"100001", openTime:"2026-06-04 09:42:18",
    tradeGrade:"A+", playbookId:"london-breakout-long", notes:"Clean ICT breakout boven Asia high.",
    setupTags:["London Breakout"], confirmationTags:[], timeframeTags:["1H"], emotionTags:["Gedisciplineerd"], mistakeTags:[], customTags:[], layers:[]},
  {id:"ftmo_csv_100002_2026060409422900", date:"2026-06-04", time:"09:42", pair:"XAUUSD", direction:"long",
    entry:"2018.50", exit:"2025.00", stopLoss:"2014.50", positionSize:"1009.25", positionSizeAsset:"0.5",
    pnl:"162.50", fees:"1.50", status:"closed", source:"ftmo", positionId:"100002", openTime:"2026-06-04 09:42:29",
    tradeGrade:"A", playbookId:"london-breakout-long", notes:"",
    setupTags:["London Breakout"], confirmationTags:[], timeframeTags:["1H"], emotionTags:[], mistakeTags:[], customTags:[], layers:[]},
  {id:"ftmo_csv_100003_2026060409424200", date:"2026-06-04", time:"09:42", pair:"XAUUSD", direction:"long",
    entry:"2018.50", exit:"2028.00", stopLoss:"2014.50", positionSize:"1009.25", positionSizeAsset:"0.5",
    pnl:"237.50", fees:"1.50", status:"closed", source:"ftmo", positionId:"100003", openTime:"2026-06-04 09:42:42",
    tradeGrade:"A+", playbookId:"london-breakout-long", notes:"",
    setupTags:["London Breakout"], confirmationTags:[], timeframeTags:["1H"], emotionTags:[], mistakeTags:[], customTags:[], layers:[]},
  {id:"ftmo_csv_100004_2026060409425100", date:"2026-06-04", time:"09:42", pair:"XAUUSD", direction:"long",
    entry:"2018.50", exit:"2032.00", stopLoss:"2014.50", positionSize:"1009.25", positionSizeAsset:"0.5",
    pnl:"337.50", fees:"1.50", status:"closed", source:"ftmo", positionId:"100004", openTime:"2026-06-04 09:42:51",
    tradeGrade:"B", playbookId:"", notes:"Runner. Trail boven 2026 manual move tot LDN close.",
    setupTags:["London Breakout"], confirmationTags:[], timeframeTags:["1H"], emotionTags:[], mistakeTags:[], customTags:[], layers:[]},
  // === 2 Blofin crypto-trades — voor "knop moet NIET verschijnen"-test ===
  {id:"blofin_btc_1", date:"2026-06-04", time:"10:00", pair:"BTC/USDT", direction:"long",
    entry:"68000", exit:"68500", stopLoss:"67800", positionSize:"6800", positionSizeAsset:"0.1",
    pnl:"45.00", fees:"5.00", status:"closed", source:"blofin",
    setupTags:[], confirmationTags:[], timeframeTags:[], emotionTags:[], mistakeTags:[], customTags:[], layers:[]},
  {id:"blofin_btc_2", date:"2026-06-04", time:"10:30", pair:"BTC/USDT", direction:"long",
    entry:"68000", exit:"69000", stopLoss:"67800", positionSize:"6800", positionSizeAsset:"0.1",
    pnl:"95.00", fees:"5.00", status:"closed", source:"blofin",
    setupTags:[], confirmationTags:[], timeframeTags:[], emotionTags:[], mistakeTags:[], customTags:[], layers:[]},
]));
localStorage.setItem("tj_welcomed", "1");
localStorage.setItem("tj_onboarded", "1");
localStorage.setItem("tj_milestones_seen", JSON.stringify(["10","25","50","100","250","500","1000"]));
location.reload();
```

**Verwacht**: pagina herlaadt, Dashboard toont 6 trades binnen, geen JS-errors in console.

---

## 1. Happy path — selecteer 4 → merge → bekijk → splits

### 1.1 Trades-tab opent met 6 trades

- [ ] Klik tab **Trades** in de top-nav
- [ ] **Verwacht**: 6 rijen zichtbaar (4× XAUUSD long, 2× BTC/USDT long)
- [ ] **Mini-stats bovenaan**: `6 trades | +$767,50 | WR: 100.0%` (alles closed + winnaars)
- [ ] **Kolom-volgorde**: ☑ · Datum · Symbol · Side · Entry · Exit · Size · PnL · R-mult · Status · Setup · Sessie · Emoties
- [ ] **Status-kolom gecentreerd** (✓-icoon in midden van cel)

### 1.2 Selecteer alle 4 FTMO-trades

- [ ] Klik checkbox vóór de 4 XAUUSD-rijen (één voor één)
- [ ] **Verwacht na elke klik**: rij krijgt licht-gouden achtergrond
- [ ] **Na 4 selecties**: gouden bulk-bar verschijnt bovenaan met `4 trades geselecteerd`
- [ ] **Knoppen in bulk-bar**: `Export JSON` · `Export CSV` · **`🔗 Samenvoegen`** (goud) · `Verwijderen`

### 1.3 Knop verschijnt NIET bij crypto-selectie

- [ ] Klik "Deselecteer" om selectie te wissen
- [ ] Selecteer de 2 BTC/USDT-rijen
- [ ] **Verwacht**: bulk-bar toont wel `Export JSON` / `Export CSV` / `Verwijderen` maar **GEEN** `🔗 Samenvoegen`-knop
- [ ] **Reden**: scope v1 alleen FTMO; crypto-exchanges hebben auto-partial-detectie

### 1.4 Mixed selectie (FTMO + crypto) verbergt knop

- [ ] Selecteer 2 FTMO + 1 BTC (mixed)
- [ ] **Verwacht**: geen merge-knop (gate is `every(t=>t.source==="ftmo")`)

### 1.5 Open merge-modal

- [ ] Deselecteer alles, selecteer opnieuw de 4 XAUUSD-trades
- [ ] Klik **🔗 Samenvoegen**
- [ ] **Verwacht**: modal opent in midden van scherm met blur op achtergrond

### 1.6 Master-preview cijfers kloppen

In de modal onder "Master-trade preview":

| Stat | Verwachte waarde | Hoe gecheckt |
|---|---|---|
| Entry (gewogen) | **2018.5** | alle children dezelfde entry → avg = die entry |
| Exit (gewogen) | **~2026.75** | (2022+2025+2028+2032)/4 weighted by size |
| Totale size | **2** (asset) | 0.5 × 4 |
| SL | **2014.5** | conservatiefst (max voor long) — alle SL hetzelfde |
| Net PnL | **+$825,00** | groen | 87.50+162.50+237.50+337.50 |
| Sub PnL | `closed · fees $6.00` | alle 4 closed |

- [ ] Cijfers kloppen ✓
- [ ] Net PnL is **groen** (positief)

### 1.7 Validatie-checks

Onder "Validatie", 5 groene ✓-regels:

- [ ] ✓ Alle 4 trades op zelfde pair (XAUUSD)
- [ ] ✓ Alle trades zelfde direction (long)
- [ ] ✓ Allemaal source: ftmo
- [ ] ✓ Tijd-spreiding entries: 0 min (allemaal `09:42`)
- [ ] ✓ Alle trades closed — master wordt "closed"
- [ ] **Geen** ⚠ of ✗ regels

### 1.8 Conflict-vragen

Onder "Conflicten — welke waarde wil je op de master?" — er moeten **2-3** conflict-blokken zijn:

- [ ] **Trade-grade**: 4 radio-opties (child 1: A+, child 2: A, child 3: A+, child 4: B) · default: A+ (meest voorkomend)
- [ ] **Playbook**: 4 radio-opties (3× `london-breakout-long`, 1× leeg cursief) · default: `london-breakout-long`
- [ ] **Review notes**: 4 radio-opties (child 1 + child 4 hebben content, child 2/3 leeg) · default: child 1's notes · **plus** een extra optie **"concat"** met scheidingslijn

### 1.9 Speel met conflict-keuzes

- [ ] Klik radio "child 4" bij Trade-grade → **Verwacht**: stat-card "Entry" + "PnL" blijven gelijk (numeric data niet beïnvloed) maar grade-keuze wordt nu B
- [ ] Klik radio "concat" bij Review notes → **Verwacht**: optie krijgt gouden border
- [ ] Klik terug naar "child 1" bij Trade-grade → A+

### 1.10 Children-overzicht onderaan modal

- [ ] **5 kolommen per child**: `#1` · `2026-06-04 09:42` · `2018.5 → 2022` · `0.5` · `+$87,50` (groen)
- [ ] 4 rows, PnLs `+$87,50 / +$162,50 / +$237,50 / +$337,50`

### 1.11 Bevestig samenvoegen

- [ ] Klik **🔗 Bevestig samenvoegen** (goud, rechtsonder)
- [ ] **Verwacht**:
  - Modal sluit
  - Toast rechtsboven: `🔗 4 trades samengevoegd · XAUUSD long · +$825,00` (groen, 3 sec zichtbaar)
  - Selectie wist
  - Tabel toont nu **3 rijen** (1 master + 2 BTC/USDT)

### 1.12 Master heeft 🔗-badge

In de XAUUSD-rij van de master:

- [ ] **Pair-cel** toont `XAUUSD` + naast de naam een **🔗 4-badge** (blauw, monospaced, klikbaar)
- [ ] **Side**: LONG (groen)
- [ ] **Entry**: `2.018,5`
- [ ] **Exit**: `2.026,75` (gewogen avg)
- [ ] **Size**: `2`
- [ ] **PnL**: `+$825,00` (groen)
- [ ] **R-mult**: positief (ongeveer +2R)
- [ ] **Status**: ✓ groen (gecentreerd)
- [ ] **Setup**: `London Breakout`
- [ ] **Grade-tag**: A+ (jouw keuze)

### 1.13 Mini-stats bovenaan kloppen

- [ ] **Verwacht**: `3 trades | +$965,00 | WR: 100.0%`
  - 825 (master) + 45 (BTC1) + 95 (BTC2) = $965
  - 4 children ZIEN we niet meer in tellingen (dat is exact wat we wilden)

### 1.14 Open master-detail

- [ ] Klik **op de XAUUSD-rij** (niet op checkbox)
- [ ] **Verwacht**: TradeForm-modal opent

### 1.15 🧩-sectie bovenaan in TradeForm

Vlak boven de mindset-quote (of bovenaan):

- [ ] **Banner** met blauwe achtergrond + linker-rand
- [ ] Header: **🧩 Samengevoegd uit 4 trades** (blauw mono uppercase)
- [ ] Subkop: "Master-trade — gewogen entry, totale size, Σ PnL. Elke child = TP-niveau. Originelen blijven bewaard..."
- [ ] **Rechtsboven**: rode knop **🔓 Splits weer uit**
- [ ] **4 child-rijen** met TP1 / TP2 / TP3 / TP4 tags (goud), elk met:
  - Datum + tijdstip child
  - Exit-prijs van die TP
  - % van totaal (25% elk omdat allen 0.5)
  - Size + PnL groen

### 1.16 Sluit modal zonder save

- [ ] Klik **Annuleren** of ✕ rechtsboven in modal
- [ ] **Verwacht**: terug naar trades-lijst, geen wijzigingen

### 1.17 Splits weer uit

- [ ] Open de master-rij opnieuw
- [ ] Klik **🔓 Splits weer uit**
- [ ] **Verwacht**: browser-prompt `"Splitsen ongedaan maken? Master verdwijnt en 4 originele trades komen terug."`
- [ ] Klik **OK**
- [ ] **Verwacht**:
  - Modal sluit
  - Toast: `🔓 Master gesplitst — 4 originele trades hersteld` (blauw)
  - Tabel toont nu weer **6 rijen** (4 XAUUSD + 2 BTC)
  - Mini-stats: `6 trades | +$767,50 | WR: 100.0%`
- [ ] Alle 4 XAUUSD-trades hebben hun originele PnL/exit/etc. — niets veranderd

---

## 2. Edge cases

### 2.1 Slechts 1 trade geselecteerd

- [ ] Selecteer **alleen 1** XAUUSD-trade
- [ ] **Verwacht**: bulk-bar zichtbaar maar **GEEN** 🔗 Samenvoegen-knop
- [ ] **Reden**: gate is `selectedTrades.length>=2`

### 2.2 Re-import dedup — herken al-samengevoegde trades

> Belangrijkste test van v12.192. Vereist dat we eerst mergen.

- [ ] Merge opnieuw de 4 XAUUSD-trades (volg stappen 1.2-1.11)
- [ ] Open console (F12)
- [ ] Bekijk huidige state:
  ```js
  JSON.parse(localStorage.getItem("tj_trades")).length
  ```
  → **Verwacht: 5** (master + 4 children met `status="merged-child"`)
- [ ] Re-import simulatie — voer in console uit:
  ```js
  // Simuleer dat dezelfde 4 FTMO-trades opnieuw uit CSV komen
  const trades = JSON.parse(localStorage.getItem("tj_trades"));
  const reimport = trades.filter(t => t.status === "merged-child").map(c => ({
    ...c, status: "closed", mergedInto: null, _preMergeStatus: null
  }));
  console.log("Re-import test data:", reimport);
  ```
- [ ] **Manual test** via UI: open Settings → Account & Data → kies FTMO → klik **Trades importeren** → upload jouw bestaande FTMO-CSV
- [ ] **Verwacht toast**: `4 al samengevoegd ✓` of `Alle 4 trades bestonden al (waarvan 4 in een samengevoegde positie) — niets toegevoegd`
- [ ] **Verwacht**: tabel ONVERANDERD, geen duplicaten

### 2.3 Verschillende direction → block

- [ ] Voeg in console toe:
  ```js
  const t = JSON.parse(localStorage.getItem("tj_trades"));
  t[0].direction = "short"; // forceer mixed
  localStorage.setItem("tj_trades", JSON.stringify(t));
  location.reload();
  ```
- [ ] Selecteer alle 4 XAUUSD → klik 🔗 Samenvoegen
- [ ] **Verwacht in modal**: ✗ rode regel `Verschillende directions (long, short) — kan niet samenvoegen.`
- [ ] **Verwacht**: knop **🔗 Bevestig samenvoegen** is **gedisabled** (grijs, niet klikbaar)
- [ ] Reset met seed-data uit stap 0.2

### 2.4 Reeds gemerged child in selectie → block

> Zeldzaam scenario maar mag niet crashen.

- [ ] Merge de 4 XAUUSD-trades (1.2-1.11)
- [ ] In console:
  ```js
  // Forceer dat een merged-child toch zichtbaar wordt (bug-simulatie)
  const t = JSON.parse(localStorage.getItem("tj_trades"));
  const child = t.find(x => x.status === "merged-child");
  child.status = "closed"; // maak weer zichtbaar
  delete child.mergedInto;
  localStorage.setItem("tj_trades", JSON.stringify(t));
  location.reload();
  ```
- [ ] **Verwacht**: master + die ene "ontsnapte" child zichtbaar (5 rijen + 2 BTC = 7)
- [ ] Selecteer master + child → merge-knop verschijnt niet (master `mergedFrom` is gate)

### 2.5 Privacy-mode 👁 maskeert master PnL

- [ ] Merge de 4 trades (1.2-1.11)
- [ ] Klik 👁-icoon in topbar (Account Waarde header)
- [ ] **Verwacht**: master-rij PnL toont `$***,**` (gemaskeerd), badge `🔗 4` blijft zichtbaar
- [ ] Open master-detail → 🧩-sectie tonen child-PnLs ook gemaskeerd

### 2.6 Master in Dashboard equity-curve

- [ ] Merge actief
- [ ] Ga naar **Dashboard**-tab
- [ ] **Verwacht**: equity-curve telt de master als 1 punt (+$825), niet 4 punten van $87.50/$162.50/$237.50/$337.50
- [ ] Mini-stats Netto PnL = som van alle visible trades incl. master

---

## 3. Theme-consistentie (visueel)

Test snel of de 🔗-badge en 🧩-sectie er in elk thema goed uitzien.

- [ ] Settings → Thema → kies **Sync** (default) — open master-detail → 🧩-sectie blauw + leesbaar
- [ ] **Classic** — idem
- [ ] **Aurora** — idem
- [ ] **Light** (white) — 🧩-sectie en 🔗-badge moeten leesbaar zijn op witte bg
- [ ] **Parchment** — idem
- [ ] **Daylight** — idem

**Wat fout zou kunnen**: harde hardcoded blauw `#5aa9ff` op light themes te bleek, of `rgba(90,169,255,0.06)` te wit-op-wit. Als iets niet leesbaar is — flag het.

---

## 4. Regression — wat NIET kapot mag

Snelle checklist dat oude features niet zijn gebroken:

- [ ] **Trade openen + bewerken**: open een gewone (niet-merged) BTC-trade → form opent normaal → wijzig pnl naar `100` → save → tabel toont nieuwe pnl
- [ ] **Delete losse trade**: ✕ klik op één losse XAUUSD-rij → trade verdwijnt
- [ ] **Bulk export CSV**: selecteer 2 trades → Export CSV → bestand wordt gedownload met header `date,time,pair,...`
- [ ] **Filter werkt**: zoek "XAUUSD" in zoekbalk → alleen XAUUSD-rijen blijven over
- [ ] **Sorteer kolommen**: klik op "PNL" kolom-header → trades sorteren high→low / low→high
- [ ] **Dashboard equity-curve** rendert smooth zonder JS-errors

---

## 5. Wat is GEEN goed signaal — flag deze

Als je een van deze ziet, is er iets mis:

- ❌ Console JS-errors (rood in DevTools) tijdens click of save
- ❌ Master-rij toont met **4× PnL** ($3300 i.p.v. $825) → dubbel-telt bug
- ❌ Children blijven zichtbaar na merge → filterMergedChildren-bug
- ❌ Splits-knop wist data → restore bug (originele tags/notes weg)
- ❌ 🔗-badge klikt door naar verkeerde detail
- ❌ Mini-stats bovenaan tellen niet logisch op (master + losse trades)
- ❌ Layout shift bij merge (tabel "springt")
- ❌ Theme-switch breekt de 🧩-sectie visueel

---

## 6. Klaar

Alles afgevinkt → feature is gevalideerd. Reset met je echte data:

```js
// In console — terug naar je eigen state:
localStorage.removeItem("tj_trades");
// (of laad backup-JSON via Settings → Backup & Restore)
location.reload();
```

Of importeer je laatste backup-JSON via Settings → Backup & Restore → ↑ Backup importeren.

---

**Gemeld bugs of opmerkingen**: drop in Discord of voeg toe aan `BACKLOG.md` onder 🐛 Bugs sectie.
