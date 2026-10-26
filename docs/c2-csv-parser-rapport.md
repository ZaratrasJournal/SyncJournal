# C2 + C4 · CSV-parser per exchange, en XLSX eruit — release-kandidaat v1.18.6

*Branch `c2-csv-parser`, vanaf `origin/main` (v1.18.5), 26-10-2026. Niet naar main, work, live of deploy.*

## Kort

- **C2:** het herkennen en omzetten van CSV-exports zit nu per exchange in de adapter. `parseExchangeCsvText`
  is een lus van tien regels; de twee negatie-kettingen zijn weg. De uitkomst is voor elke export byte-voor-byte
  gelijk gebleven (snapshot-spec, 62/62, na elke stap).
- **C4:** het externe script `xlsx@0.18.5` van cdn.jsdelivr.net is weg; de app laadt geen enkel `<script src>` meer.
  Een `.xlsx` of `.xls` importeert niets en zegt hoe het wel kan. Een MEXC-export als CSV werkt zoals altijd.
- **Release-poort:** 159/164 groen. De vijf rode zijn verklaard: drie door een geblokkeerde host in de cloud
  (niet meer jsdelivr, nu `api.frankfurter.dev`), één door de tijdzone van de container, één bekende flake.
  Zie onderaan.

## C2 · De nieuwe opbouw

### Per adapter

| Adapter | `herkentCsv(csv)` | `parseCsv(csv, bron)` |
|---|---|---|
| `ExchangeAPI.blofin` | kolommen `Underlying Asset`, `Avg Fill`, `PNL` | orderhistorie → posities via FIFO (zoals voorheen) |
| `ExchangeAPI.kraken` | account-log (`uid`/`realized pnl`/`trade price`, of geplakte JSON met `booking_uid`) | `csvBlokkade`, dan `levenslopenUitAccountLog` (dezelfde functie als de sync); `_waarschuwingen` gaat mee |
| `ExchangeAPI.mexc` | positiehistorie **of** futures-historie (hulpjes `_csvPosities`, `_csvFutures`) | kiest zelf welke van de twee; positiehistorie gaat voor, zoals voorheen |
| `ExchangeAPI.hyperliquid` | eerste kolom `time` + `coin`, `closedPnl`, `dir`, `ntl` | fills → `_reconstructTrades` (dezelfde als de API) |
| `ExchangeAPI.ftmo` | eerste kolom `Ticket` + `Pips`, `Volume`, `Swap` | MetriX, positioneel (kolom `Price` staat twee keer) |
| `ExchangeAPI.okx` | instrument-kolom of `-SWAP` in de eerste vijf rijen + PnL- + prijs-kolom; **`csvRuim: true`** | positiehistorie met de flexibele kolom-zoeker |

De code van elke tak is ongewijzigd verhuisd; alleen de lus (`csv.rijen` in plaats van `lines[i]`), `csv.headers`
en `source: bron` in plaats van `forExchange || "<exchange>"` zijn anders.

### Wat gedeeld bleef

- `csvRegel(line)` — één CSV-regel naar velden (met aanhalingstekens), voorheen `parseCSVLine` binnen de functie.
- `parseExchangeCsvText(text, forExchange)` — tekst naar `{headers, rijen}`, "Leeg bestand" bij minder dan twee
  regels, dan de adapters langs. Wie losjes herkent (`csvRuim`, nu alleen OKX) komt na de strikte. `bron` is het
  gekozen account, anders de id van de adapter.
- `csvAlgemeen(csv, bron)` — de algemene CSV (kolommen op naam) als niemand het bestand herkent. Geen exchange-aannames.
- Ongewijzigd: `sjImportCsvText`, `csvHerken`, de pop-up (`csvKeuze` …), `csvOpgaanInApi`, opslaan en de melding.

Er staat geen `if (exchange === …)` in gedeelde code. Een zevende exchange met CSV voegt `herkentCsv` en `parseCsv`
toe aan zijn adapter, verder niets. Een exchange zonder CSV laat beide weg (of `herkentCsv: () => false`); de lus
slaat adapters zonder `herkentCsv` over.

### De ene bewuste vereenvoudiging

Vroeger konden in theorie twee takken tegelijk een bestand pakken (bv. Blofin én Hyperliquid, als één bestand de
kolommen van allebei had); hun trades kwamen dan samen terug. Nu wint de eerste adapter die het bestand herkent.
Geen echte export heeft de kolommen van twee formaten, en de snapshot (alle exports + randgevallen) is gelijk.

## Bewijs dat de uitkomst gelijk bleef

`tests/csv-parser-gelijk.spec.js` + `tests/fixtures/csv-parser-gelijk.json`. De snapshot is vastgelegd met de code
van v1.18.5, **vóór** de eerste wijziging (eigen commit), en daarna na elke stap vergeleken:

- per export: `parseExchangeCsvText` zonder account en met een handmatig account (alle velden, id's, TP-niveaus,
  `_waarschuwingen`, foutmelding), `csvHerken`, en een echte import (`srcId`, exchange, pair, richting, datum, tijd,
  instap, uitstap, P&L, fees, grootte, status);
- klok en `Math.random` liggen vast, zodat ook de random id's (Blofin, MEXC, OKX) en TP-id's vergelijkbaar zijn;
- exports: de zeven uit `tests/fixtures-csv/`, plus acht randgevallen (leeg bestand, alleen een kop, algemene CSV
  met en zonder symbool-kolom, Blofin met een wees-sluiting, een omkering en een geannuleerde order, OKX zonder
  instrument-kolom maar met `-SWAP` in de data, Hyperliquid met een te korte rij, FTMO met een balansregel en
  JPY-/index-symbolen). `tests/_fixtures-exports/` en `tests/_fixtures/` bestaan niet in deze kloon: overgeslagen,
  de spec neemt ze mee als ze er lokaal wel zijn.

