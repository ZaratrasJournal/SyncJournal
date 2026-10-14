# Review: per trade + beeld-modus — implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De reviewpagina krijgt twee weergaven, **Per trade** (nieuwe indeling) en **🖼 Beeld** (kaarten per maand).
Daarbij komen een vaste selectie met een **Selectie & delen**-paneel, een presentatie met miniaturen, een rijker
coach-pakket, **Kopieer voor Discord** en **coach-feedback** die bij de trade bewaard blijft.

**Architecture:** Alles blijft in `work/syncjournal.html`. `pgReview()` wordt een dunne schakelaar die
`revPerTrade()` of `revBeeld()` rendert, met dezelfde app-filterbalk (`filterBar()`) en dezelfde lijst (`reviewItems()`).
De selectie is de bestaande `STATE.revShareSel`, maar zonder aparte "deel-modus": vakjes staan er altijd. De presentatie
is een eigen overlay (`#revpres`), los van de bestaande lightbox. Het coach-pakket bouwt verder op `coachPkgHTML`.

**Tech Stack:** vanilla JS + template strings, Canvas 2D + Clipboard API (Discord), Node/Playwright-specs (losse scripts).

**Spec:** de goedgekeurde demo `demos/review-beeld-demo-v5.html` en de besluiten in `demos/review-beeld-NOTES.md`
(sectie *Verdict*, 14-10-2026). Bij twijfel over opmaak geldt de demo; bij twijfel over data geldt de app.

## Global Constraints

- Release als **minor `v1.9`**: nieuwe functie (CLAUDE.md, versieregel van 08-10-2026).
- Gebruik theme-tokens (`var(--green)`, `var(--red)`, `var(--line)`, `var(--sink)`, `var(--accent)`, …). Geen hardcoded
  `#fff` in de app-UI. Uitzondering: het Discord-canvas, een los PNG-bestand dat altijd donker is.
- Test **licht én donker**.
- Gebruik voor R altijd `tradeROrNull(t)` / `rBadge(t)` / `rCell(t)` (streepje bij onbekend) en voor gemiddelden `gemR(rows)`.
  Nooit `t.r` of `tradeR` in een weergave of gemiddelde.
- Ga ervan uit dat alle tekst uit een trade van iemand anders kan komen, via een geïmporteerde backup. Tekst gaat door `esc()`,
  string-argumenten in `onclick` door `jsarg()` (**zonder** extra quotes), beeld-URL's door `beeldSrc()`.
  Trade-id's zijn getallen.
- Bedragen in de pagina krijgen `class="mask"` (privacymodus). Voor exports (pakket, Discord) geldt
  `STATE.shareHide` (standaard aan).
- Datums: maandsleutel is `t.date.slice(0,7)`. `t.date` is al een lokale (Amsterdam) datum.
- UI-copy: Nederlands, met Engelse trading-termen (leverage, entry, stop). Commits en code-comments in het Engels.
- Niet pushen. Lokale commits op een branch `review-beeld`; release via PR + `/code-review`.

## Review Focus

1. **Een backup met kwaadaardige tekst of beeld-URL** in notes, coach, setup, tags, pair of `screenshots`. Verwacht: niets
   wordt uitgevoerd, in de pagina, de presentatie, het coach-pakket én de Discord-tekst.
   Test: Task 4, 6 en 7 (beeld-escaping-sectie in `tests/review-beeld.spec.js`).
2. **Kopieer voor Discord met een `https://`-screenshot uit een backup.** Zonder CORS laadt dat beeld niet (met
   `crossOrigin`), of het maakt het canvas "tainted" en dan gooit `toBlob` een fout. Verwacht: geen crash; de tekst gaat naar het klembord en een melding legt uit dat het beeld niet
   meekon. Test: Task 7.
3. **Lege toestanden:**
   - helemaal geen trades;
   - wel trades, maar geen enkele met beeld of TV-link (Beeld-modus);
   - een filter dat niets overlaat;
   - een trade zonder screenshot in Per trade.

   Verwacht: een melding die zegt wat er ontbreekt en wat je kunt doen, nooit een leeg vlak of een JS-fout.
   Test: Task 3 en 4.
4. **3000 trades met data-URL-screenshots.** Verwacht: de Beeld-modus rendert alleen de kaarten van één maand, met
   `loading="lazy"` op elke `<img>`, en de Per-trade-lijst houdt de bestaande stappen van 150 (`REV_PAGE`).
   Test: Task 4 (`querySelectorAll('.revcard').length` gelijk aan de maand, niet aan het totaal).
5. **Selectie houdt trades vast die niet meer bestaan of buiten het filter vallen** (verwijderd, prullenbak, filter
   gewijzigd). Verwacht: het paneel, de presentatie, het pakket en Discord slaan id's zonder trade over. De selectie
   blijft bestaan over filters heen; dat is bewust, zodat je over maanden heen kunt kiezen.
   Test: Task 5.

---

## Bestanden

| Bestand | Wat |
|---|---|
| `work/syncjournal.html` | Alle code. Sectie *Review* (~regel 3727–4090): helpers, coach-pakket, `pgReview`. Plus `SJ_USER_FIELDS` (~8023), `sanitizeTrade` (~5219), `render()` (~5124) en de FAQ-tekst (~5016). |
| `tests/review-beeld.spec.js` | **Nieuw.** Losse Node-spec (patroon van `tests/coach-share.spec.js`). Elke taak voegt een sectie toe. |
| `tests/coach-share.spec.js` | Bijwerken: geen deel-modus en geen deel-dialoog meer; selectie en paneel. |
| `tests/review-list.spec.js` | Bijwerken: het gereviewd-rondje in de lijst wordt een selectievakje. |
| `tests/tv-links.spec.js`, `tests/prijs-streepje.spec.js`, `tests/r-zonder-stop.spec.js` | Selectors bijwerken (`.revshots-col`, `.plangrid`, `.pnlbig` verdwijnen). |
| `tests/release-set.js` | `'review-beeld'` toevoegen. |
| `CHANGELOG.md`, `site/version.json`, `site/app.html` | Release (Task 8). |

## Vaste namen (interfaces over taken heen)

```js
STATE.revMode      // 'trade' | 'beeld'   (default 'trade')
STATE.revMonth     // index in revMonths(), 0 = nieuwste maand
STATE.revShareSel  // number[]  geselecteerde trade-id's, in volgorde (bestaat al)
STATE.shareHide    // boolean   bedragen verbergen in exports (bestaat al)
t.coach            // string    coach-feedback, bewaard bij de trade (nieuw)

lagenTxt(t)        -> string   "4H → 1H" of "—"
revShots(t)        -> string[] geldige screenshots (beeldSrc-proof)
revHasBeeld(t)     -> boolean  screenshot of TV-link
revMonths()        -> [{k:'2026-09', list:Trade[]}]  nieuwste eerst, alleen revHasBeeld
revSelToggle(id), revSelMove(i,d), revSelMonth(), revSelClear(), revSelTrades() -> Trade[]
saveCoach(id,v)
revTiles(t, n)     -> HTML  n = 8 (kaart) of 18 (per trade)
revReviewFields(t) -> HTML  notitie, leerpunt, coach | emotie, discipline, rating, tags
revInfoVol(t)      -> HTML  volledige trade-info (presentatie)
openRevPres(ids, startId), drawRevPres(), revPresGo(d), closeRevPres()
revDiscord(id)     -> Promise<void>
```

---

### Task 1: Coach-feedback als veld van de trade

**Files:**
- Modify: `work/syncjournal.html`:
  - `SJ_USER_FIELDS` (~8022);
  - `sanitizeTrade` (~5219);
  - review-helpers (~3734, naast `saveLessons`);
  - `coachPkgHTML` (~3868), de `fbnote`-regel.
- Create: `tests/review-beeld.spec.js`

**Interfaces:**
- Produces: `t.coach` (string, leeg = geen feedback); `saveCoach(id,v)`.

- [ ] **Step 1: Schrijf de falende test.** Maak `tests/review-beeld.spec.js` met hetzelfde geraamte als
  `tests/coach-share.spec.js` (boot, `localStorage.clear()`, `IDB.clearAll()`, `hideWelcome()`, `mk(id,over)`), en deze eerste sectie:

```js
console.log('─── Coach-feedback als veld ───');
await p.evaluate(rows => { T = rows.map(r => ({ ...r })); persist(); clearGFilter(); go('review'); },
  [mk(1, { coach: 'Wacht op de close <b>x</b>' }), mk(2)]);
await p.waitForTimeout(300);
ok('coach blijft na sanitizeTrade', await p.evaluate(() => sanitizeTrade({ coach: 'abc' }, 1).coach === 'abc'));
ok('coach geen string → leeg', await p.evaluate(() => sanitizeTrade({ coach: { x: 1 } }, 1).coach === ''));
ok('coach verhuist mee bij sluiten (SJ_USER_FIELDS)', await p.evaluate(() => SJ_USER_FIELDS.includes('coach')));
await p.evaluate(() => saveCoach(2, 'Goede trade'));
ok('saveCoach bewaart', await p.evaluate(() => T.find(x => x.id === 2).coach === 'Goede trade'));
const pk = await p.evaluate(() => coachPkgHTML([T.find(x => x.id === 1)], { name: 'D', hide: true, shotMap: {} }));
ok('coach-feedback in het pakket, ge-escaped', pk.includes('Feedback van de coach') && pk.includes('&lt;b&gt;x') && !pk.includes('<b>x'));
ok('oude "volgende versie"-tekst weg', !/volgende versie/.test(pk));
```

