# B3 + T1 · CSV dubbel met de API, en CSV-import op CI

*Branch `csv-dubbel-ci`, vanaf `origin/funded-modus`, 26-10-2026.*

## Kort

- **B3 was een echte fout.** Bij **Blofin, OKX en Hyperliquid** kwam dezelfde positie twee keer binnen als hij via
  een CSV-import én via de API-sync kwam, in beide volgordes. Je P&L telde hem dubbel, zonder melding. Opgelost
  per exchange in de adapter.
- **Kraken was niet dubbel**: CSV en API geven daar hetzelfde id (`kraken_pos_<contract>_<opening>`), en met een
  koppeling weigert de app de Kraken-CSV. Al bewaakt door `tests/kraken-csv-api.spec.js` (10/10).
- **MEXC en FTMO** kunnen niet overlappen: MEXC synct niet meer, FTMO heeft geen API.
- **T1:** zeven synthetische exports (zes exchanges, MEXC in twee vormen) in `tests/fixtures-csv/`, met een spec die
  altijd draait, ook op CI.

## Waarom het dubbel was

`sjImportCsvText` geeft elke CSV-rij een id uit de inhoud: `<exchange>_csv_<pair|richting|datum|tijd|…>`. De
adapter geeft dezelfde positie een eigen id (Blofin `blofin_<positionId>_<createTime>`, OKX `okx_<posId>_<cTime>`,
Hyperliquid `hyperliquid_<eerste fill>`). `importTjClosed` ontdubbelt alleen op dat id, dus zag hij twee trades.
Hyperliquid deelt zelfs de reconstructie (`_reconstructTrades`), maar het voorvoegsel verschilt, en de CSV-import
vervangt het id daarna nog door de vingerafdruk.

## De fix

| Waar | Wat |
|---|---|
| `ExchangeAPI.blofin.zelfdePositie` | opening binnen 2 minuten. De orderhistorie is UTC en de parser zet hem om, dus het moment klopt. |
| `ExchangeAPI.okx.zelfdePositie`, `ExchangeAPI.hyperliquid.zelfdePositie` | de exporttijd is die van het scherm van de exporteur en de parser leest hem als lokale tijd. De zone is onbekend, dus open én sluiting mogen met **hetzelfde hele kwartier** verschoven zijn, hooguit 14 uur. |
| `zelfdeRondgang(csv, api, o)` (gedeeld, geen exchange-aannames) | zelfde pair en richting, instap- en uitstapprijs binnen 0,1%, grootte binnen 2%, en het moment zoals de adapter het vraagt. Zonder bekend moment geen match: liever een dubbele rij dan een echte trade kwijt. |
| `csvOpgaanInApi(exId)` (dispatcher, roept alleen `ExchangeAPI[exId].zelfdePositie` aan) | na elke sync (vóór de partial-detectie) en na elke CSV-import. De API-rij wint; je invoer van de CSV-rij gaat mee (lijsten zoals tags en screenshots samengevoegd, twee verschillende notities blijven allebei staan); de CSV-rij verdwijnt, **niet** naar de prullenbak. Ligt de API-rij in de prullenbak, dan verdwijnt de CSV-rij ook (verwijderd blijft verwijderd). |
| `sjImportCsvText` | telt de samengevoegde rijen niet als nieuw, en de melding zegt "N stonden er al via je koppeling". |

Er zit geen `if (exchange === …)` in een gedeelde helper. Adapters zonder `zelfdePositie` (Kraken, MEXC) slaan
de stap over.

**Bestaande dubbelen** gaan bij de eerstvolgende sync van die exchange samen: `csvOpgaanInApi` kijkt naar alle
CSV-rijen van de exchange, niet alleen naar wat net binnenkwam.

**Migratie v12** slaat koppelingen met recente CSV-trades over vanwege B3. Die uitzondering is blijven staan
(hij heeft bij leden al gedraaid); er staat nu een regel bij dat B3 opgelost is. In `BACKLOG.md` staan B3 en T1
als gedaan.

### Wat de vergelijking bewust niet doet

- Een positie met **precies dezelfde** pair, richting, instap, uitstap en grootte, waarvan open én sluiting
  precies een heel aantal kwartieren (tot 14 uur) later liggen, wordt bij OKX en Hyperliquid als dezelfde gezien.
  Dat kan in theorie, maar het vraagt dat vier getallen en twee tijdstippen samen kloppen. Bij Blofin speelt het
  niet: daar moet de opening binnen 2 minuten liggen.
