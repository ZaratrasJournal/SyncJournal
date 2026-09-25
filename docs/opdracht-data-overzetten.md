# Opdracht: data-overdracht die niet mis kan gaan (export-overzicht, import-keuze, diagnose)

**Datum:** 2026-09-25 · **Eigenaar:** Denny · **Uitvoering:** Claude in `work/syncjournal.html`
**Status:** gebouwd in v0.9.136 (2026-09-25) na demo `demos/data-overzetten-demo.html`. Specs: `export-overzicht` (21), `import-keuze` (21), `export-import-rondje` (74, vier datasets in `tests/helpers/dov-datasets.js`), `diagnose` (16). Open: stap 4-doorloop met Denny's eigen oude-app-export.

## 0. Doel

Members stappen over van de oude TradeJournal naar SyncJournal, en wisselen daarna van browser of
computer via back-ups. Dat moet zonder verlies en zonder verrassingen. Concreet:

1. Bij **exporteren** zie je vooraf precies wat er in het bestand gaat, met aantallen, en kies je
   wat meegaat.
2. Bij **importeren** zie je precies wat er in het bestand zit, kies je wat je overneemt, en krijg
   je achteraf een controle dat het klopt.
3. Een **diagnose-knop** die altijd zichtbaar is en ons in één bestand geeft wat we nodig hebben
   als een member zich meldt, zonder gevoelige gegevens.

Uitgangspunt: de bestaande migratie uit de oude app (controlescherm, veiligheidskopie,
integriteitscontrole) is het voorbeeld. Dezelfde discipline komt op de gewone export en import.

## 1. Wat er al is (niet opnieuw bouwen)

- `snapshotPayload()` = de volledige back-up: trades (notities, lessen, tags, TP's, stappen,
  screenshots als data-URI's, TradingView-links), `trash`, `tagConfig`, `pbook` (met
  voorbeeldafbeeldingen), `manual`, `conns` (API-sleutels in leesbare tekst), `sync`, `aiPrefs`,
  `view`, `exMeta`, `settings`, `tradingplan` (tekst; TradingPlan-screenshots niet).
- `exportJSON()` downloadt dat bestand direct. `importJSON()` herkent oud/nieuw, maakt een
  veiligheidskopie (`Snapshots`, laatste 3) en roept `applyBackup()` aan: alles vervangen.
- Oude-app-route: `TJMigrate` (zelfde browser én bestand) → `migPreview()` controlescherm →
  `migApply()` → `TJMigrate.verify()` (aantallen, gesloten trades, P&L op de cent).
- `ErrorCenter` (foutbalk, logboek van 30, `diagnostics()`-download alleen vanuit de balk),
  `selfCheck()` bij het opstarten.
- Opslag: IndexedDB `sj_db/kv` (`trades`, `trash`, `pbook`, `snapshots`, `snap_*`, `bk_dir`),
  localStorage `sj_*` (config, conns, manual, exmeta, tagconfig, state, view, sync, ai_prefs,
  backup, migrated_from_tj, errlog, data_ts), TradingPlan `tp2:*` + IndexedDB `tp2`.

## 2. Keuzes (vast te zetten vóór de bouw)

| # | Vraag | Advies | Besluit |
|---|-------|--------|---------|
| K1 | API-sleutels standaard mee in de export? | **Aan**, als apart vinkje met waarschuwing "zet uit als je dit bestand deelt". Eigen back-up moet direct weer kunnen syncen. | ✅ aan |
| K2 | Import: alleen vervangen per onderdeel, of ook samenvoegen? | **Beide**, vervangen als standaard. Samenvoegen ontdubbelt exchange-trades op bron-id en handmatige trades op datum + pair + richting + entry. | ✅ beide |
| K3 | Diagnose-rapport: download, klembord, of beide? | **Beide**, plus een korte samenvatting in het scherm zelf. | ✅ beide |

## 3. Scope

### 3.1 Export-overzicht

- Klik op **Exporteer JSON** opent eerst een modal "Wat gaat er mee?" met per onderdeel een regel:
  aantal, omvang (KB/MB), en een vinkje aan/uit.
  - Trades (n, waarvan met notities, screenshots, links, stappen) · Prullenbak (n) · Tags (n per
    categorie) · Playbooks (n, voorbeeldafbeeldingen n) · Handmatige accounts (n, transacties n) ·
    Exchange-koppelingen (n, "sleutels eindigend op …") · Saldi en accountnamen · Instellingen
    (thema, valuta, weergave) · AI-coach-voorkeuren · TradingPlan (plannen n, poort-records n,
    instellingen) · **API-sleutels** (apart vinkje, K1).
