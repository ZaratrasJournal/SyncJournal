// TradingPlan v3, taak 9: de doorloop met de demo-dataset (site/demo-dataset.json in de journal geladen).
// Een week, twee dagen (de eerste met stijl Scalp), vijf scenario's, een geplakt plaatje en een TradingView-link,
// één scenario gekoppeld aan een trade uit de journal en één via het vooraf ingevulde formulier, de dag afgesloten.
// Screenshots van elk scherm, licht en donker, 1280 en 390 breed:
//   node tests/plan3-doorloop.spec.js           → tests/screenshots/plan3-doorloop/
//   node tests/plan3-doorloop.spec.js --docs    → docs/plan-v3-bouw-screenshots/ (voor het bouwrapport)
//   node tests/plan3-doorloop.spec.js --uit=<map> → screenshots in die map
// De klok staat vast (Playwright clock) op de dag van de nieuwste live-trade in de dataset (dag 1) en de dag erna (dag 2).
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const H = require('./helpers/plan3'); const NAAM = 'Plan v3 doorloop';
const UIT = (process.argv.find(a => a.startsWith('--uit=')) || '').slice(6);   // --uit=<map>: screenshots daarheen (bv. de polish-voor/na)
const OUT = UIT ? path.resolve(H.ROOT, UIT) : process.argv.includes('--docs') ? path.join(H.ROOT, 'docs', 'plan-v3-bouw-screenshots') : path.join(H.ROOT, 'tests', 'screenshots', 'plan3-doorloop');
fs.mkdirSync(OUT, { recursive: true });
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
// DEMO_DATASET=<pad>: een ander bestand, bv. vers uit scripts/gen-syncjournal-dataset-v2.js vóór de release
const BRON = process.env.DEMO_DATASET || path.join(H.ROOT, 'site', 'demo-dataset.json');
const DATA = JSON.parse(fs.readFileSync(BRON, 'utf8'));
// dag 1: de dag van de nieuwste gesloten live-trade van een exchange; dag 2 de dag erna
const T1 = DATA.trades.filter(t => t.kind === 'live' && t.status === 'closed' && t.srcId && t.setup).sort((a, b) => +b.openTime - +a.openTime)[0];
const AMS = ms => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Amsterdam' }).format(new Date(ms));
const D1 = AMS(+T1.openTime), D2 = AMS(Date.parse(D1 + 'T12:00:00Z') + 864e5);
const TV = 'https://www.tradingview.com/x/AbC123/';

