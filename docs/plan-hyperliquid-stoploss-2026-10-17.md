# Hyperliquid stop-loss, take-profits en hoe de trade dichtging — implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Bijgewerkt 18-10-2026** na Kraken (v1.11). Wat sindsdien gedeeld is gebouwd, krijgt Hyperliquid gratis mee;
> dit plan bouwt alleen nog de Hyperliquid-adapter. Besluiten van Denny die het oorspronkelijke plan wijzigen:
> - **De stop van de exchange wint en is vergrendeld**, net als entry en exit. Een eerder zelf ingevulde stop
>   maakt plaats. Kent de exchange geen stop, dan vult Denny hem zelf in. (Was: "een zelf ingevulde stop wint".)
> - **Elke afbouw krijgt een label:** TP n (alleen take-profits genummerd), **SL** of **Close** (met de hand).
> - **Alle uitvoeringen blijven zichtbaar** in "Zo is deze positie gelopen", met een haak per order.
> - **Eén exchange tegelijk, elk in de eigen adapter.** Hyperliquid eerst, daarna OKX, dan Blofin.

**Goal:**
- Elke Hyperliquid-trade krijgt automatisch zijn **oorspronkelijke stop-loss** (vergrendeld, "van Hyperliquid"), met
  "verschoven" en het verloop als hij later is aangepast, en zijn **ingestelde take-profits**: geraakt, open of geannuleerd.
- Elke afbouw zegt **TP n / SL / Close / Liq**, in de stappentabel, de tijdlijn, de presentatie en de TP-lijst.
- Een lopende positie toont direct zijn SL en TP's (de lopende P&L doet Hyperliquid al).

**Architecture:**
- **Geen Worker, geen sleutels.** Hyperliquid's openbare info-endpoint (`POST https://api.hyperliquid.xyz/info`) geeft per wallet:
  - `historicalOrders`: de laatste 2000 orders, één regel per statuswijziging;
  - `frontendOpenOrders`: de orders die nu openstaan;
  - `userFills` / `userFillsByTime`: elke fill met zijn `oid` (de order waar hij bij hoort).
- **Alleen `ExchangeAPI.hyperliquid` verandert.** De adapter vult dezelfde velden als Kraken; de gedeelde code toont ze al:

| Gedeeld (al gebouwd, exchange-onafhankelijk) | Wat Hyperliquid moet vullen |
|---|---|
| `perOrder(fills)` en de haak in `execTable` | `ordId` op elke fill-stap (= HL `oid`) |
| `tpLabels(lijst)`: TP n / SL / Close / Liq | `soort` op elke afbouw-fill en op elk TP-niveau (`tps[i].soort`) |
| Vergrendelen + label "(van …)" via `EXMAP[t.stopBron]` | `stop` en `stopBron:'hyperliquid'` in `afterImport` |
| `fillTimeline` geeft `ordId` en `soort` door | — |

**Tech Stack:** vanilla JS (single-file app), Node + Playwright-specs, de wallet-opname (`tests/helpers/hl-wallet.js`).

**Spec:** dit document; gesprekken met Denny op 17 en 18-10-2026; meting op zijn echte wallet op 17-10-2026.

## Wat de echte wallet liet zien (17-10-2026)

- **Lopende BTC long 0,00391 @ 81.073**, met 4 open trigger-orders:

  | Order | `orderType` | `side` | `triggerPx` | `sz` | `reduceOnly` | `isPositionTpsl` |
  |---|---|---|---|---|---|---|
  | SL | `Stop Market` | `A` (= sell) | 79440 | 0.00391 | true | false |
  | TP1 | `Take Profit Market` | `A` | 83179 | 0.00132 | true | false |
  | TP2 | `Take Profit Market` | `A` | 85232 | 0.00148 | true | false |
  | TP3 | `Take Profit Market` | `A` | 87280 | 0.00164 | true | false |

- **`historicalOrders`:** 89 regels, terug tot april 2026. Eén regel per statuswijziging: hetzelfde `oid` komt meerdere keren voor (`open`, later `triggered`/`filled`/`canceled`/`reduceOnlyCanceled`).
- **Een SL wijzigen is annuleren plus een nieuwe order** (nieuw `oid`). Voorbeeld van 14-10 om 20:51: Buy-stop 82500 `oid …591466` werd `canceled`, direct daarna kwam `oid …807461` op 82500.
- **`isPositionTpsl` is `false`**, ook voor de SL op de hele positie: niet bruikbaar. Zijde, soort en prijs wel.
- **`side`:** `A` = verkopen (ask), `B` = kopen (bid).
- **Nog te bevestigen in Task 1:** dat een fill van een geraakte trigger hetzelfde `oid` draagt als de trigger-order
  (de order gaat van `open` naar `triggered`/`filled` onder hetzelfde `oid`, dus dat ligt voor de hand). Bevestigt de
  opname het niet, dan valt Task 4 terug op tijd + kant, zoals bij Kraken.

