# Plan T2 — verouderde specs herschrijven of schrappen

*Opgesteld 24-10-2026 op branch `t2-specs`. Backlog T2, zie `BACKLOG.md` en
`docs/teststrategie-2026-09-27.md`.*

## Samenvatting

*(wordt aan het eind van het werk ingevuld)*

---

## Uitgangspunt

- Gemeten op 24-10-2026: `tests/` bevat **217** `*.spec.js`-bestanden, waarvan **125** in
  `tests/release-set.js`. Van de **92** andere laden er **84** alleen de bevroren oude app
  (`work/tradejournal.html`), 6 laden SyncJournal en 2 geen van beide.
- De 8 die niet de oude app laden zijn lokaal groen: `faq-volledig`, `kraken-account-log`
  (echte export overgeslagen), `merged-children`, `proxy-clienttag`, `soort-waarschuwing`,
  `tp-datum-tijd`, `tradingplan-v2-demo` en `manual-tp-auto-close` (een lege `test.skip`).
- Release-poort vóór dit werk (`node tests/run-release.js --hier`): **124/125**. Rood:
  `landing` op de check *robots.txt*, omdat een Windows-checkout met `core.autocrlf=true`
  het bestand met `\r\n` uitpakt en de regex `\n` eist. Geen fout in de app of de site.

## Stap 0 · Fundament

- `tests/helpers/dov-page.js` wacht nu op het eind van `boot()` in plaats van een vaste
  pauze: de laatste stap van `boot()` (`landingAankomst`) schrijft `sj_welcomed`, en een
  init-script vangt dat schrijven af (`window.__sjBoot`). Nieuw: `go(p, pagina)` (via de
  `go()` van de app, klaar als de paginakop staat), `seedTrades`, `reload`, `mainText`.
- `tests/helpers/seed.js` zet geen `tj_`-sleutels meer; het verwijst door naar `dov-page.js`
  (`applyBackup` → `sanitizeTrade` → `sj_` + IndexedDB).
- De 11 specs die `dov-page.js` al gebruikten zijn daarna opnieuw gedraaid: 11/11 groen.

## Regels voor het herschrijven

1. Naast elke "NIET getoond"-check een positieve check dat het scherm wél staat.
2. Nooit zoeken in `page.content()`: daar staat de broncode van de app ook in. Zoek in
   `#main`, `#modal` of een specifiek element.
3. Wachten op iets dat `boot()` zet (`H.openJournal` / `H.reload`), niet op de statische kop.
4. Seeden via de app (`H.seed` / `H.seedTrades`), navigeren via `H.go`.
5. Node-stijl (eigen `ok()`-teller, `=== Naam: n/n ===`), zoals de release-specs.

## Triage

Besluiten: **herschrijven** · **schrappen** (de feature bestaat niet in SyncJournal) ·
**al gedekt** (een release-spec toetst hetzelfde gedrag; de oude spec gaat weg) ·
**wacht op besluit** · **blijft** (laadt SyncJournal al en is groen).

Schrappen en al gedekt = `git rm`; de reden staat hier, de geschiedenis in git.

### Fundament, weergave, thema's

| Spec | Toetste (oude app) | Besluit | Reden / dekking | Stand |
|---|---|---|---|---|
| smoke | app laadt, versie zichtbaar | herschrijven | basiscontrole, bestaat niet voor SyncJournal | gepland |
| themes | 6 thema's laden, body-class | herschrijven | SyncJournal heeft licht en donker; elke pagina in beide thema's | gepland |
| theme-toggle | knop wisselt classic ↔ light | schrappen | opgenomen in de nieuwe `themes` (knop, bewaren na herladen) | gepland |
| design-review | pixel-diff 6 thema's × 3 schermen | herschrijven | thema-pixeldiff is een bewust vangnet (CLAUDE.md); 2 thema's × 3 schermen | gepland |
| a11y | axe-core over 6 thema's | herschrijven | idem, 2 thema's × 3 schermen | gepland |
| ux-audit-screenshots | maakt alleen screenshots | schrappen | toetst niets (stond al in de uitsluitlijst); `design-review` maakt dezelfde beelden | gepland |
| privacy-mode | bedragen gemaskeerd | herschrijven | `togglePriv` bestaat, geen release-spec toetst het | gepland |
| trade-form-footer | footer-kleur in classic-thema | schrappen | React-modal en classic-thema bestaan niet; kleur-tokens bewaakt `theme-hook` | gepland |
| trade-form-nav | scroll-spy-zijmenu in het formulier | schrappen | het formulier van SyncJournal heeft geen zijmenu | gepland |
| validation-tab | validatie-checklist-tab | schrappen | bestaat niet in SyncJournal | gepland |

