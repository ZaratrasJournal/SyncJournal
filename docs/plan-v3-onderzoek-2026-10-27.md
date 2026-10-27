# TradingPlan v3 — onderzoek andere journals (27-10-2026)

Onderzoek bij [plan-v3-ontwerp-2026-10-27.md](plan-v3-ontwerp-2026-10-27.md): hoe doen andere tools
dag- en weekplannen, scenario's, edge per setup en "plan gevolgd"? Wat nemen we over, wat vermijden we?
Bouwt voort op het eerdere onderzoek in [tradingplan-analyse.md](tradingplan-analyse.md) (18-09-2026) en
`playbook-coaching-ai/results/`.

## Hoe dit tot stand kwam (lees dit eerst)

- Alles is verzameld met **web-zoekopdrachten**. Het rechtstreeks openen van de pagina's lukte vanuit de
  cloud-sessie niet (DNS-fout of 403 van de proxy). De beweringen hieronder komen dus uit de
  samenvattingen en citaten die de zoekmachine van die pagina's gaf, **niet** uit volledig gelezen pagina's
  of uit de apps zelf. Precieze veldlijsten zijn daardoor onvolledig.
- **"Niet gevonden"** betekent: niet gevonden in dit onderzoek. Het betekent niet dat de functie zeker
  ontbreekt.
- Recensies van concurrenten (bv. Rizetrade over Trademetria) zijn gemarkeerd als mogelijk partijdig.
- Controleer een bewering op de bronpagina voordat er een ontwerpbesluit op rust.

---

## 1. Per tool

### 1.1 TradeZella

1. **Dag-/weekplan.**
   - Knop **"Start My Day"** opent de pre-market-stap. Je kiest een template of schrijft vrij; de suggesties
     zijn economische kalender, een **if/then game plan** en mindset.
     https://help.tradezella.com/en/articles/13863136-getting-started-with-tradezella
   - Notebook heeft een map "Daily Journal". Elke nieuwe notitie krijgt automatisch een standaardtemplate,
     met 6 voorgestelde secties: pre-market game plan, watchlist, wat ging goed, fouten, reminders,
     end-of-day recap. Het is **vrije tekst**, geen gestructureerde velden.
     https://help.tradezella.com/en/articles/7190696-organizing-and-managing-your-notes-within-your-tradezella-notebook
   - Zella AI "Sentiment Agent" maakt elke ochtend in Start My Day een overzicht (events, nieuws, levels,
     volatiliteit) met "zero input needed". https://www.tradezella.com/zella-ai
   - Weekplan in de app: niet gevonden (alleen blogadvies).
     https://www.tradezella.com/blog/trading-planning-system-guide
2. **Scenario's vooraf en koppeling met de trade.**
   - Playbook = naam, beschrijving, regels in groepen.
     https://help.tradezella.com/en/articles/7020769-getting-started-with-the-playbook
   - Een trade koppel je **handmatig** aan een playbook op de tradepagina en daarna vink je af welke regels
     je volgde. Playbooks tellen ook **gemiste trades**.
     https://www.tradezella.com/blog/february-trader-software-release-notes
   - Automatisch een live trade aan een playbook koppelen: niet gevonden. Wel een "Auto Trade Tagger" voor
     tags. https://www.tradezella.com/blog/finding-your-best-trading-strategy
   - Scenario's per dag afvinken: niet gevonden; de if/then staat in vrije tekst.
3. **Statistiek per playbook.** Net P&L, win %, profit factor, expectancy, gem. win/verlies, **planned vs
   realized R** (planned R alleen met stop + target), aantal trades, streaks.
   https://help.tradezella.com/en/articles/11595424-reports-playbook
   - Vóór de trade, op een planscherm: niet gevonden.
   - Kleine aantallen: geen waarschuwing in de app gevonden; de blog adviseert ≥ 50, liefst 100+ trades per
     strategie. https://www.tradezella.com/blog/finding-your-best-trading-strategy
