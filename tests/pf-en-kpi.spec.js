// Profit factor zonder verliezen is ∞, niet "99,00" — en de KPI-kaarten blijven staan.
//
// Denny 29-09-2026: het dashboard toonde "Profit factor 99,00" bij alleen winnende trades.
// 99 is een interne waarde voor "oneindig" (winst gedeeld door nul verlies); Playbook en
// Analytics vertaalden die al naar ∞, het dashboard en de AI-coach niet. De vergelijking met de
// vorige periode rekende er ook mee (een "verschil" van 95,0).
//
// Bij het nazoeken bleek de Gem. R-kaart onder de vergelijking een `return ''` te hebben (v1.1):
// had één helft van de periode geen trades mét R, dan verdween de héle kaart. Ook bewaakt.
const { chromium } = require('playwright');
const path = require('path');

let pass = 0, fail = 0;
const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const MAAND = new Date().toISOString().slice(0, 7);
const t = (id, dag, pnl, extra) => ({ id, pair: 'BTC/USDC', dir: 'long', exchange: 'okx', kind: 'live', status: 'closed', session: 'US AM',
  date: `${MAAND}-${String(dag).padStart(2, '0')}`, time: '10:00', entry: 100, exit: 100 + pnl, size: '100', pnl, ...extra });

(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await p.setViewportSize({ width: 1600, height: 1100 });
  await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(600);
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(800);
  await p.evaluate(() => { try { hideWelcome(); } catch (e) {} });
  ok('boot zonder JS-fouten', errs.length === 0, errs[0]);

  const kaarten = rijen => p.evaluate(rijen => {
    T = rijen.map(x => ({ ...EMPTY_TRADE, ...x })); persist(); clearGFilter(); setFilter('kind', 'live');
    // de pro-KPI's (profit factor, expectancy, gem. R) aan, ongeacht het weergave-preset
    try { VIEW.v = { ...(VIEW.v || {}), dKpiCore: 1, dKpiPro: 1 }; } catch (e) {}
    go('dashboard');
    const uit = {};
    document.querySelectorAll('.kpi.kcard').forEach(k => {
      const label = (k.querySelector('.k') || {}).textContent || '';
      uit[label.trim()] = { waarde: ((k.querySelector('.v') || {}).textContent || '').trim(), trend: ((k.querySelector('.ktrend') || {}).textContent || '').trim() };
    });
    return uit;
  }, rijen);

  console.log('─── Alleen winnende trades ───');
  const winst = await kaarten([t('w1', 2, 0.45), t('w2', 3, 0.01)]);
  ok('de Profit factor-kaart staat er', !!winst['Profit factor'], JSON.stringify(Object.keys(winst)));
  ok('en toont ∞', (winst['Profit factor'] || {}).waarde === '∞', JSON.stringify(winst['Profit factor']));
  ok('niet 99,00', !/99/.test((winst['Profit factor'] || {}).waarde || ''));

  console.log('─── Eerste helft alleen winst, tweede helft gemengd ───');
  const gemengd = await kaarten([t('a', 1, 10), t('b', 2, 5), t('c', 3, 8), t('d', 4, -4), t('e', 5, 6), t('f', 6, -3)]);
  const pfTrend = (gemengd['Profit factor'] || {}).trend;
  ok('geen zinloos verschil als één helft ∞ is', !pfTrend || !/\d{2},/.test(pfTrend), pfTrend);

  console.log('─── Gem. R-kaart blijft staan als één helft geen R heeft ───');
  const rMix = await kaarten([
    t('x1', 1, 5), t('x2', 2, -2), t('x3', 3, 4),                                        // zonder stop: geen R
    t('y1', 4, 6, { stop: 95, r: 1.2 }), t('y2', 5, -5, { stop: 95, r: -1 }), t('y3', 6, 10, { stop: 95, r: 2 }),
  ]);
  ok('de Gem. R-kaart staat er nog', !!rMix['Gem. R'], JSON.stringify(Object.keys(rMix)));
  ok('en toont een waarde', /R?[+−-]?\d/.test((rMix['Gem. R'] || {}).waarde || ''), JSON.stringify(rMix['Gem. R']));

  console.log('─── AI-coach noemt ook geen 99,00 ───');
  await kaarten([t('w1', 2, 0.45), t('w2', 3, 0.01)]);
  const coach = await p.evaluate(() => [aiReply('hoe ging mijn week'), aiReply('hoe zit het met mijn risk')].join(' | '));
  ok('AI-coach zegt "profit factor ∞"', /profit factor ∞/i.test(coach), coach.slice(0, 220));
  ok('en nergens 99,00', !/99,00/.test(coach), coach.slice(0, 220));

  ok('geen nieuwe JS-fouten', errs.length === 0, errs[0]);
  console.log(`\n=== PF en KPI: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
