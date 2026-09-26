# Kraken Futures — diagnose én opdracht voor de fix (2026-09-26)

Voor: Denny + de Claude-sessie die de fix bouwt. Alles wat je nodig hebt staat hier of wordt hier naar verwezen. Onderaan staat de prompt die je letterlijk in een nieuwe sessie kunt plakken.

---

## 1. TL;DR

- **Kraken is niet "een beetje" fout, de reconstructie is structureel kapot.** Je account-log van Kraken (2025-11-05 → 2026-06-06) bevat **107 gesloten posities**. De journal heeft er **34**, waarvan **11 met omgekeerde richting**, **13 met verkeerde size** en **21 waarvan open- en sluittijd identiek zijn**. Netto PnL: account-log **−180,39**, journal **−43,33**.
- **Het probleem zit in de app, niet in Kraken.** De app bouwt per positie een "levensloop" uit Kraken's positie-events (`_krLevenslopen`). Die functie (a) neemt `fillTime` als tijd van elke stap, terwijl `fillTime` de *openingstijd van de positie* is, en (b) vertrouwt op de sorteervolgorde van de events om te bepalen wat een opening en wat een sluiting is. Die volgorde klopt in de praktijk niet, waardoor stappen van verschillende posities door elkaar lopen, richting omklapt en restjes "open" blijven en verdwijnen.
- **De bestaande CSV-import van de account-log is structureel wél goed**: 107/107 posities, richting/entry/exit 100% correct. Hij heeft vier kleinere gebreken (PnL zonder fees, size in BTC in plaats van USD, tijden in UTC, geen fills/openTime/closeTime). Dat is de snelste route naar een correcte historie én de basis voor de API-fix.
- **Aanbevolen aanpak**: één levensloop-functie op basis van de account-log-data (old/new balance per fill, volgorde-onafhankelijk) die zowel door de CSV-import als door de API (Worker → `/api/history/v3/account-log`) wordt gevoed. Eerst de CSV-route rechttrekken (offline testbaar tegen de export, geen Worker-deploy), daarna de API erop aansluiten.

---

## 2. Bewijs

### 2.1 Bronbestanden (allemaal in de repo-root, gitignored of nog niet gecommit)

| Bestand | Wat | Let op |
|---|---|---|
| `account_log_bacb6956-…_2026-09-26T11-02-51Z.csv` | Kraken Futures account-log export, 2667 regels, 2025-11-05 → 2026-06-06 (UTC) | **Ground truth.** Gitignored via `*.csv`. |
| `syncjournal-backup-2026-09-26 kraken.json` | SyncJournal-export (v0.9.137), 78 trades waarvan 34 Kraken | **Bevat je Kraken/Blofin API-keys in platte tekst** (`conns`). Staat in de repo-root en is NIET gitignored. Verplaats naar `_scratch/` en commit 'm nooit. |
| `kraken-spot-trades-2026-08-27-2026-09-26.csv` | Kraken Spot trades export | Leeg (alleen header). Niet relevant: futures staan niet in de spot-export. |
| Screenshots `~/Pictures/Screenshots/Schermafbeelding 2026-09-26 13*.png` | Kraken Pro → Portfolio → Futures → Posities / Grootboek, en de journal Trades-lijst | Kraken UI toont tijden in **UTC+1**, journal in Amsterdam (UTC+2). Dat uur verschil is géén bug. |

### 2.2 Account-log versus journal (script: `scripts/kraken-recon.js`)

```
node scripts/kraken-recon.js "account_log_…csv" "syncjournal-backup-2026-09-26 kraken.json"
```

| Meting | Account-log | Journal |
|---|---|---|
| Gesloten posities | 107 | 34 |
| Fills (contract-regels "futures trade") | 413 | 145 |
| Posities met >1 sluit-fill (partial closes) | 58 | – |
| Posities met >1 open-fill (scaling in) | 50 | – |
| Netto PnL (Σ realized pnl − Σ fee, zonder funding) | −180,39 | −43,33 |
| Sinds je sync-startdatum 2026-05-07: posities / fills | 13 / 42 | 6 / 22 |

Matching op open- of sluittijd (±3 min): **31 gematcht, 76 ontbreken**, en van de 31 gematchte hebben **11 de verkeerde richting, 13 een verkeerde size en 11 een verkeerde PnL**. Drie journal-trades matchen met geen enkele positie.

Concreet voorbeeld, positie van 20 mei (Kraken UI: *Long 77.241 → 77.329 en 77.523, twee partial closes*):

| | Account-log | Journal #76 |
|---|---|---|
| Richting | long | **short** |
| Open → sluit | 08:05 → 11:41 UTC | 08:05 → **08:05** |
| Entry / exit | 77.241 / 77.425 | **77.334** / 77.329 |
| Size | 0,0183 BTC | **0,0092** BTC (alleen de eerste close) |
| PnL netto | +1,96 | +1,95 (klopt toevallig: Σ realizedPnL is volgorde-onafhankelijk) |

De fills die de journal voor #76 heeft opgeslagen: `sell open 0.0091 @77523` → `buy add 0.0183 @77241` → `sell close 0.0092 @77329`. Dat is de échte volgorde **achterstevoren**: de laatste close staat vooraan en wordt daardoor als opening gezien, wat de richting omklapt.

### 2.3 Wat er systematisch mis is in de journal-data

