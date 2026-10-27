// TradingPlan v3, taak 1: opslag (tp3:*), thema van de journal, vier tabs, tandwiel, stijl-lagen.
//  - lege opslag → Week · Dag · Afsluiting · Log, Dag actief, lege staat met knop
//  - sj_state.theme → data-theme op <html>, en mee als de journal het in een ander tabblad wijzigt
//  - een nieuwe dag start met de lagen van de stijl (scalp 1H·15M, daytrade 4H·1H)
//  - een dag zonder weekplan is te maken en te bewaren
//  - het tandwiel bewaart risico per grade, de drie pre-flight-teksten en de stijl
const { chromium } = require('playwright'); const path = require('path');
const H = require('./helpers/plan3'); const SHOTS = H.SHOTS;
const NAAM = 'Plan v3 basis';

(async () => {
  const srv = await H.server(), { TP, APP } = srv, T = H.teller(NAAM), ok = T.ok;
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await H.alleenLokaal(ctx);
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
  await p.goto(TP, { waitUntil: 'load' }); await p.waitForTimeout(500);

  console.log('--- lege opslag ---');
  const leeg = await p.evaluate(() => ({ tabs: [...document.querySelectorAll('nav.tabs button')].map(x => x.textContent.trim()), on: (document.querySelector('nav.tabs button.on') || {}).textContent, txt: document.getElementById('app').innerText, knop: !!document.querySelector('[data-a="maakDag"]'), api: typeof window.__tp3 }));
  ok('vier tabs Week · Dag · Afsluiting · Log, Dag actief', leeg.tabs.join() === 'Week,Dag,Afsluiting,Log' && leeg.on === 'Dag', JSON.stringify(leeg.tabs) + ' ' + leeg.on);
  ok('lege staat "Nog geen plan voor vandaag" met knop', /Nog geen plan voor vandaag/.test(leeg.txt) && leeg.knop, leeg.txt.slice(0, 200));
  ok('window.__tp3 met load/save/cfg/stijlLagen/dayOf/weekOf', leeg.api === 'object' && await p.evaluate(() => ['load', 'save', 'cfg', 'stijlLagen', 'dayOf', 'weekOf'].every(k => typeof __tp3[k] === 'function')));
  ok('geen eigen themaknop', await p.evaluate(() => !document.querySelector('[data-a="theme"]')));
  ok('standaard licht, zonder sj_state', await p.evaluate(() => document.documentElement.dataset.theme === 'light'));
  for (const w of [1280, 390]) { await p.setViewportSize({ width: w, height: 800 }); await p.screenshot({ path: path.join(SHOTS, `basis-leeg-licht-${w}.png`), fullPage: true }); }
  await p.setViewportSize({ width: 1280, height: 900 });

  console.log('--- stijl-lagen ---');
  const sl = await p.evaluate(() => ({ swing: __tp3.stijlLagen('swing'), day: __tp3.stijlLagen('daytrade'), scalp: __tp3.stijlLagen('scalp') }));
  ok('swing: week Weekly·Daily, dag 4H·1H, entry 1H', sl.swing.week.join() === 'Weekly,Daily' && sl.swing.dag.join() === '4H,1H' && sl.swing.entry === '1H', JSON.stringify(sl.swing));
  ok('daytrade: week Weekly·Daily, dag 4H·1H, entry 15M', sl.day.week.join() === 'Weekly,Daily' && sl.day.dag.join() === '4H,1H' && sl.day.entry === '15M', JSON.stringify(sl.day));
  ok('scalp: week Daily·4H, dag 1H·15M, entry 5M', sl.scalp.week.join() === 'Daily,4H' && sl.scalp.dag.join() === '1H,15M' && sl.scalp.entry === '5M', JSON.stringify(sl.scalp));
  ok('standaard-stijl is daytrade, risico A 1 · B 0,5 · C 0', await p.evaluate(() => { const c = __tp3.cfg(); return c.stijl === 'daytrade' && c.risk.A === 1 && c.risk.B === 0.5 && c.risk.C === 0 && c.pre.length === 3; }));

  console.log('--- dag zonder weekplan ---');
  await p.click('[data-a="maakDag"]'); await p.waitForTimeout(200);
  const dag = await p.evaluate(() => { const id = __tp3.vandaag(), d = __tp3.dayOf(id); return { id, d, wk: d && __tp3.weekOf(d.week), ls: JSON.parse(localStorage.getItem('tp3:plans') || 'null') }; });
  ok('daytrade-dag start met 4H · 1H', dag.d && dag.d.layers.map(l => l.tf).join() === '4H,1H', JSON.stringify(dag.d && dag.d.layers));
  ok('dag zonder weekplan: geen week, wel bewaard in tp3:plans (v:1)', dag.d && dag.wk == null && dag.ls && dag.ls.v === 1 && dag.ls.days[dag.id], JSON.stringify(dag.ls).slice(0, 200));
  ok('dag heeft het vaste model', dag.d && Array.isArray(dag.d.scenarios) && dag.d.pre.length === 3 && dag.d.mental === null && dag.d.media && Array.isArray(dag.d.media.imgs) && dag.d.les === '');
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(400);
  ok('na herladen: de dag staat er nog, geen lege staat', await p.evaluate(() => !!__tp3.dayOf(__tp3.vandaag()) && !/Nog geen plan voor vandaag/.test(document.getElementById('app').innerText)));
  await p.evaluate(() => { const P = __tp3.load(); delete P.days[__tp3.vandaag()]; __tp3.save(P); const c = __tp3.cfg(); c.stijl = 'scalp'; localStorage.setItem('tp3:cfg', JSON.stringify(c)); });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(300);
  await p.click('[data-a="maakDag"]'); await p.waitForTimeout(200);
  ok('scalp-dag start met 1H · 15M', await p.evaluate(() => __tp3.dayOf(__tp3.vandaag()).layers.map(l => l.tf).join() === '1H,15M'));

  console.log('--- tandwiel ---');
  await p.click('[data-a="settings"]'); await p.waitForTimeout(150);
  await p.fill('#set-risk-A', '2'); await p.fill('#set-risk-B', '0.75'); await p.fill('#set-risk-C', '0');
  await p.fill('#set-pre-0', 'Kalender gecheckt'); await p.fill('#set-pre-1', 'Acht uur slaap'); await p.fill('#set-pre-2', '');
  await p.click('[data-a="stijl"][data-v="swing"]');
  await p.click('[data-a="saveSettings"]'); await p.waitForTimeout(150);
  const c = await p.evaluate(() => JSON.parse(localStorage.getItem('tp3:cfg')));
  ok('risico per grade bewaard (A 2 · B 0,75 · C 0)', c.risk.A === 2 && c.risk.B === 0.75 && c.risk.C === 0, JSON.stringify(c.risk));
  ok('pre-flight-teksten bewaard (een lege mag)', c.pre.join('|') === 'Kalender gecheckt|Acht uur slaap|', JSON.stringify(c.pre));
  ok('stijl bewaard: swing', c.stijl === 'swing');
  ok('lege pre-flight-tekst: geen vinkje op de dag', await p.evaluate(() => document.querySelectorAll('[data-a="pre"]').length === 2));

  console.log('--- thema volgt de journal ---');
  await p.evaluate(() => localStorage.setItem('sj_state', JSON.stringify({ theme: 'dark' })));
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(300);
  ok('sj_state.theme dark → data-theme="dark" op <html>', await p.evaluate(() => document.documentElement.dataset.theme === 'dark'));
  ok('donker: achtergrond echt donker', await p.evaluate(() => { const m = getComputedStyle(document.body).backgroundColor.match(/\d+/g).map(Number); return m[0] + m[1] + m[2] < 120; }));
  for (const w of [1280, 390]) { await p.setViewportSize({ width: w, height: 800 }); await p.screenshot({ path: path.join(SHOTS, `basis-dag-donker-${w}.png`), fullPage: true }); }
  const p2 = await ctx.newPage(); await p2.goto(TP, { waitUntil: 'load' });
  await p2.evaluate(() => localStorage.setItem('sj_state', JSON.stringify({ theme: 'light' })));   // "de journal" in een ander tabblad
  await p.waitForTimeout(300);
  ok('thema wisselt mee via het storage-event', await p.evaluate(() => document.documentElement.dataset.theme === 'light'));
  await p2.close();
  for (const w of [1280, 390]) { await p.setViewportSize({ width: w, height: 800 }); await p.screenshot({ path: path.join(SHOTS, `basis-dag-licht-${w}.png`), fullPage: true }); }
  ok('390 breed: geen horizontale scroll', await p.evaluate(() => document.documentElement.scrollWidth <= 391));

  ok('geen JS-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close(); srv.close(); process.exit(T.eind());
})();
