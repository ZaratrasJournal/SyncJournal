# TradingPlan v3 — bouwplan

> **Voor de bouw-agent:** werk taak voor taak, test eerst (superpowers:test-driven-development), commit en
> push na elke taak naar je eigen branch `plan-v3-bouw`. Houd onderaan dit bestand een logboek bij
> (`## Logboek`): per taak één regel "klaar", met de testopdracht en de uitkomst, en elke afwijking van dit
> plan als `Besluit: <wat> — <waarom> — <wat het kost als het fout is>`.

> **Wijziging 27-10-2026, 13:45:** taak 6 is herschreven: niets wordt automatisch gekoppeld, de gebruiker
> kiest de trade(s) zelf (spec besluit 23). Heb je dit plan eerder gelezen, lees taak 6 en het datamodel
> (`Scenario.trades`) opnieuw voordat je eraan begint.

**Doel:** TradingPlan v2 vervangen door v3: een week- en dagplan met scenario's dat je edge uit je eigen
journal laat zien, in de Cockpit-vorm, met vrije tijdframes, plakbare afbeeldingen en TradingView-links, en
een knop "Zet om in trade".

**Architectuur:** de plan-pagina blijft één los HTML-bestand met vanilla JS, op dezelfde origin als de
journal. Het plan leest de journal-opslag (IndexedDB `sj_db`, store `kv`, sleutels `trades` en `pbook`;
localStorage `sj_tagconfig` en `sj_state`) en schrijft eigen sleutels `tp3:*`. De journal leest `tp3:*` voor
de koppeling, de Tendencies-tab, Mori en de back-up.

**Spec:** [docs/plan-v3-ontwerp-2026-10-27.md](plan-v3-ontwerp-2026-10-27.md). **Besluiten 13–22 gaan voor**
wat erboven staat. Achtergrond: [prototype-rapport](plan-v3-prototype-rapport.md),
[onderzoek](plan-v3-onderzoek-2026-10-27.md). Lees `CLAUDE.md` in de repo-root helemaal.

**Vertrekpunt voor de code:** [demos/plan-v3-demo.html](../demos/plan-v3-demo.html), variant B. Neem de
edge-berekening, de chip-lagen en de opmaak daaruit over. De varianten A en C, de themaknop, de nagemaakte
gemist- en Log-data en de `?v=`-parameter gaan eruit.

## Bestanden

| Bestand | Rol |
|---|---|
| `tradingplan/tradingplan.html` | **De plan-pagina, hier bouw je.** v2 wordt helemaal vervangen (git-historie is de back-up). |
| `site/plan/index.html` | Release-kopie. **Niet aanraken**: dat gebeurt bij de release. |
| `work/syncjournal.html` | Journal-kant: koppeling, formulier vooraf invullen, Tendencies, Mori, back-up, poort-code weg. |
| `tests/plan3-*.spec.js` | Nieuwe specs. Losse Node-specs in de stijl van `tests/plan-koppeling.spec.js`. |
| `tests/release-set.js` | v2-specs eruit, v3-specs erin. |

## Vaste regels (gelden voor elke taak)

- **Geen versienummer, geen CHANGELOG, geen release, geen kopie naar `site/`.** Alleen pushen naar
  `plan-v3-bouw`, nooit naar `main` of `work`, en nooit naar de deploy-repo.
- Teksten in het Nederlands, code-comments en commits in het Engels. Engelse tradingtermen (leverage,
  setup, confirmation). In alles wat leden zien heet de maker "Zaratras", nooit "Denny".
- Kleuren alleen via tokens, nooit vaste `#fff`/`rgba(255,…)`. Licht én donker testen.
- R alleen van trades mét stop: `tradeROrNull` / `gemR`-logica, `0` is niet "onbekend" (CLAUDE.md).
- Elke lijst of elk paneel heeft een lege staat die zegt wat er ontbreekt en wat de volgende stap is,
  plus de staat "niets in beeld" (wel data, filter laat niets over).
- Alles wat je uit opslag of van een link toont gaat door `esc()`. Links alleen `http:`/`https:`
  (`isHttpUrl` uit de journal). Afbeeldingen alleen `image/*`, en alleen als `data:image/…`-URL tonen.
- Telefoonbreedte (390 px): geen horizontale scroll, de trechter klapt in.
- Bestaande helper in de journal? Hergebruik hem. Kopieer in het plan alleen wat je nodig hebt, met een
  comment waar het vandaan komt.

## Datamodel (vast — de journal en het plan delen het)

