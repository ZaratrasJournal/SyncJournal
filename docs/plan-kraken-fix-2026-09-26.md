# Uitvoeringsplan Kraken-fix

Datum: 2026-09-26. Hoort bij `docs/opdracht-kraken-fix-2026-09-26.md` (de diagnose en het waarom). Dit document is het *wat en in welke volgorde*, per sessie, met per stap de plek in de code, de test en het klaar-criterium. Achtergrond in `docs/research-kraken-api-2026-09-26.md` en `docs/research-kraken-thirdparty-2026-09-26.md`.

Doel in één zin: **één Kraken-levensloopfunctie op account-log-data, gevoed door de CSV-import én door de API, die tegen Denny's export 107 van 107 posities correct oplevert.**

---

## Overzicht

| Sessie | Wat | Resultaat | Wie |
|---|---|---|---|
| **0 · Voorbereiding** (Denny, 15 min) | backup verplaatsen, rauwe capture aanleveren | veilige repo + fixtures voor sessie 1 en 2 | Denny |
| **1 · CSV-route = levensloopfunctie** (Claude, één sessie) | adapter-methode bouwen, CSV-import erop, test tegen echte export, release | Denny kan haar historie correct inlezen | Claude, Denny test |
| **2 · API op dezelfde functie** (Claude, korte sessie na Worker-deploy) | Worker-action `account_log`, `fetchTrades` omzetten, oude events-pad weg | sync geeft dezelfde trades als CSV, geen duplicaten | Claude bouwt, Denny deployt |
| **3 · Opruimen** (Claude, klein) | backlog-tickets sluiten, docs, memory, baseline | schone staat | Claude |

Sessie 1 hangt nergens van af behalve stap 0.1. Sessie 2 wacht op de Worker-deploy door Denny.

---

## Sessie 0 · Voorbereiding (Denny)

**0.1 Backup uit de repo-root.** `syncjournal-backup-2026-09-26 kraken.json` bevat de API-keys van Kraken en Blofin in platte tekst en is niet gitignored. Verplaats naar `_scratch/` (gitignored). De scripts uit sessie 1 lezen 'm daar.

**0.2 Rauwe capture (optioneel voor sessie 1, nodig voor sessie 2).** Twee JSON-bestanden aanleveren via het console-snippet uit `worker-patches/README.md`, aangepast:

```js
// in de app (F12 → Console), met de huidige Worker
const c = JSON.parse(localStorage.getItem('sj_conns')).kraken;
const call = async (body) => (await fetch('https://morani-proxy.moranitraden.workers.dev', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ exchange: 'kraken', apiKey: c.apiKey, apiSecret: c.apiSecret, ...body })
})).json();
const ev = await call({ action: 'trades', startTime: Date.parse('2026-05-01'), withEvents: true });
console.log('events:', (ev.events || []).length, 'trades:', (ev.trades || []).length);
copy(JSON.stringify(ev));   // → plak in tests/_fixtures/kraken-events-2026-09.json
```

Waar het voor dient: beantwoordt definitief waarom de events incompleet en door elkaar binnenkwamen (§4 R2 van de opdracht) en wordt de regressie-fixture voor de herschreven levensloop-test. Bewaar in `tests/_fixtures/` (gitignored). Als Denny er niet aan toekomt, gaat sessie 1 gewoon door.

**0.3 Beslissing bevestigen:** de 34 huidige Kraken-trades worden na sessie 1 verwijderd en opnieuw ingelezen. Ze bevatten geen handmatige inhoud (gecontroleerd op de backup: 0 van 34 met notities, tags, screenshots, rating of SL/TP).

---

## Sessie 1 · CSV-route wordt de levensloopfunctie

Werkbestand: `work/syncjournal.html`. Regelnummers zijn van 2026-09-26 en verschuiven; zoek op de genoemde namen.

