# Claude PR-review CI — setup

Twee workflows in `.github/workflows/`:

| Workflow | Trigger | Doel |
|---|---|---|
| `claude-pr-review.yml` | Elke PR open / push naar PR | Automatische review in NL met onze project-checklist |
| `claude-mention.yml` | `@claude` in PR/issue comment | Specifieke vraag — Claude reageert in de thread |

## Eenmalige setup (door Denny)

### 1. Anthropic API key als repo secret

GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:
- Name: `ANTHROPIC_API_KEY`
- Value: jouw API-key van https://console.anthropic.com/settings/keys

(De `GITHUB_TOKEN` is automatisch aanwezig, niets te doen.)

### 2. (Optioneel) GitHub App installeren

Als je interactiever wilt werken via Claude Code zelf:
```
# In een Claude Code sessie binnen de repo:
/install-github-app
```
Dit koppelt de Anthropic GitHub App. Niet strikt nodig — de workflows hierboven werken puur via API-key.

## Testen

1. Maak een test-PR (kleine wijziging in `work/tradejournal.html`).
2. Binnen ~30s zie je een GitHub Action lopen onder **Actions → Claude Auto PR Review (NL)**.
3. Na ~1-2 min plaatst Claude een review-comment op de PR.

Voor de @mention workflow: comment `@claude leg uit waarom deze logica zo werkt` op een PR. Claude antwoordt in de thread.

## Tijdelijk uitzetten

Voeg bovenaan de workflow toe:
```yaml
on:
  workflow_dispatch:  # alleen handmatig
```

Of disable via repo Settings → Actions → Disable selected workflows.

## Kosten

Per PR-review verbruikt Claude ~10-30k tokens (afhankelijk van diff-grootte). Monitor met `npx ccusage@latest daily` of in https://console.anthropic.com/usage.

## Beperkingen

- Werkt alleen op PR's, niet op directe pushes naar main.
- Claude ziet alleen de diff + bestanden in de PR — niet de volledige history.
- Voor zeer grote PR's (> 500 regels) kan de review oppervlakkig worden — breng grote PR's terug naar logische chunks.
- Als je wilt dat Claude lokale Playwright tests draait: nu niet ingebouwd. Voeg eventueel een `gh pr checkout` + `npm test` job toe vóór de review.