### Help, lessen, FAQ

| Spec | Toetste | Besluit | Reden / dekking | Stand |
|---|---|---|---|---|
| help-tab-cleanup | Help-tab zonder startersguide | schrappen | SyncJournal heeft geen Help/lessen, alleen FAQ (`faq`, `faq-volledig`) | gepland |
| blofin-lesson | les l18 in Help | schrappen | geen lessen | gepland |
| exchange-lessons | lessen l19–l22 | schrappen | geen lessen | gepland |
| lesson-grid-themes | lessen-grid in 6 thema's | schrappen | geen lessen, geen 6 thema's | gepland |
| lesson-readability | typografie lesson-modal | schrappen | geen lessen | gepland |
| lesson-themes | les l18 in 6 thema's | schrappen | geen lessen, geen 6 thema's | gepland |

### Trades-lijst, formulier, tags

| Spec | Toetste | Besluit | Reden / dekking | Stand |
|---|---|---|---|---|
| trades-pagination | 100 per pagina, toon meer | herschrijven | SyncJournal pagineert (`setTradePage`), geen release-spec | gepland |
| tradelist-hooks | React hook-fout bij gevuld → leeg → gevuld | herschrijven | React-fout bestaat niet, maar de overgang (filter laat niets over → "niets in beeld" → weer gevuld) is de toestand uit CLAUDE.md; nieuwe naam `trades-niets-in-beeld` | gepland |
| pnl-calc-button | P&L-knop alleen bij handmatige trade | al gedekt | `gesynct-vergrendeld` (calcTrade laat de exchange-P&L staan, handmatig/CSV bewerkbaar) | gepland |
| pnl-consistency | Dashboard = Trades-pagina | al gedekt | `handmatig-statistieken` (dashboard, lijst-totaal en balans gelijk), `dashboard-live` | gepland |
| walletonly-source | HL als bron in het formulier | al gedekt | `balance-sync` (één koppeling → filter en formulier tonen alleen die, met HL) | gepland |
| bulk-tag-layered | bulk-taggen met lagen | schrappen | SyncJournal kent alleen bulk-verwijderen (gedekt door `trash`) | gepland |
| tag-delete-modal | 3-keuze-modal bij tag verwijderen | schrappen | SyncJournal haalt een tag alleen uit de instellingen (`removeTagCat`), trades houden hem; geen modal | gepland |
| trade-flat-sync | lagen → platte tag-arrays | al gedekt | SyncJournal leidt tags af via `tradeTagsAll`; `tags-overzicht` toetst weergave + filters + statistieken | gepland |
| tendencies-untagged | patronen zonder tags | herschrijven | Tendencies zonder tags moet iets zinnigs tonen; `tendencies` seedt alleen getagde trades | gepland |
| share-card-pct | %-toggle op share-card | schrappen | SyncJournal heeft geen share-card; delen gaat via het coach-pakket (`coach-share`) | gepland |
| manual-tp-auto-close | lege `test.skip` | schrappen | toetst niets | gepland |

### Accounts, saldo, backup

