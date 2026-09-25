# Opdracht: TradingPlan v2 inbouwen, verhuizen naar /plan, en koppelen aan SyncJournal

Vastgelegd 25-09-2026 na een beslisgesprek (Denny + Claude). Dit document is de prompt voor het bouwwerk; de keuzes hieronder zijn genomen en staan niet meer ter discussie tenzij Denny ze zelf opent.

## Context

- **SyncJournal** (`syncjournal.nl`, journal op `/app`): trades uit exchanges (Blofin, OKX, Hyperliquid, Kraken bèta), CSV-import, handmatige trades. Per trade o.a. pair, richting, R/P&L, `setup` (playbook), `layers[]` met setups + confirmaties, sessie, grade, emoties, fouten, tags, TP-niveaus, open-/sluittijd. Opslag: localStorage `sj_*` + IndexedDB.
- **TradingPlan** (nu `tradingplan.syncjournal.nl`, één bestand `tradingplan/tradingplan.html`): playbook, weekplan, dagplan met scenario's, pre-trade poort, log. Opslag: localStorage `tp2:*` + IndexedDB `tp2`.
- **TradingPlan v2** is als demo gebouwd en goedgekeurd: `demos/tradingplan-v2-demo.html` (route-stepper, Vandaag-cockpit, slimmere poort met setup-type, dagafsluiting, bewerkbare checklists, template-export, sneltoetsen, uitleg). Spec: `tests/tradingplan-v2-demo.spec.js`.
- Het obstakel voor koppelen: twee origins → geen gedeelde opslag. Daarom verhuist TradingPlan naar `syncjournal.nl/plan`.

## Besluiten (genomen)

| # | Vraag | Besluit |
|---|---|---|
| 1 | Waar leeft de koppeling? | TradingPlan verhuist naar `syncjournal.nl/plan` (zelfde origin). Blijft een los bestand met eigen menu-item "Plan" in de journal. Opgaan in de journal is de stip op de horizon, niet nu. |
| 2 | Hoe hoort een poort-record bij een journal-trade? | Automatisch: zelfde symbool + richting, journal-trade opent binnen **45 min** ná het poort-record (instelbaar in TradingPlan-instellingen). Vangnet: in de trade-details van de journal een regel "Poort: …" met knop "andere / geen". Handmatige journal-trades matchen op datum + tijd. |
| 3 | Welke inzichten eerst? | **1** uitvoering (vol/half/regelbreuk) → R; **2** setup-type A/B/C → R; **3** welke gemiste poort-check doet pijn; **9** trades zonder poort-record; **4** plan gevolgd (dagafsluiting) → R van die dag. Later: mentaal-score, scenario dat speelde, trades tegen dagbias, confirmaties × checks, weekfocus. |
| 4 | Waar lees je het? | In de journal: Tendencies krijgt een tab **"Plan"**; trade-details tonen de poort-regel; tradelijst krijgt een badge "zonder poort". TradingPlan leest uit de journal alleen de **R per gekoppelde trade** (geen handmatige R-invoer meer nodig) en toont in de dagafsluiting de echte trades van vandaag. |
| 5 | Hoe hard is het advies? | Cijfers altijd met `n=`. Een **observatiezin** (geen bevel) pas bij ≥10 trades per groep, ≥30 totaal en een verschil ≥0,3R. Fase 2 (nu alleen voorbereiden in de datastructuur): een knop die de observatie in het weekplan zet (no-trade-regel of focuspunt). |
| 6 | Back-up | De journal-back-up neemt TradingPlan mee (blok `tradingplan` met plannen, poort-records, afsluitingen, cfg, playbook). TradingPlan houdt zijn eigen export. De match wordt **opgeslagen op de journal-trade** als `planRef` (id van het poort-record); handmatige correctie blijft zo staan en overleeft een back-up. Trades zonder `planRef` worden bij elke sync gematcht. |
| 7 | Volgorde | Stap 1: v2 inbouwen + verhuizen naar `/plan` (één release). Stap 2: koppeling in de journal. Stap 3: Tendencies-tab "Plan". Elk apart testbaar en releasebaar. Standaard poort-regel: *setup-type × checklist*. |
| A | Grade-conflict | Drie regels blijven als instelling bestaan (setup-type × checklist / playbook wint / checklist wint); standaard de eerste. |
| B | Community-opslag | Altijd lokaal per gebruiker. Het gedeelde `window.claude`-db-pad is verwijderd. |

## Harde eisen (gelden voor elke stap)

- **Geen dataverlies.** Bestaande `tp2:*` + IndexedDB `tp2` en alle `sj_*`-data werken na elke stap. Schema-versie op de TradingPlan-data; migratie v1 → v2 draait eenmalig; v1-back-ups blijven importeerbaar.
- **De journal blijft de journal.** Koppel-code komt in duidelijk afgebakende functies (`planMatch*`, `planRef`) en één Tendencies-tab; geen wijzigingen aan sync, adapters, opslag of bestaande statistiek buiten wat hieronder staat.
- Beide apps blijven één zelfstandig HTML-bestand, geen build-stap, geen nieuwe libraries.
- Nederlands, korte zinnen, jargon met hover-uitleg. Huisstijl-tokens, licht + donker, responsive, `prefers-reduced-motion`.
- Nooit automatisch afvinken; de poort blokkeert nooit; eerlijke data gaat voor.
- Release-ritueel zoals altijd: versie-bump, CHANGELOG, mirror naar de deploy-repo, **geen push zonder het woord**.

