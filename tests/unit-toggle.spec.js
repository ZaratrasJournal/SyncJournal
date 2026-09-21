// Borgt de €/%/R-weergaveschakelaar (Denny 2026-09-18, zoals de originele Morani-journal).
// Rekent het handgeverifieerde controlevoorbeeld uit het plan exact na: balans 1.000,
// trades +80 (2R), −30 (géén R) en +150 (2R) in de huidige maand. Kernwaarheden:
// percentages worden nooit opgeteld (maand = +25,00%, níet 24,24%), een trade zonder R
// telt nooit als 0R mee, de balans blijft altijd valuta, en alles klopt óók na filtering.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
  const b = await chromium.launch(); const p = await b.newPage(); p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.setViewportSize({ width: 1700, height: 1100 });
  // Deze spec rekent met vaste bedragen, dus geen wisselkoers erbij: zonder koers toont
  // de app bewust dollars (de eerlijke terugval). De omrekening zelf staat in valuta.spec.
  await p.route('**/*', r => /frankfurter/.test(r.request().url()) ? r.abort() : r.continue());
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(600);
  await p.evaluate(() => {
    try { hideWelcome() } catch (e) {}
    const mm = new Date().toISOString().slice(0, 7);
    const base = { time: '10:00', pair: 'BTC/USDT', dir: 'long', setup: '', session: 'London', status: 'closed', kind: 'live', exchange: 'blofin', entry: 100, exit: 110, size: '1000', tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] };
    T = [
      { ...base, id: 1, date: mm + '-01', pnl: 80, r: 2.0, stop: 95 },
      { ...base, id: 2, date: mm + '-05', pnl: -30, r: 0, stop: 0, exit: 0, tp: 0 },   // bewust géén R afleidbaar
      { ...base, id: 3, date: mm + '-10', pnl: 150, r: 2.0, stop: 95 },
      { ...base, id: 4, date: mm + '-12', pnl: 50, r: 1.0, stop: 95, exchange: 'hyperliquid' },
    ]; persist();
    EXMAP.blofin.val = 1050; persistExMeta(); // totale balans 1.050: basis oudste trade = 1.050−250=800
    clearGFilter(); viewPreset('alles'); go('dashboard');
  });
  ok('boot zonder JS-errors', errs.length === 0, errs.slice(0, 2).join(' | '));

  console.log('─── Valuta-stand (standaard) ───');
  const v0 = await p.evaluate(() => { const h = document.querySelector('#main .hero'); return { seg: !!h.querySelector('.unitseg'), on: h.querySelector('.unitseg button.on').textContent, big: h.querySelector('.big').textContent, meta: h.querySelector('.meta').textContent }; });
  ok('seg staat in de hero, valuta actief, balans en maand in valuta', v0.seg && v0.on === '$' && /1\.050/.test(v0.big) && /\+\$ 250/.test(v0.meta), JSON.stringify(v0));

  console.log('─── Valuta-pil volgt de valuta-instelling ───');
  const cur = await p.evaluate(() => {
    const lbl = () => document.querySelector('#main .hero .unitseg button').textContent;
    setCurrency('USD'); render(); const usd = lbl();
    setCurrency('EUR'); render(); const eurL = lbl();
    return { usd, eurL };
  });
  // Zonder wisselkoers blijft de app bij dollars, ook als je euro hebt gekozen: liever
  // eerlijk dan een verzonnen omrekening. Het euro-geval staat in valuta.spec.
  ok('pil volgt de valuta; zonder koers blijft dat de dollar', cur.usd === '$' && cur.eurL === '$', JSON.stringify(cur));
  ok('pillen staan bóven "Totale balans" (leesorde eenheid → label → bedrag)', await p.evaluate(() => {
    const col = document.querySelector('#main .hero > div');
    const kids = [...col.children].map(c => c.className);
    return kids[0].includes('unitseg') && kids[1].includes('eyebrow');
  }));
  ok('geselecteerde pil krijgt de accent-vulling uit onze huisstijl', await p.evaluate(() => {
    // probe met background:var(--accent) → exact vergelijken zonder hex/rgb-gegoochel
    const probe = document.createElement('div'); probe.style.background = 'var(--accent)'; document.body.appendChild(probe);
    const accent = getComputedStyle(probe).backgroundColor; probe.remove();
    const btns = [...document.querySelectorAll('#main .hero .unitseg button')];
    const on = btns.find(b => b.classList.contains('on')), off = btns.find(b => !b.classList.contains('on'));
    const bgOn = getComputedStyle(on).backgroundColor, bgOff = getComputedStyle(off).backgroundColor;
    return bgOn === accent && bgOn !== bgOff;
  }));
  ok('pil-balk blijft compact (geen volle kolombreedte)', await p.evaluate(() => {
    const seg = document.querySelector('#main .hero .unitseg'), col = document.querySelector('#main .hero > div');
    return seg.getBoundingClientRect().width < col.getBoundingClientRect().width * 0.5;
  }));

  console.log('─── %-stand: nooit percentages optellen ───');
  await p.evaluate(() => setUnit('pct')); await p.waitForTimeout(700); // Recharts mount async
  const v1 = await p.evaluate(() => { const h = document.querySelector('#main .hero'); const kpis = document.querySelector('.kpis').textContent; return { meta: h.querySelector('.meta').textContent, big: h.querySelector('.big').textContent, kpis, bar: [...document.querySelectorAll('#main .panel')].find(x => /Maand-P&L/.test(x.textContent)).textContent }; });
  // maand: netto +250 op startbasis 800 → +31,25% (som van losse %: 10−3,41+17,65+6,02 = 30,26 → bewijs)
  ok('hero-maand = +31,25% (netto ÷ startbasis, géén som van trade-%)', /\+31,25%/.test(v1.meta), v1.meta);
  ok('balans blijft valuta in %-stand', /1\.050/.test(v1.big));
  ok('KPI Netto toont +31,25%, Expectancy +7,81% (÷4 trades)', /\+31,25%/.test(v1.kpis) && /\+7,81%/.test(v1.kpis), v1.kpis.slice(0, 200));
  ok('maand-chart in % met maandstart-label', /% t\.o\.v\. maandstart/.test(v1.bar) && /31,3%|31,2%/.test(v1.bar), v1.bar.slice(0, 120));

  console.log('─── R-stand: zonder-R telt nooit als 0 ───');
  const v2 = await p.evaluate(() => { setUnit('r'); const h = document.querySelector('#main .hero'); const kpis = document.querySelector('.kpis').textContent; const rec = [...document.querySelectorAll('#main table tbody tr')].map(r => r.textContent).join('|'); return { meta: h.querySelector('.meta').textContent, kpis, rec, big: h.querySelector('.big').textContent }; });
  ok('hero-maand = +5,0R · 1 zonder R', /\+5,0R/.test(v2.meta) && /1 zonder R/.test(v2.meta), v2.meta);
  ok('KPI Netto +5,0R (met zonder-R-teller), Expectancy = gemiddelde over geldige = +1,7R', /\+5,0R/.test(v2.kpis) && /zonder R/.test(v2.kpis) && /\+1,7R/.test(v2.kpis), v2.kpis.slice(0, 220));
  ok('recente trades: −$30-trade toont — in plaats van 0R', /—/.test(v2.rec), v2.rec.slice(0, 160));
  ok('balans blijft valuta in R-stand', /1\.050/.test(v2.big));

  ok('alleen risicoloze trades in de maand → "—" mét uitleg waarom', await p.evaluate(() => {
    const hold = T.map(t => ({ ...t }));
    T.forEach(t => { t.r = 0; t.stop = 0; t.exit = 0; t.tp = 0; }); persist(); go('dashboard');
    const meta = document.querySelector('#main .hero .meta').textContent;
    T = hold; persist(); go('dashboard');
    return /—/.test(meta) && /zonder R/.test(meta);
  }));

  console.log('─── Ook na filtering kloppend ───');
  const v3 = await p.evaluate(() => { setFilter('exchange', 'blofin'); go('dashboard'); const meta = document.querySelector('#main .hero .meta').textContent; clearFilterKey('exchange'); return meta; });
  ok('filter op Blofin → maand +4,0R · 1 zonder R (HL-trade telt niet mee)', /\+4,0R/.test(v3) && /1 zonder R/.test(v3), v3);
  const v4 = await p.evaluate(() => { setUnit('pct'); setFilter('exchange', 'blofin'); go('dashboard'); const meta = document.querySelector('#main .hero .meta').textContent; clearFilterKey('exchange'); setUnit('val'); return meta; });
  ok('filter in %-stand: +25,00% (netto 200 ÷ basis 800)', /\+25,00%/.test(v4), v4);

  console.log('─── Seg-klik, persistentie en randgevallen ───');
  ok('klikken op R in de seg werkt', await p.evaluate(() => { document.querySelector('.unitseg button:nth-child(3)').click(); return STATE.unit === 'r' && document.querySelector('.unitseg button.on').textContent === 'R'; }));
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(600);
  ok('unit overleeft herladen', await p.evaluate(() => { try { hideWelcome() } catch (e) {} return STATE.unit === 'r'; }));
  ok('geen balans bekend → — in %-stand, nooit een verzonnen getal', await p.evaluate(() => { setUnit('pct'); EXMAP.blofin.val = 0; persistExMeta(); go('dashboard'); const m = document.querySelector('#main .hero .meta').textContent; EXMAP.blofin.val = 1050; persistExMeta(); setUnit('val'); return /—/.test(m); }));

  console.log('─── Alle pagina\'s in alle drie de standen (incl. analytics, met filter) ───');
  for (const u of ['val', 'pct', 'r']) {
    for (const pg of ['dashboard', 'analytics', 'trades', 'kalender', 'tendencies', 'review', 'playbook']) {
      const n = errs.length;
      await p.evaluate((x) => setUnit(x[0]), [u]);
      await p.evaluate((x) => go(x), pg); await p.waitForTimeout(220);
      if (errs.length !== n) ok(pg + ' rendert in ' + u + '-stand', false, errs.slice(n).join(' | '));
    }
  }
  ok('alle pagina\'s renderen in alle standen zonder JS-errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  const filt = await p.evaluate(async () => {
    setUnit('r'); toggleFilter('exchange', 'blofin'); setFilter('dir', 'long'); go('analytics');
    await new Promise(r => setTimeout(r, 700));
    const panels = document.querySelectorAll('#main .panel').length;
    clearGFilter(); setUnit('val');
    return panels;
  });
  ok('analytics blijft volledig renderen met filters actief in R-stand', filt > 8, String(filt));
  // Fase 1 = dashboard; analytics rekent bewust nog in bedragen. Bewijs: de sessie-bars
  // tonen +230 (netto €) en niet +4,0 (R) — zo zien we straks ook of fase 2 écht landt.
  ok('analytics rekent in fase 1 nog met bedragen, ook in R-stand', await p.evaluate(async () => {
    setUnit('r'); go('analytics'); await new Promise(r => setTimeout(r, 700));
    const pn = [...document.querySelectorAll('#main .panel')].find(x => /Netto per sessie/.test(x.textContent));
    const ok1 = !!pn && /230/.test(pn.textContent);
    setUnit('val'); return ok1;
  }));

  ok('geen JS-errors totaal', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== €/%/R-weergave: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
