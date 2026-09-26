<!-- Rapport van de web-search-agent, sessie 2026-09-26. Engels. Samenvatting en verwerking in docs/opdracht-kraken-fix-2026-09-26.md §3. -->

# Kraken Futures REST API + account-log CSV — research report for a browser-based trade journal

**Research date: 2026-09-26.** Everything marked **[verified live]** I confirmed myself with `curl` against `futures.kraken.com` today, or by parsing the four real Kraken CSV exports that already sit in `C:\Users\Denny\Documents\Tradejournal\`. The rest is cited to a URL.

## TL;DR — the five things that change the design

1. **The docs site moved.** `docs.kraken.com/api/docs/futures-api/...` is now **legacy** (`docs-legacy.kraken.com`). The authoritative, machine-readable sources are two OpenAPI 3.1 specs: **https://docs.kraken.com/openapi/futures-rest.yaml** (derivatives v3, 7.5k lines) and **https://docs.kraken.com/openapi/futures-history-rest.yaml** (history **v3**, 1.9k lines). Everything below is grounded in those. Index: https://docs.kraken.com/llms.txt
2. **`/api/history/v3/positions` exists, is officially documented, and is the single best endpoint for a journal** — it gives per-close `realizedPnL`, real `fee`, `executionPrice`, `executionSize`, `oldAverageEntryPrice`, `positionChange` and a `fillTime` that is the *position open time* (the natural partial-close grouping key). It is not in the endpoint list you gave me. ccxt added `fetchPositionsHistory` on it 6 days ago.
3. **`/derivatives/api/v3/fills` now has `realized_pnl` — but it is `null` the moment you paginate.** Verbatim from the spec: *"Null when the fill was recorded before this field was introduced, **or when the request uses `lastFillTime`** (the historical query path does not currently carry realised PnL)."* Plus `/fills` has **no fee field at all**, ever, and paginating costs 25 rate-limit tokens per page vs 2. `/fills` is the wrong backfill source.
4. **CORS is blocked for two independent reasons** — a proxy is unavoidable, and I proved it. **[verified live]**
5. **`demo-futures.kraken.com` is dead** (301 → marketing page), decommissioned 14 July 2026. Every library's sandbox mode for krakenfutures is now broken. Snapshot fixtures are the only test route. **[verified live]**

Two corrections to premises in your brief:
- **`cleared_order_id` does not exist** anywhere in the Kraken Futures API — not in either OpenAPI spec, not in ccxt, not in Kraken's own Python sample. I grepped all four. Don't map it.
- **`/api/history/v2` is not deprecated and is not a separate API.** It is an alias: `v2` and `v3` return byte-identical payloads and the same continuation token. **[verified live]** No deprecation notice exists anywhere.

---

## 1. Endpoint inventory

Base URLs (from the specs' `servers:` blocks):
- `https://futures.kraken.com/derivatives/api/v3`
- `https://futures.kraken.com/api/history/v3`

| Endpoint | Auth | Params | Page size / lookback | Cost |
|---|---|---|---|---|
| `GET /derivatives/api/v3/fills` | APIKey + Authent, read-only | `lastFillTime` (ISO string) | **100 rows**, sorted **desc** by `fillTime`; `lastFillTime` = exclusive upper bound → walk backwards. No documented time cap. | **2** without `lastFillTime`, **25** with |
| `GET /derivatives/api/v3/openpositions` | same | **none** (ccxt drops `params` entirely) | current only | 2 |
| `GET /derivatives/api/v3/accounts` | same | none | current only | 2 |
| `GET /api/history/v3/executions` | same | `since`, `before` (ms), `sort` (`asc`/`desc`, default `desc`), `continuation_token`, `count`, `tradeable` | `count` **silently capped at 1000** **[verified live: count=5000 → 1000 rows]** | 1 |
| `GET /api/history/v3/positions` | same | `since`, `before`, `sort`, `continuation_token`, `count`, `tradeable`, + booleans `opened`/`closed`/`increased`/`decreased`/`reversed`/`no_change` and `trades`/`funding_realization`/`settlement` | same 1000 cap | 1 (as `historicalexecutions`) |
| `GET /api/history/v3/account-log` | same | `since`,`before` (**ms**), `from`,`to` (**row IDs**, inclusive, start at 1), `sort`, `info[]` (~50 enum values), `count` (default **500**), `conversion_details` | **no continuation token** — page by `from`/`to` or `since`/`before` | 1–10 by `count` (see §7) |
| `GET /api/history/v3/accountlogcsv` | same | `conversion_details` only | **up to 500,000 most-recent rows**, no paging at all | 6 |
| `GET /api/history/v3/orders` / `/triggers` | same | as executions (+`opened`/`closed`) | 1000 cap | 1 |
| `GET /api/history/v3/market/{tradeable}/executions` | **public, no auth** | as executions | 1000 cap | 0 |
| `GET /derivatives/api/v3/history?symbol=` | public | `symbol` (req), `lastTime` | 100 trades, **max 7 days or last engine restart** | 0 |

`/api/history/v3/fills` does **not** exist (404). `/api/history/v1` and `/v4` → 302. **[verified live]**

### Authentication — and exactly which path string is signed

`Authent = base64( HMAC-SHA512( key = base64decode(api_secret), msg = SHA256(postData + Nonce + endpointPath) ) )`
Headers: `APIKey` (required), `Authent` (required), `Nonce` (**optional**).
Source: https://docs.kraken.com/exchange/guides/futures/rest

**The rule is: strip `/derivatives`, and only `/derivatives`.** Four independent confirmations:

1. **Official guide**: `endpointPath` example is `/api/v3/orderbook` while the Java sample in the same section calls `https://futures.kraken.com/derivatives/api/v3/sendOrder`.
2. **Kraken's own Go SDK** — `krakenfx/api-go`, `pkg/derivatives/rest.go`:
   ```go
   func Sign(privateKey string, data io.Reader, nonce string, endpointPath string) (string, error) {
       sha256Hash := sha256.New()
       io.Copy(sha256Hash, data)                                          // postData
       sha256Hash.Write([]byte(nonce + strings.TrimPrefix(endpointPath, "/derivatives")))
       return helper.Sign(privateKey, sha256Hash.Sum(nil))
   }
   ```
3. **Kraken's official Python sample** — `CryptoFacilities/REST-v3-Python/cfRestApiV3.py`:
   ```python
   def sign_message(self, endpoint, postData, nonce=""):
       if endpoint.startswith('/derivatives'):
           endpoint = endpoint[len('/derivatives'):]
       message = postData + nonce + endpoint
   ```
4. **Kraken's official Rust CLI** — `krakenfx/kraken-cli/src/auth.rs` docstring: `` `endpoint_path` — e.g. `/api/v3/accounts` ``.

So, concretely:

| Request URL | String fed to SHA256 (no nonce) |
|---|---|
| `https://futures.kraken.com/derivatives/api/v3/fills` | `/api/v3/fills` |
| `…/derivatives/api/v3/fills?lastFillTime=2026-01-01T00%3A00%3A00.000Z` | `lastFillTime=2026-01-01T00%3A00%3A00.000Z/api/v3/fills` |
| `https://futures.kraken.com/api/history/v3/account-log` | `/api/history/v3/account-log` ← **nothing stripped** |
| `…/api/history/v3/account-log?count=500&sort=asc` | `count=500&sort=asc/api/history/v3/account-log` |

ccxt produces both behaviours with one line — `ts/src/krakenfutures.ts` `sign()`:
```js
let auth = postData + '/api/';
if (api !== 'private') { auth += api + '/'; }   // api === 'history' → '/api/history/'
auth += endpoint;                                // 'v3/fills' | 'v3/account-log'
const hash = this.hash (this.encode (auth), sha256, 'binary');
const signature = this.hmac (hash, this.base64ToBinary (this.secret), sha512, 'base64');
```

