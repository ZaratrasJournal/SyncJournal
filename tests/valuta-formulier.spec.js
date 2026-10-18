// The trade form works in dollars, like the journal stores them; in euro view it says so (Denny 18-10-2026).
// A trader typed P&L 32.25 under "P&L (€)" and saw € 28,25 in the table: the form labelled dollars as euros.
// Now the form says $, shows "≈ € … in je weergave" with the day's rate, and the table converts the size too.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
  const b = await chromium.launch(); const p = await b.newPage(); p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  await p.evaluate(() => {
    try { hideWelcome() } catch (e) {}
    FX.latest = 0.9; FX.latestDate = '2026-10-17'; FX.rates['2026-07-06'] = 0.876; FX.ts = Date.now(); fxSave();
    // the trader's trade: entry 60.231, size $491, 4 TPs of 25%, all hit
    T = [{ id: 1, date: '2026-07-06', time: '06:00', exchange: 'blofin', pair: 'BTC/USDC', dir: 'long', status: 'closed', kind: 'live', entry: 60231, exit: 0, stop: 59002, size: '491', pnl: 32.25, fees: 0, r: 3.22,
      tps: [[62096, 25], [63867, 25], [64233, 25], [66561, 25]].map(([price, pct]) => ({ price, pct, hit: true })), tags: [], layers: [] }];
    persist(); clearGFilter();
  });
  const formulier = () => p.evaluate(() => {
    openForm(1);
    const lbl = re => ([...document.querySelectorAll('.field label')].find(l => re.test(l.textContent)) || {}).textContent || '';
    const txt = id => (document.getElementById(id) || {}).textContent || '';
    return { pnl: lbl(/^P&L/), fees: lbl(/^Fees/), size: lbl(/^Size/), szKnop: (document.querySelector('#szseg button') || {}).textContent,
      tp: [...document.querySelectorAll('#tpbuilder .tppnl')].map(e => e.textContent).join(' '), fxPnl: txt('fxPnl'), fxSize: txt('fxSize'), calc: txt('calcPrev') };
  });

  console.log('─── Weergave in euro ───');
  await p.evaluate(() => { STATE.currency = 'EUR'; persistState(); });
  let f = await formulier();
  ok('labels zeggen $: P&L ($), Fees ($), Size (in $ …)', /\(\$\)/.test(f.pnl) && /\(\$\)/.test(f.fees) && /in \$ of/.test(f.size) && f.szKnop === '$', JSON.stringify([f.pnl, f.fees, f.size, f.szKnop]));
  ok('TP-bedragen in dollars (+$ 3,80 …)', /\+\$ 3,80/.test(f.tp) && !/€/.test(f.tp), f.tp);
  ok('onder de P&L: ≈ +€ 28,25 in je weergave, met de koers van die dag', /≈ \+€ 28,25/.test(f.fxPnl) && /0,876/.test(f.fxPnl), f.fxPnl);
  ok('onder de size: ≈ € 430', /≈ € 430/.test(f.fxSize), f.fxSize);
  ok('rekenregel onder het formulier toont dollars', /\$ 32,2/.test(f.calc) && !/€/.test(f.calc), f.calc);
  const live = await p.evaluate(() => { const el = document.getElementById('f_pnl'); el.value = '100'; el.dispatchEvent(new Event('input')); return document.getElementById('fxPnl').textContent; });
  ok('de euro-regel rekent mee als je de P&L wijzigt', /≈ \+€ 87,60/.test(live), live);
  await p.evaluate(() => closeForm());
  const tabel = await p.evaluate(() => { go('trades'); const cel = document.querySelector('tbody td[data-l="Size"]'); return { tekst: cel && cel.textContent.trim(), titel: cel && (cel.querySelector('[title]') || cel).getAttribute('title') }; });
  ok('tabel rekent de size om: € 430, met $ 491 bij de muis', /€ 430/.test(tabel.tekst) && /\$ 491/.test(tabel.titel || ''), JSON.stringify(tabel));

  const upl = await p.evaluate(() => fxView([{ date: '2026-07-06', pnl: 0, unrealizedPnl: 100 }])[0].unrealizedPnl);
  ok('lopende P&L (unrealizedPnl) wordt in euroweergave omgerekend (100 → 87,6)', Math.abs(upl - 87.6) < 1e-9, String(upl));

  console.log('─── Weergave in dollars: niets anders ───');
  await p.evaluate(() => { STATE.currency = 'USD'; persistState(); });
  f = await formulier();
  ok('labels $, geen euro-regels', /\(\$\)/.test(f.pnl) && f.fxPnl === '' && f.fxSize === '', JSON.stringify([f.pnl, f.fxPnl, f.fxSize]));
  await p.evaluate(() => closeForm());
  const tabelUsd = await p.evaluate(() => { go('trades'); const cel = document.querySelector('tbody td[data-l="Size"]'); return cel && cel.textContent.trim(); });
  ok('tabel: size $ 491', /\$ 491/.test(tabelUsd || ''), tabelUsd);

  console.log('─── Standaardvaluta: alleen nieuwe journals op $ (review v1.11) ───');
  // a member whose state was never saved with a currency had euros by default; the update must not switch them
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('sj_state', JSON.stringify({ theme: 'dark' })); localStorage.setItem('sj_tagConfig', '{}'); });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(400);
  ok('bestaand lid zonder opgeslagen valuta blijft op €', await p.evaluate(() => STATE.currency === 'EUR'));
  await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(400);
  ok('nieuwe journal begint op $, en blijft dat na herladen', await p.evaluate(() => STATE.currency === 'USD'));
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(400);
  ok('… ook bij de tweede start', await p.evaluate(() => STATE.currency === 'USD'));

  ok('opgeslagen P&L blijft in dollars (32,25 of 100 na wijzigen niet opgeslagen)', await p.evaluate(() => T[0].pnl === 32.25));
  ok('geen JS-fouten', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log(`\n=== Valuta in het formulier: ${pass}/${pass + fail} ===`); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  ✗ crash: ' + String(e).split('\n')[0]); process.exit(1); });
