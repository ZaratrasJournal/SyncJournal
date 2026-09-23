# Worker bijwerken — wat, waarom, en hoe

Voor Denny. Twee wijzigingen, allebei terugwaarts veilig: journals die ze nog niet lezen merken er niets van. `docs/worker-okx-complete.js` is de volledige, bijgewerkte Worker — plakken en deployen is genoeg.

## Wat je ermee wint

| Zonder update | Met |
|---|---|
| Kraken blijft op het oude model: één trade per groep sluitingen | **Kraken: één trade per positie**, met alle stappen, funding en een eigen label voor liquidaties |
| "Geen fills gevonden" bij OKX, ook als je sleutel geweigerd werd | De echte reden staat in de melding |

Alles wat er nu werkt blijft werken. De `trades`-uitvoer van Kraken blijft ongewijzigd naast de nieuwe `events` staan.

## Wijziging 1 — Kraken stuurt zijn positie-gebeurtenissen mee

In `handleKraken`, vlak vóór de laatste `return`:

```js
const events = allElements
  .filter(el => el && el.event && el.event.PositionUpdate)
  .map(el => ({ uid: el.uid, timestamp: el.timestamp, event: { PositionUpdate: el.event.PositionUpdate } }));

return {
  source: 'position_updates',
  trades,
  events,          // ← nieuw
  _v18Debug: { /* … */ },
};
```

`allElements` staat er al: de lus die de pagina's ophaalt vult hem. De Worker gooide alleen alles weg behalve de sluitingen.

**Waarom niet via `/derivatives/api/v3/fills`.** Uit Kraken's eigen documentatie bij dat endpoint: *"`realized_pnl` … Null when the fill was recorded before this field was introduced, or when the request uses `lastFillTime`."* De Worker pagineert altijd met `lastFillTime`, dus daar is de P&L structureel leeg. De positie-gebeurtenissen dragen hem wél, plus funding en het liquidatie-kenmerk.

## Wijziging 2 — OKX vertelt waarom er geen fills zijn

In `handleKraken`… nee, in **`handleOKX`**, in de `fills`-tak. De oude versie ving elke fout op en gaf een lege lijst terug:

```js
const safeGet2 = async (p) => { try { return await get(p); } catch (e) { return []; } };
```

Daardoor zijn een geweigerde sleutel, een geweigerd bereik en "er zijn echt geen fills" niet uit elkaar te houden. De nieuwe versie geeft de fout per instType mee onder `_okxDebug` — dezelfde plek waar de `trades`-tak dat al doet:

```js
return {
  fills: rows,
  _okxDebug: { futures: arr2(fut).length, err_fut: fut.__err, swap: arr2(swap).length, err_swap: swap.__err },
};
```

**Bewust niet als `error` op het hoogste niveau.** Dat veld betekent op deze Worker "request mislukt", en de Worker is gedeeld met Morani's journal — die zou daarop gaan gooien bij wat voorheen gewoon een leeg antwoord was. Een onbekende extra sleutel negeert elke client.

## Na het deployen

**Kraken.** Open de journal en synchroniseer. De app merkt zelf dat de proxy nu gebeurtenissen levert en haalt in diezelfde beurt je oudere historie op, zodat bestaande trades hun begin terugkrijgen. Daarna gebeurt dat niet meer. Je oude rijen (één per groep sluitingen) gaan op in de positie waar ze in vallen, met je notities en labels erbij.

Waar je op moet letten:

- Een positie die je in stappen sloot staat nu als **één** trade, met die stappen eronder. Je trade-aantal daalt dus, en je winrate verandert — dat is de correctie, niet een fout.
- De P&L per positie is `Σ realizedPnL − fees + funding`. Funding boekt Kraken als eigen gebeurtenis binnen de positie; die telt mee in het bedrag maar is geen stap.
- Een gedwongen sluiting heet **Liq**.

**OKX.** Alleen zichtbaar wanneer er iets misgaat: waar eerst "geen fills gevonden" stond, staat nu de echte reden.

## Getest

Kraken is gebouwd tegen de documentatie (`GET /api/history/v3/positions`) en getoetst op je eigen account-log (`tests/_fixtures/kraken-export.csv`, 2437 regels): 369 positiegebeurtenissen worden **93 levenslopen**, met dezelfde totale P&L als de export zelf. Specs: `tests/kraken-levensloop.spec.js` en `tests/kraken-afronding.spec.js`.

Wat ik **niet** kon testen zonder jouw sleutels: of de Worker na het deployen daadwerkelijk `events` teruggeeft. Dat is de eerste sync na het plakken — kijk of er in de tradelijst één Kraken-trade per positie verschijnt in plaats van één per sluiting.