1. **Alle stappen van een trade dragen dezelfde timestamp** (21 van 34 trades). Voorbeeld #77 (6 juni): 5 fills, allemaal `1780741307377` = 10:21:47 UTC = de opening. De sluitingen waren om 12:07 UTC (account-log én Kraken UI bevestigen dat).
2. **Stappen staan in willekeurige volgorde.** Zie #76 hierboven en #45 (8 fills, patroon `open, add, flip, add, add, flip, add, close`, terwijl de account-log 5 openingen gevolgd door 3 sluitingen laat zien).
3. **Levenslopen lopen in elkaar over.** #44 bevat de 3 sluitingen van een *long* van 4–5 dec én de volledige *short* van 6 dec (alle 3 fills), de 3 openingen van de long ontbreken. Resultaat: "short", entry van de verkeerde positie, sluittijd van de verkeerde positie.
4. **Ongeveer de helft van de events komt niet in een trade terecht** (42 fills in de account-log sinds 7 mei, 22 in de journal). Een levensloop wordt afgesloten zodra een event met `newPosition == 0` langskomt; alles wat daarna nog voor dezelfde positie binnenkomt begint een "nieuwe" levensloop die nooit meer op nul komt en daarom aan het einde stilzwijgend wordt weggegooid (`return uit; // wat nog open staat komt via de open-positie-placeholder`).
5. **Geen enkele Kraken-trade heeft `tps`** (0 van 34), terwijl 58 van de 107 posities partial closes hadden.

### 2.4 Hoe de huidige keten werkt

```
Kraken  GET /api/history/v3/positions  (PositionUpdate-events, sort=desc, max 20 pagina's)
   │      Worker v18 (worker-patches/v18-online-worker.js) + patch docs/worker-kraken-events.md
   ▼      → response { trades (oud pad: 1 rij per groep sluitingen), events: [{uid, timestamp, event:{PositionUpdate}}] }
App     ExchangeAPI.kraken.fetchTrades  (work/syncjournal.html ≈ regel 6498)
   │      events aanwezig → _krLevenslopen(events)  (≈ regel 6440)
   ▼
_krLevenslopen
   • sorteert op  (+u.timestamp || e.timestamp)  met tiebreak op executionUid (= UUID, dus willekeur bij gelijke tijd)
   • stap-tijd  = +u.fillTime || +u.timestamp || e.timestamp        ← fillTime = OPENINGSTIJD van de positie
   • stap-kant  = teken van (newPosition − oldPosition)               ← per event correct
   • levensloop klaar zodra |newPosition| ≈ 0                         ← hangt af van de volgorde
   • fillTimeline(steps) (gedeelde helper, ≈ regel 5915) sorteert nogmaals op (ts, id) en bepaalt open/add/close/flip uit een lopende teller
```

De twee zekere fouten zitten in de regels "stap-tijd" en "sorteert op". De rest volgt daaruit.

### 2.5 Waarom de bestaande test dit niet ving

`tests/kraken-levensloop.spec.js` bouwt zijn PositionUpdate-fixtures uit de oude CSV-export en zet daarbij `fillTime: ts` (= de executietijd) én levert de events al chronologisch aan. Precies de twee aannames die in productie niet kloppen. De test bewijst dus dat de logica werkt op *ideale* events, niet op Kraken's echte events. Er bestaat geen fixture met echte, rauwe Kraken-events: de 📥 Snapshot-knop (`ExchangeAPI.kraken.captureSnapshot`, ≈ regel 7080) vraagt de Worker aan **zonder** `withEvents:true`, dus de snapshot bevat de events niet eens.

### 2.6 De CSV-import in de app als vergelijking (scripts: `kraken-csv-import-adhoc.js` + `kraken-compare-csv-import.js`)

Headless dezelfde account-log CSV ingelezen via Instellingen → Data → "Trade-history importeren":

| Check | Resultaat |
|---|---|
| Aantal Kraken-trades | **107 / 107** |
| Richting, entry, exit | **100% correct** (0 afwijkingen) |
| PnL | 81× bruto (fees niet afgetrokken), 19× anders (vermoedelijk verkeerd gepaarde usd/contract-regels bij meerdere fills in dezelfde seconde), 7× toevallig netto |
| Size | 107× de BTC/ETH-hoeveelheid in plaats van USD-notional (conventie: `positionSize` = USD, `positionSizeAsset` = coin) |
| Datum/tijd | 107× de UTC-tijd uit de CSV, niet omgerekend naar Amsterdam |
| `openTime` / `closeTime` / `fills` | leeg |
| `tps` | overal 3 stuks, niet gevalideerd tegen de echte partial closes |

Conclusie: de CSV-route heeft het *moeilijke* deel (positie-levensloop, richting, prijzen) al goed omdat hij `new balance` per fill gebruikt in plaats van volgorde. Hij mist alleen afwerking.

---

## 3. Wat Kraken officieel aanbiedt (docs + OpenAPI-specs + live probes, 2026-09-26)

Bronnen: de twee OpenAPI 3.1-specs zijn leidend — `https://docs.kraken.com/openapi/futures-rest.yaml` (derivatives v3) en `https://docs.kraken.com/openapi/futures-history-rest.yaml` (history v3). De oude docs-site (`docs.kraken.com/api/docs/futures-api/…`) is legacy geworden (`docs-legacy.kraken.com`); de nieuwe pagina's staan onder `docs.kraken.com/api-reference/account-history/…`. Lokale kopieën: `.firecrawl/docs.kraken.com-api-reference-account-history-*.md`. Een web-search-agent heeft vandaag daarnaast ccxt (`krakenfutures.ts`), Kraken's eigen Go/Rust/Python-clients, de changelog en de rate-limit-pagina doorgenomen en een reeks dingen live geprobeerd tegen `futures.kraken.com`; die bevindingen staan hieronder gemarkeerd met *(live)*.

