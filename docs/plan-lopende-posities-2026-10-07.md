# Lopende posities: geld telt, uitkomst wacht — implementatieplan

> **Voor wie dit uitvoert:** werk taak voor taak (superpowers:executing-plans). Stappen hebben
> checkboxes (`- [ ]`).

**Doel:** Netto P&L is al het geboekte geld, ook het TP-deel van een positie die nog loopt (handmatig
en gesynct gelijk). Win-rate, expectancy, reeks en andere uitkomst-statistieken tellen alleen trades
die helemaal dicht zijn.

**Besluit:** Denny, 07-10-2026, optie A. Aanleiding: win-rate 43% en reeks "3V" terwijl zijn twee
lopende posities allebei al een TP hadden. Een eerste poging, die partials overal uit de statistieken
haalde, botste met de scenario-ronde van 24-09: het geboekte deel van een **handmatige** partial telt
mee in Netto P&L én saldo (`tests/handmatig-statistieken.spec.js`).

**Architectuur:** naast `CLOSED` komt een tweede lijst, `BOEKINGEN`. `CLOSED` wordt de
uitkomst-lijst (alleen trades met een uitkomst). `BOEKINGEN` is de geld-lijst: alle niet-open trades,
waarbij een partial als `pnl` zijn geboekte bedrag krijgt. Elke plek die een geldbedrag optelt, leest
`BOEKINGEN`. Elke plek die telt, deelt of wint/verliest bepaalt, leest `CLOSED`. Er verandert niets aan
de opgeslagen data, dus er is geen migratie nodig.

**Tech:** `work/syncjournal.html` (single-file, vanilla JS + React/Recharts), Playwright-specs als
losse Node-scripts.

## De twee vormen van een partial (feit, niet veranderen)

| | `pnl` | `realizedPnl` |
|---|---|---|
| Gesynct (OKX, Blofin, Hyperliquid) | `0` / `"0"` | het geboekte bedrag, na fees |
| Handmatig (formulier, TP aangevinkt) | het geboekte bedrag | leeg |

`fxView` rekent beide om naar euro (`FX_MONEY` bevat `pnl` en `realizedPnl`) en bewaart het
dollarbedrag van `pnl` als `pnlUsd`, met de koers in `_fx`.

## Vaste regels

- Versie: dit is zichtbaar ander gedrag, dus **minor**: `v1.4.2` → `v1.5` (`APP_VERSION` en
  `site/version.json`).
- Een geboekte TP staat in kalender, equity-curve en maand-P&L op **de dag van de trade** (de
  openingsdag), net als een gesloten trade. Anders verspringt het bedrag naar een andere dag zodra de
  trade dichtgaat.
- Uitsplitsingen (per setup, pair, sessie, uur, grade, richting, fouten, emoties, playbook,
  real/paper/backtest) beschrijven afgelopen trades en lezen `CLOSED`. Hun som kan daardoor afwijken
  van Netto P&L met het geboekte deel van lopende posities. Dat is bewust.
- UI-tekst in het Nederlands, Engelse trading-termen (TP, partial niet in UI-tekst: "lopend").
- Bedragen in een `.mask`-element (privacy-modus).

## Waar het op kan stuklopen (review focus)

1. **Euro-weergave:** het geboekte deel van een gesyncte partial moet in euro omgerekend zijn, en %/R
   moeten met het dollarbedrag rekenen (`pnlUsd`), niet met `0`. → Taak 2, stap 1 (EUR-test).
2. **Dubbel tellen bij sluiten:** een gesloten trade die nog een oude `realizedPnl` heeft, mag die
   niet bovenop zijn `pnl` krijgen. → `geboekt()` kijkt alleen naar `realizedPnl` bij status
   `partial`; Taak 2, stap 1.
3. **Handmatige partial:** blijft precies tellen zoals nu (Netto én saldo 4,17), alleen niet meer in
   de uitkomsten. → Taak 4, stap 1.
