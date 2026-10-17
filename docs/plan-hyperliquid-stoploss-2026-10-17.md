# Hyperliquid stop-loss en take-profits automatisch — implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Elke Hyperliquid-trade krijgt automatisch zijn **oorspronkelijke stop-loss**, met de markering "verschoven" als die later is aangepast, en zijn **ingestelde take-profits**: geraakt, niet geraakt of geannuleerd.
- Een lopende positie toont direct zijn SL en TP's.

**Architecture:**
- **Geen Worker, geen sleutels.** Hyperliquid's openbare info-endpoint (`POST https://api.hyperliquid.xyz/info`) geeft op basis van het wallet-adres:
  - `historicalOrders`: de laatste 2000 orders, met elke statuswijziging als aparte regel;
  - `frontendOpenOrders`: de orders die nu openstaan.
- **De koppel-logica** komt in `ExchangeAPI.hyperliquid` en koppelt orders aan de trades die de adapter al uit de fills bouwt (`_reconstructTrades`).
- **Invullen** gebeurt in `afterImport`: alleen een lege stop, of een stop die de sync er eerder in zette (`stopBron:'hyperliquid'`). Een stop die Denny zelf invulde of leegmaakte, blijft van hem.

**Tech Stack:** vanilla JS (single-file app), Node + Playwright-specs, de bestaande wallet-opname (`tests/helpers/hl-wallet.js`).

**Spec:** dit document. Achtergrond: gesprek met Denny op 17-10-2026 en een meting op zijn echte wallet op 17-10-2026.

## Wat de echte wallet liet zien (17-10-2026)

- **Lopende BTC long 0,00391 @ 81.073**, met 4 open trigger-orders:

  | Order | `orderType` | `side` | `triggerPx` | `sz` | `reduceOnly` | `isPositionTpsl` |
  |---|---|---|---|---|---|---|
  | SL | `Stop Market` | `A` (= sell) | 79440 | 0.00391 | true | false |
  | TP1 | `Take Profit Market` | `A` | 83179 | 0.00132 | true | false |
  | TP2 | `Take Profit Market` | `A` | 85232 | 0.00148 | true | false |
  | TP3 | `Take Profit Market` | `A` | 87280 | 0.00164 | true | false |

- **`historicalOrders`:** 89 regels, terug tot april 2026. **Eén regel per statuswijziging**, zodat hetzelfde `oid` meerdere keren voorkomt: eerst `open`, later `triggered`/`filled`/`canceled`/`reduceOnlyCanceled`.
- **Een SL wijzigen is annuleren plus een nieuwe order** (nieuw `oid`). Voorbeeld van 14-10 om 20:51: een Buy-stop 82500 met `oid …591466` werd `canceled`, en direct daarna kwam `oid …807461` op 82500.
- **`isPositionTpsl` is `false`**, ook voor de SL op de hele positie. Dat veld is dus niet bruikbaar om SL/TP te herkennen. Zijde, soort en prijs zijn dat wel.
- **`side`:** `A` = verkopen (ask), `B` = kopen (bid).

---

## Foutgevoeligheid en hoe we dat voorkomen

Dit geldt voor alle exchanges. Het staat hier volledig uitgewerkt, en het Kraken-plan neemt dezelfde regels over.