- Een open of deels gesloten API-rij wordt niet samengevoegd: de CSV-parsers leveren alleen gesloten posities.

## Tests

Eerst geschreven en rood gezien, daarna gebouwd.

| Spec | Uitkomst | Wat |
|---|---|---|
| `tests/csv-synthetisch.spec.js` (nieuw, T1) | **39/39** | per formaat herkend als het juiste formaat, exacte cijfers (pair, richting, datum, tijd, instap, uitstap, grootte, netto P&L), rijen die geen trade zijn vallen weg, dubbel inlezen geeft niets. Draait in Europe/Amsterdam. |
| `tests/csv-api-dubbel.spec.js` (nieuw, B3) | **47/47** (vóór de fix 25/41) | per exchange: A eerst CSV dan sync, B eerst sync dan CSV, C CSV in een andere tijdzone (+6 en −2 uur), D een andere positie een dag later blijft apart, E een weggegooide API-rij komt niet terug via de CSV; plus grensgevallen van de vergelijking. De API is nagebootst op de laag waar de adapter praat (Blofin `_direct`, OKX `proxyCall`, Hyperliquid `_post`), zodat de echte adapter de respons verwerkt. |
| `csv-account-keuze` | 40/40 | |
| `kraken-csv-api` | 10/10 | |
| `koppel-opnieuw` | 8/8 | |
| `terugkijken-v12` | wankel, **ook zonder deze wijziging** | soms leest hij na het herladen een lege lijst koppelingen (crash op `apiKey`) of mist hij "eenmalig: blijft staan". Op de basis 9/10 groen, met de fix 7/10 bij 10 runs. Mijn code draait pas na een geslaagde fetch, niet tijdens het laden, dus ik houd het voor de wedloop tussen seeden en herladen in de spec. Niet afgezwakt. |
| `csv-import` | overgeslagen | heeft de echte exports in `tests/_fixtures/` nodig (niet in deze kloon) |
| `blofin-levensloop`, `okx-levensloop`, `hyperliquid-levensloop` | 14/14, 13/13, 3/3 | delen met echte snapshots overgeslagen (`tests/_fixtures/`) |
| `exchange-sync`, `exchange-sync2`, `trash` | 14/14, 13/13, 31/31 | |

De nieuwe specs staan **niet** in `tests/release-set.js`: `csv-synthetisch` en `csv-api-dubbel` kunnen erbij.

### Release-poort (`node tests/run-release.js --hier`)

**139/143 groen.** De vier rode horen niet bij deze branch:

- `analytics-metrics`, `matrix`, `tendencies`: alleen "boot zonder fout", omdat deze cloud-container het CDN niet
  bereikt (`ERR_TUNNEL_CONNECTION_FAILED`). Lokaal of op CI met internet geen punt.
- `kraken-accountlog-sync` (41/43): twee checks over een short van 14-10. Faalt precies zo op `origin/main`
  (gecontroleerd op 25-10 in een losse worktree).

`terugkijken-v12` was in deze poort-run groen (zie hierboven: hij is wankel, ook zonder deze wijziging).

Voorbereiding op deze machine: `npm install` (voor `@axe-core/playwright`), met `playwright` en `playwright-core`
als koppeling naar de voorgeïnstalleerde versie. Een tweede Playwright vindt de voorgeïnstalleerde browser niet.

## Over de synthetische exports

- Verzonnen bedragen, tijden en ids. Geen e-mail, wallet of lang account-id; de spec controleert dat.
- De kolommen zijn die waarop de parser herkent en leest. **OKX** is de zwakste: de parser zelf zegt dat hij tegen
  verwachte kolomnamen uit de documentatie is gebouwd, niet tegen een echte export. Een echte OKX-export
  vergelijken is een goed volgend stapje.
- `*.csv` staat in `.gitignore`; de bestanden zijn met `git add -f` toegevoegd. Wijzig je er een, dan volgt git
  hem gewoon (een gevolgd bestand wordt niet genegeerd).

## Bestanden

- `work/syncjournal.html`: `csvMoment`, `zelfdeRondgang`, `neemInvoerMee`, `csvOpgaanInApi`, de drie
  `zelfdePositie`-methodes, de aanroep in `syncExchange` en `sjImportCsvText`, een regel bij migratie v12.
- `tests/fixtures-csv/*.csv` (7), `tests/csv-synthetisch.spec.js`, `tests/csv-api-dubbel.spec.js`.
- `BACKLOG.md` (B3, T1), `CHANGELOG.md` (onder Unreleased → Fixed).
