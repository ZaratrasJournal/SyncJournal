<!-- Deelrapport van de web-search-agent (sub-onderzoek derden), sessie 2026-09-26. Verwerkt in docs/opdracht-kraken-fix-2026-09-26.md §3.3. Hoofdrapport: docs/research-kraken-api-2026-09-26.md -->

# Hoe derden Kraken Futures / Derivatives closed positions reconstrueren

Onderzocht 26-09-2026. Elke claim heeft een URL. Waar geen bewijs is gevonden, staat dat expliciet.

## TL;DR — de kernconclusie

**Er bestaat geen enkele bestaande spec om te kopiëren.** Van de vier onderzochte trading journals ondersteunt **géén** Kraken Futures — allemaal alleen Kraken spot (of helemaal niets). De crypto-tax-tools die het wél ondersteunen gooien de executies expliciet weg en importeren alleen netto realized PnL per gesloten positie. De enige code die per-fill met Kraken's futures account log werkt is **rotki** en **ccxt**, en ook die reconstrueren géén logische trades — ze maken er ledger-/collateral-events van.

Voor SyncJournal betekent dat: we bouwen iets dat nog niemand publiek heeft gebouwd. De enige gedocumenteerde basis is Kraken's eigen `Realised P&L` per account-log-regel + `Avg. Entry Price` + `New Balance` als positiegrootte.

## Baseline: wat Kraken zelf levert (primaire bronnen)

- **Fills** — `GET /derivatives/api/v3/fills` heeft `realized_pnl`, met de beperking: *"`0` when the fill opens or increases a position. Null when the fill was recorded before this field was introduced, or when the request uses `lastFillTime`."* → https://docs.kraken.com/api/docs/futures-api/trading/get-fills
- **Account log** — `GET /api/history/v3/account-log`, per-entry velden: `execution`, `booking_uid`, `contract`, `fee`, `funding_rate`, `realized_pnl`, `realized_funding`, `old_balance`/`new_balance`, `old_average_entry_price`/`new_average_entry_price`, `trade_price`, `mark_price`, `liquidation_fee`, `conversion_spread_percentage`. → https://docs.kraken.com/api-reference/account-history/get-account-log
- **CSV-variant** — `GET /api/history/v3/accountlogcsv`. Geen kolomnamen gedocumenteerd. → https://docs.kraken.com/api-reference/account-history/account-log-csv
- **Kolommen van de UI-download** in support, met de cruciale zin: *"For each trade, there are two log entries: one which reflects the change to the balance of the Derivatives wallet, and the other which reflects the change to the position."* `Date` is *"local machine time on UI, UTC in download file"*. `Type`-waarden: `Derivatives Trade`, `Liquidation`, `Unwind Counterparty`, `Unwind Bankrupt`, `Assignor`, `Assignee`, `Funding Rate Change`, `Conversion`, `Interest Payment`, `Transfer`, `Cross-Exchange Transfer`, `Covered Liquidation`, `Kfee Applied`. Download: Export-pagina → Product = Derivatives. → https://support.kraken.com/articles/360057072571-interpreting-the-logs-derivatives
- **Positie-event-endpoint**: `GET /api/history/v3/positions`, filters `opened`/`closed`/`increased`/`decreased`/`reversed`/`no_change` × `trades`/`funding_realization`/`settlement`. Events, geen geaggregeerde trades. → https://docs.kraken.com/api-reference/account-history/get-position-update-events
- Futures-keys zijn aparte keys: *"the Kraken Futures API Keys are separate and distinct from Kraken SPOT API Keys"* → https://support.kraken.com/articles/how-to-use-our-api-for-taxes

## 1. TradesViz — alleen Kraken spot, geen Kraken Futures
- Import-instructies zijn puur spot (History → trades-export; Kraken Pro Trades → Export; ledger-export). Auto-sync met spot-keys. *"At the moment, we only support `<crypto>USD/CURRENCY-type` transactions."* → https://www.tradesviz.com/brokers/Kraken, https://www.tradesviz.com/blog/auto-import-kraken/
- Helpcentrum (18-05-2026): *"Currently Supported: Cryptocurrency"*, geen Futures. → https://tradesviz.crisp.help/en/article/how-to-import-trades-from-kraken-to-tradesviz-trading-journal-94v634/
- PnL berekent TradesViz zelf uit executies. → https://tradesviz.crisp.help/en/article/import-complete-guide-1tilu97/
- **Partial closes: flat-position-grouping** (best gedocumenteerd): *"Group executions based on flat-positions + symbol"* → `+100,-10,-90` en `+150,-150` worden 2 trades; FIFO; toggles voor split-on-side/new-day en "Merge overlapping trades". → https://www.tradesviz.com/blog/import-settings-guide/
- Limitaties: "Export current page" bevat geen fill-tijd (alles op 12:00 UTC); geen account-based transacties.

