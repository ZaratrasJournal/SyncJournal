# TradingPlan v3 — ronde 8, rapport (31-10-2026): één breedte voor alle tabs

Branch `plan-v3-ronde8`, gemaakt vanaf `release-v1.27.3` (de stand op work). Opdracht en logboek:
[plan-v3-ronde8-2026-10-31.md](plan-v3-ronde8-2026-10-31.md). Niets is gereleased: geen versienummer, geen CHANGELOG,
niets naar `site/` of de deploy-repo.

| Wat | Commit | Spec |
|---|---|---|
| Eén breedte, twee kolommen per tab, één lege staat | `a9fadcb` | `plan3-ronde8` 26/26 (nieuw, in de release-poort), `plan3-scenario-beeld` (aangepast) |

Alle plan3-specs, `theme-hook` en de FAQ-specs groen (23/23). De release-poort staat hieronder.

## Wat Zaratras zag

"Ik zie dat het dagplan-scherm breder is geworden, maar weekplan, afsluiting en log zijn smaller. Kijk even goed naar
gevulde en niet-gevulde schermen en trek dit gelijk."

**Oorzaak:** ronde 4 gaf alleen Dag 1680 px (`body.breed`); de andere tabs bleven op 1280 px. De kop schoof mee met de
tab.

## Wat er veranderde, per tab

- **Alle tabs:**
  - Tot 1680 px breed. Kop en inhoud staan op elke tab op dezelfde pixel, leeg en gevuld; gemeten op 1600 en 2000 px.
  - `body.breed` is weg.
  - Onder 1100 px één kolom; op 390 en 1024 px geen horizontale scroll.
- **Week:**
  - links de context: Lagen, Levels, No-trade, Focus;
  - rechts het werk: Afbeeldingen en links, en een nieuw blok **Dagen van deze week**. Dat toont per dag met een plan
    het aantal scenario's en wat genomen, gemist of nog open is; "Afsluiting" opent die dag.
- **Afsluiting:**
  - links: "Nog open · sluit af met één tik" en de Scenario's;
  - rechts: de kengetallen (Uitgekomen, Genomen, Gemist), Binnen tegenover buiten plan, en de Les.
- **Log:**
  - links (breder): de filters en de dagen;
  - rechts: de voorspel-score, Binnen tegenover buiten plan van deze maand, en Je dagstart-gevoel.
  - Op een smal scherm staat de samenvatting bovenaan, zoals voorheen.
- **Lege staten** ("Nog geen plan voor vandaag", "Nog geen weekplan", "Nog niets af te sluiten", "Nog geen dagen in je
  log"): één kaartje (`leegKaart`).
  - Maat: 680 px breed, in het midden, op elke tab even hoog.
  - Opbouw: titel, uitleg en knop staan op dezelfde lijnen.
  - Afsluiting kreeg daarvoor een ondertitel in de kop, net als de andere tabs.
- **Dag:** zelf ongewijzigd (alleen de kop staat nu op elke tab zoals op Dag).

## Besluiten

- Besluit: alle tabs op de breedte van Dag (1680), met twee kolommen in plaats van uitrekken — Zaratras wil één breedte;
  ronde 4 hield Week, Afsluiting en Log juist smal om uitrekken te voorkomen, twee kolommen lossen dat anders op —
  als het fout is: op een scherm tussen 1100 en ± 1300 px zijn de kolommen smal; daaronder valt alles terug naar één.
- Besluit: Week krijgt rechts een nieuw blok "Dagen van deze week" naast de charts — de opdracht noemt het als
  voorbeeld, en met alleen de charts rechts bleef die kolom half leeg — als het fout is: één blok meer; het leest alleen
  uit het plan en verandert niets.
- Besluit: de knop "Afsluiting" in "Dagen van deze week" opent die dag in de Afsluiting — de Dag-tab toont alleen
  vandaag, en de Afsluiting is waar je een eerdere dag terugziet en afsluit — als het fout is: één tik naar een andere
  tab.
- Besluit: de lege staat is een kaartje van 680 px in het midden, niet over de hele breedte — een lege kaart van 1650 px
  met drie regels tekst erin oogt leeg; centreren houdt het op alle tabs gelijk — als het fout is: alleen opmaak.
- Besluit: de uitleg in de lege staat heeft een vaste hoogte van 3 regels — anders verschuift de knop met de lengte van de
  tekst, en de opdracht vraagt de knop op dezelfde hoogte — als het fout is: een uitleg van 4 regels (op een smal scherm)
  duwt alleen daar de knop omlaag.
- Besluit: tekstvelden worden niet apart begrensd — in een kolom van ± 800 px (1680 / 2) zijn ze al redelijk breed, en
  een eigen max-breedte per veld zou de kaarten ongelijk vullen — als het fout is: op 2000+ px zijn Levels en Les nog
  ± 800 px breed.
- Besluit: in de Log is de linkerkolom (dagen) breder dan de rechter (1,5 : 1) — de dagen zijn het werk; score en gevoel
  zijn samenvattingen — als het fout is: alleen verhoudingen.
- Besluit: de uitleg van de lege Log zegt "met je voorspel-score ernaast" in plaats van "erboven" — klopt nu met de
  opbouw — als het fout is: alleen tekst (op de telefoon staat hij erboven).

## Release-poort

`node tests/run-release.js --hier` (werkmap): **177/180 groen** in 6,3 min.

| Rood | Oorzaak | Bewijs |
|---|---|---|
| `matrix` 19/21, `analytics-metrics` 15/17, `tendencies` 13/15 | alleen "boot zonder fout" en "geen JS-errors": `net::ERR_TUNNEL_CONNECTION_FAILED` | de journal haalt bij het starten wisselkoersen bij `api.frankfurter.dev` (`FX_URL` in `work/syncjournal.html`); vanuit de container is die host niet bereikbaar (`curl` geeft `000`). In ronde 3 t/m 7 precies zo rood; deze ronde raakt de journal niet. |

- Wisselvallig, tweede poging groen: `privacy-mode` (journal; deze ronde niet geraakt).
- Overgeslagen omdat `tests/_fixtures/` (echte exports, gitignored) ontbreekt: 8 specs geheel of deels.

## Wat niet getest kon worden

- **Breedtes tussen 1100 en 1300 px** met twee kolommen: alleen de randen zijn gemeten (1024 = één kolom, 1600 en 2000 =
  twee kolommen). Op screenshots niet bekeken.
- **Safari en echte telefoons:** alleen Chromium.
- **De knop "Afsluiting" in "Dagen van deze week"** is gebouwd en zichtbaar, maar niet apart doorgeklikt in de spec;
  hij zet alleen de tab en de dag (`afslNaar`).

## Screenshots

`docs/plan-v3-ronde8-screenshots/`: `voor-*` (v1.27.3) en `na-*`, van alle vier de tabs (`week`, `dag`, `afsluiting`,
`log`), elk `gevuld` en `leeg`, in licht en donker, op 1600 en 390 px.

## Concept-CHANGELOG

```markdown
### Gewijzigd
- **Het Trading Plan is op elke tab even breed.** Week, Afsluiting en Log gebruiken nu dezelfde breedte als Dag, en de
  kop verspringt niet meer als je van tab wisselt. Op een breed scherm staan ze in twee kolommen: links de context,
  rechts het werk. Week toont daarbij de dagen van deze week, met een knop naar hun afsluiting.
- **Lege schermen zien er overal hetzelfde uit**: één kaartje met uitleg en een knop, op dezelfde plek.
```