4. **Een dag met alleen een lopende positie:** kalendercel, weektotaal en jaar-tooltip tonen het
   bedrag met "loopt", geen `0·NaN%` en geen "Geen trades". → Taak 3, stap 1.
5. **Privacy-modus:** de nieuwe regel "waarvan … uit lopende posities" is gemaskeerd. → Taak 2,
   stap 1.

---

### Task 1: Twee lijsten, en de uitkomsten zonder lopende posities

**Bestanden:**
- Wijzig: `work/syncjournal.html` — bij `let CLOSED=[];`, in `render()` (`CLOSED=FT.filter(...)`),
  `playbookDetail` (`const closed=src.filter(...)`), `eroBuckets`, de teller in `pgAnalytics`
  (`const nOpenA=...`).
- Nieuw: `tests/lopend-niet-meegeteld.spec.js` (staat klaar als patch in de scratchpad van de sessie
  van 07-10; inhoud hieronder samengevat).
- Wijzig: `tests/changemaker-feedback.spec.js` (tekst van de teller).

**Levert:** `heeftUitkomst(t)`, `geboekt(t)`, `boeking(t)`, globale `BOEKINGEN` (array).

- [ ] **Stap 1: test die faalt.** `tests/lopend-niet-meegeteld.spec.js` met Denny's zeven trades uit
  zijn export (5 gesloten: +0,0089, +0,4508, −2,0222, +0,6619, −9,9307; 2 partial met `pnl 0`,
  `realizedPnl` 9,5332 en 2,5092) plus één open trade. Controles op Analytics: win-rate `60%`,
  expectancy `2,17`, reeks `1V`, 5 bolletjes in "laatste trades", teller begint met
  `5 trades in de berekening · 3 lopend niet meegerekend`. Daarna partial 82 dicht met −3,10:
  win-rate `50%`, reeks `2V`. Playbook-detail `50% win`, `eroBuckets(T).real.n === 6`.
- [ ] **Stap 2: draaien, zien falen.** `node tests/lopend-niet-meegeteld.spec.js` → o.a. `43%`, `3V`.
- [ ] **Stap 3: helpers en lijsten.** Onder `let CLOSED=[];`:

```js
let BOEKINGEN=[];
/* Two lists (Denny 07-10-2026, option A). CLOSED: trades with an outcome, for anything that counts,
   divides or decides win/loss. A running position (open, or partial after a TP) can still hit its
   stop. BOEKINGEN: all booked money, for anything that sums an amount; a partial carries what it
   booked so far. Until v1.5 a partial was a 0 trade in CLOSED: not a win, so it lowered win-rate
   and counted as a loss in the streak, while a synced partial's TP money was missing from net P&L. */
function heeftUitkomst(t){return t.status!=='open'&&t.status!=='partial';}
// Synced partials keep pnl 0 and the booked amount in realizedPnl; a manual partial books into pnl.
function geboekt(t){
  if(t.status==='partial'&&t.realizedPnl!==''&&t.realizedPnl!=null&&isFinite(+t.realizedPnl))return +t.realizedPnl;
  return +t.pnl||0;
}
// pnlUsd only exists in EUR view (fxView); % and R read it, so it must follow the booked amount.
function boeking(t){if(t.status!=='partial')return t;const v=geboekt(t);return {...t,pnl:v,...(t._fx?{pnlUsd:v/t._fx}:{})};}
```

  In `render()`: `CLOSED=FT.filter(heeftUitkomst);` en daaronder
  `BOEKINGEN=FT.filter(t=>t.status!=='open').map(boeking);`.
  `playbookDetail`: `const closed=src.filter(heeftUitkomst);`.
  `eroBuckets`: `if(!heeftUitkomst(x))return;` in plaats van `if(x.status==='open')return;`.
  Teller in `pgAnalytics`:

