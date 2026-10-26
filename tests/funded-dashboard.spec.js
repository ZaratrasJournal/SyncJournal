// Funded modus (F11), stap 5: de Funded-kaart op het Dashboard (hooguit drie getallen, alleen met de modus aan en
// "meetellen" uit) en het filter eigen / funded / alles in Analytics, met de toestand "niets in beeld".
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const SHOTS = path.resolve('tests/screenshots/funded'); fs.mkdirSync(SHOTS, { recursive: true });

(async () => {
  const b = await chromium.launch(); const { p, errs } = await H.openJournal(b);
  const zet = (o) => p.evaluate((o) => {
    const base = { time: '10:00', dir: 'long', setup: 'London SFP', session: 'London', status: 'closed', kind: 'live', entry: 100, exit: 110, stop: 95, size: '1000', pair: 'BTC/USDT', tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] };
    FUNDED = o.leeg ? [] : [
      { id: 'fdA', kind: 'challenge', firm: 'Breakout', name: '25k #1', size: 25000, status: 'bezig', stop: null, logins: [], start: '2026-10-01' },
      { id: 'fdC', kind: 'funded', firm: 'FTMO', name: '100k #2', size: 100000, status: 'actief', stop: null, logins: [], start: '2026-09-29', payouts: [{ amount: 2480, date: '2026-10-13' }] }];
    T = [{ ...base, id: 1, date: '2026-10-01', exchange: 'blofin', pnl: 80 }, { ...base, id: 2, date: '2026-10-03', exchange: 'blofin', pnl: -30 },
      ...(o.leeg || o.zonderFunded ? [] : [{ ...base, id: 3, date: '2026-10-05', exchange: 'fdA', pnl: 475 }, { ...base, id: 4, date: '2026-10-07', exchange: 'fdC', pnl: 4000 }])];
    EXMAP.blofin.val = 1000; persistExMeta(); persistFunded(); persist();
    STATE.funded = o.fm !== false; STATE.fundedMee = !!o.mee; STATE.anGeld = o.geld || 'alles';
    STATE.theme = o.theme || 'light'; document.body.classList.toggle('dark', STATE.theme === 'dark');
    clearGFilter(); go(o.page || 'dashboard');
  }, o || {});
  const kaart = () => p.evaluate(() => { const k = document.querySelector('#main [data-funded-kaart]'); return k ? k.innerText.replace(/\s+/g, ' ') : null; });
  const shot = async (n) => { await p.waitForTimeout(500); await p.screenshot({ path: path.join(SHOTS, n + '.png'), fullPage: true }); };

  console.log('─── Dashboard-kaart ───');
  await zet({ fm: false });
  ok('modus uit: geen Funded-kaart', await kaart() === null);
  await zet({}); let k = await kaart();
  const getallen = (k || '').match(/[+−-]?\$ ?[\d.,]+|\b\d+\b(?= lopend)/g) || [];
  ok('modus aan: kaart met funded P&L, uitbetaald en aantal lopend (hooguit drie getallen)', /Funded P&L/i.test(k) && /\+\$ 4\.475/.test(k) && /Uitbetaald \$ 2\.480/.test(k) && /2 lopend/.test(k) && getallen.length <= 3, k + ' · ' + JSON.stringify(getallen));
  ok('kaart zegt dat het niet in je balans telt', /telt niet in je balans/.test(k));
  await shot('dashboard-kaart-light'); await zet({ theme: 'dark' }); await shot('dashboard-kaart-dark');
  await zet({ mee: true });
  ok('meetellen aan: geen losse kaart, wel één totaal "incl. funded"', await kaart() === null && await p.evaluate(() => /incl\. funded/.test(document.querySelector('#main .hero').innerText)));
  await zet({ leeg: true }); k = await kaart();
  ok('modus aan, nog niets: kaart met "Challenge toevoegen"', /Nog geen challenge/.test(k || '') && /Challenge toevoegen/.test(k || ''), k);
  await p.click('#main [data-funded-kaart] button');
  ok('… de knop opent Instellingen → Funded met het formulier', await p.evaluate(() => STATE.page === 'instellingen' && STATE.setTab === 'funded' && !!document.getElementById('fdF')));

  console.log('─── Analytics: eigen / funded / alles ───');
  const an = () => p.evaluate(() => ({ n: FT.length, seg: !!document.querySelector('#main [data-geld-filter]'), tekst: document.getElementById('main').innerText.replace(/\s+/g, ' ').slice(0, 300) }));
  await zet({ page: 'analytics', fm: false });
  ok('modus uit: geen filter, alleen eigen trades', !(await an()).seg && (await an()).n === 2);
  await zet({ page: 'analytics' });
  let a = await an();
  ok('modus aan, "alles": filter zichtbaar, 4 trades', a.seg && a.n === 4, JSON.stringify(a).slice(0, 120));
  await p.click('#main [data-geld-filter] button:text-is("Eigen")'); a = await an();
  ok('"eigen": 2 trades', a.n === 2 && await p.evaluate(() => STATE.anGeld === 'eigen'));
  await p.click('#main [data-geld-filter] button:text-is("Funded")'); a = await an();
  ok('"funded": 2 trades', a.n === 2);
  await shot('analytics-filter-funded');
  ok('het filter geldt alleen voor Analytics: Trades toont er 4', await p.evaluate(() => { go('trades'); const n = FT.length; go('analytics'); return n === 4; }));
  await zet({ page: 'analytics', geld: 'funded', zonderFunded: true }); a = await an();
  ok('"funded" zonder funded trades: "niets in beeld" met "Toon alles"', /Geen funded trades in beeld/.test(a.tekst) && a.seg && await p.evaluate(() => !!document.querySelector('[data-empty="funded-niets"]')), a.tekst);
  await p.click('[data-empty="funded-niets"] button');
  ok('… "Toon alles" zet het filter terug', await p.evaluate(() => STATE.anGeld === 'alles' && FT.length === 2));

  ok('geen JS-fouten', !errs.length, errs.join(' | '));
  await b.close();
  console.log(`\n=== Funded-dashboard: ${pass}/${pass + fail} ===`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
