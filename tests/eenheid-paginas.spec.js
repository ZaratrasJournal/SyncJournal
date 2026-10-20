// The $ / % / R switch above "Totale balans" holds for every page (Denny 20-10-2026): Analytics followed it,
// Kalender and Tendencies kept showing dollars. In % and R no amount in dollars may remain on Dashboard, Analytics,
// Tendencies or Kalender - except the balance itself, which is always money (design 18-09-2026). Tooltips too.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
  const b = await chromium.launch(); const p = await b.newPage(); await p.setViewportSize({ width: 1500, height: 1000 }); p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  await p.evaluate(() => {
    try { hideWelcome() } catch (e) {}
    STATE.currency = 'USD'; STATE.calMonth = '2026-10'; persistState();
    // 8 live trades in October with a stop (R known), two setups, two sessions; risk 100 each → R = pnl/100
    const mk = (id, date, time, setup, pnl) => ({ id, date, time, exchange: 'blofin', pair: 'BTC/USDT', dir: 'long', status: 'closed', kind: 'live', setup,
      entry: 80000, exit: 80000 + pnl * 8, stop: 79000, size: '8000', pnl, fees: 0, tps: [], tags: [], layers: [], openTime: String(Date.parse(date + 'T' + time + ':00Z')), closeTime: String(Date.parse(date + 'T' + time + ':00Z') + 36e5) });
    T = [mk(1, '2026-10-06', '08:00', 'MSB', 200), mk(2, '2026-10-06', '14:00', 'Breakout', -100), mk(3, '2026-10-07', '08:30', 'MSB', 150), mk(4, '2026-10-08', '14:30', 'Breakout', -50),
      mk(5, '2026-10-13', '08:15', 'MSB', 300), mk(6, '2026-10-14', '14:15', 'Breakout', 100), mk(7, '2026-10-15', '08:45', 'MSB', -100), mk(8, '2026-10-16', '14:45', 'MSB', 250)];
    persist(); clearGFilter(); setFilter('kind', 'alle');
  });
  // every element whose own text shows a dollar amount, with the panel it sits in
  const dollars = page => p.evaluate(page => { go(page);
    const uit = [];
    document.querySelectorAll('#main *').forEach(el => { const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('');
      if (!/\$\s?−?[+−-]?\s?\d/.test(own)) return;
      if (el.closest('.panel.hero')) return;   // the balance is always money
      const pan = el.closest('.panel,.kpi,.kpis'), h = pan && pan.querySelector('h3,.k,.lbl');
      uit.push(((h && h.textContent.trim()) || '?').slice(0, 40) + ': ' + own.trim().slice(0, 30)); });
    return uit; }, page);

  for (const [u, naam] of [['pct', '%'], ['r', 'R']]) {
    console.log(`─── Eenheid ${naam} ───`);
    await p.evaluate(u => setUnit(u), u);
    for (const page of ['dashboard', 'analytics', 'tendencies', 'kalender']) {
      const d = await dollars(page);
      ok(`${page}: geen bedragen in dollars`, d.length === 0, JSON.stringify(d));
    }
  }

  console.log('─── R: de juiste getallen ───');
  await p.evaluate(() => setUnit('r'));
  const kal = await p.evaluate(() => { go('kalender');
    const cel = [...document.querySelectorAll('.calgrid .cell')].find(c => (c.querySelector('.dn') || {}).textContent === '6');
    const kpi = [...document.querySelectorAll('.kpis > *')].find(k => /Netto maand/.test(k.textContent));
    return { dag6: cel && cel.querySelector('.cp').textContent, maand: kpi && kpi.textContent.replace(/\s+/g, ' ') }; });
  ok('kalender 6 okt: +2R − 1R = +1,0R', kal.dag6 === '+1,0R', JSON.stringify(kal));
  ok('netto maand: +7,5R', /\+7,5R/.test(kal.maand || ''), JSON.stringify(kal));
  const tend = await p.evaluate(() => { go('tendencies'); return [...document.querySelectorAll('.hbar .sub')].map(s => s.textContent.replace(/\s+/g, ' ')); });
  ok('tendencies-breakdown: netto in R per sessie', tend.length > 0 && tend.every(s => /netto [+−]\d+,\dR/.test(s)), JSON.stringify(tend));
  const tip = await p.evaluate(() => { go('kalender'); const c = document.querySelector('.yc[data-iso="2026-10-06"]'); const r = c.getBoundingClientRect();
    c.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: r.left + 2, clientY: r.top + 2 })); return document.getElementById('yhtip').textContent; });
  ok('tooltip in het jaaroverzicht: +1,0R, geen dollars', /\+1,0R/.test(tip) && !/\$/.test(tip), tip);

  const kern = await p.evaluate(() => { go('analytics'); const m = document.getElementById('main').textContent.replace(/\s+/g, ' ');
    const na = (lbl, n = 14) => { const i = m.indexOf(lbl); return i < 0 ? '' : m.slice(i + lbl.length, i + lbl.length + n); };
    return { gemW: na('Gem. winst'), gemL: na('Gem. verlies'), bigW: na('Grootste winst', 7), bigL: na('Grootste verlies', 7), exp: na('Verwachting/trade', 7), dd: m.slice(Math.max(0, m.indexOf('Max drawdown') - 8), m.indexOf('Max drawdown')) }; });
  ok('kerncijfers in R: gem. winst +2,0R, gem. verlies −0,83R', /^\s*\+2,0R/.test(kern.gemW) && /^\s*−0,83R/.test(kern.gemL), JSON.stringify(kern));
  ok('kerncijfers in R: grootste +3,0R / −1,0R, verwachting +0,94R', /\+3,0R/.test(kern.bigW) && /−1,0R/.test(kern.bigL) && /\+0,94R/.test(kern.exp), JSON.stringify(kern));
  ok('max drawdown in R: −1,0R', /−1,0R/.test(kern.dd), JSON.stringify(kern));

  console.log('─── In dollars blijft alles zoals het was ───');
  await p.evaluate(() => setUnit('val'));
  const kalV = await p.evaluate(() => { go('kalender'); const cel = [...document.querySelectorAll('.calgrid .cell')].find(c => (c.querySelector('.dn') || {}).textContent === '6'); return cel && cel.querySelector('.cp').textContent; });
  ok('kalender 6 okt: +$ 100', /\+\$\s?100/.test(kalV || ''), kalV);

  ok('geen JS-fouten', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log(`\n=== Eenheid op elke pagina: ${pass}/${pass + fail} ===`); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  ✗ crash: ' + String(e).split('\n')[0]); process.exit(1); });
