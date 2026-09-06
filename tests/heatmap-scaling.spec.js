// Verifieert dat beide heatmaps DYNAMISCH meeschalen met het aantal coins/setups:
// weinig data → een paar grote tegels die de box vullen; meer data → meer/kleinere tegels.
// Niet statisch. Squarify vult altijd de container.
const { chromium } = require('playwright'); const path = require('path');
const mk = (id, pair, setup, session, pnl) => ({ id, date: '2026-05-04', time: '10:00', pair, dir: 'long', setup, session, status: 'closed', kind: 'live', pnl, r: pnl > 0 ? 1 : -1, pnlPct: 0.3, entry: 100, stop: 95, tp: 110, exit: 108, size: 5000, tvLinks: [], screenshots: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [] });
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
  const b = await chromium.launch(); const p = await b.newPage(); p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.setViewportSize({ width: 1600, height: 1000 });
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(400);
  await p.evaluate(() => { try { hideWelcome() } catch (e) {} });
  ok('boot zonder fout', errs.length === 0, errs.join(' | '));

  const COINS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 'DOGE/USDT', 'LINK/USDT', 'AVAX/USDT', 'BNB/USDT', 'ARB/USDT', 'OP/USDT', 'ADA/USDT', 'DOT/USDT'];
  const fillPct = sel => p.evaluate((sel) => {
    const box = document.querySelector(sel); if (!box) return -1; const br = box.getBoundingClientRect(); const A = br.width * br.height; if (!A) return -1;
    let s = 0; box.querySelectorAll('.tm-tile').forEach(t => { const r = t.getBoundingClientRect(); s += r.width * r.height; });
    return Math.round(s / A * 100);
  }, sel);

  console.log('─── Pair-heatmap schaalt met aantal coins ───');
  let prevMaxArea = Infinity;
  for (const n of [1, 2, 3, 7, 12]) {
    const rows = []; let id = 1;
    for (let i = 0; i < n; i++) for (let k = 0; k < 6; k++) rows.push(mk(id++, COINS[i], 'BOS-retest', 'London', (i % 3 === 0 ? 1 : -1) * (300 + i * 120 + k * 15)));
    await p.evaluate((rows) => { T = rows; persist(); clearGFilter(); setFilter('kind', 'alle'); go('analytics'); }, rows);
    await p.waitForTimeout(450);
    const tiles = await p.evaluate(() => document.querySelectorAll('.tmpanel .tm .tm-tile').length);
    const fill = await fillPct('.tmpanel .tm');
    const maxArea = await p.evaluate(() => { let m = 0; document.querySelectorAll('.tmpanel .tm .tm-tile').forEach(t => { const r = t.getBoundingClientRect(); m = Math.max(m, r.width * r.height); }); return Math.round(m); });
    ok(`${n} coin(s) → ${tiles} tegels, vult ${fill}% v/d box`, tiles === n && fill >= 88, `tiles=${tiles} fill=${fill}`);
    if (n > 1) ok(`  grootste tegel krimpt bij meer coins (${maxArea} ≤ ${prevMaxArea})`, maxArea <= prevMaxArea + 1000, `max=${maxArea} prev=${prevMaxArea}`);
    prevMaxArea = maxArea;
  }

  console.log('─── Setup×sessie schaalt met aantal setups/sessies ───');
  const SETUPS = ['Breakout', 'Pullback', 'Reversal', 'Range-fade', 'Trend', 'News'];
  const SESS = ['London', 'US AM', 'Asia', 'US PM'];
  for (const [ns, nse] of [[1, 1], [2, 1], [2, 2], [4, 3]]) {
    const rows = []; let id = 1;
    for (let s = 0; s < ns; s++) for (let e = 0; e < nse; e++) for (let k = 0; k < 5; k++) rows.push(mk(id++, 'BTC/USDT', SETUPS[s], SESS[e], (k % 2 ? 1 : -1) * (200 + s * 90 + k * 20)));
    await p.evaluate((rows) => { T = rows; persist(); clearGFilter(); setFilter('kind', 'alle'); go('tendencies'); }, rows);
    await p.waitForTimeout(450);
    const groups = await p.evaluate(() => document.querySelectorAll('.tm .tm-grp').length);
    const tiles = await p.evaluate(() => document.querySelectorAll('.tm .tm-tile').length);
    const fill = await fillPct('.tm');
    ok(`${ns} setup × ${nse} sessie → ${groups} groep(en), ${tiles} tegels, vult ${fill}%`, groups === nse && tiles === ns * nse && fill >= 80, `groups=${groups} tiles=${tiles} fill=${fill}`);
  }

  console.log('─── Adaptieve hoogte (niet statisch) ───');
  const hOf = async (nse) => {
    const rows = []; let id = 1;
    for (let s = 0; s < 5; s++) for (let e = 0; e < nse; e++) for (let k = 0; k < 4; k++) rows.push(mk(id++, 'BTC/USDT', SETUPS[s], SESS[e], 100));
    await p.evaluate((rows) => { T = rows; persist(); clearGFilter(); setFilter('kind', 'alle'); go('tendencies'); }, rows);
    await p.waitForTimeout(400);
    return p.evaluate(() => Math.round(document.querySelector('.tm').getBoundingClientRect().height));
  };
  const hSmall = await hOf(1), hBig = await hOf(4);
  ok(`Setup×sessie-hoogte groeit met meer tegels (${hSmall} → ${hBig})`, hBig > hSmall + 20, `small=${hSmall} big=${hBig}`);

  ok('geen JS-errors', errs.length === 0, errs.join(' | '));
  console.log(`\n=== Heatmap-scaling: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