### 3.1 Wat het onderzoek definitief maakt

- **Op `/api/history/v3/positions` is `timestamp` de executietijd en `fillTime` de openingstijd van de positie.** `timestamp` is `required` in de spec, `fillTime` is `nullable` en niet required. ccxt's `fetchPositionsHistory` (toegevoegd 20-09-2026, PR #30503) sorteert en stempelt daarom op `timestamp` en gebruikt `fillTime` alleen als groepssleutel. Onze `_krLevenslopen` doet het omgekeerde voor de stap-tijd. Dit bevestigt R1 definitief.
- **De account-log JSON bevat alles wat de CSV heeft, plus `old_balance`, `old_average_entry_price`, een sequentieel `id` en `execution`.** Dat `execution`-veld is dezelfde uuid als `fills.fill_id` en `positions.executionUid`, en koppelt de cash-regel (`asset == "usd"`) aan de positie-regel (`asset == contract`) van dezelfde fill. In de CSV ontbreekt die kolom; daar moet je positioneel paren.
- **`realized pnl` in de account-log is bruto.** De identiteit `change == realized_pnl − fee + realized_funding` klopt op 402/402 cash-regels tot op 1e-6. Trek fees dus één keer af, niet twee keer.
- **KFEE-orphans (live in jouw data):** als de fee met KFEE is betaald, schrijft Kraken géén cash-regel voor die executie, alleen de positie-regel; de fee staat als losse `kfee applied`-regel zonder `contract`. 11 van de 413 positie-regels in jouw export zijn zulke wezen. Elke paar-logica moet dat tolereren (dat zijn precies de 11 "unpaired" die `scripts/kraken-recon.js` meldt).
- **Positioneel paren in de CSV:** filter eerst op `type == "futures trade"` (conversie-regels staan er tussen en verpesten anders de buurman-logica), dan is in `asc`-volgorde de positie-regel gevolgd door de cash-regel; de export zelf staat in `desc`, dus daar andersom. De samengestelde sleutel `(dateTime, contract, trade price)` is **niet uniek**: 90 botsingen in 815 regels. Dat verklaart de 19 PnL-afwijkingen van de huidige CSV-import (§2.6), die op die sleutel met `.find()` matcht.
- **`position uid` is dood:** kolom bestaat, 0 van 2667 regels gevuld; in de JSON `null` en niet in het schema. Niet op bouwen.
- **`funding rate change`-regels dragen wél een `contract`** (995/995) plus `realized funding` → funding is per positie toe te wijzen; `conversion` en `kfee applied` niet.
- **Kraken's eigen UI-exports zijn afgekapt:** "Closed Positions" op exact 50 regels, "Ledger" op 100, met Nederlandse kolomkoppen (`Positie geopend`, `W&V`, …) en ms-epoch-datums. Alleen de account-log is compleet vanaf de start van het account. Daar moet elke serieuze importer op draaien.
- **Het demo-domein is dood** (`demo-futures.kraken.com` → 301 naar marketing, uitgezet 14-07-2026). Snapshot-fixtures zijn de enige autonome testroute.

### 3.1b Wat derden doen (deelrapport `docs/research-kraken-thirdparty-2026-09-26.md`)

- **Geen enkele trading journal ondersteunt Kraken Futures** (TradesViz, Tradervue, TraderSync, Edgewonk: alleen spot of niets). Tax-tools (Koinly, Coinpanda, CoinTracking, Divly, Blockpit) wél, maar die gooien de executies weg en houden netto PnL per sluiting over. Er is dus geen blueprint om te kopiëren; de account-log is bij iedereen die het serieus doet (rotki, ccxt, Divly, Coinpanda-CSV) de bron.
- **rotki's validatie-identiteit** is de meest complete: `new_balance − old_balance == realized_pnl + realized_funding − fee − liquidation_fee` (met `liquidation_fee`, dat bij ons nog nergens meetelt). Als harde check inbouwen op elke cash-regel; een afwijking betekent een verkeerd gepaarde regel.
- **ccxt's `fetchPositionsHistory` haalt standaard alleen `closed: true`** op, dus alleen het laatste sluitingsevent per positie. Wie via `/positions` werkt moet álle event-types opvragen (geen filter, of alle booleans aan), anders verdwijnen de partial closes. Onze Worker vraagt zonder filter, dat is goed.
- TradesViz' "flat-position + symbol"-groepering (positie terug op 0 = einde trade, FIFO) is exact wat onze balans-keten doet; Edgewonk's model met één SL/TP per trade is precies wat onze multi-TP-community níet wil. Onze aanpak is dus niet exotisch, alleen nog niet voor Kraken gebouwd.

### 3.2 Endpoint-tabel

