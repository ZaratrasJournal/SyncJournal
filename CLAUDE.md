# TradeJournal — projectcontext voor Claude

## Wat is dit
Trading journal web-app voor een kleine trade-community. Denny en Sebas bouwen samen. Voorlopig lokaal draaien; later misschien online.

## Stack & keuzes
- **Single-file HTML + vanilla JS.** Geen bundler, geen framework (tenzij expliciet besloten).
- **Storage:** localStorage met een `schemaVersion`-veld. Bij laden: migreer oude data naar huidige versie. Voor groeiende data stap over naar IndexedDB.
- **Altijd via localhost serveren**, nooit `file://` (origin-consistentie voor localStorage + toekomstige CORS).
- **Vaste filename** (`tradejournal.html`). Versienummer staat *in* de app, niet in de bestandsnaam — anders raakt localStorage zoek.
- **JSON export/import** knop is verplicht: vangnet voor gebruikers bij browserwissels en toekomstige backend-migratie.
- **Exchange-koppeling:** eerst CSV-import (werkt voor alle exchanges). Directe API's pas wanneer er een backend is (API-keys horen niet in de browser).

## Folder layout
```
work/        - dev: huidige tradejournal.html
main/        - release-mirror + version.json (gesynct via cp work -> main)
demos/       - losse *-demo.html voor UI-iteratie
  share-examples/ - voorbeeld share-playbook JSONs
assets/      - logo, favicons, og-image
  share-cards/    - bron-PNGs voor trade-share kaart-achtergronden (boss/giggling/omg/pablo/goodfellas)
tests/       - Playwright specs + fixtures + helpers + screenshots
scripts/     - tooling (gen-demo-backup.js)
proxy-local/ - CORS-proxy voor lokaal exchange-API testen
_scratch/    - GITIGNORED: oude varianten (v4_14, dragdrop-test, design-handoff), backups, persoonlijke csv's
```

