// Kleine bedragen zijn zichtbaar: +$0,46, niet "+$ 0" of "0k".
//
// Denny 29-09-2026: twee live trades van samen +$0,46, en het dashboard toonde overal nul —
// Netto P&L "+$ 0", "deze maand +$ 0", een equity-curve met assen "0k, 0k, 0k" en Maand-P&L "+0".
// Alles werd afgerond op hele dollars, grafieken zelfs op duizendtallen.
// Afspraak: onder de $100 met centen, tot $1.000 hele dollars, daarboven "k". Grote bedragen
// blijven dus rustig — ook dat bewaakt deze test.
const { chromium } = require('playwright');
const path = require('path');

let pass = 0, fail = 0;
const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const MAAND = new Date().toISOString().slice(0, 7);
const t = (id, dag, pnl) => ({ id, pair: 'BTC/USDC', dir: 'long', exchange: 'okx', kind: 'live', status: 'closed', session: 'US AM',
  date: `${MAAND}-${String(dag).padStart(2, '0')}`, time: '10:00', entry: 100, exit: 101, size: '100', pnl });

(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await p.setViewportSize({ width: 1600, height: 1400 });
  await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(600);
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(800);
  await p.evaluate(() => { try { hideWelcome(); } catch (e) {} STATE.currency = 'USD'; });
  ok('boot zonder JS-fouten', errs.length === 0, errs[0]);

  console.log('─── De grens: centen onder de 100, hele dollars daarboven ───');
  const f = await p.evaluate(() => ({ a: eurS(0.46), b: eur(23.87), c: eur(99.5), d: eur(239.4), e: eur(815.35), g: eurS(-3.95), n: eur(0) }));
  ok('+$0,46', f.a === '+$ 0,46', f.a);
  ok('$23,87', f.b === '$ 23,87', f.b);
  ok('$99,50', f.c === '$ 99,50', f.c);
  ok('$239 blijft hele dollars', f.d === '$ 239', f.d);
  ok('$815 blijft hele dollars', f.e === '$ 815', f.e);
  ok('verlies −$3,95', f.g === '−$ 3,95', f.g);
  ok('nul blijft "$ 0"', f.n === '$ 0', f.n);

  const dash = rijen => p.evaluate(async rijen => {
    T = rijen.map(x => ({ ...EMPTY_TRADE, ...x })); persist(); clearGFilter(); setFilter('kind', 'live');
    try { VIEW.v = { ...(VIEW.v || {}), dKpiCore: 1, dHero: 1, dEquity: 1, dMonthly: 1 }; } catch (e) {}
    go('dashboard'); await new Promise(r => setTimeout(r, 700));
    const paneel = naam => [...document.querySelectorAll('.panel')].find(x => new RegExp(naam).test((x.querySelector('h3') || {}).textContent || ''));
    const ticks = el => el ? [...el.querySelectorAll('.recharts-cartesian-axis-tick-value, .recharts-label, .recharts-label-list text, text')].map(x => x.textContent.trim()).filter(Boolean) : [];
    const kpi = [...document.querySelectorAll('.kpi.kcard')].find(k => /Netto P&L/.test(k.textContent));
    return {
      netto: kpi ? (kpi.querySelector('.v') || {}).textContent.trim() : null,
      meta: ((document.querySelector('.panel.hero .meta') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
      equity: ticks(paneel('Equity')), maand: ticks(paneel('Maand')),
    };
  }, rijen);

  console.log('─── Dashboard met +$0,46 (jouw situatie) ───');
  const klein = await dash([t('a', 2, 0.45), t('b', 3, 0.01)]);
  ok('Netto P&L toont +$ 0,46', klein.netto === '+$ 0,46', klein.netto);
  ok('"deze maand" toont +$ 0,46', /deze maand \+\$ 0,46/.test(klein.meta), klein.meta);
  ok('equity-curve: geen "0k" meer op de as', klein.equity.length > 0 && !klein.equity.some(x => /k$/.test(x)), JSON.stringify(klein.equity));
  ok('equity-curve: de as laat centen zien', klein.equity.some(x => /\d,\d/.test(x)), JSON.stringify(klein.equity));
  ok('Maand-P&L: het label is +0,46, niet +0', klein.maand.some(x => x === '+0,46'), JSON.stringify(klein.maand));

  console.log('─── Grote bedragen blijven rustig ───');
  const groot = await dash([t('c', 2, 1200), t('d', 3, 300.4)]);
  ok('Netto P&L toont hele dollars', groot.netto === '+$ 1.500', groot.netto);
  ok('Maand-P&L: het label is +1,5k', groot.maand.some(x => x === '+1,5k'), JSON.stringify(groot.maand));
  ok('equity-curve: geen centen op de as', !groot.equity.some(x => /\d,\d\d$/.test(x)), JSON.stringify(groot.equity));

  ok('geen nieuwe JS-fouten', errs.length === 0, errs[0]);
  console.log(`\n=== Kleine bedragen: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