localStorage `tp3:plans`:
```
{ v: 1,
  weeks: { "2026-W44": Week },
  days:  { "2026-10-27": Day } }

Layer    = { tf: "4H", bias: "" | "Bullish" | "Bearish" | "Neutraal", setups: [str], confirmations: [str] }
Media    = { imgs: [imgId], links: [url] }
Week     = { id, layers: [Layer], levels: str, noTrade: str, focus: str, media: Media, les: str }
Day      = { id, week: weekId | null, layers: [Layer], levels: str, mental: 1..5 | null,
             pre: [bool, bool, bool], media: Media, les: str, scenarios: [Scenario] }
Scenario = { id: "s_" + base36 tijd, title, pair: "BTC", dir: "long" | "short", pb: playbooknaam | "",
             grade: "A" | "B" | "C", trigger, invalid, entry: Layer, off: ["<tf>|<tag>"],
             checked: [confirmation], stop: str, tps: [str], media: Media, note: str,
             status: "open" | "genomen" | "gemist" | "niet" | "ongeldig", statusTs: ms | null,
             trades: [journal-trade-id] }
```
- `gemist` = uitgekomen, niet genomen. `niet` = niet uitgekomen. `off` = geërfde tags die dit scenario
  uitzet. Week-id is de ISO-week (`coachIsoWeek` in de journal), dag-id de Amsterdamse kalenderdag.
- localStorage `tp3:cfg`: `{ stijl: "swing" | "daytrade" | "scalp", risk: {A:1, B:0.5, C:0}, pre: [3 teksten] }`.
- localStorage `tp3:handoff`: `{ sid, day, ts }` — kortstondig, zie taak 6.
- IndexedDB `tp3`, store `img`, sleutel = imgId (`"i_" + base36 tijd + random`), waarde = `data:image/jpeg`-URL.
- Welke trades bij een scenario horen staat in `Scenario.trades` (de bron). Op de journal-trade zet de
  journal `planRef = "s:" + scenario-id` als spiegel. Oude numerieke `planRef`'s (v2-poort) worden
  genegeerd. **`tp2:*` wordt niet meer gelezen en niet gewist.** Er wordt nooit automatisch gekoppeld
  (taak 6).

## Review-focus (wat de taken hieronder expliciet testen)

1. Een journal zonder trades, zonder playbooks of zonder `tagConfig` (nieuw lid): het plan werkt, met
   lege staten, en gooit geen fout.
2. Een tijdframe dat geen enkele trade als laag heeft (Weekly, of 1M bij een swingtrader): telt niet mee,
   en de context zegt dat één keer.
3. Precies 4 trades na alle weggevallen tags, of 0: de juiste melding, geen deling door nul, geen NaN.
4. Een geplakte link met `javascript:` of een `<script>` in de tekst: geweigerd of ge-escaped.
5. Een dag met meerdere trades op hetzelfde pair en dezelfde richting: niets wordt vanzelf gekoppeld; de
   gebruiker kiest, en een trade kan nooit bij twee scenario's tegelijk horen.

---

### Taak 1: Basis — opslag, thema, tabs, tandwiel

**Bestanden:** `tradingplan/tradingplan.html` (helemaal nieuw), `tests/plan3-basis.spec.js`

**Levert:** `window.__tp3 = { load(), save(), cfg(), stijlLagen(stijl), dayOf(id), weekOf(id) }` voor tests
en latere taken.

- [ ] Test eerst: (a) lege opslag → 4 tabs Week · Dag · Afsluiting · Log, Dag actief, lege staat "Nog geen
  plan voor vandaag" met knop; (b) `sj_state` met `theme:"dark"` → `data-theme="dark"` op `<html>`, en
  wisselt mee als de journal in een ander tabblad het thema wijzigt (`storage`-event); (c) een nieuwe dag
  met stijl `scalp` start met lagen 1H · 15M, met stijl `daytrade` met 4H · 1H; (d) een dag zonder weekplan
  is te maken en te bewaren; (e) het tandwiel bewaart risico per grade, de 3 pre-flight-teksten en de stijl.
- [ ] Bouw het. Stijl-tabel uit besluit 14. Geen eigen themaknop.
- [ ] Draai de spec en lees de screenshots (licht en donker, 1280 en 390). Commit, push.

### Taak 2: Lagen met vrije tijdframes, tags uit de journal

**Bestanden:** `tradingplan/tradingplan.html`, `tests/plan3-lagen.spec.js`

**Levert:** `laagRij(Layer[], {erft})` (de chip-rij), `voegTijdframeToe(tf)`, `voegTagToe(cat, tag)`.