- Onderaan: totale bestandsgrootte en de bestandsnaam. Knop "Exporteren".
- Het bestand krijgt een `manifest`-blok: per onderdeel aantal, omvang, en of het is meegenomen.
  Daarnaast `appVersion`, `schemaVersion`, `exported`, `hostedVersion` (uit version.json als
  bereikbaar), en `keysIncluded: true|false`.
- Uitgezet onderdeel = sleutel ontbreekt in het bestand (niet leeg meegeven), zodat de import het
  correct als "niet aanwezig" toont.
- Automatische back-ups (map/Drive) blijven de volledige inhoud schrijven, met sleutels, zonder
  overzicht: die zijn voor jezelf. Dit noemen we in de modal.

### 3.2 Import-keuze

- Na het kiezen van een SyncJournal-bestand: modal "Wat zit erin en wat neem je over?".
  - Bovenaan: versie en datum van het bestand, aantal trades en netto P&L in het bestand
    tegenover je huidige journal.
  - Per onderdeel (zelfde lijst als 3.1) een regel met: aantal in bestand, aantal nu, vinkje
    overnemen, en voor trades de keuze **vervangen / samenvoegen** (K2).
  - Ontbreekt een onderdeel in het bestand → grijs, "niet in dit bestand", jouw huidige data
    blijft.
  - Sleutels in het bestand → melding "dit bestand bevat API-sleutels, ze worden alleen
    overgenomen als je Exchange-koppelingen aanvinkt".
- Uitvoering: veiligheidskopie (`Snapshots.create('vóór import')`), daarna alleen de aangevinkte
  onderdelen toepassen. `applyBackup(d)` blijft de motor; nieuw is een filterstap ervoor die
  niet-gekozen sleutels uit `d` haalt en bij "trades samenvoegen" de lijst samenstelt.
- Samenvoegen (K2): huidige trades blijven; uit het bestand komen alleen trades die er nog niet
  zijn. Gelijkheid: `srcId` als beide die hebben, anders `date + pair + dir + entry` (op 8
  decimalen) + `size`. Prullenbak-guard blijft gelden (verwijderde trades komen niet terug).
  `planRef` en `_demo` gaan mee zoals ze zijn.
- Achteraf: controlescherm zoals bij de migratie. Aantal trades verwacht = (vervangen: n in
  bestand) of (samenvoegen: n nu + n nieuw), P&L verwacht op de cent, gesloten trades. Afwijking
  → rood, met knop "Veiligheidskopie terugzetten". Geen afwijking → groene samenvatting per
  onderdeel: "412 trades overgenomen (38 nieuw), 6 playbooks, tags samengevoegd, sleutels
  overgeslagen".
- Oude-app-bestanden blijven via `migPreview` gaan. Toevoeging daar: een vaste regel "Gaat niet
  mee omdat SyncJournal het niet kent: discipline-vinkjes, weekreflecties, mindset-voorkeuren,
  mijlpalen, TP-templates; per trade compliance-vinkjes en -score, handmatige overschrijvingen."

### 3.3 Diagnose-rapport

- Instellingen → Data → panel **Hulp bij problemen** met knop "Diagnose-rapport" (altijd
  zichtbaar) en een samenvatting van drie regels in het scherm: versie + schema, aantallen,
  laatste sync per koppeling.