- [ ] **Step 2: Draai en zie hem falen.** Run `node tests/review-beeld.spec.js`.
  Verwacht: FAIL op `SJ_USER_FIELDS` / `saveCoach is not defined`.

- [ ] **Step 3: Implementeer.**
  - In `sanitizeTrade`, na de `out.session=…`-regel:
    ```js
    out.coach=typeof o.coach==='string'?o.coach:'';
    ```
  - Voeg `'coach'` toe aan het eind van `SJ_USER_FIELDS`.
  - Naast `saveLessons`:
    ```js
    function saveCoach(id,v){saveReview(id,{coach:String(v||'')});}
    ```
  - In `coachPkgHTML`: vervang de hele `<div class="fbnote">…</div>`-regel door
    ```js
    ${t.coach?`<div class="block"><p class="sect-l">Feedback van de coach</p><div class="qt">${esc(t.coach)}</div></div>`:''}
    ```

- [ ] **Step 4: Draai, nu groen.** Run `node tests/review-beeld.spec.js` en `node tests/coach-share.spec.js`.
  Verwacht: allebei PASS. Faalt coach-share alleen op de `fbnote`-tekst, pas die assert dan aan.

- [ ] **Step 5: Commit.**
  ```bash
  git add work/syncjournal.html tests/review-beeld.spec.js tests/coach-share.spec.js
  git commit -m "review: store coach feedback on the trade (t.coach)"
  ```

---

### Task 2: Schakelaar Per trade | Beeld, en een vaste selectie

Het gereviewd-rondje en de deel-modus verdwijnen. Elke lijstregel krijgt een selectievakje met het volgnummer. Markeren
als gereviewd gaat via de knop in de kop (Task 3) of de review-velden.

**Files:**
- Modify: `work/syncjournal.html`:
  - `STATE` (~2441/2445);
  - share-helpers (~3829–3846): `toggleShareMode`, `shareSelectAllVisible` en `openShareDialog` gaan weg;
  - `pgReview` (~3995);
  - FAQ-regel (~5016).
- Modify: `tests/coach-share.spec.js`, `tests/review-list.spec.js`
- Test: `tests/review-beeld.spec.js`

**Interfaces:**
- Produces:
  - `STATE.revMode`, `setRevMode(m)`;
  - `revSelToggle(id)`, `revSelMove(i,d)`, `revSelClear()`, `revSelTrades()`;
  - `pgReview()` → `revTop()+filterBar()+(revMode==='beeld'?revBeeld():revPerTrade())`.
  - Tijdelijk rendert `revPerTrade()` de huidige indeling met vakjes; Task 3 vervangt de rechterkant.

- [ ] **Step 1: Schrijf de falende test** (nieuwe sectie in `review-beeld.spec.js`):

```js
console.log('─── Schakelaar + selectie ───');
await p.evaluate(rows => { T = rows.map(r => ({ ...r })); STATE.revShareSel = []; persist(); clearGFilter(); go('review'); },
  [mk(1), mk(2), mk(3)]);
await p.waitForTimeout(300);
ok('schakelaar met twee knoppen', await p.evaluate(() => document.querySelectorAll('.revmodes button').length === 2));
ok('standaard Per trade', await p.evaluate(() => STATE.revMode === 'trade'));
ok('elke lijstregel heeft een vakje', await p.evaluate(() => document.querySelectorAll('.revitem .cbx').length === 3));
const openVoor = await p.evaluate(() => STATE.revSel);
await p.evaluate(() => document.querySelectorAll('.revitem .cbx')[1].click());
ok('vakje selecteert zonder te openen', await p.evaluate(v => STATE.revShareSel.length === 1 && STATE.revSel === v, openVoor));
ok('vakje toont volgnummer', await p.evaluate(() => document.querySelector('.revitem .cbx.on').textContent.trim() === '1'));
await p.evaluate(() => { STATE.revShareSel = []; revSelToggle(2); revSelToggle(3); revSelMove(1, -1); });
ok('volgorde verschuiven', await p.evaluate(() => STATE.revShareSel[0] === 3));
await p.evaluate(() => setRevMode('beeld'));
ok('selectie blijft over de schakelaar', await p.evaluate(() => STATE.revShareSel.length === 2 && STATE.revMode === 'beeld'));
await p.evaluate(() => { T = T.filter(x => x.id !== 3); persist(); });
ok('verdwenen trade valt uit revSelTrades', await p.evaluate(() => revSelTrades().map(t => t.id).join() === '2'));
await p.evaluate(() => setRevMode('trade'));
```

- [ ] **Step 2: Draai en zie hem falen** (`.revmodes` bestaat niet).

- [ ] **Step 3: Implementeer.**
  - **`STATE`:** vervang regel 2445 door
    ```js
    STATE.revMode='trade'; STATE.revMonth=0; STATE.revShareSel=[]; STATE.shareHide=true;  // review: weergave, maand-index in Beeld, geselecteerde trade-ids in volgorde, bedragen verbergen in exports
    ```
    Haal `revShareMode` overal weg.
  - **Helpers:** vervang `toggleShareMode`, `shareToggleSel`, `shareSelectAllVisible`, `shareClearSel` en
    `openShareDialog` door:
    ```js
    function setRevMode(m){STATE.revMode=m==='beeld'?'beeld':'trade';render();}
    function revSelToggle(id){const s=STATE.revShareSel,i=s.indexOf(id);if(i>=0)s.splice(i,1);else s.push(id);render();}
    function revSelMove(i,d){const s=STATE.revShareSel,j=i+d;if(j<0||j>=s.length)return;[s[i],s[j]]=[s[j],s[i]];render();}
    function revSelClear(){STATE.revShareSel=[];render();}
    // Selection survives filters on purpose (pick across months); ids of deleted trades are skipped here.
    function revSelTrades(){return STATE.revShareSel.map(id=>T.find(x=>x.id===id)).filter(Boolean);}
    function revCbx(id){const n=STATE.revShareSel.indexOf(id)+1;
      return `<span class="cbx ${n?'on':''}" role="checkbox" aria-checked="${!!n}" tabindex="0" title="${n?'uit selectie halen':'selecteren om te delen'}" onclick="event.stopPropagation();revSelToggle(${id})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();revSelToggle(${id});}">${n||''}</span>`;}
    function revTop(){const m=STATE.revMode;
      return `<div class="revtop"><div class="revmodes" role="tablist">${[['trade','Per trade'],['beeld','🖼 Beeld']].map(([k,l])=>`<button role="tab" aria-selected="${m===k}" class="${m===k?'on':''}" onclick="setRevMode('${k}')">${l}</button>`).join('')}</div>
        <span class="sp"></span>${m==='trade'&&STATE.revShareSel.length?`<button class="linkbtn" onclick="setRevMode('beeld')">${STATE.revShareSel.length} geselecteerd · delen in Beeld →</button>`:''}</div>`;}
    ```
  - **`pgReview`:**
    - Hernoem de huidige functie naar `revPerTrade()`.
    - Haal `${filterBar()}` uit de return en verwijder `sm`, `shareBar`, `phead`-varianten en de `⤴`-knop.
    - De lijstregel wordt:
      ```js
      `<div class="revitem ${x.id===t.id?'on':''} ${x.reviewed?'done':''}" onclick="selRev(${x.id})">${revCbx(x.id)}${rowInner(x)}</div>`
      ```
      Zet in `rowInner` rechts een `✓`-tekst voor gereviewde trades en `💬` als `x.coach`.
    - Nieuwe `pgReview`:
      ```js
      function pgReview(){if(!T.length)return emptyState('review');return revTop()+filterBar()+(STATE.revMode==='beeld'?revBeeld():revPerTrade());}
      function revBeeld(){return '';}   // filled in Task 4
      ```
  - **CSS** (bij de bestaande `.revitem`-regels):
    ```css
    .revtop{display:flex;align-items:center;gap:10px;margin:0 0 10px}
    .revmodes{display:inline-flex;background:var(--sink);border:1px solid var(--line);border-radius:10px;padding:3px}
    .revmodes button{border:0;background:none;color:var(--muted);font:600 13px var(--fb);padding:6px 14px;border-radius:7px;cursor:pointer}
    .revmodes button.on{background:var(--surface);color:var(--ink);box-shadow:var(--sh)}
    .cbx{flex:0 0 auto;width:22px;height:22px;border-radius:7px;border:2px solid var(--line);background:var(--surface);display:inline-flex;align-items:center;justify-content:center;font:800 12px var(--fb);color:var(--surface);cursor:pointer}
    .cbx:hover{border-color:var(--accent)} .cbx.on{background:var(--accent);border-color:var(--accent);color:var(--surface)}
    ```
  - **FAQ (~5016):** "Klik op het rondje vóór een trade" wordt
    "Open de trade en klik **Markeer gereviewd**. Het vakje vóór een trade selecteert hem om te delen."
  - **Specs:**
    - `coach-share.spec.js`: vervang de secties *Selectie-modus* en *Deel-dialoog* door `revSelToggle` / `.cbx`-asserts
      zoals hierboven. De pakket-secties blijven.
    - `review-list.spec.js`: de drie `rev-check`-asserts worden "vakje is een checkbox (role=checkbox)", "klik selecteert,
      opent niet" en "nogmaals klikken haalt weg". Telling, periode, zoeken en "toon meer" blijven.