### 1.1 Fixtures en scripts klaarzetten (10 min)
- Kopieer de export naar `tests/_fixtures/kraken-account-log-2026-09-26.csv` (map is gitignored; tests skippen als het bestand ontbreekt, zoals `kraken-real-data.spec.js` al doet).
- `scripts/kraken-recon.js` is de referentie-reconstructie (107 posities, netto −180,39 zonder funding). Niet wijzigen; de nieuwe app-code moet er tegenaan gehouden worden.
- Draai als nulmeting `npx playwright test tests/exchange-isolation.spec.js tests/smoke.spec.js tests/csv-import.spec.js` en noteer de uitkomst.

### 1.2 Adapter-methode `ExchangeAPI.kraken.levenslopenUitAccountLog(regels)` (kern, ~2 uur)
Plek: in het `kraken:{…}`-adapterobject, naast `_krLevenslopen` (≈ regel 6440). Pure functie, geen DOM, geen globale state behalve de helpers `fillTimeline`, `fillSummary`, `isAfbouw`, `normPrice`, `EMPTY_TRADE`.

**Input**: array van genormaliseerde regels, één per account-log-regel, met vaste veldnamen zodat CSV en JSON dezelfde functie voeden:

| veld | CSV-kolom | JSON-veld |
|---|---|---|
| `ts` (ms) | `dateTime` + `"Z"` (UTC!) | `Date.parse(date)` |
| `info` | `type` | `info` |
| `asset` | `symbol` | `asset` |
| `contract` | `contract` | `contract` |
| `change` | `change` | `new_balance − old_balance` |
| `newBalance` | `new balance` | `new_balance` |
| `avgEntry` | `new average entry price` | `new_average_entry_price` |
| `tradePrice` | `trade price` | `trade_price` |
| `realizedPnl` | `realized pnl` | `realized_pnl` |
| `fee` | `fee` | `fee` |
| `realizedFunding` | `realized funding` | `realized_funding` |
| `liquidationFee` | `liquidation fee` | `liquidation_fee` |
| `execution` | – (leeg) | `execution` |
| `id` | – | `id` |

Twee kleine normalisatie-helpers ernaast: `_logRegelsUitCsv(rows)` en `_logRegelsUitJson(logs)`.

**Algoritme** (volgorde-onafhankelijk, gebaseerd op de balans-keten):
1. Filter `info` op de trade-achtige types: `futures trade`, `futures liquidation`, `futures partial liquidation`, `futures assignor`, `futures assignee`, `futures_unwind`, `futures unwind bankrupt`, `futures unwind counterparty`, `covered liquidation`. Funding-regels (`funding rate change`, dragen `contract`) apart houden voor stap 5.
2. Sorteer chronologisch op `ts`, dan op `id` als aanwezig.
3. **Paren**: positie-regel = `asset === contract`; cash-regel = `asset !== contract` met dezelfde `contract`. JSON: paar op `execution`. CSV: paar positioneel binnen dezelfde `ts` en `contract`, in volgorde; een positie-regel zonder cash-regel is een KFEE-orphan (fee 0, pnl 0, wél een stap). Nooit op `(ts, tradePrice)` matchen.
4. **Controle per paar**: `|change_cash − (realizedPnl + realizedFunding − fee − liquidationFee)| < 1e-6`. Bij afwijking: tel 'm, zet 'm in het resultaat als `waarschuwingen[]`, ga door.
5. **Levensloop per contract** via `newBalance` van de positie-regel: `0 → ≠0` opent; `|nieuw| > |oud|` vergroot; `|nieuw| < |oud|` sluit deels; `→ 0` sluit; tekenwissel = omkering (sluit de oude levensloop en opent direct een nieuwe met het restant). `oud` = vorige `newBalance` van hetzelfde contract, of `newBalance − change` bij de eerste regel (orphan-start buiten het bestand → `notes` met de bestaande tekst "⚠ Partial data: opening order niet in CSV-range").
6. Per stap een `step` voor `fillTimeline`: `{ts, side: change>0?'buy':'sell', qty:|change|, price: tradePrice, fee, id: execution||`${ts}_${contract}_${n}`, effect: 'inc'|'dec', liq: info bevat 'liquidation', pnlExch: realizedPnl}`. Funding-regels binnen `[openTs, closeTs]` van dezelfde contract-levensloop optellen in `funding`.
7. Per afgesloten levensloop een trade, **identiek van vorm aan `_krLevenslopen`** (zodat `sjFromTj`, `importTjClosed`, `refreshFromSync` en `afterImport` niets hoeven te veranderen):
   - `id: "kraken_pos_" + CONTRACT.toUpperCase() + "_" + openTs` (dezelfde vorm als nu → CSV en API dedupen op `srcId`)
   - `date`/`time` in **Amsterdam**: gebruik `ts2date`/`ts2time` NIET (die zijn browser-lokaal); voeg één helper `amsDateTime(ms)` toe met `Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Amsterdam",…})` (patroon staat in CLAUDE.md) en gebruik die ook in `_krLevenslopen` zolang dat pad nog bestaat
   - `openTime`/`closeTime` als ms-string, `pair` via bestaande `_pair`, `direction` = teken van de eerste stap
   - `entry` = `fillSummary(tl).avgEntry`, `exit` = `avgExit`, `positionSize` = `(avgEntry × qty).toFixed(2)` (USD), `positionSizeAsset` = `normPrice(qty)`
   - `pnl` = `Σ realizedPnl − Σ fee − Σ liquidationFee + Σ funding` (net, zoals `_krLevenslopen` nu; leg in een comment vast dat funding erin zit)
   - `fees` = `Σ fee + Σ liquidationFee`
   - `fills: tl`, `positionId: CONTRACT`, `source:"kraken"`, `status:"closed"`, `leverage:""`
   - `tpLevels` uit de afbouw-stappen: `{id, price, pct: qty/totaalQty×100, status:"hit", actualPrice, ts}` — de dispatcher-code in `runPartialDetect` verwacht `ts` op een tp-level, dus meegeven.
