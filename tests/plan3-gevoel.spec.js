// TradingPlan v3, ronde 3 punt 4+5: mentaal (1–5) wordt emoties uit de journal, en dat wordt data.
//  - de trechter-stap "Gevoel": emoties uit tagConfig.emotionTags als pills in de journal-kleur (negatief rood, positief groen)
//  - Day.emoties; oude dagen met Day.mental tonen "mentaal 4/5 (oud)"; minstens één negatieve emotie → "Overweeg alleen A-setups"
//  - journal → plan: per gekozen emotie één regel over de trades met die emotie (live, gesloten; R alleen mét stop)
//  - plan → statistiek: "Je dagstart-gevoel" in de Log en in Tendencies → Plan (per ochtend-emotie, slechtste gem. R boven)
//  - Afsluiting, Log-dagkop, Mori's dagplanpakket en coachPlanRegels: emoties in plaats van het cijfer
//  - de ochtend-emotie wordt niet naar trades gekopieerd
const { chromium } = require('playwright'); const path = require('path');
const H = require('./helpers/plan3'); const SHOTS = H.SHOTS;
const NAAM = 'Plan v3 gevoel';
const TAGS = { setupTags: ['BOS'], confirmationTags: ['OB'], timeframeTags: ['15M', '1H', '4H'], emotionTags: ['FOMO', 'Twijfel', 'Rustig', 'Geduldig'], emotionNeg: ['FOMO', 'Twijfel'], mistakeTags: [], missedReasonTags: [], customTags: [] };
// Een live-trade op een Amsterdamse dag (12:00 UTC = 13/14 uur Amsterdam). entry 100, stop 99, size 1000 → 1R = $10.
let _id = 0;
const tr = (dag, pnl, o = {}) => Object.assign({ id: 'g' + (++_id), pair: 'BTC/USDT', dir: 'long', kind: 'live', status: 'closed', openTime: Date.parse(dag + 'T12:00:00Z'), date: dag, time: '14:00',
  entry: 100, stop: 99, size: 1000, pnl, emotions: [] }, o);
const TRADES = [
  // journal → plan: FOMO 12 trades mét stop (4 × +1R, 8 × −1R) + 1 zonder stop (+$5) = 13 trades, 5 winst; een backtest en een open trade tellen niet
  ...[1, 2, 3, 4].map(i => tr('2026-09-0' + i, 10, { emotions: ['FOMO'] })), ...[5, 6, 7, 8, 9, 10, 11, 12].map(i => tr('2026-09-' + String(i).padStart(2, '0'), -10, { emotions: ['FOMO', 'Gehaast'] })),
  tr('2026-09-13', 5, { emotions: ['FOMO'], stop: 0 }), tr('2026-09-14', 10, { emotions: ['FOMO'], kind: 'backtest' }), tr('2026-09-15', 0, { emotions: ['FOMO'], status: 'open' }),
  // Twijfel: 3 trades (1 winst) → weinig data
  tr('2026-09-16', 10, { emotion: 'Twijfel' }), tr('2026-09-17', -10, { emotions: ['Twijfel'] }), tr('2026-09-18', -10, { emotions: ['Twijfel'] }),
  // plan → statistiek: trades op de plan-dagen (zonder emotie: de ochtend-emotie is iets anders)
  tr('2026-10-20', 10, { id: 'ta1' }), tr('2026-10-20', -10), tr('2026-10-21', -10), tr('2026-10-21', -10), tr('2026-10-22', 10),
];
const sc = (id, status, trades = []) => ({ id, title: id, pair: 'BTC', dir: 'long', pb: '', grade: 'B', trigger: '', invalid: '', entry: { tf: '15M', bias: '', setups: [], confirmations: [] }, off: [], checked: [], critChecked: [], stop: '', tps: [], media: { imgs: [], links: [] }, note: '', status, statusTs: status === 'open' ? null : 1, trades });
const dagP = (id, o) => Object.assign({ id, layers: [], levels: '', dagstart: [], emoties: [], media: { imgs: [], links: [] }, les: '', scenarios: [] }, o);