## 2. Tradervue — geen Kraken, geen crypto
- Geen crypto-kolom in supported brokers; *"Tradervue supports equities (and options), futures (and options), and forex."* → https://www.tradervue.com/help/brokers, https://www.tradervue.com/help/assets
- Generic import: `Date,Time,Symbol,Quantity,Price,Side` (+ `Commission`, `TransFee`, `ECNFee`), geen PnL-kolom. → https://help.tradervue.com/article/3429-generic-import-format
- Grouping: nieuw trade bij side-wissel of time-limit, optioneel bij flat. → https://help.tradervue.com/article/3480-split-merge-trades

## 3. TraderSync — Kraken = crypto-spot, Futures-kolom uit
- Supported brokers: Kraken met alleen Crypto ✓ en Autosync ✓. Geen aparte "Kraken Futures"-entry. → https://tradersync.com/supported-broker/
- Kraken-pagina zonder instructies (achter login). → https://tradersync.com/broker/kraken/
- Generic template: `Date,Time,Symbol,Quantity,Price,Buy/Sell,Commission,Type,Expiration Date,Strike Price,Call or Put`. → https://tradersync.s3.amazonaws.com/brokers/Generic_import.csv

## 4. Edgewonk — geen Kraken, wel MEXC Futures en Bybit
- Fast-import-lijst zonder Kraken. → https://edgewonk.com/import, https://edgewonk.com/currently-in-development/
- Realized PnL vult de gebruiker per exit in; partial closes = meerdere entries/exits binnen één trade, open qty → 0. Eén SL/TP per trade. → https://edgewonk.zendesk.com/hc/en-us/articles/360018230299-Scaling-in-out-Multiple-entries-exits

## 5. Crypto-tax-tools
Rode draad: iedereen abstraheert naar netto PnL per gesloten positie en negeert de fills.
- **Koinly**: aparte "Kraken Futures"-wallet (API + CSV). *"Koinly will not import executions of such contracts… Instead, you will only see your closing PnL."* Dag-aggregatie. Transfers spot↔futures handmatig. → https://koinly.io/integrations/kraken/, https://support.koinly.io/en/articles/9490027-futures-and-perpetuals-pnl-other-gains, https://discuss.koinly.io/t/kraken-futures-api-access-denied/1895/8, https://discuss.koinly.io/t/transfer-kraken-standard-kraken-futures/27210
- **CoinLedger**: vraagt spot `ledgers.csv`; *"any imports containing [futures, derivatives and perpetuals] will fail at this time."* → https://help.coinledger.io/en/articles/5338231-kraken-ledgers-file-import-guide, https://help.coinledger.io/en/articles/2559346-help-my-import-is-failing-what-should-i-do
- **CoinTracking**: aparte Kraken Futures-importer (API + CSV), niets publiek gedocumenteerd. → https://cointracking.info/imports/kraken-tax/
- **Coinpanda** (nuttigste): CSV via Kraken Pro → Documents → Create export → Ledger → **Futures-tab**. *"Realized PnL from API is imported for closed positions only. If you import transactions from a CSV file, Realized PnL will be imported for every fill."* Funding alleen via CSV. → https://coinpanda.io/integrations/kraken-futures/
- **Divly**: wijst de account log aan: *"Click on Logs in the menu on the left. On the bottom of the page click Download All."* → https://divly.com/en/wallets-and-exchanges/kraken-futures-taxes
- **Blockpit**: API-only, "Futures Trades PnL (Profit, Loss, Fee and Funding)". → https://www.blockpit.io/integrations/kraken-futures-taxes
- **CoinTracker**: geen uitspraak gevonden. → https://www.cointracker.com/integrations/kraken

## 6. Open source
### ccxt `krakenfutures`
Bron: https://github.com/ccxt/ccxt/blob/master/ts/src/krakenfutures.ts
- `fetchLedger`: vraagt `count = limit * 2` omdat elke executie twee regels geeft; houdt alleen regels met `asset !== contract` (cash-leg). `amount = new_balance − old_balance`, daarna `amount += fee` (*"the fee is already deducted from the balance delta"*). `referenceId` = `execution` of `booking_uid` = join-key naar `fill_id`.
- Type-mapping: `futures trade`/`futures liquidation`/`futures assignee`/`futures assignor`/`futures unwind counterparty`/`futures unwind bankrupt`/`covered liquidation`/`settlement`/`conversion` → `trade`; `funding rate change`/`interest payment`/`kfee applied`/`tax withheld` → `fee`; `tax refund` → `rebate`.
- `fetchPositionsHistory`: `/history/v3/positions` met **`closed: true` als default** (*"the events that closed a position"*). Partials alleen met `params.decreased`/`increased`/`reversed`/`trades`/`funding_realization`/`settlement`. **Voor multi-TP dus alle event-types opvragen (of geen filter), anders alleen het laatste sluitingsevent.**
- `parsePosition`: `open`/`increase` → `newPosition`/`newAverageEntryPrice`; `close`/`decrease` → `oldPosition`/`oldAverageEntryPrice` met `executionSize`; `reverse` → hele oude positie gesloten. `realizedPnl` ← `realizedPnL`; `id` ← `executionUid`.

