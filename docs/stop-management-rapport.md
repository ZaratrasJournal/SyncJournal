# Stop-management: F5, F7 en F9, rapport

Branch `stop-management`, vanaf `origin/funded-modus` (6cb1f28). Gebouwd op 26-10-2026 in een cloud-sessie.
Geen versienummer opgehoogd; changelog staat onder `## [Unreleased]`.

| Commit | Wat |
|---|---|
| `7c048de` | F5: stopbeweging en exit-reden vastleggen en tonen |
| `bfff19f` | F9: stop van de exchange zelf aanpassen, en terug |
| `24f3104` | F7: Analytics-paneel "Stop-management en uitvoering" |

## F5 · Stopbeweging en exit-reden

**Wat het doet.** Bij Kraken-, Hyperliquid- en OKX-trades toont het trade-detail **Stop later**
(naar break-even / strakker / verder weg ⚠ / niet verzet) en **Gesloten via** (stop-loss / take-profit /
met de hand / liquidatie). Het formulier zegt bij de stop "van Kraken Futures, later naar break-even"
in plaats van alleen "later verschoven".

**Hoe.** Er komen geen nieuwe API-verzoeken bij. Alles komt uit wat de adapters al hadden:

- **Adapter (exchange-specifiek)** schrijft `stopLaatst`, de laatste stop vóór de sluiting.
  - Kraken: `_stopVoorLevensloop` volgde de stop-order al (`nu`) en geeft die nu terug als `laatst`.
  - Hyperliquid en OKX: is de stop verschoven, dan de laatste uit `stopVerloop`, anders de stop zelf.
- **Gedeeld en puur** (geen `if (exchange === …)`):
  - `stopBewegingVan(dir, entry, stop, laatst)`: `geen`, `be` (binnen 0,1% van de entry), `strakker`
    (ook trailing voorbij de entry), of `ruimer`.
  - `stopBewegingOf(t)`.
  - `exitRedenOf(t)`: de soort van de laatste afbouwstap op tijd (die zetten alle drie de adapters al),
    en anders het laatste geraakte TP-niveau.

**Afwijking van backlog F5.** `stopBeweging` en `exitReden` worden niet als velden opgeslagen maar bij
het tonen afgeleid. Alleen `stopLaatst` wordt opgeslagen. Zo kunnen ze niet uit de pas lopen met `stop`
of de stappen, bijvoorbeeld na een F9-override.

**Beperking.** Oudere trades krijgen `stopLaatst` pas bij de volgende sync die ze dekt. Tot die tijd blijft
"later verschoven" staan en tellen ze in F7 alleen mee met hun exit-reden. De Kraken-fixturetest uit het
backlog-plan (positie 3 → stop, positie 4 → hand) is niet gedraaid: die fixture staat niet in deze kloon.

## F9 · Stop zelf aanpassen

**Wat het doet.** Naast een vergrendelde stop van de exchange staat de knop **Zelf aanpassen**. Een klik:

- zet `stopBron: 'gebruiker'`;
- bewaart de waarde van de exchange in `stopExchange: {bron, stop}`;
- maakt het veld vrij. Alleen het stop-veld wordt opnieuw getekend, de rest van wat je typte blijft staan.

Het label wordt "zelf aangepast · Kraken Futures: 82.235", met de knop **Terug naar Kraken Futures**.
Terugzetten herstelt de stop van de exchange en vergrendelt het veld weer.

**De sync-regel.** Elke adapter (Kraken, Hyperliquid, OKX) kreeg dezelfde uitzondering:

- staat er een override (`stopZelfAangepast(o)`), dan blijft de stop staan en wordt alleen `stopExchange.stop`
  bijgewerkt. "Terug naar" geeft dus wat de exchange nú zegt;
- een stop die je zonder override intypt, wordt nog steeds door die van de exchange vervangen, zoals voorheen.
  De bestaande stoploss-specs bewaken dat.

## F7 · Analytics: Stop-management en uitvoering

