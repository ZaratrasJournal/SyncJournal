# TradingPlan v3 — ontwerp (27-10-2026)

Besluiten van Zaratras in een grill-sessie op 27-10-2026. Dit document is de bron voor onderzoek,
prototype en bouw. Wijkt iets hiervan af, dan eerst overleggen.

## Waarom

Het huidige plan (`site/plan/index.html`, TradingPlan v2) is te veel en onduidelijk: 8 tabs, een weekplan
van ~19 invulpunten, een dagplan van ~20 plus 4–5 per scenario, drie checklists (10/12/7 punten) en een
poort die hetzelfde doet als het dagplan, maar los van de scenario's. Niemand gebruikt het nu: **we beginnen
schoon**, zonder migratie.

**Visie:** een week- en dagplan dat je snel invult, en dat op basis van wat je invult **data uit je journal**
laat zien: hoe kansrijk is dit scenario volgens mijn eigen trades? Efficiënt en overzichtelijk. Data is key.

## Besluiten

1. **Losse pagina** op `syncjournal.nl/plan` (blijft `site/plan/index.html`). Zelfde origin als de journal
   (`/app`), dus het plan leest de journal-opslag rechtstreeks: trades, tags, playbooks.
2. **Trechter week → dag → scenario.**
   - Week: lagen Weekly en Daily (bias + setups/confirmaties als chips), levels, één regel no-trade/nieuws,
     één regel focus.
   - Dag: erft de lagen van de week en voegt 4H en 1H toe; levels overgenomen van de week (aanvullen kan);
     mentaal 1–5 (één tik); een **pre-flight** van hooguit 3 vaste vinkjes die je zelf kiest (bv. "nieuws
     gecheckt", "goed geslapen", "FTMO-limiet in orde").
   - Scenario (hoort bij een dag): erft de tags van de dag; voegt toe: titel, richting, playbook, grade
     (A/B/C), **Trigger** (één regel "als…"), **Ongeldig als** (één regel), de laag van het entry-tijdframe
     met confirmaties als **afvinklijstje**, optioneel stop en TP's, optioneel screenshot/TradingView-link,
     één notitieveld.
3. **Tags = de journal-tags, met dezelfde lagen.** Chips uit `tagConfig` van de journal, in dezelfde
   laag-vorm als op een trade (`layers[]: {timeframe, bias, setups[], confirmations[]}`). Ontbreekt een tag,
   dan voeg je hem in het plan toe en komt hij ook in de journal-taglijst. Geen vrije tekst-tags (anders
   vindt het plan de trades niet terug).
4. **Edge per scenario (blok A)** — één regel per scenario, standaard zichtbaar:
   - aantal trades, winrate, gem. R, expectancy, profit factor, laatste 10 als stipjes (●●○●…),
     betrouwbaarheid (weinig / redelijk / genoeg data).
   - **Live en Backtest apart**: "Live 23 · 61% · +1,4R · Backtest 40 · 55% · +1,1R". Paper telt bij
     Backtest. Gemist telt niet mee in de cijfers, maar krijgt een eigen regel ("6× gemist, samen +8R").
   - **Matching:** trades met hetzelfde playbook én álle tags van het scenario. Minder dan 5 trades → laat de
     minst specifieke tag vallen en zeg welke ("op basis van 14 trades, zonder *Asia high*"). Geen trades →
     "Nog geen trades met deze combinatie."
   - **Ranking** van de scenario's van vandaag op expectancy, label "sterkste". Op Live bij ≥ 10 Live-trades,
     anders op Backtest (en dat staat erbij).
   - Geen "kans in procenten": schijnzekerheid bij kleine aantallen.
   - R alleen van trades mét stop (journal-regel: `tradeROrNull` / `gemR`, `0` is niet "onbekend").
5. **Plan tegenover resultaat (blok D)** — in Afsluiting en Log:
   - welke scenario's uitkwamen, welke genomen, welke gemist;
   - **binnen plan tegenover buiten plan**: gem. R van trades die bij een scenario horen vs. de rest;
   - **voorspel-score** bovenaan de Log: "Je scenario's komen in 58% uit. Daarvan neem je 70%. De gemiste
     waren samen +6,2R."
   - Blok B (tag-lift, timing per sessie/weekdag) en C (TP-hitrate, stops, valkuilen) zijn **niet** voor
     v1. Zaratras koos A en D.
6. **De poort verdwijnt.** Het scenario is de check. Sizing wordt eenvoudig: **risico per grade**, één keer
   ingesteld (bv. A = 1%, B = 0,5%, C = niet traden). Alle poort-code mag weg, ook `tp2:trades`.
7. **Scenario afvinken:** elk scenario heeft één status: open · genomen · uitgekomen, niet genomen · niet
   uitgekomen · ongeldig. Eén tik. Kan ook achteraf in de Log.
8. **"Zet om in trade":**
   - **Gekoppelde exchange:** zet het scenario op "genomen". Komt er een trade binnen met hetzelfde pair en
     dezelfde richting rond dat moment, dan neemt die automatisch playbook, tags, confirmaties en grade van
     het scenario over (hergebruik het patroon van `planMatch`/`planAdopt` in de journal, nu op scenario's).
     Geen dubbele trade.
   - **Handmatig account, backtest of paper:** opent het tradeformulier van de journal met pair, richting,
     playbook, alle tags/confirmaties, grade, stop en TP's al ingevuld.
   - **Twijfel** (twee trades passen bij één scenario): niet zelf kiezen, vragen via de bestaande handmatige
     correctie (`planPick`/`planSetRef`).
9. **Vier tabs:** **Week · Dag · Afsluiting · Log**, plus een klein tandwiel (risico per grade, de 3
   pre-flight-vinkjes).
   - Afsluiting (dag en week): grotendeels automatisch uit blok D; jij vult **één les** in.
   - Log: alle dagen onder elkaar, nieuwste boven; scenario's als gekleurde status-chips, achteraf aan te
     tikken; filters op status, playbook, richting; voorspel-score bovenaan.
   - Weg: Poort, Regels (playbooks staan in de journal), de oude Log van poort-records, de drie checklists,
     Overzicht.
10. **Thema = journal.** Het plan volgt de themakeuze van de journal (licht/donker, `sj_state.theme`; de
    journal zet `body.dark`) en gebruikt dezelfde kleurtokens. Geen eigen themaknop meer.
11. **Back-up:** plannen gaan mee in de back-up van de journal (bestaand blok `tradingplan`).
12. **Journal-kant:** de Tendencies-tab "Plan" (`planTendencies`) laat voortaan blok D zien op basis van
    scenario's in plaats van poort-records. `coachPlanRegels` (Mori) leest het nieuwe weekplan.

## Na het prototype (27-10-2026)

Zaratras bekeek het prototype (`demos/plan-v3-demo.html`, rapport `docs/plan-v3-prototype-rapport.md`)
en het onderzoek (`docs/plan-v3-onderzoek-2026-10-27.md`). Deze besluiten gaan vóór de besluiten
hierboven waar ze botsen.

13. **Variant B (Cockpit)**, aangevuld met de voortgangsbalk van de confirmations en de groene staat
    "Klaar om te nemen · 1% risico" uit C, in de opengeklapte rij. A en C vervallen.
14. **Tijdframes zijn vrij, niet vast Weekly/Daily/4H/1H.** Een scalper moet net zo goed een plan kunnen
    maken als een swingtrader.
    - Week en Dag hebben elk een eigen rij lagen. Je kiest de tijdframes uit `tagConfig.timeframeTags` van
      de journal (standaard 5M t/m Weekly), en voegt er een toe of haalt er een weg met één tik.
      Ontbreekt een tijdframe, bv. 1M, dan voeg je hem toe en komt hij ook in de journal (zoals besluit 3).
    - **Stijl** in het tandwiel bepaalt alleen de lagen waarmee een nieuwe week en dag starten:

      | Stijl | Week | Dag | Entry-laag scenario |
      |---|---|---|---|
      | Swing | Weekly · Daily | 4H · 1H | 1H |
      | Daytrade (standaard) | Weekly · Daily | 4H · 1H | 15M |
      | Scalp | Daily · 4H | 1H · 15M | 5M |

      Per week, dag of scenario kun je daar altijd van afwijken.
    - **Het weekplan is optioneel.** Een dag zonder weekplan werkt gewoon, en erft dan niets. Een scalper
      kan dus alleen met dagen werken.
    - Lagen staan altijd top-down (hoogste tijdframe eerst), net als op een trade (`sorteerLagen`).
    - **Welk tijdframe telt mee in de edge:** elk tijdframe waar minstens één trade in je journal een laag
      mee heeft. Een tijdframe waar geen enkele trade een laag mee heeft, is context. Het erft door en
      stuurt je bias, maar telt niet mee in de matching. Dat staat één keer in de context, niet op elke
      kaart ("Weekly telt niet mee: geen van je trades heeft een Weekly-laag"). Dit vervangt de vaste
      regel "Weekly/Daily tellen niet mee" uit het prototype.
15. **Afbeeldingen en TradingView-links**, in de dag, de week én per scenario.
    - **Plakken** (Ctrl/Cmd+V) op het Dag- of Week-scherm. Plak je een afbeelding, dan komt die bij het
      scenario dat openstaat, en anders bij de dag of week. Plak je een link, dan komt die als link erbij.
      Daarnaast een knop "+ Afbeelding" (bestand kiezen, werkt op de telefoon) en slepen.
    - **TradingView-snapshotlinks** (`tradingview.com/x/<id>/`) tonen een voorbeeldplaatje. Lukt laden
      niet, dan blijft het een gewone link-chip. Andere http(s)-links worden een chip met het korte adres
      (zoals `tvShort` in de journal). Alleen `http:` en `https:`; al het andere wordt geweigerd.
    - Een klik op een plaatje opent het groot (lightbox). Elke afbeelding en link is weg te halen.
    - **Hooguit 8 afbeeldingen en 8 links** per dag of week, en **4 + 4 per scenario**. Afbeeldingen
      worden verkleind zoals in de journal (`compressImg`: max 1400×1000, JPEG 0,82).
    - "Zet om in trade" neemt de afbeeldingen en links van het scenario mee naar de trade (`screenshots`,
      `tvLinks`; de journal staat er hooguit 8 van elk toe). Die van de dag gaan niet mee: dat is context.
    - Afbeeldingen gaan mee in de back-up (besluit 11), zodat er bij een browserwissel niets verloren gaat.
16. **Matching (blok A) aangescherpt:**
    - **Richting telt mee.** Long en short op hetzelfde playbook zijn echt verschillend. Zijn er minder
      dan 5 trades, dan valt de richting als éérste weg, en dat staat erbij ("long en short samen").
    - **Bias telt niet mee** (nog niet). Dan wordt elke combinatie te specifiek.
    - Een tag telt alleen in de laag met hetzelfde tijdframe (1H BOS ≠ 15M BOS). Platte `t.tags` tellen
      niet mee.
    - Daarna vallen tags weg vanaf het hoogste tijdframe; binnen een tijdframe eerst de confirmations, dan
      de setups. Zo lang tot er ≥ 5 trades zijn.
    - Geërfde tags zijn per scenario uit te zetten (tik op de gedimde chip).
17. **Ranking en betrouwbaarheid:**
    - De ranking gebruikt de gemiddelde R. Die is de expectancy in R, en is te vergelijken tussen Live en
      Backtest. De tabel toont ook de expectancy in geld.
    - Betrouwbaarheid: < 10 trades weinig, 10–29 redelijk, ≥ 30 genoeg.
    - "Sterkste" alleen bij ≥ 10 trades op de basis (Live, of anders Backtest). Anders: "Nog te weinig
      trades om te vergelijken". Bij weinig data is het cijfer grijs. Geen Wilson-ondergrens in v1.
18. **Pre-flight blokkeert niets.** Het is een herinnering. Bij mentaal ≤ 2 staat bovenaan "Overweeg alleen
    A-setups".
19. **Voorspel-score:** "uitgekomen" = genomen + uitgekomen-niet-genomen, gedeeld door alle scenario's
    die niet meer open staan. Ongeldig telt als niet uitgekomen.
20. **Afsluiting** opent op vandaag als er een dagplan voor vandaag is, anders op de laatste dag met een
    plan. Open scenario's sluit je daar expliciet af (één tik per scenario, zoals Edgewonk). Eén vrij veld:
    de les.
21. **Binnen plan tegenover buiten plan** in R én in geld: "Buiten plan kostte je deze maand −3,6R (−$420)".
23. **"Zet om in trade" koppelt nooit automatisch** (vervangt de eerste en derde regel van besluit 8).
    Je klikt vaak pas aan het eind van de dag of de dag erna, en dan zijn er meerdere trades. Daarom:
    - **API-trade:** je kiest zelf uit een lijst met kandidaten (standaard hetzelfde pair en dezelfde
      richting op die dag; uit te breiden naar alle trades van die dag en de dag erna). Eén of meer
      trades per scenario; een trade hoort bij hooguit één scenario.
    - **Handmatig, backtest of paper:** het vooraf ingevulde formulier, zoals in besluit 8.
    - Koppelen en ontkoppelen kan ook later, vanuit de Afsluiting, de Log en de trade-details.
    - Geen "uit plan"-label voor automatisch gekoppelde trades: die bestaan niet meer.
22. **Later, niet in v1:** hoe vaak je bias klopte (blok B/C), Wilson-ondergrens, sessie per scenario.

## Bestaande code (startpunt)

- Plan v2: `site/plan/index.html` — tabs in `TABS`, opslag `tp2:*` in localStorage, screenshots in
  IndexedDB "tp2", eigen thema-tokens. Leest journal via `journalLoad`/`journalPbook`/`journalTrades`.
- Journal (`work/syncjournal.html`): `planLoad`, `planMatch`, `planAdopt`, `planLine`/`planPick`/`planSetRef`,
  `planTendencies`, `planPtOpties`, `coachPlanRegels`, back-upblok `tradingplan`.
- Statistiek in de journal: `aggOf(list)` (net, wr, pf, exp, avgR, n), `tradeTagsAll(t)`, `layers[]` op
  trades, `PBOOK` (playbooks), `tagConfig`.
- Demo-data: `site/demo-dataset.json` (gegenereerd door `scripts/gen-syncjournal-dataset-v2.js`).

## Volgorde

1. Onderzoek (cloud): hoe doen andere journals dagplannen, scenario's en edge-statistiek?
2. Prototype (cloud): `demos/plan-v3-demo.html`, 2–3 duidelijk verschillende varianten van het Dag-scherm,
   wisselbaar, op de demo-dataset, licht/donker, telefoonbreedte. Zaratras kiest.
3. Bouwplan (`docs/`), daarna bouw op een eigen branch, lokaal getest met echte data, dan naar work.