- [ ] Test eerst: (a) de tijdframe-keuze toont `tagConfig.timeframeTags`; een laag toevoegen en weghalen kan
  met één tik; lagen staan altijd top-down (gebruik de logica van `tfMinuten`/`sorteerLagen`); (b) `1M`
  toevoegen zet hem ook in `sj_tagconfig.timeframeTags` en in de journal blijft hij na herladen staan;
  (c) een nieuwe setup- of confirmation-tag komt ook in de journal-taglijst; (d) de dag erft de week-lagen
  gedimd, en een scenario erft dag + week gedimd; een gedimde chip uitzetten zet `"<tf>|<tag>"` in `off`.
- [ ] Bouw het. Geen vrije tekst-tags. Week, dag en scenario-entry gebruiken dezelfde component.
- [ ] Draai, lees screenshots, commit, push.

### Taak 3: Edge per scenario (blok A)

**Bestanden:** `tradingplan/tradingplan.html`, `tests/plan3-edge.spec.js` (met een vaste fixture in
`tests/fixtures/plan3-trades.json`: ~60 trades met lagen, stops, Live/Backtest/Paper/Gemist, long en short)

**Levert:** `edge(scenario, day, week, trades) → { basis: "live"|"backtest", live: Stat, bt: Stat,
gemist: { n, somR }, zonder: [label], richtingLos: bool, meetellend: [tf], context: [tf] }` met
`Stat = { n, wr, gemR, expGeld, pf, laatste10: [true|false|null], betr: "weinig"|"redelijk"|"genoeg" }`,
en `rangschik(scenarios) → [{ id, plek, sterkste: bool }]`.

- [ ] Test eerst, met exacte getallen uit de fixture:
  - matching: zelfde playbook + richting + álle actieve tags, elke tag in de laag met hetzelfde tijdframe;
  - een tijdframe zonder enige trade-laag in de journal komt in `context`, niet in de matching;
  - onder 5 trades valt eerst de richting weg (`richtingLos`), dan tags vanaf het hoogste tijdframe, binnen
    een tijdframe eerst confirmations; `zonder` noemt ze in die volgorde;
  - Live en Backtest apart, Paper telt bij Backtest, Gemist alleen in `gemist`;
  - `gemR` alleen over trades mét stop; een trade zonder stop telt wel mee in n en winrate;
  - 0 trades → "Nog geen trades met deze combinatie"; precies één trade → geen NaN;
  - basis = Live bij ≥ 10 Live-trades, anders Backtest; `sterkste` alleen bij ≥ 10 op de basis;
  - betrouwbaarheid < 10 / 10–29 / ≥ 30.
- [ ] Bouw het: de rekenkern als losse functies, los van de weergave, zodat de spec ze direct aanroept.
- [ ] Commit, push.

### Taak 4: Dag-scherm Cockpit en Week-scherm

**Bestanden:** `tradingplan/tradingplan.html`, `tests/plan3-dag.spec.js`

- [ ] Test eerst: (a) links de trechter week → dag → levels → pre-flight → mentaal, rechts de gerangschikte
  scenario's, één regel per scenario met `Live n · wr · gemR | Backtest n · wr · gemR`, plek en "sterkste";
  (b) tik → klapt open met trigger, ongeldig-als, geërfde tags, confirmations als afvinklijst met
  voortgangsbalk, de edge-tabel, stop/TP's en notitie; alle confirmations af → groen "Klaar om te nemen ·
  1% risico" (uit `cfg.risk` voor die grade; grade C met 0% → "C: niet traden"); (c) status met één tik,
  `statusTs` gezet; (d) mentaal ≤ 2 → "Overweeg alleen A-setups" bovenaan; pre-flight blokkeert niets;
  (e) scenario toevoegen, bewerken, verwijderen; een playbook kiezen vult entry-laag en grade uit het
  journal-playbook; (f) op 390 px is de trechter ingeklapt tot pre-flight en mentaal; (g) "Gisteren
  overnemen" kopieert lagen, levels en de nog open scenario's van de vorige dag (status terug op open).
- [ ] Week-scherm: lagen, levels, één regel no-trade/nieuws, één regel focus. Optioneel: zonder weekplan
  werkt de dag gewoon.
- [ ] Bouw, draai, lees screenshots in beide thema's en beide breedtes, commit, push.

### Taak 5: Afbeeldingen en links

**Bestanden:** `tradingplan/tradingplan.html`, `tests/plan3-media.spec.js`

**Levert:** `mediaBlok(Media, {max})`, `voegBeeldToe(File, doel)`, `voegLinkToe(url, doel)`,
`tvSnapshot(url) → plaatje-URL | null`.

