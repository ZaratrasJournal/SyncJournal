// Borgt multi-select filters: checkbox-dropdowns voor accounts/pairs/setups/sessies/
// status/tags, unie-gedrag (2 exchanges = trades van beide), labels met aantallen,
// klik-door vanuit heatmaps vervangt de selectie, Wis-gedrag, badge-telling.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
  const b = await chromium.launch(); const p = await b.newPage(); p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.setViewportSize({ width: 1700, height: 1000 });
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(600);
  await p.evaluate(() => {
    try { hideWelcome() } catch (e) {}
    const mk = (id, ex, setup, sess, st) => ({ id, date: '2026-09-0' + (1 + id % 8), time: '10:00', pair: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'][id % 3], dir: id % 2 ? 'long' : 'short', setup, session: sess, status: st || 'closed', kind: 'live', exchange: ex, entry: 100, exit: 110, stop: 95, size: '1000', pnl: 50, r: 1, tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] });
    T = [mk(1, 'blofin', 'Trend-pullback', 'London'), mk(2, 'kraken', 'Trend-pullback', 'US AM'), mk(3, 'hyperliquid', 'Range-fade', 'Asia'), mk(4, 'blofin', 'Reclaim', 'London', 'open'), mk(5, 'kraken', 'Range-fade', 'US PM', 'partial'), mk(6, 'okx', 'London SFP', 'Weekend')];
    persist(); clearGFilter(); setFilter('kind', 'alle'); go('trades');
  });
  await p.waitForTimeout(400);
  ok('boot + seed zonder JS-errors', errs.length === 0, errs.slice(0, 2).join(' | '));

  console.log('─── Multi-select: unie-gedrag ───');
  ok('2 exchanges → trades van beide (blofin+kraken = 4)', await p.evaluate(() => { toggleFilter('exchange', 'blofin'); toggleFilter('exchange', 'kraken'); return FT.length === 4 && FT.every(t => ['blofin', 'kraken'].includes(t.exchange)); }));
  ok('dropdown-label toont aantal ("2 accounts")', await p.evaluate(() => [...document.querySelectorAll('.filtbar .dd-btn')].some(x => /2 accounts/.test(x.textContent))));
  ok('derde erbij, één eraf → correcte set', await p.evaluate(() => { toggleFilter('exchange', 'okx'); const n3 = FT.length; toggleFilter('exchange', 'kraken'); const after = FT.length; return n3 === 5 && after === 3 && FT.every(t => ['blofin', 'okx'].includes(t.exchange)); }));
  ok('2 setups bovenop exchange-filter (EN tussen categorieën)', await p.evaluate(() => { toggleFilter('setup', 'Trend-pullback'); toggleFilter('setup', 'Reclaim'); return FT.length === 2 && FT.every(t => t.exchange === 'blofin'); }));
  ok('status open+partial samen', await p.evaluate(() => { clearGFilter(); setFilter('kind', 'alle'); toggleFilter('status', 'open'); toggleFilter('status', 'partial'); return FT.length === 2 && FT.every(t => t.status !== 'closed'); }));

  console.log('─── UI: checkboxes + wis ───');
  ok('checkbox-menu toont aangevinkte items', await p.evaluate(() => { const dd = document.querySelector('.dd[data-dd="status"]'); return dd && [...dd.querySelectorAll('.ddchk.on span')].map(x => x.textContent).sort().join(',') === 'Open,Partial'; }));
  ok('"Wis selectie" in het menu wist alleen die categorie', await p.evaluate(() => { toggleFilter('exchange', 'blofin'); clearFilterKey('status'); return FILTER.status.length === 0 && FILTER.exchange.length === 1; }));
  ok('badge telt actieve categorieën en aantallen', await p.evaluate(() => { const g = document.getElementById('gfBadge'); return !g.hidden && /van 6/.test(g.textContent); }));
  ok('Wis (n) wist alles', await p.evaluate(() => { clearGFilter(); setFilter('kind', 'alle'); return MULTI_FILTER_KEYS.every(k => FILTER[k].length === 0) && FT.length === 6; }));

  console.log('─── Klik-door vervangt selectie ───');
  ok('matrixCell → precies die setup+sessie (vervangt oude keuze)', await p.evaluate(() => { toggleFilter('setup', 'Range-fade'); toggleFilter('setup', 'Reclaim'); matrixCell('Trend-pullback', 'London'); return FILTER.setup.length === 1 && FILTER.setup[0] === 'Trend-pullback' && FILTER.session[0] === 'London' && STATE.page === 'trades'; }));
  ok('pairCell → één pair', await p.evaluate(() => { pairCell('ETH/USDT'); return FILTER.pair.length === 1 && FILTER.pair[0] === 'ETH/USDT'; }));
  ok('setFilter (tagchip-klik) vervangt tag-selectie', await p.evaluate(() => { FILTER.tag = ['A', 'B']; setFilter('tag', 'C'); const one = FILTER.tag.length === 1 && FILTER.tag[0] === 'C'; setFilter('tag', ''); return one && FILTER.tag.length === 0; }));

  console.log('─── Eén opmaak: ook richting + soort als dd-dropdown ───');
  ok('geen native <select> meer in de filterbar', await p.evaluate(() => { go('trades'); return document.querySelectorAll('.filtbar select').length === 0 && !!document.querySelector('[data-dd="dir"]') && !!document.querySelector('[data-dd="kind"]'); }));
  ok('richting kiezen via menu filtert en licht de knop op', await p.evaluate(() => { clearGFilter(); setFilter('kind', 'alle'); const before = FT.length; setFilter('dir', 'short'); const btn = document.querySelector('[data-dd="dir"] .dd-btn'); const okr = FT.length < before && FT.every(t => t.dir === 'short') && btn.classList.contains('on') && /Short/.test(btn.textContent); setFilter('dir', ''); return okr; }));
  ok('soort-knop toont de keuze en telt mee als filter', await p.evaluate(() => { setFilter('kind', 'backtest'); const btn = document.querySelector('[data-dd="kind"] .dd-btn'); const okr = /Backtest/.test(btn.textContent) && btn.classList.contains('on') && countActive() >= 1; setFilter('kind', 'alle'); return okr; }));

  console.log('─── Pagina-integratie ───');
  ok('analytics rendert met multi-filter actief', await p.evaluate(() => { clearGFilter(); setFilter('kind', 'alle'); toggleFilter('exchange', 'blofin'); toggleFilter('exchange', 'kraken'); go('analytics'); return document.querySelectorAll('#main .panel').length > 3; }));
  await p.waitForTimeout(400);

  ok('geen JS-errors totaal', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== Multi-select filters: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
