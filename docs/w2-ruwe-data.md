# W2 · Ruwe exchange-data vastleggen en afspelen

Bij een bug van een lid zie je normaal alleen wat er wél in de journal staat. Met dit bestand zie je
wat de exchange terugstuurde, en speel je die sync na in een spec, met de echte adapter-code.

## Hoe een lid het bestand maakt

1. Open de journal met `?dev=1` achter het adres: `syncjournal.nl/app?dev=1`.
   Het apparaat onthoudt dat; `?dev=0` zet het weer uit.
2. Instellingen → Accounts → **Sync nu** bij de exchange met het probleem.
3. Instellingen → Data → *Hulp bij problemen*. Onder het diagnose-rapport staat het dev-blok.
   Klik bij die exchange op **Ruwe gegevens downloaden**.
4. Stuur het bestand (`syncjournal-ruw-<exchange>-<datum>.json`) alleen aan Zaratras.

Het bewaren gebeurt alleen in het geheugen van het tabblad. Herladen = weg, dus downloaden ná de
sync en vóór het verversen.

## Wat erin staat

```json
{ "soort": "syncjournal-ruwe-data", "formaat": 1, "exchange": "okx", "app": "v1.17.2",
  "gemaakt": "2026-10-26T09:12:00.000Z", "sync": "2026-10-26T09:11:58.000Z",
  "afgekapt": 0, "weggelaten": ["apiKey", "apiSecret", "passphrase", "uid"],
  "aanroepen": [ { "actie": "trades", "tijd": "…", "verzoek": { "startTime": 1759… }, "antwoord": { … } } ] }
```

- **actie**: Worker-actie (`trades`, `open_positions`, `fills`, `algos`, `account_log`, …), bij Blofin het
  pad (`/api/v1/account/positions-history`), bij Hyperliquid het `type` (`userFillsByTime`, …).
- **verzoek / antwoord**: wat de adapter verstuurde en terugkreeg, vóór het omzetten naar trades.
  Een mislukte aanroep heeft `fout` en geen antwoord.
- **weggelaten**: welke veldnamen zijn weggefilterd (alleen de namen).
- **afgekapt**: aanroepen die niet meer pasten (grens: ~2 MB tekst of 300 aanroepen per exchange).

Nooit erin: API-sleutel, secret, passphrase, walletadres, account-/sub-accountnummers en het saldo.
Gefilterd op veldnaam (`work/syncjournal.html`, `RUW_WEG` en `RUW_WEG_DEEL`, plus `ruwWeg` per adapter),
en daarna nog eens op de echte sleutelwaarden uit `CONNS`, ook als tekst midden in een veld.

## Afspelen in een spec

1. Zet het bestand in `tests/_fixtures/`, bijv. `tests/_fixtures/ruw-okx-jarne.json`.
   **Die map is gitignored**: het bestand bevat trades van een lid en gaat nooit naar GitHub.
2. Draai het voorbeeld:

   ```bash
   node tests/ruwe-data-voorbeeld.spec.js tests/_fixtures/ruw-okx-jarne.json
   ```

   Dat laat zien welke trades de journal van het bestand maakt.
3. Kopieer `tests/ruwe-data-voorbeeld.spec.js` naar een eigen spec en zet de bug erin als assert
   (er staat een uitgecommentarieerd voorbeeld in).

De kern is `tests/helpers/ruwe-data.js`:

```js
const H = require('./helpers/dov-page'); const R = require('./helpers/ruwe-data');
const d = R.laad('tests/_fixtures/ruw-okx-jarne.json');
const { p } = await H.openJournal(b, { klok: new Date(d.gemaakt) });   // klok op het moment van opnemen
await R.speelAf(p, d);                                                  // adapter krijgt het bestand i.p.v. de Worker
const n = await p.evaluate(ex => syncExchange(ex, { quiet: true }), d.exchange);
```

`speelAf` vervangt `proxyCall` (OKX, Kraken, MEXC), `ExchangeAPI.blofin._direct` of
`ExchangeAPI.hyperliquid._post`, en zet een nep-koppeling klaar die een jaar vóór de opname begint.
Per actie krijgt de adapter het eerste ongebruikte antwoord met hetzelfde verzoek (tijdvelden tellen
niet mee), anders het volgende antwoord van die actie. Een actie die niet in het bestand staat gooit
`niet vastgelegd: <actie>` en komt in `window.__ruwGemist`.

**Niet in het bestand**: de publieke instrumentenlijst (contractwaarde) van OKX en Blofin. Gaat de bug
over hoeveelheden, geef de contractwaarde mee: `R.speelAf(p, d, { ctVal: { 'BTC-USDT-SWAP': 0.01 } })`.

## Getest

`tests/ruwe-data.spec.js`: zonder `?dev=1` niets; met `?dev=1` een download per exchange (OKX, Blofin,
Kraken, Hyperliquid) zonder sleutels, wallet, uid of saldo, met trades, prijzen en id's; niets in
localStorage, IndexedDB, back-up of diagnose-rapport, weg na herladen; licht en donker; en de vier
downloads spelen via het voorbeeld hierboven dezelfde trades af als de echte sync.