- [ ] Test eerst: (a) een plak-event met een afbeelding op het Dag-scherm komt bij het openstaande scenario,
  zonder open scenario bij de dag; hetzelfde op het Week-scherm; (b) "+ Afbeelding" en slepen werken ook;
  (c) een geplakte `https://www.tradingview.com/x/AbC123/` wordt een link met voorbeeldplaatje
  `https://s3.tradingview.com/snapshots/a/AbC123.png`; faalt het laden, dan blijft een chip met
  `tradingview.com/x/AbC123/`; (d) `javascript:alert(1)` en tekst zonder `http(s)` worden geweigerd met
  een melding; (e) de 9e afbeelding of link op een dag, of de 5e op een scenario, wordt geweigerd met
  "Hooguit 8 …" / "Hooguit 4 …"; (f) klik → lightbox; weghalen werkt en wist het plaatje uit IndexedDB;
  (g) na herladen staat alles er nog.
- [ ] Bouw het. Verkleinen zoals `compressImg` in de journal (1400×1000, JPEG 0,82). Plaatjes in IndexedDB
  `tp3`, in het plan alleen de id's.
- [ ] Commit, push.

### Taak 6: Zet om in trade, en de koppeling in de journal

**Bestanden:** `tradingplan/tradingplan.html`, `work/syncjournal.html`, `tests/plan3-koppeling.spec.js`

> **Gewijzigd 27-10-2026, 13:45 (Zaratras, besluit 23 in de spec): er wordt NIETS automatisch
> gekoppeld.** Wie aan het eind van de dag of de volgende dag klikt, heeft vaak meerdere trades; dan kiest
> hij zelf welke trade(s) bij het scenario horen. De oude `planMatch` (automatisch op pair + richting +
> tijdvenster) verdwijnt helemaal.

**Bron van waarheid:** `Scenario.trades: [tradeId]` in `tp3:plans` (zie datamodel). Een trade hoort bij
hooguit één scenario; een scenario mag meerdere trades hebben (bijbijkopen, herinstap). Op de trade zet de
journal `planRef = "s:<scenario-id>"` als spiegel, alleen door de journal geschreven.

**Levert (journal):** `planLoad()` leest nu `tp3:*` en geeft `{ plans, cfg }`; `planScen(sid) → {s, day,
week} | null`; `planSync()` (bij laden en bij een `storage`-event op `tp3:plans`: zet/wist `planRef` volgens
`Scenario.trades`, en vult bij een nieuwe koppeling eenmalig de lege velden via `planAdopt`);
`planAdopt(t, s, day, week)`; `planPick(tradeId)` met de scenario's; `planVanHandoff()`.

- [ ] Test eerst (journal en plan in één browsercontext, zoals `tests/plan-koppeling.spec.js`):
  - **"Zet om in trade" opent een keuze met twee wegen:**
    1. **"Koppel aan een trade uit je journal"** (voor API-trades). Een lijst met kandidaten uit de
       journal-trades: standaard alleen hetzelfde pair en dezelfde richting, geopend op de dag van het
       scenario (Amsterdamse tijd), nieuwste boven, met tijd, pair, richting, resultaat in R en geld.
       Schakelaars: "alle pairs en richtingen van die dag" en "ook de dag erna". Je vinkt **één of meer**
       trades aan en bevestigt. Een trade die al bij een ander scenario hoort staat grijs met "hoort bij
       <titel>" en is niet aan te vinken. Na bevestigen: `Scenario.trades` bijgewerkt, status `genomen`,
       en de journal neemt playbook, grade, lagen, afbeeldingen (`screenshots`) en links (`tvLinks`) over,
       **alleen velden die nog leeg zijn**. Geen dubbele trade.
       **Geen kandidaten:** "Nog geen passende trade. Sync eerst in de journal, of koppel later vanuit de
       Afsluiting of de Log." met een knop "Markeer als genomen, koppel later".
    2. **"Handmatig, backtest of paper"** → plan schrijft `tp3:handoff` en opent de journal (`/app` als
       hosted, anders `../work/syncjournal.html`). De journal opent het formulier met pair, richting,
       playbook, grade, stop, TP's, de lagen (week + dag + entry, zelfde tijdframe samengevoegd, alleen
       afgevinkte confirmations, uitgezette geërfde tags niet), de afbeeldingen van het scenario als
       screenshots en de links als `tvLinks`. Opslaan voegt de nieuwe trade toe aan `Scenario.trades` en
       zet het scenario op `genomen`. Een handoff ouder dan 10 minuten wordt genegeerd en gewist.
  - **Geen automatische koppeling:** een trade met hetzelfde pair en dezelfde richting op die dag blijft
    los zolang je hem niet kiest. Ook een open scenario wordt niet vanzelf `genomen`.
  - **Ontkoppelen:** in het opengeklapte scenario staan de gekoppelde trades met een ×; weghalen haalt
    hem uit `Scenario.trades`, en de journal wist `planRef` (de overgenomen velden blijven staan).
  - **Vanaf de trade-kant:** in de trade-details staat "Koppel aan scenario" / "Scenario: <titel>
    (wijzig)". `planPick` toont de scenario's van die dag (en de dag ervoor), plus "Geen scenario".
  - Koppelen kan ook later: vanuit de Afsluiting en de Log, met dezelfde kandidatenlijst.
