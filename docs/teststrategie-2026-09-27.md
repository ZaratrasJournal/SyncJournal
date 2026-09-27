# Teststrategie SyncJournal

*Opgesteld 27-09-2026. Eenmalige doorlichting van de suite zoals die er nu staat, met een
stappenplan. Geen agent, geen terugkerend proces — dit document is het resultaat.*

---

## 1 · Waar een bug ons het meest kost

Niet alles is even duur als het stukgaat. Deze volgorde bepaalt waar de tests moeten zitten.

| | Wat | Waarom het bovenaan staat |
|---|---|---|
| **1** | **Import en sync van exchange-data** | Een fout hier maakt stilletjes verkeerde getallen. De member van vorige week ging van 20 naar 43 trades na een re-import: de data was kapot vóór iemand het doorhad. Trades die dubbel binnenkomen of verdwijnen zijn het ergste wat deze app kan doen. |
| **2** | **Opslag en migratie** | Alles staat lokaal. Eén mislukte migratie en de journal van een member is weg, zonder backup op een server om op terug te vallen. |
| **3** | **P&L- en R-berekening** | Een fout hier is onzichtbaar: het getal ziet er plausibel uit. Mensen nemen beslissingen op deze cijfers. |
| **4** | **Thema's en weergave** | Historisch onze grootste regressiecategorie. Breekt niets, maar maakt de app onbruikbaar in één van de zes thema's — en dat merken wij niet, de member wel. |
| **5** | **Formulieren en CRUD** | Vervelend als het stuk is, maar direct zichtbaar en meteen gemeld. |
| **6** | **AI-coach, plan, deelkaarten** | Randfunctionaliteit. Een fout is irritant, niet duur. |

Twee dingen volgen hieruit en staan verderop uitgewerkt: **elke exchange hoort dezelfde
levensloop-toets te krijgen**, en **elke migratie hoort een test te hebben die met oude data
begint**.

---

## 2 · Wat er nu staat (meting 27-09-2026)

| | Aantal |
|---|---|
| Spec-bestanden in `tests/` | **171** |
| Daarvan in de Playwright-runner-stijl (`@playwright/test`) | 91 bestanden, **405** `test()`-aanroepen |
| Daarvan losse Node-scripts met eigen `ok()`-teller | 80 bestanden, **1.699** asserts |
| Spec-namen in `tests/run-all-sj.js` (de CI-lijst) | **74** |
| **Spec-bestanden die daardoor nooit automatisch draaien** | **97** |

Per exchange, aantal spec-bestanden waarin de naam voorkomt:

| mexc | okx | blofin | kraken | hyperliquid | ftmo |
|---|---|---|---|---|---|
| 18 | 9 | 6 | 6 | 5 | 1 |

**Volledige doorloop gemeten op 27-09-2026** (`node tests/run-all-sj.js`, lokaal):

```
═══ SyncJournal-suite: 72/74 specs groen · 8.6 min ═══
Gefaald: changemaker-feedback, plan-doorloop
```

Dat is sneller dan verwacht en ruim binnen de tien minuten. De traagste specs zijn `plan-doorloop`
(46 s, crasht), `landing` (25 s), `execution-stappen` (21 s), `export-import-rondje` (20 s) en
`scenario-levensloop` (19 s). De `timeout-minutes: 30` in de workflow heeft dus royaal lucht —
zolang het bij 74 specs blijft. Zodra stap 1 hieronder er 97 bij zet, is dat niet meer zo.

**De suite is niet slecht.** 2.100 asserts over 171 bestanden is serieus werk, en de
exchange-levenslopen, de thema-pixeldiff en de a11y-audit zijn stuk voor stuk goede tests. Het
probleem zit niet in de tests. Het zit in hoe ze gedraaid worden.

---

## 3 · De vier gaten

### Gat 1 — meer dan de helft van de specs draait nooit automatisch

`tests/run-all-sj.js` bevat een **met de hand bijgehouden lijst** van 74 spec-namen. Dat is wat
CI draait. Alle 97 andere bestanden staan er niet in en worden dus alleen gedraaid als iemand ze
toevallig aanroept.

Wat er onder andere buiten valt:

- **`smoke`** — de basiscontrole "laadt de app zonder JS-fouten".
- **`themes`** en **`design-review`** — de pixel-diff over zes thema's, ons vangnet voor de
  categorie waar we historisch de meeste regressies hebben.
- **`a11y`** — de hele toegankelijkheidsaudit.
- **`exchange-isolation`** — de spec die bewaakt dat exchange-logica niet uitlekt naar gedeelde code.
- **De complete MEXC-cluster** (18 bestanden) en **alle `sync-*`-specs** (backoff, cooldown,
  throttle, dedup) — precies de laag die de duurste bugs van dit jaar heeft veroorzaakt.
- **`kraken-account-log`** — 47 checks, gisteren gebouwd, nooit automatisch gedraaid.
- **`multi-account-*`** (4 bestanden) en **`trades-pagination`**.

