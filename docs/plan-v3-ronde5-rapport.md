# TradingPlan v3 — ronde 5, rapport (30-10-2026)

Branch `plan-v3-ronde5`, gemaakt vanaf `release-v1.25` (de stand op work). Niets is gereleased: geen versienummer, geen
CHANGELOG, niets naar `site/` of de deploy-repo.

Zaratras over v1.25: "Ziet er echt een heel stuk beter uit." Hij had vier punten.

| Punt | Commit | Spec |
|---|---|---|
| 1. Criteria herkenbaar uitklapbaar | `7f8f3d2` | `plan3-ronde5` (deel 1), `plan3-criteria` 19/19 (aangepast) |
| 2. Plan in blokken, zoals rechts | `f24f3c1` | `plan3-ronde5` (deel 2), `plan3-lagen` 63/63 (aangepast) |
| 3. Bewerken en verwijderen | `f642f41` | `plan3-ronde5` (deel 3), `plan3-dag` 77/77, `plan3-media` 35/35 (aangepast) |
| 4. Scenario's verplaatsen | `0d1a6d2` | `plan3-ronde5` 46/46 (nieuw, in de release-poort), `plan3-mori` 55/55 |

Alle plan3-, coach- en faq-specs: 27/27 groen.

## 1. "Ik zie niet duidelijk of ik de criteria kan uitklappen."

De ingeklapte regel is nu zichtbaar een knop:
- een rand, en bij hover een andere achtergrond en een accentrand;
- vooraan een pijltje ▸/▾ in de accentkleur;
- de tekst "Criteria · Trend-pullback · 1/3 verplicht", en rechts wat een tik doet: "Toon alle 8" of "Verberg";
- `aria-expanded` als voorheen.

De amber regel "2 verplichte criteria nog open" blijft staan.

- Besluit: "Toon alle 8" telt de criteria, niet de "Niet als"-regels; staat er alleen "Niet als", dan zegt de knop
  'Toon "Niet als"' — het getal moet kloppen met wat er openklapt — als het fout is: alleen tekst.

## 2. "Lagen en confirmaties graag in blokken, zoals Scenario en Uitvoering & edge."

De linkerkolom heeft drie blokken: **Lagen** (met ⓘ), **Confirmations 15M** (met teller en voortgangsbalk) en
**Criteria** (met "Niet als" erin). Ze hebben dezelfde kaart (`--raise`, rand `--line2`, hoek 12 px, 12 px
binnenruimte), dezelfde kopstijl (`.kh`) en dezelfde tussenruimte (12 px) als de blokken rechts. De spec vergelijkt
die waarden rechtstreeks met het blok "Scenario".

- Besluit: de kop "Plan" boven de linkerkolom is weg — rechts staat er ook geen kolomkop, en drie blokken met elk een
  eigen kop zeggen het al — als het fout is: geen.
- Besluit: in het blok Criteria is de knop zelf de kop (de titel "Criteria · <playbook>" heeft de kopstijl) — een
  aparte kop "Criteria" boven een knop "Criteria · …" zegt het twee keer — als het fout is: geen.

## 3. "Ik kan geen wijzigingen doorvoeren in een scenario … of verwijderen."

**Waarom het niet lukte.** Eerst uitgezocht, in de browser op v1.25 (1280 en 390): bewerken **werkte**. "Bewerk"
opende een venster met alle velden, en titel wijzigen en bewaren lukte. Maar de knop was klein en stond onderin de
rechterkolom, naast "Zet om in trade". Verwijderen zat alleen in dat venster, achter een `confirm()`. Een vindbaarheids-
probleem dus, geen kapotte functie.

**Nu:**
- **✎ Bewerk** staat in de kop van een opengeklapt scenario, naast de rij. De dubbele "Bewerk" onderin de rechterkolom
  is weg.
