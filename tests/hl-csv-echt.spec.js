// Zaratras' real Hyperliquid account: the wallet recording through the sync, then his real CSV export on top (B3, v1.18.1).
// "The API always leads": after the import
//   - no closed position is there twice
//   - every CSV row inside the recorded period has gone into an API trade
//   - the API trades keep their stop-loss, and their P&L does not count twice
//
// Needs two gitignored files that only exist on Zaratras' machine:
//   tests/_fixtures/hyperliquid-wallet.json         (the recording, see tests/hl-echt.spec.js)
//   tests/_fixtures/hyperliquid-trade-history.csv   (Hyperliquid → Trade History → Export)
// Without them (CI, the cloud, a fresh clone) the spec skips itself. The wallet address is never printed.
//
// Draai: node tests/hl-csv-echt.spec.js
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const hl = require('./helpers/hl-wallet');

let pass = 0, fail = 0;
const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const overslaan = reden => { console.log('  ⏭ ' + reden + ' — overgeslagen'); console.log('\n=== HL CSV echt: overgeslagen ==='); process.exit(0); };

const CSV = path.resolve(__dirname, '_fixtures/hyperliquid-trade-history.csv');
const ZONE_MARGE = 14 * 36e5;   // the export uses the exporter's screen time: at most 14 h off UTC (as zelfdePositie allows)
const dag = ms => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Amsterdam' }).format(new Date(ms));

(async () => {
  const acc = process.env.SJ_GEEN_FIXTURES ? null : hl.leesOpname();
  if (!acc) overslaan('geen opname van een echte wallet in deze kloon (tests/_fixtures/hyperliquid-wallet.json)');
  if (!fs.existsSync(CSV)) overslaan('geen echte Hyperliquid-export in deze kloon (tests/_fixtures/hyperliquid-trade-history.csv)');
  const tekst = fs.readFileSync(CSV, 'utf8');
  const { dicht } = hl.levenslopen(acc.fills);
  if (!dicht.length) overslaan('nog geen gesloten positie in de opname');
  const van = acc.fills[0].time, tot = Date.parse(acc.opgenomen);
  console.log(`  opname: ${acc.fills.length} fills, ${dicht.length} gesloten posities, ${dag(van)} t/m ${dag(tot)}; CSV: ${tekst.trim().split(/\r?\n/).length - 1} regels`);

  const b = await chromium.launch();
  const ctx = await b.newContext({ timezoneId: 'Europe/Amsterdam', locale: 'nl-NL' });
  const p = await ctx.newPage();
  p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
  await p.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const log = await hl.speelAf(p, acc, {});   // registered later, so it goes before the block
  await p.clock.setFixedTime(new Date(tot));
  await p.goto('file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/'), { waitUntil: 'load' }); await p.waitForTimeout(600);
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(800);
  await p.evaluate(() => { try { hideWelcome(); } catch (e) {} setFilter('kind', 'alle'); });

  const rijen = () => p.evaluate(() => T.filter(t => t.exchange === 'hyperliquid').map(t => ({ id: t.id, pair: t.pair, dir: t.dir, status: t.status,
    entry: +t.entry, exit: +t.exit, qty: +t.qtyAsset, pnl: +t.pnl, stop: +t.stop || 0, open: +t.openTime || 0, close: +t.closeTime || 0, gesynct: isGesynct(t) })));

  console.log('─── sync van de wallet ───');
  const n = await p.evaluate(({ wallet, syncFrom }) => { CONNS.hyperliquid = { connected: true, wallet, hint: wallet.slice(-4), syncFrom }; persistConns();
    return syncExchange('hyperliquid', { quiet: true }); }, { wallet: acc.wallet, syncFrom: dag(van - 864e5) });
  ok('sync lukt', n >= 0, String(n));
  const voor = await rijen();
  const apiDicht = voor.filter(t => t.gesynct && t.status === 'closed');
  ok(`de ${dicht.length} gesloten posities staan er als API-trade`, apiDicht.length === dicht.length, apiDicht.length + ' vs ' + dicht.length);

  console.log('─── daarna de CSV ───');
  const nieuw = await p.evaluate(t => sjImportCsvText(t, 'hyperliquid'), tekst);
  const na = await rijen();
  const csvRest = na.filter(t => !t.gesynct);
  console.log(`  ${nieuw} nieuw uit de CSV, ${csvRest.length} CSV-rijen staan er los`);

  // a CSV row is "inside the recording" when open and close lie in it, with room for the unknown screen time zone
  const binnen = t => t.open >= van + ZONE_MARGE && t.close > 0 && t.close <= tot - ZONE_MARGE;
  const losBinnen = csvRest.filter(binnen);
  ok('elke CSV-rij binnen de periode van de opname is opgegaan in een API-trade', losBinnen.length === 0,
    losBinnen.slice(0, 3).map(t => `${t.pair} ${t.dir} ${dag(t.open)} ${t.entry}→${t.exit}`).join(' | '));

  // per closed position from the raw fills: exactly one trade in the journal (API or CSV, never both)
  const coinVan = pair => String(pair).split('/')[0];
  const dichtbij = (a, b, f) => Math.abs(a - b) <= f * Math.max(Math.abs(a), Math.abs(b));
  const dubbel = dicht.map(L => ({ L, hits: na.filter(t => t.status === 'closed' && coinVan(t.pair) === L.coin && t.dir === L.dir
    && dichtbij(t.entry, L.entry, 1e-3) && dichtbij(t.exit, L.exit, 1e-3) && dichtbij(t.qty, L.qty, 0.02) && Math.abs(t.open - L.open) <= ZONE_MARGE) }))
    .filter(x => x.hits.length !== 1);
  ok('geen enkele gesloten positie staat twee keer (of ontbreekt)', dubbel.length === 0,
    dubbel.slice(0, 3).map(x => `${x.L.coin} ${x.L.dir} ${dag(x.L.open)}: ${x.hits.length}×`).join(' | '));

  const naId = Object.fromEntries(na.map(t => [t.id, t]));
  const stopWeg = voor.filter(t => t.gesynct && t.stop > 0 && !(naId[t.id] && naId[t.id].stop === t.stop));
  ok(`de API-trades houden hun stop-loss (${voor.filter(t => t.gesynct && t.stop > 0).length} met stop)`, stopWeg.length === 0,
    stopWeg.slice(0, 3).map(t => `${t.pair} ${dag(t.open)}: ${t.stop} → ${naId[t.id] ? naId[t.id].stop : 'weg'}`).join(' | '));
  const som = rs => rs.filter(t => t.gesynct).reduce((s, t) => s + t.pnl, 0);
  ok('de P&L van de API-trades is gelijk gebleven (niets dubbel)', Math.abs(som(voor) - som(na)) < 1e-6 && na.filter(t => t.gesynct).length === voor.filter(t => t.gesynct).length,
    som(voor).toFixed(4) + ' → ' + som(na).toFixed(4));
  ok('nog een keer inlezen voegt niets toe', (await p.evaluate(t => sjImportCsvText(t, 'hyperliquid'), tekst)) === 0);
  ok('geen onbekende Hyperliquid-aanroepen', log.onbekend.length === 0, log.onbekend.join(','));
  ok('geen JS-fouten', errs.length === 0, errs[0]);

  await b.close();
  console.log(`\n=== HL CSV echt: ${pass}/${pass + fail} ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
