---
name: release-flow
description: Voer de TradeJournal release-flow uit voor een user-facing change. Bump APP_VERSION + main/version.json, schrijf CHANGELOG entry, sync work/tradejournal.html → main/tradejournal.html, commit met "Release vX.Y: korte titel"-format. Push gebeurt NIET — wacht altijd op expliciet "push"/"release"-commando van Denny. Use when user says "release", "uitbrengen", "bump versie", of na elke user-facing code-change die klaar is voor de community.
---

# Release Flow

Onze vaste flow voor user-facing changes (versie-bump + changelog + sync + commit).

## Workflow

### 1. Bepaal nieuwe versie

- Lees huidige `APP_VERSION` uit `work/tradejournal.html` (zoek `const APP_VERSION=`).
- Increment minor: `v12.X` → `v12.(X+1)`. Major bump alleen op expliciet besluit.
- Datum = today (Europe/Amsterdam), formaat `YYYY-MM-DD`.

### 2. Bump versie op 2 plekken (must zijn synchroon)

- `work/tradejournal.html`: regel met `const APP_VERSION={version:"...",released:"..."};`
- `main/version.json`: `{"version":"vX.Y","released":"YYYY-MM-DD"}`

### 3. CHANGELOG.md entry

Voeg bovenaan toe (na de `---` divider) volgens "Keep a Changelog"-NL stijl:

```markdown
---

## [vX.Y] — YYYY-MM-DD

### Toegevoegd | Gewijzigd | Verwijderd | Fixed
- **Korte titel** *(YYYY-MM-DD, context)* — Beschrijving van wat, waarom, en hoe getest.
```

Alleen relevante secties. Concrete bestandsreferenties met markdown-links naar [work/tradejournal.html:LINE](work/tradejournal.html#LLINE).

### 4. Sync work → main

```bash
cp work/tradejournal.html main/tradejournal.html
```

### 5. Commit als één geheel

```bash
git add work/tradejournal.html main/tradejournal.html main/version.json CHANGELOG.md [overige-files]
git commit -m "$(cat <<'EOF'
Release vX.Y: korte titel (max 60 chars)

[2-5 regels uitleg: wat, waarom, hoe getest]

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### 6. STOP — wacht op push-commando

**Nooit `git push` zonder explicit "push" / "release" / "live" / "publiceer" van Denny.**
"Doe maar" / "ga maar" / "akkoord" tellen NIET als push-toestemming.

Toon eindstand:
```
vX.Y lokaal gecommit (`<hash>`). Niet gepusht.
[korte samenvatting van change]
Zeg "push" als 'm goed staat.
```

## Edge cases

- **Multi-commit release** (bv. fase 1-7 voor grote feature): elke fase eigen commit, alleen LAATSTE commit doet version bump + CHANGELOG + cp work→main + "Release vX.Y" message.
- **Hotfix bovenop bestaande release**: gewoon nieuwe versie (vX.(Y+1)), niet patchen.
- **Theme-token hook blokkeert commit**: fix hardcoded kleuren naar `var(--...)`, commit opnieuw.
- **Smoke-test gefaald**: niet committen, eerst fix → opnieuw test → dan release.

## Checklist vóór commit

- [ ] `APP_VERSION` in work bumpt synchroon met `main/version.json`
- [ ] CHANGELOG entry heeft datum + concrete uitleg + bestandsreferenties
- [ ] `cp work → main` uitgevoerd
- [ ] Smoke test groen (`npx playwright test tests/smoke.spec.js`)
- [ ] Bij theme-changes: 6 thema's gecheckt
- [ ] Commit-message volgt "Release vX.Y: titel" format
- [ ] Co-Authored-By footer aanwezig
- [ ] NIET gepusht

## Voorbeeld-commit-messages uit history

- `Release v12.134: setup-voorbeeld lightbox ipv lege tab`
- `Release v12.131: layer-labels leesbaar + filter-bypass clarification`
- `Release v12.123: slimme TP-verdeling met templates` (laatste van 4-commit serie)
