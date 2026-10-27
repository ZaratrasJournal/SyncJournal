# TradingPlan v3 — bouwrapport (27-10-2026)

Branch `plan-v3-bouw`. Gebouwd volgens [het bouwplan](plan-v3-bouwplan-2026-10-27.md) (taak 1 t/m 9, met de
herschreven taak 6: nooit automatisch koppelen) en [de spec](plan-v3-ontwerp-2026-10-27.md), besluiten 13–23.
Elke taak heeft een regel in het logboek onderaan het bouwplan. Niets is gereleased: geen versienummer, geen
CHANGELOG, niets naar `site/`.

## Wat er werkt

**Plan-pagina** (`tradingplan/tradingplan.html`, v2 helemaal vervangen, ~108 KB):

- **Vier tabs** Week · Dag · Afsluiting · Log, een tandwiel (stijl Swing/Daytrade/Scalp, risico per grade, drie
  pre-flight-teksten). Het thema volgt de journal (`sj_state.theme`), ook als je het in een ander tabblad wisselt.
- **Lagen met vrije tijdframes** uit `tagConfig.timeframeTags`, altijd top-down. Een nieuw tijdframe (bv. 1M) of
  een nieuwe tag komt ook in de journal. De dag erft de week gedimd, een scenario erft week + dag; geërfde tags
  zijn per scenario uit te zetten. Een weekplan is optioneel.
- **Dag-scherm (Cockpit):** links de trechter Week → Vandaag → Levels → Pre-flight → Mentaal (op 390 px ingeklapt tot
  pre-flight en mentaal), rechts de scenario's gerangschikt op edge met één regel
  `Live n · wr · gem. R | Backtest n · wr · gem. R`, plek en "sterkste". Opengeklapt: trigger, ongeldig-als,
  geërfde tags, afvinklijst met voortgangsbalk, "Klaar om te nemen · 1% risico" (of "C: niet traden"), de
  edge-tabel, stop/TP's, notitie, afbeeldingen en links, gekoppelde trades, status in één tik. Mentaal ≤ 2 →
  "Overweeg alleen A-setups". "Gisteren overnemen" kopieert lagen, levels en de open scenario's.
- **Edge (blok A):** zelfde playbook + richting + alle actieve tags in hun eigen tijdframe-laag; tijdframes die geen
  trade heeft zijn context (één zin per scherm); onder 5 trades eerst de richting los, dan tags vanaf het hoogste
  tijdframe (confirmations eerst). Live en Backtest (+ Paper) apart, gemist apart, R alleen van trades met een
  stop. Getest met exacte getallen op een vaste fixture.
- **Afbeeldingen en links** in week, dag en scenario: plakken (naar het open scenario, anders de dag/week), knop,
  slepen; TradingView-snapshots met voorbeeld (anders een chip); alleen http(s); grenzen 8/8 en 4/4; lightbox;
  plaatjes verkleind in IndexedDB `tp3`.
- **"Zet om in trade":** zelf een of meer trades uit de journal kiezen (kandidaten op pair, richting en dag; twee
  schakelaars; een trade van een ander scenario staat grijs), of "Handmatig, backtest of paper" → het
  journal-formulier opent vooraf ingevuld. Ontkoppelen kan in het scenario; koppelen kan ook later vanuit de
  Afsluiting en de Log.
- **Afsluiting** (dag/week) en **Log** met blok D: uitgekomen/genomen/gemist, binnen tegenover buiten plan in R én
  geld, de voorspel-score (besluit 19), filters met een "niets in beeld"-staat, één les.

**Journal** (`work/syncjournal.html`): leest `tp3:*`; `planSync` spiegelt `Scenario.trades` als `planRef` en vult
eenmalig lege velden (playbook, grade, lagen, screenshots, tvLinks); trade-details tonen "Scenario: …" /
"Koppel aan scenario" / "Bewust buiten plan"; `planPick` met de scenario's van die dag en de dag ervoor. De poort is
weg (incl. "dekt poort-punt" bij playbook-criteria; de data blijft staan). Tendencies → Plan toont blok D, Mori leest
het weekplan, de scenario's van vandaag en het risico per grade. De back-up neemt `tp3:plans`, `tp3:cfg` én de
plaatjes mee en zet ze terug.

