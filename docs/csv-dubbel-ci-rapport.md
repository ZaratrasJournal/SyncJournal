# B3 en T1: CSV dubbel en CSV op CI — rapport

*Cloud-routine, 26-10-2026. Branch `csv-dubbel-ci`, vanaf `origin/funded-modus`. Geen versienummer opgehoogd.*

## Kort

- **B3 was een echte fout.** Bij **Blofin, OKX en Hyperliquid** kwam dezelfde positie dubbel in je journal als hij
  via een CSV-import én via de koppeling binnenkwam, in beide volgordes. Daardoor verdubbelde de P&L. Dat is nu
  opgelost, per adapter. **Kraken** had het probleem niet.
- **T1 is gedaan.** Er zijn zeven synthetische exports (zes formaten, MEXC in twee varianten) in
  `tests/fixtures-csv/`, met een spec die altijd draait, ook op CI.

## T1 — CSV-import testen op CI

**Fixtures** (`tests/fixtures-csv/`). Alle getallen zijn verzonnen. Er staan geen account-id's, wallets of namen in.
De kolomnamen en de structuur zijn wel die van de exports, zoals de parsers in `work/syncjournal.html` ze lezen:

| Bestand | Formaat | Wat erin zit |
|---|---|---|
| `blofin-orderhistorie.csv` | Blofin Order History (15 kolommen) | BTC-long met twee TP's, ETH-short, een geannuleerde order (wordt overgeslagen), bedragen met eenheid en duizendtal-komma |
| `okx-positiehistorie.csv` | OKX Position History | 3 posities, waarvan één met de grootte in contracten (de parser rekent die om via P&L ÷ koersverschil), plus funding |
| `kraken-accountlog.csv` | Kraken Futures account-log (22 kolommen, nieuwste eerst) | long met een gedeeltelijke sluiting, short |
| `hyperliquid-fills.csv` | Hyperliquid trade history | long met twee sluitingen, short |
| `mexc-futures-orders.csv` | MEXC futures-orders | openingen (P&L 0, worden overgeslagen) en sluitingen |
| `mexc-posities.csv` | MEXC positiehistorie | long en short |
| `ftmo-metrix.csv` | FTMO MetriX (kolom "Price" komt twee keer voor) | EURUSD-buy, US30-sell, een balance-regel (wordt overgeslagen) |

De repo negeert overal `*.csv`. In deze map heft een eigen `.gitignore` (`!*.csv`) dat op. Zo hoefde de
`.gitignore` in de hoofdmap niet te veranderen.

**Specs**
- **`tests/csv-formaten.spec.js`** — nieuw, 115/115. Per formaat controleert hij het aantal trades, de exchange, de
  status, het pair, de richting, entry/exit, P&L, fees, datum en tijd van de opening (in Europe/Amsterdam),
  hoeveelheid, open- en sluittijd en afbouwstappen. Ook controleert hij dat hetzelfde bestand opnieuw inlezen
  niets toevoegt.
- **`tests/csv-import.spec.js`** gebruikt nog steeds eerst de echte exports in `tests/_fixtures/`. Ontbreken die (CI,
  een schone kloon), dan valt hij terug op de synthetische bestanden. CI slaat hem dus niet meer over (16/16).

Wat de fixtures over de parsers vastleggen (dat is huidig gedrag, geen nieuwe fout):
- MEXC futures-orders levert geen entry. De export heeft alleen de sluitende orders met een P&L.
- MEXC positiehistorie levert geen hoeveelheid in asset, alleen het aantal contracten.

## B3 — telt dezelfde positie dubbel via CSV én API?

**Eerst de test.** `tests/csv-api-dubbel.spec.js` importeert de synthetische CSV. Daarna synct hij dezelfde positie
via een nagebootst API-antwoord. Alleen de netwerkaanroep van de adapter is vervangen: de eigen mapping van elke
adapter loopt gewoon (Blofin `_direct`, OKX `proxyCall`, Hyperliquid `_post`). Daarna doet hij hetzelfde in de
andere volgorde. Vóór de fix: **15/37**.

