const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (extra ? '  → ' + extra : '')); } };
// 1x1 transparant PNG
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const mk = (id, over) => Object.assign({ id, date: '2026-08-3' + id, time: '10:00', pair: 'BTC/USDT', dir: 'long', setup: 'BOS-retest', session: 'London', timeframe: '15M', market: 'Trending', grade: 'A', exchange: 'mexc', status: 'closed', kind: 'live', pnl: 540, r: 2.4, pnlPct: 1.8, entry: 63450, stop: 62800, tp: 65100, exit: 65010, size: 8000, risk: 1, leverage: 5, rrPlanned: 2.5, reviewed: false, tags: [], layers: [], emotions: ['Kalm'], emotion: 'Kalm', mistakes: [], mistake: '', screenshots: [], notes: '', lessons: '', checks: [true, true, true, true, true], rating: 5 }, over || {});
(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
  const b = await chromium.launch(); const p = await b.newPage(); p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.setViewportSize({ width: 1600, height: 1000 });
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  await p.evaluate(() => { try { hideWelcome() } catch (e) {} });
  ok('boot zonder fout', errs.length === 0, errs.join(' | '));

  const rows = [
    mk(1, { notes: 'Nette entry <img src=x onerror=alert(1)> "quote" test', lessons: 'Volgende keer wachten', screenshots: [PNG] }),
    mk(2, { pair: 'ETH/USDT', dir: 'short', pnl: -172, r: -0.9, pnlPct: -0.9, grade: 'C', mistakes: ['Te vroeg in'], mistake: 'Te vroeg in', emotions: ['FOMO'], emotion: 'FOMO', screenshots: [], checks: [false, false, true, false, true] }),
    mk(3, { pair: 'SOL/USDT' }),
  ];
  await p.evaluate((rows) => { T = rows.map(r => ({ ...r })); STATE.revSel = 1; STATE.revShareMode = false; STATE.revShareSel = []; persist(); clearGFilter(); go('review'); }, rows);
  await p.waitForTimeout(400);

  console.log('─── Selectie-modus (los van gereviewd-rondje) ───');
  ok('normale lijst heeft gereviewd-rondje (rev-check)', await p.evaluate(() => document.querySelector('.revitem .rev-check') !== null));
  ok('"Deel"-knop aanwezig', await p.evaluate(() => document.querySelector('.revshare-btn') !== null));
  await p.evaluate(() => toggleShareMode()); await p.waitForTimeout(200);
  ok('share-modus: selectie-checkbox i.p.v. gereviewd-rondje', await p.evaluate(() => document.querySelector('.revitem.selmode .rev-selbox') !== null && document.querySelector('.revitem .rev-check') === null));
  ok('share-bar aanwezig', await p.evaluate(() => document.querySelector('.revsharebar') !== null));
  // klik een rij → selecteert (opent NIET de detail)
  await p.evaluate(() => document.querySelectorAll('.revitem.selmode')[0].click()); await p.waitForTimeout(150);
  ok('rij-klik selecteert (1)', await p.evaluate(() => STATE.revShareSel.length === 1));
  ok('geselecteerde rij krijgt .sel', await p.evaluate(() => document.querySelector('.revitem.selmode.sel') !== null));
  await p.evaluate(() => shareSelectAllVisible()); await p.waitForTimeout(150);
  ok('Alles selecteren → 3', await p.evaluate(() => STATE.revShareSel.length === 3));
  await p.evaluate(() => shareClearSel()); await p.waitForTimeout(150);
  ok('Wis → 0', await p.evaluate(() => STATE.revShareSel.length === 0));

  console.log('─── Deel-dialoog ───');
  await p.evaluate(() => { STATE.revShareSel = [1, 2]; render(); openShareDialog(); }); await p.waitForTimeout(200);
  ok('dialoog toont naam-veld + verberg-toggle', await p.evaluate(() => document.getElementById('shareName') !== null && document.getElementById('shareHide') !== null));
  ok('verberg-bedragen standaard aan', await p.evaluate(() => document.getElementById('shareHide').checked === true));
  await p.evaluate(() => closeForm());

  console.log('─── Pakket-inhoud + beveiliging ───');
  const pkg = await p.evaluate(() => { const t1 = T.find(x => x.id === 1), t2 = T.find(x => x.id === 2); return coachPkgHTML([t1, t2], { name: 'Denny', hide: true, shotMap: { 1: [T[0].screenshots[0]], 2: [] } }); });
  ok('titel met aantal trades', /Trade-review. 2 trades ter beoordeling/.test(pkg));
  ok('"gedeeld door" naam', /Gedeeld door <b>Denny/.test(pkg));
  ok('self-contained (geen externe http-resources)', !/(src|href)="https?:/.test(pkg), 'bevat externe ref');
  ok('bevat <style> en <script>', /<style>/.test(pkg) && /<scr/.test(pkg));
  ok('XSS: notes ge-escaped (geen live <img onerror>)', !/<img src=x onerror/.test(pkg) && /&lt;img src=x onerror/.test(pkg));
  ok('screenshot ingebed (base64)', pkg.includes(PNG.slice(0, 40)) || /data:image\/(png|jpeg)/.test(pkg));
  ok('trade zonder screenshot → auto-chart', /Auto-chart/.test(pkg));
  console.log('─── Verberg bedragen vs. tonen ───');
  ok('verborgen: geen $-bedrag zichtbaar, wel R-only', /R-only/.test(pkg) && pkg.includes('•••'));
  const pkgShow = await p.evaluate(() => { const t1 = T.find(x => x.id === 1); return coachPkgHTML([t1], { name: 'D', hide: false, shotMap: { 1: [] } }); });
  ok('tonen: bedrag verschijnt (540), geen •••', /540/.test(pkgShow) && !pkgShow.includes('•••') && !/R-only/.test(pkgShow));

  console.log('─── Screenshot-resizer ───');
  const rs = await p.evaluate(async (u) => await resizeShot(u), PNG);
  ok('resizeShot geeft geldige data-URL terug', /^data:image\/(jpeg|png)/.test(rs), rs.slice(0, 24));

  console.log('─── Pakket rendert zelfstandig zonder JS-errors ───');
  const p2 = await b.newPage(); const perr = []; p2.on('pageerror', e => perr.push(String(e)));
  await p2.setContent(pkg, { waitUntil: 'load' }); await p2.waitForTimeout(200);
  ok('pakket rendert 2 trade-kaarten', await p2.evaluate(() => document.querySelectorAll('.tcard').length === 2));
  ok('samenvatting aanwezig', await p2.evaluate(() => document.querySelectorAll('.sumc').length === 5));
  await p2.evaluate(() => document.querySelector('.shot').click()); await p2.waitForTimeout(150);
  ok('lightbox opent bij klik op screenshot', await p2.evaluate(() => document.getElementById('lb').classList.contains('on')));
  ok('theme-toggle werkt in pakket', await p2.evaluate(() => { document.getElementById('themeBtn').click(); return document.documentElement.getAttribute('data-theme') !== null; }));
  ok('pakket zonder JS-errors', perr.length === 0, perr.join(' | '));
  await p2.close();

  ok('hoofd-app zonder JS-errors', errs.length === 0, errs.join(' | '));
  console.log(`\n=== Deel met coach: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