- Elke rij heeft een **⋯-menu** met Bewerk, ↑ Omhoog, ↓ Omlaag en Verwijder…, ook als het scenario dicht is. Het menu
  sluit bij een klik ernaast, na een keuze en met Escape.
- Het bewerkvenster wijzigt alles: titel, pair, richting, playbook, grade, trigger, ongeldig als, entry-tijdframe, stop,
  TP's en notitie. Kies je een ander playbook, dan volgen de criteria en vallen de oude criteria-vinkjes weg.
- **Verwijderen** vraagt in de pagina (geen `confirm()`), en zegt wat er weggaat:
  - "1 gekoppelde trade wordt losgekoppeld. De trade zelf blijft in je journal."
  - "1 afbeelding van dit scenario wordt gewist."
  - en eventueel: "2 links gaan mee weg."
- Annuleer vanuit het bewerkvenster gaat terug naar dat venster. Bevestigen wist de afbeeldingen uit IndexedDB `tp3`,
  haalt het scenario uit de dag en uit `Day.volgorde`, en toont "Verwijderd: <titel>".

- Besluit: de knoppen staan naast de klikbare rij, niet erin — knoppen binnen een `role="button"` zijn voor een
  schermlezer niet te bedienen (axe `nested-interactive`) — als het fout is: geen; tikken op de rij klapt nog steeds open.
- Besluit: loskoppelen gebeurt door het scenario weg te halen; de journal zet `planRef` op de trade weer leeg bij zijn
  volgende `planSync` (zichtbaar worden van het tabblad of het storage-signaal), zoals bij elke wijziging van het plan —
  het plan schrijft nooit in de trades van de journal — als het fout is: in een journal-tabblad dat op de achtergrond
  open staat, toont de trade de koppeling nog tot je ernaar terugkeert.

## 4. "Het moet mogelijk zijn de scenario's naar boven en beneden te verplaatsen."

- **Keuze boven de lijst:** "Volgorde: Op edge · Eigen volgorde", standaard "Op edge". De keuze staat er pas bij twee
  of meer scenario's.
- **Verplaatsen:** met de knopjes ↑ ↓ op de rij, via het ⋯-menu, of door te slepen aan de greep ⠿ (op desktop). De
  eerste keer verplaatsen springt de keuze naar "Eigen volgorde".
- **Opslag:** per dag `Day.volgorde: [scenarioId]` en `Day.eigen: true/false`; oude dagen krijgen `[]` en `false`. Een
  nieuw scenario komt onderaan in je eigen volgorde. Terug naar "Op edge" laat je eigen volgorde bewaard, en "Eigen
  volgorde" zet hem precies terug.
- **Edge-plek blijft zichtbaar:** in eigen volgorde toont elke rij "edge 2" (de plek op edge) in plaats van alleen een
  getal, en "sterkste" blijft staan.
- **Mori:** het dagplanpakket (`coachDagplanDeel` in de journal) volgt de volgorde die je ziet, en zegt welke. Eigen
  volgorde: "in de eigen volgorde van de trader", per scenario "edge-plek N". Op edge: "volgorde op edge".
- **390 px:** ↑ ↓ en ⋯ staan onder de kop van de rij, en ✎ Bewerk wordt daar alleen ✎. De greep is daar weg.

- Besluit: naast `Day.volgorde` (uit de opdracht) een eigen veld `Day.eigen` voor de keuze — met alleen de lijst kun je
  niet terug naar "Op edge" zonder je eigen volgorde kwijt te raken — als het fout is: één veld meer in het datamodel.
- Besluit: de keuze geldt per dag, niet voor alle dagen — de volgorde is per dag, en een dag met één sterk scenario kan
  prima op edge — als het fout is: elke dag opnieuw kiezen.
- Besluit: "Eigen volgorde" aanzetten zonder ooit verplaatst te hebben, begint met de edge-volgorde van dat moment —
  anders sprong de lijst naar de volgorde van aanmaken, wat niemand koos — als het fout is: geen.