| Endpoint | Wat je krijgt | Paginatie / venster | Voor ons |
|---|---|---|---|
| `GET /api/history/v3/positions` (position update events) | wrapper `{uid, timestamp}`; per event: `oldPosition`, `newPosition`, `oldAverageEntryPrice` (nullable), `newAverageEntryPrice`, `positionChange` (open/close/increase/decrease/reverse/noChange/unknown), `updateReason` (trade/fundingRealisation/settlement/unknown), `tradeType` (userExecution/liquidation/partialLiquidation/assignment/unwind/unknown), `executionPrice`, `executionSize`, `executionUid`, `realizedPnL`, `fee`, `feeCurrency`, `realizedFunding`, `fundingRealizationTime`, **`fillTime` (ms, nullable = openingstijd positie)**, **`timestamp` (ms, required = executietijd)** | `since`/`before` (ms), `sort=asc|desc` (default **desc**), `count` (stil afgekapt op 1000 *(live)*), `continuationToken` (body) / `Next-Continuation-Token` (header) / `continuation_token` (param) + header `is-truncated`; filters `opened/closed/increased/decreased/reversed/no_change`, `trades/funding_realization/settlement`, `tradeable`. Kosten 1 token uit de history-pool. | Huidige bron. Bruikbaar mits: sorteren en stempelen op `timestamp`, groeperen op `(tradeable, fillTime, teken oldPosition)`, ophalen met `sort=asc&since=` zodat geen openingen buiten het venster vallen. ccxt's semantiek: `open`/`increase` beschrijven de *nieuwe* positie (`newPosition`, `newAverageEntryPrice`), `close`/`decrease`/`reverse` de *oude* (`oldPosition`, `oldAverageEntryPrice`) plus `executionSize`. |
| `GET /api/history/v3/account-log` | `{accountUid, logs:[…]}`; per regel: `id` (sequentieel), `date` (ISO), `info` (o.a. `futures trade`, `funding rate change`, `futures liquidation`, `futures partial liquidation`, `futures assignor/assignee`, `futures_unwind`, `futures unwind bankrupt/counterparty`, `conversion`, `kfee applied`), `asset`, `contract`, `old_balance`, `new_balance`, `old_average_entry_price`, `new_average_entry_price`, `trade_price`, `mark_price`, `realized_pnl` (bruto), `fee`, `realized_funding`, `funding_rate`, **`execution`** (= fill_id), `booking_uid`, `liquidation_fee`, `collateral` | `since`/`before` (ms) **of** `from`/`to` (regel-id's, inclusief, starten bij 1); `sort` (default desc); `count` (default 500); `info=`-filter; `conversion_details`. **Geen continuation-token**: pagineer op `from=<laatste id+1>` of `since`. Kosten: 1 token (count ≤25), 2 (≤50), 3 (51–1000), 6 (≤5000). | **Identiek aan de CSV die als ground truth is gevalideerd**, plus `old_balance` en `execution`. Volgorde-onafhankelijk te reconstrueren via de balans-keten. Cursor = laatste `id`. |
| `GET /api/history/v3/executions` | per executie: `timestamp` (ms), `quantity`, `price`, `markPrice`, `executionType` (maker/taker), `usdValue`, `limitFilled`, `order{tradeable, direction Buy/Sell/Unknown, orderType (15 waarden incl. Liquidation/PartialLiquidation/Assignment/Unwind), reduceOnly, positionUid}` | `since`/`before`, `sort`, `count` (cap 1000), `continuation_token` | **Let op:** de spec noemt de event-sleutel `event.execution` (kleine e), de gerenderde docs `event.Execution` — beide afhandelen. Het onderzoek vond **geen betrouwbare realized PnL** op dit endpoint (het `orderData.realizedPnl`-veld uit de gescrapete pagina is niet in de OpenAPI-spec bevestigd). `positionUid` staat in de spec op `order`, maar is met een echte key te verifiëren. Alleen plan B. |
| `GET /derivatives/api/v3/fills` | `fill_id`, `order_id`, `symbol`, `side` (buy/sell), `size`, `price`, `fillTime` (ISO), `fillType` (maker/taker/liquidation/partialLiquidation/assignor/assignee/takerAfterEdit/unwindBankrupt/unwindCounterparty), `realized_pnl` (nullable), `sequence_id` | `lastFillTime` (ISO, exclusieve bovengrens), 100 per pagina, desc. Kosten 2 zonder / **25 met** `lastFillTime`. | **Geen `fee`-veld, ooit.** `realized_pnl` is **null** zodra je met `lastFillTime` pagineert (spec-quote). Niet gebruiken voor historie. |
| `GET /derivatives/api/v3/openpositions` | `side` = `long`/`short`, `size`, `price` (gemiddelde entry), `unrealizedPnl`, `unrealizedFunding`, `pnlCurrency`, `maxFixedLeverage`; `fillTime` (ISO) wordt geretourneerd maar staat **niet** in het schema | – (2 tokens) | Blijft voor de open-positie-placeholder. Geen id → onze sleutel `symbol_fillTime_side` is de juiste keuze. |
| `GET /api/history/v3/accountlogcsv` | de complete account-log als CSV, tot 500.000 regels | geen paginering; 6 tokens; time-outs bekend | Zelfde data als de UI-export. Alleen als noodgreep. |

**Auth** (ongewijzigd, Worker v18 werkt): headers `APIKey`, `Authent` = base64(HMAC-SHA512(base64decode(secret), SHA256(postData + Nonce + endpointPath))), `Nonce` optioneel (ccxt stuurt er geen). `postData` voor GET = de url-encoded query-string zonder `?`, direct vóór het pad geplakt. `endpointPath`: **alleen het prefix `/derivatives` strippen** (`/api/v3/fills`); voor history-endpoints het volledige pad (`/api/history/v3/account-log`). Sinds 1-10-2025 hasht Kraken de url-encoded query, dus `info=futures%20trade` url-encoden vóór het signen. Bevestigd in Kraken's Go-SDK, Python-sample en Rust-CLI *(bronnen in §8.4)*.

**Foutvormen** *(live)*: derivatives-auth-fout komt als **HTTP 200** met `{"result":"error","error":"authenticationError"}`; history-auth-fout als **HTTP 401** met `{"status":"unauthorized","reason":…}`; argumentfouten als `{"result":"error","errors":[{code,message}]}` en `invalidArgument: symbol` (prefix-match). Een `if (!res.ok)` mist dus elke derivatives-auth-fout.

**Rate-limits**: derivatives-pool 500 tokens/10 s; **history-pool apart: 100 tokens per 10 minuten**. Limiet is **per IP**, dus alle community-leden delen via de Worker één budget. Een volledige account-log-backfill van 2667 regels = 3 pagina's × 3 tokens: verwaarloosbaar; 20 pagina's `/positions` à 1 token ook. Positioneel: geen enkele reden voor `/fills`.

**API-keys**: futures-keys zijn andere keys dan spot-keys (aanmaken via `futures.kraken.com/trade/settings/api`, "General API = Read Only" volstaat voor alles wat de journal doet, geen IP-allowlist beschikbaar). Per subaccount een eigen key. Meest voorkomende `authenticationError`-oorzaak bij members: een spot-key gebruiken.

Eerdere onderzoeksdocumenten die nog kloppen en relevant blijven: `docs/kraken-api-research-2026-06-09.md` (timestamp-formaten, auth-wijziging, `unknown`-enums), `docs/worker-kraken-events.md` (de Worker-patch die de events meestuurt), `worker-patches/README.md` (deploy-ritueel + console-snippet om de Worker direct aan te roepen).

---

## 4. Oorzaken, gerangschikt

| # | Oorzaak | Zekerheid | Bewijs |
|---|---|---|---|
| R1 | `_krLevenslopen` gebruikt `fillTime` (openingstijd positie) als stap-tijd | **Zeker** | 21/34 trades: alle fills identieke ts = openingstijd; account-log toont sluitingen uren/dagen later |
| R2 | Levensloop-opbouw hangt af van de sorteervolgorde, en de events komen in productie niet compleet en/of niet chronologisch binnen | **Zeker dat het gebeurt**, mechanisme nog te pinnen | Fills achterstevoren (#76), levenslopen die in elkaar overlopen (#44), helft van de events verdwijnt. Volgens de spec is `PositionUpdate.timestamp` de executietijd en required, dus de sortering in `_krLevenslopen` zou op zich moeten kloppen. Dat maakt **ontbrekende events** de hoofdverdachte: (a) de Worker haalt met `sort=desc` (default) op en breekt af zodra de oudste van een pagina < `since` → openingen van posities die over de venstergrens heen lopen ontbreken (#44 mist precies zijn 3 openingen; #77 heeft 5 van 7 events); (b) de first-time backfill in `fetchTrades` (`oudste − 1 uur`) dekt oudere openingen niet; (c) `count`-cap 1000 / max 20 pagina's. Blijft over als (d): de gedeployde Worker wijkt af van `docs/worker-kraken-events.md` en stuurt bijv. `fillTime` als `timestamp` mee, waardoor alle events van een positie gelijk staan en de tiebreak op `executionUid` (UUID) willekeur wordt. Eén rauwe capture beslecht dit. |
| R3 | Test-fixture heeft dezelfde blinde vlek als de code (`fillTime = executietijd`, events al gesorteerd) | Zeker | `tests/kraken-levensloop.spec.js` regels 45–51 en 66–71 |
| R4 | Snapshot-knop vraagt geen `withEvents:true` → geen rauwe events te capturen | Zeker | `captureSnapshot`, ≈ regel 7084 |
| R5 | CSV-import: PnL bruto, size in coin, UTC-tijd, geen fills/openTime/closeTime, usd/contract-regels op `(dateTime, trade price)` gepaard i.p.v. op executie-id | Zeker | §2.6 |

Niet meer actueel (maar staan nog op de backlog): de 1970-timestamp-bug (opgelost door de `toIso`-guard in `_normalise`, v12.230) en de dubbele open positie na refresh (v12.235 `openIsPlaceholder`). Sluit die tickets af of verwijs ze naar dit document.

---

## 5. Oplossingsrichting

### Aanbevolen: één levensloop-functie op account-log-data, gevoed door CSV én API

Waarom deze en niet "de sortering repareren":
- De account-log is wat Kraken zelf als waarheid exporteert en we hebben 'm net 107/107 gevalideerd. Position-events zijn een afgeleide waarvan we de tijdsemantiek nog steeds niet zeker weten.
- `old_balance` → `new_balance` per fill maakt de reconstructie **volgorde-onafhankelijk**: je kunt de keten per contract sluitend maken zonder op timestamps te vertrouwen, en meerdere fills binnen dezelfde seconde (komt veel voor: 4 sluitingen om 12:07:02 op 6 juni) hebben geen tiebreak nodig.
- CSV-import en API-sync leveren dan **exact dezelfde trade** (zelfde id, zelfde velden) → dedup werkt, en Denny kan haar historie vandaag al via CSV herstellen terwijl de Worker-aanpassing wacht.
- Past bij de exchange-isolatie-regel: alles in `ExchangeAPI.kraken`, geen gedeelde helper met `if (ex==="kraken")`.

Bouwvolgorde:

**Fase 0 · Bewijs verzamelen (30 min, geen code-wijziging behalve één regel)**
1. Zet `withEvents:true` in `ExchangeAPI.kraken.captureSnapshot` en capture één snapshot met `?dev=1`. Óf gebruik het console-snippet uit `worker-patches/README.md` met `withEvents:true` erbij en sla het antwoord op als `tests/_fixtures/kraken-events-2026-09.json` (gitignored map).
2. Kijk in de rauwe events: zijn `e.timestamp`, `u.timestamp` en `u.fillTime` verschillend per event? Zijn alle 42 fills sinds 7 mei aanwezig (vergelijk met `scripts/kraken-recon.js`)? Dit beslecht R2(a) versus R2(b/c) en bepaalt of de position-events later nog een rol spelen (bijv. voor `tradeType=liquidation`-labels).
3. Roep, via hetzelfde snippet, één keer `/api/history/v3/account-log?since=…&sort=asc&count=500&info=futures%20trade` aan (Worker heeft daar een pass-through voor nodig; zie fase 2) of vraag Denny om de JSON. Bevestig dat de contract-regels (`asset == contract`, `new_balance` = positie-grootte) er in de JSON óók in zitten. De v7-notitie uit mei ("account-log heeft geen betrouwbare size") is vermoedelijk gebaseerd op alleen de usd-regels; als de contract-regels ontbreken in de JSON, schakel dan over op plan B (executions-endpoint, dat `positionSize` en `realizedPnl` per executie geeft).

**Fase 1 · CSV-route rechttrekken = de levensloop-functie bouwen (offline testbaar)**
1. Haal de Kraken-log-parser uit het CSV-import-blok (≈ regels 7669–7791) naar een adapter-methode, bijv. `ExchangeAPI.kraken.levenslopenUitAccountLog(rows)`. Input: genormaliseerde regels `{ts, info, asset, contract, change, oldBalance, newBalance, avgEntry, tradePrice, realizedPnl, fee, realizedFunding, execution}` (CSV-kolommen en JSON-velden mappen op dezelfde namen).
2. Paar usd-regel en contract-regel van dezelfde fill op `execution`-id (JSON). Bij de CSV, die geen execution-kolom heeft: filter eerst op `type == "futures trade"`, keer de bestandsvolgorde om naar chronologisch en paar dan **positioneel** (positie-regel gevolgd door cash-regel). Tolereer positie-regels zonder cash-regel (KFEE-betaalde fees: 11 stuks in jouw export; fee = 0, pnl = 0 voor die stap). Niet op `(dateTime, contract, trade price)` matchen: die sleutel botst 90× in 815 regels en veroorzaakt de 19 PnL-afwijkingen van de huidige import. Controle-identiteit per cash-regel (rotki): `change == realized_pnl + realized_funding − fee − liquidation_fee`; bij afwijking is de paring fout, log dat in plaats van stil door te gaan.
3. Bouw per contract de keten via `newBalance`: opening bij 0 → ≠0, sluiting bij → 0, omkering bij tekenwissel. Gebruik `fillTimeline`/`fillSummary` (bestaande gedeelde helpers) alleen voor de weergave-stappen; de *grouping* doe je zelf op de balans-keten. Stap-tijd = de `date`/`dateTime` van de regel.
4. Vul de trade zoals `_krLevenslopen` dat nu doet (zelfde velden, zelfde `id`-vorm `kraken_pos_<CONTRACT>_<openTs>` zodat CSV en API dedupen), maar dan: `pnl` = Σ realized_pnl − Σ fee (+ Σ realized_funding binnen de levensloop, zoals nu), `positionSize` = Σ open-qty × avgEntry (USD), `positionSizeAsset` = Σ open-qty, `openTime`/`closeTime` gevuld, `date`/`time` via `Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Amsterdam"})`, `fills` gevuld, `tps` afgeleid uit de sluit-fills met `status:"hit"` en de echte tijd per TP.
5. Test: `tests/kraken-account-log.spec.js` die de echte export inleest (fixture in `tests/_fixtures/`, skip als afwezig, zoals de andere fixture-tests) en asserteert: 107 trades, netto totaal −180,39 ± 0,05, 0 richting-afwijkingen tegen `scripts/kraken-recon.js`, alle 413 fills terug te vinden, tijden in Amsterdam. Plus een kleine synthetische fixture voor: 4 sluitingen in één seconde, omkering (flip), liquidatie-regel, funding binnen levensloop.
6. Denny: 34 oude Kraken-trades verwijderen (ze hebben **geen** handmatige notities/tags/screenshots, gecontroleerd op de backup) en de CSV opnieuw inlezen. Klaar voor de historie tot 6 juni.

**Fase 2 · API op dezelfde functie aansluiten**
1. Worker: nieuwe action `account_log` in `handleKraken`: pagineer `/api/history/v3/account-log` met `since=<startTime>&sort=asc&count=1000&info=…` (de futures-trade/liquidation/assignment/unwind-waarden plus `funding rate change`, url-encoded vóór het signen). **Dit endpoint heeft geen continuation-token**: pagineer op `from=<laatste id + 1>` tot een pagina minder dan `count` regels geeft. Geef de rauwe `logs` door en de laatste `id` als cursor. Foutafhandeling: niet op `res.ok` vertrouwen; check `result === "error"` (HTTP 200) én `status === "unauthorized"` (HTTP 401). Lever de diff als `worker-patches/v19-online-worker.js` + tekst in `docs/worker-kraken-account-log.md`; Denny deployt.
2. App: `fetchTrades` roept `account_log` aan, valt terug op het huidige events-pad zolang de Worker de action nog niet kent (zelfde patroon als de `withEvents`-overgang). Verwijder het events-pad zodra Denny de nieuwe Worker draait en één sync 107/107 bevestigt.
3. `syncFrom` voor Kraken op 2025-11-01 zetten (Kraken's account-log gaat terug tot het begin van het account; `from=1` als je álles wilt) en de `tj_lastsync_kraken`-cursor resetten zodat de eerste sync de hele historie ophaalt.
4. `captureSnapshot` voor Kraken laat voortaan óók de rauwe account-log-regels meekomen, zodat een volgende bug direct een fixture oplevert.

**Plan B (alleen als fase 0 stap 3 negatief uitvalt, wat na het onderzoek onwaarschijnlijk is):** de position-events als primaire bron houden, maar dan volgens ccxt's semantiek (zie de tabel in §3.2): ophalen met `sort=asc&since=&count=1000` en `closed=true&decreased=true&opened=true&increased=true&reversed=true`, sorteren op `timestamp`, groeperen op `(tradeable, fillTime, teken oldPosition)`, stap-tijd = `timestamp`. De CSV-route blijft dan op de account-log en de acceptatietest vergelijkt beide. `/executions` is géén plan B meer: het onderzoek vond daar geen betrouwbare realized PnL.

### Waarom niet alleen de sortering fixen in `_krLevenslopen`?

Het kan (stap-tijd = wrapper-`timestamp`, tiebreak via de keten `oldPosition == vorige.newPosition`, Worker op `sort=asc&since=`), en het is een goede quick-win als fase 0 laat zien dat de events na die Worker-aanpassing compleet binnenkomen. Maar dan heb je nog steeds twee verschillende reconstructies (CSV en API) die verschillende trades kunnen opleveren. Kies dit alleen als tijdelijke pleister mét de rauwe-events-fixture als regressietest, en houd de account-log-unificatie als einddoel.

---

## 6. Acceptatiecriteria (vóór "fixed")

1. `node scripts/kraken-recon.js <csv> <nieuwe backup>` → `missing 0, dir-mismatch 0, size-mismatch 0, pnl-mismatch 0` en netto PnL binnen ±0,05 van **−180,39** zonder funding (Σ realized pnl −87,32 − Σ fee 93,07) of **−180,29** mét funding (+0,11), afhankelijk van wat de app in `pnl` stopt — leg vast welke, en documenteer het bij de trade. Voor de API-route hetzelfde tegen de account-log JSON van dezelfde periode.
2. Elke Kraken-trade heeft `openTime < closeTime` (behalve echte in-and-out binnen dezelfde seconde), `fills.length ≥ 2`, `tps` gevuld bij ≥2 sluit-fills, tijden in Amsterdam.
3. CSV inlezen na een API-sync (of andersom) levert **0 nieuwe trades** (zelfde id's).
4. Twee keer syncen → geen duplicaten; open positie verschijnt één keer als placeholder en verdwijnt zodra de levensloop binnenkomt (`openIsPlaceholder` blijft).
5. `tests/kraken-levensloop.spec.js` herschreven of vervangen: fixture met échte Kraken-semantiek (`fillTime` = openingstijd, events in `desc`-volgorde, 4 sluitingen in één seconde). De oude versie mag pas weg als de nieuwe groen is.
6. `tests/exchange-isolation.spec.js` groen: Blofin/OKX/Hyperliquid/FTMO-output byte-gelijk vóór en na.
7. Release-flow: versie-bump + CHANGELOG-entry ("Kraken: historie compleet en correct; Worker-update nodig voor API-sync, CSV werkt direct"), **geen push zonder Denny's "push"**.

---

## 7. De prompt voor de fix-sessie (kopieer vanaf hier)

```
Lees eerst docs/opdracht-kraken-fix-2026-09-26.md (diagnose en ground truth) en daarna docs/plan-kraken-fix-2026-09-26.md (het uitvoeringsplan per sessie, met per stap de plek in de code, de test en het klaar-criterium). Voer sessie 1 uit zoals daar beschreven. Wijk er alleen van af als je bewijs hebt dat iets niet klopt, en schrijf dat bewijs dan in het plan.

Context
- App: work/syncjournal.html (single-file React). Kraken-adapter: ExchangeAPI.kraken (≈ regel 6378–6525), levensloop-functie _krLevenslopen, CSV-import-blok voor het Kraken-log-formaat (≈ regel 7669–7791), captureSnapshot (≈ regel 7080).
- Ground truth: account_log_bacb6956-a5a3-487b-93ba-db8745d1a33b_2026-09-26T11-02-51Z.csv (107 gesloten posities, 413 fills, netto −180,39). Vergelijkings-scripts: scripts/kraken-recon.js, scripts/kraken-csv-import-adhoc.js, scripts/kraken-compare-csv-import.js.
- Huidige journal-export met de foute Kraken-trades: "syncjournal-backup-2026-09-26 kraken.json" (bevat API-keys: nooit committen, niet in output citeren).
- Worker-referentie: worker-patches/v18-online-worker.js + docs/worker-kraken-events.md. De productie-Worker staat buiten de repo; wijzigingen lever je als worker-patches/v19-online-worker.js + een korte deploy-instructie, Denny deployt.
- Regels: CLAUDE.md (exchange-isolatie: alle Kraken-logica in de adapter; tj_-prefix; Amsterdam-tijd via Intl sv-SE; geen push zonder expliciet "push"; changelog bij user-facing changes).

Opdracht
1. Fase 0: maak de rauwe-events-capture mogelijk (withEvents:true in captureSnapshot) en beschrijf in één alinea wat Denny moet doen om de events- en account-log-JSON aan te leveren. Ga niet zitten wachten: fase 1 kan zonder.
2. Fase 1: bouw ExchangeAPI.kraken.levenslopenUitAccountLog(rows) volgens §5 van het document en laat de CSV-import die gebruiken. Schrijf tests/kraken-account-log.spec.js die tegen de echte export draait (fixture in tests/_fixtures/, skip als afwezig) en de acceptatiecriteria van §6 afdwingt. Draai scripts/kraken-recon.js tegen een verse export uit de app als eindcontrole en plak de SUMMARY-regel in je antwoord.
3. Fase 2: sluit de API aan via een Worker-action account_log (pass-through van /api/history/v3/account-log met since, sort=asc, count=1000, info-filter url-encoded vóór het signen; geen continuation-token, pagineer op from=<laatste id+1>; foutvormen HTTP 200 result:error én HTTP 401 status:unauthorized afvangen) en laat fetchTrades daarop overschakelen met fallback naar het huidige pad. Lever de Worker-diff als v19 + docs/worker-kraken-account-log.md. Het volledige API-onderzoek staat in docs/research-kraken-api-2026-09-26.md, het onderzoek naar hoe derden (ccxt, rotki, tax-tools) het doen in docs/research-kraken-thirdparty-2026-09-26.md.
4. Herschrijf tests/kraken-levensloop.spec.js zodat de fixture Kraken's echte semantiek heeft (fillTime = openingstijd, desc-volgorde, meerdere sluitingen per seconde). De oude test mag pas weg als de nieuwe groen is.
5. Draai tests/exchange-isolation.spec.js en de smoke-test. Release-flow uitvoeren (versie + CHANGELOG + cp naar site/app.html), niet pushen.

Werkwijze
- Bewijs vóór claims: elke "werkt"-uitspraak komt met de output van het script of de test.
- Kleinste heldere wijziging; geen gedeelde helper met exchange-if's.
- Rapporteer aan het eind: wat is gefixt, wat is geverifieerd (met cijfers), wat wacht op Denny (Worker-deploy, CSV opnieuw inlezen, oude 34 Kraken-trades verwijderen: die hebben geen handmatige inhoud).
```

---

## 8. Bijlagen

### 8.1 Tijdzones (om verwarring bij het vergelijken te voorkomen)
- Account-log CSV: **UTC** (`2026-06-06 12:07:02` = de sluiting van 6 juni).
- Kraken Pro web-UI: **UTC+1** in jouw instellingen (toont `13:07`).
- SyncJournal: **Europe/Amsterdam** (toont `14:07` voor diezelfde sluiting, en `12:21` voor de opening om 10:21 UTC). Dat is correct.

### 8.2 Scripts (in `scripts/`, vandaag toegevoegd, nog niet gecommit)
- `kraken-recon.js <csv> <backup.json>` — reconstrueert posities uit de account-log en vergelijkt met de Kraken-trades in een journal-backup. Print per positie `ok` / `MISMATCH DIR,SIZE,PNL` / `MISSING` en een SUMMARY-regel.
- `kraken-csv-import-adhoc.js <csv> <out.json> <screenshot.png>` — laadt de app headless, importeert de CSV via Instellingen → Data en schrijft de resulterende Kraken-trades weg. Draaien met `NODE_PATH=./node_modules`.
- `kraken-compare-csv-import.js <csv> <out.json>` — vergelijkt die import-output veld-voor-veld met de reconstructie.

### 8.3 Bronnen van het online-onderzoek (agent-rapport 2026-09-26, 116 tool-calls)
Het volledige rapport (62 KB, Engels) staat in `docs/research-kraken-api-2026-09-26.md`. Belangrijkste bronnen:
- OpenAPI: `https://docs.kraken.com/openapi/futures-rest.yaml`, `https://docs.kraken.com/openapi/futures-history-rest.yaml`, index `https://docs.kraken.com/llms.txt`
- Guides: `https://docs.kraken.com/exchange/guides/futures/rest` (auth, endpointPath, breaking change okt 2025), `…/futures/ratelimits`, `https://docs.kraken.com/exchange/changelog`
- Support: `https://support.kraken.com/articles/360057072571-interpreting-the-logs-derivatives` (twee regels per trade), `…/360022839451-how-to-create-an-api-key-for-kraken-derivatives`, `…/360024809011-api-testing-environment-derivatives` (demo uitgezet)
- Code: ccxt `ts/src/krakenfutures.ts` (`sign()`, `fetchPositionsHistory` PR #30503, `fetchLedger` PR #29782, issue #29760 over fees/account-log), `krakenfx/api-go` `pkg/derivatives/rest.go` `Sign()`, `krakenfx/kraken-cli` `src/auth.rs`, `CryptoFacilities/REST-v3-Python/cfRestApiV3.py`
- Niet afgerond door de agent: hoe TradesViz/Tradervue/Koinly Kraken Futures importeren. Niet nodig voor de fix.

### 8.4 Openstaande vragen voor Denny
1. Wil je de 34 huidige Kraken-trades laten vervangen (aanbevolen; ze bevatten geen handmatige inhoud) of moeten ze naast de nieuwe blijven staan tot je zelf hebt vergeleken?
2. Kun je na fase 0 de rauwe events + account-log JSON aanleveren (console-snippet uit `worker-patches/README.md`, met `withEvents:true`)? Dat maakt de position-events-vraag definitief.
3. Verplaats `syncjournal-backup-2026-09-26 kraken.json` naar `_scratch/` (bevat je API-keys) — en overweeg of de app-export die überhaupt moet bevatten.