| # | Wat kan misgaan | Gevolg | Hoe we het voorkomen |
|---|---|---|---|
| 1 | Een order van een **vorige of volgende positie** op dezelfde coin wordt gekoppeld | Verkeerde stop, verkeerde R | Alleen orders die geplaatst zijn tussen `openTime − 60 s` en `closeTime` van déze positie, aan de **sluitende kant**. Bij een omkering sluit en opent dezelfde uitvoering: de kant onderscheidt de twee posities. Test met een flip in de opname. |
| 2 | Een **TP of een instap-stop** wordt aangezien voor de SL | R veel te klein of negatief | SL = soort `Stop …`, aan de sluitende kant, met een prijs aan de **verlieskant** van de entry. TP = `Take Profit …` aan de **winstkant**. Een stop aan de winstkant (al naar winst geschoven vóór de eerste meting) gebruiken we **niet** als SL. |
| 3 | De SL is **verschoven** (break-even) en de journal neemt de nieuwe stand | R klopt niet meer (vaak oneindig) | De **eerste** stop na de opening telt. Latere stops met een andere prijs zetten alleen `stopVerschoven`, en de stappen tonen het verloop. |
| 4 | Een **zelf ingevulde of leeggemaakte** stop wordt overschreven | Denny's correctie verdwijnt | `stop` staat niet in `SJ_SYNC_FIELDS`. De adapter schrijft alleen bij een lege stop **zonder** `stopBron:'gebruiker'`, of bij `stopBron:'hyperliquid'`. Het formulier zet `stopBron:'gebruiker'` zodra Denny de stop wijzigt of leegmaakt. |
| 5 | **Meerdere stops** voor delen van de positie | Onduidelijk welke "de" stop is | De eerste geplaatste stop telt als oorspronkelijk. Hebben meerdere stops in dezelfde minuut een andere prijs, dan nemen we het gewogen gemiddelde over hun grootte (dat is het echte risico). Test met twee deel-stops. |
| 6 | **Geschiedenis te kort**: meer dan 2000 orders geleden | Oude trades zonder stop | Geen stop: R blijft "—", zoals nu. Nooit gokken. |
| 7 | **API-fout of rate-limit** | Sync mislukt | Orders ophalen is een extra. Mislukt het, dan komen de trades gewoon binnen zonder stop, en de volgende sync probeert het opnieuw. |
| 8 | **Stille verandering** van oude R-cijfers | Denny ziet ineens andere statistieken | Alleen trades **zonder** stop krijgen er een, en de changelog benoemt dat. In de trade staat zichtbaar "SL van Hyperliquid", zodat de herkomst altijd te zien is. |
| 9 | **Hyperliquid wijzigt veldnamen** (`orderType`-teksten) | Niets gekoppeld | We herkennen op het begin van de tekst (`/^stop/i`, `/^take profit/i`). Onbekend blijft onbekend: geen stop in plaats van een verkeerde. `hl-echt` draait in de release-poort tegen de opname. |

**Algemene vangnetten:**
- tests met de **echte opname** van Denny's wallet, met vaste verwachte waarden per trade;
- een **droogtest** op zijn echte data vóór de release;
- uitrol eerst naar **work**, Denny controleert, daarna live;
- de stop blijft altijd **handmatig te corrigeren**.

---

## Global Constraints

- **Alleen Hyperliquid.** Alle app-code staat in `ExchangeAPI.hyperliquid` (`work/syncjournal.html`, ~regel 7355–7677). Het formulier-veld `stopBron` is de enige gedeelde wijziging: één regel in `submitForm`, exchange-onafhankelijk. Toets dat Blofin, OKX en Kraken die regel niet anders gebruiken.
- **Het walletadres** komt nooit in de repo of in een commit. Opnames staan in `tests/_fixtures/` (gitignored), zoals `hyperliquid-wallet.json` nu.
- **Rate-limit:** `historicalOrders` heeft gewicht 20 plus een toeslag per 20 regels; `frontendOpenOrders` 20 (budget 1200 per minuut per IP). Doe maximaal één `historicalOrders`-aanroep per sync.
- **Tijden:** ms (UTC). Voor weergave gaat alles via `amsDateTime`.
- **Release:** **minor** (R-cijfers veranderen). Het nummer hangt af van de volgorde met Kraken: v1.11 of v1.12.
- **Teksten** in het Nederlands, comments in het Engels, trading-termen in het Engels.

## Review Focus

