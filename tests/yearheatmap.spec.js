const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (extra ? '  → ' + extra : '')); } };
const mk = (date, pnl, i) => ({ id: i, date, time: '10:00', pair: 'BTC/USDT', dir: 'long', setup: 'S', session: 'London', grade: 'A', exchange: 'mexc', status: 'closed', kind: 'live', pnl, r: pnl > 0 ? 1 : -1, pnlPct: 0, tags: [], layers: [], emotions: [], mistakes: [], screenshots: [], entry: 100, stop: 95, tp: 110, tps: [] });
(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
  const b = await chromium.launch(); const p = await b.newPage(); p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.setViewportSize({ width: 1440, height: 950 });
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  await p.evaluate(() => { try { hideWelcome() } catch (e) {} });
  ok('app boot zonder fout', errs.length === 0, errs.join(' | '));

  await p.evaluate((rows) => { T = rows.map((r, i) => ({ ...r, id: i })); persist(); STATE.calMonth = '2026-03'; clearGFilter(); go('kalender'); }, [
    mk('2026-03-02', 300), mk('2026-03-02', -80), mk('2026-03-02', 50),   // 3 trades, 2W/1V, +270
    mk('2026-03-15', 1200),                                               // big green (magnitude tint)
    mk('2026-04-10', -120), mk('2026-06-15', 200), mk('2026-09-20', 90),
  ]);
  await p.waitForTimeout(400);

  console.log('─── Maand-strip (model B) ───');
  ok('strip heeft 12 maandkaarten', await p.evaluate(() => document.querySelectorAll('.ystrip .ymc').length === 12));
  ok('maart-kaart toont netto (+€ 1,5k som)', await p.evaluate(() => {
    const c = document.querySelector('.ymc[data-mo="2"]'); return c && +c.dataset.mv === 270 + 1200 && +c.dataset.mn2 === 4;
  }), await p.evaluate(() => { const c = document.querySelector('.ymc[data-mo="2"]'); return c ? c.dataset.mv + '/' + c.dataset.mn2 : 'geen'; }));
  ok('lege maand toont "—"', await p.evaluate(() => document.querySelector('.ymc[data-mo="0"]').textContent.includes('—')));
  ok('actieve maand (maart) gemarkeerd', await p.evaluate(() => document.querySelector('.ymc[data-mo="2"]').classList.contains('on')));

  console.log('─── Heatmap sizing (niet uitgerekt / niet te klein) ───');
  const size = await p.evaluate(() => {
    const yh = document.querySelector('.yh'); const cell = document.querySelector('.yh-cells .yc');
    const cr = cell.getBoundingClientRect(); const yr = yh.getBoundingClientRect(); const pr = yh.closest('.panel').getBoundingClientRect();
    const cs = getComputedStyle(yh);
    return { cw: cr.width, ch: cr.height, yhW: Math.round(yr.width), panelW: Math.round(pr.width), mAuto: cs.marginLeft === cs.marginRight, maxW: cs.maxWidth };
  });
  ok('cellen zijn vierkant', Math.abs(size.cw - size.ch) < 1.5, `${size.cw}×${size.ch}`);
  ok('celgrootte binnen clamp 14–26px', size.cw >= 13.5 && size.cw <= 26.5, `cw=${size.cw}`);
  ok('heatmap past binnen paneel (geen overflow)', size.yhW <= size.panelW, `yh=${size.yhW} panel=${size.panelW}`);
  ok('heatmap gecentreerd (auto-marges) + max-width cap', size.mAuto && /px|calc/.test(size.maxW), `mAuto=${size.mAuto} maxW=${size.maxW}`);

  console.log('─── Cellen hebben dag-data ───');
  ok('7 rijen × 53 kolommen grid', await p.evaluate(() => { const s = getComputedStyle(document.querySelector('.yh-cells')); return s.gridTemplateColumns.split(' ').length === 53 && s.gridTemplateRows.split(' ').length === 7; }));
  ok('cellen hebben data-iso/n/v/w', await p.evaluate(() => { const c = document.querySelector('.yc'); return c && c.dataset.iso && 'n' in c.dataset && 'v' in c.dataset && 'w' in c.dataset; }));
  ok('grote winst-dag heeft diepere tint dan kleine', await p.evaluate(() => {
    const big = document.querySelector('.yc[data-iso="2026-03-15"]'), small = document.querySelector('.yc[data-iso="2026-09-20"]');
    return big.style.background.length && small.style.background.length && big.style.background !== small.style.background;
  }));

  console.log('─── Hover-tooltip dag ───');
  const tip = await p.evaluate(() => { const r = document.querySelector('.yc[data-iso="2026-03-02"]'); yhMove({ target: r }); const t = document.getElementById('yhtip'); return { on: t.classList.contains('on'), txt: t.innerText.replace(/\n/g, ' ') }; });
  ok('dag-tooltip verschijnt', tip.on);
  ok('toont 3 trades', /Trades\s*3/.test(tip.txt), tip.txt);
  ok('toont win-rate 67%', /67%/.test(tip.txt));
  ok('toont netto +270', /270/.test(tip.txt));
  ok('lege dag → "Geen trades"', await p.evaluate(() => { const r = document.querySelector('.yc[data-iso="2026-01-05"]'); yhMove({ target: r }); return /Geen trades/.test(document.getElementById('yhtip').innerText); }));

  console.log('─── Hover-tooltip maand + klik-navigatie ───');
  ok('maand-tooltip via ymMove', await p.evaluate(() => { const c = document.querySelector('.ymc[data-mo="2"]'); ymMove({ target: c }); const t = document.getElementById('yhtip'); return t.classList.contains('on') && /Maart/i.test(t.innerText); }));
  ok('yhHide verbergt tooltip', await p.evaluate(() => { yhHide(); return !document.getElementById('yhtip').classList.contains('on'); }));
  await p.evaluate(() => calGoMonth(5)); await p.waitForTimeout(200);
  ok('klik maand → calMonth springt (juni)', await p.evaluate(() => STATE.calMonth === '2026-06'));

  ok('geen JS-errors', errs.length === 0, errs.join(' | '));
  console.log(`\n=== Jaar-heatmap (strip+grid): ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
