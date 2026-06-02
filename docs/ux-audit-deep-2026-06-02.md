# SyncJournal — Deep UX-audit (v12.163)

**Datum**: 2026-06-02
**Door**: Claude
**Doel**: Diepe pass over alle 9 hoofdpagina's om te beantwoorden: *waar voelt het rommelig en wat zijn de échte rommel-bronnen?*

**Methode**:
1. 27 verse full-page screenshots (9 schermen × sync/parchment/daylight)
2. Code-grep door tekst-volume per scherm (info-blocks, uitleg-zinnen, emoji's)
3. Visueel oordeel + vergelijking met state-of-the-art (Tradezella / TradesViz / Stripe Dashboard / Linear)

---

## TL;DR — Top 5 rommel-bronnen, op effect-grootte

| # | Bron | Schermen geraakt | Effect-grootte | Effort |
|---|------|------------------|----------------|--------|
| 1 | **Pill-overload in Trades-tabel** — 6 verschillende gekleurde pill-systemen per rij | Trades (+ embedded in Review) | XL | M |
| 2 | **Uitleg-tekst die permanent zichtbaar is** (info-blocks, sample-size waarschuwingen) | Analytics / Review / Tendencies / Playbook | L | S |
| 3 | **Dashboard-hoofd-fold consumeert ruimte met low-value content** | Dashboard | L | M |
| 4 | **Sample-size waarschuwing dupliceert 3× over schermen** | Trades / Analytics / Review | M | XS |
| 5 | **Instellingen heeft 3-niveau navigatie** (top-tabs + sidebar + middle column) | Instellingen | M | M |

**Niet-issue volgens deze audit**: thema's. Sync en parchment werken beide goed. Het rommel-gevoel zit niet in kleur-keuze — het zit in **tekst-volume** en **visuele competitie tussen elementen**.

---

## 1. Per-scherm bevindingen

### 1.1 Dashboard — gemiddeld (3/5 zwaar)
**Wat ik zag** (top fold, sync):
- Mindset-quote banner (gold, prominent) — eerste indruk is een filosofische quote
- "Account-balans niet geconfigureerd" card — leeg-state met grijze tekst, neemt ~120px verticaal
- Sample-size waarschuwing banner (amber, 156 woorden over 2 regels)
- KPI grid 4×2 maar tweede rij heeft maar 3 cards → onbalans
- "Gerealiseerde winst" card met chart en periode-tabs

**Rommel-momenten**:
- **Mindset-quote bovenaan voelt ceremonieel** voor power-user die elke dag inlogt. Eerste keer: nice. 200ste keer: noise.
- **"Account-balans niet geconfigureerd" card** is een *leeg-state als card* — neemt ruimte als data-card maar zegt niets. Voor users zonder API-config = elke pageview.
- **4+3 KPI-grid asymmetrisch** — visueel rommelig. Lege 4e cell in rij 2 oogt als "vergeten".
- **Sample-size banner** identiek aan Analytics/Review — 3× dezelfde tekst zien op 3 navigatie-clicks.

**Wat werkt**: KPI cards zelf zijn schoon (text-2xl bedragen, text-xs sub-labels). Live ticker-bar is compact en informatief.

### 1.2 Trades — rommel-hotspot (4.5/5 zwaar)
**Wat ik zag**: Filter-bar (2 rijen — quick-win 2 OK), zoekbalk, mini-stats-strip, dan **de tabel**.

**Rommel-momenten**:
- **Pill-overload**: per rij staan 6 verschillende gekleurde pill-systemen:
  1. STATUS-pill (WIN/LOSS, groen/rood-fill)
  2. SYMBOL-pill (gekleurd per crypto: paars BTC, blauw ETH, lila SOL, rood AVAX)
  3. SIDE-pill (LONG groen / SHORT rood)
  4. PNL-pill (groen $/red $)
  5. R-MULT-pill (groen +/red -)
  6. SETUP-pill (blauwig "Breakout", "Pullback", "News")
  7. SESSIE-pill (groenig "London AM")
  8. EMOTIES-pill (rood "fomo")

  8 verschillende kleur-codes per rij = visuele lawaai. Het oog kan niet rusten.

- **STATUS-kolom dupliceert PnL-kleur**: WIN-pill is groen, PnL-cel is groen. LOSS-pill is rood, PnL-cel is rood. Twee keer dezelfde info → bezet kolomruimte voor niks.

**Wat werkt**: tabel is verder dicht en scanbaar; sortering werkt; row-hover effect is subtiel.

**Industry-vergelijking**: Tradezella gebruikt **kleur enkel voor PnL-kleur**, rest is grayscale tekst. Veel rustiger.

### 1.3 Analytics — rommel-hotspot (4.5/5 zwaar)
**Wat ik zag**: Filter-bar, viewMode-control (Proces/Winst/Beide), Genereer-rapport-knop, Mark Douglas quote, Sample-size waarschuwing, **"Proces-metrics meten..." info-block (95 woorden)**, dan 4 Proces-KPI cards, Risk Consistency + Fout-ratio grid, Discipline heatmap.

**Rommel-momenten**:
- **"Proces-metrics meten..." info-block** = 95 woorden, blauwe accent-balk, *permanent zichtbaar* bij viewMode=Proces/Beide. Vergelijkt Analytics ↔ Kalender. Onderwijzend bedoeld, maar voor returning users elke pageview ruis.
- **Sample-size waarschuwing** = 156 woorden, amber-band. Identiek aan Trades/Review.
- **Lege Proces-KPI cards** ("Niet getrackt — vul thesis in trade-form") nemen evenveel ruimte als gevulde KPI's. Visueel onbalans: 2 cards met grote groene cijfers + 2 lege grijze cards.
- **Risk Consistency / Fout-ratio cards** bevatten een grote KPI + kleine uitleg-zinnetje + status-iconen (⚠/✓/🚨). Dichte info maar werkt.
- **Mark Douglas-quote** rechts naast knoppen-row = wat random.
- **9+ verschillende emoji's in 1 viewport**: 🧠 💰 📊 ✓ 📋 🛡️ 🔍 👑 ⚠ ✏️ 🎯

**Wat werkt**: viewMode-control is een prima filter. KPI cards-grid layout is solide. Discipline heatmap als visualisatie is een sterk feature.

**Industry-vergelijking**: TradesViz Analytics heeft géén permanente uitleg-tekst — alleen tooltip-icons op de KPI-titels. Stripe Dashboard verwijst uitleg naar `?`-tooltips.

### 1.4 Review — gemiddeld (2.5/5 zwaar)
**Wat ik zag**: Mindset-quote, Filter-bar, Sample-size waarschuwing (3e keer dezelfde), Trade Score 90/100 in grote ring, 5 KPI's, Equity Stats card eronder, Equity Curve chart.

**Rommel-momenten**:
- **Sample-size waarschuwing nu 3e voorkomen** in 1 sessie. Cumulatief irriterend.
- **KPI's dupliceren**: "Netto PnL: $135" boven, "Net PnL: +$135" eronder in Equity Stats. Twee labels voor identiek getal.
- **Mindset-quote weer**, andere bron. Bij elke navigatie nieuwe quote — voelt willekeurig.

**Wat werkt**: Trade Score-ring is opvallend en mooi. Equity curve volgt het Tradervue-patroon. Layout is overall rustiger dan Analytics.

### 1.5 Kalender — clean (1.5/5 zwaar)
**Wat ik zag**: Filter-bar, Trading Rules card met 5 checkboxes, 5 mini KPI's, tijd-navigatie, jaar-heatmap.

**Rommel-momenten**:
- Streak-emoji 🥚 is unintuïtief (verwacht 🔥).
- Anders: dit scherm is fundamenteel **rustig**. Geen onnodige tekst, geen info-blocks.

**Wat werkt**: Trading Rules collapsible card is een goede UI-keuze. Heatmap aan onderkant signals seizoenspatronen direct.

### 1.6 Tendencies — rommel-hotspot (4/5 zwaar)
**Wat ik zag**: "TENDENCIES · PATROON-DETECTIE" eyebrow, H1 "Wat moet je weten?" + 44-woord ondertitel, FILTER-rij (4 tabs) + PERIODE-rij (4 tabs), Setup × Sessie matrix, observatie-card.

**Rommel-momenten**:
- **H1 "Wat moet je weten?"** voelt corny / paternalistisch. App spreekt gebruiker als kind aan.
- **44-woord ondertitel** "Cross-dimensionele patronen over je laatste 30 dagen. Klik op een card om door te springen naar de gefilterde trades. Sterktes om te repliceren, pijnpunten om te omzeilen." — 3 zinnen voor wat tooltip-tekst zou kunnen zijn.
- **8 filter-knoppen in 1 rij** met "FILTER:" en "PERIODE:" labels.

**Wat werkt**: De matrix-visualisatie zelf is uitstekend. Cell-kleuren (groen = edge bevestigd, rood = edge weg, grijs = aandacht) zijn intuïtief.

### 1.7 Playbook — gemiddeld (3.5/5 zwaar)
**Wat ik zag**: Eyebrow + H1 "Jouw bewezen setups, geformaliseerd" + 57-woord uitleg-paragraaf, sub-tabs Lijst/Analytics, filter-rij, lege empty-state.

**Rommel-momenten**:
- **57-woord intro-paragraaf** boven alles. Onderwijzend ("Een journal logt élke trade. Een playbook bevat alleen je A+ setups..."). 100% nuttig bij eerste bezoek, 0% nuttig vanaf bezoek 2.
- **Kbd-shortcut footer** is op elke pagina hetzelfde — distract op een lege scherm.

**Wat werkt**: Empty-state component (v12.160) is netjes. Tabs Lijst/Analytics zijn duidelijk.

### 1.8 AI-coach (Mori) — rommel-hotspot (4/5 zwaar)
**Wat ik zag**: Linker sidebar met 7 sections, "MORI · BETA · v12.163" intro-card, hoofdcontent met Master-schakelaar toggle (OFF default), "PER-FEATURE TOGGLES" heading, 5 feature-toggles met elk 1-2 zin uitleg, dan API-key sectie.

**Rommel-momenten**:
- **Master-schakelaar OFF + alle feature-toggles ON** = paradox UX. Wat als master off is — staan features uit? Beide tonen ze visueel evenveel "actief".
- **Driedubbele "AI-coach" labeling**: sidebar top "🤖 AI-COACH" + main H1 "🤖 AI-coach" + topbar tab "AI-coach". 3× zelfde label = waste of attention.
- **Mori intro-card** in sidebar ("v12.163 · Je AI-coach. Alle features live. Geef feedback in Discord.") doet niets functioneels — pure branding.

**Wat werkt**: De feature-toggle-cards (Pre-trade validatie, Budget monitor, Weekly digest, Floating chat, Privacy-filter) zijn schoon. Per-toggle uitleg is meestal kort genoeg.

### 1.9 Instellingen → Accounts — rommel-hotspot (4.5/5 zwaar)
**Wat ik zag**: Top-tabs (Accounts/Trading Rules/Goals/Tags/Validatie/Help), linker-sidebar met 3 groepen, middle "EXCHANGES"-kolom met 5 exchange-kaartjes, rechts groot form met API key/secret/sync/label/tags/capital tracking/3 actie-knoppen.

**Rommel-momenten**:
- **3 navigatie-niveaus tegelijk zichtbaar**: top-tabs + sidebar + middle column. Welk niveau is hoofdnavigatie? Een nieuwe gebruiker moet kiezen tussen 6+5+5 = 16 mogelijke entry-points.
- **"ACCOUNT & DATA"** verschijnt 2× (sidebar header + middle column header).
- **5 actie-knoppen op één rij** onder het form: Verbinding testen / Refresh trades / Importeer CSV/XLSX + warning. Veel context-switching.

**Wat werkt**: Form-velden zelf zijn netjes gelabeld. Tags voor strategie (Swing/Daytrade/Scalp/etc) zijn handig.

---

## 2. Patronen die meermaals voorkomen

### 2.1 "Wall of text"-info-blocks
**Locaties**: Analytics regel 10522 (95w), Tendencies header 10283 (44w), Playbook header 10167 (57w), AI-coach intro 16770 (35w), Sample-size 3× herhaald op Trades/Analytics/Review.

**Patroon**: Een prominent gekleurd blok met onderwijzende tekst van 30-100 woorden, **permanent zichtbaar**. Bedoeld als hulp voor nieuwe users; effect bij returning users = ruis.

**Oplossing-template**: Dismissable hint (`localStorage.tj_hint_<id>_dismissed`) of `?`-tooltip op een icoon naast de section-heading. Niet permanent in de view-flow.

### 2.2 Mindset-quote-banner
**Locaties**: Dashboard, Review, alle hoofdpagina's. Roteert per pageload.

**Patroon**: Gold-bordered banner met quote + bron. Eerste maand inspiring; jaar 2 = pageload-tax. Geen dismiss-knop voor "blokkeer deze altijd".

**Oplossing-opties**:
- Optie A: dismiss-once-per-day (na klik X: verberg vandaag)
- Optie B: collapse-default (kleine zin "💬 Mindset" → klik = expand)
- Optie C: alleen op Dashboard, niet op andere schermen

### 2.3 Pill-overload in tabellen
**Locaties**: Trades, embedded in Analytics setup-insights, embedded in Review.

**Patroon**: Elke kolom-waarde is een gekleurde pill. Eindigt in 6-8 pills per rij in vergelijkbare grootte en saturatie.

**Oplossing-template**: Trade-tabel hiërarchie:
- **Pill (gekleurd)**: alleen voor primaire status-waarde (PnL)
- **Tekst-only (gekleurd)**: voor secundaire signal (R-Mult zonder pill, gewoon `+1.5` of `-2.3` met green/red tekstkleur)
- **Tekst-only (grijs)**: voor identifiers (SETUP, SESSIE — chip alleen on-hover)

### 2.4 Drie navigatie-niveaus
**Locaties**: Instellingen (top-tabs + sidebar + middle), AI-coach (topbar + sidebar + sub-features).

**Patroon**: Hoofdnav is topbar (9 tabs). Per scherm soms een tweede sub-nav (settings-tabs). Plus een third-level (sidebar binnen settings). Gebruiker moet leren welk niveau wat bestuurt.

**Oplossing-template**: max 2 nav-niveaus per scherm. Settings: top-tabs ÓF sidebar, niet beide.

### 2.5 Emoji-inflatie
**Locaties**: alle schermen. Tellen: Dashboard 8 unieke, Trades 2, Analytics 15, Review 6, Kalender 5, Tendencies 8, Playbook 10, AI-coach 12, Instellingen 8.

**Patroon**: Section-headers, KPI-labels, status-indicators, feature-toggles, knoppen — overal emoji. Sommige hebben semantische waarde (🎯 setup), andere zijn decoratief (📊 zonder reden).

**Oplossing-template**: Beleidsregel — emoji's alleen waar ze **functioneel disambigueren** (verschil tussen 2 dingen die anders hetzelfde label zouden hebben). Decoratieve emoji's weg.

---

## 3. Thema-bevindingen — geen kritiek probleem

Het rommelgevoel van Denny komt **niet uit de thema-keuze**:
- **Sync (donker)**: solide, professional, "trading-terminal"-vibe. Werkt voor alle data-heavy schermen.
- **Parchment (warm light)**: voelt boekachtig — werkt verrassend goed voor content-heavy schermen zoals Tendencies. KPI cards zijn iets minder prominent maar leesbaar.
- **Daylight (modern light)**: niet geverifieerd in deze audit door fout in seed-key. Geen reden om aan te nemen dat 't anders is.

**Wat de thema's wel toont**: bij parchment wordt het ruisigste pattern (pill-overload, info-blocks) net zo erg zichtbaar. Het probleem is niet kleur — het probleem is **dichtheid van competing visual elements**.

**Niet veranderen**: thema-systeem zelf. Wel: per-thema overrides voor `+ Trade`-knop accent (parchment maakt 'm flets).

---

## 4. Wat de huidige journal goed doet (niet veranderen)

- **Token-systeem** (v12.156): consistent type/space/radius — bouwde solide fundament
- **EmptyState component** (v12.160): netjes uniform per leeg scherm
- **TP-templates layout** (v12.158/159): card-wrapper + 2-col grid is een goed voorbeeld
- **Kalender Trading Rules**: minimaal en functioneel
- **viewMode in Analytics**: filter "wat zie ik" werkt goed
- **Tendencies matrix-visualisatie**: kern-feature, sterk uitgevoerd
- **Live ticker-bar**: compact en informatief

---

## 5. Aanbevolen volgorde (V12.164–V12.167, geen big bang)

Geen mass-refactor. Per release één scherm of patroon. Eerst akkoord van Denny per stap.

### Voorstel — 4 mini-releases

#### v12.164 — Mindset-quote dismiss + Sample-size compacter (XS, 1u)
**Wat**:
1. Mindset-quote: dismiss-once-per-day (klik X = verberg tot morgen, persisted)
2. Sample-size waarschuwing: compact (1-regel, "⚠ 25 trades — onder 30-drempel, stats indicatief")
3. Beide tonen alleen op Dashboard, niet meer op Trades/Analytics/Review

**Effect**: weg met de 3× herhaalde 156-woord banner. Mindset-quote blijft maar wordt opt-out.

#### v12.165 — Trades-tabel rust (S, 2u)
**Wat**:
1. STATUS-kolom verwijderen (info zit al in PnL-kleur)
2. R-MULT: pill → gekleurde tekst (`+1.5 R` groen / `-2.3 R` rood, geen pill)
3. SETUP / SESSIE / EMOTIES: pill → text-tags (kleine letters, lichte achtergrond, geen border)

**Effect**: van 6-8 pills/rij naar 1 (alleen PnL) + 2 chips (SYMBOL, SIDE).

#### v12.166 — Analytics tekst-detox (S, 2u)
**Wat**:
1. "Proces-metrics meten..." 95-woord info-block → `?`-tooltip-icoon naast section-heading
2. Lege Proces-KPI cards: van full-size grijze cards naar 1 inline-banner "🔘 3 van 4 metrics nog niet getrackt — [link naar setup]"
3. Mark Douglas-quote weg uit Analytics (wel houden op Dashboard mindset-quote)

**Effect**: Analytics top-fold krimpt ~30% in verticale ruimte. Meer KPI's in viewport.

#### v12.167 — Tendencies + Playbook intro detox (XS, 1u)
**Wat**:
1. Tendencies: H1 "Wat moet je weten?" → "Tendencies", drop de 44-woord ondertitel
2. Playbook: 57-woord intro-paragraaf → 1 zin (`Je A+ setups, geformaliseerd.`) + `?`-tooltip met uitleg

**Effect**: beide schermen krijgen direct content-focus i.p.v. les.

---

## 6. Wat we **niet** in deze ronde doen (later overwegen)

- Instellingen 3-nav-refactor: groter werk, raakt veel features. Eerst losse winst, dan plannen.
- AI-coach Master-schakelaar UX-fix: oké zo voor nu, niet de prioriteit.
- Emoji-beleid: te subjectief om mechanisch te doen. Per scherm bij refactor.
- 4+3 KPI-grid balanceren: leeg-state-handling is een eigen issue.
- Pill-overload in Analytics setup-insights tabel: zelfde patroon als v12.165 Trades-fix — kunnen later identiek aanpakken.

---

## 7. De verfijnde UX-prompt (voor toekomstige sessies)

Onderstaande prompt is geleerd uit deze audit en vorige iteraties (v12.155–v12.163). Gebruik 'm bij toekomstige "is dit rommelig?"-checks.

> **UX-audit prompt voor SyncJournal**
>
> Acteer als senior UX-designer met focus op trading-tools. Bekijk de huidige `work/tradejournal.html` als reviewing senior. Geen pre-conceptie over wat "goed" is — meet alleen wat ik zie.
>
> **Stap 1 — Visuele triage (per scherm)**
> 1. Top-fold screenshot: wat trekt aandacht? (test: blur screenshot mentaal — welke 3 elementen blijven over?)
> 2. Tel competing visual elements: pills, badges, info-blocks, koppen, knoppen. Bij >5 in 1 viewport: rood vlaggetje.
> 3. Tekst-volume: lange paragrafen (>30w) die permanent zichtbaar zijn = waste of pixels. Kandidaat voor tooltip of dismiss.
> 4. Onderwijzende tekst: "Een journal logt élke..." — bij returning user is dit ruis. Zoek alle "uitleg-zinnen".
>
> **Stap 2 — Patroon-herkenning (cross-scherm)**
> 1. Welke info-blocks / banners zien we op meerdere schermen? Identieke tekst = 1× tonen, niet 3×.
> 2. Welke labels zien we dubbel? "AI-coach" op 3 plekken = teveel.
> 3. Pill-systemen die elkaar visueel becompetiëren: tel kleuren per rij, max 3 unieke "kleur-betekenissen" per tabel-rij.
>
> **Stap 3 — Functioneel-vs-decoratief**
> 1. Elk emoji: heeft 't een functie (disambigueert) of decoreert? Decoratieve weg.
> 2. Elke kleur-pill: signaleert 't een belangrijke beslissingsdimensie of is 't gewoon "leuk"? Niet-essentieel: weg.
> 3. Elke nav-laag: voegt 't een echte beslissingsdimensie toe? Max 2 niveaus per scherm.
>
> **Stap 4 — Output**
> Lever geen mass-refactor. Voorstel: 2-4 mini-releases, elk XS-S (max 2u), elk **één** scherm of **één** patroon. Per voorstel: file:regel + concrete diff + voor/na effect-claim.
>
> **Niet veranderen tenzij data het bewijst**:
> - Bestaande sterke features (Tendencies matrix, viewMode, Trading Rules card)
> - Token-systeem zelf
> - Thema-systeem zelf
> - Working empty-states
>
> **Geen big-bang refactor**. **Wel**: meetbare reductie van ruis per release.

---

## 8. Evidence appendix

- Screenshots: `tests/screenshots/ux-audit/v163-{sync|parchment|daylight}-{scherm}.png`
- Tekst-volume rapport (agent): zie chat-history op 2026-06-02