- [ ] **Step 4: Draai, nu groen.** Run `node tests/review-beeld.spec.js`, `node tests/coach-share.spec.js` en
  `node tests/review-list.spec.js`. Verwacht: PASS.

- [ ] **Step 5: Commit.** `git commit -am "review: mode switch and a persistent selection instead of share mode"`
  (voeg `tests/review-beeld.spec.js` expliciet toe).

---

### Task 3: Per trade, nieuwe indeling

De lijst blijft links. Rechts komt één paneel met:
1. kop: vakje, pair · setup, richting, R, P&L, ‹ n/N ›, Markeer gereviewd, 📋 Discord, ✎;
2. de grote chart (max 44vh);
3. extra beelden, + screenshot en TV-links;
4. 18 tegels;
5. `<details>`-blokken voor *Lagen (top-down) · take-profits* (open) en *Zo is deze positie gelopen* (dicht);
6. de review in twee kolommen.

**Files:**
- Modify: `work/syncjournal.html`: `revPerTrade` (oude `.revmid` + `.revshots-col`), nieuwe helpers `lagenTxt`, `revShots`,
  `revTiles`, `revReviewFields`, een keydown-listener (naast ~5172) en CSS.
- Modify: `tests/tv-links.spec.js`, `tests/prijs-streepje.spec.js`, `tests/r-zonder-stop.spec.js` (selectors).
- Test: `tests/review-beeld.spec.js`

**Interfaces:**
- Consumes: `revCbx`, `revSelTrades` (Task 2); `saveCoach` (Task 1).
- Produces:
  - `lagenTxt(t)`, `revShots(t)`, `revTiles(t,n)`, `revReviewFields(t)`;
  - `.revtrade` (paneel), `.revtiles` (raster), `.revgrid` (review), `.revshot-main` (grote chart);
  - `revDiscord(id)` wordt hier al aangeroepen; tot Task 7 is het een stub.

- [ ] **Step 1: Schrijf de falende test.**

```js
console.log('─── Per trade ───');
await p.evaluate(rows => { T = rows.map(r => ({ ...r })); STATE.revSel = 1; persist(); clearGFilter(); go('review'); },
  [mk(1, { screenshots: [PNG], tvLinks: ['https://www.tradingview.com/x/abc/'], coach: 'Top', layers: [{ timeframe: '4H', bias: 'Bullish', confirmations: ['OB'] }, { timeframe: '1H', setups: ['BOS'] }] }),
   mk(2, { stop: 0, screenshots: [] })]);
await p.waitForTimeout(300);
ok('18 tegels', await p.evaluate(() => document.querySelectorAll('.revtrade .revtiles > div').length === 18));
ok('lagen top-down als 4H → 1H', await p.evaluate(() => document.querySelector('.revtiles').textContent.includes('4H → 1H')));
ok('HTF-bias Bullish groen', await p.evaluate(() => [...document.querySelectorAll('.revtiles > div')].some(d => d.textContent.includes('HTF-bias') && d.querySelector('.g'))));
ok('grote chart = eerste screenshot', await p.evaluate(() => !!document.querySelector('.revshot-main img')));
ok('TV-link zichtbaar', await p.evaluate(() => !!document.querySelector('.revtrade .tvlink')));
ok('coach-veld gevuld', await p.evaluate(() => document.querySelector('.revgrid textarea.coach').value === 'Top'));
ok('bedragen gemaskeerd', await p.evaluate(() => [...document.querySelectorAll('.revtiles > div')].filter(d => /P&L|Fees|Size/.test(d.textContent)).every(d => d.querySelector('.mask'))));
await p.keyboard.press('ArrowRight'); await p.waitForTimeout(150);
ok('→ naar volgende trade', await p.evaluate(() => STATE.revSel === 2));
ok('zonder stop: Behaald = streepje', await p.evaluate(() => [...document.querySelectorAll('.revtiles > div')].find(d => d.textContent.includes('Behaald')).textContent.includes('—')));
ok('zonder screenshot: lege staat met uitleg', await p.evaluate(() => /Nog geen screenshot/.test(document.querySelector('.revshot-main').textContent)));
await p.evaluate(() => document.querySelector('.revgrid textarea').focus()); await p.keyboard.press('ArrowLeft');
ok('pijltjes in een tekstvak bladeren niet', await p.evaluate(() => STATE.revSel === 2));
```

- [ ] **Step 2: Draai en zie hem falen** (`.revtrade` bestaat niet).

- [ ] **Step 3: Implementeer.**

  Helpers (boven `revPerTrade`):

