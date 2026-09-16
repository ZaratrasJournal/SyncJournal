# SyncJournal → eigen URL + backup-systeem — gefaseerd plan

*Opgesteld 2026-09-16 · status: wacht op go per fase · zie ook BACKLOG.md → "SyncJournal hosted op eigen domein"*

## Uitgangspunten (hard, gelden in elke fase)

1. **De gebruiker kiest** waar backups landen: **lokaal** (bestand/map) óf **Google Drive** — of alleen handmatig. Altijd opt-in, altijd omkeerbaar.
2. **JSON-export/-import blijft altijd bestaan** als universeel vangnet (werkt met elke methode, elk systeem).
3. **Backup-bewaking is provider-onafhankelijk**: de app stempelt élke geslaagde backup (handmatig, lokaal-automatisch of Drive) en **alarmeert duidelijk zodra de laatste backup ouder is dan 3 dagen** (drempel instelbaar).
4. Data blijft client-side (localStorage/IndexedDB); wij krijgen géén server-database. Drive-backups gaan naar de eigen Drive van het lid — wij zien niets.
5. Het domein wordt één keer gekozen en wisselt daarna **nooit** meer (origin = data). www → apex redirect vastleggen.
6. Berekeningen/gedrag van de app veranderen door niets in dit plan.

## Huidige stand (gemeten 2026-09-16, v0.9.58)

| Aanwezig | Ontbreekt |
|---|---|
| Handmatige JSON-export/-import (Instellingen → Data) | Registratie "laatste backup" + **>3-dagen-alarm** |
| Interne veiligheidskopieën vóór risicovolle acties (in-browser, laatste 3) | Automatische backup **buiten** de browser |
| Quota-waarschuwing (>90% vol) + crash-vangnet met exportknop | Keuze lokaal / Drive |
| FAQ-uitleg over backups en overzetten | Hosting, updatekanaal, Drive-koppeling |

---

## Fase 1 — Backup-fundament in de app *(kan direct, nog vóór hosting)*

**Doel: niemand kan meer ongemerkt lang zonder backup zitten.**

- `sj_backup`-status: tijdstip + methode van de laatste geslaagde backup; elke export/upload stempelt.
- **Indicator** in de app-balk of op het Dashboard: "Laatste backup: 2 dagen geleden" (groen ≤3 dagen).
- **Alarm**: ouder dan 3 dagen (instelbaar) → duidelijke amber banner met één-klik "Maak nu een backup". Niet wegklikbaar-voor-altijd; komt terug zolang er geen backup is. Bij >7 dagen wordt hij rood.
- **Automatische lokale backup** (de "lokaal"-keuze): eenmalig een map kiezen (File System Access API, Chrome/Edge) → de app schrijft daarna zelf gedateerde JSON-bestanden na wijzigingen (max 1×/dag, laatste 14 bewaard). Pro-tip in de UI: kies een map die al door Google Drive/OneDrive-desktop wordt gesynct → gratis cloud-kopie zonder koppeling. Browsers zonder deze API: nette terugval op de reminder + handmatige export.
- **Keuzescherm** (Instellingen → Data + welkomstscherm): "Waar wil je je backups?" → 📁 Lokale map (automatisch) / ☁️ Google Drive (beschikbaar in fase 3, alvast zichtbaar als 'binnenkort') / ✋ Alleen handmatig (met alarm).
- Spec: stempel-logica, drempel-alarm, FSA-schrijfroute, keuze-persistentie.

**Omvang:** ±1 dagdeel bouwen + testen. **Afhankelijkheden:** geen.

## Fase 2 — Live op de URL

**Doel: leden openen SyncJournal via het domein i.p.v. download+localhost.**

Denny (buiten de repo):
- Domeinnaam kiezen (naam/prijs — snelheid is geen criterium) en registreren; besluit apex vs www (en redirect).
- Cloudflare Pages aanmaken (zelfde account als de Worker), koppelen aan het domein. Brotli + cache-headers staan daar standaard goed.

