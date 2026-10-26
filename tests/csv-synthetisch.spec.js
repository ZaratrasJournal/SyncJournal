// CSV-import op CI (backlog T1). tests/csv-import.spec.js draait op echte exports in tests/_fixtures/
// (gitignored, dus op CI overgeslagen). Deze spec draait altijd: per ondersteund formaat een kleine
// SYNTHETISCHE export in tests/fixtures-csv/ (verzonnen getallen en ids, geen accounts of wallets),
// met de kolommen en de vorm die de parser verwacht.
//
// Per formaat: herkend als het juiste formaat, de juiste trades met de juiste cijfers, de rijen die
// geen trade zijn (geannuleerde order, balansregel, open-fill) vallen weg, en dubbel inlezen geeft
// niets nieuws. Tijden: Blofin en Kraken schrijven UTC, de andere formaten lokale tijd; de spec draait
// in Europe/Amsterdam (zomertijd, UTC+2).
//
// Let op: de OKX-kolomnamen volgen wat de parser herkent, niet een geverifieerde echte OKX-export
// (zie de opmerking bij ExchangeAPI.okx.herkentCsv in work/syncjournal.html).
//
// Draai: node tests/csv-synthetisch.spec.js
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const DIR = path.join('tests', 'fixtures-csv');
const bij = (a, b, tol) => Math.abs(+a - +b) <= (tol == null ? 1e-6 : tol);

// bestand → formaat (de bron die de parser stempelt) en de trades die eruit moeten komen
const VERWACHT = {
  'blofin-orderhistorie.csv': { bron: 'blofin', trades: [
    { pair: 'BTC/USDT', dir: 'long', date: '2026-09-03', time: '10:15', entry: 60000, exit: 60750, qty: 0.01, pnl: 6.78 },
    { pair: 'ETH/USDT', dir: 'short', date: '2026-09-05', time: '16:00', entry: 2400, exit: 2380, qty: 0.5, pnl: 9.28 }] },
  'okx-positiehistorie.csv': { bron: 'okx', trades: [
    { pair: 'BTC/USDT', dir: 'short', date: '2026-09-08', time: '09:00', entry: 61000, exit: 60500, qty: 0.02, pnl: 9.3 },
    { pair: 'ETH/USDT', dir: 'long', date: '2026-09-10', time: '07:30', entry: 2500, exit: 2550, qty: 0.4, pnl: 19.5 }] },
  'kraken-accountlog.csv': { bron: 'kraken', trades: [
    { pair: 'BTC/USD', dir: 'long', date: '2026-09-22', time: '12:00', entry: 64000, exit: 64500, qty: 0.004, pnl: 1.6 },
    { pair: 'ETH/USD', dir: 'short', date: '2026-09-24', time: '11:00', entry: 2550, exit: 2526, qty: 0.5, pnl: 11.5 }] },
  'hyperliquid-fills.csv': { bron: 'hyperliquid', trades: [
    { pair: 'SOL/USDC', dir: 'long', date: '2026-09-12', time: '08:00', entry: 150, exit: 153.6, qty: 10, pnl: 34.78 },
    { pair: 'ETH/USDC', dir: 'short', date: '2026-09-14', time: '17:05', entry: 2450, exit: 2420, qty: 0.8, pnl: 22.45 }] },
  'mexc-futures.csv': { bron: 'mexc', trades: [
    { pair: 'BTC/USDT', dir: 'long', date: '2026-09-18', time: '12:30', exit: 62500, qty: 0.02, pnl: 10 },
    { pair: 'DOGE/USDT', dir: 'short', date: '2026-09-19', time: '08:00', exit: 0.21, qty: 1000, pnl: -5 }] },
  'mexc-posities.csv': { bron: 'mexc', trades: [
    { pair: 'BTC/USDT', dir: 'long', date: '2026-09-20', time: '09:00', entry: 63000, exit: 63400, pnl: 8 },
    { pair: 'ETH/USDT', dir: 'short', date: '2026-09-21', time: '13:00', entry: 2600, exit: 2570, pnl: 15 }] },
  'ftmo-metrix.csv': { bron: 'ftmo', trades: [
    { pair: 'EUR/USD', dir: 'long', date: '2026-09-15', time: '09:30', entry: 1.1, exit: 1.103, qty: 0.5, pnl: 146.5 },
    { pair: 'XAU/USD', dir: 'short', date: '2026-09-16', time: '15:00', entry: 2500, exit: 2505, qty: 1, pnl: -508.2 }] },
};

