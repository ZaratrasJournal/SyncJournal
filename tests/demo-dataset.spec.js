// Borgt de "direct alles testen"-demo (Denny 2026-09-16): resetDemo haalt de volledige
// 3000-trade dataset op (gehost naast de app), laadt inhoud (trades, playbooks, tags,
// accounts) maar laat de eigen omgeving met rust (koppelingen, thema, weergave), maakt
// eerst een veiligheidskopie bij bestaande data, en valt op file://-of-offline terug op
// de compacte ingebakken SEED. De gehoste kopie zelf wordt in hosted.spec.js bewaakt.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
  const raw = fs.readFileSync(path.resolve('site', 'demo-dataset.json'), 'utf8');
  const b = await chromium.launch(); const p = await b.newPage(); p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.setViewportSize({ width: 1700, height: 1000 });
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(600);

  console.log('─── Welkomscherm ───');
  ok('rondkijk-knop laadt voorbeelddata', await p.evaluate(() => { renderWelcome(); const btn = document.querySelector('#welcome .wl-btn2'); return btn && /voorbeelddata/i.test(btn.textContent) && /resetDemo/.test(btn.getAttribute('onclick')); }));

  console.log('─── Volledige dataset (fetch gestubd met het echte bestand) ───');
  const res = await p.evaluate(async (json) => {
    try { hideWelcome() } catch (e) {}
    // eigen omgeving markeren: die mag de demo niet aanraken
    CONNS.mexc = { connected: false, autoSync: false, hint: 'KEEP' }; persistConns();
    setTheme('light'); VIEW.preset = 'rustig'; persistView();
    const fresh = T.length === 0;
    window.__realFetch = window.fetch;
    window.fetch = async (u) => /demo-dataset/.test(String(u)) ? new Response(json, { status: 200 }) : window.__realFetch(u);
    await resetDemo();
    return { fresh, trades: T.length, pbooks: Object.keys(PBOOK).length, setups: (tagConfig.setupTags || []).length,
      mexcVal: (EXCHANGES.find(e => e.id === 'mexc') || {}).val, mexcAcct: (EXCHANGES.find(e => e.id === 'mexc') || {}).acct,
      connHint: (CONNS.mexc || {}).hint, theme: STATE.theme, preset: VIEW.preset,
      manual: (MANUAL || []).length, withTps: T.filter(t => (t.tps || []).length).length };
  }, raw);
  ok('verse journal start leeg (geen confirm nodig)', res.fresh);
  ok('3000 trades geladen', res.trades === 3000, String(res.trades));
  ok('playbooks + tag-configuratie mee', res.pbooks >= 6 && res.setups > 0, JSON.stringify({ p: res.pbooks, s: res.setups }));
  ok('exchange-saldi en accountnamen uit exMeta', res.mexcVal === 13011 && res.mexcAcct === 'Scalp', JSON.stringify({ v: res.mexcVal, a: res.mexcAcct }));
  ok('handmatige accounts (FTMO) mee', res.manual >= 1);
  ok('trades met TP-levels aanwezig', res.withTps > 100, String(res.withTps));
  ok('eigen koppelingen NIET overschreven', res.connHint === 'KEEP', String(res.connHint));
  ok('eigen thema + weergave-preset blijven staan', res.theme === 'light' && res.preset === 'rustig', JSON.stringify({ t: res.theme, p: res.preset }));

  console.log('─── Pagina\'s renderen met 3000 trades ───');
  for (const pg of ['dashboard', 'analytics', 'trades', 'kalender', 'playbook']) {
    const n = errs.length;
    await p.evaluate((x) => go(x), pg); await p.waitForTimeout(250);
    ok(pg + ' rendert zonder JS-errors', errs.length === n, errs.slice(n).join(' | '));
  }

  console.log('─── Herladen met bestaande data ───');
  const res2 = await p.evaluate(async () => {
    await resetDemo(); // confirm wordt auto-geaccepteerd door de test
    const snaps = (SNAP_META || []).filter(s => s.label === 'vóór voorbeelddata').length;
    return { trades: T.length, snaps };
  });
  ok('opnieuw laden maakt eerst een veiligheidskopie', res2.snaps >= 1, String(res2.snaps));
  ok('en laadt opnieuw 3000 trades', res2.trades === 3000, String(res2.trades));

  console.log('─── Fallback zonder netwerk ───');
  const res3 = await p.evaluate(async () => {
    window.fetch = async () => { throw new Error('offline'); };
    await resetDemo();
    window.fetch = window.__realFetch;
    return { trades: T.length };
  });
  ok('offline → compacte SEED-fallback', res3.trades > 0 && res3.trades < 3000, String(res3.trades));

  ok('geen JS-errors totaal', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== Demo-dataset: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