8. Return `{trades, open: [levenslopen die nog niet op 0 staan], waarschuwingen}`. Wat nog open staat komt via de open-positie-placeholder; niet als trade uitgeven.

**Niet doen**: `if (exchange === …)` in gedeelde helpers; `fillTimeline` aanpassen; iets veranderen aan Blofin/OKX/Hyperliquid-paden.

### 1.3 CSV-import op de nieuwe functie (30 min)
Plek: `sjImportCsvText`, blok `if(isKrakenLog){ … }` (≈ regel 7669–7786) en het dode tweede blok `else if(isKrakenLog){ … }` (≈ regel 7787–7791, onbereikbaar; verwijderen).
- Vervang de hele lifecycle-lus door: `rowsRaw` → `ExchangeAPI.kraken._logRegelsUitCsv(rowsRaw)` → `levenslopenUitAccountLog(...)` → `csvTrades = trades`.
- `forExchange` blijft werken (source-override voor multi-account), net als nu.
- Laat `waarschuwingen` zien in de bestaande import-toast als er ≥1 is ("⚠ 3 regels niet sluitend, zie console").
- Detectie `isKrakenLog` (`uid` + `realized pnl` + `trade price` in de header) blijft; voeg `date`/`info`/`booking_uid` toe als tweede signatuur voor het geval iemand ooit de JSON als CSV plakt (goedkoop, defensief).

