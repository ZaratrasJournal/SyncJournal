# SyncJournal — Domain Context

Dit document is de **bron-van-waarheid voor domein-vocabulaire en architectuur-beslissingen**. Skills (`grill-with-docs`, `improve-codebase-architecture`, `diagnose`, `tdd`) lezen dit om de juiste terminologie te gebruiken en consistent te denken over het systeem.

**Aanvullend leesvoer**: [CLAUDE.md](CLAUDE.md) voor werkafspraken, [BACKLOG.md](BACKLOG.md) voor lopende werk, [docs/adr/](docs/adr/) voor architectuur-beslissingen.

---

## Wat is SyncJournal?

Een trading journal web-app voor een kleine crypto-trader community (Morani Discord). Lokaal draaiend (single-file HTML), gericht op gestructureerd journalen + analytics + setup-discipline.

**Users**: Denny (primair), Sebas (co-builder), community-leden via GitHub releases.

---

## Kern-domain glossary

### Trade
Een vastgelegd handels-event. Geen 1-op-1 mapping met exchange-orders: een Trade aggregeert opens + closes onder dezelfde `positionId` waar mogelijk.

**Sleutelvelden**:
- `id`: unieke string, format `<source>_<positionId>_<closeTime>` voor exchange-imports, `<random>` voor handmatig
- `source`: `"manual"` | `"blofin"` | `"mexc"` | `"kraken"` | `"hyperliquid"` | `"ftmo"` | `<custom-account-naam>`
- `status`: `"open"` | `"partial"` | `"closed"` | `"missed"`
- `simType` (bij `status="missed"`): `"missed"` (real-time gespot, niet genomen) | `"backtest"` (chart-replay) | `"paper"` (live demo-account) | leeg (legacy)
- `tpLevels[]`: array van `{id, price, pct, status, actualPrice}` — multi-TP support
- `tpTemplateId`: optioneel, koppeling naar TP-template (v12.123+)
- `playbookId`: FK naar Playbook
- `manualOverrides[]`: array van veld-namen die user handmatig heeft overschreven (beschermt tegen auto-recalc)

### Status vs simType
- `status="closed"` = real trade, kapitaal-impact, telt mee in realised PnL
- `status="missed"` = simulated trade, geen kapitaal-impact, telt theoretisch
- `simType` onderscheidt 3 sim-bronnen onder `status="missed"`

### Source-architectuur
- **Exchange-API sources** (5): Blofin, MEXC, Kraken, Hyperliquid, FTMO. Hebben `ExchangeAPI[source]` entry met adapter-methods (`fetchTrades`, `fetchOpenPositions`, `fetchFills`, `detectPartials`).
- **Manual**: `source="manual"` — user-curated, geen Worker-flow.
- **Custom accounts**: `source=<account-naam>` (uit `tj_accounts`). Behandeld als manual qua Worker-flow.

**Belangrijke invariant**: code die Worker-bugs heelt (bv. `normalizeTrade` SL-as-TP heal) moet scopen via `ExchangeAPI[source]` check, NIET via `source!=="manual"` (custom accounts vallen anders binnen scope).

### Playbook
Een gestructureerde catalogus van "bewezen setups". Heeft layers (top-down: HTF bias → entry TF), criteria (mandatory + optioneel), examples (referentie-charts), pairs/sessions, trust-score.

**Trust-Score progressie** (v12.110+, type-agnostic):
- Idee (geen drempel) → Theorized (1+ trade) → Validated (2+) → Tradeable (4+) → Bewezen (5+ trades met avgR > 0.3R)

### TP-Templates (v12.123+)
Distributie-patronen voor Take Profits. 3 pre-builts (Equal / Front-loaded / Runner) + custom. Met cascade-recalc bij handmatige edit (Optie B: last absorbs).

### Partial-trade
Een open positie met closed-siblings die dezelfde `positionId` delen. App-niveau filter `getConsumedSiblings()` voorkomt dubbele weergave in TradeList. `detectPartialFromSiblings()` mergt closed-siblings naar `tpLevels` van de open trade.

**Bekend Blofin-gedrag**: `positionId` wordt soms hergebruikt na full-close → guard in `detectPartialFromSiblings` met `blofinPidGuard`.

### Net PnL
Helper `netPnl(trade)` returnt:
- Voor `status="closed"`: `trade.pnl - trade.fees` (manual) of `trade.pnl` (exchange, al netto)
- Voor `status="missed"`: `trade.pnl` indien handmatig ingevuld, anders `calcTheoreticalPnl(trade)` via `_simTradeExit` chain (TPs → hindsightExit → exit), anders 0
- **Default tradeType-filter `"real"` verbergt missed trades** in Dashboard/Analytics/etc.