**Three further signing traps:**
- **GET query params are `postData`** — the URL-encoded query string, no leading `?`, concatenated directly in front of the path with no separator. ccxt: `postData = this.urlencode(params)`. api-go: `data = strings.NewReader(request.URL.Query().Encode())`.
- **Breaking change, deadline already passed.** Before: hash the *decoded* query (`greeting=hello world`). After: hash *"the full, url-encoded URI component as it appears in the request"* (`greeting=hello%20world`). Kraken aimed to phase out the old method **1 October 2025** (announced in the changelog, [4 Aug 2025 — Derivatives REST v1](https://docs.kraken.com/exchange/changelog)). Build only the new way.
- **Nonce is genuinely optional** — ccxt sends no `Nonce` header at all and signs with an empty nonce, and that provably works in production. If you do send one, use ns precision or a counter suffix (Kraken's own Python sample: `str(int(time.time()*1000)) + str(counter).zfill(4)`; gocryptotrader switched ms→ns in [PR #854](https://github.com/thrasher-corp/gocryptotrader/pull/854) specifically because of ms collisions). Kraken's official remedy for stuck nonces: *"A new pair of api keys will automatically reset the nonce."* Up to 50 keys per account, each with its own counter.

---

## 2. Data shapes

### `FillJson` (`/derivatives/api/v3/fills`) — full current schema
`fill_id` (uuid) · `order_id` (uuid) · `symbol` · `side` (`buy`|`sell`) · `size` (number) · `price` (number) · `fillTime` (**ISO 8601 string**, `"2021-11-18T02:39:41.826Z"`) · `fillType` · `cliOrdId` (nullable, only if the order had one) · **`realized_pnl`** (nullable) · **`sequence_id`** (string).

`fillType` enum — **9 values**, and the spec's descriptions:
`maker` · `taker` · `liquidation` · **`partialLiquidation`** ("part of a partial liquidation to gradually reduce a position before full liquidation") · `assignor` ("user assigning their position due to failed liquidation") · `assignee` ("counterparty receiving an Assignment in PAS") · `takerAfterEdit` · `unwindBankrupt` · `unwindCounterparty`.
(`partialLiquidation` is missing from your list; there is no `assignment` value.)

`realized_pnl`, verbatim: *"Realised PnL for this fill, signed from the requesting account's perspective (positive = gain, negative = loss). **`0` when the fill opens or increases a position.** Null when the fill was recorded before this field was introduced, **or when the request uses `lastFillTime`**."*

`sequence_id`: *"Per-market monotonic sequential trade id, starting at 1 for each market… Encoded as a string because the value is a 64-bit unsigned integer… **Omitted for fills recorded before sequential trade ids were introduced.**"* → useful for gap detection.

**No `fee` field.** Confirmed in the schema and by a live-account test in [ccxt#29760](https://github.com/ccxt/ccxt/issues/29760): *"`fee.cost` is `None` and `fees` is `[]` on 100/100 trades. There is no fee field to parse."* ccxt therefore **estimates** fees as `cost × market[taker|maker]` using the static default tier (0.0005/0.0002) — not your actual volume tier. And because `liquidation`/`assignee` don't substring-match `taker`/`maker`, ccxt emits **no fee at all** for liquidation fills.

### `OpenPositionJson` (`/derivatives/api/v3/openpositions`)
`symbol` · `side` (**`long`|`short`**, marked `x-exhaustive`) · `size` · `price` ("average price at which the position was entered into") · `unrealizedPnl` · `unrealizedFunding` (nullable) · `pnlCurrency` (nullable enum `USD|EUR|GBP|USDC|USDT|BTC|ETH`, default USD) · `maxFixedLeverage` (nullable; present ⇒ isolated) · `greeks` (options only).

⚠️ **Documentation contradiction**: the endpoint description says *"The list is sorted descending by `fillTime`"* but **`fillTime` is not in the schema**. It *is* returned in practice — ccxt's doc-comment from a real response:
```json
{"side":"long","symbol":"pi_xrpusd","price":"0.7533","fillTime":"2022-03-03T22:51:16.566Z","size":"230","unrealizedFunding":"-0.001878596918214635"}
```
Also **no `fill_id`/position id** on open positions — your existing `${symbol}_${fillTime}_${side}` key is the right call.

### `/api/history/v3/executions` — and a real event-key trap
Envelope: `{accountUid, len, serverTime?, elements[], continuationToken}`; each element `{uid, timestamp (ms int), event{...}}`.

The current OpenAPI declares **two different event keys**:
- `HistoricalExecutionEvent` (private `/executions`) → `event.execution` — *lowercase* — wrapping `{execution: HistoricalExecution, takerReducedQuantity}`, where `HistoricalExecution` has a **single `order`** field (your own order), plus `oldTakerOrder`, `executionType` (`maker`|`taker`), `limitFilled`, `usdValue`, `markPrice`, `quantity`, `price`, `timestamp`, `orderData`, `partnerTradeId`, `regulatoryData`.
- `HistoricalExecutionEventSanitized` (public `/market/{tradeable}/executions`) → `event.Execution` — *capital E* — with **`makerOrder` + `takerOrder`**, no `executionType`.

But the **legacy rendered docs for the private endpoint show `event.Execution.execution` (capital E) with `order` inside** — https://docs-legacy.kraken.com/api/docs/futures-api/history/get-execution-events/. The spec and the rendered docs contradict each other on the casing. **Handle both keys** (`event.execution ?? event.Execution`).

Real public response **[verified live]**:
```json
{"elements":[{"uid":"6d7f99dd-...","timestamp":1790422737272,
  "event":{"Execution":{"execution":{
    "uid":"f55f3bfb-...",
    "makerOrder":{"uid":"a2d6870e-...","tradeable":"PF_XBTUSD","direction":"Buy","quantity":"0.0288","timestamp":1790422725929,"limitPrice":"84186","orderType":"Post","reduceOnly":false,"lastUpdateTimestamp":1790422725929},
    "takerOrder":{"...":"direction Sell, quantity 0.716, orderType Limit"},
    "timestamp":1790422737272,"quantity":"0.0288","price":"84186",
    "markPrice":"84190.74043291174","limitFilled":true,"usdValue":"2424.56"},
   "takerReducedQuantity":""}}}],
 "len":1,"continuationToken":"MTc5MDQyMjczNzI3MC82MTE1MTc3MzIwODE="}
```

**Answering your explicit question: `/executions` carries NO realized PnL.** It does, however, carry a **`positionUid`** — the current spec lists `positionUid` on `HistoricalOrder` (i.e. `…execution.order.positionUid`). Caveat: the older rendered docs don't show it, so treat it as present-but-verify-with-your-key. `direction` is `Buy`/`Sell`/**`Unknown`**; `orderType` has 15 values incl. `Liquidation`, `Assignment`, `Unwind`, `Block`, `Rfq`, `PartialLiquidation`, `CoveredLiquidation`, `Unknown`. `takerReducedQuantity` is documented as *"sometimes empty string"*.

**Pagination mechanics [verified live]** — three spellings of one concept:
- request param `continuation_token` (snake) · response body `continuationToken` (camel) · response header `Next-Continuation-Token`
- also a boolean response header `is-truncated: true|false`
- *"The `sort` parameter must be the same as in the previous request to continue listing in the same direction."*
I paged `sort=asc&count=2` and the token correctly advanced (page 1 first ts `1648029833450` → page 2 first ts `1648029834445`).

### `HistoricalPositionUpdate` (`/api/history/v3/positions`) — the richest record Kraken exposes
Element: `{uid, timestamp (ms, required), event:{PositionUpdate:{…}}}`. Inside:

`accountUid` · `tradeable` · `oldPosition` (signed string, req) · `oldAverageEntryPrice` (nullable) · `newPosition` (req) · `newAverageEntryPrice` (req) · **`fillTime`** (ms int, **nullable**) · **`fee`** · `feeCurrency` · **`realizedPnL`** · **`positionChange`** (`open`|`close`|`increase`|`decrease`|`reverse`|`noChange`|`unknown`) · **`executionUid`** · `executionPrice` · `executionSize` · `tradeType` (`userExecution`|`liquidation`|`partialLiquidation`|`assignment`|`unwind`|`unknown`) · `fundingRealizationTime` · `realizedFunding` · `settlementPrice` · **`timestamp`** (req) · `updateReason` (`trade`|`fundingRealisation`|`settlement`|`unknown`).

Real row (ccxt doc-comment):
```json
{"accountUid":"...","tradeable":"PF_DOGEUSD","oldPosition":"250","oldAverageEntryPrice":"0.08085",
 "newPosition":"0","newAverageEntryPrice":"0.08085","fillTime":1789643150594,
 "fee":"0.01013125","feeCurrency":"USD","realizedPnL":"0.05","positionChange":"close",
 "executionUid":"7bfe252a-...","executionPrice":"0.08105","executionSize":"250",
 "tradeType":"userExecution","fundingRealizationTime":1789646492483,
 "realizedFunding":"-0.00000764284","timestamp":1789646492483,"updateReason":"trade"}
```
The `unknown` fallbacks on `positionChange`/`tradeType`/`updateReason` were added [18 May 2026](https://docs.kraken.com/exchange/changelog) — this endpoint is actively maintained.

### `/derivatives/api/v3/accounts`
`{accounts: {cash: CashAccount, flex: FlexBalanceSummary, <symbol>: MarginAccount…}, result, serverTime}` — `cash` and `flex` are **required**, legacy margin accounts appear as `additionalProperties` keyed `fi_xbtusd` / `fv_…` (**lowercase**).
- `flex` (`type: multiCollateralMarginAccount`): `currencies{CODE:{quantity,value,collateral,available}}`, `balanceValue`, `portfolioValue`, `collateralValue`, `initialMargin`, `initialMarginWithOrders`, `maintenanceMargin`, `pnl`, `unrealizedFunding`, `totalUnrealized`, `totalUnrealizedAsMargin`, `marginEquity`, `availableMargin`, `portfolioMarginBreakdown`, `upnlInterestRate`. Formulae are in the spec, e.g. `marginEquity = [Balance Value USD × (1−Haircut)] + Total Unrealised PnL as Margin`.
- `cash`: flat `balances{eur:"0.0", xrp:"2.2"}`.
- `MarginAccount`: `currency` + `balances` + `auxiliary{af,pv,pnl,funding,usd}` + `marginRequirements{im,mm,lt,tt}` + `triggerEstimates`.

⚠️ ccxt's `fetchBalance()` returns **only one sub-account** (default `flex`) and ignores every flex aggregate (`collateralValue`, `marginEquity`, …) — read `balance.info.accounts`. Its `parseAccount` also builds `fi_XBTUSD` (mixed case) for legacy inverse margin accounts and will throw `BadRequest` because the API key is `fi_xbtusd`.

---

## 3. Symbol conventions and the two-row-per-trade structure

### Casing and prefixes **[verified live, `/instruments`, 300 instruments]**
`/instruments` returns **UPPERCASE** ids. Prefix census today: **PF_ 278** (`flexible_futures`, linear, multi-collateral) · **FF_ 10** (dated flexible futures) · **PI_ 4** (`futures_inverse` perps: `PI_XBTUSD`, `PI_ETHUSD`, `PI_LTCUSD`, `PI_XRPUSD`) · **FI_ 8** (dated inverse). `FF_` isn't in your list. `type` is `flexible_futures` | `futures_inverse` (+ `… index` for indices).

**Lowercase is not historical — it is still live on three surfaces**, and this is the #1 mapping bug:
| Surface | Casing |
|---|---|
| `/instruments`, `/tickers`, `/fills.symbol`, `/positions.tradeable` | `PF_XBTUSD` |
| `account-log` JSON `contract` / CSV `contract`+`symbol` | `pf_xbtusd` **[verified live in the CSV]** |
| `/accounts` margin-account keys | `fi_xbtusd` |
| Kraken Pro `futuresLedger.csv` `Asset` column | **`PF_BTCUSD`** — BTC, not XBT! **[verified]** |
ccxt carries an explicit comment for this: `// the account log spells the contract in lower case, the market ids are upper case`, and uses `safeStringUpper(income,'contract')`.

Inverse vs linear: `type === 'futures_inverse'` ⇒ inverse, settle = base (`PI_XBTUSD` → `BTC/USD:BTC`); everything else linear, settle = USD. `contractValueTradePrecision` is 0 for PI_ (integer contracts) and 4 for PF_.

### Why the account log has both a `usd` row and a `pf_xbtusd` row — **fully verified**
Kraken's own words: *"For each trade, there are two log entries: one which reflects the change to the balance of the Derivatives wallet, and the other which reflects the change to the position."* — https://support.kraken.com/articles/360057072571-interpreting-the-logs-derivatives

I verified this on a real 2667-row export:

| | **Cash leg** | **Position leg** |
|---|---|---|
| discriminator | `symbol != contract` (`asset != contract` in JSON) | **`symbol == contract`** |
| `symbol`/`asset` | collateral currency — **always `usd`** (402/402 rows) | the contract id, `pf_xbtusd` |
| `change` | signed cash delta | signed **position-size** delta |
| `new balance` | wallet balance | **running signed position size** ← the grouping key |
| carries | `realized pnl`, `fee`, `realized funding`, `trade price`, `mark price`, `funding rate` | `new average entry price`, `trade price`, `mark price` |
| fill rate (2667 rows) | `realized pnl` on exactly **402** | `new average entry price` on exactly **413** |

**The accounting identity holds exactly** — `change == realized_pnl − fee + realized_funding` on **402/402** cash legs, zero violations to 1e-6. (Independently reported for a different account in [ccxt#29760](https://github.com/ccxt/ccxt/issues/29760): 504/504 rows, zero error.) So **`realized pnl` is GROSS of fees** — do not subtract twice.

### `conversion` rows — **verified**
`type: conversion`, `contract` **empty**, `collateral` empty; comes in **pairs** (debit of source currency + credit of destination). Extra columns with `conversion_details=true`: `exchange rate`, `exchange rate from`, `conversion fee`, `conversion spread percentage`. Real row:
```
16b5814f-…,2026-06-06 12:07:02,flex,conversion,usd,,10.98430000000,10.98430000000,…,
   exchange rate=0.9995398265798992, exchange rate from=USDC, conversion fee=0.00000000000
```
820 conversion rows in my sample (410 `usd` + 326 `usdc` + 84 `eur`) — that is Kraken converting non-USD collateral to USD to settle PnL/fees. Kraken's definition: *"Conversion — Conversion of non-USD funds to USD (includes conversion fees)."* Because `contract` is empty, **conversions are not attributable to a trade** — treat them as wallet noise, not journal rows.

### Currency of realized PnL
For PF_ multi-collateral perps, **realized PnL is expressed in USD**, regardless of the collateral you hold: every one of the 402 cash legs had `symbol = usd` on an account funded in USDC/EUR. Cross-checked against `historyFuturesClosedPositions.csv` where `W&V Unit = USD`. The per-position `pnlCurrency` preference (`USD|EUR|GBP|USDC|USDT|BTC|ETH`, set via `/derivatives/api/v3/pnlpreferences`) can change this. Legacy inverse `PI_`/`FI_` accounts realize in the **base** currency (XBT) — `feeCurrency` on `/positions` and `collateral` in the log tell you which.

---

## 4. Known bugs and gotchas

### CORS — a proxy is mandatory, and here is the proof **[verified live]**
```
OPTIONS https://futures.kraken.com/derivatives/api/v3/fills
  Origin: https://syncjournal.nl
  Access-Control-Request-Headers: APIKey,Authent
→ 204 No Content
  access-control-allow-methods: GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS
  access-control-allow-headers: Accept, Authorization, Cache-Control, Expires, Pragma,
      Content-Type, DNT, If-Modified-Since, Keep-Alive, Origin, User-Agent,
      X-Requested-With, X-XSRF-TOKEN, x-korigin
  access-control-allow-credentials: true
  (no access-control-allow-origin at all)
```
Two independent blockers: (1) **no `Access-Control-Allow-Origin`** on `/derivatives/*`; on `/api/history/*` the header is present but **empty**. (2) `Access-Control-Allow-Headers` contains **neither `APIKey` nor `Authent` nor `Nonce`** — so the preflight would fail even if ACAO were fixed. `Vary: Origin` shows Kraken echoes an allowlist for its own first-party origins only. No workaround exists. This is a hard confirmation of your Cloudflare Worker architecture.

### HTTP status lies — three distinct error shapes **[all verified live]**
```
# 1. derivatives auth failure → HTTP 200 (!)
GET /derivatives/api/v3/fills
→ 200 {"result":"error","error":"authenticationError","serverTime":"2026-09-26T11:31:31.407Z"}

# 2. history auth failure → HTTP 401, completely different shape
GET /api/history/v3/account-log
→ 401 {"status":"unauthorized","reason":"You are not authorized to access this endpoint."}

# 3. errors[] array
GET /derivatives/api/v3/orderbook   (missing symbol)
→ 400 {"status":"BAD_REQUEST","result":"error","errors":[{"code":0,"message":"400 BAD_REQUEST"}],"serverTime":"…"}
```
**`if (!res.ok)` silently misses every derivatives auth failure.** Also `invalidArgument` arrives with a suffix — `{"error":"invalidArgument: symbol"}` — so match by **prefix**, not equality (ccxt keeps it in its `broad` map for exactly this reason).

Full `Error` enum from the spec (17 values), with Kraken's own descriptions:
`accountInactive` · **`apiLimitExceeded`** ("The API limit for **the calling IP address** has been exceeded") · `authenticationError` · `insufficientFunds` · `invalidAccount` · `invalidAmount` · `invalidArgument` · `invalidUnit` · `Json Parse Error` · `marketUnavailable` · `nonceBelowThreshold` · `nonceDuplicate` · `notFound` · `requiredArgumentMissing` · `Server Error` · **`Unavailable`** ("The endpoint being called is unavailable") · `unknownError`.

**`apiLimitExceeded` is per IP, not per key** — architecturally important for a shared Worker: all your community users share the Worker's egress IPs and therefore one budget, regardless of having their own keys.

**`result: "success"` ≠ the operation happened.** Kraken: *"this merely means that the request has been received and assessed successfully. It does not necessarily mean that the desired operation has been performed."*

ccxt bug worth knowing: `Unavailable` was mapped to `InsufficientFunds` for two years — [ccxt#24338](https://github.com/ccxt/ccxt/issues/24338). Retry with backoff; don't surface it as a funds problem.

### API keys
- **Spot keys do not work on Futures, still.** Create at `kraken.com/login-futures` (now 301 → `kraken.com/u/launch-futures`) → Settings → Create Key. `futures.kraken.com/trade/settings/api` is still live (HTTP 200 today). You **cannot** create a futures key from Kraken Pro's spot API settings page. This is the single most common `authenticationError` cause — e.g. [python-kraken-sdk#303](https://github.com/btschwertfeger/python-kraken-sdk/issues/303) (reporter: *"I can use api and sec to get the spot balance"*), [ccxt#18967](https://github.com/ccxt/ccxt/issues/18967). Source: https://support.kraken.com/articles/360022839451-how-to-create-an-api-key-for-kraken-derivatives
- **Permissions**: two axes — *General API*: No Access / **Read Only** / Full Access (excl. withdrawals); *Withdrawal API*: No Access / Full Access. **Read Only is sufficient for everything a journal needs**: every endpoint above declares `general-api-key-read-only` in its `security` block. Tell users: General API = Read Only, Withdrawal = No Access.
- **IP allowlists**: not offered for futures keys (only the two permission dropdowns). Spot got IP restriction in 2022; futures did not. Note the asymmetry with the IP-based rate limit.
- **Subaccounts**: *"API keys are generated and controlled separately on each subaccount"* and *"API Rate Limits are managed separately per account"* — https://support.kraken.com/articles/360042809671-understanding-derivatives-subaccounts and https://blog.kraken.com/product/api/unlocked-6-multi-strategy-operations-subaccounts-api-keys. **No master-key traversal and no subaccount param on `/accounts` or `/fills`.** One key per subaccount. `/account-log` returns top-level `accountUid` so you can at least assert which account you got. `GET /derivatives/api/v3/subaccounts` lists them.

### Demo environment — gone **[verified live]**
```
GET https://demo-futures.kraken.com/derivatives/api/v3/tickers
→ 301 → https://www.kraken.com/gb/features/futures
```
*"Our existing demo environment on demo-futures.kraken.com will be decommissioned at 13 UTC on Monday, 14 July"* — https://support.kraken.com/articles/360024809011-api-testing-environment-derivatives (last updated 7 July 2026). No replacement named. It never had `/api/history` anyway (python-kraken-sdk documents `get_account_log` as *"not available in the Kraken demo/sandbox environment"*). ccxt still hardcodes the demo URLs in `describe()['urls']['test']`, so `setSandboxMode(true)` now hits a marketing page.

### Timestamps — five formats across Kraken's own futures surfaces
| Surface | Field | Format |
|---|---|---|
| `/fills` | `fillTime` | ISO 8601 + ms + `Z` |
| all derivatives | `serverTime` | ISO 8601, UTC |
| `/openpositions` | `fillTime` | ISO 8601 (undocumented) |
| history JSON | `elements[].timestamp`, `PositionUpdate.timestamp/fillTime` | **ms epoch int** |
| history JSON | `account-log.date` | ISO 8601 (RFC 3339) |
| history JSON | `since`/`before` **params** | **ms epoch int** |
| `accountlogcsv` | `dateTime` | **`2026-06-06 12:07:02`** — space separator, no `T`, no `Z`, no ms **[verified]** |
| Kraken Pro `futuresLedger.csv` | `Datum` | ISO + ms + `Z` **[verified]** |
| Kraken Pro `futuresTrades.csv`, `historyFuturesClosedPositions.csv` | `Datum` / `Positie geopend` | **ms epoch** **[verified]** |

Everything is UTC; there is no timezone parameter. The `accountlogcsv` format is the dangerous one — `Date.parse("2026-06-06 12:07:02")` is treated as **local time** by some engines. Append `Z` explicitly.

**Also: Kraken Pro UI CSVs have localized headers** — the real files here are Dutch: `Datum`, `Zij`, `Koers`, `Hoeveelheid`, `Kosten`, `Paar`, `W&V`, `Tegoed`, `Openingskoers`, `Slotkoers`, `Positie geopend`, `Positie gesloten`. **[verified]** An importer keyed on English headers breaks for every non-English account. The `accountlogcsv` API output is *not* localized (always English) — another argument for it.

### `kfee applied` — an undocumented structural gotcha **[discovered in the real data]**
When the trading fee is paid with KFEE, Kraken emits **no cash leg** for that execution — only the position leg. 11 of 413 position legs in my sample were such orphans. The fee appears as a separate `kfee applied` row with `symbol: "fee"` and **`contract` empty**, so it cannot be attributed to a contract:
```
2026-01-06 20:06:18  futures trade  sym=pf_xbtusd contract=pf_xbtusd chg=-0.018 newbal=-0.018 tp=92476  (no cash leg)
2026-01-06 20:06:18  kfee applied   sym=fee       contract=          chg=-33.29136 newbal=19727.907447
```
Your pairing logic must tolerate orphan position legs, and `symbol: "fee"` is an undocumented `symbol` value (22 rows, also on `admin transfer`).

---

## 5. How third parties reconstruct positions

### ccxt `krakenfutures` — the reference implementation, current master
- `api` map: `private`/`public` → `https://futures.kraken.com/derivatives/api/` ; `history` → `https://futures.kraken.com/api/history/` (trailing slash; version prepended by `sign()`).
- **Version pinning** (`options.versions.history.GET`): `orders`, `executions`, `triggers`, `accountlogcsv` → **v2**; everything else falls through to `this.version = 'v3'`, so `account-log`, `positions`, `market/{symbol}/*` → **v3**. `historicalfundingrates` → v4, charts → v1.
- `options.access.history.GET` marks `orders`/`executions`/`triggers`/`accountlogcsv`/`account-log`/`positions` as `private` (signed) while `market/{symbol}/*` stay unsigned. Missing `'account-log': 'private'` was a real bug, fixed Aug 2025 ([#26604](https://github.com/ccxt/ccxt/pull/26604)).
- **`fetchMyTrades`** → `GET /derivatives/api/v3/fills`, and `lastFillTime` is **not implemented** (`// todo: lastFillTime: this.iso8601(end)`). `symbol`, `since` and `limit` are **client-side filters only**. So ccxt hands you the last 100 fills and stops — do not use it for backfill. `parseTrade` never reads `cleared_order_id` (doesn't exist) or `cliOrdId`, sets `amount: undefined` for inverse contracts, and emits **no realized PnL**.
- **`fetchPositions`** → `openpositions`; `side` passes through as `long`/`short`; `initialMargin`/`notional`/`liquidationPrice`/`markPrice`/`collateral`/`marginRatio` are all `undefined` (Kraken doesn't return them); `marginType` is inferred purely from the presence of `maxFixedLeverage`. It now throws `ExchangeNotAvailable` rather than reporting a flat account when `openPositions` is missing ([#29710](https://github.com/ccxt/ccxt/issues/29710)).
- **`fetchPositionsHistory`** (added **2026-09-20**, [#30503](https://github.com/ccxt/ccxt/pull/30503)) → `GET /api/history/v3/positions` with `{closed: true}`, `tradeable`, `since`+`sort:'asc'`, `count`, `before`. Its `parsePosition` history branch is the clearest published statement of Kraken's event semantics:
  ```js
  // the event describes the position it acted on: an open or an increase
  // describes the new position, a close, a decrease or a reversal the old
  // one together with the size that was closed
  const describesNewPosition = (positionChange === 'open') || (positionChange === 'increase');
  let signedSize = this.safeString (position, 'oldPosition');
  entryPrice = this.safeString (position, 'oldAverageEntryPrice');
  contracts  = this.safeString (position, 'executionSize');
  if (describesNewPosition) { signedSize = newPosition; entryPrice = newAverageEntryPrice; contracts = abs(signedSize); }
  else if (positionChange === 'reverse') { contracts = abs(signedSize); }
  if (Precise.stringGt (signedSize,'0')) side='long'; else if (Precise.stringLt(signedSize,'0')) side='short';
  ```
  It maps `realizedPnl` ← `realizedPnL`, `id` ← `executionUid`, `lastPrice` ← `executionPrice`, and **for history rows uses `timestamp`, not `fillTime`** — see §(a) below. It does **not** surface `fee`, `feeCurrency`, `realizedFunding`, `positionChange` or `tradeType` (only in `.info`).
- **`fetchLedger`** (added **2026-08-11**, [#29782](https://github.com/ccxt/ccxt/pull/29782)) → `GET /api/history/v3/account-log`, and it implements exactly the two-leg filter:
  ```js
  // each execution emits two rows: a cash leg(asset is a currency) and
  // a position-size leg(asset equals the contract id) - keep the cash legs only
  if ((asset !== undefined) && (asset !== contract)) { rows.push (row); }
  ```
  plus `request['count'] = limit * 2` to compensate, and a fee correction:
  ```js
  amount = Precise.stringSub (after, before);           // new_balance - old_balance
  if (feeCost !== undefined) amount = Precise.stringAdd (amount, feeCost);  // fee already deducted
  ```
  `referenceId` ← `safeString2(item,'execution','booking_uid')`. ⚠️ **`realized_pnl` is not mapped to any unified field** — it stays in `entry.info`. `parseLedgerEntryType` keys off the row's **`info`** string (`'futures trade'`→`trade`, `'funding rate change'`→`fee`, `'transfer'`→`transfer`, …).
- **`fetchFundingHistory`** (added 2026-09-17, [#30493](https://github.com/ccxt/ccxt/pull/30493)) → `account-log` with `info: 'funding rate change'`; `amount` ← `realized_funding`.
- **Rate limiting is wrong**: `rateLimit: 600` ms and **`cost: 1` on every single endpoint** — no differentiation for `fills`-with-`lastFillTime` (real cost 25) or `account-log`. [ccxt#29929](https://github.com/ccxt/ccxt/issues/29929): *"the throttler is wrong in both directions."*
- **`handleErrors`** handles `{error}` and `errors[0].message`, plus HTTP 429 → `DDoSProtection`. It does **not** inspect `result === "error"`, and the history API's `{"status":"unauthorized","reason":…}` shape is **not in its map at all**.
- Other flagged Kraken bugs in the source: `limitPrice` on history **order** events is known-bad, so ccxt deliberately returns `price: null` for most orders ([#27996](https://github.com/ccxt/ccxt/issues/27996) — *"limitPrice is returning inaccurate values"*). Don't derive entry price from order events; use fills or position updates. Order `status` is inferred (`// status not available in the response`).

### Kraken's own official clients
- `krakenfx/api-go` (`pkg/derivatives/rest.go`) implements `instruments`, `tickers`, `orderbook`, `history`, `accounts`, order management — **no history-API endpoints at all**.
- `krakenfx/kraken-cli` exposes `futures fills`, `futures history-executions`, `futures history-orders`, `futures history-triggers`, `futures history-account-log-csv`, `futures ws fills`, `futures ws account-log` — but **no `history-account-log` (JSON) and no `history-positions`**. Kraken's own tooling omits the two best endpoints for a journal.
- `CryptoFacilities/REST-v3-Python/cfRestApiV3.py` still targets `/api/history/v2/` and its `_get_historical_elements` pages on the `is-truncated` / `next-continuation-token` **headers**.

### Third-party journals / tax tools
I dispatched a dedicated search for TradesViz / Tradervue / TraderSync / Edgewonk / Koinly / CoinLedger; **it had not returned by the time I finished, so I am not going to assert anything about them.** What I can say from the primary evidence is the far more actionable finding:

**Kraken's own "Closed Positions" export is hard-capped and unusable as a journal source. [verified]** The four real exports in the repo:

| Export | Rows | Date range covered |
|---|---|---|
| `historyFuturesClosedPositions_2026-05-06.csv` | **exactly 50** | 2026-03-24 → 2026-05-02 |
| `futuresLedger_2026-05-06.csv` | **exactly 100** | 2026-04-30 → 2026-05-02 (2 days!) |
| `futuresTrades_2026-05-06.csv` | 369 | 2025-11-05 → 2026-05-02 |
| `account_log_…_2026-05-06T14-50-51Z.csv` | **2437** | **2025-11-05 → 2026-05-02 (account inception)** |
| `account_log_…_2026-09-26T11-02-51Z.csv` | **2667** | 2025-11-05 → 2026-06-06 |

The Closed Positions and Ledger UI exports are truncated to 50/100 rows; the **account log is the only complete source**. That is why any serious tool has to use it.

Its structure, verified: **one row per closing execution**, with partials sharing the position's open timestamp and entry price. Grouping the 50 rows by `(Positie geopend, Paar, Zij, Openingskoers)` collapses them to **21 distinct positions**:
```
opened 2026-03-23T06:25:53.439Z PF_XBTUSD short entry 70170 → 4 partial closes
   close … qty 0.0093 @ 70560 pnl -3.6270 id 5d95f1d1-…
   close … qty 0.0021 @ 70560 pnl -0.8190 id 131556d1-…
   close … qty 0.0021 @ 70560 pnl -0.8190 id 13a686f5-…
   close … qty 0.0021 @ 70560 pnl -0.8190 id 4f600032-…
```
`Positie geopend` carries ms precision; `Positie gesloten` is sometimes truncated to whole seconds. `W&V` is **gross** PnL (no fees). The `ID` is the **closing execution's** id and joins to `futuresTrades.csv`. This maps 1:1 onto `/api/history/v3/positions`: `fillTime` ↔ `Positie geopend`, `oldAverageEntryPrice` ↔ `Openingskoers`, `executionSize`/`executionPrice` ↔ `Hoeveelheid`/`Slotkoers`, `realizedPnL` ↔ `W&V`, `executionUid` ↔ `ID`.

---

## 6. Per-fill realized PnL — where it actually lives

**Yes, in three places, with different reliability:**

| Source | Field | Reliability |
|---|---|---|
| `GET /derivatives/api/v3/fills` | `realized_pnl` | **`null` as soon as you pass `lastFillTime`** → useless for backfill. No `fee` ever. |
| `GET /api/history/v3/account-log` (JSON) | `realized_pnl` + `fee` + `realized_funding`, per **cash leg**, joinable to a fill via `execution` | **The canonical source.** Identity verified 402/402. |
| `GET /api/history/v3/positions` | `realizedPnL` + `fee` + `feeCurrency` + `realizedFunding` per position-change event | **Best for a journal** — already position-scoped. |
| WebSocket `fills` feed | `fee_paid` + `fee_currency` per fill | Real-time only, no history. Notably the **only** place fills carry a real fee. |

### The account-log JSON endpoint, exactly
```
GET https://futures.kraken.com/api/history/v3/account-log
    ?since=<ms>&before=<ms>&from=<id>&to=<id>&sort=asc|desc&info=futures+trade&count=500&conversion_details=false
Headers: APIKey, Authent      (sign the full path: /api/history/v3/account-log)
```
Official cURL: `curl --request GET --url 'https://futures.kraken.com/api/history/v3/account-log?sort=desc&count=500' --header 'APIKey: …' --header 'Authent: …'`
- `since`/`before` are **ms timestamps**; `from`/`to` are **row IDs** (inclusive, starting at 1). Mixing these up is the classic bug.
- `sort` default is **`desc`** — set `asc` explicitly for a forward backfill.
- `info` filters server-side; the enum has ~50 values including `futures trade`, `futures liquidation`, `futures partial liquidation`, `futures assignor`, `futures assignee`, `futures_unwind`, `futures unwind bankrupt`, `futures unwind counterparty`, `covered liquidation`, `settlement`, `funding rate change`, `conversion`, `conversion credit`, `interest payment`, `kfee applied`, `transfer`, `subaccount transfer`, `cross-exchange transfer`, `position transfer`, `futures tax withheld`, `futures tax refund`, `portfolio auctioning`, `rfq`, `options trade`, `hedging trade`.
- **No continuation token on this endpoint** — page with `from`/`to` or `since`/`before`.

Response: `{accountUid, logs: [AccountLogEntry]}`. `AccountLogEntry` fields (all `required` per spec unless noted):
`id` (int64 ≥1, sequential) · `date` (RFC 3339) · `asset` · `contract` (nullable) · `booking_uid` (uuid) · **`execution`** (nullable; *"UID of the associated execution or transfer. For orders and trades, this is always a UUID. However, this field is also populated with 'cross-exchange transfer' references, which are not always UUIDs."*) · `info` (the type enum) · `margin_account` · `old_balance` · `new_balance` · `old_average_entry_price` (nullable) · `new_average_entry_price` (nullable) · `trade_price` (nullable) · `mark_price` (nullable) · `funding_rate` (nullable) · **`realized_pnl`** (nullable; *"PnL that is realized by reducing the position"*) · **`fee`** (nullable) · **`realized_funding`** (nullable) · `collateral` (nullable) · `conversion_spread_percentage` (nullable) · `liquidation_fee` (nullable; *"Not applicable for inverse futures"*) · and with `conversion_details=true`: `exchange_rate`, `conversion_fee`, `exchange_rate_from`.

Real response (ccxt doc-comment, a funding row):
```json
{"accountUid":"f92fc7de-2fce-4265-b806-4f3c1efb37ee","logs":[{
  "id":16,"date":"2026-09-17T12:00:00.000Z","asset":"usd","contract":"pf_dogeusd",
  "booking_uid":"124f43a6-389a-4349-abc6-06fc7eeac86b","collateral":null,"execution":null,
  "fee":0,"funding_rate":9.288451412e-7,"info":"funding rate change","margin_account":"flex",
  "mark_price":null,"new_average_entry_price":null,"new_balance":0,
  "old_average_entry_price":null,"old_balance":0.0002,"realized_funding":-0.0002,
  "realized_pnl":null,"trade_price":null,
  "conversion_spread_percentage":null,"liquidation_fee":null,"position_uid":null}]}
```

### JSON ↔ CSV field mapping (and what each is missing)

Real CSV header **[verified verbatim from both exports]**:
```
uid,dateTime,account,type,symbol,contract,change,new balance,new average entry price,trade price,
mark price,funding rate,realized pnl,fee,realized funding,collateral,conversion spread percentage,
liquidation fee,position uid,exchange rate,exchange rate from,conversion fee
```

| CSV | JSON | note |
|---|---|---|
| `uid` | `booking_uid` | unique per **leg** |
| `dateTime` | `date` | CSV loses the `T`/`Z`/ms |
| `account` | `margin_account` | `flex` for all 2667 rows here |
| `type` | `info` | identical lowercase enum |
| `symbol` | `asset` | |
| `contract` | `contract` | |
| `change` | — | **CSV only**; equals `new_balance − old_balance` |
| `new balance` | `new_balance` | |
| — | **`old_balance`** | **JSON only** |
| `new average entry price` | `new_average_entry_price` | |
| — | **`old_average_entry_price`** | **JSON only** |
| — | **`execution`** | **JSON only — the join key to `fills.fill_id`** |
| — | **`id`** | **JSON only — sequential, the stable pagination cursor** |
| `position uid` | `position_uid` | **empty in 0/2667 CSV rows; `null` in the JSON sample** |
| `liquidation fee`, `collateral` | same | also empty in 0/2667 CSV rows |

**The CSV is strictly weaker: no `execution`, no `id`, no `old_balance`, no `old_average_entry_price`.** Without `execution` you cannot join legs by id, and the obvious composite key is not unique — `(dateTime, contract, trade price, isPositionLeg)` had **90 collisions** in 815 trade legs **[verified]** (multiple fills in the same second at the same price). You must pair positionally, and even then raw adjacency fails 55/402 times because `conversion` rows interleave. **Filter to `type == 'futures trade'` first**, then pair adjacent rows: that works 402/413, the 11 failures being the KFEE orphans. In `sort=asc` order the **position leg comes first**, then the cash leg.

`/accountlogcsv` also **times out often** — [ccxt#29760](https://github.com/ccxt/ccxt/issues/29760): *"times out consistently in my tests (it returns up to 500k rows)."* python-kraken-sdk's docstring: *"If facing timeout errors, set client's TIMEOUT attribute temporarily."*

**Recommendation: use the JSON `/api/history/v3/account-log` for sync, and treat the CSV as an import-only fallback.**

---

## Coordinator question (a): which field is the EXECUTION time?

**Your suspicion is correct, and this is the fix.**

| Endpoint | Event/execution time | Position open time |
|---|---|---|
| `/api/history/v3/positions` | **`elements[].timestamp`** (required) and `event.PositionUpdate.timestamp` (required) | **`fillTime`** (nullable) — the average-entry fill time, **identical for every partial of the same position** |
| `/api/history/v3/executions` | `elements[].timestamp` = `…execution.timestamp` | `…execution.order.timestamp` is the *order placement* time, not the position open |
| `/api/history/v3/account-log` | `date` / CSV `dateTime` | not present — derive it by walking `new_balance` back to 0 |
| `/derivatives/api/v3/fills` | `fillTime` (here it *is* the execution time) | n/a |
| `/openpositions` | n/a | `fillTime` |

So on `/positions`: **order and stamp every event by `timestamp`; use `fillTime` only as the position-grouping key.** ccxt's `parsePosition` does exactly this:
```js
if (isHistory) { timestamp = this.safeInteger (position, 'timestamp'); datetime = this.iso8601 (timestamp); }
else           { datetime  = this.safeString (position, 'fillTime');  timestamp = this.parse8601 (datetime); }
```
Note the schema asymmetry that likely caused the bug: `timestamp` is `required`, `fillTime` is `type: [integer, 'null']` and **not** required. For `updateReason: fundingRealisation` rows the relevant clock is `fundingRealizationTime` (in the sample it equals `timestamp`). Both are ms epoch; `/openpositions.fillTime` is an ISO string — same name, different type across endpoints.

Independent confirmation: `historyFuturesClosedPositions.csv` has separate `Positie geopend` / `Positie gesloten` columns, and all 4 partials of the 2026-03-23 position share one `Positie geopend`. **[verified]**

## Coordinator question (b): per-entry `position_uid` / `execution` / balances?

**`execution`, `old_balance` and `new_balance`: yes — and they are enough. `position_uid`: it exists but is unpopulated — do not build on it.**

- **`execution`** — present in the JSON, `null`able, and it **is** the fill id, so `account-log.execution == fills.fill_id == positions.executionUid == executions.elements[].event.…execution.uid`. Confirmed by a live-account test in [ccxt#29760](https://github.com/ccxt/ccxt/issues/29760): *"The `execution` field is the `fill_id` from `fetchMyTrades`, so the two join directly."* It is also what pairs the cash leg to its position leg. **Absent from the CSV.**
- **`old_balance` / `new_balance`** — both present and both `required` in the JSON. On the **position leg**, `new_balance` is the **running signed position size**, which is all you need.
- **`position_uid`** — in the live JSON response (ccxt's captured sample shows `"position_uid": null`) but **not in the OpenAPI `AccountLogEntry` schema at all**, and in the CSV it is a header with **zero populated rows out of 2667** spanning 2025-11 → 2026-06 on a flex account. **[verified]** Treat it as reserved-but-dead.

### Verified deterministic reconstruction — no `position_uid` needed

I ran this against the real 2667-row account log and it closes perfectly:

1. Take `info == 'futures trade'` rows, sort by `id` ascending (CSV: reverse the file — it ships `desc`).
2. Pair each **position leg** (`asset == contract`) with the following **cash leg** (`asset != contract`) — in JSON, by shared `execution`. Tolerate orphan position legs (KFEE-paid fees).
3. Walk the position leg's `new_balance` per `contract`: `0 → ±x` opens a position; `|new| > |old|` increases; `|new| < |old|` is a partial close; `→ 0` closes; `old × new < 0` is a reversal.
4. Per position accumulate `realized_pnl`, `fee`, `realized_funding` from the paired cash legs. Take entry price from the position leg's `new_average_entry_price` (constant across all reduce legs — on the position I traced it stayed `60504.4396551724138` through all 4 partial closes).

Results on the real file:
```
position legs 413 | opens 107 | full closes 107 | reversals 0
final running sizes: {pf_xbtusd: 0.0, pf_ethusd: 0.0}     <- closes exactly
reconstructed closed positions: 107
sum realized pnl -87.3235 | fees 93.0703 | funding 0.1084 | NET -180.2854

pf_xbtusd short entry=77000.14 size=0.0196 legs=5 partialCloses=1 pnl= 1.9628 fee=1.5082 fund= 0.00530
pf_xbtusd short entry=76668.00 size=0.019  legs=2 partialCloses=1 pnl=-9.8990 fee=1.4616 fund= 0.00220
pf_xbtusd long  entry=77241.00 size=0.0183 legs=3 partialCloses=2 pnl= 3.3758 fee=1.4152 fund=-0.00570
pf_xbtusd short entry=75465.00 size=0.0097 legs=2 partialCloses=1 pnl=-5.4320 fee=0.7347 fund= 0.00030
pf_xbtusd short entry=60504.44 size=0.0232 legs=7 partialCloses=4 pnl=-11.4220 fee=1.4095 fund=-0.00090
```
The last one is the position I traced by hand: `-10.3438 + -0.7849 + -0.0979 + -0.1954 = -11.4220` exactly. 107 positions from 413 legs ≈ 3.9 legs each — consistent with the partial-TP style.

Annotated real sequence (scale-in then 4-part scale-out, `sort=desc` as exported):
```
dateTime             symbol      change    new balance  new avg entry     trade px  pnl        fee
2026-06-06 12:07:02  usd         -10.9843  0.           -                 60997     -10.3438   0.6405
2026-06-06 12:07:02  pf_xbtusd    0.021    0.           60504.4396551724  60997     -          -
2026-06-06 12:07:02  usd          -0.8337  0.           -                 60995     -0.7849    0.0488
2026-06-06 12:07:02  pf_xbtusd    0.0016  -0.021        60504.4396551724  60995     -          -
2026-06-06 12:07:02  usd          -0.104   0.           -                 60994     -0.0979    0.0061
2026-06-06 12:07:02  pf_xbtusd    0.0002  -0.0226       60504.4396551724  60994     -          -
2026-06-06 12:07:02  usd          -0.2085  0.           -                 60993     -0.1954    0.0122
2026-06-06 12:07:02  pf_xbtusd    0.0004  -0.0228       60504.4396551724  60993     -          -
2026-06-06 10:21:47  usd          -0.0484  0.           -                 60497      0.        0.0484
2026-06-06 10:21:47  pf_xbtusd   -0.0016  -0.0232       60504.4396551724  60497     -          -
2026-06-06 10:21:47  usd          -0.0061  0.           -                 60504      0.        0.0061
2026-06-06 10:21:47  pf_xbtusd   -0.0002  -0.0216       60504.9907407407  60504     -          -
2026-06-06 10:21:47  usd          -0.6474  0.           -                 60505      0.        0.6474
2026-06-06 10:21:47  pf_xbtusd   -0.0214  -0.0214       60505.            60505     -          -
```
Note `realized pnl == 0` on the three opening legs (matching the `/fills` doc: *"`0` when the fill opens or increases a position"`*) and that `new average entry price` correctly stays frozen through the reduces.

`funding rate change` rows **do** carry `contract` (995/995) plus `realized funding` and `funding rate`, so funding **is** attributable to a contract; `conversion` and `kfee applied` rows are not. **[verified]**

---

## 7. 2025–2026 changes

Sources: https://docs.kraken.com/exchange/changelog, the two OpenAPI specs, https://github.com/ccxt/ccxt/commits/master/ts/src/krakenfutures.ts, live probes.

- **Docs restructured** — `docs.kraken.com/api/docs/futures-api/...` → legacy; new home is `docs.kraken.com/api-reference/...` plus the two OpenAPI YAMLs. Many old deep links now 404. Update any bookmarks.
- **`/fills` gained `realized_pnl` and `sequence_id`** — in the current spec, **not announced in the changelog**. With the explicit caveat that `realized_pnl` is null on the `lastFillTime` path.
- **`/api/history/v3/positions` is a first-class documented endpoint**, extended 18 May 2026 with `unknown` enum fallbacks on `positionChange`/`tradeType`/`updateReason`.
- **4 Aug 2025 — auth breaking change announced**, phase-out of decoded-query hashing targeted at **1 Oct 2025**. Sign the URL-encoded query string.
- **14 July 2026 — `demo-futures.kraken.com` decommissioned. [verified dead]** No replacement sandbox.
- **22 June 2026 — Fee Schedules DEPRECATED.** *"the fee values returned by these endpoints no longer reflect the fees actually charged on Futures trades… Futures fee calculation has been migrated to a centralised Kraken fee service — use the Spot `GetTradeVolume` endpoint"* (with a **Spot** API key, and a new `aclass: derivatives` option added 16 June 2026). `feeScheduleUid`, `FeeSchedule`, `FeeScheduleVolumes`, `FeeTier` all deprecated. So the fee *rate* now needs a spot key — another reason to read the actual `fee` from the account log rather than computing it.
- **20 Aug 2026** — `/rfq-assignment/max-leverage` (GET/PUT/DELETE) added.
- **8 Sept 2026 — Maker Protection**, live on selected markets from 24 Sept 2026: non-post-only order actions are held for a fixed window (`makerProtectionMillis` on `/instruments`). Can surface as `iocWouldNotExecute` / `CANCELLED_BY_SELF_TRADE`. Read-only journal impact: none, but it changes fill timing/`fillType` distributions.
- **8 March 2025** — FIX now supports futures.
- **Kraken Pro merge**: `kraken.com/login-futures` 301 → `kraken.com/u/launch-futures`; `futures.kraken.com/trade/settings/api` still live and still the only place to create futures keys. Kraken Pro's Export page (Product → "Derivatives") is the UI route to the account log. **Separate platform warning**: https://support.kraken.com/articles/pnl-calculations is about **Kraken Derivatives US** (NinjaTrader Clearing / Bitnomial, CFTC-regulated, launched mid-2026) — a different venue from futures.kraken.com. Its *"Realized PnL = (Exit − Entry) × Size − Total Fees"* is **net of fees**, which contradicts the account log's `realized_pnl` (gross, fee in its own column). Don't cross-apply.
- **History v2**: still alive, still undeprecated, byte-identical to v3. **[verified]** Build on v3 (what Kraken documents), but don't panic if a library uses v2.
- **Rate limits** (current, https://docs.kraken.com/exchange/guides/futures/ratelimits — note the URL moved too):
  - `/derivatives`: **500 per 10 s**. `accounts`/`openpositions`/`openorders` = 2 · `fills` **no** `lastFillTime` = **2** · `fills` **with** `lastFillTime` = **25** · `sendorder`/`editorder`/`cancelorder` = 10 · `cancelallorders` = 25 · `unwindqueue` = 200 · `withdrawaltospotwallet` = 100 · `batchorder` = 9 + batch size.
  - `/history`: a **separate** pool of **100 tokens replenishing 100 per 10 minutes** (~10/min — very slow). `historicalorders`/`historicaltriggers`/`historicalexecutions` = 1; `accountlogcsv` = 6; `accountlog` = 1 (count 1–25) / 2 (26–50) / **3 (51–1000)** / 6 (1001–5000) / 10 (5001–100000).
  - 429 carries a `rate-limit-reset` header ("seconds until a repeat request of the same cost will be accepted").
  - ⚠️ **Spec/limit contradiction**: the shared `count` parameter says *"silently capped at 1000"* (I confirmed 1000 live), yet the rate-limit table prices `accountlog` counts up to **100,000**. `account-log` has its own `count` (default 500) and is probably not subject to the 1000 cap — **test it with your key before relying on it.** `count=1000` at 3 tokens is the documented sweet spot.

---

## Concrete recommendations for the journal

1. **Primary sync: `GET /api/history/v3/positions?closed=true&decreased=true&sort=asc&since=<cursor>&count=1000`.** One row per close/partial-close with `realizedPnL`, real `fee`, `executionPrice`, `executionSize`, `oldAverageEntryPrice`. Group partials by `(tradeable, fillTime, sign(oldPosition))`; order events by **`timestamp`**. Page via `Next-Continuation-Token` / `continuationToken`.
2. **Secondary / reconciliation: `GET /api/history/v3/account-log?sort=asc&count=500`.** Verify `new_balance − old_balance == realized_pnl − fee + realized_funding` per cash leg as a self-check, and take funding from `info == 'funding rate change'` rows (they carry `contract`). Persist the last `id` as the cursor.
3. **Drop `/fills` from the backfill path.** No fee, `realized_pnl` null when paginated, 25 tokens/page. Keep it only for a fast "latest 100 fills" freshness probe (cost 2).
4. **Fix the proxy's time field.** Use the event `timestamp`, never `fillTime`, for ordering. Keep `fillTime` as the position key.
5. **Fix error handling.** Never `res.ok`. Handle three shapes: `{result,error,serverTime}` at HTTP 200; `{status:"unauthorized",reason}` at 401 (history only); `{result,errors:[{code,message}]}`. Prefix-match `invalidArgument`.
6. **Pace against the history pool**, not the derivatives pool: 100 tokens / 10 min. A first full backfill takes minutes — tell the user, and make the cursor resumable. And remember `apiLimitExceeded` is **per IP**, so your Worker's egress shares one budget across the whole community: queue per user server-side.
7. **Normalize casing at the boundary.** `contract`/`asset` are lowercase, market ids uppercase; `futuresLedger.csv` says `PF_BTCUSD` where the API says `PF_XBTUSD`.
8. **CSV importer**: three timestamp formats (space-separated UTC from `accountlogcsv`, ISO+Z from `futuresLedger`, ms epoch from `futuresTrades`/`historyFuturesClosedPositions`), localized headers, and a warning that the Closed-Positions/Ledger UI exports are capped at 50/100 rows — steer users to the account log.
9. **Tolerate KFEE orphans** (position leg with no cash leg) and the empty `position uid` / `collateral` / `liquidation fee` columns.
10. Read-only keys suffice; never log the `Authent` header; and note there is no sandbox any more — the snapshot-fixture pattern is the only autonomous test route.

---

## Sources

**Official — OpenAPI (authoritative)**
1. https://docs.kraken.com/openapi/futures-rest.yaml — derivatives v3 spec
2. https://docs.kraken.com/openapi/futures-history-rest.yaml — history v3 spec
3. https://docs.kraken.com/llms.txt — docs index / base URLs / auth summary

**Official — guides & reference**
4. https://docs.kraken.com/exchange/guides/futures/rest — auth algorithm, `endpointPath`, Oct-2025 breaking change
5. https://docs.kraken.com/exchange/guides/futures/introduction — symbols, key creation, base URLs (**still lists `/api/history/v2/` — contradicts the v3 spec**)
6. https://docs.kraken.com/exchange/guides/futures/ratelimits — both cost tables
7. https://docs.kraken.com/exchange/changelog — 2025–2026 derivatives entries
8. https://docs.kraken.com/api/docs/futures-api/trading/get-fills/ · https://docs.kraken.com/api/docs/futures-api/trading/get-open-positions/
9. https://docs.kraken.com/api-reference/account-history/get-account-log · .../account-log-csv · .../get-order-events · .../get-trigger-events
10. https://docs-legacy.kraken.com/api/docs/futures-api/history/get-execution-events/ · .../get-position-events/ · .../account-log/ · .../account-log-csv/
11. https://docs.kraken.com/exchange/api-reference/futures-websocket/fills (`fee_paid`/`fee_currency`) · .../account_log
12. https://docs.kraken.com/api-reference/market-data/get-tickers · https://docs.kraken.com/api-reference/account-information/get-open-positions

**Official — support**
13. https://support.kraken.com/articles/360057072571-interpreting-the-logs-derivatives — the two-rows-per-trade rule, full CSV field table (upd. 22 Apr 2026)
14. https://support.mtf.kraken.com/hc/en-us/articles/360017798918-Interpreting-the-logs — older MTF variant
15. https://support.kraken.com/articles/360022839451-how-to-create-an-api-key-for-kraken-derivatives — permission levels
16. https://support.kraken.com/articles/360024809011-api-testing-environment-derivatives — **demo decommission notice**
17. https://support.kraken.com/articles/360042809671-understanding-derivatives-subaccounts — per-subaccount keys & limits
18. https://support.kraken.com/articles/pnl-calculations — **Kraken Derivatives US**, net-of-fees definition (different venue)
19. https://blog.kraken.com/product/api/unlocked-6-multi-strategy-operations-subaccounts-api-keys

**Official code**
20. https://github.com/krakenfx/api-go — `pkg/derivatives/rest.go` `Sign()`, `internal/helper/signature.go`
21. https://github.com/krakenfx/kraken-cli — `src/auth.rs` (signing + ns nonce), README command table
22. https://github.com/CryptoFacilities/REST-v3-Python/blob/master/cfRestApiV3.py — `sign_message`, `_get_historical_elements`
23. https://github.com/CryptoFacilities/WebSocket-v1-Python/blob/master/cfWebSocketApiV1.py — WS challenge signing
24. https://github.com/krakenfx — org index

**ccxt**
25. https://github.com/ccxt/ccxt/blob/master/ts/src/krakenfutures.ts · https://github.com/ccxt/ccxt/commits/master/ts/src/krakenfutures.ts · https://docs.ccxt.com/docs/exchanges/krakenfutures
26. Issues/PRs: [#29760](https://github.com/ccxt/ccxt/issues/29760) (fees invisible; account-log verified) · [#29782](https://github.com/ccxt/ccxt/pull/29782) (fetchLedger) · [#30503](https://github.com/ccxt/ccxt/pull/30503) (fetchPositionsHistory) · [#30493](https://github.com/ccxt/ccxt/pull/30493) (fetchFundingHistory) · [#26604](https://github.com/ccxt/ccxt/pull/26604) (account-log unsigned) · [#29929](https://github.com/ccxt/ccxt/issues/29929) (uniform costs) · [#29710](https://github.com/ccxt/ccxt/issues/29710) (positions fail-open) · [#27958](https://github.com/ccxt/ccxt/issues/27958) · [#27996](https://github.com/ccxt/ccxt/issues/27996) (bad limitPrice) · [#24338](https://github.com/ccxt/ccxt/issues/24338) (Unavailable) · [#19896](https://github.com/ccxt/ccxt/issues/19896) · [#19646](https://github.com/ccxt/ccxt/issues/19646) (batchorder signing) · [#18967](https://github.com/ccxt/ccxt/issues/18967)

**Other clients / libraries**
27. https://github.com/btschwertfeger/python-kraken-sdk — `base_api/__init__.py` (`removeprefix("/derivatives")`), `futures/user.py` ("not available in the demo environment"), [#303](https://github.com/btschwertfeger/python-kraken-sdk/issues/303)
28. https://github.com/thrasher-corp/gocryptotrader — `exchanges/kraken/kraken_futures.go`, [PR #854](https://github.com/thrasher-corp/gocryptotrader/pull/854) (ns nonce), [PR #2387](https://github.com/thrasher-corp/gocryptotrader/pull/2387) (scrub `Authent` from logs)
29. https://github.com/nautechsystems/nautilus_trader/issues/3871 (WS challenge race) · /issues/5042 (undeclared fill lookback)
30. https://github.com/freqtrade/freqtrade/issues/10685 · https://github.com/krakenfx/kraken-cli/issues/36 (both now moot — demo is dead)

**Primary data (local, first-hand)**
31. `C:\Users\Denny\Documents\Tradejournal\account_log_bacb6956-a5a3-487b-93ba-db8745d1a33b_2026-09-26T11-02-51Z.csv` — 2667 rows, 2025-11-05 → 2026-06-06; the source for the CSV header, the two-leg structure, the accounting identity, the 107-position reconstruction, the KFEE orphans, and the always-empty `position uid`
32. `…_2026-05-06T14-50-51Z.csv` (2437 rows) · `historyFuturesClosedPositions_2026-05-06.csv` (50 rows, capped) · `futuresLedger_2026-05-06.csv` (100 rows, capped) · `futuresTrades_2026-05-06.csv` (369) · `futuresOrders_2026-05-06.csv` (239)
33. Working scratch copies of the specs and scraped docs: `C:\Users\Denny\AppData\Local\Temp\claude\c--Users-Denny-Documents-Tradejournal\ab4ec195-2294-44a8-80f6-9d4d64de495c\scratchpad\` (`fut-rest.yaml`, `fut-hist.yaml`, `kf.ts`, `cfrest.py`, `apigo-rest.go`, `kcli-auth.rs`, `changelog.md`, `fut-ratelimits.md`, `legacy-exec.md`, `.firecrawl/`)

## Caveats
- **Section 5's commercial-journal coverage is incomplete.** My dedicated TradesViz / Tradervue / TraderSync / Edgewonk / Koinly / CoinLedger search had not returned when I finished, and I have deliberately asserted nothing about them. Worth a follow-up if you care; the primary-data finding (Kraken's own Closed-Positions export is capped at 50 rows, so the account log is the only complete source) is the actionable part and is verified.
- **Not verifiable without a live API key**: that `/fills` really returns `realized_pnl`/`sequence_id` today (spec says yes, changelog is silent); that `account-log` `count` exceeds 1000; that `positionUid` is really populated on `…execution.order`; that `position_uid` is truly always null in the JSON (0/2667 in the CSV is strong but is one account). All four are cheap to confirm with a read-only key via the `?dev=1` snapshot button.
- **Documentation contradictions found**, listed so you don't trust one source blindly: `fillTime` returned by `/openpositions` but absent from its schema · the private `/executions` event key (`event.execution` in the spec vs `event.Execution` in the rendered docs) · the intro guide still advertising `/api/history/v2/` while the spec is v3 · `count` "capped at 1000" vs the rate-limit table pricing up to 100,000 · `position_uid` in live responses but not in the schema · `realized_pnl` gross (account log) vs net of fees (Kraken Derivatives US PnL article).