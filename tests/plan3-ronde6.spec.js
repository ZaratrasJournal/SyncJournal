// TradingPlan v3 ronde 6 (docs/plan-v3-ronde6-2026-10-31.md): het scenario-venster.
//  1. Afbeeldingen en links bij "Zet om in trade": een nieuwe trade krijgt ze; koppelen aan een trade die al
//     screenshots heeft houdt die en voegt de plan-afbeeldingen toe (geen dubbele, hooguit 8); opnieuw koppelen voegt
//     niets nog eens toe; past niet alles, dan zegt de toast het. Het venster "Zet om in trade" zegt wat er meegaat.
const { chromium } = require('playwright');
const H = require('./helpers/plan3'); const NAAM = 'Plan v3 ronde 6';
const L = (tf, setups = [], confirmations = [], bias = '') => ({ tf, bias, setups, confirmations });
const leeg = () => ({ imgs: [], links: [] });
const sc = o => Object.assign({ pair: 'BTC', dir: 'long', grade: 'A', trigger: '', invalid: '', entry: L('15M'), off: [], checked: [], critChecked: [], stop: '', tps: [], media: leeg(), note: '', status: 'open', statusTs: null, trades: [] }, o);
const TV = 'https://www.tradingview.com/x/AbC123/', EIGEN_TV = 'https://www.tradingview.com/x/EiGeN1/';

