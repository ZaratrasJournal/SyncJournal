// Borgt de tabblad-bescherming (audit 2026-09-18). Zonder deze bewaking overschreef een
// tweede, verouderd tabblad stilletjes het werk uit het eerste — het ergste wat een
// journal kan doen. Nu: verouderd tabblad schrijft niet meer en zegt het eerlijk.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const mk = (id, pair) => ({ id, date: '2026-09-0' + ((id % 9) + 1), time: '10:00', pair, dir: 'long', setup: '', session: 'London', status: 'closed', kind: 'live', exchange: '', entry: 100, exit: 110, stop: 95, size: '1000', pnl: 50, r: 1, tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] });
(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
  const b = await chromium.launch(); const ctx = await b.newContext();  // zelfde context = zelfde opslag, net als twee tabs
  const A = await ctx.newPage(); A.on('dialog', d => d.accept());
  const errs = []; A.on('pageerror', e => errs.push('A:' + String(e).split('\n')[0]));
  await A.goto(url, { waitUntil: 'networkidle' });
  await A.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await A.reload({ waitUntil: 'networkidle' }); await A.waitForTimeout(700);
  await A.evaluate((t) => { try { hideWelcome() } catch (e) {} T = [t]; persist(); clearGFilter(); setFilter('kind', 'alle'); go('dashboard'); }, mk(1, 'START/USDT'));
  await A.waitForTimeout(300);

  const B = await ctx.newPage(); B.on('dialog', d => d.accept());
  B.on('pageerror', e => errs.push('B:' + String(e).split('\n')[0]));
  await B.goto(url, { waitUntil: 'networkidle' }); await B.waitForTimeout(900);
  await B.evaluate(() => { try { hideWelcome() } catch (e) {} go('dashboard'); });
  ok('tweede tabblad start met dezelfde trade', (await B.evaluate(() => T.map(t => t.pair))).join() === 'START/USDT');

  console.log('─── Tab A schrijft, tab B merkt het ───');
  await A.evaluate((t) => { T.push(t); persist(); }, mk(2, 'TABA/USDT'));
  await B.waitForTimeout(600);
  const stale = await B.evaluate(() => ({ stale: TAB_STALE, banner: !!document.querySelector('.updbanner.red'), tekst: (document.querySelector('.updbanner.red') || {}).textContent || '' }));
  ok('tab B markeert zichzelf direct als verouderd', stale.stale === true);
  ok('tab B toont een duidelijke waarschuwing', stale.banner && /ander tabblad/i.test(stale.tekst), stale.tekst.slice(0, 60));

  console.log('─── Verouderd tabblad overschrijft niets meer ───');
  await B.evaluate((t) => { T.push(t); persist(); }, mk(3, 'TABB/USDT'));
  await B.waitForTimeout(500);
  const opslag = await B.evaluate(async () => ((await IDB.get('trades')) || []).map(t => t.pair));
  ok('werk van tab A staat nog in de opslag', opslag.includes('TABA/USDT'), JSON.stringify(opslag));
  ok('tab B heeft niets overschreven', !opslag.includes('TABB/USDT'), JSON.stringify(opslag));
  ok('tab A ziet zijn eigen data ongewijzigd', (await A.evaluate(() => T.map(t => t.pair))).join() === 'START/USDT,TABA/USDT');

  console.log('─── Herstelroutes ───');
  await B.reload({ waitUntil: 'networkidle' }); await B.waitForTimeout(900);
  const naVerversen = await B.evaluate(() => { try { hideWelcome() } catch (e) {} return { stale: TAB_STALE, pairs: T.map(t => t.pair), banner: !!document.querySelector('.updbanner.red') }; });
  ok('na verversen is tab B weer bij (en de waarschuwing weg)', naVerversen.stale === false && !naVerversen.banner && naVerversen.pairs.join() === 'START/USDT,TABA/USDT', JSON.stringify(naVerversen));

  // bewust doorgaan met het oude tabblad moet kunnen (gebruiker beslist)
  await A.evaluate((t) => { T.push(t); persist(); }, mk(4, 'TABA2/USDT'));
  await B.waitForTimeout(500);
  const keep = await B.evaluate(async () => {
    const wasStale = TAB_STALE;
    T.push({ id: 9, date: '2026-09-09', time: '10:00', pair: 'KEUZE/USDT', dir: 'long', setup: '', session: 'London', status: 'closed', kind: 'live', exchange: '', entry: 100, exit: 110, stop: 95, size: '1000', pnl: 10, r: 1, tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] });
    tabKeepThis(); await new Promise(r => setTimeout(r, 400));
    const st = ((await IDB.get('trades')) || []).map(t => t.pair);
    return { wasStale, stale: TAB_STALE, st };
  });
  ok('"Toch dit tabblad gebruiken" schrijft alsnog, bewust', keep.wasStale && keep.stale === false && keep.st.includes('KEUZE/USDT'), JSON.stringify(keep));

  console.log('─── Eén tabblad blijft normaal werken ───');
  ok('in tab A (nu zelf verouderd na B\'s keuze) blijft de app bruikbaar', await A.evaluate(async () => { go('trades'); await new Promise(r => setTimeout(r, 300)); return document.getElementById('main').innerText.length > 50; }));
  ok('geen JS-errors in beide tabbladen', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== Twee tabbladen: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
