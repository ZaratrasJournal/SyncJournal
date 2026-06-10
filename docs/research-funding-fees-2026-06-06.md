# Funding-fees per trade — exchange-API research

**Datum**: 2026-06-06
**Status**: research-fase afgerond (exchange-integrator × 4, parallel). Nog géén code geschreven.
**Backlog-item**: "Funding-fees per trade tracken" (~3-4 dagen, 4 exchanges) → deblokkeert Scenario O + Funding/Fees waterfall.

## Doel

Crypto-perpetuals rekenen funding elke 1/4/8u af op open posities. SyncJournal telt die kosten nu nergens mee, waardoor True PnL onnauwkeurig is voor trades die een funding-cycle overspannen. Target:

```
True PnL = realizedPnl − tradeFees − fundingFees
```

Target-schema (per trade):
- `t.fundingFees` (number, default 0)
- `t.fundingEvents[]` = array van `{ts, amount, rate, intervalHours}`

## Samenvatting per exchange

| Exchange | Endpoint | Auth / proxy | Risico | Interval |
|---|---|---|---|---|
| **Hyperliquid** | `POST /info` `type:"userFunding"` | Public, wallet-only → géén proxy | 🟢 Laag | 1u (hard) |
| **MEXC** | `GET /api/v1/private/position/funding_records` | Signed → Worker | 🟢 Laag | `collectCycle` uit contract-detail (meestal 8u) |
| **Kraken Futures** | `GET /api/v3/accountlog` `info="Funding Rate Change"` | Signed → Worker | 🟡 Middel | afleiden / 4u-aanname |
| **Blofin** | géén dedicated funding-endpoint gevonden | Signed → Worker | 🔴 Hoog | dynamisch (8/4/1u sinds dec 2025) |

**Aanbevolen bouwvolgorde**: Hyperliquid → MEXC → Kraken → Blofin (omgekeerd t.o.v. oorspronkelijk backlog).

---

## Hyperliquid 🟢 — begin hier

**Request**
```
POST https://api.hyperliquid.xyz/info
{ "type": "userFunding", "user": "0x<wallet>", "startTime": <ms>, "endTime": <ms?> }
```
- `startTime` is **required**, `endTime` optioneel (default now).

**Auth**: puur public, alleen wallet-adres (geen secret). Kan client-side zónder Worker — mits CORS oké (één live test nodig).

**Response-shape** (numerieke velden zijn strings → `parseFloat`):
```json
[{ "time": 1732233600000, "hash": "0x00..", "delta": {
  "type": "funding", "coin": "BTC", "usdc": "-2.851187",
  "szi": "0.045", "fundingRate": "0.00005566", "nSamples": null } }]
```

**Sign**: `usdc` negatief = betaald, positief = ontvangen. Direct optelbaar.

**Mapping**:
```
ts:            event.time
amount:        parseFloat(delta.usdc)
rate:          parseFloat(delta.fundingRate)
intervalHours: 1
```

**Matching**: `delta.coin` (base, geen suffix) + `delta.szi` (signed → richting) + `time` binnen [entry..exit].

**Pagination**: max 500 events/call; pagineer op laatste `time` als nieuwe `startTime`; dedup op `hash`. Rate-limit 1200 weight/min — verwaarloosbaar bij 1 call/sessie.

---

## MEXC 🟢 — dedicated endpoint bestaat

**Endpoint**: `GET https://contract.mexc.com/api/v1/private/position/funding_records`
(backlog vermoedde `account/history?type=FUNDING_FEE` — onjuist; er is een echt funding-endpoint)

**Auth**: signed (ApiKey + HMAC-SHA256, `Request-Time` header). "View Order Details"-permissie volstaat. → via Worker.

**Response**:
```json
{ "id": 328033, "symbol": "SUSHI_USDT", "positionType": 1,
  "positionValue": 41.8899, "funding": 0.0837798, "rate": -0.002,
  "settleTime": 1606435200000 }
```
- `positionType`: 1=long, 2=short
- bedrag (`funding`) + `positionValue` in **USDT** voor USDT-M (geen contractSize-conversie nodig)

**Sign**: ⚠️ ONZEKER. Voorbeeld suggereert `funding>0` = ontvangen, `<0` = betaald (omgekeerd aan MEXC trade-fees die negatief uitkomen). Valideren met snapshot.

**Mapping**:
```
ts:            settleTime
amount:        funding (sign valideren!)
rate:          rate
intervalHours: collectCycle uit GET /api/v1/contract/detail?symbol=... (meestal 8)
```

**Matching**: `(symbol, positionType, settleTime∈[entry..exit])`. Mogelijk `position_id` in records — als die matcht met onze opgeslagen `positionId` is dat de schoonste route (valideren).

**Pagination**: `page_num`/`page_size` (max 100), `start_time`/`end_time`, optioneel `symbol`/`position_id`. Rate 20 req/2s.

---

## Kraken Futures 🟡 — account-log, matching-uitdaging

**Endpoint**: `GET https://futures.kraken.com/derivatives/api/v3/accountlog?info=Funding%20Rate%20Change`

**Auth**: signed (APIKey + Authent, HMAC-SHA512). Geen passphrase. → via Worker.