In de app / repo:
- Release-artefact: `main/`-mirror + `version.json` (zelfde ritueel als de oude app) → Pages deployt vanaf main.
- `navigator.storage.persist()` aanvragen bij eerste bezoek (vermindert kans dat Safari/Chrome de opslag opruimt) + status tonen bij Instellingen → Data.
- `IS_HOSTED`-detectie + update-mechanisme: versie-check tegen `version.json`, banner "Nieuwe versie — ververs" (geen download-knop meer nodig op hosted).
- **Privacyverklaring-pagina** op het domein (ook harde eis voor Google-verificatie in fase 3).
- **Migratiepad voor bestaande leden** (belangrijk!): op localhost = andere origin, dus data reist niet mee. Comms + FAQ: "Exporteer JSON op je oude versie → open de nieuwe URL → Importeer." Fase-1-alarm vangt wie het vergeet.
- Optioneel 2b: service worker (PWA) → herhaalbezoek instant + offline bruikbaar.

**Omvang:** ±1 dagdeel app-werk; domein/DNS bij Denny. **Afhankelijkheid:** fase 1 gewenst (alarm beschermt bij de overstap), niet blokkerend.

## Fase 3 — Google Drive-backup (de ☁️-keuze wordt actief)

**Doel: automatische backup naar de eigen Drive van het lid + je journal meenemen naar elk systeem.**

Denny (eenmalig):
- Google Cloud-project + OAuth-toestemmingsscherm; verificatie aanvragen met de privacyverklaring uit fase 2. Scope: `drive.file` (lichtste traject — app kan alléén bij bestanden die hij zelf aanmaakt).

In de app:
- Koppel-flow (client-side OAuth, geen backend) → **zichtbare map "SyncJournal"** in de Drive van het lid (transparant: ze zien, downloaden en wissen hun eigen backups).
- Auto-upload na wijzigingen (uitgesteld, max ~1×/15 min), stempelt de backup-status → zelfde alarm dekt ook Drive.
- **Nieuwere-backup-check bij opstarten** (voorwaarde, geen extraatje): staat er in Drive een nieuwere backup dan de lokale staat → "Overnemen? (gisteren 21:14, ander apparaat)". Dit maakt het vreemde-systeem-scenario veilig: daar herstellen → werken → auto-upload → thuis melding → één klik bij.
- Vreemd-systeem-flow in de FAQ (incl. incognito-advies zodat er niets achterblijft).
- Token-verloop (1 uur) netjes afhandelen: stille verversing waar mogelijk, anders rustige her-login-prompt; mislukte uploads tellen NIET als backup (alarm blijft eerlijk).
- Vangnet bij divergentie (op beide plekken gewerkt zonder op te halen): per-trade samenvoegen op id + wijzigingstijd, met keuzedialoog.
- Spec met gemockte Drive-API (snapshot-fixture-patroon).

**Omvang:** ±2 dagdelen + Google-verificatie-doorlooptijd (dagen, loopt parallel). **Afhankelijkheid:** fase 2 (domein + privacyverklaring).

## Fase 4 — later, optioneel

- OneDrive als tweede connector in dezelfde backup-laag (als leden erom vragen).
- E2E-versleutelde multi-device-sync (Cloudflare Worker + D1 of Supabase) — pas als "twee apparaten door elkaar" een bewezen behoefte is. NUC blijft privé-speeltuin/testomgeving, geen community-productie.

## Beslispunten voor Denny

1. ~~Go voor fase 1?~~ ✅ **Gebouwd 2026-09-16 (v0.9.59)**: backup-status + 3-dagen-alarm (rood ≥7, drempel instelbaar), keuze map-automatisch / Drive-binnenkort / handmatig, FSA-map-backups met 14-dagen-retentie. Spec: tests/backup-guard.spec.js (20 checks).
2. ~~Domeinnaam?~~ ✅ **Besloten 2026-09-16: `syncjournal.nl`** (registreren bij NL-registrar, naamservers → Cloudflare; www → apex redirect). Tradingplan krijgt **`tradingplan.syncjournal.nl`** — subdomeinen zijn gratis en hebben elk een eigen origin/opslag (tp2: en sj_ botsen dus nooit). Eén privacyverklaring op syncjournal.nl dekt beide voor de Google-verificatie.
3. Alarm-drempel: 3 dagen standaard akkoord? (instelbaar per lid blijft)
4. Fase 2b (PWA/offline) meteen meenemen of apart?