## Versies & bestanden
- `work/tradejournal.html` — huidige development-file. Hier werk je.
- `main/tradejournal.html` — community-release. Wordt gesynct via `cp work → main` bij elke release (niet bij elke commit).
- `main/version.json` — bron-van-waarheid voor auto-update-check: `{version: "v12.X", released: "YYYY-MM-DD"}`. Wordt gefetched door de app via GitHub raw.
- `APP_VERSION` const bovenin `work/tradejournal.html` — semver `v12.X`. **Moet synchroon blijven met `main/version.json`**.
- `CHANGELOG.md` — user-facing release-notes. Standaard "Keep a Changelog"-stijl in NL.
- `_scratch/TradeJournal_v4_14.html` — historische referentie (Denny's oude versie, gitignored). Features zijn grotendeels gemigreerd; zie feature-diff onderin BACKLOG.md.

## Release-flow (exact ritueel bij user-facing changes)
1. Bump `APP_VERSION.version` in `work/tradejournal.html` (zoek `const APP_VERSION`).
2. Bump `"version"` in `main/version.json` naar dezelfde waarde.
3. Voeg changelog-entry toe bovenaan `CHANGELOG.md` onder `## [vX.Y] — YYYY-MM-DD` met **Toegevoegd** / **Gewijzigd** / **Verwijderd** / **Fixed** secties.
4. Commit de user-facing changes bij elkaar (code + version-bumps + CHANGELOG entry in één commit).
5. `cp work/tradejournal.html main/tradejournal.html`.
6. Commit als `Release: sync work -> main (vX.Y — korte titel)`.
7. `git push` — community ziet update-banner in Instellingen → Accounts bij hun volgende Check.

## Code-conventies
- **Theme-awareness**: nooit hardcoded `#fff`, `rgba(255,255,255,...)`, `#C9A84C` in JSX. Gebruik `var(--text)`, `var(--text2)`, `var(--gold)`, `var(--bg)`, `var(--green)`, `var(--red)`, `var(--amber)`. Of voeg per-thema override toe in `<style>` block met `body.theme-light .selector {...}`. Alle 6 thema's testen: sync / classic / aurora / light / parchment / daylight.
- **localStorage prefix `tj_`**: alle keys beginnen met `tj_` (bv. `tj_trades`, `tj_mindset_prefs`, `tj_discipline_checks`, `tj_milestones_seen`). Voorkomt collisions.
- **Environment flags**:
  - `IS_DEV` (via `?dev=1` in URL, persistent) — verbergt dev-only UI (proxy-URL, debug knoppen) voor community.
  - `IS_HOSTED` (detecteert file:// / localhost vs. public domain) — regelt variant van de update-knop (↻ Update nu op hosted, ⬇ Download op lokaal).
- **Inline JSX styling**: inline `style={{}}` is de norm in deze file. CSS-class alleen als er een hover/media-query nodig is. Houd style-objects compact.
- **React hooks**: `useState` / `useEffect` / `useRef` / `useMemo` / `useCallback` zijn globaal gedestructureerd bovenin het bestand (`const {useState,...} = React`). Geen `React.useState` nodig.
- **Amsterdam-tijd voor user-facing datums**: gebruik `Intl.DateTimeFormat("sv-SE", {timeZone:"Europe/Amsterdam", ...})` voor dag-of-week / uur berekeningen (DST-aware). Zie DisciplineHeatmap als voorbeeld.

## Werkafspraken
- Communiceer in het **Nederlands**.
- Commit-messages en code-comments in het Engels (GitHub-conventie, makkelijker voor anderen die later aansluiten).
- Kleine, reviewbare commits; feature branches + PR review tussen Denny en Sebas.
- Elke user-facing commit = óók een `CHANGELOG.md` entry in dezelfde commit. Refactor / test / docs hoeven niet in changelog.
- Voordat je een feature van v4_14 overzet: eerst checken of de huidige `work/tradejournal.html` al een eigen variant heeft, dan afstemmen welke richting we kiezen.

## Agents & skills — wanneer gebruiken

Claude mag (en moet) deze tools proactief inzetten. Denny hoeft er niet steeds om te vragen.

### Custom subagents (in `~/.claude/agents/`)
- **`html-feature-diff`** — altijd gebruiken wanneer we features tussen twee versies (v4_14 ↔ v9 of latere versies) vergelijken of migreren. Levert een gestructureerde featurelijst + migratievolgorde.
- **`exchange-integrator`** — gebruiken bij álles rondom exchange-data: CSV-parser schrijven, nieuw exchange toevoegen, trade-schema-mapping, API-vragen. Weigert terecht API-keys-in-de-browser.
- **`pr-reviewer-nl`** — draaien vóór elke merge van een PR tussen Denny en Sebas. Focus op single-file HTML valkuilen + storage-schema + security.

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
- Voor een grote feature: eerst `Plan`, dan uitvoeren.
- Bij werken aan beide HTML-versies: start met `html-feature-diff`.
- Bij nieuwe exchange: start met `exchange-integrator` (die gebruikt intern `web-search-agent`).
- Vóór een merge naar `main`: `pr-reviewer-nl` over de diff.
- **Demo-first voor grote UI-features**: bouw eerst een losse `demos/<feature>-demo.html` (patroon zoals `demos/discipline-heatmap-demo.html`, `demos/mindset-reminders-demo.html`, `demos/personalized-greeting-demo.html`). Itereer op het visuele met Denny. Pas als de UX zit, integreer in `work/tradejournal.html`. Bespaart herwerk en houdt de grote file schoon tijdens experimenten.
- **Changelog-discipline**: elke user-facing commit hoort in de release-flow (zie boven). Refactor/test/docs hoeven niet in changelog.
- **Bij bug-fix op theme-gerelateerd gedrag**: altijd alle 6 thema's checken (sync / classic / aurora / light / parchment / daylight).

## Autonome testing (sinds v12.62)

Claude Code kan UI-flows zelfstandig testen tegen `work/tradejournal.html` via Playwright. **Geen copy-paste loop meer voor visuele validatie.**

### Tooling

- **Playwright + headless Chromium** geïnstalleerd in `node_modules/` (eenmalig via `npm install` + `npx playwright install chromium`).
- **`tests/`-folder** bevat:
  - `smoke.spec.js` — laad app, verifieer versie, geen JS-errors, screenshot in `tests/screenshots/`.
  - `blofin-partial.spec.js` — seedt localStorage met `tests/fixtures/blofin-partial-state.json`, valideert detectPartialFromSiblings + UI-rendering.
  - `themes.spec.js` — laadt app voor alle 6 thema's (sync/classic/aurora/light/parchment/daylight), checkt body.className + geen JS-errors + screenshot per thema in `tests/screenshots/themes/`.
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
npm test                                  # alle tests
npx playwright test tests/smoke.spec.js
npx playwright test tests/blofin-partial.spec.js
npx playwright test tests/themes.spec.js  # 6 thema's × ~9s = ~55s
node tests/run-adhoc.js --fixture=blofin-partial-state.json --theme=parchment
```

### Workflow voor mij (Claude) bij elke nieuwe feature

1. Code wijzigen in `work/tradejournal.html`.
2. **Pure logic gewijzigd?** Run Node-simulatie tegen relevante snapshot-fixture.
3. **UI gewijzigd?** Run/uitbreiden van de bijbehorende `*.spec.js`. Lees screenshot via Read-tool.
4. **Nieuwe feature?** Voeg test toe in `tests/<feature>.spec.js` voordat je 'm afsluit. Past in dezelfde commit.
5. **Visuele regressie verdacht?** Vergelijk via Read-tool de nieuwe `tests/screenshots/<x>.png` met de gecommitte baseline in `tests/screenshots/baseline/<x>.png`. Voor thema's: per-thema baseline staat in `tests/screenshots/baseline/themes/<theme>.png` (vastgelegd vanaf v12.62 Dashboard).
6. **Baseline updaten?** Alleen na bewuste UI-keuze: `cp tests/screenshots/themes/*.png tests/screenshots/baseline/themes/` en commit met "update theme baseline (vX.Y — reden)".

### Bekende limitaties

- **Live exchange API met credentials**: ik kan niet inloggen met Denny's keys. Snapshot-knop blijft de brug.
- **Externe OAuth flows**: niet automatiseerbaar.
- **Subjective UX-calls** ("voelt warm genoeg", "is dit visueel mooi"): blijft Denny's call. Read-tool toont kleur/layout, maar smaak is menselijk.

### Niet committen

- `node_modules/` (gitignored)
- `tests/screenshots/*.png` behalve `baseline/` (gitignored)
- Lokale `blofin-snapshot-*.json` (gitignored — kan positionId's bevatten die specifiek voor user zijn)

## Tooling — guardrails & cost-tracking (sinds v12.62)

### Theme-token validator hook

`.claude/hooks/check-theme-tokens.js` (PreToolUse op Edit/Write) blokkeert hardcoded `#fff` / `#000` / `#C9A84C` / `rgb(255,255,255)` in JSX inline-style attributes voor `work/tradejournal.html`. CSS in `<style>` blokken (theme-overrides via `body.theme-light .selector {...}`) is wel toegestaan. Geregistreerd in `.claude/settings.json`.

**Effect**: Claude krijgt direct feedback (exit 2 + stderr) bij theme-violation, kan zelf fixen vóór de Edit doorgaat. Voorkomt theme-bug-categorie permanent.

Test handmatig:
```bash
echo '{"tool_name":"Edit","tool_input":{"file_path":"work/tradejournal.html","new_string":"<div style={{color:\"#fff\"}}>x</div>"}}' \
  | node .claude/hooks/check-theme-tokens.js
# Verwacht: exit 2 + uitleg
```

### ccusage — token & kosten check

```bash
npx ccusage@latest daily              # dagoverzicht
npx ccusage@latest blocks             # 5-uur block-view
npx ccusage@latest session            # per-sessie overzicht
```

Geen install nodig. Parseert `~/.claude/projects/*.jsonl`. Gebruik wekelijks om budget in de gaten te houden.

### /design-review slash command

`.claude/commands/design-review.md` — autonome visuele review over 6 thema's × 3 schermen (Dashboard / Trades / Instellingen). Type `/design-review` (of met argument: `trades` / `accounts` / `dashboard` om te scopen). Workflow: runt `tests/design-review.spec.js` (18 specs, ~2.5 min) + smoke, leest output-screenshots multimodaal, vergelijkt met baseline in `tests/screenshots/baseline/design-review/`, loopt design-checklist (contrast, theme-consistency, layout integrity, whitespace, top-bar info), output in Nederlands gestructureerd rapport met ✓/⚠/✗ per scherm × thema + top-actiepunten + ship/fix-verdict.

**Twee specs onderscheid:**
- `tests/themes.spec.js` — snelle Dashboard-only check (~55s, 6 shots) — voor pre-commit / smoke
- `tests/design-review.spec.js` — comprehensive multi-screen × multi-theme (~2.5 min, 18 shots, met fixture) — voor `/design-review`

**Wanneer gebruiken**: vóór elke release-bump, na elke grote UI-feature, bij twijfel of een theme-fix het niet brak.

**Wat het NIET doet**: subjectieve UX ("voelt premium"), klikflows binnen schermen (gebruik feature-specs), accessibility audit (fase 3).

## Niet doen
- Geen `file://` paden in instructies naar gebruikers.
- Geen API-keys in de browser persisten zolang er geen backend is.
- Geen framework-refactor zonder expliciet akkoord.