### 1.4 Tests (1 uur)
- **Nieuw `tests/kraken-account-log.spec.js`** (Playwright, patroon van `kraken-real-data.spec.js`):
  1. Laad app, ga naar Instellingen, upload de fixture-CSV via `#csvFileInp` (patroon in `scripts/kraken-csv-import-adhoc.js`).
  2. Lees de Kraken-trades uit IndexedDB `sj_db` (store `kv`), exporteer ze als backup-achtig object en draai de logica van `scripts/kraken-recon.js` erover (require de vergelijkfunctie of kopieer 'm compact in `tests/helpers/kraken-recon.js`).
  3. Assert: 107 trades · `missing 0, dir 0, size 0, pnl 0` · netto som binnen ±0,05 van de referentie (documenteer of funding erin zit) · alle 413 fills terug te vinden (Σ `fills.length` = 413) · elke trade `openTime ≤ closeTime` en `date/time` = Amsterdam van `openTime` · 58 trades met ≥2 tp-levels · 0 waarschuwingen.
  4. Tweede upload van hetzelfde bestand → nog steeds 107 (dedupe op `srcId`).
  5. Skip netjes als de fixture ontbreekt.
- **Synthetische unit-cases** (in dezelfde spec via `page.evaluate` op `ExchangeAPI.kraken.levenslopenUitAccountLog`): 4 sluitingen in één seconde · KFEE-orphan · omkering long→short in één fill · liquidatie-regel krijgt `liq` · funding binnen en buiten de levensloop · regels in `desc`-volgorde aangeleverd geven hetzelfde resultaat als `asc`.
- **Herschrijf `tests/kraken-levensloop.spec.js`** zodat de fixture Kraken's echte semantiek heeft (`fillTime` = openingstijd van de positie voor álle events, events in `desc`, meerdere sluitingen per seconde). Verwacht: de huidige `_krLevenslopen` **faalt** hierop. Dat is gewenst: het bewijst de bug. Markeer de test als `test.fixme` met verwijzing naar sessie 2 tot het events-pad is verwijderd of gerepareerd. De oude groene versie mag pas weg als deze staat.
- Regressie: `exchange-isolation.spec.js`, `smoke.spec.js`, `csv-import.spec.js`, `import-keuze.spec.js`, `export-import-rondje.spec.js` groen.

### 1.5 Snapshot-knop (5 min)
`ExchangeAPI.kraken.captureSnapshot` (≈ regel 7080): voeg `withEvents:true` toe aan de `trades`-call en neem `events` op in de snapshot. Voorbereiding voor sessie 2, geen gedrag voor gebruikers.

### 1.6 Release (20 min)
Release-flow uit CLAUDE.md / skill `release-flow`: `APP_VERSION` bump, `site/version.json`, CHANGELOG-entry:
> **Kraken: CSV-import van de account-log geeft nu je complete historie, correct.** Elke positie één trade met alle stappen, partial closes als TP's, netto PnL inclusief fees, tijden in Amsterdam. Lees je account-log-export (Kraken Pro → Documents → Ledger → tab Futures, of futures.kraken.com → Logs → Download All) opnieuw in; dubbel inlezen kan geen kwaad. De API-sync volgt in de volgende versie en vereist een Worker-update.

Kopie naar `site/app.html`, commit. **Niet pushen** zonder Denny's "push".

### 1.7 Denny's doorloop na sessie 1 (15 min)
1. Instellingen → Data → back-up maken (vangnet).
2. Trades → filter exchange Kraken → alle 34 selecteren → verwijderen.
3. Instellingen → Data → account-log CSV inlezen. Verwacht: 107 trades, toast zonder waarschuwingen.
4. Steekproef tegen Kraken Pro → Posities: 6 juni (short 60.504 → 60.997, 4 sluitingen, −12,83 netto), 20 mei (long 77.241, 2 sluitingen, +1,96), 19 mei (4 posities). Let op: Kraken toont UTC+1, de journal Amsterdam.
5. Export maken → `node scripts/kraken-recon.js <csv> <export>` → SUMMARY met `missing 0`.

**Klaar-criterium sessie 1**: alle asserts in 1.4 groen, Denny's doorloop klopt, release lokaal gecommit.

---

## Sessie 2 · API op dezelfde functie

Vereist: de rauwe capture uit 0.2 (voor de fixture) en Denny die de Worker deployt.

### 2.1 Worker v19 (Claude levert, Denny deployt; ~45 min)
Basis: `worker-patches/v18-online-worker.js` → `worker-patches/v19-online-worker.js`. Alleen `handleKraken` wijzigt; MEXC/Blofin/OKX byte-gelijk.
- Nieuwe action `account_log` met `{startTime, fromId}`:
  - URL `/api/history/v3/account-log?sort=asc&count=1000&since=<startTime>` of, als `fromId` meekomt, `&from=<fromId>` in plaats van `since`; plus `info=` met de negen trade-types en `funding rate change`, **url-encoded vóór het signen** (`futures%20trade`).
  - Geen continuation-token op dit endpoint: herhaal met `from = laatste id + 1` tot een pagina < 1000 regels teruggeeft; max 20 pagina's per call, geef `nextFromId` terug als er meer is. **`from`/`to` zijn inclusief** (rotki pagineert daarom met `to = min(id) − 1`); bouw een guard in die stopt als de cursor niet vooruitgaat, en dedupe op `booking_uid` zodat een overlappende pagina nooit dubbele regels geeft.
  - Signeren: volledig pad `/api/history/v3/account-log` (geen `/derivatives` te strippen), query-string als `postData`.
  - Foutafhandeling: HTTP 200 met `result:"error"` én HTTP 401 met `status:"unauthorized"` beide als fout teruggeven met de Kraken-tekst; `apiLimitExceeded` doorgeven zodat de app kan wachten.
  - Response: `{ source: 'account_log', logs: [...rauw], nextFromId, pages }`.
- `trades`-action en `events` blijven ongewijzigd staan tot 2.3 klaar is.
- Documentatie: `docs/worker-kraken-account-log.md` (zelfde opzet als `docs/worker-kraken-events.md`: waarom, exacte snippet, verificatie-snippet met verwachte output).
- Verificatie door Denny na deploy: console-snippet `call({action:'account_log', startTime: Date.parse('2026-05-01')})` → `logs.length` ≈ 2× het aantal fills sinds 1 mei (2 regels per fill) en `nextFromId` leeg.

### 2.2 App: `fetchTrades` op account-log (45 min)
Plek: `ExchangeAPI.kraken.fetchTrades` (≈ regel 6498).
- Nieuwe volgorde: `proxyCall({action:'account_log', startTime, fromId: CONNS.kraken.logCursor})`. Bij `logs` → `_logRegelsUitJson(logs)` → `levenslopenUitAccountLog(...)` → `trades`. Bewaar `nextFromId`/hoogste `id` als `CONNS.kraken.logCursor` (persistConns) zodat de volgende sync incrementeel is.
- Fallback: geeft de Worker `{error}` met "unknown action" of geen `logs`, dan het huidige pad (`trades` + `events`) zoals nu, met een eenmalige console-waarschuwing "Worker v19 nodig". Zo blijft de app werken bij members met een oude Worker.
- Levenslopen die het venster overlappen: vraag bij een lege cursor de historie vanaf `syncFrom` (default nu 2026-05-07 → voor Denny op 2025-11-01 zetten, of `from=1` voor alles); een positie die vóór `since` opende komt als orphan binnen. Dat is dezelfde afspraak als bij de CSV.
- `afterImport` (≈ regel 6488) blijft: oude `kraken_csv_*`/losse rijen gaan op in de levensloop met dezelfde `pair`/`dir`/`closeTime`. Voeg de `kraken_pos_`-vorm van CSV-trades toe aan de adoptie zodat een CSV-trade en een API-trade met dezelfde `srcId` niet dubbel komen (ze hebben dezelfde id, dus `importTjClosed` werkt al op `srcId`; controleren in test 2.4).
- `openIsPlaceholder` blijft `true`.

### 2.3 Oud pad verwijderen (na bevestiging door Denny, 20 min)
Als één sync bij Denny 107/107 geeft en `nextFromId` leeg is: `_krLevenslopen`, de `withEvents`-logica, de `evt`-vlag op de conn en `ExchangeAPI.kraken.detectPartials`'s oude-pad-tak verwijderen. `tests/kraken-levensloop.spec.js` gaat dan weg (vervangen door `kraken-account-log.spec.js` + de events-fixture-test hieronder).

### 2.4 Tests (45 min)
- **`tests/kraken-sync-mock.spec.js`**: mock `proxyCall` (patroon: `hyperliquid-refresh-dup.spec.js` / `kraken-3way.spec.js`) met de account-log-JSON uit de capture (0.2) → sync → dezelfde 13 posities sinds 7 mei als de CSV → daarna dezelfde CSV inlezen → 0 nieuwe trades → tweede sync → 0 nieuwe trades → open positie: placeholder verdwijnt zodra de levensloop binnenkomt.
- Fallback-test: Worker antwoordt zonder `logs` → app valt terug op events-pad zonder fout.
- Foutvormen: HTTP 200 `result:"error"` en 401 `status:"unauthorized"` geven een leesbare toast, geen lege import.
- Regressie: `exchange-isolation.spec.js`, `smoke.spec.js`.

### 2.5 Release
Versie-bump + CHANGELOG:
> **Kraken: API-sync haalt nu dezelfde complete historie op als de CSV-import** (account-log als bron). Vereist Worker v19 (Denny). Zet je "Sync vanaf" desgewenst terug naar het begin van je Kraken-account en druk op Sync; bestaande Kraken-trades worden bijgewerkt, niet gedupliceerd.

**Klaar-criterium sessie 2**: sync bij Denny = 107 trades = CSV-import, tweede sync 0 nieuwe, mock-tests groen, oud pad verwijderd.

---

## Sessie 3 · Opruimen (30 min)
- BACKLOG: tickets "Kraken 1970-timestamps", "Kraken open positie gedupliceerd" en "Kraken trades hebben geen TP-coverage" sluiten met verwijzing naar dit plan; nieuw ticket "Kraken: liquidation_fee zichtbaar maken in trade" alleen als het voorkomt.
- `docs/worker-kraken-events.md` markeren als vervangen door `docs/worker-kraken-account-log.md`.
- Memory `reference_kraken_api.md`: bijwerken naar de definitieve architectuur.
- Design-review baseline alleen bijwerken als de trade-lijst visueel is veranderd (niet verwacht).
- `.firecrawl/` en `scripts/kraken-*.js`: scripts committen, `.firecrawl/` niet.

---

## Risico's en hoe we ze afdekken

| Risico | Kans | Afdekking |
|---|---|---|
| Account-log JSON blijkt tóch geen positie-regels te geven (v7-notitie uit mei) | laag (ccxt en rotki verwerken ze; docs: `new_balance` = "new balance of wallet or new size of the position") | Denny's capture in 0.2 vóór sessie 2; anders plan B uit de opdracht (position-events met ccxt-semantiek) op dezelfde levensloopfunctie |
| CSV-paring positioneel gaat mis bij exotische regels (unwind/assignment) | laag voor Denny, onbekend voor members | controle-identiteit per paar + waarschuwingen in de toast; fixture-cases in 1.4 |
| Members met oude Worker | zeker, tijdelijk | fallback-pad in 2.2 tot Denny v19 heeft uitgerold; changelog zegt het |
| Rate-limit history-pool (100 tokens / 10 min, per IP, gedeeld door alle members) | laag bij `count=1000` (3 tokens/pagina) | max 20 pagina's per call; `apiLimitExceeded` netjes tonen |
| Dubbele trades CSV ↔ API | laag | zelfde `srcId`-vorm; expliciet getest in 2.4 |
| Funding in `pnl` verwarrend voor gebruikers | middel | comment + changelog; later los veld als de funding-feature komt |

## Definition of Done (hele traject)
1. `node scripts/kraken-recon.js <csv> <export>` → `missing 0, dir-mismatch 0, size-mismatch 0, pnl-mismatch 0`.
2. CSV-import en API-sync leveren identieke trades (zelfde `srcId`, velden, `fills`, `tps`).
3. Twee keer syncen of importeren → 0 nieuwe trades.
4. Alle Kraken-tests groen; `exchange-isolation.spec.js` bewijst dat de andere exchanges byte-gelijk bleven.
5. Release-flow doorlopen voor beide sessies; push alleen op Denny's "push".
