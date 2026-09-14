// Borgt de fixes op de testgebruiker-feedback (ChangeMaker) + Denny's tag-bug:
// A1 balans filter-onafhankelijk · A2 setup opslaan/legen · A3 tags-cirkel gesloten
// (picker → opslaan → kolom → filter) · A4/A5 dynamische filteropties · A6 R-explosie-guards.
// Blok B (filter-indicator, analytics-teller) en C (status-filter, TP-veld/tijden) volgen onderin.
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
  await p.evaluate(() => { try { hideWelcome() } catch (e) {} T = []; TRASH = []; MANUAL = []; persist(); persistManual(); clearGFilter(); setFilter('kind', 'alle'); });
  ok('boot zonder JS-errors', errs.length === 0, errs.slice(0, 2).join(' | '));

  console.log('─── A1: balans is filter-onafhankelijk ───');
  const bal = await p.evaluate(() => {
    MANUAL = [{ id: 'm-ftmo', name: 'FTMO Challenge', transactions: [{ id: 'tx1', type: 'deposit', amount: '100000', date: '2026-01-01', note: '' }] }]; persistManual();
    const mk = (id, setup, pnl) => ({ id, date: '2026-09-0' + (1 + id % 8), time: '10:00', pair: 'BTC/USDT', dir: 'long', setup, session: 'London', status: 'closed', kind: 'live', exchange: 'm-ftmo', entry: 100, exit: 110, stop: 95, size: '1000', pnl, r: pnl > 0 ? 1 : -1, tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] });
    T = [mk(1, 'Trend-pullback', 5000), mk(2, 'Trend-pullback', 3000), mk(3, 'Range-fade', -6000)]; persist(); render();
    const before = totalBalance();
    setFilter('setup', 'Trend-pullback');       // winnende setup — vroeger steeg de balans hierdoor
    const after = totalBalance();
    setFilter('setup', '');
    return { before, after };
  });
  // 126663 = demo-exchange-saldi (24663) + FTMO-inleg 100000 + netto trade-PnL 2000
  ok('totale balans identiek mét en zonder setup-filter', bal.before === bal.after && bal.before === 126663, JSON.stringify(bal));

  console.log('─── A2: setup wijzigen & legen ───');
  const a2 = await p.evaluate(() => {
    openForm(1); const sel = document.getElementById('f_playbook');
    sel.value = 'London SFP'; onPlaybookPick(); submitForm(1);
    const changed = T.find(x => x.id === 1).setup;
    openForm(1); const sel2 = document.getElementById('f_playbook');
    sel2.value = ''; onPlaybookPick(); submitForm(1);
    const cleared = T.find(x => x.id === 1).setup;
    return { changed, cleared };
  });
  ok('setup wijzigen naar London SFP slaat op', a2.changed === 'London SFP', JSON.stringify(a2));
  ok('expliciet "— geen —" maakt setup echt leeg', a2.cleared === '', JSON.stringify(a2));
  ok('onaangeraakt leeg playbook-veld valt terug op de entry-laag', await p.evaluate(() => {
    // bestaande trade zónder playbook-setup: select staat onaangeraakt op "— geen —"
    T.push({ id: 55, date: '2026-09-04', time: '09:00', pair: 'LINK/USDT', dir: 'long', setup: '', session: 'London', status: 'closed', kind: 'live', exchange: '', entry: 100, exit: 105, stop: 98, size: '500', pnl: 25, r: 1, tps: [], tags: [], layers: [{ timeframe: '15M', bias: 'long', setups: ['BOS-retest'], confirmations: [] }], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] }); persist();
    openForm(55); submitForm(55);
    return T.find(x => x.id === 55).setup === 'BOS-retest';
  }));

  console.log('─── A3: tag-cirkel — Instellingen → picker → opslaan → kolom → filter ───');
  const a3 = await p.evaluate(() => {
    tagConfig.customTags = [...(tagConfig.customTags || []), 'MijnNieuweTag']; persistTagConfig();
    openForm(1); renderFormTags();
    const inPicker = [...document.querySelectorAll('#tagpick .tagopt')].some(x => x.textContent === 'MijnNieuweTag');
    toggleFormTag('MijnNieuweTag'); submitForm(1);
    go('trades'); const row = [...document.querySelectorAll('tbody tr')].find(r => /BTC\/USDT/.test(r.textContent) && /MijnNieuweTag/.test(r.textContent));
    const inFilterOpts = [...document.querySelectorAll('.filtbar .ddchk span')].some(x => x.textContent === 'MijnNieuweTag');
    setFilter('tag', 'MijnNieuweTag'); const filtered = FT.length;
    setFilter('tag', '');
    return { inPicker, inRow: !!row, inFilterOpts, filtered };
  });
  ok('nieuwe config-tag zichtbaar in trade-picker', a3.inPicker);
  ok('na opslaan zichtbaar in de Tags-kolom', a3.inRow);
  ok('aanwezig in het tag-filter en filtert correct (1)', a3.inFilterOpts && a3.filtered === 1, JSON.stringify(a3));
  const a3b = await p.evaluate(() => {
    T.push({ id: 77, date: '2026-09-05', time: '11:00', pair: 'SOL/USDT', dir: 'long', setup: '', session: 'London', status: 'closed', kind: 'live', exchange: '', entry: 10, exit: 11, stop: 9, size: '100', pnl: 10, r: 1, tps: [], tags: [], layers: [{ timeframe: '15M', bias: '', setups: [], confirmations: ['FVG'] }], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] }); persist(); render();
    const row = [...document.querySelectorAll('tbody tr')].find(r => /SOL\/USDT/.test(r.textContent));
    setFilter('tag', 'FVG'); const n = FT.length; setFilter('tag', '');
    return { rowHasFvg: row && /FVG/.test(row.textContent), n };
  });
  ok('laag-confirmatie (FVG) zichtbaar in kolom én filterbaar', a3b.rowHasFvg && a3b.n === 1, JSON.stringify(a3b));

  console.log('─── A4/A5: dynamische filteropties ───');
  ok('eigen setup (via tags-config) direct in setup-filter', await p.evaluate(() => { tagConfig.setupTags = [...(tagConfig.setupTags || []), 'Test Setup XYZ']; persistTagConfig(); render(); return [...document.querySelectorAll('.filtbar .ddchk span')].some(x => x.textContent === 'Test Setup XYZ'); }));
  ok('playbook-naam in setup-filter', await p.evaluate(() => [...document.querySelectorAll('.filtbar .ddchk span')].some(x => x.textContent === 'London SFP')));

  console.log('─── A6: R-explosie-guards ───');
  ok('tradeR neutraliseert datafouten (|R|>100 → 0)', await p.evaluate(() => tradeR({ r: 430316479702.99 }) === 0 && tradeR({ r: -430316479702.99 }) === 0 && tradeR({ r: 2.5 }) === 2.5));
  const kpi = await p.evaluate(() => {
    T.push({ id: 666, date: '2026-09-06', time: '12:00', pair: 'DOGE/USDT', dir: 'long', setup: '', session: 'London', status: 'closed', kind: 'live', exchange: '', entry: 62.1, exit: 62.2, stop: 62.0999, size: '20388', pnl: 124, r: -430316479702.99, tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] }); persist(); go('dashboard');
    const tile = [...document.querySelectorAll('.kpi')].find(x => /GEM\. R/i.test(x.textContent));
    return tile ? tile.querySelector('.v').textContent.trim() : 'geen tile';
  });
  ok('Gem. R-KPI blijft normaal ondanks giftige trade', kpi.length < 12 && !/\d{6}/.test(kpi), kpi);
  ok('formulier berekent geen R bij stop ≈ entry', await p.evaluate(() => { openForm(null); document.getElementById('f_entry').value = '62.1'; document.getElementById('f_stop').value = '62.0999'; document.getElementById('f_exit').value = '62.2'; document.getElementById('f_size').value = '20388'; document.getElementById('f_r').value = ''; calcTrade(true); const v = document.getElementById('f_r').value; closeForm(); return v === ''; }));
  ok('waarschuwing bij onrealistische R in rekenbalk', await p.evaluate(() => { openForm(null); document.getElementById('f_entry').value = '100'; document.getElementById('f_stop').value = '99.99'; document.getElementById('f_exit').value = '110'; document.getElementById('f_size').value = '10000'; calcTrade(true); const warn = /onrealistisch/.test(document.getElementById('calcPrev').textContent); closeForm(); return warn; }));

  console.log('─── B1: globale filter-indicator in de app-balk ───');
  const b1 = await p.evaluate(() => {
    setFilter('setup', 'Trend-pullback');
    const badge = document.getElementById('gfBadge');
    const shown = !badge.hidden && / van /.test(badge.textContent) && /hele app/.test(badge.textContent);
    go('kalender'); const onOtherPage = !document.getElementById('gfBadge').hidden;
    badge.querySelector('button').click();
    const cleared = document.getElementById('gfBadge').hidden && FILTER.setup.length === 0;
    go('trades'); return { shown, onOtherPage, cleared };
  });
  ok('indicator toont aantallen + uitleg bij actief filter', b1.shown, JSON.stringify(b1));
  ok('indicator zichtbaar op andere pagina\'s', b1.onOtherPage);
  ok('Wis-knop in de indicator wist alle filters', b1.cleared);

  console.log('─── B2: analytics-teller ───');
  ok('scope-chip legt gesloten/open-telling uit', await p.evaluate(() => { T.push({ id: 800, date: '2026-09-07', time: '10:00', pair: 'BTC/USDT', dir: 'long', setup: '', session: 'London', status: 'open', kind: 'live', exchange: '', entry: 100, exit: 0, stop: 95, size: '100', pnl: 0, r: 0, tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] }); persist(); go('analytics'); const txt = document.getElementById('main').textContent; return /trades in de berekening/.test(txt) && /open niet meegerekend/.test(txt); }));

  console.log('─── C1: status-filter ───');
  const c1 = await p.evaluate(() => { go('trades'); const hasSel = [...document.querySelectorAll('.filtbar .ddchk span')].some(x => x.textContent === 'Partial'); setFilter('status', 'open'); const allOpen = FT.length > 0 && FT.every(t => t.status === 'open'); setFilter('status', ''); return { hasSel, allOpen }; });
  ok('status-dropdown aanwezig + filtert op open', c1.hasSel && c1.allOpen, JSON.stringify(c1));

  console.log('─── C2: FAQ partial ───');
  ok('FAQ legt "partial" uit', await p.evaluate(() => { go('faq'); return /deels gesloten/i.test(document.querySelector('.faqwrap').textContent); }));

  console.log('─── C3: TP-veld weg, R:R via TP1 ───');
  const c3 = await p.evaluate(() => {
    openForm(null);
    const noField = !document.getElementById('f_tp');
    document.getElementById('f_entry').value = '100'; document.getElementById('f_stop').value = '95';
    formTPs = [{ price: '110', pct: 100, r: '', hit: false, ts: 0, tsTime: '' }]; renderTPs(); calcTrade(true);
    const rr = document.getElementById('f_rrPlanned').value;
    closeForm(); return { noField, rr };
  });
  ok('los Take-profit-veld is weg', c3.noField);
  ok('geplande R:R berekend uit TP1 (110 → 2:1)', c3.rr === '2', JSON.stringify(c3));

  console.log('─── C4: TP-sluittijden ───');
  const c4 = await p.evaluate(() => {
    openForm(null);
    document.getElementById('f_pair').value = 'ATOM/USDT'; document.getElementById('f_date').value = '2026-09-12'; document.getElementById('f_time').value = '10:00';
    document.getElementById('f_entry').value = '10'; document.getElementById('f_exit').value = '11'; document.getElementById('f_pnl').value = '5';
    formTPs = [{ price: '10.5', pct: 50, r: '', hit: true, ts: 0, tsTime: '12:30' }, { price: '11', pct: 50, r: '', hit: true, ts: 0, tsTime: '08:15' }]; renderTPs();
    const hasTimeInput = !!document.querySelector('.tpin.tptime');
    submitForm(null);
    const t = T.find(x => x.pair === 'ATOM/USDT');
    return { hasTimeInput, ts1: t.tps[0].ts, ts2: t.tps[1].ts, sameDay: new Date(t.tps[0].ts).getDate(), nextDay: new Date(t.tps[1].ts).getDate() };
  });
  ok('tijd-veld zichtbaar bij geraakte TP', c4.hasTimeInput);
  ok('TP-tijd opgeslagen (12:30 zelfde dag)', c4.ts1 === +new Date('2026-09-12T12:30'), JSON.stringify(c4));
  ok('TP-tijd vóór open-tijd → volgende dag (overnight)', c4.ts2 === +new Date('2026-09-13T08:15'), JSON.stringify(c4));
  ok('tijdlijn toont handmatige TP-tijd', await p.evaluate(() => { const t = T.find(x => x.pair === 'ATOM/USDT'); STATE.revSel = t.id; go('review'); const tl = document.querySelector('.tline'); return tl && /12:30/.test(tl.textContent); }));

  ok('geen JS-errors totaal', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== ChangeMaker-feedback (A+B+C): ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
