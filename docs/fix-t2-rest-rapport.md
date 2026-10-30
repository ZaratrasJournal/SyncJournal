# Fix T2-rest: rommel-back-up en de datums van de ingebouwde demo

Branch `fix-t2-rest`, vanaf `origin/release-v1.24` (a3b07cf). Gebouwd op 30-10-2026 in een cloud-sessie.
Geen versienummer, CHANGELOG of `site/` aangeraakt.

| Commit | Wat |
|---|---|
| `c47ad6b` | Bug 1: rommel in een back-up biedt nooit "vervangen" aan, en een TypeError is geen controle meer |
| `c55507b` | Bug 2: de ingebouwde demo zet zijn trades op de lokale dag, niet de UTC-dag |

## Bug 1 · Rommel-back-up (T2 #6, `integrity-edge`)

**Wat er al goed was.** Het zichtbare deel uit `docs/plan-t2-specs.md` was al opgelost door B10 (v1.15.1).
`[{foo:'bar'}, 1, 'x', null]` telde niet meer als 1 trade: `importJSON` filterde `trades` met `isTradeLike`,
en `integrity-edge` stond op deze branch al op 14/14, zonder `fixme`'s.

**Oorzaak van wat er nog misging.** Dat filter liep alleen als `trades` een lijst was.

- **`trades` als tekst** (`{"app":"SyncJournal","trades":"x"}`): `looksOldExport('x')` deed `'dir' in 'x'`,
  een TypeError. Die werd gevangen, en de gebruiker zag de algemene foutmelding "kon niet worden
  geïmporteerd". Dat is precies de "gevangen TypeError als controlemechanisme" uit de opdracht.
- **`trades` als object** (`{"trades":{"foo":"bar"}}`): het bestand telde als journal-bestand. Het keuzescherm
  opende, en bevestigen liep vast op `d.trades.filter`.
- **Een SyncJournal-back-up met alleen rommel als trades**: er opende een keuzescherm zonder iets over te nemen,
  omdat `app:'SyncJournal'` alleen al genoeg was.
- **De spec zelf was te ruim**: hij accepteerde "niet worden geïmporteerd" als nette melding. Dat is de tekst van
  het foutpad, dus een TypeError gold als geslaagd.

**Fix** (in `importJSON` en `looksOldExport`):

- `trades` wordt bij binnenkomst één keer genormaliseerd. Er blijft alleen een lijst met trade-achtige regels
  over; is er niets geldigs, dan valt het onderdeel Trades weg. Het keuzescherm toont Trades dan als "niet in dit
  bestand, jouw huidige blijft staan": er is geen "vervangen", niet voorgeselecteerd en niet te bevestigen.
- Een bestand zonder één over te nemen onderdeel krijgt een melding uit de controle zelf: "Geen journal-gegevens
  gevonden in dit bestand. Kies een back-up die je in SyncJournal of TradeJournal met Exporteer backup hebt
  gemaakt; je journal is niet veranderd."
- `looksOldExport` controleert zijn invoer nu zelf (`Array.isArray`, `isTradeLike`). Hij kan dus niet meer
  gooien, ook niet vanuit `seedBundled`.

**Spec** `tests/integrity-edge.spec.js` (stond al in de release-set): van 14 naar 21 checks.

- Er telt alleen nog de echte melding, zonder `ErrorCenter`-regel voor `import`. De algemene foutmelding geldt
  niet meer als geslaagd.
- De melding moet zeggen wat je kunt doen (Exporteer).
- Nieuwe varianten: SyncJournal-back-up met alleen rommel, `trades` als tekst, `trades` als object.
- Eén echte trade tussen rommel telt als 1 trade, in beide bestandsvormen.

Vóór de fix: 15/21, met de TypeError zichtbaar in het log ("Cannot use 'in' operator to search for 'dir' in x").
Erna: 21/21.

## Bug 2 · De ingebouwde demo een dag te vroeg

**Oorzaak.** In `genTrades` (die `SEED` maakt: de compacte demo die `resetDemo` laadt als de volledige dataset niet
bereikbaar is) waren de handelsdagen lokale middernachten, omgezet met `new Date(d).toISOString().slice(0,10)`.
Dat is de UTC-dag. In een Nederlandse browser schoof elke dag één terug: maandag werd zondag en vrijdag werd
donderdag. 14 van de 74 demo-trades vielen op zondag. In een UTC-browser (CI) schuift er niets, en daarom zag de
poort het nooit. Het is hetzelfde patroon als B9.

**Fix.** `ts2date(d)`: de lokale dag, dezelfde helper als `localDateISO`.