(async () => {
  const srv = await H.server(), { TP, APP } = srv, T = H.teller(NAAM), ok = T.ok;
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await H.alleenLokaal(ctx);
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
  await p.addInitScript(t => { localStorage.setItem('sj_tagconfig', JSON.stringify(t)); localStorage.setItem('sj_welcomed', 'true'); }, TAGS);
  await p.goto(TP, { waitUntil: 'load' }); await p.waitForTimeout(300);
  await H.zaaiJournal(p, { trades: TRADES, pbook: {} });
  const PLAN = { v: 1, weeks: {}, days: {
    '2026-10-20': dagP('2026-10-20', { emoties: ['Twijfel'], scenarios: [sc('s_a1', 'genomen', ['ta1']), sc('s_a2', 'niet')] }),
    '2026-10-21': dagP('2026-10-21', { emoties: ['Twijfel', 'Rustig'], scenarios: [sc('s_b1', 'gemist')] }),
    '2026-10-22': dagP('2026-10-22', { emoties: ['Rustig'] }),
    '2026-10-19': { id: '2026-10-19', layers: [], levels: '', mental: 4, pre: [true, false, false], media: { imgs: [], links: [] }, les: '', scenarios: [sc('s_o', 'niet')] } } };
  await p.evaluate(P => localStorage.setItem('tp3:plans', JSON.stringify(P)), PLAN);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(500);
  await p.click('[data-a="maakDag"]'); await p.waitForTimeout(200);
  const dag = () => p.evaluate(() => __tp3.dayOf(__tp3.vandaag()));
  const stap = () => p.evaluate(() => { const s = [...document.querySelectorAll('.funnel .fstep')].find(x => /^Gevoel/.test(x.querySelector('h3').textContent.trim())); return s ? { txt: s.innerText, regels: [...s.querySelectorAll('.emoregel')].map(r => ({ t: r.textContent.trim(), grijs: r.classList.contains('weinig') })) } : null; });

  console.log('--- kiezen ---');
  ok('de stap heet "Gevoel"; geen cijfers 1–5 meer', !!(await stap()) && await p.evaluate(() => !document.querySelector('.mental,[data-a="mental"]')));
  const pills = await p.evaluate(() => { const tok = v => { const e = document.createElement('i'); e.style.color = `var(${v})`; document.body.appendChild(e); const c = getComputedStyle(e).color; e.remove(); return c; };
    return { tags: [...document.querySelectorAll('.funnel [data-a="emo"]')].map(x => x.dataset.v), fomo: getComputedStyle(document.querySelector('[data-a="emo"][data-v="FOMO"]')).color, rustig: getComputedStyle(document.querySelector('[data-a="emo"][data-v="Rustig"]')).color, red: tok('--red'), green: tok('--green') }; });
  ok('de emoties uit tagConfig.emotionTags, op volgorde', pills.tags.join() === 'FOMO,Twijfel,Rustig,Geduldig', pills.tags.join());
  ok('negatief rood (FOMO), positief groen (Rustig), zoals tagKleur in de journal', pills.fomo === pills.red && pills.rustig === pills.green, JSON.stringify(pills));
  ok('nog niets gekozen: geen waarschuwing', !/Overweeg alleen A-setups/.test(await p.evaluate(() => document.getElementById('app').innerText)));
  await p.click('[data-a="emo"][data-v="FOMO"]'); await p.waitForTimeout(100);
  ok('FOMO gekozen: Day.emoties ["FOMO"], geen Day.mental', JSON.stringify((await dag()).emoties) === '["FOMO"]' && (await dag()).mental == null);
  ok('minstens één negatieve emotie → "Overweeg alleen A-setups"', await p.evaluate(() => /Overweeg alleen A-setups/.test(document.querySelector('#app .mentwarn') ? document.querySelector('#app .mentwarn').textContent : '')));
  let st = await stap();
  ok('journal → plan: "Met FOMO: 13 trades · 38% · −0,33R" (R alleen mét stop; backtest en open niet)', st.regels.length === 1 && st.regels[0].t === 'Met FOMO: 13 trades · 38% · −0,33R' && !st.regels[0].grijs, JSON.stringify(st.regels));
  await p.click('[data-a="emo"][data-v="Twijfel"]'); await p.click('[data-a="emo"][data-v="Rustig"]'); await p.waitForTimeout(100);
  st = await stap();
  ok('meerdere mogen: FOMO, Twijfel, Rustig', JSON.stringify((await dag()).emoties) === '["FOMO","Twijfel","Rustig"]');
  ok('onder 10 trades grijs met "weinig data" (Twijfel, ook t.emotion telt)', st.regels[1] && st.regels[1].t === 'Met Twijfel: 3 trades · 33% · −0,33R · weinig data' && st.regels[1].grijs, JSON.stringify(st.regels[1]));
  ok('geen trades: "Nog geen trades met Rustig."', st.regels[2] && st.regels[2].t === 'Nog geen trades met Rustig.', JSON.stringify(st.regels[2]));
  await p.click('[data-a="emo"][data-v="FOMO"]'); await p.click('[data-a="emo"][data-v="Twijfel"]'); await p.waitForTimeout(100);
  ok('alleen een positieve emotie: geen waarschuwing', !/Overweeg alleen A-setups/.test(await p.evaluate(() => document.getElementById('app').innerText)));
  ok('de ochtend-emotie komt niet op trades (IndexedDB onveranderd)', await p.evaluate(() => new Promise(res => { const r = indexedDB.open('sj_db', 1); r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').get('trades'); q.onsuccess = () => { r.result.close(); res(q.result.every(t => !(t.emotions || []).includes('Rustig'))); }; }; })));

  console.log('--- Log en Afsluiting ---');
  await p.click('[data-a="emo"][data-v="Rustig"]'); await p.waitForTimeout(80);   // vandaag weer leeg: de statistiek gaat over de oude dagen
  await p.click('nav.tabs [data-v="log"]'); await p.waitForTimeout(150);
  const log = await p.evaluate(() => { const k = document.querySelector('#app .gevoel'); return { kop: k ? k.querySelector('h3').textContent : '', regels: k ? [...k.querySelectorAll('.gvrij')].map(r => ({ t: r.querySelector('.gvtxt').textContent.replace(/\s+/g, ' ').trim(), grijs: r.classList.contains('weinig'), rel: (r.querySelector('.rel') || {}).textContent })) : [],
    dagkop: Object.fromEntries([...document.querySelectorAll('#app .dayrow')].map(r => [r.dataset.d, r.querySelector('.dayhead').innerText.replace(/\s+/g, ' ')])) }; });
  ok('Log: blok "Je dagstart-gevoel"', /Je dagstart-gevoel/.test(log.kop), log.kop);
  ok('Twijfel: "Dagen die je met Twijfel begon: 2 dagen · 4 trades · 25% · −0,50R · 3 buiten plan · scenario\'s 67% uit"', log.regels[0] && log.regels[0].t === "Dagen die je met Twijfel begon: 2 dagen · 4 trades · 25% · −0,50R · 3 buiten plan · scenario's 67% uit", JSON.stringify(log.regels));
  ok('Rustig daaronder (−0,33R): slechtste gem. R bovenaan', log.regels[1] && log.regels[1].t === "Dagen die je met Rustig begon: 2 dagen · 3 trades · 33% · −0,33R · 3 buiten plan · scenario's 100% uit", JSON.stringify(log.regels[1]));
  ok('onder 10 dagen: grijs, "weinig data"', log.regels.length === 2 && log.regels.every(r => r.grijs && /weinig/.test(r.rel)), JSON.stringify(log.regels));
  ok('Log-dagkop: de emoties van de dag', /Twijfel · Rustig/.test(log.dagkop['2026-10-21'] || ''), log.dagkop['2026-10-21']);
  ok('Log-dagkop van een oude dag: "mentaal 4/5 (oud)"', /mentaal 4\/5 \(oud\)/.test(log.dagkop['2026-10-19'] || ''), log.dagkop['2026-10-19']);
  ok('Log-dagkop: geen "mentaal –/5" op een nieuwe dag', !Object.values(log.dagkop).some(t => /mentaal –/.test(t)));
  await p.click('nav.tabs [data-v="afsluiting"]'); await p.click('#app [data-a="afslDag"][data-v="2026-10-21"]'); await p.waitForTimeout(100);
  ok('Afsluiting: "Gevoel bij de dagstart: Twijfel · Rustig"', /Gevoel bij de dagstart: Twijfel · Rustig/.test(await p.evaluate(() => document.getElementById('app').innerText)));
  await p.click('nav.tabs [data-v="log"]'); await p.waitForTimeout(80);
  await H.vierShots(p, 'gevoel-log', async q => { await q.click('nav.tabs [data-v="log"]'); await q.waitForTimeout(120); });

  console.log('--- journal: Tendencies → Plan, Mori ---');
  const j = await ctx.newPage(); j.on('pageerror', e => errs.push('journal: ' + String(e).split('\n')[0]));
  await j.goto(APP, { waitUntil: 'load' }); await j.waitForTimeout(1500);
  await j.evaluate(() => { STATE.tend = 'plan'; go('tendencies'); }); await j.waitForTimeout(400);
  const tend = await j.evaluate(() => document.getElementById('main').innerText.replace(/\s+/g, ' '));
  ok('Tendencies → Plan: "Je dagstart-gevoel" met dezelfde regels', /Je dagstart-gevoel/i.test(tend) && /Dagen die je met Twijfel begon: 2 dagen · 4 trades · 25% · −0,50R · 3 buiten plan · scenario's 67% uit/.test(tend), tend.slice(tend.search(/dagstart-gevoel/i), tend.search(/dagstart-gevoel/i) + 300));
  const pk = await j.evaluate(() => { const P = planLoad(), day = Object.assign({}, P.plans.days['2026-10-20'], { emoties: ['FOMO', 'Twijfel'] });
    return { dag: coachDagplanDeel([], { plan: { day, week: null, edge: null } }).join('\n'), regels: coachPlanRegels('long', '2026-10-21').join('\n'), oud: coachPlanRegels('long', '2026-10-19').join('\n') }; });
  ok('Mori-dagplanpakket: de gekozen emoties, met kant', /Gevoel bij de dagstart: FOMO \(negatief\), Twijfel \(negatief\)/.test(pk.dag) && !/Mentaal/.test(pk.dag), pk.dag);
  ok('…en per emotie de regel uit de journal', /Met FOMO: 13 trades · 38% · −0,33R/.test(pk.dag) && /Met Twijfel: 3 trades · 33% · −0,33R · weinig data/.test(pk.dag), pk.dag);
  ok('…en de regel uit het plan als er data is (Twijfel), niet zonder (FOMO)', /Dagen die je met Twijfel begon: 2 dagen · 4 trades/.test(pk.dag) && !/Dagen die je met FOMO begon/.test(pk.dag), pk.dag);
  ok('coachPlanRegels: emoties in plaats van het cijfer; oude dag "mentaal 4/5 (oud)"', /Gevoel bij de dagstart: Twijfel \(negatief\), Rustig \(positief\)/.test(pk.regels) && /mentaal 4\/5 \(oud\)/i.test(pk.oud), pk.regels + ' || ' + pk.oud);
  ok('Mori-opdracht voor het dagplan noemt het gevoel, niet de mentale score', await j.evaluate(() => { const o = AI_PLAN_KNOPPEN.find(x => x[0] === 'plan-dag')[2]; return /gevoel/.test(o) && !/mentale score/.test(o); }));
  await j.close();

  console.log('--- lege staten ---');
  await p.evaluate(() => { const P = __tp3.load(); Object.values(P.days).forEach(d => { d.emoties = []; }); __tp3.save(P); __tp3.render(); });
  await p.click('nav.tabs [data-v="log"]'); await p.waitForTimeout(100);
  ok('Log zonder dagstart-gevoel: "Kies een paar dagen je gevoel bij de dagstart, …"', /Kies een paar dagen je gevoel bij de dagstart, dan zie je hier wat het met je trades doet\./.test(await p.evaluate(() => document.querySelector('#app .gevoel').innerText)));
  await p.evaluate(t => { t.emotionTags = []; localStorage.setItem('sj_tagconfig', JSON.stringify(t)); }, TAGS);
  await p.click('nav.tabs [data-v="dag"]'); await p.waitForTimeout(100);
  ok('geen emoties in de journal: één regel met de link naar Instellingen → Tags', await p.evaluate(() => { const s = document.querySelector('.funnel .geentags'); return !!s && /Nog geen emoties/.test(s.textContent) && !!s.querySelector('a[href$="?page=instellingen&tab=tags"]'); }));
  await p.evaluate(t => localStorage.setItem('sj_tagconfig', JSON.stringify(t)), TAGS);
  await p.evaluate(() => { const P = __tp3.load(); P.days[__tp3.vandaag()].emoties = ['FOMO', 'Rustig']; __tp3.save(P); });
  const scroll = await H.vierShots(p, 'gevoel-dag', async q => { if (q.viewportSize().width < 800) await q.click('[data-a="ctx"]').catch(() => {}); await q.waitForTimeout(80); });
  ok('390 breed: geen horizontale scroll', !scroll.licht && !scroll.donker, JSON.stringify(scroll));

  ok('geen JS-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close(); srv.close(); process.exit(T.eind());
})();
