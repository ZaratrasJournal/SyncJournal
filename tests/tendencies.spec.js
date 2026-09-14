// Borgt de vernieuwde Tendencies-pagina: Edge/Lek-kaart (min-N), Dim×Dim kruis-heatmap
// (dropdowns + klik=filter + min-sample-guard), weekdag×uur heatmap, 3-lagen-volgorde.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const HH = ['08', '09', '10', '14', '15', '19', '20', '03'];
const mk = (id) => { const setup = ['Trend', 'VWAP', 'BOS'][id % 3]; const sess = ['London', 'US AM', 'Asia'][id % 3];
  // Trend wint duidelijk, VWAP verliest duidelijk, BOS ~breakeven → duidelijke edge/lek
  const win = setup === 'Trend' ? (id % 10 < 7) : setup === 'VWAP' ? (id % 10 < 2) : (id % 10 < 5); const r = win ? 1.4 : -1;
  return { id, date: '2026-0' + (1 + (id % 6)) + '-1' + (id % 8), time: HH[id % HH.length] + ':10', pair: 'BTC/USDT', dir: id % 2 ? 'long' : 'short', setup, session: sess, grade: 'A', exchange: 'mexc', status: 'closed', kind: 'live', entry: 100, stop: 95, tp: 110, exit: 108, size: 5000, rrPlanned: 2, mae: 0.4, mfe: 2, durationMin: 60, emotion: setup === 'Trend' ? 'Kalm' : 'FOMO', tvLinks: [], screenshots: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], pnl: r * 200, r }; };
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

  const rows = []; for (let i = 0; i < 240; i++) rows.push(mk(i));
  await p.evaluate((rows) => { T = rows; STATE.theme = 'dark'; document.body.classList.add('dark'); STATE.tendRow = 'setup'; STATE.tendCol = 'session'; persist(); clearGFilter(); setFilter('kind', 'alle'); go('tendencies'); }, rows);
  await p.waitForTimeout(500);

  console.log('─── 3-lagen-volgorde ───');
  ok('sectiekoppen Conclusie/Kruis/Tijd/Detail', await p.evaluate(() => { const s = [...document.querySelectorAll('.sect-h')].map(x => x.textContent); return /Conclusie/.test(s[0]) && /Kruis/.test(s[1]) && /Tijd/.test(s.join('|')) && /Detail/.test(s.join('|')); }));

  console.log('─── Verdict: Edge/Lek-kaart ───');
  ok('edge- en lek-kaart aanwezig', await p.evaluate(() => document.querySelector('.vcard.edge') && document.querySelector('.vcard.leak')));
  ok('edge = Trend (winnende combinatie)', await p.evaluate(() => /Trend/.test(document.querySelector('.vcard.edge .vcombo').textContent)));
  ok('lek = VWAP (verliezende combinatie)', await p.evaluate(() => /VWAP/.test(document.querySelector('.vcard.leak .vcombo').textContent)));

  console.log('─── Kruis-heatmap ───');
  ok('twee dimensie-dropdowns', await p.evaluate(() => document.querySelectorAll('.crossctrl select').length === 2));
  ok('heatmap-cellen aanwezig', await p.evaluate(() => document.querySelectorAll('.thm td[data-t]').length >= 4));
  ok('cel toont gem. R + n', await p.evaluate(() => { const c = document.querySelector('.thm td[data-t] .thm-v'); return c && /R/.test(c.textContent); }));
  // dropdown wisselen → andere dimensie
  await p.evaluate(() => { const s = document.querySelector('.crossctrl select'); s.value = 'emo'; s.dispatchEvent(new Event('change')); });
  await p.waitForTimeout(300);
  ok('dropdown wisselt rij-dimensie (emotie-rijen)', await p.evaluate(() => [...document.querySelectorAll('.thm th.rowh')].some(x => /Kalm|FOMO/.test(x.textContent))));
  await p.evaluate(() => { const s = document.querySelector('.crossctrl select'); s.value = 'setup'; s.dispatchEvent(new Event('change')); });
  await p.waitForTimeout(300);

  console.log('─── Min-sample-guard ───');
  // seed een schaarse combinatie (n<8) en check faded
  await p.evaluate(() => { const extra = { id: 9000, date: '2026-05-04', time: '10:10', pair: 'BTC/USDT', dir: 'long', setup: 'Zeldzaam', session: 'London', status: 'closed', kind: 'live', pnl: 100, r: 1, rrPlanned: 2, mae: 0.4, mfe: 2, emotion: 'Kalm', grade: 'A', exchange: 'mexc', tvLinks: [], screenshots: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [] }; T = [...T, extra, { ...extra, id: 9001 }, { ...extra, id: 9002 }]; persist(); go('tendencies'); });
  await p.waitForTimeout(400);
  ok('schaarse cel (<8) is faded', await p.evaluate(() => { const r = [...document.querySelectorAll('.thm tr')].find(tr => /Zeldzaam/.test((tr.querySelector('.rowh') || {}).textContent || '')); return r && [...r.querySelectorAll('td')].some(td => td.classList.contains('faded')); }));

  console.log('─── Weekdag × uur ───');
  ok('weekdag×uur heatmap (7×24 cellen)', await p.evaluate(() => document.querySelectorAll('.whm .whm-cell').length === 7 * 24));
  ok('hover-tooltip via whMove', await p.evaluate(() => { const c = document.querySelector('.whm .whm-cell'); whMove({ target: c }); return document.getElementById('yhtip').classList.contains('on'); }));
  await p.evaluate(() => yhHide());

  console.log('─── Klik-filter ───');
  await p.evaluate(() => { STATE.tendRow = 'setup'; STATE.tendCol = 'session'; go('tendencies'); }); await p.waitForTimeout(300);
  await p.evaluate(() => { const td = [...document.querySelectorAll('.thm td[data-t]')].find(x => /Trend · London/.test(x.dataset.t) && !x.classList.contains('faded')); if (td) td.click(); });
  await p.waitForTimeout(300);
  ok('cel-klik filtert setup+sessie → trades', await p.evaluate(() => STATE.page === 'trades' && FILTER.setup.includes('Trend') && FILTER.session.includes('London')));
  ok('tooltip weg na klik+navigatie', await p.evaluate(() => !document.getElementById('yhtip').classList.contains('on')));

  ok('geen JS-errors', errs.length === 0, errs.join(' | '));
  console.log(`\n=== Tendencies: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
