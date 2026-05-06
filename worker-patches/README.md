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

### v6-online-worker.js (2026-05-06)

**Wat verandert**: alleen MEXC `fills`-action. Blofin + Kraken ongewijzigd.

- **v12.93**: Switch van `order_deals` → `history_orders` voor accurate close-fill data. Research wees uit dat `order_deals` het `position_id`-filter stilzwijgend negeert én structureel alleen open-fills retourneert. `history_orders` heeft per record een `positionId` veld + alle benodigde data (`dealAvgPrice`, `dealVol`, `profit`, `totalFee`, `state`).
- **v12.89** (gemist in v5): Pending TP/SL ophaling via `stoporder/list/orders` (is_finished=0, state=1). Open trades met TP/SL gezet maar nog niet getriggerd verschijnen nu in de fills-response als `_pending: true` records.
- **v12.90** (gemist in v5): positionId-filter op pending TPs zodat fills van andere posities op zelfde pair niet als TPs van huidige trade verschijnen.

**Verificatie na deploy**: in de app → F12 console → Refresh MEXC → `[refresh mexc]` regels moeten close-fills tonen (niet "0 close-fills na filter"). De server-response heeft `_sources._endpoint: 'history_orders'`.

**Rollback** als er iets mis gaat: paste de v5 code terug (jouw vorige versie van vóór deze deploy) en redeploy.
