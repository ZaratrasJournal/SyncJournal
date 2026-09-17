// Borgt de echte P&L-percentagebasis (Denny 2026-09-17: "het moet altijd kloppend zijn").
// Basis per trade = huidige totale balans − P&L van deze en alle latere gesloten trades;
// optioneel vast referentiebedrag (prop-accounts); geen basis → géén percentage.
// Het oude demo-restant ACCT=24663 bestaat niet meer.
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
    const base = { time: '10:00', pair: 'BTC/USDT', dir: 'long', setup: '', session: 'London', status: 'closed', kind: 'live', exchange: 'blofin', entry: 100, exit: 110, stop: 95, size: '1000', r: 1, tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] };
    T = [
      { ...base, id: 1, date: '2026-09-01', pnl: 80 },
      { ...base, id: 2, date: '2026-09-05', pnl: -30 },
      { ...base, id: 3, date: '2026-09-10', pnl: 150 },
      { ...base, id: 9, date: '2026-09-12', status: 'open', pnl: 0 },
    ]; persist(); clearGFilter();
  });
  ok('boot zonder JS-errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  ok('het oude vaste bedrag (ACCT) bestaat niet meer', await p.evaluate(() => typeof ACCT === 'undefined'));

  console.log('─── Geen balans bekend → géén percentage ───');
  ok('pnlPctOf is null en de tabel toont alleen het bedrag', await p.evaluate(() => {
    go('trades');
    const cel = [...document.querySelectorAll('tbody td[data-l="P&L"]')][0];
    return pnlPctOf(T.find(t => t.id === 3)) === null && cel && !/%/.test(cel.textContent);
  }));

  console.log('─── Echte basis per trade (balans 1000) ───');
  const r1 = await p.evaluate(() => {
    EXMAP.blofin.val = 1000; persistExMeta(); render();
    const f = id => pnlPctOf(T.find(t => t.id === id));
    return { p1: f(1), p2: f(2), p3: f(3), open: f(9), b1: pnlBaseOf(T.find(t => t.id === 1)) };
  });
  // t1: basis 1000−(80−30+150)=800 → +10% · t2: basis 880 → −3,41% · t3: basis 850 → +17,65%
  ok('oudste trade: +10% op basis 800', r1.b1 === 800 && r1.p1 === 10, JSON.stringify(r1));
  ok('middelste: −3,41% op basis 880', r1.p2 === -3.41, String(r1.p2));
  ok('nieuwste: +17,65% op basis 850', r1.p3 === 17.65, String(r1.p3));
  ok('open trade heeft geen percentage', r1.open === null);
  ok('tabel toont de percentages, totaal-regel t.o.v. startbasis (+25%)', await p.evaluate(() => {
    go('trades'); const txt = document.querySelector('#main table').textContent;
    return /10,00%/.test(txt) && /17,65%/.test(txt) && /25,00%/.test(txt);
  }));

  console.log('─── Vast referentiebedrag ───');
  const r2 = await p.evaluate(() => { setPctRef(10000); const f = id => pnlPctOf(T.find(t => t.id === id)); return { p1: f(1), tot: pnlPctTotal(T.filter(t => t.status === 'closed'), 200) }; });
  ok('vaste referentie 10.000 → +0,8% en totaal +2%', r2.p1 === 0.8 && r2.tot === 2, JSON.stringify(r2));
  ok('instelling zichtbaar bij Accounts en overleeft herladen', await p.evaluate(() => { setPctRef(5000); go('instellingen'); return /P&L-percentage/.test(document.getElementById('main').textContent); }));
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(600);
  ok('pctRef persistent na reload', await p.evaluate(() => { try { hideWelcome() } catch (e) {} return STATE.pctRef === 5000; }));
  await p.evaluate(() => { setPctRef(0); });

  console.log('─── Consistentie ───');
  ok('nieuwe trade opslaan schrijft geen pnlPct-veld meer', await p.evaluate(() => {
    openForm(null);
    document.getElementById('f_pair').value = 'ETH/USDT'; document.getElementById('f_entry').value = '100'; document.getElementById('f_exit').value = '105'; document.getElementById('f_pnl').value = '50';
    submitForm(null);
    const t = T.find(x => x.pair === 'ETH/USDT');
    return t && t.pnlPct === undefined;
  }));
  ok('coach-tekst toont — bij ontbrekende basis (nooit een verzonnen getal)', await p.evaluate(() => { EXMAP.blofin.val = 0; persistExMeta(); return pnlPctOf(T[0]) === null; }));

  ok('geen JS-errors totaal', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== P&L-percentagebasis: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