4. **Plan gevolgd / discipline.**
   - Per playbook een **rule follow-rate %** en net P&L per gevolgde regel (playbook-artikel hierboven).
     Filter op "rules followed" vs "deviated". https://www.tradezella.com/blog/analyze-trading-performance
   - **Progress Tracker**: dagelijkse checklist in drie fasen (Prepare / Trade / Reflect), vaste en eigen
     regels, optionele max-verlies per trade en per dag; "Finish My Day" sluit de dag af; widget met
     dagscore en heatmap.
     https://help.tradezella.com/en/articles/10371695-understanding-and-using-progress-tracker-rules
   - **Zella Score** (0–100) is puur prestatie (PF 25%, max DD 20%, gem. win/verlies 20%, win % 15%,
     recovery 10%, consistency 10%), zonder discipline.
     https://help.tradezella.com/en/articles/10305642-introducing-the-all-new-zella-score
   - "Rule Adherence Score" (< 60% = systeemprobleem, 85%+ = elite) staat in hun blog; als app-functie niet
     bevestigd. https://www.tradezella.com/blog/trading-discipline
- **Invulwerk.** Goed: auto-template en een AI-ochtendoverzicht zonder invoer. Handwerk: playbook koppelen
  en regels afvinken per trade. Recensie: geavanceerde functies overweldigen beginners.
  https://benzinga.com/money/tradezella-review

### 1.2 Edgewonk

1. **Plan.** "Trading Plans" werkt **per trade-idee**, niet per dag: entry, exits en de redenen (variabelen);
   de uitkomst vul je later in.
   https://edgewonk.zendesk.com/hc/en-us/articles/7772564128786-Trading-Plans ·
   https://edgewonk.com/blog/more-custom-statistics-trading-plans-may-2022-update
   - Dag- of weekplan als functie: niet gevonden. Exacte veldenlijst: niet gevonden.
2. **Koppeling plan → trade.** De duidelijkste van alle tools: elk plan heeft twee knoppen, **naar Journal**
   (uitgevoerd) of **naar "Missed Trades"** (niet genomen). Daarna statistiek over "the success of your trade
   plans". Voor gemiste trades raadt de helpdesk een eigen tag voor de reden aan.
   https://edgewonk.zendesk.com/hc/en-us/articles/7772557295506-Missed-Trades
3. **Statistiek.**
   - Custom Statistics: tot 20 categorieën met tags; per tag beste/slechtste-grafiek, expectancy, winrate.
     https://edgewonk.com/blog/10-things-to-do-in-edgewonk
   - Stoplicht: is je reward-to-risk hoog genoeg voor je huidige winrate?
     https://tradeciety.com/all-edgewonks-metrics-and-statistics-explained-for-successful-journaling
   - **Edge Finder** (elke zondag automatisch): duurste fouten, beste tijden, **Total Edge Leak** (kosten
     van trades met regelbreuk) en **True System Edge** (resultaat zonder die trades).
     https://edgewonk.com/edge-finder
   - Vóór de trade: niet gevonden. Kleine aantallen: geen waarschuwing gevonden; een recensent noemt Edge
     Finder onder 50–100 trades "questionable". https://tradingjournal.com/review/edgewonk
4. **Discipline.** Per trade entry-/management-/exit-commentaar (bv. "Revenge trading") als positief,
   negatief of neutraal → efficiency-score en **Tiltmeter** (rood/groen per trade, per dag op de kalender,
   streaks over de equity-curve). https://edgewonk.com/blog/edgewonk-october-update — bronnen spreken elkaar
   tegen over de precieze invoer.
- **Invulwerk.** Meest gehoorde klacht: veel handmatig taggen, "feels like homework"; geen naadloze sync.
  https://daytradingz.com/edgewonk-review/

### 1.3 TraderSync

1. **Plan.** "Trading Plan"-tool met regels als max dagverlies en max trades per sessie; volgens recensies
   alleen in Elite. https://tradersync.com/features/ · https://www.stockbrokers.com/review/tools/tradersync
   Pre-market- of dagplan met velden: niet gevonden.
