# Exchange validatie-checklist

**Doel**: voor élke ondersteunde exchange dezelfde 5 scenarios doorlopen en valideren of álle waarden in SyncJournal kloppen met wat de exchange laat zien. Gebruik dit naast de exchange-UI bij elke release of bij twijfel.

> 📌 **Belangrijk**: doe scenarios met **kleine bedragen** (bv. $5-20 risk). Trades zijn echt — niet tegen een testnet. Doe ze achtereenvolgens binnen één refresh-cyclus zodat je timestamps + import-flow ook test.

---

## Wat te valideren (per trade)

Voor elke scenario loop je deze 10 velden langs:

| # | Veld | Waar in app | Match met... |
|---|---|---|---|
| 1 | **Entry prijs** | trade-row + edit-modal | exchange position open-prijs |
| 2 | **Direction** | trade-row badge (LONG/SHORT) | exchange position type |
| 3 | **Position size (asset)** | edit-modal "Positie (BTC)" | exchange position size in BTC/ETH/etc |
| 4 | **Position size ($)** | trade-row + edit-modal positie-veld | entry × asset-qty |
| 5 | **Stop loss** | trade-row + edit-modal | exchange SL trigger-prijs |
| 6 | **Take profit-prijzen** | edit-modal TP-niveaus | exchange TP-orders |
| 7 | **TP percentages** | edit-modal TP-niveaus | size per TP / totale size |
| 8 | **Exit prijs** | trade-row + edit-modal | exchange close-prijs (gewogen gem. bij partials) |
| 9 | **PnL** | trade-row + Dashboard | exchange `realised` / `pnl` veld (op cent niveau) |
| 10 | **Fees** | edit-modal Fees-veld | exchange totale fees voor deze positie |

Plus per-scenario de afgeleide waarden:

| Afgeleid | Waar | Klopt als... |
|---|---|---|
| **R:R** | edit-modal KPI-strip | (TP-afstand) / (SL-afstand) |
| **Risk $ + %** | edit-modal KPI-strip | (entry−SL) × size, gedeeld door account-equity |
| **R-multiple** | trade-row hover | werkelijke PnL / Risk $ |
| **Hold time** | trade-row hover | closeTime − openTime |

---

## Hoe een afwijking te rapporteren

Plak in Discord het format uit [test-checklist.md](test-checklist.md) (sectie "Bug-rapport template"). Belangrijk: vermeld **welk veld** afwijkt + de **exacte waarde in app vs. exchange**.

---

# 🟣 Blofin

## 1. Open trade + SL gezet (live)
- [ ] Open trade verschijnt in Trades-lijst met badge "🟢 LIVE" of "OPEN"
- [ ] Entry prijs match Blofin → Positions
- [ ] SL prijs zichtbaar in trade-row + edit-modal
- [ ] Direction (LONG/SHORT) klopt
- [ ] Position size (BTC) klopt — zelfde getal als Blofin "Size"
- [ ] Position size ($) ≈ entry × size (binnen $1 afronding)
- [ ] Live PnL `~$X` (tilde-prefix) update bij prijsbeweging
- [ ] Liquidation-price `LIQ $X` zichtbaar (amber kleur)
- [ ] Risk $ in KPI-strip ≈ (entry − SL) × size
- [ ] Geen TP zichtbaar (nog niet gezet)

## 2. Trade met 1 TP, daarna exit op TP
- [ ] Na TP gezet: TP1 verschijnt in edit-modal als "open" status
- [ ] TP1 percentage = 100%
- [ ] R:R in KPI-strip = (TP-prijs − entry) / (entry − SL), klopt op 0.01R
- [ ] Na hit: status verandert naar "closed", exit-prijs = TP-prijs
- [ ] TP1 status verandert naar "hit" met checkmark
- [ ] Exit prijs in trade-row matcht Blofin position-history "Close price"
- [ ] PnL in app == Blofin "Realised PnL" (op cent niveau)
- [ ] Fees in app == Blofin "Total fees" voor deze positie
- [ ] R-multiple in hover = PnL / Risk

## 3. Trade met 2 TPs (partial close)
- [ ] Beide TPs zichtbaar in edit-modal vóór exit
- [ ] TP1 + TP2 percentages tellen op tot 100% (bv. 50/50 of 60/40)
- [ ] Na TP1-hit: status = "partial", trade blijft staan in lijst
- [ ] Na TP1-hit: TP1 toont actualPrice (kan iets afwijken van targetPrice door slippage)
- [ ] Na TP2-hit: status = "closed", trade.exit = gewogen gemiddelde van beide TPs
- [ ] Σ van TP1-PnL + TP2-PnL == trade.pnl (op cent niveau)
- [ ] Beide TPs hebben ts-veld (timestamp), chronologisch oplopend
- [ ] Hold-time = closeTime (laatste TP) − openTime

