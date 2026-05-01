---
description: Autonome visuele design-review over alle 6 thema's met checklist en gestructureerd rapport
---

# /design-review

Voer een autonome design-review uit op `work/tradejournal.html` over alle 6 thema's × 3 schermen (Dashboard / Trades / Instellingen). Gebruik onze bestaande Playwright + screenshot infrastructuur. Geen menselijke clicks nodig — output is een gestructureerd rapport dat Denny kan lezen.

Als de gebruiker een argument meegeeft (`/design-review trades` of `/design-review accounts` of `/design-review dashboard`), focus de review op alleen die screen om de output beknopt te houden.

## Werkproces

### Stap 1 — Run de tests
```bash
cd C:/Users/Denny/Documents/Tradejournal
npx playwright test tests/design-review.spec.js tests/smoke.spec.js
```

Verifieer dat alle 19 tests groen zijn (6 thema's × 3 schermen + 1 smoke). Bij failure: stop, rapporteer welke test faalde + waarom, vraag of door te gaan.

### Stap 2 — Lees screenshots
Per thema, per scherm: `Read tests/screenshots/design-review/<theme>-<screen>.png`. Beschikbare screens: `dashboard`, `trades`, `accounts`. Bij argument-filter: alleen die screen lezen.

### Stap 3 — Vergelijk met baseline
Per thema/screen: `Read tests/screenshots/baseline/design-review/<theme>-<screen>.png` en zet naast de nieuwe versie. Noteer:
- **Identiek**: geen verschil → ✓ (timestamps/quote-rotatie/live-koers tellen niet)
- **Bedoelde wijziging**: layout/styling change die Denny aankondigde → ⓘ (en suggereer baseline-update)
- **Onbedoelde regressie**: iets veranderd dat niet bewust was → ⚠ (vereist actie)

### Stap 4 — Loop de design-checklist per thema

Voor elk thema, beoordeel:

1. **Contrast (WCAG-achtig)**
   - Lichaamstekst tegen achtergrond: voldoende contrast?
   - Secundaire labels (var(--text2)) zichtbaar?
   - Inactieve/disabled states leesbaar maar duidelijk inactief?

2. **Theme-consistency**
   - Komen er geen "wrong-theme" kleuren door? (bv. donkere card in light theme)
   - Hover/focus states gebruiken theme-tokens?
   - Borders/dividers schaduw-of-lijn consistent met theme-stijl?

3. **Layout integrity**
   - Geen tekstoverloop / afgesneden labels?
   - Cards/tabellen uitgelijnd op 1 baseline?
   - Geen onverwachte horizontale scrollbar?
   - Iconen op de juiste hoogte t.o.v. tekst?

4. **Information density & whitespace**
   - Padding tussen secties consistent?
   - Headers van content gescheiden door duidelijke ruimte?
   - Cards niet "gepropt" (ademruimte rondom getallen)?

5. **Top-bar info (Trading Journal + tickers)**
   - Live ticker leesbaar in alle themes?
   - "Trading Journal" titel consistent in stijl, alleen kleur shift per theme?

### Stap 5 — Output: gestructureerd rapport

Schrijf in NL, kort, scanbaar:

```
# Design Review — work/tradejournal.html (vX.X)
Datum: YYYY-MM-DD
Tests: 19/19 ✓ (6 thema's × 3 schermen + smoke)

## Per-theme bevindingen

### sync (dark, gold)
- Dashboard: ✓ / ⚠ / ✗  — kort
- Trades:    ✓ / ⚠ / ✗  — kort
- Instellingen: ✓ / ⚠ / ✗  — kort

### classic ...
...

## Top-actiepunten
1. <concrete actie als er ⚠/✗ is>
2. ...

## Verdict
- ✓ ship als geen ⚠/✗
- 🛑 fix eerst als ⚠/✗ aanwezig is
```

### Stap 6 — Subjectieve UX uit het rapport laten

Niet beoordelen:
- "Voelt premium genoeg" / "is dit visueel mooi" — dat is Denny's smaak
- Branding-keuzes (logo-grootte, font-weight)
- Of een feature gemist wordt — dat is product, niet design-review

Wel beoordelen:
- Contrast, leesbaarheid, layout, theme-consistentie
- Concrete bugs (overlap, afgesneden, scrollbar)
- Regressies t.o.v. baseline

## Wanneer dit gebruiken

- **Voor elke release** (vX.Y bump). Vangt visuele regressies in 1-2 minuten.
- **Na elke grote UI-feature** in `work/tradejournal.html`. Zoals een nieuwe Trades-rij, Playbook-modal, of Settings-tab.
- **Twijfel of een theme-fix het niet brak**. Run `/design-review` en vergelijk met baseline.

## Wat het NIET doet

- Geen klik-flows (tab-navigatie, modal-open, form-submit) — dat is voor `tests/<feature>.spec.js`.
- Geen logica-validatie — daar zijn smoke + feature-specs voor.
- Geen accessibility-audit (axe/Lighthouse) — kan in fase 3 toegevoegd worden.
