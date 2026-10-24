// Trades-pagina: 100 rijen per pagina, met Vorige/Volgende. Zoeken, filteren en sorteren
// gelden voor de hele set (niet alleen de pagina in beeld) en zetten je terug op pagina 1.
// Het totaal onderaan telt alle trades van de selectie, niet alleen de 100 in beeld.
//
// Herschreven in T2 (24-10-2026): de oude spec testte "Toon meer / Toon alles" in work/tradejournal.html.
const { chromium } = require('playwright');
const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const trade = (i, pair) => ({ id: i, date: '2026-0' + (1 + (i % 9)) + '-' + String(1 + (i % 27)).padStart(2, '0'), time: String(i % 24).padStart(2, '0') + ':00',
  pair, dir: i % 2 ? 'long' : 'short', status: 'closed', kind: 'live', entry: 100, exit: 101, stop: 99, size: '1000', pnl: 1, exchange: '' });
// 150 BTC + 100 ETH = 250 trades, elk +1 → totaal 250
const SET = [...Array.from({ length: 150 }, (_, i) => trade(i, 'BTC/USDT')), ...Array.from({ length: 100 }, (_, i) => trade(150 + i, 'ETH/USDT'))];

const stand = () => ({
  rijen: document.querySelectorAll('#main tbody tr.mrow').length,
  info: (document.querySelector('#main .pager .pageinfo') || {}).textContent || '',
  vorigeUit: !!document.querySelector('#main .pager button:first-child[disabled]'),
  volgendeUit: !!document.querySelector('#main .pager button:last-child[disabled]'),
  totaal: ((document.querySelector('#main tfoot') || {}).textContent || '').replace(/\s+/g, ' '),
  pagina: STATE.tradePage,
});

(async () => {
  const b = await chromium.launch(); const { p, errs } = await H.openJournal(b);
  await H.seedTrades(p, SET);
  await H.go(p, 'trades');

  let s = await p.evaluate(stand);
  ok('pagina 1: 100 rijen, "1–100 van 250 · pagina 1/3"', s.rijen === 100 && /1–100/.test(s.info) && /van 250/.test(s.info) && /pagina 1\/3/.test(s.info), JSON.stringify(s));
  ok('Vorige uit, Volgende aan', s.vorigeUit && !s.volgendeUit, JSON.stringify(s));
  ok('totaal telt alle 250 trades, niet de 100 in beeld', /Totaal \(250\)/.test(s.totaal) && /250/.test(s.totaal.replace(/Totaal \(250\)/, '')), s.totaal);

  await p.click('#main .pager button:last-child');
  s = await p.evaluate(stand);
  ok('Volgende → pagina 2: 101–200, beide knoppen aan', s.rijen === 100 && /101–200/.test(s.info) && !s.vorigeUit && !s.volgendeUit, JSON.stringify(s));
  await p.click('#main .pager button:last-child');
  s = await p.evaluate(stand);
  ok('pagina 3: de laatste 50, Volgende uit', s.rijen === 50 && /201–250/.test(s.info) && s.volgendeUit, JSON.stringify(s));

  await p.fill('#trSearch', 'ETH');
  await p.waitForFunction(() => STATE.query === 'ETH' && document.querySelectorAll('#main tbody tr.mrow').length === 100, null, { timeout: 3000 });
  s = await p.evaluate(stand);
  ok('zoeken op ETH vanaf pagina 3: terug naar pagina 1, alle 100 ETH-trades, geen pager meer', s.pagina === 0 && s.rijen === 100 && !s.info && /Totaal \(100\)/.test(s.totaal), JSON.stringify(s));
  ok('en alleen ETH in beeld', await p.evaluate(() => [...document.querySelectorAll('#main tbody tr.mrow td[data-l="Pair"]')].every(td => /ETH/.test(td.textContent))));
  await p.evaluate(() => { STATE.query = ''; render(); });

  await p.evaluate(() => setTradePage(2));
  await p.evaluate(() => setFilter('pair', 'BTC/USDT'));
  s = await p.evaluate(stand);
  ok('filter op BTC vanaf pagina 3: pagina 1 van 2 (150 trades)', s.pagina === 0 && s.rijen === 100 && /van 150/.test(s.info) && /pagina 1\/2/.test(s.info), JSON.stringify(s));
  await p.evaluate(() => { setTradePage(1); sortBy('pair'); });
  ok('sorteren zet je terug op pagina 1', await p.evaluate(() => STATE.tradePage === 0));
  await p.evaluate(() => clearGFilter());

  console.log('─── Randen ───');
  await H.seedTrades(p, SET.slice(0, 100));
  await H.go(p, 'trades');
  s = await p.evaluate(stand);
  ok('precies 100 trades: alles op één pagina, geen pager', s.rijen === 100 && !s.info, JSON.stringify(s));
  await H.seedTrades(p, SET.slice(0, 101));
  await H.go(p, 'trades');
  await p.evaluate(() => setTradePage(1));
  s = await p.evaluate(stand);
  ok('101 trades: pagina 2 heeft precies één rij', s.rijen === 1 && /101–101 van 101/.test(s.info), JSON.stringify(s));
  await H.seedTrades(p, SET.slice(0, 3));
  await H.go(p, 'trades');
  s = await p.evaluate(stand);
  ok('van pagina 2 naar een set van 3: geen lege pagina, de 3 rijen staan er', s.rijen === 3 && s.pagina === 0 && !s.info, JSON.stringify(s));

  ok('geen JS-fouten', errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n=== Trades-paginatie: ${pass}/${pass + fail} ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
