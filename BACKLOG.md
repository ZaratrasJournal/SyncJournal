# SyncJournal — Backlog

*Opgeruimd op 29-09-2026.* Van de 84 open punten waren er 24 al gedaan of vervallen; de meeste
stamden uit april–juni en waren geschreven voor de oude TradeJournal. Elk twijfelgeval is in de code
nagekeken. Wat er met elk punt is gebeurd staat onderaan; de vorige versie, met 137 afgeronde punten
en alle onderzoeksnotities, staat in [docs/backlog-archief-2026-09-29.md](docs/backlog-archief-2026-09-29.md).

**Hoe te lezen.** Elke story heeft een ID (**B** bug · **T** tests · **C** code · **W** werkwijze), een
prioriteit (1 = eerst) en een effort (XS < 1 uur · S ≈ halve dag · M ≈ dag · L = meerdere dagen). Per
story: waarom het ertoe doet, het plan in stappen, en wanneer hij klaar is.

**Werkwijze** (uit CLAUDE.md): bugs beginnen met een test die de fout laat zien; M- en L-stories eerst
een plan-document (`superpowers:writing-plans`); exchange-logica alleen in de adapter van die exchange;
elke wijziging eindigt met `node tests/run-release.js` groen.

---

## Overzicht

| ID | Story | Prio | Effort | Hangt af van |
|---|---|---|---|---|
| **B1** | Partial close bij Hyperliquid en Kraken pas zichtbaar na sluiting | 1 | M | — |
| **B2** | OKX: contractwaarde-vangnet kent geen USDC-perps | 2 | S | — |
| **W2** | Ruwe exchange-data kunnen vastleggen (dev-modus terug) | 2 | M | — |
| **C1** | Lege staten: één manier, met een volgende stap | 2 | S + M | — |
| ~~C5~~ | ~~Acht tag-soorten, acht kleuren, overal gelijk~~ — ✅ **gedaan in v1.3** | — | — | — |
| **T1** | CSV-import testen op CI | 2 | M | — |
| **W1** | Worker: staat `Access-Control-Allow-Origin` op `*`? | 2 | XS (Denny) | — |
| **B3** | Controleren: telt dezelfde positie dubbel via CSV én API? | 2 | S | — |
| **T2** | Oude-app-specs herschrijven of schrappen | 3 | L | besluit AI-coach (deels) |
| **C2** | CSV-parser per exchange opsplitsen | 3 | M–L | T1 |
| **T3** | Levensloop-toets voor FTMO, één gedeelde vorm | 3 | M | T1 |
| **T4** | `npm test` repareren | 3 | XS | — |
| **T5** | `drive-backup` is timing-gevoelig bij 4 specs tegelijk | 3 | XS | — |
| **C3** | Account-label opzoeken in plaats van kopiëren | 3 | S | — |
| **W3** | Graphify verversen of de instructie weghalen | 3 | S | — |
| **W4** | Eerste echte PR met beide reviewers | 3 | XS | volgende release |
| **C4** | XLSX-ondersteuning eruit | gepland | S | na 16 nov (MEXC weg) |

---

## Bugs

### B1 · Partial close bij Hyperliquid en Kraken pas zichtbaar na sluiting — prio 1 · M

