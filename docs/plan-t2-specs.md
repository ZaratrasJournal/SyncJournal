# Plan T2 — verouderde specs herschrijven of schrappen

*Opgesteld 24-10-2026 op branch `t2-specs`. Backlog T2, zie `BACKLOG.md` en
`docs/teststrategie-2026-09-27.md`. `work/syncjournal.html` is niet aangeraakt.*

## Samenvatting

| | Aantal | Welke |
|---|---|---|
| **Herschreven** voor SyncJournal | **11** | smoke, themes, privacy-mode, design-review, a11y, trades-pagination, trades-niets-in-beeld (vervangt tradelist-hooks), tendencies-untagged, integrity-edge, exchange-isolation, okx-adapter — plus het fundament in `tests/helpers/` |
| **Geschrapt** (feature bestaat niet in SyncJournal, of toetst niets) | **33** | zes thema's (theme-toggle ging op in themes), Help/lessen, samenvoegen, share-card, bulk-taggen, tag-modal, validatie-tab, MEXC-API-cluster, Blofin-siblings, lege `test.skip` |
| **Al gedekt** door een release-spec (ook weg) | **28** | zie de kolom "dekking" per spec |
| **Wacht op besluit** van Denny | **13** | het AI-coach-cluster |
| **Blijft** (laadde SyncJournal al, groen) | **7** | faq-volledig, merged-children, soort-waarschuwing, tp-datum-tijd, proxy-clienttag, kraken-account-log, tradingplan-v2-demo |
| **Gevonden bugs** in de app | **7** | zie "Gevonden bugs"; elk staat als `FIXME` in een spec |

*11 + 33 + 28 + 13 + 7 = 92: elke spec die buiten de release-poort stond. 62 bestanden zijn met
`git rm` weg (33 + 28 + tradelist-hooks, dat als trades-niets-in-beeld terugkwam).*

- **Geen spec laadt nog alleen `work/tradejournal.html`**, behalve de 13 AI-coach-specs die bewust
  blijven staan tot het besluit over de AI-coach valt.
- **Alle herschreven specs zijn lokaal groen** (Windows, Chromium 1248 / Playwright 1.64.1).
  Een bekende bug telt in die specs als `⚠ FIXME (bekende bug)` en maakt de spec niet rood;
  is de bug weg, dan meldt de spec "FIXME lijkt opgelost, maak er weer ok() van".
- **Release-poort** (`node tests/run-release.js --hier`): vóór dit werk 124/125 (landing rood op
  CRLF in robots.txt, alleen op een Windows-checkout), erna 125/125 — zie "Metingen".
- **Niet lokaal geverifieerd**: de delen van de release-specs die echte exports nodig hebben
  (`tests/_fixtures/`, gitignored) — zie "Metingen". En `design-review` heeft nog geen baseline:
  die is bewust niet vastgelegd (zie "Voor Denny").

---

## Uitgangspunt

- Gemeten op 24-10-2026: `tests/` bevat **217** `*.spec.js`-bestanden, waarvan **125** in
  `tests/release-set.js`. Van de **92** andere laden er **84** alleen de bevroren oude app
  (`work/tradejournal.html`), 6 laden SyncJournal en 2 geen van beide.
- De 8 die niet de oude app laden zijn lokaal groen: `faq-volledig`, `kraken-account-log`
  (echte export overgeslagen), `merged-children`, `proxy-clienttag`, `soort-waarschuwing`,
  `tp-datum-tijd`, `tradingplan-v2-demo` en `manual-tp-auto-close` (een lege `test.skip`).
- Release-poort vóór dit werk: **124/125**. Rood: `landing` op de check *robots.txt*, omdat een
  Windows-checkout met `core.autocrlf=true` het bestand met `\r\n` uitpakt en de regex `\n` eist.
  Geen fout in de app of de site; de spec accepteert nu `\r?\n`.

## Stap 0 · Fundament

