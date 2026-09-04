# SyncJournal — veilige overgang oude app → nieuwe variant

**Datum:** 2026-09-04
**Doel:** Bestaande TradeJournal-gebruikers (`tj_`) veilig naar SyncJournal (`sj_`) laten overgaan — zónder dataverlies, met behoud van alle instellingen, een volwaardige foutmodule, en nazorg (validatie + herstel).

## Vastgelegde keuzes (2026-09-04)
1. **Overgang-scope:** alléén oude app → SyncJournal (eenmalige migratie). Versie-naar-versie upgrades zijn niet de focus, maar Fase 3 legt er wel het frame voor.
2. **Foutmodule:** volwaardig — centrale handler, zichtbare/begrijpelijke meldingen, herstelacties, diagnostics-log, vangt stille opslag-/quota-fouten.
3. **Backup:** auto-snapshot vóór risicovolle acties + 1-klik herstel.
4. **Origin:** oude en nieuwe app draaien op dezelfde origin → **auto-detectie** van `tj_`-data is de primaire route; JSON-import blijft fallback.

## Huidige risico's (waarom dit nodig is)
- `persist()` schrijft **fire-and-forget** naar IndexedDB (geen `await`, geen foutafhandeling) → write-failure = stil dataverlies.
- Migratie-hook is een **lege stub** en dekt alleen localStorage; IndexedDB-data heeft geen geversioneerd migratiepad.
- Fouten worden overal **stil geslikt** (`try/catch{}`).
- **Geen backup** vóór import/migratie (overschrijven direct).

## Fasering

### Fase 0 — Schrijf-veiligheid + foutmodule (fundament)
- Geverifieerd opslaan: `persist()`/`persistX()` async + resultaat gecontroleerd; falen → melding, geen stil verlies.
- `ErrorCenter`: `reportError(ctx, err, {severity, actions})` → gebufferde log (`sj_errlog`) + zichtbare melding (modal kritiek / banner-toast waarschuwing) + herstelacties + diagnostics-export.
- Globale vangnetten: `window.onerror` + `unhandledrejection` → ErrorCenter (geen wit scherm).
- Quota-bewaking: `navigator.storage.estimate()` + `QuotaExceededError`-afhandeling.

### Fase 1 — Snapshot & herstel
- `Snapshots`-module: auto-snapshot vóór risicovolle acties; laatste 3 in IndexedDB.
- Herstel-UI (Instellingen → Data): datum + trade-aantal, 1-klik herstel (snapshot huidige staat eerst).
- JSON-export blijft de draagbare backup.

### Fase 2 — Migratie-wizard oude app → SyncJournal
- Auto-detectie van `tj_`-data (zelfde origin) op eerste start → aanbod veilig overzetten.
- JSON-import-fallback (bestaat al) voor ander apparaat/browser.
- Flow: snapshot → validatie vooraf → migratie (trades + playbooks + accounts + capital-ledger + alle instellingen) → post-migratie-rapport → integriteitscheck → 1-klik herstel bij twijfel.
- Idempotent: `sj_migrated_from_tj`-vlag; nooit bestaande sj_-data overschrijven zonder bevestiging.

### Fase 3 — Nazorg: geversioneerde migratieketen + self-check
- Migratie-framework `migrations=[{v, up}]` (localStorage + IndexedDB): snapshot-vóór, in volgorde, rollback-bij-fout.
- Boot-time self-check (licht): valideer vorm van trades/playbooks/config; corruptie → ErrorCenter + herstel-aanbod.

### Fase 4 — Test & hardening
- Playwright/Node end-to-end: echte oude-app-fixture → migratie, write-failure/quota, corrupt-load, snapshot-restore round-trip, idempotentie, post-migratie-integriteit.
- Valideren tegen een échte export van Denny (accounts, mae/mfe, sessie-grenzen).

## Kortste veilige pad
Fase 0 → 1 → 2 = veilige, volledige overstap met vangnet. Fase 3 = toekomstbestendiging. Fase 4 loopt mee.

## Nog nodig van Denny
- Eén echte export uit de oude app om de veld-mapping tegen echte data te valideren.