1. **Omkering long ↔ short binnen een minuut:** de stop van de nieuwe positie mag niet bij de oude terechtkomen, en andersom.
2. **SL al naar winst geschoven vóór de eerste sync** (stop aan de winstkant): geen SL invullen, R blijft "—".
3. **Stop leeggemaakt in het formulier:** blijft leeg na de volgende sync.
4. **Positie open en dicht binnen enkele seconden** (scalp), met een bracket-SL 30 s vóór de instap: de SL telt mee.
5. **`historicalOrders` geeft een fout of HTTP 429:** de trades komen toch binnen.

Elke regel krijgt een test in Task 2, 3 of 4.

---

## Bestanden

| Bestand | Wat |
|---|---|
| `tests/helpers/hl-wallet.js` | Opname uitbreiden met `historicalOrders` en `frontendOpenOrders`, en afspelen |
| `work/syncjournal.html` | `ExchangeAPI.hyperliquid`: `_orderRegels`, `_slTpVoorTrade`, ophalen in `fetchTrades` en `fetchOpenPositions`, invullen in `afterImport`. Formulier: `stopBron:'gebruiker'`. Weergave: label "SL van Hyperliquid" en "verschoven" |
| `tests/hl-stoploss.spec.js` | **Nieuw.** Koppel-regels (synthetisch) en integratie |
| `tests/hl-echt.spec.js` | Uitbreiden: de echte trades krijgen de verwachte SL en TP's |
| `tests/release-set.js`, `CHANGELOG.md`, versie | Release |

## Vaste namen (interfaces)

```js
// ExchangeAPI.hyperliquid
_orderRegels(historical)  → [{ oid, ts, coin, side:'buy'|'sell', soort:'sl'|'tp'|'anders', price, sz, status, statusTs }]
                            // one row per oid (first placement ts, last known status)
_slTpVoorTrade(t, regels) → { stop:number|null, verschoven:boolean, stopVerloop:[{ts, price, status}],
                              tps:[{ price, pct, status:'geraakt'|'open'|'geannuleerd' }] }
                            // t = trade from _reconstructTrades: coin (positionId), direction, entry, openTime, closeTime, qty
_SL_VOOR_MS = 60e3        // a bracket SL may be placed up to 60 s before the opening fill

// trade fields
stop, stopBron:'hyperliquid'|'gebruiker', stopVerschoven:true, stopVerloop:[…], tpsGepland:[…]
```

---

### Task 1: De opname kan orders opnemen en afspelen