- `tests/helpers/dov-page.js` wacht op het eind van `boot()` in plaats van een vaste pauze: de
  laatste stap van `boot()` (`landingAankomst`) schrijft `sj_welcomed`, en een init-script vangt
  dat schrijven af (`window.__sjBoot`). Nieuw: `go(p, pagina)` (via de `go()` van de app, klaar als
  de paginakop staat), `seedTrades`, `reload`, `stil` (wacht tot het infaden van `#main` klaar is,
  voor screenshots en kleurmetingen), `mainText`, en de opties `klok` (vaste `Date.now`) en
  `timezoneId`.
- `tests/helpers/seed.js` zet geen `tj_`-sleutels meer; het verwijst door naar `dov-page.js`
  (`applyBackup` → `sanitizeTrade` → `sj_` + IndexedDB).
- De 11 specs die `dov-page.js` al gebruikten zijn daarna opnieuw gedraaid: 11/11 groen.
- `tests/run-all-sj.js` slaat een spec over als de bron `tradejournal.html` noemt zonder
  `syncjournal.html`. Specs die via `dov-page.js` laden moeten de oude bestandsnaam dus ook niet
  in een commentaar noemen (dat ging eerst mis bij zes herschreven specs).

## Regels voor het herschrijven

1. Naast elke "NIET getoond"-check een positieve check dat het scherm wél staat.
2. Nooit zoeken in `page.content()`: daar staat de broncode van de app ook in. Zoek in `#main`,
   `#modal` of een specifiek element.
3. Wachten op iets dat `boot()` zet (`H.openJournal` / `H.reload`), niet op de statische kop.
4. Seeden via de app (`H.seed` / `H.seedTrades`), navigeren via `H.go`.
5. Node-stijl (eigen `ok()`-teller, `=== Naam: n/n ===`), zoals de release-specs.
6. Een echte bug in de app: `fixme(naam, conditie, detail)` in plaats van `ok()`, plus een regel
   onder "Gevonden bugs". De spec blijft groen en meldt zelf wanneer de bug weg is.

## Triage

Besluiten: **herschrijven** · **schrappen** (de feature bestaat niet in SyncJournal) ·
**al gedekt** (een release-spec toetst hetzelfde gedrag; de oude spec is weg) ·
**wacht op besluit** · **blijft**. Schrappen en al gedekt = `git rm`; de geschiedenis staat in git.

### Fundament, weergave, thema's

| Spec | Toetste (oude app) | Besluit | Reden / dekking | Stand |
|---|---|---|---|---|
| smoke | app laadt, versie zichtbaar | herschrijven | boot zonder fout, elke pagina en elk Instellingen-tabblad rendert, versie in beeld, lege vs. gevulde Trades-lijst | groen 10/10 |
| themes | 6 thema's laden, body-class | herschrijven | licht en donker: themaknop, bewaren na herladen, achtergrond past bij thema, elke pagina + formulier, screenshots | groen 14/14 |
| theme-toggle | knop wisselt classic ↔ light | schrappen | opgegaan in `themes` | weg |
| design-review | pixel-diff 6 thema's × 3 schermen | herschrijven | 2 thema's × 5 schermen, vaste data en klok; oude baselines weggehaald | groen 1/1, 10 schermen zonder baseline (⏭️) |
| a11y | axe-core over 6 thema's | herschrijven | 2 thema's × dashboard/trades/instellingen/formulier, blokkeert op critical | groen 9/9 · 5 fixme |
| ux-audit-screenshots | maakt alleen screenshots | schrappen | toetst niets; `design-review` en `themes` maken dezelfde beelden | weg |
| privacy-mode | bedragen gemaskeerd | herschrijven | oog-knop, elk bedrag op dashboard/trades onleesbaar, bewaren, uitzetten | groen 11/11 · 2 fixme |
| trade-form-footer | footer-kleur in classic-thema | schrappen | React-modal en classic-thema bestaan niet; kleur-tokens bewaakt `theme-hook` | weg |
| trade-form-nav | scroll-spy-zijmenu in het formulier | schrappen | het formulier van SyncJournal heeft geen zijmenu | weg |
| validation-tab | validatie-checklist-tab | schrappen | bestaat niet in SyncJournal | weg |

