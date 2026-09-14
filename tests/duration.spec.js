// Borgt Open/Close/Duur (member-suggestie): afleiding uit openTime/closeTime met
// durationMin-fallback en live-teller, canonieke open-datum (sjFromTj + migratie v2),
// tabel-kolommen (status versmolten in Close), formulier met sluit-datum/tijd + autofill,
// review-tijdlijn met TP-tijden, en het analytics-paneel "Duur → resultaat".
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
  await p.evaluate(() => { try { hideWelcome() } catch (e) {} T = []; TRASH = []; persist(); clearGFilter(); setFilter('kind', 'alle'); });
  ok('boot zonder JS-errors', errs.length === 0, errs.slice(0, 2).join(' | '));

  console.log('─── Helpers ───');
  ok('duur uit timestamps (90m)', await p.evaluate(() => tradeDurationMin({ openTime: '1000000000000', closeTime: String(1000000000000 + 90 * 60000), status: 'closed' }) === 90));
  ok('open trade → live-teller', await p.evaluate(() => { const m = tradeDurationMin({ openTime: String(Date.now() - 30 * 60000), closeTime: '', status: 'open' }); return m >= 29 && m <= 31; }));
  ok('fallback op durationMin, anders null', await p.evaluate(() => tradeDurationMin({ status: 'closed', durationMin: 25 }) === 25 && tradeDurationMin({ status: 'closed' }) === null));
  ok('fmtDurMin: 45m / 1u 30m / 2d 2u', await p.evaluate(() => fmtDurMin(45) === '45m' && fmtDurMin(90) === '1u 30m' && fmtDurMin(3000) === '2d 2u'));

  console.log('─── Canonieke open-datum ───');
  const canon = await p.evaluate(() => {
    const o = +new Date('2026-09-10T08:14:00'), c = +new Date('2026-09-11T02:12:00');
    const t = sjFromTj({ id: 'hl_x1', source: 'hyperliquid', status: 'closed', pair: 'BTC/USDC', direction: 'long', entry: '77695', exit: '78200', positionSize: '89', positionSizeAsset: '0.00115', pnl: '0.58', fees: '0.04', date: ts2date(c), time: ts2time(c), openTime: String(o), closeTime: String(c), tpLevels: [], setupTags: [], leverage: '10' });
    return { date: t.date, time: t.time, session: t.session };
  });
  ok('sjFromTj: datum/tijd/sessie van het OPEN-moment', canon.date === '2026-09-10' && canon.time === '08:14' && canon.session === 'London', JSON.stringify(canon));
  ok('migratie v2 corrigeert bestaande trades', await p.evaluate(() => { const o = +new Date('2026-09-01T09:30:00'); const t = { id: 1, date: '2026-09-02', time: '23:00', session: 'US PM', status: 'closed', openTime: String(o) }; T = [t]; MIGRATIONS.find(m => m.v === 2).up(); return t.date === '2026-09-01' && t.time === '09:30' && t.session === 'London'; }));

  console.log('─── Tabel: Open / Close / Duur ───');
  await p.evaluate(() => {
    const o1 = +new Date('2026-09-12T10:00:00'), c1 = +new Date('2026-09-12T14:26:00');
    T = [
      { id: 1, date: '2026-09-12', time: '10:00', pair: 'BTC/USDT', dir: 'long', setup: 'Reclaim', session: 'London', status: 'closed', kind: 'live', exchange: '', entry: 100, exit: 110, stop: 95, size: '1000', pnl: 100, r: 2, openTime: String(o1), closeTime: String(c1), tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] },
      { id: 2, date: '2026-09-13', time: '09:00', pair: 'SOL/USDT', dir: 'long', setup: '', session: 'London', status: 'open', kind: 'live', exchange: '', entry: 200, exit: 0, stop: 0, size: '500', pnl: 0, r: 0, openTime: String(Date.now() - 2 * 3600e3), closeTime: '', unrealizedPnl: 3.2, tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] },
      { id: 3, date: '2026-09-11', time: '11:00', pair: 'ETH/USDT', dir: 'short', setup: '', session: 'London', status: 'closed', kind: 'live', exchange: '', entry: 2500, exit: 2400, stop: 0, size: '800', pnl: 32, r: 1, durationMin: 15, tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] },
    ]; persist(); go('trades');
  });
  await p.waitForTimeout(400);
  ok('kolomkoppen Open + Close + Duur, geen Status-kolom', await p.evaluate(() => { const hs = [...document.querySelectorAll('thead th')].map(x => x.textContent.trim()); return hs.some(x => /^Open/.test(x)) && hs.some(x => /^Close/.test(x)) && hs.some(x => /^Duur/.test(x)) && !hs.some(x => /^Status/.test(x)); }));
  ok('gesloten rij: sluit-tijd + duur 4u 26m', await p.evaluate(() => { const r = [...document.querySelectorAll('tbody tr')].find(x => /BTC\/USDT/.test(x.textContent)); return r && /14:26/.test(r.textContent) && /4u 26m/.test(r.textContent); }));
  ok('open rij: OPEN-badge in Close-cel + live ~duur', await p.evaluate(() => { const r = [...document.querySelectorAll('tbody tr')].find(x => /SOL\/USDT/.test(x.textContent)); return r && /Open/i.test(r.querySelector('td[data-l="Close"]').textContent) && /~2u/.test(r.querySelector('td[data-l="Duur"]').textContent); }));
  ok('fallback-rij: duur uit durationMin (15m), close —', await p.evaluate(() => { const r = [...document.querySelectorAll('tbody tr')].find(x => /ETH\/USDT/.test(x.textContent)); return r && /15m/.test(r.querySelector('td[data-l="Duur"]').textContent) && /—/.test(r.querySelector('td[data-l="Close"]').textContent); }));
  ok('sorteren op duur werkt', await p.evaluate(() => { sortBy('dur'); const first = document.querySelector('tbody tr td[data-l="Duur"]'); const t1 = first.textContent; sortBy('dur'); const t2 = document.querySelector('tbody tr td[data-l="Duur"]').textContent; return t1 !== t2; }));

  console.log('─── Formulier: sluit-datum/tijd + autofill ───');
  await p.evaluate(() => openForm(null)); await p.waitForTimeout(250);
  ok('sluit-datum + sluit-tijd velden aanwezig', await p.evaluate(() => !!document.getElementById('f_closeDate') && !!document.getElementById('f_closeTime')));
  const auto = await p.evaluate(() => {
    document.getElementById('f_date').value = '2026-09-12'; document.getElementById('f_time').value = '10:00';
    document.getElementById('f_closeDate').value = '2026-09-12'; document.getElementById('f_closeTime').value = '13:45';
    calcTrade(true); return document.getElementById('f_durationMin').value;
  });
  ok('duur automatisch berekend (225m)', auto === '225', auto);
  await p.evaluate(() => { document.getElementById('f_pair').value = 'DOGE/USDT'; document.getElementById('f_entry').value = '0.1'; document.getElementById('f_exit').value = '0.11'; document.getElementById('f_size').value = '100'; calcTrade(true); submitForm(null); });
  await p.waitForTimeout(300);
  const saved = await p.evaluate(() => { const t = T.find(x => x.pair === 'DOGE/USDT'); return { o: +t.openTime, c: +t.closeTime, d: t.durationMin }; });
  ok('opgeslagen: openTime + closeTime + duur', saved.o > 0 && saved.c > saved.o && saved.d === 225, JSON.stringify(saved));
  await p.evaluate(() => { const t = T.find(x => x.pair === 'DOGE/USDT'); openForm(t.id); }); await p.waitForTimeout(250);
  ok('bewerken: sluit-velden vooringevuld', await p.evaluate(() => document.getElementById('f_closeDate').value === '2026-09-12' && document.getElementById('f_closeTime').value === '13:45'));
  await p.evaluate(() => closeForm());

  console.log('─── Review-tijdlijn ───');
  await p.evaluate(() => {
    const t = T.find(x => x.id === 1);
    t.tps = [{ price: 105, pct: 50, r: '', hit: true, ts: +new Date('2026-09-12T12:10:00') }];
    t.reviewed = false; persist(); STATE.revSel = 1; go('review');
  });
  await p.waitForTimeout(400);
  ok('tijdlijn toont Open → TP1 (met tijd) → Close → duur', await p.evaluate(() => { const tl = document.querySelector('.tline'); return tl && /Open/.test(tl.textContent) && /TP1/.test(tl.textContent) && /12:10/.test(tl.textContent) && /Close/.test(tl.textContent) && /4u 26m/.test(tl.textContent); }));

  console.log('─── Analytics: Duur → resultaat ───');
  await p.evaluate(() => go('analytics')); await p.waitForTimeout(600);
  ok('paneel met duur-buckets aanwezig', await p.evaluate(() => { const h = [...document.querySelectorAll('#main .panel h3')].find(x => /Duur → resultaat/.test(x.textContent)); if (!h) return false; const body = h.closest('.panel').textContent; return /1–4u/.test(body) || /15m–1u/.test(body) || /<15m/.test(body); }));

  console.log('─── Partial: TP-tijdstip bewaard ───');
  const pts = await p.evaluate(() => {
    const mk = (id, st) => ({ id, srcId: 'blofin_9_' + id, date: '2026-09-01', time: '10:00', pair: 'LINK/USDT', dir: 'long', setup: '', session: 'London', status: st, kind: 'live', exchange: 'blofin', entry: 20, exit: st === 'closed' ? 22 : 0, stop: 0, size: '400', qtyAsset: st === 'closed' ? 5 : 20, _rawCloseSize: st === 'closed' ? '5' : undefined, positionId: 'pid-9', closeTime: st === 'closed' ? String(+new Date('2026-09-01T15:30:00')) : '', pnl: st === 'closed' ? 10 : 0, fees: 0, r: 0, tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] });
    T.push(mk(9501, 'open'), mk(9502, 'closed')); persist(); runPartialDetect('blofin');
    const t = T.find(x => x.id === 9501); return { status: t.status, ts: (t.tps.find(x => x.hit) || {}).ts };
  });
  ok('TP-hit draagt het sluit-tijdstip van de sibling', pts.status === 'partial' && pts.ts === +new Date('2026-09-01T15:30:00'), JSON.stringify(pts));

  ok('geen JS-errors totaal', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== Open/Close/Duur: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