```js
const lagenTxt=t=>(t.layers||[]).map(l=>l&&l.timeframe).filter(Boolean).join(' → ')||'—';
const revShots=t=>(t.screenshots||[]).filter(u=>beeldSrc(u));
const tvKnoppen=t=>(t.tvLinks||[]).filter(isHttpUrl).map((u,i,a)=>`<a class="tvlink" href="${esc(u)}" target="_blank" rel="noopener noreferrer" title="${esc(u)}">📈 TV${a.length>1?' '+(i+1):''} ↗</a>`).join('');
// Info tiles: 8 on a card, 18 on the per-trade page (order agreed in demo v5).
function revTiles(t,n){const tile=(l,v,c)=>`<div><div class="l">${l}</div><div class="v num ${c||''}">${v}</div></div>`;
  const b=htfBias(t),r=tradeROrNull(t),hit=(t.tps||[]).filter(x=>x.hit).length;
  const kaart=[tile('Datum',esc(fmtD(t.date)+(t.time?' '+t.time:''))),tile('Sessie',esc(sessionOf(t)||'—')),tile('Lagen',esc(lagenTxt(t))),
    tile('HTF-bias',b||'—',b==='Bullish'?'g':b==='Bearish'?'r':''),tile('Entry',prijsOfStreep(t.entry)),tile('Stop',prijsOfStreep(t.stop),'r'),
    tile('Exit',prijsOfStreep(t.exit)),tile('Duur',fmtDurMin(t.durationMin))];
  if(n<=8)return `<div class="revtiles k8">${kaart.join('')}</div>`;
  const vol=[kaart[0],kaart[1],tile('Exchange',esc((acctOf(t.exchange)||{}).name||t.exchange||'—')),kaart[2],kaart[3],tile('Grade',esc(gradeOf(t)||'—')),
    kaart[4],kaart[5],kaart[6],tile('R:R gepland',t.rrPlanned?esc(String(t.rrPlanned).replace('.',','))+' : 1':'—'),
    tile('Behaald',r==null?'—':rS(r),r==null?'':r>=0?'g':'r'),kaart[7],
    tile('Size','<span class="mask">'+(isNaN(SZ(t))?'—':CURSYM()+' '+SZ(t).toLocaleString('nl-NL'))+'</span>'),tile('Leverage',(t.leverage||'—')+'×'),
    tile('Risk','<span class="mask">'+(t.risk||'—')+'%</span>'),tile('P&L','<span class="mask">'+eurS(t.pnl)+'</span>',cls(t.pnl)),
    tile('Fees','<span class="mask">'+eur(t.fees||0)+'</span>'),tile('TP geraakt',(t.tps||[]).length?hit+'/'+t.tps.length:'—')];
  return `<div class="revtiles">${vol.join('')}</div>`;}
function revReviewFields(t){const checks=revChecks(t),rating=t.rating||0,emo=tradeEmotions(t)[0];
  return `<div class="revgrid"><div>
      <div class="lbl">Wat gebeurde er?</div><textarea class="note" onblur="saveNote(${t.id},this.value)" placeholder="Wat ging goed, wat kan beter?">${esc(t.notes||'')}</textarea>
      <div class="lbl">Leerpunt</div><textarea class="note" style="min-height:48px" onblur="saveLessons(${t.id},this.value)" placeholder="Volgende keer…">${esc(t.lessons||'')}</textarea>
      <div class="lbl">💬 Coach-feedback</div><textarea class="note coach" onblur="saveCoach(${t.id},this.value)" placeholder="Wat zegt je coach? Wordt bewaard bij de trade en gaat mee in het coach-pakket.">${esc(t.coach||'')}</textarea></div>
    <div><div class="lbl">Emotie</div><div class="emos">${EMOTIONS.map(e=>`<span class="emo ${emo===e?'on':''}" onclick="setEmotion(${t.id},${jsarg(e)})">${esc(e)}</span>`).join('')}</div>
      <div class="lbl">Discipline · ${checks.filter(Boolean).length}/5</div>${CHECKLIST.map((l,i)=>`<div class="check ${checks[i]?'done':''}" onclick="toggleCheck(${t.id},${i})"><span class="box">${checks[i]?'✓':''}</span><span>${esc(l)}</span></div>`).join('')}
      <div class="lbl">Rating</div><div class="stars">${[1,2,3,4,5].map(n=>`<span style="cursor:pointer;color:${n<=rating?'var(--amber)':'var(--track)'}" onclick="setRating(${t.id},${n})">★</span>`).join('')}</div>
      <div class="lbl">Tags & fouten</div><div>${tagChips(tradeTagsAll(t),true)}${tradeMistakes(t).map(m=>`<span class="tagchip col" style="--tc:var(--red)">${esc(m)}</span>`).join('')||''}</div></div></div>`;}
function revDiscord(id){toast('Kopieer voor Discord volgt','info');}   // replaced in Task 7
```

  - **Rechterkant van `revPerTrade`.** Vervang de hele `<div class="revmid">…</div>` + `<div class="revshots-col">…</div>` door
    één `<div class="panel revtrade ${(tradeROrNull(t)??t.pnl)>=0?'win':'loss'}">` met daarin:
    - **Kop.**
      - Links: `revCbx(t.id)`, dan `<h3>` met pair · setup.
      - Daarna: `pill`, `rBadge(t)` en `<span class="mask ${cls(t.pnl)}">${eurS(t.pnl)}</span>`.
      - Navigatie: de bestaande `revNav`-knoppen met de `pos+1/items.length`-chip.
      - De bestaande `toggleReviewed`-knop.
      - `<button class="iconbtn" onclick="revDiscord(${t.id})" title="Kopieer voor Discord">📋</button>` en de bestaande ✎-knop.
    - **Chart.** Bij `revShots(t)[0]`: `<div class="revshot-main" onclick="zoomShots(${t.id},0)"><img src="${beeldSrc(shots[0])}" alt="screenshot" loading="lazy"></div>`.
      Zonder screenshot: `<div class="revshot-main leeg">📷 Nog geen screenshot. Plak er een (Ctrl+V) of klik + screenshot.${tvKnoppen(t)?'<div>'+tvKnoppen(t)+'</div>':''}</div>`.
    - **Beeldenrij.** Extra beelden als 130px-thumbnails (`zoomShots(${t.id},k)`), dan `<button class="btn" onclick="pickScreenshot(${t.id})">+ screenshot</button>`,
      `<button class="btn" onclick="openForm(${t.id})">+ TV-link</button>` en `tvKnoppen(t)`.
    - `revTiles(t,18)`.
    - `<details class="revsec" open><summary>Lagen (top-down) · take-profits</summary>`: per laag
      `<div class="laag"><span class="tf">${esc(l.timeframe||'?')}</span> ${esc((l.setups||[]).join(' + '))} ${l.bias?'<span class="tagchip">'+esc(l.bias)+'</span>':''}${tagChips(l.confirmations||[],false)}</div>`,
      daarna `${(t.tps||[]).length?tpBreakdown(t):''}`.
    - `<details class="revsec"><summary>Zo is deze positie gelopen (stappen)</summary>${tradeTimeline(t)}${execTable(t)}</details>`.
    - `revReviewFields(t)`.
  - **Grid.** De `rev3`-grid wordt `.revtl{display:grid;grid-template-columns:minmax(260px,320px) 1fr;gap:14px;align-items:start}`,
    met `@media(max-width:900px){.revtl{grid-template-columns:1fr}}`.
  - **CSS:**
    ```css
    .revtrade.win{border-left:4px solid var(--green)} .revtrade.loss{border-left:4px solid var(--red)}
    .revshot-main{border-radius:12px;overflow:hidden;border:1px solid var(--line);cursor:zoom-in;background:var(--sink)}
    .revshot-main img{display:block;width:100%;max-height:44vh;object-fit:contain}
    .revshot-main.leeg{cursor:default;padding:34px;text-align:center;color:var(--muted)}
    .revtiles{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px}
    .revtiles.k8{grid-template-columns:repeat(2,minmax(0,1fr))}
    .revtiles>div{background:var(--sink);border:1px solid var(--line2);border-radius:8px;padding:5px 9px;min-width:0}
    .revtiles .l{font:700 10px var(--fb);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
    .revtiles .v{font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    @media(max-width:1200px){.revtiles:not(.k8){grid-template-columns:repeat(3,minmax(0,1fr))}}
    .revsec{border:1px solid var(--line);border-radius:10px;padding:8px 12px} .revsec summary{font-weight:700;cursor:pointer}
    .revgrid{display:grid;grid-template-columns:1.3fr 1fr;gap:18px} @media(max-width:900px){.revgrid{grid-template-columns:1fr}}
    .revgrid .lbl{font:700 10.5px var(--fb);letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:12px 0 6px}
    .revgrid textarea.coach{background:var(--accent-soft);border-color:var(--accent-line)}
    ```
  - **Toetsenbord** (naast de bestaande keydown-listener rond ~5172). `revPres` bestaat vanaf Task 6; declareer hier al
    `let revPres=null;` bij de review-helpers.
    ```js
    document.addEventListener('keydown',e=>{
      if(STATE.page!=='review'||!['ArrowLeft','ArrowRight','Escape'].includes(e.key))return;
      const el=document.activeElement;if(el&&/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))return;
      if(document.getElementById('modal').classList.contains('on')||document.getElementById('lightbox').classList.contains('on'))return;
      const d=e.key==='ArrowRight'?1:-1;
      if(revPres){e.preventDefault();if(e.key==='Escape')closeRevPres();else revPresGo(d);return;}
      if(e.key==='Escape')return;e.preventDefault();
      if(STATE.revMode==='beeld')revMonthGo(-d);else revNav(d);});
    ```
    `revMonthGo` en `closeRevPres` / `revPresGo` komen in Task 4 en 6. Zet tot dan stubs:
    ```js
    function revMonthGo(){}
    function closeRevPres(){}
    function revPresGo(){}
    ```
  - **Specs:**
    - `tv-links.spec.js`: `.revshots-col .tvlink` → `.revtrade .tvlink`; de "📈 TradingView"-paneelkop-assert vervalt.
    - `prijs-streepje.spec.js`: `.plangrid > *` → `.revtiles > div`.
    - `r-zonder-stop.spec.js`: `.pnlbig` → de tegel "Behaald" (`[...document.querySelectorAll('.revtiles > div')].find(d=>d.textContent.includes('Behaald'))`).

- [ ] **Step 4: Draai, nu groen.**
  ```bash
  node tests/review-beeld.spec.js
  node tests/review-list.spec.js
  node tests/tv-links.spec.js
  node tests/prijs-streepje.spec.js
  node tests/r-zonder-stop.spec.js
  node tests/duration.spec.js
  node tests/possize.spec.js
  node tests/changemaker-feedback.spec.js
  ```
  Verwacht: allemaal PASS.
- [ ] **Step 5: Kijk ernaar.** Maak screenshots, licht en donker, op 1440×900 en 1920×1080. Lees ze met de Read-tool.
  Vergelijk met `tests/screenshots/demo5-rijk-trade.png`.
- [ ] **Step 6: Commit.** `git commit -am "review: per-trade layout with big chart, 18 tiles and two-column review"`

---

### Task 4: Beeld-modus, maandblokken met kaarten

**Files:**
- Modify: `work/syncjournal.html`: `revBeeld`, `revMonths`, `revHasBeeld`, `revMonthGo`, `revCard`; nieuwe `EMPTY`-regel `revbeeld`; CSS.
- Test: `tests/review-beeld.spec.js`

**Interfaces:**
- Consumes: `revTiles(t,8)`, `revShots`, `tvKnoppen`, `revCbx` (Task 2–3).
- Produces:
  - `revMonths()`, `revMonthGo(d)` (d=+1 is een oudere maand);
  - `.revcards` (raster van 3), `.revcard.win|.loss`;
  - `revSelPanel()` als stub (Task 5), `openRevPres` als stub (Task 6).

- [ ] **Step 1: Schrijf de falende test.**

```js
console.log('─── Beeld-modus ───');
const BAD = 'x" onerror="alert(1)';
await p.evaluate(rows => { T = rows.map(r => ({ ...r })); STATE.revShareSel = []; STATE.revMonth = 0; persist(); clearGFilter(); go('review'); setRevMode('beeld'); },
  [mk(1, { date: '2026-09-29', screenshots: [PNG], setup: '<img src=x onerror=alert(1)>' }),
   mk(2, { date: '2026-09-20', tvLinks: ['https://www.tradingview.com/x/a/'] }),
   mk(3, { date: '2026-08-10', screenshots: [PNG] }),
   mk(4, { date: '2026-09-21' }),                          // geen beeld, geen link → niet in Beeld
   mk(5, { date: '2026-09-22', screenshots: [BAD] })]);    // ongeldige URL telt niet als beeld
await p.waitForTimeout(300);
ok('nieuwste maand eerst (september)', await p.evaluate(() => /september 2026/.test(document.querySelector('.revmonth h2').textContent)));
ok('alleen trades met beeld of TV-link', await p.evaluate(() => document.querySelectorAll('.revcard').length === 2));
ok('kaart heeft 8 tegels', await p.evaluate(() => document.querySelectorAll('.revcard')[0].querySelectorAll('.revtiles > div').length === 8));
ok('winst = groene rand', await p.evaluate(() => document.querySelector('.revcard').classList.contains('win')));
ok('setup ge-escaped', await p.evaluate(() => !document.querySelector('.revcard img[src="x"]') && document.querySelector('.revcard').textContent.includes('<img')));
ok('img lazy', await p.evaluate(() => [...document.querySelectorAll('.revcard img')].every(i => i.loading === 'lazy')));
await p.evaluate(() => revMonthGo(1)); await p.waitForTimeout(100);
ok('‹ naar augustus', await p.evaluate(() => /augustus 2026/.test(document.querySelector('.revmonth h2').textContent)));
ok('oudste maand: ‹ uitgeschakeld', await p.evaluate(() => document.querySelector('.revmonth .mbtn').disabled));
await p.evaluate(() => { T = T.map(t => ({ ...t, screenshots: [], tvLinks: [] })); persist(); render(); });
ok('lege staat zonder beelden, met uitleg', await p.evaluate(() => /Nog geen trades met beeld/.test(document.querySelector('.empty').textContent)));
```