(async () => {
  const srv = await H.server(), T = H.teller(NAAM), ok = T.ok;
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await H.alleenLokaal(ctx);
  await ctx.route('https://s3.tradingview.com/snapshots/a/AbC123.png', r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await ctx.clock.setFixedTime(new Date(D1 + 'T07:30:00Z'));
  if (process.env.DEMO_DATASET) await ctx.route('**/demo-dataset.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(BRON) }));
  const nieuw = async () => { const q = await ctx.newPage(); q.on('pageerror', e => errs.push(String(e).split('\n')[0])); q.on('dialog', d => d.accept()); return q; };
  const shot = async (q, naam, voor) => { for (const donker of [false, true]) for (const w of [1280, 390]) {
    await q.setViewportSize({ width: w, height: 900 }); await H.thema(q, donker); if (voor) await voor(q);
    await q.evaluate(() => window.scrollTo(0, 0)); await q.waitForTimeout(150);
    await q.screenshot({ path: path.join(OUT, `${naam}-${donker ? 'donker' : 'licht'}-${w}.jpg`), fullPage: true, type: 'jpeg', quality: 78 }); }
    await q.setViewportSize({ width: 1280, height: 900 }); await H.thema(q, false); };

  console.log(`--- journal met de demo-dataset (dag 1 ${D1}: ${T1.pair} ${T1.dir} ${T1.setup}) ---`);
  const j = await nieuw();
  await j.addInitScript(() => localStorage.setItem('sj_welcomed', 'true'));
  await j.goto(srv.APP, { waitUntil: 'load' }); await j.waitForTimeout(1000);
  await j.evaluate(() => resetDemo()); await j.waitForTimeout(1500);
  // een demo-bestand met een eigen plan (v3-blok): dat plan weg, we maken hier alles zelf
  await j.evaluate(() => { localStorage.removeItem('tp3:plans'); planSync(); }); await j.waitForTimeout(300);
  ok('demo-dataset geladen in de journal', await j.evaluate(n => T.length === n, DATA.trades.length));

  console.log('--- dag 1 (Scalp): week en dag maken ---');
  const p = await nieuw();
  await p.goto(srv.TP, { waitUntil: 'load' }); await p.waitForTimeout(600);
  ok('vandaag in het plan = dag 1', await p.evaluate(() => __tp3.vandaag()) === D1);
  await p.click('[data-a="settings"]'); await p.click('[data-a="stijl"][data-v="scalp"]'); await p.click('[data-a="saveSettings"]');
  await p.click('nav.tabs [data-v="week"]'); await p.click('[data-a="maakWeek"]'); await p.waitForTimeout(100);
  ok('weekplan met de Scalp-lagen Daily · 4H', await p.evaluate(() => [...document.querySelectorAll('#app .layer .tf')].map(x => x.textContent).join()) === 'Daily,4H');
  await p.click('[data-a="bias"][data-p="week.0"][data-v="Bullish"]'); await p.click('[data-a="bias"][data-p="week.1"][data-v="Bullish"]');
  await p.click('[data-a="picker"][data-p="week.1"]'); await p.click('#modal [data-a="pick"][data-v="BOS"]'); await p.click('#modal [data-a="close"]');
  await p.fill('#w-levels', 'BTC 78.150 weekly high\nBTC 75.000 range-low'); await p.fill('#w-nt', 'do FOMC 19:00, niet traden 18:30–20:00'); await p.fill('#w-focus', 'Alleen A-setups in London');
  await p.click('nav.tabs [data-v="dag"]'); await p.click('[data-a="maakDag"]'); await p.waitForTimeout(100);
  ok('dag 1 met de Scalp-lagen 1H · 15M en de week erboven', await p.evaluate(() => __tp3.dayOf(__tp3.vandaag()).layers.map(l => l.tf).join()) === '1H,15M');
  await p.click('[data-a="bias"][data-p="day.0"][data-v="Bullish"]');
  const maakScen = async (o) => { await p.click('section [data-a="newScen"]'); await p.waitForTimeout(100);
    await p.fill('#sc-title', o.titel); if (o.pb) await p.selectOption('#sc-pb', o.pb); await p.fill('#sc-pair', o.pair);
    await p.click(`#modal [data-a="dset"][data-p="dir"][data-v="${o.dir}"]`); if (o.grade) await p.click(`#modal [data-a="dset"][data-p="grade"][data-v="${o.grade}"]`);
    await p.fill('#sc-trig', o.trig || ''); await p.fill('#sc-inv', o.inv || ''); if (o.stop) await p.fill('#sc-stop', o.stop); if (o.tps) await p.fill('#sc-tps', o.tps);
    await p.click('#modal [data-a="saveScen"]'); await p.waitForTimeout(150); };
  const base = T1.pair.split('/')[0];
  await maakScen({ titel: base + ' ' + T1.setup, pb: T1.setup, pair: base, dir: T1.dir, trig: 'Als de Asia-low gesweept wordt en 15M terug in de range sluit', inv: '15M close voorbij de sweep' });
  await maakScen({ titel: 'ETH range-fade', pb: 'Range-fade', pair: 'ETH', dir: 'short', grade: 'C', trig: 'Als de range-high afwijst zonder volume', inv: 'Acceptance boven de range' });
  ok('dag 1: twee scenario\'s met hun edge uit de journal', await p.evaluate(() => document.querySelectorAll('.ritem').length === 2 && /Live \d+/.test(document.querySelector('.rlist').innerText)));

  console.log('--- dag 2 (Daytrade): drie scenario\'s, plaatje en TradingView-link ---');
  await ctx.clock.setFixedTime(new Date(D2 + 'T07:30:00Z'));
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(500);
  await p.click('[data-a="settings"]'); await p.click('[data-a="stijl"][data-v="daytrade"]'); await p.click('[data-a="saveSettings"]');
  await p.click('[data-a="maakDag"]'); await p.waitForTimeout(100);
  ok('dag 2 met de Daytrade-lagen 4H · 1H, min 4H dat de week al heeft: 1H', await p.evaluate(() => __tp3.dayOf(__tp3.vandaag()).layers.map(l => l.tf).join()) === '1H');
  await p.click('[data-a="mental"][data-v="4"]'); await p.click('[data-a="pre"][data-v="0"]'); await p.click('[data-a="pre"][data-v="1"]');
  await maakScen({ titel: 'BTC trend-pullback', pb: 'Trend-pullback', pair: 'BTC', dir: 'long', trig: 'Als BTC de 4H OB raakt en 1H een MSB zet', inv: '4H close onder 75.000', stop: '75020', tps: '77400 78150' });
  await maakScen({ titel: 'SOL BOS-retest', pb: 'BOS-retest', pair: 'SOL', dir: 'short', trig: 'Als SOL onder 158 breekt en de retest afwijst', inv: '1H close boven 162' });
  await maakScen({ titel: 'ARB London SFP', pb: 'London SFP', pair: 'ARB', dir: 'long', grade: 'B', trig: 'Als London de Asia-low sweept', inv: '15M close onder 0,80' });
  const P = await p.evaluate(() => __tp3.load());
  ok('vijf scenario\'s over twee dagen, een weekplan', Object.keys(P.days).length === 2 && Object.values(P.days).reduce((n, d) => n + d.scenarios.length, 0) === 5 && Object.keys(P.weeks).length >= 1);
  const s3 = P.days[D2].scenarios[0].id;
  await p.click(`.ritem[data-s="${s3}"] .rrow`); await p.waitForTimeout(100);
  await p.evaluate(async () => { const c = document.createElement('canvas'); c.width = 640; c.height = 360; const g = c.getContext('2d'); g.fillStyle = '#1b2436'; g.fillRect(0, 0, 640, 360); g.strokeStyle = '#37c48b'; g.lineWidth = 4; g.beginPath(); [[0, 300], [120, 240], [200, 270], [330, 150], [420, 190], [640, 60]].forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
    const bl = await new Promise(r => c.toBlob(r, 'image/png')); const dt = new DataTransfer(); dt.items.add(new File([bl], 'chart.png', { type: 'image/png' })); document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); await new Promise(r => setTimeout(r, 400));
    const dt2 = new DataTransfer(); dt2.setData('text/plain', 'https://www.tradingview.com/x/AbC123/'); document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt2, bubbles: true, cancelable: true })); await new Promise(r => setTimeout(r, 300)); });
  const m3 = await p.evaluate(id => __tp3.load().days[__tp3.vandaag()].scenarios.find(s => s.id === id).media, s3);
  ok('plaatje en TradingView-link geplakt bij het open scenario', m3.imgs.length === 1 && m3.links.join() === TV, JSON.stringify(m3));
  await p.click(`.ritem[data-s="${s3}"] [data-a="chk"]`).catch(() => {});
  await shot(p, 'dag', async q => { await q.click('nav.tabs [data-v="dag"]'); await q.click(`.ritem[data-s="${s3}"] .rrow`); await q.waitForTimeout(400); });
  await shot(p, 'week', async q => { await q.click('nav.tabs [data-v="week"]'); await q.waitForTimeout(150); });
  await shot(p, 'instellingen', async q => { await q.click('[data-a="settings"]'); await q.waitForTimeout(100); });

  console.log('--- zet om in trade: koppelen (dag 1) en het formulier (dag 2) ---');
  const s1 = P.days[D1].scenarios[0].id;
  const naarKoppel = async q => { await q.click('nav.tabs [data-v="log"]'); await q.click(`#app .schip[data-s="${s1}"]`); await q.click(`#app .dayrow [data-a="convert"][data-s="${s1}"]`); await q.waitForTimeout(200); };
  await shot(p, 'zet-om-koppelen', naarKoppel);
  await naarKoppel(p);
  const kand = await p.evaluate(() => [...document.querySelectorAll('#modal .kand')].map(k => k.dataset.t));
  ok('kandidaten op dag 1: de trade van dezelfde pair en richting staat erbij', kand.includes(String(T1.id)), JSON.stringify(kand));
  await p.click(`#modal .kand[data-t="${T1.id}"]`); await p.click('#modal [data-a="koppel"]'); await p.waitForTimeout(300);
  ok('scenario 1 genomen en gekoppeld', await p.evaluate(([id, tid]) => { const s = __tp3.load().days[Object.keys(__tp3.load().days).sort()[0]].scenarios.find(x => x.id === id); return s.status === 'genomen' && s.trades.map(String).includes(String(tid)); }, [s1, T1.id]));
  await j.bringToFront(); await j.evaluate(() => planSync()); await j.waitForTimeout(800);
  ok('journal: de trade heeft planRef en lagen uit het scenario (alleen lege velden)', await j.evaluate(([tid, sid]) => { const t = T.find(x => String(x.id) === String(tid)); return t.planRef === 's:' + sid; }, [T1.id, s1]));
  await p.bringToFront();
  await shot(p, 'zet-om-formulier', async q => { await q.click('nav.tabs [data-v="dag"]'); await q.click(`.ritem[data-s="${s3}"] .rrow`); await q.click(`.ritem[data-s="${s3}"] [data-a="convert"]`); await q.click('#modal [data-a="convWeg"][data-v="hand"]'); await q.waitForTimeout(150); });
  await p.click(`.ritem[data-s="${s3}"] .rrow`); await p.click(`.ritem[data-s="${s3}"] [data-a="convert"]`); await p.click('#modal [data-a="convWeg"][data-v="hand"]');
  await Promise.all([p.waitForNavigation({ waitUntil: 'load' }), p.click('#modal [data-a="naarFormulier"]')]); await p.waitForTimeout(1500);
  const form = await p.evaluate(() => ({ open: modalKind === 'trade', pair: document.getElementById('f_pair').value, pb: document.getElementById('f_playbook').value, shots: formShots.length, tv: formTvLinks.length, lagen: formLayers.length }));
  ok('het journal-formulier opent vooraf ingevuld (pair, playbook, lagen, plaatje, link)', form.open && /^BTC\//.test(form.pair) && form.pb === 'Trend-pullback' && form.shots === 1 && form.tv === 1 && form.lagen >= 1, JSON.stringify(form));
  await p.screenshot({ path: path.join(OUT, 'journal-formulier-licht-1280.jpg'), type: 'jpeg', quality: 78 });
  await p.fill('#f_entry', '76100'); await p.fill('#f_exit', '77400'); await p.fill('#f_pnl', '128'); await p.selectOption('#f_kind', 'paper');
  await p.evaluate(() => submitForm(null)); await p.waitForTimeout(400);
  ok('opslaan: paper-trade gekoppeld aan het scenario, scenario genomen', await p.evaluate(sid => { const t = T.find(x => +x.entry === 76100); const s = JSON.parse(localStorage.getItem('tp3:plans')).days; const sc = Object.values(s).flatMap(d => d.scenarios).find(x => x.id === sid); return t && t.planRef === 's:' + sid && sc.status === 'genomen' && sc.trades.map(String).includes(String(t.id)); }, s3));
  await p.goto(srv.TP, { waitUntil: 'load' }); await p.waitForTimeout(500);

  console.log('--- de dag afsluiten ---');
  await p.click('nav.tabs [data-v="afsluiting"]'); await p.waitForTimeout(150);
  ok('afsluiting opent op vandaag (dag 2)', await p.evaluate(D2 => document.querySelector('#app [data-a="afslDag"].on').dataset.v === D2, D2));
  const open = await p.evaluate(() => [...new Set([...document.querySelectorAll('#app .afopen [data-s]')].map(x => x.dataset.s))]);
  if (open[0]) await p.click(`#app .afopen [data-a="status"][data-s="${open[0]}"][data-v="niet"]`);
  if (open[1]) await p.click(`#app .afopen [data-a="status"][data-s="${open[1]}"][data-v="gemist"]`);
  await p.fill('#af-les', 'Alleen genomen wat in het plan stond. De SOL-short kwam niet; goed dat ik niet ging jagen.'); await p.waitForTimeout(100);
  await p.click(`#app [data-a="afslDag"][data-v="${D1}"]`); await p.waitForTimeout(100);
  const open1 = await p.evaluate(() => [...new Set([...document.querySelectorAll('#app .afopen [data-s]')].map(x => x.dataset.s))]);
  for (const id of open1) await p.click(`#app .afopen [data-a="status"][data-s="${id}"][data-v="ongeldig"]`);
  ok('beide dagen afgesloten: geen open scenario\'s meer, les bewaard', await p.evaluate(D2 => { const P = __tp3.load(); return Object.values(P.days).every(d => d.scenarios.every(s => s.status !== 'open')) && /goed dat ik niet ging jagen/.test(P.days[D2].les); }, D2));
  await shot(p, 'afsluiting', async q => { await q.click('nav.tabs [data-v="afsluiting"]'); await q.waitForTimeout(150); });
  await shot(p, 'log', async q => { await q.click('nav.tabs [data-v="log"]'); await q.waitForTimeout(150); });
  const score = await p.evaluate(() => { document.querySelector('nav.tabs [data-v="log"]').click(); return document.querySelector('#app .score').innerText.replace(/\s+/g, ' '); });
  ok('Log: voorspel-score van de vijf scenario\'s', /Je scenario's komen in \d+% uit\. Daarvan neem je \d+%\./.test(score), score);
  const buitenPlan = await p.evaluate(D1 => { const gek = new Set(Object.values(__tp3.load().days).flatMap(d => d.scenarios.flatMap(x => x.trades.map(String)))), m = __tp3.vandaag().slice(0, 7);
    const dag = t => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Amsterdam' }).format(new Date(+t.openTime));
    return { verwacht: __tp3.JR.trades.filter(t => (!t.kind || t.kind === 'live') && t.status === 'closed' && dag(t) >= D1 && dag(t).slice(0, 7) === m && !gek.has(String(t.id))).length, txt: document.querySelector('#app .score').nextElementSibling.innerText.replace(/\s+/g, ' ') }; }, D1);
  ok('Log telt "buiten plan" pas vanaf de eerste plan-dag (zoals Tendencies → Plan)', buitenPlan.verwacht === 0 ? /Geen trades buiten plan deze maand/.test(buitenPlan.txt) : new RegExp('over ' + buitenPlan.verwacht + ' trade').test(buitenPlan.txt), JSON.stringify(buitenPlan));

  console.log('--- journal: Tendencies → Plan en de trade-details ---');
  await j.bringToFront(); await j.reload({ waitUntil: 'load' }); await j.waitForTimeout(1200);
  await shot(j, 'journal-plan', async q => { await q.waitForTimeout(800); await q.evaluate(() => { STATE.tend = 'plan'; go('tendencies'); }); await q.waitForTimeout(900); });
  ok('Tendencies → Plan toont de voorspel-score', await j.evaluate(() => { STATE.tend = 'plan'; go('tendencies'); return /Je scenario's komen in/.test(document.body.innerText); }));
  ok('trade-details: "Scenario: …" bij de gekoppelde trade', await j.evaluate(tid => /Scenario:/.test(planLine(T.find(x => String(x.id) === String(tid)))), T1.id));

  ok('geen JS-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('screenshots: ' + path.relative(H.ROOT, OUT));
  await b.close(); srv.close(); process.exit(T.eind());
})();
