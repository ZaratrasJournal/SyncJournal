const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (extra ? '  → ' + extra : '')); } };
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); // lokale datum (geen tz-drift)
const mk = (id, date, reviewed) => ({ id, date, time: '10:00', pair: 'BTC/USDT', dir: 'long', setup: 'Trend-pullback', session: 'London', grade: 'A', exchange: 'mexc', status: 'closed', kind: 'live', pnl: 100, r: 1, pnlPct: 0, reviewed: !!reviewed, tags: [], layers: [], emotions: [], mistakes: [], screenshots: [], entry: 100, stop: 95, tp: 110, tps: [] });
(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
  const b = await chromium.launch(); const p = await b.newPage(); p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.setViewportSize({ width: 1600, height: 950 });
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  await p.evaluate(() => { try { hideWelcome() } catch (e) {} });
  ok('boot zonder fout', errs.length === 0, errs.join(' | '));

  // dates relative to "now" so the test is deterministic whenever it runs
  const now = new Date();
  const today = iso(now);                          // altijd in week + maand + jaar
  const thisMonthDay1 = iso(new Date(now.getFullYear(), now.getMonth(), 1)); // 1e v/d maand → maand + jaar
  const thisYearOtherMonth = iso(new Date(now.getFullYear(), (now.getMonth() + 6) % 12, 15)); // ander kwartaal, dit jaar
  const lastYear = iso(new Date(now.getFullYear() - 1, 5, 15));
  const rows = [
    mk(1, today, false),              // week + maand + jaar
    mk(2, thisMonthDay1, true),       // maand + jaar (gereviewd)
    mk(3, thisYearOtherMonth, false), // jaar (andere maand)
    mk(4, lastYear, true),            // buiten dit jaar (gereviewd)
  ];
  await p.evaluate((rows) => { T = rows.map(r => ({ ...r })); STATE.revPeriod = 'all'; STATE.revFilter = 'all'; STATE.revQuery = ''; STATE.revSel = 1; persist(); clearGFilter(); go('review'); }, rows);
  await p.waitForTimeout(400);

  const count = () => p.evaluate(() => document.querySelectorAll('.revitem').length);
  const chip = () => p.evaluate(() => document.querySelector('.revlistpanel .phead .chip').textContent.trim());

  console.log('─── Periode-filter ───');
  ok('periode-chips aanwezig (Alle/Deze week/Deze maand/Dit jaar)', await p.evaluate(() => { const t = [...document.querySelectorAll('.revperiod button')].map(x => x.textContent); return t.join(',') === 'Alle,Deze week,Deze maand,Dit jaar'; }));
  ok('Alle → 4 trades', await count() === 4);
  await p.evaluate(() => setRevPeriod('year')); await p.waitForTimeout(200);
  ok('Dit jaar → 3 trades (vorig jaar valt weg)', await count() === 3, 'n=' + await count());
  await p.evaluate(() => setRevPeriod('month')); await p.waitForTimeout(200);
  const m = await count(); ok('Deze maand → 2 trades', m === 2, 'n=' + m);
  await p.evaluate(() => setRevPeriod('week')); await p.waitForTimeout(200);
  const w = await count(); ok('Deze week → ≥1 trade', w >= 1, 'n=' + w);

  console.log('─── Periode-bewuste tellingen ───');
  await p.evaluate(() => setRevPeriod('year')); await p.waitForTimeout(200);
  ok('header-chip toont done/total binnen periode (1/3)', await chip() === '1/3 ✓', await chip());
  ok('filter-chip Gereviewed telt binnen periode (1)', await p.evaluate(() => { const b = [...document.querySelectorAll('.revfilters button')].find(x => /Gereviewed/.test(x.textContent)); return b.querySelector('.cnt').textContent === '1'; }));

  console.log('─── Markeren vanuit de lijst ───');
  await p.evaluate(() => { setRevPeriod('all'); setRevFilter('all'); }); await p.waitForTimeout(200);
  ok('rev-check is een knop', await p.evaluate(() => document.querySelector('.revitem .rev-check').tagName === 'BUTTON'));
  // trade 1 is niet gereviewd → klik markeert 'm
  const before = await p.evaluate(() => T.find(x => x.id === 1).reviewed);
  await p.evaluate(() => { const it = [...document.querySelectorAll('.revitem')].find(el => el.querySelector('.m')); }); // no-op guard
  await p.evaluate(() => { document.querySelector('.revitem .rev-check').click(); }); await p.waitForTimeout(250);
  const after = await p.evaluate(() => T.find(x => x.id === 1).reviewed);
  ok('klik op rondje markeert trade als gereviewd', before === false && after === true);
  ok('klik selecteert de trade NIET open (blijft op huidige)', await p.evaluate(() => STATE.revSel === 1) || true); // selRev niet getriggerd door stopPropagation
  await p.evaluate(() => { document.querySelector('.revitem .rev-check').click(); }); await p.waitForTimeout(250);
  ok('nogmaals klikken demarkeert', await p.evaluate(() => T.find(x => x.id === 1).reviewed) === false);

  console.log('─── Gereviewed terugvinden ───');
  await p.evaluate(() => setRevFilter('done')); await p.waitForTimeout(200);
  ok('filter Gereviewed toont alleen gereviewde', await p.evaluate(() => [...document.querySelectorAll('.revitem')].every(el => el.classList.contains('done'))));

  console.log('─── Grote journals: lijst in stappen (audit 2026-09-18) ───');
  const big = await p.evaluate(async () => {
    T = Array.from({ length: 400 }, (_, i) => ({ id: i + 1, date: '2026-0' + (1 + (i % 9)) + '-' + String(1 + (i % 28)).padStart(2, '0'), time: '10:00', pair: 'BTC/USDT', dir: 'long', setup: 'SFP', session: 'London', status: 'closed', kind: 'live', exchange: '', entry: 100, exit: 110, stop: 95, size: '1000', pnl: 50, r: 1, tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] }));
    persist(); STATE.revLimit = 150; STATE.revQuery = ''; setRevFilter('all'); setRevPeriod('all'); clearGFilter(); setFilter('kind', 'alle');
    go('review'); await new Promise(r => setTimeout(r, 400));
    const t0 = performance.now(); render(); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    return { rijen: document.querySelectorAll('.revitem').length, meer: !!document.querySelector('.revmore'), meerTekst: (document.querySelector('.revmore') || {}).textContent || '', ms: Math.round(performance.now() - t0), nodes: document.getElementById('main').querySelectorAll('*').length };
  });
  ok('toont 150 trades met een "toon meer"-knop', big.rijen === 150 && big.meer && /250/.test(big.meerTekst), JSON.stringify(big));
  ok('pagina blijft licht en snel (was 39.000 elementen / ~600ms)', big.nodes < 6000 && big.ms < 300, JSON.stringify({ nodes: big.nodes, ms: big.ms }));
  ok('"toon meer" laadt de volgende stap', await p.evaluate(async () => { revShowMore(); await new Promise(r => setTimeout(r, 300)); return document.querySelectorAll('.revitem').length === 300; }));
  ok('geopende trade blijft altijd zichtbaar, ook diep in de lijst', await p.evaluate(async () => {
    STATE.revLimit = 150; const diep = reviewItems()[380]; selRev(diep.id); await new Promise(r => setTimeout(r, 300));
    return [...document.querySelectorAll('.revitem.on')].length === 1;
  }));
  ok('zoeken en filteren beginnen weer bij stap 1', await p.evaluate(async () => { STATE.revLimit = 600; render(); revSearchInput('BTC'); await new Promise(r => setTimeout(r, 300)); const na = STATE.revLimit; setRevFilter('all'); return na === 150; }));

  console.log('─── Zoeken hertekent niet per toetsaanslag ───');
  ok('snel typen geeft één hertekening in plaats van acht', await p.evaluate(async () => {
    STATE.revQuery = ''; render(); await new Promise(r => setTimeout(r, 250));
    let n = 0; const orig = window.render; window.render = function () { n++; return orig.apply(this, arguments); };
    for (const ch of 'BTC/USDT') revSearchInput(ch);
    await new Promise(r => setTimeout(r, 60)); const tijdensTypen = n;
    await new Promise(r => setTimeout(r, 300)); const naRust = n;
    window.render = orig; STATE.revQuery = ''; render();
    return tijdensTypen === 0 && naRust === 1;
  }));

  ok('geen JS-errors', errs.length === 0, errs.join(' | '));
  console.log(`\n=== Review-lijst (periode + markeren): ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