## Stap 1 — TradingPlan v2 inbouwen en verhuizen naar /plan

1. `cp tradingplan/tradingplan.html tradingplan/tradingplan.backup.html`.
2. Bouw v2 in het echte bestand op basis van de demo, met deze verschillen t.o.v. de demo: opslagsleutels `tp2:*` (niet `tp2demo:`), screenshots weer in IndexedDB `tp2` (niet inline), geen demo-balk, geen seed-data. Nieuwe sleutel `tp2:cfg` (checklists, poort-regel, maxima, matchvenster) en `tp2:meta` (uitleg gezien, schema-versie).
3. Migratie bij eerste start: `trades[].grade` → `exec` (A→vol, B→half, NO→regelbreuk), `setup:""` (onbekend); oud `plan`-tekstveld → scenario 1 (bestond al); `cfg` uit `DEF`. Back-up-export wordt `version:2`; import accepteert v1 en v2.
4. Deploy: bestand naar `site/plan/index.html` (Cloudflare Pages serveert `/plan`); `_headers` `/plan` en `/plan/` op `no-cache`; `robots.txt` `Disallow: /plan`; het oude Pages-project `tradingplan.syncjournal.nl` krijgt een redirect naar `https://syncjournal.nl/plan` (met een korte "we zijn verhuisd"-pagina voor wie het oude adres heeft, plus in TradingPlan zelf een melding: "je data staat nog op het oude adres? Exporteer daar, importeer hier").
5. Journal: menu-item **"Plan"** dat `/plan` opent (één regel in de navigatie; aansluitpunt, vooraf benoemen zoals bij de landing).
6. Tests: `tests/tradingplan-v2.spec.js` (de demo-spec, maar op het echte bestand en met IndexedDB-screenshots), plus: bestaande v1-data in localStorage → na laden v2 alles aanwezig; v1-back-up importeren; leeg starten; licht/donker; mobiel; reduced motion.

## Stap 2 — koppeling in de journal

Datamodel:
- Journal-trade krijgt `planRef` (string, id van het poort-record) of `planRef:"none"` (handmatig losgekoppeld) of ontbreekt (nog niet gematcht).
- Poort-record (TradingPlan) blijft de bron; de journal leest `tp2:trades`, `tp2:plans`, `tp2:cfg` alleen.

Logica (`planMatch`):
- Kandidaten: poort-records met `taken:true`, zelfde symbool (BTC ↔ BTC/USDC via `pairBase`), zelfde richting, `ts` ≤ `openTime` ≤ `ts + venster` (standaard 45 min, uit `tp2:cfg`). Dichtstbijzijnde wint; één poort-record hoort bij maximaal één trade.
- Draait na elke sync en na elke handmatige trade, alleen voor trades zonder `planRef`. Overschrijft nooit een bestaande `planRef`.
- R terug: TradingPlan toont bij een gekoppeld poort-record de R uit de journal (leesbaar, niet bewerkbaar; handmatige R alleen als er geen koppeling is). Dagafsluiting: "Resultaat vandaag" = som van de R van gekoppelde trades van die dag.

UI in de journal:
- Trade-details: regel "Poort · A-setup · 7/7 · volle size · 2%" (of "geen poort-record") met knop "andere / geen" (lijst van poort-records van die dag).
- Tradelijst: badge "zonder poort" op trades zonder match (filterbaar).
- Back-up: blok `tradingplan` in export/import.

Tests: `tests/plan-koppeling.spec.js`: match binnen venster, geen match buiten venster, twee shorts vlak na elkaar → dichtstbijzijnde, handmatige correctie blijft na een sync, `planRef:"none"` wordt niet opnieuw gematcht, R terug in TradingPlan, back-up round-trip.

## Stap 3 — Tendencies-tab "Plan"

Vijf blokken, elk: cijfers per groep (gem. R, winrate, `n=`), drempelmelding "nog te weinig data (x van 30)", en één observatiezin als de drempels gehaald zijn.

1. **Uitvoering**: vol / half / regelbreuk.
2. **Setup-type**: A / B / C / onbekend.
3. **Gemiste checks**: per poort-punt dat open stond bij een genomen trade (alleen halve size + regelbreuk), gem. R — "welk punt kost je geld".
4. **Zonder poort**: aantal en gem. R van trades zonder poort-record, naast trades mét.
5. **Plan gevolgd**: dagen met afsluiting ja / deels / nee → gem. R per dag.

Observatiezin-regels: ≥10 per groep, ≥30 gekoppelde trades totaal, verschil ≥0,3R; formulering als observatie ("kost je −0,4R per trade over 12 trades"), nooit als bevel. Fase 2 (later): knop "zet als no-trade-regel / focuspunt" → schrijft naar het weekplan van volgende week.

Tests: `tests/plan-tendencies.spec.js` met een fixture van 40 gekoppelde trades: alle vijf blokken, drempels (29 vs 30 trades), verschil net onder/boven 0,3R, lege staat.

## Klaar als

- `syncjournal.nl/plan` draait TradingPlan v2 met alle bestaande data; het oude adres stuurt door.
- Een journal-trade toont zijn poort-record; een verkeerde match is met één klik te corrigeren en blijft staan.
- TradingPlan hoeft geen R meer te vragen voor gekoppelde trades.
- Tendencies → Plan toont de vijf inzichten met `n=`, en zegt eerlijk "te weinig data" tot 30 trades.
- Eén journal-back-up herstelt alles, inclusief de koppelingen.
- Suite groen; geen bestaande functie of data verloren; niets gepusht zonder "push".
