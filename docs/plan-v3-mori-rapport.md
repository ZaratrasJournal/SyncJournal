# TradingPlan v3 — Mori in het plan en de FAQ, rapport (27-10-2026)

Branch `plan-v3-mori` (vanaf de polish-ronde). Twee delen, elk met een eigen commit en een logboek met
`Besluit:`-regels onderaan [de opdracht](plan-v3-mori-2026-10-27.md). Niets is gereleased: geen versienummer, geen
CHANGELOG, niets naar `site/`.

| Deel | Commit | Spec |
|---|---|---|
| 1. Mori in het plan (+ scenario zonder titel) | `04f5661` | `tests/plan3-mori.spec.js` 54/54 (nieuw, in de release-poort) |
| 2. FAQ bijgewerkt | `5de32bf` | `tests/faq-volledig.spec.js` 28/28, `tests/faq.spec.js` 84/84 |
| Poort-fix (bestaande race in het plan) | `40d006c` | `plan3-koppeling` 12/12 onder last |

## Deel 1 — Mori in het plan

Het plan heeft **geen eigen Mori**. Een knop zet de overdracht `tp3:mori` en opent de journal in hetzelfde tabblad;
de journal stelt de vraag met haar eigen sleutel, pakket, tools, verbruik en veiligheidsregels.

**In het plan** (`tradingplan/tradingplan.html`)
- Opengeklapt scenario: **🤖 Vraag Mori** tussen "Zet om in trade" en "Bewerk".
- Kop van Dag: **🤖 Vraag Mori over mijn dagplan**, naast de week-focus. Zonder scenario's uit, met de zichtbare regel
  "Voeg eerst een scenario toe" (ook als `title` en `aria-describedby`).
- Zichtbaar alleen als Mori aan staat (`sj_ai_prefs.enabled`, standaard aan) **en** er een sleutel is. Anders een kleine
  link **Mori instellen** naar `journal?page=ai` (daar staat de volgende stap: sleutel koppelen of Mori inschakelen).
- Het plan kijkt alleen óf er een sleutel is, met `'sj_ai_key' in sessionStorage/localStorage`: het roept nooit
  `getItem` op de sleutel aan (de spec telt elke `getItem`). De sleutel komt nooit in `tp3:*`.
- `tp3:mori = { soort: 'scenario' | 'dag', sid?, day, ts, edge }`. `edge` zijn de cijfers die het plan toont, per
  scenario (zie Besluiten).

**In de journal** (`work/syncjournal.html`)
- `planMoriVanOverdracht()` bij het starten (naast `planVanHandoff`): leest en wist `tp3:mori`; ouder dan 10 minuten,
  kapotte JSON of een onbekende soort → niets; scenario of dag verdwenen → melding in Mori, niets verstuurd; Mori uit
  of geen sleutel → Mori opent en zegt zelf wat er ontbreekt.
- Vraag: "Check mijn scenario: <titel> — <PAIR> <richting>, <playbook>" of "Review mijn dagplan van <datum>".
- Pakket (`coachPakket`, `deel: 'plan-scenario' | 'plan-dag'`):
  - **scenario** (`coachScenarioDeel` + het bestaande pre-trade-deel): titel, pair, richting, playbook, grade, status,
    trigger, ongeldig als, alle actieve lagen per tijdframe (week + dag + entry, uitgezette tags niet), confirmations
    en criteria afgevinkt/open, stop, TP's, notitie, de edge-regel van het plan; daarna als trade-idee met
    **"entry nog niet bekend"** (geen R:R, geen fout), de cijfers van de setup, het symbool en de richting, de
    playbook-regels en de regels uit TradingPlan (week- en dag-bias, levels, mentaal, risico per grade).
  - **dagplan** (`coachDagplanDeel`): week (lagen, levels, no-trade, focus), dag (lagen, levels, mentaal, pre-flight),
    elk scenario op de volgorde van het plan met de edge-regel en "sterkste", de journal-cijfers per playbook en het
    risico per grade.
- Opdrachten in `AI_PLAN_KNOPPEN`: scenario = `AI_PRETRADE_OPDRACHT` + "Vergelijk het scenario … week- of dagbias";
  dagplan = de tekst uit de opdracht. Geen eigen knoppen in de journal.