### Help, lessen, FAQ

| Spec | Toetste | Besluit | Reden / dekking | Stand |
|---|---|---|---|---|
| help-tab-cleanup | Help-tab zonder startersguide | schrappen | geen Help/lessen in SyncJournal, alleen FAQ (`faq`, `faq-volledig`) | weg |
| blofin-lesson | les l18 in Help | schrappen | geen lessen | weg |
| exchange-lessons | lessen l19–l22 | schrappen | geen lessen | weg |
| lesson-grid-themes | lessen-grid in 6 thema's | schrappen | geen lessen, geen 6 thema's | weg |
| lesson-readability | typografie lesson-modal | schrappen | geen lessen | weg |
| lesson-themes | les l18 in 6 thema's | schrappen | geen lessen, geen 6 thema's | weg |

### Trades-lijst, formulier, tags

| Spec | Toetste | Besluit | Reden / dekking | Stand |
|---|---|---|---|---|
| trades-pagination | 100 per pagina, toon meer | herschrijven | Vorige/Volgende per 100; zoeken, filter en sorteren over de hele set en terug naar pagina 1; totaal over alles; randen 100 / 101 / krimpen | groen 13/13 |
| tradelist-hooks | React hook-fout bij gevuld → leeg → gevuld | herschrijven als `trades-niets-in-beeld` | React-fout bestaat niet; de overgang en het verschil leeg / niets in beeld (CLAUDE.md) wel | groen 10/10 |
| tendencies-untagged | patronen zonder tags | herschrijven | Tendencies zonder playbook/tags: edge en lek, heatmap, breakdown per sessie | groen 7/7 · 1 fixme |
| pnl-calc-button | P&L-knop alleen bij handmatige trade | al gedekt | `gesynct-vergrendeld` (calcTrade laat de exchange-P&L staan, handmatig/CSV bewerkbaar) | weg |
| pnl-consistency | Dashboard = Trades-pagina | al gedekt | `handmatig-statistieken` (dashboard, lijst-totaal en balans gelijk), `dashboard-live` | weg |
| walletonly-source | HL als bron in het formulier | al gedekt | `balance-sync` (één koppeling → filter en formulier tonen alleen die, met HL) | weg |
| bulk-tag-layered | bulk-taggen met lagen | schrappen | SyncJournal kent alleen bulk-verwijderen (gedekt door `trash`) | weg |
| tag-delete-modal | 3-keuze-modal bij tag verwijderen | schrappen | `removeTagCat` haalt een tag alleen uit de instellingen, trades houden hem; geen modal | weg |
| trade-flat-sync | lagen → platte tag-arrays | al gedekt | SyncJournal leidt tags af via `tradeTagsAll`; `tags-overzicht` toetst weergave, filters en statistieken | weg |
| share-card-pct | %-toggle op share-card | schrappen | geen share-card; delen gaat via het coach-pakket (`coach-share`) | weg |
| manual-tp-auto-close | lege `test.skip` | schrappen | toetst niets | weg |

### Accounts, saldo, backup, datums

