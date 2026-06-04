# Changelog

Alle noemenswaardige wijzigingen aan SyncJournal. Versies volgen [semver](https://semver.org/): `major.minor`.

Na elke community-release verschijnt hier een nieuw blok. Vragen of feedback? Drop in de Morani Discord.

---

## [v12.188] — 2026-06-04

### Fixed
- **Dashboard "Account waarde" telde stale capital i.p.v. live equity** *(gemeld door Jordy in Discord: "balance van handmatige accounts wordt wel bijgewerkt bij settings, maar niet bij het dashboard")*

  **Oorzaak**: het Dashboard las het oude `a.balance`-veld (= start-capital van het account) i.p.v. de echte equity (capital + mutaties + trade-PnL). Settings → Accounts toonde dus $24.396 EQUITY terwijl het Dashboard $20.000 als ACCOUNT WAARDE liet zien — diezelfde stale capital deed `+10.000 → $10.000 / +10.000 → $10.000` zonder ooit de stortingen, opnames of gerealiseerde winst van gesloten trades mee te tellen.

  **Fix**: Dashboard rekent nu `equity = computeAccountCapital(transactions) + sumTradePnl(closed, account.name)` — exact dezelfde helpers die Settings ook gebruikt. Geldt voor het totaal in de header én voor het per-account regeltje rechts. Legacy accounts zonder `transactions`-array vallen terug op het oude `a.balance`-veld zodat hun startwaarde niet plots op $0 valt.

  **Effect**: stortingen / opnames / correcties via de Settings → Accounts knoppen + alle gesloten trades op dat account werken nu direct door in de Dashboard-header. Geen refresh of re-import nodig.

---

## [v12.187] — 2026-06-04

### Fixed
- **Trades-tabel kolommen niet goed aligned** *(gemeld door Denny: "kolommen en invoer niet goed aligend · meerdere kolommen · kan je dit eens goed nalopen?")*

  **Oorzaak**: header-cells (`thStyle`) hadden `padding:"8px 6px"`, body-cells (`tdStyle`) hadden `padding:"10px 6px"`. Verschillende vertical-paddings = visuele mismatch tussen header-labels en kolom-content. Plus header had geen eigen achtergrond → visueel niet duidelijk gescheiden van body.

  **Fix**:
  - **Padding uniform**: header + body beide nu `padding:"12px 10px"` (was 8/6 + 10/6 mixed). Body-cell content staat nu pixel-perfect onder header-labels.
  - **Header krijgt eigen achtergrond**: `background:"var(--bg3)"` → duidelijke scheiding met body-rijen.
  - **Header iets prominenter**: `fontWeight 600 → 700`, `letterSpacing 0.04em → 0.06em`.
  - **`verticalAlign:"middle"`** expliciet op header (was default maar nu garantie).
  - PaddingRight 12px op numerieke kolommen (Entry/Exit/Size/PnL/R-Mult) blijft consistent tussen header + body.

  **Effect**: Tabel ziet er nu strakker uit. Headers duidelijk afgescheiden. Numerieke waarden exact onder hun labels.

### Test
- Smoke groen + visueel geverifieerd: alle 12 kolommen netjes aligned, getallen onder header-labels uitgelijnd

---

## [v12.186] — 2026-06-04

### Fixed
- **Matrix-cellen slecht leesbaar** *(gemeld door Denny: "waarom zijn er zoveel zo slecht leesbaar?")*
  - Wat Denny opmerkte: dat is de `minN=3` drempel-instelling. Cellen met **<3 trades** (1 of 2 trades) krijgen opacity-dim omdat ze statistisch onbetrouwbaar zijn — één enkele trade van +$70 zegt niets over edge.
  - **Probleem**: opacity 0.4 was te aggressief, vooral in light/parchment thema waar tekst sowieso subtieler is. Tekst werd bijna onleesbaar terwijl de data wel relevant kan zijn (lower-confidence indicator).
  - **Fix**: opacity 0.4 → **0.7**. Visueel onderscheid blijft (signaal dat data lage confidence is), maar tekst is nu leesbaar in alle themas.
  - **Header-uitleg duidelijker**: "Cellen met < 3 trades zijn gedimd" → "Cellen met < 3 trades zijn iets transparant (te weinig data voor betrouwbare conclusie)".

### Test
- Smoke groen — pure opacity-tweak

---

## [v12.185] — 2026-06-04

### Gewijzigd
- **SetupSessionMatrix compacter** *(gemeld door Denny: "ziet er goed uit maar mag een tikje compacter")*
  - `border-spacing`: 3 → 2 (kleiner gat tussen tiles)
  - Cell paddings krimpen: header 8/10 → 6/8, body 8/12 → 6/10, lege cellen 12 → 10
  - Fonts 1px kleiner over de hele linie: WR% 14→13, PnL 10→9.5, header 10→9.5
  - `n trades` sub-label terug naar compacte `Xt` notatie (was "X trades")
  - Border-radius 6 → 5 voor cellen (subtieler)
  - Min-width tabel 800 → 780

### Test
- Smoke groen — pure sizing-tweak

---

## [v12.184] — 2026-06-04

### Gewijzigd
- **SetupSessionMatrix grondig herontworpen — heatmap-stijl** *(gemeld door Denny: "matrix niet overzichtelijk · hoe aantrekkelijker en beter lezen · denk goed na")*

  **Vorige design**:
  - Spreadsheet-look met 1px borders rondom elke cel (zware tabel)
  - 3 discrete kleur-buckets (groen / amber / rood / lichtgroen / lichtrood / transparent) op basis van WR + PnL drempels
  - Lege cellen met "—" centered, witte achtergrond, full border (visueel net zo prominent als data-cellen)
  - WR% klein (12px), n + $ samen op 1 regel (9px), flag in corner

  **Nieuwe design**:
  - **`border-collapse: separate` + `border-spacing: 3px`** voor visuele "tiles" met gap — geen zware borders meer
  - **`borderRadius: 6px`** per cel — heatmap-stijl
  - **Continue heat-color scale** ipv 3 discrete buckets:
    - Score = `wrScore * 0.55 + pnlScore * 0.45` (WR-offset van 50% + PnL-magnitude tot ±$500)
    - Alpha-intensiteit gebaseerd op |score| (0 → 0.28)
    - Donker groen voor sterke positieve edge → lichter → minimal → lichter rood → donker rood
  - **Lege cellen subtieler**: opacity 0.35, kleine "·" puntje ipv "—", `var(--bg4)` achtergrond → visueel terug op achtergrond
  - **Cell typografie hiërarchie**:
    - WR% prominent: 14px / fontWeight 800 / -.01em letterspacing
    - PnL middel: 10px / fontWeight 700 / kleur per teken
    - n trades sub: 8.5px / "n trades" volledig uitgeschreven
  - **Hover-effect**: `scale(1.04)` + box-shadow + z-index 2 (interactieve feedback)
  - **Flag-cellen**: gekleurde border per categorie (🎯 groene border / 🕒 rode border / ⏰ amber border) ipv alleen icon-badge
  - **Setup-rij headers**: prominenter (11.5px fontWeight 700) met eigen rounded card

  **Nieuwe features**:
  - **Sort-toggle**: "Op edge" (default — beste edge bovenaan op basis van cum-PnL) of "A–Z" (alfabetisch). State persisted in `tj_matrix_sort`.
  - **Legenda uitgebreid** met 2e regel uitleg: *"Cel-kleur = heat-map van edge-sterkte (donkergroen = sterke positieve edge, donkerrood = sterke negatieve). Klik op cel om trades te filteren."*

### Test
- Smoke groen — pure styling refactor

---

## [v12.183] — 2026-06-04

### Fixed
- **Edge-Breakdown bars + Per Confirmation-tag card** *(gemeld door Denny: "bars beginnen ook hier weer in het midden · rechter gedeelte niet duidelijk leesbaar")*

  **Edge-Breakdown bars** (Per dag / Per grade / Per sessie):
  - **Was**: divergent bar met center-lijn op 50% — positief groeide rechts, negatief links. Verwarrend en inconsistent met alle andere bars in de app.
  - **Nu**: uniform vanaf links. Bar-lengte = magnitude, kleur signaleert teken. Same look-and-feel als Layer-Pattern, Tijd-van-dag, Performance Per Pair, etc.
  - Bar-hoogte 6 → 8px, met border voor betere zichtbaarheid in light themas.
  - Hover-tooltip met volledige info.

  **Per Confirmation-tag card** (rechter card "MET VS ZONDER"):
  - **Was**: 2-koloms layout met groene + rode tinted boxes naast elkaar (mét/zonder), losse Δ-regel onderaan. Niet duidelijk wat "mét"/"zonder" betekenden, kleuren hardcoded ongeacht teken.
  - **Nu**: per tag een **stacked layout**:
    - Tag-naam prominent + delta-badge rechts (`-0.25R delta`)
    - Visuele bar die magnitude van delta toont (kleur per teken)
    - 2 sub-regels: `met deze tag: +0.47R · 150 trades` / `zonder deze tag: +0.72R · 150 trades`
    - Kleuren nu **per R-teken** (positief = groen, negatief = rood) — niet hardcoded per "met/zonder" positie
  - Card-header subtitle uitleg: *"Verschil in R-multiple wanneer je deze tag wel of niet had bij entry. Positief = tag voegt edge toe."*

### Test
- Smoke groen + visueel geverifieerd met seed-playbook (300 trades, varied confirmation-tags)

---

## [v12.182] — 2026-06-04

### Gewijzigd
- **PlaybookDetailModal grondig hertekend** *(gemeld door Denny: "niet leesbaar en overzichtelijk · breder paneel · beter ontwerp · zelfde grootte fonts · alles loopt door elkaar")*

  **Layout**:
  - Modal **maxWidth 920 → 1240** (35% breder, veel meer adem)
  - Body **padding uniform 32px** (was 22-28 mixed)
  - **Section gap 24 → 32** (consistente verticale ademruimte tussen blokken)
  - Header padding uniform 28-32 (was 22-28)

  **Typografie consolidatie**:
  - Nieuwe `PDH` (Playbook Detail Header) helper component — vervangt **12 inline kopieën** van section-eyebrows met subtiele variaties (margin-bottom 10, soms hint-rendering, soms niet, etc.). Eén uniforme stijl voor alle: 11px mono gold uppercase + 14px margin-bottom + italic hint optioneel.
  - Toegepast op: Setup-lagen / Setup-voorbeelden / Referenties / Stats / Edge-breakdown / Markt-context / Entry-criteria / Anti-criteria / Rules / Hoe verpest jij dit setup? / Edge-Erosion Funnel / Simulated Trades / Recent gelinkte trades
  - **Tag-chip fontSize uniform naar 11px** (was 10-11.5 wisselend) op header pairs/timeframes/sessions
  - Stat-cards **groter en duidelijker**: padding 12→18, fontSize 18→22, border-radius 8→10, gap 10→12, label-letterspacing+weight bumped

  **Theme-tokens**:
  - Stat-cards `rgba(255,255,255,0.02)` → `var(--bg3)` (theme-aware)

### Effect
- Modal voelt nu **ruim en georganiseerd**. Een uniforme leesritme per sectie (eyebrow + content), niet 12 verschillende sub-variaties.
- Belangrijke nummers (TRADES 271, WIN-RATE 80%, etc) zijn echt prominent — voorheen klein en weggedrukt.
- Tag-chips in header consistent qua hoogte → één visuele rij, geen "trapeze".

### Test
- Smoke groen + visueel geverifieerd met Daily Bias Pullback seed-playbook (271 trades, 80% WR, +0.67R avg, +$12632 cum)

---

## [v12.181] — 2026-06-04

### Fixed
- **Layer-Pattern + Tijd-van-dag bars: uniform left-aligned + 2-regel R-label** *(gemeld door Denny: "hier zijn de bars niet links zoals bij de andere bars — kan je dit overal in het document doen?")*

  **Oorzaak**: in `PlaybookAnalyticsView` hadden 2 bar-secties nog de oude rendering met `justifyContent: isWin ? "flex-start" : "flex-end"` — positieve bars groeiden vanaf links, negatieve van rechts. Plus cryptische label `+0.8R · 50` (was al verbeterd in andere secties).

  **Fix**:
  - **Layer-Pattern** (regel ~10186) + **Tijd-van-dag (CET)** (regel ~10237): `justifyContent` swap verwijderd, bars groeien nu uniform vanaf links voor zowel positief als negatief (kleur signaleert teken).
  - 2-regel R-label notatie (`+0.8R avg` boven, `50 trades` eronder) — matched met `RBar`/`RLabel` in Per Pair/Grade/Direction cards.
  - Hover-tooltip op bar legt R-multiple uit (consistency).

  **Globale audit**: grep door hele file voor `justifyContent.*?flex-end.*?flex-start` → enige overige hits zijn chat-bubble alignment in AI-coach (geen bars). Geen andere right-aligned bars meer in document.

### Test
- Smoke groen — pure CSS/JSX-wijziging op 2 bar-secties

---

## [v12.180] — 2026-06-04

### Fixed
- **PlaybookCard: uniforme hoogte + geen status-kleur links** *(gemeld door Denny: "size van playbook-tegels niet gelijk + kleur status links geeft onrust")*

  **Oorzaak**:
  - Cards hadden `borderLeft: 3px solid statusColor` — groen voor active, amber voor testing, grijs voor retired. Plus de bestaande status-pill rechtsboven = dubbele status-signaal + visuele drukte.
  - Variabele content (one-liner / aantal tags / sparkline / "Nog geen linked trades"-tekst) maakte cards verschillend hoog binnen dezelfde grid-rij.

  **Fix**:
  - **borderLeft verwijderd** — status-pill rechtsboven blijft enige status-signaal.
  - **`display: flex; flex-direction: column; height: 100%`** op de card-root.
  - **Spacer-div** (`flex: 1`) net vóór Trust-Score sectie zodat de progress-bar altijd onderaan blijft, ongeacht hoeveel content erboven staat.
  - Grid wrapper-divs per card krijgen `height: 100%` zodat de card de hele cell vult. Plus `alignItems: stretch` op de grid.

### Test
- Smoke groen + 4-cards screenshot (Breakout A+ / Range Fade / Pullback Continuation Long / Retired Setup) — 3 cards in bovenste rij nu pixel-identiek hoog, Trust-Score onderaan uitgelijnd

---

## [v12.179] — 2026-06-04

### Gewijzigd (UX fase 5e — alle equity-curves nu echt consistent)
- **PlaybookEquityCurve consolideerd naar SyncEquityCurve** *(gemeld door Denny: "de curve in playbook en de curve in de dashboard zijn verschillende types")*
  - Was: eigen multi-line SVG-impl met HWM-stippellijn + dashed grid + dashed zero-line + multi-overlay (Real/Backtest/Paper/Missed tegelijk als verschillende dash-patterns)
  - Nu: **single-line SyncEquityCurve met chip-filter** (Variant A — klik bron = die curve, switchen ipv overlay). Match met Dashboard/Review look.
  - HIGH / END labels behouden in card-header
  - **Compacte DD-pill** rechtsboven (`● DD`)
  - State persisted in `tj_playbook_dd`

### Toegevoegd in SyncEquityCurve
- **`data` prop** (bypass `tradesToEquity`) voor pre-berekende equity-arrays `[{t,v}]`. Use-case: PlaybookEquityCurve heeft `{date,cum}[]` per simType → simpele map naar `{t,v}` en doorgeven.

### Effect — UX fase 5 nu écht afgerond
**Eén consistente equity-curve in ALLE 6 locaties**:
1. Dashboard `SyncEquityCurve` (Variant A, exchange-chips)
2. Review `SyncEquityCurve`
3. DashboardPremium `SyncEquityCurve`
4. Playbook-card sparklines `SyncEquityCurve` mini-mode
5. Tendency-card sparklines `SyncEquityCurve` mini-mode
6. **Playbook Analytics view** `SyncEquityCurve` (Variant A, simType-chips) ← v12.179

Geen multi-line overlays meer. Geen HWM-stippellijnen. Geen dashed grids. Allemaal smooth + clean.

### Test
- Smoke groen — pure component refactor

---

## [v12.178] — 2026-06-04

### Gewijzigd (UX fase 5d — equity-curve consolidatie afgerond)
- **DashboardPremium equity-curve** vervangen door SyncEquityCurve (laatste caller van oude EquityCurveChart). DD-pill rechtsboven naast HIGH/END labels (compact "● DD"). State persisted in `tj_premium_dd`.

### Verwijderd
- **Oude Chart.js `DashboardEquityChart` function** (~30 regels) — geen callers meer
- **Oude Chart.js `EquityCurveChart` function** (~25 regels) — alle callers vervangen

### Effect
- **Eén consistente equity-curve** door de hele app: Dashboard, Review, DashboardPremium, Playbook-cards, Tendency-cards. Allemaal via `SyncEquityCurve` met de clean defaults (smooth, geen HWM, subtle grid, drawdown via pill).
- **Chart.js library** blijft staan — nog 4 niet-equity charts gebruiken het (RMultDist, MistakeImpact, RollingEdge, TradeReport PDF charts). Library-verwijdering buiten scope.

### Regressie-validatie
- Smoke groen
- Themes: 6/6 thema's groen
- Backup-bewaker: 11/11 groen
- Blofin partial-close + andere kritieke tests: groen
- Geen regressies door v12.175-v12.178 wijzigingen

### UX-fase 5 totaal-overzicht
| Release | Wat |
|---------|-----|
| **v12.175** | EquityCurve.js inline + SyncEquityCurve wrapper + Dashboard equity (Variant A clean) |
| **v12.176** | Review equity-curve naar SyncEquityCurve |
| **v12.177** | Playbook + Tendency sparklines naar SyncEquityCurve mini-mode |
| **v12.178** | DashboardPremium equity-curve + cleanup oude Chart.js code |

---

## [v12.177] — 2026-06-04

### Gewijzigd (UX fase 5c — equity-curve consolidatie)
- **PlaybookSparkline + TendencySparkline** vervangen door SyncEquityCurve in `size='mini'`
  - Eén consistente look door de hele app (Dashboard / Review / Playbook / Tendencies)
  - PlaybookSparkline switcht van cum-R-multiple naar cum-PnL (consistency boven specificity)
  - Default `drawdown:false` = pure groene curve, geen rood-bij-verlies kleur switch meer
  - `aggregateDaily:false` voor sparklines — alle trades als individuele punten zichtbaar
  - Externe wrap-divs (`height:36px` / `height:48px`) blijven het hoog-formaat aansturen

### Test
- Smoke groen + visueel geverifieerd op Playbook (Breakout A+ card met smooth groene sparkline)

---

## [v12.176] — 2026-06-04

### Gewijzigd (UX fase 5b — equity-curve consolidatie)
- **Review equity-curve** vervangen door SyncEquityCurve met clean defaults
  - Oude `<EquityCurveChart line={eq}/>` (Chart.js) → `<SyncEquityCurve trades={trades}/>` (vanilla SVG)
  - Same look-and-feel als Dashboard equity-curve (smooth, no HWM, subtle grid)
  - DD-pill in card-header naast "EQUITY CURVE" label
  - Drawdown-state persisted in `tj_review_dd` localStorage

### Test
- Smoke groen + visueel geverifieerd op Review-tab (curve van 02-01 tot 03-13, DD-pill rechts)

---

## [v12.175] — 2026-06-04

### Toegevoegd (UX fase 5a — equity-curve consolidatie)
- **Nieuwe `SyncEquityCurve` React-wrapper** rond een framework-vrije SVG equity-curve component (`window.EquityCurve`, inline vóór Babel-blok). Eén consistente look door de hele app, met clean defaults:
  - **drawdown standaard UIT** (subtiele pill-toggle per chart)
  - **geen HWM-stippellijn** (de gouden gestippelde lijn langs pieken weg)
  - **smooth curves** (bezier-paden, geen hoekige knikken)
  - **subtle solid grid** (geen dashed)
- **Helpers**:
  - `tradesToEquity(trades, startBalance)` — closed-only, sorteert op date+time, cumuleert netPnl
  - `aggregateDailyEq(equity)` — 1 punt per dag-eind (rustigere curve bij high-freq trading)
  - `buildEquityTheme()` — leest CSS-vars (--green/--red/--text*/--bg2) en mapt naar EquityCurve theme-schema
- **Privacy-mode**: via `formatValue` callback maskeert bedragen naar `$***` op y-axis ticks + tooltip. Patch op vendor-component (4 regels).

### Gewijzigd
- **Dashboard equity-curve vervangen** door SyncEquityCurve (Variant A — chip-filter geeft één totaal-lijn, geen multi-line overlay meer).
  - Bestaande `DashboardEquityChart` (Chart.js) blijft staan tot v12.178 cleanup
  - Period-buttons + exchange-chips behouden (filteren trades vóór doorgeven)
  - BTC↔USD unit-toggle behouden (transformeer pnl door 1/btcPrice + currency-prop swap)
  - **Subtiele DD-pill** rechtsboven in card-header (`● DRAWDOWN`) — klein, monospaced, grijs default. Klik = rood actief, drawdown-strip verschijnt onder de curve. Persisted in `tj_dashboard_dd` localStorage.

### Niet aangeraakt (Out-of-scope deze release)
- Review equity-curve (volgt v12.176)
- Playbook + Tendency mini-sparklines (volgen v12.177)
- Oude DashboardEquityChart code (cleanup v12.178)
- Chart.js library zelf (nog 4 niet-equity charts in gebruik: RMultDist / MistakeImpact / RollingEdge / TradeReport PDF)

### Test
- Smoke groen
- Visueel geverifieerd: clean curve zonder drawdown (default), met drawdown via pill-toggle

---

## [v12.174] — 2026-06-04

### Fixed
- **Playbook Analytics: paarse rij-achtergrond Missed-impact niet meer theme-consistent** *(gemeld door Denny met screenshot: "gaat niet meer in het thema")*
  - **Oorzaak**: 4 rijen in Missed-impact card hadden hardcoded `rgba(180,140,200,0.12)` background + `rgba(180,140,200,0.32)` border (paarse "ghost trades" tint). Bij donker thema werd dat een paars-zwaar blok dat niet matchte met de Mistake-tags / Emotion-impact rijen ernaast.
  - **Fix**: backgrounds + borders genormaliseerd naar `var(--bg3)` + `var(--border1)` — zelfde patroon als de andere kaart-rijen.
  - **Behouden**: paarse tekst-kleur (`#b48cc8`) op de cijfers blijft als semantisch signaal voor missed/ghost-trades.

### Niet aangeraakt (bewust)
- Edge Gap section in Analytics (regel 7224+) — dedicated "missed trades" view; paars-tint past hier semantisch
- 👻 MISS-pill in Trades-tabel (regel 4320) — status-indicator, paars is functioneel
- Trade-form `👻 Type` filter-buttons + `👻 Gemist?` toggle — input-controls, paars is hun signaal

### Test
- Smoke groen — pure CSS/styling-wijziging, geen runtime-impact

---

## [v12.173] — 2026-06-03

### Gewijzigd
- **Bar-charts: uniform links-uitgelijnd (revert van v172 divergent)** *(gemeld door Denny: "alles van links naar rechts is beter lijkt me")*
  - V172 divergent design (bars vanuit center) bleek tegenintuïtief — twee leesrichtingen voor het oog (rechts voor positief, links voor negatief).
  - **Nu**: alle bars starten links bij 0 en groeien naar rechts. Bar-lengte = magnitude (|waarde|), kleur = signaal (groen=positief, rood=negatief).
  - Eén leesrichting: hoe verder de bar uitsteekt, hoe groter de impact (of het nu winst of verlies is).
- **MistakeImpactChart (Chart.js)**: nu `beginAtZero:true` met `abs` values. X-axis vanaf $0 links naar +$X rechts. Tooltip toont oorspronkelijk teken (`+$X` of `−$X`). Geen symmetric scale meer nodig.
- **`barRow` + `RBar` helpers**: terug naar simple left-aligned + positive width. Geen center-line, geen flex-halves.

### Behouden uit v172
- 2-regel label-notatie: `+0.6R avg` + `244 trades` (niet meer cryptisch `+0.6R · 244`)
- Hover-tooltip op bars die R uitlegt
- `30t` ipv `30x` voor trade-count

### Test
- Smoke groen
- Visueel geverifieerd: Performance Per Pair (BTC/ETH/LINK/SOL/AVAX) toont één rij ETH groen + 4 rode (oplopende lengte). Fout-impact: 7 rode + 1 groene, allemaal vanaf $0 links.

---

## [v12.172] — 2026-06-03

### Gewijzigd
- **Bar-charts: divergent design (vanuit center, niet vanaf links)** *(gemeld door Denny: "rood rechts is niet echt heel duidelijk voor me")*
  - **Voor**: bars groeiden allemaal vanaf links — rode bars (negatief) waren rechts-uitgelijnd, groene bars (positief) links-uitgelijnd. Verwarrend bij mix van winnaars/verliezers en bij chart waar bijna alles negatief is.
  - **Na**: bars groeien VANUIT zero-line in het midden. Positief = rechts (groen), negatief = links (rood). Center-line altijd visueel zichtbaar als 1px verticaal lijntje.
  - **Geraakt**:
    - `barRow` helper in Analytics → 5 charts: Performance per Pair / Per Dag / Per Sessie / R:R / Layer Setups
    - Per Pair / Per Grade / Per Direction cards in SetupInsightsView (Playbook → Analytics) — eigen helper `RBar`
    - `MistakeImpactChart` (Chart.js) → x-axis nu symmetric `min=-maxAbs, max=+maxAbs` met 0-grid-line dikker zichtbaar (1.5px ipv 1px)

- **Cryptische "+0.6R · 244" notatie verduidelijkt** *(gemeld door Denny: "ik vind door de hele journal maar is onduidelijk")*
  - **Voor**: `+0.6R · 244` — wat is R? wat is 244?
  - **Na**: Twee-regel label:
    - Regel 1: `+0.6R avg` (met "avg" in kleinere grijze suffix)
    - Regel 2: `244 trades` (volledig uitgeschreven, klein font)
  - Plus `title` hover-tooltip op de bar: *"Gemiddeld +0.6R per trade. R = winst gedeeld door risk. 0R = break-even, +1R = je verdiende je risk-bedrag."*
  - `barRow` `30x` → `30t` (compact maar duidelijker als "trades")

### Test
- Smoke groen
- Visueel geverifieerd op Performance Per Pair (Analytics): BTC/ETH groen rechts van center, LINK/SOL/AVAX rood links van center
- Fout-impact Chart.js: symmetric x-axis (-$111 ... +$0 ... +$111)

---

## [v12.171] — 2026-06-03

### Fixed
- **Geen ruimte tussen Thema- en TP-templates-card in Instellingen** *(gemeld door Denny met screenshot)*
  - **Oorzaak**: Layout-card en Thema-card hebben `marginTop:"16px"` op hun inner-wrap-div, maar TpTemplateManager wrap-card had alleen `marginBottom`, geen `marginTop`. Daardoor stond TP-templates direct tegen het Thema-card.
  - **Fix**: `marginTop:"16px"` toegevoegd aan TpTemplateManager wrap-card, matchend met Layout/Thema spacing-patroon.

### Test
- Smoke groen + screenshot geverifieerd: duidelijke 16px gap tussen Thema en TP-templates

---

## [v12.170] — 2026-06-03

### Fixed (Privacy-mode leak-audit)
- **10 privacy-leaks gefixed** *(gemeld door Denny: "als ik de prijzen hide dan zie ik bij gerealiseerde winst nog steeds de winsten en geen sterren. loop alles nog even door")*

  **Dashboard**
  - `DashboardEquityChart` y-axis ticks + tooltip — toonden equity-bedragen ongemaskeerd (callback functie checked geen `priv`)
  - "Gerealiseerde winst" header in Portfolio-card — 28px groot bedrag was zichtbaar
  - Per-exchange totals onder chart (Blofin +$X, Kraken +$Y) — niet gemaskeerd

  **Trades**
  - Mini-stats strip "25 trades | +$132,50 | WR: 64.0%" — totalPnl was niet gemaskeerd
  - `closeData` toasts ("✓ Trade gesloten — PnL: +$X") — 4 toast-varianten lekten netto-PnL

  **Review**
  - Equity Stats sub-cards (NET PNL / MAX DRAWDOWN / HUIDIGE CUMULATIEF / TRADING DAGEN) — 3 bedragen ongemaskeerd. Trading dagen blijft zichtbaar (geen $ bedrag)

  **Kalender**
  - "Best dag" KPI label — bedrag ongemaskeerd
  - Heatmap-tooltip (hover dag-cell) — `tip.innerHTML` toonde dag-PnL ongemaskeerd

  **Tendencies**
  - Setup × Sessie matrix-cellen — `pnlStr` toonde cumulatieve PnL per cell ongemaskeerd
  - Tendency-card "CUMULATIEF" KPI — bedrag ongemaskeerd (rules-of-hooks: `usePrivacy` toegevoegd aan `TendenciesPage`)
  - Setup×Sessie matrix `usePrivacy` toegevoegd aan `SetupSessionMatrix` component

### Open / lower-prio (documented voor toekomstige pass)
- Tendency-card body-descriptions bevatten nog "cumulatief +$X" in lopende tekst (9 desc-strings in `getTendencies()` — vereist function-signature uitbreiding)
- BTC live-feed + ticker (publieke market-price) — bewust niet gemaskeerd, geen user-private data
- Entry/Exit prices in Trades-tabel — market prices van trade-moment, niet account-balans (consistent met BTC ticker beleid)
- Trade-cards (share-cards / PDF-rapport) — user kiest expliciet om te delen, eigen workflow

### Test
- Smoke groen
- Themes regressie 6/6 groen
- Backup-bewaker regressie 11/11 groen
- Visueel geverifieerd via 8 priv=on screenshots (Dashboard, Trades, Analytics, Review, Kalender, Tendencies, Playbook)
- React error gefixed in TendenciesPage (`priv is not defined`)

---

## [v12.169] — 2026-06-03

### Gewijzigd
- **Trades-tabel: numerieke kolommen rechts-uitgelijnd** *(gemeld door Denny: "kolommen wijken wat af")*
  - **Voor**: Entry / Exit / Size / R-Mult kolommen waren `textAlign:"center"`. Met variabele-width getallen (`3,09` vs `67.327,40`) wijken decimalen visueel af. PnL was zonder explicit align (default left), inconsistent met andere numerieke kolommen.
  - **Na**: Entry / Exit / Size / PnL / R-Mult → `textAlign:"right"` + `paddingRight:"12px"`. Headers en body matchen. Duizenden-separators, decimal-punten en `+/-`-tekens lijnen pixel-perfect onder elkaar.
  - **Pro-trader-best-practice**: numerieke data right-aligned, categorische data left-aligned. Status / Datum / Symbol / Setup / Sessie / Emoties blijven links. Side blijft center (pill).
  - LIQ-price flex-column nu `alignItems:"flex-end"` matchend met right-align van de Exit-cel.

### Test
- Smoke groen + screenshot geverifieerd op breed viewport (1600px) met variabele-width data: alle decimal-punten staan onder elkaar

---

## [v12.168] — 2026-06-02

### Verwijderd (UX-audit fase 4e — polish)
- **Mark Douglas-quote naast Analytics "Genereer rapport"-knop** *(deep audit: filler-element naast functionele knop)*
  - "Focus on the process, the outcome takes care of itself." — Mark Douglas (proces-mode)
  - "Resultaten van je trading. Uitkomst." (winst-mode)
  - "Proces én uitkomst naast elkaar." (beide-mode)
  - viewMode-buttons hebben al `title=` tooltips met deze exacte uitleg — quote was duplicate visuele claim
  - Verticale balans rechts-bovenhoek opgeschoond — alleen "📄 Genereer rapport"-knop blijft

### Regressie-validatie
- **Themes**: 6/6 thema's (sync/classic/aurora/light/parchment/daylight) laden zonder JS-errors
- **Backup-bewaker**: alle 11 tests groen (AlertCenter, reminder-flow, snooze, onboarding, soft recovery, autobackup)
- **Blofin partial-close**: alle 2 tests groen (sibling-detector + UI-rendering)
- **Smoke**: groen
- Geen regressies door v12.164-v12.167 wijzigingen

---

## [v12.167] — 2026-06-02

### Gewijzigd (UX-audit fase 4d)
- **Tendencies + Playbook page-headers gedetoxt** *(deep audit: beide schermen begonnen met onderwijzende paragrafen die voor returning users ruis zijn)*

  **Tendencies**
  - **Voor**: H1 "Wat moet je weten?" + 44-woord ondertitel "Cross-dimensionele patronen over je laatste 30 dagen. Klik op een card om door te springen naar de gefilterde trades. Sterktes om te repliceren, pijnpunten om te omzeilen."
  - **Na**: H1 "Tendencies" (zoals scherm-naam) + 14-woord sub "Patronen over je laatste 30 dagen — klik op een card om naar de trades te springen."
  - Full uitleg over "sterktes/pijnpunten" verschoven naar eyebrow-tooltip
  - H1 "Wat moet je weten?" voelde paternalistisch — app sprak gebruiker als kind aan

  **Playbook**
  - **Voor**: H1 "Jouw bewezen setups, geformaliseerd" + 57-woord intro "Een journal logt élke trade. Een playbook bevat alleen je A+ setups, gestructureerd en herhaalbaar. Pre-market scan je alleen op deze setups; alles daarbuiten = no-trade. Stats worden automatisch berekend uit trades met overlappende setup-tag."
  - **Na**: H1 "Playbook" + 18-woord sub "Je **A+ setups**, geformaliseerd. Stats worden auto-berekend uit trades met matching setup-tag."
  - Full journal-vs-playbook uitleg verschoven naar eyebrow-tooltip
  - Eerste-bezoek uitleg is nuttig; permanent staan is ruis

### Effect
- Beide schermen krijgen Stripe/Linear-stijl page-header (gewoon de scherm-naam als H1) — direct content-focus i.p.v. marketing-tagline
- Returning users zien geen herhaalde les meer; nieuwe users vinden uitleg op hover van eyebrow

### Test
- Smoke groen + 2 screenshots geverifieerd (Tendencies headlines + Playbook empty-state)

---

## [v12.166] — 2026-06-02

### Gewijzigd (UX-audit fase 4c)
- **Analytics "Proces-metrics" 95-woord info-block → dismissable 1-regel hint** *(deep audit: permanent 3-regel uitleg over "Proces-metrics vs Trading Rules" — nuttig bij eerste bezoek, ruis voor returning users)*
  - Hint nu compact: "**Proces-metrics** meten trade-data-compleetheid — niet Kalender's dagelijkse Trading Rules. *(hover voor detail)*"
  - Full uitleg over thesis/SL/post-trade notes verschoven naar `title` hover-tooltip
  - X-knop rechts dismist permanent via `tj_analytics_proces_hint_dismissed` localStorage
  - Geen rules-of-hooks-violation: state lift naar Analytics top-level
- **Lege Proces-KPI cards: opacity 0.5** *(was: even prominent als gevulde KPI's = onbalans)*
  - Hele card (border, background, value, sub, icon) krijgt opacity 0.5 wanneer empty
  - Gevulde KPI's blijven prominent; lege "staan achteraan"
  - Geen layout-shift: card-size identiek (drag-sortable grid stabiel)

### Effect
- Analytics top-fold krijgt extra ademruimte. Met hint dismissed: Discipline heatmap (footer-feature) komt direct mee in viewport
- Visuele hiërarchie: oog gaat naar prominent gevulde KPI's; lege KPI's signalen wat nog te trackmen valt zonder schreeuwen

### Test
- Smoke groen + 2 screenshots geverifieerd (hint on, hint dismissed)

---

## [v12.165] — 2026-06-02

### Gewijzigd (UX-audit fase 4b)
- **Trades-tabel "fruit-salad" pill-overload weg** *(deep audit: 6+ verschillend gekleurde pills per rij = visuele lawaai)*
  - **STATUS-kolom voor closed trades**: van WIN/LOSS-pill naar subtiel ✓ (groen) / ✗ (rood) icoon. Dupliceerde PnL-kleur — twee plekken zelfde info. Open/Partial/Missed indicators blijven full-pill (voegen wel info toe).
  - **R-MULT-kolom**: pill (background + color) → gewoon gekleurde tekst (`+1.5R` groen / `-2.3R` rood), monospaced. `.r-pos`/`.r-neg`/`.r-zero` classes verloren hun background.
  - **SETUP-kolom**: van gold-on-gold-dim pill naar gold-gekleurde tekst, geen background, geen border.
  - **SESSIE-kolom**: van per-sessie gekleurde pill naar per-sessie gekleurde tekst, geen background.
  - **EMOTIES-kolom**: van rood/groen pill naar rood/groen tekst.

### Effect
- Per rij van **6+ gekleurde pills** naar **2** (alleen SIDE pill + PnL-tekst). Tabel kan rusten.
- Symbol-pill (BTC/ETH/SOL met crypto-icon) blijft — visueel necessary disambiguation.
- Scanbaarheid + 1: oog vindt PnL en R-mult sneller zonder competing backgrounds.

### Test
- Smoke groen + screenshot geverifieerd (8 rijen zichtbaar, alle status-indicators + setup-tags + sessies correct gerenderd)

---

## [v12.164] — 2026-06-02

### Gewijzigd (UX-audit fase 4a)
- **Mindset-quote: dismiss-once-per-day + alleen op Dashboard** *(geleerd uit deep UX-audit: banner verscheen ook op Review en kwam steeds terug bij elke pageload)*
  - Klik X = quote verberg tot middernacht (Amsterdam-tijd). Volgende dag verschijnt 'm automatisch weer
  - Persisted via `tj_mindset_dismissed_until` localStorage timestamp
  - Niet meer op Review (was 2-page tax; eerder voor reflectie-momenten gedacht, maar dubbel-tonen werd ruis)
- **Sample-size waarschuwing: van 156 woorden naar 8** *(zelfde tekst verscheen 3× over Dashboard/Analytics/Review)*
  - **Voor**: "⚠ Sample-size waarschuwing: 25 trades — onder de 30-drempel voor statistisch betrouwbare conclusies. Profit Factor, Expectancy, WR per setup zijn indicatief; behandel als richting, niet als feit."
  - **Na**: "⚠ 25 trades — onder 30-drempel, stats indicatief."
  - Detail-uitleg verplaatst naar hover-tooltip op de banner
  - Banner verwijderd uit Analytics en Review — alleen Dashboard toont 'm nog (1× per sessie i.p.v. 3×)

### Effect
- Dashboard top-fold met dismissed mindset: KPI cards 1 fold hoger in viewport
- Analytics top-fold: ~30px verticaal gewonnen (geen sample-size banner meer)
- Review: KPI cards en Trade Score direct na filter-bar

### Test
- Smoke groen + 4 screenshots geverifieerd (dashboard normaal, dashboard met dismissed quote, analytics zonder banner, review zonder banner+quote)

---

## [v12.163] — 2026-06-02

### Verwijderd
- **Analytics TOC ("Spring naar:" sticky bar) verwijderd** *(gemeld door Denny: "ik zie nog steeds beide. dat is overbodig")* — De v12.161+v12.162 TOC kwam pal onder de viewMode-control (Proces/Winst/Beide) te staan. Twee bars boven elkaar bleek visueel overladen, ook na het ontdubbelen van labels in v12.162. viewMode dekt de navigatiebehoefte voldoende — Analytics is met de filter "wat zie ik" al voldoende beheersbaar.
  - Code helemaal verwijderd (geen `display:none` of feature-flag)
  - Geen impact op widgets zelf: `data-sortkey` attributes blijven voor drag-reorder

---

## [v12.162] — 2026-06-02

### Gewijzigd
- **Analytics TOC — Proces/Winst-knoppen verwijderd om dubbel-op te vermijden** *(gemeld door Denny: "bij analytics heb je het nu dubbel")* — De v12.161 sticky TOC bevatte 🧠 Proces en 💰 Winst-knoppen, maar dezelfde labels stonden ook in de viewMode-control erboven (Proces / Winst / Beide). Visueel dubbel-op + verwarrend over functie-verschil.
  - **Nieuwe TOC**: 📅 Discipline · 📈 R-Multiple · 🎯 Setups · 💭 Fout & Emotie
  - Bewust geen Proces/Winst-labels meer in TOC — die staan in viewMode (filter "wat zie ik")
  - TOC blijft een scroll-shortcut voor diepere widgets die anders ondersneeuwen
  - Functie-verschil nu helder: **viewMode** filtert wat zichtbaar is, **TOC** scrolt erbinnen

### Test
- Smoke groen + screenshot geverifieerd: viewMode-bar en TOC-bar hebben geen overlap meer

---

## [v12.161] — 2026-06-02

### Toegevoegd
- **Analytics sticky TOC (section-nav)** — Boven de Analytics-feed staat nu een sticky "Spring naar:"-bar met jump-knoppen naar de 5 belangrijkste secties. Voorheen moest je 20+ widgets doorscrollen zonder oriëntatie:
  - **🧠 Proces** — naar process KPI's (plan / SL / journal / consistency)
  - **💰 Winst** — naar winst KPI row
  - **📈 R-Multiple** — naar R-multiple distributie
  - **🎯 Setups** — naar setup insights tabel
  - **💭 Fout & Emotie** — naar fout-analyse sectie
  - Klik = `scrollIntoView` met smooth-behavior; offset houdt de TOC zelf in beeld
  - **Smart filtering**: knoppen die naar verborgen widgets verwijzen (uitgezet in Layout-prefs of buiten huidige viewMode proces/winst/both) worden automatisch niet getoond
  - **Sticky positioning** met `position:sticky; top:0` — blijft bovenin viewport bij scrollen
  - **Auto-hide bij <2 sections** — als maar 1 section over is na filter is TOC overbodig

### Effect (UX-audit fase 3b)
- Analytics had 21 widgets in `seq()`-rendering zonder oriëntatie-hulp. Met de TOC kun je direct naar de sectie die je nodig hebt — geen scroll-fatigue meer
- Discoverability +1: nieuwe gebruikers zien direct welke domeinen (proces/winst/setups/emotie) Analytics bevat

### Test
- Smoke groen + screenshot geverifieerd (TOC zichtbaar boven KPI cards, filtert correct op viewMode)

---

## [v12.160] — 2026-06-02

### Toegevoegd
- **`EmptyState` component** — canonieke "geen data"-weergave voor page-level lege schermen. Eén component, één layout, één type-spacing — alle eerdere ad-hoc varianten gebruikten subtiel andere fontsizes, padding en margins:
  - **Props**: `icon` (emoji), `title`, `body`, `action` (JSX), `hint` (kbd-shortcuts), `variant` (`page` default of `card`)
  - **Tokens**: `--text-lg` titel, `--text-sm` body, `--text-xs` hint, spacing via `--space-N`
  - Body max 40ch breed gecentreerd voor goede leesbaarheid
  - Icon 48px (page) / 32px (card) met opacity 0.3 — niet schreeuwerig

### Gewijzigd (UX-audit fase 3)
- **5 page-level empty-states gemigreerd** naar EmptyState component:
  - Dashboard "Nog geen trades" (📊 + kbd-hints)
  - Trades-overzicht "Geen trades gevonden" (📋)
  - Tendencies "Nog geen closed trades" (🎯)
  - Analytics "Nog geen closed trades" (📈)
  - Review "Geen trades voor review" (📋)
- Alle 5 hadden voorheen hand-gerolde markup met subtiele afwijkingen (16px vs 13px, 4rem vs 24px padding, marginBottom 8px vs none, etc.). Nu pixel-identiek over alle schermen.

### Niet aangeraakt
- Inline micro-emptiness in widget-cellen (calendar-cel "geen trades op deze dag", linked-trades counter, etc.) — die zijn micro-context en passen niet in een full-page component
- Print-rapport empty-state (regel 5071) — heeft eigen `tr-empty` class voor PDF-styling

### Test
- Smoke groen + 5 screenshots geverifieerd: alle empty-states zien er nu identiek uit qua hiërarchie, spacing en typografie

---

## [v12.159] — 2026-06-02

### Gewijzigd
- **TP-templates kaart-inhoud — TP1-5 onder elkaar, label bold, waarde regular** *(2026-06-02, gevraagd door Denny: "TPs wel onder elkaar, dik gedrukt TP1, niet dik gedrukt de waarde, goed gealigneerd")* — Per-template kaart toonde de 5 TP-verdelingen als horizontaal wrappende pills. Nu een verticale 2-koloms grid:
  - Linker kolom: `TP1` t/m `TP5` in monospaced bold (`fontWeight:700`, `color:var(--text2)`)
  - Rechter kolom: waardes (`100`, `50 / 50`, `34 / 33 / 33`, etc.) regular (`fontWeight:400`, `color:var(--text3)`)
  - Beide kolommen monospaced (`var(--mono)`) zodat alle waardes pixel-perfect onder elkaar uitlijnen
  - Lege verdeling (custom template zonder N-TP definitie) toont `—` in `var(--text5)`
  - Slash-separator nu met spaties (`50 / 50`) ipv (`50/50`) voor leesbaarheid

### Test
- Smoke groen — pure layout-wijziging, geen runtime-impact
- Visueel geverifieerd: alle waardes alignen exact, TP-labels duidelijk leesbaar

---

## [v12.158] — 2026-06-02

### Gewijzigd
- **TP-templates sectie krijgt card-wrapper + 3-kolommen grid** *(2026-06-02, gemeld door Denny: header stond los van content)* — De TP-templates sectie was de enige in Instellingen waarvan de header (titel + sub-text + Reset/+Nieuwe template knoppen) **buiten een card-container** stond, terwijl alle andere secties (VRIJWILLIGE DONATIE, BACKUP & RESTORE, DEFAULT-TEMPLATE PER AANTAL TPS) hun header **binnen** een card hebben. Visuele inconsistentie nu opgelost:
  - **Card-wrapper** rond hele TP-templates blok met `var(--glass)` background + `var(--border1)` border (zelfde patroon als VRIJWILLIGE DONATIE)
  - **📐 icon-prefix** in de header voor consistentie met `📣 VRIJWILLIGE DONATIE`
  - **3-kolommen grid** voor Equal / Front-loaded / Runner cards (`repeat(auto-fit, minmax(280px, 1fr))`) — direct visueel vergelijkbaar ipv onder elkaar
  - Per-template-card layout: titel + Edit/Delete knoppen op één rij boven, pills (1TP-5TP) gewikkeld eronder
  - Custom templates schalen mee in dezelfde grid (auto-fit zorgt voor extra rijen)
  - Responsief: viewport <860px stapelt automatisch (minmax 280px)
- **Token-uitrol**: Reset-knop = `.tj-btn-tertiary .tj-btn-sm`, +Nieuwe template = `.tj-btn-secondary .tj-btn-sm`. Alle font-sizes, padding, gaps en borderRadius via tokens. Sub-text van `--text4` naar `--text3` (leesbaarder).

### Test
- Smoke groen — geen runtime-impact (alleen JSX-structuur + CSS-tokens)
- Visueel geverifieerd via screenshot

---

## [v12.157] — 2026-06-02

### Fixed
- **TP-template "Front-loaded" 5TP-verdeling was inconsistent** *(2026-06-02, gemeld door Denny met screenshot)* — Was `[40, 25, 15, 10, 10]` (laatste twee gelijk → patroon breekt). Vergelijking met de andere Front-loaded varianten:
  - 2TP: `[70, 30]` (strict-aflopend −40)
  - 3TP: `[50, 30, 20]` (strict-aflopend −20/−10)
  - 4TP: `[40, 30, 20, 10]` (strict-aflopend −10 lineair)
  - 5TP: was `[40, 25, 15, 10, 10]` ✗
  - 5TP: nu `[30, 25, 20, 15, 10]` ✓ — strict-aflopend −5 lineair, perfecte spiegel van Runner 5TP `[10, 15, 20, 25, 30]`
- **DEFAULT_TP_DEFAULTS voor 5 TPs was `Equal`** — terwijl 3 TPs → Front-loaded en 4 TPs → Runner. Geen logische trend. Gefixt naar `Front-loaded` zodat de defaults een consistenter patroon volgen:
  - 1 TP: Equal (vanzelfsprekend, [100])
  - 2 TPs: Equal ([50, 50])
  - 3 TPs: Front-loaded ([50, 30, 20])
  - 4 TPs: Runner ([10, 20, 30, 40])
  - 5 TPs: was Equal → nu **Front-loaded** ([30, 25, 20, 15, 10])

### Migratie
- Bestaande users die de pre-built templates nooit hebben aangepast: **klik "↻ Reset to defaults"** in Instellingen → TP-templates om de gefixte verdeling op te halen.
- Users met custom-aanpassingen: huidige distributie blijft staan (upsert-by-id raakt alleen pre-built `frontloaded_default`).
- Users die hun `tj_ai_config.weekly.dayOfWeek` / TP-template-defaults expliciet hebben aangepast: hun keuze blijft persistent in `tj_tp_defaults`.

### Test
- Smoke groen — `MILESTONE_DEFS`, `PRE_BUILT_TP_TEMPLATES`, `DEFAULT_TP_DEFAULTS` zijn const-initialisaties zonder runtime-test-impact

---

## [v12.156] — 2026-06-02

### Toegevoegd / Gewijzigd
- **UX-audit fase 2: design-system fundering** *(2026-06-02, vervolg op v12.155)*. Spacing-tokens, borderRadius-tokens en button-tier-classes geïntroduceerd. Selectieve uitrol naar Dashboard Maand-doelen, Trade-form bottom-buttons en Instellingen sub-headers — mechanische mass-replace bewust vermeden om regressie-risico te vermijden.

#### Spacing-scale tokens (`--space-1` t/m `--space-6`)
4pt-grid, 6 niveaus. Vervangt de 10 historische gap-waarden en 13 padding-waarden:
```css
--space-1:4px;   --space-2:8px;   --space-3:12px;
--space-4:16px;  --space-5:24px;  --space-6:32px;
```

#### borderRadius-tokens (`--radius-sm/md/pill`)
Voegt 3 tokens toe naast de bestaande `--radius` (12px) en `--radius-lg` (16px). Reduceert de 13 historische `borderRadius`-varianten naar een 5-niveau systeem:
```css
--radius-sm:6px;     /* buttons, inputs, badges */
--radius-md:10px;    /* cards, modals */
--radius-pill:999px; /* status-badges, pills */
```

#### Button-tier-classes (`.tj-btn-primary/secondary/tertiary`)
Drie strikte tiers vervangen de 15+ ad-hoc button-bg-varianten:
- **Primary** (`.tj-btn .tj-btn-primary`) — `var(--gold)` solid, gold-border. Max 1 zichtbaar per scherm.
- **Secondary** (`.tj-btn .tj-btn-secondary`) — `var(--gold-dim)` background, gold border. Voor sub-acties.
- **Tertiary** (`.tj-btn .tj-btn-tertiary`) — transparant, neutral border. Voor cancel/dismiss.

Plus `.tj-btn-sm` modifier voor compacte variant in toolbars.

#### Selectieve token-uitrol
- **Dashboard Maand-doelen card**: padding/gap/font-sizes → tokens
- **Trade-form bottom-buttons**: `📸 Deel kaart` naar `.tj-btn-secondary`; `Annuleren` naar `.tj-btn-tertiary` met `color:var(--text4)` (visueel-lichter — audit issue #12 over button-hiërarchie)
- **Instellingen sub-headers**: `.settings-cat-label` van `11px` → `--text-xs`; `.settings-cat-banner h2` van `11px` → `--text-sm`; backup-sectie header van `11px` → `--text-sm` + body van `12px` + `text4` → `--text-base` + `text3` (leesbaarheid)
- Volledige mass-replace door alle 18000 regels bewust niet gedaan — risico vs benefit te ongunstig. Tokens zijn beschikbaar voor incrementele migratie en NIEUWE features.

### Niet veranderd
- Bestaande individuele indicators (`BackupAgeIndicator`, `AIBudgetIndicator`, etc.) blijven in code voor backwards-compat. Topbar gebruikt sinds v12.155 `AlertCenter`.
- onSave-knop in Trade-form behoudt zijn gradient-logic voor BT/Paper/Missed-states (special case, geen tier).
- Theme-tokens (`--text/text2-5`, `--bg/bg2-4`, `--border1-6`) onveranderd — die zaten al goed.

### Test
- Regressie: 18/18 smoke + backup-suite + foundation groen
- Geen nieuwe tests — alleen design-system tokens (geen runtime-impact bij correct gebruik)

### Volgende fase
- **v12.157** (~3u): Empty-state component (consolideren 9 ad-hoc varianten) + Analytics section-TOC

---

## [v12.155] — 2026-06-02

### Toegevoegd / Gewijzigd
- **UX-audit fase 1: 5 quick wins** *(2026-06-02, gebaseerd op UX-audit rapport `docs/ux-audit-2026-06-01.md`)* — Eerste van een 3-release-traject (v12.155–v12.157) om de app weer samenhangend te laten aanvoelen na de feature-explosie van Q1.

#### QW1 — Milestone-modal stop blokkeren bij grote import
Bij elke import (drag-drop of Backup-knop) markeren we nu alle reeds-behaalde milestones automatisch als seen. Een import van 1000 trades hoort niet de "10 trades!"-modal te tonen — die was duizend trades geleden voorbij. Nieuwe helper `markAchievedMilestonesAsSeen(trades)` evalueert na elke import welke `MILESTONE_DEFS` qua trade-count voldaan zijn en update `tj_milestones_seen` zonder modal te triggeren. **Fixt severity-4 issue uit de audit**: de modal die de demo-data screenshots blokkeerde.

#### QW2 — FilterBar default compact
`FilterBar` opent niet meer automatisch wanneer er actieve filters zijn. Default is nu `expanded: false`. De disclosure-knop "▾ Filters · N" laat user opklappen wanneer ze meer willen zien. Resultaat: van 7 rijen filter-overhead naar 2-3 rijen default. Search-input + result-summary blijven primair zichtbaar.

#### QW3 — Type-scale token-systeem
6 nieuwe CSS-tokens ipv 23 hardcoded font-sizes:

```css
--text-xs:11px;   --text-sm:12px;   --text-base:13px;
--text-lg:15px;   --text-xl:18px;   --text-2xl:24px;  --text-3xl:32px;
```

Toegepast op Dashboard KEY METRICS sidebar (was `10/11.5/13px` → `xs/sm/base`) en Analytics KPI-tegels (was `10/26px` → `xs/2xl`). Sub-stats zijn nu **leesbaar bij normale viewing-distance** (was hopeloos op 10px). Migratie van overige schermen volgt in v12.156.

#### QW4 — "+ Account toevoegen"-knop zichtbaar
Was `1px dashed transparent border` + `color: var(--text3)` — bijna onzichtbaar tussen exchange-pills. Nu: `gold-dim background` + `gold border` + duidelijkere label *"+ Handmatig account toevoegen"*.

#### QW5 — AlertCenter consolideert 3 topbar-indicators
Nieuwe `<AlertCenter>` component vervangt `<BackupAgeIndicator>` + `<AIWeeklyIndicator>` + `<AIBudgetIndicator>` in `tj-right-btns`. Eén 🔔-bubble met aantal-tag en dropdown bij klik. Severity-kleuren: rood (high — backup ≥7d / budget ≥100%), amber (med — backup 3-7d / budget ≥80% / weekly due), neutral (geen alerts).

**Topbar gaat van 6 elementen rechts naar 4**: `[+ Trade] [🔔 N] [👁] [☀]`. Schaalbaar voor toekomstige alerts (geen extra knoppen meer per indicator). De oude individuele indicators blijven beschikbaar in de codebase voor mogelijke andere gebruiks-contexten.

### Test
- **3 bestaande backup-tests bijgewerkt** naar AlertCenter-asserties (was `button[aria-label="Backup-leeftijd indicator"]`, nu `button[aria-label$="alerts"]`). De BackupAgeIndicator-component blijft bestaan voor niet-topbar gebruik.
- Regressie: 12/12 backup-suite + smoke groen.

### Volgende fasen (uit audit)
- **v12.156** (~4u): spacing-tokens + borderRadius-tokens + button-tier-consolidation + token-uitrol naar overige schermen
- **v12.157** (~3u): Empty-state component + Analytics section-TOC

---

## [v12.154] — 2026-06-01

### Toegevoegd
- **Backup-bewaker fase 2 — auto-backup naar folder** (File System Access API) *(2026-06-01)*. Bouwt voort op fase 1 (v12.153). Voor Chrome/Edge/Opera/Brave: stille auto-write naar een door-user gekozen folder. Geen modals, geen klikken — bestand belandt direct op disk bij app-open.
  - **🛡 Sub-sectie "Auto-backup naar folder"** in Instellingen → Backup & Restore. Vier UI-states:
    1. *Niet ondersteund* (Firefox/Safari) — vriendelijke uitleg + nudge naar fase 1
    2. *Niet actief* — knop `📁 Kies folder` opent native picker
    3. *Actief* — folder-naam + frequentie-selector (1/3/7/14/30d, default 7) + bewaar-selector (2/4/8/12 bestanden, default 4) + laatste-write info + `🧪 Test nu` + `🗑 Verwijder koppeling` + master-toggle
    4. *Permissie verlopen* — knop `🔓 Herstel permissie` (komt voor na browser-restart, ~1×/maand)
  - **Trigger-flow** in App `useEffect` bij app-open: skip wanneer unsupported / geen handle / niet enabled / interval niet due. Anders: verify permissie → schrijf `syncjournal-backup-YYYY-MM-DD.json` → roteer (behoud laatste N) → update `tj_autobackup_last_write_at` + `tj_last_backup_at` → toast met bestandsnaam.
  - **Stille roteer-logica** — oudere bestanden met patroon `syncjournal-backup-YYYY-MM-DD.json` worden alfabetisch (=chronologisch) gesorteerd; oudste worden gewist tot `keep`-aantal over is. Andere bestanden in de folder blijven onaangeroerd.
  - **Foutafhandeling** — `tj_autobackup_last_error` logged write-fouten; UI toont rode banner in de actieve-state met de message. Toast meldt "⚠ Auto-backup mislukt — check Instellingen → Backup" zodat user weet wat te doen.
  - **Memory + IDB persistence** — `FileSystemDirectoryHandle` wordt in IndexedDB store `tj_autobackup.handles` opgeslagen + in module-level memory cache voor snelle access binnen dezelfde sessie. Werkt na browser-restart (mits permissie weer "granted" wordt).

### Storage-keys (alle `tj_autobackup_*`)
| Key | Doel |
|---|---|
| `tj_autobackup_enabled` | "1" als feature aan |
| `tj_autobackup_folder_name` | folder-display-naam |
| `tj_autobackup_interval_days` | "1"/"3"/"7"/"14"/"30" |
| `tj_autobackup_rotate_keep` | "2"/"4"/"8"/"12" |
| `tj_autobackup_last_write_at` | Unix ms van laatste succesvolle write |
| `tj_autobackup_last_error` | laatste error-message (diagnostics) |

Plus IndexedDB: database `tj_autobackup` met store `handles` (key `directory` → FSA-handle).

### Browser-ondersteuning
| Browser | Ondersteund |
|---|---|
| Chrome 86+, Edge 86+, Opera 72+, Brave (Chromium) | ✓ volledig |
| Firefox, Safari | ✗ — graceful fallback op fase 1 reminder |

### Test
- **10 nieuwe Playwright-specs** (`tests/backup-autobackup.spec.js`) met FSA-mock:
  - UI-state per scenario (4) · pick folder triggert state-change · auto-write bij due (8d) · NIET bij interval niet due · NIET bij disabled · rotate keep=2 wist 3 oude (3+1→2) · permission "prompt" → toast + last-error · test-knop schrijft direct · verwijder-koppeling herstart state
- **Regressie**: 18/18 smoke + fase-1 + AI-coach foundation groen.
- Test-only hook `window.__abInjectedHandle` laat mocks de page-reload overleven (productie negeert 'm).

### Bonus
- Helpers (`abSaveHandle`/`abLoadHandle`) hebben memory-fallback voor wanneer een handle niet structured-clone-baar is (test-mocks) zonder productie-gedrag te raken.

---

## [v12.153] — 2026-06-01

### Toegevoegd
- **Backup-bewaker** — voorkomt onbedoeld data-verlies door browser-wissen *(2026-06-01, gevraagd door Denny na Discord-issue van NielsB die zijn Chrome-profiel leegmaakte met 2-weken-oude backup)*
  - **📦 Topbar-indicator** rechts in de topbar, altijd zichtbaar. Kleur op basis van laatste-backup-leeftijd:
    - Groen ✓ wanneer <3 dagen
    - Amber Xd wanneer 3-7 dagen
    - Rood + pulse Xd wanneer ≥7 dagen
    - Rood + pulse ! wanneer nooit een backup
    - **Klik = directe export** (geen tussenstap)
  - **Reminder-modal** verschijnt bij app-open wanneer ≥7 dagen sinds laatste backup + ≥5 trades. Vriendelijk maar duidelijk: *"Tijd voor je wekelijkse backup"* + waarom-uitleg (data staat in browser, kan weg bij profiel-wissen).
    - **⬇ Download backup nu** — directe export, 1 klik
    - **Herinner morgen** — 24u snooze (gebruikt `tj_backup_reminder_snoozed_at`)
    - **Nooit meer tonen** — `tj_backup_reminder_off=1`, terug-aan-zetten kan via Instellingen
  - **Onboarding-modal** eenmalig na 5 trades wanneer er nog NOOIT een backup is gemaakt. Educatief, geen download-prompt — leert nieuwe users dat data lokaal staat en hoe ze 'm veilig houden. State opgeslagen in `tj_backup_onboarding_shown`.
  - **Soft recovery** — confirmation-dialog bij destructive import: wanneer huidige journal ≥10 trades heeft EN nieuwe payload <50% van huidige → vraagt expliciete bevestiging *"Je gaat huidige X trades vervangen door Y trades. Weet je het zeker?"*. Voorkomt het *"ik importeerde per ongeluk een oude/verkeerde backup"*-scenario. Werkt in zowel drag-drop als de Backup-knop in Instellingen.
  - **Import herstelt timestamp** — bij import wordt `tj_last_backup_at` gezet uit `payload.exportDate` zodat de reminder niet direct na import triggert (anders had je net een verse import en kreeg je toch een "doe een backup"-reminder).
  - **Instellingen-stat + toggle** in Instellingen → Backup & Restore: toont *"Laatste backup: X dagen geleden"* in kleurcode + checkbox om de reminder aan/uit te zetten (handig om "Nooit meer" terug te zetten).

### Storage-keys
| Key | Doel |
|---|---|
| `tj_last_backup_at` | Unix ms van laatste export/import |
| `tj_backup_reminder_snoozed_at` | Unix ms van "Herinner morgen" |
| `tj_backup_reminder_off` | "1" wanneer "Nooit meer" gekozen |
| `tj_backup_onboarding_shown` | "1" na eerste-keer educatieve modal |

### Test
- **12 nieuwe Playwright-specs** (`tests/backup-bewaker.spec.js`): indicator-kleur per leeftijd · indicator label "8d" · indicator "!" bij nooit · reminder triggert bij ≥7d · reminder NIET bij <7d · reminder NIET bij off=1 · snooze + state · reminder NIET binnen 24u snooze · download triggert export + timestamp · onboarding eenmalig · onboarding NIET na shown · soft recovery confirm bij destructive import.
- Regressie: 6/6 smoke + AI-coach foundation groen.

### Volgende fasen
- **v12.154 Fase 2** — File System Access API voor stille auto-write naar door-user-gekozen folder (Chrome/Edge), fallback voor Firefox/Safari.
- **v12.155+ Fase 3** — Cloud-opties (GitHub Gist auto-push / S3 BYOK / WebDAV) op community-vraag.

---

## [v12.152] — 2026-05-21

### Fixed
- **Backup-knop importeerde geen playbooks** *(2026-05-21, gemeld door Denny bij demo-data import)* — De "↑ Backup importeren"-knop (Instellingen → Backup & Restore) herstelde wel trades, tags, accounts, config en TP-templates, maar **niet de playbooks**. Drag & drop van een JSON-bestand deed dat wél — een inconsistentie tussen de twee import-paden. Een backup-restore hoort álles te herstellen.
  - **Oorzaak**: `handleBackup` in AccountsHub had geen `setPlaybooks` (werd niet als prop doorgegeven) en miste de playbooks-import-regel die `handleDrop` wel had.
  - **Fix**: `playbooks` + `setPlaybooks` doorgegeven aan AccountsHub; `handleBackup` herstelt nu `d.playbooks` via `migratePlaybooks()`, identiek aan het drag-drop pad.
  - Geverifieerd met een nieuwe test die de **echte file-upload flow** doorloopt (niet localStorage-seed): `tests/demo-backup-import.spec.js` uploadt een 6-playbook backup via de Backup-knop en bevestigt dat alle 6 playbooks + tags + accounts laden.

---

## [v12.151] — 2026-05-18

### Gewijzigd
- **Mori is publiek beschikbaar — `?ai=1` flag-gating verwijderd** *(2026-05-18)* — Tot v12.150 was Mori verborgen achter een feature-flag `?ai=1` in de URL voor staged rollout. Nu de feature compleet is + documentatie staat, hoeft die flag niet meer:
  - **🤖 AI-coach tab** staat nu standaard in de topbar voor alle gebruikers
  - **💬 Floating chat-knop** verschijnt zodra master + features.floatingChat aan
  - **Opt-in blijft via master-toggle + BYOK API-key** — Mori doet niets totdat user dat expliciet aanzet
  - **`?ai=0` als opt-out** — voor screenshots, demo's of als de community-user echt niets van Mori wil zien
- **`IS_AI` constante** is nu default `true` (was: false zonder URL-flag). Backwards-compatible — alle bestaande checks in code blijven werken (evalueren altijd waar tenzij `?ai=0`).
- **Handleiding L23 + FAQ-entry "Hoe activeer ik Mori?"** geupdate — geen `?ai=1` meer noemen. Setup is nu: klik tab → vul API-key in → master aan.
- **Foundation + popup tests** geupdate naar nieuwe semantiek: was *"tab verborgen zonder ?ai=1"*, is nu *"tab standaard zichtbaar"* + nieuwe *"tab verborgen wanneer ?ai=0"* spec voor opt-out coverage.

**Volledige test-suite**: 12/12 foundation + popup + smoke groen na switch.

---

## [v12.150] — 2026-05-18

### Toegevoegd
- **Mori: handleiding + FAQ-sectie** *(2026-05-18, gevraagd door Denny)* — Documentatie zodat community-users zelf aan de slag kunnen met Mori zonder hulp uit Discord.
  - **Nieuwe lesson `L23`** in Help → Handleiding: *"Mori — je AI-coach (BETA)"* (advanced, 14 min). Bevat: TL;DR · Setup in 3 stappen (feature-flag + BYOK + master-toggle) · alle 5 sub-features uitgelegd (pre-trade / weekly / chat / budget / privacy) · Wat Mori NIET kan (live data, charts, tools, garanties) · 5 sterke voorbeeld-vragen · Wanneer ChatGPT/Claude direct beter is · Beta-disclaimer. Met "Open AI-coach →" jump-link.
  - **Nieuwe FAQ-categorie `🤖 Mori (AI-coach)`** met 8 entries:
    1. *"Wat is Mori?"* — wie/wat/welke 4 features
    2. *"Hoe activeer ik Mori?"* — 3-stap: ?ai=1 + tab + BYOK
    3. *"Wat kost Mori me?"* — BYOK uitleg + model-vergelijking (Sonnet/Opus/Haiku) + hard-cap
    4. *"Waar haal ik een Anthropic API-key?"* — console.anthropic.com stap-voor-stap + security-tip
    5. *"Is mijn data veilig met Mori?"* — 3 privacy-lagen + Anthropic policy + verifiëren via 📜 Laatste prompt
    6. *"Waarom Mori en niet gewoon ChatGPT?"* — context-injectie + workflow-integratie + wanneer ChatGPT wel beter is
    7. *"Mori antwoordt vreemd — wat nu?"* — 5-punt troubleshoot-checklist (playbookId, setupTags, R-multiple, privacy-filter, model)
    8. *"Floating chat-knop verwijderen?"* — toggle uit + sidebar-tip (☰)

### Status: Mori v1 documentatie compleet
- Code: v12.135-149 (15 releases)
- Tests: 27+ Playwright-specs
- Docs: 1 lesson (L23) + 8 FAQ-entries + dit changelog

---

## [v12.149] — 2026-05-18

### Toegevoegd
- **Privacy-sectie volwaardig** *(2026-05-18, gevraagd door Denny na uitleg over privacy-filter)* — Vervangt de oude placeholder met een complete transparantie + control panel. AI-coach laatste placeholder is nu live.
  - **Status-blok** met groene/amber visual + telling: "Ticker-mask actief · 46 standaard tickers + N custom · amount-mode: ..."
  - **Bedrag-masking** — nieuwe `cfg.privacy.amountMode` met 3 keuzes via segment-buttons:
    - `off` (default): bedragen onveranderd naar Claude
    - `labels`: `$340` → `$X1`, `$-180` → `$X2` (per-call mapping, reverse-bar zodat AI-output weer echte bedragen toont)
    - `buckets`: `$340` → `$middel`, `$-180` → `-$klein` (≤50 = klein, 50–500 = middel, 500–5k = groot, >5k = zeer-groot — irreversibel, sterkste anonimisering)
    - **Scope-keuze**: amount-mask werkt alleen in **chat-flows** (ChatSection + popup). Pretrade/weekly behouden bedragen omdat ze analytisch relevant zijn voor coaching. Documentatie-tip in UI.
  - **Custom tickers** — nieuwe `cfg.privacy.customTickers[]`. Toevoegen via inputveld + Enter/knop, verwijderen via tag-chip. Validatie: 2–10 letters/cijfers, niet dubbel, niet in standaard-46. Werkt direct in alle outgoing mask-calls (chat + pretrade + weekly).
  - **🔍 Live preview "Wat ziet Claude?"** — textarea waar je test-tekst typt, daaronder real-time output zoals die naar Anthropic gaat. Telt aantal gemaskeerde tickers + toont actieve amount-mode. Demonstreert masking transparant zonder dat je een API-call hoeft te doen.
  - **WEL/NIET-gedeeld lijst** — 2-kolommen overview:
    - ✓ Wel: setup-tags, playbook-namen, trade-stats, gemaskeerde tickers, bedragen (afhankelijk van mode)
    - ✗ Niet: API-keys, account-saldi, custom account-namen, screenshots, tradingrules + goals
  - **📜 Laatste prompt logger** — `cfg.privacy.logLastPrompt` (default aan) bewaart de meest recente outgoing `system` + `messages` in `tj_ai_last_prompt` localStorage. "Bekijk"-knop toont volledige payload (model, system prompt, alle messages met user/assistant labels). Verifieerbare transparantie — je ziet exact wat Mori naar Claude stuurt. "Wis"-knop verwijdert log.
- **Integratie van amount-masking in chat-flows** — Zowel `ChatSection.sendMessage` als `AIChatPopup.sendMessage` passen nu ticker-mask + amount-mask toe op messages/playbooks/trades/weeklies vóór payload, met reverse-mask op response (labels-mode only — buckets is irreversibel).
- **`logLastPrompt(payload)` in `callClaude` + `callClaudeChat`** — Elke outgoing API-call wordt geregistreerd in localStorage zodat de Privacy-sectie "wat is verstuurd" kan tonen. Alleen wanneer toggle aan.
- **6-spec Playwright suite** (`tests/aicoach-privacy.spec.js`): sectie rendert + status-blok · live preview toont COIN_-mask · labels-mode `$X1` · buckets-mode `$middel` · custom ticker toevoegen → masking actief · last-prompt log opgeslagen na chat-send.

### Gewijzigd
- `DEFAULT_AI_CONFIG.privacy` toegevoegd: `{amountMode:"off", customTickers:[], logLastPrompt:true}` — backwards-compatible (oude configs krijgen defaults via spread in `loadAIConfig`).
- Ticker-list verplaatst van regex-constant naar `TICKER_HARDCODED` array + nieuwe `getTickerList()` helper die custom tickers mergt bij elke mask-build.

### AI-coach feature-tracker — alle subsecties live ✓
| Sectie | Versie | Status |
|---|---|---|
| Foundation | v12.135 | ✓ |
| Pre-trade validatie | v12.136 | ✓ |
| Budget & kosten | v12.137 | ✓ |
| Weekly digest | v12.138 | ✓ |
| Chat (tab + popup) | v12.139–148 | ✓ |
| **Privacy** | **v12.149** | **✓** |
| Naam: Mori | v12.147 | ✓ |

**Volledige test-suite na deze release**: 26+ specs (smoke + foundation + pretrade + budget + weekly + chat × 5 + popup × 2 + privacy).

---

## [v12.148] — 2026-05-18

### Toegevoegd
- **Mori-popup krijgt collapsible chat-history sidebar (links)** *(2026-05-18, gevraagd door Denny: "ik wil de geschiedenis gesprekken zichtbaar hebben of uitklapbaar aan de rechter of linkerkant")* — Vervangt de oude dropdown-switcher door een volwaardige sidebar zoals in de AI-coach tab. WhatsApp/email-style: alle conversaties zichtbaar naast de actieve chat, één klik om te wisselen.
  - **☰ toggle** links in header — toont/verbergt sidebar. Gold-highlight wanneer aan.
  - **Popup-breedte responsief**: 560px wanneer sidebar aan, 420px wanneer uit. Smooth transition (0.18s).
  - **Sidebar 140px breed** met chat-items: titel + bericht-count + datum + delete-knop (✕). Active chat krijgt gold-dim background + gold border (zelfde `.ai-chat-item` class als tab-sidebar — visueel consistent).
  - **Toggle-state persistent** in `tj_ai_popup_history` localStorage. Eerst-keer-open = sidebar aan (zodat user ziet wat er is); daarna respect je laatste keuze.
  - **Empty-state in sidebar**: "Geen conversaties. Klik + om te starten."
- **Header header opgeschoond** — dropdown-switcher verwijderd (overbodig met sidebar). Chat-titel staat nu inline naast MORI-tag zonder klikbaar te zijn. + nieuwe chat en ✕ sluit blijven rechts.
- **5-spec Playwright suite** (`tests/aicoach-popup-sidebar.spec.js`): sidebar default zichtbaar bij open · ☰ toggle verbergt + width shrinkt naar 420px + localStorage persist · klik chat-item switcht active · delete-knop verwijdert · toggle-state persist over re-open.

### Notities
- `min(560px, calc(100vw - 48px))` zorgt dat de popup ook op smalle viewports (mobile-portret) past door clamping.
- De popup-sidebar dupliceert geen logica met ChatSection-sidebar — beide renderen alleen UI uit dezelfde `chats` state. Bron-van-waarheid = `tj_ai_chats` localStorage met `upsertChat` / `deleteChatById` helpers.

---

## [v12.147] — 2026-05-18

### Gewijzigd
- **De AI-coach heeft een naam: Mori** *(2026-05-18, naam gekozen door Denny uit 4 opties)* — Afgeleid van Morani, warm en persoonlijk, voelt als een trading-buddy ipv een tool. De feature/tab heet nog steeds "AI-coach" (categorische naam in topbar) maar in alle user-facing chat-copy is het nu Mori:
  - **Message-bubble label**: was "AI-COACH", nu "Mori" (in zowel ChatSection als floating popup)
  - **Section-titel** in AI-coach tab: "💬 Chat met je coach" → "💬 Chat met Mori"
  - **Intro-paragraph**: "Stel vragen aan **Mori** over je trading. Hij heeft context van je playbooks..."
  - **Empty-states**:
    - "Stel je eerste vraag." → "Stel je eerste vraag aan Mori."
    - "Klik + voor een chat met Mori." (popup)
    - "Mori heeft een API-key nodig. Vul 'm in onder AI-coach → API-key (BYOK)." (no-key state)
  - **Popup header**: bevat nu een **MORI**-tag (gold) als brand-prefix vóór de chat-titel (bv. "**MORI** · chat over backtests")
  - **FAB tooltip**: "Open Mori (AI-coach)" / "Sluit Mori"
  - **System prompt** introduceert AI als Mori: *"Je bent **Mori**, de persoonlijke trading-coach in deze Morani Trading Journal."* + *"Wanneer je jezelf moet introduceren of refereren: je heet Mori."*
  - **Beta-badge** in sidebar: "**MORI · BETA · v12.147** — Je AI-coach. Alle features live. Geef feedback in Discord."

### Test
- 15/15 chat + popup + smoke groen na rename — geen test-selectors gebroken (alle tests matchen op tab-label "AI-coach" wat onveranderd is, niet op message-labels).

---

## [v12.146] — 2026-05-18

### Toegevoegd
- **Floating AI-chat popup (FAB rechtsonder, overal in app)** *(2026-05-18, gevraagd door Denny: "is het ook mogelijk om een interactieve chat te openen via een knopje dat je een soort pop krijgt?")* — Vanaf elke pagina (Dashboard / Trades / Analytics / Playbook / etc.) is er nu een 💬 floating action button (FAB) rechtsonder die een compacte chat-popup opent. Verschijnt alleen wanneer **`?ai=1`** + master enabled + nieuwe toggle **`features.floatingChat`** aan.
  - **FAB**: 54px ronde knop, fixed rechtsonder, gold-dim achtergrond → gold solid wanneer popup open (toont ✕ ipv 💬)
  - **Popup**: 420×580px (clamped op `min(580px, calc(100vh - 120px))`), gold border, donker bg, drop-shadow. Boven de FAB gepositioneerd.
  - **Header**: chat-titel als dropdown (klik → toont alle conversaties met active-highlight + bericht-count) · `+` knop voor nieuwe chat · `✕` sluit
  - **Body**: zelfde markdown-rendering als AI-coach tab chat-sectie (headers, bold, lists, blockquotes, code, code-fences via `renderChatMarkdown`)
  - **Input**: compacte textarea (rows=2) + ↑ verstuur. Enter = send, Shift+Enter = newline.
  - **Empty-state**: geen API-key → vriendelijke melding "Vul je Anthropic key in onder AI-coach → API-key (BYOK)"
  - **Geen API-key** = popup wel zichtbaar (knop werkt) maar body toont enkel de empty-state, geen input.
- **Storage gedeeld** met `ChatSection`: zelfde `tj_ai_chats` localStorage + dezelfde `callClaudeChat` + `buildChatSystemPrompt` + `recordAICost` + privacy-filter. Een chat starten via popup, dan voortzetten in AI-coach tab → werkt naadloos (refresh van data bij open). Eén chat-conversatie tegelijk getoond per locatie.
- **Per-feature toggle** in AI-coach → Algemeen sectie: "Floating chat-knop" met beschrijving *"Toont een 💬-knop rechtsonder op elke pagina voor snelle chat-toegang."* Default aan (bij eerste keer activeren AI-coach).
- **6-spec Playwright suite** (`tests/aicoach-popup.spec.js`): FAB zichtbaar op Dashboard wanneer feature aan · verborgen wanneer feature uit · verborgen wanneer master uit · verborgen zonder `?ai=1` · klik FAB → popup opent + send-message + cost-tracking write + sluit-knop werkt · FAB **beschikbaar op Trades-tab** (verifieert dat popup overal werkt, niet alleen AI-coach tab).

### Notities
- Popup gebruikt `position:fixed` met `z-index:997` (FAB op 998), zodat het altijd boven content blijft maar onder modals/welkom-overlay (zIndex 9998+) — geen UX-conflict.
- Geen drag/resize voor v1 (vaste positie rechtsonder, vaste afmetingen) — als de community dat wil, kan in latere release.
- ChatSection in AI-coach tab blijft de volledige experience (sidebar met alle conversaties, grote chat-pane). Popup is de quick-access variant.

**Volledige test-suite na deze release**: 19 specs / 19 passed (chat + popup + smoke).

---

## [v12.145] — 2026-05-18

### Fixed
- **Chat-input verdween bij lange responses + geen scroll mogelijk** *(2026-05-18, gemeld door Denny met screenshot: lege ruimte onder de assistant-bubble, geen input zichtbaar)* — Hieronder lag de ECHTE root-cause van "bug 1" uit v12.143/144: een klassieke **flex+overflow CSS-valkuil**. Mijn chat-shell had `height:540px` met inner flex column (scroll-div + input-area), maar zonder `minHeight:0` op flex-children kan een lange child de container uitduwen — de scroll-div werkt dan niet (`overflow:auto` activeert niet) en de input-area wordt door de assistant-bubble onder de container weggeschoven. Bij Denny's 800-token markdown-response was de bubble ~700px hoog, dus de input zat ~150px onder de "chat-shell" en daardoor onzichtbaar (overflow:hidden clipt 'm). De fixes uit v12.143/144 (state-sync + event-listener verwijderen) waren technisch wel correct, maar de **visuele symptoom** kwam van deze layout-bug.
- **Concrete CSS-fixes**:
  - `minHeight:0` op `<aside>` + sidebar scroll-div (anders pushen lange chat-lijsten de sidebar weg)
  - `minHeight:0` op `<main>` (zodat de grid-cel van 540px gerespecteerd wordt)
  - `minHeight:0` + `overflowX:hidden` op de scroll-div (zodat `overflow:auto` activeert binnen flex-context)
  - `flexShrink:0` op input-area (input blijft altijd zichtbaar, niet wegduwbaar door content)
  - `flexShrink:0` op sidebar "+ Nieuwe chat" header (zelfde principe)
  - `wordBreak:break-word` + `overflowWrap:break-word` op bubbles (lange tokens/URLs wrappen ipv horizontale overflow)

### Test
- Nieuwe `tests/aicoach-chat-layout.spec.js`: stuurt een 30-secties markdown-response (~800 tokens, ~700px hoog), verifieert dan:
  1. Chat-shell respecteert nog steeds height 540px
  2. Textarea zichtbaar in viewport (width>100px, height>20px)
  3. Verstuur-knop zichtbaar
  4. Scroll-div heeft `scrollHeight > clientHeight` (er VALT te scrollen) en `clientHeight < 540` (input neemt z'n share)

**Volledige chat test-suite na deze release**: 13 specs / 13 passed (2msg + context×3 + layout + markdown×2 + switch + chat×4 + smoke).

---

## [v12.144] — 2026-05-18

### Fixed
- **Chat-input bleef na 1 antwoord onbruikbaar — v12.143 fix was incompleet** *(2026-05-18, gemeld door Denny: "Ik kan na 1 antwoord niks meer met de chat. niet opnieuw typen of scrollen.")* — Root-cause: ik had in v12.143 directe `setChats(arr)` toegevoegd in mutaties, MAAR de oude event-listener `tj-ai-chats-change` bleef óók luisteren en deed alsnog een tweede `setChats(loadChats())` na de `saveChats` dispatch. De async event-handler-render kwam soms ná `setLoading(false)` met een stale snapshot binnen → input bleef effectief disabled tot een unrelated page-interaction. **Fix**: event-listener verwijderd uit ChatSection. We doen sinds v12.143 al direct setChats overal — cross-tab sync gebeurt nog via browser Storage-event als nodig. **Nieuwe Playwright-test** (`tests/aicoach-chat-2msg.spec.js`) reproduceert exact het bug-scenario: 2 messages sequentieel sturen → input enabled blijft + scroll-pane onderaan staat na 2e response. Test was vóór deze fix rood, nu groen.
- **AI vergeleek avgR (1.94) met playbook.minRR (3.0) en concludeerde "onder minimum, niet winstgevend"** *(2026-05-18, gemeld door Denny: "1.7R en hij zegt onder 1R. hoe berekent hij dit?")* — De aggregator gaf alleen `avgR` mee als R-metric. AI vergeleek dat direct met playbook.minRR (een entry-criterium) en concludeerde dat de playbook tekortschoot. Maar:
  - `avgR` is het gemiddelde over **alle** trades (winners + losers); losers @ -1R trekken het omlaag
  - `playbook.minRR` is een ENTRY-criterium (welke setups je vóór entry mag nemen), niet een target voor avgR achteraf
  - Met multi-TP partial closes worden veel trades vroeg gesloten op 0.5–1.5R bij TP1 — dat is by design, niet "tekortschieten"
  - Edge-metric is **expectancy** = WR × avgWinR − (1−WR) × avgLossR. Positief expectancy = winstgevende playbook
- **Fix**: per-playbook breakdown rapporteert nu `WR · avgR · avgWinR · avgLossR · expectancy`. Plus een nieuwe sectie in system prompt **"Hoe je de R-metrics juist leest (KRITIEK — voorkomt foute conclusies)"** met expliciete uitleg + voorbeeld + expliciete instructie *"NIET zeggen 'avgR 1.9 ligt onder minRR 3.0 dus playbook tekortschiet'. Wel zeggen 'expectancy +0.8R per trade = winstgevend, gegeven 75% WR + 2.9R avgWin'."*

**Test-suite**: 28 + 2 nieuwe (chat-2msg + interne updates) = 30 specs / 30 passed.

---

## [v12.143] — 2026-05-18

### Fixed
- **AI-coach chat hing in loading-state — assistant-message kwam binnen maar UI bleef "1 berichten" tonen** *(2026-05-18, gemeld door Denny met screenshot: chat-pane leeg met loading-dots na response)* — Race-conditie tussen async event-listener `tj-ai-chats-change` en `setLoading(false)`. State-update via event arriveerde soms ná de re-render → chat-storage had assistant-msg wel, maar React-state nog niet. UI bleef hangen op user-msg + dots, input box disabled. **Fix**: `sendMessage` + `newChat` + `deleteChat` doen nu **direct `setChats(arr)`** met de return-value van `upsertChat`/`deleteChatById` ipv te wachten op event. Plus force-scroll na assistant-render (`setTimeout 80ms` zodat de pane naar bottom scrollt en niet half-leeg lijkt).
- **Chat-messages waren onleesbaar — markdown werd raw getoond** *(2026-05-18, gemeld door Denny: "De opmaak van de tekst is slecht te lezen")* — Claude antwoordt vaak in markdown (`# headers`, `**bold**`, `> quotes`, `` `code` ``, lists). De chat-pane toonde alleen `whiteSpace: pre-wrap` waardoor `## Wat de data zegt` en `**winstgevend**` als raw tekst met sterretjes verschenen. **Fix**: nieuwe lichte markdown-renderer **`renderChatMarkdown(text)`** die ondersteunt: `# / ## / ### / ####` headers (4 sizes), `**bold**`, `*italic*`, `` `code` ``, code-fences (```` ```...``` ````), `> blockquote` (gouden border-left), ordered/unordered lists (`- * • / 1.`), horizontale lijnen (`---`), paragraph-breaks. Wordt alleen op assistant-messages toegepast via `dangerouslySetInnerHTML`. **User-messages blijven raw** (security: alleen gegenereerde content trusten we, niet user-input).
- **AI kreeg te weinig trade-detail om patronen te zien** *(2026-05-18, gemeld door Denny: "data wordt niet goed opgehaald", AI vroeg om "tijd van dag, sessie, trend vs range")* — De `Recente trades`-sectie in system prompt had alleen 15 trades met basis-info (datum, sym, pnl, R, pb, grade). Geen tijd, geen sessie, geen notes → AI kon niet vragen als "welke setups op London-open vs NY werkten beter?" beantwoorden zonder extra info aan user te vragen. **Fix**: sample verhoogd naar **25 trades** + per trade extra: `entryTime`, **sessie-bucket** (Asia / London / London-NY / NY, op basis van uur), eerste 60 chars van `notes`. AI kan nu direct patroon-analyses doen zonder verduidelijking.

### Test
- Nieuwe `tests/aicoach-chat-markdown.spec.js` (2 specs): verifieert dat assistant-message markdown rendert naar `<strong>`/`<blockquote>`/`<ul>`/`<code>`/`<pre>` etc. én dat user-message raw blijft (geen XSS-vector via markdown in user-input).
- Bestaande chat tests blijven groen (4 + switch + context = 6) na directe state-sync wijziging.

**Volledige test-suite na deze release**: 28 specs / 28 passed / 0 failed (smoke + foundation + pretrade + budget + weekly + chat × 5).

---

## [v12.142] — 2026-05-18

### Fixed
- **AI-coach gaf "WR 7.1% niet winstgevend" terwijl playbook winstgevend is** *(2026-05-18, gemeld door Denny met screenshot, root-cause:	backtest-trades hebben `t.pnl=""` maar wél `rMultiple` of TPs)* — De aggregator gebruikte direct `Number(t.pnl) || 0`. Backtests die alleen TPs/hindsightExit ingevuld hadden (zonder positionSize / pnl) werden geteld als pnl=0 → noch win noch loss → WR=0% terwijl het 75% had moeten zijn.
  - **Fix**: `aggregatePlaybookStats` gebruikt nu de bestaande `netPnl(t)` helper (die voor backtests `calcTheoreticalPnl()` aanroept). Win/loss-bepaling werkt nu primair op **`rMultiple`** (preferred voor backtests), fallback naar `calcTheoreticalR()` voor missed-trades zonder R, dan pas `pnl`. Eindelijk klopt de WR voor playbooks met theoretische backtests.
  - **Recent-trades sample** doet dezelfde correctie + toont R-multiple ook als die uit `calcTheoreticalR` komt (was alleen `t.rMultiple` voorheen).
- **AI mixede data-interpretatie** — Naast bovenstaande bug zat de model óók geen context te hebben over **hoe** de data is opgebouwd. Nieuwe sectie in system prompt: **"Hoe de data is opgebouwd (lees dit eerst!)"** met expliciete uitleg over trade-types ([BT]/[PAPER]/[MISSED]/real), dat WR + avg-R primair uit `rMultiple` komen, dat "PnL$0" op backtests klopt wanneer positionSize leeg is, en dat een playbook met "backtest: 20t WR 65% R 1.5" winstgevend is ondanks $0 PnL.
- **Chat sidebar: active state was te subtiel om makkelijk te switchen** — Nieuwe CSS-class `.ai-chat-item` + `.active` voor duidelijkere visual feedback: hover-state (lichter bg), active-state krijgt nu een **3px gouden border-left** + verlaagde padding zodat het ge-highlighte item visueel "ingedrukt" oogt. Switchen tussen chats voelt nu meer responsief, ook al was de onderliggende logica al correct (geverifieerd in `tests/aicoach-chat-switch.spec.js`).

### Test
- Nieuwe scenario in `tests/aicoach-chat-context.spec.js`: 20 backtest-trades met `pnl=""` maar `rMultiple` (15 winners @ 1.8R + 5 losers @ -1.0R) — verifieert dat system prompt nu `backtest: 20t WR 75%` toont en dat de data-format-uitleg-sectie aanwezig is.
- Nieuwe `tests/aicoach-chat-switch.spec.js` — confirmeert dat chat-switching technisch werkt (zodat we de visuele upgrade niet als logica-bug aanzien).

---

## [v12.141] — 2026-05-18

### Fixed
- **AI-coach chat zag nog steeds geen trade-data, ondanks v12.140 fix** *(2026-05-18, gemeld door Denny met screenshot: "38 live trades deze week, geen enkele getagd met playbook-naam")* — Root-cause: in dit project zijn trades gekoppeld aan playbooks via **`t.playbookId`** (foreign-key naar `playbook.id`), niet via `t.playbook`. Mijn v12.140 `aggregatePlaybookStats` skipte alle trades omdat `t.playbook` overal leeg was. Twee gevolgschades:
  1. Per-playbook breakdown was **leeg** in system prompt (geen enkele playbook getoond)
  2. Recent-trades sample toonde `pb=-` voor alles
- **Fix v12.141**:
  - **`aggregatePlaybookStats`** gebruikt nu `t.playbookId` als groep-key en mapt naar playbook-naam via `playbooks.find(p=>p.id===playbookId).name` lookup
  - **Untagged trades** (geen `playbookId`) komen nu in een `(geen playbook gekoppeld)` bucket — AI ziet dat ze bestaan en kan adviseren om te taggen, ipv ze stilletjes te negeren
  - **Recent-trades sample** doet pb-naam-lookup en toont nu óók `setupTags` per trade (bv. `setups=MSB,BOS`), zodat AI kan inferreren welk setup-pattern bij welke playbook hoort, zelfs zonder expliciete `playbookId`
- **Nieuwe test** (`tests/aicoach-chat-context.spec.js`): nieuw scenario verifieert dat 10 untagged trades (5 real + 4 backtest split via `i%3===0`) correct in `(geen playbook gekoppeld)`-bucket verschijnen met juiste counts. Bestaande test bijgewerkt: fake-trades hebben nu `playbookId` ipv `playbook`.

  **Probeer dezelfde vraag opnieuw in chat** — als jouw trades wél `playbookId` gekoppeld hebben, krijg je nu de echte breakdown. Als ze geen `playbookId` hebben, krijgt AI tenminste de untagged-info + setupTags zodat hij niet zegt "geen data".

---

## [v12.140] — 2026-05-18

### Gewijzigd
- **AI-coach chat krijgt veel rijkere trader-context** *(2026-05-18, gemeld door Denny: "deze vraag zou hij moeten kunnen ophalen uit de data die in de journal zit toch?")* — De v12.139 chat-system-prompt gaf alleen 7-dag aggregated stats + top-5 playbook-namen. Bij vragen als *"wat vind je van mijn 1h MSB BOS backtest trades?"* antwoordde de AI dat hij geen data had ontvangen. **Fix**: system-prompt is nu drastisch uitgebreid met:
  - **Per-playbook breakdown** voor álle playbooks (gesorteerd op trade-count), gesplitst per type: `real: 12t WR 58% PnL $340 R 1.2 · backtest: 8t WR 75% R 1.8 · paper: 3t · missed-real: 2t`. AI kan nu direct vergelijken: real-vs-backtest-discrepancy, welk playbook de meeste edge heeft, of er paper-experimenten lopen.
  - **Top-15 recente trades** met datum + type-tag (`[BT]` / `[PAPER]` / `[MISSED]` / leeg=real) + sym + dir + PnL + R + playbook + grade. AI ziet de daadwerkelijke trades, niet alleen geaggregeerde cijfers.
  - **Expliciete instructie** in system prompt: "BELANGRIJK: gebruik de Trader-data hieronder als bron van waarheid. Vraag GEEN trades opnieuw als ze er al staan." Voorkomt de "ik heb geen data ontvangen"-respons wanneer de data wél in de payload zit.
  - Geüpdatete labels: secties heten nu *"Trader-data: laatste 7 dagen"* en *"Trader-data: per playbook (alle trades, niet alleen 7 dagen)"* zodat AI begrijpt dat het z'n bron-van-waarheid is.
- **Nieuwe helper `categorizeTradeType(t)`** mapt trade naar `"real"|"backtest"|"paper"|"missed"` op basis van `status` + `simType`. Hergebruikbaar voor toekomstige features.
- **Nieuwe helper `aggregatePlaybookStats(trades, playbooks)`** bouwt per-playbook breakdown met type-split. Geeft array gesorteerd op total count.
- **Test**: nieuwe `tests/aicoach-chat-context.spec.js` valideert dat een chat-call over backtests van een specifieke playbook de juiste counts (4 backtest · 2 real · 1 paper) en `[BT]`/`[PAPER]`-tags in de system prompt heeft.

---

## [v12.139] — 2026-05-18

### Toegevoegd
- **Multi-turn chat live (AI-coach, BETA — `?ai=1`)** *(2026-05-18)* — Sluitsteen van de AI-coach feature: een volwaardige chat-interface met behoud van conversation-history. Nieuwe sectie **💬 Chat met je coach** tussen Weekly en Privacy.
  - **2-pane layout** (220px sidebar + main pane, 540px hoog) — net als een email-client / WhatsApp web
  - **Conversations-list** in sidebar: nieuwe chat-knop, klikbare lijst met titel + bericht-count + laatste-update-datum, hernoem-knop (✎) + verwijder-knop (✕) per chat. Active chat gold-highlighted.
  - **Chat-pane**: user-messages rechts (gold), assistant-messages links (neutral), auto-scroll naar bottom bij nieuwe message, typing-indicator (● ● ●) tijdens loading, error-banner bij failure
  - **Multi-turn context**: bij elke send wordt de **volledige message-history** naar Claude gestuurd zodat vervolgvragen context behouden. De helper `callClaudeChat` heeft dezelfde budget-guard als `callClaude`
  - **Cross-feature system prompt**: per chat-call wordt een rijke context geïnjecteerd: laatste 7-dag stats (W/L/WR/PnL/avgR/PF), top-5 playbooks met one-liner + grade, laatste weekly digest (summary + action + discipline-trend). Coach kan dus refereren naar je echte data zonder dat je het hoeft uit te leggen.
  - **Auto-title** vanaf eerste user message (max 60 chars, ellipsis bij langer). Bij rename: inline-edit veld in sidebar.
  - **Cost per message** zichtbaar onder elke assistant-bubble (\\$0.0xxx, mono-font). Totale maand-cost loopt via dezelfde `recordAICost` als pre-trade + weekly.
  - **Privacy-filter** actief op messages + playbooks + trades + weeklies vóór payload wanneer toggle aan. Reverse-mask op response zodat UI gewoon "BTC" toont.
  - **Keyboard**: Enter = verstuur · Shift+Enter = nieuwe regel · Esc bij rename = annuleer
  - **Storage `tj_ai_chats`** — JSON-array van chat-records (id, title, createdAt, updatedAt, messages[]), auto-cap 50 chats (oudste wordt afgeknipt). Custom event `tj-ai-chats-change`.
- **4-spec Playwright suite** (`tests/aicoach-chat.spec.js`): empty-state + nieuwe chat · send-flow (API payload check + storage + cost-tracking + auto-title) · **multi-turn payload bevat volledige history** (3 messages na 2e send) · delete-knop verwijdert chat.

### Gewijzigd
- AI-coach sidebar beta-badge tekst geupdate naar **"Alle features live. Geef feedback in Discord."** (was "Pre-trade live. Budget + Weekly + Chat volgen in v12.137–138.").

---

## [v12.138] — 2026-05-18

### Toegevoegd
- **Weekly digest live (AI-coach, BETA — `?ai=1`)** *(2026-05-18)* — Vervangt placeholder in **📅 Weekly digest** met volwaardige wekelijkse coaching-samenvatting:
  - **Stats-preview** van afgelopen 7 dagen: trade-count, W/L/Scratch, win-rate, totale PnL, avg R-multiple, profit factor, gemiste-TP-count, top symbolen
  - **"Genereer nu"-knop** — pakt stats + top 8 samples (sorted by abs PnL met playbook/grade/setups/notes), bouwt prompt met Steenbarger + Douglas system context, vraagt Claude om JSON-digest
  - **Digest renderer** met 5 vakken: Summary · ✓ Best trade (groen) · ✗ Worst trade (rood) · ⚠ Missed-TP-patroon (amber, optioneel) · Discipline-trend (kleur per trend: improving/stable/declining) · → Actie (gold)
  - **Recente digests** — accordion-list (cap 26 = half jaar), click-to-expand, header toont week + trade-count + cost
  - **Instellingen**: voorkeursdag (zo/ma/di/…/za) + auto-banner toggle
  - **Cost-tracking**: weekly call telt mee in maand-budget via dezelfde `recordAICost` + hard-cap guard
  - **Privacy-filter**: tickers in stats + samples worden geanonimiseerd vóór payload wanneer toggle aan
- **AIWeeklyIndicator topbar** — klein 📅 due-knopje verschijnt **alleen** wanneer master+weekly+autoTrigger aan **en** ≥7 dagen sinds laatste digest (of nooit). Klik → springt naar AI-coach → Weekly. Verdwijnt zodra digest gegenereerd. Geen pollutie wanneer up-to-date.
- **Storage `tj_ai_weeklies`** — JSON-array van digest-records (id, generatedAt, periodStart/End, tradeCount, cost, model, content), auto-cap op 26 entries (oudste wordt afgeknipt bij save). Eigen custom event `tj-ai-weeklies-change` voor realtime UI-sync.
- **5-spec Playwright suite** (`tests/aicoach-weekly.spec.js`): section render · generate→API→parse→save→render flow · topbar indicator due bij ≥7d · indicator verborgen <7d · indicator verborgen wanneer autoTrigger uit.

### Gewijzigd
- `DEFAULT_AI_CONFIG.weekly` toegevoegd: `{dayOfWeek:1, autoTrigger:true, lastGeneratedAt:0}` — backwards-compatible (oude configs krijgen defaults via spread in `loadAIConfig`).

---

## [v12.137] — 2026-05-18

### Toegevoegd
- **Budget-monitor live (AI-coach, BETA — `?ai=1`)** *(2026-05-18)* — Volledige cost-control voor je AI-coach. Vervangt de placeholder in **💰 Budget & kosten**. Features:
  - **Maandelijkse limiet** met presets ($5 / $10 / $15 / $25 / $50) + custom input (0 = geen hard-cap, alleen tracking)
  - **Alert-threshold slider** (50–95%, default 80%) — bij overschrijden verschijnt topbar-indicator
  - **Spent-display** met kleurgecodeerde progress bar: groen <80%, amber 80–99%, rood ≥100% (BLOCKED-badge)
  - **Periode + auto-reset info** — toont huidige maand-key, auto-reset op 1e van maand
  - **Handmatige reset-knop** met confirmation (alleen na bewuste eind-maand-check)
- **Hard-cap guard in `callClaude`** — vóór elke API-call wordt budget gecheckt; bij `spent >= limit` throwt de helper meteen met duidelijke melding ("Maandlimiet bereikt: $X / $Y. Verhoog in Budget & kosten of wacht tot 1e van de maand.") — geen API-call, geen kosten, geen verrassingen. Skipt wanneer budget-feature uitstaat.
- **Topbar-indicator (subtle)** — wanneer `?ai=1` + master aan + budget-feature aan + `spent >= alertThreshold`: een klein 💰-icoontje met percentage verschijnt in de topbar-rechts, tussen de Trade-knop en Privacy-toggle. Amber bij 80–99%, rood bij ≥100%. **Klik** → springt direct naar AI-coach → Budget-sectie voor actie. Verdwijnt onder threshold (geen visuele clutter wanneer alles oké is).
- **Realtime sync via custom events** — `tj-ai-budget-change` (op cost-record) + `tj-ai-config-change` (op save) dispatched naar `window` zodat topbar-indicator + andere subscribers binnen één tab updaten zonder polling.
- **5-spec Playwright suite** (`tests/aicoach-budget.spec.js`): spent+pct+bar render · indicator zichtbaar ≥80% · indicator verborgen <80% · hard-cap blokkeert fetch volledig · reset-knop zet spent op 0.

### Gewijzigd
- `saveAIConfig` broadcastet nu `tj-ai-config-change` event — backwards-compatible (oude subscribers worden gewoon niets-doend, nieuwe luisteren).

---

## [v12.136] — 2026-05-18

### Toegevoegd
- **Pre-trade validatie live (AI-coach, BETA — `?ai=1`)** *(2026-05-18)* — Eerste functionele AI-feature. In de **🛡 Pre-trade validatie**-sectie kun je nu een geplande trade beschrijven (ticker, richting, entry, stop, TP's, risk%, gekozen playbook, optionele notities). AI valideert in <3s tegen je playbook + Bellafiore-5-decision-framework. Output:
  - **Severity-oordeel** in 4 niveaus met visuele styling: ✓ Positief (groen) · ○ Neutraal · ⚠ Waarschuwing (amber) · ✗ Severe — SKIP (rood)
  - **Headline + concreet advies** (wat te DOEN of NIET doen)
  - **Bellafiore-5 scores** (intel-edge / tape / story / risk / execution) elk met score 1-5 + 1-zin toelichting
  - **Playbook-fit** score 1-10
  - **Concerns** (specifieke zorgen, 0-3 items)
- **Cost-tracking foundation** — Per Claude API call worden input/output tokens vermenigvuldigd met model-pricing (Sonnet 4.6 = $3/$15 per M, Opus 4.7 = $15/$75, Haiku 4.5 = $0.80/$4) en geaccumuleerd in `tj_ai_config.budget.spent`. Reset automatisch eerste van de maand. Per-call cost + maand-totaal zichtbaar rechts onder de Valideer-knop.
- **Privacy-filter actief (default aan)** — Wanneer `cfg.features.privacy` aan staat (default in foundation): ticker-namen (BTC, ETH, SOL, +40 anderen) worden vervangen door `COIN_A`, `COIN_B`, … vóór de payload naar Claude gaat. AI-output wordt na ontvangst weer terug-gemapt naar echte tickers. Anthropic ziet alleen geanonimiseerde data. Autonoom getest: ticker komt niet meer in outgoing payload (`tests/aicoach-pretrade.spec.js`).
- **Playbook-context builder** — Pakt automatisch je gekozen playbook (name, oneLiner, defaultGrade, setupTags, timeframes, confirmations, sessions, bigPicture/tape/intuition als enabled, criteria, anti-criteria, stop/target/minRR, mistakePatterns) en bouwt een gestructureerde system-prompt-context. Hoe vollediger je playbook, hoe scherper het advies.
- **Helpful empty-states** — Zonder master aan / zonder pretrade-toggle / zonder API-key: duidelijke melding wat je moet doen ipv leeg form.
- **3-spec Playwright suite** (`tests/aicoach-pretrade.spec.js`): fetch-mock verifieert form-submit → juiste API-call (model, prompt, ticker) · severity-render · cost-tracking write · privacy-mask werkt · zonder-key empty-state.

### Gewijzigd
- AI-coach sidebar beta-badge toont nu **dynamisch APP_VERSION.version** ipv hardcoded v12.135 (auto-update bij volgende releases).

---

## [v12.135] — 2026-05-18

### Toegevoegd
- **AI-coach foundation (BETA — feature-flag `?ai=1`)** *(2026-05-18, na grondig onderzoek + 9-decisions grill-me + demo-iteratie)* — Eerste increment van de AI-coach feature. **Activeren**: open de app met `?ai=1` of `#ai=1` achter de URL (persistent in localStorage zoals `?dev=1`). Daarna verschijnt een **🤖 AI-coach** tab in de topbar tussen Playbook en Instellingen. **Wat er nu in zit**:
  - **Master-schakelaar** + **4 per-feature toggles** (Pre-trade validatie / Budget-monitor / Weekly digest / Privacy-filter) — alles individueel aan/uit.
  - **BYOK (Bring Your Own Key)** — plak je eigen Anthropic API-key (`sk-ant-…`), kies model (Sonnet 4.6 default, Opus 4.7 of Haiku 4.5), test verbinding met één klik. Key blijft in `tj_ai_config` localStorage (NIET in JSON-backup export).
  - **5 sub-secties** met scroll-spy sidebar: Algemeen / API-key / Pre-trade / Budget / Weekly / Privacy.
  - **Placeholders** voor Pre-trade / Budget / Weekly met 🚧 BINNENKORT badge + versie-targeting (v12.136–137).
  - Security-waarschuwing in BYOK-sectie: key niet exporteren, niet committen, wissen vóór browser-data delen.

  **Functionaliteit volgt**: v12.136 = pre-trade validatie + weekly digest. v12.137 = budget-tracking + privacy-filter. v12.138 = multi-turn chat. Tot dan: alleen de tab + BYOK-skeleton zichtbaar voor beta-users met `?ai=1`. Anderen merken niets — geen UI, geen storage-pollutie, geen kosten. Autonoom getest met 4-spec Playwright suite (`tests/aicoach-foundation.spec.js`): tab-flag respecteert, alle 6 secties renderen, master-toggle persistent, BYOK key toon/verberg werkt.

---

## [v12.134] — 2026-05-17

### Fixed
- **Setup-voorbeeld afbeeldingen openden lege tab bij klikken** *(2026-05-17, gemeld door Denny met screenshot)* — Klik op een setup-voorbeeld in Playbook Detail-modal opende een nieuwe browser-tab die leeg bleef. **Oorzaak**: `window.open(ex.dataUrl, "_blank")` met een `data:image/...;base64,...` URL. Chrome (en de meeste browsers) **blokkeren sinds 2017 het openen van data-URLs via window.open** vanwege security (phishing-risico met spoofed pages). **Fix**: in-app lightbox-overlay i.p.v. nieuwe tab — zelfde pattern als trade-screenshots in TradeForm. Voordelen: werkt overal (geen browser-blokkering), keyboard-navigatie (Esc om te sluiten, ← → om door voorbeelden te bladeren bij meerdere), kind-label (✓ School / ✗ Vals / ⚡ Marginal) en caption blijven zichtbaar onder de afbeelding. Nieuwe `.tj-lightbox-btn` CSS-class voor sluit/navigatie-knoppen (theme-agnostic: overlay is altijd donker zodat foto helder oogt).

---

## [v12.133] — 2026-05-17

### Fixed
- **BT-trade verliest SL-prijs TP na reload — vervolg op v12.130** *(2026-05-17, gemeld door Denny: "weer dat SL na reload wordt verwijderd")* — v12.130 scopte de self-heal naar `source !== "manual"`, maar BT-trades die gekoppeld zijn aan een **custom account** (bv. een eigen "BT Account" toegevoegd in Settings → Accounts) krijgen `source = account.name` — niet `"manual"`. De heal triggerde dan nog wel. **Fix**: scope verfijnd naar **alleen exchange-API sources** (Blofin / MEXC / Kraken / Hyperliquid / FTMO via `ExchangeAPI[source]` check). Manual trades én trades gekoppeld aan een custom account skipen nu allemaal de heal. Worker-bug fix blijft actief voor de 5 exchange-sources. Autonoom geverifieerd met 3 scenarios (Blofin heal werkt nog ✓ · manual skipt ✓ · custom account-naam skipt ✓).

  **Note**: als je vóór deze versie BT-trades had waar de heal al heeft toegeslagen (TPs zijn al uit localStorage gewist), dan komen die niet vanzelf terug. Vul handmatig de TP-rij opnieuw aan en bij volgende reload blijft hij staan.

---

## [v12.132] — 2026-05-15

### Toegevoegd
- **Date-filter op Playbook Analytics** *(2026-05-15, op verzoek van Denny)* — De Playbook Analytics-tab heeft nu z'n eigen datum-filter, mirror van de main FilterBar's date-row. Inputs voor van/tot + presets **Vandaag** / **Deze week** / **Deze maand** / **Alles**. Filter geldt op álle breakdowns: Trust-Score, Erosion, KPIs, equity-curves, layer/session/grade/pair/mistake/emotion-stats, missed-opportunities. Wanneer de filter actief is en trades wegfiltert verschijnt een amber hint "X/Y trades" rechts naast de presets. Filter blijft behouden bij wisselen tussen playbooks (zodat je dezelfde periode over verschillende setups kunt vergelijken). Reset door op "Alles" te klikken. Geen interactie met main FilterBar — Playbook Analytics heeft eigen lokale state.

---

## [v12.131] — 2026-05-15

### Fixed
- **Analytics "Setup lagen performance" labels worden afgekapt met "..."** *(2026-05-14, gemeld door Denny met screenshot)* — Labels zoals `Daily → 1H+BOS+SFP` werden afgekapt naar `Daily → 1H+B...` waardoor je niet zag welke layer-combinatie bij welke bar hoort. **Oorzaak**: `barRow` helper gebruikte vaste 70px label-kolom met ellipsis. Layer-pattern strings nodigen 110-135px (gemeten via Playwright). **Fix**: `barRow` accepteert nu een optionele `wide`-param die de label-kolom verbreedt naar 160px. Alleen layerAnalysis gebruikt deze opt-in — andere bar-widgets (pair / dag / sessie / fouten / emoties / long-short) blijven compact (70px). Geverifieerd: alle layer-labels passen nu volledig zonder ellipsis.

### Toegevoegd
- **EdgeGap + StressLeak: zichtbaar label dat ze datum-filter negeren** *(2026-05-14, gemeld door Denny "data van andere trades lekt door bij Analytics filter")* — Onderzoek toonde aan dat 95% van Analytics de FilterBar correct respecteert. Alleen **EdgeGap** (👻 missed trades) en **StressLeakWidget** (💢 paper vs real) gebruiken `allTrades` by design — hun analyses zijn alleen zinvol over volle history. Zonder visueel signaal leek dit een bug. **Fix**: kleine cursieve subtitel `📊 Over alle trades — datum-filter genegeerd voor deze analyse` onder beide widget-headers. Geen functionele verandering — pure UX-clarification.

---

## [v12.130] — 2026-05-14

### Fixed
- **BT-trade verliest "missed" TPs én loss-marking na reload** *(2026-05-14, gemeld door Denny, autonoom gediagnosticeerd)* — Wanneer je in een backtest-trade een TP-prijs invult op SL-niveau (om een SL-hit te modelleren) en die TP markeert als missed, verdween die TP-rij bij de eerstvolgende reload. Daardoor verdween ook de "🛑 Verlies gemarkeerd"-pill omdat de remaining TPs niet meer 100% missed waren. **Oorzaak**: de v12.104 self-heal in `normalizeTrade` ([line ~1665](work/tradejournal.html#L1665)) verwijderde elke niet-hit TP die aan de "verkeerde" kant van entry zat (LONG: prijs < entry, SHORT: prijs > entry) omdat dat een typisch teken was van Blofin/MEXC Worker-bug waarbij pending stop-loss orders per ongeluk als TP-rij werden gestuurd. Voor BT-trades is dat een misclassificatie — user vult bewust SL-prijzen in om verlies-scenarios te modelleren. **Fix**: heal-scope beperkt naar exchange-source (`source !== "manual"`). Manual trades (BT / paper / handmatige real-trades) blijven onaangetast. Worker-bug fix blijft actief voor Blofin/MEXC/Kraken/Hyperliquid imports. Autonoom geverifieerd via 2 Playwright-tests (Blofin heal werkt nog + manual heal skipt).

---

## [v12.129] — 2026-05-14

### Fixed
- **BT/paper-trades zonder handmatige pnl niet meegerekend in Analytics** *(2026-05-14, autonoom gediagnosticeerd na Denny's melding "ik zie nog steeds geen data")* — Vervolg op v12.128. Twee onderliggende oorzaken:
  1. **`netPnl()` returnde altijd 0** voor `status="missed"` trades, ook met handmatige pnl ingevuld. Alle aggregaten (Net PNL / Profit Factor / Expectancy / setup-bars) waren dus 0 voor BT/paper-trades zelfs als de data er was.
  2. **Analytics's `closed`-filter** vereiste `t.pnl !== ""` — BT-trades waar gebruiker alleen TPs of hindsightExit had ingevuld (geen handmatige pnl) vielen weg.
  
  **Fix**:
  - `netPnl()` doet nu fallback voor missed-trades: eerst `t.pnl` proberen, dan `calcTheoreticalPnl(t)` (uit TPs / hindsightExit / exit-chain), dan 0.
  - Analytics's filter accepteert nu ook trades met theoretical PnL.
  
  **Autonoom verifieerd via Playwright**: 5 BT-trades geseed (verschillende invul-patronen), filter "Backtest" actief — vóór de fix 2 trades zichtbaar, nu 4 (5e zonder enige data wordt terecht weggefilterd).
  
  **Default tradeType-filter blijft `"real"`** dus Dashboard voor real-only users is onaangetast — alleen wanneer je actief naar Sim / Backtest / Paper / Alles wisselt zie je je simulaties.

---

## [v12.128] — 2026-05-12

### Fixed
- **Backtests/paper-trades verborgen in Analytics zonder zichtbare toggle** *(2026-05-12, gemeld door Denny)* — De globale FilterBar `tradeType` default = `"real"`, wat alle BT/paper/missed trades onzichtbaar maakt (Dashboard, Analytics, Trades, Review, Calendar). De "👻 Type"-toggle om dat te wisselen was alleen zichtbaar wanneer `config.trackMissedTrades` aanstond — een opt-in waar veel users niet vanaf weten. **Fix**: type-filter staat nu altijd in de FilterBar onder "Geavanceerde filters". Default-gedrag blijft `"real"` (geen verrassing voor bestaande users), maar je kunt nu altijd wisselen naar **🔬 Backtest / 📝 Paper / 👻 Gemist / Sim (alle) / Alles** om je simulaties in te zien.

---

## [v12.127] — 2026-05-12

Globale privacy-modus — verbergt alle $/€ bedragen met één klik. Voor stream-veilig delen, screen-sharing, of over-de-schouder-context.

### Toegevoegd
- **👁 privacy-toggle in de top-bar** *(2026-05-12, op verzoek van Denny — vervangt de Dashboard-only toggle die alleen account-saldo verborg)* — Naast de Theme-knop in de top-bar staat nu een 👁 (oog-icoon) die alle dollar/euro-bedragen vervangt door `$***,**`. Werkt op elke pagina, persisteert via `tj_privacy_mode` localStorage. Active state: 👁‍🗨 + gold accent.
- **Dashboard's bestaande 👁 togglet nu globaal** — voorheen verborg die alleen het account-saldo-blok bovenin, maar alle PnL-cards/KPIs/charts bleven zichtbaar (privacy-leek). Nu synced met de top-bar via React Context — beide togglen dezelfde state.

### Maskerings-scope
Verborgen wanneer privacy aan staat:
- **Dashboard**: BALANS, DD/limiet, account-balances per exchange, alle 6 KPI-cards (Netto PNL / R:R sub / Expectancy / Gem. Win / Gem. Loss / Fees), Setup performance bars, Session performance bars, Emotie performance bars, Setup ranking widget
- **Trades-lijst**: PnL-kolom (alle 4 branches: real / theoretical missed / unrealized / theoretical-fallback), sub-row Risk + Fees, footer Return, fmtSize $-fallback
- **TradeForm modal**: Live KPI strip "Risk $", 💡 PNL berekenen-knop, TPs Verwacht-totaal + per-TP winst, close-data buttons (PnL/Exit/was→nu)
- **Analytics**: 4-stat insight cards, Expectancy, lek-warning, HIGH-stat, edge/emotion-insight cards
- **Review**: 6-stat grid (Netto PNL / Profit factor / Gem. winst+verlies / Expectancy), Max DD, Best/Worst trade + day
- **Calendar**: cal-stat Net jaar + Gem. winst, dag-cell PnL, side-totals, year-view monthly tiles, month-view day tiles
- **DashboardPremium**: HIGH cumulatief, recent trades PnL kolom
- **Charts**: EquityCurveChart + PnlBarChart + MistakeImpactChart Y-axis ticks + tooltip labels

Bewust NIET gemaskt:
- **Toasts** ("✓ Trade gesloten — PnL: +$X") — bewuste user-actie feedback, 3 sec zichtbaar
- **Entry/exit prijzen** in trade-rows — markt-data, geen positie-info
- **Position-size in asset** (0.0312 BTC) — belangrijk voor playbook-fit analyse
- **R-multiples / win-rates % / counts / dates** — privacy-vriendelijk maar nog leesbaar
- **TradeReport (Rapport-modal)** — bewust onaangetast om PDF-export niet te raken
- **PDF/JSON exports** — export is bewuste actie, volledige data behouden
- **RMultDistChart** — toont alleen R-buckets, geen $

### Onder de motorkap
- React Context (`PrivacyContext` + `usePrivacy()` hook) als single-source-of-truth
- `<Money value={v} sign={true} prefix="$"/>` component voor JSX-rendering (toekomstig gebruik)
- `fmtMoney(v, privacy, opts)` helper voor template-strings/chart-callbacks
- Chart.js callbacks krijgen `priv` als useEffect-dep zodat charts rebuilden bij toggle
- Theme-token hook compatible (geen hardcoded kleuren in nieuwe code)

### Tests
- `tests/privacy-mode.spec.js` — Playwright spec verifieert toggle + masking + localStorage persist
- Smoke + 6 thema's blijven groen (8/8 tests pass)

### Migratie
Geen breaking change. Nieuwe localStorage key `tj_privacy_mode` (default `"0"`). Bestaande Dashboard `lp.accountValue`-pref blijft in de layout-prefs maar wordt niet meer gebruikt voor masking-state.

---

## [v12.126] — 2026-05-12

### Fixed
- **Refresh respecteerde een al-ingestelde "Sync vanaf" niet** *(2026-05-12, follow-up op v12.125)* — De vorige fix wist alleen `tj_lastsync_<ex>` bij wijziging van de date-input. Voor users die syncFrom al hadden ingesteld vóór de fix (of die de datum niet opnieuw aanraakten), bleef de bug bestaan. **Nieuwe fix in refresh-flow zelf**: als `c.syncFrom` expliciet is gevuld door de user, gebruik altijd die datum als startTime — incremental-optimization (`lastSync - 1u`) geldt nu alleen wanneer syncFrom op de default staat. Werkt onmiddellijk na update zonder dat user de input opnieuw hoeft te selecteren.

---

## [v12.125] — 2026-05-12

### Fixed
- **Refresh-knop negeerde "Sync vanaf" wijziging** *(2026-05-12, gemeld door Denny, gediagnosticeerd via Blofin snapshot)* — Wanneer je "Sync vanaf" verlaagde (bv. 1 mei → 1 april) en op Refresh klikte, kreeg je maar 2 trades binnen i.p.v. de verwachte ~21. **Oorzaak**: Refresh's incremental-optimization gebruikte `Math.max(configuredStart, lastSync-1u)` — `lastSync` (gisteren) wint van `configuredStart` (1 april), dus alleen records sinds gisteren worden gefetcht. **Fix**: bij wijziging van de "Sync vanaf"-datum reset de incremental-cursor (`tj_lastsync_<ex>` localStorage), zodat de volgende Refresh respecteert wat je hebt ingesteld. Geldt voor alle exchanges met API-sync (Blofin / MEXC / Kraken / Hyperliquid). Bestaande trades worden gededupliceerd via `importTrades` — geen duplicates. **Note**: deze fix was incompleet voor users die syncFrom al hadden ingesteld vóór update — zie v12.126.

---

## [v12.124] — 2026-05-11

### Fixed
- **"+ TP toevoegen" knop verdween na 4 TPs** *(2026-05-11, gemeld door Denny)* — De pre-existing cap was `tps.length<4`, maar v12.123 templates ondersteunen tot 5 TPs. Cap opgehoogd naar `tps.length<5` zodat je tot 5 TPs kunt toevoegen.

---

## [v12.123] — 2026-05-11

Slimme TP-verdeling met templates — Take Profit positiegroottes worden automatisch verdeeld volgens gekozen template, handmatige TP-edits triggeren auto-recalc zodat de som altijd 100% blijft.

### Toegevoegd
- **3 Pre-built templates** *(2026-05-11, op verzoek van Denny)*: Equal (gelijke verdeling), Front-loaded (zwaar op eerste TP), Runner (zwaar op laatste TP). Werken voor 1 t/m 5 TPs.
- **Template-dropdown** in de trade-modal, boven de TP-grid. Selecteer een template → percentages worden automatisch overschreven. "Custom" verschijnt automatisch wanneer percentages afwijken van de actieve template.
- **Auto-verdeling** bij `+ TP toevoegen` / TP verwijderen — gebruikt de default-template voor het nieuwe aantal TPs. Bij handmatige afwijking verschijnt een "Verdeling overschrijven?" bevestigingsdialoog.
- **Auto-recalc cascade** *(Optie B: Last absorbs)* — wanneer je een TP-percentage handmatig wijzigt absorbeert de laatste TP het verschil. Bij overflow cascadet het terug naar TP n-1, etc., met een minimum van 1% per TP. Som blijft altijd exact 100%.
- **Visuele highlight** — 300ms debounced gele flash op cascade-aangepaste TPs zodat je ziet waar het verschil landt.
- **Settings-UI** in Instellingen → 🔧 App → **TP-templates**:
  - Lijst van alle templates (pre-built + custom) met distributie-preview per count
  - Bewerk / verwijder per template (pre-builts kunnen ook worden bewerkt)
  - **"↻ Reset to defaults"** knop herstelt de 3 pre-builts via upsert-by-id zonder custom templates te raken
  - **+ Nieuwe template** edit-modal met validatie (unieke naam, geen 0%, alleen integers, som=100, partial-distributies toegestaan)
  - **Default-per-count picker** — kies per aantal TPs (1-5) welke template default wordt gebruikt
- **Backup integratie** — templates + defaults zijn opgenomen in de JSON-export en worden hersteld bij import (zowel via drag-drop als via "Backup importeren" knop in Settings).

### Gewijzigd
- **Trade-schema**: `EMPTY_TRADE.tpTemplateId=""` toegevoegd. Bestaande trades zonder dit veld worden als "Custom" geladen (geen on-load wijziging van pcts).
- **localStorage keys**: `tj_tpTemplates` en `tj_tpDefaults` toegevoegd. Eerste-keer-init laadt pre-builts.

### Niet aangeraakt (regressie-veilig)
- Bestaande trades met handmatige TP-distributies (bv. 70/30) — `tpTemplateId=""` betekent "Custom" → geen on-load overschrijving.
- Exchange-fetch tpLevels (non-integer pcts uit fills) — automatisch als "Custom" gemarkeerd, exchange-pnl blijft bron-van-waarheid.
- `_simTradeExit`, `calcRMultiple`, `playbookErosionStats` analytics — onveranderd.
- v12.122 closeManualTrade flow + markAllHit/markAllMissed — ongewijzigd.

### Tests
- 44 logica-tests voor helpers (equalDistribution, getDistributionForCount, applyDistributionToTps, isManualDistribution, **recalcLastAbsorbs met 100-iteraties fuzz**, validateTpTemplate)
- 4 backup round-trip tests (export → serialize → import → state intact)
- Smoke + 6-thema regressie groen

---

## [v12.122] — 2026-05-09

Quick-action knoppen "Mark als win" / "Mark als verlies" zijn nu beschikbaar voor *alle* trades — handmatig én exchange-imports — naast BT/paper/missed.

### Toegevoegd
- **Quick-actions voor manuele + exchange trades** *(2026-05-09, op verzoek van Denny)* — De knoppen "✓ Mark als win" / "🛑 Mark als verlies" naast Take Profit niveaus waren tot nu toe alleen zichtbaar bij missed/BT/paper trades. Nu verschijnen ze voor élke trade met TPs:
  - **Handmatige trades** (open/partial): "Mark als win" → zet alle TPs op hit + de bestaande "Trade sluiten"-knop verschijnt voor auto-close op TP-weighted exit. **NIEUW**: "Mark als verlies" → zet alle TPs op missed + nieuwe "🛑 Trade sluiten op SL" knop verschijnt voor auto-close op SL met negatieve pnl.
  - **Handmatige trades** (closed): bij pnl-drift toont een suggestie-knop "PnL bijwerken naar TPs" (win) of **NIEUW** "PnL bijwerken naar SL" (verlies).
  - **Exchange trades** (Blofin / MEXC / Kraken / Hyperliquid / FTMO): knoppen werken puur als TP-status marker — exchange-pnl blijft onaangetast (bron-van-waarheid). Handig voor playbook-analytics.
  - **BT/paper/missed**: gedrag onveranderd — TP-status drijft `_simTradeExit` voor analytics.
- **Tooltips** zijn neutraler geformuleerd ("Markeer alle TPs als bereikt / gemist") zodat ze voor alle trade-types kloppen.

### Gewijzigd
- **`closeManualTrade`-flow uitgebreid** — naast `mode:"close"` (open→sluit op TPs) en `mode:"update"` (closed pnl-drift) zijn er nu `mode:"close-loss"` (open→sluit op SL) en `mode:"update-loss"` (closed pnl-drift naar SL). Knop-styling: rood voor verlies-flows, groen voor close+win, amber voor close+verlies of pnl-update.

---

## [v12.121] — 2026-05-09

Mindset-toast theme-aware gemaakt — was altijd donker met onleesbare tekst in lichte thema's.

### Fixed
- **Mindset-quote toast onleesbaar in lichte thema's** *(2026-05-09, gemeld door Denny met screenshot)* — De mindset-reminder toast (rechtsonder, post-loss) had een hardcoded donkere achtergrond `rgba(10,12,18,.97)` terwijl de tekstkleur `var(--text2)` per-thema schakelt. Resultaat in light/parchment/daylight: donkere tekst op donkere bg = onleesbaar én visueel inconsistent met de rest van de app. **Fix**: achtergrond gebruikt nu `var(--bg2)` (theme-aware) en de drop-shadow is iets zachter (`rgba(0,0,0,.25)` ipv `.5`) zodat hij ook op lichte thema's natuurlijk oogt.

---

## [v12.120] — 2026-05-08

Trust-Score visueel gemoderniseerd + drempel-labels gecorrigeerd. Iconen per stage, continue progress-bar, status-samenvatting in header.

### Gewijzigd
- **Drempel-labels gecorrigeerd** *(2026-05-08, gemeld door Denny — labels toonden nog oude v12.109 thresholds)* — De Trust-Score progressie-bar gaf nog labels van vóór v12.110 ("10+ BT", "5+ paper", "6+ real", "16+ >0.3R"). Sinds v12.110 zijn drempels type-agnostisch. **Fix**: labels nu correct:
  - `Idee` (geen drempel — playbook bestaat)
  - `Theorized` · 1+ trade
  - `Validated` · 2+ trades
  - `Tradeable` · 4+ trades
  - `Bewezen` · 5+ · &gt;0.3R
- **Modern visueel ontwerp**:
  - **Iconen per stage** (💡 Idee · 🔬 Theorized · 📊 Validated · 🎯 Tradeable · 🏆 Bewezen) ipv simpele dots/cijfers
  - **Continue progress-bar** onder de stages — gradient van groen→goud→groen, vult zich proportioneel naarmate je meer trades + edge hebt (15% / 40% / 65% / 82% / 100%)
  - **Status-samenvatting in header** — `STATUS · BEWEZEN · 10 trades · +3.05R avg` ipv duplicaat onder de bar
  - **Active stage** krijgt gold-glow, **Bewezen** krijgt extra green-glow + ★ badge rechtsonder
  - **Done stages** krijgen klein groen ✓ badge rechtsonder de icon
  - **Pending stages** zijn icoon in grayscale + verlaagde opacity zodat de progressie visueel duidelijk is
- **Action-hint card** vervangt de oude inline status-tekst — alleen actie-tekst zichtbaar:
  - 🏆 Bewezen → groene success-card "Bewezen workhorse — overweeg risk-allocatie verhogen"
  - ⚠ Sample te klein / R-data ontbreekt / edge te laag → amber warning-card met concrete actie
  - Andere stages zonder actie → geen card

### Aanpak
- Geen logica-wijziging in `classifyTrust` — alleen presentatie-laag.
- Continue progress % afgeleid uit dezelfde drempels die `classifyTrust` gebruikt → blijft 1-op-1 in sync.

---

## [v12.119] — 2026-05-08

**Playbook Analytics Phase 2** — 7 nieuwe analyse-secties onder de bestaande Trust-Score / KPI's / Equity Curve. Layer-patterns, sessie-heatmap, criteria-impact, mistakes, emotions, missed-opportunities, en auto-insights.

### Toegevoegd
- **📐 Layer-Pattern bars** — trades gegroepeerd op layer-combinatie (`4H+SFP → 15m+BOS+MSB`). Per pattern: avgR, n, sortering op edge. Min. 1 trade/pattern. Toont top 8.
- **📅 Sessie × Weekday heatmap** — 8 sessies (Asia AM/PM, EU AM/PM, US AM/PM/Late, Weekend) × 7 weekdagen. Cel-kleur intensiteit op |avgR|. Cellen met data tonen `+1.5R · n=3`.
- **⏰ Tijd-van-dag bars** — 2-uurs blokken (00:00–02:00 etc). Welk uur is je sweet-spot?
- **🎓 Per Grade · 💱 Per Pair · 🧭 Per Direction** — drie bars-cards op één rij. Grade volgt A+/A/B/C ordering. Pair top 5 op edge. Direction long/short voor bias-detectie.
- **✅ Criteria-impact ranking** *(real only)* — voor elk criterium in `pb.criteria`: % afgevinkt in winners vs losers + lift-score. Hoge lift = sterke voorspeller. Vereist `complianceChecks` op real trades.
- **📊 Compliance × Outcome split** *(real only)* — high (≥80% checks) vs low compliance bars + WR/avgR/PnL per group.
- **😤 Mistake-tags ranking** *(real only)* — top 6 mistakes op cumulatieve PnL-impact. "Welke fouten kosten het meest?"
- **🧠 Emotion-impact ranking** *(real only)* — top 6 emoties op avgR. "Geduldig 100% WR / FOMO 0%"
- **👻 Missed-opportunities detail** *(alleen als missed > 0)* — n, theoretische avgR, cum. PnL, % van real PnL. Plus top reden-tags ranking uit `missedReasonTags`.
- **💡 Auto-Insights cards** — derive 2-4 highlight statements: best layer, worst layer, best session-cell, worst mistake, best emotion. Smart heuristieken (min. 2 trades, drempels op avgR/PnL).

### Aanpak
- Nieuwe helpers in `tradejournal.html`: `_pbTradeR`, `_pbTradePnl`, `_pbGroupBy`, `_pbTagFreq`, `_pbLayerKey`, `_pbSessionWeekdayKey`, `_pbHourKey`, `_pbCriteriaImpact`, `_pbComplianceSplit`, `_pbAutoInsights`. Alle samengetrokken in 1 helper-blok boven `PlaybookAnalyticsView`.
- Universele R-derivatie via `_pbTradeR(t)`: real trades → `calcRMultiple`, sim trades → `calcTheoreticalR` (= trade.exit / hit-TPs / hindsightExit fallback chain).
- Sections renderen alleen wanneer relevante data aanwezig is. Per-Grade/Pair/Direction tonen subtiele empty-states (50% opacity) als data ontbreekt.
- Auto-Insights heuristieken: best layer/session/emotion vereisen `n>=2` AND `avgR>0.5`. Worst mistake vereist `sumPnl<-50`. Output max 4 cards.
- Test-suite: `tests/playbook-analytics-phase2.js` — 6 logic-cases (layer-key uit layers, fallback uit setupTags, groupBy met avgR, real vs sim mixed, skip zonder R-data, tag-frequency).

### Voor de community
- Geen actie nodig. Bij update naar v12.119 ziet je Playbook Analytics direct de nieuwe sections op basis van bestaande trade-data.
- **Voor 10 BT trades zoals Denny's voorbeeld**: Layer-pattern (1 pattern uit '1H+BOS+MSB'), Sessie-heatmap (London PM/AM/Weekend cells), Per Grade (A+/A/B/C verdeling), Auto-Insights (sweet-spot identificatie). Mistakes/Emotions/Criteria zijn empty (zijn real-only) — die vullen zich naarmate je real trades neemt.
- **Tip**: vul `tradeGrade` (A+/A/B/C) op je trades om Per-Grade breakdown te zien. Vul `complianceChecks` op real trades voor criteria-impact ranking.

---

## [v12.118] — 2026-05-08

Quick-fixes Playbook Analytics: equity curve auto-defaults naar beschikbare bron + Cum. PnL toont theoretisch totaal voor BT/paper/missed.

### Fixed
- **Equity curve "Selecteer minstens één bron"** *(2026-05-08, gemeld door Denny — 10 BT trades zonder real toonden geen curve)* — Bij playbook-switch (of initial load) was eqSources hard-coded `["real"]`. Voor playbooks zonder real-trades bleef de curve leeg. **Fix**: useEffect detecteert empty curve-state en pakt automatisch eerste beschikbare bron (real → bt → paper → missed). Source-toggle voor KPIs idem.
- **Cum. PnL toonde "theor." placeholder voor BT/paper/missed** — Nu berekent de KPI sum van `calcTheoreticalPnl(t)` over alle trades in bucket. Voor jouw 10 BT met +3.05R avg op $1000 size → toont nu daadwerkelijke theoretische PnL i.p.v. statisch "theor." label.

### Aanpak
- `_srcStats` voor bt/paper/missed berekent nu `sumTheorPnl(buckets[src])` en zet dat als `pnl` veld → KPI display formatteert via `_pbFmtUsd`.
- useEffect bij `pbId` change: scant counts en eqCurves voor eerste beschikbare bron.

### Voor de community
- Geen actie nodig. Bij update toont Playbook Analytics nu direct data voor sample-types die je hebt — geen handmatige source-toggle meer nodig om curve te zien.

---

## [v12.117] — 2026-05-08

Hotfix: BT/paper trades met EXIT ingevuld toonden `+$0,00` in PnL-kolom van trades-tabel — terwijl het formulier wel `-7.85` aangaf. Oude `netPnl()` clamp van missed trades naar 0 brak v12.115 EXIT-flow.

### Fixed
- **PnL-kolom in trades-tabel respecteert ingevulde `trade.pnl` voor BT/paper** *(2026-05-08, gemeld door Denny — BT short met EXIT=SL ingevuld toonde `+$0,00` ipv `-$7,85`)* — `netPnl(t)` returnt 0 voor `t.status === "missed"` (= correct voor analytics-aggregatie zodat sim-trades real edge-stats niet vervuilen). Maar de trade-rij gebruikte die voor display, waardoor user-ingevulde PnL op BT/paper trades werd gemaskeerd. **Fix**: row-display gebruikt nu `pnlRaw` direct voor missed-trades met PnL ingevuld, met `~` prefix en italic styling om aan te geven dat het theoretisch is. `netPnl()` zelf onveranderd — analytics-paden blijven correct.
- **W/L kleur en badge correct voor BT/paper** — `isW`/`isL` flags gebruikten ook netPnl, dus toonden geen kleur. Nu fallback naar pnlRaw voor missed trades.

### Aanpak
- Geen `netPnl()` wijziging — die blijft "missed = 0" returnen voor aggregaties (Cum. PnL, Avg PnL, Expectancy worden correct gescoped op real trades).
- Display-laag verandering alleen in `Trades` tabel-renderer.

---

## [v12.116] — 2026-05-08

UX-fix op v12.114: knop-labels waren ambigu — leek alsof "🛑 SL hit" de status was, terwijl het de actie was. Plus state-indicator wanneer trade bulk-gemarkeerd is.

### Gewijzigd
- **Knop-labels actie-georiënteerd** *(2026-05-08, gemeld door Denny — "als ik TP op groen vink komt er SL hit te staan, klopt je logica wel?")* — Voorheen `✓ Alle TPs hit` en `🛑 SL hit` lazen als status-claims. Nu duidelijk acties:
  - `✓ Mark als win` (klik → alle TPs naar hit)
  - `🛑 Mark als verlies` (klik → alle TPs naar missed)
- **State-indicator pillen** verschijnen bij volledige bulk-state:
  - Wanneer alle TPs hit zijn: groene pill `✓ Win gemarkeerd` (geen knop, alleen status)
  - Wanneer alle TPs missed: rode pill `🛑 Verlies gemarkeerd`
  - De inverse-actie knop blijft beschikbaar — gebruiker kan met 1 klik switchen.

### Resultaat
Bij allHit: zie `✓ Win gemarkeerd` (status pil) + `🛑 Mark als verlies` (actie knop voor switch). Niet langer alleen "🛑 SL hit" wat verwarrend was.

---

## [v12.115] — 2026-05-08

EXIT-veld nu zichtbaar voor backtest/paper trades. Simpelste UX: vul exit-prijs in → analytics werkt. Geen hindsightExit of TP-toggling meer nodig.

### Toegevoegd
- **EXIT-veld voor backtest/paper trades** *(2026-05-08, gemeld door Denny — "Misschien een exit in de backtest gemist? En dan winst berekenen op basis van exit-prijs?")* — Voor `simType="backtest"` en `simType="paper"` is het EXIT-veld nu zichtbaar in het hoofd-formulier (naast ENTRY en STOP LOSS). Vul de exit-prijs in (waar trade ook werkelijk gesloten is in jouw replay/demo) en analytics werkt direct. Voor `isMissedReal` (real-time gespotte trades, niet daadwerkelijk getradet) blijft EXIT verborgen — daar is hindsightExit nog steeds de juiste field.

### Gewijzigd
- **`_simTradeExit` priority chain uitgebreid**: `trade.exit` is nu de **primaire** bron voor BT/paper trades. Volgorde:
  1. **NIEUW**: `trade.exit` (directe replay/demo-exit) — winnt altijd
  2. 100% hit TPs → weighted exit
  3. hit + missed = 100% → mixed weighted (hit op TP, missed op SL)
  4. Alle TPs missed → SL hit, R = -1
  5. hindsightExit fallback (legacy)
  6. null
- **hindsightExit-section verborgen voor BT/paper** — voorheen verscheen er een aparte "🎯 Backtest Exit" sectie met `hindsightExit` veld. Nu redundant want EXIT-veld is in main form. Section verschijnt nog wel voor `isMissedReal` als "🔮 Hindsight (optioneel)".

### Aanpak
- Backwards compatible: bestaande BT/paper trades met alleen `hindsightExit` blijven werken via fallback chain. Bij nieuwe trades vult gebruiker EXIT direct.
- Test-suite uitgebreid 15 → 18 cases — `trade.exit` priority, SL-hit short via direct exit, fallback wanneer exit leeg.

### Voor de community
- **Voor je 4 BT trades zonder W/L**: open de trade → vul EXIT-prijs in (waar je sloot in je replay, kan SL-prijs zijn voor verlies-trades) → analytics werkt direct.
- Voor BT/paper trades met TP-grid: je kunt nu kiezen — vul EXIT in (snelste) OF vink TPs aan (mooiere R-distribution per pattern). Beide werken.

---

## [v12.114] — 2026-05-08

Verlies-trades met SL-hit kunnen nu in 1 klik gemarkeerd worden + mixed-outcome (sommige TPs hit, rest naar SL) wordt automatisch correct afgeleid.

### Toegevoegd
- **Quick-action knoppen voor sim-trades** *(2026-05-08, gemeld door Denny — niet alle BT trades toonden W/L)* — In de TP-sectie van missed/BT/paper trades:
  - Groen `✓ Alle TPs hit` — markeert alle TPs als hit in 1 klik (= trade volledig in winst)
  - Rood `🛑 SL hit` — markeert alle TPs als missed in 1 klik (= trade volledig stopgezet)
  - Knoppen verdwijnen wanneer trade al in die staat is (bv. "✓ Alle TPs hit" verbergt zich als allemaal al hit)
  - Spaart 2 clicks per TP (toggle-cyclus is open→missed→hit). Bij 4 TPs: 8 clicks → 1 klik.
- **Mixed-outcome derivatie**: hit + missed = 100% van de trade. Hit-portie sluit op TP-prijs, missed-portie op SL-prijs. Voorbeeld: TP1 hit (50%) + TP2 missed (50%) op long entry 70k / SL 69k / TP1 71k → weighted exit = 70000 → R = 0 (= break-even na partial winst + SL op rest).

### Aanpak
- `_simTradeExit` chain uitgebreid:
  1. 100% hit TPs → weighted exit
  2. **NIEUW**: hit + missed = 100% + SL gezet → mixed weighted (hits op TP-prijs, missed op SL)
  3. **NIEUW**: alle TPs missed (= SL hit op volledige positie) → exit = SL → R = -1
  4. hindsightExit fallback
  5. null
- Test-suite 12 → 15 cases. Alle scenarios: 100% hit, alle missed (SL), mixed long/short, fallback chain.

### Voor de community
- **Verlies-trade in backtest**: open de trade → klik "🛑 SL hit" knop → analytics werkt direct. Trade-rij toont rood ✗ in BT-badge, R-multiple `-1.0R`, theoretische PnL.
- **Winst-trade**: klik "✓ Alle TPs hit" of toggle individuele TPs handmatig.
- **Mixed**: vink TPs handmatig hit/missed naar je replay — auto-derivatie pakt dat op.

---

## [v12.113] — 2026-05-08

Theoretische exit voor BT/paper/missed trades wordt nu **automatisch afgeleid uit 100% hit-TPs** — geen apart `hindsightExit`-veld meer nodig als de gebruiker zijn TPs al heeft aangevinkt.

### Gewijzigd
- **Auto-afgeleide exit voor sim-trades** *(2026-05-08, gevraagd door Denny — "waarom hindsight invullen? het kan toch op basis van de gegevens die zijn ingevuld")* — Voor backtest/paper/missed trades wordt theoretische R en PnL nu in deze volgorde bepaald:
  1. **100% hit-TPs**: weighted exit uit `tp.price × tp.pct`. R = `(weighted_exit − entry) / |entry − SL|`. Geen extra invoer nodig — gewoon TPs aanvinken op hit.
  2. **`hindsightExit` als fallback**: alleen als TPs niet 100% afgevinkt zijn.
  3. **Null** (geen analytics): als beide ontbreken.
- **`calcTheoreticalR` + `calcTheoreticalPnl` herzien** — gebruiken nieuwe helper `_simTradeExit(trade)` die de afleiding centraal houdt. Backwards compatible: trades met alleen `hindsightExit` blijven werken.
- **`playbookErosionStats` gebruikt nieuwe afleiding** — Trust-Score, BT-vs-Real comparison, Edge-Erosion stats — allemaal pakken nu hit-TPs op als beschikbaar.
- **UX-hint context-bewust**: "🎯 Backtest Exit" sectie toont nu:
  - `✓ Exit afgeleid uit 100% hit-TPs. Geen extra invoer nodig` als TPs gevuld
  - `Twee opties: (a) TPs aanvinken op hit, of (b) handmatig exit-prijs invullen` als geen exit-data
  - Section auto-opent alleen wanneer **noch** TPs noch hindsightExit beschikbaar
- **Hint-status** in Section header: `afgeleid uit TPs ✓` / `ingevuld ✓` / `TPs aanvinken óf prijs invullen ⚠`.

### Aanpak
- Centrale derivatie in `_simTradeExit` voorkomt drift tussen verschillende paden (KPI, Trust, Edge-Erosion, trade-tabel display).
- Test-suite uitgebreid van 8 naar 12 cases — TPs-priority over hindsightExit, partial-hit fallback, beide leeg → null.

### Voor de community
- **Heb je BT/paper trades met TPs aangevinkt op hit (✓)?** Bij update werkt analytics direct — geen extra werk. De Trust-Score, BT-vs-Real en Win-rate worden automatisch berekend uit de TP-data die al in je trade zit.
- **Geen TPs aangevinkt?** Twee opties:
  1. Vink je TPs aan op `hit` in de trade-modal (toggle-cyclus is open → missed → hit, dus 2 clicks per TP).
  2. OF vul handmatig een Backtest/Paper Exit-prijs in onder de gelijknamige sectie.

---

## [v12.112] — 2026-05-08

UX-fix op v12.111: voor backtest/paper trades was de exit-prijs verstopt achter een collapsible "🔮 Hindsight (optioneel)" sectie, defaultOpen=false. Daardoor sloegen gebruikers het over en kregen geen analytics. Nu prominenter en context-specifiek.

### Gewijzigd
- **Backtest/Paper exit-veld is nu prominent** *(2026-05-08, gemeld door Denny — 10 BT trades zonder hindsightExit ondanks v12.111 fix)* — Het `hindsightExit` veld krijgt nu per `simType` een aangepaste presentatie:
  - **Backtest** (`simType="backtest"`): Section title `🎯 Backtest Exit`, input label `BACKTEST EXIT (waar sloot je in je replay)`, defaultOpen=true, hint `vereist voor analytics ⚠`. Beschrijving: *"Vul je werkelijke exit-prijs in uit de chart-replay. Zonder dit blijven stats leeg."*
  - **Paper** (`simType="paper"`): zelfde behandeling met titel `🎯 Paper Exit`, label `PAPER EXIT (waar sloot je op demo-account)`.
  - **Missed** (legacy/real-time gespot): blijft `🔮 Hindsight (optioneel)` zoals voorheen — daar is het inderdaad optioneel voor edge-leak analyse.
- **Visuele waarschuwing als veld leeg is op vereiste-trade**: input-border kleurt amber, beschrijving krijgt amber-tint. Wanneer ingevuld → standaard styling + ✓ in hint.

### Aanpak
- Geen logica-verandering, alleen presentatie. Bestaande `trade.hindsightExit` veld blijft de bron — voor BT/paper is het functioneel hetzelfde als de "exit" zou zijn voor closed real trades, alleen onder een andere naam.
- Section auto-opent alleen wanneer het vereist EN nog leeg is. Wanneer ingevuld → collapsed (default), geen visuele clutter.

### Voor de community
- Bij update naar v12.112: open een bestaande BT of paper trade → de "Backtest Exit" / "Paper Exit" sectie staat automatisch open met amber border. Vul de prijs in → analytics werkt.

---

## [v12.111] — 2026-05-08

Hotfix op v12.110: Trust-Score telde alleen trades **met** hindsightExit. 10 BT trades zonder hindsight stonden nog steeds op "Idee" met "0 trades totaal". Nu gefixt — sample-size telt onafhankelijk van R-data.

### Fixed
- **Trust-Score `classifyTrust` count gebaseerd op status+simType, niet hindsightExit** *(2026-05-08, gemeld door Denny — 10 BT trades zonder hindsight bleven op Idee)* — v12.110 gebruikte `playbookErosionStats` voor counts, welke hindsightExit vereist. Daardoor: BT trades zonder hindsightExit telden niet mee → Trust-Score bleef op Idee. **Fix**: `classifyTrust` doet eigen pass over `tradesForPlaybook` met dezelfde filter als `_pbBucketBySource` (status+simType). R-aggregatie gebruikt alleen subset met geldige R-data.
  
  Resultaat voor 10 BT zonder hindsightExit:
  - Voor: stage=Idea, "0 trades totaal"
  - Na: stage=**Tradeable**, "10 trades totaal, geen R-data nog"
- **Bewezen vereist nu ook 5+ trades MET R-data** — voorheen kon 1 trade met +2R en 9 zonder hindsightExit theoretisch Bewezen triggeren. Nu: `nWithR >= 5 AND avgR > 0.3R AND total >= 5`. Voorkomt dat één lucky trade het stempel "Bewezen" forceert.
- **Trust-rule bericht differentieert nu drie scenarios** voor non-Bewezen:
  - Sample te klein (`total < 5`): "Nog X trades nodig"
  - Sample oké, R-data incompleet (`nWithR < 5`): "Vul hindsightExit in op X extra trades (= 5+ met R-data) voor Bewezen"
  - Sample + R-data oké maar edge te laag (`avgR <= 0.3R`): "Edge nog te laag (huidige avg X.XXR, nodig >0.3R)"

### Aanpak
- `classifyTrust` retourneert nu ook `nWithR` voor de UI-message-logica.
- Test-suite uitgebreid van 10 → 13 cases — partial-hindsight scenarios (8 zonder + 2 met) + 10 zonder hindsight + 5 zonder edge-data.

### Voor de community
- Geen actie nodig. Bij update toont Trust-Score nu correct het aantal totaal-trades. Vul `hindsightExit` op je trades om Bewezen-status te ontgrendelen.

---

## [v12.110] — 2026-05-08

Trust-Score type-agnostisch: alle trade-types (real + paper + backtest + missed) tellen nu mee, drempel voor Bewezen verlaagd van 16 real → 5 totaal.

### Gewijzigd
- **`classifyTrust` drempels herzien** *(2026-05-08, gevraagd door Denny)* — Vóór: progressie naar Bewezen vereiste **16 real trades** met avgR > 0.3R. Voor playbooks die voornamelijk via backtest/paper/missed worden gebouwd was Bewezen-status onbereikbaar zonder veel real-money handel. **Nu**: type-agnostische progressie:
  - **Idee** — 0 trades
  - **Theorized** — 1+ trade (any type)
  - **Validated** — 2+ trades
  - **Tradeable** — 4+ trades
  - **Bewezen** — 5+ trades **én** weighted-avg R > 0.3R
- **Aggregaat avgR over alle types** — Bewezen-criterium gebruikt nu een gewogen gemiddelde over real/paper/backtest/missed buckets ipv alleen real-avgR. Sample-size telt; edge-vereiste blijft >0.3R.
- **Trust-rule bericht aangepast** in PlaybookAnalyticsView — toont totaal aantal trades over alle types met aggregaat avgR. Specifieke waarschuwingen voor twee scenarios:
  - Sample te klein: "Nog X trades nodig"
  - Sample oké, edge te laag: "Sample-size oké, maar edge nog te laag (huidige avg X.XXR, nodig >0.3R)"
- **`classifyTrust` retourneert nu `total` en `totalAvgR`** velden voor downstream gebruik.

### Aanpak
- `playbookErosionStats` skipt missed-trades (bewust, om edge-erosion analysis schoon te houden), maar `classifyTrust` voegt missed nu apart toe via `hindsightExit`-derivatie.
- Test-suite: 10 logic-cases in `tests/trust-score-thresholds.js` — alle stages, edge-cases (5 trades met avgR<0.3 = Tradeable niet Bewezen), Denny's specifieke scenario (10 BT trades).

### Voor de community
- Geen actie nodig. Bij update naar v12.110 worden bestaande playbooks heractiveerd op de nieuwe drempels — een playbook met bv. 10 backtest trades met avg +0.5R komt direct op Bewezen-status.

---

## [v12.109] — 2026-05-08

Win/Loss zichtbaar maken op backtest/paper/missed trades + Playbook Analytics werkt nu ook zonder hindsightExit (toont count + hint).

### Toegevoegd
- **W/L-indicator op trade-rij voor BT/paper/missed** *(2026-05-08, gemeld door Denny)* — Trades met `status="missed"` (= backtest/paper/missed) hadden voorheen alleen het bron-badge (🔬 BT / 📝 PAPER / 👻 MISS) maar geen win/loss-aanduiding. **Nu**: badge krijgt een ✓ (groen) of ✗ (rood) icon op basis van theoretische R uit `hindsightExit`. Tooltip toont exacte R-waarde. Vereist dat user `hindsightExit` invult.
- **Theoretische PnL + R-multiple in trade-tabel** — PnL-kolom toont `~+$28.57` (italic, theoretisch label) voor missed trades met hindsightExit. R-multiple kolom idem `+2.0R` italic. EXIT-kolom toont `~72000` (italic) als hindsightExit beschikbaar.
- **Twee nieuwe helpers**: `calcTheoreticalR(trade)` en `calcTheoreticalPnl(trade)` — apart van `calcRMultiple` zodat real-edge-stats voor closed trades NIET gevuld worden door theoretische missed-data.

### Fixed
- **Playbook Analytics toonde "Geen backtest trades" terwijl source-pill 10 zei** *(2026-05-08, gemeld door Denny)* — Mismatch tussen twee functies: `_pbBucketBySource` (voor source-pill counts) telde puur op status+simType, terwijl `playbookErosionStats` (voor KPI's) ook `hindsightExit` vereiste om R te kunnen berekenen. Resultaat: 10 BT trades ingevuld zonder hindsightExit → pill toont 10, KPI's tonen "geen trades". **Fix**: `_srcStats` gebruikt nu count uit `_pbBucketBySource`. Stats (wr/avgR) komen alsnog uit erosion — als die 0 zijn omdat hindsightExit ontbreekt, toont KPI "—" met goud-amber hint:
  > 💡 Stats nog niet beschikbaar. Vul hindsightExit in op je 10 backtest trades om Win-rate, Avg R en theoretische PnL te zien.
- Geldt identiek voor paper en missed trades.

### Aanpak
- Test-suite: 8 logic-cases in `tests/theoretical-r-logic.js` — long/short, win/loss, missing fields, edge-cases.
- Status-badge-render: tooltip op ✓/✗ icon toont de exacte theoretische R.
- Cum.PnL-kolom: blijft "theor." labelled bij BT/missed wanneer wExit beschikbaar — nu uitgebreid met hint wanneer hindsightExit ontbreekt.

### Voor de community
- Geen actie nodig voor **closed trades** met PnL (= real). Werkt zoals voorheen.
- **Heb je backtest/paper/missed trades?** Vul `hindsightExit` (in trade-modal onder "🔮 Hindsight (optioneel)") in om W/L badges te zien + Playbook Analytics KPI's te ontgrendelen. Zonder hindsightExit: trades blijven zichtbaar maar zonder win/loss-data.

---

## [v12.108] — 2026-05-08

Uitbreiding op v12.107 close-button: dezelfde knop verschijnt nu ook bij **al-gesloten** handmatige trades wanneer de opgeslagen PnL afwijkt van wat de hit-TPs samen suggereren. Klik = bijwerken, met manualOverrides-bescherming.

### Toegevoegd
- **Knop heeft nu twee modes** *(2026-05-08, gemeld door Denny op eigen closed trade waar PnL=$12.50 stond maar 4 hit-TPs samen +$24.38 zouden geven)*:
  - `mode="close"` — trade is `open`/`partial` met sum-of-hit-pcts ≥ 100%. Knop: groen `✓ Trade sluiten · PnL: +$24.38 · Exit: $81450`. Klik = status closed + PnL/exit/closeTime gevuld.
  - `mode="update"` — trade is `closed`, sum-of-hit-pcts ≥ 100%, opgeslagen PnL wijkt > $1 af van TP-totaal. Knop: amber `🔄 PnL bijwerken naar TPs · was +$12.50 → +$24.38`. Klik = pnl/exit bijgewerkt naar TP-berekening, status blijft closed, closeTime onveranderd.
- **$1 drempel** voorkomt dat de knop opduikt door floating-point noise of micro-fee-verschillen.
- **manualOverrides bescherming** blijft werken in beide modes — als gebruiker `pnl` of `exit` handmatig heeft gezet (en dus in `manualOverrides` staat), worden die niet overschreven bij klik.

### Aanpak
- Single component-niveau wijziging: `closeData` returnt nu een object met `{mode, netPnl, wExit, hitCount, currentPnl?}`. Knop-styling en label conditioneel op mode. Toast wisselt tekst.
- Test-suite uitgebreid van 9 naar 12 cases — drempel-test, update-mode reconciliatie tegen Jordy's $24.38 vs $12.50 scenario, en applyClose-edge-cases (status onveranderd, closeTime bewaard).

### Voor de community
- Geen actie nodig. Bij update naar v12.108 verschijnt de knop automatisch op trades waar 'ie van toegevoegde waarde is.
- **Use case**: heb je een trade die je in het verleden handmatig hebt gesloten met een single exit-prijs/PnL maar inmiddels alle hit-TPs hebt aangevinkt? De knop springt op met de TP-derived PnL als suggestie. Klik = synced. Alle individuele TP-winsten correct gerepresenteerd in de cumulative PnL.

---

## [v12.107] — 2026-05-08

UX-verbetering voor handmatig ingevoerde trades, gemeld door Jordy in de community. Bij 100% van de TPs aangevinkt verschijnt een prominente "✓ Trade sluiten" knop met de berekende PnL en exit. Klik = sluit trade in één keer met juiste velden.

### Toegevoegd
- **"✓ Trade sluiten" knop bij 100% TP-hit op handmatige trades** *(2026-05-08, gemeld door Jordy in Discord)* — Vóór: bij een handmatige trade alle TPs aanvinken liet de trade "open" staan. Gebruiker moest 3 stappen handmatig doen: status omzetten naar "Closed", exit-prijs invullen, en de "Verwacht: $X" waarde overtypen naar het PnL-veld. **Nu**: zodra je voor `source==="manual"` trades met status `open`/`partial` de som van **hit**-TP-percentages ≥ 100% bereikt, verschijnt onder de TP-lijst een prominente knop:
  > **✓ Trade sluiten · PnL: +$21.43 · Exit: $71500**
  
  Klik → trade krijgt automatisch:
  - `status: "closed"`
  - `pnl: <netto-PnL>` (= som van per-TP profit minus fees, zelfde formule als `calcProfit` fallback). Niet overschreven als `manualOverrides.pnl` is gezet.
  - `exit: <pct-gewogen avg van hit-TP prijzen>`. Niet overschreven bij `manualOverrides.exit`.
  - `closeTime: Date.now()` (alleen als nog leeg).
  - Toast "✓ Trade gesloten — PnL: ±$X.XX" als bevestiging.
- **Knop kleurt mee met PnL**: groen (winst) of amber (verlies) zodat de uitkomst direct visueel duidelijk is vóór klik.
- **Geen auto-close**: jij houdt controle. Verkeerde TP per ongeluk aangevinkt? Knop verschijnt, maar zolang je niet klikt blijft de trade open. Aanvinken ongedaan maken → knop verdwijnt vanzelf.
- **Reopen-by-remove werkt impliciet**: verwijder een TP die de sum naar <100% drukt → knop verdwijnt automatisch (geen state-mutatie nodig).

### Aanpak
- Single component-niveau wijziging in `TradeForm` op [tradejournal.html:5419-5470](work/tradejournal.html#L5419) — `toggleStatus` blijft eenvoudige toggle, nieuwe `closeData` + `closeManualTrade` helpers, JSX-knop direct na de TP-summary.
- Scope: alleen `source==="manual"` — exchange-trades (MEXC/Blofin/Kraken/Hyperliquid/FTMO) blijven via hun eigen finalize-flow lopen.
- Test-suite: 9 logic-tests in `tests/manual-tp-close-button-logic.js` — closeData berekening (long/short, percentages), exchange-exclusion, manual-override-protect, fees-aftrek, applyClose semantiek.
- Vorige iteratie (v12.106 — onuitgegeven) had auto-close zonder confirmatie. Aangepast naar knop-variant op community-feedback voor betere voorspelbaarheid en geen reopen-edge-cases.

### Voor de community
- Geen actie nodig. Bij update naar v12.107 verschijnt de knop automatisch bij geschikte trades.
- **Hoe gebruik je 'm**: bij een handmatige open trade, vink je TPs aan tot je het groene ✓-icon ziet (toggle-cyclus is open → missed → hit → open, dus 2 clicks om vanaf "open" naar "hit" te gaan). Zodra alle hit-TPs samen ≥ 100% afdekken, verschijnt onderaan de TP-sectie de "✓ Trade sluiten" knop met je berekende PnL. Eén klik = trade dicht.

---

## [v12.105] — 2026-05-08

Hotfix op v12.104: SL-as-TP self-heal was niet **idempotent** — kon falen wanneer een SL-row na een eerdere heal opnieuw werd toegevoegd via een refresh-cyclus. Plus defensieve Number-cast op `_triggerSide` voor robuustheid tegen JSON-roundtrip variaties.

### Fixed
- **Self-heal werkt nu altijd** — v12.104 zette een `_slHealed=true` marker zodat de migratie maar 1× per trade liep. Probleem: als een refresh ná die heal alsnog een SL-row in `tpLevels` zette (bv. doordat de Worker iets terugstuurt vóór de filter kicks in), bleef die staan tot de gebruiker handmatig de TP-rij verwijderde. **Fix**: heal is nu idempotent — geen marker meer, draait bij elke app-load opnieuw. Performance-impact verwaarloosbaar (single-pass over `tpLevels`). Bestaande `_slHealed=true` markers worden bij eerstvolgende load opgeruimd.
- **Pending-fills filter robuuster** — `_triggerSide` wordt nu via `Number(f._triggerSide) === 2` vergeleken. Voorheen `f._triggerSide !== 2` zou strings ("2" uit een rare proxy-roundtrip) niet vangen. MEXC stuurt het als number, maar defensiever schaadt niet.
- **Multi-SL detectie** — als de Worker meerdere SL-rows zou meesturen (zelden, maar mogelijk bij bracket-orders), worden ze nu **allemaal** uit `tpLevels` verwijderd (was: alleen de eerste).

### Aanpak
- Test-suite uitgebreid met `tests/mexc-sl-idempotent-reload.js` — twee scenarios: (a) fresh buggy data, (b) post-heal data waar de SL alsnog opnieuw is geïntroduceerd. Beide krijgen volledige healing bij elke load.
- Bestaande tests `mexc-sl-self-heal.js` en `mexc-sl-protect-manual.js` aangepast — verwachten geen `_slHealed=true` marker meer.

### Voor de community
- **Heb je v12.104 geupdate maar zie je nog steeds een TP-rij op de SL-prijs (bv. 81000 voor een short bij entry 80552)?** Update naar v12.105 → bij eerstvolgende app-load wordt 'ie alsnog gecorrigeerd.
- Geen actie verder nodig.

---

## [v12.104] — 2026-05-08

MEXC stop-loss orders verschenen foutief als TP-rij in de trade-modal. Nu correct gefilterd + auto-geplaatst in `trade.stopLoss`. Bestaande buggy trades worden automatisch geheald bij eerstvolgende app-load.

### Fixed
- **Pending stop-loss orders verschenen als TP-niveau** *(2026-05-08, gemeld door Denny — BTC short positionId 1367600842 toonde SL=81000 als TP2)* — De Cloudflare Worker stuurt pending stop-loss orders (`triggerSide=2`) mee in de pending-fills lijst voor MEXC, met `_triggerSide` als marker. Vorige versie filterde die marker niet en zette ze door naar `tpLevels` met status `"open"`. Resultaat: een SHORT met SL=81000 (boven entry 80552.7) toonde 81000 als "TP2" met negatieve "winst". **Fix**: client filtert pending-fills op `_triggerSide !== 2` voor TP-conversie en routeert SL-orders naar `trade.stopLoss` (= hoogste-volume SL als heuristiek). Manueel ingestelde stopLoss (in `manualOverrides`) wordt expliciet niet overschreven.
- **Self-heal voor bestaande buggy trades** — Trades die de SL als TP-rij hadden krijgen automatische correctie via `normalizeTrade`: detecteer status="open" tpLevel waar prijs aan de SL-zijde ligt (boven entry voor short, onder voor long) → verplaats prijs naar `trade.stopLoss` (alleen als die leeg is) en verwijder uit `tpLevels`. Marker `_slHealed=true` voorkomt dubbele migratie.

### Aanpak
- **Twee verdedigingslagen**:
  1. Worker-response filter in [refresh-flow](work/tradejournal.html#L11409) — fix komt direct binnen voor nieuwe syncs
  2. Self-heal-migratie in [`normalizeTrade`](work/tradejournal.html#L1442) — corrigeert bestaande data bij eerstvolgende load
- **Worker-fix als backlog** (BACKLOG.md): de Cloudflare Worker zelf zou `triggerSide=2` netter kunnen retourneren met een aparte `_pendingStop` marker zodat de classificatie aan de bron gebeurt. Voor nu doet de client de juiste split via het bestaande `_triggerSide`-veld dat de Worker al meelevert (zie [proxy-local/worker.js:149](proxy-local/worker.js#L149) als referentie).
- **Test-suite uitgebreid**: 4 nieuwe tests in `tests/mexc-sl-*.js` covering pure-logic, in-browser filter, self-heal voor buggy data, en bescherming van manuele edits.

### Voor de community
- Geen actie nodig. Bij update naar v12.104 worden bestaande trades waar de SL als TP-rij verscheen automatisch gecorrigeerd bij eerstvolgende app-load. De SL-prijs verschijnt dan in het `Stop Loss` veld; de TP-rij verdwijnt uit de modal.
- Heb je zelf de stopLoss handmatig ingevuld voor een trade? Die blijft bewaard — self-heal raakt 'm niet aan.

---

## [v12.103] — 2026-05-08

MEXC partial-close-still-open positie: `positionSizeAsset` werd te klein opgeslagen (alleen resterende deel), waardoor TP-percentages > 100% en TP-winst-berekeningen factor-fout werden. Geïsoleerd in MEXC-adapter.

### Fixed
- **MEXC `fetchOpenPositions`: positionSizeAsset gebruikt origineel = `holdVol + closeVol`** *(2026-05-08, gemeld door Denny via snapshot mexc-snapshot-2026-05-08-06-39.json)* — Bij open positions die al een partial-close hebben gehad levert MEXC `holdVol` (resterend) en `closeVol` (al gesloten). Vorige versie gebruikte alleen `holdVol` voor `_convertContracts`. Symptoom: BTC short positionId `1367600842` had originele 0.0247 BTC (= 247 contracts), maar journal sloeg `positionSizeAsset = 0.0124` op (alleen de resterende 124 contracts). Resultaat: TP1 toonde 49.8% correct (pct opgeslagen op fill-tijd tegen original), maar TP2 toonde **199.2%** want pct = `qty(0.0247) / stored(0.0124) × 100`. Plus warning "Totaal 249% > 100%". **Fix**: `totalVol = (parseFloat(p.holdVol)||0) + (parseFloat(p.closeVol)||0)` als basis voor `_convertContracts`. Reconciliatie volledig gevalideerd via `tests/mexc-partial-open-fix.js` + in-browser test `tests/mexc-partial-open-browser.js`.

### Aanpak
- **Self-heal**: `syncOpenPositions` overschrijft `positionSize` en `positionSizeAsset` automatisch bij volgende refresh (geen ALWAYS_PROTECT-veld). Een `🔄 Refresh trades` op MEXC voldoet om bestaande buggy data te corrigeren.
- **Bewaard voor debug**: nieuwe `_rawHoldVol` en `_rawCloseVol` velden op de trade voor toekomstige diagnose van soortgelijke partial-close-states.
- **TP-percentages opnieuw berekenen**: helaas blijven al-opgeslagen `tpLevels[i].pct` waarden (zoals 199.2%) staan tot de gebruiker handmatig de TP wijzigt OF de trade volledig sluit (waarna `positionsHistory` finalisatie plaatsvindt). Voor nu = manual action; auto-heal van TP-pct staat op de backlog voor v12.104+.

### Voor de community
- Doe één **🔄 Refresh trades** op MEXC na update — dat herstelt `positionSize` + `positionSizeAsset` voor alle open positions die al een partial-close hadden.
- Toon je playbook nog TP-percentages > 100% in een specifieke trade? Open de trade-modal, verwijder de offending TP-rij en voeg 'm opnieuw toe — pct wordt dan herberekend tegen de juiste base.

---

## [v12.102] — 2026-05-07

Nieuwe **Playbook Analytics dashboard** als sub-view in de Playbook-pagina (Phase 1). Beantwoordt de vraag *"vertaalt mijn backtest-edge naar real?"* met source-filtering (real/bt/paper/missed), Trust-Score progressie en multi-source equity curve.

### Toegevoegd
- **View-toggle in PlaybookPage** — knoppen `📋 Lijst | 📊 Analytics` bovenaan de Playbook-pagina (regel ~8650). De lijst-view bestaat zoals voorheen; Analytics opent een nieuw dashboard scoped op een gekozen playbook.
- **Source-toggle pills** (Alles · Real · Backtest · Paper · Missed) — per bron live counts uit `simType` (`real` = `status!="missed"` met PnL; `bt` = `simType==="backtest"`; `paper` = `simType==="paper"`; `missed` = legacy/real-time gespotte trades). Buttons worden disabled als de bron 0 trades heeft.
- **Trust-Score progressie** (5-stappen stepper Idee → Theorized → Validated → Tradeable → Bewezen) — hergebruikt de bestaande `classifyTrust(pb, allTrades)` helper. Active-stap is goud, voltooide stappen groen, "Bewezen"-eindstap krijgt een ★ marker.
- **Backtest vs Real card** — drie-koloms vergelijking (BT / Real / Δ) met automatische verdict ("Edge bevestigd" als WR-gap <10pp en R-gap <0.5R, anders "Significante execution-gap"). Verschijnt alleen wanneer er BT én Real trades zijn.
- **Headline KPI's strip** (6 cellen: Trades · WR · Avg R · Expectancy · Cum. PnL · Compliance) — scope volgt source-toggle. Cum. PnL toont *theoretisch* voor BT/missed.
- **Equity Curve · USD met multi-source toggle** — smooth Catmull-Rom interpolatie, Y-as in dollars (`+$504`, `+$1.2k`), datum X-as, groen-fill boven nullijn / rood-fill onder via clip-paths, dual-line overlay met dashed lijnen per bron (BT 5-4, Paper 2-3, Missed 1-3). HIGH/END stats top-right. Per playbook real-time berekend uit `netPnl(t)` (real) of `((hindsightExit-entry)*dirSign)/Math.abs(entry-stopLoss) * riskUsd` (theoretisch voor BT/paper/missed).

### Aanpak
- **Phase 1 = kern** (filter + source-toggle + Trust + BT-vs-Real + KPIs + Equity). Hergebruikt bestaande helpers: `tradesForPlaybook`, `playbookStats`, `playbookErosionStats`, `classifyTrust`, `playbookMissedStats`, `netPnl`.
- **Phase 2 (volgt)**: Sessie × Weekday heatmap, Criteria-impact ranking met lift-score, Mistake/Emotion-tag rankings, Missed-opportunities detail-card. Vereisen nieuwe groupBy-helpers — bewust overgeslagen voor reviewbare commit.
- Twee nieuwe componenten: `PlaybookAnalyticsView` + `PlaybookEquityCurve`. Helpers (`_pbBucketBySource`, `_pbEquityReal`, `_pbEquityTheoretical`, `_pbSmoothPath`, `_pbFmtUsd`) zijn private (underscore-prefix) om niet met andere `playbook*` helpers te clashen.
- **Demo-first traject**: v3-interactief in [demos/analytics-playbook-filter-demo-v3-interactief.html](demos/analytics-playbook-filter-demo-v3-interactief.html) iteratief getuned vóór integratie.

### Voor de community
- Geen actie nodig. Bij update naar v12.102 verschijnt automatisch de view-toggle in Playbook → Analytics.
- Voor de meeste waarde: koppel een reeks trades aan een playbook (via `playbookId` of overlappende `setupTags`), en log een mix van real-trades én backtest-trades (via Mark als → 🔬 Backtest in TradeForm) zodat de Backtest-vs-Real validatie zinvol vergelijkt.

---

## [v12.101] — 2026-05-06

Twee Kraken open-positions bugs gefixt in `_normalise`. Geïsoleerd in de Kraken-adapter — geen impact op MEXC/Blofin/Hyperliquid/FTMO.

### Fixed
- **Direction omgekeerd voor Kraken open posities** *(gemeld door Denny op live BTC long)* — Kraken's `/derivatives/api/v3/openpositions` endpoint geeft `side: "long"` of `side: "short"`, géén `"buy"`/`"sell"`. De `_normalise` viel terug op `t.side === "buy" ? "long" : "short"` waardoor élke open Kraken-positie als **short** in het journal terecht kwam. **Fix**: matchen op zowel `"buy"` als `"long"` (case-insensitive). Closed Kraken-trades waren niet geraakt — die kregen `direction` direct van de Worker.
- **Instabiele id voor Kraken open posities** — Kraken's openpositions endpoint heeft géén `fill_id`, dus de fallback `uid()` genereerde bij elke re-sync een nieuwe random id → riskeerde duplicaten in de trade-lijst. **Fix**: voor open posities is de id nu `kraken_open_${symbol}_${fillTime}_${side}` — deterministisch, idempotent over re-syncs heen. Closed trades blijven hun `fill_id` van de Worker gebruiken.

### Voor de community
- Geen actie nodig voor closed Kraken-trades.
- **Heb je nu een open Kraken-positie in je journal?** Verwijder 'm één keer en doe een refresh — de fresh sync schrijft 'm met correcte direction én stabiele id terug. Vanaf v12.101 ontstaat de bug niet meer.

---

## [v12.100] — 2026-05-06

Kraken trade-import client-side fixes ter ondersteuning van Worker v11. Maakt Kraken trades zichtbaar met correcte position-size + TPs + auto-heal voor bestaande buggy trades zonder verlies van handmatige edits.

### Fixed
- **Kraken `_normalise` positionSize bug** — `positionSize` werd op de raw `size` (BTC qty) gezet, gelijk aan `positionSizeAsset`. Resultaat: modal toonde "Position ($) = 0.00120000" identiek aan "Position (BTC) = 0.00120000". **Fix**: `positionSize = size × entry_price` (USD-notional). `positionSizeAsset` blijft de BTC qty.
- **Kraken trades hadden geen TPs** — Kraken trades hebben geen positionId, dus de needsTPs filter skipte ze altijd. **Fix**: Worker v11 levert nu `tpLevels` array per trade gebouwd uit de close-fills (1 TP per fill = correct voor partial-close trades). Client passthrough via `_normalise`.
- **Auto-heal voor bestaande Kraken trades met buggy data** — `importTrades` filterde duplicates op id, dus bestaande trades met `positionSizeAsset: "0.00000000"` of `exit: "0"` werden nooit overschreven met fresh data. **Fix**: detecteer source=kraken trades waar bestaande data buggy is EN incoming data correct is → overschrijf alleen fix-velden (`size`, `exit`, `positionSize`, `positionSizeAsset`, `tpLevels`, `fillTime`, `pnl`, `fees`). **Behoud** alle user-edits: notes, tags, screenshots, playbook-koppelingen, ratings, complianceChecks. Toast toont nu `${healedCount} bijgewerkt` naast nieuwe trades.

### Aanpak
- Geen actie nodig voor community-leden. Bij refresh na Worker v11 deploy worden bestaande Kraken trades automatisch bijgewerkt zonder verlies van handmatige edits.
- Patroon herbruikbaar voor toekomstige bugs in andere exchanges (= "self-healing import" architectuur).

### Voor de community
1. Deploy Worker v11 in Cloudflare (zie [worker-patches/v11-online-worker.js](worker-patches/v11-online-worker.js))
2. Update naar v12.100 via Instellingen → Accounts → Check voor updates
3. Eén refresh op Kraken → bestaande 37 trades worden automatisch ge-update met correcte size/exit/TPs

---

## [v12.99] — 2026-05-06

Auto-sync intervallen aangepast voor community-schaal + nieuwe gecombineerde sync flow + jitter + last-sync indicator. Plus universele positionSize self-heal voor alle exchanges (was MEXC-only).

### Fixed
- **PositionSize self-heal werkt nu voor alle exchanges** — Bulk-analyse op community-data wees uit dat ook Blofin trades de factor-bug kunnen hebben (in jouw backup: 9 trades met factor-issue, waarvan 3 echte bugs met ratio 0.06 = factor 17 verschil). Pre-v12.90 Blofin had eigen "mixed-units" issue (contracts vs base currency) waardoor `positionSizeAsset` factor-fout werd opgeslagen. **Fix**: migratie in `normalizeTrade` heeft de `out.source === "mexc"` filter laten vallen — werkt nu voor élke source met geldige entry/exit/pnl/asset (Blofin, MEXC, Hyperliquid). Kraken niet (andere field-names, separate ticket op backlog).

### Gewijzigd
- **Auto-sync intervallen 30sec/1min/2min → 15min/30min/1uur** — De korte intervallen waren technisch werkbaar voor solo-gebruik, maar **niet schaalbaar** voor de community via gedeelde Cloudflare Worker. Bij 50+ users tegelijk via dezelfde Worker IP zou MEXC's rate-limit (20 reqs/sec) overschreden worden bij 30sec interval. Plus Cloudflare free-tier (100K reqs/dag) zou snel vol raken. Nieuwe intervallen zitten ruim binnen alle limits.
- **Eén gecombineerde sync per cyclus** — Voorheen aparte useEffects voor `fetchOpenPositions` (live PnL) en `fetchTrades` (historisch). Nu één useEffect die beide doet per gekoppelde exchange. Voor users die "Auto-sync = Uit" hebben: alles werkt zoals altijd via de manuele "🔄 Refresh trades" knop.
- **Jitter (0-30s random offset)** bij elke setInterval-start. Voorkomt dat alle community-users tegelijk om :00 / :15 / :30 syncen → minder kortstondige spikes op Cloudflare + exchange-side.

### Toegevoegd
- **"Laatst gesynchroniseerd: X geleden" indicator** onder de Auto-sync setting in Voorkeuren. Toont de meest recente sync-tijd plus per welke exchanges. Persisteert via `tj_last_sync_times` localStorage zodat info ook na reload zichtbaar is.

### Code-changes
- Nieuwe config-key `autoSyncMin` (in minuten). Oude `autoRefreshOpen` (seconden) en `syncInterval` blijven in storage als dode-code voor backwards-compat — geen breaking change voor users die deze legacy-keys hebben.
- Twee oude useEffects (`autoRefreshOpen` poll + `syncInterval` poll) vervangen door één gecombineerde useEffect.
- Default `autoSyncMin = 0` (uit) bij upgrade — users moeten zelf kiezen om auto-sync aan te zetten.

### Voor de community
- Geen actie nodig. Default staat Auto-sync op "Uit" — werk dezelfde manier als nu (manuele refresh op exchange-pagina).
- Wil je auto-sync? Voorkeuren → Auto-sync → kies 15/30/60 min. Live posities + nieuwe trades komen dan automatisch binnen op dat interval.

---

## [v12.98] — 2026-05-06

Drie-lagen positionSize fix voor MEXC trades + Auto-sync UI vereenvoudigd naar één setting. v12.96 self-heal had één gat: trades met **lege** `positionSizeAsset` werden niet gecorrigeerd. Zichtbaar bij Denny's trade van vandaag (closeTime 2026-05-06 10:32) met `positionSize="72"` en `positionSizeAsset=""`.

### Fixed (positionSize self-heal)
- **Lege `positionSizeAsset` wordt nu ook gehealed** — Migratie in `normalizeTrade` verbreed: heal als `assetEmpty || ratio>2 || ratio<0.5`. Voorheen alleen bij ratio-mismatch (vereiste niet-lege asset → parseFloat("")=NaN→0 faalde de `asset > 0` check).
- **`_convertContracts` valt zelf terug op `_ctvFallback`** als cache leeg is (race-condition-vrij). Voorkomt dat de bug-state ooit ontstaat voor coins in fallback-map (BTC/ETH/SOL/etc.).
- **`fetchTrades` mapping krijgt pnl-derivation als laatste vangnet** — als ctSize toch 0 blijft (exotic coin niet in fallback-map zoals PEPE/WIF), bereken `positionSizeAsset` direct uit `(realised + fees) / |exit-entry|`. PnL is autoritatief (= MEXC `realised`, netto sinds v12.88).

### Aanpak — drie verdedigingslagen voor positionSize
- **Laag 1** (root, `_convertContracts`): cache OR fallback-map → assetQty correct voor alle pairs in fallback-map zelfs zonder warming
- **Laag 2** (defense, `fetchTrades`): pnl-derivation als laatste vangnet voor exotic coins
- **Laag 3** (heal, `normalizeTrade`): bestaande trades met lege OF factor-fout asset worden gecorrigeerd bij eerstvolgende app-load
- Relatieve priceMove-drempel (`> entry * 1e-9`) zodat ook microcap coins (PEPE etc.) gecorrigeerd worden

### Gewijzigd (UI-cleanup)
- **Auto-sync vereenvoudigd van twee settings naar één** — Voorkeuren had twee aparte intervallen ("Auto-sync interval" 15-60 min voor historische trades + "Live open posities" 30s-2min voor live PnL). Verwarrend en in praktijk weinig nut: live PnL is wat users continu willen zien, nieuwe historische trades komen sowieso binnen via de "🔄 Refresh trades" knop op de exchange-pagina. **Fix**: één setting "🔄 Auto-sync" (Uit / 30sec / 1min / 2min) die live posities ververst. Description vertelt expliciet voor historische trades de refresh-knop te gebruiken. `config.syncInterval` is dode code geworden — backwards-compat behouden door state niet te wissen.

### Toegevoegd
- **Drie-lagen test-spec** ([tests/mexc-size-rehel-v1297.spec.js](tests/mexc-size-rehel-v1297.spec.js)) — 4 scenarios: lege asset wordt gehealed (Denny's trade pid 1364821115), `_convertContracts` gebruikt fallback-map, exotic coin pnl-derivation werkt voor microcap, correcte trade niet aangeraakt.

### Voor de community
Geen actie nodig. Bij update naar v12.98 worden trades met lege `positionSizeAsset` automatisch gecorrigeerd bij eerstvolgende app-load. Voor nieuwe imports na de update: bug-state ontstaat niet meer dankzij laag 1 + 2.

---

## [v12.96] — 2026-05-06

Self-heal voor legacy MEXC positionSize bug. Trades uit pre-v12.89 era waar de contractSize-conversie faalde (CORS-fail vóór de fallback-map bestond) hadden `positionSize = String(closeVol)` opgeslagen — raw contracts opgevat als USD, factor 8-100× te klein. Symptoom werd zichtbaar nu de TP-breakdown (v12.93+) per-fill winsten toont: `Verwacht totaal $1.78` terwijl PnL `$14.27` was, plus TP-percentage som > 100%.

### Fixed
- **Legacy MEXC positionSize/asset factor-mismatch** *(2026-05-06, gemeld door Denny op tweede profiel met v12.95 + Worker v6)* — Voor élke MEXC closed trade berekent normalizeTrade nu de verwachte asset uit `(pnl + fees) / |exit − entry|` (PnL is autoritatief sinds v12.88 = MEXC `realised` veld). Als de opgeslagen asset >2× of <0.5× afwijkt van die verwachting: corrigeer `positionSizeAsset` + `positionSize` automatisch en zet marker `_sizeRehealed=true` om dubbele migratie te voorkomen. Voor de gevallen trade (pid=1360488693): `0.004185 BTC` / `$336` → `0.0336 BTC` / `$2697` (matcht raw `closeVol × ctSize` uit snapshot). Trades binnen 0.5-2.0× ratio (= normale fee/ronding-variatie) worden niet aangeraakt.

### Aanpak
- Migratie loopt eenmalig per trade bij eerstvolgende app-load via `normalizeTrade`. Geen actie vereist van community-leden.
- PnL-veld blijft onveranderd (was nooit fout — MEXC realised is netto).
- TP-percentages tellen na correctie correct op tot 100% en per-TP winst klopt met PnL.
- Open trades worden bewust overgeslagen — exit kan markprijs zijn ipv echte exit, asset-correctie zou onbetrouwbaar zijn.

### Toegevoegd
- **Self-heal spec** ([tests/mexc-size-rehel.spec.js](tests/mexc-size-rehel.spec.js)) — 5 scenarios: factor-8 mismatch wordt gecorrigeerd, correcte trades blijven onaangeraakt, marker voorkomt dubbele migratie, open trades worden overgeslagen, fees worden correct meegenomen in gross-PnL berekening.

### Voor de community
Geen actie nodig. Bij update naar v12.96 worden eventuele factor-mismatches in MEXC trades automatisch gecorrigeerd bij de eerstvolgende app-load. PnL-totalen veranderen niet — alleen positionSize-display + TP-percentages worden consistent.

---

## [v12.95] — 2026-05-06

Validatie-checklist tab in Instellingen voor systematisch testen van trade-flow per exchange. Community-leden kunnen scenarios afvinken, afwijkingen noteren en een rapport-PNG genereren om naar Discord te sturen.

### Toegevoegd
- **🧪 Validatie tab in Instellingen** — naast Accounts / Trading Rules / Goals / Tags / Help. Per exchange (Blofin / MEXC / Kraken / Hyperliquid) × 8 standaard scenarios:
  1. Open trade + SL gezet (live)
  2. Trade met 1 TP, daarna exit
  3. Trade met 2 TPs (partial close)
  4. Live trade tijdens markt-bewegingen
  5. Volledig gesloten trade
  6. Trade die SL hit (verlies)
  7. Trade handmatig gesloten (markt-close)
  8. SL verplaatst tijdens leven (bv. naar BE)
  Per scenario: 4-8 checkboxes voor TPs / fees / PnL / percentages / R-multiple validatie + vrij notitie-veld voor afwijkingen.
- **State persistence** — vinkjes + notities + tester-naam worden opgeslagen in `tj_validation_state` localStorage. Voortgang-teller bovenin (X/Y aangevinkt = Z%).
- **📸 Genereer rapport** — html2canvas-export van de hele checklist als PNG. Bestand: `validation-report-{tester}-{timestamp}.png`. Klaar om naar Discord te sturen.
- **🔄 Reset** — wist alle vinkjes + notities (tester-naam blijft).
- **Tests** — [tests/validation-tab.spec.js](tests/validation-tab.spec.js) (3 scenarios: tab opent + state persisteert, tester-naam veld + voortgang teller, reset werkt) + [docs/exchange-validation-checklist.md](docs/exchange-validation-checklist.md) als bron-document.

---

## [v12.94] — 2026-05-06

Self-healing TP-fetch flow + dev-only TP-coverage diagnostics + schema-invariant tests. Sluit de robustness-roadmap af. Marker is nu officieel een hint, geen autoriteit — de filter beslist op basis van wat de trade écht heeft vs. wat hij zou moeten hebben.

### Fixed
- **"PNL berekenen → Toepassen" knop verscheen ook bij API-imports** — De helper-knop in de trade-edit modal vergeleek de eigen formule `(exit-entry)×size/entry − fees` met de PnL uit de exchange-import, en bood aan de exchange-waarde te overschrijven bij drift >$0.01. Voor MEXC/Blofin/Kraken/Hyperliquid is de exchange echter de bron-van-waarheid (al netto PnL via `realised`/`pnl` velden), en onze formule wijkt licht af door fee-handling verschillen. Klikken zou correcte data overschrijven met een ruwe schatting. **Fix**: knop alleen tonen voor `trade.source === "manual"`. Voor API-imports en CSV-imports blijft de exchange-waarde behouden. Test: [tests/pnl-calc-button.spec.js](tests/pnl-calc-button.spec.js).

### Toegevoegd
- **Self-heal in `needsTPs` filter** (laag 3) — drie automatische triggers re-queuen trades ongeacht marker-status:
  - `onlyFallback`: trade heeft alleen v12.92 positionsHistory fallback-TPs → wil upgraden naar echte history_orders breakdown via v6 Worker
  - `suspectMissing`: closed trade met realised PnL maar 0 hit-TPs en jonger dan 90d → data-gat dat zichzelf moet helen
  - `noTps`: standaard, gerespecteerd door 24u-TTL
  Bij onlyFallback en suspectMissing wordt TTL bewust genegeerd om asap echte data binnen te halen. Effect: na deploy van Worker v6 worden de 116 fallback-trades automatisch opgewaardeerd naar echte history_orders breakdown bij de volgende refresh, zonder dat de gebruiker iets hoeft te wissen.
- **TP-coverage diagnostics panel** (laag 4) — dev-only `📊 TP-coverage` knop in Instellingen → Accounts (`?dev=1`) per exchange met `fetchFills`. Toont totaal closed / met echte TPs / alleen fallback / zonder TPs + marker-status (none/fresh/expired) + leeftijd-distributie + waarschuwingen voor suspect-missing en permanent-stuck markers. Helpt drift detecteren vóór de community 'm meldt.
- **Schema-invariant test-spec** ([tests/mexc-self-heal.spec.js](tests/mexc-self-heal.spec.js)) (laag 5) — 5 self-heal scenarios + 2 schema-invariant checks. Voorkomt dat dit type bug-categorie ooit terugkomt: permanent-stuck markers, suspect-missing zonder marker, fallback-only zonder retry-trigger. Loopt mee in CI.

### Aanpak
Sluit de 3-fase robustness-roadmap af die op 2026-05-06 startte met v12.91 (time-bounded markers). Combinatie:
- **v12.91**: marker boolean → timestamp + invariant-aware setting + one-shot migratie
- **v12.92**: positionsHistory fallback-TP wanneer fetchFills 0 close-fills retourneert
- **v12.93**: proxy switch order_deals → history_orders (Worker re-deploy nodig)
- **v12.94**: self-heal in filter + diagnostics + invariant tests

Resultaat: het permanent-stuck-marker probleem is structureel onmogelijk geworden. Markers kunnen verkeerd staan, fetches kunnen 0 fills retourneren, propagation-delays kunnen optreden — het systeem detecteert het en heelt zichzelf bij elke refresh.

---

## [v12.93] — 2026-05-06

MEXC fetchFills schakelt over van `order_deals` naar `history_orders` voor accurate fill-breakdown bij partial-close trades. **Vereist Cloudflare Worker re-deploy** voor effect op gehoste proxy.

### Fixed
- **MEXC: per-fill TP-breakdown bij partial-close trades** — Onderzoek (zie research 2026-05-06) wees uit dat MEXC's `order_deals` endpoint het `position_id`-filter stilzwijgend negeert én structureel alleen open-fills retourneert. Daardoor zag de client consistent 0 close-fills, en kreeg elke trade hooguit 1 fallback-TP (uit v12.92). **Fix**: in `proxy-local/worker.js` schakelt de MEXC fills-action over naar `/api/v1/private/order/list/history_orders`. Dat endpoint retourneert per record een `positionId` veld (zodat client-side filtering wel werkt) plus voor close-orders alle benodigde velden: `dealAvgPrice`, `dealVol`, `profit`, `totalFee`, `state`. Velden worden in de proxy gemapt naar de bestaande fill-shape (vol/price/profit/fee/timestamp) zodat de client-side parser ongewijzigd blijft. Filter `state=3` (= completed orders). ccxt gebruikt dit endpoint ook als primary source.

### Aanpak
- Voor single-close trades: 1 TP direct uit history_orders (vervangt v12.92 fallback automatisch via merge-flow).
- Voor partial-close trades: meerdere TPs (één per close-order op verschillende prijzen). Bv. een ETH LONG die in 3 stukken wordt gesloten op 3550/3580/3600 toont nu 3 TPs i.p.v. 1 gewogen-gemiddelde.
- Pending TP/SL orders blijven via `stoporder/list/orders` (is_finished=0, state=1) ophalen — die zitten niet in history_orders.
- Fallback-TP uit v12.92 blijft als safety-net wanneer history_orders 0 close-orders oplevert (bv. tijdelijke API-fout of trade buiten history-window).

### Toegevoegd
- **history_orders parsing spec** ([tests/mexc-history-orders.spec.js](tests/mexc-history-orders.spec.js)) — 4 scenarios: single-close, multi-close partial, open-orders worden geskipt, field-mapping aansluit op client-parser.

### Deploy-instructies
- **Lokaal testen**: gebruik `wrangler dev` tegen `proxy-local/worker.js`.
- **Hosted Worker**: na deploy is de fix direct actief voor alle community-leden. Check `_sources._endpoint: 'history_orders'` in de fills-response om te bevestigen dat de nieuwe versie draait.

---

## [v12.92] — 2026-05-06

MEXC trades zonder TP-niveaus krijgen nu automatisch een fallback-TP uit de positionsHistory data. Lost het stuck-trades probleem direct op zonder extra API-calls of Worker-deploy.

### Fixed
- **MEXC: 116 closed trades zonder TP's krijgen nu fallback-TP** *(diagnose 2026-05-06 — vervolg op v12.91 markers fix)* — Onderzoek wees uit dat MEXC's `order_deals` endpoint close-fills niet betrouwbaar levert: het `position_id`-filter wordt stilzwijgend genegeerd én het endpoint retourneert structureel alleen open-fills (side 1/3). Daarom kreeg de TP-fetch flow consistent 0 close-fills. **Fix**: in de refresh-handler, wanneer fetchFills 0 close-fills oplevert voor een MEXC closed trade met geldige `exit` + `closeTime`, genereer 1 fallback-TP op `closeAvgPrice` (gewogen gemiddelde van alle close-fills volgens positionsHistory aggregaat). Voor partial-close trades is dit 1 gemiddelde TP i.p.v. een per-fill breakdown — beter dan niets, en wordt automatisch vervangen door echte fills wanneer v12.93 (proxy switch naar `history_orders`) landt. Werkt voor alle 116 stuck trades inclusief 10 oudere die niet meer in de huidige positionsHistory page staan (data zit al opgeslagen in journal-record). Alleen actief voor MEXC; andere exchanges ongewijzigd.

### Toegevoegd
- **Fallback-TP spec** ([tests/mexc-fallback-tp.spec.js](tests/mexc-fallback-tp.spec.js)) — 4 scenarios: fallback wordt gegenereerd voor closed trades, niet voor open of voor trades zonder exit, en wordt automatisch vervangen door echte fills via de bestaande merge-flow.

### Aanpak
Tweede fase van robustness-roadmap (v12.91 was time-bounded markers). v12.93 zal de proxy switchen naar `history_orders` voor echte fill-breakdown bij partial-close trades — vereist Cloudflare Worker re-deploy. v12.94 brengt self-healing audit en TP-coverage diagnostics.

---

## [v12.91] — 2026-05-06

TP-fetch-markers zijn nu time-bounded en self-healing. Voorkomt structureel dat een eenmalig "0 fills"-antwoord (door propagation-delay of transient API-glitch) een trade *permanent* uit de TP-fetch queue blokkeert. Geldt voor alle exchanges met `fetchFills` (MEXC, Blofin, Hyperliquid).

### Fixed
- **MEXC: 116 trades stonden permanent zonder TP's** *(diagnose 2026-05-06 op community-data Denny)* — De v12.90 marker `_tpFetched: true` werd gezet ongeacht of de fetch fills opleverde. Eénmaal door een transient 0-fills response gemarkeerd, werd een trade nooit meer hergerprobeerd, ook niet als MEXC nadien wel data zou geven. Bij Denny's journal stonden 70% van haar MEXC trades (116/165) zo permanent zonder TP-niveaus. **Root cause**: boolean-marker zonder TTL + zonder invariant-check. **Fix in 3 lagen**:
  1. **Time-bounded markers** — boolean `_tpFetched` vervangen door timestamp `_tpFetchedAt: <ms>`. Skip alleen binnen 24u-TTL — daarna automatisch retry. Voorkomt permanent-stuck states structureel.
  2. **Invariant-aware marker-setting** — marker NIET zetten wanneer `closed && realised≠0 && fills.length=0 && trade <90d oud`. Een gesloten trade met PnL *moet* fills hebben — 0 fills is per definitie verdacht en hoort retry'd te worden. Voor trades ouder dan 90d (= praktische API-archief-grens) accepteren we 0 fills wel als definitief.
  3. **One-shot migratie in `normalizeTrade`** — bestaande `_tpFetched=true && tpLevels=[]` markers worden bij eerste load van v12.91 weggegooid → die 116 trades komen automatisch terug in de fetch-queue. `_tpFetched=true && tpLevels=[N]` (succesvolle markers) krijgen `_tpFetchedAt=now-12u` zodat ze nog binnen TTL liggen en niet onnodig hergerprobeerd worden.

### Toegevoegd
- **TP-fetch retry spec** ([tests/mexc-tpfetched-retry.spec.js](tests/mexc-tpfetched-retry.spec.js)) — 4 scenarios: migratie van stuck markers, migratie van success markers, TTL-skip-logica, invariant-guard tegen suspect-empty markers.

### Aanpak
Eerste fase van een 3-fase robustness-roadmap. v12.92 voegt self-healing audit toe (markers worden hint, niet autoriteit), v12.93 brengt dev-only TP-coverage diagnostics + schema-invariant CI tests. Kraken's TP-gat (alle 37 trades zonder TPs door ontbrekende positionId) staat als aparte ticket op de backlog — andere bug-categorie, eigen fix.

---

## [v12.90] — 2026-05-05

Blofin trade-import is nu accuraat: positie-grootte, TP-detectie, direction en sibling-matching werken correct ook voor stale data. Zes Blofin-specifieke fixes plus één UI-tweak.

### Fixed
- **Blofin: positie-grootte ×1000 fout** — Blofin's `closePositions` en `positions` velden zijn inconsistent: soms in CONTRACTS (1 contract = 0.001 BTC), soms al in BASE CURRENCY. Resultaat: 0.0744 BTC trade werd als 0.0000744 BTC opgeslagen ($0,51 i.p.v. $5.935). **Fix**: PnL-cross-check heuristiek — bereken implied size uit `|realizedPnl + fee| / |exit − entry|` en match met raw vs raw×ctVal. Voor open positions zelfde principe via `unrealizedPnl + markPrice`. Andere exchanges ongewijzigd.
- **Blofin: TP-fields niet herkend** — auto-fetch zocht naar `fillPx`/`fillSz`/`fillPnl` maar Blofin gebruikt `fillPrice`/`fillSize`/`fillPnL` (let op hoofdletter L in PnL). Resultaat: TPs verschenen als `0%` met TP-prijs gelijk aan entry-prijs. **Fix**: extra fallback-namen toegevoegd aan filter + TP-builder.
- **Blofin: fills van andere posities werden als TPs van huidige trade gemarkt** — `fetchFills(symbol)` accepteert geen positionId-filter en retourneert alle fills voor de pair binnen het tijdsvenster. **Fix**: scope-filter op `fill.ts ≥ trade.openTime` + `positionSide` matcht trade direction. Alleen voor Blofin actief.
- **Blofin: direction-detect fout bij net-loss-door-fees** — voor SHORT trades waar gross-winst < fee → net loss → heuristic `(exit−entry)×netPnl` gaf SHORT-loss → LONG. Resultaat: closed records met verkeerde direction → matchKey verschilt → géén partial-merge → losse "LOSS LONG" trades naast open trade. **Fix**: gebruik GROSS PnL (`netPnl + |fee|`) voor direction-heuristic. Alleen Blofin parser.
- **Blofin: TP-percentage fout door mixed units in `_rawCloseSize`** *(geverifieerd live met user 2026-05-05)* — `detectPartialFromSiblings`-`sizeOf` las `_rawCloseSize` als raw contracts (bv. 13.2) terwijl `positionSizeAsset` (= restAsset) in base currency (BTC, bv. 0.0133) staat. Resultaat: `totalAsset = 13.2 + 0.0133 = 13.21` (mixed units!) → pct = 13.2/13.21 = 99.8% i.p.v. 50% bij een 50%-partial close. Plus calcProfit met deze pct + verkeerde origAsset gaf TP-winst $3082 i.p.v. $3.08. **Fix**: in Blofin parser `_rawCloseSize = String(assetQty)` (= base currency na heuristic) i.p.v. raw contracts. Andere exchanges niet aangeraakt (zetten geen `_rawCloseSize`).
- **Blofin: stale closed records gemerged als siblings van huidige open trade** — eerdere posities op dezelfde entry-prijs werden via `matchKey = pair|direction|entry` als sibling van actuele open trade gemerged. Resultaat: TPs van vorige trades verschenen op huidige (bv. 80159.3 met -$3.509). **Fix**: positionId-guard toegevoegd in 3 sibling-match plekken (`detectPartialFromSiblings`, `importTrades` finalize, `syncOpenPositions` finalize). Alleen actief voor Blofin (waar positionId per-positie uniek is). Andere exchanges ongewijzigd.
- **TP-implied-price gebruikte NET in plaats van GROSS PnL** — formule `pnl = (price-entry) × size × dirSign` vereist gross. Met net kreeg je een gefake exit (bv. 79834 ipv echte 79746). **Fix**: gebruik `totalGrossPnl = pnl + |fees|` in reconstructie. Geldt voor alle exchanges, geen regressie voor MEXC zero-fee trades (gross = net = pnl).
- **Pending TPs voor open MEXC trades** — MEXC's stoporder/list/orders met `state=1` (untriggered) worden nu opgehaald door proxy en getoond als tpLevels met `status="open"`. Geldt na deploy van uitgebreide proxy-worker.

### Gewijzigd
- **Fees-display toont negatief in trade-detail edit-modal** — fees werden positief getoond ($7,12), nu met minteken (−$7,12) voor visuele duidelijkheid dat het uitgaand geld is. Storage blijft positief (conventie consistent over alle exchanges, `netPnl()` helper ongewijzigd).

### Toegevoegd
- **MEXC pending-TPs spec** ([tests/mexc-pending-tps.spec.js](tests/mexc-pending-tps.spec.js)) — 9 scenarios voor pending-TP rendering, originalSize-heuristiek, en open/partial trade gedrag.

### Fixed (2026-05-05 patches)
- **MEXC: TP's van andere posities lekken in als hit-TPs van huidige trade** *(community-bug 2026-05-05)* — voor user met meerdere BTC-trades verschenen er 3 TP-niveaus op een 0.0258 BTC SHORT-trade waarvan TP3 = 80800 (= boven entry → onmogelijk als hit-TP voor SHORT) en TP2 = 80000 met fill-grootte > positie-grootte. **Root cause**: `proxy-local/worker.js` `fills`-action haalde `stoporder/list/orders` met `state=3` (executed triggers) op zonder `positionId`-filter. Triggered TP/SL fills van eerdere BTC-posities binnen het tijdvenster bleven dus gemerged worden in de huidige trade's fills. Zelfde bug-categorie als Blofin's "fills van andere posities" (zie scope-filter in [tradejournal.html:10752](work/tradejournal.html#L10752)). **Fix**: extra `.filter(s => !positionId || String(s.positionId) === String(positionId))` op de executed-triggers in proxy. **Vereist proxy-redeploy** voor effect op hosted Cloudflare worker — werkt nu al lokaal via proxy-local. Pending TPs hadden deze filter al sinds v12.89.

### Performance
- **Skip TP-fetch voor al-gefetchte closed trades** *(community-perf 2026-05-05)* — voorheen werd voor elke `closed && tpLevels.length===0` trade bij elke Refresh opnieuw fills opgehaald. Voor users met veel handmatig-gesloten oude trades (geen TP-trigger gebruikt) leverde dat 0 close-fills op maar wel 100+ API-calls = 3-4 minuten wachten per refresh. **Fix**: per-trade marker `_tpFetched: true` wordt gezet na elke succesvolle fetch-poging (succes + 0-fills, niét bij netwerk/API-error → transient errors retry'en vanzelf). Volgende refresh slaat zo'n trade over. **Failsafe-design**: marker reist mee met trade-record in localStorage — bij delete + reimport is marker automatisch weg = retry. Open/partial trades blijven altijd refetchen (positie kan elke refresh veranderen). Closed trades binnen 1u grace-window ook nog refetchen (exchange API propagation-delay). Geldt voor alle exchanges met `fetchFills` (Blofin/MEXC/Hyperliquid/Kraken). FTMO MT5 niet geraakt (CSV-only, geen fetchFills-pad).

## [v12.89] — 2026-05-04

Stale-open trades worden nu correct gefinalized + de stale-tpLevels-accumulatiebug is gefixt. Voor MEXC users: een gesloten positie die als open vast bleef staan met 18 (of meer) TPs uit andere posities, wordt nu netjes 1 trade met 1 TP-niveau per echte close-fill.

### Gewijzigd
- **🔄 Refresh trades = alles in 1 klik** — voorheen was Refresh een 2-stappen flow: nieuwe trades verschijnen als preview, en je moest handmatig "Importeer geselecteerde" klikken. Nu doet Refresh in één klik: open posities ophalen → stale-opens finalizen → trades importeren → TP-fills auto-fetchen voor open/partial/closed-zonder-TPs trades. Geen preview-modal meer voor het normale pad. Manual edits (notes, setupTags, screenshot, rating) blijven via de bestaande merge-logica behouden. Geldt voor alle exchanges.

### Fixed
- **MEXC complete fills-fetch via stoporder + deal_details** *(community-bug 2026-05-04)* — MEXC's `order_deals` endpoint geeft soms minder close-fills terug dan er werkelijk waren. Volgens de officiële MEXC docs (mexcdevelop.github.io) staan TP/SL trigger-orders apart in `stoporder/list/orders` met een `placeOrderId` dat verwijst naar de echte fill in `order/deal_details/{orderId}`. **Permanente fix in proxy-local/worker.js**: `fills`-action haalt nu zowel `order_deals` als alle executed (`state=3`) entries uit `stoporder/list/orders` op, en bij elke trigger fetcht de echte fill via `deal_details`. Merge + dedup op `id`/`orderId`. Response bevat nu `_sources: {deals, stoporder}` voor debug. Plus: PnL-delta reconstructie blijft als safety-net (zie hieronder) voor gevallen waar zelfs stoporder een fill mist.
- **Pending TPs voor open trades** *(community-vraag 2026-05-04)* — voor open MEXC trades waar TP/SL-orders ingesteld zijn maar nog niet getriggerd waren, verschenen die TP-niveaus niet in de app. **Fix**: `proxy-local/worker.js` haalt nu naast `order_deals` (filled) en `stoporder` met `state=3` (executed) ook `stoporder` met `is_finished=0 + state=1` (untriggered) op. De adapter rendert pending-orders als tpLevels met `status="open"` (niet `"hit"`). Voor partial trades zie je dus een mix: filled TPs als hit-status, pending TPs als open-status. Reconstructie wordt overgeslagen voor open trades. **Vereist proxy-deploy** voor effect op hosted Cloudflare worker — werkt nu al lokaal via proxy-local. Tests: 7 scenarios in [tests/mexc-pending-tps.spec.js](tests/mexc-pending-tps.spec.js).
- **Geen duplicate trade meer na finalize** *(community-bug 2026-05-04)* — wanneer een stale-open trade werd gefinalized naar closed (via importTrades-flow of syncOpenPositions), bleef de matchende closed-sibling **óók** in de journal staan. Resultaat: 2 identieke trades met verschillende open-tijden (bv. 13:41 = oude open-tijd, 16:20 = nieuwe close-tijd) maar zelfde entry/exit/pnl/size. **Fix**: bij finalize tracken welke siblings zijn opgenomen (`consumedSiblingIds`), en die na de finalize-pass uit de array verwijderen. Geldt voor zowel `importTrades`-finalize als `syncOpenPositions`-finalize. Test: scenario "Fix #3: na finalize is er GEEN duplicate" in [tests/mexc-stale-open.spec.js](tests/mexc-stale-open.spec.js).
- **TP-niveaus chronologisch gesorteerd** — voorheen werden auto-gegenereerde "hit"-TPs in willekeurige volgorde getoond (op basis van fill-id sortering). Nu staan ze chronologisch op fill-timestamp: TP1 = oudste close, TPN = laatste close. Reconstructed-TPs (zonder echte fill-tijd) krijgen `trade.closeTime` als beste guess en komen daarmee meestal als laatste. Geldt voor zowel `detectPartialFromSiblings` (siblings → tpLevels) als de auto-fetch flow in Refresh trades.
- **MEXC fills-reconstructie als safety-net** — als alle 3 fetch-paths samen nog minder qty leveren dan `trade.positionSizeAsset`, reconstrueer de ontbrekende fill via PnL-delta: `missingPrice = entry + (trade.pnl − Σ knownPnl) / (missingSize × dirSign)`. Werkt als fallback wanneer MEXC's API onverwacht een fill achterhoudt. Dekt 9 scenarios in [tests/mexc-fills-reconstruction.spec.js](tests/mexc-fills-reconstruction.spec.js) — incl. opens-filtering, lege fills, missing pnl, long+short, en de exacte user-bug van 2026-05-04 (positie 1360488693, 0.0336 BTC short, 79805.1 fill ontbreekt).
- **MEXC fills-filter — opens werden onterecht als TPs getoond** *(community-bug 2026-05-04)* — voor MEXC retourneerde `fetchFills` zowel openings (`side=1` open long, `side=3` open short) als closes (`side=2` close short, `side=4` close long). Alle fills werden als TP-niveau gemarkt → opens verschenen als TPs op de entry-prijs met winst $0,00. **Fix**: filter op `side ∈ {2, 4}` voor MEXC. Andere exchanges ongewijzigd. Gevolg: 4 fake-TPs op 80282.5 (= entry-prijs) verdwijnen, alleen echte close-fills blijven.
- **TP-niveaus automatisch zichtbaar bij Refresh trades** — voorheen moest je in trade-detail modal apart op "🎯 Uit MEXC ophalen" knop klikken om TPs te zien. Nu wordt dat automatisch gedaan tijdens Refresh: voor elke open/partial trade én voor closed trades zonder tpLevels (vooral relevant voor MEXC waar positionsHistory geen fill-detail geeft) haalt de app fills op + zet ze als auto-hit TP-niveaus. De knop "Uit MEXC ophalen" is volledig verwijderd uit trade-detail modals.
- **"Refresh trades" laat geen trades zien na "Wis alle trades"** *(community-bug 2026-05-04)* — incremental sync gebruikt `tj_lastsync_<ex>` localStorage als startpunt. Bij volledig wissen van trades bleef die timestamp staan → volgende refresh haalde alleen trades vanaf "laatste sync" op = 0 nieuwe. **Fix**: detect of de journal trades bevat van deze exchange. Lege journal → fallback op `configuredStart` (sync-from datum of 1e van deze maand) i.p.v. `lastSync`. Geldt voor alle exchanges (Blofin/MEXC/Kraken/Hyperliquid).
- **Stale tpLevels accumulatie** *(community-bug 2026-05-04)* — wanneer een open trade siblings kreeg via `detectPartialFromSiblings` of `syncOpenPositions` finalize-flow, werd de bestaande `tpLevels`-array NIET opnieuw opgebouwd: nieuwe siblings bovenop oude, sync na sync. Eén user kreeg 18 TP-niveaus op een trade die maximaal 3 echte closes had — gevuld met prijzen uit ándere posities. **Fix**: behoud alleen user-toegevoegde TPs (status ≠ "hit"), rebuild de auto-gegenereerde "hit"-TPs altijd op basis van huidige siblings. Geldt voor alle exchanges (Blofin/MEXC/Kraken/Hyperliquid).
- **Stale-open finalize werkt nu na trade-import** *(community-bug 2026-05-04)* — voorheen werd de finalize-flow alleen tijdens `syncOpenPositions` (= aanroepen direct na `fetchOpenPositions`) gedaan. Op dat moment waren de net-gesloten siblings nog niet in de journal-state. Resultaat: een positie die op de exchange dicht stond bleef in de app eeuwig als OPEN/PARTIAL hangen. **Fix**: `importTrades` doet nu ook een finalize-pass — bij elk import van closed records worden stale-opens van dezelfde exchange omgezet naar `status="closed"` indien matchende siblings worden gevonden. Manual edits (notes/setupTags/rating/screenshot/SL/TP) blijven behouden.
- **MEXC contractSize-fallback bij CORS-fail** — vanaf `file://` URLs blokkeert de browser `fetch` naar `contract.mexc.com/api/v1/contract/detail` (geen Access-Control-Allow-Origin header). Resultaat: contractSize=0 → positionSize klopt niet. **Fix**: hardcoded fallback-map voor de 12 meest-gebruikte pairs (BTC/ETH/SOL/DOGE/XRP/ADA/DOT/MATIC/LINK/AVAX/LTC/BNB × USDT). Dynamic lookup via fetch blijft als primaire bron voor onbekende pairs.

### Toegevoegd
- **MEXC stale-open spec** ([tests/mexc-stale-open.spec.js](tests/mexc-stale-open.spec.js)) — 3 tests die de community-bug isoleren met de echte stale-open trade uit IndexedDB + verse API snapshot. Voorkomt regressie op deze categorie bugs in de toekomst.

## [v12.88] — 2026-05-04

Real-data validation tegen jouw eigen exchange-snapshots, plus 2 fee-bugs gevonden en gefixt. Voor MEXC-users: jouw netto PnL kan iets lager uitkomen dan voorheen — die was eerder bruto.

### Fixed
- **MEXC: fees worden absoluut opgeslagen** — MEXC's `fee`-veld komt negatief uit de API (uitgaand vanuit account-perspectief), terwijl Blofin/Kraken/Hyperliquid absolute waardes leveren. Voorheen toonde de UI MEXC fees als negatieve cijfers (bv `-0.5` ipv `0.5`). **Fix**: parser doet nu `Math.abs(fee)`. PnL-veld blijft `realised` direct (verified via 3-way validation tegen xlsx export: MEXC's `realised` is al NET = gross − fee per positie).
- **Hyperliquid: scaled-in fee-duplicatie.** Bij meerdere opens vóór 1 close (bv. 3× scaling-in op verschillende prijzen) werd in de FIFO-matching de open-fee pro-rata afgesplitst, maar `lot.fee` bleef op de volle initiële waarde staan. Bij volgende close-fills van dezelfde lot werd opnieuw pro-rata gerekend op die volle fee → fee-duplicatie tot ~3% over-attribution. **Fix**: `lot.fee -= feeShare` na elke pro-rata aftrek. Voor Denny's snapshot ging fee-attribution van 1.030× naar 1.000× exact.

### Toegevoegd
- **Real-data spec-suite per exchange** ([tests/blofin-real-data.spec.js](tests/blofin-real-data.spec.js), [tests/mexc-real-data.spec.js](tests/mexc-real-data.spec.js), [tests/kraken-real-data.spec.js](tests/kraken-real-data.spec.js), [tests/hyperliquid-real-data.spec.js](tests/hyperliquid-real-data.spec.js)) — 23 tests die de echte parser-pipeline tegen snapshot-fixtures runnen (smoke + trade-count + PnL-sum + fees-sum + open-positions + detectPartials). Skipt automatisch wanneer de fixture ontbreekt — CI blijft groen zonder real-data. Snapshots leven in `tests/_fixtures/` (gitignored).
- **3-way validation suite per exchange** ([tests/hyperliquid-3way.spec.js](tests/hyperliquid-3way.spec.js), [tests/blofin-3way.spec.js](tests/blofin-3way.spec.js), [tests/kraken-3way.spec.js](tests/kraken-3way.spec.js), [tests/mexc-3way.spec.js](tests/mexc-3way.spec.js)) — 15 tests die CSV/XLSX export ↔ API snapshot ↔ parser-output cross-valideren. Drie onafhankelijke bronnen geven dezelfde aggregaten = pro-trader-grade vertrouwen. Inclusief MEXC xlsx-parser zonder npm-dependency (inline-string regex via unzip + child_process). Resultaten: HL/Blofin matchen op de cent voor fees, Kraken in overlap-window, MEXC fees exact maar xlsx PnL-aggregatie heeft open vraag voor BTC (zie BACKLOG).
- **Scenarios K, L, M, N — field-behoud spec** ([tests/scenarios-klmn.spec.js](tests/scenarios-klmn.spec.js)) — 4 tests focused op WAT er met user-edits gebeurt na de pipeline (niet alleen aggregaten). K: `stopLoss` blijft op SL-merge. L: `notes` + `setupTags` + `rating` + `screenshot` + `stopLoss` + `takeProfit` blijven na TP1+SL. M: open trade met `unrealizedPnl` blijft `status='open'`. N: `getConsumedSiblings` filtert closed-siblings na partial-merge.

## [v12.87] — 2026-05-04

Blofin partial-close finalize-flow + 1 Refresh-knop + cross-exchange regressie-suite. Lost de community-bug op waar TP1+SL trades als losse records bleven staan met verloren manual edits.

### Fixed
- **Bug 1 — `originalSizeAsset` 2× te groot bij ghost-partial.** Wanneer een open trade in journal stond met stale `positionSizeAsset` (positie was eigenlijk dicht), telde de helper rest + alle siblings op zonder te detecteren dat ze overlappen. TP-percentages werden daardoor de helft te klein getoond. Fix: detecteer wanneer `closedAsset >= rawRest * 0.99` en zet `restAsset=0`.
- **Bug 2 — Fees gaan verloren bij geconsumeerde siblings.** Closed-siblings worden via `getConsumedSiblings` verborgen in de UI; hun fees verdwenen mee. Fix: aggregeer sibling-fees naar `partial.fees` zodat ze in totalen + per-trade zichtbaar blijven.
- **Bug 3+4 — Stale opens werden verwijderd ipv gefinaliseerd.** `syncOpenPositions` verwijderde elke open-trade die niet meer in de fresh API-response zat — manual edits (notes, setupTags, screenshot, rating, emotionTags) gingen verloren. Plus: partials werden nooit opgeruimd want de check was alleen op `status==="open"`. **Nieuwe finalize-flow**: stale open/partial → omgezet naar `status="closed"` met behoud van alle manual edits + aggregaten uit closed-siblings (pnl, fees, exit, tpLevels, originalSizeAsset). Toast: *"X afgerond"* in plaats van *"X verwijderd"*.

### Gewijzigd
- **Eén Refresh-knop ipv twee.** "Trades importeren" + "Open posities ophalen" zijn vervangen door één **🔄 Refresh trades**. Doet beide in correcte volgorde (open posities eerst → finalize via v12.87 fix → daarna trade history). **Incrementeel** via `tj_lastsync_<ex>` localStorage met 1u-veiligheidsbuffer; alleen nieuwe records sinds laatste sync. Toast: *"X nieuwe trades"* of *"Up-to-date — geen nieuwe trades"*.
- **Hash-fallback voor `?dev=1`.** Sommige browsers (Edge, Brave) interpreteren `?dev=1` als bestandsnaam-deel bij `file://` URLs (ERR_FILE_NOT_FOUND). Detectie regex'et nu zowel query als hash (`#dev=1`) op `location.href` — werkt ook offline zonder server.

### Toegevoegd
- **Cross-exchange pipeline regressie-suite** ([tests/exchange-pipeline-cross.spec.js](tests/exchange-pipeline-cross.spec.js)) — 17 tests: 4 kern-scenarios (TP1+SL / TP1+TP2 / full-close / positionId-hergebruik) × 4 exchanges (Blofin/MEXC/Kraken/Hyperliquid) + 1 FTMO no-op check. Generic fixture-builder werkt voor alle exchanges. Toekomstige fixes worden nu automatisch tegen alle exchanges geregresseerd.
- **Diepgaande Blofin pipeline-suite** ([tests/blofin-pipeline-scenarios.spec.js](tests/blofin-pipeline-scenarios.spec.js)) — 12 scenarios met edge-cases (missing `_rawCloseSize`, sizeAsset=0, ghost-partials, mixed exchanges).

## [v12.86] — 2026-05-04

Lichtere thema's beter leesbaar voor de community.

### Gewijzigd
- **Light / Parchment / Daylight thema's** — text-tokens versterkt zodat secondary helptekst (descriptions onder section-headers, theme-card subtexts, footer-hints) WCAG-AA contrast haalt op lichte achtergronden. text4 ging van ~3:1 naar ~4.6:1.
  - **Light**: alpha-getinte greys verstrekt (`rgba(26,26,26,0.45) → 0.6`). Koel/clean karakter behouden, gold-accent donkerder (`#a88a3c → #8d6f1f`).
  - **Parchment**: koel-blauwe greys (`#928C80 / #B8B2A4`) vervangen door **warm/sepia** greys (`#5a4f44 / #7a6e62`). Geen koud-warm botsing meer met het beige paper-karakter.
  - **Daylight**: lichte cool-greys (`#8898AA / #ADBDCC`) → **cool slate-blue** (`#475264 / #646e80`). Stripe/Vercel-look behouden.
  - Hierarchie `text2 > text3 > text4 > text5` blijft in alle drie behouden, plus borders versterkt voor card-scheiding.

## [v12.85] — 2026-05-04

Grote release: Instellingen-pagina herontworpen met scroll-spy sidebar, Playbook-pagina als edge-archief uitgebreid, en exchange-bug-isolatie via adapter-pattern. Plus diverse bug-fixes en UX-polish.

### Toegevoegd

#### ⚙️ Instellingen-pagina — scroll-spy redesign
- **Sticky sidebar links** met 3 categorieën (🔌 Account & Data / 🔧 App / ⚙️ Geavanceerd) en scroll-spy navigatie. IntersectionObserver highlight de actieve sectie tijdens scroll, klik in sidebar = smooth scroll naar het anker.
- **Sub-tabs (Accounts / Trading Rules / Goals / Tags / Help)** verplaatst boven de "Account & Data" banner en links uitgelijnd voor consistentie tussen alle settings-pagina's. Zichtbaar in alle 6 thema's via subtle border + `var(--text2)` op inactieve tabs.
- **Hoofdstuk-labels** in de sidebar duidelijker: gold-kleur, font-weight 800, 11px, letter-spacing .14em + subtiele divider tussen categorieën.
- **Data wissen-card** met confirm-modals: "Wis trades" toont aantal trades, "Reset alles" vereist letterlijk **typen van `RESET`** voordat de bevestig-knop ontgrendelt. ESC sluit, klik buiten de card sluit ook.
- **Storage-card** toont localStorage-gebruik (KB / 5MB) met groene badge.

#### 🎯 Playbook-pagina — edge-archief
- **Setup-voorbeelden** (max 5 per playbook) — referentie-charts gemarkeerd als ✓ Schoolvoorbeeld / ⚡ Marginal / ✗ Valse setup. Upload via klik, sleep, of **Ctrl+V plakken** uit clipboard (zoals trade-screenshots). Helpt pattern-recognition trainen — édge bouwen begint bij weten hoe het er goed/slecht uitziet.
- **Referenties-sectie** in Playbook-form en -detail: TradingView chart-template URL + Bron-label + Bron-URL (vrij format, bv. *"Morani — MLS strategie"*).
- **Anti-criteria** als checklist paralel aan Entry-criteria — vóór-trade gates ("wanneer NIET nemen"). Andere semantiek dan Mistake-patterns (= ná-trade reflectie). Hard stop-flag voor harde no-go regels.
- **Edge-breakdown** in PlaybookDetailModal — 4 cards met horizontale R-bars + 💡 inzicht-callouts:
  - Per sessie (bv. *"Beste sessie: London AM (+2.23R · 6 trades). Verlies in Asia PM — overweeg te skippen."*)
  - Per dag van de week (NL labels, Amsterdam-tijd)
  - Per grade (A+/A/B/C — verschil in R per grade)
  - Per confirmation-tag (mét vs zonder vergelijking + Δ-delta zodat je ziet welke confluence het meest bijdraagt aan je edge)

#### 🔧 Architecture
- **Exchange-bug-isolatie via adapter-pattern**. `detectPartialFromSiblings` (shared helper) wordt nu via `ExchangeAPI[ex].detectPartials(...)` geroepen ipv direct shared-aanroep. Een Blofin-fix kan onmogelijk MEXC-paden raken (en omgekeerd). Toegevoegd aan elke exchange (Blofin/MEXC/Kraken/Hyperliquid wrappen de shared helper, FTMO is no-op want CSV-only). Regressie-test [tests/exchange-isolation.spec.js](tests/exchange-isolation.spec.js) bewijst de isolatie. Zie ook [CLAUDE.md](CLAUDE.md) sectie "Exchange-architectuur" voor het architectuur-principe.

### Gewijzigd
- **Analytics-pagina spacing** — alle Analytics-secties (Proces-KPI's, Risk Consistency, Setup Edge, Sessie Performance, Heatmap, etc.) hadden geen tussenruimte tussen de cards. `.sort-row` heeft nu `margin-bottom: 18px` zodat secties netjes ademen.
- **HelpPage volledige breedte** — `maxWidth: 1100px` constraint verwijderd zodat Help dezelfde brede layout krijgt als Trading Rules / Goals / Tags.
- **Top-right thema-toggle** wisselt nu tussen `light` en `classic` (was: tussen niet-bestaande thema's `morani`/`purple` waardoor de knop niets deed).
- **PlaybookForm intro-tekst** vervangt misleidende "alleen Naam + Setup-tags zijn echt nodig" door uitnodigender *"Hoe vollediger je deze playbook invult, hoe scherper je edge wordt"* met expliciete moedig om criteria, anti-criteria, regels en voorbeelden mee te nemen.

### Fixed
- **Milestone-popup transparantie** — card had een gradient van 8-12% alpha zonder solide basislaag, waardoor underlying content erdoorheen leesbaar bleef. Stack nu: `linear-gradient(...) , var(--bg2)`.
- **Milestone-popup demo-skip** — demo-trades triggeren geen "10 trades!"-felicitatie meer (voelde vals). Wordt ook niet als seen opgeslagen, dus zodra demo uit gaat en je 10 echte trades behaalt, fired de popup wél.

### Verwijderd
- **Proxy URL setting** uit Voorkeuren-card. Default Cloudflare Worker werkt out-of-the-box; dev-only override blijft mogelijk via `tj_proxy_url` localStorage.
- **Diagnostiek-snapshot knop** uit oude Debug-card. Vervangen door enkel een Storage-card die het ruimte-gebruik toont.
- **Categorie-banners taglines** ("Hoe je trades binnenkomen + waar je backup-vangnet zit." / "Algemene voorkeuren + updates." / "Voor wie z'n setup zelf in de hand heeft") verwijderd. Banner-titel alleen.

### Verborgen (dev-only)
- **Blofin debug-knoppen** (🔍 Debug raw response / 📥 Snapshot / 🔬 Test fixture) zijn nu alleen zichtbaar met `?dev=1` in de URL. Code intact voor toekomstige debug-sessies. Documentatie + uitbreidings-pad voor andere exchanges in [BACKLOG.md](BACKLOG.md) onder "🚧 Hidden / dev-only debug-knoppen".

## [v12.84] — 2026-05-03

Vrijwillige donatie-sectie + milestone-popup fixes.

### Toegevoegd
- **🍕 Vrijwillige donatie-card** onderaan de Instellingen-pagina. SyncJournal blijft 100% gratis voor de community; deze sectie geeft mensen die willen bijdragen een nette plek om dat te doen, zonder enige verplichting of feature-gating. Twee crypto-adressen (USDC op Arbitrum, SOL op Solana) met **📋 Kopieer-knoppen** die per klik wisselen naar `✓ Gekopieerd` (1.6s feedback). Network-warning callout om te voorkomen dat iemand op het verkeerde netwerk stuurt. Werkt op alle 6 thema's via theme-tokens (`var(--gold-border)`, `var(--bg3)`, `var(--gold-dim)` — geen hardcoded kleuren).

### Fixed
- **Milestone-popup vuurt niet meer in demo-modus**. Wie demo-data inlaadde kreeg ten onrechte de "10 trades!"-felicitatie, want het zijn geen echt verdiende trades. We slaan ze ook niet als gezien op — zodra demo wordt uitgezet en de user 10 echte trades behaalt, fired de popup wél.
- **Milestone-popup is niet meer doorschijnend**. De card had een gold-tint gradient van 8-12% alpha zonder solide basislaag, waardoor de underlying content erdoorheen leesbaar bleef. Nieuwe stack: `linear-gradient(...) , var(--bg2)` + steviger `var(--gold-border)` zodat de popup op alle 6 thema's solide oogt.
- **Top-right thema-toggle werkt weer**. Knop wisselde tussen `morani`/`purple` (twee thema's die niet meer bestaan), waardoor klikken niets deed. Nieuwe gedrag: wisselt tussen `light` en `classic`. Icoon switcht mee (☀️ in dark / 🌙 in light) en heeft een tooltip + aria-label. Andere thema's blijven kiesbaar via Instellingen → Thema.

## [v12.83] — 2026-05-03

Hub-only navigatie voor exchange-lessons + FAQ-opmaak met markdown-rendering.

### Gewijzigd
- **Exchange-detail-lessons (l18-l22) verborgen uit de Handleiding-grid**. Ze waren dubbel zichtbaar: één keer als losse card én als knop in de hubs (CSV importeren / Exchange koppelen). De hubs zijn nu de enige route — voorkomt verwarring "welke moet ik klikken?". Lessen blijven volledig bereikbaar via de twee hub-cards en de exchange-tab-strip bovenaan elke detail-lesson.
- **FAQ-antwoorden krijgen markdown-rendering**. Tot nu toe werden `**bold**`, `1. lijst`, `• bullets` en `` `code` `` letterlijk getoond als platte tekst — lappen tekst die niet uitnodigde tot lezen. Nieuwe `renderFaqAnswer()` helper converteert minimal-markdown (bold, italic, code, ordered/unordered lists, paragrafen) naar HTML met aparte `.faq-answer` styling: gold-counter-cirkels voor genummerde lijsten, gold-bullets voor punt-lijsten, monospace gold code-tags. Resultaat: gestructureerde antwoorden met visuele hiërarchie i.p.v. lopende tekst. Werkt op alle 6 thema's.

### Fixed
- **Exchange-lessons cards niet meer dubbel zichtbaar**: `HIDDEN_FROM_GRID` Set in `LessonsView` filtert de 5 detail-lessons (l18-l22) uit de grid. Voortgangsteller `done/total` rekent nu ook met de zichtbare set zodat de progressie niet ineens van 22 naar 17 lessen springt.

## [v12.82] — 2026-05-03

HelpPage opgeschoond: Startersguide weg, FAQ herschreven gebruiksvriendelijk.

### Verwijderd
- **Startersguide-tab** uit Help. De content (3 cards: Exchange sync / CSV / Demo) was verouderd geworden — de exchange-namen verschenen ook in de Handleiding-cards. Dubbele info, en de Handleiding dekt nu alle paden via lessons l04-l05 (hubs) + l18-l22 (per exchange). Header-tekst aangepast: weg met "snelle startersguide", in de plaats: "Stap-voor-stap handleidingen per onderdeel, plus een doorzoekbare FAQ."
- **Legacy migratie**: gebruikers met `tj_help_subtab="startersguide"` in localStorage worden automatisch gemapt naar `lessons` zodat ze geen blanco tab zien.

### Gewijzigd
- **FAQ volledig herschreven** voor niet-technische gebruikers. ~30 entries doorgelopen:
  - **Geen DevTools-instructies meer** ("F12 → Console → typ `localStorage.removeItem(...)`") — vervangen door UI-routes.
  - **Geen `python -m http.server`-tip** als oplossing voor file:// — vervangen door begrijpelijk advies (vaste map, hosted versie via Discord vragen).
  - **Lange essays ingekrompen**: het Playbook-koppeling antwoord ging van 800+ woorden naar ~150 woorden, idem voor Big-Picture-velden, A+/A/B/C grading, Gemist/Backtest/Paper.
  - **Jargon vereenvoudigd**: "IndexedDB + localStorage" → "in je browser, op je eigen apparaat". "Cloudflare Worker als proxy voor CORS-signing" → "een proxy om de exchange te bereiken (technische noodzaak voor veiligheid)".
  - **Concrete voorbeelden toegevoegd** waar abstract: R-multiple uitleg met BTC entry/SL/exit prijzen, Capital vs Equity met $10k voorbeeld, multi-TP met split percentage-voorbeeld.
  - **Verwijzingen naar de juiste hulp**: "voor stap-voor-stap per exchange: Help → Handleiding → klik je exchange" — kruisverwijzing naar de uitgewerkte exchange-lessons in plaats van inline herhaling.

### Tests
- **Nieuwe spec `tests/help-tab-cleanup.spec.js`** met 4 scenario's: Startersguide-tab is weg, header-tekst is bijgewerkt, FAQ-tab opent en bevat de gebruiksvriendelijke entries (verifieert dat DevTools- en python-instructies eruit zijn), legacy `startersguide`-state in localStorage wordt correct naar lessons gemapt.
- **Volledige focused regressie**: 19/19 groen.

---

## [v12.81] — 2026-05-03

Lesson-grid card-illustratie passend bij thema in lichte modi.

### Fixed
- **Lesson-card SVG-illustratie-container** had hardcoded donkere gradient (`linear-gradient(135deg,#0a0d13,#13161e)`) die er onsamenhangend uitzag op lichte thema's (light / parchment / daylight) — donkere blokken op lichte achtergrond. Vervangen door `linear-gradient(135deg,var(--bg3),var(--bg4))`. In donker thema's: blijft donker. In lichte: meegekleurd met de bg-token-shift, zodat de cards homogeen zijn met de rest van de pagina.

### Tests
- **Nieuwe spec `tests/lesson-grid-themes.spec.js`** — opent Help → Handleiding card-grid in alle 6 thema's (sync/classic/aurora/light/parchment/daylight) en maakt screenshots in `tests/screenshots/lesson-grid-themes/`. Visuele regressie-tool voor toekomstige theme-tweaks aan de card-grid.
- Verifieerde uitkomsten: sync (donker) blijft donker zoals voorheen; light + parchment + daylight tonen nu correct lichte illustratie-containers passend bij thema.

---

## [v12.80] — 2026-05-03

Tab-strip bovenaan in plaats van "Andere exchange?"-sectie onderaan. Lessons compacter geschreven — minder lap tekst, meer functionaliteit.

### Gewijzigd
- **Exchange-tabs verplaatst van onderaan naar bovenaan** elke detail-lesson (l18-l22). Nieuwe `.lesson-exchange-tabs`-class — compacte horizontal strip met 5 chips, self-exchange highlighted in goud (`active` + `aria-current="page"`), andere 4 klikbaar via `data-lesson-target`. **Direct na openen lesson zie je alle exchange-opties** in plaats van pas onderaan na scrollen.
- **Onderaan-sectie "Andere exchange?" verwijderd** — was dubbel met de nieuwe top-tabs.
- **Alle 5 lessons compacter herschreven**:
  - Inleidingsparagraaf van 3-4 zinnen naar 1-2 zinnen
  - "Welk pad past bij jou?"-secties verwijderd waar TL;DR het al uitlegt
  - Glossary-blokken (API key vs Secret vs Passphrase) ingekrompen tot 1 callout of weggehaald
  - "Common pitfalls" van 5-6 punten naar top 3-4 essentiële
  - "Trades komen niet binnen?"-troubleshooting van 5 stappen naar top 3
  - **l18 Blofin** krijgt eindelijk ook een TL;DR-block (was de enige lesson zonder)
- Resultaat: ~30% minder tekst per lesson, dezelfde kritische info (90-dagen-trap, ESMA, privacy, US-vs-Global).

### Toegevoegd
- **`scripts/move-exchange-tabs-top.js`** — eenmalig script dat de tabs bovenaan plaatste en de onderaan-sectie verwijderde voor alle 5 lessons.
- **`scripts/rewrite-exchange-lessons-compact.js`** — eenmalig script dat de volledige content van l18-l22 vervangt met compacte versies. Behoudt id/level/svg/title/desc, vervangt alleen de content-string.

### Tests
- `tests/exchange-lessons.spec.js` scenario "Andere exchange?-sectie + cross-navigatie" hernoemd naar **"tab-strip BOVENAAN met active-state + cross-navigatie"** — verifieert nu `.lesson-exchange-tabs` class, `aria-current="page"` op self-exchange, en dat de oude onderaan-`<h2>Andere exchange?</h2>` verdwenen is.
- `tests/blofin-lesson.spec.js` content-assertions bijgewerkt: oude headings ("Welk pad past bij jou", "Common pitfalls bij Blofin") vervangen door huidige (TL;DR, Pad A — CSV exporteren, Pad B — API-koppeling, Pitfalls).
- `tests/exchange-lessons.spec.js` Hyperliquid-test: callout-titel-tekst aangepast (van "Privacy bovenaan: alle trades zijn publiek" naar "Privacy: alle trades zijn publiek").
- **Volledige focused regressie**: alle relevante lesson-specs (15/15) groen.

---

## [v12.79] — 2026-05-03

Cross-exchange navigatie binnen detail-lessons. Plus design-review check in alle 6 thema's voor lesson-modal kleur-leesbaarheid.

### Toegevoegd
- **"Andere exchange?"-sectie** onderaan elke detail-lesson (l18 t/m l22). Bevat 4 chip-knoppen voor de overige exchanges (zelf-exchange wordt eruit gefilterd). Snel switchen zonder via Help-tab terug te hoeven. Lost het *"als ik op MEXC klik verdwijnen de andere knoppen"*-gevoel op — gebruiker kan nu binnen één modal-sessie tussen alle 5 lessons heen-en-weer.
- **Nieuwe spec `tests/lesson-themes.spec.js`** — opent l18 in alle 6 thema's en maakt screenshots in `tests/screenshots/lesson-themes/`. Visuele regressie-tool voor toekomstige theme-tweaks.
- **Eenmalige helper `scripts/add-other-exchange-section.js`** — Node-script dat de "Andere exchange?"-sectie programmatisch in elke lesson injecteerde (5 lessons in 1 run, deterministisch).

### Design-review uitkomsten
Lesson-modal getest in alle 6 thema's. Resultaat: **alle 6 leesbaar zonder kleur-fixes nodig**:
- ✅ **Sync** (default donker): goede contrast, callouts duidelijk gekleurd, step-cirkels gold-tinted, body op `var(--text)` knalt
- ✅ **Classic** (donker, minder goud): tekst helder, callouts blijven onderscheidend
- ✅ **Aurora** (donker met paars-accent): leesbaar; modal-rendering klein in screenshot maar inhoudelijk OK
- ✅ **Light** (wit/grijs accent): donkere tekst op witte modal — sterk contrast, callout-tints werken
- ✅ **Parchment** (warme beige): warmte gehandhaafd, geen "alles is grijs"-gevoel
- ✅ **Daylight** (zacht licht): subtieler dan Light maar nog steeds goed leesbaar

### Tests
- **8 scenario's in `tests/exchange-lessons.spec.js`** (1 nieuw): cross-navigatie via "Andere exchange?"-sectie verifieert dat klik op MEXC-chip in Blofin-lesson l19 opent, en dat l19 op zijn beurt de Blofin-chip toont.
- **Volledige focused regressie**: 29/29 groen.

---

## [v12.78] — 2026-05-03

Vier nieuwe exchange-handleidingen: **MEXC (l19), Kraken Futures (l20), Hyperliquid (l21), FTMO MT5 (l22)**. Hub-knoppen in l04/l05 zijn nu allemaal actief.

### Toegevoegd
- **Lesson l19 — "MEXC koppelen + importeren"** (~11 min). CSV-pad via Orders → Futures Orders → Position History (max 18 maanden). API-pad zonder passphrase (anders dan Blofin/OKX). Documenteert de **90-dagen-key-trap** (zelfde patroon als Blofin: zonder IP-whitelist verloopt key na 90d). Pitfalls: Spot vs Futures aparte exports, mobiele app exporteert niet, max 100k entries / 10 downloads per maand.
- **Lesson l20 — "Kraken Futures koppelen + importeren"** (~12 min). futures.kraken.com is een **aparte interface** — spot-keys werken niet. CSV via Logs → Download All (Account Log met `booking_uid`/`trade_price`/`realized_pnl`). API via Settings → API → Read Only, geen passphrase, HMAC-Authent header. **EU-traders-warning**: nov 2025 lanceerde Kraken via CySEC perpetuals voor EU-retail (max 10× hefboom). ESMA publiceerde feb 2026 dat perpetuals onder CFD-product-intervention vallen → leverage zou H2 2026 naar 2× kunnen zakken. Lesson waarschuwt expliciet.
- **Lesson l21 — "Hyperliquid koppelen + importeren"** (~9 min). DEX zonder API-key — alleen 0x-wallet-adres (42 chars). **Privacy-warning prominent bovenaan**: alle Hyperliquid-trades zijn 100% publiek on-chain — leaderboard, HyperTracker, Coinglass tonen elke positie/PnL/win-rate. Tip: gebruik dedicated trading-wallet, geen wallet met persoonlijke ENS/NFT's. CSV via Portfolio → Trade History → Export (hard limit 10.000 rijen — voor meer: trade-export.hypedexer.com community-tool). Sub-accounts/vaults hebben eigen adres.
- **Lesson l22 — "FTMO (MT5) koppelen + importeren"** (~10 min). **CSV-only — geen API**. Pad via trader.ftmo.com → Accounts Overview → klik account → MetriX → Trading Journal → Export CSV. Date-range filter boven tabel. **Pitfall #1: FTMO US (netting/FIFO) vs FTMO Global (hedging)** — radicaal andere CSV-output. Bij netting verbergt average-entry losse fills. Symbol-format: `EURUSD`/`BTCUSD`/`US30`/`XAUUSD` (geen slash, geen suffix). Trial accounts zonder eerste trade hebben geen MetriX-tab.

### Gewijzigd
- **l04 (CSV-hub)**: alle 5 exchange-knoppen zijn nu actief klikbaar (Blofin/MEXC/Kraken Futures/Hyperliquid/FTMO MT5). Geen "binnenkort"-badges meer.
- **l05 (API-hub)**: 4 knoppen actief (Blofin/MEXC/Kraken Futures/Hyperliquid). FTMO blijft een aparte callout maar is nu **klikbaar** — opent direct l22 voor de CSV-pad.
- **Alle 4 nieuwe lessons gebruiken het v12.77 readability-redesign**: TL;DR-block bovenaan met 3-4 key-takeaways, custom counter-cirkels op `<ol>`, gestylede callouts (warn/tip/why/example), `<code>` met gold-tint, scroll-progress in de modal-header. "Laatst gecontroleerd: 2026-05-03" stempel onderaan elke lesson.

### Tests
- **Nieuwe Playwright spec `tests/exchange-lessons.spec.js`** met 7 scenario's: alle 5 lesson-cards zichtbaar, CSV-hub alle knoppen klikbaar (geen disabled meer), klik op MEXC-knop opent l19 met TL;DR + 90-dagen-trap, Kraken-lesson bevat EU/ESMA-warning + futures.kraken.com onderscheid, Hyperliquid-lesson heeft prominent privacy-warning + 0x-format, FTMO-lesson heeft CSV-only + US-vs-Global pitfall, API-hub klik op FTMO-callout-knop opent l22.
- **Volledige focused regressie**: 28/28 groen.

### Onderzoek-bronnen per exchange
- **MEXC**: officiële MEXC support center (export-articles, API tutorial, Key renewal regels), MEXC API docs, community-bronnen (Cryptact, Gunbot).
- **Kraken Futures**: Kraken support 360022839451, docs.kraken.com/api/docs/futures-api, python-kraken-sdk veldenset, Kraken blog (3 nov 2025 EU-launch), ESMA-statement (24 feb 2026), Finance Magnates analyse.
- **Hyperliquid**: hyperliquid.gitbook.io, app.hyperliquid.xyz/portfolio, Cryptact integratie, trade-export.hypedexer.com, community guides over wallet-extensies.
- **FTMO MT5**: FTMO blog (Account MetriX, Scaling out), FTMO Academy, trader-journal-integraties (TradeZella/TradesViz/TradeBB), MQL5 forum (positions vs deals), The Payout Report (FTMO US vs Global, MT5 risk controls).

---

## [v12.77] — 2026-05-03

Lesson-readability redesign. Geen "lap tekst"-gevoel meer — typography, callouts, step-markers, scroll-progress.

### Toegevoegd
- **Lesson-typography CSS** — eigen `<style id="lesson-readability-v12-77">` block met theme-aware styling voor `.lesson-body` en alle sub-elementen:
  - **Body 16px / line-height 1.65** (research: optimaal voor reading-heavy content op desktop)
  - **Body color `var(--text)`** ipv `text2` — voorkomt het "alles is grijs"-gevoel dat docs vaak hebben
  - **Lead-paragraph** (eerste `<p>`) op 17px voor visuele hierarchy
  - **Max-width 65ch** op alle content-elementen — leescomfort, geen lange regels in 780px modal
  - **h2** op 24px met onderstreep-line + ruime `margin-top:36px` (4:1 ratio met margin-bottom = scannable hierarchy)
  - **h3** op 19px, weight 600 (niet 700 — research: te zwaar bij gold-accent)
  - **Custom counter-cirkels** voor `<ol>` items via CSS counter — gold-dim circle met monospace nummering (`30%` snellere scan-snelheid volgens Microsoft Style Guide)
  - **Custom dot-bullets** voor `<ul>` items — subtiele gold dot
  - **`<code>`** krijgt gold-tinted background + border voor visuele isolatie
  - **`<blockquote>`** als pull-quote met gold-border-left, italic, 16px
  - **Callout-styling** (`.lesson-callout` met variants `.tip` `.warn` `.why` `.example`) krijgt eigen border-left-color + tint per variant — volgt Mintlify/Quarto-conventie
  - **`.lesson-tldr`-class** klaar voor toekomstige TL;DR-blocks bovenaan lessons
- **Scroll-progress bar** in modal-header — 3px gold strip onderaan de sticky header die meegroeit met scroll-positie binnen de lesson-content. Lage cognitieve cost, hoge "ik weet waar ik ben"-payoff voor 12-min lessons.
- **`cardRef` + `useEffect`** in `LessonReadingModal` — attacht scroll-listener op modal-card, reset op lesson-switch zodat progress nul start bij elke nieuwe lesson.

### Gewijzigd
- **Inline `style={{fontSize:14,lineHeight:1.7,color:var(--text2)}}`** op de `.lesson-body` div verwijderd — overrulede de CSS-class met hogere specificity. Nu alleen `padding:"24px 32px 28px"` inline.
- **CSS in een tweede `<style>`-block** geplaatst (na de hoofdblok). Reden: de hoofdblok bevat legacy `.theme-purple` rules met genest-aanhalingstekens (bv. `[style*="background:"#C9A84C""]`) die de CSS-parser-state corrumperen — alle nieuwe rules erna werden niet geladen. Een onafhankelijke tweede block omzeilt dat. Opmerking in code dekt dit voor toekomstige bewerkers.

### Tests
- **Nieuwe Playwright spec `tests/lesson-readability.spec.js`** met 3 scenario's: (1) typography-CSS daadwerkelijk toegepast — verifieert via `getComputedStyle` dat body 16px is, h2 24px met `border-bottom`; (2) scroll-progress-bar bestaat en groeit van 0% naar >0% bij scroll; (3) custom counter-markers op `<ol>` renderen via `::before` pseudo-element met `content:counter(...)` en ronde marker.
- **Focused regressie**: 21/21 groen (smoke + blofin-partial + tag-delete + flat-sync + blofin-lesson + lesson-readability).

### Research-bronnen
Pimp my Type, Baymard, Butterick's Practical Typography, Material Design 3, Stripe Docs, Tailwind Docs, React.dev (callouts), Linear changelog, Mintlify, Quarto. Volledige lijst in research-output van session.

---

## [v12.76] — 2026-05-03

l04 (CSV importeren) en l05 (Exchange koppelen) omgevormd tot **hub-lessons** met exchange-keuze-knoppen. Plus lesson-naar-lesson navigatie in de Reading Modal.

### Toegevoegd
- **Hub-knoppen in l04 + l05** — gebruiker ziet nu een directe keuze "Welke exchange gebruik je?" met klikbare buttons per exchange. Klik = open de bijbehorende detail-lesson zonder de modal te sluiten. Blofin (l18) is nu actief; MEXC, Kraken, Hyperliquid, FTMO staan als disabled buttons met "(binnenkort · v12.7X)"-badge zodat gebruiker weet dat ze in komen.
- **`data-lesson-target` attribuut** in lesson-content. Naast de bestaande `data-target="<tab>"` (sluit modal + switch app-tab) ondersteunt LessonReadingModal nu `data-lesson-target="<lesson-id>"` dat de modal-content verwisselt door het bestaande `openLesson`-event te dispatchen. Dezelfde mechaniek die de prev/next-knoppen al gebruiken — geen nieuwe state, geen modal-flicker.

### Gewijzigd
- **l04 "CSV importeren — kies je exchange"** — duration verlaagd van 10 naar 4 min (hub is nu kort). Algemene tips (taggen na import, dedup, klein beginnen) blijven; exchange-specifieke instructies zijn verhuisd naar de detail-lessons (l18+).
- **l05 "Exchange koppelen — kies je exchange"** — duration verlaagd van 12 naar 4 min. Universele Read-only-veiligheidsregel + uitleg over wat live-sync ophaalt (trades / open posities / balance / TP-fills) blijven. Specifieke API-stappen zijn nu in de detail-lessons.

### Tests
- **Nieuwe scenario in `tests/blofin-lesson.spec.js`**: verifieert hub-navigatie — open l04 → klik Blofin-knop → l18 swap-t in dezelfde modal en de "90-dagen-trap" sectie van l18 is zichtbaar (bewijst dat de juiste lesson is geopend).
- Volledige regressie: 18/18 groen.

---

## [v12.75] — 2026-05-02

Eerste van een serie diepere exchange-handleidingen — **Blofin koppelen + importeren** (lesson l18) toegevoegd onder Help. Beginner-niveau, ~12 min, dekt zowel CSV als API.

### Toegevoegd
- **Lesson l18 — "Blofin koppelen + importeren"** — stap-voor-stap voor zowel **CSV-export** (eenvoudig) als **API-koppeling** (live sync). Schrijfstijl gericht op iedereen "met en zonder kennis":
  - Glossary in-lesson voor jargon (API key vs Secret vs Passphrase, IP whitelist).
  - Veiligheidswaarschuwing prominent: alleen `Read`-permissie aanvinken — Trade en Withdraw uit. Met *waarom*-onderbouwing.
  - **De 90-dagen-trap** — kritieke pitfall die Blofin's officiële docs noemen: een API-key zonder IP-whitelist verloopt na 90 dagen, sync stopt dan stilletjes. Twee oplossingen (statisch IP / kalender-reminder) uitgelegd.
  - Common-pitfalls-sectie: mobile app kan niet exporteren · contract size BTC = 0.001 · funding fees ontbreken in standaard CSV (apart aanvragen via support) · 180 dagen max per export · partial closes worden automatisch geaggregeerd.
  - "Trades komen niet binnen — wat nu?" troubleshooting met verwijzing naar exacte CSV-headers (`Underlying Asset` / `Avg Fill` / `PNL`) zodat user zelf kan checken of 't juiste export-type gekozen is.
  - **"Laatst gecontroleerd: 2026-05-02"** stempel onderaan — UI's veranderen, dit erkent dat.

### Tests
- **Nieuwe Playwright spec `tests/blofin-lesson.spec.js`** (2 scenario's): (1) lesson-card zichtbaar in Help → lessons, kern-secties + 90-dagen-trap + CSV-headers worden correct gerenderd, géén JS-errors; (2) "Open Accounts →"-knop in lesson navigeert naar Accounts-tab (verifieert lesson-link click-handler).
- **Babel-deoptimisation-noise** in console wordt expliciet gefilterd in test-assertions — die warning hoort bij in-browser babel-compilatie van een groot single-file script en is geen bug.
- Volledige focused regressie: 21/21 groen (smoke + blofin-partial + tag-delete + flat-sync + tendencies + default-tags + blofin-lesson).

### Volgorde van komende exchange-lessons
- v12.76 — MEXC (l19)
- v12.77 — Kraken Futures (l20) + Hyperliquid (l21)
- v12.78 — FTMO MT5 (l22), CSV-only

Per release: review door Denny + Sebas tegen hun eigen accounts vóór de volgende lesson begint.

---

## [v12.74] — 2026-05-02

Standaard tag-baseline voor nieuwe users afgestemd op de community-set die Denny + Sebas hanteren.

### Gewijzigd
- **`DEFAULT_TAGS`** vernieuwd naar de set die zichtbaar is in de community-screenshot. Per categorie:
  - **Setup Type** (10): toegevoegd `Structuur`, `MLS`, `Range`, `Bullish retest`, `Bearish retest`. Verwijderd: `Fill Play`.
  - **Confirmaties** (11): kern (`Liquidity Sweep`, `OB`, `EQL/EQH`) behouden + nieuw: `FVG`, `Flat candle`, `Session sweep US/UK/AS`, `VAH / VAL / POC`, `Range retest`, `Range acceptatie`, `Spot koop`, `Spot verkoop`. Verwijderd: `Divergence`, `ChoCh`, `Directe Play`, `Backtest Play`.
  - **Timeframe** (10): `30M` en `2H` toegevoegd voor fijnere intraday-granulariteit.
  - **Emoties** (6): gereduceerd tot 3 negatief (`FOMO`, `Gehaast`, `Twijfels`) + 3 positief (`Geduldig`, `Rustig`, `Zelfverzekerd`). Onbruikbaar geworden: `Overconfident`, `Gefrustreerd`, `Tilt`, `Onzeker`, `Kalm`, `Gedisciplineerd`.
  - **Fouten**: ongewijzigd (8 tags).
  - **Missed-redenen**: zelfde labels, andere icons — `🐢 Durf`, `🔪 Buiten regels`, `⏰ Te laat gespot`, `💰 Kapitaal vol`, `🌫️ Onduidelijk`, `🚷 Bewuste skip`, `🛌 Offline`.
- **Geen migratie van bestaande users**. `tagConfig` in localStorage blijft 1-op-1 staan voor iedereen die al een eigen set heeft. Alleen verse installs (geen `tj_tags`-key) krijgen de nieuwe defaults. Reden: users hebben hun tag-config vaak gepersonaliseerd; force-merge zou ongewenst zijn.
- **`EMOTIONS_NEG` / `EMOTIONS_POS` blijven comprehensive** — bevatten naast de nieuwe defaults ook alle legacy-emoties (`Overconfident`, `Gefrustreerd`, `Tilt`, `Onzeker`, `Kalm`, `Gedisciplineerd`) zodat trades met die historische tags nog steeds rood-vs-groen geclassificeerd worden in alle widgets (TagManager, Tendencies-tag-styling, FilterBar emotion-chips).

### Tests
- **Nieuwe Playwright spec `tests/default-tags.spec.js`** — 2 scenario's: (1) verse user krijgt exact de 10+11+10+6+8+7 tags via `data-testid` lookup in TagManager; (2) bestaande user met eigen `tj_tags` behoudt die config volledig en krijgt geen automatische merge.

---

## [v12.73] — 2026-05-02

Tag-delete strip nu ook layers (fix voor "SFP blijft staan in trade-overzicht na verwijderen"). Plus bulk-tag knop tijdelijk verborgen want feature mist nog logica.

### Fixed
- **Critical: tag-delete pad A liet de tag in `layers[].setups` / `.confirmations` / `.timeframe` staan.** Reproductie (Denny): SFP zit in een laag van een trade, gebruiker verwijdert SFP via Instellingen → Tags met *"Verwijder uit config én van trades"*. Voorheen werd alleen `t.setupTags` (flat) geleegd; v12.70's `syncTradeFlatFields` zou bij de eerstvolgende load de flat herafleiden uit de niet-opgeschoonde layers, dus SFP kwam terug. Bovendien rendert de trade-list de chips direct uit `layers[]`, dus de tag bleef visueel zichtbaar zelfs zonder die revival. **Fix**: gedeelde top-level helper `stripTagFromTrade(t, catKey, tag)` die zowel de platte array als alle layer-velden cleant en daarna `syncTradeFlatFields` runt. Voor `timeframeTags` op een laag met die TF: `L.timeframe` wordt geleegd, layer + setups + confirmations blijven. `bulkUntag` (uit v12.72) gebruikt nu dezelfde helper — zelfde regel op één plek.
- **`removeTag`-counter telt nu ook layer-voorkomens.** Voorheen: `trades.filter(t => (t[catKey]||[]).includes(tag))` miste tags die alleen in een layer zaten (de delete-modal vuurde dan niet, ook al stond de tag wel ergens op de trade). Nu via `tradeHasTag(t, catKey, tag)` — top-level helper die flat én layers checkt.

### Gewijzigd
- **"Tags toevoegen"-knop op de Trades-pagina tijdelijk verborgen** *(zie [BACKLOG.md](BACKLOG.md) "🚧 Hidden / work-in-progress")*. De feature werkte technisch (timeframe + layer-builder + toggle) maar miste nog logica volgens Denny — bv. hoe omgaan met meerdere layers per trade en een "verwijder hele layer"-actie. Knop is verstopt via `{false && <button .../>}`-wrap; bulk-tag panel-code, handlers en 9 Playwright scenario's blijven intact zodat re-activeren een 2-regel-edit is. Spec `tests/bulk-tag-layered.spec.js` is gemarkeerd als `test.describe.skip(...)` met dezelfde reden.

### Tests
- **Nieuwe scenario in `tests/tag-delete-modal.spec.js`**: *"Pad A op layered trade"* — SFP staat in twee layers van één trade, klik *"Verwijder uit config én van trades"* → beide layers krijgen SFP gestript, layer-count blijft 2 (TF + confirmations behouden), flat is correct gederiveerd. Volledige focused regressie: 17/17 groen.

---

## [v12.72] — 2026-05-02

Bulk-tag knoppen tonen nu actieve staat én werken als toggle — visueel gelijk aan de tag-pickers in TradeForm.

### Toegevoegd
- **Active-state styling** op de simple-tag knoppen in het bulk-tag panel. Een tag-knop wordt **goud-gehighlight** (zelfde stijl als TradeForm + de layer-builder picks) wanneer **alle** geselecteerde trades de tag hebben — voor layer-aware velden (Setup Type / Confirmaties / Timeframe) checkt de helper zowel de platte arrays als alle `layers[].setups` / `.confirmations` / `.timeframe`. Beantwoordt Denny's vraag *"die knop moet vasthouden welke geselecteerd is, zoals in de trade zelf"*.
- **Toggle-gedrag**: klik op een actieve knop **verwijdert** de tag van alle geselecteerde trades; klik op een inactieve knop **voegt 'm toe** (oud gedrag). Mixed state (1 van 2 trades heeft de tag) telt als inactive — eerste klik vult dan iedereen aan, tweede klik verwijdert overal.
- **`aria-pressed`** attribuut op de tag-knoppen voor screen-readers en betrouwbare test-assertions.

### Gewijzigd
- **Nieuwe `bulkUntag(ids, field, tag)` handler** — spiegelvorm van `bulkTag`. Strip de tag uit de platte array én uit ALLE layers (over alle layers, niet alleen de eerste — anders zouden lagere lagen 'm behouden). Voor `timeframeTags` op een layer met die TF: clear `L.timeframe` maar behoud de layer (setups/confirmations blijven). Roept `syncTradeFlatFields` aan na de mutatie zodat flat-arrays correct herbouwd worden.
- Toast-feedback verschilt per richting: *"X toegevoegd aan N trades"* vs *"X verwijderd van N trades"*.

### Tests
- **Vier nieuwe scenario's in `tests/bulk-tag-layered.spec.js`** (totaal 9 in deze spec, 25 over de focused regressie):
  - Active-state: tag op alle selected → `aria-pressed="true"` + klik = remove uit beide
  - Mixed state: tag op één-van-twee → `aria-pressed="false"` + klik = add to all
  - Layer-aware untag: SFP in twee verschillende layers → klik = beide layers strippen
  - Timeframe-untag op layer: TF wordt geleegd, layer + setups + confirmations blijven

---

## [v12.71] — 2026-05-02

Bulk-tag panel voor Trades-pagina: Timeframe-rij + complete layer-builder + layer-aware single-tag knoppen.

### Toegevoegd
- **Timeframe-categorie** in het bulk-tag panel — 5e knoppenrij, naast Setup Type, Confirmaties, Emoties en Fouten. Voorheen was timeframe alleen via de TradeForm per trade in te stellen.
- **Layer-builder** in het bulk-tag panel — bouw één complete laag (TF + setup(s) + confirmatie(s)) en voeg 'm met één klik toe aan **alle** geselecteerde trades. Herhaal voor extra lagen. Beantwoordt de directe behoefte: *"meerdere lagen toevoegen via Trades-pagina"*.
  - **Dedupe**: zelfde TF + dezelfde setup-set + dezelfde confirmation-set = skip (idempotent).
  - **Disabled-state**: knop *"+ Voeg layer toe"* is alleen actief als minstens één setup óf één confirmatie gepickt is. Lege lagen (alleen TF, geen tags) zijn betekenisloos en niet toegestaan.
  - **Wissen**-knop reset de pickers, *"+ Voeg layer toe"* reset óók na succesvolle toevoeging.

### Gewijzigd
- **`bulkTag()` is nu layer-aware** — voor trades met `layers.length > 0` schrijft de simple tag-knop (Setup Type, Confirmaties, Timeframe) naar de **eerste layer** in plaats van de platte array. Voorheen schreef 'ie naar flat, maar v12.70's `syncTradeFlatFields` zou die mutatie bij de volgende load weer wegvegen omdat layers winnen. Voor `emotionTags` en `mistakeTags` blijft platte append gelden — die zitten niet in layers.
- Bij Timeframe-tag op een layered trade waar de eerste layer al een TF heeft: **timeframe wordt niet overschreven** (bestaande layer-info is sacred). De user kan via TradeForm een nieuwe layer maken voor extra TF's.
- Na elke bulk-mutatie wordt `syncTradeFlatFields` aangeroepen zodat de gederiveerde flat-arrays consistent blijven met de layers — zo blijven FilterBar, Analytics, Tendencies en TagManager up-to-date direct na de bulk-actie.

### Tests
- **Nieuwe Playwright spec `tests/bulk-tag-layered.spec.js`** — 5 scenario's: Timeframe-rij zichtbaar, layer-builder voegt layer toe aan elke geselecteerde trade, dedupe werkt, simple-tag knop schrijft naar eerste layer (layered trade), simple-tag knop schrijft naar flat (geen layers).
- Volledige regressie: 21/21 groen (smoke, blofin-partial, tag-delete, flat-sync, tendencies-untagged, bulk-tag-layered).

---

## [v12.70] — 2026-05-02

Flat-tag-sync uit `layers[]` — fixt onzichtbare layer-tags in TagManager, FilterBar, Analytics en Tendencies.

### Fixed
- **Critical: layer-tags telden nergens mee** — trades met `layers[]` (multi-entry / multi-TF setups, bv. *"1H · SFP · Liquidity Sweep"* + *"5M · MSB · OB"* in één trade) sloegen hun setup/timeframe/confirmation **alleen** op in `layers[].setups` / `.timeframe` / `.confirmations`. De platte arrays `setupTags` / `timeframeTags` / `confirmationTags` bleven leeg. Gevolg: deze trades waren **onzichtbaar** voor:
  - TagManager-counter (`Nx` ontbrak naast tags) en de v12.69 delete-modal (viel terug op simpele confirm omdat usedCount=0)
  - FilterBar setup-chips ([5228](work/tradejournal.html#L5228))
  - `applyFilters()` op setupTags ([5263](work/tradejournal.html#L5263))
  - Analytics `setupPerf` ([2858](work/tradejournal.html#L2858)) en `rrBySetup` ([8091](work/tradejournal.html#L8091))
  - `detectTendencies()` detector #2 (setup × pair) en #7 (setup × session) ([5932](work/tradejournal.html#L5932))
- **Fix**: nieuwe helper `syncTradeFlatFields(trade)` (spiegelvorm van `syncPlaybookFlatFields`) derives platte arrays als unie van alle `layers[].*`-waarden. Wordt aangeroepen op twee plekken:
  - **`normalizeTrade()`** — draait op elke load (localStorage + IndexedDB + JSON-import). Migreert historische trades automatisch zonder schemaVersion-bump; alle 173 layer-only trades van Denny krijgen direct correcte flat-arrays bij eerste boot van v12.70.
  - **`saveTrade()`** — derives flat-arrays uit `enriched.layers` vóór het persisten, zodat nieuwe edits direct correcte stats geven.
- **Behoudregel**: alleen syncen als `layers.length > 0`. Trades zonder layers (oude-stijl handmatige flat-tagging) blijven ongemoeid. `emotionTags` / `mistakeTags` raken nooit door deze sync, want layers slaan die niet op.
- **Conflict-resolution**: bij stale flat-tags die niet in layers voorkomen, **winnen layers** (overschrijven flat). Consistent met `syncPlaybookFlatFields`-gedrag.

### Tests
- **Nieuwe Playwright spec `tests/trade-flat-sync.spec.js`** — 5 scenario's: layer-only migratie na load, flat-only blijft ongemoeid, lege `layers:[]` blijft ongemoeid, layers winnen bij conflict, en TagManager-counter + v12.69 delete-modal vuren correct voor layer-only tags.

---

## [v12.69] — 2026-05-02

3-keuze tag-delete modal — voorkomt verloren tags op trades bij wissen via Instellingen.

### Gewijzigd
- **Tag verwijderen in Instellingen → Tags** vraagt nu expliciet wat er met de tag op bestaande trades moet gebeuren. Voorheen verdween de tag alleen uit de config en bleef hij stilzwijgend op alle trades hangen — verwarrend bij latere filtering. Nu krijg je een modal met 3 opties:
  - **⚠ Verwijder uit config én van trades** (rood/destructief) — tag verdwijnt overal.
  - **✓ Verwijder uit config** (goud/neutraal) — trades behouden hun tag (oude gedrag, expliciet gemaakt).
  - **Annuleren** (grijs, default keyboard-focus) — niets verandert.
- Modal verschijnt **alleen** als de tag op ≥1 trade staat. Bij een ongebruikte tag valt het terug op een simpele bevestiging zoals voorheen — geen dialog-fatigue voor lege tags.
- ESC-toets en klik buiten de modal sluiten zonder wijzigingen.
- Toast-feedback verschilt per pad (*"... verwijderd uit config en van 12 trades"* vs *"... uit config; 12 trades behouden hun tag"*) zodat je direct weet wat er gebeurd is.

### Tests
- **Nieuwe Playwright spec `tests/tag-delete-modal.spec.js`** — 6 scenario's: pad A/B/C, ESC, klik-buiten-modal, en de fallback bij 0 trades. Voegt `data-testid="tag-box-${catKey}-${tag}"` toe aan tag-boxes voor robuuste lookup vanuit tests.

---

## [v12.68] — 2026-05-02

Tendencies-page voor users zonder tags — 4 nieuwe tag-loze detectoren + empty-state hint.

### Toegevoegd
- **4 tag-loze tendency-detectoren** — werken puur op `pair`, `direction`, `date` en `time`, dus zichtbaar zonder dat je trades getagd hebt:
  - **#8 pair × sessie** (🎯/🕒) — sterke of zwakke edge per pair-tijdvak combo (bv. *"BTC/USDT verzwakt in London PM"*).
  - **#9 direction-bias** (↔️) — long/short bias per pair, alleen verlies-zijde geflagd, met opposite-direction stats in de beschrijving (*"Tegenovergestelde richting op zelfde pair: 63% WR over 32 trades"*).
  - **#10 day-of-week** (📈/📉) — top-1 verlies-dag + top-1 flow-dag (max 2 cards, geen 7×spam). Gate op ≥30 closed trades zodat weekdag-stats niet flapperen op kleine datasets.
  - **#11 overtrading-cluster** (🌀) — detecteert 5+ trades binnen 2 uur; firet pas bij ≥2 verlies-bursts (1 cluster = toeval, 2+ = patroon). Klassieke revenge/FOMO-signaal.
- **Empty-state hint op Tendencies-page** — *"Patronen-bibliotheek: X van 11 actief"* banner verschijnt zodra <10% van je trades getagd is. Legt uit welke detectoren je ontgrendelt door 2 setup-tags + 2 emotion-tags toe te voegen. Permanent dismissable via *"Niet meer tonen"* (`tj_tendencies_taghint_dismissed`).
- **`Weekdag`-filter-chip-rij** in de FilterBar (geavanceerde filters) — Ma/Di/Wo/Do/Vr/Za/Zo, multi-select, tijdzone-aware via `Europe/Amsterdam`.
- **`tradeIds`-actieve-filter-chip** naast de Reset-knop (*"🔍 N specifieke trades ✕"*) — verschijnt wanneer een tendency-cluster geklikt wordt en filtert op exact die set trades. Klik om te legen.

### Gewijzigd
- **Filter-infra uitgebreid**: `applyFilters` ondersteunt nu `dayOfWeek` (array van 0-6, zondag=0) en `tradeIds` (array van trade-ID's). `tradeMatchesTendencyFilter` ondersteunt nu ook `direction` (verbetert cross-validation voor bestaande detectoren). Beide additief, geen schemaVersion-bump.
- **`crossValidateTendency` skipt op `tradeIds`-filters** — overtrading-clusters zijn gedragspatronen op specifieke real-trades, niet repliceerbaar in backtests/paper-trades.
- **`DETECTOR_REGISTRY`-constante** — declaratieve lijst van alle 11 detectoren met hun tag-vereisten. Drijft de "X van 11 actief"-counter automatisch zodat toekomstige detectoren één regel toevoeging zijn.

### Tests
- **Nieuwe Playwright spec `tests/tendencies-untagged.spec.js`** — seedt een dataset van 52 ongetagde trades met ingebouwde patronen (BTC long winners, ETH long losers, BTC short bias, 2 verlies-clusters). Valideert dat ≥3 detectoren firen, dat de hint verschijnt + correct gedismissed wordt + persistent blijft over reloads.

---

## [v12.67] — 2026-05-02

Sessie 2 van pro-trader-review followup — 4 majors uitgewerkt.

### Toegevoegd
- **Trade Score-tooltip** op Review-pagina — hover over de 35/100 score-cirkel toont breakdown: "Start: 50 + WR-bonus + PF-bonus + Avg-W>L bonus − uitschieter-penalty = score". Plus een ⓘ-icoon naast de "Trade score"-label met uitleg over de formule en interpretatie (75+ sterk, 50-74 OK, <50 aandacht). Pro-trader review feedback: "score 35/100 zonder uitleg = vanity metric".
- **Drawdown-limiet in top-bar** — als een gebruiker een actieve `maxDD`-goal heeft (al beschikbaar in Goals-tab), toont de top-bar nu `DD -$X / -$Y limiet` met kleurindicatie (rood bij ≥80%, amber bij ≥60%). Voor FTMO/prop-firm-traders is dit critical context; voorheen toonde de bar alleen het bedrag zonder threshold.
- **Empty-state Analytics proces-KPI's** — "Thesis-gevuld / SL-gedefinieerd / Post-trade notes" tonen nu **"—"** met cursief sub-tekst *"Niet getrackt — vul X in trade-form"* als geen enkele trade het veld ingevuld heeft. Voorheen toonde elke KPI rauw 0% wat demotiverend was bij eerste import. Plus een explainer-banner bovenaan de Proces-tab die het verschil met Kalender's "Trading Rules" duidelijk maakt.

### Gewijzigd
- **Analytics proces-KPI labels hernoemd** voor duidelijkheid: "Plan gevolgd" → **"Thesis-gevuld"**, "Stop-loss discipline" → **"SL-gedefinieerd"**, "Journal compleet" → **"Post-trade notes"**. Maakt expliciet dat dit *trade-data-compleetheid* meet, niet *rule-volgen* (dat is Kalender's Trading Rules). Pro-trader review feedback: twee parallelle "rules"-systems waren verwarrend.

### Niet gefixt — was misinterpretatie
- **"Sharpe Cumulatief" mislabel** — geverifieerd in code: review-pagina toont correct "Huidige cumulatief" (geen "Sharpe"-label). Mijn pro-trader-review screenshot was misgelezen.

### Nog op backlog
- Default account-name "Trader" → onboarding-vraag (skip, te complex voor minor)
- Period-tab dedup "Halfjaar/6M" — niet teruggevonden in code (was visualisatie-artifact)
- Echte Sharpe-ratio-berekening (was niet kapot, alleen nice-to-have)

Zie [docs/pro-trader-review-2026-05-02.md](docs/pro-trader-review-2026-05-02.md) voor de volledige context.

---

## [v12.66] — 2026-05-02

### Fixed
- **Critical: PnL/WR-inconsistency tussen Dashboard en Trades-pagina** *(uit pro-trader review 2026-05-02)* — Dashboard toonde `$-8,37 / WR 33,3%` terwijl Trades-pagina header `$-11,63 / WR 27%` toonde voor exact dezelfde dataset. Verschil = de PARTIAL-trade die op Dashboard wel meetelde, op Trades niet (Trades had eigen `consumedSiblingIds` filter, Dashboard had die niet). Fix: helper `getConsumedSiblings()` op top-level geëxtraheerd, App past 'm één keer toe op `mergedTrades` vóór `applyFilters` zodat alle views (Dashboard / Trades / Analytics / Review / Calendar / Rapport) dezelfde set zien. Plus: Trades-stat-line gebruikt nu `closedSorted` (excl. open trades in WR-noemer, consistent met Dashboard).
- **Critical: Floating-point precision in trade-edit modal** — Entry/Exit/PnL/Fees velden toonden rauwe float-waarden zoals `2255.5805555555557` (16 decimalen) en `-6.749084190000000001`. Pro-trader-vertrouwen breekt bij elke ruis-pixel. Fix: nieuwe helper `fmtPriceDisplay()` rondt floating-point-ruis af met smart-decimals op basis van magnitude (BTC ~78000 → 2 decimalen, ETH ~2300 → 2, alts < 1 → 6, sat-precision tot 10 decimalen behouden). Toegepast op alle modal-input-bindings.
- **Minor: Currency-format `$-4,66` → `-$4,66`** — minus stond NA dollar-symbool op Goals-cards (Net P&L, Expectancy). Pro-conventie: minus altijd VOOR symbool. Fix: `(v>=0?"+":"")+"$"+abs` patroon vervangen door `(v>=0?"+":"-")+"$"+abs` op regels 1570, 1578.

### Toegevoegd
- **Sample-size waarschuwingsbanner** — nieuwe `<SampleSizeBanner n={...} threshold={30}>` component die alleen rendert als trades-count onder de drempel zit. Plug-in op Dashboard, Review, Analytics. Tekst: *"⚠ Sample-size waarschuwing: N trades — onder de 30-drempel voor statistisch betrouwbare conclusies. Profit Factor, Expectancy, WR per setup zijn indicatief; behandel als richting, niet als feit."* Edgewonk/TradeZella-conventie. Pro-trader checklist top-5.

### Gewijzigd
- **Mindset-banner alleen op Dashboard + Review** (was elke pagina) — pro-trader feedback: banner op iedere tab is afleidend; mindset-reflectie hoort bij review-momenten, niet tijdens data-werk op Trades/Analytics.
- **"Voeg een account toe"-CTA** op Dashboard toont nu "Account-balans niet geconfigureerd" als er gesyncte trades zijn maar geen API-balans. Voorheen suggereerde de CTA dat er nog geen accounts waren terwijl er wel trades stonden.

### Niet gefixt in v12.66 (op backlog gebleven)
- **Twee parallelle "rules"-systems consolideren** (Calendar 5/5 vs Analytics 0%) — vereist conceptuele beslissing
- **"Sharpe Cumulatief" mislabel op Review** — wacht op echte Sharpe-berekening
- **"Trade Score 35/100" tooltip** — needs design-think
- **Drawdown-limit configurable** in Goals — feature-werk, niet bug-fix
- **Empty-state Analytics 0%-metrics** — needs design

Zie [docs/pro-trader-review-2026-05-02.md](docs/pro-trader-review-2026-05-02.md) voor volledige context en [BACKLOG.md](BACKLOG.md) "🔜 Next up" voor de overige 5 majors.

---

## [v12.65] — 2026-05-01

### Toegevoegd
- **Trade Performance Report** — nieuwe hoofdpagina (📄 Rapport-tab in de nav, tussen Review en Kalender). 12-pagina institutioneel rapport met cover, executive summary, performance overview (equity-curve + drawdown underwater chart), risk analysis (Sharpe/Sortino/Calmar), trade statistics (R-multiple distributie + top winners/losers), segmentatie (per setup/pair/exchange), tijd-analyse (kalender heatmap + per weekdag), process & discipline scorecard, **5 reflectie-prompts met persistent storage per periode**, auto-gegenereerde findings & next steps, glossary + methodology + disclaimer.
- **Periode-selector**: Week / Maand / Kwartaal / Jaar / Custom range — alle metrics herberekenen live op basis van trade exit-datum.
- **Sectie-toggles**: gebruiker kan via "⚙ Secties"-dropdown elke sectie aan/uitvinken voor het rapport.
- **Sample-size waarschuwing** verschijnt automatisch bij < 30 trades in de gekozen periode (Edgewonk/TradeZella richtlijn).
- **Smart fig.2-fallback**: bij < 5 buckets toont een tabel ipv een bar-chart (voorkomt amputeerd-ogende grafieken bij week-rapport met 7 dagen of kwartaal-rapport met 3 maanden).
- **Auto-gegenereerde findings**: top-3 hoofdbevindingen op p2 + strengths/weaknesses op p11, gebaseerd op profit factor, win rate, max drawdown en setup-performance van de echte trades.
- **PDF-export via `Ctrl+P`** met `@media print` styles: hide app-chrome, A4 portrait, page-breaks per sectie.
- **Branded cover**: SyncJournal masthead, "CONFIDENTIAL" stempel, samenvatting-line met Net P&L · Win Rate · Profit Factor · Avg R, en spark-equity onderaan de cover.
- **Inline metric-uitleg**: info-icoontjes + "Hoe te lezen"-blokken bij elke KPI/figuur, plus glossary op p12.

### Gewijzigd
- **Source Serif 4** ingeladen met extra `weight 900` voor de hero-titels van het rapport (was eerst alleen 300/400/600/700).
- **Hoofdnav**: 8 zichtbare tabs in plaats van 7 (`TABS.slice(0,7)` → `TABS.slice(0,8)`) om Rapport ernaast te tonen.

### Verwijderd
- **Dode "📄 Genereer rapport"-knop op het Dashboard** — `onReport`-prop, dode `showPdf`-state en de `setShowPdf(true)`-wiring zijn allemaal weg. Rapport heeft nu een eigen tab als logische plek.

### Onderzoek
- Voorafgaand aan de bouw is online onderzoek gedaan naar Edgewonk / Tradervue / TradeZella / TradesViz rapport-formaten + institutional tear-sheet-structuur (hedge funds, CTA monthly reports, McKinsey/Goldman) + Steenbarger/Mark Douglas reflectie-frameworks. Sample size, mistake-clustering, één-actiepunt-principe en risk-adjusted-ratio uitleg komen direct uit dit onderzoek. Anti-gamification-principe (CFA Institute / Management Science research) heeft de visuele toon bepaald: serieus, plat, monochroom-bias, geen confetti.

---

## [v12.64.12] — 2026-05-01

### Verwijderd
- **"Share Card v2" titel + sidebar lead-tekst** — de "Share Card v2" header en de regel "4 designs. Auto-suggest variant. Brand: moranitraden.nl." in de share-modal sidebar zijn weg. Sidebar begint nu direct met de close-knop en de direction-tiles. Cleaner.

---

## [v12.64.11] — 2026-05-01

### Fixed
- **Letterbox-look op Reactions 16:9 was inconsistent** — `object-fit: contain` werkt afhankelijk van photo-aspect ratio. Goodfellas (407×484) en Final Boss (417×538) zijn taller dan de photo-container, dus contain gaf side-letterbox ipv top+bottom — niet de "filmposter"-look die OMG/Pablo wel hadden. Fix: padding-based letterbox via `padding: 50px 24px` op `.tc-photo` + `display: flex` met centered img. Garandeert consistente top+bottom (en kleine zijkant) ruimte voor alle 5 varianten ongeacht photo-aspect.
- **Goodfellas: groen confetti-vierkantje op voorhoofd** — verplaatst van `top: 30%, left: 60%` (recht boven gezicht) naar `top: 8%, left: 50%` (top edge, valt nu in de bovenste letterbox-balk).

---

## [v12.64.10] — 2026-05-01

### Gewijzigd
- **Alle Reactions 16:9 varianten: letterbox-look met `object-fit: contain`** — wat in v12.64.9 alleen voor OMG werd toegepast (met paarse letterbox), gebeurt nu voor alle 5 mood-varianten (Goodfellas/Giggling/OMG/FinalBoss/Pablo). Photo background staat op `transparent` zodat de variant-gradient (gold/sage/magenta/obsidian/burnt-grey) als naadloze letterbox door de bovenkant en onderkant van de foto schemert. Hele meme-foto altijd compleet zichtbaar — gezicht én eventuele meme-tekst niet meer afgesneden op 16:9.
- **1:1 ongewijzigd** — daar blijft `object-fit: cover` met variant-specifieke `object-position` tweaks (giggling 22%, finalboss 25%, omg 25% top voor face-focus). Wider container in 1:1 maakt cover daar wel werkbaar.

---

## [v12.64.9] — 2026-05-01

### Fixed
- **OMG meme cropping per format apart afgestemd** — OMG photo (483×440) past niet perfect in beide formats. Vorige fix met `object-position: center 95%` toonde tekst maar sneed gezicht af op 1:1, en sneed tekst af op 16:9. Nu format-specifiek:
  - **16:9** (taller container 540×608): `object-fit: contain` + OMG-paars achtergrond — hele meme zichtbaar (gezicht + "OMG THIS IS SO EXCITING!" tekst), met minimale letterbox die opgaat in de bg-kleur.
  - **1:1** (wider container ~520×280): `object-position: center 25%` — focus op gezicht/hoofd top, tekst onderaan wordt afgesneden (Denny's keuze: hoofd belangrijker dan tekst op 1:1).

---

## [v12.64.8] — 2026-05-01

### Fixed
- **Pre-entry hero pct duwde stats naar de rand** — bij Reactions OMG variant met 4 stats (R Target/Entry/Target/Stop) was de hero `+126,92%` op 84px (Reactions default) te dominant. Stats rechts werden naar de rand geknepen. Fix: pre-entry pct krijgt **64px** voor 16:9 (was 84px) en **44px** voor 1:1 (was 60px). Closed-trade hero blijft 84px/60px omdat die maar 3 sub-stats heeft (PnL/R/Hold).

---

## [v12.64.7] — 2026-05-01

### Fixed
- **Setup-tags lazen niet uit `trade.layers[]`** — sinds v12.54 worden setup/confirmation tags vaak in **layers** opgeslagen (multi-laag setup-systeem) ipv de legacy flat `trade.setupTags[]`. De share-card las alleen het flat veld, dus voor trades met layered setups bleef de tag-string leeg. Nu **beide bronnen samengevoegd**:
  - `trade.setupTags[]` (legacy flat, fallback voor oude trades)
  - `trade.layers[].setups[]` + `trade.layers[].confirmations[]` (nieuwe multi-laag structuur)
  - Gededupliceerd via `Set`, max 2 setups + 2 confirmations = 4 tags totaal.
- **Lege rijen op alle 4 directions** — voor open/sync trades waar `stopLoss`, `setup`, `entry/exit` of `hold` leeg zijn, toonden cards rijen met alleen labels en geen waarden. Bv. Dossier toonde "Stop loss" en "Setup" rijen leeg, en de subhead bevatte "Setup: ." (alleen punt). Fix: alle stat/tabel/sub-rijen vereisen nu zowel toggle aan **als** non-empty waarde.

---

## [v12.64.6] — 2026-05-01

### Fixed
- **Setup-tag werd niet getoond op pre-entry/open trade share-cards** — voor open trades (Reactions OMG variant) zat de setup-tag wel in de meta-row maar door de specifieke logica + lege `setupTags` op API-imports kwam de tag niet in beeld. Nu **vervangt setup-tag de generic "Setup" label in de eyebrow** voor pre-entry: voorheen `▶ Setup · Short · ETH/USDT` → nu `▶ Breakout · Pullback · Short · ETH/USDT`. Voor closed trades blijft setup-tag in de meta-row zoals voorheen.
- **"STOP"/"Entry"/"TP" toonden zonder waarde** — als de Stop-toggle aan stond maar `trade.stopLoss` was leeg, kreeg je de label "STOP" zonder cijfer (idem voor leeg Entry of Target). Nu: alle stat-rijen vereisen zowel toggle aan als non-empty waarde voordat ze renderen.

---

## [v12.64.5] — 2026-05-01

### Gewijzigd
- **Share-card preview groter en beter leesbaar** — modal-preview schaalde op 0.55× wat tekst (10-13px font-sizes) effectief naar 6-7px maakte op screen. Nu **scale 0.75×** voor zowel 16:9 als 1:1 — tekst is ~36% groter, leesbaarheid significant beter. Card native dimensies + PNG-export blijven onveranderd op originele resolutie (2× retina).

---

## [v12.64.4] — 2026-05-01

### Gewijzigd
- **Pre-entry (open trade) toont nu target Return% prominent** — voor de Reactions OMG variant (open trades) was er geen Return% maar een "PRE / ENTRY" placeholder. Nu berekent de share-card het **target return%** als `(exit − entry) / entry × 100` (richting-gecorrigeerd voor short) en toont die als hero, met **target R-multiple** + **TP** als sub-stats. Consistent met de hero-swap-philosophie van v12.64.2.
- **Setup-toggle toont nu setup + confirmation tags** — voorheen alleen `setupTags` (max 2). Nu voegt de share-card ook `confirmationTags` toe (max 2 elk = max 4 tags totaal). Voorbeeld: `Breakout · Pullback · Volume confirm · RSI divergence`.

### Fixed
- **OMG meme-foto cropping** — de "OMG THIS IS SO EXCITING!" tekst onderaan de meme werd afgesneden door `object-fit: cover` met default center-positie. Fix: `object-position: center 95%` voor de OMG variant zodat de tekst onderaan in beeld blijft (gezicht boven blijft ook zichtbaar).

---

## [v12.64.3] — 2026-05-01

### Fixed
- **"Deel kaart"-knop verscheen alleen bij Blofin-trades, niet bij MEXC** — de knop-conditie was `{trade.pnl && ...}`, wat falsy is bij lege string `""`. MEXC's API-mapping doet `pnl: String(t.realised || "")` waarbij JavaScript `0 || ""` als `""` evaluatert (0 is falsy). Resultaat: voor MEXC break-even trades én alle open trades was de knop verborgen. Fix: knop altijd tonen — open trades krijgen automatisch de pre-entry (OMG) variant in de share-card via auto-suggest, en break-even trades zijn ook deelbaar.

---

## [v12.64.2] — 2026-05-01

### Gewijzigd
- **Share-card v2 hero-swap: Return% groot, PnL secundair** — geïnspireerd op MEXC's referral-card waar `+68.86%` enorm in beeld staat met `+5.22 USDT` daaronder. In alle 4 directions (Reactions/Cinema/Dossier/Monogram) is nu de **return-percentage de hero**:
  - **Reactions** 16:9 + 1:1: `tc-pnl-num` toont nu `+3,16%` (was `+$945`); PnL prominent in stats-rij als `+$945 USDT` met `tc-pnl-money` styling.
  - **Cinema** 16:9: `tc-pnl-hero` toont nu Return% in 76px Bodoni (was 56px voor pnl); sub-meta toont PnL + R-multiple.
  - **Cinema** 1:1: 96px Bodoni voor pct; pnl als sub-stat met `P&L` label.
  - **Dossier** 16:9: `tc-fact-num` 84px GFS Didot voor pct; PnL in fact-side als sub.
  - **Dossier** 1:1: 78px voor pct.
  - **Monogram** 16:9: `tc-num` 240px Didot voor pct (was 200px voor pnl); PnL als 1e fact-item in de facts-row.
  - **Monogram** 1:1: 200px Didot voor pct; label gewijzigd van "Realized P&L" naar "Return".

### Fixed
- **Setup-tag verdween in Reactions** — bug in meta-row logica: `else if (s.setup && !v.isPreEntry)` betekende dat setup-tag ALLEEN getoond werd als entry/exit UIT was. Met beide aan (default) verdween de setup-tag uit de share-kaart. Fix: setup-tag toont nu altijd als de toggle aan staat, naast entry/exit.
- **Setup-tag in Dossier/Monogram/Cinema** — werkte al correct via subhead/post/credits-block, alleen Reactions had de logica-bug. Geen wijzigingen nodig in de andere directions.

---

## [v12.64.1] — 2026-05-01

### Fixed
- **Share-card v2 modal: layout + render-fix** — bij eerste live-test bleek dat:
  1. **Cards overflowten buiten de modal** — de `1fr` grid-track in de modal liet 1080-1200px brede cards naar buiten ontsnappen. Fix: `gridTemplateColumns: "320px minmax(0, 1fr)"` plus `transform: scale(0.55)` op een fixed-dimensie wrapper per format. PNG-export blijft op origineel formaat (2× retina).
  2. **Cinema/Dossier/Monogram backgrounds onzichtbaar** — de tc-* CSS in het head `<style>` block werd door de browser parser niet geladen (parsing stopte ergens vóór de tc-injectie). Fix: CSS verplaatst naar een inline `<style>` tag binnen het TradeCardExport component zelf — wordt door React gemount samen met de modal en parseert gegarandeerd.
  3. **PNG-download van scaled preview** — html2canvas captureerde bij eerste implementatie de visueel-geschaalde versie. Fix: clone de card naar een offscreen sandbox zonder `transform`, capture daar, sandbox opruimen.

Geen visuele wijziging in de cards zelf — alleen de modal-rendering en download flow zijn betrouwbaar gemaakt.

---

## [v12.64] — 2026-05-01

### Gewijzigd
- **Share-trade kaarten compleet vernieuwd (v2)** — uitspraakvol design-systeem met **4 stijl-richtingen**:
  - **Reactions** — meme-foto met 5 mood-varianten (Goodfellas/Giggling/OMG/Final Boss/Pablo). Auto-suggest op basis van R-multiple + side. Past bij Discord/X community-vibe.
  - **Cinema** — A24/Mubi filmposter aesthetiek. Bodoni Moda + sprocket-holes + vignette. Cinematic restraint.
  - **Dossier** — editorial broadsheet. GFS Didot + warme paper texture + serif body. Trade als "een artikel".
  - **Monogram** — fine-art catalogus. Eén getal in Didot, witruimte, micro-typografie. Minimalistisch.
- **Per-veld toggle-checkboxes** — 9 toggles in de modal (Trade Nº, Datum, PnL $, Return %, R-multiple, Hold time, Entry/Exit, Stop, Setup tag) bepalen wat er op de card komt. Werkt over alle 4 directions.
- **Twee export-formats** per direction:
  - **16:9** (1080×608 of 1200×675) — voor Discord embeds + X link previews
  - **1:1** (520×520 of 760×760) — voor Twitter/X feed + Instagram
- **Brand `moranitraden.nl`** vast op elke kaart — niet meer editable.
- **PNG export** via `html2canvas` op 2× retina; **clipboard-kopie** voor direct plakken in Discord (Ctrl+V).

### Verwijderd
- **Oude v1 share-card** (9 stijlen: classic/ticker/story/minimal/boss/goodfellas/giggling/omg/pablo) — vervangen door v2-systeem hierboven. Voor referentie blijft de v1 in git history (`git log --all -- work/tradejournal.html`).

### Onder de motorkap
- **5 meme-PNG's als base64 ge-embed** in de single-file HTML (~1.8MB toename) zodat de app zonder externe `assets/share-cards/`-folder werkt — community downloadt 1 file en alles werkt.
- **Google Fonts uitgebreid** met Archivo Black, JetBrains Mono, Caveat, Cormorant Garamond, Bodoni Moda, GFS Didot, Source Serif 4 (alle Google CDN, geen build-stap).
- **CSS in `.tc-*` namespace** zodat de share-card stijlen niet botsen met de 6 app-thema's.

---

## [v12.63] — 2026-05-01

### Fixed
- **Toegankelijkheid: screen-reader labels op datum-velden** — vier `<input type="date">` velden hadden visuele labels maar geen programmatische koppeling, waardoor screen-readers (NVDA, JAWS, Windows Narrator) ze als "datum" voorlazen zonder context. Nu allemaal voorzien van een `aria-label`:
  - **Trade-form** datum (in Nieuw/Edit modal) → "Trade datum"
  - **Trades-filter** van/tot datum (boven trade-list) → "Filter datum vanaf" / "Filter datum tot en met"
  - **Geavanceerde filters** van/tot datum (uitklap-paneel) → idem
  - **Account-config** Sync-vanaf datum (Instellingen → exchange) → "Sync trades vanaf datum"
  - Geen visuele wijziging — `aria-label` is screen-reader-only metadata. Voldoet nu aan WCAG 2.1 niveau-A "1.3.1 Info and Relationships" en "4.1.2 Name, Role, Value".

---

## [v12.62] — 2026-05-01

### Toegevoegd
- **`partial`-status voor open posities met partial closes** (uit research naar TraderVue / Edgewonk / NautilusTrader patterns). Een Blofin-positie waarvan deels al gerealiseerd is (bv. 22-04 BTC short 0.0019 BTC + 29-04 TP1 0.0010 hit) verschijnt nu als één open trade met:
  - Amber **PARTIAL**-badge in trade-list (i.p.v. de gewone gouden OPEN-stip)
  - **Realized PnL** zichtbaar inline (bv. `PARTIAL +$3.26`) — aggregeert alle closed-records met dezelfde `positionId`
  - In TradeForm: Status-pill toont "Partial" met amber accent; status-bar hint *"🔄 Partial close · restant open · realized +$3.26"*
- Mirror-pattern uit best-in-class journals: een deels-gesloten positie is **niet open en niet closed** — het is een derde staat met eigen visueel karakter en eigen realized PnL.

### Schema
- `EMPTY_TRADE.realizedPnl` (string, default `""`) — sum van pnl van closed-siblings die dezelfde `positionId` delen. Gevuld door `syncOpenPositions`.
- `EMPTY_TRADE.status` accepteert nu `"partial"` als waarde (naast `"open"`, `"closed"`, `"missed"`). Gederiveerd, niet handmatig zetbaar — auto-overgang via sibling-detectie.

### Gewijzigd
- **`syncOpenPositions` doet nu sibling-detectie**: na de reguliere merge loopt 'ie door alle open trades van die exchange, zoekt closed-records die op `(pair, direction, entry-prijs op 8 decimalen)` matchen, en markeert de open trade als `partial` + sum'ed `realizedPnl`. **Niet** op `positionId` — empirisch bewezen via Denny's data dat Blofin `positionId` hergebruikt over meerdere posities (1 positionId telde 8 verschillende BTC-trades met verschillende entries). Een exacte entry-prijs op 8 decimalen is wel uniek per positie. Werkt voor elke exchange waar pair/direction/entry stabiel zijn over partial-close events — Blofin direct, MEXC en Hyperliquid impliciet.
- **TradeForm `isOpen`** behandelt `partial` nu hetzelfde als `open` voor exit-fields (verborgen) — positie is technisch nog open. Visueel onderscheid alleen via badge + hint.
- **FilterBar status-filter** — `"open"` matcht nu zowel `open` als `partial` records (want partial is een open-staat).

### Fixed (binnen v12.62, na test)
- **Partial-status auto-recompute bij app-load** — `detectPartialFromSiblings` runde voorheen alleen tijdens `syncOpenPositions` (knop-actie). Bij stale state (bv. na code-update of na localStorage-mutatie zonder verse sync) kon een open trade onterecht "open" of "partial" blijven met outdated `realizedPnl`. Nieuwe `useEffect` runt detectie 1× bij elke app-load over alle exchanges, en updatet alleen waar de gederiveerde waarde echt anders is.
- **Sibling close-records verbergen uit trade-list** — gemeld door Denny: de TP-record van 29-04 (+$3.26) verscheen naast de 22-04 PARTIAL-rij als losse trade. Beide vertellen hetzelfde verhaal. Nu: in TradeList rendering, closed-records die op `(source, pair, direction, entry)` matchen met een open of partial trade worden verborgen. localStorage en analytics blijven intact — pure visuele filter. Bij volledige positie-sluiting (open trade weg) komen ze automatisch terug als zichtbare losse trades.
- **Auto-fill `tpLevels` op partial-status open trades** — gemeld door Denny: de TP-record verdween uit de lijst maar verscheen niet in de "Take Profit niveaus" sectie van de open trade. Nu: `detectPartialFromSiblings` vult `tpLevels[]` met de matched siblings als de open trade nog géén user-gedefinieerde tpLevels heeft (geen overschrijving van eigen planning). Per niveau: `price` = closeAveragePrice, `pct` = correct berekend uit raw size, `status: "hit"`, `actualPrice` = closeAveragePrice. Voor Denny's geval: TP1 op 75.647,20 verschijnt als 34.48%-hit op de 22-04 BTC short (= 0.001 BTC van origineel 0.0029 BTC).
- **TP-winst-calc gebruikte rest-size i.p.v. originele size** — gemeld door Denny: TP1 toonde +$2.16 i.p.v. de echte +$3.35. `calcProfit` rekende `pct × positionSize` waarbij positionSize voor partial-trades de **rest** is (0.0019 BTC) i.p.v. **origineel** (0.0029 BTC). Fix: nieuwe veld `originalSizeAsset` op partial trades (gevuld door `detectPartialFromSiblings` als `rest + alle siblings`), en `calcProfit` gebruikt die wanneer `status==="partial"`. Voor closed/open trades: ongewijzigd gedrag.
- **"Uit Blofin ophalen" knop overschreef tpLevels met lege array** — gemeld door Denny: na klik verdween de auto-gevulde TP. Bug: `setTrade(p=>({...p,tpLevels:newTPs}))` overschreef ook als `newTPs.length === 0` na price-filter. Fix: bij geen valide fills toon waarschuwing-toast en behoud bestaande tpLevels (incl. door auto-detectie gevulde). Plus: knop verbergt zich bij partial-trades waar tpLevels al gevuld zijn — anti-conflict met auto-detectie.
- **Blofin closePositions eenheid-bug omzeild** — Blofin's `/positions-history` returnt `closePositions` in **base currency direct** (BTC voor BTC-USDT) terwijl `/positions` `positions` in contracts geeft. Onze fetchTrades vermenigvuldigt closePositions onnodig met ctVal=0.001 → `positionSizeAsset` op closed-records is 1000× te klein. Voor de tpLevels pct-berekening gebruiken we nu een nieuw veld `_rawCloseSize` (raw waarde) i.p.v. de buggy `positionSizeAsset`. Bredere fix (size-display in trade-list) blijft op backlog — heeft cosmetische impact maar geen logica-bug.

### Diagnostic — autonome iteratie zonder copy-paste-loop
- **📥 Snapshot Blofin response** knop in Accounts → Blofin. Doet beide API-calls (positions + positions-history) en biedt het rauwe resultaat aan als download-bestand `blofin-snapshot-<datum>.json`. Fixture is bedoeld als offline test-data — geen credentials erin.
- **🔬 Test fixture** file-input. Drop een eerder gecaptured snapshot → de app simuleert `fetchTrades` + `fetchOpenPositions` mapping op die data, runt `detectPartialFromSiblings` (de pure helper die ook in productie draait), en toont per open positie **expected vs actual**: hoeveel siblings, wat de realizedPnl moet zijn, of de status klopt. Mismatches highlighten met rode border-left.
- **`detectPartialFromSiblings` extraheerd** als module-scope pure functie (was inline in `syncOpenPositions`). Maakt 't testbaar zonder React state of API-calls. Productie-flow ongewijzigd qua gedrag.
- Doel: bij toekomstige Blofin-issues hoeft Denny alleen 1× een snapshot te capturen i.p.v. elke iteratie console-data te kopiëren.

### Niet meegenomen (deferred)
- **historyId als primary trade-ID** (i.p.v. `blofin_<positionId>_<closeTime>`). Research-gap #1 uit gap-tabel — zou onze "matchte geen enkele closed-record"-bug eerder hebben opgelost. Niet nu omdat: composite-ID werkt op zich (geen actief reproduceerbaar dedup-probleem na de v12.62 fix), en switch vereist legacy-migratie. Op backlog.
- **TPSL pending-endpoint integratie** voor "geplande TPs" naast "uitgevoerde TPs". Blofin's endpoint heeft geen `positionId`-filter — koppeling fragiel. Op backlog.
- **WebSocket real-time updates**. Vereist persistent connection + backend; past niet bij single-file HTML-architectuur.

### Bron
Research-rapport (2026-04-30) naar Tradezella / TraderSync / TraderVue / Edgewonk / FX Replay + GitHub-projecten ccxt / freqtrade / NautilusTrader. Conclusie: dominant model is **position-as-container met fills als events** (NautilusTrader-stijl), en best-in-class journals tonen een derde `partial` status met realized PnL. Onze v12.62 implementeert het tonen-deel; de container-refactor (alle fills in 1 trade) is bewust uitgesteld als groter-scope werk.

---

## [v12.61] — 2026-04-30

### Toegevoegd
- **Bellafiore Playbook-uitbreidingen** (uit research naar Mike Bellafiore's "The Playbook" + Tradezella, gepluimd met Denny's UX-feedback). Twee Bellafiore-concepten geïntegreerd in de bestaande Playbook-feature:
  - **🌍 Big-Picture-velden op playbook-niveau** — drie optionele textareas: *Big Picture* (markt-state · BTC.D / DXY / total-cap / risk-on of -off), *Reading the Tape* (order-flow · CVD / book-imbalance / liquidations / funding / whale-flows), *Intuition* (pattern-recognition uit ervaring, expliciet apart). Toggle aan/uit per playbook — niet iedereen wil deze laag. Default uit voor nieuwe playbooks; voor bestaande playbooks met `context` ingevuld migreert dat veld automatisch naar `bigPicture` en flipt de toggle aan, zodat geen data verloren gaat.
  - **🎯 A+/A/B/C grading + sizing-helper** — Bellafiore's Tier-systeem voor risico-allocatie. Per playbook stel je een **default-grade** in (wat is dit setup typisch?). Per trade kun je dat overrulen via grade-pills. De **sizing-helper** toont op basis van de grade het suggested risk in % (default A+ 2 / A 1.5 / B 1 / C 0.5 — conservatief voor crypto, lager dan Bellafiore's stocks-30%-DLL omdat 24/7-markt en hogere variance). Met `config.bellafioreAccountSize` ingesteld toont 'ie ook het $-bedrag. **Info-only**, geen save-block — consistent met de bestaande compliance-meter-filosofie.

### Schema
- `EMPTY_PLAYBOOK`: nieuwe velden `defaultGrade`, `bigPictureEnabled`, `bigPicture`, `tape`, `intuition`. Bestaande `context` blijft als legacy-veld; bij `migratePlaybooks` wordt 'ie naar `bigPicture` gemapped als die nog leeg is, en `bigPictureEnabled` wordt op `true` gezet zodat de user de migratie direct ziet werken.
- `EMPTY_TRADE`: nieuw veld `tradeGrade` (per-trade override van playbook's default-grade).
- Nieuwe module-scope constant `DEFAULT_GRADE_RISK_PCT = {"A+":2,"A":1.5,"B":1,"C":0.5}`. User kan via `config.gradeRiskPct` overschrijven.

### Gewijzigd
- **`applyPlaybook` in TradeForm**: bij playbook-keuze wordt `pb.defaultGrade` gekopieerd naar `trade.tradeGrade` (alleen als trade nog geen grade heeft — geen overschrijving van handmatige input).
- **PlaybookForm Markt-sectie**: legacy `context`-textarea is alleen nog zichtbaar als de playbook *geen* Big-Picture-toggle aan heeft maar wél oude context-data bevat. Anders verborgen — Bellafiore Big-Picture is de vervanger.

### Bellafiore-bron
- Mike Bellafiore — *"The Playbook"* (2010), SMB Capital. 5 decision-indicators: Big Picture · Intraday Fundamentals · Technical Analysis · Reading the Tape · Intuition. A+ trades verdienen meer risk (Tier-systeem). [SMB Capital blog: The SMB PlayBook — Compiling our best trades](https://www.smbtraining.com/blog/the-smb-playbook-compiling-our-best-trades).

### Niet meegenomen (deferred)
- **Intraday Fundamentals als 4e veld** — Bellafiore's 3e decision-indicator. Voor crypto vertaalt dit naar tag-chips (token unlocks / FOMC / regulatory / liquidation cascade / etc.) plus vrij veld. Deferred volgens Denny — past niet in dezelfde release-scope, op backlog gezet.
- **Reasons2Sell exit-checklist · Trust-Score met PF-tiers · Pre-market ritueel** — Bellafiore optimalisaties #3, #4, #5 uit research-rapport. Volgende releases.

### Documentatie
- **3 nieuwe FAQ-entries** in Help-tab onder 📝 Features: *"Wat zijn de Bellafiore Big-Picture-velden?"*, *"Hoe werkt het A+/A/B/C grading-systeem?"*, *"Hoe stel ik mijn account-saldo in voor de sizing-helper?"* — met crypto-vertaalde voorbeelden voor BTC.D / CVD / funding / etc.
- **Nieuwe handleiding-lesson l17** *"Bellafiore Big-Picture + A+/A/B/C grading"* (advanced, 11 min) — Bellafiore-bron, voorbeeld-Daily-Bias-playbook, sizing-rekenvoorbeeld op $10k account, anti-pattern waarschuwing tegen achteraf-rebrandering, en aanbeveling om met 1-2 hoogste-conviction setups te starten.

---

## [v12.60] — 2026-04-29

### Toegevoegd (tijdelijk · diagnostic)
- **🔍 Debug raw response** knop in Accounts → Blofin. Tijdelijk hulpmiddel om Blofin's `/positions-history` gedrag empirisch te valideren — vooral: of partial closes echt N records opleveren met dezelfde `positionId` (zoals de docs impliceren maar niet expliciet zeggen). Toont per positionId: aantal records, states, sum-pnl, openAvg, close-prijs-range, of de positie nog open is, en of `historyId` aanwezig is. Alleen geaggregeerde counts — geen ruwe API-data wordt opgeslagen of verzonden. Knop wordt verwijderd zodra de partial-close aggregator (volgende release) is gevalideerd. Achtergrond: gemeld door Denny — een Blofin-positie van 22-04 met TP1-hit op 29-04 verschijnt nu als 2 losse trades i.p.v. 1 trade met TP-niveau.

---

## [v12.59] — 2026-04-29

### Fixed
- **Backtest- en paper-trades nog steeds onzichtbaar in Simulated-Trades sectie** (vervolg op v12.58, gemeld door Denny). De v12.58 fix las `trade.exit` — maar dat veld is verborgen voor missed/backtest/paper trades (`hideExitFields=isOpen||isMissed` in TradeForm). De échte exit-data zit in `trade.tpLevels[]` met per niveau een prijs + percentage + status (`hit` / `open` / `missed`). Fix: `playbookMissedStats()` berekent nu **weighted R uit de hit-TPs** (zelfde formule die TradeForm onderaan toont als *"Gem R:R"*) — bv. 50% op TP1 + 25% op TP2 + 25% op TP3 → 3.52R bij Denny's setup. Resterende positie zonder hit telt als −1R (aangenomen op SL). Fallback-volgorde: hit-TPs → legacy exit-veld → pnl/riskUsd.

---

## [v12.58] — 2026-04-29

### Fixed
- **Backtest- en paper-trades werden alsnog leeg gerenderd in de Simulated-Trades sectie van Playbook-detail** (vervolg op v12.56/57, gemeld door Denny). `playbookMissedStats()` filterde elke trade weg waar `hindsightExit` niet was ingevuld — terwijl dat veld alleen bedoeld is voor échte gemiste trades (waar zou de prijs zijn gegaan als je had genomen?). Een backtest- of paper-trade heeft juist een **echte** `exit` ingevuld. Fix: R-bron hangt nu af van sim-type — `missed` blijft `hindsightExit`, `backtest` en `paper` gebruiken `exit + entry + stopLoss` (of `pnl/riskUsd` als fallback). Backtest-trades verschijnen daardoor nu met match-rate tier (≥80% / 50–79% / <50%) + R-multiple in de edge-leak analyse.

---

## [v12.57] — 2026-04-29

### Fixed
- **Backtest-trade onzichtbaar in Playbook-detail terwijl matcher ze wel vond** (vervolg op v12.56, gemeld door Denny). De Simulated-Trades sectie had `missSubFilter` default op `"missed"` — voor wie alleen backtest-trades had bleef de sectie leeg met "Geen gemiste-trades, probeer een ander filter". Erger: de filter-pills (👻 / 🔬) verschenen alleen wanneer **beide** tellers > 0, dus geen knop om naar Backtest te switchen. Twee fixes: (1) default filter is nu intelligent — als alleen backtest-trades, start op `"backtest"`; (2) pills zichtbaar zodra één teller > 0, zodat de user altijd visuele feedback krijgt dat de trades gevonden zijn. "Beide"-pill verschijnt alleen als er daadwerkelijk twee types zijn.

---

## [v12.56] — 2026-04-29

### Fixed
- **Backtest / Gemiste / Paper trades met playbook-koppeling werden niet teruggevonden in de Playbook-detail-modal** (gemeld door Denny). `tradesForPlaybook()` matchte alleen op setup-tag-overlap met `pb.setupTags`, maar negeerde de expliciete `t.playbookId` FK die `applyPlaybook()` sinds v12.50 zet. Resultaat: koppelde je een backtest-trade aan een playbook zonder setup-tags (of klikte je de auto-gevulde tags handmatig weg), dan verscheen de trade nergens — terwijl `t.playbookId === pb.id` correct was. Fix: `playbookId` is nu de primaire match, setup-tag overlap blijft fallback voor legacy trades zonder FK. Geldt voor alle drie de sim-types (Gemist 👻 / Backtest 🔬 / Paper 📝) én normale closed/open trades.

---

## [v12.55] — 2026-04-29

### Gewijzigd
- **Playbook-picker is nu ook beschikbaar bij Gemist / Backtest / Paper trades** (gemeld door Denny). Voorheen werd de picker verstopt zodra je `Gemist? / Backtest? / Paper?` aanklikte (`!isMissed`-guard in TradeForm), waardoor je een backtest of gemiste setup niet aan een playbook kon koppelen. Nu zichtbaar voor alle statussen — de playbook-koppeling, auto-fill (setup-tags / timeframes / confirmaties / pair / lagen) én entry-criteria checklist werken bij elke trade-soort. Belangrijk voor wie zijn backtests systematisch tegen specifieke playbooks valideert.

---

## [v12.54] — 2026-04-29

### Toegevoegd
- **Setup-lagen in Playbook-form** (Denny voorgesteld). Voorheen had de Playbook-form drie losse flat multi-selects: Setup-tags / Timeframes / Confirmaties — die geen relatie met elkaar legden. Nu mirror van TradeForm: per laag een eigen TF + multi-select setups + multi-select confirmaties. Voeg lagen top-down toe (HTF bias → entry-TF), herorder met ▲▼, verwijder met ✕, "⚠ Niet top-down" waarschuwing als TF-volgorde stijgt. Een playbook is daardoor 1-op-1 een template voor een trade: bij selectie in TradeForm wordt `trade.layers` automatisch met de playbook-lagen voorgevuld (alleen als trade nog geen lagen heeft).
- **Layered share/import** — een gedeelde playbook (JSON-export) bevat nu de gestructureerde `layers[]`. Bij import via community-link bouwt `migratePlaybooks` de unions opnieuw uit de lagen, dus structuur blijft behouden tussen gebruikers.

### Gewijzigd
- **Playbook detail-modal** toont nu een echte top-down stack van lagen (genummerd, per laag eigen TF + setups + confirmaties chips) i.p.v. één flat tag-cloud. Voor playbooks die nog niet gemigreerd zijn (edge case) blijft de oude flat-rendering als fallback.
- **`pb.setupTags` / `pb.timeframes` / `pb.confirmations`** worden nu automatisch afgeleid als de union van `pb.layers[*]`. Alle bestaande consumenten (TradeForm playbook-koppeling, `tradesForPlaybook`-matcher, `playbookStats` compliance × PnL split, PlaybookCard, share-export, FilterBar) werken ongewijzigd door — geen breaking changes voor analytics.

### Schema
- **`EMPTY_PLAYBOOK_LAYER`** toegevoegd: `{id, timeframe, setups[], confirmations[]}`. Mirror van `EMPTY_LAYER` in trades, minus de trade-specifieke velden (`fillPlayType`, `notes`).
- **`EMPTY_PLAYBOOK.layers[]`** is de nieuwe canonieke structuur. `setupTags`/`timeframes`/`confirmations` blijven bestaan op het schema als gederiveerde unions (niet meer in de UI bewerkbaar). `migratePlaybooks` backfilt automatisch: oude flat-velden → 1 laag per TF (eerste TF krijgt alle setups + confirmaties; user kan splitsen). Geen gebruikersactie nodig.

### Fixed
- **Schermflicker + focus-loss bij typen in Playbook-form Naam/Omschrijving** (gemeld door Denny). `Section` en `QuickAdd` waren als componenten *binnen* `PlaybookForm` gedefinieerd — bij elke keystroke kregen ze nieuwe component-identiteit, waardoor React de hele subtree (incl. het input-veld waar je in typte) unmounte+remounte. Focus viel weg, browser scrollde. Fix: helpers naar module-scope (`PlaybookFormSection`, `PlaybookFormQuickAdd`) — zelfde patroon als `Section` voor TradeForm.
- **Playbook-modal sluit niet meer bij klikken naast het venster** (gemeld door Denny). Backdrop-`onClick` verwijderd; gedrag nu identiek aan trade-edit modal — alleen de ✕-knop sluit. Voorkomt accidenteel verlies van werk.

---

## [v12.53] — 2026-04-29

### Gewijzigd
- **Setup-pills per laag zijn nu multi-select** (Denny voorgesteld). Tot v12.52 kon je per laag in TradeForm maar één setup-tag aanvinken — onrealistisch in de praktijk, want een 4H-laag kan tegelijk een **MSB én een SFP** zijn (of een Reclaim + Liquidity Sweep, etc.). Pills werken nu identiek aan de CONFIRMATIE-rij: klik = toggle add/remove. Sub-label *"meerdere mogelijk (bv. MSB + SFP op dezelfde laag)"* maakt 't expliciet voor nieuwe gebruikers. Fill Play sub-section verschijnt zodra "Fill Play" in de geselecteerde setups zit; deselecteren wist `fillPlayType` automatisch (zelfde gedrag als voorheen).
- **Display-format**: Trade-list cell toont layers nu als `4H · MSB+SFP · CVD divergentie+Volume spike` — consistent met hoe confirmaties al gerenderd werden. PlaybookStats layer-summary key wordt `4H+MSB+SFP → 15m+FVG tap` zodat multi-setup combinaties hun eigen unieke groep krijgen (geen vermenging met single-setup variants).
- **`t.setupTags` (flat trade-level array) blijft onveranderd** — gebruikt door 95% van analytics (Tendencies, Setup × Sessie matrix, FilterBar, Setup Ranking, Playbook compliance). Layer-setups zijn supplementaal voor wie diep wil bouwen, niet de bron-van-waarheid voor patroon-detectie.

### Schema
- **`layer.setup` (string) → `layer.setups` (array)** in `EMPTY_LAYER`. Backwards-compat: `normalizeTrade()` migreert legacy layers automatisch op load — bestaande `setup: "MSB"` wordt `setups: ["MSB"]`. Oude `setup` field wordt netjes gestript via destructuring. Bestaande trades blijven werken zonder gebruikersactie.

---

## [v12.52] — 2026-04-28

### Toegevoegd
- **Centrale `netPnl(t)` helper** voor consistente net-PnL door de hele app. Voor manuele trades retourneert `pnl − fees`, voor exchange-imports (Blofin/MEXC/Kraken/Hyperliquid) de al-netto `realizedPnl` ongewijzigd, voor sim-trades altijd 0. Bumped `CURRENT_SCHEMA_VERSION` constant naar 12 — referenced door de export payload.

### Gewijzigd
- **Edge-Erosion Funnel volledig herontworpen** in Playbook-detail. Was: tabel + parallel SVG-bars (duplicatie, concurrerende leesrichting, leak-percentages weeskind). Nu: één verticale stack van 3 stadium-cards (Backtest 🔬 / Paper 📝 / Real ✅) met inline stats (trades · WR · uitleg-tooltip) en stage-color bar + groot R-getal rechts. Tussen rijen: dashed connector-pills die direct het verhaal vertellen ("↓ Hindsight-bias leak: −50%" / "↓ Execution-stress leak: −65%"). Onderaan: één geconsolideerd Total edge-leakage panel (of "Edge buiten je regels"-melding wanneer Real beter is dan Backtest). Werkt op alle 6 themes (`var(--bg3)` + theme-aware borders/text).
- **Theoretical edge-leak** (Simulated Trades sectie) volledig herontworpen. Was: 20-bucket histogram (~3 gevulde bars in lege ruimte) + dezelfde data eronder als getallen + one-liner — driedubbele info-overlap, hardcoded `rgba(0,0,0,0.25)` background onleesbaar op light themes. Nu: 3 tier-cards (≥80% / 50–79% / <50% match) met count + R + interpretatie-zin per card, headline-pill bovenaan die adapteert (paars als edge-leak, groen als discipline goed is). Lege tiers krijgen subtiele opacity zodat in één blik zichtbaar is wat leeg is. Dead code opgeruimd: `PlaybookMissedHistogram` component + 20-bucket bins-berekening verwijderd.
- **Setup-laag UX-redesign** in TradeForm (Setup & Psychologie). Wrapper-card kreeg `var(--bg3)` (wit op parchment, donkergrijs op sync) + soft elevation-shadow + `var(--border3)` border + 14px padding — voelt nu als een echte tactiele card. Pills (TIMEFRAME / SETUP / CONFIRMATIE) kregen filled background (`var(--bg4)` chip) i.p.v. `transparent` zodat ze visuele "klik me"-presence hebben op alle themes. Selected SETUP-pill nu via `var(--gold)` + `var(--gold-dim)` + `var(--gold-border)` (theme-aware — parchment krijgt donker amber #A8832E i.p.v. licht goud). Labels gelijkgetrokken: alle drie 9px gold uppercase + letter-spacing (was inconsistent: alleen SETUP goud).
- **Save-knop label en gradient differentiëren nu Backtest / Paper / Gemist** (was alle drie "👻 Gemiste trade opslaan" met roze gradient). Backtest-trades krijgen "🔬 Backtest opslaan" met blauwe gradient (`#7ab4d2`-familie), Paper-trades "📝 Paper trade opslaan" met paarse gradient (`#9a8acc`-familie), Gemist blijft roze. Matcht 1-op-1 met de status-pills bovenin het formulier.

### Fixed
- **Fees worden nu overal afgetrokken van PnL in stats & overzicht (quick-log scenario)** (gemeld door Denny). De v12.49 fix werkte alleen wanneer entry/exit/positionSize ingevuld waren. Bij een quick-log (alleen PNL + fees handmatig invullen, zonder entry/exit) bleef de trades-lijst en alle aggregations de bruto-PnL tonen — voorbeeld: PNL=$5000, fees=$50 toonde +$5.000,00 in plaats van +$4.950,00. Opgelost via de nieuwe `netPnl(t)` helper. Toegepast in trade-list cell-display, dashboard-tegels (Total PnL, Win-rate, Profit Factor, Drawdown), Tendencies (Setup × Session matrix, session performance, holdtime, pairs-perf), Playbook-stats (compliance, edge-erosion), R-multiple `_trR()` berekening, score-berekening, en best/worst trade. Filter-checks (`!isNaN(parseFloat(t.pnl))`) blijven raw — die detecteren of een trade überhaupt een pnl-waarde heeft.
- **Export-knop crashte met `JS ERROR: Script error. Line: 0`** (gemeld door Denny). De export-payload referenceerde `CURRENT_SCHEMA_VERSION` maar die constante was nooit gedeclareerd → ReferenceError → caught door global error-handler die de cross-origin "Script error. Line: 0" toonde (browsers zwartmaken cross-origin error-details, vandaar Line 0). Constante toegevoegd naast `APP_VERSION`.
- **Glow rond Goals-progress-cirkel werd vierkant gerenderd** (gemeld door Denny). Op het Dashboard bij Maand-doelen was de cirkel-progress correct, maar de drop-shadow eromheen werd geclipped door de SVG viewport (100×100 viewBox, circle reikte tot radius ~45.5, glow had maar ~4.5px ruimte vóór clip → vierkante bounding-box). Fix: `overflow:"visible"` op de SVG zodat de filter buiten de viewBox mag bloeden, plus glow-tuning (8px → 6px blur, alpha 60 → 80 omdat 'ie nu niet meer geclipped wordt).
- **Setup-lagen pill-tekst onleesbaar op parchment/light/daylight themes** (gemeld door Denny — vervolg op v12.49 fix). Pills gebruikten `var(--text3)` op `var(--bg4)` wrapper → contrast slechts 2.5:1 op parchment (WCAG AA vereist 4.5:1). Eerste poging (text3 → text2) verbeterde contrast naar 7:1 maar de wrapper bleef te wash-out. Definitieve fix is de UX-redesign hierboven (echte card + filled chips).

## [v12.50] — 2026-04-28

### Toegevoegd
- **📘 Playbook-koppeling bij + Nieuwe Trade** — selecteer een playbook bovenaan in TradeForm en setup-tags / timeframes / confirmaties / pair worden automatisch gevuld vanuit de playbook-blueprint. Pills blijven toggleable — overschrijven mag wanneer setup afwijkt. Bron: research op Steenbarger + Bellafiore (playbook-thinking als pre-trade ritueel).
- **✅ Entry-criteria checklist** — verschijnt automatisch zodra een playbook is gekozen. Vink af welke criteria je vóór entry hebt gezien. Werkt naast de bestaande Setup-lagen sectie. Verplichte vs optionele criteria visueel onderscheiden (gold border-left voor mandatory).
- **Live compliance-meter** — toont je score op basis van mandatory criteria afgevinkt. Drie niveaus:
  - 🟢 **≥80%** → A+ entry — *"Sterke setup, discipline-stats positief"*
  - 🟡 **50-79%** → judgement-call — *"Geel licht, overweeg of ontbrekende items kunnen wachten"*
  - 🔴 **<50%** → buiten plan — *"Niet geblokkeerd, maar weet wat je doet"*

  **Geen save-blokkade** bij rood — alleen visuele waarschuwing. Journal moet logging niet blokkeren.

- **Schema-uitbreiding** voor `EMPTY_TRADE`: drie nieuwe velden — `playbookId` (FK naar playbook), `complianceChecks[]` (afgevinkte criteria-text), `complianceScore` (% mandatory afgevinkt). `normalizeTrade()` defaults deze naar leeg/null voor backwards-compat — bestaande trades blijven onveranderd.

### Gewijzigd
- **`playbookStats()` Compliance × PnL split werkt nu in twee modes**:
  - **EXPLICIT** (nieuw, default zodra ≥50% trades expliciete `complianceScore` hebben) — gebruikt de echte vinkjes uit TradeForm, geen heuristiek-disclaimers meer
  - **HEURISTIC** (fallback) — bestaande tag-overlap logica voor oude trades zonder explicit score

  Mode-badge zichtbaar in Playbook-detail naast de "⚖️ Compliance × PnL" titel. EXPLICIT in groen, HEURISTIC in amber. Subtitel toont de juiste drempel-uitleg per mode.

### Documentatie
- **FAQ-entry** *"Hoe werkt de Playbook-koppeling bij + Nieuwe Trade?"* — volledige uitleg van auto-fill + checklist + 3 compliance-niveaus + opt-out.
- **Lesson 11 (Compliance × PnL begrijpen)** in de handleiding bijgewerkt — uitleg van EXPLICIT vs HEURISTIC mode, hoe je de explicit mode activeert (playbook kiezen + criteria afvinken vóór entry), en hindsight-bias waarschuwing.

## [v12.49] — 2026-04-28

### Fixed
- **Setup-lagen tag-pills onleesbaar op Parchment-theme** (gemeld door Denny). De Setup-pills bij Trades → trade-detail → "+ Laag toevoegen" gebruikten hardcoded `rgba(255,255,255,0.35)` voor unselected tekst en lichte borders die op cream-bg parchment vrijwel onzichtbaar waren. Vervangen door `var(--text3)` voor tekst en `var(--border4)` voor borders — werkt nu correct op alle 6 themes (sync / classic / aurora / light / parchment / daylight). Geldt voor alle drie pill-types in de layer-builder: Timeframe, Setup, Confirmatie(s).
- **Layout-toggles ("Indeling aanpassen") onzichtbaar in OFF-state op light themes** (gemeld door Denny). De toggle-track gebruikte `rgba(255,255,255,0.08)` als OFF-background en `rgba(255,255,255,0.25)` als OFF-knob — wit op cream/wit-bg = onzichtbaar. Gebruikers konden uitgeschakelde widgets niet meer aanzetten. Vervangen door `var(--bg4)` track + `1px solid var(--border3)` border + `var(--text4)` knob in OFF-state. ON-state (groen + gold) onveranderd. Werkt nu zichtbaar op alle 6 themes.
- **Fees worden nu auto-verrekend in PnL bij handmatige trades** (gemeld door Morani via Discord). De PnL-velding had alleen een handmatige *"💡 PNL berekenen"* knop — gebruikers vulden fees in en verwachtten dat PnL automatisch zou aanpassen. Nu doet 'ie dat: nieuwe `useEffect` recalculeert PnL automatisch wanneer entry/exit/positionSize/fees veranderen, mits het een handmatige trade is (`source === "manual"`) en de gebruiker PnL niet handmatig heeft overschreven (`"pnl"` niet in `manualOverrides`). Zodra user PnL handmatig invult, stopt de auto-update — geen overrides van expliciete waarden. API-imports (Blofin / MEXC / Kraken / Hyperliquid) worden geskipt; die leveren al netto PnL.

## [v12.48] — 2026-04-28

### Toegevoegd
- **🔀 Cross-Validation Tendencies** — elke tendency-card krijgt nu een extra badge naast de severity-badge die toont of het patroon ook in backtest- of paper-trades verschijnt:
  - **🔀 Validated (sim n=X)** (groen) — patroon werkt in real én sim-data (positief in beide), sterker signaal dan alleen real
  - **⚠ Noise risk (sim ±X.YR)** (amber) — real-tendency met klein sample (<5) terwijl sim-data het juist tegenspreekt — mogelijk ruis-correlatie

  Helper: `crossValidateTendency(tend, allTrades)` matcht een tendency's filter op simulated trades, berekent virtuele R uit `hindsightExit`, en classificeert op basis van real + sim-uitkomst. Backtest is primaire validator (≥3 trades vereist); paper als fallback. Geen badge wanneer er geen sim-data is — geen visuele ruis voor users zonder simulated trades.

- **💢 Stress-Leak Detector** in Analytics (Proces-mode) — nieuwe widget die rule-discipline vergelijkt tussen paper-trades (geen druk) en real-trades (geld op het spel). Sport-coaching analogie: clutch-factor = het verschil tussen training en wedstrijd.
  - Twee thermometers: **Paper-discipline** vs **Real-discipline** (% rule-compliance)
  - Plus secundaire **WR-vergelijking** (paper-WR vs real-WR via hindsight-R)
  - Stress-Leak in pp + diagnose-tekst:
    - **>15pp leak** (rood) → "Mentale bandbreedte-probleem onder financiële druk. Halveer size 4 weken."
    - **5-15pp** (amber) → "Lichte stress-leak — let op grote size."
    - **±5pp** (groen) → "Discipline consistent. Issues elders."
    - **<−5pp** (blauw) → "Real-disc beter dan paper — paper niet serieus genomen?"
  - `tradeDisciplineScore(t, maxRiskPct)` — 5-check rule-compliance: SL gezet / setup-tag / pre-notitie / binnen risk-limit / post-notitie. Hergebruikt de Trading Rules `max_risk_pct` als drempel.
  - `stressLeakStats(allTrades, maxRiskPct)` — minimum 3 paper + 3 real samples vereist; toont "te weinig data"-hint bij ondersample.
  - Verschijnt in Analytics alleen als er paper-trades bestaan (`config.trackMissedTrades` + minstens 1 paper-trade). Layout-pref-key `stressLeak` toggelbaar via tandwiel.

- **📝 Paper-trade subtype** — derde simType naast Missed en Backtest:
  - Nieuwe knop in TradeForm status-bar: 📝 **Paper?** (paars)
  - Trades-tabel badge: 📝 **PAPER** (paars)
  - FilterBar tradeType: nieuwe optie `[📝 Paper]` (paars accent)
  - CommandPalette: nieuwe actie `📝 Log paper trade — Live demo-account, geen geld`
  - Edge-Erosion Funnel (v12.47) toont nu ook paper-rij in de tabel + funnel-bars
  - Trust-Score (v12.47) gebruikt paper-counts voor "Validated"-stadium (1+ paper na 4+ backtest)
- **Help-FAQ entry uitgebreid** — *"Wat is het verschil tussen Gemist, Backtest en Paper?"* legt nu alle drie de bias-onderscheiden uit en linkt expliciet aan de drie killer-features (Edge-Erosion Funnel, Cross-Validation, Stress-Leak Detector).

## [v12.47] — 2026-04-28

### Toegevoegd
- **📉 Edge-Erosion Funnel in Playbook detail** — visualiseert hoe edge erodeert van Backtest → Paper → Real. Per-type tabel (Trades / Win-rate / Gem. R) naast SVG-bar-chart met Δ-percentages tussen rijen. Verschijnt automatisch zodra een playbook minstens 2 van de 3 types data heeft. Boven de bestaande Simulated Trades-sectie. Bron: research op Steenbarger + sport-coaching analogie ("clutch-factor" = paper vs real verschil). Zie `simtrades-analytics-demo.html` voor concept.

  Auto-gegenereerde insights bij alle drie types data:
  - 🔬→📝 **Hindsight-bias leak** (% verloren tussen Backtest en Paper) — chart-replay liet sweet-spots zien die in real-time niet zichtbaar waren
  - 📝→✅ **Execution-stress leak** (% verloren tussen Paper en Real) — markt is hetzelfde, geld op het spel; psychologisch werk
  - 🎯 **Total edge-leakage** met split tussen hindsight en execution
  - ⚡ **Edge buiten regels** — zeldzame case waarin Real > Backtest, betekent dat je instinct/timing/feel een edge oplevert buiten je mechanische regels. Onderzoek wat dit triggert.

  Niet beschikbaar bij <2 types data: hint-block dat aangeeft welk type ontbreekt voor volledige analyse.

- **🏆 Trust-Score per Playbook** — visuele 5-stadia progressie-bar in elke PlaybookCard onder de stats:
  1. **Idea** (grijs, 0-3 backtest)
  2. **Theorized** (blauw, 4+ backtest)
  3. **Validated** (paars, 1+ paper)
  4. **Tradeable** (gold, 6+ real)
  5. **Bewezen** (groen, 16+ real met expectancy >0.3R)

  Onder de bar count-badges per type (🔬 backtest / 📝 paper / ✅ real) zodat je in één oogopslag prioriteert welke playbook nog werk vereist en welke "klaar" is. Visuele kleur per stadium. `classifyTrust(pb, allTrades)` helper.

- **`playbookErosionStats(pb, allTrades)`** helper — splitst linked trades per simType (real/paper/backtest) en berekent per groep: n / WR / avgR. Voor real-trades via `_trR()` (pnl/riskUsd); voor sim-trades via theoretical R uit `hindsightExit`. Hergebruikbaar voor toekomstige Cross-Validation Tendencies en Stress-Leak Detector (Fase B in v12.48).

## [v12.46] — 2026-04-28

### Toegevoegd
- **Backtest trades naast Missed trades** (Denny voorgesteld). Tot v12.45 had je alleen 👻 Gemist (real-time gespotte setup, niet genomen). Nu ook 🔬 Backtest (chart-replay analyse). Beide vallen onder de bestaande `status:"missed"` paraplu — geen breaking change — maar onderscheiden via nieuw veld `simType: "missed" | "backtest"`. Backwards compat: lege `simType` op bestaande trades wordt automatisch `"missed"` bij eerstvolgende load (`normalizeTrade`).

  **Waarom de splitsing belangrijk is**: missed en backtest hebben fundamenteel verschillende **bias-richting**. Missed-trades hebben twijfel/FOMO/discipline ingebakken — stats erop zijn realistisch. Backtest-trades hebben **hindsight-bias** ingebakken (je weet al hoe de markt liep) — stats erop zijn opgeblazen. Samen-poolen geeft misleidende edge-cijfers. Daarom default-filter op "Gemist" in alle stats, backtest opt-in.

  **Wijzigingen per plek**:
  - **TradeForm**: status-balk heeft nu twee aparte toggle-knoppen — `👻 Gemist?` (huidige flow, paars) en `🔬 Backtest?` (nieuw, blauw). Beide zetten `status:"missed"` met respectievelijke `simType`. Header krijgt context-hint: *"🔬 Backtest / chart-replay — uitgesloten van standaard edge-stats."*
  - **Trades-tabel**: badge toont 👻 MISS (paars) of 🔬 BT (blauw) op basis van simType
  - **FilterBar**: type-filter uitgebreid van `[Genomen | Gemist | Beide]` naar `[Genomen | 👻 Gemist | 🔬 Backtest | Sim (👻+🔬) | Alles]`. Backwards compat: oude `"both"` filter mapt naar `"sim"`.
  - **PlaybookDetailModal — Simulated Trades sectie** (heette voorheen "Missed Trades · Playbook-backtest"): subtype-filter pills `[👻 Gemist (n) | 🔬 Backtest (n) | Beide]`. Default Gemist. Bij "Beide" verschijnt een amber waarschuwing over hindsight-bias-vertekening.
  - **playbookMissedStats(pb, allTrades, subTypeFilter)**: derde argument met default `"missed"`. Backtest-trades worden niet gemixt in standaard edge-leak cijfers tenzij expliciet gevraagd.
  - **Tendencies**: backtest-trades automatisch uitgesloten van patroon-detectie (existing detectors filterden al op `pnl !== ""` waardoor `status:"missed"` trades sowieso al buiten boord vielen — onveranderd).
  - **CommandPalette**: nieuwe actie *"🔬 Log backtest trade"* naast bestaande *"👻 Log gemiste trade"*. Sneltoets `M` blijft voor missed.
  - **Help-FAQ**: nieuwe entry *"Wat is het verschil tussen Gemist en Backtest?"* legt het bias-onderscheid uit.

  **Use case voor backtest**: scroll door TradingView-replay, log gespotte setups als backtest-trade met `hindsightExit`, zie pure mechanische edge per setup. Handig om een setup te valideren vóór je 'm aan je playbook toevoegt. Toekomstig opvolg: `simType: "paper"` voor live demo-account trades.

## [v12.45] — 2026-04-28

### Toegevoegd
- **Nieuwe Steenbarger-quote** in `MINDSET_QUOTES` (categorie `process-focus`): *"We hoeven onszelf niet totaal anders te maken. We hoeven alleen consistenter te zijn in wie we al zijn op ons best."* — uit zijn SMB Trading Summit 2026 talk *"Positive Trading Psychology"*. Verschijnt nu in de rotating mindset-banner, dashboard-card en pre-trade hints. ID `c6`, NL-paraphrase consistent met de andere classics.

## [v12.44] — 2026-04-28

### Fixed
- **Lesson-card SVG illustraties schaalden niet** (Denny gemeld). De 16 SVG icons in de Handleiding-tab hadden alleen `viewBox="0 0 80 80"` zonder explicit `width`/`height` attributes — browsers defaulten dan naar 300×150px (HTML5 spec), waardoor de illustraties uit de 120px-hoge container braken en de cards visueel onevenwichtig werden. Fix: explicit `width="80" height="80"` toegevoegd aan alle 16 SVG-strings. In de demo (`handleiding-demo.html`) was dit afgevangen via een CSS-regel `.card-illustration svg{max-width:80px}` die niet meekwam tijdens v12.43-integratie.

## [v12.43] — 2026-04-28

### Toegevoegd
- **📚 Handleiding — 16 lessen voor crypto-traders** (Notion-stijl) in de Help-tab. Nieuw als eerste sub-tab; oude Startersguide en FAQ verplaatst naar eigen sub-tabs.
  - **8 Beginner-lessen** (totaal ~58 min): Wat is een trading journal · Je eerste trade loggen · R-multiple in 5 minuten · CSV importeren · Exchange koppelen · Tags & Setups · Het Dashboard lezen · Backup & export
  - **8 Advanced-lessen** (totaal ~83 min): Playbook vs. Journal · Tendencies-detectie lezen · Compliance × PnL · Setup × Sessie matrix · R-multiple op portfolio-niveau · Trading Rules + Heatmap · Missed-trades backtest · Goals & milestones
  - Notion-stijl **card-grid** met inline gold-line SVG-illustraties (16 unieke icons in Morani-stijl, geen externe assets)
  - **Filter-pills**: niveau (Alle / 🌱 Beginner / 🚀 Advanced) + status (Alle / Niet gelezen / Voltooid)
  - **Voortgangsbalk** bovenaan met percentage en X/16 voltooid + Reset-knop
  - **Smart-suggestie banner** dynamisch op basis van `trades.length` + leesvoortgang. Vier zones: <5 trades (basis-concept) / 5–30 (R + tags + dashboard) / 30–50 (afronden beginner) / 50+ (Playbook + Tendencies + Compliance)
  - **Reading-modal** per les met:
    - Crypto-specifieke voorbeelden (BTC/USDT $-prijzen i.p.v. FX-pips)
    - Vier callout-kleuren: 🟡 Waarom · 🟢 Voorbeeld · 🟠 Waarschuwing · 🔵 Tip
    - **Deeplinks** *"Open Trades →"*, *"Open Playbook →"*, *"Beheer tags →"* — sluiten modal en navigeren direct naar de juiste tab
    - Markeer-als-voltooid toggle (persistent in `tj_lessons_seen`)
    - Vorige/volgende-knoppen voor sequentiële doorloop
- **Help-tab nieuwe structuur** met 3 sub-tabs (default opent op Handleiding, persistent in `tj_help_subtab`):
  1. 📚 Handleiding (nieuw)
  2. 🚀 Startersguide (bestaande 3-paden cards)
  3. ❓ FAQ (bestaande accordion + Feature-referentie)
- **localStorage**: `tj_lessons_seen` (Set van les-IDs) + `tj_help_subtab` (laatst geopende sub-tab)

## [v12.42] — 2026-04-28

### Gewijzigd
- **PlaybookForm Mistake-pattern → multi-select uit `tagConfig.mistakeTags`** (Denny gemeld). Het laatste vrije text-veld in de Playbook-form is nu ook een pill-grid uit de centrale tag-bron, consistent met setup-tags / confirmaties / timeframes (v12.41). Geen tag-wirwar meer mogelijk.
  - Nieuw schema-veld `mistakePatterns: []` op playbooks; defaults naar `[]` via `migratePlaybooks()`.
  - Pill-grid uit `tagConfig.mistakeTags` ("Te vroeg in", "SL te krap", "FOMO", "Revenge trade", etc.).
  - **Beheer tags →** deeplink + lege-staat hint zoals andere tag-velden.
  - **Orphan-detectie** voor tags die uit `tagConfig` zijn verwijderd.
  - **Backwards-compat met legacy free-text** (`mistake: string` veld uit v12.38–12.41): bestaande playbooks tonen de oude tekst onder een grijs *"📜 Oude vrije tekst (legacy)"* block met *Verwijder oude tekst* knop. Geen data-loss.
- **PlaybookDetailModal** toont nu chips i.p.v. tekst voor mistake-patterns (rood-getint), met legacy free-text als optionele *"extra context"* eronder.
- **PlaybookShareModal** payload bevat nu zowel `mistakePatterns[]` als (indien aanwezig) de legacy `mistake` string. Tekst-format: `⚠️ Te vroeg in · SL te krap` met optioneel *"Context: …"* erna.

## [v12.41] — 2026-04-28

### Gewijzigd
- **PlaybookForm — geen vrije tag-input meer** (Denny gemeld). De setup-tags / confirmaties / timeframes velden waren in v12.40 nog chip-inputs met vrije tekst, wat tag-wirwar in de hand werkte ("SFP" / "sfp" / "S F P" / "swing-trade" naast elkaar zou kunnen ontstaan, en dat ondermijnt Tendencies + Compliance × PnL detectie). Discipline-principe: één tag-bron.

  Nu alle drie als **multi-select pill-grids** uit `tagConfig`:
  - Setup-tags ← `tagConfig.setupTags`
  - Confirmaties ← `tagConfig.confirmationTags`
  - Timeframes ← `tagConfig.timeframeTags`

  Klik op pill = selecteren · klik nogmaals = deselecteren. Dezelfde lijst die TradeForm gebruikt — playbook en logged trade kijken naar dezelfde naming.

  **Beheer tags →** deeplink onder elke pill-grid springt direct naar Instellingen → Tags voor wie een tag mist. Lege tag-lijst toont een hint met dezelfde deeplink.

  **Orphan-tag detectie**: als een bestaande playbook tags bevat die ondertussen uit `tagConfig` zijn verwijderd, verschijnen die in een aparte amber-blok onder de pill-grid met *"⚠ Niet meer in tag-lijst — opschonen?"*. Klik × om weg te halen. Geen stilzwijgende data-loss.

  **Pairs blijven flexibel** — ticker-symbols zijn geen tags (BTC/USDT is overal hetzelfde), dus chip-input + snelkoppelingen blijven zoals ze waren.

  Geen schema-migratie. Bestaande playbooks blijven werken; tags die in de pill-grid staan worden gewoon getoond, andere komen onder ⚠.

## [v12.40] — 2026-04-28

### Gewijzigd
- **PlaybookForm UX-redesign** (Denny gemeld). Het nieuwe-playbook formulier was in v12.38 één lange opsomming van 11 velden onder elkaar — overweldigend, geen visuele hiërarchie, optionele velden even prominent als verplichte. De form is nu opgedeeld in **5 gekleurde sectie-cards** met eigen accent-kleur en spacing:
  - 📋 **Basis** (neutraal grijs) — Naam (prominent groter veld met goud-tint), Status, Eén-zin omschrijving
  - 🔍 **Setup-lagen** (gold accent) — Setup-tags (chip-input), Timeframes (pills), Confirmaties (collapsible, default dicht)
  - 📊 **Markt** (blue accent) — Pairs, Sessies, Markt-context (collapsible, default dicht)
  - ✅ **Entry-criteria** (green accent) — Genummerde criteria-rijen met visuele 1/2/3-badges, gouden border bij verplicht, accent-color checkboxes
  - 🎯 **Trade-rules** (amber accent) — Stop (rood label), Target (groen label), Min R:R, Mistake-pattern (collapsible, default dicht)

  **Progressive disclosure**: drie optionele velden (Confirmaties, Markt-context, Mistake-pattern) zijn nu collapsible en standaard dichtgeklapt. Bij bewerken van een bestaande playbook met data in die velden klapt de sectie automatisch open. Verkort het visuele oppervlak van de form met ~40% bij eerste-keer-aanmaken.

  **Snelkoppelingen** (`+ SFP`, `+ MSB` etc.) zijn nu kleiner getekend (10px ipv 11px, lichtere border) en gegroepeerd onder een *"Voorbeelden:"* label. Geeft minder visuele dominantie t.o.v. de eigenlijke chip-input.

  **Naam-veld** is nu visueel het belangrijkste: 15px font, gouden border-tint, lichte gold-tinted background. Maakt direct duidelijk dat dit het kritieke veld is.

  **Status-dropdown** krijgt emoji-prefix (🟡 Testing / 🟢 Actief / ⚪ Retired) voor sneller scannen.

  Geen schema- of data-wijzigingen — alleen visuele reorganisatie. Bestaande playbooks blijven onveranderd.

## [v12.39] — 2026-04-28

### Fixed
- **Playbook-tab was niet zichtbaar in de top-navigatie** (Denny gemeld). De `TABS`-array bevatte de Playbook-entry op index 6, maar de top-nav rendert alleen `TABS.slice(0,6)` — alleen de eerste 6 tabs. Daarna volgt een hardcoded "Instellingen"-knop voor de cluster Accounts/Rules/Tags/Help. Resultaat in v12.38: Playbook bestond als route en als content (`tab==="playbook"&&<PlaybookPage…>` rendered correct), maar er was geen klikbare ingang in de top-nav. Fix: `slice(0,6)` → `slice(0,7)` zodat Playbook als 7e top-tab verschijnt tussen Tendencies en Instellingen.

## [v12.38] — 2026-04-28

### Toegevoegd
- **📘 Playbook — eigen hoofdtab** tussen Tendencies en Accounts. Een gestructureerde catalogus van bewezen setups (Bellafiore-stijl: *"take only trades you have already perfected"*). Aanvulling op het journal: een journal logt élke trade, een playbook bevat alléén je A+ setups met criteria, rules en stats. Pre-market scan je alleen op deze setups; alles daarbuiten = no-trade.

  **Velden per playbook**:
  - `name`, `oneLiner`, `status` (testing / actief / retired)
  - `setupTags[]` — multi (top-down lagen, bv. SFP + Liquidity Sweep)
  - `timeframes[]` — top-down stack (1D / 4H / 1H / 15M / 5M / 1M)
  - `pairs[]` — vrij in te vullen (chip-input + snelkoppelingen voor BTC/ETH/SOL/XAU)
  - `sessions[]` — multi-select uit de 8 sessie-buckets (v12.37)
  - `confirmations[]` — extra confluence (CVD divergentie, FVG tap, OB level, funding flip, OI rising, …)
  - `context`, `criteria[]` met `mandatory`-toggle, `stop`, `target`, `minRR`, `mistake`-pattern

  **Lijst-view**: filter pills (Alles / Actief / Testing / Retired + per pair) + sort (cum. PnL / WR / # trades / laatst gebruikt). Cards met status-pill, badges, mini-stats, sparkline van cum. R.

  **Detail-modal** per playbook:
  - Setup-lagen sectie (top-down) — tags, timeframes, confirmaties als gekleurde rijen
  - Stats grid (n / WR / gem. R / expectancy / cum. PnL) afgeleid uit setup-tag join met je trades
  - **⚖️ Compliance × PnL split** — heuristiek op overlap tussen `pb.confirmations` en `trade.confirmationTags`. Toont *"compliant trades = +X.XR/trade vs. non-compliant = +Y.YR/trade. Discipline-delta: +Z.ZR per trade."* — uniek t.o.v. Tradezella/TraderSync.
  - Markt-context, entry-criteria checklist (gouden border = verplicht), stop/target rules
  - Mistake-pattern card (rood)
  - **🔬 Missed Trades · Playbook-backtest** — gebruikt bestaande `hindsightExit` veld (v12.6) om opportunity-cost te berekenen. SVG-histogram met 20 × 5%-bins toont verdeling van match-rate vs. trades. Threshold-lijn op 80%. Aggregated: *"X setups matchten je playbook volledig — daar liet je +Y.YR liggen."* Met hindsight-bias-waarschuwing.
  - Linked trades lijst (laatste 8) met R-multiple en PnL
  - Acties: Verwijder / Bewerk / 🔗 Delen / 📊 Toon alle trades

  **Add/Edit form** met chip-inputs voor multi-select velden, pill-toggles voor sessions/timeframes, criteria-builder met add/remove rijen + verplicht-toggle.

  **🔗 Delen-modal** — drie formats voor de Discord-community:
  - **📋 Tekst** in 3 stijlen: Discord-markdown / Plain text / Markdown
  - **📦 JSON-bestand** (download .json voor Discord file-attachment)
  - **📸 PNG-card** (visueel via html2canvas, retina-scale 2×)
  - **Privacy-toggle**: Pro-mode (R-multiples, default) vs. Showcase ($-bedragen, opt-in)
  - **Field-toggles**: per veld kiezen wat meegaat (oneliner / pairs / sessies / timeframes / setup-tags / confirmaties / context / criteria / rules / mistake / stats / individuele trades). Mistake en trades-list default uit voor privacy.

  **📥 Importeer-modal** — accepteert JSON-tekst plakken, .json bestand selecteren of erop slepen. Parser ondersteunt wrapped JSON (`{type:"tradejournal-playbook", playbook:{…}}`), bare JSON, base64-string, en URL-fragment (forward-compat). Preview vóór import. Stats van de deler worden NIET overgenomen — geïmporteerde playbook start als `testing` met lege trades-array. Naam-collision: auto-suffix `(geïmporteerd)`, `(geïmporteerd 2)`, etc. + non-blocking toast.

  **URL-import banner**: bij `#playbook=...` hash detect verschijnt een paarse banner bovenaan de Playbook-tab i.p.v. een intrusieve modal. Click "Bekijk" → import-preview opent.

  **Backup/restore-flow** uitgebreid met `playbooks` array — JSON-export bevat nu ook je hele playbook-collectie; sleep-import herstelt 'm.

  **localStorage**: nieuwe key `tj_playbooks` met `migratePlaybooks()` voor schema-stabiliteit.

## [v12.37] — 2026-04-28

### Gewijzigd
- **Sessies van 5 naar 8 buckets — één waarheid in de hele app.** Tot v12.36 hadden we 5 buckets (Asia / London / New York / US Late / Weekend) en sinds v12.36 een tweede 7-bucket systeem dat alleen voor de Setup × Sessie matrix gebruikt werd. Twee parallelle waarheden = verwarrend. v12.37 convergeert beide naar één 8-bucket model in Amsterdam-tijd (DST-aware):
  - **Asia AM** — 01:00–05:00 (Tokyo open)
  - **Asia PM** — 05:00–09:00 (Tokyo lunch/close, pre-London)
  - **London AM** — 09:00–11:30 (London-open volatility)
  - **London PM** — 11:30–15:30 (pre-NY drift)
  - **US AM** — 15:30–19:00 (NY cash-open) — *was "New York" + "NY-AM"*
  - **US PM** — 19:00–22:00 (richting NY close) — *was "NY-PM"*
  - **US Late** — 22:00–01:00 (post-NY, Asia preview)
  - **Weekend** — Zat/Zon hele dag

  Dit raakt: FilterBar sessie-pills (8 i.p.v. 5), sessionPerf cards in Analytics, Trade-tabel sessie-tags, Discipline Heatmap hourly-view (7 sessies, sans Weekend), Tendencies emotion×session / mistake×session / setup×session detectors, Setup × Sessie matrix. Niet-persistente filter-state betekent geen migratie nodig; sessie-tags op trades worden real-time uit `date+time` berekend dus bestaande trades krijgen automatisch de nieuwe label.

### Toegevoegd
- **FAQ-entry over sessie-buckets** in Help-tab onder *"Welke sessie-buckets gebruikt SyncJournal en wat zijn de tijden?"* — exacte tijden, motivatie, waar het overal gebruikt wordt.
- **Nieuwe sessie-kleuren** voor de 4 nieuwe buckets (Asia AM/PM, London AM, US AM/PM) in `SESSION_COLORS`. Bestaande Asia → split in lichter/donkerder gold, London → split in lichter/donkerder blue, US → split in lichter/donkerder purple. US Late en Weekend onveranderd.

### Verwijderd
- **`ALL_FINE_SESSIONS`, `getFineSessionAt`, `getFineSessionTags`** (toegevoegd in v12.36) — overbodig nu de hoofdsessie-helper 8 buckets returnt.

## [v12.36] — 2026-04-27

### Toegevoegd
- **🎯 Setup × Sessie matrix bovenaan Tendencies** — heatmap-tabel die elke setup uitsplitst over 7 fijne sessie-buckets (`Asia / London-AM / London-PM / NY-AM / NY-PM / US Late / Weekend`). De bestaande sessie-detectie gebruikt 5 buckets — die smelten London-AM en London-PM samen tot één gemiddelde, waardoor het patroon *"deze setup werkt 's ochtends maar verliest 's middags"* onzichtbaar blijft. De fijnere indeling onthult dat. Cellen kleuren op WR + cumulatieve PnL; vlaggetjes 🎯 (edge bevestigd) / 🕒 (edge weg) / ⏰ (aandacht) markeren de drempels. Cellen met &lt; 3 trades zijn gedimd. Klik op een cel → filtert Trades-tab op die setup. Matrix is collapsible (default open, persisted in `tj_matrix_open`).
- **7e Tendencies-detector: setup × fijne-sessie** — naast de bestaande 6 detectors flagt deze nu individuele setup × sessie-bucket combinaties. Drempels gelijk aan setup × pair detector (≥4 trades, WR ≥ 65% + PnL > +$150 = sterkte; WR ≤ 30% + PnL < −$100 = edge weg; WR ≤ 45% + PnL < −$50 = aandacht). Recommendation-zin verwijst naar de matrix bovenaan voor visuele context. Inzicht direct uit een community-tip: *"the edge often disappears after 11:30."*
- Nieuwe helpers `getFineSessionAt(dt)` + `getFineSessionTags(date,time)` + constant `ALL_FINE_SESSIONS`. Amsterdam-tijd via `Intl.DateTimeFormat` (DST-aware), zelfde patroon als de bestaande `getSessionAt`.

## [v12.35] — 2026-04-25

### Gewijzigd
- **Tendencies gepromoot van Analytics-sectie naar eigen hoofdtab** (🎯 Tendencies, 6e tab tussen Kalender en Instellingen). Reden: Tendencies is een coach-perspectief, geen statistiek — verdient primair entry-point. Mengen met Analytics-widgets maakt beide minder scherp. De huidige sectie in Analytics is verwijderd; alle detectie-logica blijft hetzelfde maar krijgt nu meer ruimte.
- **Tendencies-pagina** heeft eigen periode-controls los van de globale FilterBar (`7d / 30d / 90d / Alles`, default 30d), severity-filter pills, en grotere cards (`380px` min-width vs `320px` in de oude widget). Per card ook een extra meta-regel onderaan: *"Eerst: 2026-03-04 · Laatst: 2026-04-22 · Toon trades →"*.

### Toegevoegd
- **Coach's Note bovenaan Dashboard** — toont de 1 meest urgente tendency van de huidige periode (hoogste impact, severity = red of amber). Bij geen pijn-patronen toont de top sterkte als positieve nudge. Klik op de hele card OF op `Bekijk alles →` knop springt naar Tendencies-tab. Verschijnt alleen vanaf 10 trades. Uit te zetten in Instellingen → Accounts → Layout via *"🎯 Coach's Note op Dashboard"* toggle (default aan). Volgt het Tim Grittani-pattern: één coach-quote prominent, glance-and-go.
- **Command palette** (Cmd+K / Ctrl+K) krijgt Tendencies als action.

## [v12.34] — 2026-04-25

### Toegevoegd
- **🔍 Tendencies-sectie in Analytics** — cross-dimensionele patroon-detectie. Tot v12.33 had je per-setup, per-emotion, per-mistake en per-sessie widgets, maar **combinaties** waren onzichtbaar (bv. "FOMO + US Late session", "SFP-setup op BTC/USDT"). De nieuwe sectie detecteert 6 categorieën patronen:
  - `emotionTag × session` — emotie-staat per sessie (bv. *"FOMO tijdens US Late: 12 trades, 18% WR, -$420"*)
  - `setupTag × pair` — sterke (>65% WR) of zwakke (<30% WR) pair-setup combo's
  - `timeframe × emotion` — sterkte-detectie ("4H + Geduldig" = template)
  - Weekend-trade gedragspatroon (los van sessionPerf — focus op gedrag)
  - `emotion-combo` (2 tags samen) — bv. *"FOMO + Gehaast: 8 trades, 12% WR"*
  - `mistakeTag × session` — sessie-specifieke triggers van fouten
  
  **Severity-classificatie**: 🔴 Hoge pijn / 🟡 Aandacht / 🟢 Sterkte / 🔵 Observatie. Per card: stats (n / WR / cumulatieve PnL), mini-sparkline van cumulatieve PnL met zero-line, en een auto-gegenereerde aanbeveling ("Voorstel: voeg toe aan Trading Rules…"). Klik op een card → filter-state wordt overgenomen + spring naar Trades-tab. Filter-pills bovenaan: Alles / Pijnpunten / Sterktes / Observaties. Limit top 12 patronen om de pagina niet te overspoelen. **Adaptieve drempel**: bij <30 trades MIN_N=2 (anders zie je niks bij weinig data), daarna MIN_N=3. Bij <10 trades verschijnt een hint dat tendencies pas zinvol worden vanaf 10 trades. Geen overlap met bestaande secties: "mistake-tag puur" zit al in "Fout impact" en is daarom niet als detector toegevoegd; alleen `mistake × sessie` is nieuw. Geen AI in v1 — pure aggregatie.

## [v12.33] — 2026-04-25

### Fixed
- **MEXC positie-size klopt nu** (Denny's report). Tot v12.32 nam de MEXC-import de raw `vol`/`closeVol`/`holdVol` direct over als `positionSize` — maar dat zijn **contracts**, niet USDT. Voor BTC_USDT betekent 1 contract = 0.0001 BTC, dus een echte positie van 0.0212 BTC werd in de journal als `212` weergegeven (en geïnterpreteerd als $212 USDT). Fix: zelfde patroon als Blofin — een `_getContractSize(symbol)` helper haalt de echte contract-size op via MEXC's public endpoint `https://contract.mexc.com/api/v1/contract/detail?symbol=X` (CORS-open, geen API-key, geen worker-proxy nodig). Cache per symbol. Bij `fetchTrades` en `fetchOpenPositions` worden contracts geconverteerd naar `positionSizeAsset` (BTC/ETH/SOL qty) en `positionSize` (USD notional via entry-prijs). Voor BTC_USDT op 50× leverage: $1641 USD notional + 0.0212 BTC ipv `212` als raw contracts. Re-sync je MEXC-trades om bestaande verkeerde records te overschrijven (zelfde trade-ID dus geen duplicaten).

## [v12.32] — 2026-04-24

### Toegevoegd
- **Meerdere screenshots per trade** (max 10). Trade-form heeft nu een thumbnail-grid (4:3 aspect, ~120px breed) i.p.v. één grote inline preview. Elke nieuwe upload of `Ctrl+V`-paste voegt toe aan de array. Per thumbnail een ✕ om te verwijderen (met confirm). Klik op een thumbnail opent een **lightbox**: full-screen donker overlay, image gecentreerd op max 94vw × 90vh. Bij meerdere screenshots: `‹ ›`-knoppen + `← →`-pijltoetsen om te bladeren, `Esc` om te sluiten, teller `1 / N` onderaan. Klik op de overlay sluit ook. Sectie-hint toont nu het aantal: *"3 screenshots · 1 link"*.
- **Achterliggende data-fix**: IndexedDB-save schreef tot v12.31 `screenshot=null` voor data:URLs (oude TODO-comment over een nooit-gebouwd "idb: references"-systeem). Resultaat: screenshots verdwenen na page-refresh. Nu worden ze gewoon volledig in IDB bewaard (geen practische size-limit). LocalStorage-backup blijft screenshots wegfilteren want die heeft wél een 5MB-limiet.

### Migratie
- **Bestaande trades met legacy `screenshot` (single)** → automatisch gelift naar `screenshots: [oude_screenshot]` bij eerste load via `normalizeTrade`. Het `screenshot`-veld blijft staan voor backwards-compat met oudere exports/imports. Geen actie van gebruiker nodig.

## [v12.31] — 2026-04-24

### Toegevoegd
- **Screenshot plakken met `Ctrl+V` / `Cmd+V`** in het trade-formulier. Geen klik op de upload-zone nodig: kopieer in TradingView (Alt+S → "Copy chart image") en plak direct ergens in het formulier — wordt automatisch herkend en gecomprimeerd via dezelfde pipeline als de bestand-upload (1600×1200 max, JPEG 82%, IndexedDB-opslag). Toast bevestigt: *"Screenshot geplakt uit clipboard"*. Tekstvelden blijven gewoon werken — browsers triggeren `paste` met image-data alleen als de clipboard daadwerkelijk een image bevat. Upload-zone toont nu een hint: *"Klik om screenshot te uploaden — of plak met `Ctrl+V`"*.
- **Tags zijn nu sleepbaar in volgorde** (Instellingen → Tags). Tot v12.30 werd elke nieuwe tag onderaan gekwakt — vervelend als je `2H` toevoegt aan Timeframe en die tussen `1H` en `4H` wil hebben staan. Nu: drag & drop per categorie via een ⋮⋮-handle. Native HTML5 (geen library), per categorie geïsoleerd zodat je niet per ongeluk tags tussen categorieën sleept. Voor Emoties zijn neg/pos sub-groepen apart sleepbaar (geen menging). Visuele feedback: opacity .4 op de gesleepte tag, gouden border op de drop-target. Klikken op de naam blijft hernoemen, ✕ blijft verwijderen.

### Verwijderd
- **ROL-knoppen bij setup-lagen** (Bias / Entry / Confirmatie). De optie was alleen relevant in 1 plek (Analytics → R:R analyse → R:R-per-timeframe filterde op `role="Entry"`) maar voor users met 1 laag per trade had het geen zichtbare impact en de drie opties zorgden voor verwarring. Verwijderd: `ROLE_OPTIONS` constant, `role`-veld uit `EMPTY_LAYER`, ROL-row in trade-form, en de `l.role==="Entry"`-filter in R:R-per-timeframe (alle lagen tellen nu mee). Bestaande trades met opgeslagen `role`-veld blijven werken — het veld wordt simpelweg genegeerd, geen migratie nodig.

## [v12.30] — 2026-04-24

### Gewijzigd
- **Balans-formule definitief: BALANS = Live API + Capital Tracker (add-on, ≥$0).** Vier iteraties later het juiste model gevonden: tracker en live API zijn complementair, niet concurrent. Voor exchange-koppelingen: live API-balance (= echt saldo, incl. PnL) plus eventuele tracker capital (= off-platform reserve / persoonlijke ledger) opgeteld. Voor accounts zonder API (csv/wallet-only/handmatige accounts): tracker capital + linked trade-PnL. Tracker capital wordt gecapt op $0 — kan nooit negatief, en `Opname > capital` wordt geweigerd door `promptCapitalTx` met heldere alert. Voorkomt zowel Coelho's case (typo's leiden niet meer tot $0 of negatieve cap) als Denny's case (storting verlaagt nooit BALANS). Mini-hint in widget legt het model uit bij exchanges met live API.
- **Capital Tracking widget vereenvoudigd**. v12.29 mengde Capital + Equity + Return + Trade PnL door elkaar — bij iemand met $20 inleg + $22 historisch verlies stond er "Equity -$2 / Return -111%" wat eruitzag alsof het systeem geld weghaalde door te storten. Nu: pure capital tracking. Alleen één centraal getal "Ingelegd capital: $X" + twee knoppen **Storting** / **Opname** + collapsible mutaties-lijst. De Correctie-knop is uit de UI gehaald (legacy `correction`-entries blijven leesbaar in de mutaties-lijst voor backwards compat); fouten herstel je nu door de mutatie te verwijderen en een nieuwe te maken. Trade PnL en equity zie je elders (Dashboard / Analytics / live API balance) — die horen niet in een widget die "capital tracking" heet. Geldt voor zowel exchange-koppelingen als handmatige accounts.

### Toegevoegd
- **Guardrails op capital-mutaties** (Coelho's `−$100k typo` issue). Nieuwe shared helper `promptCapitalTx` rond elke Storting/Opname/Correctie-knop:
  - **Live preview**: het prompt toont nu `(huidig: $X)` zodat je weet waar je op voortbouwt; bij Correctie staat erbij dat het bedrag het *nieuwe totaal* wordt, niet een delta.
  - **Sanity-check confirms**: extra `confirm()` met waarschuwing als (a) de mutatie capital negatief maakt, (b) een Opname >2× je huidige capital is (typo-detectie), of (c) een Correctie >50% afwijkt van het huidige capital.
  - **Toast na elke mutatie**: `"MEXC capital nu: $X"` — direct visuele bevestiging, dus typo's vallen meteen op.
  - Werkt voor zowel handmatige accounts als exchange-koppelingen (één gedeelde helper).

## [v12.29] — 2026-04-24

### Toegevoegd
- **Live status bar aan/uit toggle** — Instellingen → Accounts → Layout sectie. Default aan; uitzetten verbergt de hele bar (klok, sessie, balans, DD, risk, BTC/ETH/SOL/XAU/XAG tickers) en geeft 32px extra schermruimte. Stop ook met de balance-fetch + WS-tickers wanneer de bar verborgen is — de hook zit ín `AppStatusBar`, dus die unmount volledig.

### Fixed
- **BALANS in status bar toonde alleen de winst, niet het totaalsaldo** (Coelho's + Denny's feedback). Bij een storting van $1000 + $50 winst toonde de bar `$50` ipv `$1050`; bij een handmatig ingevulde Storting van $10.000 werd dat genegeerd zodra de exchange-API een ander bedrag teruggaf. Oorzaak: oude formule `handmatigCap + exchangeCap + totalPnl` ging ervan uit dat je je storting altijd handmatig invult, en de eerste fix-poging vertrouwde altijd op live API als die beschikbaar was — beide breken een legitieme use case. Definitieve formule per exchange-koppeling, in volgorde van prioriteit: (1) als je zelf Storting/Opname/Correctie hebt ingevuld → respecteer dat als source of truth (`transactions + gelinkte trade-PnL`), (2) anders gebruik live API-balance via nieuwe `useLiveExchangeBalances` hook (elke 60s `testConnection`-call, gecachet in `localStorage`), (3) anders alleen gelinkte PnL. Orphan trades tellen los mee. Voorkomt zowel onder- als overschatting.

### Gewijzigd
- **Trading sessies herzien naar 5 NL-georiënteerde tijdvakken** (Amsterdam-tijd, DST-aware via `Intl.DateTimeFormat`):
  - **Asia** 01:00–09:00 (was Tokyo 02:00–08:00 — uitgebreid met Sydney-overlap)
  - **London** 09:00–15:30 (ongewijzigd)
  - **New York** 15:30–22:00 (status bar toonde dit voorheen vanaf 14:00 NL = 1.5u te vroeg)
  - **US Late** 22:00–01:00 — NIEUW; combineert wat eerder "Off-session" was met Fed/FOMC-news window om 20:00 NL én de na-NY pump/dump-zone
  - **Weekend** Sat/Sun (ongewijzigd)
- Status bar (`getSession`) en trade-tagging (`getSessionTags`) gebruiken nu **één gedeelde core-functie** `getSessionAt(date)` met identieke grenzen — voorheen had de status bar een eigen UTC-uur-mapping die afweek (`12-21 UTC = NEW YORK` = 14:00–23:00 NL, te vroeg én te laat). Trades worden automatisch herkleurd want sessie-tags worden on-the-fly berekend uit `date`+`time`, niet gepersisteerd in de trade — een trade van 22:30 die voorheen "Off-session" was wordt nu "US Late", overal in de app (trade-tabel, filter, analytics, calendar).
- DisciplineHeatmap (uur-buckets in Analytics) gemigreerd van Nacht/Tokyo/London/NY/Post-NY → Asia/London/NY/US Late zodat de heatmap dezelfde sessies toont als de rest van de app.
- Filter-state met oude waarde `"Tokyo"` of `"Off-session"` filtert nu op een sessie die niet meer bestaat → 0 trades. Klik **Reset** in de filter-bar om dat op te lossen.

## [v12.28] — 2026-04-24

### Toegevoegd
- **Dashboard BTC live-chart heeft nu een echte timeframe-selector** (5M / 15M / 1H / 4H / 1D / 1W). Tot v12.27 was de sparkline een 60-tick-buffer die bij elke page-refresh leeg begon en geen tijd-as had. Nu: nieuwe `BtcLiveChart` component fetcht bij mount + bij elke TF-switch een REST `klines` request (intervals: `1s/1m/5m/15m/1h` afhankelijk van het venster) en blijft daarna live via `@kline_<interval>` WebSocket — laatste candle wordt continu vervangen, nieuwe candle bij elke interval-rollover. 5M en 15M gebruiken Binance's 1-seconde klines voor maximale interactiviteit (300 ticks per 5 min). SVG area-render met pulserende dot op de laatste prijs, kleur groen/rood op basis van eerste-vs-laatste candle in zichtbaar venster. Hoogte gegroeid van 60px → 140px om de TF-bar + chart te huisvesten.
- **Statusbar: SOL + Gold (XAU) + Silver (XAG) live tickers** naast BTC/ETH. SOL via Binance Spot WebSocket (`solusdt@ticker`), Gold/Silver via Binance Futures (USDT-margined TradFi perpetuals, sinds jan-2026 live op Nest Exchange / FSRA-Abu Dhabi). Eerste poging via `xauusdt@ticker` faalde stil — Binance zendt voor deze symbols (nog) geen 24h-ticker stream uit, ws.open lukt maar er komen nooit messages. Werkende oplossing: nieuwe `useBinanceFuturesMetal` hook die `@bookTicker` WebSocket gebruikt voor live mid-prijs (~per 100ms) plus een REST poll naar `/fapi/v1/ticker/24hr` per 60s voor de 24h pct change. Margins in de statusbar verkleind van 22px → 16px om alle 5 tickers + de bestaande info te laten passen. Render-helper geëxtraheerd zodat elk ticker-blokje 1-regel is.

### Gewijzigd
- **Exchange-sidebar op Accounts toont alleen actieve verbindingen** (Coelho's feedback in Discord). Tot v12.27 verscheen elke exchange uit de registry altijd in de linkerkolom, en de default-selectie was hardcoded op de eerste in de lijst (MEXC) — ook als jouw enige actieve koppeling Blofin was. Nu: connected exchanges staan bovenaan en zijn meteen geselecteerd; ongekoppelde exchanges zitten weggeklapt achter een `+ Meer exchanges (N)` toggle, één klik weg om er een nieuwe toe te voegen. Bij nul verbindingen klapt de toggle automatisch open zodat de gebruiker weet waar te kiezen.

### Fixed
- **Periode-knoppen op Dashboard werken nu** (1D / 1W / 1M / 3M / YTD / ALL) — waren tot v12.27 enkel decoratieve buttons zonder `onClick`. Klikken filtert nu het hele dashboard: hero P&L + win-rate + streak + trade-count, equity curve, trade tape, pairs-widget, key metrics, AI insight en risk alert. Hero-label past zich aan ("Vandaag" / "Deze week" / "30 dagen" / "90 dagen" / "YTD" / "Totaal"). AI insight in de hero blijft op alle data gebaseerd (zodat de boodschap niet flickert bij elke klik).
- **Status bar: `BAL` → `BALANS`** — afkorting was te cryptisch.
- **Geavanceerde filters klappen automatisch dicht bij tab-wissel.** FilterBar wordt op Trades / Analytics / Review / Kalender gerenderd; tot v12.27 bleef de "Geavanceerd"-sectie open hangen tussen die tabs. Twee fixes: (1) `key={tab}` op FilterBar dwingt een remount per tab af zodat `expanded`-state reset, (2) de `activeCount` telde `tradeType:"real"` (= default) ten onrechte als actieve filter, waardoor `expanded` na remount wéér op `true` initialiseerde. Nu telt `tradeType` alleen wanneer het expliciet ≠ "real" is, dus de bar opent na remount alleen bij écht actieve filters.
- **Download-knop bij update-banner downloadt nu écht** (Coelho's feedback). Tot v12.27 was de knop een `<a download>` link naar `raw.githubusercontent.com`. Browsers negeren het `download`-attribuut bij cross-origin links, dus Chrome opende het bestand inline (GitHub raw stuurt `Content-Type: text/plain`) en je kreeg de hele HTML-source als tekst te zien. Fix: klik triggert nu een `fetch` → `Blob` met `text/html` MIME → blob-URL → click — same-origin dus de browser respecteert het `download`-attribuut. Spinner tijdens fetch en toast-melding bij succes/fout. **Eenmalig nog handmatig updaten naar v12.28**: in v12.27 — rechtsklik op de Download-knop → "Link opslaan als…" werkt wel correct in Chrome.

## [v12.27] — 2026-04-24

### Gewijzigd
- **Status bar volgt nu het thema** — tot v12.26 had de bar hardcoded `rgba(10,12,18,0.9)` donkere achtergrond, wat op light/parchment/daylight thema's niet paste (donker strookje boven lichte app). Fix: inline style verplaatst naar CSS-class `.tj-statusbar`, met per-thema overrides — light/daylight = witte achtergrond, parchment = cream, classic = donker-paars. Text-colors gebruiken al thema-bewuste CSS-vars (`var(--text)`, `var(--gold)`, etc.) en hoeven dus niet aangepast. Brand-colors (BTC `#f7931a` oranje, ETH `#627eea` blauw) blijven vast want dat zijn de officiële crypto brand-colors.

## [v12.26] — 2026-04-24

### Toegevoegd
- **Live status-bar bovenaan** (SyncJournal-stijl terminal bar, 32px) — staat nu boven de topbar op elke tab. Inhoud: `● LIVE` pulsing dot (0.8s), huidige klok (tikt elke seconde) + datum, `SESSION` auto-detected uit UTC-uur (Tokyo / London / New York / Off-session), totale `BAL` (sum van alle account-capital + PnL), max `DD` (peak-to-trough drawdown op equity curve), `RISK TODAY` (som van riskPct van trades vandaag), **live BTC ticker** via Binance WS, **live ETH ticker** via Binance WS, en rechts-uitgelijnd `⚡ N opens` (aantal open posities).
- **ETH live ticker** — nieuwe `useBinanceTicker(symbol)` hook (geabstraheerd uit de oude `useBtcTicker`) ondersteunt nu zowel `btcusdt` als `ethusdt`. Beide tickers tonen realtime price met green/red flash op tick-directie + 24H pct change. `useBtcTicker()` blijft bestaan als backward-compat alias.
- **`useLiveClock()` + `getSession()`** helpers naar tradejournal.html geport (al aanwezig in syncjournal.html).

### Gewijzigd
- **Maand-doelen ringen zijn nu optioneel** — nieuwe toggle `config.showGoalsRings` (default: aan). Verschijnt in Instellingen → Accounts → Layout, direct onder de Premium-keuze (alleen zichtbaar als je op Premium-layout zit). Uitzetten verbergt de GoalsRings widget bovenaan het Dashboard zonder je goals-data aan te tasten.

## [v12.25] — 2026-04-24

### Gewijzigd
- **Content max-width 1520px terug** — v12.23 strekte content over de volle schermbreedte, maar dat oogde op wide-schermen te uitgerekt. Denny wees terug naar de SyncJournal-demo als gewenst ontwerp (waar content compacter staat). `tj-content` heeft nu weer `maxWidth:1520px; margin:0 auto`. Viewport-lock van v12.22 (geen page-scroll, topbar blijft) én responsive Sparkline van v12.24 blijven intact.

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
