const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (extra ? '  → ' + extra : '')); } };
const mk = (id, over) => Object.assign({ id, date: '2026-08-31', time: '10:00', pair: 'BTC/USDT', dir: 'long', setup: 'BOS-retest', session: 'London', timeframe: '15M', market: 'Trending', grade: 'A', exchange: 'mexc', status: 'closed', kind: 'live', pnl: 100, r: 1, pnlPct: 0.5, entry: 100, stop: 95, tp: 110, exit: 108, size: 5000, risk: 1, leverage: 5, rrPlanned: 2, reviewed: false, tags: [], layers: [], emotions: [], mistakes: [], screenshots: [], tvLinks: [], checks: [] }, over || {});
(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
  const b = await chromium.launch(); const p = await b.newPage(); p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.setViewportSize({ width: 1600, height: 1000 });
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  await p.evaluate(() => { try { hideWelcome() } catch (e) {} T = []; });
  ok('boot zonder fout', errs.length === 0, errs.join(' | '));

  console.log('─── Trade-form: links toevoegen/valideren ───');
  await p.evaluate(() => { T = [{ id: 1, date: '2026-08-31', time: '10:00', pair: 'BTC/USDT', dir: 'long', setup: 'BOS-retest', session: 'London', status: 'closed', kind: 'live', pnl: 100, r: 1, pnlPct: 0.5, entry: 100, stop: 95, tp: 110, exit: 108, size: 5000, tvLinks: [], screenshots: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [] }]; persist(); openForm(1); });
  await p.waitForTimeout(300);
  ok('form heeft TradingView-link veld', await p.evaluate(() => !!document.getElementById('f_tvlink') && !!document.getElementById('tvlinkbuilder')));
  // geldige link (met protocol)
  await p.evaluate(() => { document.getElementById('f_tvlink').value = 'https://www.tradingview.com/x/aBc123/'; addFormTvLink(); });
  ok('geldige link toegevoegd', await p.evaluate(() => formTvLinks.length === 1));
  // bare host → https:// wordt geprepend
  await p.evaluate(() => { document.getElementById('f_tvlink').value = 'tradingview.com/chart/xyz'; addFormTvLink(); });
  ok('bare host krijgt https:// prefix', await p.evaluate(() => formTvLinks.length === 2 && formTvLinks[1].startsWith('https://')));
  // duplicate wordt geweigerd
  await p.evaluate(() => { document.getElementById('f_tvlink').value = 'https://www.tradingview.com/x/aBc123/'; addFormTvLink(); });
  ok('duplicaat geweigerd', await p.evaluate(() => formTvLinks.length === 2));
  // javascript: URL geweigerd (security)
  await p.evaluate(() => { document.getElementById('f_tvlink').value = 'javascript:alert(1)'; addFormTvLink(); });
  ok('javascript: URL geweigerd', await p.evaluate(() => formTvLinks.length === 2 && !formTvLinks.some(u => /javascript:/i.test(u))));
  // chip rendert met veilige anchor
  ok('chip = anchor target=_blank rel=noopener noreferrer', await p.evaluate(() => { const a = document.querySelector('#tvlinkbuilder .tvchip a'); return a && a.target === '_blank' && /noopener/.test(a.rel) && /noreferrer/.test(a.rel); }));
  // verwijderen
  await p.evaluate(() => removeFormTvLink(0));
  ok('link verwijderen werkt', await p.evaluate(() => formTvLinks.length === 1));

  console.log('─── Opslaan op de trade ───');
  await p.evaluate(() => submitForm(1)); await p.waitForTimeout(200);
  ok('tvLinks opgeslagen op trade', await p.evaluate(() => { const t = T.find(x => x.id === 1); return t.tvLinks.length === 1 && t.tvLinks[0].startsWith('https://'); }));

  console.log('─── Review-pagina: sectie boven screenshots ───');
  await p.evaluate(() => { STATE.revSel = 1; clearGFilter(); go('review'); }); await p.waitForTimeout(300);
  ok('TradingView-paneel aanwezig', await p.evaluate(() => [...document.querySelectorAll('#main .panel h3')].some(h => /TradingView/.test(h.textContent))));
  ok('review-link opent in nieuw tabblad (target/rel)', await p.evaluate(() => { const a = document.querySelector('.revshots-col .tvlink'); return a && a.target === '_blank' && /noopener/.test(a.rel) && /noreferrer/.test(a.rel); }));
  ok('link staat BOVEN de screenshots', await p.evaluate(() => {
    const panels = [...document.querySelectorAll('.revshots-col .panel')];
    const tvIdx = panels.findIndex(pl => /TradingView/.test(pl.querySelector('h3').textContent));
    const shotIdx = panels.findIndex(pl => /Screenshots/.test(pl.querySelector('h3').textContent));
    return tvIdx >= 0 && shotIdx >= 0 && tvIdx < shotIdx;
  }));
  ok('href intact (https tradingview)', await p.evaluate(() => { const h = document.querySelector('.revshots-col .tvlink').getAttribute('href'); return h.startsWith('https://') && h.includes('tradingview.com'); }));
  // trade zonder links → geen paneel
  await p.evaluate(() => { T.push({ id: 2, date: '2026-08-30', time: '10:00', pair: 'ETH/USDT', dir: 'long', setup: 'Reclaim', session: 'US AM', status: 'closed', kind: 'live', pnl: 50, r: 1, pnlPct: 0.2, entry: 100, stop: 95, tp: 110, exit: 105, size: 3000, tvLinks: [], screenshots: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [] }); STATE.revSel = 2; go('review'); }); await p.waitForTimeout(200);
  ok('geen links → geen TradingView-paneel', await p.evaluate(() => ![...document.querySelectorAll('.revshots-col .panel h3')].some(h => /TradingView/.test(h.textContent))));

  console.log('─── Coach-pakket bevat de links ───');
  const pkg = await p.evaluate(() => { const t = T.find(x => x.id === 1); return coachPkgHTML([t], { name: 'D', hide: true, shotMap: { 1: [] } }); });
  ok('pakket toont TradingView-sectie', /TradingView/.test(pkg) && /class="tvlink"/.test(pkg));
  ok('pakket-link target=_blank + rel', /<a class="tvlink"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/.test(pkg));

  ok('geen JS-errors', errs.length === 0, errs.join(' | '));
  console.log(`\n=== TradingView-links: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