## 4. Live trade tijdens markt-bewegingen
- [ ] Live PnL update werkt (zonder refresh-knop, via auto-refresh interval)
- [ ] Bij beweging tegen je: PnL wordt rood
- [ ] Bij beweging in je voordeel: PnL wordt groen
- [ ] Liquidation-price update mee bij margin-veranderingen

## 5. Volledig gesloten trade (na refresh)
- [ ] Trade staat als "closed" in lijst
- [ ] Geen "~" prefix meer voor PnL (= realized)
- [ ] Edit-modal toont alle TPs als "hit" met actualPrice
- [ ] Dashboard total-PnL bevat deze trade
- [ ] Trades-pagina header-stats kloppen met Dashboard

## 6. Trade die SL hit (verlies)
- [ ] Status = closed na hit
- [ ] Exit prijs = SL-prijs (binnen slippage-marge)
- [ ] PnL is negatief en klopt met Blofin "Realised PnL"
- [ ] R-multiple ≈ −1R (of dichtbij, afhankelijk van SL-positie)
- [ ] TP1 (als die was gezet) heeft status "missed" of "open" — niet "hit"
- [ ] SL-veld zichtbaar in trade-row + edit-modal
- [ ] Hold-time klopt

## 7. Trade handmatig gesloten (markt-close zonder TP/SL trigger)
- [ ] Status = closed
- [ ] Exit prijs = market-close prijs (niet TP/SL)
- [ ] Geen TP gemarkeerd als "hit" (alle TPs blijven "open" of "missed")
- [ ] PnL klopt met Blofin
- [ ] Fees klopt
- [ ] Hold-time klopt

## 8. Trade met SL verplaatst tijdens leven (bv. naar BE na TP1)
- [ ] Bij wijziging in Blofin: nieuwe SL-waarde verschijnt na refresh
- [ ] R-multiple herberekent naar nieuwe risk-distance
- [ ] Risk $ in KPI-strip update
- [ ] Bij eventuele exit op nieuwe SL: PnL klopt (kleinere verlies of break-even)

---

# 🟢 MEXC

## 1. Open trade + SL gezet (live)
- [ ] Open trade verschijnt met badge "🟢 LIVE"
- [ ] Entry prijs match MEXC Position
- [ ] SL prijs zichtbaar (komt via stoporder/list endpoint, vereist Worker v6)
- [ ] Direction klopt
- [ ] Position size (BTC) klopt — let op: vol-veld is in contracts, app converteert via contractSize naar BTC
- [ ] Position size ($) klopt
- [ ] Live PnL `~$X` werkt
- [ ] Liquidation-price zichtbaar
- [ ] **Pending TPs** (als je TPs hebt gezet maar niet gehit) zichtbaar als "open" tpLevels (Worker v6 vereist)

## 2. Trade met 1 TP, daarna exit
- [ ] TP1 zichtbaar als "open" status zolang trade open is
- [ ] Na hit: TP1 status → "hit", actualPrice gevuld
- [ ] Exit prijs = TP1 actualPrice
- [ ] PnL == MEXC `realised` veld (al netto, sinds v12.88 verified)
- [ ] Fees == |MEXC `fee` veld| (MEXC fee komt negatief; app toont positief)
- [ ] R-multiple klopt
- [ ] Trade verdwijnt uit Open-positions, verschijnt in closed-list

## 3. Trade met 2 TPs (partial close)
- [ ] Beide TPs zichtbaar pre-hit als "open" pending
- [ ] Pcts tellen op tot 100%
- [ ] Na TP1-hit: status = "partial"
- [ ] Na TP2-hit: 2 hit-TPs zichtbaar in edit-modal
- [ ] **Belangrijk** (Worker v6): elke TP heeft eigen prijs + eigen timestamp (niet 1 gemiddelde via fallback)
- [ ] Σ TP-fills.size == trade.positionSizeAsset
- [ ] PnL == Σ realized per fill = MEXC `realised` per positie

## 4. Live trade
- [ ] Live PnL update via auto-refresh
- [ ] LIVE-badge verdwijnt na full close

## 5. Volledig gesloten
- [ ] Status = closed
- [ ] Console na MEXC-refresh: `[refresh mexc] positionId=X → N close-fills na filter` met **N>0** (= geen 0)
- [ ] Geen "fallback" badge in TP _source (tenzij Worker v6 niet draait)
- [ ] Dashboard PnL telt mee