- `coachIdeeCijfers(i, {entryOptioneel})`: alleen voor een scenario mag de entry ontbreken. Het gewone formulier
  "Check mijn trade-idee" eist nog steeds entry en stop (`coach-pretrade` 23/23).
- `coachPlanRegels(dir, dagId)` toont nu ook lagen en levels van de dag (geldt ook voor het gewone pre-trade-pakket).
- Na het antwoord (en bij de meldingen) staat **← Terug naar je plan** (`/plan/`, lokaal `../tradingplan/tradingplan.html`).
- Bedragen volgen `AIPREFS.hideAmounts` / privacy-modus; de edge-regel heeft nooit bedragen. "Wat is er verstuurd?"
  toont het pakket.

**Klein: scenario zonder titel.** `titel()` in het plan en `planTitel()` in de journal: zonder titel, of met het id als
titel, "<PAIR> <playbook>" (anders alleen het pair, anders "Scenario"). Overal waar de titel staat: Cockpit, Log-chips,
koppelvenster (ook "bij …"), Afsluiting, statusknoppen, verwijder-vraag, `planLine`, `planPick`, de toast bij koppelen,
`coachPlanRegels` en het Mori-pakket. De `s_zc` uit de polish-screenshot kwam uit de spec (`plan3-dag` zaaide
`title: id`); die vorm wordt nu ook opgevangen.

## Deel 2 — FAQ

Zie [faq-audit-2026-10-27.md](faq-audit-2026-10-27.md) voor het oordeel en het bewijs per vraag.
- Nieuwe categorie **🗓️ Je trading plan** (10 vragen) direct na "✍️ Trades bijhouden", met `FAQ_DESC`.
- "Wat is de Plan-pagina?" weg: die zei nog dat de journal zelf koppelt.
- Bijgewerkt: volgorde van leren, back-up, overzetten, Live/Paper/Backtest/Gemist (Geen exchange → Backtest, knop
  Backtest-trade), de Mori-vragen (scenario-variant, wat er meegaat) en de naam van de schakelaar "Mori ingeschakeld".
- `FAQ_POPULAR`: "Wat is het Trading Plan?" in plaats van "Wat betekent R-multiple"; `FAQ_SUGGEST` + `scenario`.

## Besluiten

Uit het logboek (met waarom en wat het kost staan ze daar volledig):

1. De edge gaat als cijfers mee in `tp3:mori.edge` — de journal kent de rekenregel van het plan niet, en een kopie kan
   gaan afwijken van wat het plan toont. Had het plan de journal nog niet geladen: "niet meegegeven".
2. Sleutel-controle met de `in`-test, nooit `getItem`.
3. "Mori instellen" gaat naar Mori (`?page=ai`), niet naar Instellingen.
4. Zonder sleutel of met Mori uit: Mori openen, niets versturen. Zonder gesloten trades: de bestaande lege staat.
5. Een mislukte vraag uit het plan gaat, zoals bij de vaste knoppen, als tekst terug in het invoerveld (dan zonder het
   scenario-pakket); opnieuw vanuit het plan geeft het volledige pakket.
6. De rang in het dagplan-pakket is de volgorde van het plan, met uitleg waarop die gaat.
7. `coachPlanRegels` toont ook de lagen en levels van de dag (een paar regels meer in het pre-trade-pakket).
8. Titel-terugval ook bij titel = id.
9. Plaats en naam van de knoppen (zie boven).
10. `save(p)` (alleen specs) leest het plan na opslaan normaal in; de spec wacht op IndexedDB bij trade 108.
11. FAQ: plan-vraag populair in plaats van R-multiple; `scenario` als zesde suggestie; "Mori ingeschakeld" verbeterd;
    de spec controleert de knopnamen tegen de broncode (lijst van 32).

## Screenshots

[`docs/plan-v3-mori-screenshots/`](plan-v3-mori-screenshots/), licht en donker, 1280 en 390:
- `mori-dag-*` — Dag met de dag-knop in de kop en "🤖 Vraag Mori" in het opengeklapte scenario (plus een scenario
  zonder titel: "ETH London SFP").
- `mori-instellen-*` — zonder sleutel: "Mori instellen" in de kop en bij het scenario.
- `mori-antwoord-*` — de journal na een scenario-vraag: vraag, antwoord, "Wat is er verstuurd?", "← Terug naar je plan".
- `faq-plan-*` — de FAQ met de nieuwe categorie open.

