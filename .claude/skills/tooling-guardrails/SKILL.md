---
name: tooling-guardrails
description: Guardrails en meetgereedschap van SyncJournal — de theme-token hook, de accessibility-audit met axe-core, de Claude PR-review-workflows in GitHub Actions, ccusage voor token- en kostencontrole, en het /design-review slash-commando. Gebruik dit bij het opzetten, aanpassen of debuggen van die tooling, of wanneer je wilt weten hoe je een visuele of a11y-controle draait.
---

# Tooling — guardrails & cost-tracking

> Stond tot 29-09-2026 in `CLAUDE.md` en werd elke sessie geladen. Het is naslag voor
> specifieke taken, dus het laadt nu alleen wanneer je het nodig hebt.

### Theme-token validator hook

`.claude/hooks/check-theme-tokens.js` (PreToolUse op Edit/Write) blokkeert hardcoded `#fff` / `#000` / `#C9A84C` / `rgb(255,255,255)` in JSX inline-style attributes voor `work/syncjournal.html`. CSS in `<style>` blokken (theme-overrides via `body.theme-light .selector {...}`) is wel toegestaan. Geregistreerd in `.claude/settings.json`.

**Effect**: Claude krijgt direct feedback (exit 2 + stderr) bij theme-violation, kan zelf fixen vóór de Edit doorgaat. Voorkomt theme-bug-categorie permanent.

Test handmatig:
```bash
echo '{"tool_name":"Edit","tool_input":{"file_path":"work/syncjournal.html","new_string":"<div style={{color:\"#fff\"}}>x</div>"}}' \
  | node .claude/hooks/check-theme-tokens.js
# Verwacht: exit 2 + uitleg
```

### Accessibility audit (axe-core)

`tests/a11y.spec.js` — runt axe-core (WCAG 2.1 A + AA tags) over Dashboard/Trades/Accounts × de thema's (geschreven voor zes, nu twee — spec loopt achter). Logt alle violations per scherm gegroepeerd op impact (critical/serious/moderate/minor) + concrete rule-IDs en eerste 3 affected nodes voor critical.

**Hard-fail beleid**: alleen `critical` impact blokkeert (form-labels, keyboard-traps, missing roles). `serious` (vooral color-contrast) wordt gelogd maar niet geblokkeerd — onze thema's hebben bewust subtiele inactieve tabs/ondertitels die ~3.4:1 zitten i.p.v. WCAG 4.5:1. Bij regressie zou de log-output direct opvallen.

**Run**:
```bash
npx playwright test tests/a11y.spec.js
```

**Baseline drift** (gemeten 2026-05-01 op v12.62, na 4 aria-label fixes):
- Dark thema's: 15-40 serious per scherm (vooral inactieve tabs, LIVE-indicator, "built by Zaratras" subtitel)
- Light thema's: 35-76 serious per scherm (lichtgrijs op wit = altijd marginaal)

Hand-fixes voor specifieke contrast-issues kunnen later — pas `BLOCKING_IMPACTS` in de spec aan om strakker te worden.

### Claude PR-review CI (claude-code-action)

Twee GitHub workflows in `.github/workflows/`:
- `claude-pr-review.yml` — **uitgezet op 29-09-2026** (alleen nog handmatig te starten). Kostte API-tegoed bij
  elke PR en is vervangen door het `/code-review`-commando uit de code-review-plugin, dat je zelf start.
- `claude-mention.yml` — `@claude <vraag>` in PR/issue comment triggert Claude in de thread

**Setup**: zie `.github/CLAUDE-REVIEW-SETUP.md` voor de eenmalige stappen (ANTHROPIC_API_KEY toevoegen aan repo secrets). Werkt zonder GitHub App.

### ccusage — token & kosten check

```bash
npx ccusage@latest daily              # dagoverzicht
npx ccusage@latest blocks             # 5-uur block-view
npx ccusage@latest session            # per-sessie overzicht
```

Geen install nodig. Parseert `~/.claude/projects/*.jsonl`. Gebruik wekelijks om budget in de gaten te houden.

### /design-review slash command

`.claude/commands/design-review.md` — autonome visuele review over de thema's × 3 schermen (geschreven voor zes thema's, nu twee) (Dashboard / Trades / Instellingen). Type `/design-review` (of met argument: `trades` / `accounts` / `dashboard` om te scopen). Workflow: runt `tests/design-review.spec.js` (18 specs, ~2.5 min) + smoke, leest output-screenshots multimodaal, vergelijkt met baseline in `tests/screenshots/baseline/design-review/`, loopt design-checklist (contrast, theme-consistency, layout integrity, whitespace, top-bar info), output in Nederlands gestructureerd rapport met ✓/⚠/✗ per scherm × thema + top-actiepunten + ship/fix-verdict.

**Twee specs onderscheid:**
- `tests/themes.spec.js` — snelle Dashboard-only check (~55s, 6 shots) — voor pre-commit / smoke
- `tests/design-review.spec.js` — comprehensive multi-screen × multi-theme (~2.5 min, 18 shots, met fixture) — voor `/design-review`. **Heeft pixel-diff** tegen `tests/screenshots/baseline/design-review/<theme>-<screen>.png` via `pixelmatch` (helper in `tests/helpers/diff-baseline.js`). Drempel 2% — daadwerkelijke drift door dynamic content (live tickers, timestamps, mindset-quote rotatie) zit op 0.2-0.7%, dus 2% geeft ~3× marge en vangt elke echte regressie. Bij failure: bekijk `tests/screenshots/diff/design-review/<theme>-<screen>.diff.png` voor visuele diff (rood = veranderd).

**Baseline updaten** (na bewuste UI-keuze):
```bash
cp tests/screenshots/design-review/<theme>-<screen>.png tests/screenshots/baseline/design-review/
git commit -am "update design-review baseline (vX.Y — reden)"
```

**Wanneer gebruiken**: vóór elke release-bump, na elke grote UI-feature, bij twijfel of een theme-fix het niet brak.

**Wat het NIET doet**: subjectieve UX ("voelt premium"), klikflows binnen schermen (gebruik feature-specs), accessibility audit (fase 3).
