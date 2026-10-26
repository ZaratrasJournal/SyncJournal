# Kraken stop-loss automatisch ophalen — implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elke Kraken-trade krijgt automatisch zijn **oorspronkelijke stop-loss**, zodat R-multiple, risico en geplande R:R kloppen zonder dat Zaratras de stop zelf invult.

**Architecture:**
- **Worker v22** krijgt één nieuwe actie, `triggers`. Die haalt Kraken's trigger-geschiedenis op (`GET /api/history/v3/triggers`): daar staan alle stop- en take-profit-orders met hun triggerprijs en tijd.
- **De Kraken-adapter in de app** koppelt die stops aan de posities die hij al uit de account-log bouwt (v1.10). De eerste stop aan de verlieskant, geplaatst rond of na de opening, wordt de stop van die trade.
- **Een zelf ingevulde stop wint altijd.** `stop` staat niet in `SJ_SYNC_FIELDS`, en de adapter vult alleen een lege stop of een stop die hij er zelf eerder in zette (`stopBron: 'kraken'`).

**Tech Stack:** vanilla JS (single-file app), Cloudflare Worker (WebCrypto), Node + Playwright-specs.

**Spec:** dit document, plus Kraken's documentatie:
- [Get trigger events](https://docs.kraken.com/api-reference/account-history/get-trigger-events)
- [Get open orders](https://docs.kraken.com/api-reference/order-management/get-open-orders)
- [Rate limits](https://docs.kraken.com/exchange/guides/futures/ratelimits)

**Achtergrond:** gesprek met Zaratras op 17-10-2026. Bevindingen uit Kraken's documentatie:
- `/triggers` heeft geen positie-id. Koppelen kan alleen via contract en tijd.
- Er is geen veld dat zegt "dit is SL" of "dit is TP".
- De `orderType`-waarden zijn tegenstrijdig gedocumenteerd: `stop` of `stp`.
- Er staan geen voorbeelden van stop-orders in de documentatie.

Daarom komt er een snapshot van echte data (Task 2) vóórdat de koppel-logica vastligt.

---

## Global Constraints

- **Alleen Kraken.** Alle app-code staat in `ExchangeAPI.kraken` (`work/syncjournal.html`, regel ~6893–7340). Niets in gedeelde helpers, geen `if(exchange==='kraken')` buiten de adapter.
- **Worker:** `docs/worker-v22.js` = v21 + één actie. Alle andere code blijft byte-voor-byte gelijk aan v21 (Morani's journal draait op dezelfde Worker). Zaratras deployt hem via het Cloudflare-dashboard.
- **De stop van een trade is de oorspronkelijke stop.** De eerste stop aan de verlieskant, niet een later verschoven stop. Een verschoven stop (bijv. naar break-even) wordt alleen gemarkeerd (`stopVerschoven: true`).
- **Nooit overschrijven wat Zaratras zelf invulde.** De adapter schrijft `stop` alleen als die leeg is, of als `stopBron === 'kraken'`.
- **Rate-limit:** `historicaltriggers` kost 1 token uit de history-pot (100 per 10 minuten). Gebruik maximaal 10 pagina's per verzoek, en per sync maximaal 1 extra verzoek.
- **Tijden:** Kraken stuurt ms-timestamps (UTC). Voor weergave gaat alles via `amsDateTime`.
- **Release:** **v1.11 (minor)**, want R-multiples veranderen. Worker v22 moet live zijn vóór de app-release. Bij Worker v21 slaat de app de stop-stap over, zonder fout.
- **Teksten** in het Nederlands, code-comments in het Engels, trading-termen in het Engels (stop-loss, entry).
- **Privacy:** Zaratras' snapshot (`kraken-triggers-snapshot*.json`) komt nooit in de repo. Zet het patroon in `.git/info/exclude`. Een fixture in `tests/_fixtures/` wordt geanonimiseerd: geen uid's, geen clientId's.

## Review Focus

1. **Stop verschoven naar break-even.** Verwacht: de trade houdt de oorspronkelijke stop (R klopt) en krijgt `stopVerschoven: true`.
2. **Bracket-order:** de stop wordt een paar seconden vóór de instap geplaatst (entry + SL tegelijk). Verwacht: hij telt mee, binnen 60 s vóór de opening.
3. **Een take-profit- of instap-trigger aan de winstkant** of in dezelfde richting als de positie. Verwacht: wordt nooit als stop-loss gezien.
4. **Een zelf ingevulde stop** (zoals Zaratras' 82.235 op de short van 14-10). Verwacht: blijft staan, ook als Kraken een andere stop kent.
5. **Worker nog op v21**, of `/triggers` geeft een fout. Verwacht: de sync gaat gewoon door, alleen zonder stop.

Elke regel heeft een test in de taak die de code bezit (Task 3 en Task 4).

---

## Bestanden

| Bestand | Wat |
|---|---|
| `docs/worker-v22.js` | **Nieuw.** v21 + actie `triggers` |
| `tests/worker-triggers.spec.js` | **Nieuw.** Worker-test: verzoek, ondertekening, paginering, fout, rest gelijk aan v21 |
| `work/syncjournal.html` | `ExchangeAPI.kraken`: `_triggerRegels`, `_stopVoorLevensloop`, `_triggersOphalen`, aanroep in `fetchTrades`, stop invullen in `afterImport` |
| `tests/kraken-stoploss.spec.js` | **Nieuw.** De koppel-logica en de sync-integratie |
| `tests/release-set.js` | Beide specs toevoegen |
| `CLAUDE.md` | Productie-Worker = v22 |
| `CHANGELOG.md`, `site/version.json`, `site/app.html` | Release v1.11 |

## Vaste namen (interfaces)

```js
// Worker v22
action 'triggers'  → { source:'triggers', elements:[...], _trigDebug:{ paginas, regels, afgekapt } }

// ExchangeAPI.kraken
_triggerRegels(elements)         → [{ ts, contract, side:'buy'|'sell', price, qty, soort, uid }]
                                   soort ∈ 'geplaatst' | 'gewijzigd' | 'geannuleerd' | 'geactiveerd'
_stopVoorLevensloop(L, regels)   → { stop:number|null, verschoven:boolean }
                                   L = trade uit levenslopenUitAccountLog: positionId, direction, entry, openTime, closeTime
_triggersOphalen(key,secret,van,tot) → regels[] | null   (null = Worker kent de actie niet of fout)
_STOP_VOOR_MS = 60e3             // a bracket stop may be placed up to 60 s before the opening fill

// trade-velden
t.stopLoss (lifecycle, nieuwe trade) → t.stop via sjFromTj
t.stopBron = 'kraken'            // the stop came from the exchange; the user may overwrite it, the sync then leaves it alone
t.stopVerschoven = true          // the stop was later moved (e.g. to break-even)
```

---

### Task 1: Worker v22 — actie `triggers`

**Files:**
- Create: `docs/worker-v22.js` (kopie van `docs/worker-v21.js` + blok)
- Create: `tests/worker-triggers.spec.js`

**Interfaces:**
- Produces: actie `triggers` met `startTime` (ms) en optioneel `before` (ms). Antwoord `{ source:'triggers', elements, _trigDebug }`.

- [ ] **Step 1: Schrijf de falende test.** Gebruik hetzelfde patroon als `tests/worker-accountlog.spec.js`: het complete Worker-bestand met nagemaakt internet. Controleer:

```js
// ── one page
verzoeken = []; antwoord = () => ({ accountUid: 'a', len: 2, elements: [el(1), el(2)] });
let r = await vraag({ action: 'triggers', startTime: SINCE });
const u = new URL(verzoeken[0].url);
ok('endpoint /api/history/v3/triggers', u.pathname === '/api/history/v3/triggers');
ok('sort=asc, count=1000, since', u.searchParams.get('sort') === 'asc' && u.searchParams.get('count') === '1000' && u.searchParams.get('since') === String(SINCE));
ok('source triggers met de elementen', r.data.source === 'triggers' && r.data.elements.length === 2);
// signature exactly as in worker-accountlog.spec.js, with path '/api/history/v3/triggers'
// ── paging via continuationToken (body) / continuation_token (query)
antwoord = (url) => url.searchParams.get('continuation_token') ? { elements: [el(3)] } : { elements: Array.from({ length: 1000 }, (_, i) => el(i)), continuationToken: 'abc' };
r = await vraag({ action: 'triggers', startTime: SINCE });
ok('tweede pagina met continuation_token=abc', new URL(verzoeken[verzoeken.length - 1].url).searchParams.get('continuation_token') === 'abc' && r.data.elements.length === 1001);
// ── cap 10 pages → afgekapt
// ── Kraken error → HTTP 500 with "Kraken triggers"
// ── rest byte-for-byte v21 (strip the new block and compare, line endings normalised)
```

  met `const el = i => ({ uid: 'u' + i, timestamp: 1790000000000 + i, event: { OrderTriggerPlaced: { order: { uid: 't' + i, tradeable: 'PF_XBTUSD', direction: 'Buy', quantity: '0.001', orderType: 'stop', triggerOptions: { triggerPrice: '82235', triggerSide: 'Above', triggerSignal: 'MarkPrice' }, reduceOnly: true, timestamp: 1790000000000 + i } } } })`.

- [ ] **Step 2: Draai en zie hem falen.** Run `node tests/worker-triggers.spec.js`. Verwacht: FAIL, want `docs/worker-v22.js` bestaat niet.

- [ ] **Step 3: Implementeer.** Kopieer v21 naar v22, pas de kop aan ("Changes vs v21: Kraken-actie 'triggers' …") en voeg na de `account_log`-actie toe:

```js
  // v22: trigger history (stop and take-profit orders) — Kraken docs "Get trigger events". since/before in ms.
  if (action === 'triggers') {
    const KRAKEN_TRIG_PAGINAS = 10;     // 10 × cost 1 of the 100 history tokens per 10 minutes
    const KRAKEN_TRIG_PER_PAGINA = 1000; // Kraken silently caps count at 1000
    const params = { sort: 'asc', count: String(KRAKEN_TRIG_PER_PAGINA) };
    if (startTime) params.since = String(Number(startTime));
    if (before) params.before = String(Number(before));
    let elements = [], paginas = 0, afgekapt = false, token = null;
    for (;;) {
      const d = await krakenGet('/api/history/v3/triggers', token ? { ...params, continuation_token: token } : params);
      paginas++;
      if (!d || !Array.isArray(d.elements)) throw new Error('Kraken triggers: ' + String((d && (d.error || d.result)) || 'geen elementen in het antwoord').slice(0, 160));
      elements = elements.concat(d.elements);
      token = d.continuationToken || null;
      if (!token || d.elements.length < KRAKEN_TRIG_PER_PAGINA) break;
      if (paginas >= KRAKEN_TRIG_PAGINAS) { afgekapt = true; break; }
    }
    return { source: 'triggers', elements, _trigDebug: { paginas, regels: elements.length, afgekapt } };
  }
```

- [ ] **Step 4: Draai, nu groen.** Run `node tests/worker-triggers.spec.js` en `node tests/worker-accountlog.spec.js`. Verwacht: beide PASS. De accountlog-spec test v21; die blijft ongewijzigd.
- [ ] **Step 5: Commit.** `git add docs/worker-v22.js tests/worker-triggers.spec.js && git commit -m "Worker v22: Kraken action triggers (GET /api/history/v3/triggers)"`

---

### Task 2: Zaratras deployt v22 en maakt een snapshot (handmatig)

Dit is geen code, maar een **stoppunt**: Task 3 legt de koppel-regels vast tegen echte data.

- [ ] **Step 1: Deploy.** Zaratras plakt `docs/worker-v22.js` in het Cloudflare-dashboard bij `morani-proxy` en deployt.
- [ ] **Step 2: Snapshot.** Op work.syncjournal.nl in de Console (F12) plakken:

```js
(async()=>{const c=CONNS.kraken;
const d=await proxyCall({exchange:'kraken',action:'triggers',apiKey:c.apiKey,apiSecret:c.apiSecret,startTime:Date.parse('2026-09-01')});
const out={source:d.source,debug:d._trigDebug,elements:(d.elements||[]).map(e=>{const k=Object.keys(e.event||{})[0]||'?',v=e.event[k]||{},o=v.order||v.newOrderTrigger||v.attemptedOrderTrigger||{};
 return{ts:e.timestamp,soort:k,reason:v.reason,tradeable:o.tradeable,direction:o.direction,orderType:o.orderType,qty:o.quantity,reduceOnly:o.reduceOnly,trig:o.triggerOptions,old:v.oldOrderTrigger&&v.oldOrderTrigger.triggerOptions};})};
const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(out,null,1)],{type:'application/json'}));a.download='kraken-triggers-snapshot.json';a.click();})();
```

  Daarna `kraken-triggers-snapshot.json` in de projectmap zetten. Er staan geen sleutels in.
- [ ] **Step 3: Vastleggen wat we zien.** Leg in dit document onder "Bevindingen snapshot" vast:
  - de echte `orderType`-waarden;
  - of een SL-trigger `reduceOnly` heeft;
  - hoe een verschoven stop eruitziet (`OrderTriggerUpdated` of annuleren + nieuw plaatsen);
  - hoe ver de geschiedenis teruggaat.

  Wijken de regels van Task 3 af van wat de snapshot laat zien, pas Task 3 dan eerst aan. Dat is een ruling, en die gaat in het logboek.
- [ ] **Step 4: Fixture.** Maak een geanonimiseerde fixture `tests/_fixtures/kraken-triggers-sample.json`: 3–5 echte posities, uid's vervangen door `t1…`.

---

### Task 3: Koppel-logica — welke trigger is de stop van welke positie

**Files:**
- Modify: `work/syncjournal.html`, in `ExchangeAPI.kraken` (naast `_logRegelsUitJson`)
- Create: `tests/kraken-stoploss.spec.js`

**Interfaces:**
- Produces: `_triggerRegels(elements)`, `_stopVoorLevensloop(L, regels)`, `_STOP_VOOR_MS`.

**Regels** (definitief na Task 2):
- **Kandidaat:** een trigger op hetzelfde contract (`tradeable` = `L.positionId`, hoofdletter-ongevoelig), in de **tegenovergestelde richting** van de positie:
  - een short wordt gesloten met een **buy**-stop, een long met een **sell**-stop;
  - geplaatst tussen `openTime − 60 s` en `closeTime`.
- **Stop-loss:** de triggerprijs ligt aan de **verlieskant** van de entry:
  - short: triggerprijs > entry;
  - long: triggerprijs < entry.

  Een trigger aan de winstkant is een take-profit en telt niet mee.
- **De stop** is de triggerprijs van de **eerst geplaatste** kandidaat. Bij een wijziging (`gewijzigd`) telt de **oude** prijs als eerste plaatsing, als de oorspronkelijke plaatsing buiten het venster lag.
- **`verschoven`** is `true` als er na de eerste plaatsing een stop met een andere prijs kwam (gewijzigd, of geannuleerd en opnieuw geplaatst).
- **Geen kandidaat:** `stop` blijft `null` en de R blijft "—", zoals nu.

- [ ] **Step 1: Schrijf de falende test** (`tests/kraken-stoploss.spec.js`, losse Node-spec met Playwright, zoals `kraken-opentijd.spec.js`):

```js
const Z = s => Date.parse(s + 'Z');
const plaats = (ts, dir, prijs, extra = {}) => ({ uid: 'e' + ts, timestamp: ts, event: { OrderTriggerPlaced: { order: { uid: 't' + ts, tradeable: 'PF_XBTUSD', direction: dir, quantity: '0.0092', orderType: 'stop', reduceOnly: true, timestamp: ts, triggerOptions: { triggerPrice: String(prijs), triggerSide: dir === 'Buy' ? 'Above' : 'Below', triggerSignal: 'MarkPrice' } }, reason: 'new_user_order' } }, ...extra });
const wijzig = (ts, dir, oud, nieuw) => ({ uid: 'w' + ts, timestamp: ts, event: { OrderTriggerUpdated: { oldOrderTrigger: { tradeable: 'PF_XBTUSD', direction: dir, triggerOptions: { triggerPrice: String(oud) }, orderType: 'stop' }, newOrderTrigger: { tradeable: 'PF_XBTUSD', direction: dir, triggerOptions: { triggerPrice: String(nieuw) }, orderType: 'stop' }, reason: 'edited_by_user' } } });
const SHORT = { positionId: 'PF_XBTUSD', direction: 'short', entry: '81489', openTime: String(Z('2026-10-14T18:12:52')), closeTime: String(Z('2026-10-15T15:05:30')) };
const t = (els) => p.evaluate(([els, L]) => { const k = ExchangeAPI.kraken; return k._stopVoorLevensloop(L, k._triggerRegels(els)); }, [els, SHORT]);

ok('SL geplaatst na de instap', (await t([plaats(Z('2026-10-14T18:13:30'), 'Buy', 82235)])).stop === 82235);
ok('bracket: 20 s vóór de instap telt mee', (await t([plaats(Z('2026-10-14T18:12:32'), 'Buy', 82235)])).stop === 82235);
ok('5 min vóór de instap telt niet', (await t([plaats(Z('2026-10-14T18:07:52'), 'Buy', 82235)])).stop === null);
ok('TP (winstkant, buy onder entry) is geen SL', (await t([plaats(Z('2026-10-14T18:13:30'), 'Buy', 80000)])).stop === null);
ok('stop in dezelfde richting (sell) is geen SL', (await t([plaats(Z('2026-10-14T18:13:30'), 'Sell', 82235)])).stop === null);
let r = await t([plaats(Z('2026-10-14T18:13:30'), 'Buy', 82235), wijzig(Z('2026-10-14T20:00:00'), 'Buy', 82235, 81489)]);
ok('naar break-even geschoven: oorspronkelijke stop blijft, verschoven=true', r.stop === 82235 && r.verschoven === true);
ok('ander contract telt niet', (await p.evaluate(([els, L]) => { const k = ExchangeAPI.kraken; return k._stopVoorLevensloop({ ...L, positionId: 'PF_ETHUSD' }, k._triggerRegels(els)); }, [[plaats(Z('2026-10-14T18:13:30'), 'Buy', 82235)], SHORT])).stop === null);
ok('geen triggers → null', (await t([])).stop === null);
ok('na de sluiting geplaatst telt niet', (await t([plaats(Z('2026-10-15T16:00:00'), 'Buy', 82235)])).stop === null);
// echte data (Task 2): voor elke positie in tests/_fixtures/kraken-triggers-sample.json de verwachte stop
```

- [ ] **Step 2: Draai en zie hem falen.** Run `node tests/kraken-stoploss.spec.js`. Verwacht: FAIL (`_stopVoorLevensloop` bestaat niet).
- [ ] **Step 3: Implementeer** in `ExchangeAPI.kraken`:

```js
    _STOP_VOOR_MS:60e3,   // a bracket stop may be placed up to 60 s before the opening fill
    // Trigger events → flat rows. Kraken documents no SL/TP field; side and price decide later.
    _triggerRegels(elements){
      const SOORT={OrderTriggerPlaced:'geplaatst',OrderTriggerUpdated:'gewijzigd',OrderTriggerCancelled:'geannuleerd',OrderTriggerActivated:'geactiveerd'};
      const num=v=>{const n=parseFloat(v);return isFinite(n)?n:0;};
      return(elements||[]).flatMap(e=>{const k=Object.keys((e&&e.event)||{})[0],soort=SOORT[k];if(!soort)return[];
        const v=e.event[k]||{},o=v.order||v.newOrderTrigger||{},oud=v.oldOrderTrigger;
        const rij={ts:+e.timestamp||+o.timestamp||0,contract:String(o.tradeable||'').toUpperCase(),side:String(o.direction||'').toLowerCase(),
          price:num(o.triggerOptions&&o.triggerOptions.triggerPrice),qty:num(o.quantity),soort,uid:String(o.uid||e.uid||'')};
        if(soort==='gewijzigd'&&oud)rij.oudePrijs=num(oud.triggerOptions&&oud.triggerOptions.triggerPrice);
        return rij.contract&&rij.price>0?[rij]:[];});
    },
    // The original stop-loss of a position: the first trigger on its contract, closing side, loss side of the entry,
    // placed between the opening (minus a bracket margin) and the close.
    _stopVoorLevensloop(L,regels){
      const short=String(L.direction||L.dir)==='short',entry=+L.entry,van=+L.openTime-this._STOP_VOOR_MS,tot=+L.closeTime||Infinity;
      const sluitKant=short?'buy':'sell',verlies=p=>short?p>entry:p<entry;
      const kand=(regels||[]).filter(r=>r.contract===String(L.positionId||'').toUpperCase()&&r.side===sluitKant&&r.ts>=van&&r.ts<=tot&&r.soort!=='geannuleerd')
        .sort((a,b)=>a.ts-b.ts);
      const eerste=kand.find(r=>verlies(r.soort==='gewijzigd'&&r.oudePrijs>0?r.oudePrijs:r.price));
      if(!eerste||!(entry>0))return{stop:null,verschoven:false};
      const stop=eerste.soort==='gewijzigd'&&eerste.oudePrijs>0?eerste.oudePrijs:eerste.price;
      const verschoven=kand.some(r=>r.ts>=eerste.ts&&(r.price!==stop));
      return{stop,verschoven};
    },
```

- [ ] **Step 4: Draai, nu groen.** Run `node tests/kraken-stoploss.spec.js`. Verwacht: PASS, ook de checks tegen de fixture van Task 2.
- [ ] **Step 5: Commit.** `git commit -m "Kraken: link a stop-loss trigger to its position (original stop, moved flag)"`

---

### Task 4: In de sync — stop ophalen en invullen

**Files:**
- Modify: `work/syncjournal.html`, in `ExchangeAPI.kraken`: `_triggersOphalen`, `fetchTrades` (na de account-log), `afterImport`
- Test: `tests/kraken-stoploss.spec.js` (integratie-sectie)

**Interfaces:**
- Consumes: `_triggerRegels`, `_stopVoorLevensloop` (Task 3); `this._log.levenslopen` (v1.10).
- Produces:
  - `this._log.stops`: Map van lifecycle-id naar `{stop, verschoven}`;
  - op nieuwe trades `stopLoss`, `stopBron:'kraken'` en `stopVerschoven`.

- [ ] **Step 1: Schrijf de falende integratietest.** Hij draait `syncExchange('kraken')` met een nagemaakte `proxyCall` die zowel `account_log` als `triggers` beantwoordt, en controleert:

```js
// account_log: a short 14-10 18:12:52 → 15-10 15:05:30 (entry 81489); triggers: Buy stop 82235 at 18:13:30
ok('nieuwe trade krijgt stop 82.235 van Kraken', k.stop === 82235 && k.stopBron === 'kraken');
ok('R-multiple nu berekend (geen streepje)', await p.evaluate(() => tradeROrNull(T.find(t => t.exchange === 'kraken')) != null));
// existing row with user stop 82000 and no stopBron
ok('zelf ingevulde stop blijft staan', bestaand.stop === 82000 && !bestaand.stopBron);
// existing row without stop
ok('lege stop van een bestaande trade wordt ingevuld', leeg.stop === 82235 && leeg.stopBron === 'kraken');
// existing row with stopBron 'kraken' and an old value; a new sync with another first stop
ok('stop van Kraken wordt bijgewerkt zolang de gebruiker hem niet aanpaste', bijgewerkt.stop === 82235);
// Worker v21: 'triggers' answered with the trades flow (source 'position_updates')
ok('Worker v21: sync slaagt, alleen zonder stop', res !== -1 && geenStop.stop == null);
// triggers throws (rate limit)
ok('fout bij triggers: trades komen toch binnen', n === 1);
// call count
ok('één triggers-verzoek per sync, met het venster van de posities', vragen.filter(v => v.action === 'triggers').length === 1);
```

- [ ] **Step 2: Draai en zie hem falen.**
- [ ] **Step 3: Implementeer.**

```js
    async _triggersOphalen(apiKey,apiSecret,van,tot){
      try{const d=await proxyCall({exchange:"kraken",action:"triggers",apiKey,apiSecret,startTime:van>0?van:undefined,before:tot});
        return(d&&d.source==="triggers"&&Array.isArray(d.elements))?this._triggerRegels(d.elements):null;   // Worker v21 answers with the trades flow
      }catch(e){return null;}   // the stop is extra: a failing request never blocks the trades
    },
```

  In `fetchTrades`, direct nadat `this._log` gezet is (vóór de `return`):

```js
        if(levenslopen.length){
          const van=Math.min(...levenslopen.map(t=>+t.openTime))-this._STOP_VOOR_MS, tot=Math.max(...levenslopen.map(t=>+t.closeTime))+1;
          const regels=await this._triggersOphalen(apiKey,apiSecret,van,tot);
          if(regels){const stops=new Map();
            levenslopen.forEach(t=>{const s=this._stopVoorLevensloop(t,regels);if(s.stop){stops.set(String(t.id),s);t.stopLoss=String(s.stop);t.stopBron='kraken';if(s.verschoven)t.stopVerschoven=true;}});
            this._log.stops=stops;}
        }
```

  In `afterImport`, binnen `if(this._log){…}` na het opruimblok:

```js
        // existing trades: fill an empty stop, or update one the exchange set before; never touch a stop the user typed
        if(this._log.stops)T.forEach(o=>{if(!o||o.exchange!=="kraken")return;const s=this._log.stops.get(String(o.srcId));if(!s)return;
          const leeg=!(+o.stop>0);if(!leeg&&o.stopBron!=='kraken')return;
          if(+o.stop!==s.stop){o.stop=s.stop;o.stopBron='kraken';if(s.verschoven)o.stopVerschoven=true;n++;}});
```

  Controleer dat `sjFromTj` `stopBron` en `stopVerschoven` meeneemt. Onbekende velden blijven via `...o` in `sanitizeTrade` behouden. Doet `sjFromTj` dat niet, zet ze dan in `afterImport` op de nieuwe rij (via `srcId`). Leg dat vast als ruling.
- [ ] **Step 4: Formulier.** Past de gebruiker de stop in het formulier aan, dan verdwijnt `stopBron`, zodat de sync er daarna van afblijft. Zoek in `submitForm` waar `stop` wordt gezet (`grep -n "stop:" work/syncjournal.html | grep -i form`) en voeg daar toe:

```js
  if(String(oud.stop||'')!==String(nieuw.stop||''))delete nieuw.stopBron;   // the user changed it: the sync must leave it alone
```

  Test: stop wijzigen via het formulier, opnieuw syncen, de stop blijft wat de gebruiker invulde.
- [ ] **Step 5: Draai, nu groen.** Run alle Kraken-specs (`kraken-stoploss`, `kraken-accountlog-sync`, `kraken-opentijd`, `kraken-csv-api`, `kraken-account-log`) en `node tests/run-release.js --hier`.
- [ ] **Step 6: Commit.** `git commit -m "Kraken: fill the stop-loss from the trigger history during sync (never over a user stop)"`

---

### Task 5: Lopende posities (optioneel, na Task 4)

Een lopende positie heeft in de account-log al een open levensloop met openingstijd. Gebruik **dezelfde** triggers-aanroep met als venster de start van die open positie tot nu, en vul de stop van de open rij op dezelfde manier (alleen als hij leeg is of `stopBron:'kraken'`).

Geen `/openorders`: die geeft de **huidige** stop. Dat is na verschuiven een break-even stop, en daarmee klopt de R niet.

Test: een open short met een Buy-stop 82.235 krijgt die stop. Verschuift hij naar break-even, dan blijft 82.235 staan.

---

### Task 6: Release v1.11

- [ ] **Review:** `pr-reviewer-nl` over de diff, met de Review Focus hierboven. Critical en Important eerst fixen, met test.
- [ ] **CLAUDE.md:** "Sinds <datum> is de productieversie `docs/worker-v22.js` (v21 + `triggers`)".
- [ ] **Release-ritueel** (CLAUDE.md):
  - `APP_VERSION='v1.11'`, `site/version.json`;
  - CHANGELOG (*Toegevoegd: stop-loss van Kraken automatisch, R-multiple klopt zonder invullen; een stop die je zelf invulde blijft staan*);
  - `cp work/syncjournal.html site/app.html`, demo-data verversen, één release-commit.
- [ ] **Poort:** `node tests/run-release.js` groen.
- [ ] **Uitrol:** eerst work, Zaratras test met zijn echte trades, daarna live, alleen op zijn "push".

---

## Bevindingen snapshot (18-10-2026)

Snapshot van Zaratras' account: 40 events van 14-10 18:12 tot 16-10 17:55, 1 pagina, gevraagd vanaf 01-09.
Vaste testdata (zonder uid's) in `tests/fixtures/kraken-triggers-sample.json`.

- **`orderType`** is altijd `Market`, zowel voor de SL als de TP's (de documentatie noemt `stop`/`stp`). De app filtert er niet op.
- **`reduceOnly`** is `true` op alle triggers, SL en TP. Het onderscheid SL/TP blijft dus: kant ten opzichte van de entry.
- **De SL wordt bij de fill geplaatst**, met reason `partial_fill`, op exact de openingstijd. Bij een limit-instap met SL
  plaatst Kraken hem eerst bij de order (14:59:50), en bij de fill annuleert (`order_group_order_cancelled`) en plaatst
  hij hem opnieuw (17:15:52). Review-punt I3 (limit-instap buiten de 60 s) speelt dus niet: er is altijd een plaatsing op de fill.
- **TP's** komen als `new_user_order` aan de winstkant, met hun eigen qty (bijv. 0,0038 / 0,0019 / 0,0019). Dat zijn je geplande TP's.
- **Bij de sluiting** annuleert Kraken alle resterende triggers (`would_not_reduce_position`). Een geraakte stop of TP is `OrderTriggerActivated`.
- **Verschuiven:** komt in deze periode niet voor (geen `OrderTriggerUpdated`). Of verschuiven een update is of annuleren +
  nieuw plaatsen, is nog niet gezien; de code kent beide.
- **Geschiedenis:** begint op 14-10, niet op 01-09. Ouder bestaat er (voor Zaratras) niet. Trades van vóór 14-10 houden "—".
- **Afwijkingen:** geen. Alle vier de gesloten posities krijgen de stop die Kraken had (82235, 81700, 81700, 81500).
  Let op: bij twee daarvan had Zaratras zelf de exit als stop ingevuld (81680 en 81882); die blijven staan (een zelf ingevulde stop wint).

## Bewust niet in dit plan

- **Geplande take-profits** uit de triggers (`take_profit` aan de winstkant). Die zouden de geplande TP's en de R:R kunnen vullen. Eerst de stop werkend krijgen, dan als volgende story.
- **De huidige stop** van een lopende positie tonen (`/openorders`), naast de oorspronkelijke. Alleen als Zaratras daar om vraagt.
- **Andere exchanges.** Hyperliquid, Blofin en OKX hebben eigen bronnen voor stops; elk een eigen story.