2. **Koppeling.** **Strategy Checker**: strategie als checklist van regels (Technicals, Entry, Exit); toont
   welke regels je volgt/breekt en wat dat doet met je winrate. https://tradersync.com/strategy-checker/
   Meetbare regels (limieten) worden volgens een recensie automatisch gecontroleerd.
   https://www.luxalgo.com/blog/tradersync-trade-journal-breakdown/ — Automatisch een setup aan een trade
   koppelen: niet gevonden; setup- en mistake-tags zijn handwerk.
3. **Statistiek.** Winrate en profit factor per setup; rapporten op tijd, strategie, mistakes.
   https://www.benzinga.com/money/tradersync-review — **Let op:** hun "expectancy" gebruikt een eigen,
   niet-standaard formule. https://tradersync.com/support/expectancy/ — Vóór de trade / kleine aantallen:
   niet gevonden.
4. **Discipline.** Score per regel; voorbeeld op de homepage: "Max Daily Trades 18/20" plus het verlies door
   afwijken van het plan. https://tradersync.com/ — Cypher Coach (Elite) toetst trades proactief aan je plan.
   https://www.financialtechwiz.com/post/tradersync-review/
- **Invulwerk.** Analyses worden "blurry" bij inconsequent taggen; Trustpilot-klachten over verloren notities.
  https://www.trustpilot.com/review/tradersync.com

### 1.4 Tradervue

1. **Plan.** Vrije notities per trade, per dag (ook zonder trades) en algemeen; een notitie-template vult zich
   automatisch. Gestructureerd pre-market-plan: niet gevonden.
   https://help.tradervue.com/article/3475-note-template
2. **Scenario's/koppeling.** Niet gevonden. Tags alleen op trades, achteraf.
   https://blog.tradervue.com/?p=1164
3. **Statistiek.** "Performance by Tag": aantal, totaal/gem. P&L, win %, profit factor, MFE/MAE (Silver/Gold).
   https://help.tradervue.com/article/3452-preformance-by-tag-report — Expectancy/R per tag, waarschuwing
   bij kleine aantallen, statistiek vóór de trade: niet gevonden.
4. **Discipline.** Niet ingebouwd (alleen via een eigen tag).
- **Invulwerk.** "Dated", veel klikken per routinetaak. https://traderssecondbrain.com/guides/tradervue-review

### 1.5 TradesViz

1. **Plan.** Zelf te ontwerpen **Day Plans** (aan een datum) en **Trade Plans** (aan een trade), met
   veldtypen checkbox, tekst, categorie, getal. Geen kant-en-klaar pre-market-template.
   https://www.tradesviz.com/glossary/trade-plans/
2. **Koppeling.** Een plan kun je vóór de entry maken; het blijft "Unlinked" tot je het aan een trade hangt
   (keuze uit de 30 recentste). **Ongekoppelde plannen tellen niet mee** in de statistiek, dus overgeslagen
   setups worden niet geanalyseerd. Een Day Plan verzamelt automatisch de statistiek van de trades van die
   dag. Hun blog stelt een taggroep "Entry Process: Planned / Reactive" voor.
   https://www.tradesviz.com/blog/plans-view/ ·
   https://tradesviz.crisp.help/en/article/trade-and-day-plans-management-1e1o89z/ ·
   https://www.tradesviz.com/trading-psychology/fear-of-missing-out/
3. **Statistiek.** Plan Analysis: samenvatting per plan (win/loss, win %, P&L, gem. R), per checkbox hoe
   vaak aangevinkt en het verband met resultaat, plus pivot-grid.
   https://www.tradesviz.com/blog/trading-plan-analysis/ —
   **Betrouwbaarheid:** alleen de AI Coach: 16 vaste checks met een **z-toets op proporties**; zwakke
   signalen krijgen "low statistical confidence", elke bevinding toont n en betrouwbaarheid. Drempels niet
   gepubliceerd. https://www.tradesviz.com/blog/ai-coach-trading-review/ — In de gewone tabellen: niet
   gevonden.