- [ ] **Step 2: Draai en zie hem falen.**

- [ ] **Step 3: Implementeer.**

```js
const revHasBeeld=t=>revShots(t).length>0||(t.tvLinks||[]).some(isHttpUrl);
function revMonths(){const m={};reviewItems().filter(revHasBeeld).forEach(t=>{const k=String(t.date||'').slice(0,7);if(/^\d{4}-\d{2}$/.test(k))(m[k]=m[k]||[]).push(t);});
  return Object.keys(m).sort().reverse().map(k=>({k,list:m[k].sort((a,b)=>(b.date+(b.time||'')).localeCompare(a.date+(a.time||'')))}));}
const revMaandNaam=k=>new Date(k+'-15T12:00:00').toLocaleDateString('nl-NL',{month:'long',year:'numeric'});
function revMonthGo(d){const n=revMonths().length;STATE.revMonth=Math.min(Math.max(0,(STATE.revMonth||0)+d),Math.max(0,n-1));render();}
function revCard(t){const shots=revShots(t),on=STATE.revShareSel.includes(t.id),r=tradeROrNull(t);
  return `<div class="panel revcard ${(r??t.pnl)>=0?'win':'loss'} ${on?'on':''}">
    <div class="cardhd">${revCbx(t.id)}<b>${esc(fmtD(t.date))}</b><span class="mu">${esc(t.time||'')}</span><b>${esc(t.pair)}</b><span class="pill ${t.dir}">${t.dir==='long'?'LONG':'SHORT'}</span></div>
    <div class="cardsub">${esc(t.setup||'—')} · grade ${esc(gradeOf(t)||'—')}<span class="sp"></span>${rBadge(t)}</div>
    <div class="cardshot" onclick="openRevPres([${t.id}],${t.id},false)">${shots[0]?`<img src="${beeldSrc(shots[0])}" alt="screenshot" loading="lazy">`:`<div class="tvonly">📈 Alleen een TradingView-link</div>`}${shots.length>1?`<span class="nshots">+${shots.length-1}</span>`:''}</div>
    <div class="cardlinks">${tvKnoppen(t)}${tagChips(tradeTagsAll(t).slice(0,3),false)}</div>
    ${revTiles(t,8)}
    ${t.coach?`<div class="cardcoach">💬 ${esc(t.coach)}</div>`:''}
    <div class="cardft"><button class="linkbtn" onclick="toggleReviewed(${t.id})">${t.reviewed?'✓ Gereviewd':'Markeer gereviewd'}</button><span class="sp"></span><button class="linkbtn" onclick="STATE.revSel=${t.id};setRevMode('trade')">Open trade →</button></div></div>`;}
function revBeeld(){const M=revMonths();
  if(!M.length)return emptyState(reviewItems().length?'revbeeld':'trades-none');
  STATE.revMonth=Math.min(STATE.revMonth||0,M.length-1);const m=M[STATE.revMonth],L=m.list,i=STATE.revMonth;
  const g=gemR(L),w=L.filter(t=>(tradeROrNull(t)??t.pnl)>0).length,done=L.filter(t=>t.reviewed).length,nSel=STATE.revShareSel.length;
  return `<div class="revmonth"><button class="mbtn" onclick="revMonthGo(1)" ${i>=M.length-1?'disabled':''} aria-label="vorige maand">‹</button><h2>${esc(revMaandNaam(m.k))}</h2><button class="mbtn" onclick="revMonthGo(-1)" ${i<=0?'disabled':''} aria-label="volgende maand">›</button>
      <span class="mu">${L.length} trades · ${Math.round(w/L.length*100)}% win · gem. ${g.n?`<b class="${g.avg>=0?'g':'r'}">${rS(g.avg)}</b>`:'—'} · ${done}/${L.length} gereviewd</span>
      ${nSel?`<button class="btn pri" onclick="openRevPres(STATE.revShareSel,null,true)">▶ Presenteer geselecteerde (${nSel})</button>`:`<button class="btn" onclick="openRevPres(${JSON.stringify(L.map(t=>t.id))},null,true)">▶ Presenteer maand</button>`}
      ${revStatusSeg()}<span class="sp"></span><div class="dots">${M.map((x,j)=>`<span class="${j===i?'on':''}" title="${esc(revMaandNaam(x.k))}" onclick="STATE.revMonth=${j};render()"></span>`).join('')}</div></div>
    <div class="revbeeld"><div class="revcards">${L.map(revCard).join('')}</div>${revSelPanel()}</div>`;}
function revSelPanel(){return '';}          // Task 5
function openRevPres(){}                    // Task 6
```

  - **`revStatusSeg()`.** Haal het segment *Alles / Te reviewen / Gereviewd* uit `revPerTrade` naar een eigen functie
    (de bestaande `revfilters`-knoppen met `setRevFilter`), zodat beide modi hem tonen. Zet in `setRevFilter`
    `STATE.revMonth=0`.
  - **`EMPTY`.** Voeg toe:
    `revbeeld:['🖼','Nog geen trades met beeld','In deze selectie heeft geen enkele trade een screenshot of TradingView-link. Plak een screenshot bij een trade (Per trade → + screenshot) of pas je filter aan.','Naar Per trade',"setRevMode('trade')"]`.
    Volg de vorm van de bestaande regels (`[ico,head,desc,cta,act]`).
  - **CSS:**
    ```css
    .revmonth{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:4px 0 12px}.revmonth h2{min-width:170px;text-align:center;text-transform:capitalize}
    .revmonth .mbtn{width:34px;height:34px;border-radius:50%;border:1px solid var(--line);background:var(--surface);color:var(--ink);cursor:pointer}.revmonth .mbtn:disabled{opacity:.35;cursor:default}
    .revmonth .dots span{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--line);margin:0 3px;cursor:pointer}.revmonth .dots span.on{background:var(--accent)}
    .revbeeld{display:grid;grid-template-columns:1fr 300px;gap:14px;align-items:start}@media(max-width:1100px){.revbeeld{grid-template-columns:1fr}}
    .revcards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}@media(max-width:1400px){.revcards{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:700px){.revcards{grid-template-columns:1fr}}
    .revcard{display:flex;flex-direction:column;gap:9px;padding:12px}.revcard.win{border-left:4px solid var(--green)}.revcard.loss{border-left:4px solid var(--red)}.revcard.on{box-shadow:0 0 0 2px var(--accent)}
    .revcard .cardhd{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.revcard .cardsub{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--muted)}
    .revcard .cardshot{position:relative;border-radius:10px;overflow:hidden;border:1px solid var(--line);aspect-ratio:16/10;background:var(--sink);cursor:zoom-in}
    .revcard .cardshot img{width:100%;height:100%;object-fit:cover;display:block}.revcard .tvonly{display:flex;height:100%;align-items:center;justify-content:center;color:var(--muted)}
    .revcard .nshots{position:absolute;right:8px;bottom:8px;background:var(--surface);border-radius:99px;padding:1px 8px;font-size:12px}
    .revcard .cardcoach{background:var(--accent-soft);border-radius:8px;padding:7px 10px;font-size:13px}.revcard .cardft{display:flex;align-items:center}
    ```

- [ ] **Step 4: Draai, nu groen.** Maak ook een screenshot van Beeld (licht en donker) en vergelijk met `tests/screenshots/demo5-rijk-beeld.png`.
- [ ] **Step 5: Prestatie.** Voeg toe aan de spec: 3000 trades via `tests/helpers/dov-datasets.js` (of 3000 keer `mk` met
  datums verspreid over 12 maanden en `screenshots:[PNG]`). Assert dat `.revcard`-telling gelijk is aan de trades in de
  nieuwste maand, en `render()` in Beeld onder 300 ms (`performance.now()` rond `render()`).
- [ ] **Step 6: Commit.** `git commit -am "review: image mode with month blocks and cards"`

---

### Task 5: Selectie & delen-paneel + coach-pakket uit het paneel

**Files:**
- Modify: `work/syncjournal.html`: `revSelPanel`, `revSelMonth`, `downloadCoachPackage`, `coachPkgHTML` (extra regel met sessie · lagen · HTF-bias).
- Test: `tests/review-beeld.spec.js`, `tests/coach-share.spec.js`

