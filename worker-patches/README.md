# Worker patches

Snippets en complete versies van de **online Cloudflare Worker** die de exchange-API's voor de TradeJournal app proxiet. Deze folder is de werkplaats voor Worker-wijzigingen — de productie-Worker zelf zit niet in deze repo onder version-control.

## Hoe te deployen

1. Open de Cloudflare dashboard → Workers → de Morani Trading Journal worker
2. Klik **Edit code**
3. Selecteer alle code in de editor (`Ctrl+A` of `Cmd+A`)
4. Vervang door de **complete inhoud** van bv. `v6-online-worker.js`
5. Klik **Save and Deploy**
6. Verifieer in de app: F12 console → klik MEXC refresh → check dat er geen fout-melding komt

## Versies

### v7-online-worker.js (2026-05-06)

**Wat verandert**: alleen Kraken `trades`-action. MEXC + Blofin byte-voor-byte ongewijzigd vs v6.

- **Kraken trades**: switch van account-log-only → fills + account-log gekoppeld. Reden: research 2026-05-06 wees uit dat Kraken's account-log endpoint geen betrouwbaar size-veld heeft voor "futures trade" entries (`change` is null of bevat USD-notional, niet contract-grootte). Daardoor leverde de Worker consistent `size: 0` en `exit_price: 0` voor alle Kraken trades.
- **Nieuwe flow**: haal fills via `/derivatives/api/v3/fills` (heeft expliciet `size` en `price`), match op tijdstempel + symbool met account-log entries (voor `realized_pnl`, `fee`, `old_average_entry_price`). Aggregeer zoals voorheen per (symbol, minute, direction).
- **Direction-detectie**: nu uit `fill.side` + pnl-sign (`side=sell + pnl≠0` → closed long, `side=buy + pnl≠0` → closed short). Voorheen uit `change`-veld dat onbetrouwbaar was.
- **Veiligheids-net**: bij 0 matchende fills (bv. `/fills` endpoint failt) valt de logic terug op het oude account-log-only pad. Slechtste geval = same-as-v6, niet erger.
- **Debug-info**: response bevat `_v7Debug: { fillsCount, logsCount, matchedCount }` zodat je in F12 kunt zien hoeveel fills + logs binnenkwamen en hoeveel er gematched zijn.

**Verificatie na deploy** (jij doet de math-check):
1. Open een gesloten Kraken trade in de modal
2. Check dat `Position ($)` en `Qty (BTC)` nu gevuld zijn (niet meer 0)
3. Math-check: `(exit - entry) × qty ≈ pnl + fees`. Als ratio ≠ ~1.0, mogelijk hebben we inverse-conversie nodig voor `pf_xbtusd` (= patch v8).
4. Console: `[refresh kraken]` zou trades moeten tonen met niet-zero `size` en `exit_price`.

**Bestaande 37 Kraken trades**: hebben in localStorage `size: "0"` en `exit_price: "0"`. Bij refresh worden ze niet automatisch overschreven (`importTrades` skipt bestaande id's). Twee opties:
- A) Verwijder Kraken-trades manueel via Trades-pagina, daarna refresh → fresh import met correcte data
- B) Wacht op v12.100 client-side patch met "Re-import Kraken (overschrijven)" knop

**Rollback** als er iets mis gaat: paste de v6 code terug en redeploy.

### v6-online-worker.js (2026-05-06)

**Wat verandert**: alleen MEXC `fills`-action. Blofin + Kraken ongewijzigd.

- **v12.93**: Switch van `order_deals` → `history_orders` voor accurate close-fill data. Research wees uit dat `order_deals` het `position_id`-filter stilzwijgend negeert én structureel alleen open-fills retourneert. `history_orders` heeft per record een `positionId` veld + alle benodigde data (`dealAvgPrice`, `dealVol`, `profit`, `totalFee`, `state`).
- **v12.89** (gemist in v5): Pending TP/SL ophaling via `stoporder/list/orders` (is_finished=0, state=1). Open trades met TP/SL gezet maar nog niet getriggerd verschijnen nu in de fills-response als `_pending: true` records.
- **v12.90** (gemist in v5): positionId-filter op pending TPs zodat fills van andere posities op zelfde pair niet als TPs van huidige trade verschijnen.

**Verificatie na deploy**: in de app → F12 console → Refresh MEXC → `[refresh mexc]` regels moeten close-fills tonen (niet "0 close-fills na filter"). De server-response heeft `_sources._endpoint: 'history_orders'`.

**Rollback** als er iets mis gaat: paste de v5 code terug (jouw vorige versie van vóór deze deploy) en redeploy.
