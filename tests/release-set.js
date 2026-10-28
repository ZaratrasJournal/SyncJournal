// De specs die bij een RELEASE groen moeten zijn.
//
// Waarom een expliciete lijst en niet "alles in tests/": ongeveer de helft van de map
// beschrijft nog de oude TradeJournal (verdwenen UI, hernoemde teksten) en staat rood
// zonder dat er iets aan de app mankeert. Zie backlog T2. Zodra die klaar is, kan dit
// bestand weg en is de map zelf weer de poort.
//
// Waarom een eigen bestand: tot 29-09-2026 stond deze lijst alleen nog in de git-historie
// van run-all-sj.js, omdat die runner de map ging lezen. Om v1.1 te kunnen vrijgeven moest
// hij met `git show HEAD:tests/run-all-sj.js` teruggehaald worden. Een release-poort die je
// kwijtraakt door een commit is geen poort.
//
// Nieuwe spec toevoegen? Zet hem hier ook neer als hij een release moet kunnen tegenhouden.
module.exports = [
  'e2e-doorloop',            // ← de grote doorloop, draait eerst en alleen (vangt integratie-breuken meteen)

  // fundament: opslag, backup, weergave, demo-data
  'backup-guard', 'drive-backup', 'drive-broker', 'hosted', 'weergave-presets', 'demo-dataset',
  'pb-demo-cleanup', 'pb-layers', 'duration', 'changemaker-feedback', 'fout-filter', 'default-tags',
  'multifilter', 'playbook-filter', 'kraken-opentijd', 'kraken-accountlog-sync', 'kraken-csv-api', 'worker-accountlog', 'worker-triggers', 'worker-executions', 'worker-okx-algos', 'okx-ctval', 'okx-stoploss', 'kraken-stoploss', 'kraken-stappen', 'valuta-formulier', 'backtest-zonder-exchange', 'trades-sortering', 'integratie-breed', 'stress-vandaag', 'csv-import',

  // exchanges: sync, saldo, levensloop per beurs
  'exchange-sync', 'exchange-sync2', 'balance-sync', 'auto-sync', 'valuta',
  'okx-positie', 'okx-levensloop', 'okx-subtype', 'okx-partial', 'okx-partial-herstel',
  'partial-alle-exchanges', 'hyperliquid-levensloop', 'hl-open-tijd', 'blofin-levensloop',
  'auto-sync-pauze',         // blijvende sleutelfout: auto-sync stopt, handmatig syncen kan altijd
  'web-analytics',           // meetscript alleen op syncjournal.nl, niet op de werkversie of lokaal
  'worker-monitoring',       // de Worker-telling voor het dagrapport lekt geen sleutels of IP's
  'worker-v25',              // v25: okxHost alleen naar OKX, algos zonder orders-history, websites meten/afdwingen
  'okx-overzetten',          // oude backup: losse OKX-trades met dezelfde posId blijven apart (member Jarne)
  'nieuwe-positie-na-pauze', // dagen niet gesynct: nieuwe positie op dezelfde coin krijgt haar eigen datum
  'stappen-open',            // OKX en Blofin: de stappen van een open positie, vanaf de opening
  'hl-deels-dicht',          // Hyperliquid: een geraakte TP is zichtbaar terwijl de positie nog loopt
  'valuta-koers',            // euro-saldo is een schatting: ≈, ECB-koers met datum, oranje bij een oude koers
  'partial-unrealized',      // een partial toont ook de unrealized P&L van de rest (klein, telt nergens mee)
  'sync-logboek',            // elke sync vastgelegd: rij per koppeling, stip bij de balans, geschiedenis, export
  'eenheid-paginas',         // de $ / % / R-schakelaar geldt op Dashboard, Analytics, Tendencies en Kalender
  'kraken-deels-dicht',      // Kraken: een geraakte TP en de stappen zichtbaar terwijl de positie nog loopt
  'hl-partial-blijft',       // Hyperliquid: een deels gesloten positie blijft één partial-rij, sync na sync
  'hl-stoploss',             // Hyperliquid: stop-loss, ingestelde TP's en TP/SL/Close per afbouw uit de orders (F8)
  'equity-curve',            // equity-curve van oud naar nieuw, zonder verzonnen toppen; geen 493%-trend
  'jaaroverzicht-past',      // Kalender: het jaaroverzicht past in zijn paneel, ook op een laptop
  'tijdframe-analytics',     // Tendencies tijdframe/combinatie/HTF-bias, HTF-paneel, lagen-patronen per playbook
  'lagen-topdown',           // setup-lagen top-down op tijdframe; entry-laag bepaalt het tijdframe
  'playbook-r',              // R overal netto ÷ risico: playbook-kaart, cumulatieve R, R per duur, prullenbak
  'lopend-niet-meegeteld',   // geboekt geld telt (ook van een lopende positie), uitkomsten pas als hij dicht is
  'hl-echt',                 // Denny's echte wallet, afgespeeld uit tests/_fixtures (op CI overgeslagen)
  'kraken-levensloop', 'kraken-afronding', 'scenario-levensloop', 'gesynct-vergrendeld',
  'execution-stappen', 'koppelingen-menu', 'account-remove', 'robustness', 'multi-tab',

  // migratie, invoer, export
  'tj-migrate', 'tj-overzetten', 'pnl-pct', 'unit-toggle', 'tp-overzicht',
  'afgeleide-stappen', 'afgeleide-scenarios', 'handmatig-formulier', 'handmatig-scenarios',
  'handmatig-statistieken', 'tj-backtest', 'export-overzicht', 'import-keuze', 'import-leeg-object',
  'export-import-rondje', 'diagnose', 'possize',
  'export-sleutels',         // F12: API-sleutels alleen in een bestand als je dat kiest; automatische back-ups nooit
  'lege-staten',             // C1: elke lege staat via emptyState, twee soorten (leeg / niets in beeld), met een volgende stap
  'account-label',           // C3: hernoemd account → oude trades tonen de nieuwe naam
  'koppel-opnieuw',          // opnieuw koppelen: eerste sync 30 dagen terug of vanaf 'sync vanaf', niet vanaf de oude lastSync (Jarne)
  'terugkijken-v12',         // migratie v12: eenmalig 30 dagen terugkijken (niet bij recente CSV-trades, nooit vooruit)

  // site + TradingPlan v3 (tradingplan/tradingplan.html, syncjournal.nl/plan)
  'landing',
  'plan3-basis',             // opslag tp3:*, thema van de journal, vier tabs, tandwiel, stijl-lagen
  'plan3-lagen',             // vrije tijdframes en tags uit de journal; erven week → dag → scenario
  'plan3-edge',              // edge per scenario, exacte getallen uit tests/fixtures/plan3-trades.json
  'plan3-dag',               // Cockpit: trechter, rangschikking, opengeklapt scenario, status, gisteren overnemen
  'plan3-media',             // afbeeldingen en links: plakken, slepen, TradingView-voorbeeld, grenzen, lightbox
  'plan3-koppeling',         // "Zet om in trade": zelf koppelen (nooit automatisch) en het vooraf ingevulde formulier
  'plan3-afsluiting',        // Afsluiting, Log, voorspel-score, binnen/buiten plan
  'plan3-journal',           // journal: Tendencies → Plan, Mori, back-up met plaatjes, geen poort meer
  'plan3-doorloop',          // de hele route op de demo-dataset: week, twee dagen, vijf scenario's, koppelen, afsluiten
  'plan3-mori',              // Mori in het plan: per scenario en het dagplan, via tp3:mori; de sleutel nooit in het plan
  'plan3-dagstart',          // Dagstart (was pre-flight): vrije lijst van hooguit 8, vinkjes op tekst, migratie van Day.pre
  'plan3-gevoel',            // gevoel bij de dagstart: emoties uit de journal, journal → plan per emotie, "Je dagstart-gevoel"
  'plan3-regels',            // Vandaag: één regel per laag (kaartje), tikken = bewerken, week compact, ⓘ, stap Charts
  'plan3-zijpaneel',         // Mori in een zijpaneel van het plan: de journal in embed-modus, stil en alleen-lezen
  'plan3-criteria',          // playbook-criteria in een scenario standaard ingeklapt; amber als verplichte nog open staan

  // analyse en weergave
  'matrix', 'yearheatmap', 'review-list', 'coach-share', 'review-beeld', 'tv-links', 'theme-hook', 'beeld-escaping',
  'heatmap-scaling', 'analytics-metrics', 'tendencies', 'faq', 'trash',

  // v1.1: R-onbekend en zichtbare verbindingsfouten
  'r-scenarios', 'r-zonder-stop', 'conn-fout-zichtbaar', 'ip-whitelist-melding',

  // v1.2: Tags-kolom toont alles wat je aanklikte
  'tags-overzicht',

  // v1.3: acht tag-soorten, acht kleuren, overal gelijk (backlog C5)
  'tag-kleuren',

  // v1.3.1: je invoer blijft staan als een trade sluit
  'sluiten-behoudt-invoer',

  // v1.3.2: dashboard telt je filter, ∞, geen rekenruis, streepje voor ontbrekende prijzen,
  // centen onder de $100, en R overal netto
  'dashboard-live', 'pf-en-kpi', 'afronding-prijzen', 'prijs-streepje', 'kleine-bedragen', 'r-netto',

  // v1.15.1: the bugs T2 found, now real checks
  'privacy-mode', 'integrity-edge', 'a11y', 'tendencies-untagged',
  // v1.15.2 + v1.16: Morani links, FAQ, and the AI coach (key never in an export, the app computes, the model reads)
  'morani-links',
  'coach-pakket', 'coach-sleutel', 'coach-stream', 'coach-verbruik', 'coach-knoppen', 'coach-tools', 'coach-pretrade',
  // v1.18: funded mode, CSV account pop-up, Discord copy for several trades, raw data in dev mode (W2),
  // stop management (F5, F7, F9)
  'funded-geld', 'funded-tab', 'funded-import', 'funded-dashboard', 'csv-account-keuze',
  'discord-meerdere', 'ruwe-data', 'ruwe-data-voorbeeld',
  'stop-beweging', 'stop-override', 'stop-analytics',
  // v1.18.1: CSV and API no longer double (B3), CSV import on CI (T1), Hyperliquid CSV without leading zeros and
  // Zaratras' real export (skips without the local fixtures), stop-loss line after an import, TP sum
  'csv-synthetisch', 'csv-parser-gelijk', 'csv-geen-excel', 'csv-api-dubbel', 'hl-csv-zonder-nul', 'hl-csv-echt', 'csv-stop-melding', 'tp-verdeling',
  // v1.18.2: Review page, newest first, tiles without an image, large view with trade details
  'review-volgorde', 'review-beeld-info',
];