| Spec | Toetste | Besluit | Reden / dekking | Stand |
|---|---|---|---|---|
| account-delete-modal | trades behouden of verwijderen | al gedekt | `account-remove` | gepland |
| account-tile-balance | tegel toont live API-saldo | al gedekt | `balance-sync` (saldo op het account, ook na herladen) | gepland |
| account-type-cap | max 1 per exchange in dropdown | schrappen | SyncJournal heeft één koppeling per exchange (`CONNS[id]`), geen dropdown; meerdere handmatige accounts toetst `handmatig-statistieken` | gepland |
| balance-no-open-doublecount | open positie niet dubbel in balans | al gedekt | `handmatig-statistieken` (open trade telt niet in netto of balans); `totalBalance` telt geen posities | gepland |
| dashboard-balance | storting op exchange-tracker | schrappen | exchanges hebben in SyncJournal geen stortingen; handmatige stortingen: `handmatig-statistieken` | gepland |
| dashboard-orphan-pnl | trades van verwijderd account | al gedekt | `account-remove`, `handmatig-statistieken` (account weg, trade terug uit prullenbak) | gepland |
| multi-account-detail | master-detail crasht niet | al gedekt | React-crash bestaat niet; Instellingen met handmatig + HL: `account-remove`, `balance-sync` | gepland |
| multi-account-migration | oude accounts-migratie | schrappen | migratie van de oude app; SyncJournal-overzetten: `tj-migrate`, `tj-overzetten` | gepland |
| multi-account-sources | filter-chips tonen namen | al gedekt | `balance-sync` (filter toont "Hyperliquid"), `handmatig-statistieken` | gepland |
| multi-account-ui | twee FTMO-accounts via UI | al gedekt | `e2e-doorloop` (addManual), `handmatig-statistieken` (twee handmatige accounts) | gepland |
| backup-autobackup | map-backup met FSA-mock | al gedekt | `backup-guard` (autoBackup, retentie, geen toestemming) | gepland |
| backup-bewaker | indicator, reminder, snooze | al gedekt | `backup-guard` (banner, drempel, snooze, stempel) | gepland |
| demo-backup-import | backup-knop importeert alles | al gedekt | `import-keuze`, `export-import-rondje` | gepland |
| demo-dataset-import | demo-dataset laadt | al gedekt | `demo-dataset` | gepland |
| integrity-edge | datum na middernacht, rommel-import | herschrijven | `localDateISO`/`ts2date` bestaan; `robustness` dekt alleen de import, niet middernacht | gepland |
| calc-unit | netPnl, calcRMultiple, … | al gedekt | `r-scenarios`, `r-zonder-stop`, `r-netto`, `pf-en-kpi`, `kleine-bedragen`, `robustness` | gepland |

### Samenvoegen

| Spec | Toetste | Besluit | Reden / dekking | Stand |
|---|---|---|---|---|
| merge-trades | samenvoeg-UI | schrappen | SyncJournal kan niet samenvoegen; samengevoegde trades uit oude data: `merged-children` | gepland |
| merge-manual-account | samenvoeg-gate per account | schrappen | idem | gepland |
| merged-rr | master-SL na migratie | schrappen | migratie van de oude app; weergave van masters: `merged-children` | gepland |

### Exchanges

