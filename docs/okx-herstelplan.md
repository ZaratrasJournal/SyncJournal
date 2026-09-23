# OKX-herstelplan

Datum: 2026-09-22. Hoort bij [okx-model.md](okx-model.md) (hoe OKX werkt). Status: **stap 1 gebouwd** (v0.9.112, lokaal; spec `tests/okx-levensloop.spec.js`, 25/25 op Denny's back-ups en de snapshot van 29-06). Hyperliquid naar model B: gebouwd in v0.9.113 (`tests/hyperliquid-levensloop.spec.js`, 25/25 op de wallet-snapshot van mei). Formulier vergrendeld in v0.9.115. Blofin naar model B in v0.9.116 (zie onderaan). OKX stap 2 in v0.9.118, Kraken in v0.9.119 en afgerond in v0.9.126. Alle vier de exchanges staan op model B; Kraken wacht alleen nog op de Worker-update (zie `docs/worker-update.md`). Rest: stap 3, plan tegen uitvoering.

## Wat er kapot is, in één zin

Wij sleutelen OKX-trades op `posId`, maar OKX hergebruikt dat id tot 30 dagen na een volledige sluiting — dus overschrijft elke heropening de vorige trade, en lekken de fills van de nieuwe positie in de stappentabel van de oude.

Zichtbaar in Denny's back-up van 22-09: de positie van 20–21 sept (P&L −9,76, 0,009 BTC) is vervangen door die van 22 sept (P&L −1,56, 0,0019 BTC), onder één rij die van 20-09 03:51 tot 22-09 10:53 loopt en negen stappen van twee posities toont.

## Dubbelcheck: elke aanname met bewijs

| # | Aanname | Bewijs | Zekerheid |
|---|---|---|---|
| 1 | OKX hergebruikt `posId` na volledige sluiting | Docs *positions-history*: "The posId will be expired if it is more than 30 days after the last full close position, then position will use new posId." Snapshot 29-06: **zes** levenslopen, allemaal `posId 3669951356244779008` | zeker |
| 2 | `cTime` is per levensloop uniek en blijft stabiel zolang de positie loopt | Snapshot 29-06: zes verschillende `cTime`'s (15:24:33 … 16:32:56); het `type:1`-record van een lopende positie houdt zijn `cTime`. Back-up 21-09: twee tussenstanden, zelfde `cTime` 03:51:18, andere `uTime` | zeker |
| 3 | Fills dragen géén `posId` | Docs *transaction details*: veldenlijst bevat `ordId`, `tradeId`, `billId`, `posSide` — geen `posId` | zeker |
| 4 | Fills zeggen zelf of ze openen of sluiten | `subType` 3/4 = open long/short, 5/6 = close long/short, 100–107 liquidatie, 125–128 ADL | zeker |
| 5 | `fillPnl` is per fill de gerealiseerde P&L en klopt met ons model | Docs-formule `(fillPx − avgPx) × fillSz × ctVal`; onze eerste afbouw +1,5778 vs OKX-export +1,57778431 | zeker |
| 6 | Sorteren hoort op `fillTime`, niet `ts` | Docs: "For chronological ordering of trades, sort by fillTime, not ts." | zeker |
| 7 | De sluitingen waren TP/SL-algo's, gekoppeld aan de instap-orders | OKX-export *Order History*: kolom **Bot ID** gevuld bij precies de drie sluitingen; prefix matcht de instap-order (`39402602602…` ↔ `3940260260269182976`) | zeker |
| 8 | Een hersync repareert een bestaande rij als de sleutel matcht | `refreshFromSync` overschrijft `SJ_SYNC_FIELDS` en wist `fills` bij gewijzigde `closeTime`/`pnl` | zeker (code) |
| 9 | Een hersync haalt de oude levensloop opnieuw op | Worker `trades`: `positions-history` gefilterd op `uTime >= startTime`; bewaartermijn 3 maanden | zeker, mits `startTime` ver genoeg terug (zie stap 1) |
| 10 | Worker `trades` haalt hooguit 100 rijen, zonder paginering | Worker v19: `limit=100`, geen `after` | bekende beperking, niet blokkerend voor Denny |

Wat ik **niet** kan bewijzen zonder live sleutels: dat `fills-history` daadwerkelijk fills teruggeeft voor Denny's venster. Sinds v0.9.109 doet de knop dat wel (screenshot van Denny), dus dat staat.

## Stap 1 — Sleutel `okx_<posId>_<cTime>`

**Wijziging**
- `ExchangeAPI.okx._normalise`: `id: "okx_" + posId + "_" + cTime` (valt terug op `uTime` als `cTime` ontbreekt — hoort niet voor te komen).
- `ExchangeAPI.okx._normaliseOpen`: placeholder `okx_open_<posId>_<cTime>` (open posities hebben `cTime`, zie snapshot).
- Migratie **v5**, alleen OKX-trades met `srcId` zonder tijddeel (`okx_<cijfers>`):
  1. hernoem naar `okx_<posId>_<openTime>` (`openTime` = `cTime`, staat al op de trade);
  2. wis `fills` (kunnen stappen van een andere levensloop bevatten);
  3. doe hetzelfde met `srcId`'s in de prullenbak (anders komt een verwijderde trade onder de nieuwe sleutel één keer terug);
  4. zet `CONNS.okx.lastSync` terug naar `min(openTime) − 1 uur`, zodat de eerstvolgende sync de oude levensloop opnieuw ophaalt en de overschreven rij herstelt (aanname 8 + 9).
- Migratie v3 blijft staan (historisch pad); v5 corrigeert het resultaat ervan.

**Wat er met Denny's data gebeurt**
- Rij `okx_3809943469299781632` → `okx_3809943469299781632_1789869078888`, fills leeg, lastSync terug naar 20-09.
- Sync: `positions-history` geeft twee records (cTime 20-09 03:51 en 22-09 ~05:03). Het eerste matcht de hernoemde rij → `refreshFromSync` zet P&L −9,76 / exit 82.039 / 0,009 BTC terug. Het tweede is nieuw → eigen trade, P&L −1,56.
- Notities, tags, screenshots blijven staan (`adoptUserFieldsSJ` is niet eens nodig: de rij wordt hernoemd, niet vervangen).

**Risico's**
- Gebruikers zonder OKX: migratie doet niets.
- Een OKX-positie ouder dan 3 maanden: hersync vindt hem niet meer; rij blijft staan met de laatste stand. Dat is niet erger dan nu.
- `lastSync` terugzetten betekent één zwaardere sync (tot 100 rijen). Acceptabel.

**Tests**
- Migratietest op Denny's echte back-ups: 21-09 (twee tussenstanden → één trade, ongewijzigd) en 22-09 (gelijmde rij → hernoemd, fills leeg, lastSync teruggezet).
- Synctest met de snapshot van 29-06: zes levenslopen met één `posId` → **zes** trades, geen overschrijving.
- Herhaalde sync met dezelfde levensloop (tussenstand → eindstand) → één trade, bijgewerkt.
- Prullenbak-guard onder de nieuwe sleutel.
- Volledige suite.

## Stap 2 — Stappen op OKX' eigen begrippen

**Wijziging** (alles in de OKX-adapter; `fillTimeline` blijft exchange-vrij)
- `stepsForTrade` geeft per fill mee: `effect` (`inc` bij subType 3/4, `dec` bij 5/6, `liq` bij 100–107/125–128; bij net-mode 1/2 valt hij terug op `side`), `pnlExch` (= `fillPnl`), `ordId`, en sorteert op `fillTime`.
- `fillTimeline` gebruikt `effect` als die er is (anders `side`, zoals nu) om te bepalen of de positie groeit of krimpt; open/bij/af/om blijft uit de lopende teller komen. Per afbouwstap wordt `pnlExch` het getoonde bedrag, ons eigen cijfer blijft als controle (tooltip bij > 1 cent verschil, zoals nu bij de totaalregel).
- Nieuw stapsoort `Liq` voor liquidatie/ADL.
- Venster per levensloop is met stap 1 vanzelf goed.

**Tests**
- Denny's zeven echte fills met `subType` → zelfde uitkomst als nu (regressie), en met opzettelijk verkeerde `side` maar juiste `subType` → nog steeds goed.
- `ts` en `fillTime` in andere volgorde → sortering volgt `fillTime`.
- `fillPnl` leidend, eigen berekening als tooltip.

## Stap 3 — Plan tegen uitvoering (TP's)

**Afhankelijk van een Worker-actie** `algo_history` (`/trade/orders-algo-history?ordType=conditional,oco` voor `effective` én `canceled`) — dus van de keuze eigen Worker of Morani's Worker aanpassen. Pas daarna:
- koppeling `algoId → ordIdList → fills(ordId)`;
- per gepland TP/SL: triggerprijs, deel van de positie (`sz` / `closeFraction`), uitkomst (geraakt met werkelijke prijs / geannuleerd / niet bereikt);
- weergave in de stappentabel: de afbouwstap krijgt het label van de TP die hem veroorzaakte.

Aparte release. Ontwerp eerst als demo.

## Volgorde en go/no-go

1. Stap 1 bouwen → suite → op Denny's back-up van 22-09 draaien → **Denny controleert** dat beide posities terug zijn met de juiste P&L → release.
2. Stap 2 → release.
3. Worker-beslissing → stap 3.

v0.9.111 (datums en tussenkoppen in de tabel) gaat mee met stap 1; de tussenkop "Nieuwe positie" blijft als vangnet bestaan maar hoort na stap 1 niet meer voor te komen.

## Blofin (gebouwd in v0.9.116)

Bron: [Blofin API docs](https://docs.blofin.com/), *GET Positions History*, *GET Trade History*; snapshots uit Denny's account van 01-05 en 04-05-2026 (`tests/_fixtures/blofin-snapshot*.json`).

| Aanname | Bewijs |
|---|---|
| `positionId` is per instrument en wordt hergebruikt | Snapshot 04-05: **33** levenslopen onder `positionId 8000000610734` |
| `createTime` is per levensloop uniek en stabiel | 33 verschillende `createTime`'s; `historyId 109673008` heeft op 01-05 en 04-05 dezelfde `createTime` |
| Het record werkt in-place bij | Diezelfde `historyId`: 01-05 `closePositions 0.001/0.0029`, P&L 3,26; 04-05 `0.0029/0.0029`, P&L 4,52 |
| Fills dragen geen positie-id, wel `fillPnl` | Docs *Trade History*: `tradeId, orderId, fillPrice, fillSize, fillPnl, positionSide, side, fee, ts` |

Sleutel: `blofin_<positionId>_<createTime>`. Stappen via `fills-history` per levensloop-venster (Blofin praat rechtstreeks vanuit de browser, geen Worker). `detectPartials` is voor Blofin een no-op. Migratie v7 voegt de oude rij-per-sluiting-trades samen per (positionId, openTime). Spec: `tests/blofin-levensloop.spec.js` (21/21, waarvan de twee snapshots als twee syncs). De deterministische partial-test in `exchange-sync2` draait nu op Kraken, de laatste exchange op model A.