**Spec** `tests/demo-offline-datum.spec.js`, nieuw en toegevoegd aan `tests/release-set.js`. Hij laadt de demo via
de echte offline-route van `resetDemo` (`fetchDemoDataset` geeft niets) in een Amsterdamse én een UTC-browser:

- geen trade op zaterdag of zondag (ook niet in `SEED` zelf);
- de datum van elke trade is de Amsterdamse dag van zijn `openTime`.

Vóór de fix: 6/7 (Nederland: 14 zondagtrades, UTC: 0). Erna: 7/7.

**`scripts/gen-syncjournal-dataset-v2.js` gecontroleerd: niet hetzelfde patroon.** Het script rekent overal lokaal
(`dk()`, `getDay()`, `new Date(\`${date}T${time}:00\`)`), dus datum, weekdag en `openTime` zijn het onderling
altijd eens. Weekendtrades zijn daar bewust ("weekend zelden"). Het script gaat er wel van uit dat het in
Nederlandse tijd draait. Op een machine in UTC zouden de tijden, gezien vanuit Amsterdam, 1 à 2 uur verschuiven.
Niet aangepast, want het draait bij een release op Denny's pc; een vaste `TZ=Europe/Amsterdam` in het script kan
als het ooit op CI moet draaien.

## Besluiten

1. **Geen geldige trades in een bestand = geen onderdeel Trades.** Dat geldt ook voor een export met `trades: []`.
   Zo'n bestand kan je journal niet meer leegmaken via "vervangen". Wie echt opnieuw wil beginnen, heeft daar
   Instellingen voor. Bewust, omdat de opdracht zegt: zonder geldige trades geen "vervangen".
2. **`app: 'SyncJournal'` alleen is niet genoeg** om een keuzescherm te openen. Er moet minstens één onderdeel in
   staan om over te nemen; anders volgt de melding.
3. **De controle zit bij het binnenkomen** (`importJSON`), niet verspreid. Ook `looksOldExport` controleert zijn
   invoer, omdat `seedBundled` hem los aanroept.
4. **De demo-datum is de lokale dag van de browser**, net als `localDateISO`. Er is geen vaste Amsterdam-omrekening
   in de generator nodig: tijd en datum komen allebei lokaal, en `loadDemoData` bouwt `openTime` ook lokaal.
5. **Het datasetscript blijft ongewijzigd** (zie hierboven): het is intern consistent en draait in Nederland.

## Release-poort

`TZ=Europe/Amsterdam node tests/run-release.js --hier`: **171/174 groen**.

- **Rood door de container**: `matrix` (19/21), `analytics-metrics` (15/17) en `tendencies` (13/15). Alle drie falen
  alleen op "boot zonder fout" en "geen JS-errors". **Bewijs**:
  - de enige mislukte request bij het laden is `https://api.frankfurter.dev/v1/latest · net::ERR_TUNNEL_CONNECTION_FAILED`
    (de wisselkoers-API; de proxy van deze container laat hem niet door);
  - met `work/syncjournal.html` van `origin/release-v1.24` geven dezelfde drie specs exact dezelfde scores
    (19/21, 15/17, 13/15).
- **Overgeslagen**, omdat de fixtures in `tests/_fixtures` niet in de repo staan: `csv-import`, `hl-echt`,
  `hl-csv-echt`, en delen van `okx-levensloop`, `hyperliquid-levensloop`, `blofin-levensloop`, `kraken-levensloop`
  en `scenario-levensloop`.
- `TZ=Europe/Amsterdam` is nodig omdat de container in UTC draait; `kraken-accountlog-sync` verwacht Amsterdam-tijd.

## Concept-CHANGELOG-blok

```markdown
### Fixed
- **Een kapot of vreemd back-upbestand importeren.** Stond er in een bestand iets dat op een back-up leek maar geen
  trades bevatte, dan kon de journal toch een keuzescherm tonen, of een algemene foutmelding geven. Nu krijg je
  een duidelijke melding ("Geen journal-gegevens gevonden… kies een back-up die je met Exporteer backup hebt
  gemaakt"), en een bestand zonder geldige trades biedt nooit meer aan je trades te vervangen. Je journal blijft
  in alle gevallen zoals hij was.
- **Voorbeelddata op de juiste dag.** Laadde je de voorbeelddata terwijl de volledige dataset niet bereikbaar was,
  dan stonden de trades een dag te vroeg, waardoor er trades op zondag in je kalender stonden. Ze staan nu op
  de juiste werkdag.
```