| Exchange | Eerst CSV, dan sync | Eerst sync, dan CSV |
|---|---|---|
| Blofin | dubbel | dubbel |
| OKX | dubbel | dubbel |
| Hyperliquid | dubbel | dubbel |
| Kraken | niet dubbel: CSV en API bouwen hetzelfde id (`kraken_pos_<contract>_<opening>`) | CSV-import wordt geweigerd zolang Kraken gekoppeld is |

MEXC (koppeling gestopt) en FTMO (alleen CSV) hebben geen API die dubbel kan tellen.

**De fix**, volgens de exchange-isolatieregel:
- **Per adapter** zit er een methode `zelfdePositie(csvRij, apiRij)` in `ExchangeAPI.blofin`, `ExchangeAPI.okx` en
  `ExchangeAPI.hyperliquid`. Die vergelijkt pair, richting, entry en exit (binnen 0,1 %) en hoeveelheid (binnen 2 %),
  en daarna de tijden. Hoe dat gaat verschilt per exchange:
  - **OKX en Hyperliquid:** opening én sluiting moeten op hetzelfde moment liggen (±2 min). De export zegt niet in
    welke tijdzone hij staat. Daarom mag er een heel aantal uren verschil zijn, zolang dat voor de opening en de
    sluiting hetzelfde is (`uurVerschuiving`). De spec controleert ook een OKX-export in UTC (wordt herkend) en een
    sluiting die een uur anders is (geen match).
  - **Blofin:** de CSV kent alleen de ordertijd van de eerste openingsorder, en geen sluittijd. Een limit-order
    kan wachten voordat hij gevuld wordt, dus de API-opening moet 0 tot 12 uur ná de CSV-tijd liggen. Daarvoor
    geeft de Blofin-parser nu `openTime` mee (in UTC-ms). Dat veld zit niet in de vingerafdruk van het CSV-id, dus
    een eerder ingelezen Blofin-CSV houdt bij herimport hetzelfde id.
- **Gedeeld** (`importTjClosed` roept `csvApiSamen` aan): die vraagt het alleen aan een adapter die
  `zelfdePositie` heeft. Er staat geen `if (exchange === …)` in. De gedeelde helpers `bijnaGelijk` en
  `uurVerschuiving` zijn puur en gaan niet uit van een bepaalde exchange. Bij een match:
  - nieuwe API-rij en een bestaande CSV-rij: de API-rij wint. Notities, labels, screenshots, playbook (`setup`),
    rating en de rest van `SJ_USER_FIELDS` gaan mee via `adoptUserFieldsSJ`. De CSV-rij verdwijnt zonder in de
    prullenbak te belanden;
  - nieuwe CSV-rij en een bestaande API-rij: de CSV-rij wordt overgeslagen. In de toast telt hij als "al aanwezig".
- Alleen gesloten rijen worden vergeleken. Een CSV-export bevat nooit een positie die nog loopt.

Na de fix: **39/39**. Daar zitten ook bij: "de andere CSV-trades blijven", "dezelfde CSV opnieuw → 0 nieuw" en per
exchange een positie die er alleen op lijkt (zelfde prijzen en grootte, een dag later geopend), die níet wordt
samengevoegd.

**Wat de fix niet doet**
- Trades die al dubbel in een journal staan, worden niet opgeruimd. Dat zou een migratie vragen. Zoals gevraagd is
  migratie v12 ongemoeid gelaten. In de changelog staat dat je een bestaande dubbele CSV-rij zelf verwijdert.
- Ligt de CSV-rij in de prullenbak, dan houdt dat de API-rij niet tegen. De prullenbak-guard werkt op het bron-id,
  en dat is anders.
- Een Blofin-limit-order die langer dan 12 uur wachtte voordat hij gevuld werd, wordt niet herkend. Dan blijven er
  twee rijen, zoals vóór de fix.
- De marges zijn alleen getoetst op synthetische data. Het is de moeite waard om ze één keer na te lopen met een
  echte export van Denny naast een sync. Daarbij vooral nagaan: is Blofins "Order Time" de plaatsing of de vulling,
  en in welke tijdzone schrijven OKX en Hyperliquid de export?