- [ ] Bouw het. Hergebruik wat bruikbaar is van `planAdopt`/`planPick`/`planSetRef`
  ([work/syncjournal.html](../work/syncjournal.html), zoek `PLAN_LS`); `planMatch` en zijn aanroep bij het
  laden gaan weg.
- [ ] Commit, push.

### Taak 7: Afsluiting, Log en blok D

**Bestanden:** `tradingplan/tradingplan.html`, `tests/plan3-afsluiting.spec.js`

- [ ] Test eerst: (a) Afsluiting opent op vandaag als er een plan is, anders op de laatste dag met plan;
  open scenario's sluit je daar af met één tik; één veld "les"; (b) uitgekomen / genomen / gemist, en
  binnen tegenover buiten plan in R én in geld ("Buiten plan kostte je deze maand −3,6R (−$420)"), uit de
  journal-trades van die dag of week via `planRef`; (c) Log: alle dagen, nieuwste boven, scenario's als
  gekleurde status-chips, achteraf aan te tikken; filters status, playbook, richting; "niets in beeld" als
  het filter niets overlaat; (d) voorspel-score bovenaan volgens besluit 19, met exacte getallen uit een
  fixture: "Je scenario's komen in X% uit. Daarvan neem je Y%. De gemiste waren samen +Z R."
- [ ] Bouw, draai, lees screenshots, commit, push.

### Taak 8: Journal opruimen — poort weg, Tendencies, Mori, back-up

**Bestanden:** `work/syncjournal.html`, `tests/plan3-journal.spec.js`, `tests/release-set.js`, oude specs

- [ ] Test eerst: (a) Tendencies → "Plan" toont blok D op scenario's (binnen/buiten plan, voorspel-score),
  met een lege staat zonder plannen; (b) `coachPlanRegels` leest het weekplan uit `tp3:plans` (focus,
  no-trade); (c) export bevat `tradingplan` met `tp3:plans`, `tp3:cfg` en de plaatjes; importeren zet ze
  terug, ook de plaatjes in IndexedDB `tp3`; het export-overzicht telt "N plannen · M scenario's · K
  afbeeldingen"; (d) geen poort-tekst meer in de trade-details; het veld "dekt poort-punt" bij
  playbook-criteria is weg (de data mag blijven staan).
- [ ] Haal weg: poort-records, `planPtOpties`/`PLAN_PT_STD`, `planExec`, de poort-uitleg in `planLine`.
  Controleer elke aanroeper met grep.
- [ ] Vervang de v2-specs in `tests/release-set.js` (`tradingplan-v2`, `plan-koppeling`, `plan-tendencies`,
  `plan-doorloop`, `plan-playbook`, `tradingplan-plan`) door de `plan3-*`-specs. Verwijder v2-specs die
  alleen v2 testen; pas specs aan die iets anders testen en alleen de plan-sleutels raken.
- [ ] Draai de hele release-poort: `node tests/run-release.js --hier`. **Alles groen.** Plak de
  eindregel in het logboek.
- [ ] Commit, push.

### Taak 9: Eindcontrole

- [ ] Doorloop met de demo-dataset (`site/demo-dataset.json` in de journal geladen): maak een week, twee
  dagen (één met stijl Scalp), vijf scenario's, plak een plaatje en een TradingView-link, zet er één om in
  trade, sluit de dag af. Screenshots van elk scherm, licht en donker, 1280 en 390, in
  `docs/plan-v3-bouw-screenshots/`.
- [ ] Schrijf `docs/plan-v3-bouw-rapport.md` (Nederlands, kort): wat er werkt, wat afwijkt (de
  `Besluit:`-regels), wat je niet kon testen, en een concept voor het CHANGELOG-blok.
- [ ] Commit, push. Klaar.

## Logboek