---

# 🟠 Kraken Futures

> ⚠ Kraken heeft géén positionId in de API. TPs worden niet automatisch gefetched (zie [BACKLOG.md](../BACKLOG.md) "Kraken trades hebben geen TP-coverage"). Verwacht voor nu: alleen entry/exit/PnL via account-log.

## 1. Open trade + SL gezet
- [ ] Open trade verschijnt
- [ ] Entry / Direction / Size kloppen
- [ ] SL waarde — manueel ingevuld? Komt niet automatisch via API
- [ ] Live PnL update werkt

## 2. Trade met 1 TP, daarna exit
- [ ] Na exit: trade.exit = werkelijke close-prijs
- [ ] PnL == Kraken realized PnL
- [ ] Fees == Kraken fee
- [ ] **TPs leeg** (verwacht — Kraken-bug, op backlog)

## 3. Trade met 2 TPs (partial close)
- [ ] trade.exit = gewogen gem. close-prijs (proxy aggregeert via account-log)
- [ ] PnL = Σ realized per fill, klopt op cent
- [ ] Hold-time = laatste fill − eerste fill
- [ ] **TPs leeg** (verwacht — bug)

## 4. Live trade
- [ ] Live PnL update werkt
- [ ] Margin info klopt

## 5. Volledig gesloten
- [ ] Status = closed via reconstructie uit account-log
- [ ] PnL klopt (testen met fixture: `tests/_fixtures/kraken-snapshot.json`)

---

# 🔵 Hyperliquid

## 1. Open trade + SL gezet
- [ ] Open trade verschijnt
- [ ] Entry / Direction / Size kloppen
- [ ] SL veld zichtbaar (Hyperliquid SL via app of platform-UI gezet?)
- [ ] Live PnL update via wallet-poll werkt
- [ ] Wallet-balance bovenin klopt met Hyperliquid `accountValue`

## 2. Trade met 1 TP, daarna exit
- [ ] Na hit: trade.exit = TP-prijs
- [ ] PnL == Hyperliquid `closedPnl`
- [ ] Fees klopt (wordt in v12.88 fix correct geattribueerd)

## 3. Trade met 2 TPs (partial close)
- [ ] Beide closes verschijnen via _reconstructTrades FIFO
- [ ] Σ realized PnL klopt
- [ ] Geen fee-duplicatie (v12.88 fix verifiëert ratio == 1.000)

## 4. Live trade
- [ ] Live PnL update werkt
- [ ] Bij meerdere open posities: elke individueel zichtbaar

## 5. Volledig gesloten
- [ ] Status = closed
- [ ] Trade verschijnt in Dashboard totals

---

# 📌 Cross-exchange consistency

Na alle 4 exchanges getest:

- [ ] Dashboard total-PnL = Σ van alle exchange-PnLs (op cent niveau)
- [ ] Trades-pagina header-stats == Dashboard
- [ ] Per exchange: pnl-sum-tile op Dashboard klopt met per-exchange exchange-UI
- [ ] Geen valuta-inconsistentie ($ vs €) tussen Dashboard en Trades
- [ ] Win-rate over alle exchanges = (winners / total trades), partial-trades duidelijk gehandeld
- [ ] Sample-size warning verschijnt onder N=30

---

# 🚨 Wanneer iets niet klopt

1. Maak screenshots van **beide** kanten (app + exchange-UI)
2. Bij MEXC/Blofin: maak ook een **dev-mode snapshot** (`?dev=1` URL → 📥 Snapshot-knop). Bevat geen credentials, wel raw API-response.
3. Plak het bug-rapport template uit [test-checklist.md](test-checklist.md) in Discord
4. Vermeld of dit een nieuwe trade was of een herimport van bestaande
5. Vermeld de versie (zie Instellingen → Accounts → Versie)

---

# 📋 Snelle release-validatie (na elke deploy)

Niet alle 5 scenarios hoef je elke keer te draaien. Minimum-set:

- [ ] Bestaande trades: open Trades-lijst → check dat aantallen + PnL niet veranderd zijn (regressie-check)
- [ ] Per actieve exchange: één refresh draaien → console (F12) check op errors
- [ ] Eén closed trade openen in edit-modal → check TPs + PnL nog kloppen
- [ ] Dashboard headlines vergelijken met Trades-pagina (PnL/WR/count consistent)

Volledige scenario-set is voor: kwartaal-review, na grote feature-release, of bij community-rapport van inconsistentie.