4. **Discipline.** Checkbox "Followed rules" → P&L, winrate, PF voor ja vs nee; aantal vinkjes per regel.
   Dag-tags als followed_plan, broke_rules, overtraded, no_trade_day.
   https://www.tradesviz.com/blog/trading-journal-psychology-tracking/ ·
   https://www.tradesviz.com/blog/day-tags-complete-guide/
- **Invulwerk.** Steile leercurve, druk scherm (gebruiksgemak 3,2/5); er is een "Simple Mode".
  https://thegodfunded.com/en/tools/tradesviz/

### 1.6 Chartlog

1. **Plan.** Trades per dag gegroepeerd met P&L, win %, PF; templates; een blauwe stip markeert
   niet-gereviewde trades/dagen. Pre-market-plan: niet gevonden.
   https://bullishbears.com/chartlog-review/
2. **Koppeling.** "Strategies" met regelgroepen (market conditions, entry triggers, exit triggers); na de
   sessie geef je elke trade een strategie en vink je de gevolgde regels aan.
   https://www.chartlog.com/course/strategies/
3. **Statistiek.** Rapporten per strategie, tag, tijd, custom fields; "success rate" per strategie.
   **Kleine aantallen:** alleen advies — wacht op ≥ 25 trades per setup.
   http://help.chartlog.com/en/articles/5482668-tutorial-how-to-track-winning-strategies-on-chartog
4. **Discipline.** Regels per trade afgevinkt; een "% rules followed"-cijfer: niet gevonden.
- **Invulwerk.** Werkt alleen met veel discipline in het journalen. https://tradingreview.net/chartlog-review/

### 1.7 Trademetria

1. **Plan.** Vrije notities per trade; dagplan: niet gevonden. https://trademetria.com/trading-journal-features
2. **Koppeling.** Niet gevonden; strategy-tags pas als een trade gesloten is.
   https://trademetria.com/blog/ranking-your-trading-strategies/
3. **Statistiek.** "Strategy rankings" (beste/slechtste strategie). Precieze cijfers en omgang met kleine
   aantallen: niet gevonden.
4. **Discipline.** "Challenges": regels instellen, zien welke je haalt of breekt, met badges.
   https://trademetria.com/ — Kritiek (van concurrent Rizetrade, dus partijdig): challenges meten uitkomst,
   niet of je je playbook volgde. https://rizetrade.com/trademetria-alternative

### 1.8 Stonk Journal (extra)

- Per trade setup, thesis, geplande stop/target, tags. Dagplan: niet gevonden.
  https://stonkjournal.com/markets/day-trading-journal
- Winrate **zonder break-even-trades**, expectancy, PF, R. https://stonkjournal.com/methodology
- **Rule compliance score**, uitdrukkelijk los van de uitkomst: een winnende trade kan het plan breken.
  https://stonkjournal.com/features/risk-management-rules

### 1.9 ICT/SMC-templates (Notion, Sheets) en TradingView-scripts (extra)

- **Notion-templates** (Dangstrat, Prototion, Gumroad): weekly en daily bias, **draw on liquidity**, POI,
  entry-criteria, execution-checklist, weekly review. Alles handmatig. Bull/bear-scenario's die je achteraf
  afvinkt: niet gevonden. https://threadreaderapp.com/thread/1641754962605506560.html ·
  https://www.prototion.com/notion-template/ICT-SMC-Trading-Plan-&-Journal
- **ICT-journalgids**: pre-trade bias, draw on liquidity, kill zone, AMD-fase, PD-array, screenshot; als
  statistiek o.a. winrate per kill zone en een **"bias accuracy rate"** (hoe vaak je bias klopte).
  https://www.theinnercircletraders.com/ict-trading-journal/
- Advies: schrijf de daily bias in gewone taal op vóór je een lager tijdframe opent; een trade zonder
  invalidatieniveau is een fout.
  https://tradingstrategyguides.com/day-19-7-common-ict-smc-trading-mistakes-beginners-make-and-how-to-fix-them/