| Spec | Toetste | Besluit | Reden / dekking | Stand |
|---|---|---|---|---|
| integrity-edge | datum na middernacht, rommel-import | herschrijven | 1 juli 00:30 Amsterdam (30 juni in UTC): lokale datum, fills, formulier, kalender, storting; rommel-back-up | groen 11/11 · 4 fixme |
| calc-unit | netPnl, calcRMultiple, … | al gedekt | `r-scenarios`, `r-zonder-stop`, `r-netto`, `pf-en-kpi`, `kleine-bedragen`, `robustness` | weg |
| account-delete-modal | trades behouden of verwijderen | al gedekt | `account-remove` | weg |
| account-tile-balance | tegel toont live API-saldo | al gedekt | `balance-sync` (saldo op het account, ook na herladen) | weg |
| account-type-cap | max 1 per exchange in dropdown | schrappen | één koppeling per exchange (`CONNS[id]`), geen dropdown; meerdere handmatige accounts: `handmatig-statistieken` | weg |
| balance-no-open-doublecount | open positie niet dubbel in balans | al gedekt | `handmatig-statistieken` (open trade telt niet in netto of balans); `totalBalance` telt geen posities | weg |
| dashboard-balance | storting op exchange-tracker | schrappen | exchanges hebben geen stortingen; handmatige: `handmatig-statistieken` | weg |
| dashboard-orphan-pnl | trades van verwijderd account | al gedekt | `account-remove`, `handmatig-statistieken` (account weg, trade terug uit prullenbak) | weg |
| multi-account-detail | master-detail crasht niet | al gedekt | React-crash bestaat niet; Instellingen met handmatig + HL: `account-remove`, `balance-sync` | weg |
| multi-account-migration | oude accounts-migratie | schrappen | migratie binnen de oude app; overzetten naar SyncJournal: `tj-migrate`, `tj-overzetten` | weg |
| multi-account-sources | filter-chips tonen namen | al gedekt | `balance-sync` (filter toont "Hyperliquid"), `handmatig-statistieken` | weg |
| multi-account-ui | twee FTMO-accounts via UI | al gedekt | `e2e-doorloop` (addManual), `handmatig-statistieken` (twee handmatige accounts) | weg |
| backup-autobackup | map-backup met FSA-mock | al gedekt | `backup-guard` (autoBackup, retentie, geen toestemming) | weg |
| backup-bewaker | indicator, reminder, snooze | al gedekt | `backup-guard` (banner, drempel, snooze, stempel) | weg |
| demo-backup-import | backup-knop importeert alles | al gedekt | `import-keuze`, `export-import-rondje` | weg |
| demo-dataset-import | demo-dataset laadt | al gedekt | `demo-dataset` | weg |

### Samenvoegen

| Spec | Toetste | Besluit | Reden / dekking | Stand |
|---|---|---|---|---|
| merge-trades | samenvoeg-UI | schrappen | SyncJournal kan niet samenvoegen; samengevoegde trades uit oude data: `merged-children` | weg |
| merge-manual-account | samenvoeg-gate per account | schrappen | idem | weg |
| merged-rr | master-SL na migratie | schrappen | migratie binnen de oude app; masters in SyncJournal: `merged-children` | weg |

### Exchanges

