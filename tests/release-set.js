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
  'multifilter', 'trades-sortering', 'integratie-breed', 'stress-vandaag', 'csv-import',

  // exchanges: sync, saldo, levensloop per beurs
  'exchange-sync', 'exchange-sync2', 'balance-sync', 'auto-sync', 'valuta',
  'okx-positie', 'okx-levensloop', 'okx-subtype', 'okx-partial', 'okx-partial-herstel',
  'partial-alle-exchanges', 'hyperliquid-levensloop', 'hl-open-tijd', 'blofin-levensloop',
  'auto-sync-pauze',         // blijvende sleutelfout: auto-sync stopt, handmatig syncen kan altijd
  'web-analytics',           // meetscript alleen op syncjournal.nl, niet op de werkversie of lokaal
  'worker-monitoring',       // de Worker-telling voor het dagrapport lekt geen sleutels of IP's
  'okx-overzetten',          // oude backup: losse OKX-trades met dezelfde posId blijven apart (member Jarne)
  'nieuwe-positie-na-pauze', // dagen niet gesynct: nieuwe positie op dezelfde coin krijgt haar eigen datum
  'hl-deels-dicht',          // Hyperliquid: een geraakte TP is zichtbaar terwijl de positie nog loopt
  'hl-echt',                 // Denny's echte wallet, afgespeeld uit tests/_fixtures (op CI overgeslagen)
  'kraken-levensloop', 'kraken-afronding', 'scenario-levensloop', 'gesynct-vergrendeld',
  'execution-stappen', 'koppelingen-menu', 'account-remove', 'robustness', 'multi-tab',

  // migratie, invoer, export
  'tj-migrate', 'tj-overzetten', 'pnl-pct', 'unit-toggle', 'tp-overzicht',
  'afgeleide-stappen', 'afgeleide-scenarios', 'handmatig-formulier', 'handmatig-scenarios',
  'handmatig-statistieken', 'tj-backtest', 'export-overzicht', 'import-keuze',
  'export-import-rondje', 'diagnose', 'possize',

  // site + tradingplan
  'landing', 'tradingplan-v2', 'plan-koppeling', 'plan-tendencies', 'plan-doorloop', 'plan-playbook',
  'tradingplan-plan',        // aparte app (tradingplan.syncjournal.nl), draait mee zodat hij niet ongetest blijft

  // analyse en weergave
  'matrix', 'yearheatmap', 'review-list', 'coach-share', 'tv-links', 'theme-hook', 'beeld-escaping',
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
];