Dit is het belangrijkste gat van de vier. De andere drie zijn er deels een gevolg van.

### Gat 2 — twee runners die elkaar in de weg zitten

Er zijn twee manieren om de suite te draaien, en ze zijn niet verenigbaar:

- `npm test` → `playwright test` met `testMatch: '**/*.spec.js'` (uit `playwright.config.js`).
- `node tests/run-all-sj.js` → de handmatige lijst, wat CI gebruikt.

Omdat `testMatch` álle 171 bestanden pakt, laadt de Playwright-runner ook de 80 losse
Node-scripts. Die scripts hebben geen `test()`-blokken; hun module-body start zélf een browser.
Gevolg: bij `playwright test --list` — dus nog vóór er ook maar iets gedraaid wordt — starten er
tientallen browsers en verschijnt hun eigen ✓-uitvoer tussen de lijst.

Erger: **77 van die 80 scripts roepen `process.exit()` aan.** `csv-import.spec.js` doet
`process.exit(0)` zodra de fixtures ontbreken. Draait dat tijdens de collectiefase van de
runner, dan stopt daarmee de hele run. Op een schone kloon — en dat is CI — is dat precies de
situatie.

`npm test` is daarmee in de praktijk onbruikbaar. Dat staat nergens; het staat zelfs als
standaardcommando in `CLAUDE.md`.

### Gat 3 — de CSV-import wordt in CI overgeslagen

`tests/_fixtures/` staat in `.gitignore` (regel 38) omdat er echte exports in staan. Terecht.
Maar `csv-import.spec.js` slaat zichzelf daardoor over zodra de bestanden er niet zijn, en op CI
zijn ze er nooit. De import — risicocategorie 1 — wordt online dus **niet** getest.

De spec dekt bovendien maar drie van de zes formaten (blofin, kraken, hyperliquid). MEXC, FTMO
en OKX hebben geen CSV-fixture.

Dit hangt samen met backlog-story 6 (CSV-parser per exchange splitsen): die refactor heeft
precies deze tests als vangnet nodig, en dat vangnet ligt er nu niet.

### Gat 4 — geen enkel signaal over de dekking

Er is geen overzicht van wat wel en niet gedekt is. De lijst in `run-all-sj.js` is de facto het
enige overzicht, en die is handmatig — dus hij loopt achter zodra iemand een spec toevoegt zonder
eraan te denken. Dat is precies hoe gat 1 is ontstaan: niemand heeft een fout gemaakt, de lijst
is gewoon niet meegegroeid.

### En twee specs die nú rood staan

De doorloop van 27-09-2026 gaf twee failures. Die staan los van de vier gaten en zijn als
bug-item in de backlog gezet:

- **`changemaker-feedback` 27/28** — de check *"TP-tijd vóór open-tijd → volgende dag (overnight)"*
  faalt. Raakt de TP-datum/tijd-functie uit v0.9.146.
- **`plan-doorloop`** — harde crash op `ReferenceError: planBadge is not defined`, in het blok
  *"Koppeling met de journal op de demo-dataset"*. De spec stopt daar; alles erna draait niet.

Beide draaien wél mee in CI (ze staan in de lijst), dus ze zijn niet aan gat 1 te wijten. Ze
stonden gewoon rood.

---

## 4 · Waar de tests horen te zitten

Een piramide in de klassieke zin past hier niet: er is geen backend, dus er is geen
integratielaag tussen unit en E2E. Wat er wél is, is dit, en het loopt van snel-en-veel naar
langzaam-en-weinig:

| Laag | Wat | Hoe | Richtgetal |
|---|---|---|---|
| **Rekenlaag** | `netPnl`, `normalizeTrade`, levensloop-reconstructie, CSV-parsing, migraties | Node tegen een fixture, geen browser | ~60% van de asserts, < 2 min totaal |
| **Schermlaag** | één scherm rendert correct met gegeven state | Playwright, één pagina, geseede localStorage | ~30%, < 8 min |
| **Doorloop** | `e2e-doorloop` — accounts, trades, tags, TP's, prullenbak in samenhang | Playwright, volledige flow | 1–3 specs, < 5 min |
| **Beeldvergelijking** | 6 thema's × 3 schermen pixel-diff, a11y | Playwright + pixelmatch | apart, niet in de snelle poort |

De verhouding klopt nu ongeveer. Wat niet klopt is dat de rekenlaag vaak een browser start terwijl
dat niet hoeft — dáár zit de winst in looptijd, niet in minder tests.

---

## 5 · Stappenplan

Volgorde is: eerst zorgen dat wat er is ook draait, dan pas nieuwe tests schrijven. Een test die
niet draait is geen test.

### Stap 1 · De CI-lijst automatisch maken *(effort S — grootste winst van allemaal)*

