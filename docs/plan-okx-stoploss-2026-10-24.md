# OKX stop-loss, ingestelde take-profits en TP/SL/Close per afbouw — implementatieplan (F10)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** OKX-trades krijgen hetzelfde als Kraken (v1.11) en Hyperliquid (v1.12):
- de **oorspronkelijke stop-loss**, vergrendeld ("van OKX"), met "verschoven" en het verloop;
- de **ingestelde TP's** van een lopende positie;
- per afbouw het label **TP n / SL / Close ✋ / Liq** in de stappentabel en de TP-lijst.

**Architecture:**
- OKX loopt via de Worker. Er komt **één nieuwe Worker-actie `algos`** (Worker v24), die Zaratras via het dashboard
  deployt. De rest van de Worker blijft byte-gelijk aan v23.
- **Alleen `ExchangeAPI.okx` verandert**, plus één generieke haak in de gedeelde `backfillFills`:
  `ExchangeAPI[ex].naStappen?.(t)`. Dat is het dispatcher-patroon; voor andere exchanges is het een no-op.
- De gedeelde weergave doet de rest al: `perOrder`, de haak in `execTable`, `tpLabels`, de vergrendeling via
  `EXMAP[t.stopBron]`, en `partialPnlCel`.

**Tech Stack:** vanilla JS (single-file app), Cloudflare Worker (JS), Node + Playwright-specs.

