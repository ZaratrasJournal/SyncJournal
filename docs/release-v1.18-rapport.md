# Release-kandidaat v1.18 — rapport (26-10-2026)

Branch `release-v1.18`, gemaakt vanaf `origin/main` (`8b0ac89`, Release v1.17.2). Samengesteld en getest
door een cloud-routine, zonder iemand die meekeek. **Niet** naar `main`, `work` of de deploy-repo gepusht.

## Wat er is samengevoegd

In deze volgorde, elk met `--no-ff`:

| Branch | Merge-commit | Inhoud |
|---|---|---|
| `funded-modus` | `08a41c7` | Funded modus (Instellingen → Funded), funded geld telt niet als eigen geld, CSV-import vraagt bij welk account het bestand hoort, Funded-kaart op het Dashboard, Eigen/Funded/Alles in Analytics |
| `f2-discord-meerdere` | `0250a52` | Kopieer voor Discord met meerdere trades; privacy-modus geldt ook voor Mori en het coach-pakket |
| `w2-ruwe-data` | `12fa690` | Dev-modus (`?dev=1`) terug, ruwe exchange-antwoorden downloaden per exchange (backlog W2) |
| `stop-management` | `268b580` | Stopbeweging en sluitreden (F5), stop zelf aanpassen (F9), Analytics-paneel stop-management (F7). Gebouwd op `funded-modus`, dus die commits zaten er al in |
| `archief-docs` | `2d7cb63` | Research en demo's van zijbranches gearchiveerd in `docs/`, Zaratras in documenten |

Daarna de release-commit `e567b77` (*Release v1.18: funded mode, CSV account pop-up, stop management, Discord copy
for several trades, raw data in dev mode*).

## Botsingen

**Geen.** Alle vijf merges gingen zonder conflict door git heen. Er stonden daarna ook nergens
conflictmarkeringen (`<<<<<<<` / `>>>>>>>`) in `CHANGELOG.md`, `work/syncjournal.html` of `tests/release-set.js`.

Wel bleef de CHANGELOG met **twee** `## [Unreleased]`-blokken achter (één van `f2-discord-meerdere`, één van
`funded-modus` + `stop-management`). Die zijn samengevoegd tot één blok `## [v1.18] — 2026-10-26`:

- **Toegevoegd**, **Gewijzigd** en **Fixed** staan er elk één keer; alle regels van beide blokken zijn behouden.
- `w2-ruwe-data` had geen changelog-regel. Omdat de release-titel het noemt, staat er nu één regel onder
  Toegevoegd ("Ruwe gegevens bij een probleem (dev-modus)"), met de verwijzing om het bestand alleen aan Zaratras te sturen.
- Een `---` vóór en na het blok. Niets aan v1.17.2 of eerder veranderd.

## Versie en bestanden

- `work/syncjournal.html`: `const APP_VERSION='v1.17.2';` → `'v1.18'` (gezocht op inhoud, regel 2222).
- `site/version.json`: `{"version":"v1.18","released":"2026-10-26"}`.
- `site/app.html` = kopie van `work/syncjournal.html` (byte-gelijk gecontroleerd).
- `site/demo-dataset.json` ververst met `node scripts/gen-syncjournal-dataset-v2.js`.
- `tests/release-set.js`: elf specs achteraan toegevoegd, met comment: `funded-geld`, `funded-tab`,
  `funded-import`, `funded-dashboard`, `csv-account-keuze`, `discord-meerdere`, `ruwe-data`,
  `ruwe-data-voorbeeld`, en uit `docs/stop-management-rapport.md`: `stop-beweging`, `stop-override`,
  `stop-analytics`. Met node gecontroleerd: 155 namen, geen dubbele, elk `tests/<naam>.spec.js` bestaat.

## De release-poort

`TZ=Europe/Amsterdam node tests/run-release.js --hier` (de TZ is in deze container nodig voor
`kraken-accountlog-sync`, zie het stop-management-rapport). Twee keer gedraaid:

| Ronde | Groen | Rood |
|---|---|---|
| 1 | **150/154** | `matrix`, `analytics-metrics`, `tendencies` (netwerk), `ruwe-data` (zie onder) |
| 2 (na de release-commit) | **150/154** | `matrix`, `analytics-metrics`, `tendencies` (netwerk), `plan-doorloop` (zie onder) |

Alle elf nieuwe specs waren in beide rondes groen, op `ruwe-data` in ronde 1 na.

### Rood door het netwerk (niet afgezwakt)

- `matrix` (19/21), `analytics-metrics` (15/17), `tendencies` (13/15): alleen "boot zonder fout" en "geen
  JS-errors" falen, met `net::ERR_TUNNEL_CONNECTION_FAILED`. De app laadt `xlsx.full.min.js` van
  `cdn.jsdelivr.net` en de proxy van de cloud-container blokkeert dat. Op `main` is dat hier net zo; de rest
  van die specs is groen.