**Demo-generator** (`scripts/gen-syncjournal-dataset-v2.js`) maakt nu een v3-plan (25 dagen, scenario's, gekoppelde
trades). `site/demo-dataset.json` is níet ververst; dat hoort bij de release.

## Tests

- Nieuw, allemaal in de release-poort: `plan3-basis` 24, `plan3-lagen` 25, `plan3-edge` 29, `plan3-dag` 39,
  `plan3-media` 35, `plan3-koppeling` 37, `plan3-afsluiting` 28, `plan3-journal` 21, `plan3-doorloop` 20 — alle groen.
  De plan3-specs draaien via een localhost-server (`tests/helpers/plan3.js`).
- Weg (alleen v2): `tradingplan-v2`, `plan-koppeling`, `plan-tendencies`, `plan-doorloop`, `plan-playbook`,
  `tradingplan-plan`. Aangepast: `coach-pretrade`, `demo-dataset`, `diagnose`, `export-import-rondje`,
  `export-overzicht`, `landing`, `tests/helpers/dov-datasets.js`.
- **Release-poort** `node tests/run-release.js --hier`:
  `═══ SyncJournal-suite (release-poort): 164/167 specs groen · 5.4 min ═══`.
  Rood: `matrix`, `analytics-metrics`, `tendencies` — alle drie op "boot zonder fout", omdat de wisselkoers-API
  (`api.frankfurter.dev`) vanuit deze cloud-container niet bereikbaar is. Met alleen dat adres lokaal beantwoord zijn
  ze 21/21, 17/17 en 15/15, en vóór de bouw stonden ze hier al zo rood. Op een machine met internet horen ze groen
  te zijn; draai de poort lokaal om dat te bevestigen. Flaky (2e poging groen): `terugkijken-v12`, `export-sleutels`.

## Wat afwijkt (de `Besluit:`-regels uit het logboek, kort)

1. `Day.week` is altijd de ISO-week; de dag erft alleen als dat weekplan bestaat (ook een later gemaakt weekplan).
2. Een lege pre-flight-tekst in het tandwiel = minder vinkjes.
3. plan3-specs via localhost in plaats van `file://` (op `file://` zag een tweede tabblad de opslag soms niet).
4. Een onleesbaar tijdframe ("abc") wordt geweigerd.
5. "Sterkste" vraagt ook een positieve gem. R.
6. Een open trade telt niet mee in de edge; zonder playbook geen edge.
7. "Gisteren overnemen" pakt de laatste eerdere dag met plan; links gaan mee, plaatjes niet.
8. Zonder confirmations is een scenario nooit "klaar om te nemen".
9. Bedragen in het plan in dollars (de euro-omrekening van de journal zit niet in het plan).
10. Plakken met een open venster doet niets (behalve in tekstvelden); plakken in een tekstveld blijft tekst.
11. Zonder trades met lagen zegt de context "Nog geen trades met lagen in je journal".
12. "Geen scenario" bij een trade = `planRef: "none"` (bewust buiten plan).
13. Koppelen vanaf de trade zet alleen een *open* scenario op genomen.
14. `planSync` na een opslag-signaal alleen in het zichtbare journal-tabblad.
15. Vooraf ingevuld pair volgt je eigen schrijfwijze (laatste trade met die base), anders `<BASE>/USDT`.
16. Stop en TP's zijn vrije tekst; "78150,5" en "75.020,5" worden goed gelezen, "75.020" is 75,02.
17. Binnen/buiten plan telt alleen live, gesloten trades, en "buiten" pas vanaf je eerste plan-dag (in het plan én
    in Tendencies).
18. "De gemiste waren samen +Z R" komt uit gemiste trades die je aan een gemist scenario koppelt; anders staat er dat
    de R nog onbekend is (een scenario heeft geen entry om zelf uit te rekenen).