```js
  const nLopendA=FT.filter(t=>!heeftUitkomst(t)).length;
  const scopeChip=`…📊 ${CLOSED.length.toLocaleString('nl-NL')} trades in de berekening${nLopendA?` · ${nLopendA} lopend niet meegerekend`:''}</span></div>`;
```

  `tests/changemaker-feedback.spec.js`: `/open niet meegerekend/` → `/lopend niet meegerekend/`.
- [ ] **Stap 4: draaien, groen.** `node tests/lopend-niet-meegeteld.spec.js` en
  `node tests/changemaker-feedback.spec.js`.

### Task 2: Geld leest BOEKINGEN

**Bestanden:** `work/syncjournal.html`: `kpiBlock`, `equity`, de Analytics-equity
(`equity(214,periodTrades(CLOSED,KPIPER.eq))`), dashboard `mRows`/`yRows`, `monthlyUnit`, Analytics
drawdown (`chron.forEach(t=>{cum+=t.pnl;peak=…`), `byDayNet`, het totaal onder de tradelijst
(`net=rows.reduce((s,t)=>s+t.pnl,0)`), `acctPnl`. Test: uitbreiding van
`tests/lopend-niet-meegeteld.spec.js`; `tests/equity-curve.spec.js`.

- [ ] **Stap 1: test die faalt.** In dezelfde spec, vóór partial 82 dichtgaat:
  - Netto P&L-kaart `+$ 1,21` (−10,8313 + 9,5332 + 2,5092), met eronder
    `waarvan +$ 12,04 uit lopende posities` in een `.mask`-element.
  - Equity-reeks `[0.01, 0.46, -1.56, -0.9, -10.83, -8.32, 1.21]` (partial 83 opent 06:16, 82 om
    16:24): eindigt op Netto P&L.
  - Dashboard "Gerealiseerd deze maand" (oktober, klok op 07-10-2026) `+$ 12,04`.
  - Totaal onder de tradelijst `+$ 1,21`.
  - EUR: alle trades `fx: 0.9`, `STATE.currency='EUR'` → Netto `1,09`; in %-weergave geen `0%` voor
    de partials (pnlUsd volgt het geboekte bedrag).
  - Dubbel tellen: een gesloten trade met een achtergebleven `realizedPnl: 50` telt alleen zijn `pnl`.
  `tests/equity-curve.spec.js`: `VERWACHT` wordt `[0.01, 0.46, -1.56, -0.9, -10.83, -8.32, 1.21]`.
- [ ] **Stap 2: draaien, zien falen.**
- [ ] **Stap 3: implementatie.**
  - `kpiBlock`: `const per=KPIPER[sk],bron=key==='net'?BOEKINGEN:CLOSED,lst=periodTrades(bron,per),…`.
    In de `net`-kaart, onder de waarde, alleen in de valuta-weergave en als het bedrag niet 0 is:

```js
  const lopend=key==='net'&&UNIT()==='val'?lst.filter(t=>t.status==='partial').reduce((s,t)=>s+t.pnl,0):0;
  // …in de return, na de kv-row:
  ${lopend?`<div class="kctx mask">waarvan ${eurCS(lopend)} uit lopende posities</div>`:''}
```

    (bestaat `.kctx` niet, gebruik dan `style="font-size:11px;color:var(--muted)"`, zie `kpiCard`).
  - `equity(h,list)`: standaard `list||BOEKINGEN`; Analytics: `equity(214,periodTrades(BOEKINGEN,KPIPER.eq))`.
  - Dashboard: `const mRows=BOEKINGEN.filter(…)`, `const yRows=BOEKINGEN.filter(…)`.
  - `monthlyUnit`: `BOEKINGEN.filter(hasDate).forEach(…)`.
  - Analytics drawdown en "Max drawdown": een eigen lus over
    `BOEKINGEN.slice().sort((x,y)=>tradeMoment(x)-tradeMoment(y))` voor `cum/peak/maxDD/eqV/ddV`.
    `crV` (cumulatieve R), de reeksen en `wrRun/pfRun/expRun` blijven op `chron` (`CLOSED`); `expRun`
    krijgt een eigen cumulatief in plaats van `eqV[i+1]`.
  - `byDayNet`: `BOEKINGEN.forEach(…)`.
  - Tradelijst-totaal: `net=rows.reduce((s,t)=>s+geboekt(t),0)`.
  - `acctPnl`: `.reduce((s,t)=>s+geboekt(t),0)` (zelfde getal voor handmatige trades, maar nu ook
    juist voor een gesyncte vorm).
