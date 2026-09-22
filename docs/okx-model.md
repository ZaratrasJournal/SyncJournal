# Hoe OKX werkt — en waar wij ervan afwijken

Datum: 2026-09-22. Bron: [OKX API v5 docs](https://www.okx.com/docs-v5/en/), secties *Get positions history*, *Transaction details (3 days / 3 months)*, *Order history*, *Algo order history*. Aanleiding: Denny's OKX-trades liepen door elkaar (orders, fills, TP's), zie de stappentabel van 22-09.

## 1. De vier dingen die OKX kent

| Object | Sleutel | Wat het is | Endpoint |
|---|---|---|---|
| **Order** | `ordId` | Een opdracht: "verkoop 39 contracten limiet 81.055". Kan in stukjes gevuld worden. | `/trade/orders-history(-archive)` |
| **Fill** | `tradeId` / `billId` | Eén uitvoering. Een order heeft 1..n fills; elke fill heeft de `ordId` van zijn order. | `/trade/fills` (3 dagen), `/trade/fills-history` (3 maanden) |
| **Positie-levensloop** | `posId` **+ `cTime`** | Van eerste opening tot volledig vlak. Eén record per levensloop, dat bijwerkt bij elke (gedeeltelijke) sluiting. | `/account/positions-history` |
| **Algo-order** (TP/SL) | `algoId` | Een voorwaardelijke opdracht. Als hij afgaat, maakt OKX er een gewone order van (`source: 7`, `algoId` gevuld) — en dié krijgt fills. | `/trade/orders-algo-history` |

Dus: **een TP is geen fill.** Een TP is een algo-order die, als hij raakt, een gewone order spawnt; die order heeft fills. Wat er in de fills staat is wat er *gebeurd* is; wat er in de algo-orders staat is wat je *gepland* had.

## 2. De drie feiten die ons de das omdeden

### 2a. `posId` wordt hergebruikt

> *posId — Position ID. There is attribute expiration. The posId will be expired if it is more than 30 days after the last full close position, then position will use new posId.*

Sluit je een positie volledig en open je binnen 30 dagen opnieuw op hetzelfde instrument en dezelfde kant, dan krijgt die **hetzelfde `posId`**. Denny sloot op 21-09 19:39 en opende op 22-09 05:03: zelfde id.

Wat wij doen: sinds v0.9.104 is de trade-sleutel `okx_<posId>` (migratie v3, "één positie = één trade"). Daarmee **plakken we twee losse posities aan elkaar**. De sleutel daarvóór was `okx_<posId>_<uTime>`; die gaf juist een dubbele rij bij elke gedeeltelijke sluiting, omdat `uTime` bijwerkt.

De juiste sleutel is **`okx_<posId>_<cTime>`**: `cTime` is "Created time of position" en hoort per levensloop uniek te zijn. *(Te bevestigen met Denny's verse export: zelfde posId, twee verschillende cTime's.)*

Denny's back-up van 21-09 klopt overigens met dit model: twee rijen, zelfde `posId`, zelfde `cTime` (20-09 03:51:18), verschillende `uTime` (03:22 en 19:39). Dat is één levensloop, twee tussenstanden. Die samenvoegen was goed. De positie van 22-09 samenvoegen is fout.

### 2b. Fills zeggen zelf of ze openen of sluiten

Elke fill heeft een `subType`:

| subType | Betekenis |
|---|---|
| 1 / 2 | Buy / Sell (net-mode) |
| **3 / 4** | **Open long / Open short** |
| **5 / 6** | **Close long / Close short** |
| 100–107 | (Gedeeltelijke) liquidatie |
| 125–128 | ADL |

Wij leiden "open / bij / af" af uit `side` en een lopende teller. Dat werkt zolang het venster klopt — en gaat mis zodra er fills van een andere positie in het venster vallen. OKX zegt het gewoon; dat moeten we gebruiken.

Fills hebben verder:
- **`fillPnl`** — gerealiseerde P&L van díe fill, formule `(fillPx − avgPx) × fillSz × ctVal`, 0 bij openen. OKX rekent dit al voor ons uit; ons lopend-gemiddelde-model reproduceerde het exact (+1,5778 vs +1,57778431), maar OKX' cijfer hoort leidend te zijn.
- **`fillTime`** vs `ts` — docs: *"For chronological ordering of trades, sort by fillTime, not ts."* Wij sorteren op `ts`.
- **Geen `posId`.** Fills weten niet bij welke positie ze horen. Koppelen kan alleen op instrument + `posSide` + tijdvenster van de levensloop (`cTime`..`uTime`). Daarom is 2a zo belangrijk: een verkeerd venster geeft verkeerde fills.
- `fee` negatief = betaald; `feeCcy` is de valuta.

### 2c. TP's zijn algo-orders, geen fills

Wat een trader een "TP" noemt, bestaat bij OKX op twee plekken:

1. **Op de instap-order**: `attachAlgoOrds[]` — de TP/SL die je bij het plaatsen meegaf, met `tpTriggerPx`, `slTriggerPx` en bij split-TP's per stuk een `sz`. Dit is **het plan**.
2. **In de algo-historie**: `orders-algo-history` met `state` (`effective` = afgegaan, `canceled`, `order_failed`), `actualSide` (`tp` / `sl`), `triggerTime`, en `ordIdList` → de gewone order(s) die eruit kwamen → hun fills. Dit is **wat ervan terechtkwam**.

Onze `tps[]` op een trade zijn ingevoerde niveaus zonder koppeling aan een van beide. Om "TP1 geraakt op 80.378, TP2 geannuleerd, rest handmatig gesloten" te tonen — het plan-tegen-uitvoering-verschil dat geen andere journal laat zien — moet de Worker een `algo_history`-actie krijgen en koppelen we `algoId → ordIdList → fills`.

## 3. Kleinere afwijkingen

- `fills-history` **vereist `instType`** (de Worker geeft FUTURES én SWAP mee — goed) en bewaart 3 maanden. `fills` (3 dagen) heeft een zesmaal hoger rate-limit (60/2s vs 10/2s); voor verse trades is dat de betere eerste keus.
- Tijdvenster per positie moet `cTime − marge` .. `uTime + marge` van díe levensloop zijn. Met de gelijmde trade liep het venster tot 22-09 en kwam de tweede positie mee.
- De Worker slikt fouten van `fills-history` in (`safeGet2` → `[]`). Voorstel in `docs/worker-okx-complete.js` (`_okxDebug`, geen top-level `error` — de Worker is gedeeld met Morani's journal).

## 4. Wat dit betekent voor de opbouw

```
positions-history  ──►  trade   (sleutel posId+cTime; entry=openAvgPx, exit=closeAvgPx,
                                 pnl=realizedPnl, venster=cTime..uTime)
fills(-history)    ──►  stappen (subType = open/bij/af; fillPnl per stap; sorteer op fillTime;
                                 koppel op instId+posSide+venster)
orders-history     ──►  plan    (attachAlgoOrds op de instap-order = geplande TP/SL)
algo-history       ──►  uitkomst(state/actualSide/triggerTime; ordIdList → fills = wat er raakte)
```

Volgorde van herstel, elk apart te testen:
1. **Sleutel** `okx_<posId>_<cTime>` + migratie die de gelijmde rijen weer splitst (of: verwijderen en opnieuw syncen — de data komt van OKX, niet van de gebruiker).
2. **Stappen**: `subType` gebruiken, `fillPnl` leidend, sorteren op `fillTime`, venster per levensloop.
3. **Plan vs. uitvoering**: Worker-actie `algo_history`, koppeling naar de stappentabel. Aparte stap, aparte release.

Niets hiervan is gebouwd. Eerst Denny's verse export naast dit model leggen.
