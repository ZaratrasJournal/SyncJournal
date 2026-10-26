// C2 · De CSV-parser per exchange opgesplitst: bewijs dat de uitkomst gelijk bleef.
//
// Haalt elke export door parseExchangeCsvText (met en zonder gekozen account), door csvHerken
// en door een echte import, en vergelijkt de uitkomst byte-voor-byte met een vastgelegde
// snapshot (tests/fixtures/csv-parser-gelijk.json). Die snapshot is gemaakt met de code van
// vóór de verbouwing (v1.18.5). Klok en Math.random liggen vast, zodat ook de random ids
// (Blofin, MEXC, OKX) en de TP-ids vergelijkbaar zijn.
//
// Bronnen: tests/fixtures-csv/ (altijd), tests/_fixtures-exports/ en tests/_fixtures/*.csv
// (echte exports, gitignored: overgeslagen als ze er niet zijn), plus randgevallen hieronder.
//
// Draai: node tests/csv-parser-gelijk.spec.js              vergelijken
//        node tests/csv-parser-gelijk.spec.js --vastleggen  snapshot (opnieuw) vastleggen
const fs = require('fs'); const path = require('path');
const { chromium } = require('playwright'); const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const SNAP = path.join('tests', 'fixtures', 'csv-parser-gelijk.json');
const VASTLEGGEN = process.argv.includes('--vastleggen');

const bestanden = {};
const lees = dir => { if (!fs.existsSync(dir)) return 0; const f = fs.readdirSync(dir).filter(x => /\.csv$/i.test(x)).sort();
  f.forEach(x => { bestanden[dir.split(path.sep).pop() + '/' + x] = fs.readFileSync(path.join(dir, x), 'utf8'); }); return f.length; };
lees(path.join('tests', 'fixtures-csv'));
const echt = lees(path.join('tests', '_fixtures-exports')) + lees(path.join('tests', '_fixtures'));
// Randgevallen die de synthetische exports niet raken
Object.assign(bestanden, {
  'rand/leeg.csv': '',
  'rand/alleen-kop.csv': 'Time,Futures Trading Pair,Direction\n',
  'rand/algemeen.csv': 'date,symbol,side,entry,exit,size,pnl,fee\n2026-09-01,BTCUSDT,buy,60000,61000,0.1,100,1\n2026-09-02,ETHUSDT,sell,2500,2450,1,50,0.5\n,XRPUSDT,buy,1,2,3,4,5\n',
  'rand/algemeen-zonder-symbool.csv': 'time,side,profit\n2026-09-03 10:00:00,long,12\n',
  'rand/blofin-wees-en-omkeer.csv': 'Underlying Asset,Leverage,Order Time,Side,Avg Fill,Filled,PNL,Fee,Reduce-only,Status\n'
    + 'SOLUSDT,5,09/01/2026 08:00:00,Sell,150.0 USDT,2 SOL,4.0 USDT,0.1 USDT,Y,Filled\n'
    + 'ETHUSDT,10,09/02/2026 08:00:00,Buy,2400 USDT,1 ETH,--,0.5 USDT,N,Filled\n'
    + 'ETHUSDT,10,09/02/2026 09:00:00,Sell,2410 USDT,2 ETH,--,0.5 USDT,N,Filled\n'
    + 'ETHUSDT,10,09/02/2026 10:00:00,Buy,2390 USDT,2 ETH,40 USDT,0.5 USDT,Y,Filled\n'
    + 'BTCUSDT,10,09/03/2026 08:00:00,Buy,60000 USDT,0.01 BTC,--,0.3 USDT,N,Canceled\n',
  'rand/okx-swap-in-data.csv': 'Contract,Side,Avg open price,Avg close price,Position,PnL,Trading fee,Leverage,Create time,Update time\n'
    + 'SOL-USDT-SWAP,buy,150,155,1000,50,0.2,3,2026-09-04T08:00:00,2026-09-04T09:00:00\n'
    + 'ADA-USDT-SWAP,,0.5,0.45,100,-5,0.01,,2026-09-05 08:00:00,\n',
  'rand/hl-korte-rij.csv': 'time,coin,dir,px,sz,ntl,fee,closedPnl\n01-09-2026 - 08:00:00,BTC,Open Long,60000,0.1,6000,1,-1\n01-09-2026 - 09:00:00,BTC\n02-09-2026 - 09:00:00,BTC,Close Long,61000,0.1,6100,1,99\n',
  'rand/ftmo-balans.csv': 'Ticket,Open,Type,Volume,Symbol,Price,SL,TP,Close,Price,Swap,Commissions,Profit,Pips,Trade duration in seconds\n'
    + '1,2026-09-01 08:00:00,balance,0,,0,0,0,2026-09-01 08:00:00,0,0,0,100000,,0\n'
    + '2,2026-09-02 08:00:00,buy,1,GBPJPY,190.1,0,0,2026-09-02 09:00:00,190.3,0,-5,130,20,3600\n'
    + '3,2026-09-03 08:00:00,sell,2,US30,40000,0,0,2026-09-03 09:00:00,39900,0,0,200,,3600\n',
});