- **TradingView-scripts** maken het ochtendplan: "Daily Trade Plan Generator" (levels, bias-score, Plan
  A/B/C) en "DailyDesk" (1D bias, 4H structuur, 1H confirmatie, 15m executie) — dezelfde trechter als onze
  lagen. https://it.tradingview.com/script/gD4fbEGn-Daily-Trade-Plan-Generator-AGPro-Series/ ·
  https://ar.tradingview.com/script/tgctd3HU-DailyDesk-Pre-Market-Plan-Risk/

### 1.10 Winrate bij kleine aantallen (achtergrond)

- Foutmarge winrate ≈ 1,96·√(p(1−p)/n): bij 55% is dat ±22 procentpunt bij 20 trades, ±7 bij 200.
  https://traderssecondbrain.com/guides/how-many-trades-to-know-if-strategy-works
- **Wilson-interval** gedraagt zich beter bij kleine n. https://metricgate.com/calculator/wilson-score-interval
  Een TradingView-indicator kijkt of de **ondergrens** boven de break-even-winrate van je R:R ligt.
  https://www.tradingview.com/script/4OAS5c8R-Edge-Confidence-Gauge-AGPro-Series/
- **Shrinkage**: trek de winrate naar 50% met 8–20 "nep-trades" (vuistregel van een leverancier, geen
  standaard). https://www.quantum-algo.com/glossary/shrinkage/
- Zelf nagerekend (Wilson, 95%):

  | Trades | Winrate | Interval |
  |---|---|---|
  | 3 van 4 | 75% | 30–95% |
  | 7 van 10 | 70% | 40–89% |
  | 14 van 23 | 61% | 41–78% |
  | 30 van 50 | 60% | 46–72% |
  | 60 van 100 | 60% | 50–69% |

  Pas rond 50 trades wordt het interval smaller dan ±15 punt.

---

## 2. Samenvattend beeld

| | Dagplan | Scenario's vooraf afvinken | Plan ↔ trade | Edge vóór de trade | Kleine aantallen | Plan gevolgd |
|---|---|---|---|---|---|---|
| TradeZella | vrije tekst + AI-overzicht | ✖ | handmatig playbook + regels | ✖ | advies ≥ 50 | follow-rate %, Progress Tracker |
| Edgewonk | ✖ (per idee) | per idee: Journal / Missed | ✔ duidelijkst | ✖ | ✖ | Tiltmeter, Edge Leak in geld |
| TraderSync | regels (Elite) | ✖ | Strategy Checker | ✖ | ✖ | score per regel, verlies door afwijken |
| Tradervue | vrije notitie | ✖ | tags achteraf | ✖ | ✖ | ✖ |
| TradesViz | zelf bouwen | plan vooraf, later koppelen | handmatig; ongekoppeld telt niet | ✖ | alleen AI Coach (z-toets) | Followed-checkbox ja/nee |
| Chartlog | ✖ | ✖ | strategie + regels achteraf | ✖ | advies ≥ 25 | regels per trade |
| Trademetria | ✖ | ✖ | ✖ | ✖ | ✖ | challenges (uitkomst) |
| Stonk Journal | ✖ | ✖ | setup-tag | ✖ | ✖ | compliance los van uitkomst |
| ICT-templates | bias, DOL, levels | ✖ | ✖ | ✖ | ✖ | checklist |

Drie conclusies:

1. **Niemand toont de edge van een setup op het moment dat je plant.** Overal is statistiek iets voor
   achteraf. Blok A van het ontwerp is daarmee onderscheidend.
2. **Betrouwbaarheid bij weinig trades wordt bijna nergens getoond**; alleen de TradesViz AI Coach labelt
   zwakke signalen. De rest geeft een blogadvies (25, 50, 100 trades).
3. **De koppeling plan → trade is overal handwerk.** De meest gehoorde klacht bij Edgewonk, TraderSync en
   Chartlog is taggen achteraf. Edgewonk's "naar Journal of naar Missed" is het enige expliciete
   scenario-einde; TradesViz laat ongekoppelde plannen juist buiten de cijfers vallen.

---

## 3. Aanbevelingen voor SyncJournal plan v3