**Wat het doet.** Een nieuw paneel in Analytics met twee tabellen:

- **Stop later:** naar break-even / strakker / verder weg ⚠ / niet verzet.
- **Gesloten via:** stop-loss / take-profit / met de hand / liquidatie.

Per rij staan het aantal trades, de gem. R (`gemR`, dus geen stop = geen R, nooit `t.r`) en de netto P&L.
Erboven staat "5 van 6 trades hebben een stopgeschiedenis", met onder de 10 trades "te weinig trades voor
een conclusie". Bij trades met de stop verder weg staat een waarschuwing. Het paneel zegt ook dat we zonder
koersdata niet weten wat er zónder verzetten was gebeurd.

**Filters.** Het paneel krijgt `CLOSED`, dus de filterbalk én Eigen / Funded / Alles uit de funded-branch
gelden vanzelf. De test controleert beide.

**Lege staten** via `emptyState`:

- `stop-leeg`: nog nooit een trade met stopgeschiedenis;
- `stop-niets`: die zijn er wel, maar niet in dit filter.

Laat het filter helemaal geen gesloten trades over, dan toont Analytics zijn eigen lege staat.

**Niet gebouwd uit backlog F7** (de opdracht noemde ze niet): het blok "verliezen in R / aandeel slechter dan
−1,1R", "stop verder weg als fout voorstellen" en "gepland tegenover gehaald". Ook de demo-eerst-stap
(`/prototype`) is overgeslagen. Licht en donker zijn wel gecontroleerd via screenshots in
`tests/screenshots/stop-analytics/`.

## Tests

Nieuwe specs, alle drie eerst rood gezien en daarna groen. Ze staan nog niet in `tests/release-set.js`.

| Spec | Uitkomst |
|---|---|
| `tests/stop-beweging.spec.js` (F5) | 19/19 |
| `tests/stop-override.spec.js` (F9) | 13/13 |
| `tests/stop-analytics.spec.js` (F7) | 16/16 |

Bestaande specs die meedraaiden:

| Spec | Uitkomst |
|---|---|
| `kraken-stoploss` | 61/61 |
| `hl-stoploss` | 38/38 |
| `okx-stoploss` | 31/31 (deel "Denny's opname" overgeslagen: `tests/_fixtures/okx-algos.json` en de export ontbreken) |
| `funded-dashboard` | 14/14 |
| `lege-staten` | 134/134 |
| `theme-hook` | 26/26 |
| `e2e-doorloop`, `handmatig-formulier`, `sluiten-behoudt-invoer`, `valuta-formulier`, `r-zonder-stop` | groen |

**Release-poort** (`TZ=Europe/Amsterdam node tests/run-release.js --hier`): **140/143**.

- `matrix`, `analytics-metrics` en `tendencies` falen alleen op "boot zonder fout" en "geen JS-errors". De proxy
  van de cloud-container blokkeert het xlsx-script van jsdelivr (`ERR_TUNNEL_CONNECTION_FAILED`). Op main was
  dat ook zo; de rest van die specs is groen.
- `okx-partial-herstel` was pas groen bij de herkansing. Dat is een bekende timing-flake, ook op main
  (1 op 12 los).
- Overgeslagen omdat fixtures in `tests/_fixtures` ontbreken: `csv-import`, `hl-echt`, en delen van
  `okx-levensloop`, `hyperliquid-levensloop`, `blofin-levensloop`, `kraken-levensloop` en `scenario-levensloop`.
- `TZ=Europe/Amsterdam` is nodig in deze container: `kraken-accountlog-sync` verwacht Amsterdam-tijd.

## Open punten

- `stop-beweging`, `stop-override` en `stop-analytics` in `tests/release-set.js` zetten.
- De niet-gebouwde F7-blokken (zie hierboven), als je ze wilt.
- Een F9-override blijft per trade staan tot je terugzet. Er is (nog) geen overzicht van alle trades met een
  zelf aangepaste stop.
