// TradingPlan v3, taak 8: de journal na het opruimen van de poort.
//  (a) Tendencies → Plan toont blok D op scenario's (binnen/buiten plan, voorspel-score), met een lege staat zonder plannen
//  (b) coachPlanRegels (Mori) leest het weekplan uit tp3:plans (focus, no-trade) en het risico per grade
//  (c) export bevat tradingplan met tp3:plans, tp3:cfg en de plaatjes; importeren zet ze terug, ook in IndexedDB tp3;
//      het export-overzicht telt "N plannen · M scenario's · K afbeeldingen"
//  (d) geen poort-tekst in de trade-details; geen "dekt poort-punt" bij playbook-criteria (de data mag blijven)
const { chromium } = require('playwright');
const H = require('./helpers/plan3'); const NAAM = 'Plan v3 journal';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

(async () => {
  const srv = await H.server(), T = H.teller(NAAM), ok = T.ok;
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await H.alleenLokaal(ctx);
  const j = await ctx.newPage(); j.on('pageerror', e => errs.push(String(e).split('\n')[0])); j.on('dialog', d => d.accept());
  await j.addInitScript(() => localStorage.setItem('sj_welcomed', 'true'));
  await j.goto(srv.APP, { waitUntil: 'load' }); await j.waitForTimeout(1200);
  const V = await j.evaluate(() => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Amsterdam' }).format(new Date()));
  const tr = (id, R, extra) => Object.assign({ id, exchange: 'okx', status: 'closed', kind: 'live', pair: 'BTC/USDT', dir: 'long', entry: 100, stop: 99, size: 1000, exit: 100 + R, pnl: R * 10, r: 0, fees: 0, date: V, time: '10:10', openTime: String(Date.parse(V + 'T09:10:00Z')), closeTime: '', tps: [], tags: [], layers: [], screenshots: [], tvLinks: [], notes: '', setup: 'London SFP', grade: 'A' }, extra || {});

  console.log('--- (a) Tendencies → Plan ---');
  await j.evaluate(t => { T = t; TRASH = []; PBOOK['London SFP'] = pbNormalize('London SFP', { criteria: [{ text: 'Sweep', mandatory: true, covers: 'trigger' }] }); persistPbook(); persist(); }, [tr(1, 2), tr(2, -1), tr(3, -1), tr(4, 1.5, { kind: 'gemist', r: 1.5, pnl: 0 }), tr(5, -2), tr(6, 3, { date: '2025-01-02', openTime: String(Date.parse('2025-01-02T09:00:00Z')) })]);
  const tend = () => j.evaluate(() => { STATE.tend = 'plan'; go('tendencies'); return document.getElementById('content') ? document.getElementById('content').innerText.replace(/\s+/g, ' ') : document.body.innerText.replace(/\s+/g, ' '); });
  let t = await tend();
  ok('zonder plannen: lege staat met de volgende stap (Plan openen)', /Nog geen scenario's uit TradingPlan/.test(t) && /Open Plan/.test(t), t.slice(0, 300));
  ok('geen poort-tekst meer in Tendencies', !/poort/i.test(t));
  const sc = (id, status, trades, o) => Object.assign({ id, title: 'S ' + id, pair: 'BTC', dir: 'long', pb: 'London SFP', grade: 'A', trigger: '', invalid: '', entry: { tf: '15M', bias: '', setups: [], confirmations: [] }, off: [], checked: [], stop: '', tps: [], media: { imgs: [], links: [] }, note: '', status, statusTs: 1, trades }, o || {});
  const wid = await j.evaluate(V => coachIsoWeek(V), V);
  const PLAN = { v: 1, weeks: { [wid]: { id: wid, layers: [{ tf: 'Weekly', bias: 'Bullish', setups: ['BOS'], confirmations: [] }], levels: 'BTC 78.150 weekly high', noTrade: 'do FOMC 19:00', focus: 'Alleen A-setups in London', media: { imgs: ['i_w1'], links: [] }, les: '' } },
    days: { [V]: { id: V, week: wid, layers: [], levels: '', mental: 4, pre: [true, false, false], media: { imgs: [], links: [] }, les: '', scenarios: [sc('s_a', 'genomen', [1, 2]), sc('s_b', 'gemist', [4]), sc('s_c', 'niet', []), sc('s_d', 'open', [], { dir: 'short', title: 'ETH short' })] } } };
  await j.evaluate(([P, PNG]) => new Promise(res => { localStorage.setItem('tp3:plans', JSON.stringify(P)); localStorage.setItem('tp3:cfg', JSON.stringify({ stijl: 'scalp', risk: { A: 2, B: 1, C: 0 }, pre: ['a', 'b', 'c'] }));
    const r = indexedDB.open('tp3', 1); r.onupgradeneeded = () => r.result.createObjectStore('img'); r.onsuccess = () => { const tx = r.result.transaction('img', 'readwrite'); tx.objectStore('img').put(PNG, 'i_w1'); tx.oncomplete = () => { r.result.close(); res(); }; }; }), [PLAN, PNG]);
  await j.reload({ waitUntil: 'load' }); await j.waitForTimeout(1200);
  t = await tend();
  ok('voorspel-score: 2 van 3 uitgekomen (67%), daarvan genomen 1 van 2 (50%), gemist samen +1,5R', /Je scenario's komen in 67% uit\. Daarvan neem je 50%\. De gemiste waren samen \+1,5R\./.test(t), (t.match(/Je scenario's[^.]*\.[^.]*\.[^.]*\./) || [t.slice(0, 300)])[0]);
  ok('binnen plan (1, 2: +1,0R) tegenover buiten plan (3, 5: −3,0R); de trade van vóór je eerste plan telt niet mee', /Binnen plan/.test(t) && /Buiten plan/.test(t) && /n=2 · win-rate 50% · \+\$ 10,00/.test(t) && /n=2 · win-rate 0% · −\$ 30,00/.test(t), (t.match(/Binnen plan[^]{0,200}/) || [''])[0]);
  ok('zin in R én geld: "Buiten plan kostte je −3,0R (−$ 30,00)"', /Buiten plan kostte je −3,0R \(−\$ 30,00\)/.test(t), (t.match(/Buiten plan kostte[^.]*/) || [''])[0]);
  ok('geen poort-tekst', !/poort/i.test(t));
  await j.screenshot({ path: H.SHOTS + '/journal-tendencies-plan.png', fullPage: false });

  console.log('--- (b) Mori leest het weekplan ---');
  const regels = (await j.evaluate(() => coachPlanRegels('long'))).join('\n');
  ok('weekplan: focus, no-trade, levels en de lagen', /Alleen A-setups in London/.test(regels) && /do FOMC 19:00/.test(regels) && /78\.150/.test(regels) && /Weekly Bullish/.test(regels), regels);
  ok('risico per grade uit tp3:cfg: A 2%, B 1%, C niet traden', /A 2%/.test(regels) && /B 1%/.test(regels) && /C niet traden/.test(regels), regels);
  ok('scenario\'s van vandaag in die richting (long), niet de short', /S s_a/.test(regels) && !/ETH short/.test(regels), regels);
  ok('zonder plan: "Geen TradingPlan-gegevens"', await j.evaluate(() => { const a = localStorage.getItem('tp3:plans'), c = localStorage.getItem('tp3:cfg'); localStorage.removeItem('tp3:plans'); localStorage.removeItem('tp3:cfg'); const r = coachPlanRegels('long').join(' '); localStorage.setItem('tp3:plans', a); localStorage.setItem('tp3:cfg', c); return /Geen TradingPlan-gegevens/.test(r); }));

  console.log('--- (c) back-up ---');
  const exp = await j.evaluate(() => { const s = snapshotPayload(); return { tp: s.tradingplan, sub: dovDescribe(s).plan.sub }; });
  ok('export: tradingplan met tp3:plans, tp3:cfg en de plaatjes', exp.tp && exp.tp.v === 3 && /s_a/.test(exp.tp.plans) && /scalp/.test(exp.tp.cfg) && exp.tp.imgs && exp.tp.imgs.i_w1 === PNG, JSON.stringify(exp.tp).slice(0, 200));
  ok('overzicht: "2 plannen · 4 scenario\'s · 1 afbeelding"', /^2 plannen · 4 scenario's · 1 afbeelding$/.test(exp.sub), exp.sub);
  ok('geen tp2-sleutels in de back-up', !/tp2/.test(JSON.stringify(exp.tp)) && !('trades' in exp.tp));
  const terug = await j.evaluate(async snap => {
    localStorage.removeItem('tp3:plans'); localStorage.removeItem('tp3:cfg');
    await new Promise(res => { const r = indexedDB.open('tp3', 1); r.onsuccess = () => { const tx = r.result.transaction('img', 'readwrite'); tx.objectStore('img').clear(); tx.oncomplete = () => { r.result.close(); res(); }; }; });
    const d = JSON.parse(JSON.stringify(snapshotPayload())); d.tradingplan = snap; applyBackup(d); await new Promise(r => setTimeout(r, 400));
    const img = await new Promise(res => { const r = indexedDB.open('tp3', 1); r.onsuccess = () => { const q = r.result.transaction('img').objectStore('img').get('i_w1'); q.onsuccess = () => { res(q.result); r.result.close(); }; }; });
    return { plans: JSON.parse(localStorage.getItem('tp3:plans') || 'null'), cfg: JSON.parse(localStorage.getItem('tp3:cfg') || 'null'), img };
  }, exp.tp);
  ok('importeren zet tp3:plans en tp3:cfg terug', terug.plans && terug.plans.days[V].scenarios.length === 4 && terug.cfg && terug.cfg.stijl === 'scalp');
  ok('importeren zet de plaatjes terug in IndexedDB tp3', terug.img === PNG, String(terug.img).slice(0, 30));
  ok('een oude back-up met het v2-blok (tp2) zet niets terug en wist niets', await j.evaluate(() => { const voor = localStorage.getItem('tp3:plans'); const d = JSON.parse(JSON.stringify(snapshotPayload())); d.tradingplan = { trades: '[{"id":1}]', plans: '{"dag-x":{}}', cfg: '{}', meta: '{}' }; applyBackup(d); return localStorage.getItem('tp3:plans') === voor && localStorage.getItem('tp2:trades') === null; }));

  console.log('--- (d) geen poort ---');
  await j.evaluate(() => planSync()); await j.waitForTimeout(300);
  const det = await j.evaluate(() => tradeHoverDetail(T.find(t => t.id === 1)).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
  ok('trade-details: "Scenario: S s_a", geen poort-tekst', /Scenario: S s_a/.test(det) && !/poort/i.test(det), det.slice(0, 300));
  await j.evaluate(() => { go('playbook'); openPbEdit('London SFP'); }); await j.waitForTimeout(200);
  const pb = await j.evaluate(() => ({ cov: document.querySelectorAll('#modal .critcov').length, txt: document.getElementById('modal').innerText }));
  ok('playbook-criteria: geen "dekt poort-punt" meer', pb.cov === 0 && !/poort/i.test(pb.txt), pb.txt.slice(0, 200));
  await j.evaluate(() => { const b = [...document.querySelectorAll('#modal button')].find(x => /Opslaan|Bewaar/.test(x.textContent)); if (b) b.click(); }); await j.waitForTimeout(200);
  ok('de covers-data van een criterium blijft staan na opslaan', await j.evaluate(() => PBOOK['London SFP'].criteria[0].covers === 'trigger'));
  ok('geen functies van de poort meer', await j.evaluate(() => ['planPtOpties', 'planExec', 'planMatch', 'planRecOf', 'planHas'].every(f => typeof window[f] === 'undefined') && typeof PLAN_PT_STD === 'undefined'));

  ok('geen JS-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close(); srv.close(); process.exit(T.eind());
})();