**1. Laat de dag zichzelf vullen; vraag alleen wat echt nieuw is.**
Wat: Dag erft week (dat staat al vast); daarnaast "neem gisteren over" voor de 4H/1H-laag en voor
scenario's die gisteren open bleven, en de pre-flight-vinkjes onthouden hun stand tot je ze reset.
Waarom: TradeZella vult notities automatisch met een template en geeft een ochtendoverzicht zonder invoer;
Edgewonk en TraderSync krijgen de klacht "homework" en "blurry bij inconsequent taggen".
Besluit: past binnen besluit 2. "Gisteren overnemen" is een uitbreiding, geen wijziging.

**2. Toon bij elke edge-regel het aantal trades als eerste getal, en de betrouwbaarheid als woord.**
Wat: "Live 23 · 61% · +1,4R" met *weinig* (< 10), *redelijk* (10–29), *genoeg* (≥ 30) — de grenzen zijn
een voorstel. Grijs de cijfers bij *weinig*.
Waarom: geen enkele journal doet dit in de gewone weergave; alleen TradesViz' AI Coach labelt "low
statistical confidence" en toont n. Chartlog/TradeZella geven alleen blogadvies.
Besluit: past binnen besluit 4 (die noemt al weinig/redelijk/genoeg). Raakt geen besluit; alleen de grenzen
moeten nog gekozen worden.

**3. Gebruik de Wilson-ondergrens in plaats van een kale winrate voor de betrouwbaarheid en de ranking.**
Wat: bereken intern het 95%-Wilson-interval. Gebruik het om *weinig/redelijk/genoeg* te bepalen (bv. op
breedte van het interval) en eventueel als tooltip "winrate tussen 41% en 78%". Of: toets of de
ondergrens boven de break-even-winrate van het gemiddelde R:R ligt ("edge aangetoond: ja/nog niet").
Waarom: bij 7/10 trades ligt de echte winrate ergens tussen 40% en 89%; een kaal "70%" is de schijnzekerheid
die besluit 4 wil vermijden. De TradingView-indicator "Edge Confidence Gauge" doet precies die
break-even-toets.
Besluit: past binnen besluit 4 ("geen kans in procenten"), zolang het interval in een tooltip blijft.
**Raakt besluit 4 (ranking op expectancy)** als we de ranking op een ondergrens zouden zetten: dat is een
keuze voor Zaratras.

**4. Ranking: alleen "sterkste" noemen als het verschil er echt is.**
Wat: zet het label "sterkste" alleen als het scenario *redelijk* of *genoeg* data heeft; bij twee scenario's
met *weinig* data geen winnaar, maar "nog te weinig trades om te vergelijken".
Waarom: zelfde reden als 2 en 3; een ranking tussen 4 en 6 trades is ruis. Niemand anders rankt vooraf, dus
er is geen voorbeeld om te kopiëren — wel om fouten te vermijden.
Besluit: **raakt besluit 4** (ranking op expectancy, Live vanaf ≥ 10 Live-trades): het voegt een
minimumvoorwaarde toe. Voorleggen aan Zaratras.

**5. Gemist expliciet afsluiten, zoals Edgewonk; laat niets ongemerkt verdwijnen.**
Wat: een scenario dat aan het eind van de dag nog "open" staat, verschijnt in de Afsluiting met de vraag
"uitgekomen, niet genomen / niet uitgekomen / ongeldig" (één tik). De gemist-regel ("6× gemist, samen +8R")
bouwt daarop.
Waarom: Edgewonk's knoppen "naar Journal / naar Missed" is het enige expliciete scenario-einde in de markt.
TradesViz laat ongekoppelde plannen buiten de statistiek: precies het gat dat de voorspel-score nodig heeft.
Besluit: past binnen besluit 5 en 7.