---

## Architectuur-principes

### Single-file HTML
Hele app is `work/tradejournal.html` (~5500+ LOC). React + Babel inline. **Geen bundler, geen framework keuze, geen npm scripts voor build**. Bewuste keuze: portable, lokaal, geen toolchain.

**Consequenties**:
- Functies definieren bovenin het script, useState patterns hergebruikt
- Inline JSX styling (`style={{...}}`) is de norm; CSS-class alleen voor hover/media-query
- React hooks (`useState`/`useEffect`/etc) globaal gedestructureerd: `const {useState,useRef,...} = React;`
- Theme-token validatie hook blokkeert hardcoded kleuren in JSX (alleen `var(--gold)` / `var(--text)` etc)

### Storage
- `localStorage` met `tj_` prefix voor alle keys (`tj_trades`, `tj_config`, `tj_playbooks`, etc)
- IndexedDB (`TradeJournalDB`) als primary store voor trades; localStorage als fallback
- Bij elke load: `normalizeTrade(t)` runt voor self-heal + migraties
- Schema-versie via `CURRENT_SCHEMA_VERSION` constant

### Exchange-architectuur (per-adapter isolation)
**Principe**: een Blofin-fix mag MEXC niet raken. Daarom:
- `ExchangeAPI.<exchange>.<method>()` voor alle exchange-specifieke logica
- Shared helpers (`syncTradeFlatFields`, `normalizeTrade`, `getConsumedSiblings`) hebben ZERO exchange-aannames
- Bij nieuwe exchange: vol-formuleerd adapter-object, no-ops voor irrelevant methods

### Release-flow
Vaste 6-staps flow: bump APP_VERSION in 2 files + CHANGELOG entry + sync work→main + commit "Release vX.Y" + STOP (geen push zonder explicit cmd).

Geautomatiseerd via [`/release-flow`](.claude/skills/release-flow/SKILL.md) skill.

### Theme-systeem
6 thema's (sync / classic / aurora / light / parchment / daylight). Geactiveerd via `body.theme-<naam>` class. Alle kleuren via CSS-vars (`--text`, `--bg2`, `--gold`, etc).

PreToolUse hook (`.claude/hooks/check-theme-tokens.js`) blokkeert hardcoded `#fff`/`#000`/`#C9A84C` in JSX inline-style.

---

## Worker-architectuur (productie-only)

App praat met exchange-API's via **online Cloudflare Worker**. `proxy-local/worker.js` is historische referentie — NIET actief.

**Consequentie**: lokaal end-to-end testen tegen echte exchange APIs kan niet zonder credentials + actieve Worker. Snapshot-fixture pattern is de canonieke debug-route: `?dev=1` → 📥 Snapshot → JSON-fixture → offline pipeline-test in `tests/`.

---

## Autonome testing (sinds v12.62)

Playwright + headless Chromium installed. Per feature:
- Logic-fix → Node-snippet tegen JSON-fixture (snelst)
- UI-render → Playwright spec + Read-tool op screenshot
- Live exchange data → Snapshot-knop (credentials blijven bij Denny)

Commands: `npm test`, `npx playwright test tests/<feature>.spec.js`, `node tests/run-adhoc.js`.

---

## Anti-patterns (vermijd)

- ❌ `if (exchange === "blofin") {...}` in shared scope — splits naar adapter
- ❌ Hardcoded kleuren in JSX inline-style (`#C9A84C`, `#fff`, `#000`) — hook blokt
- ❌ `git push` zonder expliciet "push"/"release"/"live" commando
- ❌ API-keys persisten in browser (geen backend) — voorlopig altijd via Worker
- ❌ Refactor zonder akkoord (framework-wissel, schema-migratie)
- ❌ Test/refactor/docs in CHANGELOG (alleen user-facing changes)

---

## Glossary — sub-system specifiek

- **Tendency** — auto-gedetecteerd patroon uit user's trade-data (detectTendencies())
- **Edge Gap** — analyse over missed trades (theoretical PnL gemist)
- **Stress-Leak** — paper-vs-real discipline-vergelijking
- **Discipline-heatmap** — 7×24 grid van adherence-rate per slot
- **closeData** — payload voor "Trade sluiten"-knop in TradeForm (mode: `close` / `close-loss` / `update` / `update-loss`)
- **hindsightExit** — user-ingevulde "waar prijs naartoe ging" prijs voor missed trades
- **layer-pattern key** — string als `Daily+BOS → 1H+SFP+OB` voor playbook-analyse grouping