Zoals in de vorige rondes blokkeren de tests alles buiten localhost, ook Google Fonts: de letters op de screenshots
zijn het systeemlettertype van de container.

## Wat ik niet kon testen

- **Een echte aanroep naar Anthropic.** Alles draait tegen de nep-Anthropic uit `tests/helpers/coach-nep.js`
  (nieuw: `vooraf(ctx, …)`, zodat de nep er al is als de journal bij het starten verstuurt). Of het echte model zich
  aan de opdrachten houdt (geen advies, bias benoemen, één punt voor vandaag) is niet getest.
- **De gehoste route** `syncjournal.nl/plan` → `/app` → `/plan/`. Getest is de lokale variant
  (`../work/syncjournal.html` en `../tradingplan/tradingplan.html` op één localhost-origin). De gehoste adressen
  zijn dezelfde als die "Zet om in trade" en het menu al gebruiken (`JOURNAL_URL`, `go('plan')`).
- **Een sleutel "alleen voor deze sessie" over een echte tabbladwissel** is getest binnen één tabblad (plan → journal in
  hetzelfde tabblad, sessionStorage blijft); in een nieuw tabblad is hij er per definitie niet (dan "Mori instellen").
- Smaak: of de knoppen op de juiste plek voelen is Zaratras' oordeel.

## Release-poort

`node tests/run-release.js --hier` op commit `40d006c`:
**`═══ SyncJournal-suite (release-poort): 165/168 specs groen · 6.1 min ═══`** — gefaald: `analytics-metrics`, `matrix`,
`tendencies`. Alle drie alleen op "boot zonder fout" en "geen JS-errors", met als enige fout
`net::ERR_TUNNEL_CONNECTION_FAILED`: de journal haalt bij het starten de wisselkoers op bij `api.frankfurter.dev`
(`FX_URL`), en dat adres is vanuit deze container niet bereikbaar (`curl https://api.frankfurter.dev/v1/latest` →
`CONNECT tunnel failed, response 403`). Precies dezelfde drie, op dezelfde twee checks, als in de polish- en de
bouwronde; geen van de drie raakt het plan, Mori of de FAQ. Op een machine met internet horen ze groen te zijn.

**Eerste ronde (`5de32bf`): 164/168**, met daarnaast `plan3-koppeling` 44/45 ("geen JS-errors":
`TypeError: Cannot read properties of undefined (reading 'filter')`). Met 6 runs tegelijk gereproduceerd (1 op 12),
stack `snoeiCriteria` ← `laadJournal` in het plan. Oorzaak uit de polish-ronde: `__tp3.save(P)` (alleen de specs)
zette een niet-genormaliseerd plan in `PL`. Gefixt in `40d006c` (`save(p)` leest daarna normaal in; plus een wacht op
IndexedDB in de spec bij trade 108, een tweede race die de stresstest vond). Daarna 12 van 12 groen met 6 tegelijk, en
de poort hierboven.

## Concept CHANGELOG-blok (het versienummer kiest Claude bij de release)

```markdown
## [vX.Y] — 2026-10-xx

### Toegevoegd
- **Vraag Mori vanuit je Trading Plan.** In een scenario staat 🤖 Vraag Mori: Mori vergelijkt het scenario met je eigen
  cijfers en regels, en zegt waar het tegen je week- of dagbias ingaat. Een entry is nog niet nodig.
- Bovenaan Dag staat 🤖 Vraag Mori over mijn dagplan: welke scenario's volgens je cijfers het sterkst en het zwakst zijn,
  waar je plan zichzelf tegenspreekt en of het past bij je mentale score. Na het antwoord ga je met één klik terug naar
  je plan.
- FAQ: een eigen onderwerp "Je trading plan" met tien vragen, van je eerste dagplan tot Mori en de back-up.

### Gewijzigd
- Een scenario zonder titel heet nu "<pair> <playbook>" in plaats van een interne code.
- Mori ziet bij "Check mijn trade-idee" ook de lagen en levels van je dagplan.
- FAQ: bijgewerkt voor het nieuwe plan, de back-up met je plan, "Geen exchange" als backtest en de knop Backtest-trade.
  De oude uitleg dat de journal zelf koppelt is weg.

### Fixed
- FAQ: de schakelaar om Mori uit te zetten heet "Mori ingeschakeld".
```
