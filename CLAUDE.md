# SyncJournal — projectcontext voor Claude

## Wat is dit
Trading journal web-app voor een kleine trade-community. Denny bouwt het — sinds 29-09-2026
alleen; Sebas doet niet meer mee. Adviezen die alleen voor een tweede ontwikkelaar nut hebben
(delen, review tussen twee mensen) zijn dus niet van belang.
Draait online op **syncjournal.nl** (leden) en **work.syncjournal.nl** (werkversie), en
lokaal via een localhost-server.

> **Let op — er staan twee apps in deze repo.** `syncjournal.html` is de app waar we aan
> werken. `tradejournal.html` is de oude journal en is **bevroren**: daar gaat geen fix of
> feature meer in. Zie *Versies & bestanden* hieronder.

## Stack & keuzes
- **Single-file HTML + vanilla JS.** Geen bundler, geen framework (tenzij expliciet besloten).
- **Storage:** localStorage met een `schemaVersion`-veld. Bij laden: migreer oude data naar huidige versie. Voor groeiende data stap over naar IndexedDB.
- **Altijd via localhost serveren**, nooit `file://` (origin-consistentie voor localStorage + toekomstige CORS).
- **Vaste filename** (`syncjournal.html`, als release `app.html`). Versienummer staat *in* de app, niet in de bestandsnaam — anders raakt localStorage zoek.
- **JSON export/import** knop is verplicht: vangnet voor gebruikers bij browserwissels en toekomstige backend-migratie.
- **Exchange-koppeling:** eerst CSV-import (werkt voor alle exchanges). Directe API's pas wanneer er een backend is (API-keys horen niet in de browser).

## Folder layout
```
work/        - dev: syncjournal.html — HIER WERK JE
               (work/tradejournal.html = de oude app, BEVROREN)
site/        - wat er gepubliceerd wordt: index.html (landing), app.html (de journal, kopie
               van work/syncjournal.html), version.json, plan/, demo-dataset.json.
               site/README.md beschrijft het release-ritueel en de hosting.
deploy/      - GITIGNORED: kloon van de losse site-repo (ZaratrasJournal/syncjournal-site)
               waar Cloudflare Pages op draait. Hierheen kopieer je site/ bij een release.
main/        - BEVROREN: release-spiegel van de oude TradeJournal (v12.239). Niet aanraken.
demos/       - losse *-demo.html voor UI-iteratie
  share-examples/ - voorbeeld share-playbook JSONs
assets/      - logo, favicons, og-image
  share-cards/    - bron-PNGs voor trade-share kaart-achtergronden (boss/giggling/omg/pablo/goodfellas)
tests/       - Playwright specs + fixtures + helpers + screenshots
scripts/     - tooling (gen-demo-backup.js)
proxy-local/ - HISTORISCH: oude lokale CORS-proxy. NIET MEER ACTIEF. Wijzigingen
               aan `worker.js` hebben GEEN effect — productie draait via de online
               Cloudflare Worker. Zie sectie "Cloudflare Worker proxy" hieronder.
_scratch/    - GITIGNORED: oude varianten (v4_14, dragdrop-test, design-handoff), backups, persoonlijke csv's
```

## Versies & bestanden

| Bestand | Rol |
|---|---|
| `work/syncjournal.html` | **De development-file. Hier werk je.** |
| `site/app.html` | De release: kopie van `work/syncjournal.html`, gepubliceerd als `/app` |
| `site/version.json` | Bron van waarheid voor de in-app update-check: `{version, released}` |
| `site/index.html` | De landingspagina |
| `site/plan/` | TradingPlan v2 (`syncjournal.nl/plan`) |
| `CHANGELOG.md` | User-facing release-notes, "Keep a Changelog"-stijl in NL |

- `APP_VERSION` staat bovenin `work/syncjournal.html` en is een **string**:
  `const APP_VERSION='v1.3';` — geen object. **Moet gelijk blijven aan `site/version.json`**;
  `tests/hosted.spec.js` bewaakt dat.
- **Bevroren, niet meer aanraken**: `work/tradejournal.html`, `main/tradejournal.html` en
  `main/version.json` (de oude TradeJournal, v12.239). Fixes en features gaan uitsluitend naar
  `work/syncjournal.html`. Oude data overzetten gebeurt ín de app
  (Instellingen -> Data -> Importeer oude backup), niet door in het oude bestand te werken.
- `_scratch/TradeJournal_v4_14.html` — historische referentie (gitignored).

## Release-flow (exact ritueel bij user-facing changes)

