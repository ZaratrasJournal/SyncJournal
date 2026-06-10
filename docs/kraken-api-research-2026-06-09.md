# Kraken API — oud vs. nieuw (volledig onderzoek)

**Datum**: 2026-06-09
**Bron**: https://docs.kraken.com/api/ (de nieuwe, geünificeerde docs-site)
**Methode**: hele site gemapt via firecrawl (235 links → 224 unieke doc-pagina's in 13 secties), changelog + alle overzichts-/auth-guides + de voor SyncJournal relevante Futures-endpoints gescrapet en gelezen.
**Aanleiding**: relevant voor onze openstaande Kraken-bugs — de **1970-timestamp-bug** en de **open-positie-dedup-vraag**.

---

## 1. TL;DR

- **"De nieuwe API" = vooral een geünificeerd docs-platform** (`docs.kraken.com/api`) dat álle Kraken-API's samenbrengt die vroeger over losse sites verspreid stonden (oude `api.kraken.com/0` Spot-docs + aparte `futures.kraken.com` docs + losse blog/guides). De onderliggende endpoints zijn grotendeels hetzelfde gebleven; het is geen "v2 REST" die de oude vervangt.
- **De echte versie-sprong zit bij WebSocket**: **WS v1 (legacy)** → **WS v2 (huidig, GA sinds 6 dec 2023)**. v1 blijft draaien maar krijgt amper nog features; v2 is waar Kraken nieuwe dingen op zet.
- **Spot REST is nog steeds "v1"** (`api.kraken.com/0/…`) en stabiel — wel veel nieuwe endpoints bijgebouwd (AmendOrder, Level3, GroupedBook, GetApiKeyInfo, Earn, Subaccounts).
- **Futures REST is "v3"** (`futures.kraken.com/derivatives/api/v3/…`) — **dit gebruikt SyncJournal**. Twee changes raken ons direct:
  1. **Auth-wijziging (uitgefaseerd 1 okt 2025)** — url-encoding bij het `Authent`-hashen. Waarschijnlijk **géén** breuk voor onze calls (simpele params), wél te verifiëren.
  2. **Fee Schedules-endpoints deprecated per 22 juni 2026** → fee-rate via Spot `GetTradeVolume` (met Spot-key).
- **Nieuw productlandschap** naast Exchange: **FIX API**, **Custody**, **OTC**, **Prime** (REST/FIX/WS), **Embed**, **Ramp**, en **OAuth "Kraken Connect"**.
- **Belangrijkste lead voor onze 1970-bug**: binnen Futures verschilt het **timestamp-formaat per endpoint** — `/fills` & `/openpositions` geven `fillTime` als **ISO-string**, maar de **history**-endpoints (`/historicalexecutions`, `account-history`) geven `timestamp`/`lastUpdateTimestamp` als **integer-milliseconden**. Onze parser verwacht ISO → als de bron naar het history-formaat wisselt, valt `fillTime` weg → epoch 0 → **1970**.

---

## 2. De geünificeerde API-structuur (de "nieuwe" docs)

De nieuwe site groepeert alles onder drie hoofdcategorieën (uit de site-navigatie):

| Categorie | API's |
|---|---|
| **Exchange** | Spot REST · Spot WebSocket (v2) · Futures REST · Futures WebSocket · Spot/Futures **FIX** |
| **Institutional** | **Custody** REST · **OTC** REST · **Prime** (REST/FIX/WebSocket) |
| **Embed** | **Embed** REST · **Ramp** REST · **OAuth** (Kraken Connect) |

Kraken benadrukt expliciet: er zijn **twee gescheiden trading-engines** (spot en futures) met eigen protocollen, endpoints, onboarding, **authenticatie**, rate limits en error-messages. Dat is precies waarom SyncJournal per-exchange-adapters heeft — en waarom Kraken Futures een eigen signing/parsing-pad heeft.

**Wat is hier "nieuw" t.o.v. vroeger?**
- Vroeger: Spot-docs op `api.kraken.com`/`docs.kraken.com/rest`, Futures-docs los op `docs.futures.kraken.com`, WS-docs weer apart. **Nu**: alles op één `docs.kraken.com/api` met één navigatie, één changelog, OpenAPI-stijl endpoint-pagina's.
- Nieuwe productlijnen (Custody/OTC/Prime/Embed/Ramp/OAuth) zijn de afgelopen ~2 jaar toegevoegd; die bestonden eerder niet of niet publiek gedocumenteerd.

---

## 3. Oud vs. nieuw per API-surface

### 3.1 Spot WebSocket — v1 (oud) → v2 (nieuw) — de duidelijkste breuk
- **v1** (`wss://ws.kraken.com` / `ws-auth.kraken.com`): legacy. Array-gebaseerde berichten, channel-namen als `ownTrades`, `openOrders`, `addOrder`. Krijgt sinds 2023 nauwelijks nog features (alleen pariteits-patches zoals `cl_ord_id`, `amendOrder`).
- **v2** (`wss://ws.kraken.com/v2`): **huidig**, GA sinds 6-12-2023. JSON-object-berichten met `method`/`channel`/`type`, kanalen `executions`, `balances`, `level3`, `instrument`, `ticker`, `book`, `ohlc`. Alle nieuwe functionaliteit komt hier: `trailing-stop`, `liquidated`-flag, native amends, L3-data, nanoseconde-timestamps, `snap_orders`/`snap_trades`.
- **L3-endpoint kreeg eigen host** (1-12-2025): `wss://ws-auth.kraken.com/v2` → `wss://ws-l3.kraken.com/v2`.
- 18 v2-pagina's vs. 18 v1-pagina's in de docs (zie bijlage). **Advies algemeen**: bouw nieuw op v2; v1 alleen voor legacy.

### 3.2 Spot REST — stabiele "v1", veel nieuwe endpoints
`api.kraken.com/0/public/…` en `/0/private/…` — ongewijzigd qua versie/auth (HMAC-SHA512 met nonce, API-Sign header). Toevoegingen sinds 2024:
- **AmendOrder** + **OrderAmends** (audit-trail van amends) — sep 2024.
- **Level3** (order-niveau L3 book) + **GroupedBook** — dec 2025.
- **GetApiKeyInfo** (key-config + usage) — mrt 2026.
- **Earn**-sectie (verving Staking, dat is verwijderd), **Subaccounts** (CreateSubaccount, AccountTransfer), **WithdrawMethods/Addresses**, export-endpoints (Ledgers/Trades export).
- `FOK` time-in-force, `cl_ord_id`/`sender_sub_id` client-IDs, xStocks (`asset_class`/`rebased`).
- Breuken: POST op publieke endpoints verwijderd (31-12-2023, gebruik GET); `.F`-asset-suffixen deprecated (12-11-2025); `no_mpp` deprecated (17-9-2025).

50 Spot-REST-endpoint-pagina's (zie bijlage).

### 3.3 Futures REST — "v3" — **relevant voor SyncJournal**
Host: `futures.kraken.com/derivatives/api/v3/…`. Auth via `APIKey` + `Authent` headers (HMAC-SHA512 over `postData + Nonce + endpointPath`, secret base64-decoded). `Nonce` is **optioneel** bij Futures.

**Wijzigingen die ons raken — zie §4 voor detail:**
- Auth url-encoding-wijziging (uitfasering oude methode 1-10-2025).
- Fee Schedules deprecated 22-6-2026.
- `unknown`-enum toegevoegd aan history-velden (17-5-2026).

76 Futures-pagina's (trading 47, websocket 13, charts 8, history 8 — zie bijlage). Relevante endpoints voor ons:
`get-fills`, `get-open-positions`, `history/account-history`, `history/get-execution-events`, `historical-funding-rates` (voor onze funding-feature!), `get-user-fee-schedule-volumes-v-3`.

### 3.4 Futures WebSocket
`account_log`, `fills`, `open_position`, `open_orders(_verbose)`, `balances`, `notifications`, `book`, `ticker(_lite)`, `trade`, `challenge` (auth-handshake), `heartbeat`. Niet door SyncJournal gebruikt (wij doen REST via de Worker), maar een latere live-feed-optie.

### 3.5 FIX API (nieuw, institutioneel)
20 pagina's. Sinds 2023 (Spot), sinds 7-3-2025 ook Futures-trading. Niet relevant voor ons (institutioneel, sessie-gebaseerd).

### 3.6 Nieuwe productlijnen
- **Custody REST** (institutional cold-storage; deposit/withdraw methods+addresses) — gedocumenteerd sinds feb 2025.
- **OTC REST** (quote-based block trading).
- **Prime** (REST/FIX/WebSocket — prime-brokerage: currency/exposure/subscribe).
- **Embed / Ramp / OAuth "Kraken Connect"** — voor partners die crypto inbouwen (users beheren, quote-based trades, webhooks, fast API-keys via OAuth2-gateway).

---

## 4. Futures deep-dive — wat raakt SyncJournal direct

### 4.1 ⏱ Timestamp-formaat verschilt per endpoint → lead voor de 1970-bug
Gemeten in de docs:

| Endpoint | Tijd-veld | Formaat |
|---|---|---|
| `/api/v3/fills` (get-fills) | `fillTime` | **ISO-8601 string** `"2020-07-22T13:37:27.077Z"` |
| `/api/v3/openpositions` | `fillTime` | **ISO-8601 string** (lijst gesorteerd op `fillTime`) |
| `/api/v3/historicalexecutions` (history/get-execution-events) | `timestamp`, `lastUpdateTimestamp` | **integer-milliseconden**; query `since`/`before` ook in **ms** |
| `account-history` (account log) | (zie §4.4) | events met `timestamp` |

**Onze adapter** `ExchangeAPI.kraken._normalise` leest `t.fillTime||t.open_time` en doet `closeT.split("T")` → verwacht dus een **ISO-string**. Komt de data uit het **history**-pad (integer ms, veld heet `timestamp` niet `fillTime`), dan is `fillTime` leeg → `date=""` → trade valt terug op epoch 0 → **1970-01-01**.

> **Hypothese voor de 1970-bug**: de Worker (of Kraken) levert trades nu (deels) uit een history/executions-bron met `timestamp` (ms-integer) i.p.v. `/fills` met `fillTime` (ISO). Te bevestigen met een **Kraken-snapshot** (`?dev=1`) — dan zie ik welk veld/formaat binnenkomt. Fix-richting: parser accepteert zowel `fillTime` (ISO) als `timestamp`/`lastUpdateTimestamp` (ms-integer → `new Date(ms)`), met een harde guard tegen epoch 0 (val terug op een ander tijd-veld i.p.v. 1970).

### 4.2 🔐 Auth url-encoding-wijziging (oude methode uit per 1-10-2025)
- **Oud**: hash de *gedecodeerde* query-string params (`greeting=hello world`).
- **Nieuw**: hash de *volledige url-encoded* URI-component (`greeting=hello%20world`).
- Backward-compatible geweest; oude methode wordt uitgefaseerd. **Vooral relevant voor `batchorder`** (JSON-body in query). Onze endpoints (accountlog/fills/openpositions) gebruiken simpele params zonder spaties/speciale tekens → **waarschijnlijk geen breuk**, maar de Worker-signing wel even langs deze regel leggen.

### 4.3 💸 Fee Schedules deprecated per 22-6-2026
- Velden/endpoints `feeScheduleUid`, `FeeSchedule`, `FeeScheduleVolumes`, `FeeTier`, `get-user-fee-schedule-volumes-v-3` worden uitgefaseerd. Fee-rate voortaan via **Spot `GetTradeVolume`** (met **Spot**-API-key — let op: aparte key dan de Futures-key!).
- Impact: als we ooit fee-rates uit Kraken Futures haalden, moeten we naar het Spot-endpoint. Voor de huidige journal (we krijgen `fee` per fill mee) waarschijnlijk laag, maar noteren.

### 4.4 📐 `unknown`-enum (17-5-2026) op history-velden
`HistoricalPositionUpdateElement.positionChange / tradeType / updateReason` (en order `direction`/`orderType`/`triggerSignal`/`triggerSide`) kunnen nu `unknown` teruggeven. Parser mag daar niet op crashen/verkeerd mappen — defensief afhandelen.

### 4.5 📈 `historical-funding-rates` endpoint bestaat
Relevant voor onze **funding-fees-feature** (aparte backlog): Futures heeft `futures-api/trading/historical-funding-rates` (publiek) + `account-history` voor realized funding per account. Sluit aan op het eerdere funding-onderzoek (`docs/research-funding-fees-2026-06-06.md`).

---

## 5. Implicaties & actiepunten voor SyncJournal

1. **1970-timestamp-bug** *(backlog)* — sterkste lead: timestamp-formaat-mismatch (`fillTime` ISO vs `timestamp` ms). **Volgende stap**: Kraken-snapshot via `?dev=1` → ik zie het werkelijke veld/formaat, dan parser uitbreiden (ISO **én** ms-epoch) + harde guard tegen 1970-fallback. Niet blind fixen — eerst de snapshot.
2. **Kraken open-positie-dedup** *(backlog)* — `/openpositions` is gesorteerd op `fillTime`. Als `fillTime` per refresh wisselt of leeg is (1970-bug), wisselt onze `open_${symbol}_${fillTime}_${side}`-id → duplicaten. **Deze bug en de 1970-bug hangen dus samen.** Bevestig met dezelfde snapshot; defensieve fix = open-id losmaken van `fillTime` (`open_${symbol}_${side}`).
3. **Auth-methode** — Worker-signing tegen de nieuwe url-encode-regel leggen (low-risk, maar afvinken).
4. **Fee Schedules** — niet meer op Futures-fee-endpoints bouwen; per-fill `fee` blijven gebruiken, fee-*rate* (indien ooit nodig) via Spot `GetTradeVolume`.
5. **Funding-feature** — `historical-funding-rates` + `account-history` bevestigen het eerder geschetste Kraken-pad.
6. **Algemeen** — voor eventuele live-feeds: Spot **WS v2** (niet v1), Futures-WS apart.

---

## 6. Volledige sub-page-inventaris (224 doc-pagina's, 13 secties)

> Volledig in `.firecrawl/kraken-inventory.md` (gegenereerd uit de site-map). Sectie-counts:

`futures-api: 76 · rest-api (Spot): 50 · guides: 24 · fix-api: 20 · websocket-v2: 19 · websocket-v1: 18 · category: 6 · custody-api: 4 · prime-api: 3 · change-log: 1 · embed-api: 1 · oauth: 1 · ramp-api: 1`

(Plus losse: OTC en Prime-REST/FIX zaten in de navigatie maar niet in de gemapte sitemap-links; de OTC- en Prime-REST-pagina's bestaan blijkens de change-log-nav.)

### Futures (76) — trading / history / charts / websocket
Trading (47): account-information, get-accounts, get-fills, get-history, get-open-orders, get-open-positions, get-order-status, get-orderbook, get-ticker(s), get-leverage-setting, set-leverage-setting, get-max-order-size, get-initial-margin, get-notifications, get-pnl-currency-preference, get-unwind-queue, get-user-fee-schedule-volumes-v-3, historical-funding-rates, instrument-details/status, send-order, send-batch-order, edit-order-spring, cancel-order, cancel-all-orders(-after), (de)assignment-program, subaccounts (+transfer/list/capability), transfer(s), withdrawal, multi-collateral, set-pnl-currency-preference, trading-settings, …
History (8): **account-history**, **get-execution-events**, get-order-events, get-trigger-events, market-history, get-public-{execution,order,price}-events
Charts (8): candles, charts, analytics, market-analytics, resolutions, symbols, tick-types, liquidity-pool-stats
WebSocket (13): account_log, balances, book, challenge, fills, heartbeat, notifications, open_orders(_verbose), open_position, ticker(_lite), trade

### Spot REST (50)
Market data: get-server-time, get-system-status, get-asset-info, get-tradable-asset-pairs, get-ticker-information, get-ohlc-data, get-order-book, get-recent-trades, get-recent-spreads
Account/Trading: get-account-balance, get-trade-balance, get-open-orders, get-closed-orders, get-orders-info, get-order-amends, get-trade-history, get-trades-info, get-open-positions, get-ledgers(-info), get-trade-volume, add-order(-batch), amend-order, edit-order, cancel-order(-batch), get-websockets-token
Funding: deposit/withdrawal methods+addresses, withdraw-funds, cancel-withdrawal, status-recent-{deposits,withdrawals}, wallet-transfer, account-transfer
Subaccounts/Earn: create-subaccount, allocate/deallocate-strategy (+status), list-strategies, list-allocations
Export: add-export, export-status, retrieve-export, remove-export

### Spot WebSocket v2 (19, nieuw) / v1 (18, legacy)
v2: add_order, amend_order, edit_order, cancel_order, cancel_all, cancel_after, batch_add, batch_cancel, executions, balances, book, level3, instrument, ticker, trade, ohlc, status, heartbeat, ping
v1: addorder, amendorder, editorder, cancelorder, cancelall, cancelallordersafter, openorders, owntrades, book, ticker, trade, ohlc, spread, subscriptionstatus, systemstatus, unsubscribe, heartbeat, ping

### Guides (24)
global-intro, spot-rest-intro/auth/ratelimits/earn, spot-ws-intro/auth/book-v1/book-v2/l3-v2, spot-amends, spot-clordid, spot-errors, spot-examples, spot-l3-data, spot-ratelimits, spot-fix-intro/auth/checksums, **futures-rest**, futures-websockets, futures-rate-limits, custody-rest-auth, fix-auth

### FIX (20), Custody (4), Prime (3), Embed (1), Ramp (1), OAuth (1)
Zie `.firecrawl/kraken-inventory.md` voor de complete lijst.

---

## 7. Bronnen
- Site-map (alle URLs): `.firecrawl/kraken-urls.json` → `.firecrawl/kraken-inventory.md`
- [Change Log](https://docs.kraken.com/api/docs/change-log)
- [Kraken APIs (global intro)](https://docs.kraken.com/api/docs/guides/global-intro)
- [Futures REST guide + Upcoming Changes](https://docs.kraken.com/api/docs/guides/futures-rest)
- [Get Fills](https://docs.kraken.com/api/docs/futures-api/trading/get-fills) · [Get Open Positions](https://docs.kraken.com/api/docs/futures-api/trading/get-open-positions) · [Get Execution Events](https://docs.kraken.com/api/docs/futures-api/history/get-execution-events) · [Account History](https://docs.kraken.com/api/docs/futures-api/history/account-history)
- [Spot WS intro](https://docs.kraken.com/api/docs/guides/spot-ws-intro) · [Spot REST intro](https://docs.kraken.com/api/docs/guides/spot-rest-intro)