| Stap (commit) | csv-parser-gelijk | csv-synthetisch | csv-api-dubbel | csv-account-keuze | hl-csv-zonder-nul | kraken-csv-api | csv-stop-melding |
|---|---|---|---|---|---|---|---|
| vóór (snapshot) | 62/62 | 39/39 | 47/47 | 40/40 | 15/15 | 10/10 | 12/12 |
| gedeelde lus + Blofin | 62/62 | 39/39 | 47/47 | 40/40 | 15/15 | 10/10 | 12/12 |
| Kraken | 62/62 | 39/39 | 47/47 | 40/40 | 15/15 | 10/10 | 12/12 |
| MEXC | 62/62 | 39/39 | 47/47 | 40/40 | 15/15 | 10/10 | 12/12 |
| Hyperliquid | 62/62 | 39/39 | 47/47 | 40/40 | 15/15 | 10/10 | 12/12 |
| FTMO | 62/62 | 39/39 | 47/47 | 40/40 | 15/15 | 10/10 | 12/12 |
| OKX + algemene CSV | 62/62 | 39/39 | 47/47 | 40/40 | 15/15 | 10/10 | 12/12 |

`csv-import` en `hl-csv-echt` slaan zich over (geen echte exports in de kloon).

## C4 · Wat er met XLSX verdween

- Het `<script defer src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/…">` (met integrity-hash en commentaar) bovenin.
- De XLSX-tak in `handleCsvFile` (`readAsArrayBuffer`, `XLSX.read`, `sheet_to_csv`) en de foutmelding "XLSX-bibliotheek
  niet geladen".
- `accept=".csv,.xlsx,.xls"` → `accept=".csv"`; "Trade-history importeren (CSV / XLSX)" → "(CSV)".

Wat ervoor in de plaats kwam: kiest iemand toch een `.xlsx`/`.xls` (via "alle bestanden"), dan opent de bestaande
"niet herkend"-pop-up in een eigen toestand (`data-csvk="excel"`): **"Dit is een Excel-bestand"**, de bestandsnaam,
en *"Dit is een Excel-bestand. Open het in Excel of Google Sheets en kies Opslaan als → CSV, en lees dat bestand hier
in. Er is niets geïmporteerd."* Geen accountkeuze, geen import.

FAQ "Hoe importeer ik een CSV-bestand?": stap 1 zegt nu "als CSV", met de tip dat een Excel-bestand (zoals MEXC vaak
geeft) eerst via **Opslaan als → CSV** moet. CHANGELOG v1.18.6 onder *Gewijzigd*.

Verwijzingen elders: `site/_headers` noemt jsdelivr niet (niets te doen). Bijgewerkt in `docs/`:
`research-funded-modus-2026-10-24.md` (de XLSX-route bestaat niet meer), `wachtpost-ontwerp-2026-09-27.md` (geen
extern script meer), `test-checklist.md` (MEXC-export eerst als CSV). Historische rapporten zijn gebleven zoals ze waren.
`docs/csp.md` (branch f14-beta) is niet aangeraakt; zodra die samenkomt kan `cdn.jsdelivr.net` uit een `script-src`.

## Tests

| Spec | Uitkomst | Wat |
|---|---|---|
| `tests/csv-parser-gelijk.spec.js` (nieuw, C2) | 62/62 | zie boven |
| `tests/csv-geen-excel.spec.js` (nieuw, C4) | **16/16** (eerst 7/16 rood gezien) | geen `<script src>`, niets opgevraagd bij jsdelivr, `XLSX` bestaat niet; veld accepteert alleen `.csv` en noemt geen XLSX; een `.xlsx` en een `.XLS` (via het echte bestandsveld) geven de melding met bestandsnaam en importeren niets; een MEXC-export als CSV wordt herkend en geeft 2 trades; FAQ zonder "CSV of XLSX", met de MEXC/Excel-tip; geen JS-fouten |
| `smoke` | 10/10 | |

Beide nieuwe specs staan in `tests/release-set.js`.

## Release-poort (`node tests/run-release.js --hier`, cloud)

**159/164 groen**, 5,0 min. Rood:

- `matrix` (19/21), `analytics-metrics` (15/17), `tendencies` (13/15): alleen "boot zonder fout" / "geen JS-errors".
  **Niet meer door jsdelivr** — dat verzoek bestaat niet meer. Wat overblijft is `api.frankfurter.dev` (de
  ECB-koers voor het euro-saldo), die de proxy van de cloud-container ook blokkeert (`ERR_TUNNEL_CONNECTION_FAILED`;
  op main faalden beide hosts). Met alleen die ene host nagebootst: **21/21, 17/17, 15/15**. Lokaal bij Denny, met
  internet, horen ze groen te zijn.
- `kraken-accountlog-sync` (41/43): de tijdzone van de container (UTC); met `TZ=Europe/Amsterdam` **43/43**. Al rood op
  main (zie het v1.18.5-rapport).
- `plan-doorloop` (70/72): los opnieuw gedraaid **72/72**; bekend als timing-gevoelig (v1.18-rapport).

Overgeslagen door ontbrekende fixtures (bekend): `csv-import`, `hl-echt`, `hl-csv-echt` en delen van de
levensloop-specs.

## Wat er nog moet gebeuren (Denny)

Lezen en akkoord geven. Daarna samenvoegen naar `main`, `site/` naar de deploy-repo, en work en live. Dat gebeurt
alleen op jouw expliciete woord. Let op: `BACKLOG.md` is ook op branch `opruimen-backlog` gewijzigd; hier zijn alleen
C2 en C4 weggehaald, dus bij samenvoegen kan daar een kleine conflict zitten.