---

## Foutgevoeligheid en hoe we dat voorkomen

| # | Wat kan misgaan | Gevolg | Hoe we het voorkomen |
|---|---|---|---|
| 1 | Een order van een **vorige of volgende positie** op dezelfde coin wordt gekoppeld | Verkeerde stop, verkeerde R | Alleen orders geplaatst tussen `openTime − 60 s` en `closeTime`, aan de **sluitende kant**. Bij een omkering onderscheidt de kant de twee posities. Test met een flip. |
| 2 | Een **TP of instap-stop** wordt aangezien voor de SL | R veel te klein of negatief | SL = `Stop …` aan de sluitende kant, prijs aan de **verlieskant** van de entry. TP = `Take Profit …`. Een stop aan de winstkant gebruiken we **niet** als oorspronkelijke SL. |
| 3 | De SL is **verschoven** en de journal neemt de nieuwe stand | R klopt niet meer | De **eerste** stop na de opening telt. Latere stops zetten `stopVerschoven` en komen in `stopVerloop`. |
| 4 | Een **eerder zelf ingevulde** stop | Wijkt af van wat in de markt stond | **Besluit 18-10: de exchange wint** (zoals Kraken). Kent Hyperliquid de stop, dan vervangt die een getypte stop en is het veld vergrendeld. Kent hij hem niet, dan blijft de eigen stop staan. Komt er een override-knop ("Zelf aanpassen"), dan respecteert de sync `stopBron:'gebruiker'` weer. |
| 5 | **Meerdere stops** voor delen van de positie | Onduidelijk welke "de" stop is | Meerdere stops binnen 60 s van de eerste: het op grootte gewogen gemiddelde. Test met twee deel-stops. |
| 6 | **Geschiedenis te kort**: meer dan 2000 orders geleden | Oude trades zonder stop en zonder labels | Geen stop: R blijft "—". Geen order bekend: label blijft TP n (zoals nu). Nooit gokken. |
| 7 | **API-fout of rate-limit** | Sync mislukt | Orders ophalen is een extra: bij een fout komen de trades binnen zonder stop en labels; de volgende sync probeert opnieuw. |
| 8 | **Zichtbare verandering** van R-cijfers | Denny ziet andere statistieken | Changelog benoemt het. Bij elke stop staat "(van Hyperliquid)". |
| 9 | **Hyperliquid wijzigt de `orderType`-teksten** | Niets gekoppeld | Herkennen op het begin (`/^stop/i`, `/^take profit/i`). Onbekend blijft onbekend. `hl-echt` draait in de release-poort tegen de opname. |
| 10 | **Sub-fills los laten** (voor de haak) verandert P&L of stappen | Andere cijfers dan nu | Task 2 toetst op de echte opname: P&L, fees en entry per trade **identiek** aan nu; alleen het aantal regels in de stappentabel groeit. |
| 11 | **Een wijziging voor Hyperliquid raakt een andere exchange** | Kraken/OKX/Blofin anders | Alleen `ExchangeAPI.hyperliquid` wijzigt. De gedeelde functies blijven ongemoeid; doet een taak dat toch, dan stopt hij en wordt het een eigen besluit. De Kraken-specs (`kraken-*`, 200+ checks) zitten in de release-poort en worden rood als Kraken iets merkt. |

**Vangnetten:** tests met de echte opname, een droogtest op Denny's data vóór de release, eerst naar work, daarna live alleen op "push".

---

## Global Constraints