**Files:** Modify `tests/helpers/hl-wallet.js`. Test via `node tests/hl-echt.spec.js --opnemen` (Denny's wallet, buiten de repo).

- [ ] **Step 1:** In `haalAccount(wallet)` na de fills ook ophalen en in het resultaat zetten:

```js
  const historicalOrders = await post({ type: 'historicalOrders', user: wallet });
  const frontendOpenOrders = await post({ type: 'frontendOpenOrders', user: wallet });
  return { ...bestaand, historicalOrders: Array.isArray(historicalOrders) ? historicalOrders : [], frontendOpenOrders: Array.isArray(frontendOpenOrders) ? frontendOpenOrders : [] };
```

- [ ] **Step 2:** In `speelAf` de twee types afspelen, met de klok (`nu`) als filter, zodat een test "het moment van toen" kan nabootsen:

```js
    else if (body.type === 'historicalOrders') json = (acc.historicalOrders || []).filter(x => nu == null || (+x.statusTimestamp || +x.order.timestamp) <= nu);
    else if (body.type === 'frontendOpenOrders') json = acc.frontendOpenOrders || [];
```

- [ ] **Step 3:** Een oude opname zonder deze velden geeft lege lijsten, dus de bestaande `hl-echt`-checks blijven werken. Run `node tests/hl-echt.spec.js`. Verwacht: zelfde resultaat als nu (31/31).
- [ ] **Step 4:** Denny of Claude ververst de opname met `node tests/hl-echt.spec.js --opnemen`. Dat schrijft alleen naar `tests/_fixtures/` (gitignored).
- [ ] **Step 5: Commit.** `git commit -m "hl-wallet: record and replay historicalOrders and frontendOpenOrders"`

---

### Task 2: Koppel-regels — welke order is de SL of een TP van welke trade

**Files:** `work/syncjournal.html` (`ExchangeAPI.hyperliquid`), `tests/hl-stoploss.spec.js` (nieuw).

**Regels:**
- **`_orderRegels`:** groepeer `historicalOrders` per `oid`:
  - `ts` = de vroegste `order.timestamp`;
  - `status` = de status met de laatste `statusTimestamp`;
  - `soort` = `sl` als `orderType` met "Stop" begint, `tp` als hij met "Take Profit" begint, anders `anders`;
  - `side` = `B` → buy, `A` → sell;
  - `price` = `triggerPx`, `sz` = `origSz` of `sz`.
- **Kandidaat voor een trade:**
  - zelfde coin (`t.positionId` of de coin uit de pair);
  - sluitende kant: een long sluit met sell, een short met buy;
  - `ts` tussen `openTime − 60 s` en `closeTime` (bij een lopende positie: nu).
- **SL:** de kandidaten van soort `sl` aan de verlieskant van de entry (long: prijs < entry; short: prijs > entry).
  - **Oorspronkelijke stop:** de vroegste. Liggen er meerdere binnen 60 s van de vroegste, dan het op grootte gewogen gemiddelde.
  - **`verschoven`:** er is later een SL met een andere prijs.
  - **`stopVerloop`:** alle SL's met tijd, prijs en status.
  - **Geen SL aan de verlieskant** (bijv. alleen een stop in winst): `stop: null`.
- **TP's:** kandidaten van soort `tp` aan de winstkant.
  - **Welke telt:** per prijsniveau de laatste order.
  - **Status:**
    - `triggered`/`filled` → `geraakt`;
    - `open` → `open`;
    - `canceled` → `geannuleerd`;
    - `reduceOnlyCanceled` → `geannuleerd`, maar alleen als de positie toen nog niet dicht was. Anders betekent het "vervallen bij sluiten", en dat tonen we als "niet geraakt".
  - **`pct`:** `sz` ÷ de grootste positiegrootte van de trade × 100.

- [ ] **Step 1: Schrijf de falende test** met synthetische orders in het echte formaat:

```js
const ord = (oid, ts, side, type, px, sz, status, statusTs) => ({ order: { coin: 'BTC', side, orderType: type, triggerPx: String(px), sz: String(sz), origSz: String(sz), oid, timestamp: ts, isTrigger: true, reduceOnly: true, isPositionTpsl: false }, status, statusTimestamp: statusTs || ts });
const LONG = { positionId: 'BTC', direction: 'long', entry: '81073', openTime: String(Z('2026-10-15T19:00:00')), closeTime: '', qty: 0.00391 };
ok('SL 79.440 (sell-stop onder entry)', (await sl([ord(1, Z('2026-10-15T19:05:00'), 'A', 'Stop Market', 79440, 0.00391, 'open')], LONG)).stop === 79440);
ok('TP aan de winstkant is geen SL', (await sl([ord(2, Z('2026-10-15T19:05:00'), 'A', 'Take Profit Market', 83179, 0.00132, 'open')], LONG)).stop === null);
ok('stop aan de kopende kant (instap-stop) is geen SL', (await sl([ord(3, Z('2026-10-15T19:05:00'), 'B', 'Stop Market', 79440, 0.00391, 'open')], LONG)).stop === null);
let r = await sl([ord(4, Z('2026-10-15T19:05:00'), 'A', 'Stop Market', 79440, 0.00391, 'canceled', Z('2026-10-16T10:00:00')), ord(5, Z('2026-10-16T10:00:00'), 'A', 'Stop Market', 81073, 0.00391, 'open')], LONG);
ok('verschoven naar break-even: oorspronkelijke 79.440 blijft, verschoven=true', r.stop === 79440 && r.verschoven === true && r.stopVerloop.length === 2);
ok('alleen een stop in winst (al geschoven vóór meting): geen SL', (await sl([ord(6, Z('2026-10-15T19:05:00'), 'A', 'Stop Market', 82000, 0.00391, 'open')], LONG)).stop === null);
ok('bracket 30 s vóór instap telt', (await sl([ord(7, Z('2026-10-15T18:59:30'), 'A', 'Stop Market', 79440, 0.00391, 'open')], LONG)).stop === 79440);
ok('5 min vóór instap (vorige positie) telt niet', (await sl([ord(8, Z('2026-10-15T18:55:00'), 'A', 'Stop Market', 79440, 0.00391, 'open')], LONG)).stop === null);
r = await sl([ord(9, Z('2026-10-15T19:05:00'), 'A', 'Stop Market', 79000, 0.002, 'open'), ord(10, Z('2026-10-15T19:05:20'), 'A', 'Stop Market', 80000, 0.002, 'open')], LONG);
ok('twee deel-stops in dezelfde minuut: gewogen gemiddelde 79.500', r.stop === 79500);
r = await sl([ord(11, Z('2026-10-16T17:54:00'), 'A', 'Take Profit Market', 83179, 0.00132, 'triggered', Z('2026-10-16T20:00:00')), ord(12, Z('2026-10-16T17:54:00'), 'A', 'Take Profit Market', 85232, 0.00148, 'open')], LONG);
ok('TP\'s: 83.179 geraakt, 85.232 open, met %', r.tps.length === 2 && r.tps[0].status === 'geraakt' && r.tps[1].status === 'open' && Math.round(r.tps[0].pct) === 34);
// flip: short closes and long opens in one fill at 10:00; a buy-stop at 09:30 belongs to the short, a sell-stop at 10:00:10 to the long
```

- [ ] **Step 2: Draai en zie hem falen** (`_slTpVoorTrade` bestaat niet).
- [ ] **Step 3: Implementeer** in `ExchangeAPI.hyperliquid`:

```js
    _SL_VOOR_MS:60e3,   // a bracket SL may be placed up to 60 s before the opening fill
    // historicalOrders → one row per oid: first placement time, last known status. Order types are matched
    // on their start ("Stop Market", "Stop Limit", "Take Profit Market", ...); anything else is ignored.
    _orderRegels(historical){
      const per=new Map();
      (historical||[]).forEach(x=>{const o=x&&x.order;if(!o||!o.isTrigger)return;const k=String(o.oid);
        const soort=/^stop/i.test(o.orderType)?'sl':/^take profit/i.test(o.orderType)?'tp':'anders';
        const rij=per.get(k)||{oid:k,ts:+o.timestamp||0,coin:String(o.coin||''),side:o.side==='B'?'buy':'sell',soort,price:parseFloat(o.triggerPx)||0,sz:parseFloat(o.origSz||o.sz)||0,status:'',statusTs:0};
        rij.ts=Math.min(rij.ts||Infinity,+o.timestamp||Infinity);
        if((+x.statusTimestamp||0)>=rij.statusTs){rij.status=String(x.status||'');rij.statusTs=+x.statusTimestamp||0;}
        per.set(k,rij);});
      return[...per.values()].filter(r=>r.price>0&&r.soort!=='anders');
    },
    _slTpVoorTrade(t,regels){
      const short=String(t.direction||t.dir)==='short',entry=+t.entry,coin=String(t.positionId||String(t.pair||'').split('/')[0]);
      const van=+t.openTime-this._SL_VOOR_MS,tot=+t.closeTime||Date.now(),sluit=short?'buy':'sell';
      const kand=(regels||[]).filter(r=>r.coin===coin&&r.side===sluit&&r.ts>=van&&r.ts<=tot).sort((a,b)=>a.ts-b.ts);
      const verlies=p=>short?p>entry:p<entry;
      const sls=kand.filter(r=>r.soort==='sl'&&verlies(r.price));
      let stop=null,verschoven=false;
      if(sls.length&&entry>0){const eerste=sls.filter(r=>r.ts-sls[0].ts<=60e3);const tw=eerste.reduce((s,r)=>s+r.sz,0);
        stop=tw>0?+(eerste.reduce((s,r)=>s+r.price*r.sz,0)/tw).toFixed(8):sls[0].price;
        verschoven=kand.some(r=>r.soort==='sl'&&r.ts>eerste[eerste.length-1].ts&&r.price!==stop);}
      const stopVerloop=kand.filter(r=>r.soort==='sl').map(r=>({ts:r.ts,price:r.price,status:r.status}));
      const piek=+t.qty||+t.positionSizeAsset||0,dicht=+t.closeTime||0;
      const perPrijs=new Map();kand.filter(r=>r.soort==='tp'&&!verlies(r.price)).forEach(r=>perPrijs.set(r.price,r));
      const tps=[...perPrijs.values()].sort((a,b)=>short?b.price-a.price:a.price-b.price).map(r=>({price:r.price,pct:piek>0?+(r.sz/piek*100).toFixed(2):0,
        status:/triggered|filled/.test(r.status)?'geraakt':r.status==='open'?'open':(r.status==='reduceOnlyCanceled'&&dicht&&r.statusTs>=dicht-5e3)?'niet geraakt':'geannuleerd'}));
      return{stop,verschoven,stopVerloop,tps};
    },
```

- [ ] **Step 4: Draai, nu groen.** Voeg ook de flip-test toe en laat hem slagen.
- [ ] **Step 5: Commit.** `git commit -m "Hyperliquid: link stop-loss and take-profit orders to their trade"`

---

### Task 3: In de sync ophalen en invullen — nooit over de keuze van de gebruiker

**Files:** `work/syncjournal.html` (`ExchangeAPI.hyperliquid`: `fetchTrades`, `fetchOpenPositions`, `afterImport`; `submitForm`), `tests/hl-stoploss.spec.js` (integratie), `tests/hl-echt.spec.js`.

- [ ] **Step 1: Schrijf de falende tests.**
  - **Integratie met een nagemaakt info-endpoint:**
    - een nieuwe trade krijgt `stop`, `stopBron:'hyperliquid'` en `tpsGepland`;
    - een bestaande trade met een eigen stop blijft ongewijzigd;
    - een in het formulier leeggemaakte stop (`stopBron:'gebruiker'`) blijft leeg;
    - `historicalOrders` met HTTP 429 → de trades komen binnen, zonder stop;
    - er is één `historicalOrders`-aanroep per sync.
  - **Echte data** (`hl-echt`, met opname): de lopende BTC long krijgt SL **79.440** en TP's **83.179 / 85.232 / 87.280** met hun %. De gesloten trades in de opname krijgen de stop uit de geschiedenis. Leg per trade de verwachte waarde vast na een handmatige controle tegen Denny's Hyperliquid-scherm.
- [ ] **Step 2: Draai en zie ze falen.**
- [ ] **Step 3: Implementeer.**
  - **In `fetchTrades`**, na `_reconstructTrades`: haal één keer `historicalOrders` op, met een `try`. Bij een fout gaat het verder zonder orders. Bewaar `this._orders=this._orderRegels(hist)`.
  - **In `fetchOpenPositions`:** gebruik `this._orders` als die er is; is hij er niet, haal hem dan op dezelfde manier op. Zet **geen** `stop` op de open rij via de return-waarde, want de gedeelde `syncOpenTrades` zou hem dan elke sync overschrijven.
  - **In `afterImport`**, voor elke Hyperliquid-rij (open en gesloten) met `this._orders`:

```js
      const magVullen=o=>o.stopBron==='hyperliquid'||(!(+o.stop>0)&&o.stopBron!=='gebruiker');
      T.filter(o=>o&&o.exchange==='hyperliquid'&&(o.status==='closed'||o.status==='open'||o.status==='partial')).forEach(o=>{
        const s=this._slTpVoorTrade(o,this._orders||[]);
        if(s.stop&&magVullen(o)&&+o.stop!==s.stop){o.stop=s.stop;o.stopBron='hyperliquid';n++;}
        if(magVullen(o)||o.stopBron==='hyperliquid'){o.stopVerschoven=s.verschoven||undefined;o.stopVerloop=s.stopVerloop;}
        if(s.tps.length)o.tpsGepland=s.tps;
      });
      this._orders=null;
```

  - **In `submitForm`:** waar het formulier de stop leest, de bron vastleggen:

```js
  if(String(oud.stop||'')!==String(nieuw.stop||''))nieuw.stopBron='gebruiker';   // changed or cleared by the user: syncs leave it alone
```

    Dit is exchange-onafhankelijk; ook Kraken gaat deze regel gebruiken.
- [ ] **Step 4: Draai, nu groen.**
  ```bash
  node tests/hl-stoploss.spec.js
  node tests/hl-echt.spec.js
  node tests/hyperliquid-levensloop.spec.js
  node tests/hl-open-tijd.spec.js
  node tests/hl-deels-dicht.spec.js
  node tests/run-release.js --hier
  ```
- [ ] **Step 5: Commit.** `git commit -m "Hyperliquid: fill stop-loss and planned TPs during sync; a user stop always wins"`

---

### Task 4: Laten zien waar de stop vandaan komt

**Files:** `work/syncjournal.html`:
- de tegel **Stop** in `revTiles` (review per trade en presentatie);
- het stop-veld in het tradeformulier;
- "Zo is deze positie gelopen" (`execTable` of de TP-breakdown).

- [ ] **Stop-tegel en formulier:** onder of naast de stop een klein label "van Hyperliquid", en "· verschoven" als `stopVerschoven`. Gebruik theme-tokens: `var(--muted)`, en `var(--amber)` voor "verschoven".
- [ ] **TP-niveaus:** in het TP-blok de geplande TP's met hun status: ✓ geraakt, open, niet geraakt of geannuleerd.
- [ ] **Verloop:** in "Zo is deze positie gelopen" de regels uit `stopVerloop` ("SL geplaatst 79.440", "SL naar 81.073").
- [ ] **Test:** het label staat er bij `stopBron:'hyperliquid'`, en niet bij een zelf ingevulde stop. Bekijk het in licht en donker.
- [ ] **Commit:** `git commit -m "Show where a stop came from and how it moved"`

---

### Task 5: Droogtest op echte data en release

- [ ] **Droogtest:** speel de verse opname af in een losse browser, zoals bij Kraken. Controleer:
  - het aantal trades per exchange (alleen Hyperliquid mag veranderen);
  - per Hyperliquid-trade de stop en TP's tegen Denny's eigen beeld;
  - dat geen enkele bestaande stop is overschreven.
- [ ] **Review:** `pr-reviewer-nl` over de diff, met de Review Focus en de risicotabel hierboven.
- [ ] **Release:** het ritueel uit CLAUDE.md (minor). Changelog: *"Hyperliquid: je stop-loss en ingestelde take-profits komen automatisch mee. Je R-multiple klopt zonder invullen. Een stop die je zelf invulde of weghaalde, blijft van jou. Bij een trade zie je waar de stop vandaan kwam en of hij verschoven is."*
- [ ] **Uitrol:** eerst work, Denny controleert zijn lopende long (SL 79.440, drie TP's), daarna live, alleen op zijn "push".

---

## Bewust niet in dit plan
- **Blofin en OKX:** daar bewaart de exchange alleen de laatste stand. Die krijgen een eigen plan met de aanpak "eerst gezien = oorspronkelijk".
- **Geplande R:R automatisch** uit SL en TP's. Kan zodra dit staat; eerst de basis.
- **Meldingen** zoals "je SL ligt verder dan je playbook toestaat". Dat is een latere functie.
