// TradingPlan v3, taak 7: Afsluiting, Log en blok D (besluiten 5, 19, 20, 21).
//  (a) Afsluiting opent op vandaag als er een plan is, anders op de laatste dag met plan; open scenario's sluit je
//      daar af met één tik; één veld "les"
//  (b) uitgekomen / genomen / gemist, binnen tegenover buiten plan in R én geld, uit de journal-trades via Scenario.trades
//  (c) Log: alle dagen, nieuwste boven, status-chips achteraf aan te tikken; filters status, playbook, richting;
//      "niets in beeld" als het filter niets overlaat; koppelen kan ook hier
//  (d) voorspel-score: "Je scenario's komen in X% uit. Daarvan neem je Y%. De gemiste waren samen +Z R."
// De vaste set (vandaag V, gisteren G):
//  V: s1 genomen [201: +2R/+$20] · s2 genomen [202: −1R, 203: +1R] · s3 gemist [204 gemist-trade +2R] ·
//     s4 gemist [205 gemist-trade +1,5R] · s5 niet · s6 open · s7 open (short)
//  G: s8 niet · s9 ongeldig · s10 genomen (nog niet gekoppeld)
//  Buiten plan op V: 206 (−1R/−$10), 207 (−2R/−$20); 208 is backtest en telt niet mee.
//  Alles: beslist 8, uitgekomen 5 (3 genomen + 2 gemist) → 63%; daarvan genomen 3/5 = 60%; gemist samen +3,5R.
const { chromium } = require('playwright');
const H = require('./helpers/plan3'); const NAAM = 'Plan v3 afsluiting';
const leeg = () => ({ imgs: [], links: [] });
const sc = (id, status, o) => Object.assign({ id, title: 'Scenario ' + id.slice(2), pair: 'BTC', dir: 'long', pb: 'Trend-pullback', grade: 'B', trigger: '', invalid: '', entry: { tf: '15M', bias: '', setups: [], confirmations: [] }, off: [], checked: [], stop: '', tps: [], media: leeg(), note: '', status, statusTs: status === 'open' ? null : 1, trades: [] }, o || {});

