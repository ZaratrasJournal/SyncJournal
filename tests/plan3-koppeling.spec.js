// TradingPlan v3, taak 6: "Zet om in trade" en de koppeling in de journal (besluit 23: nooit automatisch).
//  1. Koppel aan een trade uit je journal: kandidaten (zelfde pair + richting op die dag, nieuwste boven), schakelaars
//     "alle pairs en richtingen" en "ook de dag erna", een of meer aanvinken; een trade van een ander scenario is
//     grijs; na bevestigen neemt de journal playbook, grade, lagen, afbeeldingen en links over (alleen lege velden).
//     Geen kandidaten: melding + "Markeer als genomen, koppel later".
//  2. Handmatig, backtest of paper: tp3:handoff → de journal opent het formulier vooraf ingevuld; opslaan koppelt.
//     Een handoff ouder dan 10 minuten wordt genegeerd en gewist.
//  Geen automatische koppeling · ontkoppelen · vanaf de trade-kant planPick met "Geen scenario".
const { chromium } = require('playwright');
const H = require('./helpers/plan3'); const NAAM = 'Plan v3 koppeling';
const TV = 'https://www.tradingview.com/x/AbC123/';
const L = (tf, setups = [], confirmations = [], bias = '') => ({ tf, bias, setups, confirmations });
const leeg = () => ({ imgs: [], links: [] });
const sc = o => Object.assign({ pair: 'BTC', dir: 'long', grade: 'B', trigger: '', invalid: '', entry: L('15M'), off: [], checked: [], stop: '', tps: [], media: leeg(), note: '', status: 'open', statusTs: null, trades: [] }, o);