**Response** (`logs[]`):
```
date              ISO-string "2023-04-04T16:10:46.260Z"  (GEEN 1970-probleem hier)
info              "Funding Rate Change"
realized_funding  number  (negatief = betaald)
funding_rate      number
contract          "PF_XBTUSD"
asset             collateral-valuta
margin_account    wallet-id
id                cursor voor pagination
```

**Sign**: `realized_funding` negatief = afgeschreven (betaald). Cross-check: `old_balance − new_balance`.

**Mapping**:
```
ts:            date (ISO, direct bruikbaar)
amount:        realized_funding
rate:          funding_rate
symbol:        contract (strip "PF_"/"PI_" prefix)
intervalHours: 4-aanname OF verify via public /historicalfundingrates
```

**Matching-uitdaging**: geen positionId én geen `side`-veld. Strategie: match op `contract` + tijdvenster; bij meerdere open trades → pro-rata op size. Richting niet nodig voor True PnL (sign van `realized_funding` volstaat). Bij multi-collateral wallets ook op `margin_account` filteren.

**Pagination**: `before`/`since`/`from`/`to`/`count` (default 500, max 100k). Token-pool 100/10min; `count=1000` kost 3 tokens.

**Noot 1970-bug**: raakt de *fills*-endpoint, niet de account-log (`date` is ISO). Apart bug-item.

---

## Blofin 🔴 — geen funding-endpoint, open probleem

**Bevinding**: er is **geen** dedicated per-user funding-fee endpoint in de huidige Blofin REST API. Het backlog-vermoeden (`/api/v1/asset/bills?type=funding` of `/api/v1/account/bills`) bestaat niet zoals aangenomen:
- `GET /api/v1/asset/bills` = fondstransfers tussen accounts, geen funding-filter
- `GET /api/v1/market/funding-rate-history` = **publieke** marktrates, geen persoonsbedragen
- `GET /api/v1/trade/fills-history` = trade-fills + fees, **geen funding-settlements**

**Twee mogelijke routes** (beide met nadelen):
- **A — CSV-import**: Blofin-UI heeft mogelijk een "Funding Fee History" export. Past bij onze CSV-first filosofie en is exact. → **Eerst checken of die export bestaat.**
- **B — Reconstructie** (benadering): `fundingFee ≈ positionSize × fundingRate × markPrice` per settlement-tijdstip uit publieke `funding-rate-history` + gereconstrueerde positiegrootte uit fills. Niet exact bij partial-closes tussen settlements.

**Interval**: dynamisch sinds 9 dec 2025 (8u default, kan 4u/1u worden). Terugrekenen uit opeenvolgende `fundingTime`-waarden.

**Aanbeveling**: Blofin als laatste, en eerst bij Denny verifiëren of de UI een funding-CSV-export biedt. Zo niet → reconstructie-benadering of Blofin voorlopig uitstellen.

---

## Open punten — valideren met live snapshot (`?dev=1`)

1. **Hyperliquid CORS** — `fetch()` POST vanuit localhost-tab; als CORS-error → toch via Worker.
2. **MEXC sign-conventie** `funding`-veld — betaald vs ontvangen.
3. **MEXC `position_id`** in funding-records — matcht met onze opgeslagen positionId?
4. **Kraken exacte `info`-string** — "Funding Rate Change" vs lowercase; één call zonder filter doen en werkelijke waarden lezen.
5. **Kraken `side`** — bestaat er een (niet-gedocumenteerd) richting-veld in funding-entries?
6. **Blofin** — bestaat een funding-CSV-export in de UI?
7. **Historische diepte** per exchange (90 dagen? langer?).

## Nog te beslissen ontwerpkeuzes (vóór bouw)

Uit het backlog, nog niet beslist:
- Parallelle opens op zelfde pair+direction → funding pro-rata op size of toewijzen aan oldest-open?
- Open trade met lopende funding → live cumulatieve funding tonen in TradeDetailModal?
- Funding-event ná close (settle-lag) → toewijzen aan laatst-gesloten trade binnen 1 interval, anders aggregate-only?
- Funding-event zonder matchende trade → aggregate-only in Analytics-card.

## Proxy-dependency

MEXC/Kraken/Blofin vereisen elk een nieuwe action-handler in de **Cloudflare Worker** (signed calls kunnen niet client-side). Die deployt Denny zelf — wij leveren de diff aan (zie CLAUDE.md "Cloudflare Worker proxy"). Hyperliquid heeft dit niet nodig.

## Voorgestelde bouwvolgorde

1. **Schema + migratie + `netPnl()`-aanpassing** (no-op zonder data, veiligste eerste commit).
2. **Hyperliquid-adapter** `fetchFundingFees()` — proxy-vrij, end-to-end bewijs van schema + matching op één exchange.
3. **MEXC-adapter** (+ Worker-handler-diff voor Denny).
4. **Kraken-adapter** (+ Worker-handler-diff).
5. **Blofin** — alleen ná CSV-export-check; anders reconstructie of uitstel.
6. **Analytics**: Funding-card + Funding/Fees waterfall. Scenario O test-fixture.

## Bronnen

Hyperliquid: GitBook info-endpoint/perpetuals, funding mechanics, rate-limits; Chainstack/QuickNode userFunding refs.
MEXC: api-docs futures get-funding-fee-details; mexcdevelop apidocs contract_v1.
Kraken: docs.kraken.com futures-api account-log + historical-funding-rates + rate-limits.
Blofin: docs.blofin.com, blofin-sdk-python, funding-rate support-artikelen.
