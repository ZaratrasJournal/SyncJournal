# 0001 — Single-file HTML zonder bundler

**Status**: Accepted (initiële beslissing, gehandhaafd t/m v12.x)

**Datum**: 2026-04 (overgenomen van Sebas' v9 baseline)

## Context

We bouwen een trading journal voor een kleine community. Twee fundamentele keuzes vroegen om besluit:

1. **Distributie**: hoe leveren we updates aan community-leden?
2. **Stack**: framework + bundler + toolchain (Vite/Webpack/Next/etc.) of vanilla?

Constraints:
- Community is technisch divers; sommige users kunnen geen `npm install` runnen
- Geen backend tot we kapitaal hebben voor hosting + security (API-keys-in-browser bezwaar)
- Lokaal draaien moet kunnen zonder ingewikkelde setup
- Updates moeten makkelijk verspreidbaar zijn (Discord-link of GitHub-bestand)

## Decision

**Hele applicatie in één HTML-file** (`tradejournal.html`):
- React + Babel inline geladen via CDN (`<script src="cdn.../react.production.min.js">`)
- Geen bundler, geen npm dependencies (behalve dev: Playwright voor testing)
- JSX direct in `<script type="text/babel">` block
- CSS in `<style>` block met CSS-variables voor theming
- localStorage + IndexedDB voor persistence
- Dezelfde file werkt zowel via `file://` als `localhost`

**Filename is vast** (`tradejournal.html`); versienummer staat IN de app (`APP_VERSION` constant) — anders raakt localStorage zoek bij bestandswissel.

**Release-model**: `work/` voor development, `main/` voor community-mirror. Sync via `cp` bij elke release.

## Consequences

### Positief
- ✓ User download 1 file, opent in browser, klaar
- ✓ Geen build-fouten of dependency-hell voor community
- ✓ Discord-bericht "kopieer deze file" werkt
- ✓ Auto-update via GitHub raw fetch (`main/version.json`) zonder npm
- ✓ Zero toolchain-onderhoud — geen Webpack-config-rabbit-holes

### Negatief / acceptabel
- 😐 Single file groeit groot (5500+ LOC in v12.130) — moeilijk te navigeren zonder `zoom-out` / `Grep`
- 😐 Geen TypeScript (alleen JSDoc-comments waar nodig)
- 😐 Geen tree-shaking; alle React-bundle wordt geladen
- 😐 Inline styling als norm (CSS-class is uitzondering)
- 😐 Babel transpilation runtime in browser (~50ms boot-cost)

### Implicaties voor coding
- **Inline styles** zijn standaard, niet anti-pattern
- **Theme-token validator hook** (`.claude/hooks/check-theme-tokens.js`) blokkeert hardcoded kleuren omdat we 6 thema's hebben
- **Refactor-risico** is hoog — geen module-boundaries om beschermend op te leunen
- **Test-strategie** is end-to-end (Playwright) + losse Node-snippets voor pure-function logic; geen unit tests

### Wanneer heroverwegen
- Community > 100 actieve users + framework wordt botte-neck voor feature-velocity
- Backend wordt geïntroduceerd → bundler/Next.js wordt natuurlijke fit
- IndexedDB-only storage wordt complex genoeg dat een ORM-laag waarde toevoegt

## Alternatives overwogen (en afgewezen)

- **Vite + React** — moderne DX, maar build-stap voor community = adoption-friction
- **Next.js** — SSR onnodig voor lokaal-only journal, kosten > baten
- **Vanilla JS zonder React** — DX te slecht voor de hoeveelheid UI-state
- **Tauri / Electron** — installer-friction + binary-size, geen winst boven browser

## Referenties

- [CLAUDE.md](../../CLAUDE.md) "Stack & keuzes" sectie
- [CONTEXT.md](../../CONTEXT.md) "Architectuur-principes → Single-file HTML"
