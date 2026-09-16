// Borgt ChangeMaker-feedback 2026-09-14: trades met een toegewezen fout waren nergens
// terug te vinden. Nu: fouten-filter in de filterbar, zoekbalk vindt fouten én álle
// emoties (niet alleen de eerste), fout-chips in de uitklaprij zijn klikbaar, en de
// Fout-analyse in Analytics telt alle fouten per trade en klikt door naar die trades.
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
    const base = { time: '10:00', setup: 'SFP', session: 'London', status: 'closed', kind: 'live', exchange: 'blofin', entry: 100, exit: 110, stop: 95, size: '1000', r: 1, tps: [], tags: [], layers: [], checks: [], screenshots: [], tvLinks: [] };
    T = [
      { ...base, id: 1, date: '2026-09-10', pair: 'BTC/USDT', dir: 'long', pnl: -50, emotions: ['FOMO', 'Ongeduld'], mistakes: ['Overtrading', 'Positie te groot'] },
      { ...base, id: 2, date: '2026-09-11', pair: 'ETH/USDT', dir: 'short', pnl: -30, emotions: [], mistakes: [], mistake: 'Overtrading' }, // oud enkelvoud-veld
      { ...base, id: 3, date: '2026-09-12', pair: 'SOL/USDT', dir: 'long', pnl: 100, emotions: [], mistakes: [] },
    ]; persist(); clearGFilter(); go('trades');
  });
  ok('boot zonder JS-errors', errs.length === 0, errs.slice(0, 2).join(' | '));

  console.log('─── Zoekbalk vindt fouten en alle emoties ───');
  ok('zoek "overtrading" → beide trades met die fout (ook oud enkelvoud-veld)', await p.evaluate(() => { STATE.query = 'overtrading'; render(); return curTradeRows().length === 2; }));
  ok('zoek "positie te groot" → de trade met die tweede fout', await p.evaluate(() => { STATE.query = 'positie te groot'; render(); return curTradeRows().length === 1 && curTradeRows()[0].id === 1; }));
  ok('zoek "ongeduld" → tweede emotie telt ook mee', await p.evaluate(() => { STATE.query = 'ongeduld'; render(); return curTradeRows().length === 1; }));
  await p.evaluate(() => { STATE.query = ''; render(); });

  console.log('─── Fouten-filter in de filterbar ───');
  ok('dropdown "Alle fouten" aanwezig met configuratie-opties', await p.evaluate(() => { const dd = document.querySelector('[data-dd="mistake"]'); return dd && /Alle fouten/.test(dd.textContent) && /Overtrading/.test(dd.textContent) && /Revenge trade/.test(dd.textContent); }));
  ok('filter Overtrading → 2 trades in de tabel', await p.evaluate(() => { setFilter('mistake', 'Overtrading'); return FT.length === 2 && document.querySelectorAll('#main tbody tr.mrow').length === 2; }));
  ok('filter Positie te groot → 1 trade', await p.evaluate(() => { setFilter('mistake', 'Positie te groot'); return FT.length === 1; }));
  ok('filter telt mee in Wis-knop en wist netjes', await p.evaluate(() => { const had = countActive() >= 1; clearGFilter(); return had && FILTER.mistake.length === 0 && FT.length === 3; }));
  ok('fout-chip in uitklaprij is klikbaar naar het filter', await p.evaluate(() => /setFilter\('mistake'/.test(tradeHoverDetail(T.find(t => t.id === 1)))));

  console.log('─── Fout-analyse in Analytics ───');
  await p.evaluate(() => go('analytics')); await p.waitForTimeout(700);
  ok('paneel aanwezig met klik-hint', await p.evaluate(() => { const pn = [...document.querySelectorAll('.panel')].find(x => /Fout-analyse/.test(x.textContent)); return pn && /klik = die trades/.test(pn.textContent); }));
  ok('beide fouten van trade 1 staan als bar (niet alleen de eerste)', await p.evaluate(() => { const pn = [...document.querySelectorAll('.panel')].find(x => /Fout-analyse/.test(x.textContent)); return pn && pn.querySelectorAll('.recharts-bar-rectangle').length === 2; }));
  const clicked = await p.evaluate(() => new Promise(res => {
    const pn = [...document.querySelectorAll('.panel')].find(x => /Fout-analyse/.test(x.textContent));
    const bar = pn && pn.querySelector('.recharts-bar-rectangle path');
    if (!bar) return res({ ok: false, why: 'geen bar' });
    bar.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    setTimeout(() => res({ ok: true, page: STATE.page, filt: FILTER.mistake.slice(), rows: FT.length }), 300);
  }));
  // bars staan gesorteerd op netto: Overtrading (−80) eerst → klik = naar die 2 trades
  ok('klik op bar → Trades-pagina gefilterd op die fout', clicked.ok && clicked.page === 'trades' && clicked.filt.join() === 'Overtrading' && clicked.rows === 2, JSON.stringify(clicked));

  console.log('─── Per pair top 6: grootste verliezer valt er niet meer uit ───');
  const r5 = await p.evaluate(() => {
    const base = { time: '10:00', dir: 'long', setup: '', session: 'London', status: 'closed', kind: 'live', exchange: '', entry: 100, exit: 110, stop: 95, size: '1000', r: 1, tps: [], tags: [], layers: [], emotions: [], mistakes: ['Overtrading'], checks: [], screenshots: [], tvLinks: [] };
    T = ['ETH/USDT', 'SOL/USDT', 'DOGE/USDT', 'LINK/USDT', 'AVAX/USDT', 'XRP/USDT'].map((pair, i) => ({ ...base, id: i + 1, date: '2026-09-0' + (i + 1), pair, pnl: 10 + i }));
    T.push({ ...base, id: 99, date: '2026-09-09', pair: 'BTC/USDT', pnl: -1900 });
    persist(); clearGFilter(); setFilter('mistake', 'Overtrading'); go('analytics');
    const pn = [...document.querySelectorAll('.panel')].find(x => /Per pair/.test(x.textContent));
    const rows = pn ? [...pn.querySelectorAll('.hbar-row,.hrow,[class*=hbar]')].map(x => x.textContent) : [];
    return { txt: pn ? pn.textContent : '', hasBtc: /BTC\/USDT/.test(pn ? pn.textContent : '') };
  });
  ok('BTC (−1.9k, grootste impact) staat in de top 6 bij fouten-filter', r5.hasBtc, r5.txt.slice(0, 150));
  ok('kop zegt grootste netto-impact', /grootste netto-impact/.test(r5.txt));

  ok('geen JS-errors totaal', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== Fouten-filter: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