### Overgeslagen (fixtures in `tests/_fixtures` ontbreken in deze kloon)

- Helemaal: `csv-import`, `hl-echt`.
- Gedeeltelijk (de rest groen): `okx-levensloop` (3 delen), `hyperliquid-levensloop` (3), `kraken-levensloop` (2),
  `blofin-levensloop` (1), `scenario-levensloop` (1).

### Pas groen bij de herkansing

Ronde 1: `okx-partial-herstel` (bekende timing-flake, ook op main), `plan-doorloop`.
Ronde 2: `auto-sync`, `export-sleutels`, `tradingplan-v2`.

### `ruwe-data` en `plan-doorloop`: wisselend rood, en waarom (geen fix)

Beide falen niet elke keer. Wat ik vond:

- **`ruwe-data`** faalde in ronde 1 op "na herladen: knoppen uit, 'nog niets' per exchange" (het paneel zei
  "Geen gekoppelde exchange"). Los gedraaid: 3 van 6 keer rood op de release-branch, en **1 van 6 keer rood op
  `origin/w2-ruwe-data` zelf**. Het spec-gedrag bestond dus al op de branch.
  Met een meet-hook bekeken: vlak vóór `reload()` staan er elf `sj_`-sleutels in localStorage (o.a. `sj_conns` met
  vier koppelingen). In het nieuwe document is localStorage, nog vóór de app-code draait, **helemaal leeg** op
  `sj_welcomed` na (dat zet de test-helper zelf). Ook `sj_dev`, dat al bij de eerste load werd geschreven en
  daarna niet meer is aangeraakt, is weg. De app schrijft tussendoor niets weg (`setItem`/`removeItem`/`clear`
  gevolgd: geen aanroepen). In een ander geval zag `?dev=0` hetzelfde: `CONNS` leeg bij het opstarten.
- **`plan-doorloop`** faalde in ronde 2 en in 2 van 4 losse runs op "journal koppelt bij het opstarten: ≥40
  gekoppeld": TradingPlan schrijft 42 poortrecords in `tp2:trades`, maar na `goto` naar de journal ziet die er 2.
  Hetzelfde patroon: wat de vorige pagina in localStorage schreef, is na de navigatie niet te zien. Op
  `origin/main` 4 van 4 groen.
- De samenvoeging raakt geen opslagcode: de diff van `work/syncjournal.html` tegen main heeft geen enkele nieuwe
  `localStorage`-, `IDB`- of navigatie-aanroep. Wel is de app groter geworden en start hij dus iets trager.
- **Wat ik vermoed**: de browser zelf. `npx playwright install chromium` mocht hier niet downloaden (`403`,
  `cdn.playwright.dev` staat niet op de lijst van de proxy). De poort draaide daarom op de vooraf geïnstalleerde
  Chromium **build 1243 (v153)**, via een symlink, terwijl deze Playwright build **1248** verwacht. Een browser
  die localStorage bij navigatie op `file://` kwijtraakt past daarbij; de app kan de opslag aan browserkant niet
  leegmaken. Dat de race vaker optreedt sinds de merge kan door de tragere start komen, maar dat heb ik niet bewezen.

Ik heb hier **niets aan veranderd**: niet aan de app (er is geen app-oorzaak gevonden) en niet aan de specs.
CONNS of `tp2:trades` na het herladen opnieuw zetten zou de echte vraag ("raakt een lid na herladen zijn
koppelingen kwijt?") alleen maar verstoppen.

## Wat ik fixte

Niets in app of specs. Alleen de release-onderdelen: CHANGELOG samengevoegd, versie, `site/`, release-set.

## Open punten

1. **Draai de poort lokaal** (Windows, de echte Playwright-Chromium) vóór het vrijgeven:
   `node tests/run-release.js`. Verwachting: alles groen, ook `matrix`/`analytics-metrics`/`tendencies`
   (daar is jsdelivr wel bereikbaar). Zijn `ruwe-data` of `plan-doorloop` daar óók wisselend rood, dan is het
   geen omgevingskwestie en moet het uitgezocht worden. Bij `ruwe-data` gaat het om de vraag of koppelingen
   (`sj_conns`) een herlaad overleven; dat zou voor leden ernstig zijn.
2. `okx-partial-herstel`, `auto-sync`, `export-sleutels`, `tradingplan-v2` en `plan-doorloop` waren hier
   (soms) pas groen bij de tweede poging.
3. Versienummer: v1.18 is een minor, past bij nieuwe functies (funded modus, stop-management).
4. Daarna de gewone stappen 7–8 van de release-flow (site/ naar de deploy-repo, push alleen op Denny's "push").
   Deze branch is alleen gepusht als `release-v1.18`.

## Push

`git push -u origin release-v1.18` aan het eind van de routine. Lukt dat niet, dan staat de foutmelding hieronder.