(async () => {
  const srv = await H.server(), T = H.teller(NAAM), ok = T.ok;
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await H.alleenLokaal(ctx);
  const nieuw = async () => { const q = await ctx.newPage(); q.on('pageerror', e => errs.push(String(e).split('\n')[0])); q.on('dialog', d => d.accept()); return q; };
  const p = await nieuw();
  await p.goto(srv.TP, { waitUntil: 'load' });
  const DAG = await p.evaluate(() => __tp3.vandaag());
  // een paar kleine plaatjes (verschillende inhoud), als data-URL zoals de journal ze bewaart
  const plaatjes = await p.evaluate(n => Array.from({ length: n }, (_, i) => { const c = document.createElement('canvas'); c.width = 40; c.height = 24; const g = c.getContext('2d');
    g.fillStyle = `hsl(${i * 37},70%,50%)`; g.fillRect(0, 0, 40, 24); return c.toDataURL('image/jpeg', 0.8); }), 9);
  const tr = (id, extra) => Object.assign({ id, exchange: '', status: 'closed', kind: 'live', pair: 'BTC/USDT', dir: 'long', setup: '', entry: 100, stop: 99, size: 1000, exit: 101, pnl: 10, r: 0, fees: 0,
    date: DAG, time: '10:00', tps: [], layers: [], screenshots: [], tvLinks: [] }, extra || {});
  const TRADES = [tr(901, { screenshots: [plaatjes[0]], tvLinks: [EIGEN_TV] }), tr(902, { screenshots: plaatjes.slice(1, 8) }), tr(903)];
  await H.zaaiJournal(p, { trades: TRADES, pbook: H.PBOOK });
  await p.evaluate(([s, d]) => { const P = { v: 1, weeks: {}, days: {} };
    P.days[d] = { id: d, week: __tp3.isoWeek(d), layers: [], levels: '', emoties: [], dagstart: [], off: [], media: { imgs: [], links: [] }, les: '', scenarios: s, volgorde: [], eigen: false };
    localStorage.setItem('tp3:plans', JSON.stringify(P)); }, [[sc({ id: 's_x', title: 'BTC met charts', pb: 'Trend-pullback', media: { imgs: [], links: [TV] } }), sc({ id: 's_y', title: 'ETH zonder charts', pair: 'ETH' })], DAG]);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(400);
  const beeld = (doel, i) => p.evaluate(async ([doel, i]) => { const c = document.createElement('canvas'); c.width = 320; c.height = 180; const g = c.getContext('2d'); g.fillStyle = i ? '#3a7' : '#a37'; g.fillRect(0, 0, 320, 180);
    const bl = await new Promise(r => c.toBlob(r, 'image/png')); return __tp3.voegBeeldToe(new File([bl], 'c.png', { type: 'image/png' }), doel); }, [doel, i]);
  await beeld('scen:s_x', 0); await beeld('scen:s_x', 1);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(400);
  const planBeelden = await p.evaluate(() => __tp3.dayOf(__tp3.vandaag()).scenarios[0].media.imgs.map(id => __tp3.IMG[id]));

  console.log('--- 1a. het venster "Zet om in trade" zegt wat er meegaat ---');
  const meeRegel = () => p.evaluate(() => (document.querySelector('#modal .meeregel') || {}).textContent || '');
  await p.click('.ritem[data-s="s_x"] .rrow'); await p.click('.ritem[data-s="s_x"] [data-a="convert"]'); await p.waitForTimeout(100);
  for (const donker of [false, true]) for (const w of [1280, 390]) { await p.setViewportSize({ width: w, height: 900 }); await p.evaluate(d => { document.documentElement.dataset.theme = d ? 'dark' : 'light'; }, donker);
    await p.screenshot({ path: `${H.SHOTS}/ronde6-zetom-${donker ? 'donker' : 'licht'}-${w}.png` }); }
  await p.setViewportSize({ width: 1280, height: 900 }); await p.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
  ok('tab Uit je journal: "2 afbeeldingen en 1 link gaan mee naar de trade"', /^2 afbeeldingen en 1 link gaan mee naar de trade/.test(await meeRegel()), await meeRegel());
  await p.click('#modal [data-a="convWeg"][data-v="hand"]'); await p.waitForTimeout(80);
  ok('tab Nieuwe trade invullen: dezelfde regel', /^2 afbeeldingen en 1 link gaan mee naar de trade/.test(await meeRegel()), await meeRegel());
  await p.click('#modal [data-a="close"]');
  await p.click('.ritem[data-s="s_y"] .rrow'); await p.click('.ritem[data-s="s_y"] [data-a="convert"]'); await p.waitForTimeout(100);
  ok('scenario zonder beeld: "Geen afbeeldingen in dit scenario"', /^Geen afbeeldingen in dit scenario/.test(await meeRegel()), await meeRegel());
  await p.click('#modal [data-a="close"]');

  console.log('--- 1b. koppelen vanuit de journal: toevoegen, niets kwijt, geen dubbele ---');
  const j = await nieuw();
  await j.addInitScript(() => localStorage.setItem('sj_welcomed', 'true'));
  await j.goto(srv.APP, { waitUntil: 'load' }); await j.waitForTimeout(1200);
  const trade = id => j.evaluate(id => { const t = T.find(x => x.id === id); return { shots: t.screenshots || [], links: t.tvLinks || [], ref: t.planRef || '' }; }, id);
  const toastJ = () => j.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map(x => x.textContent).join(' | '));
  await j.evaluate(() => planSetRef(901, 's:s_x')); await j.waitForTimeout(600);
  let a = await trade(901);
  ok('de eigen screenshot blijft vooraan, de twee plan-afbeeldingen komen erbij', a.shots.length === 3 && a.shots[0] === plaatjes[0] && a.shots[1] === planBeelden[0] && a.shots[2] === planBeelden[1], JSON.stringify({ n: a.shots.length }));
  ok('de eigen link blijft, de plan-link komt erbij', JSON.stringify(a.links) === JSON.stringify([EIGEN_TV, TV]), JSON.stringify(a.links));
  ok('de toast zegt wat er mee kwam', /2 afbeeldingen en 1 link meegenomen/.test(await toastJ()), await toastJ());
  await j.evaluate(() => { planSetRef(901, 'none'); }); await j.waitForTimeout(200);
  await j.evaluate(() => { planSetRef(901, 's:s_x'); }); await j.waitForTimeout(600);
  a = await trade(901);
  ok('opnieuw koppelen aan hetzelfde scenario: geen dubbele', a.shots.length === 3 && a.links.length === 2, JSON.stringify({ n: a.shots.length, l: a.links.length }));
  await j.evaluate(() => { planSetRef(901, 'none'); }); await j.waitForTimeout(200);

  console.log('--- 1c. koppelen vanuit het plan, aan een trade die bijna vol zit ---');
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(600);
  await p.click('.ritem[data-s="s_x"] .rrow'); await p.click('.ritem[data-s="s_x"] [data-a="convert"]'); await p.waitForTimeout(100);
  await p.click('#modal [data-a="kandSel"][data-v="902"]'); await p.click('#modal [data-a="koppel"]'); await p.waitForTimeout(150);
  const toastP = await p.evaluate(() => (document.querySelector('.toast') || {}).textContent || '');
  ok('plan-toast: "1 van 2 afbeeldingen … de trade zat vol" en de link', /1 van 2 afbeeldingen/.test(toastP) && /zat vol/.test(toastP) && /1 link/.test(toastP), toastP);
  await j.reload({ waitUntil: 'load' }); await j.waitForTimeout(1500);
  const b2 = await trade(902);
  ok('in de journal: de zeven eigen screenshots onaangeroerd, één plan-afbeelding erbij, samen 8', b2.shots.length === 8 && plaatjes.slice(1, 8).every((u, i) => b2.shots[i] === u) && b2.shots[7] === planBeelden[0] && b2.ref === 's:s_x', JSON.stringify({ n: b2.shots.length, ref: b2.ref }));

  console.log('--- 1d. nieuwe trade invullen ---');
  await j.evaluate(d => localStorage.setItem('tp3:handoff', JSON.stringify({ sid: 's_x', day: d, ts: Date.now() })), DAG);
  await j.reload({ waitUntil: 'load' }); await j.waitForTimeout(1500);
  const f = await j.evaluate(() => ({ shots: formShots.length, eerste: formShots[0], links: formTvLinks.slice() }));
  ok('een nieuwe trade krijgt de afbeeldingen en de link van het scenario', f.shots === 2 && f.eerste === planBeelden[0] && JSON.stringify(f.links) === JSON.stringify([TV]), JSON.stringify({ ...f, eerste: (f.eerste || '').slice(0, 20) }));
  await j.close();

  ok('geen JS-fouten', errs.length === 0, errs.join(' | '));
  await b.close(); srv.close();
  process.exit(T.eind());
})();