**Interfaces:**
- Consumes: `revSelTrades`, `revSelMove`, `revSelToggle`, `revSelClear` (Task 2); `revMonths` (Task 4).
- Produces: `revSelPanel()`, `revSelMonth()`. `downloadCoachPackage()` leest de naam uit `#revShareName`.

- [ ] **Step 1: Schrijf de falende test.**

```js
console.log('─── Selectie & delen ───');
await p.evaluate(rows => { T = rows.map(r => ({ ...r })); STATE.revShareSel = []; STATE.revMonth = 0; persist(); clearGFilter(); go('review'); setRevMode('beeld'); },
  [mk(1, { date: '2026-09-29', screenshots: [PNG] }), mk(2, { date: '2026-09-20', screenshots: [PNG], coach: 'Let op <script>' })]);
await p.waitForTimeout(300);
ok('paneel zonder selectie: uitleg + knoppen uit', await p.evaluate(() => /Vink kaarten aan/.test(document.querySelector('.revsel').textContent) && document.querySelector('#revPkgBtn').disabled));
await p.evaluate(() => revSelMonth());
ok('+ Hele maand selecteert de maand', await p.evaluate(() => STATE.revShareSel.length === 2));
ok('paneel toont volgorde met pijltjes', await p.evaluate(() => document.querySelectorAll('.revsel .bitem').length === 2));
ok('presenteerknop wordt "geselecteerde (2)"', await p.evaluate(() => /geselecteerde \(2\)/.test(document.querySelector('.revmonth').textContent)));
const dl = p.waitForEvent('download');
await p.evaluate(() => { document.getElementById('revShareName').value = 'Denny'; downloadCoachPackage(); });
const f = await dl; const html = require('fs').readFileSync(await f.path(), 'utf8');
ok('pakket gedownload met naam', /Gedeeld door <b>Denny/.test(html));
ok('pakket bevat coach-feedback ge-escaped', html.includes('Let op &lt;script&gt;'));
ok('pakket bevat lagen-regel', /Lagen/.test(html));
ok('selectie blijft na download (ook nog naar Discord)', await p.evaluate(() => STATE.revShareSel.length === 2));
```

- [ ] **Step 2: Draai en zie hem falen.**

- [ ] **Step 3: Implementeer.**

```js
function revSelMonth(){const M=revMonths(),m=M[STATE.revMonth||0];if(!m)return;m.list.forEach(t=>{if(!STATE.revShareSel.includes(t.id))STATE.revShareSel.push(t.id);});render();}
function revSelPanel(){const sel=revSelTrades(),n=sel.length,dis=n?'':'disabled';
  return `<div class="panel revsel"><h3>Selectie & delen</h3>
    <p class="mu">${n?`${n} trade${n>1?'s':''}, in deze volgorde`:'Vink kaarten aan (het vakje vóór de datum) om ze te presenteren, naar je coach te sturen of op Discord te zetten.'}</p>
    ${sel.map((t,i)=>`<div class="bitem"><span class="o"><button onclick="revSelMove(${i},-1)" aria-label="omhoog">▲</button><button onclick="revSelMove(${i},1)" aria-label="omlaag">▼</button></span><span class="num mu">${i+1}</span><span class="nm"><b>${esc(t.pair)}</b> <span class="mu">${esc(fmtD(t.date))}</span></span>${rBadge(t)}<button class="linkbtn" onclick="revSelToggle(${t.id})" aria-label="weghalen">✕</button></div>`).join('')}
    <div class="selacts"><button class="linkbtn" onclick="revSelMonth()">+ Hele maand</button>${n?'<button class="linkbtn" onclick="revSelClear()">Wissen</button>':''}</div>
    <label class="lbl" for="revShareName">Jouw naam (in het pakket)</label><input id="revShareName" class="shareinp" value="${esc(DB.load('share_name','')||'')}" onchange="DB.save('share_name',this.value.trim())" placeholder="bv. Denny">
    <label class="shareopt"><input type="checkbox" ${STATE.shareHide?'checked':''} onchange="STATE.shareHide=this.checked"> Bedragen verbergen (alleen R)</label>
    <div class="act">
      <button class="btn pri" ${dis} onclick="openRevPres(STATE.revShareSel,null,true)">▶ Presenteer geselecteerde<small>volledig scherm · info, review en coach-feedback ernaast</small></button>
      <button class="btn" id="revPkgBtn" ${dis} onclick="downloadCoachPackage()">⬇ Coach-pakket<small>één HTML-bestand met beelden, info, review en coach-feedback</small></button>
      <button class="btn" ${dis} onclick="revDiscord(STATE.revShareSel[0])">📋 Kopieer voor Discord<small>chart + trade-info als beeld, plus tekst (eerste trade)</small></button>
    </div><div id="shareBusy" class="hint" style="display:none">⏳ Pakket wordt gebouwd…</div></div>`;}
```

  - **`downloadCoachPackage`:**
    - `ids` wordt `revSelTrades().map(t=>t.id)`.
    - Lees de naam uit `#revShareName` (en sla hem op via `DB.save('share_name',…)`).
    - `go` wordt `#revPkgBtn`.
    - Verwijder `closeForm()` en het wissen van de selectie in de success-tak.
  - **`coachPkgHTML`, `tc-sub`.** Vervang `· ${esc(t.timeframe||'—')} ·` door
    `· ${esc(lagenTxt(t))}${htfBias(t)?' · HTF '+esc(htfBias(t)):''} ·`, en zet vóór *Plan vs. uitvoering* een `<p class="sect-l">Lagen</p>`-regel
    met per laag `timeframe · setups · bias · confirmations` (alles door `esc`).
  - **CSS:**
    `.revsel{position:sticky;top:12px;display:flex;flex-direction:column;gap:6px;padding:14px}`,
    `.revsel .bitem{display:flex;align-items:center;gap:6px;font-size:13px}`,
    `.revsel .act{display:flex;flex-direction:column;gap:8px;margin-top:8px}`,
    `.revsel .act .btn{text-align:left;display:flex;flex-direction:column;align-items:flex-start}`,
    `.revsel .act small{font-weight:500;color:var(--muted);font-size:11.5px}`,
    `.revsel .act .btn.pri small{color:inherit;opacity:.8}`.

- [ ] **Step 4: Draai, nu groen.** Run `node tests/review-beeld.spec.js` en `node tests/coach-share.spec.js`.
- [ ] **Step 5: Commit.** `git commit -am "review: selection & share panel, coach package with layers and coach feedback"`

---

### Task 6: Presentatie met zijpaneel en miniaturen

**Files:**
- Modify: `work/syncjournal.html`: `revPres`, `openRevPres`, `drawRevPres`, `revPresGo`, `closeRevPres`, `revInfoVol`; einde van `render()`; CSS.
- Test: `tests/review-beeld.spec.js`

**Interfaces:**
- Consumes: `revShots`, `tvKnoppen`, `revTiles`, `revReviewFields` (Task 3).
- Produces:
  - `openRevPres(ids:number[], startId:number|null, panel:boolean)`;
  - `#revpres` (overlay), `.revpres .film .f` (miniaturen), `.revpres aside`.

- [ ] **Step 1: Schrijf de falende test.**

```js
console.log('─── Presentatie ───');
await p.evaluate(rows => { T = rows.map(r => ({ ...r })); STATE.revShareSel = []; persist(); clearGFilter(); go('review'); setRevMode('beeld'); },
  [mk(1, { date: '2026-09-29', screenshots: [PNG, PNG] }), mk(2, { date: '2026-09-20', tvLinks: ['https://www.tradingview.com/x/a/'], notes: '<img src=x onerror=alert(1)>' })]);
await p.waitForTimeout(300);
await p.evaluate(() => document.querySelector('.revmonth .btn').click()); await p.waitForTimeout(150);
ok('presenteer maand opent overlay', await p.evaluate(() => document.getElementById('revpres').classList.contains('on')));
ok('miniaturen = 3 (2 beelden + 1 TV-only)', await p.evaluate(() => document.querySelectorAll('#revpres .film .f').length === 3));
ok('zijpaneel met info + coach-veld', await p.evaluate(() => !!document.querySelector('#revpres aside .revtiles') && !!document.querySelector('#revpres aside textarea.coach')));
await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(100);
ok('→ door de items, ook naar TV-only', await p.evaluate(() => /Alleen een TradingView-link/.test(document.querySelector('#revpres .stage').textContent)));
ok('notitie ge-escaped in zijpaneel', await p.evaluate(() => !document.querySelector('#revpres aside img[src="x"]')));
await p.evaluate(() => { document.querySelector('#revpres aside textarea.coach').value = 'Mooi'; document.querySelector('#revpres aside textarea.coach').dispatchEvent(new Event('blur')); });
ok('coach invullen in presentatie bewaart', await p.evaluate(() => T.find(x => x.id === 2).coach === 'Mooi'));
await p.evaluate(() => document.querySelectorAll('#revpres .film .f')[0].click());
ok('klik op miniatuur springt', await p.evaluate(() => revPres.i === 0));
await p.evaluate(() => setEmotion(1, 'Kalm'));
ok('overlay blijft open na een render()', await p.evaluate(() => document.getElementById('revpres').classList.contains('on')));
await p.keyboard.press('Escape');
ok('Esc sluit', await p.evaluate(() => !document.getElementById('revpres').classList.contains('on') && revPres === null));
```