- [ ] **Stap 4: draaien, groen.** Beide specs.

### Task 3: Kalender en jaaroverzicht

**Bestanden:** `work/syncjournal.html`: `pgKalender` (`byDay`, `yByDay`, de dagcel en het
weektotaal), `yearHeatmap` (data-attributen), `yhMove` (tooltip).

- [ ] **Stap 1: test die faalt.** In de spec, kalender oktober 2026:
  - "Netto maand" `+$ 12,04`, `0 trades` (er is nog niets afgelopen).
  - De cel van 5 oktober toont `+$ 12,04` en `loopt`, niet `0·NaN%`.
  - Het weektotaal van die week is `+$ 12,04`, geen `—`.
  - Jaaroverzicht: de cel van 5 oktober heeft een kleur; de tooltip toont het bedrag en "lopend", niet
    "Geen trades".
- [ ] **Stap 2: draaien, zien falen.**
- [ ] **Stap 3: implementatie.** `byDay` en `yByDay` vullen uit `BOEKINGEN`; `v` telt elk bedrag, `n`
  en `w` alleen als `heeftUitkomst(t)`, en een nieuw veld `l` telt de lopende:

```js
  const byDay={};BOEKINGEN.filter(t=>hasDate(t)&&t.date.slice(0,7)===STATE.calMonth).forEach(t=>{const d=(byDay[t.date]=byDay[t.date]||{v:0,n:0,w:0,l:0});
    d.v+=t.pnl;if(!heeftUitkomst(t)){d.l++;return;}d.n++;if(t.pnl>0)d.w++;});
```

  Dagcel: `${dd.n?`${dd.n}·${Math.round(dd.w/dd.n*100)}%`:'loopt'}`. Weektotaal: tel dagen met een
  entry (`wkD++`) en toon `${wkD?eurS(wkNet):'—'}`. `yearHeatmap`: zet `data-l` naast `data-n`.
  `yhMove`: bij `n===0&&l>0` een tooltip met de datum, `Lopend: ${l}` en het bedrag (`.mask`); bij
  `n>0&&l>0` een extra regel `Lopend`.
- [ ] **Stap 4: draaien, groen.**

### Task 4: Bestaande specs, release

- [ ] **Stap 1:** `tests/handmatig-statistieken.spec.js`, blok "Open, deels gesloten en oefentrades":
  de handmatige partial telt in netto (dashboard-kaart toont `4,17`) en balans `10004,17`, maar
  `closedN === 0`. Het paper/backtest-blok verwacht ook `closedN === 0`.
- [ ] **Stap 2:** `tests/release-set.js`: `'lopend-niet-meegeteld'` toevoegen.
- [ ] **Stap 3:** `APP_VERSION='v1.5'`, `site/version.json` `v1.5`, CHANGELOG-blok `## [v1.5]` onder
  **Gewijzigd**: Netto P&L telt het geboekte deel van lopende posities; win-rate, expectancy en reeks
  tellen een positie pas als hij dicht is.
- [ ] **Stap 4:** `cp work/syncjournal.html site/app.html`,
  `node scripts/gen-syncjournal-dataset-v2.js`, één commit `Release v1.5: …`, dan
  `node tests/run-release.js` (alles groen), dan `site/` naar `deploy/syncjournal-site/` en daar
  committen. **Niet pushen** zonder "push" van Denny.