De volledige beschrijving met hosting staat in **`site/README.md`**, sectie *Voor beheerders*.
Dat is de bron; hieronder de korte versie.

1. Bump `APP_VERSION` in `work/syncjournal.html` (zoek `const APP_VERSION`) — het is een string.
   **Welk nummer** (afspraak Denny, 29-09-2026 — `major.minor.patch`):
   - **patch** `v1.3` → `v1.3.1`: bugfix, niets nieuws voor de gebruiker
   - **minor** `v1.3` → `v1.4`: nieuwe functie of zichtbaar ander gedrag (schrijf zonder `.0`, zoals `v1.4`)
   - **major** → `v2.0`: grote omslag — nieuwe opzet, backend, of iets wat leden aan hun data merken
   Nooit terug naar een lager nummer: `verNum()` in de update-check telt major×1e6 + minor×1e3 + patch,
   dus een lagere versie verschijnt bij leden nooit als update. Tot en met v1.3 telde elke release het
   tweede cijfer op, ook bij bugfixes; vanaf v1.3 geldt dit schema.
2. Zet `version` en `released` in `site/version.json` op dezelfde waarde.
3. Voeg een changelog-blok toe bovenaan `CHANGELOG.md` onder `## [vX.Y] — YYYY-MM-DD` met
   **Toegevoegd** / **Gewijzigd** / **Verwijderd** / **Fixed**.
4. `cp work/syncjournal.html site/app.html`.
5. Commit code + versiebumps + changelog + `site/app.html` **in één commit**, als
   `Release vX.Y: korte titel`.
6. Draai de release-poort: **`node tests/run-release.js`**. Die test **de commit** in een losse
   kopie (worktree), niet je werkmap — zo kan niemand halverwege een bestand verwisselen, wat op
   28-09-2026 twee metingen waardeloos maakte. Alles groen voordat er iets vertrekt. Rood? Fixen,
   opnieuw committen, poort opnieuw.
7. Kopieer `site/` naar `deploy/syncjournal-site/` — **die aparte repo is wat Cloudflare Pages
   bouwt.** Sla je dit over, dan blijft de site op de vorige versie staan terwijl deze repo al
   bij is. Dat is eerder gebeurd en kostte een middag zoeken.
8. **`git push` ALLEEN op expliciet "push"-commando van Denny.** In de deploy-repo: push naar `work` -> work.syncjournal.nl (staging); fast-forward `work` -> `main` + push -> syncjournal.nl (leden). Een "ga maar bouwen" / "doe maar" / "zet erin" is **géén** push-toestemming. Lokale commits zijn OK; pushen naar `origin/main` maakt het publiek voor de community en vereist altijd Denny's expliciete go. Na push ziet de community de update-banner in Instellingen → Accounts bij hun volgende Check.

## Code-conventies
- **Theme-awareness**: nooit hardcoded `#fff`, `rgba(255,255,255,...)`, `#C9A84C` in JSX. Gebruik `var(--text)`, `var(--text2)`, `var(--gold)`, `var(--bg)`, `var(--green)`, `var(--red)`, `var(--amber)`. Of voeg per-thema override toe in `<style>` block met `body.theme-light .selector {...}`. **SyncJournal heeft twee thema's: licht en donker** (`setTheme('light')` / `setTheme('dark')`) — test allebei. De zes thema's uit de oude journal (sync / classic / aurora / light / parchment / daylight) bestaan hier niet meer.
- **R-multiple: `0` is niet "onbekend"**. Zonder stop-loss is R niet te bepalen, en dat is iets
  anders dan een trade die precies op break-even sloot. Gebruik `tradeROrNull(t)` voor weergave
  (geeft `null` → toon een streepje) en `gemR(rows)` voor gemiddelden (telt alleen trades mét
  een R, `n===0` → streepje). `tradeR(t)` geeft `0` bij onbekend en is **alleen** goed voor
  sorteren. Dit was de bug van v1.1: elf plekken lazen `t.r` of deelden door álle trades,
  waardoor een verlies van −$3,95 als `+0,0R` in beeld kwam en elk gemiddelde naar nul werd
  getrokken.
