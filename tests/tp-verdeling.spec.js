// Take-profit levels in the trade form: "Verdeeld: 99.99999999999999% — moet samen 100% zijn" (Zaratras, v1.18.1).
// An import with three TPs (33.76 + 42.97 + 23.27) gives a computer rounding error in the sum: it showed 14 nines
// and counted as not complete.
//
// Draai: node tests/tp-verdeling.spec.js
const { chromium } = require('playwright');
const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const trade = (id, pcts) => ({ id, date: '2026-10-20', time: '10:00', pair: 'BTC/USDT', dir: 'long', session: 'London', status: 'closed', kind: 'live',
  entry: 60000, exit: 61000, stop: 59000, size: '1000', pnl: 10, tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [],
  tps: pcts.map((pct, i) => ({ price: 60500 + i * 500, pct, r: '', hit: true, ts: 0 })) });
const veelDecimalen = s => /\d[.,]\d{3,}/.test(s);

(async () => {
  const b = await chromium.launch(); const alleFouten = [];
  for (const thema of ['light', 'dark']) {
    console.log(`─── ${thema} ───`);
    const { ctx, p, errs } = await H.openJournal(b, { viewport: { width: 390, height: 860 } });
    await p.evaluate(t => setTheme(t), thema);
    await H.seedTrades(p, [trade('a', [33.76, 42.97, 23.27]), trade('b', [50, 40]), trade('c', [16.67, 16.67, 16.67, 16.67, 16.67, 16.67])]);
    const ids = await p.evaluate(() => T.map(t => t.id));
    const form = async i => p.evaluate(async id => { openForm(id); await new Promise(r => setTimeout(r, 250));
      const el = document.querySelector('#tpbuilder .tptot'); return { tekst: el ? el.innerText.replace(/\s+/g, ' ') : '', som: formTPs.reduce((a, x) => a + (+x.pct || 0), 0), pcts: formTPs.map(x => x.pct) }; }, ids[i]);

    let f = await form(0);
    ok(`${thema}: 33.76 + 42.97 + 23.27 → "100% ✓ volledig"`, /100% ✓ volledig/.test(f.tekst), f.tekst);
    ok(`${thema}: geen getal met meer dan 2 decimalen`, !veelDecimalen(f.tekst), f.tekst);
    ok(`${thema}: de drie delen blijven zoals ze waren`, f.pcts.join('|') === '33.76|42.97|23.27', f.pcts.join('|'));
    // typing in a level updates the whole line, not only the number
    f = await p.evaluate(() => { const inp = document.querySelectorAll('#tpbuilder .tpin.pct')[2]; inp.value = '20'; inp.dispatchEvent(new Event('input', { bubbles: true }));
      return document.querySelector('#tpbuilder .tptot').innerText.replace(/\s+/g, ' '); });
    ok(`${thema}: TP3 op 20 getypt → 96,73% en de melding, niet meer "volledig"`, /96,73%/.test(f) && /moet samen 100% zijn/.test(f) && !/volledig/.test(f), f);
    f = await p.evaluate(() => { const inp = document.querySelectorAll('#tpbuilder .tpin.pct')[2]; inp.value = '23.27'; inp.dispatchEvent(new Event('input', { bubbles: true }));
      return document.querySelector('#tpbuilder .tptot').innerText.replace(/\s+/g, ' '); });
    ok(`${thema}: terug naar 23.27 getypt → weer "100% ✓ volledig"`, /100% ✓ volledig/.test(f) && !veelDecimalen(f), f);
    await p.evaluate(() => closeForm());

    f = await form(1);
    ok(`${thema}: 50 + 40 → nog steeds de melding`, /90% — moet samen 100% zijn/.test(f.tekst), f.tekst);
    await p.evaluate(() => closeForm());

    f = await form(2);
    ok(`${thema}: zes keer 16.67 (afgerond 100,02) → "100% ✓ volledig" en samen precies 100`, /100% ✓ volledig/.test(f.tekst) && Math.abs(f.som - 100) < 1e-9 && f.pcts.every(x => !veelDecimalen(String(x))), f.tekst + ' ' + f.pcts.join('|'));
    await p.evaluate(() => { closeForm(); openForm(null); });
    f = await p.evaluate(async () => { addTP(); addTP(); addTP(); evenTPs(); renderTPs(); return document.querySelector('#tpbuilder .tptot').innerText.replace(/\s+/g, ' '); });
    ok(`${thema}: Gelijk verdelen met 3 TP's → 100% ✓ volledig`, /100% ✓ volledig/.test(f), f);
    const kleur = await p.evaluate(() => { const el = document.getElementById('tpsum'); return el ? getComputedStyle(el).color : ''; });
    ok(`${thema}: het getal staat in de groene themakleur`, kleur === await p.evaluate(() => { const s = document.createElement('span'); s.style.color = 'var(--green)'; document.body.appendChild(s); const c = getComputedStyle(s).color; s.remove(); return c; }), kleur);
    await p.evaluate(() => closeForm());
    alleFouten.push(...errs); await ctx.close();
  }
  ok('geen JS-fouten', alleFouten.length === 0, [...new Set(alleFouten)].slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n=== TP-verdeling: ${pass}/${pass + fail} ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
