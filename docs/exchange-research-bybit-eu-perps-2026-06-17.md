# Bybit EU Perpetual Futures — verkennend onderzoek (2026-06-17)

> Status: **voorbereiding, GEEN bouwopdracht.** Perps op bybit.eu nog NIET live.

## 1. Status (lees eerst)
| Vraag | Antwoord | Zekerheid |
|---|---|---|
| Perps live op bybit.eu? | **Nee** | bevestigd |
| Timing | onbekend — MiFID II-aanvraag sept-2025, CEO noemde "binnen 6 mnd" (aug-2025), geen nieuwe deadline | onzeker |
| Blokkade | aparte **MiFID II**-licentie (los van MiCA) | bevestigd |
| Spot + margin op bybit.eu? | ja, sinds 1-jul-2025 | bevestigd |

Chronologie: mei-2025 MiCAR-licentie (FMA Oostenrijk, 29 EEA-landen) → 1-jul-2025 bybit.eu live (spot) → 5-sep-2025 MiFID II-aanvraag ingediend → apr-2026 CEO: MiCA alleen niet genoeg → jun-2026 perps nog steeds niet live. EU-regulatieprocessen duren typisch 12-24 mnd → "binnenkort" is speculatief (Q3/Q4 2026 of 2027).

## 2. Bybit EU vs globaal
| Aspect | bybit.com | bybit.eu |
|---|---|---|
| Entiteit | niet-EU | Bybit EU GmbH, Wenen (MiCAR) |
| Perps | ja (100×) | nee — wacht op MiFID II |
| Leverage-cap perps (toekomst) | 100× | wrs ESMA-grens 2× retail / 10× pro (ONZEKER) |
| API-host | `api.bybit.com` | `api.bybit.eu` |
| API-schema | Bybit V5 | **zelfde V5** |
| Passphrase | nee | nee |

EU-key werkt niet op globale host en vice versa (gebonden aan entiteit).

## 3. API — Bybit V5
Auth (geen passphrase), 4 headers: `X-BAPI-API-KEY`, `X-BAPI-TIMESTAMP` (ms), `X-BAPI-RECV-WINDOW` ("5000"), `X-BAPI-SIGN`.
`sign = HMAC-SHA256(secret, timestamp+apiKey+recvWindow+querystring/body).toLowerCase()`.

Endpoints (`category=linear` voor USDT-perps):
| Doel | Endpoint | Noot |
|---|---|---|
| Balance | `GET /v5/account/wallet-balance` | `accountType=UNIFIED`/`CONTRACT` |
| Open posities | `GET /v5/position/list` | |
| Gesloten PnL | `GET /v5/position/closed-pnl` | **max 7 dagen/call**, 2 jr terug, limit 200, cursor |
| Executions/fills | `GET /v5/execution/list` | max 7 dagen, limit 100, cursor |
| Funding/transacties | `GET /v5/account/transaction-log` | |

Rate limits ~50/s (transaction-log 25/s). 7-daags window-patroon = zelfde als Kraken (Worker itereert ~52 calls/jaar).

## 4. Multi-TP / partial-close
`closed-pnl` = **1 record per reduce-event** (TP1/TP2/TP3 = 3 records), met `closedSize`,`avgEntryPrice`,`avgExitPrice`,`closedPnl`. **Geen positionId** → koppelen via `execution/list` (`orderId`, `seq`, `closedSize`, `execTime`). FIFO-reconstructie zoals onze Hyperliquid-logica. ONZEKER of er ergens een echte positionId is (`positionIdx` is alleen 0/1/2 mode-flag).

## 5. CSV
Profiel → Account → Gegevens exporteren → product-type. **Trade History** (fill-niveau, aanbevolen) of **Closed P&L** (samenvattend). Verwachte kolommen (gereconstrueerd, **onbevestigd**): Symbol, Order/Trade ID, Side, Order Type, Qty, Exec Price, Exec Fee, Exec Value, Closed Size, Exec Time (UTC, ISO8601), Closed PnL. Onzeker of bybit.eu-export = bybit.com-export.

## 6. Schema-mapping
symbol→symbol; side Buy/Sell → long/short via FIFO-context; createdTime/updatedTime (ms)→entry/exitTime; avgEntryPrice/avgExitPrice→entry/exitPrice; closedSize→size; closedSize×avgEntryPrice→quoteSize; leverage→leverage; Σ execFee→fees; closedPnl→pnl (netto per Bybit-definitie). Side = order-zijde, niet positie-zijde → context bepaalt open/close.

## 7. Architectuur
Nieuwe `ExchangeAPI.bybit` (via Worker, `needsPassphrase:false`, host-var `api.bybit.eu` vs `api.bybit.com`). Worker-acties: test→wallet-balance, trades→closed-pnl over 7-daagse windows, open_positions→position/list, fills→execution/list.

## 8. Voorbereidingschecklist
**Nu (zonder live perps):**
- [ ] stub `ExchangeAPI.bybit` (no-op methodes, clean dispatcher).
- [ ] Worker-skeleton "bybit" action (signing + host-var) — als diff aan Denny.
- [ ] CSV-parser zodra Denny sample (globale bybit.com-export, wrs gelijke structuur) levert.
- [ ] inline sanity-test parser.
- [ ] 7-daags pagineer-patroon documenteren (= Kraken).

**Wacht op live perps + EU-account:**
- [ ] `api.bybit.eu` accepteert private endpoints?
- [ ] geeft closed-pnl een positionId?
- [ ] multi-TP FIFO valideren tegen echte data.
- [ ] CSV-kolommen bybit.eu bevestigen.
- [ ] leverage-caps definitief (MiFID II/ESMA).
- [ ] fixture-pattern `tests/bybit-partial.spec.js`.

## 9. Open vragen (Denny / live account)
1. bybit.eu-account of nog globaal?
2. geanonimiseerde Trade History CSV exporteerbaar (ook spot) om kolommen te bevestigen?
3. account-type UTA of CONTRACT?
4. accepteert api.bybit.eu nu al execution/closed-pnl voor spot?
5. One-Way of Hedge mode?

Bronnen: learn.bybit.com (MiCAR), PRNewswire MiFID II 5-sep-2025, bybit-exchange.github.io/docs/v5, CoinDesk apr-2026.