**6. Koppel automatisch, vraag alleen bij twijfel — en laat zien dát er gekoppeld is.**
Wat: na een sync toont het scenario "gekoppeld aan BTC long 14:32 · +1,8R"; een trade die automatisch
playbook/tags kreeg, krijgt in de journal een klein "uit plan"-label, zodat je een foute koppeling ziet.
Waarom: bij álle onderzochte tools is plan → trade handwerk (playbook kiezen, regels afvinken). Dat is de
grootste invulpijn en tegelijk het punt waar wij met exchange-sync voorlopen.
Besluit: past binnen besluit 8. Het label is een kleine toevoeging aan de journal-kant.

**7. Binnen vs buiten plan: toon het verschil in R én in geld, niet alleen een percentage.**
Wat: "Binnen plan 14 trades · +0,9R gem. — Buiten plan 6 trades · −0,6R gem. — buiten plan kostte je
−3,6R deze maand." Het percentage "binnen plan" mag eronder.
Waarom: Edgewonk's "Edge Leak" / "True System Edge" en TraderSync's "verlies door afwijken" maken het
concreet in geld; eerder onderzoek (`tradingplan-analyse.md` §4.3) vond dat het bedrag beter binnenkomt dan
een nalevingspercentage. Stonk Journal houdt naleving bewust los van uitkomst — dat sluit hierop aan.
Besluit: past binnen besluit 5. "Binnen plan" = trade gekoppeld aan een scenario; definitie verandert niet.

**8. Voorspel-score: splits "klopte de bias" van "kwam het scenario uit".**
Wat: naast "je scenario's komen in 58% uit" ook — uit de Week/Dag-bias die al ingevuld wordt — een
"bias klopte"-cijfer per laag (Weekly/Daily), zonder extra invoer: vergelijk de bias met de richting van de
uitgekomen scenario's. Toon de voorspel-score met n ("58% van 31 scenario's").
Waarom: de ICT-journalgids noemt "bias accuracy rate" als kerncijfer; geen enkele journal-tool heeft het.
De n erbij volgt uit punt 2.
Besluit: de score zelf past binnen besluit 5. **Het bias-cijfer is nieuw**: valt onder blok B/C-achtig werk,
dat besluit 5 buiten v1 houdt. Alleen bouwen als Zaratras het toevoegt; anders voor later noteren.

**9. Houd de dag-afsluiting op één vrije regel; alles anders automatisch.**
Wat: Afsluiting toont automatisch: scenario-statussen, trades binnen/buiten plan, dag-R. De enige invoer
is "één les". Geen dagscore, geen mood-schaal achteraf.
Waarom: TradeZella's Progress Tracker (Prepare / Trade / Reflect, "Finish My Day") is het beste
dagritueel in de markt, maar vraagt per dag meerdere vinkjes; Edgewonk's tiltmeter vraagt commentaar per
trade, wat als huiswerk voelt. De Zella Score laat zien dat een samengestelde score makkelijk prestatie meet
in plaats van gedrag.
Besluit: past binnen besluit 9.

**10. Geen vrij te ontwerpen formulieren; vaste velden, eigen chips.**
Wat: houd de vaste veldenset uit besluit 2 (titel, richting, playbook, grade, Trigger, Ongeldig als, laag,
stop/TP, link, notitie) en laat alleen de *inhoud* (chips, pre-flight-vinkjes) instelbaar.
Waarom: TradesViz laat je je hele plan zelf ontwerpen en scoort daardoor laag op gebruiksgemak; Notion-
templates zijn flexibel maar leveren geen statistiek omdat de velden per persoon verschillen. Vaste velden
+ journal-tags (besluit 3) is precies wat matching en edge mogelijk maakt.
Besluit: past binnen besluiten 2 en 3; bevestigt ze.

---

### Wat we bewust níét overnemen

- **AI-ochtendoverzicht** (TradeZella, Chartlog.ai): vraagt een backend en een sleutel buiten de browser;
  past niet bij de huidige architectuur. Mori (`coachPlanRegels`) is de plek als het ooit komt.
- **Gamification/badges** (Trademetria): meet uitkomst, niet planvolging.
- **Een eigen expectancy-formule** (TraderSync): gebruik de journal-definitie (`aggOf`, `gemR`).
