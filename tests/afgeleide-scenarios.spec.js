// Uitgebreide scenario's rond de afgeleide stappen (Denny 23-09-2026). Niet de losse
// rekenregels — die staan in afgeleide-stappen.spec.js — maar de weg die een trader
// aflegt: invoeren, bijstellen, in euro's kijken, back-uppen, filteren, en of de rest
// van de app er niets van merkt.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const bij = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 0.01 : tol);
const APP = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');

(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext(); const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
  p.on('dialog', d => d.accept());
  await p.route('**/*', r => /^https?:/.test(r.request().url()) ? r.abort() : r.continue());
  await p.addInitScript(() => localStorage.setItem('sj_welcomed', 'true'));
  await p.goto(APP, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1300);

  console.log('─── Scenario 1: een trade invoeren zoals een trader dat doet ───');
  {
    const r = await p.evaluate(async () => {
      T = []; TRASH = []; persist(); STATE.page = 'trades'; render();
      openForm(null);                                   // + Nieuwe trade
      const zet = (k, v) => { const el = document.getElementById('f_' + k); el.value = v; el.dispatchEvent(new Event('input')); };
      zet('pair', 'BTC/USDC'); zet('date', '2026-09-20'); zet('time', '08:00');
      zet('entry', '80000'); zet('exit', '82000'); zet('stop', '79000'); zet('size', '8000');
      zet('closeDate', '2026-09-20'); zet('closeTime', '14:00'); zet('fees', '4');
      // twee TP's, de eerste geraakt
      addTP(); addTP();
      formTPs[0] = { price: '81000', pct: 60, r: '', hit: true, tsTime: '10:30' };
      formTPs[1] = { price: '83000', pct: 40, r: '', hit: false };
      renderTPs(); calcTrade(true);
      submitForm(null);
      const t = T[0];
      openForm(t.id);
      const el = document.querySelector('.exwrap');
      const uit = { n: T.length, pnl: +t.pnl, tabel: !!(el && el.querySelector('table')),
        rijen: el ? [...el.querySelectorAll('tbody tr:not(.exday):not(.exnew)')].map(tr => tr.innerText.replace(/\s+/g, ' ').trim()) : [],
        afgeleid: !!el && /afgeleid/.test(el.innerText) };
      closeForm(); return uit;
    });
    ok('de trade is aangemaakt met een berekende P&L', r.n === 1 && bij(r.pnl, 196, 1), JSON.stringify(r.pnl));
    ok('en het formulier toont meteen drie stappen', r.tabel && r.rijen.length === 3, JSON.stringify(r.rijen.length));
    ok('instap 08:00 op 80.000, TP1 om 10:30 op 81.000, rest 14:00 op 82.000',
      /08:00/.test(r.rijen[0]) && /80\.000/.test(r.rijen[0]) && /10:30/.test(r.rijen[1]) && /81\.000/.test(r.rijen[1]) && /14:00/.test(r.rijen[2]) && /82\.000/.test(r.rijen[2]),
      JSON.stringify(r.rijen));
    ok('met de markering dat het afgeleid is', r.afgeleid);
  }

  console.log('─── Scenario 2: de trade bijstellen ───');
  {
    const r = await p.evaluate(() => {
      const id = T[0].id; const lees = () => { openForm(id); const el = document.querySelector('.exwrap');
        const n = el && el.querySelector('table') ? el.querySelectorAll('tbody tr:not(.exday):not(.exnew)').length : 0; closeForm(); return n; };
      const start = lees();
      T[0].tps[1].hit = true; persist(); const naTweede = lees();          // samen 100%: geen restje meer
      T[0].tps = T[0].tps.map(x => ({ ...x, hit: false })); persist(); const naUit = lees();   // alles uitgevinkt
      T[0].tps = [{ price: 81000, pct: 60, r: '', hit: true, ts: 0 }]; persist(); const terug = lees();
      return { start, naTweede, naUit, terug };
    });
    ok('TP2 ook aanvinken: nog steeds drie stappen, want samen dekken ze 100%',
      r.naTweede === 3, JSON.stringify(r.naTweede));
    ok('alles uitvinken laat de tabel verdwijnen', r.naUit === 0, JSON.stringify(r.naUit));
    ok('en één TP terugzetten brengt hem weer terug', r.terug === 3, JSON.stringify(r.terug));
  }

  console.log('─── Scenario 3: in euro’s kijken ───');
  {
    const r = await p.evaluate(() => {
      T = [{ id: 1, exchange: 'manual', srcId: '', pair: 'BTC/USDC', dir: 'long', status: 'closed', kind: 'live',
        date: '2026-09-20', time: '08:00', openTime: String(+new Date('2026-09-20T08:00')), closeTime: String(+new Date('2026-09-20T14:00')),
        entry: 80000, exit: 82000, stop: 79000, pnl: 136, r: 1.4, size: '8000', qtyAsset: 0.1, fees: 4,   // 140 bruto − 4 fees
        tps: [{ price: 81000, pct: 60, r: '', hit: true, ts: 0 }, { price: 83000, pct: 40, r: '', hit: false, ts: 0 }],
        tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] }];
      persist();
      const meet = () => { const t = fxView(applyFilter(T))[0]; const st = stappenVan(t);
        return { valuta: CURSYM(), pnl: +t.pnl.toFixed(2), stapSom: +st.filter(s => s.pnl != null).reduce((a, s) => a + s.pnl, 0).toFixed(2),
          fees: +st.reduce((a, s) => a + s.fee, 0).toFixed(2), prijzen: st.map(s => s.price) }; };
      const dollars = meet();
      FX.rates['2026-09-20'] = 0.9; FX.latest = 0.9; FX.latestDate = '2026-09-20'; FX.ts = Date.now();
      STATE.currency = 'EUR'; render();
      const euros = meet();
      STATE.currency = 'USD'; render();
      return { dollars, euros };
    });
    ok('in dollars: 60% op 81.000 en 40% op 82.000 is 140 bruto, met 4 fees',
      bij(r.dollars.stapSom, 140) && bij(r.dollars.fees, 4) && bij(r.dollars.pnl, 136), JSON.stringify(r.dollars));
    ok('in euro’s staan de prijzen ongewijzigd — een BTC-koers is een BTC-koers',
      JSON.stringify(r.euros.prijzen) === JSON.stringify(r.dollars.prijzen), JSON.stringify(r.euros.prijzen));
    ok('maar de bedragen per stap gaan wél mee: 140 → 126', bij(r.euros.stapSom, 126), JSON.stringify(r.euros.stapSom));
    ok('en de fees ook: 4 → 3,60', bij(r.euros.fees, 3.6), JSON.stringify(r.euros.fees));
    ok('zodat de stappen blijven aansluiten op het totaal erboven',
      bij(r.euros.stapSom - r.euros.fees, r.euros.pnl, 0.02), JSON.stringify({ stappen: r.euros.stapSom - r.euros.fees, totaal: r.euros.pnl }));
  }

  console.log('─── Scenario 4: de rest van de app merkt er niets van ───');
  {
    const r = await p.evaluate(async () => {
      const voorSom = T.reduce((s, t) => s + (+t.pnl || 0), 0);
      const opgeslagen = JSON.parse(JSON.stringify(T[0]));
      const backup = snapshotPayload();
      const inBackup = JSON.stringify(backup.trades[0]);
      const paginas = {};
      for (const pg of Object.keys(PAGES)) { try { go(pg); paginas[pg] = true; } catch (e) { paginas[pg] = e.message; } }
      go('trades');
      return { voorSom, heeftFills: 'fills' in opgeslagen, fillsLeeg: !(opgeslagen.fills || []).length,
        backupSchoon: !/synthetic/.test(inBackup), backupBytes: inBackup.length,
        naSom: T.reduce((s, t) => s + (+t.pnl || 0), 0), paginas: Object.values(paginas).every(x => x === true),
        agNet: +aggOf(CLOSED).net.toFixed(2) };
    });
    ok('de afgeleide stappen worden niet opgeslagen op de trade', r.fillsLeeg, JSON.stringify({ heeft: r.heeftFills, leeg: r.fillsLeeg }));
    ok('en staan dus ook niet in je back-up', r.backupSchoon, JSON.stringify(r.backupBytes));
    ok('de totalen veranderen er niet door', bij(r.voorSom, r.naSom) && bij(r.agNet, r.naSom), JSON.stringify(r));
    ok('elke pagina tekent gewoon', r.paginas);
  }

  console.log('─── Scenario 5: verschillende soorten trades ───');
  {
    const r = await p.evaluate(() => {
      const mk = (o) => ({ id: 1, exchange: 'manual', srcId: '', pair: 'X/Y', dir: 'long', status: 'closed', kind: 'live',
        date: '2026-09-20', time: '08:00', openTime: String(+new Date('2026-09-20T08:00')), closeTime: String(+new Date('2026-09-20T14:00')),
        entry: 100, exit: 110, stop: 95, pnl: 10, r: 2, size: '1000', qtyAsset: 10, fees: 1,
        tps: [{ price: 105, pct: 50, r: '', hit: true, ts: 0 }, { price: 115, pct: 50, r: '', hit: false, ts: 0 }],
        tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [], ...o });
      const kinds = (t) => { T = [t]; return stappenVan(t).map(s => s.kind).join(); };
      const uit = {};
      uit.long = kinds(mk({}));
      uit.short = kinds(mk({ dir: 'short', entry: 110, exit: 100, stop: 115, tps: [{ price: 105, pct: 50, r: '', hit: true, ts: 0 }, { price: 95, pct: 50, r: '', hit: false, ts: 0 }] }));
      uit.verlies = kinds(mk({ exit: 92, pnl: -9, tps: [{ price: 105, pct: 50, r: '', hit: true, ts: 0 }, { price: 115, pct: 50, r: '', hit: false, ts: 0 }] }));
      uit.satoshi = kinds(mk({ entry: 0.00001234, exit: 0.00001300, qtyAsset: 1000000, tps: [{ price: 0.00001280, pct: 50, r: '', hit: true, ts: 0 }, { price: 0.000014, pct: 50, r: '', hit: false, ts: 0 }] }));
      uit.vijfTps = kinds(mk({ tps: [20, 20, 20, 20, 20].map((pct, i) => ({ price: 101 + i, pct, r: '', hit: i < 4, ts: 0 })) }));
      uit.alles100 = kinds(mk({ tps: [{ price: 105, pct: 40, r: '', hit: true, ts: 0 }, { price: 108, pct: 60, r: '', hit: true, ts: 0 }] }));
      uit.backtest = kinds(mk({ kind: 'backtest' }));
      uit.csv = kinds(mk({ exchange: 'blofin', srcId: 'blofin_csv_x1' }));
      uit.gesynct = kinds(mk({ exchange: 'blofin', srcId: 'blofin_800_1770' }));
      const t = mk({ tps: [20, 20, 20, 20, 20].map((pct, i) => ({ price: 101 + i, pct, r: '', hit: i < 4, ts: 0 })) });
      T = [t]; const vijf = stappenVan(t);
      uit.vijfTijden = vijf.map(s => s.ts).every((x, i, a) => i === 0 || x > a[i - 1]);
      uit.vijfEind = vijf[vijf.length - 1].posAfter;
      return uit;
    });
    ok('long en short krijgen allebei hun tabel', r.long === 'open,close,close' && r.short === 'open,close,close', JSON.stringify({ l: r.long, s: r.short }));
    ok('een verliestrade met een geraakte TP ook', r.verlies === 'open,close,close', r.verlies);
    ok('en een trade in satoshi-prijzen', r.satoshi === 'open,close,close', r.satoshi);
    ok('vijf niveaus waarvan vier geraakt: zes stappen, netjes op volgorde in de tijd',
      r.vijfTps === 'open,close,close,close,close,close' && r.vijfTijden === true && r.vijfEind === 0, JSON.stringify({ k: r.vijfTps, t: r.vijfTijden, e: r.vijfEind }));
    ok('twee TP’s die samen 100% zijn: geen restje op de exit', r.alles100 === 'open,close,close', r.alles100);
    ok('backtest- en CSV-trades krijgen hem ook', r.backtest === 'open,close,close' && r.csv === 'open,close,close', JSON.stringify({ b: r.backtest, c: r.csv }));
    ok('een gesyncte trade niet', r.gesynct === '', JSON.stringify(r.gesynct));
  }

  console.log('─── Scenario 6: cijfers die niet op elkaar aansluiten ───');
  {
    const r = await p.evaluate(() => {
      // de trader typte een P&L die niet volgt uit zijn eigen prijzen
      const t = { id: 1, exchange: 'manual', srcId: '', pair: 'X/Y', dir: 'long', status: 'closed', kind: 'live',
        date: '2026-09-20', time: '08:00', openTime: String(+new Date('2026-09-20T08:00')), closeTime: String(+new Date('2026-09-20T14:00')),
        entry: 100, exit: 110, stop: 95, pnl: 42, r: 2, size: '1000', qtyAsset: 10, fees: 1,
        tps: [{ price: 105, pct: 50, r: '', hit: true, ts: 0 }, { price: 115, pct: 50, r: '', hit: false, ts: 0 }],
        tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] };
      T = [t]; openForm(1);
      const el = document.querySelector('.exwrap');
      const tekst = el ? el.innerText.replace(/\s+/g, ' ') : '';
      const tip = el ? (el.querySelector('tfoot [title]') || {}).title || '' : '';
      closeForm();
      return { tekst: tekst.slice(-70), tip };
    });
    ok('de totaalregel houdt jouw ingevoerde P&L aan', /42/.test(r.tekst), r.tekst);
    ok('en legt in de tooltip uit wat er uit de stappen zelf komt', /Uit de stappen berekend/.test(r.tip), JSON.stringify(r.tip).slice(0, 110));
  }

  console.log('─── Scenario 7: honderd handmatige trades ───');
  {
    const r = await p.evaluate(() => {
      const nu = Date.now();
      T = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, exchange: 'manual', srcId: '', pair: 'BTC/USDC', dir: i % 2 ? 'long' : 'short',
        status: 'closed', kind: 'live', date: new Date(nu - i * 864e5).toISOString().slice(0, 10), time: '08:00',
        openTime: String(nu - i * 864e5), closeTime: String(nu - i * 864e5 + 6 * 36e5),
        entry: 80000, exit: i % 2 ? 82000 : 78000, stop: 79000, pnl: 196, r: 1.9, size: '8000', qtyAsset: 0.1, fees: 4,
        tps: [{ price: i % 2 ? 81000 : 79000, pct: 60, r: '', hit: true, ts: 0 }, { price: i % 2 ? 83000 : 77000, pct: 40, r: '', hit: false, ts: 0 }],
        tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] }));
      persist();
      const t0 = performance.now(); STATE.page = 'trades'; render(); const tabel = performance.now() - t0;
      const t1 = performance.now(); go('review'); const review = performance.now() - t1;
      const t2 = performance.now(); go('analytics'); const analytics = performance.now() - t2;
      go('trades');
      const hint = document.body.innerText.match(/\d+ instap(pen)? · \d+ afbouwstap/);
      return { tabel: Math.round(tabel), review: Math.round(review), analytics: Math.round(analytics), som: +T.reduce((s, t) => s + t.pnl, 0).toFixed(0), hint: !!hint };
    });
    ok('honderd trades met afgeleide stappen blijven vlot renderen',
      r.tabel < 2500 && r.review < 2500 && r.analytics < 2500, JSON.stringify({ tabel: r.tabel, review: r.review, analytics: r.analytics }));
    ok('en de som klopt nog', r.som === 19600, JSON.stringify(r.som));
    ok('de tradelijst wijst naar de stappen in Review', r.hint === true);
  }

  console.log('─── Scenario 8: back-up heen en weer ───');
  {
    const backup = await p.evaluate(() => snapshotPayload());
    await ctx.close();
    const ctx2 = await b.newContext(); const p2 = await ctx2.newPage();
    p2.on('pageerror', e => errs.push('vers: ' + String(e).split('\n')[0]));
    p2.on('dialog', d => d.accept());
    await p2.route('**/*', r => /^https?:/.test(r.request().url()) ? r.abort() : r.continue());
    await p2.addInitScript(() => localStorage.setItem('sj_welcomed', 'true'));
    await p2.goto(APP, { waitUntil: 'domcontentloaded' }); await p2.waitForTimeout(1300);
    const r = await p2.evaluate(async d => {
      await applyBackup(d); await new Promise(x => setTimeout(x, 1200));
      const t = T[0]; openForm(t.id);
      const el = document.querySelector('.exwrap');
      const n = el && el.querySelector('table') ? el.querySelectorAll('tbody tr:not(.exday):not(.exnew)').length : 0;
      closeForm();
      return { n: T.length, opgeslagenFills: T.filter(x => (x.fills || []).length).length, stappen: n, som: +T.reduce((s, x) => s + (+x.pnl || 0), 0).toFixed(0) };
    }, backup);
    ok('de back-up bevat geen enkele afgeleide stap', r.opgeslagenFills === 0, JSON.stringify(r.opgeslagenFills));
    ok('maar op het verse profiel staat de tabel er gewoon weer', r.stappen === 3, JSON.stringify(r.stappen));
    ok('en de bedragen zijn ongewijzigd', r.n === 100 && r.som === 19600, JSON.stringify(r));
    await ctx2.close();
  }

  ok('geen JS-errors in de hele ronde', errs.length === 0, [...new Set(errs)].slice(0, 4).join(' | '));
  console.log(`\n=== Afgeleide stappen — scenario's: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