- **Alleen Hyperliquid.** App-code alleen in `ExchangeAPI.hyperliquid` (`work/syncjournal.html`, ~regel 7517–7845). Geen `if(exchange==='hyperliquid')` buiten de adapter, en geen wijziging aan `perOrder`, `tpLabels`, `execTable`, `tradeTimeline`, `fillTimeline`, `submitForm` of `openForm`.
- **Het walletadres** komt nooit in de repo of een commit. Opnames staan in `tests/_fixtures/` (gitignored).
- **Rate-limit:** `historicalOrders` heeft gewicht 20 plus een toeslag per 20 regels; `frontendOpenOrders` 20 (budget 1200/min per IP). Maximaal één `historicalOrders`-aanroep per sync.
- **Tijden:** ms (UTC). Weergave via `amsDateTime`.
- **Release:** minor (R-cijfers veranderen). **v1.12** (v1.11 is Kraken).
- **Teksten** in het Nederlands, comments in het Engels, trading-termen in het Engels.

## Review Focus

1. **Omkering long ↔ short binnen een minuut:** stop en labels van de nieuwe positie komen niet bij de oude, en andersom.
2. **SL al naar winst geschoven vóór de eerste sync:** geen oorspronkelijke SL, R blijft "—"; een geraakte stop in winst heet wél SL.
3. **Positie open en dicht binnen enkele seconden** (scalp), met een bracket-SL 30 s vóór de instap: de SL telt mee.
4. **`historicalOrders` geeft een fout of HTTP 429:** de trades komen binnen, zonder stop, met labels TP n.
5. **Een TP die in meerdere fills wordt gevuld:** één label TP1 met een haak, niet TP1/TP2/TP3.

Elke regel krijgt een test in Task 2, 3 of 4.

---

## Bestanden

| Bestand | Wat |
|---|---|
| `tests/helpers/hl-wallet.js` | Opname uitbreiden met `historicalOrders` en `frontendOpenOrders`, en afspelen |
| `work/syncjournal.html` | Alleen `ExchangeAPI.hyperliquid`: `oid` op de stappen, `_orderRegels`, `_slTpVoorTrade`, `_afbouwSoort`, ophalen in `fetchTrades`/`fetchOpenPositions`, invullen in `afterImport` |
| `tests/hl-stoploss.spec.js` | **Nieuw.** Koppel-regels, labels en integratie (synthetisch) |
| `tests/hl-echt.spec.js` | Uitbreiden: echte trades krijgen de verwachte SL, TP's en labels; P&L ongewijzigd |
| `tests/release-set.js`, `CHANGELOG.md`, versie | Release |

## Vaste namen (interfaces)

```js
// ExchangeAPI.hyperliquid
_orderRegels(historical)  → [{ oid, ts, coin, side:'buy'|'sell', soort:'sl'|'tp'|'anders', price, sz, status, statusTs }]
                            // one row per oid (first placement ts, last known status)
_slTpVoorTrade(t, regels) → { stop:number|null, verschoven:boolean, stopVerloop:[{ts, price, status}],
                              tps:[{ price, pct, status:'geraakt'|'open'|'geannuleerd'|'niet geraakt' }] }
_afbouwSoort(t, regels)   → (group from perOrder) → 'tp'|'sl'|'hand'|'liq'
_SL_VOOR_MS = 60e3        // a bracket SL may be placed up to 60 s before the opening fill

// fill steps:  ordId = String(oid)            (shared perOrder / execTable bracket)
// close fills: soort = 'tp'|'sl'|'hand'|'liq' (shared tpLabels)
// trade:       stop, stopBron:'hyperliquid', stopVerschoven, stopVerloop, tps[i].soort, tpsGepland
```

---

### Task 1: De opname kan orders opnemen en afspelen

