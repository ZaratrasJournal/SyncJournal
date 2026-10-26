# Setup-lagen top-down — implementatieplan (stap 1 van 2)

> **Voor wie dit uitvoert:** werk taak voor taak (superpowers:executing-plans). Stappen hebben
> checkboxes (`- [ ]`).

**Doel:** setup-lagen staan altijd top-down op tijdframe (hoogste boven, entry onderaan), het
formulier toont je eigen tijdframe-tags, en bestaande trades worden eenmalig rechtgezet.

**Besluiten** (Zaratras, 13-10-2026, grill-me):
1. Een laag springt **meteen** naar zijn plek zodra je een tijdframe kiest; bij opslaan nog eens
   gegarandeerd. Een laag zonder tijdframe blijft op zijn plek.
2. **Bestaande trades eenmalig rechtzetten**: lagen sorteren, `t.timeframe` = tijdframe van de
   onderste laag. De **setup blijft onaangeroerd** (niet te zien of die zelf gekozen of afgeleid was).
3. De laag toont **jouw tijdframe-tags** (`tagConfig.timeframeTags`), gesorteerd op duur. Sorteren
   op werkelijke duur; een onleesbaar label gaat **bovenaan** (wordt nooit per ongeluk de entry).
4. Bias-schrijfwijze gelijktrekken (`bearish` → `Bearish`) in dezelfde opruimstap; stap 2 rekent
   ermee.
5. Twee releases: **v1.7** = dit plan; **v1.8** = analytics (eigen plan): tijdframe en
   tijdframe-combinatie als Tendencies-dimensie, HTF-bias mee/tegen/geen (bias van de **hoogste**
   laag met Bullish/Bearish), en lagen-patronen (tijdframe + setup) op de playbook-pagina.

**Waarom het meer is dan volgorde:** `submitForm` neemt de **laatste** laag als entry-laag
(`work/syncjournal.html`, `const entryLayer=layers[layers.length-1]`) en leidt daar `t.timeframe`
en — zonder gekozen playbook — de setup uit af. Een 4H-laag onder de 1H maakte de trade een
4H-trade. In Zaratras' export van 13-10 staat er zo één ("1H > 4H").

**Tech:** `work/syncjournal.html`, Playwright-specs als losse Node-scripts.

## Vaste regels
- Versie **v1.7** (minor: verandert je werkwijze en hoe trades geclassificeerd worden).
- `'M'` is minuten (zoals in de tags: 1M, 5M, 15M). Maand heet `Monthly`.
- Comments in het Engels, UI-tekst in het Nederlands.
- Licht en donker checken (de chips gebruiken bestaande stijlen; geen nieuwe kleuren).

## Waar het op kan stuklopen (review focus)
1. **Gelijke tijdframes** (twee 1H-lagen): de volgorde tussen die twee blijft zoals hij was.
2. **Een trade waarvan de onderste laag geen tijdframe heeft**: `t.timeframe` niet leegmaken.
3. **Een tijdframe op een oude trade dat niet in je tags staat** (bv. `1M`): in het formulier wel
   zichtbaar en geselecteerd, anders verlies je hem bij opslaan.
4. **Playbook-sjablonen** (`PBOOK[x].layers`) en trades in de **prullenbak** gaan ook mee in de
   opruimstap, anders komen ongesorteerde lagen terug.
5. **Import van een oude backup** (`sjFromTj`) zet lagen ook top-down.

---

### Task 1: Sorteren in formulier en bij opslaan, met je eigen tags

**Bestanden:** `work/syncjournal.html` (bij `TFLIST`: helpers; `setLayerTF`, `renderLayers`,
`submitForm`, `savePbook`, `sjFromTj`). Nieuw: `tests/lagen-topdown.spec.js`.

**Levert:** `tfMinuten(tf)`, `sorteerLagen(layers)`, `tfKeuzes()`.

- [ ] **Stap 1: test die faalt** (`tests/lagen-topdown.spec.js`):
  - Pure functies: `sorteerLagen` op `1H, 4H` → `4H, 1H`; `15M, Weekly, 1H, Daily, 12H` →
    `Weekly, Daily, 12H, 1H, 15M`; een laag zonder tijdframe op plek 2 blijft op plek 2; twee
    1H-lagen behouden hun volgorde; `HTF` (onleesbaar) komt bovenaan.
  - Formulier: nieuwe trade, laag 1 = 1H; voeg laag 2 toe en kies 4H → in de DOM staat 4H als laag 1
    en 1H als laag 2. Opslaan → `t.layers` top-down, `t.timeframe === '1H'`.
  - De tijdframe-chips in een laag zijn je tags (`tagConfig.timeframeTags`), hoog → laag: met de
    standaard-tags `Weekly, Daily, 12H, 4H, 2H, 1H, 30M, 15M, 10M, 5M`.
  - Een bestaande trade met laag `1M` (niet in de tags): chip `1M` zichtbaar en geselecteerd.
  - Playbook-editor: zelfde gedrag; opgeslagen `PBOOK[x].layers` top-down.
- [ ] **Stap 2: draaien, zien falen.**
- [ ] **Stap 3: implementatie.** Onder `const TIMEFRAMES=TFLIST;`:

```js
/* Timeframe label → minutes, for top-down order (Weekly > Daily > 12H > 1H > 15M). 'M' is minutes,
   as in the timeframe tags. An unreadable label is Infinity: it sorts to the top and never becomes
   the entry layer (the last layer, see submitForm). Empty → null (no timeframe chosen yet). */
function tfMinuten(tf){const s=String(tf||'').trim().toLowerCase();if(!s)return null;
  const woord={weekly:10080,week:10080,daily:1440,day:1440,monthly:43200,month:43200}[s];if(woord)return woord;
  const m=s.match(/^(\d+)\s*(m|min|h|d|w)$/);if(!m)return Infinity;
  return +m[1]*{m:1,min:1,h:60,d:1440,w:10080}[m[2]];}
const tfHoogEerst=(a,b)=>a===b?0:(a>b?-1:1);
// Layers top-down by timeframe. A layer without a timeframe keeps its slot; equal timeframes keep
// their order (Array.prototype.sort is stable).
function sorteerLagen(layers){const L=[...(layers||[])],plek=[],met=[];
  L.forEach((l,i)=>{if(tfMinuten(l&&l.timeframe)!=null){plek.push(i);met.push(l);}});
  met.sort((a,b)=>tfHoogEerst(tfMinuten(a.timeframe),tfMinuten(b.timeframe)));
  plek.forEach((i,k)=>{L[i]=met[k];});return L;}
// The timeframe chips of a layer: your timeframe tags plus whatever the open trade already uses.
function tfKeuzes(){const s=new Set([...((tagConfig&&tagConfig.timeframeTags)||TFLIST),...formLayers.map(l=>l.timeframe).filter(Boolean)]);
  return [...s].sort((a,b)=>tfHoogEerst(tfMinuten(a),tfMinuten(b)));}
```

  - `setLayerTF`: na het zetten `formLayers=sorteerLagen(formLayers);` dan `renderLayers()`.
  - `renderLayers`: `${TFLIST.map(tfChip)…}` → `${tfKeuzes().map(tfChip)…}`.
  - `submitForm` en `savePbook`: `const layers=sorteerLagen(formLayers.map(…).filter(…));`.
  - `sjFromTj`: `const layers=sorteerLagen((ot.layers||[]).map(…));` (de entry-afleiding eronder
    blijft de laatste laag).
- [ ] **Stap 4: draaien, groen.**

### Task 2: Eenmalige opruimstap (migratie v11)

**Bestanden:** `work/syncjournal.html` (`MIGRATIONS`, `SCHEMA_VERSION`). Test: uitbreiding van
`tests/lagen-topdown.spec.js`; `tests/diagnose.spec.js` leest `SCHEMA_VERSION` al dynamisch.

- [ ] **Stap 1: test die faalt.** Seed `T`, `TRASH` en `PBOOK` met: een trade `1H > 4H`
  (`timeframe:'4H'`, `setup:'X'`), een trade met bias `bearish`/`bullish`, een trade zonder lagen.
  `DB.save('schema',10)`, herladen. Verwacht: lagen top-down, `timeframe:'1H'`, `setup:'X'`
  ongewijzigd, bias `Bearish`/`Bullish`, de trade zonder lagen onaangeroerd; prullenbak en playbook
  ook gesorteerd.
- [ ] **Stap 2: draaien, zien falen.**
- [ ] **Stap 3: implementatie.** `SCHEMA_VERSION=11` en achteraan `MIGRATIONS`:

```js
  /* Layers top-down (Zaratras 13-10-2026): the last layer is the entry layer and sets t.timeframe; a
     4H layer added under a 1H one made the trade a 4H trade. The setup stays as it is: we cannot
     tell whether it was picked or derived. Bias spelling from the old journal ('bearish') joins in. */
  {v:11,note:'Setup-lagen top-down, bias-schrijfwijze gelijk',up(){
    const BIAS={bullish:'Bullish',bearish:'Bearish',neutraal:'Neutraal',neutral:'Neutraal'};
    const fix=layers=>sorteerLagen((layers||[]).map(l=>({...l,bias:BIAS[String(l.bias||'').toLowerCase()]||l.bias||''})));
    [...T,...TRASH].forEach(t=>{if(!t||!Array.isArray(t.layers)||!t.layers.length)return;
      t.layers=fix(t.layers);const tf=(t.layers[t.layers.length-1]||{}).timeframe;if(tf)t.timeframe=tf;});
    Object.values(PBOOK||{}).forEach(pb=>{if(pb&&Array.isArray(pb.layers))pb.layers=fix(pb.layers);});
    persist();persistTrash();persistPbook();
  }},
```

  (Controleer bij het bouwen hoe andere migraties opslaan en of `TRASH`/`PBOOK` op dat moment al
  geladen zijn; volg dat patroon.)
- [ ] **Stap 4: draaien, groen.**

### Task 3: Release v1.7

- [ ] `tests/release-set.js`: `'lagen-topdown'` toevoegen.
- [ ] `APP_VERSION='v1.7'`, `site/version.json` `v1.7` + datum, CHANGELOG `## [v1.7]`:
  **Gewijzigd** — lagen top-down, je eigen tijdframe-tags in het formulier; **Fixed** — een hoger
  tijdframe onderaan maakte je trade een trade op dat tijdframe; oude trades zijn rechtgezet.
- [ ] Licht en donker: screenshot van het lagenblok.
- [ ] `cp work/syncjournal.html site/app.html`, `node scripts/gen-syncjournal-dataset-v2.js`, één
  commit `Release v1.7: …`, `pr-reviewer-nl` over de diff, `node tests/run-release.js` groen,
  `site/` naar `deploy/syncjournal-site/` en daar committen. **Niet pushen** zonder "push".
