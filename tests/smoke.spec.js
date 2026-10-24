// Smoke: SyncJournal start zonder JS-fouten, elke pagina en elk Instellingen-tabblad rendert,
// en de versie staat in beeld. Bedoeld als snelste vangnet voor een kapotte build.
//
// Herschreven in T2 (24-10-2026): de oude smoke laadde work/tradejournal.html.
const { chromium } = require('playwright');
const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const TRADE = { id: 1, date: '2026-10-01', time: '10:00', pair: 'BTC/USDT', dir: 'long', status: 'closed', kind: 'live',
  entry: 100, exit: 110, stop: 95, size: '1000', pnl: 50, exchange: '' };

(async () => {
  const b = await chromium.launch(); const { p, errs } = await H.openJournal(b);

  console.log('─── Lege journal ───');
  const start = await p.evaluate(() => ({ trades: T.length, modal: document.getElementById('modal').classList.contains('on'),
    welkom: document.getElementById('welcome').classList.contains('on'), pagina: STATE.page }));
  ok('boot klaar: lege journal, geen migratie-modal en geen welkomscherm', start.trades === 0 && !start.modal && !start.welkom, JSON.stringify(start));
  ok('start op het dashboard', start.pagina === 'dashboard', start.pagina);

  const paginas = await p.evaluate(() => Object.keys(PAGES));
  const leeg = {};
  for (const pg of paginas) {
    await H.go(p, pg);
    leeg[pg] = await p.evaluate(() => document.getElementById('main').innerText.trim().length);
  }
  ok('elke pagina rendert iets (' + paginas.length + ' pagina\'s)', paginas.length >= 9 && Object.values(leeg).every(n => n > 20), JSON.stringify(leeg));

  await H.go(p, 'trades');
  const lijst = await p.evaluate(() => ({ eerste: !!document.querySelector('#main .empty-h') && document.querySelector('#main .empty-h').textContent, rijen: document.querySelectorAll('#main tbody tr').length }));
  ok('Trades zonder data: de "begin je journal"-staat, niet "geen trades gevonden"', /Begin je journal/.test(lijst.eerste) && lijst.rijen === 0, JSON.stringify(lijst));

  console.log('─── Instellingen en versie ───');
  const inst = await p.evaluate(() => {
    go('instellingen');
    const tabs = [...document.querySelectorAll('#main button[onclick^="setSetTab"]')].map(x => (x.getAttribute('onclick').match(/setSetTab\('(\w+)'\)/) || [])[1]).filter(Boolean);
    const tekst = {};
    tabs.forEach(t => { setSetTab(t); tekst[t] = document.getElementById('main').innerText; });
    return { tabs, lengtes: Object.fromEntries(Object.entries(tekst).map(([k, v]) => [k, v.trim().length])), versie: Object.values(tekst).some(v => v.includes('SyncJournal ' + APP_VERSION)), APP_VERSION };
  });
  ok('Instellingen heeft tabbladen en elk rendert', inst.tabs.length >= 5 && Object.values(inst.lengtes).every(n => n > 20), JSON.stringify(inst.lengtes));
  ok('versie in beeld: "SyncJournal ' + inst.APP_VERSION + '"', inst.versie && /^v\d+\.\d+(\.\d+)?$/.test(inst.APP_VERSION), inst.APP_VERSION);

  console.log('─── Met één trade ───');
  await H.seedTrades(p, [TRADE]);
  await H.go(p, 'trades');
  const gevuld = await p.evaluate(() => ({ rijen: document.querySelectorAll('#main tbody tr').length, leeg: !!document.querySelector('#main .empty') }));
  ok('Trades toont de rij en geen lege staat', gevuld.rijen >= 1 && !gevuld.leeg, JSON.stringify(gevuld));
  await H.reload(p);
  ok('na herladen staat de trade er nog (IndexedDB)', await p.evaluate(() => T.length === 1 && T[0].pair === 'BTC/USDT'));
  const vol = {};
  for (const pg of paginas) { await H.go(p, pg); vol[pg] = await p.evaluate(() => document.getElementById('main').innerText.trim().length); }
  ok('alle pagina\'s renderen ook met data', Object.values(vol).every(n => n > 20) && errs.length === 0, JSON.stringify(vol));

  ok('geen JS-fouten', errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n=== Smoke: ${pass}/${pass + fail} ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