### rotki `KrakenFuturesAccountLogProcessor`
Bron: https://github.com/rotki/rotki/blob/develop/rotkehlchen/exchanges/kraken_futures.py (page size 500 in kraken.py)
- Werkt op account-log-rows; position-legs (`asset_symbol == contract`) apart gehouden per `execution_id` als metadata; cash-legs gegroepeerd op `execution_id or booking_uid`.
- **Harde validatie-identiteit** (als `DeserializationError` afgedwongen):
  `new_balance − old_balance == realized_pnl + realized_funding − fee − liquidation_fee`
  Onafhankelijk bevestigd op 504/504 regels in ccxt issue #29760. → https://github.com/ccxt/ccxt/issues/29760
- Reconstrueert bewust géén posities; bewaart `position_changes` (`old_size`, `new_size`, `old/new_average_entry_price`, `trade_price`) als extra_data. `cross-exchange transfer` wordt geskipt.

### Kraken CLI
https://github.com/krakenfx/kraken-cli — geen closed-positions-commando; alleen `fills`, `history-executions`, `history-orders`, `history-triggers`, `history-account-log-csv`.

### Niet afgerond
Brede GitHub-code-search (Deltalytix, TradeNote e.d.) liep op API-rate-limits.

## 7. Community-discussie
- r/KrakenSupport (03-09-2024): *"the only way possible is to download the futures ledger in History and do the exercise yourself"*. Support verwees naar de UI-view, geen export. → https://www.reddit.com/r/KrakenSupport/comments/1f7u468/seeing_realized_pnl_after_futures_trade_is_closed/
- ccxt #29760 (11-08-2026): *"`fetchMyTrades` on krakenfutures returns no fee information at all"*; maintainer: *"fills expose no fees while account-log has them and joins via execution = fill_id."* → https://github.com/ccxt/ccxt/issues/29760
- ccxt #29931 (18-08-2026): `/history/v3/positions` moet als private gesigneerd worden, anders `401 {"status":"unauthorized"}`. → https://github.com/ccxt/ccxt/issues/29931 ; implementatie PR #30503 → https://github.com/ccxt/ccxt/pull/30503
- Realized PnL per fill ontbreekt NIET; het zijn de fees die op `/fills` ontbreken.
- Klachten over partial-close-groepering bij Kraken Futures: geen bewijs gevonden.
- Kraken zelf (spot): *"You can, however, reconstruct order activity by reviewing your Trades export."* → https://support.kraken.com/articles/208267878-how-to-export-your-account-history

## Praktische punten voor de adapter
- Join-key: account-log `execution` == fills `fill_id` == positions `executionUid`.
- Validatie-identiteit per cash-regel: `new_balance − old_balance == realized_pnl + realized_funding − fee − liquidation_fee`.
- Cash-leg (`asset !== contract`) draagt PnL/fee/funding; position-leg (`asset === contract`) draagt size en avg entry — beide bewaren.
- `accountlogcsv` time-out-gevoelig voor grote accounts; JSON met `count=1000` is het optimum (3 tokens, pool 100 per 10 min).
- `from`/`to` zijn ids, `since`/`before` timestamps; geen `continuationToken` op account-log.
- `/history/v3/positions`: zonder filters of met alle booleans, anders alleen het laatste sluitingsevent.
- Fees komen niet uit fills; een fills-only pipeline geeft structureel verkeerde netto-PnL.

## Samenvattende matrix