- [ ] **Step 2: Draai en zie hem falen.**

- [ ] **Step 3: Implementeer.** Vervang de stubs van `openRevPres`, `closeRevPres` en `revPresGo`, en declareer `revPres`
  hier als die er nog niet staat.

```js
// Presentation: every screenshot of the chosen trades in order; a trade without one gets one TV/auto slot.
function openRevPres(ids,startId,panel){const items=[];
  (ids||[]).map(id=>T.find(x=>x.id===id)).filter(Boolean).forEach(t=>{const s=revShots(t);if(s.length)s.forEach((src,k)=>items.push({id:t.id,src,k}));else items.push({id:t.id,src:null,k:0});});
  if(!items.length){toast('Geen trades om te presenteren','info');return;}
  revPres={items,i:Math.max(0,items.findIndex(x=>x.id===startId)),panel:!!panel};drawRevPres();}
function revInfoVol(t){return `${revTiles(t,18)}<div class="lbl">Lagen (top-down)</div>${(t.layers||[]).map(l=>`<div class="laag"><span class="tf">${esc(l.timeframe||'?')}</span> ${esc((l.setups||[]).join(' + '))} ${l.bias?'<span class="tagchip">'+esc(l.bias)+'</span>':''}${tagChips(l.confirmations||[],false)}</div>`).join('')||'<span class="mu">—</span>'}`;}
function drawRevPres(){let el=document.getElementById('revpres');
  if(!el){el=document.createElement('div');el.id='revpres';el.className='revpres';document.body.appendChild(el);}
  if(!revPres){el.classList.remove('on');el.innerHTML='';return;}
  const it=revPres.items[revPres.i],t=T.find(x=>x.id===it.id);if(!t){closeRevPres();return;}
  el.classList.add('on');el.classList.toggle('nopanel',!revPres.panel);
  el.innerHTML=`<div class="stage">${it.src?`<img src="${beeldSrc(it.src)}" alt="screenshot">`:`<div class="tvonly"><div style="font-size:46px">📈</div><b>Alleen een TradingView-link</b><div>${tvKnoppen(t)}</div></div>`}
      <button class="nav prev" onclick="revPresGo(-1)" aria-label="vorige">‹</button><button class="nav next" onclick="revPresGo(1)" aria-label="volgende">›</button><button class="x" onclick="closeRevPres()" aria-label="sluiten">✕</button>
      <div class="film">${revPres.items.map((x,j)=>{const tt=T.find(y=>y.id===x.id)||{};const r=tradeROrNull(tt);return `<div class="f ${j===revPres.i?'on':''}" onclick="revPres.i=${j};drawRevPres()" title="${esc(fmtD(tt.date||''))} · ${esc(tt.pair||'')}">${x.src?`<img src="${beeldSrc(x.src)}" alt="" loading="lazy">`:'<div class="tvf">📈</div>'}<div class="fc"><span>${esc(fmtD(tt.date||''))}</span><b class="${r==null?'':r>=0?'g':'r'}">${r==null?'—':rS(r)}</b></div></div>`;}).join('')}</div>
      <div class="capbar"><b>${esc(fmtD(t.date))} ${esc(t.time||'')}</b> · ${esc(t.pair)} · ${esc(t.setup||'')} ${rBadge(t)} <span class="mask">${eurS(t.pnl)}</span> <span class="mu">· ${revPres.i+1}/${revPres.items.length}</span><span class="sp"></span>${tvKnoppen(t)}<button class="linkbtn" onclick="closeRevPres();STATE.revSel=${t.id};setRevMode('trade')">Open trade →</button></div></div>
    ${revPres.panel?`<aside><div class="mu">${esc(fmtD(t.date))} · ${esc(t.time||'')} · ${esc(sessionOf(t)||'')}</div><h3>${esc(t.pair)} · ${esc(t.setup||'')}</h3>${revInfoVol(t)}${revReviewFields(t)}</aside>`:''}`;
  const f=el.querySelector('.film .f.on');if(f)f.scrollIntoView({block:'nearest',inline:'center'});}
function revPresGo(d){if(!revPres)return;revPres.i=(revPres.i+d+revPres.items.length)%revPres.items.length;drawRevPres();}
function closeRevPres(){revPres=null;drawRevPres();}
```

  - **`render()`.** Voeg als laatste regel toe: `if(revPres)drawRevPres();`. Zo ziet de presentatie direct een gewijzigde
    emotie, check of rating. Verlaat de gebruiker de reviewpagina (`go(...)`), zet dan `revPres=null` in `go()`.
  - **De kaartklik in `revCard`** (`openRevPres([${t.id}],${t.id},false)`) toont alleen de beelden van die trade, zonder paneel.
  - **CSS** (overlay altijd donker, zoals de bestaande lightbox; tokens binnen het paneel):
    ```css
    .revpres{position:fixed;inset:0;z-index:300;display:none;grid-template-columns:1fr 420px;background:rgba(8,10,16,.94)}
    .revpres.on{display:grid}.revpres.nopanel{grid-template-columns:1fr}
    .revpres .stage{position:relative;display:flex;flex-direction:column;min-width:0;padding:18px 18px 0}
    .revpres .stage>img{flex:1;min-height:0;object-fit:contain;width:100%}
    .revpres .tvonly{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#c9d1e4}
    .revpres .nav,.revpres .x{position:absolute;border:0;border-radius:50%;width:44px;height:44px;background:rgba(255,255,255,.12);color:#fff;font-size:22px;cursor:pointer}
    .revpres .prev{left:24px;top:40%}.revpres .next{right:24px;top:40%}.revpres .x{right:24px;top:18px}
    .revpres .film{display:flex;gap:8px;overflow-x:auto;padding:10px 0}
    .revpres .film .f{flex:0 0 120px;border-radius:8px;overflow:hidden;border:2px solid transparent;cursor:pointer;background:#111722}
    .revpres .film .f.on{border-color:var(--accent)}.revpres .film img{width:100%;height:64px;object-fit:cover;display:block}
    .revpres .film .fc{display:flex;justify-content:space-between;font-size:11px;color:#c9d1e4;padding:2px 6px}
    .revpres .capbar{display:flex;align-items:center;gap:8px;color:#eef1f7;padding:10px 0 16px}
    .revpres aside{background:var(--surface);color:var(--ink);overflow:auto;padding:18px}.revpres aside .revtiles{grid-template-columns:repeat(3,minmax(0,1fr))}
    .revpres aside .revgrid{grid-template-columns:1fr}
    @media(max-width:1000px){.revpres.on{grid-template-columns:1fr}.revpres aside{display:none}}
    ```
    `#fff` en de rgba-waarden staan hier bewust: de overlay is altijd donker in beide thema's, net als `.lightbox`.
    Zet er een comment bij, en controleer of de theme-token-hook dit accepteert. Gebruik anders de bestaande lightbox-variabelen.

- [ ] **Step 4: Draai, nu groen.** Maak een screenshot van de overlay in licht en donker.
- [ ] **Step 5: Commit.** `git commit -am "review: presentation overlay with side panel and thumbnail strip"`

---

### Task 7: Kopieer voor Discord

**Files:**
- Modify: `work/syncjournal.html`: `revDiscord` (vervangt de stub uit Task 3), `revDiscordTekst`.
- Test: `tests/review-beeld.spec.js`

**Interfaces:**
- Consumes: `revShots`, `lagenTxt`, `htfBias`, `STATE.shareHide`.
- Produces:
  - `revDiscordTekst(t, hide) -> string` (puur, testbaar);
  - `revDiscord(id) -> Promise<void>`.

- [ ] **Step 1: Schrijf de falende test.**

```js
console.log('─── Discord ───');
await p.evaluate(rows => { T = rows.map(r => ({ ...r })); persist(); },
  [mk(1, { screenshots: [PNG], notes: 'Netjes', layers: [{ timeframe: '4H', bias: 'Bullish' }, { timeframe: '1H' }], tvLinks: ['https://www.tradingview.com/x/a/'] }),
   mk(2, { screenshots: ['https://example.com/x.png'], stop: 0 })]);
const tx = await p.evaluate(() => revDiscordTekst(T[0], true));
ok('tekst: pair, richting, lagen, R', /\*\*BTC\/USDT LONG\*\*/.test(tx) && tx.includes('4H → 1H') && /[+−][\d,]+R/.test(tx));
ok('tekst: verborgen bedragen = geen $', !/\$|540/.test(tx));
ok('tekst: TV-link mee', tx.includes('tradingview.com/x/a/'));
ok('tekst zonder stop: R als streepje', /—/.test(await p.evaluate(() => revDiscordTekst(T[1], true))));
await p.context().grantPermissions(['clipboard-read', 'clipboard-write']);
await p.evaluate(() => revDiscord(1)); await p.waitForTimeout(600);
ok('beeld + tekst gekopieerd (toast)', await p.evaluate(() => /gekopieerd/i.test(document.body.innerText)));
const errsVoor = errs.length;
await p.evaluate(() => revDiscord(2)); await p.waitForTimeout(800);
ok('externe screenshot (tainted canvas): geen crash, wel melding', errs.length === errsVoor && await p.evaluate(() => /tekst gekopieerd|niet mee/i.test(document.body.innerText)));
```