- Bijwerking: een Blofin-CSV-rij heeft nu een openingstijd. Is Blofin gekoppeld, dan kan `backfillFills` voor zo'n
  rij (als hij jonger is dan 90 dagen) de stappen proberen op te halen. Dat zijn hooguit 8 per sync, en bij geen
  resultaat wordt het een week niet opnieuw geprobeerd.

## Gewijzigde bestanden

- `work/syncjournal.html` — `csvApiSamen` en de helpers bij `importTjClosed`; `zelfdePositie` in de adapters van
  Blofin, OKX en Hyperliquid; `openTime` in de Blofin-CSV-parser.
- `tests/fixtures-csv/` (7 CSV's + `.gitignore`), `tests/csv-formaten.spec.js`, `tests/csv-api-dubbel.spec.js`,
  `tests/csv-import.spec.js` (terugval op de synthetische bestanden).
- `BACKLOG.md` (B3 en T1 afgevinkt, met wat er gedaan is), `CHANGELOG.md` (onder `[Unreleased]` → Fixed: leden merken
  dat er niets meer dubbel komt).

De nieuwe specs staan **niet** in `tests/release-set.js`, zoals gevraagd. Kandidaten om toe te voegen:
`csv-formaten`, `csv-api-dubbel`.

## Testresultaten

Voorbereiding: `npm install`. `npx playwright install chromium` mislukte, omdat de download in deze omgeving
geblokkeerd is. De geïnstalleerde `@playwright/test@1.64.1` past niet bij de browser die al in de container staat
(build 1243). Daarom tijdelijk `npm install --no-save @playwright/test@1.63.0`. `package.json` is niet veranderd.

| Spec | Resultaat |
|---|---|
| `csv-formaten` (nieuw) | 115/115 |
| `csv-api-dubbel` (nieuw) | 39/39 (vóór de fix 15/37) |
| `csv-import` | 16/16 (nu op de synthetische bestanden) |
| `csv-account-keuze` | 40/40 |
| `kraken-csv-api` | 10/10 |
| `koppel-opnieuw` | 8/8 |
| `terugkijken-v12` | 12/12, maar **wisselvallig**: ongeveer 1 op 6 runs rood, **ook op de basis-branch zonder deze wijziging** (6× gedraaid, 1× rood). Vermoedelijk een wedloop tussen opslaan en herladen. Niet aangepast. |

**Release-poort** `node tests/run-release.js --hier`: **137/143 groen**. De zes rode komen niet door deze wijziging:
- `matrix`, `analytics-metrics`, `tendencies`: `ERR_TUNNEL_CONNECTION_FAILED`. Ze laden iets van internet (CDN), en
  dat is hier dicht.
- `kraken-accountlog-sync` (41/43): verwacht Nederlandse tijd (19:12), maar de container draait op UTC (17:12). De
  spec zet geen `timezoneId`. Op de basis-branch is hij net zo rood.
- `tradingplan-v2` (19/20) en `plan-doorloop` (71/72): los gedraaid met deze wijziging allebei groen (20/20 en
  72/72). Ze worden rood onder de belasting van 4 specs tegelijk. `tradingplan-v2` was los gedraaid op de
  basis-branch zelfs rood (19/20).
- Overgeslagen omdat `tests/_fixtures/` ontbreekt (echte data): `okx-levensloop`, `hyperliquid-levensloop`,
  `blofin-levensloop`, `kraken-levensloop` en `scenario-levensloop` (delen), en `hl-echt` (opname van Denny's
  wallet).
- Pas bij een tweede poging groen: `auto-sync`, `terugkijken-v12`, `plan-playbook`.

## Push

`git push -u origin csv-dubbel-ci` werd geweigerd (non-fast-forward). Op `origin/csv-dubbel-ci` stonden al twee
commits van een **andere sessie**, om 07:30 gepusht, dus vóór deze run (07:47): `ba20f04` en `235cb88`. Dat is een
aparte uitwerking van dezelfde opdracht, met onder meer `tests/csv-synthetisch.spec.js`. Die branch is **niet
overschreven**. Deze uitwerking staat op **`csv-dubbel-ci-2`** (ook vanaf `origin/funded-modus`). Kies er één, of
neem de beste delen van beide over. Niet gepusht naar `main`, `work` of een deploy-repo.