**Spec:** dit document; Zaratras 24-10-2026 ("SL meegeven via OKX, net als bij de andere exchanges zichtbaar TP en
handmatige TP; niet de handelingen van de andere exchanges slopen"); besluiten 18-10 (exchange wint, vergrendeld);
het onderzoek in [docs/okx-model.md](okx-model.md) §2c en het OKX-API-onderzoek van 24-10 (samengevat hieronder).

## Wat OKX levert (docs-v5, gecontroleerd 24-10-2026)

| Endpoint | Wat | Belangrijk |
|---|---|---|
| `GET /api/v5/trade/orders-algo-history` | afgelopen TP/SL-orders, **3 maanden** | `ordType` verplicht (`conditional,oco` mag samen; `move_order_stop` apart); `state` verplicht, **één per call** (`effective`, `canceled`, `order_failed`); geen tijdfilter, pagineren met `after=<algoId>`, `limit` max 100; 20 req/2s |
| `GET /api/v5/trade/orders-algo-pending` | TP/SL-orders die nu openstaan | `ordType` verplicht; `state` is `live`/`pause` |
| `GET /api/v5/trade/orders-history` | gewone orders, **7 dagen** | `attachAlgoOrds[]` op de instap-order (`slTriggerPx`, `tpTriggerPx`, `sz`): het plan bij plaatsing; ook `source` (7 = door TP/SL) en `algoId` |
| `fills` / `fills-history` | wat we al ophalen | alleen `ordId`, **geen** `algoId` |

Velden op een algo-order: `algoId`, `instId`, `ordType`, `side`, `posSide`, `sz`, `closeFraction`, `reduceOnly`,
`slTriggerPx`, `tpTriggerPx`, `state`, `actualSide` (`tp`/`sl`), `actualPx`, `actualSz`, `triggerTime`, `cTime`,
`uTime`, **`ordIdList`** (de orders die eruit kwamen, meerdere bij een split).

**Koppeling afbouw → soort:** `fill.ordId ∈ algo.ordIdList` → `actualSide` (`tp`→TP, `sl`→SL); een
`move_order_stop` (trailing) → SL; een liquidatie-fill (`subType` 100-107/125-128) → Liq; anders hand.

**De oorspronkelijke SL is het lastige deel.** Een SL wijzigen (`amend-algos`) houdt **hetzelfde `algoId`** en
de nieuwste prijs; OKX bewaart geen revisies. Drie bronnen, in deze volgorde:
1. `attachAlgoOrds[].slTriggerPx` op de instap-order (orders-history, 7 dagen), als die bij een wijziging niet
   meeverandert — **te meten in Task 2**;
2. **eerst gezien**: de SL die de journal de eerste keer bij een lopende positie in `orders-algo-pending` zag
   (bewaard op de trade als `stopEerst`), omdat de sync elk kwartier draait;
3. anders `slTriggerPx` uit de algo-historie (de laatste stand); dan zonder "verschoven".

## Wat de opname liet zien (24-10-2026, Worker v24 live)

Opname van Zaratras' OKX-account (`tests/_fixtures/okx-algos.json`, gitignored): 81 algo-orders over 3 maanden,
allemaal `BTC-USD_UM_XPERP-310404`; 0 openstaand (geen lopende positie); 3 instap-orders (7 dagen); geen fouten.

- **SL en TP's zijn losse `conditional`-orders**, seconden tot minuten na de instap geplaatst; `attachAlgoOrds` is
  overal leeg. In september ook een paar `oco`-orders (SL + TP in één). Geen trailing (`move_order_stop`).
- **One-way-modus:** `posSide` is overal `net`; `side` is de sluitkant (`buy` sluit een short, `sell` een long);
  `reduceOnly` is `true`. TP op de hele positie: `closeFraction` `1` (geen `sz`).
- **Een SL verschuiven = annuleren + nieuwe order** (nieuw `algoId`), zoals bij Hyperliquid. Voorbeeld 24-09: SL 87.463
  geannuleerd 16:49:48, nieuwe SL 84.850 om 16:50:41. Wijzigen-in-plaats is niet gezien.
- **Koppeling exact:** in Zaratras' export (22-10) hangen alle 4 de TP-afbouwen via `ordIdList` aan hun TP-order. De 4
  afbouwen zonder koppeling zijn handmatige sluitingen: bij die trades staat de SL `canceled` op het moment van sluiten.
- **`posId` wordt hergebruikt:** de drie laatste trades hebben hetzelfde `posId` → koppelen op instrument (basis-asset),
  sluitkant en tijdvenster.
- **OKX-trades hebben geen TP-niveaus** (`tps: []`): die komen er per afbouw-order bij, zoals bij Hyperliquid.

**Rulings (vervangen de drie bronnen voor de oorspronkelijke SL):**
- De oorspronkelijke SL = de **eerst geplaatste SL-order** aan de sluitkant, aan de verlieskant van de entry, geplaatst
  tussen opening − 60 s en sluiting (of actief bij de opening, niet al afgelopen ervóór) — dezelfde regel als Hyperliquid
  (v1.12, met de C1-fix). Latere SL's met een andere prijs → `verschoven`, en het verloop.
- `_planOpInstap` en `stopEerst` vervallen: het plan op de instap-order is bij Zaratras leeg, en verschuiven maakt een nieuwe
  order. Kosten als het fout is: wie een SL *wijzigt in plaats van opnieuw zet*, ziet alleen de laatste prijs.
- Contracten → asset met `_ctVal(instId)` (B2) voor het percentage van een gepland TP.

## Global Constraints

- **Exchange-isolatie:** geen wijziging aan Kraken, Hyperliquid, Blofin, MEXC of FTMO; geen `if(exchange===…)` in
  gedeelde code. De enige gedeelde regel is de no-op-haak in `backfillFills`.
- **De Worker** levert Zaratras als bestand (`docs/worker-v24.js`); nooit `wrangler dev` of `proxy-local/`. Zolang hij
  v23 draait, moet een sync gewoon slagen, zonder stop en labels (net als HL bij een 429).
- **De stop van de exchange wint** en staat vast in het formulier (`stopBron:'okx'`), zoals bij Kraken (18-10).
- **Labels:** alleen take-profits genummerd; met de hand in winst "TP n ✋", met verlies "Close ✋" (`tpLabels`).
- **Je eigen geplande TP's en leverage** blijven staan als de sync een trade bijwerkt (zoals HL v1.13.2).
- **Geen push** zonder het letterlijke "push"/"live" van Zaratras. Eerst work.
- Commits Engels, UI-tekst Nederlands met Engelse tradingtermen.

## Review Focus

1. **One-way-modus (`posSide: net`)**: kant van de algo uit `side` (sluitkant) + `reduceOnly`/`closeFraction`, niet uit `posSide`.
2. **Wijzigen in plaats van opnieuw plaatsen**: een verschoven SL heeft hetzelfde `algoId` met de nieuwe prijs; de stop mag dan niet "verschoven = nee" met de nieuwe prijs worden.
3. **Hergebruikt `posId`** (OKX geeft een nieuwe positie op hetzelfde instrument binnen 30 dagen hetzelfde `posId`): koppel algo's op instrument + kant + **tijdvenster van de levensloop** (`openTime`..`closeTime`), niet op `posId`.
4. **Split-TP met één SL en "cost-price SL"** (`amendPxOnTriggerType=1`): één TP-order per niveau; de SL verhuist bij de eerste TP naar de instap. Dat is een SL-verschuiving, en de afbouw op de verschoven SL heet "SL".
5. **Oude Worker (v23) en fouten**: onbekende actie valt in v23 door naar `positions-history` (de `trades`-route); herken een echt antwoord aan `source:'algos'`, anders: geen stop, geen labels, sync slaagt.

---

### Task 1: Worker v24 — actie `algos`

**Files:**
- Create: `docs/worker-v24.js` (kopie van `docs/worker-v23.js` + één blok in `handleOKX`)
- Test: `tests/worker-okx-algos.spec.js` (patroon: `tests/worker-executions.spec.js`)

**Interfaces:**
- Produces: `POST {exchange:'okx', action:'algos', apiKey, apiSecret, passphrase, startTime}` →
  `{source:'algos', history:[…], pending:[…], orders:[…], _okxDebug:{calls, pages, errors:[…], afgekapt}}`
  - `history`: `orders-algo-history` voor `ordType=conditional,oco` × elke `state` (`effective`, `canceled`,
    `order_failed`) en `ordType=move_order_stop` × elke `state`; pagineren met `after=<laatste algoId>` tot een
    pagina < 100 rijen heeft, of tot de oudste `cTime` < `startTime`; hooguit **5 pagina's per combinatie**.
  - `pending`: `orders-algo-pending` voor `conditional,oco` en `move_order_stop`.
  - `orders`: `orders-history` (7 dagen) voor `instType` `SWAP` en `FUTURES`, alleen rijen met een niet-lege
    `attachAlgoOrds` of een `algoId`; pagineren met `after=<ordId>`, hooguit 5 pagina's per instType.
  - Fouten per call komen onder `_okxDebug.errors` (zoals `fills`), nooit als top-level `error`.

- [ ] **Step 1: Write the failing test** `tests/worker-okx-algos.spec.js` met een nep-`fetch`, zoals `worker-executions`:
  - de juiste paden en query's (`ordType=conditional%2Coco` of `conditional,oco`, `state=effective`, enz.), op `https://eea.okx.com`;
  - de OKX-handtekening: base64 HMAC-SHA256 van `ts + 'GET' + pad+query` met de secret, in `OK-ACCESS-SIGN`;
  - pagineren met `after` en stoppen bij `cTime < startTime`; hooguit 5 pagina's (dan `afgekapt:true`);
  - een fout in één call: de rest komt door, de fout staat in `_okxDebug.errors`;
  - `source === 'algos'`;
  - **alle andere code byte-voor-byte gelijk aan v23** (blok wegknippen, vergelijken; zie `worker-executions` regel 62-66).
- [ ] **Step 2:** `node tests/worker-okx-algos.spec.js` → FAIL (`docs/worker-v24.js bestaat niet`).
- [ ] **Step 3:** schrijf het blok in `handleOKX` vóór de `trades`-route, met de bestaande `get`.
- [ ] **Step 4:** spec groen; `node tests/worker-monitoring.spec.js` op v24 groen.
- [ ] **Step 5:** commit `Worker v24: OKX action 'algos' (TP/SL algo orders, pending, entry-order attachAlgoOrds)`; zet `worker-okx-algos` in `tests/release-set.js`.
- [ ] **Step 6:** Zaratras deployt v24 in het Cloudflare-dashboard (`morani-proxy`). CLAUDE.md: productieversie → v24.

### Task 2: Opname van Zaratras' account en de meting

**Files:**
- Create: `tests/_fixtures/okx-algos.json` (gitignored, zoals de HL-opname)
- Modify: dit plan, sectie "Wat de opname liet zien"

- [ ] **Step 1:** Zaratras draait in de console van de journal (ingelogd, OKX gekoppeld):
  ```js
  copy(JSON.stringify(await proxyCall({exchange:'okx',action:'algos',apiKey:CONNS.okx.apiKey,apiSecret:CONNS.okx.apiSecret,passphrase:CONNS.okx.passphrase,startTime:Date.now()-90*864e5})))
  ```
  en plakt het in `tests/_fixtures/okx-algos.json`. Sleutels zitten er niet in.
- [ ] **Step 2:** meet en noteer in dit plan:
  - welke `ordType` de OKX-app maakt voor een SL bij de instap en voor een positie-TP/SL;
  - of `ordIdList` van een `effective` algo de `ordId` van de afbouw-fill bevat (koppeling exact);
  - of een verschoven SL hetzelfde `algoId` heeft, en of `attachAlgoOrds[].slTriggerPx` op de instap-order de
    oorspronkelijke prijs houdt (bron 1 bruikbaar of niet).
- [ ] **Step 3:** als bron 1 niet klopt: ledger-ruling, en Task 4 gebruikt alleen bron 2 en 3.

### Task 3: Algo-orders lezen en aan een trade koppelen (pure functies)

**Files:**
- Modify: `work/syncjournal.html` — `ExchangeAPI.okx` (na `stepsForTrade`)
- Test: `tests/okx-stoploss.spec.js` (nieuw)

**Interfaces:**
- Produces:
  - `_algoRegels(antwoord) → [{algoId, instId, basis, posSide, side:'buy'|'sell', soort:'sl'|'tp'|'oco'|'trail', slPx, tpPx, sz, hele:boolean, state, actualSide, actualPx, triggerTime, cTime, uTime, ordIds:string[], live:boolean}]`
    (`basis` = asset uit `instId`, zoals in `stepsForTrade`; `hele` = `closeFraction==='1'`; `live` = uit `pending`)
  - `_slTpVoorTrade(t, regels) → {stop:number|null, verschoven:boolean, stopVerloop:[{ts,price,status}], tps:[{price,pct,status}]}`
    (ruling 24-10: geen plan-op-instap en geen `stopEerst`; zie "Wat de opname liet zien")
  - `_afbouwSoort(regels) → (groep) => 'tp'|'sl'|'liq'|'hand'|null` (`null` als de stap geen `ordId` heeft)

- [ ] **Step 1: tests** in `tests/okx-stoploss.spec.js` (synthetische OKX-rijen):
  - SL `conditional` sell-stop onder de entry van een long → stop;
  - `oco` met beide prijzen: SL-kant telt, TP-kant is een gepland TP;
  - TP aan de winstkant is geen SL; een stop aan de instap-kant is geen SL;
  - **one-way (`posSide:'net'`)**: kant uit `side`, sluitkant van de trade;
  - **hergebruikt posId**: een SL van een vorige levensloop (zelfde instrument, `uTime` vóór de opening) telt niet;
  - verschoven zoals Zaratras het doet: SL 87.463 geannuleerd, daarna een nieuwe SL 84.850 (nieuw `algoId`): stop 87.463,
    `verschoven:true`, verloop van 2;
  - een SL die vóór de opening al afgelopen was (vorige positie) telt niet (de HL-C1-regel);
  - `_afbouwSoort`: fill-`ordId` in `ordIdList` van een `effective` algo met `actualSide:'tp'` → `tp`, `'sl'` → `sl`;
    `trail` → `sl`; liquidatie-stap → `liq`; geen match → `hand`; geen `ordId` → `null`;
  - **split-TP**: drie TP-algo's met eigen `sz` → drie geplande TP's met `pct` = `sz`/positie.
- [ ] **Step 2:** FAIL. **Step 3:** implementeer. **Step 4:** groen. **Step 5:** commit.

### Task 4: In de sync — stop, geplande TP's en labels

**Files:**
- Modify: `work/syncjournal.html` — `ExchangeAPI.okx.fetchTrades`, nieuw `afterImport` en `naStappen` op `ExchangeAPI.okx`;
  de haak in `backfillFills` (na `t.fills=fills`): `if(typeof ad.naStappen==='function'){try{ad.naStappen(t);}catch(e){}}`
- Test: `tests/okx-stoploss.spec.js` (sync-deel, met nep-`proxyCall`) en de bestaande OKX-specs

**Interfaces:**
- Consumes: Task 3.
- Produces op een OKX-trade: `stop`, `stopBron:'okx'`, `stopVerschoven`, `stopVerloop`, `tpsGepland`,
  `fills[].soort`, en per afbouw-order een TP-niveau in `tps` met `hit:true`, `ts` en `soort` (zelfde vorm als HL; je
  eigen niet-geraakte TP's blijven erbij).

- [ ] **Step 1: tests** (sync via `syncExchange('okx')`, nep-Worker):
  - nieuwe gesloten trade met SL en twee TP-afbouwen → stop van OKX, labels `TP1, TP2`, daarna stop-out `SL`;
  - **één `algos`-aanroep per sync**;
  - lopende positie: SL en geplande TP's uit `pending` op de rij; na verschuiven (geannuleerd + nieuw) blijft de stop
    de eerste, `verschoven:true`;
  - **Zaratras' opname** (`tests/_fixtures/okx-algos.json`, overgeslagen als hij ontbreekt) tegen zijn drie trades met
    stappen: 05-10 → TP1, TP2, Close ✋, stop 87.000; 20-10 → TP1, TP2, Close ✋, stop 81.200; 28-09 → stop 82.000;
  - een zelf getypte stop (`stopBron:'gebruiker'`) maakt plaats voor die van OKX;
  - **Worker v23** (antwoord zonder `source:'algos'`) en een fout: trades komen binnen, geen stop, geen labels;
  - trade waarvan de stappen pas in `backfillFills` binnenkomen (nieuw): labels via `naStappen` in dezelfde sync;
  - **isolatie**: `partial-alle-exchanges`, `kraken-*`, `hl-*`, `blofin-*` blijven groen.
- [ ] **Step 2:** FAIL. **Step 3:** implementeer. **Step 4:** groen + release-poort. **Step 5:** commit.

### Task 5: Droogtest op Zaratras' opname en release

- [ ] **Step 1:** speel `tests/_fixtures/okx-algos.json` af tegen zijn OKX-trades uit de laatste export
  (alleen de nodige velden lezen); controleer per trade stop, labels en TP's met Zaratras.
- [ ] **Step 2:** `pr-reviewer-nl` over de branch; Critical/Important in één fix-ronde met eerst-rode tests.
- [ ] **Step 3:** release (minor) volgens CLAUDE.md; changelog vermeldt dat **Worker v24** nodig is.
- [ ] **Step 4:** work; live alleen op Zaratras' "push"/"live".

## Bewust niet in dit plan
- **Blofin:** eigen plan daarna.
- **Override-knop** (F9) en **stopbeweging-analytics** (F5): gedeeld, eigen story.
- **WebSocket** (`orders-algo`-kanaal) voor elke SL-wijziging: alleen als "eerst gezien" in de praktijk tekortschiet.
