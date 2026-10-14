// Playbook filter (Denny 14-10-2026). In SyncJournal t.setup IS the playbook (form field "Playbook").
// The old "Alle setups" dropdown mixed playbook names with setup tags from the layers but only
// matched t.setup, so picking "BOS" always gave 0 trades. Now: "Alle playbooks" filters t.setup,
// "Alle setups" filters the setup tags in the layers, across playbooks. Plus the per-page effects.
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
  const QPB = 'HTF "OB" <POI>';   // quotes and brackets: must survive the dropdown's onclick
  await p.evaluate((QPB) => {
    try { hideWelcome() } catch (e) {}
    const L = (...s) => [{ timeframe: '4H', setups: [], bias: 'Bullish', confirmations: [] }, { timeframe: '1H', setups: s, confirmations: [] }];
    const mk = (id, setup, layers, over) => Object.assign({ id, date: '2026-09-' + String(10 + id).padStart(2, '0'), time: '10:00', pair: 'BTC/USDT', dir: 'long', setup, session: 'London', status: 'closed', kind: 'live', exchange: 'blofin', pnl: id % 2 ? 50 : -20, r: id % 2 ? 1 : -1, entry: 100, stop: 99, exit: 101, layers }, over || {});
    PBOOK = {}; PBOOK['1H MSB/BOS'] = pbNormalize('1H MSB/BOS', { status: 'active' }); PBOOK[QPB] = pbNormalize(QPB, { status: 'active' }); PBOOK['Leeg PB'] = pbNormalize('Leeg PB', { status: 'active' });
    tagConfig.setupTags = ['BOS', 'MSB', 'SFP'];
    T = [mk(1, '1H MSB/BOS', L('BOS')), mk(2, '1H MSB/BOS', L('MSB', 'BOS')), mk(3, QPB, L('SFP')), mk(4, QPB, L('BOS')), mk(5, '', L('MSB'))];
    persist(); clearGFilter(); go('trades');
  }, QPB);
  await p.waitForTimeout(400);
  ok('boot + seed zonder JS-errors', errs.length === 0, errs.slice(0, 2).join(' | '));

  console.log('─── Twee dropdowns, elk met eigen opties ───');
  const opts = k => p.evaluate(k => [...document.querySelectorAll(`.filtbar .dd[data-dd="${k}"] .ddchk span`)].map(x => x.textContent), k);
  const pbOpts = await opts('setup'), suOpts = await opts('setupTag');
  ok('"Alle playbooks" aanwezig', await p.evaluate(() => [...document.querySelectorAll('.filtbar .dd-btn')].some(x => /Alle playbooks/.test(x.textContent))));
  ok('"Alle setups" aanwezig', await p.evaluate(() => [...document.querySelectorAll('.filtbar .dd-btn')].some(x => /Alle setups/.test(x.textContent))));
  ok('playbook-opties = playbooks, geen setup-tags', pbOpts.includes('1H MSB/BOS') && pbOpts.includes(QPB) && pbOpts.includes('Leeg PB') && !pbOpts.includes('BOS'), pbOpts.join(' | '));
  ok('"Zonder playbook" alleen als er zo een trade is', pbOpts.includes('Zonder playbook'));
  ok('setup-opties = setup-tags, geen playbooks', ['BOS', 'MSB', 'SFP'].every(x => suOpts.includes(x)) && !suOpts.includes('1H MSB/BOS'), suOpts.join(' | '));

  console.log('─── Filteren ───');
  ok('playbook 1H MSB/BOS → trades 1 en 2', await p.evaluate(() => { toggleFilter('setup', '1H MSB/BOS'); return FT.map(t => t.id).sort().join() === '1,2'; }));
  ok('playbook met quotes via de dropdown (escaping)', await p.evaluate(() => { clearGFilter(); const cb = [...document.querySelectorAll('.dd[data-dd="setup"] .ddchk')].find(l => l.textContent.includes('<POI>')).querySelector('input'); cb.click(); return FT.map(t => t.id).sort().join() === '3,4'; }));
  ok('Zonder playbook → trade 5', await p.evaluate(() => { clearGFilter(); toggleFilter('setup', ''); return FT.map(t => t.id).join() === '5'; }));
  ok('setup BOS → over playbooks heen (1, 2, 4)', await p.evaluate(() => { clearGFilter(); toggleFilter('setupTag', 'BOS'); return FT.map(t => t.id).sort().join() === '1,2,4'; }));
  ok('playbook + setup = EN (1H MSB/BOS met MSB → 2)', await p.evaluate(() => { toggleFilter('setupTag', 'BOS'); toggleFilter('setupTag', 'MSB'); toggleFilter('setup', '1H MSB/BOS'); return FT.map(t => t.id).join() === '2'; }));
  ok('badge telt beide filters', await p.evaluate(() => countActive() === 2));
  ok('Wis wist ook het setup-filter', await p.evaluate(() => { clearGFilter(); return FILTER.setupTag.length === 0 && FT.length === 5; }));
  ok('backtest-vergelijking (zonder soort-filter) volgt het setup-filter', await p.evaluate(() => { toggleFilter('setupTag', 'SFP'); const n = applyFilterNoKind(T).length; clearGFilter(); return n === 1; }));

  console.log('─── Effect per pagina ───');
  ok('Playbook-pagina: alleen de gekozen playbook als kaart', await p.evaluate(() => { toggleFilter('setup', '1H MSB/BOS'); go('playbook'); return document.querySelectorAll('.pbcard').length === 1 && /1H MSB\/BOS/.test(document.querySelector('.pbcard').textContent); }));
  ok('Playbook-pagina zonder filter: alle playbooks', await p.evaluate(() => { clearGFilter(); return document.querySelectorAll('.pbcard').length === 3; }));
  ok('Playbook-detail binnen een filter dat niets overlaat: 0 trades, niet alles', await p.evaluate(() => { const n = () => { const h = [...document.querySelectorAll('#main .phead')].find(x => x.querySelector('h3') && x.querySelector('h3').textContent.trim() === 'Trades'); return h ? h.querySelector('.chip').textContent.trim() : '?'; };
    STATE.pbSel = '1H MSB/BOS'; render(); const zonder = n(); setFilter('pair', 'ETH/USDT'); const met = n(); STATE.pbSel = null; clearGFilter(); return zonder === '2' && met === '0'; }));
  ok('Review: lege playbook toont een lege lijst, niet alle trades', await p.evaluate(() => { toggleFilter('setup', 'Leeg PB'); go('review'); const n = document.querySelectorAll('.revitem').length; clearGFilter(); return n === 0; }));
  ok('Tendencies: tab heet "Per playbook"', await p.evaluate(() => { go('tendencies'); return /Per playbook/.test(document.getElementById('main').innerText); }));

  ok('doorklikken op "—" (geen playbook) = Zonder playbook', await p.evaluate(() => { clearGFilter(); matrixCell('—', ''); const r = FILTER.setup.length === 1 && FILTER.setup[0] === '' && FT.map(t => t.id).join() === '5'; clearGFilter(); return r; }));
  ok('geen JS-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n${pass} ✓  ${fail} ✗`); await b.close(); process.exit(fail ? 1 : 0);
})();