**Files:** `tests/helpers/hl-wallet.js`. Test via `node tests/hl-echt.spec.js --opnemen` (Denny's wallet, buiten de repo).

- [ ] **Step 1:** In `haalAccount(wallet)` na de fills ook `historicalOrders` en `frontendOpenOrders` ophalen en in het resultaat zetten (lege lijst bij een fout).
- [ ] **Step 2:** In `speelAf` beide types afspelen, met de klok (`nu`) als filter: `historicalOrders` alleen regels met `statusTimestamp ≤ nu`.
- [ ] **Step 3:** Een oude opname zonder deze velden geeft lege lijsten; `node tests/hl-echt.spec.js` blijft groen.
- [ ] **Step 4:** Opname verversen met `node tests/hl-echt.spec.js --opnemen` (alleen naar `tests/_fixtures/`).
- [ ] **Step 5: Meten en vastleggen** in dit document onder "Bevindingen opname": draagt een fill van een geraakte TP/SL hetzelfde `oid` als de trigger-order? Hoe ziet een liquidatie eruit in de fills?
- [ ] **Step 6: Commit.** `git commit -m "hl-wallet: record and replay historicalOrders and frontendOpenOrders"`

---

### Task 2: Alle fills zichtbaar, met het order-nummer

**Waarom:** de adapter voegt nu sub-fills op dezelfde ms + coin + richting samen tot één stap. Voor de haak blijven ze
los, met `ordId`; `perOrder` en de TP-lijst tellen per order.

- [ ] **Step 1: Falende test** (`tests/hl-stoploss.spec.js`): drie fills met hetzelfde `oid` op 2 ms → drie stappen met hetzelfde `ordId`, één TP-niveau, P&L en fees gelijk aan de som. Op de echte opname (`hl-echt`): P&L, fees, entry en exit per trade **identiek aan vóór de wijziging** (leg die vooraf vast).
- [ ] **Step 2:** Zie hem falen.
- [ ] **Step 3: Implementeer** in `ExchangeAPI.hyperliquid`: `_naarFill` neemt `oid` mee; de samenvoeging per ms vervalt; elke stap krijgt `ordId:String(oid)`; de TP-niveaus komen uit `perOrder(tl.filter(isAfbouw))` (zelfde vorm als Kraken). Dedup op `tid` blijft.
- [ ] **Step 4:** Groen, plus `hyperliquid-levensloop`, `hl-open-tijd`, `hl-deels-dicht`, `hl-echt`.
- [ ] **Step 5: Commit.** `git commit -m "Hyperliquid: keep every fill as a step with its order id"`

---

### Task 3: Koppel-regels — welke order is de SL of een TP van welke trade

**Files:** `ExchangeAPI.hyperliquid`, `tests/hl-stoploss.spec.js`.

**Regels:**
- **`_orderRegels`:** groepeer `historicalOrders` per `oid`: `ts` = vroegste `order.timestamp`; `status` = die met de laatste `statusTimestamp`; `soort` = `sl` als `orderType` met "Stop" begint, `tp` met "Take Profit", anders `anders`; `side` B → buy, A → sell; `price` = `triggerPx`, `sz` = `origSz` of `sz`.
- **Kandidaat voor een trade:** zelfde coin, sluitende kant, `ts` tussen `openTime − 60 s` en `closeTime` (lopend: nu).
- **SL:** kandidaten `sl` aan de verlieskant. Oorspronkelijk = de vroegste (meerdere binnen 60 s: gewogen gemiddelde). `verschoven` = later een SL met een andere prijs. `stopVerloop` = alle SL's met tijd, prijs, status. Geen SL aan de verlieskant: `stop: null`.
- **TP's:** kandidaten `tp`; per prijsniveau de laatste order. Status: `triggered`/`filled` → geraakt; `open` → open; `canceled` → geannuleerd; `reduceOnlyCanceled` bij het sluiten → niet geraakt. `pct` = `sz` ÷ grootste positie × 100.

- [ ] **Step 1: Falende test** met synthetische orders in het echte formaat:

```js
const ord = (oid, ts, side, type, px, sz, status, statusTs) => ({ order: { coin: 'BTC', side, orderType: type, triggerPx: String(px), sz: String(sz), origSz: String(sz), oid, timestamp: ts, isTrigger: true, reduceOnly: true, isPositionTpsl: false }, status, statusTimestamp: statusTs || ts });
const LONG = { positionId: 'BTC', direction: 'long', entry: '81073', openTime: String(Z('2026-10-15T19:00:00')), closeTime: '', qty: 0.00391 };
ok('SL 79.440 (sell-stop onder entry)', (await sl([ord(1, Z('2026-10-15T19:05:00'), 'A', 'Stop Market', 79440, 0.00391, 'open')], LONG)).stop === 79440);
ok('TP aan de winstkant is geen SL', (await sl([ord(2, Z('2026-10-15T19:05:00'), 'A', 'Take Profit Market', 83179, 0.00132, 'open')], LONG)).stop === null);
ok('stop aan de kopende kant (instap-stop) is geen SL', (await sl([ord(3, Z('2026-10-15T19:05:00'), 'B', 'Stop Market', 79440, 0.00391, 'open')], LONG)).stop === null);
let r = await sl([ord(4, Z('2026-10-15T19:05:00'), 'A', 'Stop Market', 79440, 0.00391, 'canceled', Z('2026-10-16T10:00:00')), ord(5, Z('2026-10-16T10:00:00'), 'A', 'Stop Market', 81073, 0.00391, 'open')], LONG);
ok('verschoven naar break-even: 79.440 blijft, verschoven, verloop 2', r.stop === 79440 && r.verschoven === true && r.stopVerloop.length === 2);
ok('alleen een stop in winst: geen oorspronkelijke SL', (await sl([ord(6, Z('2026-10-15T19:05:00'), 'A', 'Stop Market', 82000, 0.00391, 'open')], LONG)).stop === null);
ok('bracket 30 s vóór instap telt', (await sl([ord(7, Z('2026-10-15T18:59:30'), 'A', 'Stop Market', 79440, 0.00391, 'open')], LONG)).stop === 79440);
ok('5 min vóór instap (vorige positie) telt niet', (await sl([ord(8, Z('2026-10-15T18:55:00'), 'A', 'Stop Market', 79440, 0.00391, 'open')], LONG)).stop === null);
r = await sl([ord(9, Z('2026-10-15T19:05:00'), 'A', 'Stop Market', 79000, 0.002, 'open'), ord(10, Z('2026-10-15T19:05:20'), 'A', 'Stop Market', 80000, 0.002, 'open')], LONG);
ok('twee deel-stops in dezelfde minuut: gewogen 79.500', r.stop === 79500);
r = await sl([ord(11, Z('2026-10-16T17:54:00'), 'A', 'Take Profit Market', 83179, 0.00132, 'triggered', Z('2026-10-16T20:00:00')), ord(12, Z('2026-10-16T17:54:00'), 'A', 'Take Profit Market', 85232, 0.00148, 'open')], LONG);
ok('TP\'s: 83.179 geraakt, 85.232 open, met %', r.tps.length === 2 && r.tps[0].status === 'geraakt' && r.tps[1].status === 'open' && Math.round(r.tps[0].pct) === 34);
// flip: short closes and long opens in one fill at 10:00; a buy-stop at 09:30 belongs to the short, a sell-stop at 10:00:10 to the long
```

- [ ] **Step 2:** Zie hem falen.
- [ ] **Step 3: Implementeer** `_SL_VOOR_MS`, `_orderRegels` en `_slTpVoorTrade` De uitgewerkte code staat in de eerste versie van dit plan: `git show dd8bda3:docs/plan-hyperliquid-stoploss-2026-10-17.md` (Task 2, Step 3). Neem hem ongewijzigd over.
- [ ] **Step 4:** Groen, inclusief de flip-test.
- [ ] **Step 5: Commit.** `git commit -m "Hyperliquid: link stop-loss and take-profit orders to their trade"`

---

### Task 4: Hoe ging elke afbouw — TP, SL, Close of Liq

**Regel:** een afbouw-groep (`perOrder`) waarvan het `ordId` een trigger-order is: `soort` van die order (`sl`/`tp`).
Een stop in winst die geraakt wordt, blijft `sl`. Geen trigger-order: `hand`. Liquidatie-fill: `liq`. Valt Task 1's
meting tegen (fill-`oid` ≠ trigger-`oid`): koppel op de `statusTimestamp` van `triggered` = fill-tijd, zelfde coin en kant.

- [ ] **Step 1: Falende test** (synthetisch): long met TP1 geraakt, TP2 geraakt, daarna de stop → labels `TP1,TP2,SL` in
  `tpLabels(t.tps)`, de stappentabel (`.extp`) en `revTps`; een sluiting met de hand → `Close`; zonder orders → `TP1,TP2` (zoals nu).
  Op de echte opname: per gesloten trade de verwachte labels, vooraf nagekeken tegen Denny's Hyperliquid-scherm.
- [ ] **Step 2:** Zie hem falen.
- [ ] **Step 3: Implementeer** `_afbouwSoort` en zet `soort` op de afbouw-fills en `tps[i].soort` in `afterImport`
  (`sjFromTj` laat onbekende velden vallen, dus op de TP-niveaus in `afterImport`, zoals Kraken).
- [ ] **Step 4:** Groen.
- [ ] **Step 5: Commit.** `git commit -m "Hyperliquid: label each close TP, SL, Close or Liq"`

---

### Task 5: In de sync ophalen en invullen — de exchange wint

**Files:** `ExchangeAPI.hyperliquid` (`fetchTrades`, `fetchOpenPositions`, `afterImport`), `tests/hl-stoploss.spec.js`, `tests/hl-echt.spec.js`.

- [ ] **Step 1: Falende tests:**
  - een nieuwe trade krijgt `stop`, `stopBron:'hyperliquid'`, `tpsGepland`; het formulier toont het veld vergrendeld met "(van Hyperliquid)";
  - een bestaande trade met een **zelf ingevulde** stop krijgt de stop van Hyperliquid (besluit 18-10);
  - kent Hyperliquid geen stop, dan blijft de eigen stop staan en is het veld vrij;
  - `historicalOrders` met HTTP 429 → de trades komen binnen, zonder stop;
  - één `historicalOrders`-aanroep per sync;
  - **echte data:** de lopende BTC long krijgt SL **79.440** en TP's **83.179 / 85.232 / 87.280** met hun %.
- [ ] **Step 2:** Zie ze falen.
- [ ] **Step 3: Implementeer:**
  - `fetchTrades`: na `_reconstructTrades` één keer `historicalOrders` ophalen (met `try`); `this._orders=this._orderRegels(hist)`.
  - `fetchOpenPositions`: `this._orders` gebruiken of op dezelfde manier ophalen. **Geen** `stop` via de return-waarde (de gedeelde `syncOpenTrades` zou hem elke sync overschrijven).
  - `afterImport`, voor elke Hyperliquid-rij (open, partial, gesloten):

```js
      T.filter(o=>o&&o.exchange==='hyperliquid'&&(o.status==='closed'||o.status==='open'||o.status==='partial')).forEach(o=>{
        const s=this._slTpVoorTrade(o,this._orders||[]);
        // where Hyperliquid knows the stop it is the stop, like entry and exit (Denny 18-10-2026)
        if(s.stop&&(+o.stop!==s.stop||o.stopBron!=='hyperliquid')){o.stop=s.stop;o.stopBron='hyperliquid';n++;}
        if(o.stopBron==='hyperliquid'){if(s.verschoven)o.stopVerschoven=true;else delete o.stopVerschoven;o.stopVerloop=s.stopVerloop;}
        if(s.tps.length)o.tpsGepland=s.tps;
      });
      this._orders=null;
```

  - Een **eenmalige herhaling** voor bestaande trades (zoals Kraken's `_HERHAAL`), alleen als een gewone sync ze niet raakt.
- [ ] **Step 4:** Groen: `hl-stoploss`, `hl-echt`, `hyperliquid-levensloop`, `hl-open-tijd`, `hl-deels-dicht`, en `node tests/run-release.js --hier`.
- [ ] **Step 5: Commit.** `git commit -m "Hyperliquid: stop-loss and planned TPs from the order history; the exchange's stop wins"`

---

### Task 6: Droogtest op echte data en release

- [ ] **Droogtest:** speel de verse opname af in een losse browser. Controleer:
  - het aantal trades per exchange (alleen Hyperliquid mag veranderen);
  - per Hyperliquid-trade stop, TP's en labels tegen Denny's eigen beeld;
  - P&L, fees, entry en exit per trade ongewijzigd (Task 2).
- [ ] **Review:** `pr-reviewer-nl` over de diff, met de Review Focus en de risicotabel.
- [ ] **Release v1.12** volgens CLAUDE.md. Changelog: *"Hyperliquid: je stop-loss en ingestelde take-profits komen automatisch mee, net als bij Kraken. Je R-multiple klopt zonder invullen, en per afbouw zie je TP, SL of Close."*
- [ ] **Uitrol:** eerst work (Denny controleert zijn lopende long: SL 79.440, drie TP's), live alleen op zijn "push".

---

## Bevindingen opname (in te vullen bij Task 1)

- Fill-`oid` van een geraakte trigger = trigger-`oid`: …
- Liquidatie in de fills: …

## Bewust niet in dit plan
- **OKX en Blofin:** eigen plan per exchange, daarna. Daar bewaart de exchange alleen de laatste stand van een stop: "eerst gezien = oorspronkelijk" zolang de positie loopt.
- **Override-knop** ("Zelf aanpassen" / "Terug naar de exchange") voor een verkeerd geplaatste stop: gedeelde functie, eigen story; dit plan respecteert `stopBron:'gebruiker'` zodra die bestaat.
- **Stopbeweging** (BE / strakker / verder weg ⚠, rest van F5): gedeeld, eigen story; `stopVerloop` levert de data al.
- **Geplande R:R automatisch** uit SL en TP's, en **meldingen** ("je SL ligt verder dan je playbook toestaat"): later.
