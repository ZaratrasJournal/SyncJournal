# TradingPlan v3 — ronde 4, rapport (30-10-2026)

Branch `plan-v3-ronde4`, gemaakt vanaf `release-v1.24` (de stand op work). Niets is gereleased: geen versienummer, geen
CHANGELOG, niets naar `site/` of de deploy-repo.

**Aanleiding.** Zaratras (screenshot van v1.24, scenario open, criteria open): "Als je de criteria uitklapt klopt de
opmaak van het scenario niet meer. Je mag daardoor het scherm breder maken, zodat er duidelijkheid en overzicht komt.
Daarnaast moet het mogelijk zijn om per scenario een afbeelding te plaatsen die, als je het scenario opent, goed
zichtbaar is, net als bij de Review-pagina in beeld-modus."

| Wat | Commit | Spec |
|---|---|---|
| Dag breder, nieuwe opbouw van het open scenario, chart per scenario | `plan-v3-ronde4` (eerste commit) | `plan3-scenario-beeld` 38/38 (nieuw, in de release-poort), `plan3-media` 35/35 (aangepast) |
| Dit rapport | tweede commit | release-poort 171/174 |

Alle plan3-, coach- en faq-specs: 26/26 groen.

## De oorzaak van wat Zaratras zag

Niet alleen ruimte. In `critLijst` (ronde 3, punt 8, van mij) stond één `</div>` te veel. Met de criteria **open**
sloot die de linkerkolom van het scenario te vroeg; de rest van de kolom (Stop, TP's, afbeeldingen, trades) viel daardoor
in het raster ernaast, met de gaten en de verschoven "Stop … TP's" uit de screenshot. Dicht klopte het, open niet. De
nieuwe spec vond het: met de criteria open stond de rechterkolom buiten het raster. De tag is weg; de spec bewaakt de
opbouw nu met de criteria open én dicht.

## Wat er veranderde

**Breedte.** Dag gaat tot 1680 px (de kop schuift mee), met de trechter in een kolom van 310 px (was 340). Week,
Afsluiting en Log blijven op 1280.

**Het opengeklapte scenario** (`scenDetail`):
- **Links:** de chart groot bovenaan, daaronder **Plan**: lagen, confirmations (afvinklijst), criteria (ingeklapt zoals
  in ronde 3; uitgeklapt mag hij lang zijn) met "Niet als".
- **Rechts, één sticky kolom** (340–400 px, meeschalend):
  - **Scenario:** trigger en ongeldig als; daarna **Stop, TP's en risico in één blok**; "Klaar om te nemen"; de notitie.
  - **Uitvoering & edge:** statusknoppen, Zet om in trade, Vraag Mori en Bewerk, de gekoppelde trades en de edge-tabel.
  - De kolom is nooit hoger dan het scherm (eigen scroll), anders kan sticky niet houden. Hij blijft naast je staan
    terwijl je links de criteria afvinkt.
- **Smal** (container onder 760 px, ± een venster onder 1100 px, of met het Mori-paneel open op een klein scherm): één
  kolom: chart, scenario, plan, uitvoering & edge. Op 390 px geen horizontale scroll.
- `.ritem` heeft `overflow: clip` in plaats van `hidden`. Met `hidden` werkt sticky niet.

**De chart per scenario** (`scenBeeld`, `beeldLijst`, `lbLijst`):
- Is er minstens één beeld, dan staat bij openen het eerste groot: 16:9, `object-fit: contain`, op een donkere
  achtergrond (token `--stage`, in beide thema's).
- Zijn er meer, dan staat er een strookje miniaturen onder. Tik op een miniatuur en die staat groot.
- Tik op de grote chart en hij gaat schermvullend (de bestaande lightbox). Daar kun je bladeren met de knoppen of met
  ← →, en sluiten met Escape. "Haal weg" werkt daar voor een afbeelding; voor een TradingView-voorbeeld heet het
  "Haal link weg".
- **Een TradingView-snapshotlink telt als beeld**: het voorbeeldplaatje staat in de strip en de lightbox.
- **Zonder beeld:** een rustige plek "Plak of sleep hier een chart (Ctrl+V)". Daar werken plakken (het open scenario is
  het plakdoel), slepen en tikken om te kiezen. De grens blijft 4 per scenario.
- Onder de chart: "+ Afbeelding", het linkveld en de gewone links als chip. `mediaBlok` kreeg daarvoor `zonderBeeld`:
  geen dubbele miniaturen.
- **Dicht** toont de rij een miniatuurtje (64 × 36) van het eerste beeld.

## Besluiten

- Besluit: rechts één sticky kolom met de kern én Uitvoering & edge, in plaats van de kern naast de chart en een aparte
  rechterkolom eronder (het ontwerp) — met de kern naast een chart van 16:9 stond er op 1680 een groot leeg vlak naast
  de kern, en zakte "Uitvoering & edge" onder de chart weg; nu staan Stop, TP's, risico en de status altijd naast wat je
  afvinkt, zonder gaten — als het fout is: de kern staat rechts in plaats van direct naast de chart (op dezelfde hoogte
  wel), één CSS-regel `grid-template-areas` om terug te gaan.
- Besluit: Stop en TP's staan één keer, in het blok "Scenario" bovenaan de sticky kolom, niet ook nog in "Uitvoering &
  edge" — het ontwerp noemde ze in beide; twee keer dezelfde getallen is ruis — als het fout is: geen, ze staan in
  dezelfde kolom direct boven de statusknoppen.
- Besluit: de sticky kolom krijgt `max-height: 100vh − 116 px` met eigen scroll — met de edge-tabel is hij ± 780 px
  hoog; hoger dan het scherm kan sticky niet houden — als het fout is: op een laag scherm scrol je de edge-tabel binnen
  de kolom.
- Besluit: breedte per scenario met een container query (`container-type: inline-size` op `.ritem`), niet per
  schermbreedte — zo klopt het ook met het Mori-paneel open (420 px minder) zonder eigen regel; de regel uit ronde 3
  (`body.mori-open .rdetail` één kolom) is weg — als het fout is: een browser zonder container queries (Safari < 16)
  toont altijd twee kolommen.
- Besluit: rechterkolom `clamp(340px, 34%, 400px)` — bij 290 px viel "Backtest" uit de edge-tabel; de chart is op 1280
  nog ± 540 px breed — als het fout is: op 1280 een iets kleinere chart.
- Besluit: alleen Dag gaat naar 1680; Week, Afsluiting en Log blijven op 1280 — op 1680 werden hun statusknoppen 320
  px breed en hun vlakken leeg (screenshots bekeken), en de opdracht zegt "mogen meeprofiteren, niet verder
  ombouwen" — als het fout is: die drie tabs gebruiken de extra breedte niet.
- Besluit: de achtergrond van de chart is in beide thema's donker (`--stage: #0B0E14`), zoals de opdracht vraagt
  ("donkere achtergrond zoals de Review") — charts zijn bijna altijd donker; op licht thema geeft dat een rustig vlak in
  plaats van witte randen — als het fout is: een donker vlak in het lichte thema.
- Besluit: de gekozen miniatuur onthoudt het plan per scenario in het geheugen (`S.beeldSel`), niet in de opslag — net
  als open/dicht van de criteria — als het fout is: na herladen staat weer de eerste groot.
- Besluit: weghalen gaat via de lightbox ("Haal weg" / "Haal link weg"); de strip heeft geen × — een × op miniaturen
  van 84 × 48 px is te klein om veilig te tikken — als het fout is: één tik extra om weg te halen.
- Besluit: ook de lightbox van de dag en de week bladert nu via `lbLijst`, maar alleen door afbeeldingen (zoals
  voorheen); TradingView-voorbeelden zitten alleen in die van een scenario — buiten het scenario is niets veranderd —
  als het fout is: geen.

## Release-poort

`node tests/run-release.js --hier` (werkmap): **171/174 groen** in 5,7 min.

| Rood | Oorzaak | Bewijs |
|---|---|---|
| `matrix` 19/21, `analytics-metrics` 15/17, `tendencies` 13/15 | alleen "boot zonder fout" en "geen JS-errors": `net::ERR_TUNNEL_CONNECTION_FAILED` | de journal haalt bij het starten wisselkoersen bij `api.frankfurter.dev` (`FX_URL` in `work/syncjournal.html`); vanuit de container is die host niet bereikbaar (`curl` geeft `000`). In ronde 3 en op `t2-specs` precies zo rood. Deze ronde raakt de journal niet. |

Overgeslagen omdat `tests/_fixtures/` (echte exports, gitignored) ontbreekt: 8 specs geheel of deels (`csv-import`,
`hl-echt`, `hl-csv-echt` en delen van de levensloop-specs).

## Wat niet getest kon worden

- **Echte telefoons en Safari**: alleen Chromium (1280, 1680, 1000, 390). Container queries en `overflow: clip` vragen
  Safari 16 of nieuwer.
- **Echte TradingView-snapshots**: de spec speelt het voorbeeldplaatje af met een lokaal PNG'tje; de echte host
  (`s3.tradingview.com`) is vanuit de container niet bereikbaar.
- **Slepen** met een echt bestand uit de verkenner: de spec test plakken en het bestand-kiezen-veld; slepen gebruikt
  dezelfde `.media`-afhandeling als voorheen (`plan3-media`).

## Screenshots

`docs/plan-v3-ronde4-screenshots/`, licht en donker × 1280, 1680 en 390:
- `voor-*`: v1.24.
- `na-*`: deze ronde.
- Per breedte drie varianten: `met` (scenario met twee afbeeldingen en een TradingView-link), `zonder` (de lege
  plek) en `criteria` (met de criteria open, acht criteria en vier keer "Niet als").

## Concept-CHANGELOG

```markdown
### Gewijzigd
- **Een scenario openen geeft overzicht.** Het plan gebruikt op Dag de hele breedte van je scherm. Een open scenario toont
  links je chart groot met daaronder je plan (lagen, confirmations, criteria), en rechts je trigger, stop, TP's, status
  en edge in één kolom die in beeld blijft terwijl je afvinkt.

### Toegevoegd
- **Een chart per scenario, groot in beeld.** Plak, sleep of kies een afbeelding bij een scenario; als je het opent staat
  hij groot, zoals in de beeld-modus van Review. Meer afbeeldingen? Tik een miniatuur aan om te wisselen, tik op de grote
  voor volledig scherm. Een TradingView-snapshotlink telt ook. Dichtgeklapt zie je een klein voorbeeldje.

### Fixed
- **Met de criteria open klopte de opmaak van een scenario niet meer.** Stop en TP's stonden ver uit elkaar en er vielen
  gaten. Opgelost.
```