| Spec | Toetste | Besluit | Reden / dekking | Stand |
|---|---|---|---|---|
| exchange-isolation | detectPartials per adapter, geen kruisbesmetting | herschrijven | eigen adapter per exchange; siblings-model (MEXC, oud Kraken-pad) raakt geen andere exchange; levensloop-model heeft geen detectie; `kraken_pos_`-rijen blijven erbuiten | groen 12/12 |
| okx-adapter | positions-history normaliseren | herschrijven | ctVal, netto P&L, fees incl. funding, net-mode, EEA X-Perp, open posities, registratie (levensloop-model) | groen 14/14 |
| okx-partial-open | partial op open positie | al gedekt | `okx-partial`, `okx-partial-herstel` (het oude sibling-pad bestaat niet meer voor OKX) | weg |
| okx-tp-fills | fetchFills → TP's | al gedekt | `okx-subtype`, `stappen-open`, `execution-stappen` | weg |
| exchange-pipeline-cross | partial-scenario's per exchange | al gedekt | `partial-alle-exchanges` (OKX, Blofin, HL, Kraken door dezelfde levensloop) | weg |
| blofin-partial | open + siblings → partial | al gedekt | Blofin is levensloop-model; siblings-pad: `exchange-sync2`, `exchange-isolation`; Blofin: `blofin-levensloop` | weg |
| blofin-pipeline-scenarios | 10 sibling-scenario's Blofin | schrappen | Blofin gebruikt geen siblings meer (`detectPartials = null`) | weg |
| scenarios-klmn | velden blijven na sibling-merge | al gedekt | `exchange-sync2` (user-velden geadopteerd), `partial-alle-exchanges` (notities overleven) | weg |
| blofin-3way | CSV ↔ snapshot ↔ parser | al gedekt | `blofin-levensloop` (zelfde snapshots), `csv-import` | weg |
| blofin-real-data | echte snapshot door parser | al gedekt | `blofin-levensloop` | weg |
| hyperliquid-3way | CSV ↔ snapshot ↔ parser | al gedekt | `hl-echt`, `hyperliquid-levensloop` (zelfde snapshot), `csv-import` | weg |
| hyperliquid-real-data | echte snapshot door parser | al gedekt | `hl-echt`, `hyperliquid-levensloop` | weg |
| hyperliquid-refresh-dup | placeholder + fills → één trade | al gedekt | `exchange-sync2` (placeholder weg, user-velden over), `hl-partial-blijft` | weg |
| kraken-3way | CSV ↔ snapshot ↔ parser | al gedekt | `kraken-levensloop` (echte account-log), `kraken-csv-api`, `kraken-account-log` | weg |
| kraken-real-data | echte snapshot door parser | al gedekt | `kraken-levensloop` | weg |
| mexc-3way | XLSX ↔ snapshot ↔ parser | schrappen | MEXC-koppeling gestopt (`connectEx`/`syncExchange` geblokkeerd, zie `exchange-sync`) | weg |
| mexc-real-data | echte snapshot | schrappen | idem | weg |
| mexc-fallback-tp | fallback-TP | schrappen | idem; geen fetchFills voor MEXC | weg |
| mexc-fills-reconstruction | TP-reconstructie | schrappen | idem | weg |
| mexc-history-orders | history_orders → TP's | schrappen | idem | weg |
| mexc-pending-tps | pending TP's | schrappen | idem | weg |
| mexc-self-heal | TP-fetch-queue | schrappen | idem | weg |
| mexc-size-rehel | size-herstel | schrappen | idem; de normalizeTrade-migratie bestaat niet in SyncJournal | weg |
| mexc-size-rehel-v1297 | size-herstel, contract-fallback | schrappen | idem | weg |
| mexc-stale-open | stale open → closed | schrappen | idem | weg |
| mexc-tpfetched-retry | TP-fetch-markers | schrappen | idem | weg |

### AI-coach — wacht op besluit van Denny

Of de AI-coach blijft is nog niet besloten (backlog T2 stap 3). Deze specs zijn niet aangeraakt en
laden nog de oude app; `run-all-sj.js` slaat ze over.

aicoach-budget · aicoach-chat · aicoach-chat-2msg · aicoach-chat-context · aicoach-chat-layout ·
aicoach-chat-markdown · aicoach-chat-switch · aicoach-foundation · aicoach-popup ·
aicoach-popup-sidebar · aicoach-pretrade · aicoach-privacy · aicoach-weekly — **wacht op besluit**.

*(De backlog noemt 12; er staan er 13 in `tests/`.)*

### Laadden SyncJournal al — blijven

| Spec | Stand 24-10 |
|---|---|
| faq-volledig | groen 14/14 |
| merged-children | groen 11/11 |
| soort-waarschuwing | groen 13/13 |
| tp-datum-tijd | groen 14/14 |
| proxy-clienttag | groen 6/6 |
| kraken-account-log | groen 32/32, echte export overgeslagen |
| tradingplan-v2-demo | groen 31/31 (toetst `demos/`, niet de app) |

## Gevonden bugs

Geen ervan is gefixt: `work/syncjournal.html` is niet aangeraakt. Elke bug staat als `FIXME` in de
genoemde spec.