- Besluit: in eigen volgorde nummert Mori de scenario's op positie (1., 2., …) en zet de edge-plek erachter; op edge
  blijft het nummer de edge-plek — Mori ziet zo dezelfde lijst als de trader — als het fout is: alleen tekst.
- Besluit: ↑ op de bovenste en ↓ op de onderste staan uit (gedimd) — een knop die niets doet zegt niets — als het fout
  is: geen.
- Besluit: een open ⋯-menu mag over de rand van zijn kaart en over de volgende kaart heen (`.ritem:has(.rmenu)`
  zonder `overflow: clip`, hoger in de stapel) — de kaart knipte het menu anders af — als het fout is: een browser
  zonder `:has()` (Safari < 15.4) knipt het menu nog af.

## Ook gevonden

Bij het nalopen op 390 px bleek dat een latere regel `flex: 1` mijn regel voor smalle rijen overschreef. Daardoor
brak de titel woord voor woord af naast de knoppen. Opgelost; de spec controleert nu dat de knoppen onder de kop staan
en de titel de volle breedte heeft.

## Release-poort

`node tests/run-release.js --hier` (werkmap): **173/176 groen** in 5,7 min.

| Rood | Oorzaak | Bewijs |
|---|---|---|
| `matrix` 19/21, `analytics-metrics` 15/17, `tendencies` 13/15 | alleen "boot zonder fout" en "geen JS-errors": `net::ERR_TUNNEL_CONNECTION_FAILED` | de journal haalt bij het starten wisselkoersen bij `api.frankfurter.dev` (`FX_URL` in `work/syncjournal.html`); vanuit de container is die host niet bereikbaar (`curl` geeft `000`). In ronde 3 en 4 precies zo rood; deze ronde raakt in de journal alleen `coachDagplanDeel`. |

Overgeslagen omdat `tests/_fixtures/` (echte exports, gitignored) ontbreekt: 8 specs geheel of deels.

## Wat niet getest kon worden

- **Slepen op een echt touchscherm**: HTML5-slepen werkt niet met vingers; daarom staan er op 390 alleen ↑ ↓ (zo vroeg
  de opdracht ook). Slepen met de muis is getest (Chromium, `dragAndDrop`).
- **Safari en echte telefoons**: alleen Chromium.
- **Het loskoppelen in een journal-tabblad dat tegelijk open staat**: de spec controleert dat het scenario de trade
  niet meer noemt en dat de trade nog in de journal staat; de spiegel `planRef` in de journal toetst `plan3-koppeling`.

## Screenshots

`docs/plan-v3-ronde5-screenshots/`, licht en donker × 1280, 1680 en 390:
- `voor-*`: v1.25, het eerste scenario open met de criteria open.
- `na-*`: deze ronde, met de volgorde-keuze, een scenario open met de criteria open en Plan in blokken, en het ⋯-menu
  open op de tweede rij.

## Concept-CHANGELOG

```markdown
### Toegevoegd
- **Scenario's verplaatsen.** Zet je scenario's in je eigen volgorde met ↑ ↓, via het ⋯-menu of door te slepen aan ⠿.
  Boven de lijst kies je "Op edge" of "Eigen volgorde"; de edge-plek blijft bij elk scenario staan, en Mori bekijkt je
  dagplan in de volgorde die jij ziet.
- **Bewerken en verwijderen waar je ze zoekt.** ✎ Bewerk staat in de kop van een open scenario, en elk scenario heeft
  een ⋯-menu. Verwijderen vraagt eerst wat er weggaat: gekoppelde trades worden losgekoppeld (ze blijven in je journal),
  de afbeeldingen van het scenario worden gewist.

### Gewijzigd
- **Criteria uitklappen is duidelijker.** De regel is een knop met een pijltje en zegt "Toon alle 8" of "Verberg".
- **Lagen, confirmations en criteria in blokken**, net als Scenario en Uitvoering & edge ernaast.
```
