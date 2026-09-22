# Worker-aanpassing: Kraken position-events meesturen

Voor Denny. Eén wijziging in `handleKraken`, in de `trades`-tak. Zonder deze aanpassing werkt de journal gewoon door op het oude pad (één trade per groep sluitingen); zodra hij erin staat, schakelt Kraken over op één trade per positie met alle stappen erin.

## Waarom

Kraken levert zijn positiegeschiedenis als losse gebeurtenissen (`GET /api/history/v3/positions`, `PositionUpdate`). Elke gebeurtenis zegt wat de positie ervóór en erná was, wat er gerealiseerd is, wat de fee en funding waren, en of het een liquidatie betrof:

| Veld | Waarde |
|---|---|
| `positionChange` | `open` · `close` · `increase` · `decrease` · `reverse` · `noChange` · `unknown` |
| `tradeType` | `userExecution` · `liquidation` · `partialLiquidation` · `assignment` · `unwind` |
| `updateReason` | `trade` · `fundingRealisation` · `settlement` |
| verder | `oldPosition`, `newPosition`, `executionPrice`, `executionSize`, `executionUid`, `realizedPnL`, `fee`, `realizedFunding`, `fillTime`, `timestamp` |

De Worker gooit nu alles weg behalve de sluitingen, en groepeert die per `(tradeable, fillTime, richting)`. Daarmee wordt elke deelsluiting een eigen trade — en gaan de openingen, de funding en het liquidatie-kenmerk verloren.

**Niet via `/derivatives/api/v3/fills`.** De docs bij dat endpoint: *"`realized_pnl` … Null when the fill was recorded before this field was introduced, or when the request uses `lastFillTime` (the historical query path does not currently carry realised PnL)."* De Worker pagineert altijd met `lastFillTime`, dus daar is de P&L structureel leeg.

## De wijziging

In `handleKraken`, ná de bestaande lus die `allElements` vult en vóór `return { source: 'position_updates', trades }`, wordt het antwoord uitgebreid. De bestaande `trades` blijft ongemoeid, zodat oudere journals niets merken.

Zoek de laatste regel van `handleKraken`:

```js
  return { source: 'position_updates', trades };
```

en vervang die door:

```js
  /* De losse gebeurtenissen gaan mee zodat de journal één trade per positie-levensloop kan
     bouwen, met alle stappen, funding en liquidatie-kenmerk erin. `trades` blijft erbij voor
     journals die de gebeurtenissen nog niet lezen. (Denny 22-09-2026.) */
  const events = allElements
    .filter(el => el && el.event && el.event.PositionUpdate)
    .map(el => ({ uid: el.uid, timestamp: el.timestamp, event: { PositionUpdate: el.event.PositionUpdate } }));
  return { source: 'position_updates', trades, events };
```

Meer is het niet: `allElements` bestaat al in die functie en bevat precies de gebeurtenissen.

## Optioneel, maar aan te raden

De lus haalt nu alles op en filtert pas daarna op `since`. Kraken kent een `since`-parameter (milliseconden) en `sort=asc`; dat scheelt bij een lange historie een hoop pagina's:

```js
const params = continuationToken
  ? { continuationToken: String(continuationToken) }
  : { since: String(since), sort: 'asc' };
```

Let op: bij `sort: 'asc'` loopt de bestaande `oldestTs < since`-afbreekconditie de verkeerde kant op. Laat die dan weg en stop op het ontbreken van een `continuationToken`.

## Wat de journal ermee doet

- Eén trade per levensloop: van de eerste opening tot de positie weer op nul staat.
- Alle stappen erin, met per stap Kraken's eigen `realizedPnL`.
- P&L = Σ `realizedPnL` − Σ fees + Σ `realizedFunding` over de hele levensloop.
- `liquidation` en `partialLiquidation` krijgen het label **Liq**.
- Een `fundingRealisation` is géén stap, maar telt wel mee in de P&L.
- De eerste keer dat de journal gebeurtenissen ziet, haalt hij in dezelfde beurt de oudere historie op, zodat bestaande trades hun begin terugkrijgen. Daarna niet meer.

Getest tegen je eigen account-log (`tests/_fixtures/kraken-export.csv`, 2437 regels): 369 positiegebeurtenissen worden **93 levenslopen**, met dezelfde totale P&L als de export zelf. Spec: `tests/kraken-levensloop.spec.js`.