| # | Spec | Wat er misgaat | Verwacht | Gezien |
|---|---|---|---|---|
| 1 | privacy-mode | Privacy-modus laat de regel "N trades · netto …" onder de balkjes (`hbars`) leesbaar: dashboard (win-rate per groep, `groupRows`) en Analytics (long/short); in de broncode heeft de prestatie-breakdown op Tendencies hetzelfde patroon (niet door de spec bezocht). De `<b>` met het bedrag mist de `mask`-class. | bedrag vervaagd | `+$ 913` leesbaar |
| 2 | privacy-mode | Analytics toont onder privacy-modus nog meer bedragen leesbaar: max drawdown (`.tv`), netto per groep (`.gr-net`), gem. winst / gem. verlies, grootste winst / grootste verlies, verwachting per trade, grootste enkele verlies. | alle bedragen vervaagd | o.a. `−$ 321`, `+$ 1.235`, `+$ 457` leesbaar |
| 3 | a11y | De invoervelden van het trade-formulier hebben geen gekoppeld label (axe `label`, impact critical): 14 velden, o.a. `#f_date`, `#f_entry`, `#f_exit`. Een schermlezer leest alleen "invoerveld". | `<label for>` of `aria-label` per veld | 14× zonder label, licht én donker |
| 4 | a11y | Een gesloten formulier blijft in de toegankelijkheidsboom: `#modal` gaat dicht met `opacity:0; pointer-events:none`, zonder `visibility:hidden`, `inert` of `aria-hidden`. Na één keer openen vindt een schermlezer de 14 velden op elke pagina. | dicht = onzichtbaar voor hulpmiddelen | velden blijven vindbaar na `closeForm()` |
| 5 | integrity-edge | Tussen 00:00 en 02:00 (Nederlandse tijd) is "vandaag" op drie plekken de UTC-dag: de datum van een nieuwe trade (`openForm(null)`, `new Date().toISOString().slice(0,10)`), de maand waarop de Kalender opent (`STATE.calMonth`) en de datum van een storting/opname op een handmatig account (`addAcctTx`, ook `addManual` en de oude-balans-migratie). `_today` gebruikt hetzelfde patroon. `localDateISO()` bestaat en klopt wel. | 1 juli / juli | 30 juni / juni |
| 6 | integrity-edge | Een back-up met een object zonder één trade-veld (`[{foo:'bar'}, 1, 'x', null]`) telt in het keuzescherm als **1 trade**; "vervangen" staat voorgeselecteerd, dus bevestigen vervangt je journal door één lege trade (er is wel een veiligheidskopie). Een array met alleen rommel geeft wél een nette melding, maar via een gevangen TypeError in `looksOldExport`. | 0 trades, of een melding | "1 in bestand" |
| 7 | tendencies-untagged | De kruis-analyse start op Playbook × Sessie. Zonder playbooks toont hij een tabel met alleen een kopregel: geen rijen en geen lege staat (CLAUDE.md: "een grafiek zonder data hoort een lege staat te tonen"). | lege staat of een andere startdimensie | kop `London · Weekend · Asia`, 0 rijen |

Gezien, niet als bug genoteerd (alleen gelogd door `a11y`): axe meldt "serious" kleurcontrast,
in licht ~170× op Trades tegen ~15× in donker, en `label-content-name-mismatch` op de knop
"Long of short". Dat kan een bewuste ontwerpkeuze zijn; eerst als baseline bekijken.

## Metingen

Eindstand 24-10-2026 op branch `t2-specs`, lokaal (Windows 11, Node 24.14.1, Playwright 1.64.1,
Chromium headless shell 1248):

| Run | Vóór | Na |
|---|---|---|
| `node tests/run-release.js --hier` | 124/125 (landing: CRLF) | **125/125** · 2,8 min |
| `node tests/run-all-sj.js` (hele map, min uitsluitlijst en oude-app-specs) | 125 + 6 groen, 81 overgeslagen | **141/141** · 3,1 min · 13 overgeslagen (AI-coach) |
| `node tests/design-review.spec.js` | — | 1/1 · 10 schermen zonder baseline (⏭️) |
| `node tests/a11y.spec.js` | — | 9/9 · 5 fixme |