Vervang de handmatige `SPECS`-lijst in `run-all-sj.js` door een `readdirSync` over `tests/*.spec.js`,
met een expliciete **uitsluitlijst** voor wat bewust niet meedraait (`design-review` en `a11y`
horen in een aparte, tragere poort).

Dan draait alles, en een nieuwe spec doet automatisch mee. De uitsluitlijst is kort en zichtbaar,
in plaats van een insluitlijst van 74 namen die stilletjes achterloopt.

Verwacht: de eerste run wordt rood. Dat is de opbrengst, niet het probleem — dat zijn 97
bestanden waarvan we nu niet weten of ze kloppen.

### Stap 2 · Eén runner *(effort S)*

Kies `run-all-sj.js` als de enige weg en maak `npm test` daarnaar wijzen. Zet in
`playwright.config.js` de `testMatch` op alleen de runner-stijl-bestanden, of haal de config-route
helemaal weg. Werk `CLAUDE.md` bij: daar staat `npm test` nu als standaardcommando terwijl het niet
werkt.

Op termijn: de 80 losse scripts omzetten naar `@playwright/test`. Dat is geen prioriteit — ze
werken — maar elke nieuwe spec hoort in de runner-stijl geschreven te worden.

### Stap 3 · CSV-fixtures die wél in git mogen *(effort M)*

Per exchange één **geanonimiseerde** export in `tests/fixtures/csv/`: echte kolomstructuur, echte
randgevallen, verzonnen getallen en geen account-ID's. Dan draait `csv-import.spec.js` ook op CI,
en dekt hij zes formaten in plaats van drie.

Dit is tegelijk het vangnet dat backlog-story 6 nodig heeft.

### Stap 4 · Dezelfde levensloop-toets voor elke exchange *(effort M)*

Er bestaan `kraken-levensloop`, `blofin-levensloop`, `hyperliquid-levensloop` en `okx-levensloop`.
MEXC en FTMO hebben er geen. Maak er één gedeelde vorm van — open → partial → close → re-import —
en draai die per adapter over diens fixture. Eén test, zes keer gedraaid, in plaats van zes
verschillende tests die niet hetzelfde toetsen.

### Stap 5 · Twee poorten — pas nádat stap 1 is gedaan *(effort S)*

Op dit moment **niet nodig**: 74 specs in 8,6 minuten zit onder de grens. Deze stap wordt pas
urgent zodra stap 1 er 97 specs bij zet; reken dan op ruwweg een verdubbeling.

| Poort | Wat | Wanneer | Doel |
|---|---|---|---|
| **Snel** | rekenlaag + schermlaag + `e2e-doorloop` | elke push en PR | **< 10 min** |
| **Volledig** | daarbij `design-review`, `a11y`, en de zware exchange-specs | nachtelijk + vóór een release | mag 30 min duren |

De `timeout-minutes: 30` blijft staan voor de volledige poort; de snelle krijgt er 12. Meet ná
stap 1 opnieuw vóór je dit bouwt — misschien blijkt het niet nodig.

---

## 6 · Regels om het zo te houden

- **Elke bugfix krijgt een test die zonder de fix faalt.** Geen test, geen fix — dat is de enige
  manier waarop we weten dat de bug echt weg is en niet terugkomt.
- **Elke nieuwe spec draait automatisch mee** (dat is wat stap 1 regelt), en wordt in de
  runner-stijl geschreven.
- **Geen asserts op interne structuur of toevallige styling-waarden.** Met één bewuste
  uitzondering: de thema-pixeldiffs en de theme-token-hook blijven, omdat thema-bugs historisch
  onze grootste regressiecategorie zijn.
- **Flaky = kapot.** `run-all-sj.js` geeft nu één herkansing en meldt `⚠ flaky`. Dat is een goede
  noodrem, geen eindstation: een spec die drie keer als flaky is gemeld, wordt gerepareerd of
  verwijderd.
- **Een overgeslagen test telt niet als groen.** De runner meldt `⏭️` bij een skip — die melding
  hoort zichtbaar te blijven in de samenvatting, zodat gat 3 niet nog eens stilletjes ontstaat.

---

## 7 · Wat hier bewust niet in staat

- **Een dekkingspercentage als doel.** Er is geen coverage-tooling voor een single-file HTML-app
  zonder build-stap, en een percentage zou hier toch het verkeerde sturen. De vraag is niet
  "hoeveel regels zijn geraakt" maar "draait de test die deze bug zou vangen".
- **De 80 losse scripts herschrijven als project.** Ze werken. Ze worden vervangen wanneer iemand
  ze toch al aanraakt.
- **Tests voor de AI-coach uitbreiden.** Er staan er al 13, en de risicoweging zet dat onderaan.

---

## Herkomst

Structuur (risicoprofiel → lagen → tooling → testgevallen → stappenplan → poorten en onderhoud)
is een bewerking van `prompts/test_strategy_architect.txt` uit ai-boost/awesome-prompts (GPL-3.0).
De inhoud, de metingen en de conclusies gaan over deze repo.