| Spec | Toetste | Besluit | Reden / dekking | Stand |
|---|---|---|---|---|
| exchange-isolation | detectPartials per adapter, geen kruisbesmetting | herschrijven | het principe uit CLAUDE.md; `exchange-sync` toetst alleen dat de adapters bestaan | gepland |
| exchange-pipeline-cross | partial-scenario's per exchange | al gedekt | `partial-alle-exchanges` (OKX, Blofin, HL, Kraken door dezelfde levensloop) | gepland |
| blofin-partial | open + siblings → partial | al gedekt | Blofin is model B (geen siblings); siblings-pad: `exchange-sync2`; Blofin: `blofin-levensloop` | gepland |
| blofin-pipeline-scenarios | 10 sibling-scenario's Blofin | schrappen | Blofin gebruikt in SyncJournal geen siblings meer (`detectPartials=null`) | gepland |
| scenarios-klmn | velden blijven na sibling-merge | al gedekt | `exchange-sync2` (user-velden geadopteerd), `partial-alle-exchanges` (notities overleven) | gepland |
| blofin-3way | CSV ↔ snapshot ↔ parser | al gedekt | `blofin-levensloop` (echte export, lokaal), `csv-import` | gepland |
| blofin-real-data | echte snapshot door parser | al gedekt | `blofin-levensloop` | gepland |
| hyperliquid-3way | CSV ↔ snapshot ↔ parser | al gedekt | `hl-echt`, `hyperliquid-levensloop` | gepland |
| hyperliquid-real-data | echte snapshot door parser | al gedekt | `hl-echt` | gepland |
| hyperliquid-refresh-dup | placeholder + fills → één trade | al gedekt | `exchange-sync2` (placeholder weg, user-velden over), `hl-partial-blijft` | gepland |
| kraken-3way | CSV ↔ snapshot ↔ parser | al gedekt | `kraken-levensloop`, `kraken-csv-api`, `kraken-account-log` | gepland |
| kraken-real-data | echte snapshot door parser | al gedekt | `kraken-levensloop` | gepland |
| okx-adapter | positions-history normaliseren | al gedekt | `okx-levensloop`, `okx-ctval`, `okx-positie`, `okx-subtype` | gepland |
| okx-partial-open | partial op open positie | al gedekt | `okx-partial`, `okx-partial-herstel` | gepland |
| okx-tp-fills | fetchFills → TP's | al gedekt | `okx-subtype`, `stappen-open`, `execution-stappen` | gepland |
| mexc-3way | XLSX ↔ snapshot ↔ parser | schrappen | MEXC-koppeling is gestopt (`deprecated`, `connectEx`/`syncExchange` geblokkeerd, zie `exchange-sync`) | gepland |
| mexc-real-data | echte snapshot | schrappen | idem | gepland |
| mexc-fallback-tp | fallback-TP | schrappen | idem; geen fetchFills voor MEXC | gepland |
| mexc-fills-reconstruction | TP-reconstructie | schrappen | idem | gepland |
| mexc-history-orders | history_orders → TP's | schrappen | idem | gepland |
| mexc-pending-tps | pending TP's | schrappen | idem | gepland |
| mexc-self-heal | TP-fetch-queue | schrappen | idem | gepland |
| mexc-size-rehel | size-herstel | schrappen | idem; normalizeTrade-migratie bestaat niet in SyncJournal | gepland |
| mexc-size-rehel-v1297 | size-herstel, contract-fallback | schrappen | idem | gepland |
| mexc-stale-open | stale open → closed | schrappen | idem | gepland |
| mexc-tpfetched-retry | TP-fetch-markers | schrappen | idem | gepland |

### AI-coach — wacht op besluit van Denny

Of de AI-coach blijft is nog niet besloten (backlog T2 stap 3, community-survey). Deze specs
blijven onaangeroerd staan en laden de oude app.

| Spec | Stand |
|---|---|
| aicoach-budget | wacht op besluit |
| aicoach-chat | wacht op besluit |
| aicoach-chat-2msg | wacht op besluit |
| aicoach-chat-context | wacht op besluit |
| aicoach-chat-layout | wacht op besluit |
| aicoach-chat-markdown | wacht op besluit |
| aicoach-chat-switch | wacht op besluit |
| aicoach-foundation | wacht op besluit |
| aicoach-popup | wacht op besluit |
| aicoach-popup-sidebar | wacht op besluit |
| aicoach-pretrade | wacht op besluit |
| aicoach-privacy | wacht op besluit |
| aicoach-weekly | wacht op besluit |

*(De backlog noemt 12; er staan er 13 in `tests/`.)*

### Laden SyncJournal al en zijn groen — blijven

| Spec | Stand 24-10 | Voorstel release-poort |
|---|---|---|
| faq-volledig | 14/14 | ja: elke FAQ-vraag opent en heeft inhoud |
| merged-children | 11/11 | ja: samengevoegde kinderen tellen niet dubbel (P&L) |
| soort-waarschuwing | 13/13 | ja |
| tp-datum-tijd | 14/14 | ja |
| proxy-clienttag | 6/6 | ja: raakt `proxyCall`, dus OKX + MEXC + Kraken tegelijk |
| kraken-account-log | 32/32, echte export overgeslagen | ja |
| tradingplan-v2-demo | 31/31 | nee: toetst `demos/`, niet de app |

## Gevonden bugs

*(nog niets)*

## Buiten deze ronde

- **37 losse scripts** in `tests/` (geen `*.spec.js`: `run-*.js`, `*-logic.js`, `mexc-sl-*.js`,
  `perf-*.js`, …) laden nog `work/tradejournal.html`. Ze draaien in geen enkele runner.
  Voorstel: in een volgende ronde dezelfde triage; de meeste zijn eenmalige onderzoeks- of
  debugscripts en kunnen weg.