- [ ] **Step 2: Draai en zie hem falen.**

- [ ] **Step 3: Implementeer.**

```js
function revDiscordTekst(t,hide){const r=tradeROrNull(t),tv=(t.tvLinks||[]).filter(isHttpUrl)[0];
  return [`**${t.pair} ${t.dir==='long'?'LONG':'SHORT'}** · ${t.setup||'—'} (${lagenTxt(t)}) · ${r==null?'—':rS(r)}${hide?'':' · '+eurS(t.pnl)}`,
    `Entry ${prijsOfStreep(t.entry)} · Stop ${prijsOfStreep(t.stop)} · Exit ${prijsOfStreep(t.exit)}${t.rrPlanned?' · R:R gepland '+String(t.rrPlanned).replace('.',','):''}`,
    t.notes||'',tv||''].filter(Boolean).join('\n');}
// Discord image: chart left, trade info right, note in a footer. Always dark: it is a standalone PNG.
const DC={bg:'#0d1118',bar:'#151a23',ink:'#eef1f7',sub:'#c3c9d6',mut:'#8a92a6',pos:'#2fbf8a',neg:'#ef5d6a',brand:'#7d88ff'};
async function revDiscord(id){const t=T.find(x=>x.id===id);if(!t)return;const hide=STATE.shareHide,tekst=revDiscordTekst(t,hide),src=revShots(t)[0];
  const alleenTekst=async msg=>{try{await navigator.clipboard.writeText(tekst);}catch(e){}toast(msg,'info');};
  if(!src)return alleenTekst('Geen screenshot bij deze trade: alleen de tekst gekopieerd');
  const img=new Image();img.crossOrigin='anonymous';
  try{await new Promise((ok,nok)=>{img.onload=ok;img.onerror=nok;img.src=src;});}catch(e){return alleenTekst('Screenshot niet te laden: alleen de tekst gekopieerd');}
  const W=1280,H=760,P=440,c=document.createElement('canvas');c.width=W+P;c.height=H+64;const g=c.getContext('2d');
  g.fillStyle=DC.bg;g.fillRect(0,0,c.width,c.height);
  const s=Math.min(W/img.naturalWidth,H/img.naturalHeight),dw=img.naturalWidth*s,dh=img.naturalHeight*s;g.drawImage(img,(W-dw)/2,(H-dh)/2,dw,dh);
  let y=48;const x=W+28,r=tradeROrNull(t),b=htfBias(t);
  const regel=(l,v,col)=>{g.fillStyle=DC.mut;g.font='600 19px Inter,sans-serif';g.fillText(l,x,y);g.fillStyle=col||DC.ink;g.font='600 21px "IBM Plex Mono",monospace';g.fillText(String(v),x+170,y);y+=38;};
  g.fillStyle=DC.ink;g.font='bold 32px Inter,sans-serif';g.fillText(t.pair,x,y);const pw=g.measureText(t.pair).width;
  g.fillStyle=t.dir==='long'?DC.pos:DC.neg;g.font='bold 20px Inter,sans-serif';g.fillText(t.dir==='long'?'LONG':'SHORT',x+pw+14,y);y+=40;
  g.fillStyle=DC.sub;g.font='600 22px Inter,sans-serif';g.fillText(((t.setup||'—')+' · '+lagenTxt(t)).slice(0,34),x,y);y+=74;
  g.fillStyle=r==null?DC.mut:r>=0?DC.pos:DC.neg;g.font='bold 54px "IBM Plex Mono",monospace';g.fillText(r==null?'—':rS(r),x,y);y+=50;
  if(!hide){g.font='bold 24px "IBM Plex Mono",monospace';g.fillText(eurS(t.pnl),x,y-8);y+=26;}
  regel('Datum',fmtD(t.date)+' '+(t.time||''));regel('Sessie',sessionOf(t)||'—');regel('HTF-bias',b||'—',b==='Bullish'?DC.pos:b==='Bearish'?DC.neg:null);
  regel('Entry',prijsOfStreep(t.entry));regel('Stop',prijsOfStreep(t.stop),DC.neg);regel('Exit',prijsOfStreep(t.exit));
  regel('R:R gepland',t.rrPlanned?String(t.rrPlanned).replace('.',',')+' : 1':'—');regel('Duur',fmtDurMin(t.durationMin));
  g.fillStyle=DC.bar;g.fillRect(0,H,c.width,64);g.fillStyle=DC.brand;g.font='bold 24px Inter,sans-serif';g.fillText('SyncJournal',24,H+41);
  const nt=t.notes?'“'+t.notes.replace(/\s+/g,' ')+'”':'';g.fillStyle=DC.mut;g.font='20px Inter,sans-serif';g.fillText(nt.length>110?nt.slice(0,107)+'…”':nt,200,H+40);
  let blob;try{blob=await new Promise((ok,nok)=>{try{c.toBlob(b=>b?ok(b):nok(new Error('leeg')),'image/png');}catch(e){nok(e);}});}
  catch(e){return alleenTekst('Dit beeld komt van een andere website en mag niet mee: alleen de tekst gekopieerd');}
  try{await navigator.clipboard.write([new ClipboardItem({'image/png':blob,'text/plain':new Blob([tekst],{type:'text/plain'})})]);toast('📋 Beeld + tekst gekopieerd: plak in Discord (Ctrl+V)','ok');}
  catch(e){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='discord-'+t.date+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(u),3000);
    try{await navigator.clipboard.writeText(tekst);}catch(_){}toast('Klembord staat geen beeld toe: beeld gedownload, tekst gekopieerd','info');}}
```

  Canvas-tekst is geen HTML. `esc()` is hier dus niet nodig en zou `&lt;` letterlijk tonen. Dat geldt ook voor de
  Discord-tekst: Discord rendert geen HTML.

- [ ] **Step 4: Draai, nu groen.** Bekijk ook het PNG-bestand: laat de test `revDiscord` in de fallback-tak een download
  doen, of schrijf het blob naar `tests/screenshots/discord.png`. Lees het met de Read-tool.
- [ ] **Step 5: Commit.** `git commit -am "review: copy for Discord (chart + trade info image and text)"`

---

### Task 8: Afronden en release v1.9

**Files:** `tests/release-set.js`, `CHANGELOG.md`, `work/syncjournal.html` (`APP_VERSION`), `site/version.json`, `site/app.html`, `site/demo-dataset.json`

- [ ] **Step 1: Poortlijst.** Voeg `'review-beeld'` toe aan `tests/release-set.js`, naast `'coach-share'`.
- [ ] **Step 2: Volledige review-set.**
  ```bash
  node tests/run-all-sj.js review coach tv-links prijs-streepje r-zonder-stop duration possize changemaker e2e beeld
  ```
  Verwacht: alles groen.
- [ ] **Step 3: Visueel.** Maak screenshots van Per trade, Beeld, het paneel met selectie en de presentatie, in licht
  én donker, op 1366×768 en 1920×1080. Run `node tests/run-adhoc.js` met de demo-dataset. Lees ze. Let op:
  - tegels die afbreken;
  - het paneel dat onder de kaarten valt op een laptop;
  - contrast van `.cbx.on` in donker.
- [ ] **Step 4: Review.** Laat `pr-reviewer-nl` (opus) de diff `main...review-beeld` reviewen. Fix bevindingen met een test.
- [ ] **Step 5: Release-ritueel** (CLAUDE.md):
  - `APP_VERSION='v1.9'` en `site/version.json` (`version`, `released: 2026-10-xx`);
  - CHANGELOG-blok `## [v1.9]`:
    - **Toegevoegd:** Beeld-modus, Selectie & delen, Presenteer met miniaturen, Kopieer voor Discord, coach-feedback bij de trade.
    - **Gewijzigd:** Per-trade-indeling. Het vakje vóór een trade selecteert nu; markeren als gereviewd gaat met de knop.
      Het coach-pakket bevat lagen en coach-feedback.
    - **Verwijderd:** deel-modus en de deel-dialoog.
  - `cp work/syncjournal.html site/app.html`;
  - `node scripts/gen-syncjournal-dataset-v2.js`.

  Commit als `Release v1.9: review image mode, sharing and coach feedback` (squash op `main` via PR).
- [ ] **Step 6: Poort.** Run `node tests/run-release.js`. Verwacht: alles groen. Daarna kopie naar
  `deploy/syncjournal-site` en commit. **Niet pushen** zonder "push" van Denny.

---

## Bewust niet in dit plan
- Filter **Alle playbooks** in de filterbalk. Dat volgt als losse patch daarna; zie `demos/review-beeld-NOTES.md`,
  sectie *Daarna*.
- Coach-feedback terug-importeren uit een bestand van de coach. Nu typ je die zelf over tijdens of na het gesprek.
- Meer dan één trade tegelijk naar Discord. Dat is nu bewust één beeld (de eerste van de selectie), omdat Discord per
  bericht één afbeelding uit het klembord plakt.