| Tool | Kraken Futures? | Bron | Realized PnL | Partial closes | Kern-limitatie |
|---|---|---|---|---|---|
| TradesViz | Nee (alleen spot) | spot-CSV / spot-API | zelf berekend | flat-position + symbol (FIFO) | `<crypto>USD`-only |
| Tradervue | Nee (geen crypto) | generic CSV | zelf berekend | side-change / time-limit / flat | equities/futures/forex |
| TraderSync | Kraken = spot | generic CSV | zelf berekend | niet gedocumenteerd | instructies achter login |
| Edgewonk | Nee | manueel / Excel | gebruiker per exit | open qty → 0 | één SL/TP per trade |
| Koinly | Ja (wallet) | trade history | closing-PnL per close | geen; dag-aggregatie | executies niet geïmporteerd |
| CoinLedger | Nee | `ledgers.csv` (spot) | n.v.t. | — | futures-import faalt |
| CoinTracking | Ja | login-gated | "automatically" | geen bewijs | niets gedocumenteerd |
| Coinpanda | Ja | Documents → Ledger → Futures | API per close, CSV per fill | — | funding alleen via CSV |
| Divly | Ja | Logs → Download All | niet gedocumenteerd | geen bewijs | geen kolomspec |
| Blockpit | Ja (API) | futures-API | PnL/fee/funding | geen bewijs | geen CSV |
| ccxt | Ja | account-log + positions | balance-deltas / `realizedPnL` | `decreased:true` nodig | dropt position-leg |
| rotki | Ja | account-log | beide, gevalideerd | groepeert op `execution_id` | reconstrueert geen trades |

---

## Addendum (zelfde dag, open-source-sweep afgerond)

**Correctie op de TL;DR:** er is één open-source tool die wél posities reconstrueert uit de account-log-CSV: `alexkonsta93/krakenfuturestax` (`app/KrakenFuturesAdapter.ts`, laatste commit 2023-03-31, 0 sterren, inverse-only). Algoritme = ons patroon: CSV omkeren naar chronologisch, per markt één open bucket, `new balance` als lopende grootte, `new average entry price` als entry, klaar zodra de grootte 0 is, `realized pnl` optellen. Beperkingen: alleen `pi_`-contracten, PnL × trade price (inverse-conversie, fout voor `pf_`), hardcoded datumfilter, geen tests. Bruikbaar als bevestiging van het algoritme, niet als dependency. Zijn `Line`-interface is de enige publieke lijst van CSV-kolomnamen: `dateTime, type, symbol, account, 'trade price', 'realized pnl', 'realized funding', fee, 'funding rate', uid, 'new average entry price', 'new balance', change`.

**Docs-tip:** de OpenAPI-markdown-variant (`.md` achter de URL, bijv. `https://docs.kraken.com/api-reference/account-history/get-account-log.md`) toont de child-attributes die de HTML-pagina dichtgeklapt houdt. Daar staat o.a.: `new_balance` = "New balance of wallet **or new size of the position**" (cash-leg vs positie-leg); `/fills` heeft `sequence_id` (per markt monotoon, vanaf 1) maar geen fee en geen positionId; `accountlogcsv` = "500,000 rows of most recent account logs", docs onder v3, ccxt en python-kraken-sdk gebruiken v2.

**ccxt (commit eb062f4):** `parseTrade` leest `realized_pnl` niet en **schat** de fee uit de fee-tier; `accountlogcsv` is gedeclareerd maar wordt nergens aangeroepen; PR #30503 zegt letterlijk dat de `decrease`-tak van `fetchPositionsHistory` alleen "by reasoning about the documented payload" is gedekt, niet met echte data — precies onze use-case. Beschikbaar vanaf ccxt 4.5.84.

**rotki (commit a5e34ac, kraken.py L1239–L1315), paginatie-patroon om over te nemen:** `count=500`, `sort=desc`, dedupe op `booking_uid`, volgende pagina met `to = min(id) − 1` (**de id-grens is inclusief; zonder −1 dupliceer je rijen**), guard `if next_to >= previous_to: raise 'pagination did not advance'`, stop bij `earliest_log_id == 1`. Bij een mismatch tussen balans-delta en componenten gaat de hele groep naar `skipped_logs` voor retry, niet stil door.

**Waarschuwingen uit andere clients:** freqtrade berekent de fee zelf omdat `/fills` er geen heeft en de VWAP zelf omdat ccxt's `average` onbetrouwbaar is (ccxt#27996); nautilus_trader declareert `fee_paid` op fills die Kraken niet levert → stille nul-commissie. Hummingbot, TradeNote, Deltalytix, LuxAlgo/trade-journal, BittyTax, kraken-pnl-calculator: geen Kraken-Futures-reconstructie (gecheckt op regex, 0 hits).

**Bijgestelde conclusie van de agent:** `/api/history/v3/positions` als data-route (Kraken doet daar de running-size-naar-nul al server-side), account-log als tweede bron voor fees/funding en als validatie. *Onze keuze in `docs/plan-kraken-fix-2026-09-26.md` blijft de account-log als primaire bron voor CSV én API, met de position-events als plan B — omdat de account-log de CSV-import en de sync op één code-pad zet, we hem al 107/107 hebben gevalideerd, en de `decrease`-semantiek van de position-events door niemand tegen echte data is getest. De rauwe capture uit sessie 0 kan die afweging nog kantelen.*
