const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (extra ? '  → ' + extra : '')); } };
const mk = (setup, session, pnl, date) => ({ setup, session, pnl, r: pnl > 0 ? 1 : -1, date: date || '2026-05-04', time: '10:00', pair: 'BTC/USDT', dir: 'long', grade: 'A', exchange: 'mexc', status: 'closed', kind: 'live', pnlPct: 0, tags: [], layers: [], emotions: [], mistakes: [], screenshots: [], entry: 100, stop: 95, tp: 110, tps: [] });
(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
  const b = await chromium.launch(); const p = await b.newPage(); p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  p.on('console', m => { if (m.type() === 'error' && !/NaN|attribute /.test(m.text())) errs.push('C:' + m.text().slice(0, 100)); });
  await p.setViewportSize({ width: 1440, height: 950 });
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  await p.evaluate(() => { try { hideWelcome() } catch (e) {} });
  ok('boot zonder fout', errs.length === 0, errs.join(' | '));
  // 2026-05-04 = maandag (London). 2026-05-02 = zaterdag (Weekend).
  const rows = [];
  for (let i = 0; i < 8; i++) rows.push(mk('AlphaSetup', 'London', 400));           // London: 8W → WR100% +3200 → 🎯 (grootste)
  for (let i = 0; i < 5; i++) rows.push(mk('BetaSetup', 'US AM', -200));             // US AM: 5L → WR0% -1000 → ⊘
  rows.push(mk('AlphaSetup', 'US AM', 50)); rows.push(mk('AlphaSetup', 'US AM', 30)); // 2 trades → faded
  for (let i = 0; i < 4; i++) rows.push(mk('AlphaSetup', 'x', 300, '2026-05-02'));    // weekend (za) 4W
  await p.evaluate((rows) => { T = rows.map((r, i) => ({ ...r, id: i })); persist(); clearGFilter(); go('tendencies'); }, rows);
  await p.waitForTimeout(500);

  console.log('─── Treemap rendert ───');
  ok('paneel "Setup × sessie" aanwezig', await p.locator('#main', { hasText: 'Setup × sessie' }).count() >= 1);
  ok('treemap-container aanwezig', await p.locator('.tm').count() === 1);
  ok('sessie-groepen aanwezig (London/US AM/Weekend)', await p.evaluate(() => {
    const names = [...document.querySelectorAll('.tm-grp .gn')].map(x => x.textContent);
    return names.includes('London') && names.includes('US AM') && names.includes('Weekend');
  }), await p.evaluate(() => [...document.querySelectorAll('.tm-grp .gn')].map(x => x.textContent).join(',')));
  ok('setup-tegels aanwezig', await p.evaluate(() => document.querySelectorAll('.tm-tile').length >= 4));

  console.log('─── Tegel-data + grootte-verhouding ───');
  const t = await p.evaluate(() => {
    const find = (su, se) => [...document.querySelectorAll('.tm-tile')].find(x => x.dataset.su === su && x.dataset.se === se);
    const a = find('AlphaSetup', 'London'), bb = find('BetaSetup', 'US AM'), faded = find('AlphaSetup', 'US AM'), wk = find('AlphaSetup', 'Weekend');
    const area = el => { const r = el.getBoundingClientRect(); return r.width * r.height; };
    return {
      aBadge: a.querySelector('.tb') ? a.querySelector('.tb').textContent : '', aN: +a.dataset.n,
      bBadge: bb.querySelector('.tb') ? bb.querySelector('.tb').textContent : '',
      aArea: area(a), bArea: area(bb),
      fadedN: +faded.dataset.n, wkN: +wk.dataset.n,
      aGreen: a.style.background.includes('green'), bRed: bb.style.background.includes('red'),
    };
  });
  ok('London/AlphaSetup: 🎯 edge bevestigd', t.aBadge === '🎯', t.aBadge);
  ok('US AM/BetaSetup: ⊘ edge weg', t.bBadge === '⊘', t.bBadge);
  ok('grootste tegel (8 trades) > kleinere (5 trades)', t.aArea > t.bArea, `a=${Math.round(t.aArea)} b=${Math.round(t.bArea)}`);
  ok('winst-tegel groen, verlies-tegel rood', t.aGreen && t.bRed);
  ok('weekend-trades in eigen groep (4)', t.wkN === 4);

  console.log('─── Grootte-toggle (# trades ↔ |P&L|) ───');
  // US AM heeft 2 setups (BetaSetup 5t/−1000 + AlphaSetup 2t/+80) → ratio verandert tussen #trades en |P&L|
  const areaN = await p.evaluate(() => { const a = [...document.querySelectorAll('.tm-tile')].find(x => x.dataset.su === 'BetaSetup' && x.dataset.se === 'US AM'); const r = a.getBoundingClientRect(); return r.width * r.height; });
  await p.evaluate(() => setMatrixSize('pnl')); await p.waitForTimeout(300);
  ok('|P&L|-modus actief', await p.evaluate(() => STATE.matrixSize === 'pnl'));
  ok('tegels herschikt op |P&L|', await p.evaluate(([an]) => { const a = [...document.querySelectorAll('.tm-tile')].find(x => x.dataset.su === 'BetaSetup' && x.dataset.se === 'US AM'); const r = a.getBoundingClientRect(); return Math.abs(r.width * r.height - an) > 1; }, [areaN]));
  await p.evaluate(() => setMatrixSize('n')); await p.waitForTimeout(200);

  console.log('─── Hover-tooltip + klik-filter ───');
  ok('tooltip via tmMove', await p.evaluate(() => {
    const el = [...document.querySelectorAll('.tm-tile')].find(x => x.dataset.su === 'AlphaSetup' && x.dataset.se === 'London');
    tmMove({ target: el }); const t = document.getElementById('yhtip');
    return t.classList.contains('on') && /AlphaSetup/.test(t.innerText) && /London/.test(t.innerText) && /100%/.test(t.innerText);
  }));
  ok('yhHide verbergt tooltip', await p.evaluate(() => { yhHide(); return !document.getElementById('yhtip').classList.contains('on'); }));
  await p.evaluate(() => matrixCell('AlphaSetup', 'London')); await p.waitForTimeout(300);
  ok('tegel-klik filtert setup+sessie → trades', await p.evaluate(() => STATE.page === 'trades' && FILTER.setup === 'AlphaSetup' && FILTER.session === 'London'));
  ok('gefilterde trades = alleen London/AlphaSetup (8)', await p.evaluate(() => CLOSED.length === 8 && CLOSED.every(t => t.setup === 'AlphaSetup' && sessionOf(t) === 'London')));

  ok('geen JS-errors', errs.length === 0, errs.join(' | '));
  console.log(`\n=== Setup×sessie treemap: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