- **Opslag: `sj_` en IndexedDB, niet `tj_`**. SyncJournal zet instellingen in localStorage onder
  `sj_` (via `DB.load` / `DB.save`, [work/syncjournal.html:1816](work/syncjournal.html#L1816)) en de
  trades in IndexedDB (`IDB`). **`tj_` is het voorvoegsel van de óúde TradeJournal**: een gevulde
  `tj_trades` ziet SyncJournal juist als oude data om te migreren, en opent dan de migratie-modal.
  Specs die `tj_`-sleutels seeden starten daardoor in een lege journal achter een modal — zo faalden
  64 omgezette specs op 29-09-2026 (backlog T2). Seed in specs via `tests/helpers/dov-page.js`.
- **Environment flags**:
  - `IS_DEV` (via `?dev=1` in URL, persistent) — verbergt dev-only UI (proxy-URL, debug knoppen) voor community.
    **Bestaat in SyncJournal (nog) niet** — dit beschrijft de oude app. Terugbrengen is backlog **W2**.
  - `IS_HOSTED` (detecteert file:// / localhost vs. public domain) — regelt variant van de update-knop (↻ Update nu op hosted, ⬇ Download op lokaal).
- **Inline JSX styling**: inline `style={{}}` is de norm in deze file. CSS-class alleen als er een hover/media-query nodig is. Houd style-objects compact.
- **React hooks**: `useState` / `useEffect` / `useRef` / `useMemo` / `useCallback` zijn globaal gedestructureerd bovenin het bestand (`const {useState,...} = React`). Geen `React.useState` nodig.
- **Amsterdam-tijd voor user-facing datums**: gebruik `Intl.DateTimeFormat("sv-SE", {timeZone:"Europe/Amsterdam", ...})` voor dag-of-week / uur berekeningen (DST-aware). Zie DisciplineHeatmap als voorbeeld.
- **Toestanden benoemen vóór je bouwt**: elk scherm, paneel en lijst heeft meer toestanden dan
  "gevuld". Loop ze expliciet langs vóór de eerste regel code, en bouw wat van toepassing is:
  **leeg** (nog nooit data), **niets in beeld** (wel data, maar het filter of de periode laat
  niets over — een andere melding dan leeg), **laden**, **fout**, **gevuld**. Voor formulieren
  ook: **uitgeschakeld** en **bezig met opslaan**.
  - Een grafiek zonder data hoort een lege staat te tonen, geen leeg assenstelsel. Gebruik
    `emptyState(key)` (met een regel in `EMPTY`) in plaats van een nieuwe `*-empty`-class.
  - Een lege staat zegt wát er ontbreekt en wat de volgende stap is ("Nog geen trades, start een
    sync"), niet alleen dat er niets is.
  - Randgevallen die hier vaak misgaan: precies één datapunt, alle waarden nul, en een periode
    zonder trades terwijl er wel trades bestaan.

## Code-stijl (voor Claude)

- **Kleinste heldere wijziging** die de taak volledig oplost. Geen speculatieve
  abstracties, flexibiliteit of dependencies "voor later" — bouw wat de taak vraagt.
- **Vóór het bewerken**: begrijp de geraakte flow en check of bestaande code of een
  bestaande helper het al oplost (voorkomt duplicaten in de grote single-file).
- **Bij bugfixes**: fix de wortel-oorzaak, niet het symptoom. Inspecteer elke caller
  van de functie die je wijzigt en loop de sibling-paden na (zie ook de
  exchange-isolatie-regel en de graphify-impact-check elders in dit document).
- **Liever verwijderen en hergebruiken** dan toevoegen. Maar offer nooit correctheid
  of leesbaarheid op voor een kleinere diff.
- **Magic values**: benoem elke literal waarvan de betekenis niet op de plek zelf
  duidelijk is (const met naam, of comment).
- **Simpeler alternatief?** Stel het voor als het aan dezelfde eisen voldoet.
  Routinebeslissingen neem je zelf, zonder goedkeuring te vragen.
- **Comments** alleen voor niet-voor-de-hand-liggende intentie of constraints —
  geen "wat de volgende regel doet". Bewuste shortcuts markeer je met een comment
  die de beperking én het upgrade-pad benoemt.
- **Single-file blijft de architectuur** (géén 1000-regel-limiet per bestand), maar
  houd fúncties klein en gescheiden; splits een functie vóór hij onleesbaar wordt.
- **Tests**: alleen een test toevoegen als het falen ervan iets écht kapots aanwijst.
  Geen asserts op interne structuur of toevallige styling-waarden — met één bewuste
  uitzondering: onze theme-pixel-diffs en de theme-token-hook zijn regressie-vangnetten
  en blijven (theme-bugs zijn historisch onze grootste regressiecategorie).

## Cloudflare Worker proxy (productie — enige actieve proxy)

De app praat met exchange-API's via een **online Cloudflare Worker**, niet via `proxy-local/`. Die laatste is historisch en niet meer in gebruik — wijzigingen daaraan hebben geen productie-effect.

### Wat dat betekent voor proxy-wijzigingen
- **Nooit zeggen** "gebruik wrangler dev tegen `proxy-local/`" of "edit worker.js lokaal" als instructie aan Denny — dat doet niets.
- **Worker-code zelf** draait als `morani-proxy` in **het Cloudflare-account van Morani**; Denny kan erbij en deployt
  via het dashboard. Sinds 30-09-2026 staat de productieversie óók in de repo: [docs/worker-v20.js](docs/worker-v20.js)
  (v19 was byte-gelijk aan `docs/worker-okx-complete.js`). Verandert de Worker, werk dan dat bestand bij en draai
  `node tests/worker-monitoring.spec.js` — die test het complete bestand met de echte handlers. v20 telt elk verzoek
  in Workers Analytics Engine voor het dagrapport op Denny's NUC ([scripts/dagrapport/](scripts/dagrapport/)); zie
  [docs/worker-monitoring.md](docs/worker-monitoring.md). Morani's eigen journal gebruikt dezelfde Worker.
- **Wij kunnen wel** in deze repo voorstellen formuleren ("vervang in worker.js de fills-action door deze code"), maar de daadwerkelijke deploy gebeurt buiten ons zicht.
- **Veranderingen aan `proxy-local/worker.js`** zijn dus in principe **alleen historisch / als referentie**. Als we de productie-Worker willen wijzigen, leveren we de diff aan Denny en zij past het toe in haar Worker-omgeving.

### Wat dat betekent voor lokaal testen
- Lokaal end-to-end testen tegen echte MEXC/Blofin/Kraken/Hyperliquid APIs **kan niet** zonder credentials + actieve Worker.
- **Snapshot-fixture pattern** blijft daarom de enige autonome test-route: `?dev=1` knop captured raw API response → JSON fixture → offline pipeline-test in `tests/`. **Let op:** in SyncJournal ontbreekt die knop nog (backlog **W2**); tot dan levert Denny ruwe data handmatig aan. Zie sectie "Autonome testing" verder in dit document.
- Mock-fixtures voor proxy-response in unit-tests blijven ook bruikbaar voor client-side parsing/filter validatie (bv. `tests/mexc-history-orders.spec.js` v12.93 patroon).

### Wat te doen bij een proxy-wijziging
1. Schrijf de wijziging op in tekst/diff-vorm met exacte snippet en regelnummer-context.
2. Vermeld in CHANGELOG dat de wijziging een Worker re-deploy door Denny vereist vóór effect.
3. **Niet** spelen met `proxy-local/worker.js` of refereren naar `wrangler dev` als route — verwarrend en onjuist.
4. Cliënt-side fallback (zoals v12.92's positionsHistory fallback-TP) is een goede strategie om wijzigingen te overbruggen tot de Worker is ge-redeployd.

## Exchange-architectuur — bug-isolatie tussen exchanges

We ondersteunen zes exchanges: **Blofin, OKX, Kraken Futures en Hyperliquid** met een API-koppeling, **MEXC** (koppeling gestopt — MEXC verlaat NL nov 2026, CSV-import blijft) en **FTMO MT5** via CSV en handmatige accounts. Elke exchange heeft eigen data-shapes en eigen aannames; **een fix voor één exchange mag niet per ongeluk een andere breken**. Daarom:

### Hoe elke exchange de buitenwereld bereikt

Dit stond nergens opgeschreven en moest op 29-09-2026 uit de code worden afgeleid — met een
verkeerde aanname als gevolg. Onthoud het:

| Exchange | Route | Gevolg |
|---|---|---|
| **OKX, MEXC, Kraken** | via de Cloudflare Worker (`proxyCall`) | hun authenticated endpoints staan geen CORS toe, en de secret hoort niet client-side getekend te worden. De exchange ziet het IP van de Worker, **nooit dat van de gebruiker** — dus een IP-whitelist op de sleutel kan nooit kloppen, en Workers hebben geen vast uitgaand IP. |
| **Blofin** | rechtstreeks vanuit de browser (`fetch`) | Blofin stáát CORS toe. De exchange ziet het echte IP, dus daar werkt een IP-whitelist wél. |
| **Hyperliquid** | publieke wallet-data | geen sleutels, niet van toepassing. |

Wat via `proxyCall` loopt raakt dus per definitie OKX, MEXC én Kraken tegelijk — en Blofin en
Hyperliquid juist niet. Toets dat expliciet vóór je `proxyCall` of `refreshBalance` aanraakt.

- **API-adapters zijn per exchange** in `ExchangeAPI.{exchange}` — `fetchTrades`, `testConnection`, `fetchOpenPositions`, `fetchFills`, etc. Elk eigen object, eigen closure. Hier nooit cross-exchange logica plakken.
- **Trade-processing met exchange-aannames hoort óók in de adapter**, niet in shared helpers. Voorbeeld: Blofin's partial-close detectie maakt aannames over `positionId`-hergebruik en `_rawCloseSize`-veld die voor MEXC niet kloppen. Zo'n functie wordt een adapter-methode (`ExchangeAPI.blofin.detectPartials(...)`), niet een gedeelde helper die met `if (ex==="blofin")` switcht.
- **Pure utilities mogen gedeeld blijven** als ze ZERO exchange-aannames hebben: `syncTradeFlatFields` (layers→flat tags), `normalizeTrade` (price-precisie fix), `getConsumedSiblings` (algemene matchKey). Geen `if (exchange === ...)` ergens in. Bij twijfel: per exchange.
- **Bij wijzigingen aan iets dat door meerdere exchanges loopt**: expliciet toetsen welke exchanges het pad raken. Een commit-message als "fix Blofin partial-close" terwijl je `detectPartialFromSiblings` (shared) wijzigt = misleidend, want MEXC gaat ook door dezelfde functie.
- **Nieuwe exchange toevoegen** = vol-formuleerd adapter-object met alle methodes (incl. no-ops voor wat niet relevant is, bv. `detectPartials: t => t` voor CSV-only). Dispatcher in App roept altijd via `ExchangeAPI[ex].method(...)`, nooit een if/else op exchange-naam in App.
- **Snapshot-fixture pattern** (`?dev=1` knoppen voor Blofin in v12.85, oude app): per-exchange uitbreidbaar. In SyncJournal nog niet aanwezig — backlog **W2**.

**Anti-patroon**: één gedeelde `detectPartialFromSiblings` met `if (exchange === "blofin") { /* speciale logica */ }`. Dat trekt Blofin-aannames over het MEXC-pad heen. Beter: split naar adapter-methodes.

**Pragmatische scope**: niet alles moet vandaag al gemoduleerd worden. Bestaande gedeelde code mag staan. **Maar nieuwe exchange-specifieke logica gaat per direct in de adapter**, en wanneer een gedeelde helper buggy blijkt voor een specifieke exchange splitsen we 'm bij de fix (niet patchen met een if-statement).

## Werkafspraken
- Communiceer in het **Nederlands**.
- Commit-messages en code-comments in het Engels (GitHub-conventie, makkelijker voor anderen die later aansluiten).
- Kleine, reviewbare commits, gewoon op `main`. **Alleen bij een release of een grote feature**
  een branch + pull request, zodat `/code-review` (plugin) er met een frisse blik naar kijkt.
  Voor elke kleine fix een PR is in je eentje alleen maar extra werk.
- Elke user-facing commit = óók een `CHANGELOG.md` entry in dezelfde commit. Refactor / test / docs hoeven niet in changelog.
- Voordat je een feature van v4_14 overzet: eerst checken of `work/syncjournal.html` al een eigen variant heeft, dan afstemmen welke richting we kiezen.

## Agents & skills — wanneer gebruiken

Claude mag (en moet) deze tools proactief inzetten. Denny hoeft er niet steeds om te vragen.

### Custom subagents (in `~/.claude/agents/`)
- **`html-feature-diff`** — altijd gebruiken wanneer we features tussen twee versies (v4_14 ↔ v9 of latere versies) vergelijken of migreren. Levert een gestructureerde featurelijst + migratievolgorde.
- **`exchange-integrator`** — gebruiken bij álles rondom exchange-data: CSV-parser schrijven, nieuw exchange toevoegen, trade-schema-mapping, API-vragen. Weigert terecht API-keys-in-de-browser.
- **`pr-reviewer-nl`** — lokaal, op de diff, vóór een release of het mergen van een PR. Nederlands,
  kent de single-file-HTML-valkuilen, het storage-schema en de security-punten. Vult `/code-review`
  aan: dat draait op de PR zelf en toetst aan dít bestand.

### Built-in agents
- **`Explore`** — snel zoeken in de grote HTML-bestanden (200–400 KB) zonder ze helemaal in context te trekken. Gebruik voor "waar staat functie X?".
- **`Plan`** — vóór elke grotere feature/refactor. Eerst plan, dan code.
- **`web-search-agent`** — voor up-to-date info over exchange-API's / CSV-formaten (formats veranderen).
- **`general-purpose`** — voor multi-step research die niet in de andere agents past.

### Skills
- **`research` + `research-deep` + `research-report`** — pipeline voor grondig exchange-onderzoek (vergelijk features, rate limits, CSV-kolommen).
- **`simplify`** — na een v4_14→v9 feature-merge: duplicaten en rommel opruimen.
- **`commit`** — standaard git-commits maken (Engels, beknopt). PR's alleen openen als Denny er om vraagt.
- **`loop` / `schedule`** — nu niet nodig.

### Standaard-reflexen
- **Grote feature of refactor** (bv. backlog C2 CSV-parser, T2 verouderde specs):
  `superpowers:writing-plans` → plan-document in `docs/`, daarna `superpowers:executing-plans`.
  Niet voor kleine fixes.
- Bij werken aan beide HTML-versies: start met `html-feature-diff`.
- Bij nieuwe exchange: start met `exchange-integrator` (die gebruikt intern `web-search-agent`).
- **Vóór een release**: `pr-reviewer-nl` over de diff. Bij een pull request daarnaast `/code-review`
  (plugin; vereist GitHub CLI `gh`, ingelogd). De automatische CI-review is uitgezet: die kostte
  API-tegoed bij elke PR en deed hetzelfde.
- **Demo-first voor grote UI-features**: gebruik `/prototype` (mattpocock skill) — formaliseert ons bestaande `demos/*-demo.html` patroon. Bouw 1-3 radically different UI variations, toggleable. Itereer met Denny. Pas als UX zit, integreer in `work/tradejournal.html`. Bespaart herwerk en houdt de grote file schoon.
- **Bij bug-melding van Denny**: gebruik `superpowers:systematic-debugging` (plugin — 4-phase root cause, completer dan mattpocock's `/diagnose`). Voorkomt ad-hoc grep-en-gokken bij hardnekkige Blofin/MEXC/BT-bugs. Bij ≥3 mislukte fixes: ga naar Phase 4.5 (architectuur-twijfel).
- **Bij elke bugfix: eerst de test** (`superpowers:test-driven-development`). Schrijf een spec die
  de bug laat zien, zie hem falen, dán de fix. Bewezen op 28-09-2026: de ingeslikte fout in
  `refreshBalance` kwam alleen boven doordat de test bleef falen na de eerste fix.
- **Voor "klaar"/"fixed"/"werkt"-claims**: gebruik `superpowers:verification-before-completion` (plugin). Run verificatie-commando's eerst (Playwright spec / Node-snippet / smoke), bevestig output, dan pas claim. Geen "should work"-aannames.
- **Bij "denk er over na" / nieuwe-feature plan**: gebruik `/grill-me` — interview-modus met decision-tree branches, één vraag tegelijk. Voorkomt onvolledige plannen voor grote features.
  **`/grill-me` gaat voor `superpowers:brainstorming`.** Die laatste meldt zich uit zichzelf bij
  elke "maak iets"-vraag; gebruik hem alleen bij grote nieuwe features, ná grill-me.
- **Bij onbekend deel van `work/syncjournal.html` (~8.900 regels)**: gebruik `/zoom-out` — geeft module-map + callers met domain-vocabulaire. Sneller oriënteren dan blind grep'en.
- **Impact-check vóór wijziging aan een gedeelde / cross-exchange helper** (`netPnl`, `sourceTypeOf`, `normalizeTrade`, `syncTradeFlatFields`, `detectPartialFromSiblings`, `getConsumedSiblings`, e.d.): raadpleeg de graphify-graaf voor de callers — `graphify query "wat roept netPnl aan"` of `graphify path "A" "B"` — om te toetsen wélke exchanges/modules dat pad raken (sluit aan op de exchange-isolatie-regel). De graaf staat in `graphify-out/` (gitignored, lokaal), met de bron in `graphify-src/`. Dit is een **"wat raakt dit nog meer"-tool**, géén vervanging voor grep — voor "waar staat functie X" blijft grep sneller én altijd actueel.
  - **De graaf klopt op dit moment niet.** `graphify-src/tradejournal.js` is geextraheerd uit de
    **bevroren** `tradejournal.html` en dateert van 22-06-2026. Hij beschrijft dus een andere app
    dan die waarin we werken: aanroepers die hier niet bestaan, en alles van na juni ontbreekt
    (Kraken-levensloop, OKX-adapter). **Vertrouw hem niet tot hij ververst is** — gebruik grep.
  - **Verversen**: extraheer het `<script>`-blok van `work/syncjournal.html` naar
    `graphify-src/syncjournal.js`, verwijder de oude `tradejournal.js`, en draai
    `graphify graphify-src --update` (code-only/AST, kost geen tokens). Zie backlog W3.
- **Changelog-discipline**: elke user-facing commit hoort in de release-flow (zie boven). Refactor/test/docs hoeven niet in changelog.
- **Bij bug-fix op theme-gerelateerd gedrag**: licht én donker checken. (De oude journal had er zes; SyncJournal twee.)

## Autonome testing (sinds v12.62)

Claude Code kan UI-flows zelfstandig testen tegen `work/syncjournal.html` via Playwright. **Geen copy-paste loop meer voor visuele validatie.**

### Tooling

- **Playwright + headless Chromium** geïnstalleerd in `node_modules/` (eenmalig via `npm install` + `npx playwright install chromium`).
- **`tests/`-folder** bevat:
  - `smoke.spec.js` — laad app, verifieer versie, geen JS-errors, screenshot in `tests/screenshots/`.
  - `blofin-partial.spec.js` — seedt localStorage met `tests/fixtures/blofin-partial-state.json`, valideert detectPartialFromSiblings + UI-rendering.
  - `themes.spec.js` — laadt de app per thema, checkt body.className + geen JS-errors + screenshot in `tests/screenshots/themes/`. **Let op**: deze spec dateert uit de tijd van zes thema's; zie backlog T2 over verouderde specs.
  - `helpers/seed.js` — `seedLocalStorage(fixture)` voor `page.addInitScript`.
  - `run-adhoc.js` — losse Node-runner voor ad-hoc exploratie (geen test-framework).
  - `screenshots/` — gegitignored behalve `baseline/`.
  - `fixtures/` — JSON-fixtures voor reproducibele state.

### Wanneer welke tool gebruiken

| Situatie | Tool | Waarom |
|---|---|---|
| Pure logic-fix (helper-functie) | `node -e "..."` simulatie tegen snapshot-JSON | Snelste, geen browser nodig |
| UI-rendering check (visueel) | `npx playwright test tests/<feature>.spec.js` + Read-tool op `tests/screenshots/*.png` | Headless browser, ik zie wat user ziet |
| Ad-hoc exploratie ("kijk wat er gebeurt") | `node tests/run-adhoc.js --fixture=X.json --theme=parchment` | Geen test-spec nodig, snelle iteratie |
| Live exchange-data | Snapshot-knop in app → Denny levert JSON → fixture laden in test | Credentials blijven bij Denny |

### Standaard-commands

```bash
cd C:/Users/Denny/Documents/Tradejournal
node tests/run-release.js                 # DE RELEASE-POORT — 80 specs, ~3 min, test de laatste commit in een worktree
node tests/run-release.js --hier          # zelfde poort in je werkmap (zo draait CI)
node tests/run-all-sj.js                  # alles in de map: 174 specs (~helft rood = verouderd, zie hieronder)
node tests/run-all-sj.js --jobs=1         # serieel, als parallel iets vertroebelt
node tests/run-all-sj.js --lijst          # toon wat er zou draaien, draai niets
node tests/run-all-sj.js kraken csv       # alleen specs waarvan de naam matcht
node tests/kraken-levensloop.spec.js      # losse Node-spec (80 stuks) draai je met node
node tests/hl-echt.spec.js                # Denny's echte Hyperliquid-account door de hele app (opname)
node tests/hl-echt.spec.js --opnemen      # opname verversen bij Hyperliquid; --live = vers, zonder bewaren
npx playwright test tests/smoke.spec.js   # runner-spec (91 stuks) draai je met playwright
node tests/run-adhoc.js --fixture=blofin-partial-state.json --theme=light
SPEC_TIMEOUT=15000 GEEN_HERKANSING=1 node tests/run-all-sj.js   # diagnose-ronde: snel falen
```

> **Stand 29-09-2026 — twee poorten, en waarom.**
> `tests/run-all-sj.js` leest de map: 174 specs. Ongeveer de helft staat rood en dat zijn
> **verouderde specs, geen kapotte app** — ze beschrijven de oude journal (verdwenen UI,
> hernoemde teksten). Zie `docs/teststrategie-2026-09-27.md` en backlog T2.
>
> Wat bij een release telt staat daarom in **`tests/release-set.js`** en draait met
> **`node tests/run-release.js`**. Die lijst zat tot 29-09 alleen nog in de git-historie van
> `run-all-sj.js` en moest met `git show HEAD:` teruggehaald worden om v1.1 vrij te geven —
> een poort die je kwijtraakt door een commit is geen poort. Wijst de lijst naar een spec die
> niet bestaat, dan stopt de runner hard in plaats van 'm over te slaan.
>
> De poort draait standaard in een **worktree** (losse kopie van de laatste commit), zodat niets
> in je werkmap een lopende meting kan verstoren. Ook de CI (`.github/workflows/syncjournal-tests.yml`)
> draait sinds 29-09 de poort (`--hier`), niet meer de hele map — die was daardoor rood geworden.
>
> Beide runners draaien **4 specs tegelijk** (`--jobs=N`). De specs zijn onafhankelijk: eigen
> browser, eigen localStorage. Dat bracht de release-poort van ~55 min naar ~4 min. De
> e2e-doorloop draait vooraf en alléén, zonder concurrentie.

> **`npm test` werkt op dit moment niet.** De `testMatch` in `playwright.config.js` pakt álle
> `tests/*.spec.js`, maar 80 daarvan zijn losse Node-scripts die zelf een browser starten en
> `process.exit()` aanroepen — die draaien dan al tijdens het verzamelen en kunnen de hele run
> afbreken. Gebruik `node tests/run-all-sj.js`. Zie `docs/teststrategie-2026-09-27.md` en
> backlog T4.

### Workflow voor mij (Claude) bij elke nieuwe feature

1. Code wijzigen in `work/syncjournal.html`.
2. **Pure logic gewijzigd?** Run Node-simulatie tegen relevante snapshot-fixture.
3. **UI gewijzigd?** Run/uitbreiden van de bijbehorende `*.spec.js`. Lees screenshot via Read-tool.
4. **Nieuwe feature?** Voeg test toe in `tests/<feature>.spec.js` voordat je 'm afsluit. Past in dezelfde commit.
5. **Visuele regressie verdacht?** Vergelijk via Read-tool de nieuwe `tests/screenshots/<x>.png` met de gecommitte baseline in `tests/screenshots/baseline/<x>.png`. Voor thema's: per-thema baseline staat in `tests/screenshots/baseline/themes/<theme>.png` (vastgelegd vanaf v12.62 Dashboard).
6. **Baseline updaten?** Alleen na bewuste UI-keuze: `cp tests/screenshots/themes/*.png tests/screenshots/baseline/themes/` en commit met "update theme baseline (vX.Y — reden)".

### Bekende limitaties

- **Live exchange API met credentials**: ik kan niet inloggen met Denny's keys. Snapshot-knop blijft de brug.
  **Uitzondering: Hyperliquid.** Wallet-data is openbaar, dus daar testen we tegen Denny's echte account:
  `tests/hl-echt.spec.js` speelt een opname uit `tests/_fixtures/hyperliquid-wallet.json` af (zit in de
  release-poort, slaat zich over op CI). **Het walletadres blijft buiten de repo**: die is openbaar, en het
  adres koppelt het project aan Denny's hele tradehistorie en saldo.
- **Externe OAuth flows**: niet automatiseerbaar.
- **Subjective UX-calls** ("voelt warm genoeg", "is dit visueel mooi"): blijft Denny's call. Read-tool toont kleur/layout, maar smaak is menselijk.

### Niet committen

- `node_modules/` (gitignored)
- `tests/screenshots/*.png` behalve `baseline/` (gitignored)
- Lokale `blofin-snapshot-*.json` (gitignored — kan positionId's bevatten die specifiek voor user zijn)

## Tooling — guardrails & cost-tracking

Staat in de skill **`tooling-guardrails`** (`.claude/skills/tooling-guardrails/SKILL.md`) en
laadt alleen wanneer je hem nodig hebt: de theme-token hook, de axe-core a11y-audit, de Claude
PR-review-workflows, `ccusage` voor token- en kostencontrole, en `/design-review`.

## Niet doen
- **Geen `git push` naar `origin/main` zonder expliciet "push"-commando van Denny.** Geldt voor élke push (gewoon, force, vanaf andere branch — alles). "Ga maar bouwen" / "doe maar" / "zet erin" / "ja akkoord" zijn **géén** push-toestemming, alleen het letterlijke woord *push* (of "release", "live", "publiceer") telt. Lokale commits + `cp work → main` zijn OK; pas op het moment dat het naar GitHub gaat is expliciete go vereist. Bij twijfel: niet pushen, vragen.
- Geen `file://` paden in instructies naar gebruikers.
- Geen API-keys in de browser persisten zolang er geen backend is.
- Geen framework-refactor zonder expliciet akkoord.