// Alles wat een parse oplevert, in een vorm die JSON overleeft (ook de extra eigenschap _waarschuwingen).
async function meet(p, tekst, ex) {
  return p.evaluate(([t, ex]) => {
    let s = 20261026; Math.random = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
    try { const r = parseExchangeCsvText(t, ex); return { trades: JSON.parse(JSON.stringify(r)), waarschuwingen: r._waarschuwingen || null }; }
    catch (e) { return { fout: String((e && e.message) || e) }; }
  }, [tekst, ex]);
}

(async () => {
  console.log(`exports: ${Object.keys(bestanden).length} (waarvan echt: ${echt}${echt ? '' : ', tests/_fixtures-exports ontbreekt: overgeslagen'})`);
  const b = await chromium.launch();
  const { p, errs } = await H.openJournal(b, { timezoneId: 'Europe/Amsterdam', klok: new Date('2026-10-26T12:00:00Z') });
  await p.evaluate(() => { setFilter('kind', 'alle'); });
  const uit = {};
  for (const [naam, tekst] of Object.entries(bestanden)) {
    const r = { zonder: await meet(p, tekst, ''), metAccount: await meet(p, tekst, 'manual_x') };
    r.herken = await p.evaluate(t => { const h = csvHerken(t); return JSON.parse(JSON.stringify(h)); }, tekst);
    // een echte import op de bron van het formaat: welke rijen (srcId's) en cijfers er in de journal komen
    r.import = await p.evaluate(t => {
      let s = 7; Math.random = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
      const h = csvHerken(t), ex = h.fmt && h.fmt.ex || '';
      const voor = new Set(T.map(x => x.id)); const n = sjImportCsvText(t, ex);
      const rijen = T.filter(x => !voor.has(x.id)).map(x => [x.srcId, x.exchange, x.pair, x.dir, x.date, x.time, x.entry, x.exit, x.pnl, x.fees, x.qtyAsset, x.status].join('|')).sort();
      return { n, rijen };
    }, tekst);
    uit[naam] = r;
  }
  await b.close();

  if (VASTLEGGEN || !fs.existsSync(SNAP)) {
    fs.writeFileSync(SNAP, JSON.stringify(uit, null, 1) + '\n');
    console.log('snapshot vastgelegd: ' + SNAP);
    ok('geen JS-fouten', errs.length === 0, errs.slice(0, 3).join(' | '));
  } else {
    const oud = JSON.parse(fs.readFileSync(SNAP, 'utf8'));
    for (const naam of Object.keys(uit)) {
      if (!oud[naam]) { console.log(`  · ${naam}: niet in de snapshot (nieuw of echte export), niets te vergelijken`); continue; }
      for (const k of ['zonder', 'metAccount', 'herken', 'import']) {
        const a = JSON.stringify(oud[naam][k]), n = JSON.stringify(uit[naam][k]);
        let waar = ''; if (a !== n) { let i = 0; while (a[i] === n[i]) i++; waar = `oud …${a.slice(Math.max(0, i - 60), i + 60)}… nieuw …${n.slice(Math.max(0, i - 60), i + 60)}…`; }
        ok(`${naam} · ${k} gelijk`, a === n, waar);
      }
    }
    const weg = Object.keys(oud).filter(n => !uit[n] && !/^_fixtures/.test(n));
    ok('elke export uit de snapshot is weer gemeten', !weg.length, weg.join(', '));
    ok('geen JS-fouten', errs.length === 0, errs.slice(0, 3).join(' | '));
  }
  console.log(`\n=== CSV-parser gelijk: ${pass}/${pass + fail} ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