(async () => {
  const srv = await H.server(), T = H.teller(NAAM), ok = T.ok;
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await H.alleenLokaal(ctx);
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e).split('\n')[0])); p.on('dialog', d => d.accept());
  await p.goto(srv.TP, { waitUntil: 'load' });
  const V = await p.evaluate(() => __tp3.vandaag()), G = new Date(Date.parse(V + 'T12:00:00Z') - 864e5).toISOString().slice(0, 10);
  const tr = (id, dag, R, extra) => Object.assign({ id, pair: 'BTC/USDT', dir: 'long', kind: 'live', status: 'closed', entry: 100, stop: 99, size: 1000, exit: 100 + R, pnl: R * 10, r: 0, date: dag, time: '10:00', openTime: String(Date.parse(dag + 'T09:00:00Z')), layers: [], setup: 'Trend-pullback' }, extra || {});
  await H.zaaiJournal(p, { trades: [tr(201, V, 2), tr(202, V, -1), tr(203, V, 1), tr(204, V, 2, { kind: 'gemist', r: 2, pnl: 0 }), tr(205, V, 1.5, { kind: 'gemist', r: 1.5, pnl: 0 }), tr(206, V, -1), tr(207, V, -2, { dir: 'short', stop: 101, exit: 102 }), tr(208, V, 3, { kind: 'backtest', r: 3 })], pbook: H.PBOOK });
  const zaai = (dagen) => p.evaluate(dagen => { const P = { v: 1, weeks: {}, days: {} }; dagen.forEach(d => { P.days[d.id] = Object.assign({ week: __tp3.isoWeek(d.id), layers: [], levels: '', mental: null, pre: [false, false, false], media: { imgs: [], links: [] }, les: '' }, d); }); __tp3.save(P); }, dagen);
  const DAGEN = [
    { id: V, mental: 4, les: '', scenarios: [sc('s_1', 'genomen', { trades: [201] }), sc('s_2', 'genomen', { trades: [202, 203], pb: 'London SFP' }), sc('s_3', 'gemist', { trades: [204] }), sc('s_4', 'gemist', { trades: [205] }), sc('s_5', 'niet'), sc('s_6', 'open'), sc('s_7', 'open', { dir: 'short' })] },
    { id: G, mental: 2, les: 'Wacht de 15M-close af.', scenarios: [sc('s_8', 'niet'), sc('s_9', 'ongeldig', { dir: 'short' }), sc('s_10', 'genomen', { pb: 'London SFP' })] }];
  await zaai(DAGEN);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(500);
  const scen = id => p.evaluate(id => { for (const d of Object.values(__tp3.load().days)) { const s = d.scenarios.find(x => x.id === id); if (s) return s; } }, id);
  const tekst = () => p.evaluate(() => document.getElementById('app').innerText.replace(/\s+/g, ' '));

  console.log('--- (d) voorspel-score in de Log ---');
  await p.click('nav.tabs [data-v="log"]'); await p.waitForTimeout(150);
  const score = await p.evaluate(() => document.querySelector('#app .score').innerText.replace(/\s+/g, ' '));
  ok('"Je scenario\'s komen in 63% uit. Daarvan neem je 60%. De gemiste waren samen +3,5R."', /Je scenario's komen in 63% uit\. Daarvan neem je 60%\. De gemiste waren samen \+3,5R\./.test(score), score);
  ok('bovenaan de Log', await p.evaluate(() => { const s = document.querySelector('#app .score'), d = document.querySelector('#app .dayrow'); return s && d && s.getBoundingClientRect().top < d.getBoundingClientRect().top; }));
  ok('ongeldig telt als niet uitgekomen (besluit 19): 8 beslist, 2 open niet', await p.evaluate(() => { const x = __tp3.blokD(Object.values(__tp3.load().days)); return x.beslist === 8 && x.open === 2 && x.uit === 5 && x.niet === 2 && x.ong === 1; }));

  console.log('--- (c) Log ---');
  const dagen = await p.evaluate(() => [...document.querySelectorAll('#app .dayrow')].map(d => ({ id: d.dataset.d, chips: [...d.querySelectorAll('.schip')].map(c => c.dataset.s + ':' + [...c.classList].find(k => ['open', 'genomen', 'gemist', 'niet', 'ongeldig'].includes(k))) })));
  ok('alle dagen, nieuwste boven', dagen.map(d => d.id).join() === [V, G].join(), JSON.stringify(dagen.map(d => d.id)));
  ok('scenario\'s als gekleurde status-chips', dagen[0].chips.join() === 's_1:genomen,s_2:genomen,s_3:gemist,s_4:gemist,s_5:niet,s_6:open,s_7:open' && dagen[1].chips.join() === 's_8:niet,s_9:ongeldig,s_10:genomen', JSON.stringify(dagen));
  ok('chip met de R van de gekoppelde trades (s_2: −1 + 1 = 0,0R)', /\+0,0R|−0,0R|0,0R/.test(await p.evaluate(() => document.querySelector('#app .schip[data-s="s_2"]').textContent)), await p.evaluate(() => document.querySelector('#app .schip[data-s="s_2"]').textContent));
  ok('de les van gisteren staat erbij, mentaal 2/5', /Wacht de 15M-close af/.test(await tekst()) && /mentaal 2\/5/.test(await tekst()));
  await p.click('#app .schip[data-s="s_9"]'); await p.waitForTimeout(100);
  await p.click('#app .dayrow [data-a="status"][data-s="s_9"][data-v="niet"]'); await p.waitForTimeout(100);
  ok('achteraf aangetikt: s_9 ongeldig → niet uitgekomen, statusTs gezet', (await scen('s_9')).status === 'niet' && (await scen('s_9')).statusTs > 1e12);
  await p.click('#app .schip[data-s="s_10"]'); await p.waitForTimeout(100);
  await p.click('#app .dayrow [data-a="convert"][data-s="s_10"]'); await p.waitForTimeout(150);
  ok('koppelen kan ook vanuit de Log (kandidatenlijst van die dag)', await p.evaluate(G => /Koppel aan een trade uit je journal/.test(document.getElementById('modal').innerText) && document.getElementById('modal').innerText.includes(G.slice(8, 10).replace(/^0/, '') + '-'), G));
  await p.click('#modal [data-a="close"]'); await p.waitForTimeout(80);
  await p.click('#app [data-a="logF"][data-p="status"][data-v="gemist"]'); await p.waitForTimeout(100);
  ok('filter-pills in hun kleur: gemist amber, short rood, playbook accent', await p.evaluate(() => { const c = s => getComputedStyle(document.querySelector('#app [data-a="logF"]' + s)).getPropertyValue('--tc').trim(), t = k => getComputedStyle(document.documentElement).getPropertyValue(k).trim();
    return c('[data-v="gemist"]') === t('--amber') && c('[data-v="short"]') === t('--red') && c('[data-p="pb"]') === t('--accent'); }));
  ok('filter status gemist: alleen s_3 en s_4, gisteren valt weg', (await p.evaluate(() => [...document.querySelectorAll('#app .schip')].map(c => c.dataset.s))).join() === 's_3,s_4');
  await p.click('#app [data-a="logF"][data-p="status"][data-v="gemist"]'); await p.click('#app [data-a="logF"][data-p="pb"][data-v="London SFP"]'); await p.waitForTimeout(100);
  ok('filter playbook London SFP: s_2 en s_10', (await p.evaluate(() => [...document.querySelectorAll('#app .schip')].map(c => c.dataset.s))).join() === 's_2,s_10');
  await p.click('#app [data-a="logF"][data-p="pb"][data-v="London SFP"]'); await p.click('#app [data-a="logF"][data-p="dir"][data-v="short"]'); await p.waitForTimeout(100);
  ok('filter richting short: s_7 en s_9', (await p.evaluate(() => [...document.querySelectorAll('#app .schip')].map(c => c.dataset.s))).join() === 's_7,s_9');
  await p.click('#app [data-a="logF"][data-p="status"][data-v="gemist"]'); await p.waitForTimeout(100);
  ok('niets over: "Niets in beeld met deze filters" (geen lege-log-melding)', /Niets in beeld met deze filters/.test(await tekst()) && !/Nog geen dagen/.test(await tekst()));
  await p.click('#app [data-a="logReset"]'); await p.waitForTimeout(100);
  ok('wis filters: alles weer in beeld', (await p.evaluate(() => document.querySelectorAll('#app .schip').length)) === 10);
  await H.vierShots(p, 'log', async q => { await q.click('nav.tabs [data-v="log"]'); await q.waitForTimeout(150); });

  console.log('--- (a)+(b) Afsluiting ---');
  await p.click('nav.tabs [data-v="afsluiting"]'); await p.waitForTimeout(150);
  ok('opent op vandaag (er is een plan voor vandaag)', await p.evaluate(V => document.querySelector('#app [data-a="afslDag"].on').dataset.v === V, V));
  let t = await tekst();
  ok('uitgekomen 4 van 7, genomen 2, gemist 2 (samen +3,5R)', /Uitgekomen 4 \/ 7/.test(t) && /Genomen 2/.test(t) && /Gemist 2/.test(t) && /samen \+3,5R/.test(t), t.slice(0, 400));
  ok("binnen plan: 3 trades, +2,0R, +$20", /Binnen plan\s*3 trades/i.test(t) && /\+2,0R/.test(t) && /\+\$20/.test(t), t.match(/Binnen plan[^|]{0,80}/));
  ok('buiten plan in R én geld: "Buiten plan kostte je vandaag −3,0R (−$30)" (backtest telt niet mee)', /Buiten plan kostte je vandaag −3,0R \(−\$30\)/.test(t), (t.match(/Buiten plan kostte[^.]*/) || [''])[0]);
  const open = await p.evaluate(() => [...document.querySelectorAll('#app .afopen [data-s]')].map(x => x.dataset.s).filter((v, i, a) => a.indexOf(v) === i));
  ok('open scenario\'s staan apart om af te sluiten (s_6, s_7)', open.join() === 's_6,s_7', open.join());
  await p.click('#app .afopen [data-a="status"][data-s="s_6"][data-v="gemist"]'); await p.waitForTimeout(100);
  ok('één tik sluit af: s_6 gemist', (await scen('s_6')).status === 'gemist' && (await p.evaluate(() => [...document.querySelectorAll('#app .afopen [data-s]')].map(x => x.dataset.s).filter((v, i, a) => a.indexOf(v) === i))).join() === 's_7');
  await p.fill('#af-les', 'Twee trades buiten plan na de eerste winst. Niet doen.'); await p.waitForTimeout(80);
  ok('les van de dag bewaard', await p.evaluate(V => /buiten plan na de eerste winst/.test(__tp3.load().days[V].les), V));
  await H.vierShots(p, 'afsluiting', async q => { await q.click('nav.tabs [data-v="afsluiting"]'); await q.waitForTimeout(150); });
  await p.click('nav.tabs [data-v="afsluiting"]'); await p.click('#app [data-a="afslDag"][data-v="' + G + '"]'); await p.waitForTimeout(100);
  t = await tekst();
  ok('gisteren: geen trades buiten plan, één genomen zonder trade met "koppel"-knop', /Geen trades buiten plan/.test(t) && await p.evaluate(() => !!document.querySelector('#app [data-a="convert"][data-s="s_10"]')), t.slice(0, 300));
  await p.click('#app [data-a="afsl"][data-v="week"]'); await p.waitForTimeout(100);
  await p.fill('#af-les', 'Weekles'); await p.waitForTimeout(80);
  ok('week-afsluiting: les bewaard in het weekplan (ook zonder weekplan)', await p.evaluate(V => __tp3.load().weeks[__tp3.isoWeek(V)].les === 'Weekles', V));

  console.log('--- (a) zonder plan vandaag ---');
  await p.evaluate(V => { const P = __tp3.load(); delete P.days[V]; __tp3.save(P); }, V);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(300);
  await p.click('nav.tabs [data-v="afsluiting"]'); await p.waitForTimeout(100);
  ok('geen plan vandaag → opent op de laatste dag met plan (gisteren)', await p.evaluate(G => document.querySelector('#app [data-a="afslDag"].on').dataset.v === G, G));
  await zaai([]); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(300);
  await p.click('nav.tabs [data-v="afsluiting"]'); await p.waitForTimeout(100);
  ok('nog geen enkel plan: lege staat met de volgende stap', /Nog niets af te sluiten/.test(await tekst()) && /Dag/.test(await tekst()));
  await p.click('nav.tabs [data-v="log"]'); await p.waitForTimeout(100);
  ok('Log zonder dagen: "Nog geen dagen in je log"', /Nog geen dagen in je log/.test(await tekst()));
  await H.zaaiJournal(p, { trades: [], pbook: {} }); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(300);
  ok('nieuw lid (geen trades, geen playbooks, geen plannen): geen fout', errs.length === 0);

  ok('geen JS-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close(); srv.close(); process.exit(T.eind());
})();
