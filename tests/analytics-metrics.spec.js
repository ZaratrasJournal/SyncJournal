// Borgt de nieuwe Analytics-panelen (verbeterplan): SQN, drawdown+herstel, MFE/MAE-efficiency,
// gepland vs behaald R:R, consistentie/Pareto, sample-size-badge + de nieuwe sectie-volgorde.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const mk = (id, over) => Object.assign({ id, date: '2026-0' + (1 + (id % 8)) + '-1' + (id % 9), time: '10:00', pair: 'BTC/USDT', dir: id % 2 ? 'long' : 'short', setup: ['Breakout', 'Pullback', 'Reversal'][id % 3], session: 'London', grade: 'A', exchange: 'mexc', status: 'closed', kind: 'live', entry: 100, stop: 95, tp: 110, exit: 108, size: 5000, risk: 1, leverage: 5, rrPlanned: 2.5, mae: 0.4, mfe: 2.0, durationMin: 60, tvLinks: [], screenshots: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [] }, over || {});
function seed(n) { const rows = []; for (let i = 0; i < n; i++) { const win = i % 2 === 0; const r = win ? 1.5 : -1; const kind = i % 7 === 0 ? 'backtest' : i % 7 === 1 ? 'paper' : 'live'; rows.push(mk(i, { pnl: r * 200, r, mfe: win ? 2.2 : 0.5, mae: win ? 0.3 : 1.1, kind })); } return rows; }
(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
  const b = await chromium.launch(); const p = await b.newPage(); p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  p.on('console', m => { if (m.type() === 'error' && !/NaN|attribute /.test(m.text())) errs.push('C:' + m.text().slice(0, 100)); });
  await p.setViewportSize({ width: 1600, height: 1000 });
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  await p.evaluate(() => { try { hideWelcome() } catch (e) {} });
  ok('boot zonder fout', errs.length === 0, errs.join(' | '));

  await p.evaluate((rows) => { T = rows; STATE.theme = 'dark'; document.body.classList.add('dark'); persist(); clearGFilter(); setFilter('kind', 'alle'); go('analytics'); }, seed(60));
  await p.waitForTimeout(900);
  const heads = () => p.evaluate(() => [...document.querySelectorAll('#main .panel h3')].map(h => h.textContent.trim()));

  console.log('─── Nieuwe panelen aanwezig ───');
  const H = await heads();
  ok('SQN-tegel (tegels-rij)', await p.evaluate(() => [...document.querySelectorAll('.tile .tl')].some(x => /SQN/.test(x.textContent))));
  ok('sectiekoppen aanwezig', await p.evaluate(() => { const s = [...document.querySelectorAll('.sect-h')].map(x => x.textContent); return s.some(x => /Traject/.test(x)) && s.some(x => /Kwaliteit/.test(x)) && s.some(x => /dimensie/i.test(x)) && s.some(x => /Gedrag/.test(x)); }));
  ok('Drawdown + herstel paneel', H.some(h => /Drawdown \+ herstel/.test(h)));
  ok('recovery + duur chip', await p.evaluate(() => [...document.querySelectorAll('.chip')].some(c => /recovery/.test(c.textContent) && /onder piek/.test(c.textContent))));
  ok('MFE / MAE-efficiency paneel', H.some(h => /MFE \/ MAE/.test(h)));
  ok('scatter gerenderd (stippen)', await p.evaluate(() => { const pnl = [...document.querySelectorAll('.panel')].find(x => /MFE \/ MAE/.test((x.querySelector('h3') || {}).textContent || '')); return pnl && pnl.querySelectorAll('svg .recharts-symbols, svg circle').length > 5; }));
  ok('Gepland vs. behaald R:R paneel', H.some(h => /Gepland vs\. behaald/.test(h)));
  ok('Consistentie / Pareto paneel', H.some(h => /Consistentie \/ Pareto/.test(h)));

  console.log('─── Volgorde: risk vóór dimensies ───');
  ok('Drawdown vóór Setup-grade', await p.evaluate(() => { const t = [...document.querySelectorAll('#main .panel h3, #main .sect-h')].map(x => x.textContent); const dd = t.findIndex(x => /Drawdown \+ herstel/.test(x)); const sg = t.findIndex(x => /Setup-grade/.test(x)); return dd >= 0 && sg >= 0 && dd < sg; }));
  ok('MFE/MAE vóór Winst per pair', await p.evaluate(() => { const t = [...document.querySelectorAll('#main .panel h3')].map(x => x.textContent); return t.findIndex(x => /MFE \/ MAE/.test(x)) < t.findIndex(x => /Winst per pair/.test(x)); }));
  ok('Real vs Paper vs Backtest onderaan', await p.evaluate(() => { const t = [...document.querySelectorAll('#main .panel h3')].map(x => x.textContent); const e = t.findIndex(x => /Real vs Paper/.test(x)); return e === t.length - 1; }));

  console.log('─── SQN-berekening klopt ───');
  // seed: 30 winners @ +1.5R, 30 losers @ -1R → meanR=0.25, stdR≈1.269, sqn≈0.25/1.269*sqrt(60)
  const sqnShown = await p.evaluate(() => { const el = [...document.querySelectorAll('.tile')].find(t => /SQN/.test(t.textContent)); return parseFloat(el.querySelector('.tv').textContent); });
  const rs = seed(60).map(t => t.r); const m = rs.reduce((s, x) => s + x, 0) / rs.length; const sd = Math.sqrt(rs.reduce((s, x) => s + (x - m) ** 2, 0) / (rs.length - 1)); const exp = (m / sd) * Math.sqrt(60);
  ok('SQN ≈ verwachte waarde', Math.abs(sqnShown - exp) < 0.05, `getoond=${sqnShown} verwacht=${exp.toFixed(2)}`);

  console.log('─── Sample-size badge ───');
  ok('≥30 trades → betrouwbaar', await p.evaluate(() => { const c = [...document.querySelectorAll('.chip')].find(x => /trades in beeld/.test(x.textContent)); return c && /betrouwbaar/.test(c.textContent); }));
  await p.evaluate((rows) => { T = rows; persist(); clearGFilter(); setFilter('kind', 'alle'); go('analytics'); }, seed(12));
  await p.waitForTimeout(700);
  ok('<30 trades → waarschuwing', await p.evaluate(() => [...document.querySelectorAll('.chip')].some(x => /n<30/.test(x.textContent))));

  ok('geen JS-errors', errs.length === 0, errs.join(' | '));
  console.log(`\n=== Analytics-metrics: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