(async () => {
  const srv = await H.server(), T = H.teller(NAAM), ok = T.ok;
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await H.alleenLokaal(ctx);
  const nieuw = async () => { const q = await ctx.newPage(); q.on('pageerror', e => errs.push(String(e).split('\n')[0])); q.on('dialog', d => d.accept()); return q; };
  const j = await nieuw();
  await j.addInitScript(() => localStorage.setItem('sj_welcomed', 'true'));
  await j.goto(srv.APP, { waitUntil: 'load' }); await j.waitForTimeout(1200);
  const DAG = await j.evaluate(() => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Amsterdam' }).format(new Date()));
  const MORGEN = new Date(Date.parse(DAG + 'T12:00:00Z') + 864e5).toISOString().slice(0, 10);
  // UTC 07:00–12:00 valt op dezelfde Amsterdamse kalenderdag
  const tr = (id, pair, dir, dag, uur, pnl, extra) => Object.assign({ id, exchange: 'okx', status: 'closed', kind: 'live', pair, dir, entry: 100, exit: 100 + pnl / 10, stop: dir === 'long' ? 99 : 101, size: 1000, pnl, r: 0, fees: 0, date: dag, time: String(uur + 1).padStart(2, '0') + ':10', openTime: String(Date.parse(dag + 'T' + String(uur).padStart(2, '0') + ':10:00Z')), closeTime: '', tps: [], tags: [], layers: [], screenshots: [], tvLinks: [], notes: '', setup: '', grade: '' }, extra || {});
  await j.evaluate(([DAG, MORGEN, ts]) => { T = ts; TRASH = []; PBOOK['Trend-pullback'] = pbNormalize('Trend-pullback', { layers: [], defaultGrade: 'A' }); PBOOK['London SFP'] = pbNormalize('London SFP', { layers: [] }); persistPbook(); persist(); render(); },
    [DAG, MORGEN, [tr(101, 'BTC/USDT', 'long', DAG, 8, 20), tr(103, 'ETH/USDT', 'short', DAG, 9, -10, { setup: 'Mijn setup', grade: 'C' }), tr(102, 'BTC/USDT', 'long', DAG, 10, -10), tr(105, 'SOL/USDT', 'long', DAG, 11, 5), tr(104, 'BTC/USDT', 'long', MORGEN, 7, 15)]]);

  // plan: dag met week, drie scenario's, één afbeelding in IndexedDB tp3
  const p = await nieuw();
  await p.goto(srv.TP, { waitUntil: 'load' });
  await p.evaluate(([DAG, S]) => new Promise(res => { const wid = __tp3.isoWeek(DAG), P = __tp3.load();
    P.weeks[wid] = { id: wid, layers: [{ tf: 'Weekly', bias: 'Bullish', setups: ['BOS'], confirmations: [] }], levels: '', noTrade: '', focus: '', media: { imgs: [], links: [] }, les: '' };
    P.days[DAG] = { id: DAG, week: wid, layers: [{ tf: '4H', bias: 'Bullish', setups: ['MSB'], confirmations: [] }, { tf: '1H', bias: '', setups: [], confirmations: ['OB'] }], levels: '', mental: null, pre: [false, false, false], media: { imgs: [], links: [] }, les: '', scenarios: S };
    __tp3.save(P);
    const r = indexedDB.open('tp3', 1); r.onupgradeneeded = () => r.result.createObjectStore('img'); r.onsuccess = () => { const c = document.createElement('canvas'); c.width = 8; c.height = 8; const tx = r.result.transaction('img', 'readwrite'); tx.objectStore('img').put(c.toDataURL('image/jpeg', 0.8), 'i_test1'); tx.oncomplete = () => { r.result.close(); res(); }; }; }),
    [DAG, [sc({ id: 's_btc', title: 'BTC trend-pullback', pb: 'Trend-pullback', grade: 'A', entry: L('15M', ['BOS'], ['FVG', 'OB'], 'Bullish'), checked: ['FVG'], off: ['1H|OB'], stop: '75020', tps: ['77400', '78150,5'], media: { imgs: ['i_test1'], links: [TV] } }),
      sc({ id: 's_eth', title: 'ETH short', pair: 'ETH', dir: 'short', pb: 'London SFP' }),
      sc({ id: 's_xrp', title: 'XRP long', pair: 'XRP', pb: 'London SFP' })]]);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(500);
  const scen = id => p.evaluate(id => { const P = __tp3.load(); for (const d of Object.values(P.days)) { const s = d.scenarios.find(x => x.id === id); if (s) return s; } return null; }, id);
  const jt = id => j.evaluate(id => { const t = T.find(x => String(x.id) === String(id)); return t && JSON.parse(JSON.stringify(t)); }, id);
  const kandidaten = () => p.evaluate(() => [...document.querySelectorAll('#modal .kand')].map(k => ({ id: k.dataset.t, uit: k.classList.contains('bezet'), txt: k.textContent.replace(/\s+/g, ' ').trim() })));

  console.log('--- 1. koppel aan een trade uit je journal ---');
  const zetOm = async (q, sid, weg) => { await q.click(`.ritem[data-s="${sid}"] .rrow`); await q.click(`.ritem[data-s="${sid}"] [data-a="convert"]`); if (weg) await q.click(`#modal [data-a="convWeg"][data-v="${weg}"]`); await q.waitForTimeout(150); };
  const sc1 = await H.vierShots(p, 'koppel', q => zetOm(q, 's_btc'));
  const sc2 = await H.vierShots(p, 'koppel-hand', q => zetOm(q, 's_btc', 'hand'));
  ok('390 breed: geen horizontale scroll in het koppelvenster', !sc1.licht && !sc1.donker && !sc2.licht && !sc2.donker);
  await p.setViewportSize({ width: 390, height: 700 }); await zetOm(p, 's_btc');
  ok('390 breed: paneel van onderen, de knoppen in beeld (vast onderaan)', await p.evaluate(() => { const m = document.querySelector('#modal .modal').getBoundingClientRect(), f = document.querySelector('#modal .mf').getBoundingClientRect(); return Math.abs(m.bottom - innerHeight) < 2 && f.bottom <= innerHeight + 1 && f.top < innerHeight; }));
  await p.click('#modal .mh [data-a="close"]'); await p.setViewportSize({ width: 1280, height: 900 }); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(300);
  await p.click('.ritem[data-s="s_btc"] .rrow'); await p.click('.ritem[data-s="s_btc"] [data-a="convert"]'); await p.waitForTimeout(150);
  ok('keuze met twee wegen als tabs: "Uit je journal" en "Nieuwe trade invullen"', await p.evaluate(() => [...document.querySelectorAll('#modal [data-a="convWeg"]')].map(x => x.textContent.trim()).join('|') === 'Uit je journal|Nieuwe trade invullen'));
  const kop = await p.evaluate(() => { const h = document.querySelector('#modal .mh'); const r = [...h.querySelectorAll('.grade,.dir,b,.datum')].map(x => x.getBoundingClientRect()); return { txt: h.innerText.replace(/\s+/g, ' ').trim(), eenRegel: r.length === 4 && r.every(x => Math.abs(x.top + x.height / 2 - (r[0].top + r[0].height / 2)) < 6) }; });
  ok('kop in één regel: grade, richting, pair, titel en de datum klein', kop.eenRegel && /^A LONG BTC BTC trend-pullback/i.test(kop.txt) && /\d+-\d+/.test(kop.txt), JSON.stringify(kop));
  ok('geen uitleg-alinea meer, wel één regel onder de lijst', await p.evaluate(() => { const t = document.getElementById('modal').innerText; return !/Vink één of meer trades aan/.test(t) && /Lege velden van de trade worden aangevuld vanuit het scenario\./.test(t); }));
  ok('filters als twee schakel-pills: "Alle pairs en richtingen" en "+ dag erna"', await p.evaluate(() => [...document.querySelectorAll('#modal .kfilter [data-a]')].map(x => x.textContent.trim()).join('|') === 'Alle pairs en richtingen|+ dag erna'));
  ok('niets gekozen: "Koppel" uitgeschakeld; secundair de tekstlink "Nog niet binnen? Markeer als genomen"', await p.evaluate(() => { const b = document.querySelector('#modal [data-a="koppel"]'), l = document.querySelector('#modal [data-a="laterKoppelen"]'); return b && b.disabled && l && /Nog niet binnen\? Markeer als genomen/.test(l.textContent) && !l.classList.contains('pri'); }));
  let k = await kandidaten();
  ok('kandidaten: BTC long op die dag, nieuwste boven (102 · 101)', k.map(x => x.id).join() === '102,101', JSON.stringify(k));
  ok('per trade: tijd, pair, richting, R en geld', /11:10/.test(k[0].txt) && /BTC\/USDT/.test(k[0].txt) && /long/i.test(k[0].txt) && /−1,0R/.test(k[0].txt) && /−\$10/.test(k[0].txt), k[0].txt);
  ok('het resultaat rood bij verlies, groen bij winst', await p.evaluate(() => document.querySelector('#modal .kand[data-t="102"] .res').classList.contains('neg') && document.querySelector('#modal .kand[data-t="101"] .res').classList.contains('pos')));
  await p.click('#modal .kand[data-t="102"]'); await p.waitForTimeout(80);
  ok('een rij in zijn geheel aantikken: gekozen met vinkje en gekleurde rand, knop "Koppel 1 trade"', await p.evaluate(() => { const r = document.querySelector('#modal .kand[data-t="102"]'), b = document.querySelector('#modal [data-a="koppel"]'); return r.classList.contains('on') && r.getAttribute('aria-pressed') === 'true' && /✓/.test(r.textContent) && !b.disabled && b.textContent.trim() === 'Koppel 1 trade'; }));
  await p.click('#modal .kand[data-t="101"]'); await p.waitForTimeout(80);
  ok('twee gekozen: "Koppel 2 trades"', await p.evaluate(() => document.querySelector('#modal [data-a="koppel"]').textContent.trim() === 'Koppel 2 trades'));
  await p.click('#modal .kand[data-t="102"]'); await p.click('#modal .kand[data-t="101"]'); await p.waitForTimeout(80);
  await p.click('#modal [data-a="kandAlle"]'); await p.waitForTimeout(80);
  ok('"alle pairs en richtingen van die dag": 105 · 102 · 103 · 101', (await kandidaten()).map(x => x.id).join() === '105,102,103,101', JSON.stringify((await kandidaten()).map(x => x.id)));
  await p.click('#modal [data-a="kandErna"]'); await p.waitForTimeout(80);
  ok('"ook de dag erna": 104 erbij, bovenaan', (await kandidaten())[0].id === '104');
  await p.click('#modal [data-a="kandAlle"]'); await p.click('#modal [data-a="kandErna"]'); await p.waitForTimeout(80);
  await p.click('#modal .kand[data-t="101"]'); await p.click('#modal [data-a="koppel"]'); await p.waitForTimeout(200);
  let s = await scen('s_btc');
  ok('bevestigd: Scenario.trades = [101], status genomen', JSON.stringify(s.trades) === '[101]' && s.status === 'genomen' && s.statusTs > 0, JSON.stringify({ t: s.trades, st: s.status }));
  await j.waitForTimeout(800);
  let t = await jt(101);
  ok('journal (storage-event): planRef s:s_btc', t.planRef === 's:s_btc', t.planRef);
  ok('journal neemt playbook en grade over', t.setup === 'Trend-pullback' && t.grade === 'A', t.setup + ' ' + t.grade);
  ok('lagen: Weekly BOS · 4H MSB · 15M BOS+FVG (OB niet afgevinkt, 1H OB uitgezet), top-down', JSON.stringify(t.layers.map(l => [l.timeframe, l.bias, l.setups.join('+'), l.confirmations.join('+')])) === JSON.stringify([['Weekly', 'Bullish', 'BOS', ''], ['4H', 'Bullish', 'MSB', ''], ['15M', 'Bullish', 'BOS', 'FVG']]), JSON.stringify(t.layers));
  ok('afbeelding als screenshot, link als tvLink', t.screenshots.length === 1 && /^data:image\/jpeg/.test(t.screenshots[0]) && JSON.stringify(t.tvLinks) === JSON.stringify([TV]), t.screenshots.length + ' ' + JSON.stringify(t.tvLinks));
  ok('geen dubbele trade', await j.evaluate(() => T.length) === 5);

  console.log('--- alleen lege velden, bezette trade grijs ---');
  await p.click('.ritem[data-s="s_eth"] .rrow'); await p.click('.ritem[data-s="s_eth"] [data-a="convert"]'); await p.waitForTimeout(150);
  await p.click('#modal [data-a="kandAlle"]'); await p.waitForTimeout(80);
  k = await kandidaten();
  const bezet = k.find(x => x.id === '101');
  ok('trade van een ander scenario: grijs, "bij BTC trend-pullback" rechts, niet aan te tikken', bezet && bezet.uit && /bij BTC trend-pullback$/.test(bezet.txt) && await p.evaluate(() => document.querySelector('#modal .kand[data-t="101"]').disabled), JSON.stringify(bezet));
  await p.click('#modal .kand[data-t="103"]'); await p.click('#modal [data-a="koppel"]'); await p.waitForTimeout(900);
  t = await jt(103);
  ok('bestaande setup en grade blijven staan, lege lagen worden gevuld', t.planRef === 's:s_eth' && t.setup === 'Mijn setup' && t.grade === 'C' && t.layers.length >= 1, JSON.stringify({ r: t.planRef, s: t.setup, g: t.grade }));

  console.log('--- geen kandidaten ---');
  await p.click('.ritem[data-s="s_xrp"] .rrow'); await p.click('.ritem[data-s="s_xrp"] [data-a="convert"]'); await p.waitForTimeout(150);
  ok('geen kandidaten: één regel met wat ontbreekt en de volgende stap, plus de tekstlink', await p.evaluate(() => { const t = document.getElementById('modal').innerText; return /Geen XRP long op .+ in je journal\. Sync eerst in de journal, of zet "Alle pairs en richtingen" aan\./.test(t) && !!document.querySelector('#modal [data-a="laterKoppelen"]') && !document.querySelector('#modal [data-a="koppel"]'); }));
  await p.click('#modal [data-a="laterKoppelen"]'); await p.waitForTimeout(100);
  s = await scen('s_xrp');
  ok('"Markeer als genomen, koppel later": genomen, zonder trades', s.status === 'genomen' && s.trades.length === 0);

  console.log('--- ontkoppelen ---');
  ok('opengeklapt scenario toont de gekoppelde trade', await p.evaluate(() => !!document.querySelector('.ritem[data-s="s_btc"] [data-a="ontkoppel"][data-v="101"]')));
  await p.click('.ritem[data-s="s_btc"] [data-a="ontkoppel"][data-v="101"]'); await p.waitForTimeout(800);
  t = await jt(101);
  ok('weg uit Scenario.trades; journal wist planRef, overgenomen velden blijven', (await scen('s_btc')).trades.length === 0 && !t.planRef && t.setup === 'Trend-pullback', JSON.stringify({ r: t.planRef, s: t.setup }));

  console.log('--- geen automatische koppeling ---');
  await p.evaluate(DAG => { const P = __tp3.load(); P.days[DAG].scenarios.push({ id: 's_ada', title: 'ADA long', pair: 'ADA', dir: 'long', pb: '', grade: 'B', trigger: '', invalid: '', entry: { tf: '15M', bias: '', setups: [], confirmations: [] }, off: [], checked: [], stop: '', tps: [], media: { imgs: [], links: [] }, note: '', status: 'open', statusTs: null, trades: [] }); __tp3.save(P); }, DAG);
  await j.evaluate(t => { T.push(t); persist(); }, tr(108, 'ADA/USDT', 'long', DAG, 11, 30));
  await j.reload({ waitUntil: 'load' }); await j.waitForTimeout(1200);
  ok('ADA long op dezelfde dag blijft los, het open scenario blijft open', !(await jt(108)).planRef && (await scen('s_ada')).status === 'open' && (await scen('s_ada')).trades.length === 0);

  console.log('--- vanaf de trade-kant ---');
  const lijn = id => j.evaluate(id => planLine(T.find(t => t.id === id)).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), id);
  ok('trade-details zonder scenario: "Koppel aan scenario"', /Koppel aan scenario/.test(await lijn(108)), await lijn(108));
  await j.evaluate(() => planPick(108)); await j.waitForTimeout(100);
  const knoppen = await j.evaluate(() => [...document.querySelectorAll('#modal .mbody .btn')].map(x => x.textContent.trim()));
  ok('planPick: de scenario\'s van die dag (en de dag ervoor) + "Geen scenario"', knoppen.length === 5 && knoppen.some(x => /ADA long/.test(x)) && knoppen.some(x => /BTC trend-pullback/.test(x)) && /Geen scenario/.test(knoppen[knoppen.length - 1]), JSON.stringify(knoppen));
  await j.evaluate(() => planSetRef(108, 's:s_ada')); await j.waitForTimeout(300);
  ok('kiezen: planRef s:s_ada, Scenario.trades bijgewerkt, status genomen', (await jt(108)).planRef === 's:s_ada' && JSON.stringify((await scen('s_ada')).trades) === '[108]' && (await scen('s_ada')).status === 'genomen');
  ok('trade-details: "Scenario: ADA long" met wijzig', /Scenario: ADA long/.test(await lijn(108)) && /wijzig/.test(await lijn(108)), await lijn(108));
  await j.evaluate(() => planSetRef(108, 's:s_btc')); await j.waitForTimeout(200);
  ok('een trade hoort bij hooguit één scenario: weg bij ADA, bij BTC', (await scen('s_ada')).trades.length === 0 && JSON.stringify((await scen('s_btc')).trades) === '[108]');
  await j.evaluate(() => planSetRef(108, 'none')); await j.waitForTimeout(200);
  ok('"Geen scenario": planRef none, uit elk scenario, "Bewust buiten plan"', (await jt(108)).planRef === 'none' && (await scen('s_btc')).trades.length === 0 && /Bewust buiten plan/.test(await lijn(108)), await lijn(108));
  ok('een oude numerieke planRef (v2-poort) wordt genegeerd', await j.evaluate(() => { const t = T.find(x => x.id === 105); t.planRef = '7'; return /Koppel aan scenario/.test(planLine(t)); }));

  console.log('--- 2. handmatig, backtest of paper ---');
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(400);
  await p.click('.ritem[data-s="s_btc"] .rrow'); await p.click('.ritem[data-s="s_btc"] [data-a="convert"]'); await p.click('#modal [data-a="convWeg"][data-v="hand"]'); await p.waitForTimeout(100);
  ok('handmatig: overzicht van wat meegaat', /Open tradeformulier/.test(await p.evaluate(() => document.getElementById('modal').innerText)));
  await Promise.all([p.waitForNavigation({ waitUntil: 'load' }), p.click('#modal [data-a="naarFormulier"]')]);
  await p.waitForTimeout(1500);
  ok('plan opent de journal (lokaal: ../work/syncjournal.html)', /\/work\/syncjournal\.html$/.test(p.url()), p.url());
  const f = await p.evaluate(() => ({ open: document.getElementById('modal').classList.contains('on') && modalKind === 'trade', pair: document.getElementById('f_pair').value, dir: document.getElementById('f_dir').value, pb: document.getElementById('f_playbook').value, grade: formGrade, stop: (document.getElementById('f_stop') || {}).value, date: document.getElementById('f_date').value, tps: formTPs.map(x => +x.price), lagen: formLayers.map(l => l.timeframe + ':' + l.setups.join('+') + '/' + l.confirmations.join('+')), shots: formShots.length, tv: formTvLinks, hand: localStorage.getItem('tp3:handoff') }));
  ok('formulier open met pair (zoals je eerdere BTC-trades), richting, playbook, grade', f.open && f.pair === 'BTC/USDT' && f.dir === 'long' && f.pb === 'Trend-pullback' && f.grade === 'A', JSON.stringify(f));
  ok('stop 75020 en TP\'s 77400 · 78150,5', f.stop === '75020' && f.tps.join() === '77400,78150.5', f.stop + ' ' + f.tps);
  ok('lagen samengevoegd (Weekly BOS · 4H MSB · 15M BOS+FVG)', f.lagen.join() === 'Weekly:BOS/,4H:MSB/,15M:BOS/FVG', f.lagen.join());
  ok('afbeelding als screenshot en de link als tvLink; datum = de dag van het scenario', f.shots === 1 && f.tv.join() === TV && f.date === DAG);
  ok('handoff gewist', f.hand === null);
  await p.fill('#f_entry', '76000'); await p.fill('#f_exit', '76500'); await p.fill('#f_pnl', '12');
  await p.evaluate(() => submitForm(null)); await p.waitForTimeout(400);
  const n = await p.evaluate(() => { const t = T.find(x => x.pair === 'BTC/USDT' && +x.entry === 76000); return t && { id: t.id, ref: t.planRef }; });
  const P2 = await p.evaluate(DAG => JSON.parse(localStorage.getItem('tp3:plans')).days[DAG].scenarios.find(s => s.id === 's_btc'), DAG);
  ok('opslaan: nieuwe trade met planRef s:s_btc, in Scenario.trades, status genomen', n && n.ref === 's:s_btc' && P2.trades.map(String).includes(String(n.id)) && P2.status === 'genomen', JSON.stringify({ n, t: P2.trades, st: P2.status }));

  console.log('--- oude handoff ---');
  await p.evaluate(DAG => localStorage.setItem('tp3:handoff', JSON.stringify({ sid: 's_eth', day: DAG, ts: Date.now() - 11 * 60000 })), DAG);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1500);
  ok('ouder dan 10 minuten: geen formulier, handoff gewist', await p.evaluate(() => !(document.getElementById('modal').classList.contains('on') && modalKind === 'trade') && localStorage.getItem('tp3:handoff') === null));
  await p.evaluate(DAG => localStorage.setItem('tp3:handoff', JSON.stringify({ sid: 'bestaat_niet', day: DAG, ts: Date.now() })), DAG);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1500);
  ok('handoff naar een onbekend scenario: geen formulier, gewist', await p.evaluate(() => !(document.getElementById('modal').classList.contains('on') && modalKind === 'trade') && localStorage.getItem('tp3:handoff') === null));

  ok('geen JS-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close(); srv.close(); process.exit(T.eind());
})();