**Niet lokaal geverifieerd:** de delen die echte exports uit `tests/_fixtures/` nodig hebben
(gitignored, niet in deze worktree): `csv-import`, `hl-echt`, en de fixture-delen van
`blofin-levensloop`, `hyperliquid-levensloop`, `kraken-levensloop`, `okx-levensloop`,
`scenario-levensloop` en `kraken-account-log` meldden ⏭️. Op die delen leunen de "al gedekt"-
besluiten voor de oude `*-3way`- en `*-real-data`-specs; draai ze in Denny's eigen kloon.

## Voorstel release-poort

Niet zelf toegevoegd aan `tests/release-set.js`. Voorstel om op te nemen:

| Spec | Waarom hij een release moet kunnen tegenhouden |
|---|---|
| smoke | de snelste "is de build heel"-check |
| exchange-isolation | bewaakt de exchange-isolatie uit CLAUDE.md bij elke wijziging aan gedeelde partial-code |
| okx-adapter | OKX-normalisatie (netto P&L, ctVal, X-Perps) |
| integrity-edge | datums rond middernacht en rommel-import (risico 1–2 uit de teststrategie) |
| trades-pagination, trades-niets-in-beeld | de Trades-lijst bij veel en bij nul resultaten |
| privacy-mode | leden maken screenshots voor de community met privacy aan |
| themes | elke pagina in licht en donker |
| tendencies-untagged | Tendencies voor wie niets tagt |
| faq-volledig, merged-children, soort-waarschuwing, tp-datum-tijd, proxy-clienttag, kraken-account-log | laadden SyncJournal al en zijn groen; `proxy-clienttag` raakt `proxyCall`, dus OKX, MEXC en Kraken tegelijk |

`design-review` en `a11y` horen in de eigen, tragere poort (ze staan in de uitsluitlijst van
`run-all-sj.js`). De `FIXME`-checks maken een spec niet rood, dus ze blokkeren een release niet
zolang de bug bekend is.

## Voor Denny

- **Design-review-baseline vastleggen** na een blik op de screenshots (bewuste UI-keuze, CLAUDE.md):
  `node tests/design-review.spec.js`, dan
  `cp tests/screenshots/design-review/*.png tests/screenshots/baseline/design-review/` en committen.
  Twee runs achter elkaar verschilden lokaal 0,00–0,05%, de drempel is 2%.
- **CLAUDE.md loopt achter** (niet aangepast, dat is aan jou): sectie "Autonome testing" noemt nog
  `blofin-partial.spec.js` en zes thema's in `themes.spec.js`, `helpers/seed.js` als
  `seedLocalStorage`, `npx playwright test tests/smoke.spec.js` (nu `node tests/smoke.spec.js`) en
  de baseline-map `tests/screenshots/baseline/themes/` (weg; `themes` maakt alleen screenshots).
  De Worker-sectie verwijst naar `tests/mexc-history-orders.spec.js` als voorbeeld (geschrapt).
- **AI-coach**: na het besluit de 13 specs herschrijven of schrappen.

## Buiten deze ronde

- **37 losse scripts** in `tests/` (geen `*.spec.js`: `run-*.js`, `*-logic.js`, `mexc-sl-*.js`,
  `perf-*.js`, …) laden nog `work/tradejournal.html`. Ze draaien in geen enkele runner. Voorstel:
  dezelfde triage in een volgende ronde; de meeste zijn eenmalige onderzoeks- of debugscripts.
- `EMPTY_TRADE` in SyncJournal heeft nog de vorm van de oude app (`direction`, `positionSize`,
  `source: 'manual'`, …). Specs die `{ ...EMPTY_TRADE, ...rij }` gebruiken krijgen die velden mee;
  geen bug gevonden, wel iets om te weten bij het lezen van testdata.