19. Een weekles zonder weekplan maakt het weekplan aan. Bedragen in de blok-D-zinnen van het plan in hele dollars;
    in de journal in de eigen notatie (`−$ 30,00`).
20. Back-up van de plaatjes via een geheugenkopie (`snapshotPayload` is synchroon).
21. Het Cloudflare-meetscript (alleen actief op syncjournal.nl) staat in `tradingplan/tradingplan.html`, zodat de
    release-kopie naar `site/plan/index.html` een gewone `cp` is.

## Wat ik niet kon testen

- Een echte exchange-sync met koppelen achteraf (geen sleutels); getest met trades zoals de journal ze opslaat.
- Het echte TradingView-voorbeeldplaatje (`s3.tradingview.com`): in de tests nagemaakt, en de fallback (laden
  mislukt → chip) apart getest.
- De gehoste paden (`/plan/` → `/app` en terug): alleen lokaal (`../work/syncjournal.html`). `IS_HOSTED` volgt dezelfde
  regel als de journal.
- Plakken op een echte telefoon (iOS/Android): het plak-event is in Chromium getest; "+ Afbeelding" is de route op
  de telefoon.
- Twee journal-tabbladen tegelijk met een plan-tab: ontworpen (alleen het zichtbare tabblad synct), niet apart getest.

## Bekend, niet opgelost

- Heeft de journal in een ander tabblad de tag-instellingen open en bewaart hij ze daarna, dan kan een tag die je
  net in het plan toevoegde weer weg zijn (de journal schrijft zijn hele `tagConfig`).
- `nextId()` in de journal geeft het hoogste id + 1: wis je de trade met het hoogste id definitief, dan krijgt de
  volgende trade hetzelfde id en hoort hij bij het scenario van de gewiste.
- Een export in de eerste tel na het openen van de journal kan de plan-plaatjes missen (geheugenkopie nog niet geladen).

## Voor de release (door Claude, lokaal)

1. `cp tradingplan/tradingplan.html site/plan/index.html` en `cp work/syncjournal.html site/app.html`.
2. `node scripts/gen-syncjournal-dataset-v2.js` — de nieuwe demo heeft een v3-plan; `demo-dataset` en `plan3-doorloop`
   zijn al getest tegen zo'n bestand (`DEMO_DATASET=<pad>`).
3. Versie: minor (nieuwe functie, raakt werkwijze). Release-poort lokaal, met internet.
4. Screenshots van de doorloop: [docs/plan-v3-bouw-screenshots/](plan-v3-bouw-screenshots/) (licht/donker, 1280/390;
   opnieuw maken met `node tests/plan3-doorloop.spec.js --docs`).

## Concept CHANGELOG-blok

```markdown
## [vX.Y] — 2026-10-xx

### Toegevoegd
- **TradingPlan v3** (syncjournal.nl/plan): een week- en dagplan met scenario's dat je edge uit je eigen journal laat
  zien. Per scenario: Live en Backtest apart (trades, winrate, gem. R, expectancy, profit factor, laatste 10),
  gerangschikt, met "sterkste" vanaf 10 trades.
- Vrije tijdframes per week, dag en scenario; een stijl (Swing, Daytrade, Scalp) bepaalt waarmee je start.
- Afvinklijst per scenario met "Klaar om te nemen" en je risico per grade; pre-flight en mentaal als herinnering.
- Afbeeldingen en TradingView-links plakken in je week, dag of scenario.
- "Zet om in trade": koppel zelf een of meer trades uit je journal, of open het tradeformulier al ingevuld.
- Afsluiting en Log: wat uitkwam, wat je nam en wat je liet liggen, binnen tegenover buiten plan in R en geld, en je
  voorspel-score.

### Gewijzigd
- Tendencies → Plan laat je scenario's tegenover je trades zien in plaats van de poort.
- Mori leest je nieuwe weekplan, je scenario's van vandaag en je risico per grade.
- De back-up neemt je plannen en hun afbeeldingen mee.

### Verwijderd
- De poort van TradingPlan v2 en "dekt poort-punt" bij playbook-criteria. Trades worden niet meer vanzelf aan het
  plan gekoppeld: je kiest zelf.
```