**Waarom.** Partial-close is de standaard handelsstijl in de community. Bij OKX en Blofin toont een
lopende positie het geboekte deel als *partial*. Bij Hyperliquid en Kraken staat hij als gewoon "open",
en de winst van de afgebouwde stukken verschijnt pas als de hele positie dicht is. Tot dat moment
kloppen P&L en win-rate niet. Het staat vastgelegd als "bekend gat" in
[tests/partial-alle-exchanges.spec.js:138](tests/partial-alle-exchanges.spec.js#L138).

Dit is wat er overbleef van de oude story *"Kraken trades hebben geen TP-coverage"*: sinds de
levensloop krijgt elke Kraken-trade zijn afbouwstappen wél, maar pas na sluiting.

**Plan.**
1. Test eerst: de assertie op regel 138 omdraaien — een lopende Hyperliquid/Kraken-positie met één
   afbouw hoort een partial-rij te zijn, met het geboekte deel apart. Zien falen.
2. Nagaan hoe OKX en Blofin die partial-rij opbouwen uit hun positiegeschiedenis.
3. Hetzelfde gedrag in de levensloop-functies: `levenslopenUitAccountLog` (Kraken,
   [work/syncjournal.html:6563](work/syncjournal.html#L6563)) en `_reconstructTrades` (Hyperliquid,
   [:6873](work/syncjournal.html#L6873)). Een levensloop die nog loopt maar al afbouwstappen heeft →
   status partial, geboekt deel = som van die stappen.
4. Herhaald syncen en daarna sluiten: nog steeds één rij, geen dubbeltelling (scenario 1–3 in
   dezelfde spec dekken dat al).
5. Alleen in deze twee adapters. Niets in gedeelde helpers (exchange-isolatie).

**Klaar als** de spec voor alle vier de API-exchanges hetzelfde gedrag toetst, en de release-poort groen is.

### B2 · OKX: contractwaarde-vangnet kent geen USDC-perps — prio 2 · S

**Waarom.** `ExchangeAPI.okx._ctvFallback` ([work/syncjournal.html:7123](work/syncjournal.html#L7123))
kent 14 sleutels, allemaal `*-USDT-SWAP`. Faalt de live lookup van `/public/instruments`, dan wordt de
size van een USDC-positie verkeerd omgerekend. Meestal vangt de live lookup het af — dit is het
vangnet — maar OKX is je actieve exchange en EEA-accounts handelen in USDC.

**Plan.**
1. Test eerst: met een lege cache geeft `_ctVal('BTC-USDC-SWAP')` nu geen of een verkeerde waarde.
2. De echte `ctVal`-waarden van de USDC-tegenhangers ophalen uit OKX's publieke
   `/api/v5/public/instruments?instType=SWAP` (geen sleutel nodig). Niet gokken: USDC- en
   USDT-contracten kunnen een andere grootte hebben.
3. Toevoegen aan de map; test groen.

**Klaar als** elke USDT-sleutel in het vangnet een USDC-tegenhanger heeft, met de waarde van OKX zelf.

### B3 · Controleren: telt dezelfde positie dubbel via CSV én API? — prio 2 · S

**Waarom.** In de oude app kon één positie twee keer binnenkomen: via een CSV-import én via de
API-sync, met verschillende id's. Of dat in SyncJournal nog kan is onbekend — de import is sindsdien
herbouwd. Het is een stille fout: je P&L verdubbelt zonder melding.

**Plan.**
1. Test eerst: een CSV-fixture importeren van een exchange met API-koppeling (Blofin of Kraken — de
   fixtures staan lokaal), daarna dezelfde positie syncen via een nagebootste API-respons.
2. Groen → story sluiten, de spec blijft als bewaking. Rood → dedup in de adapter van die exchange,
   niet in een gedeelde helper.

**Klaar als** de spec bestaat en groen is. Effort M als het een echte fout blijkt.

---

## Tests

### T1 · CSV-import testen op CI — prio 2 · M

**Waarom.** `tests/_fixtures/` is terecht gitignored (echte exports), dus op CI slaat `csv-import`
zichzelf over — ook in de groene runs van vandaag (`⏭️ csv-import … overgeslagen`). Lokaal draait hij
weer sinds de worktree-poort die map koppelt. Import is de risicovolste laag, en de spec dekt 3 van de
6 formaten (Blofin, Kraken, Hyperliquid).

**Plan.**
1. Per exchange één **geanonimiseerde** export in `tests/fixtures/csv/` (die mag in git): echte
   kolommen en randgevallen, verzonnen bedragen en id's. MEXC (xlsx), FTMO en OKX erbij.
2. `csv-import.spec.js` leest die map; de lokale echte exports blijven een extra laag.
3. Vóór de commit controleren dat er geen account-id's, wallets of namen in staan.

**Klaar als** CI geen `⏭️ csv-import` meer toont en alle zes formaten gedekt zijn. Nodig vóór C2 en T3.

### T2 · Oude-app-specs herschrijven of schrappen — prio 3 · L

*Voegt de oude stories 17 (AI-coach), 18 (accounts) en 20 samen.*

**Waarom.** 81 specs laden nog de bevroren oude app en worden overgeslagen in de volle run. 7 laden
SyncJournal maar zoeken teksten van de oude journal ("Verbinding testen", "Refresh trades",
milestones, donatie) — dat zijn de enige rode in de volle run (90/97). Een mechanische omzetting gaf
op 29-09 64 rode en ~20 vals-groene specs, dus: per spec.

**Plan** (eerst een plan-document in `docs/`):
0. Fundament: `tests/helpers/seed.js` laten seeden via `dov-page.js` → `seed()` / `applyBackup`
   (`sj_` + IndexedDB, niet `tj_`), en één navigatiehelper via `go(page)` in plaats van ~50 keer
   knoppen op tekst zoeken.
1. Triage-tabel per spec: **herschrijven**, **schrappen** (de feature bestaat niet in SyncJournal:
   zes thema's, milestones, donatie, mindset, hash-routing) of **al gedekt** door een release-spec.
2. Per cluster herschrijven, met de lessen uit de review: naast elke "NIET getoond"-check een
   positieve check; niet zoeken in `page.content()` (daar staat de broncode ook in); wachten op iets
   dat `boot()` zet, niet op de statische kop.
3. De AI-coach-cluster (12 specs) pas na het besluit of de AI-coach blijft.

**Klaar als** geen spec meer alleen `tradejournal.html` laadt, de volle run groen is, en wat een
release moet tegenhouden in `tests/release-set.js` staat.

### T3 · Levensloop-toets voor FTMO, één gedeelde vorm — prio 3 · M

**Waarom.** Kraken, Blofin, Hyperliquid en OKX hebben een levensloop-spec; FTMO niet. En de vier
toetsen elk iets anders. (MEXC vervalt: koppeling gestopt.)

**Plan** (na T1): één toets — open → partial → partial → dicht → opnieuw importeren voegt niets toe —
die per adapter over diens fixture draait. FTMO erbij via zijn CSV. De bestaande specs blijven voor
de eigenaardigheden per exchange.

**Klaar als** vijf exchanges dezelfde toets doorlopen.

### T4 · `npm test` repareren — prio 3 · XS

**Waarom.** `package.json` zegt `"test": "playwright test"`, en `playwright.config.js` pakt
`**/*.spec.js` — ook de losse node-scripts, die zelf een browser starten en `process.exit` aanroepen.
Onbruikbaar; CLAUDE.md waarschuwt er nu voor.

**Plan.** `"test": "node tests/run-release.js"` en `testMatch` beperken of weghalen. De waarschuwing
in CLAUDE.md eruit.

**Klaar als** `npm test` hetzelfde doet als de release-poort.

### T5 · `drive-backup` is timing-gevoelig bij 4 specs tegelijk — prio 3 · XS

**Waarom.** In de release-poort van v1.2 (29-09) faalde `drive-backup` de eerste keer en slaagde hij
bij de herkansing (39 s). Los draaide hij 3 van de 3 keer groen. De herkansing verbergt dit nu —
maar een spec die op timing leunt, geeft vroeg of laat een vals rood of groen.

**Plan.** De vaste wachttijden in de spec vervangen door wachten op een concreet signaal (de
back-up is geschreven). Daarna de poort een paar keer draaien zonder herkansing
(`GEEN_HERKANSING=1 node tests/run-release.js`).

**Klaar als** hij bij 4 tegelijk drie keer achter elkaar zonder herkansing groen is.

---

## Code

### C1 · Lege staten: één manier, met een volgende stap — prio 2 · S + M

**Waarom.** `equity()` zet bij nul trades een nulpunt in de reeks
([work/syncjournal.html:2996](work/syncjournal.html#L2996)) en tekent een leeg assenstelsel zonder
uitleg — het lijkt een fout. Daarnaast bestaan naast de helper `emptyState()`
([:2930](work/syncjournal.html#L2930), teksten in `EMPTY` op [:2921](work/syncjournal.html#L2921))
nog zeven losse classes: `lt-empty` (5×), `revempty` (3×), `txempty`, `thm-empty`, `tagcard-empty`,
`ml-empty`, `empty-h`.

**Plan.**
1. Test eerst: dashboard met een periode zonder gesloten trades → een lege staat met een volgende
   stap. Twee teksten: "nog nooit data" en "niets in deze periode" zijn verschillende meldingen.
2. `equity()` geeft bij lege data `emptyState(...)` terug in plaats van het nulpunt. Andere
   grafiekhelpers nalopen op `data.push({x:0`.
3. Per scherm één losse class naar `emptyState()`, CSS opruimen. Pixel-diff als vangnet, licht én donker.

**Klaar als** er geen losse `*-empty`-classes meer zijn en elke lege-staat-tekst in `EMPTY` staat en
een volgende stap noemt.

### C5 · Eén kleurenschema voor tags, en emoties gesplitst in positief en negatief — ✅ gedaan in v1.3

*Gebouwd 29-09-2026 na akkoord op de demo ([demos/tag-kleuren-demo.html](demos/tag-kleuren-demo.html)).*
*Spec: `tests/tag-kleuren.spec.js` (64 checks, beide thema's). Afwijking van het plan: de emotiekaart*
*zet Negatief en Positief onder elkaar in plaats van naast elkaar — de kaarten zijn ~360px breed.*

*Gevraagd door Denny, 29-09-2026.*

**Waarom.** Elke soort tag heeft op drie plekken drie verschillende kleuren:

| Soort | Trade-formulier | Instellingen → Tags | Tags-kolom (overzicht) |
|---|---|---|---|
| Setups | neutraal (aangeklikt: accentblauw) | blauw | blauw |
| Bevestigingen | neutraal | groenblauw | groenblauw |
| Emoties, negatief | rood | amber, één lijst | amber |
| Emoties, positief | groen | amber, één lijst | amber |
| Fouten | amber | oranje | oranje |

Instellingen → Tags belooft *"elke categorie z'n eigen kleur, precies zoals ze in de trade-picker
verschijnen"* — dat klopt niet. En de splitsing positief/negatief in het formulier komt uit een vaste
lijst in de code (`EMO_NEG`, [work/syncjournal.html:1738](work/syncjournal.html#L1738)): een emotie
die je zelf toevoegt (bv. "Angstig") staat daar niet in en belandt bij **Positief**, in het groen,
zonder dat je dat ergens kunt rechtzetten.

**Plan.**
1. Eén bron: elke soort één kleur, uit thema-tokens (`var(--red)`, `var(--green)`, `var(--amber)` …)
   in plaats van hex, zodat licht en donker kloppen.
2. De splitsing wordt data: `tagConfig.emotionNeg` (welke emoties negatief zijn). Bij het laden gevuld
   uit de huidige vaste lijst als het veld ontbreekt — ook voor oude back-ups.
3. Instellingen → Tags: de emotiekaart in twee kolommen, Negatief en Positief; toevoegen aan een kant,
   met één klik verplaatsen naar de andere.
4. Formulier: leest de splitsing uit `emotionNeg`; aangeklikte setups en bevestigingen in hun eigen kleur.
5. Tags-kolom volgt vanzelf via `tagColor`, die alleen positief/negatief hoeft te kennen.
6. `EMO_NEG` en het ongebruikte `EMO_POS` weg. `CALM_EMOS` blijft (rating in de coach-export).
7. Test: dezelfde tag heeft op alle drie de plekken dezelfde kleur, in licht en donker; een zelf
   toegevoegde negatieve emotie staat overal bij Negatief; een oude journal zonder `emotionNeg` houdt
   FOMO en Gehaast negatief.

**Acht soorten, acht kleuren** (voorstel 29-09-2026, wacht op akkoord Denny):

| Soort | Kleur | Token |
|---|---|---|
| Setup-type | blauw | `--accent` |
| Confirmaties | groenblauw | `--teal` |
| Timeframe | paars | `--violet` |
| Emoties, positief | groen | `--green` |
| Emoties, negatief | rood | `--red` |
| Fouten | amber | `--amber` |
| Missed-redenen | roze | nieuw `--pink` (licht + donker) |
| Eigen tags | grijs | `--muted` |

Groen, rood en amber zijn de kleuren die het formulier al gebruikt. Nu dubbel: missed-redenen en eigen
labels zijn allebei grijs.

**Ook erbij:** timeframe en missed-redenen komen in de Tags-kolom van het overzicht (`overzichtTags`
toont ze nu niet), en in het formulier krijgen timeframe, setups en confirmaties hun kleur zodra je
ze aanklikt.

**Klaar als** elke soort op alle drie de plekken dezelfde kleur heeft, in beide thema's, eigen emoties
hun kant kiezen in Instellingen, en de belofte in Instellingen weer klopt. Wijzigt de tag-datastructuur:
met migratie, changelog-regel en een test op oude back-ups.

### C2 · CSV-parser per exchange opsplitsen — prio 3 · M–L

**Waarom.** `parseExchangeCsvText` ([work/syncjournal.html:7788](work/syncjournal.html#L7788)) is 333
regels met de parsing van alle exchanges door elkaar. De OKX-tak en de fallback beginnen met een
zesvoudige negatie, dus een nieuwe exchange toevoegen betekent twee negatie-kettingen bijwerken.
Kraken en Hyperliquid hebben hun parsing al in de adapter; Blofin, MEXC, FTMO en OKX nog niet.

**Plan** (na T1, eerst een plan-document):
1. Per exchange `herkentCsv(headers)` en `parseCsv(rows)` op de adapter, zoals Kraken en
   Hyperliquid het al doen.
2. `parseExchangeCsvText` wordt een lus over de adapters; de negatie-kettingen verdwijnen vanzelf.
3. Eén exchange per stap, met `csv-import` (zes formaten) ertussen.

**Klaar als** de functie op één scherm past en elke import exact dezelfde trades oplevert als
ervoor. Geen changelog (geen gedragswijziging). Niet samen met een feature doen.

### C3 · Account-label opzoeken in plaats van kopiëren — prio 3 · S

**Waarom.** Het trade-formulier zet het account-label plat in de trade
([work/syncjournal.html:8750](work/syncjournal.html#L8750)). Hernoem je je account, dan houden oude
trades de oude naam. Cosmetisch — er wordt niets mee gerekend.

**Plan.** Weergave via `acctOf(t.exchange).acct`; `t.account` alleen voor echte sub-accounts. Test:
account hernoemen → een oude trade toont de nieuwe naam.

### C4 · XLSX-ondersteuning eruit — gepland, na 16 november · S

**Waarom.** Het enige externe script in de app (`xlsx@0.18.5`,
[work/syncjournal.html:15](work/syncjournal.html#L15)) bestaat alleen voor MEXC's Excel-export. Tot
MEXC uit Nederland vertrekt hebben leden het nodig om hun historie binnen te halen.

**Plan** (december): script-tag weg; `accept` terug naar `.csv` ([:3923](work/syncjournal.html#L3923));
de xlsx-tak uit de CSV-import met de melding *"Sla op als CSV en probeer opnieuw"*; FAQ nalopen.
Test: een `.xlsx` geeft een begrijpelijke melding.

**Klaar als** er geen `<script src>` meer in het bestand staat.

---

## Werkwijze & tooling

### W1 · Worker: staat `Access-Control-Allow-Origin` op `*`? — prio 2 · XS (Denny)

**Waarom.** Dan kan elke website je Worker gebruiken als gratis exchange-proxy, op jouw
Cloudflare-quota. Bij misbruik gaan de koppelingen voor iedereen stuk door rate-limits. Sleutels
lekken er niet door.

**Plan** (jouw kant, ~5 minuten): in het Cloudflare-dashboard de Worker openen en zoeken op
`Access-Control-Allow-Origin`. Staat er `*`, dan lever ik een diff die beperkt tot de eigen origins.
Meteen meekijken: bouwt de Worker upstream-URL's uit een vaste basis per exchange, zodat het clientpad
geen andere host kan worden?

**Let op:** Morani's journal en de oude TradeJournal gebruiken dezelfde Worker. De oude TradeJournal
draait lokaal — als bestand (origin `null`) of via `localhost`. Die moeten op de lijst, anders breek je ze.

**Klaar als** bevestigd is wat er staat, en bij `*` een diff gedeployd is.

### W2 · Ruwe exchange-data kunnen vastleggen (dev-modus terug) — prio 2 · M

**Waarom.** CLAUDE.md beschrijft het snapshot-fixture-patroon via `?dev=1`-knoppen als dé manier om
exchange-bugs met echte data te reproduceren zonder jouw sleutels. In SyncJournal bestaat `?dev=1`
niet (0 treffers). Het diagnosepaneel (`diagnostics()`,
[work/syncjournal.html:1846](work/syncjournal.html#L1846)) geeft versie, aantallen en laatste sync,
maar niet de ruwe respons. Voor B1 en elke volgende exchange-bug mis je zo de brug naar een testfixture.

**Plan.**
1. `?dev=1`, onthouden onder een `sj_`-sleutel, zet een dev-blok aan in het diagnosepaneel.
2. Per gekoppelde exchange een knop "Ruwe respons downloaden": de laatste API-antwoorden van de
   adapter, met sleutels, wallet en accountnummers eruit gefilterd.
3. Die download is direct bruikbaar als fixture in `tests/_fixtures/`.
4. Test: het bestand bevat geen `apiKey`, `secret`, `passphrase` of wallet (zoals de diagnose-spec
   dat al toetst).
5. CLAUDE.md bijwerken: de passages over `IS_DEV` beschrijven nu de oude app.

**Klaar als** de knop voor elke API-exchange (OKX, Blofin, Kraken, Hyperliquid) een bestand oplevert
dat een spec kan inladen.

### W3 · Graphify verversen of de instructie weghalen — prio 3 · S

**Waarom.** CLAUDE.md verwijst naar de graphify-graaf voor impact-checks, maar die graaf komt uit de
bevroren app (22-06-2026). Een verouderde graaf geeft plausibele, foute antwoorden.

**Plan.** Kiezen, niet allebei half. **Verversen**: het `<script>`-blok van `work/syncjournal.html`
naar `graphify-src/syncjournal.js`, de oude weg, `graphify graphify-src --update` (gratis, alleen
AST). **Of weghalen**: de instructie uit CLAUDE.md, want grep werkt en is altijd actueel.
Advies: weghalen, tenzij je hem echt gebruikt — dat is de afgelopen weken niet gebeurd.

### W4 · Eerste echte PR met beide reviewers — prio 3 · XS

**Waarom.** `pr-reviewer-nl` en `/code-review` zijn nog nooit op een release losgelaten.

**Plan.** Bij de volgende release een branch en een PR. Lokaal `pr-reviewer-nl` over de diff, op de
PR `/code-review`. Daarna beoordelen of ze te streng of te los zijn, en of `pr-reviewer-nl` op het
duurdere opus-model moet blijven.

---

## Ideeën — niet ingepland

| Groep | Punten | Oppakken als |
|---|---|---|
| AI-coach uitbreiden (3) | AI Trade Autopsy, AI Super-Prompt "wat heeft prioriteit", playbook-coaching | Na het besluit of de AI-coach blijft |
| Mindset & discipline (10) | Tiltmeter, pre-trade-checklist-builder, checklist-streak, mindset-reminders, dag-limiet/tilt guard, Strengths-onboarding, 2D mindset-grid, decision-space-meter, Strengths Primer, Best Trade of the Week | Als leden erom vragen — de mindset-module is niet meegekomen en de enquête vroeg om vereenvoudiging |
| Grafieken & analyse (7) | Bruto/netto P&L naast elkaar, drawdown-grafiek, funding & fees-waterval, weekoverzicht, scratch-donut, MAE-to-stop per setup, bias per layer | Kies er één; bruto/netto eerst (fees worden zichtbaar) |
| Funding-fees per trade (1) | Onderzoek klaar (bouwvolgorde Hyperliquid → Kraken → Blofin) | Na B1 |
| Blofin-schermhulpjes (3) | Near-liquidation-waarschuwing, "laatst ververst"-indicator, live R:R | Laag |
| Delen & integraties (4) | Trade-voucher/deellink, Discord-webhook, TradingView-grafieken, PDF-rapport | Laag |
| Help & content (3) | Alerts Cookbook, Bellafiore-playbookveld, pro-trader-review-follow-up | Laag |
| Combined trades (1) | Meerdere trades als één behandelen | Samenvoegen bestaat al (FTMO); pas bij vraag |
| Test-scenario's O–T (6) | Funding, scaling-in, direction-flip, leverage-wijziging, liquidatie, sub-accounts | Zodra de bijbehorende feature er is |
| Wachtpost (2) | Dagelijkse staat-controle, diff-wachtpost ([ontwerp](docs/wachtpost-ontwerp-2026-09-27.md)) | Na W3 en T2 — anders vervalt de helft van de signalen |
| Sync (1) | `fetchFills` parallel bij verversen | Als verversen traag voelt |

De uitgewerkte teksten van deze ideeën staan in het [archief](docs/backlog-archief-2026-09-29.md).

## Besluiten

| Besluit | Waarom het ertoe doet |
|---|---|
| **Blijft de AI-coach?** | Blokkeert de AI-coach-specs in T2 en de drie AI-ideeën. De enquête zei "heroverwegen". |
| Welke exchanges krijgen prioriteit? | Bepaalt of er een zevende exchange komt, en daarmee de urgentie van C2 |
| Backend ja of nee? | Pas relevant als API-sleutels uit de browser moeten, of bij cloud-sync |
| Distributiemodel | Gratis/donatie, of iets anders |

---

## Opgeruimd op 29-09-2026

| Punt (oud) | Uitkomst | Bewijs |
|---|---|---|
| Hyperliquid toevoegen | ✅ gedaan | adapter `ExchangeAPI.hyperliquid` |
| Laadtijd ~10 s door Babel | ✅ gedaan | geen Babel meer; laadt in 0,2 s |
| Hosted op eigen domein | ✅ gedaan | syncjournal.nl |
| Meerdere screenshots per trade | ✅ gedaan | `t.screenshots` |
| TP-niveaus met datum en tijd | ✅ gedaan | `tsDate`/`tsTime` (v0.9.149) |
| MFE/MAE-analyse, MFE/MAE-scatter | ✅ gedaan | grafiek bij "Kwaliteit van je trades" |
| PnL-kalender-heatmap | ✅ gedaan | kalenderpagina |
| Trades-tabel paginatie | ✅ gedaan | `tPage`/`pageCount` |
| Kraken-trades zonder TP-overzicht | ✅ opgelost door de levensloop | `kraken-levensloop`: "elke trade heeft stappen met minstens één afbouw"; het restgat is **B1** |
| Blofin partial-close → koppeling met open trade | ✅ opgelost door de levensloop | `blofin-levensloop`: partial met het geboekte deel apart |
| CI draait 74 van de 171 specs | ✅ anders opgelost | vaste release-set, en de volle run leest de map |
| Trage poort splitsen / CI-poorten (oud 14, 19) | ✅ gedaan | 55 → 2,4 min, 4 specs tegelijk |
| Self-review vóór commit | ✅ gedaan | `superpowers:verification-before-completion` + `pr-reviewer-nl` |
| Twee runners | ✅ grotendeels | runner draait beide soorten; de rest is **T4** |
| MEXC partial-close: TP-winst ~8× te laag | ❌ geschrapt | MEXC-koppeling gestopt |
| MEXC `contractSize` via de proxy | ❌ geschrapt | idem |
| MEXC eigen `detectPartials` | ❌ geschrapt | idem |
| `ftmoCtx` doorgeven aan `calcRMultiple` | ❌ geschrapt | die functies bestaan niet in SyncJournal; R loopt via `tradeR`/`gemR` |
| Dashboard-grafieken lazy mounten | ❌ geschrapt | probleem van de oude React-app |
| Finalize-aggregatie: 3 kopieën | ❌ geschrapt | `importTrades`-finalize bestaat niet in SyncJournal |
| Bulk-tag-knop afmaken | ❌ geschrapt | de code zit niet in SyncJournal |
| Pre-Market Game Plan-tab | ❌ geschrapt | gaat op in de Plan-pagina |
| aicoach-weekly-spec structureel maken | → **T2** | valt onder de AI-coach-specs |
| Dev-only debug-knoppen | → **W2** | bestaan niet in SyncJournal; opnieuw als W2 |
| CSV-import op CI | → **T1** | bleek *niet* gedaan: CI slaat de spec over |
| Levensloop-toets MEXC en FTMO | → **T3** | MEXC vervalt, FTMO blijft |
| Oude stories 17, 18, 20 | → **T2** | samengevoegd |
| Lege staten (oud 8, 9) | → **C1** | samengevoegd |
| CSV-import per exchange (oud 6) | → **C2** | |
| CSV- vs API-dedup-gat | → **B3** | eerst een test: bestaat het nog? |
| Graphify (oud 7), Worker-CORS, reviewer op echte PR | → **W3**, **W1**, **W4** | |
