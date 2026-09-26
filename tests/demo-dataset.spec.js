// Borgt de "direct alles testen"-demo (Denny 2026-09-16): resetDemo haalt de volledige
// dataset (v2, ±1100 trades t/m vandaag, incl. TradingPlan-blok) op (gehost naast de app), laadt inhoud (trades, playbooks, tags,
// accounts) maar laat de eigen omgeving met rust (koppelingen, thema, weergave), maakt
// eerst een veiligheidskopie bij bestaande data, en valt op file://-of-offline terug op
// de compacte ingebakken SEED. De gehoste kopie zelf wordt in hosted.spec.js bewaakt.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
  const raw = fs.readFileSync(path.resolve('site', 'demo-dataset.json'), 'utf8');
  const N = JSON.parse(raw).trades.length;   // aantal trades in het bestand (v2: geen vast getal meer)
  const b = await chromium.launch(); const p = await b.newPage(); p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.setViewportSize({ width: 1700, height: 1000 });
  // Vaste bedragen in deze spec: geen wisselkoers erbij (de omrekening staat in valuta.spec).
  await p.route('**/*', r => /frankfurter/.test(r.request().url()) ? r.abort() : r.continue());
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
      blofinVal: (EXCHANGES.find(e => e.id === 'blofin') || {}).val, blofinAcct: (EXCHANGES.find(e => e.id === 'blofin') || {}).acct,
      planRecs: JSON.parse(localStorage.getItem('tp2:trades') || '[]').length, planPlans: Object.keys(JSON.parse(localStorage.getItem('tp2:plans') || '{}')).length,
      linked: T.filter(t => t.planRef).length, synced: T.filter(t => t.srcId).length, fills: T.filter(t => t.fills && t.fills.length).length,
      today: T.some(t => (Date.now() - +new Date(t.date)) < 8 * 864e5),
      connHint: (CONNS.mexc || {}).hint, theme: STATE.theme, preset: VIEW.preset,
      manual: (MANUAL || []).length, withTps: T.filter(t => (t.tps || []).length).length };
  }, raw);
  ok('verse journal start leeg (geen confirm nodig)', res.fresh);
  ok('alle trades uit het bestand geladen (' + N + ')', res.trades === N && N > 1000, String(res.trades));
  ok('data loopt tot (hooguit een week vóór) vandaag', res.today);
  ok('gesynct-uitziende exchange-trades met stappen', res.synced > 500 && res.fills > 500, JSON.stringify({ s: res.synced, f: res.fills }));
  ok('TradingPlan-blok mee (poort-records + plannen) en trades eraan gekoppeld', res.planRecs === 70 && res.planPlans > 40 && res.linked === 70, JSON.stringify({ r: res.planRecs, p: res.planPlans, l: res.linked }));
  ok('playbooks + tag-configuratie mee', res.pbooks >= 6 && res.setups > 0, JSON.stringify({ p: res.pbooks, s: res.setups }));
  ok('exchange-saldi en accountnamen uit exMeta', res.blofinVal === 10527 && res.blofinAcct === 'Swing', JSON.stringify({ v: res.blofinVal, a: res.blofinAcct }));
  ok('handmatige accounts (FTMO) mee', res.manual >= 1);
  ok('trades met TP-levels aanwezig', res.withTps > 100, String(res.withTps));
  ok('eigen koppelingen NIET overschreven', res.connHint === 'KEEP', String(res.connHint));
  ok('eigen thema + weergave-preset blijven staan', res.theme === 'light' && res.preset === 'rustig', JSON.stringify({ t: res.theme, p: res.preset }));

  console.log('─── Pagina\'s renderen met de volledige set ───');
  for (const pg of ['dashboard', 'analytics', 'trades', 'kalender', 'playbook', 'tendencies', 'review']) {
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
  ok('en laadt opnieuw alle trades', res2.trades === N, String(res2.trades));

  console.log('─── Eigen TradingPlan wordt nooit overschreven ───');
  const res2b = await p.evaluate(async () => {
    localStorage.setItem('tp2:trades', JSON.stringify([{ id: 1, ts: new Date().toISOString(), sym: 'BTC', dir: 'Long', setup: 'A', exec: 'VOL', taken: true, checks: {}, missing: [], noTrade: [] }]));
    localStorage.setItem('tp2:plans', '{}');
    await resetDemo();
    return { recs: JSON.parse(localStorage.getItem('tp2:trades')).length, linked: T.filter(t => t.planRef).length };
  });
  ok('bestaand plan blijft staan (1 eigen record, geen demo-records)', res2b.recs === 1, String(res2b.recs));
  ok('en de trades krijgen dan geen verwijzing naar niet-bestaande records', res2b.linked === 0, String(res2b.linked));
  await p.evaluate(() => { localStorage.removeItem('tp2:trades'); localStorage.removeItem('tp2:plans'); });

  console.log('─── Fallback zonder netwerk ───');
  const res3 = await p.evaluate(async () => {
    window.fetch = async () => { throw new Error('offline'); };
    await resetDemo();
    window.fetch = window.__realFetch;
    return { trades: T.length };
  });
  ok('offline → compacte SEED-fallback', res3.trades > 0 && res3.trades < N, String(res3.trades));

  console.log('─── Voorbeelddata weer opruimen (Denny 2026-09-18) ───');
  const cl = await p.evaluate(async (json) => {
    // verse start, dan demo laden
    T = []; PBOOK = {}; MANUAL.length = 0; persist(); persistPbook(); persistManual();
    EXCHANGES.forEach(e => e.val = 0); persistExMeta();
    window.fetch = async (u) => /demo-dataset/.test(String(u)) ? new Response(json, { status: 200 }) : window.__realFetch(u);
    await resetDemo(); await new Promise(r => setTimeout(r, 300));
    const na = { trades: T.length, pb: Object.keys(PBOOK).length, man: MANUAL.length, ex: EXMAP.blofin.val, plan: JSON.parse(localStorage.getItem('tp2:trades') || '[]').length, knop: (go('instellingen'), setSetTab('data'), /Voorbeelddata opruimen/.test(document.getElementById('main').textContent)) };
    // eigen werk toevoegen dat NIET weg mag
    T.push({ id: 999999, date: '2026-09-18', time: '10:00', pair: 'EIGEN/USDT', dir: 'long', setup: 'London SFP', session: 'London', status: 'closed', kind: 'live', exchange: '', entry: 100, exit: 110, stop: 95, size: '1000', pnl: 42, r: 1, tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] });
    PBOOK['Mijn eigen'] = pbNormalize('Mijn eigen', ['eigen regel']);
    PBOOK['BOS-retest'].oneLiner = 'zelf aangepast';   // demo-playbook dat ik bewerkte
    persist(); persistPbook();
    // eigen poort-record naast de demo-records
    localStorage.setItem('tp2:trades', JSON.stringify(JSON.parse(localStorage.getItem('tp2:trades')).concat([{ id: 5, ts: new Date().toISOString(), sym: 'ETH', dir: 'Long', setup: 'A', exec: 'VOL', taken: true, checks: {}, missing: [], noTrade: [] }])));
    demoCleanup(); await new Promise(r => setTimeout(r, 300));
    return { na, trades: T.length, pairs: T.map(t => t.pair), pb: Object.keys(PBOOK).sort(), man: MANUAL.length, ex: EXMAP.blofin.val, plan: JSON.parse(localStorage.getItem('tp2:trades') || '[]').map(r => r.id), plans: Object.keys(JSON.parse(localStorage.getItem('tp2:plans') || '{}')).length, knopWeg: (setSetTab('data'), !/Voorbeelddata opruimen/.test(document.getElementById('main').textContent)) };
  }, raw);
  ok('na laden: alle trades, 6 playbooks, accounts, saldi en plan + opruim-knop verschijnt', cl.na.trades === N && cl.na.pb === 6 && cl.na.man >= 1 && cl.na.ex > 0 && cl.na.plan === 70 && cl.na.knop, JSON.stringify(cl.na));
  ok('opruimen haalt de demo-poortrecords en -plannen weg, eigen record blijft', cl.plan.length === 1 && cl.plan[0] === 5 && cl.plans === 0, JSON.stringify({ plan: cl.plan, plans: cl.plans }));
  ok('opruimen haalt alle voorbeeld-trades weg', cl.trades === 1 && cl.pairs.join() === 'EIGEN/USDT', JSON.stringify(cl.pairs.slice(0, 3)));
  ok('eigen playbook blijft, bewerkt demo-playbook blijft, gebruikt demo-playbook blijft', cl.pb.includes('Mijn eigen') && cl.pb.includes('BOS-retest') && cl.pb.includes('London SFP'), JSON.stringify(cl.pb));
  ok('ongebruikte, onaangeraakte demo-playbooks zijn weg', !cl.pb.includes('Range-fade') && !cl.pb.includes('VWAP-bounce'), JSON.stringify(cl.pb));
  ok('demo-accounts en demo-saldi zijn opgeruimd', cl.man === 0 && cl.ex === 0, JSON.stringify({ man: cl.man, ex: cl.ex }));
  ok('knop verdwijnt zodra er geen voorbeelddata meer is', cl.knopWeg);

  ok('geen JS-errors totaal', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== Demo-dataset: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
