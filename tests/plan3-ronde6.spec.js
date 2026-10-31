// TradingPlan v3 ronde 6 (docs/plan-v3-ronde6-2026-10-31.md): het scenario-venster.
//  1. Afbeeldingen en links bij "Zet om in trade": een nieuwe trade krijgt ze; koppelen aan een trade die al
//     screenshots heeft houdt die en voegt de plan-afbeeldingen toe (geen dubbele, hooguit 8); opnieuw koppelen voegt
//     niets nog eens toe; past niet alles, dan zegt de toast het. Het venster "Zet om in trade" zegt wat er meegaat.
//  2. Het scenario-venster: ± 1000 breed, links het formulier (vaste volgorde), rechts sticky playbook en context
//     (criteria als lijst met "verplicht"-badges, "Niet als" per regel in amber, Target en Min R:R, lagen met entry-
//     tijdframe, edge). Zonder playbook een lege staat. Lange criteria: Annuleer/Bewaar blijven zichtbaar. 390: één kolom.
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

  console.log('--- 2. het scenario-venster ---');
  const PB8 = Object.assign({}, H.PBOOK, { 'Trend-pullback': Object.assign({}, H.PBOOK['Trend-pullback'], {
    criteria: ['HTF-trend mee', 'Liquidity gepakt boven de Asia-high of onder de Asia-low, met een duidelijke wick en een close terug binnen de range', 'Pullback naar 50%', 'FVG op de 15M', 'Geen nieuws binnen 30 min', 'London of NY open', 'R:R minstens 2', 'Volume boven gemiddeld']
      .map((text, i) => ({ text, mandatory: i < 3 })), antiCriteria: ['Vlak voor nieuws', 'Na drie verliezers op een dag', 'Tegen de daily bias'].map(text => ({ text, mandatory: true })), stop: 'Onder de sweep', target: '2R', minRR: '2' }) });
  await H.zaaiJournal(p, { trades: TRADES, pbook: PB8 }); await p.setViewportSize({ width: 1280, height: 900 }); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(500);
  const venster = () => p.evaluate(() => { const m = document.querySelector('#modal .modal'), vorm = m && m.querySelector('.scenvorm'), zij = m && m.querySelector('.scenzij'), r = e => e && e.getBoundingClientRect();
    const ids = ['sc-title', 'sc-pb', 'sc-pair', 'sc-dir', 'sc-grade', 'sc-trig', 'sc-inv', 'sc-stop', 'sc-tps', 'sc-note'].map(id => document.getElementById(id));
    const volg = ids.every(Boolean) && ids.every((e, i) => !i || (ids[i - 1].compareDocumentPosition(e) & 4)) && ids.every(e => vorm && vorm.contains(e));
    const crit = zij ? [...zij.querySelectorAll('.crit')] : [], tops = crit.map(c => Math.round(c.getBoundingClientRect().top));
    const badges = zij ? [...zij.querySelectorAll('.crit .verplicht')] : [];
    return { w: m ? Math.round(r(m).width) : 0, kol: !!vorm && !!zij && r(zij).left >= r(vorm).right - 1, onder: !!vorm && !!zij && r(zij).top >= r(vorm).bottom - 1, sticky: zij ? getComputedStyle(zij).position : '',
      volg, crit: crit.length, eigenRegel: new Set(tops).size === tops.length, badges: badges.length, badgeRechts: badges.every(b => r(b.closest('.crit')).right - r(b).right < 16),
      anti: zij ? zij.querySelectorAll('.anti').length : 0, antiAmber: zij ? [...zij.querySelectorAll('.anti')].every(a => getComputedStyle(a).color === getComputedStyle(document.querySelector('.anti')).color) : false,
      kgetal: zij ? [...zij.querySelectorAll('.kgetal')].map(k => k.textContent.replace(/\s+/g, ' ').trim()) : [], tf: !!(zij && zij.querySelector('#sc-tf')), lagen: !!(zij && zij.querySelector('.lagen')),
      edge: !!(zij && /Edge van deze combinatie/.test(zij.textContent)), leeg: zij ? zij.textContent : '', titel: (m && m.querySelector('.mh') || {}).textContent || '' }; });
  await p.click('[data-a="newScen"]'); await p.waitForTimeout(150);
  let v = await venster();
  ok('1280: het venster is ± 1000 breed, twee kolommen', v.w >= 940 && v.w <= 1010 && v.kol, JSON.stringify({ w: v.w, kol: v.kol }));
  ok('links het formulier in de volgorde Titel, Playbook, Pair, Richting, Grade, Trigger, Ongeldig als, Stop, TP\'s, Notitie', v.volg);
  ok('rechts sticky', v.sticky === 'sticky', v.sticky);
  ok('zonder playbook: rechts een lege staat "Kies een playbook om de criteria te zien", lagen en entry-tijdframe wel', /Kies een playbook om de criteria te zien/.test(v.leeg) && v.crit === 0 && v.tf && v.lagen, v.leeg.slice(0, 120));
  await p.selectOption('#sc-pb', 'Trend-pullback'); await p.waitForTimeout(150);
  v = await venster();
  ok('playbook gekozen: 8 criteria als lijst, elk op een eigen regel', v.crit === 8 && v.eigenRegel, JSON.stringify({ crit: v.crit, eigen: v.eigenRegel }));
  ok('"verplicht" als badge rechts, bij de drie verplichte', v.badges === 3 && v.badgeRechts, JSON.stringify({ b: v.badges, r: v.badgeRechts }));
  ok('"Niet als": elke regel apart, in amber', v.anti === 3 && v.antiAmber, String(v.anti));
  ok('Target en Min R:R als twee kengetallen', v.kgetal.length === 2 && /Target 2R/.test(v.kgetal[0]) && /Min\. R:R 2/.test(v.kgetal[1]), JSON.stringify(v.kgetal));
  ok('rechts ook de lagen met het entry-tijdframe en de edge van deze combinatie', v.tf && v.lagen && v.edge);
  ok('dezelfde lijst als in het opengeklapte scenario (zelfde klasse, zelfde badge)', await p.evaluate(() => { const c = document.querySelector('#modal .scenzij .crit'); return !!c && c.classList.contains('chk') && !c.hasAttribute('data-a'); }));
  const voet = await p.evaluate(() => { const b = document.querySelector('#modal [data-a="saveScen"]'), r = b.getBoundingClientRect(), el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { zicht: r.bottom <= innerHeight + 1 && r.top >= 0, bovenop: el === b || b.contains(el) }; });
  ok('lange criteria: Bewaar staat zichtbaar onderaan en niets ligt eroverheen', voet.zicht && voet.bovenop, JSON.stringify(voet));
  await p.evaluate(() => { const m = document.querySelector('#modal .modal'); m.scrollTop = m.scrollHeight; }); await p.waitForTimeout(80);
  const voet2 = await p.evaluate(() => { const b = document.querySelector('#modal [data-a="saveScen"]'), r = b.getBoundingClientRect(), el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return el === b || b.contains(el); });
  ok('ook helemaal gescrold: Bewaar bovenop', voet2);
  await p.click('#modal [data-a="close"]'); await p.waitForTimeout(80);
  await p.click('.ritem[data-s="s_x"] .rrow').catch(() => {}); await p.evaluate(() => { if (!document.querySelector('.ritem[data-s="s_x"] .rdetail')) document.querySelector('.ritem[data-s="s_x"] .rrow').click(); });
  await p.click('.ritem[data-s="s_x"] .rtools [data-a="editScen"]'); await p.waitForTimeout(150);
  v = await venster();
  ok('bewerken: hetzelfde venster (breed, twee kolommen, criteria als lijst)', /Scenario bewerken/.test(v.titel) && v.w >= 940 && v.kol && v.crit === 8, JSON.stringify({ t: v.titel, w: v.w, crit: v.crit }));
  await p.click('#modal [data-a="close"]');
  await p.setViewportSize({ width: 390, height: 860 }); await p.waitForTimeout(150);
  await p.click('[data-a="newScen"]'); await p.selectOption('#sc-pb', 'Trend-pullback'); await p.waitForTimeout(150);
  v = await venster();
  ok('390: één kolom, playbook en context onder het formulier', v.onder && !v.kol, JSON.stringify({ onder: v.onder, kol: v.kol }));
  ok('390: geen horizontale scroll in het venster', await p.evaluate(() => { const m = document.querySelector('#modal .modal'); return m.scrollWidth <= m.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1; }));
  await p.click('#modal [data-a="close"]'); await p.setViewportSize({ width: 1280, height: 900 });

  console.log('--- screenshots van het venster ---');
  const VENSTER = async (naam, open) => { for (const donker of [false, true]) { await H.thema(p, donker); for (const w of [1280, 390]) { await p.setViewportSize({ width: w, height: 900 }); await p.waitForTimeout(120); await open();
    await p.waitForTimeout(150); await p.screenshot({ path: `${H.SHOTS}/ronde6-${naam}-${donker ? 'donker' : 'licht'}-${w}.png` }); await p.keyboard.press('Escape'); await p.waitForTimeout(80); } } await p.setViewportSize({ width: 1280, height: 900 }); await H.thema(p, false); };
  await VENSTER('venster-leeg', async () => { await p.click('[data-a="newScen"]'); });
  await VENSTER('venster-playbook', async () => { await p.click('[data-a="newScen"]'); await p.selectOption('#sc-pb', 'Trend-pullback'); });
  await VENSTER('venster-bewerken', async () => { await p.evaluate(() => { const r = document.querySelector('.ritem[data-s="s_x"] .rrow'); if (!document.querySelector('.ritem[data-s="s_x"] .rdetail')) r.click(); }); await p.waitForTimeout(80); await p.click('.ritem[data-s="s_x"] .rtools [data-a="editScen"]'); });

  ok('geen JS-fouten', errs.length === 0, errs.join(' | '));
  await b.close(); srv.close();
  process.exit(T.eind());
})();
