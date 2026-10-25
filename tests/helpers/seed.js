// Seeden voor SyncJournal-specs. Vroeger zette dit bestand tj_-sleutels in localStorage
// (de oude TradeJournal). SyncJournal ziet een gevulde tj_trades juist als oude data om te
// migreren en opent dan de migratie-modal, zodat een spec in een lege journal achter een
// modal start (backlog T2). Daarom loopt alles nu via de app zelf: applyBackup → sj_ +
// IndexedDB. Zie dov-page.js; dit bestand is er alleen zodat oude imports blijven werken.
const { seed, seedTrades, wipe } = require('./dov-page');
module.exports = { seed, seedTrades, wipe };