(async () => {
  const bestanden = fs.readdirSync(DIR).filter(f => f.endsWith('.csv')).sort();
  ok('elk ondersteund formaat heeft een synthetische export (7 bestanden, 6 exchanges)',
    Object.keys(VERWACHT).every(f => bestanden.includes(f)) && new Set(Object.values(VERWACHT).map(v => v.bron)).size === 6, bestanden.join(', '));
  // geen echte gegevens: geen e-mail, geen wallet-adres (0x + 40 hex), geen lange account-/order-ids
  const verdacht = bestanden.filter(f => /@|0x[0-9a-f]{40}|\b\d{13,}\b/i.test(fs.readFileSync(path.join(DIR, f), 'utf8')));
  ok('de exports bevatten geen e-mail, wallet-adres of lange echte id', !verdacht.length, verdacht.join(', '));

  const b = await chromium.launch();
  const { p, errs } = await H.openJournal(b, { timezoneId: 'Europe/Amsterdam' });
  await p.evaluate(() => { setFilter('kind', 'alle'); });

  for (const [f, v] of Object.entries(VERWACHT)) {
    console.log(`─── ${f} ───`);
    const tekst = fs.readFileSync(path.join(DIR, f), 'utf8');
    const h = await p.evaluate(t => { const r = csvHerken(t); return { toestand: r.toestand, bron: r.bron, n: r.n }; }, tekst);
    ok(`${f}: herkend als ${v.bron} met ${v.trades.length} trades`, h.toestand === 'herkend' && h.bron === v.bron && h.n === v.trades.length, JSON.stringify(h));
    // importeren zoals de pop-up dat doet, op het account van het formaat (FTMO: geen exchange, dus zonder)
    const r = await p.evaluate(([t, ex]) => { const voor = new Set(T.map(x => x.id)); const n = sjImportCsvText(t, ex); window.__nieuw = T.filter(x => !voor.has(x.id)).map(x => x.id); return { n, erbij: window.__nieuw.length }; }, [tekst, v.bron === 'ftmo' ? '' : v.bron]);
    ok(`${f}: ${v.trades.length} trades geïmporteerd`, r.n === v.trades.length && r.erbij === v.trades.length, JSON.stringify(r));
    const rijen = await p.evaluate(() => T.filter(t => window.__nieuw.includes(t.id)).map(t => ({ pair: t.pair, dir: t.dir, date: t.date, time: t.time, entry: +t.entry, exit: +t.exit, qty: +t.qtyAsset, pnl: +t.pnl, status: t.status })));
    for (const w of v.trades) {
      const t = rijen.find(x => x.pair === w.pair && x.dir === w.dir);
      ok(`${f}: ${w.pair} ${w.dir} ${w.date} ${w.time} netto ${w.pnl}`, t && t.status === 'closed' && t.date === w.date && t.time === w.time && bij(t.pnl, w.pnl, 0.005)
        && (w.entry == null || bij(t.entry, w.entry, 1e-6)) && (w.exit == null || bij(t.exit, w.exit, 1e-6)) && (w.qty == null || bij(t.qty, w.qty, 1e-9)), JSON.stringify(t));
    }
    const nog = await p.evaluate(([t, ex]) => sjImportCsvText(t, ex), [tekst, v.bron === 'ftmo' ? '' : v.bron]);
    ok(`${f}: nog een keer inlezen geeft niets nieuws`, nog === 0, 'n=' + nog);
  }
  ok('unieke ids over alle imports', await p.evaluate(() => new Set(T.map(t => t.id)).size === T.length));
  ok('geen JS-fouten', errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n=== CSV synthetisch: ${pass}/${pass + fail} ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
