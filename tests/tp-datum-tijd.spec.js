// Denny 26-09-2026: bij het handmatig invullen van TP's moet je per TP een datum én tijd kunnen
// zetten (niet pas na "hit", en niet alleen een tijd t.o.v. de open-dag), en die momenten
// moeten doorwerken: sluitmoment, duur, tijdlijn, stappentabel en de analytics.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const APP = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');

(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext(); const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
  p.on('dialog', d => d.accept());
  await p.route('**/*', r => /^https?:/.test(r.request().url()) ? r.abort() : r.continue());
  await p.addInitScript(() => localStorage.setItem('sj_welcomed', 'true'));
  await p.goto(APP, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1300);

  const g = id => p.evaluate(id => { const el = document.getElementById(id); return el ? el.value : null; }, id);
  const set = (id, v) => p.evaluate(([id, v]) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change')); }, [id, v]);
  await p.evaluate(() => { T = []; TRASH = []; persist(); CONNS = {}; persistConns(); MANUAL = [{ id: 'm1', name: 'Eigen boek', transactions: [] }]; persistManual(); STATE.page = 'trades'; render(); });

  console.log('─── 1. datum + tijd staan bij elke TP klaar, ook vóór de hit ───');
  {
    await p.evaluate(() => { openForm(null); addTP(); addTP(); renderTPs(); });
    const n = await p.evaluate(() => ({ date: document.querySelectorAll('#tpbuilder .tpdate').length, time: document.querySelectorAll('#tpbuilder .tptime').length, hits: formTPs.filter(x => x.hit).length }));
    ok('twee open TP\'s → twee datumvelden en twee tijdvelden', n.date === 2 && n.time === 2 && n.hits === 0, JSON.stringify(n));
  }

  console.log('─── 2. een tijd invullen zet de TP op gehaald en rekent door ───');
  {
    await set('f_pair', 'ETH/USDC'); await set('f_date', '2026-09-15'); await set('f_time', '09:30'); await set('f_entry', '2400'); await set('f_stop', '2380'); await set('f_size', '1000'); await set('f_status', 'open');
    await p.evaluate(() => { formTPs[0].price = '2420'; formTPs[1].price = '2450'; renderTPs(); calcTrade(true); });
    await p.evaluate(() => { const el = document.querySelectorAll('#tpbuilder .tptime')[0]; el.value = '10:15'; el.dispatchEvent(new Event('input')); });
    const s2 = await p.evaluate(() => ({ hit: formTPs[0].hit, status: document.getElementById('f_status').value, focus: document.activeElement && document.activeElement.classList.contains('tptime'), pnl: document.getElementById('f_pnl').value }));
    ok('TP1 krijgt een tijd → hit, status partial, cursor blijft in het tijdveld', s2.hit === true && s2.status === 'partial' && s2.focus, JSON.stringify(s2));
    ok('P&L van het gehaalde deel is uitgerekend', Math.abs(+s2.pnl - 4.17) < 0.01, JSON.stringify(s2.pnl));
    await p.evaluate(() => { formDirty = false; closeForm(); });
  }

  console.log('─── 3. swing over meerdere dagen: eigen datum per TP → sluitmoment en duur ───');
  {
    await p.evaluate(() => { openForm(null); });
    await set('f_pair', 'BTC/USDC'); await set('f_date', '2026-09-10'); await set('f_time', '09:00'); await set('f_entry', '60000'); await set('f_stop', '59000'); await set('f_size', '6000');
    await p.evaluate(() => { addTP(); addTP(); formTPs[0].price = '61000'; formTPs[0].pct = 50; formTPs[1].price = '62000'; formTPs[1].pct = 50; renderTPs();
      formTPs[0].tsDate = '2026-09-10'; formTPs[0].tsTime = '15:00'; tpTijdIngevuld(0);
      formTPs[1].tsDate = '2026-09-12'; formTPs[1].tsTime = '08:00'; tpTijdIngevuld(1); });
    const s3 = { status: await g('f_status'), cd: await g('f_closeDate'), ct: await g('f_closeTime'), dur: await g('f_durationMin'), exit: await g('f_exit') };
    ok('beide TP\'s gehaald → gesloten, sluitmoment = laatste TP op zijn eigen dag (12-09 08:00)', s3.status === 'closed' && s3.cd === '2026-09-12' && s3.ct === '08:00', JSON.stringify(s3));
    ok('duur = 1 dag 23 uur (2820 min), exit = gewogen 61500', s3.dur === '2820' && s3.exit === '61500', JSON.stringify(s3));
    await p.evaluate(() => submitForm(null));
    const t = await p.evaluate(() => { const t = T.find(x => x.pair === 'BTC/USDC'); return { ts0: t.tps[0].ts, ts1: t.tps[1].ts, close: +t.closeTime, open: +t.openTime, dur: t.durationMin, tl: tradeTimeline(t).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ') }; });
    ok('opgeslagen: TP1 = 10-09 15:00, TP2 = 12-09 08:00', t.ts0 === +new Date('2026-09-10T15:00') && t.ts1 === +new Date('2026-09-12T08:00'), JSON.stringify(t));
    ok('closeTime = TP2-moment, durationMin 2820', t.close === t.ts1 && t.dur === 2820, JSON.stringify(t));
    ok('tijdlijn toont bij TP2 de datum (andere dag dan de open)', /TP1 15:00/.test(t.tl) && /TP2 12-09-2026 08:00|TP2 12-09 08:00/.test(t.tl), t.tl);
  }

  console.log('─── 4. heropenen toont datum én tijd terug; tijd wissen haalt het moment weg ───');
  {
    const r = await p.evaluate(() => { const t = T.find(x => x.pair === 'BTC/USDC'); openForm(t.id); return { d0: formTPs[0].tsDate, t0: formTPs[0].tsTime, d1: formTPs[1].tsDate, t1: formTPs[1].tsTime, dom: [...document.querySelectorAll('#tpbuilder .tpdate')].map(e => e.value) }; });
    ok('formulier: TP1 10-09 15:00, TP2 12-09 08:00, datumvelden gevuld', r.d0 === '2026-09-10' && r.t0 === '15:00' && r.d1 === '2026-09-12' && r.t1 === '08:00' && r.dom.join() === '2026-09-10,2026-09-12', JSON.stringify(r));
    await p.evaluate(() => { formTPs[1].tsTime = ''; calcTrade(true); submitForm(T.find(x => x.pair === 'BTC/USDC').id); });
    const t2 = await p.evaluate(() => { const t = T.find(x => x.pair === 'BTC/USDC'); return { ts1: t.tps[1].ts, hit1: t.tps[1].hit }; });
    ok('tijd leeg → ts 0 (hit blijft staan)', t2.ts1 === 0 && t2.hit1 === true, JSON.stringify(t2));
    // en weer terugzetten, zodat de analytics hieronder een trade met twee TP-momenten heeft
    await p.evaluate(() => { const id = T.find(x => x.pair === 'BTC/USDC').id; openForm(id); formTPs[1].tsDate = '2026-09-12'; formTPs[1].tsTime = '08:00'; calcTrade(true); submitForm(id); });
    ok('tijd opnieuw ingevuld → moment terug', await p.evaluate(() => T.find(x => x.pair === 'BTC/USDC').tps[1].ts === +new Date('2026-09-12T08:00')));
  }

  console.log('─── 5. bestaand gedrag: alleen een tijd, vóór de open-tijd = volgende dag ───');
  {
    await p.evaluate(() => { openForm(null); });
    await set('f_pair', 'SOL/USDC'); await set('f_date', '2026-09-15'); await set('f_time', '23:30'); await set('f_entry', '100'); await set('f_size', '100');
    await p.evaluate(() => { addTP(); formTPs[0].price = '101'; renderTPs(); formTPs[0].tsTime = '00:45'; tpTijdIngevuld(0); });
    ok('TP om 00:45 na een instap om 23:30 → sluitdatum 16-09', await g('f_closeDate') === '2026-09-16' && await g('f_closeTime') === '00:45' && await g('f_status') === 'closed', JSON.stringify({ d: await g('f_closeDate'), t: await g('f_closeTime') }));
    await p.evaluate(() => submitForm(null));
  }

  console.log('─── 6. analytics: tijd tot je TP\'s ───');
  {
    const a = await p.evaluate(() => { STATE.page = 'analytics'; render(); const txt = document.body.innerText.replace(/\s+/g, ' '); return { tp1: /Tot 1e TP/.test(txt), tpN: /Tot laatste TP/.test(txt), sub: /tot je TP/.test(txt) }; });
    ok('"Gem. tijd in trade" toont Tot 1e TP en Tot laatste TP', a.tp1 && a.tpN && a.sub, JSON.stringify(a));
  }

  ok('geen JS-errors', errs.length === 0, errs.join(' | '));
  console.log(`\n=== TP datum+tijd: ${pass}/${pass + fail} ===`);
  await b.close(); process.exit(fail ? 1 : 0);
})();