- Inhoud van het rapport (JSON, geen gevoelige gegevens: geen sleutels, geen notities, geen
  screenshots, geen wallet-adressen behalve laatste 4 tekens):
  - `app`: versie geladen, versie gehost (version.json), schemaversie, URL-host, `IS_HOSTED`,
    `LANDING_ALTIJD`, browser (userAgent), taal, tijdzone, klok-offset t.o.v. Date.now() in UTC.
  - `opslag`: `navigator.storage.estimate()` (gebruik, quota, %), `persisted`, aantal en omvang
    per IndexedDB-sleutel en per `sj_*`-localStorage-sleutel, aanwezigheid `tj_*` (oude app),
    `tp2:*` (TradingPlan) met aantallen.
  - `data`: trades totaal, per status, per kind, per exchange, met/zonder `srcId`, met stappen,
    open trades, datumbereik, trades zonder datum / zonder geldige P&L / zonder `openTime`,
    dubbele `srcId`, dubbele (date+pair+dir+entry) bij handmatige trades, prullenbak n,
    playbooks n, tags n, handmatige accounts n, snapshots (label, tijd, n), `migrated_from_tj`,
    `demo_loaded`.
  - `sync`: per koppeling: verbonden, hint (laatste 4), `lastSync`, `syncFrom`, autoSync,
    rate-limit-backoff actief tot, laatste sync-uitkomst; Worker-URL en of die bereikbaar is
    (één HEAD/OPTIONS, met time-out 3 s); sync-interval.
  - `backup`: keuze (map/Drive/zelf), laatste back-up, drempel, Drive verbonden, dirty-since.
  - `tradingplan`: aanwezig, plannen n, poort-records n, gekoppeld n, `cfg.matchMin`.
  - `zelfcontrole`: uitkomst van `selfCheck()` en de integriteitsregels uit 3.2 op de huidige
    data.
  - `fouten`: de laatste 30 uit `ErrorCenter.log`, en de laatste 20 console-fouten die tijdens
    deze sessie zijn opgevangen (window error / unhandledrejection, al aanwezig).
- Knoppen: **Download** (`syncjournal-diagnose-YYYY-MM-DD.json`) en **Kopieer** (klembord,
  compact JSON) (K3). Onderaan een zin: "Plak dit in Discord bij je melding, er staan geen
  sleutels of notities in."
- `ErrorCenter.diagnostics()` gaat hetzelfde rapport gebruiken (één bron).

### 3.4 Buiten scope

- Bewerken of inkijken van individuele trades in het importscherm.
- Migratie van oude-app-onderdelen die SyncJournal niet kent (zie 3.2, alleen benoemen).
- TradingPlan-screenshots in de journal-back-up (blijft TradingPlans eigen back-up).
- Automatisch versturen van het diagnose-rapport naar ons (blijft handmatig plakken).

## 4. Stappen (in deze volgorde, elk met spec + volledige suite groen + commit)

1. **Manifest + export-overzicht** (3.1). Spec `tests/export-overzicht.spec.js`: aantallen kloppen
   met de data, uitgezette onderdelen ontbreken in het bestand, sleutels-vinkje werkt, manifest
   aanwezig, bestandsgrootte binnen 5% van werkelijk.
2. **Import-keuze + controle achteraf** (3.2). Spec `tests/import-keuze.spec.js`: alleen gekozen
   onderdelen veranderen; ontbrekend onderdeel laat huidige data staan; samenvoegen ontdubbelt op
   `srcId` en op de handmatige sleutel; prullenbak-guard; P&L-controle slaat aan bij een bewust
   kapot bestand en biedt terugzetten aan; oud bestand gaat nog steeds via `migPreview`; de
   toevoeging "gaat niet mee" staat erin.
3. **Diagnose-rapport** (3.3). Spec `tests/diagnose.spec.js`: rapport bevat alle blokken, bevat
   géén `apiKey`/`apiSecret`/`passphrase`/`notes`/`data:image`, klembord-knop werkt, dubbele
   `srcId` en trades zonder datum worden gevonden, foutbalk-Details gebruikt hetzelfde rapport.
4. **Doorloop met echte data**: Denny's eigen oude-app-export → SyncJournal, daarna export met
   overzicht → verse browser → import met keuze → controle groen. Plus de demo-dataset.
5. Release: versie-bump, CHANGELOG, `cp work/syncjournal.html site/app.html`, mirror, push op
   Denny's woord.

## 5. Acceptatie

- Een member die exporteert weet vooraf wat er in het bestand zit, en kan sleutels weglaten.
- Een member die importeert ziet wat er in het bestand zit, kiest wat hij overneemt, en krijgt
  een controle die op de cent klopt of anders duidelijk rood is met een weg terug.
- Een member die zich meldt kan binnen één minuut een rapport plakken waaruit wij versie,
  opslag, aantallen, sync-status en fouten lezen, zonder dat er sleutels of notities in staan.
- Niets van dit alles verandert het gedrag van automatische back-ups, snapshots of de migratie
  uit de oude app, behalve de extra regel "gaat niet mee".
