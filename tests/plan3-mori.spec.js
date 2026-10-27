// TradingPlan v3 — Mori in het plan (docs/plan-v3-mori-2026-10-27.md).
//  1. "Vraag Mori" per scenario en "Vraag Mori over mijn dagplan": alleen met Mori aan én een sleutel, anders
//     "Mori instellen". De dag-knop is uit zonder scenario's.
//  2. Het plan zet tp3:mori en opent de journal; de journal stuurt één vraag met het scenario of het dagplan in het
//     pakket en de juiste opdracht. Een scenario heeft geen entry: geen fout, "entry nog niet bekend".
//  3. Een oude, kapotte of verweesde overdracht verstuurt niets.
//  4. De sleutel komt nooit in tp3:*, een overdracht of een pakket; het plan leest hem nooit (alleen óf hij er is).
//  5. Een scenario zonder titel toont nooit zijn id: "<pair> <playbook>".
// Nep-Anthropic uit helpers/coach-nep.js: nooit een echte sleutel, nooit een echte aanroep.
const { chromium } = require('playwright');
const H = require('./helpers/plan3'); const N = require('./helpers/coach-nep'); const NAAM = 'Plan v3 Mori';
const L = (tf, setups = [], confirmations = [], bias = '') => ({ tf, bias, setups, confirmations });
const leeg = () => ({ imgs: [], links: [] });
const sc = o => Object.assign({ pair: 'BTC', dir: 'long', grade: 'B', trigger: '', invalid: '', entry: L('15M'), off: [], checked: [], critChecked: [], stop: '', tps: [], media: leeg(), note: '', status: 'open', statusTs: null, trades: [] }, o);
const ANTWOORD = 'Je Trend-pullback staat op n=4 (uit je setuptabel). Let op je bearish dag-bias.';

(async () => {
  const srv = await H.server(), T = H.teller(NAAM), ok = T.ok;
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await H.alleenLokaal(ctx);
  await N.vooraf(ctx, N.tekst(ANTWOORD), N.tekst(ANTWOORD), N.tekst(ANTWOORD), N.tekst(ANTWOORD));
  // Het plan mag alleen weten óf er een sleutel is: elk getItem op sj_ai_key en elke tp3:*-schrijfactie wordt geteld.
  await ctx.addInitScript(() => { window.__lees = []; window.__tp3schrijf = []; const g = Storage.prototype.getItem, s = Storage.prototype.setItem;
    Storage.prototype.getItem = function (k) { window.__lees.push(k); return g.call(this, k); };
    Storage.prototype.setItem = function (k, v) { if (/^tp3:/.test(k)) { window.__tp3schrijf.push([k, String(v)]); try { const a = JSON.parse(sessionStorage.getItem('__tp3log') || '[]'); a.push([k, String(v)]); s.call(sessionStorage, '__tp3log', JSON.stringify(a)); } catch (e) {} } return s.call(this, k, v); }; });
  let netwerkAnthropic = 0; ctx.on('request', r => { if (/anthropic\.com/.test(r.url())) netwerkAnthropic++; });
  const nieuw = async () => { const q = await ctx.newPage(); q.on('pageerror', e => errs.push(String(e).split('\n')[0])); q.on('dialog', d => d.accept()); return q; };

  // journal: trades en playbooks
  const j = await nieuw();
  await j.addInitScript(() => localStorage.setItem('sj_welcomed', 'true'));
  await j.goto(srv.APP, { waitUntil: 'load' }); await j.waitForTimeout(1200);
  const DAG = await j.evaluate(() => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Amsterdam' }).format(new Date()));
  const WID = await j.evaluate(d => coachIsoWeek(d), DAG);
  const tr = (id, R, extra) => Object.assign({ id, exchange: 'okx', status: 'closed', kind: 'live', pair: 'BTC/USDT', dir: 'long', setup: 'Trend-pullback', entry: 100, stop: 99, size: 1000, exit: 100 + R, pnl: R * 10, r: 0, fees: 0,
    date: '2026-10-01', time: '10:10', openTime: String(Date.parse('2026-10-01T09:10:00Z') + id * 864e5), closeTime: '', tps: [], layers: [L('4H', ['MSB']), L('15M', ['BOS'], ['FVG'])].map(x => ({ timeframe: x.tf, bias: '', setups: x.setups, confirmations: x.confirmations })) }, extra || {});
  await j.evaluate(ts => { T = ts; TRASH = [];
    PBOOK['Trend-pullback'] = pbNormalize('Trend-pullback', { layers: [], defaultGrade: 'A', criteria: [{ text: 'HTF-trend mee', mandatory: true }, { text: 'Volume boven gemiddeld', mandatory: false }], antiCriteria: [{ text: 'Vlak voor nieuws', mandatory: true }], minRR: '2' });
    PBOOK['London SFP'] = pbNormalize('London SFP', { layers: [] }); persistPbook(); persist(); clearGFilter(); setFilter('kind', 'alle'); render(); },
    [tr(1, 2), tr(2, -1), tr(3, 1.5), tr(4, -1), tr(5, 3, { setup: 'London SFP' }), tr(6, -1, { setup: 'London SFP', dir: 'short' })]);

  // plan: week (bullish), dag (bearish 4H), twee scenario's waarvan één zonder titel, en een lege dag-van-gisteren
  const PLAN = { v: 1, weeks: { [WID]: { id: WID, layers: [L('Weekly', ['BOS'], [], 'Bullish')], levels: 'BTC 78.150 weekly high', noTrade: 'do FOMC 19:00', focus: 'Alleen A-setups', media: leeg(), les: '' } },
    days: { [DAG]: { id: DAG, week: WID, layers: [L('4H', ['MSB'], [], 'Bearish'), L('1H', [], ['OB'])], levels: 'BTC 76.200 Asia-low', mental: 2, pre: [true, false, false], media: leeg(), les: '', scenarios: [
      sc({ id: 's_btc', title: 'BTC trend-pullback', pb: 'Trend-pullback', grade: 'A', trigger: 'Als 15M BOS boven 77k', invalid: '4H close onder 75k', entry: L('15M', ['BOS'], ['FVG', 'OB'], 'Bullish'), checked: ['FVG'], critChecked: ['HTF-trend mee'], off: ['1H|OB'], stop: '75020', tps: ['77400', '78150,5'] }),
      sc({ id: 's_zc', title: '', pair: 'ETH', dir: 'short', pb: 'London SFP', grade: 'C' })] } } };
  const p = await nieuw();
  await p.goto(srv.TP, { waitUntil: 'load' });
  await p.evaluate(([P, cfg]) => { localStorage.setItem('tp3:plans', JSON.stringify(P)); localStorage.setItem('tp3:cfg', JSON.stringify(cfg)); }, [PLAN, { stijl: 'daytrade', risk: { A: 2, B: 1, C: 0 }, pre: ['Nieuws gecheckt', 'Goed geslapen', ''] }]);
  const herlaad = async () => { await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(600); };
  const open = async sid => { if (!(await p.evaluate(sid => !!document.querySelector(`.ritem[data-s="${sid}"] .rdetail`), sid))) await p.click(`.ritem[data-s="${sid}"] .rrow`); };
  const knoppen = () => p.evaluate(() => ({ scen: document.querySelectorAll('.ritem[data-s="s_btc"] [data-a="mori"]').length, dag: document.querySelectorAll('[data-a="dagMori"]').length,
    instellen: [...document.querySelectorAll('a.moriset')].map(a => a.getAttribute('href')) }));
  await herlaad();

  console.log('--- 1. zichtbaarheid ---');
  await open('s_btc');
  let k = await knoppen();
  ok('zonder sleutel: geen Mori-knoppen', k.scen === 0 && k.dag === 0, JSON.stringify(k));
  await H.vierShots(p, 'mori-instellen', async q => { await q.waitForTimeout(300); await q.click('.ritem[data-s="s_btc"] .rrow'); await q.waitForTimeout(100); });
  ok('zonder sleutel: "Mori instellen" wijst naar Mori in de journal', k.instellen.length >= 1 && k.instellen.every(h => h === '../work/syncjournal.html?page=ai'), JSON.stringify(k));
  await p.evaluate(k => sessionStorage.setItem('sj_ai_key', k), N.NEP);
  await p.evaluate(() => localStorage.setItem('sj_ai_prefs', JSON.stringify({ enabled: false })));
  await herlaad(); await open('s_btc'); k = await knoppen();
  ok('sleutel (alleen deze sessie) maar Mori uit: geen knoppen, wel "Mori instellen"', k.scen === 0 && k.dag === 0 && k.instellen.length >= 1, JSON.stringify(k));
  await p.evaluate(() => localStorage.removeItem('sj_ai_prefs'));
  await herlaad(); await open('s_btc'); k = await knoppen();
  ok('sleutel en Mori aan (standaard): "Vraag Mori" naast "Zet om in trade", en de dag-knop', k.scen === 1 && k.dag === 1 && !k.instellen.length, JSON.stringify(k));
  ok('"Vraag Mori" staat in dezelfde rij als "Zet om in trade"', await p.evaluate(() => { const m = document.querySelector('.ritem[data-s="s_btc"] [data-a="mori"]'); return !!m && !!m.parentElement.querySelector('[data-a="convert"]'); }));
  ok('dag-knop bij de titel, met scenario\'s aan', await p.evaluate(() => { const d = document.querySelector('[data-a="dagMori"]'); return !!d.closest('.pagehead') && !d.disabled && /Vraag Mori over mijn dagplan/.test(d.textContent); }));
  ok('het plan leest de sleutel nooit (alleen óf hij er is)', await p.evaluate(() => !window.__lees.includes('sj_ai_key')));

  console.log('--- 5. scenario zonder titel ---');
  const txt = await p.evaluate(() => document.getElementById('app').innerText);
  ok('Cockpit: "ETH London SFP" in plaats van het id', /ETH London SFP/.test(txt) && !/s_zc/.test(txt), (txt.match(/.*ETH.*/) || [''])[0]);
  await p.click('nav.tabs [data-v="log"]'); await p.waitForTimeout(100);
  ok('Log-chip: geen id', await p.evaluate(() => { const c = document.querySelector('.schip[data-s="s_zc"]'); return !!c && /ETH London SFP/.test(c.textContent) && !/s_zc|zonder titel/.test(c.textContent); }));
  await p.click('.schip[data-s="s_zc"]'); await p.click('[data-a="convert"][data-s="s_zc"]'); await p.waitForTimeout(100);
  ok('koppelvenster: kop zonder id', await p.evaluate(() => { const t = document.querySelector('#modal .mh').innerText; return /ETH London SFP/.test(t) && !/s_zc|zonder titel/.test(t); }));
  await p.click('#modal .mh [data-a="close"]');
  await p.click('nav.tabs [data-v="afsluiting"]'); await p.waitForTimeout(100);
  ok('Afsluiting: geen id', await p.evaluate(() => { const t = document.getElementById('app').innerText; return /ETH London SFP/.test(t) && !/s_zc|zonder titel/.test(t); }));
  await p.click('nav.tabs [data-v="dag"]'); await p.waitForTimeout(100);

  const shots = await H.vierShots(p, 'mori-dag', async q => { await q.waitForTimeout(300); await q.click('.ritem[data-s="s_btc"] .rrow'); await q.waitForTimeout(100); });
  ok('390 breed: geen horizontale scroll met de Mori-knoppen', !shots.licht && !shots.donker, JSON.stringify(shots));

  console.log('--- 2a. scenario → journal ---');
  await herlaad(); await open('s_btc');
  await Promise.all([p.waitForNavigation({ waitUntil: 'load' }), p.click('.ritem[data-s="s_btc"] [data-a="mori"]')]);
  await p.waitForFunction(() => window.__nep && window.__nep.verzoeken.length > 0 && typeof AI_UI === 'object' && !AI_UI.bezig, null, { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(300);
  let v = await N.verzoeken(p);
  const pakket = body => ((body.system || []).find(x => /Data van de trader/.test(x.text)) || { text: '' }).text;
  const opdracht = body => ((body.system || []).find(x => /Opdracht voor deze vraag/.test(x.text)) || { text: '' }).text;
  ok('in de journal, op Mori, precies één verzoek', /syncjournal\.html/.test(p.url()) && await p.evaluate(() => STATE.page) === 'ai' && v.length === 1, p.url() + ' · ' + v.length);
  let body = v[0] ? v[0].body : {}, pk = pakket(body), op = opdracht(body);
  const vraag = body.messages ? body.messages[body.messages.length - 1].content : '';
  ok('de vraag: "Check mijn scenario: BTC trend-pullback — BTC long, Trend-pullback"', vraag === 'Check mijn scenario: BTC trend-pullback — BTC long, Trend-pullback', vraag);
  ok('opdracht: die van de pre-trade-check (geen koop- of verkoopadvies, niets voorspellen)', op.includes(await p.evaluate(() => AI_PRETRADE_OPDRACHT)), op.slice(0, 200));
  ok('opdracht: plus vergelijken met eigen cijfers en de week- of dagbias', /Vergelijk het scenario met de eigen cijfers en regels van de trader, en noem waar het scenario tegen zijn week- of dagbias ingaat\./.test(op));
  ok('pakket: het scenario als trade-idee, entry nog niet bekend, geen fout', /# Trade-idee/.test(pk) && /entry nog niet bekend/i.test(pk) && !/Vul entry en stop in/.test(pk), (pk.match(/# Trade-idee[^]{0,300}/) || [''])[0]);
  ok('pakket: de cijfers van de setup uit de journal', /## Deze setup \(Trend-pullback\)\n- n=4 · /.test(pk));
  const S = (pk.match(/# Scenario uit TradingPlan[^]*?(?=\n# |$)/) || [''])[0];
  ok('pakket: titel, pair, richting, playbook, grade', /BTC trend-pullback/.test(S) && /Pair: BTC/.test(S) && /Richting: long/.test(S) && /Playbook: Trend-pullback/.test(S) && /Grade: A/.test(S), S.slice(0, 600));
  ok('pakket: trigger en ongeldig als', /Trigger: Als 15M BOS boven 77k/.test(S) && /Ongeldig als: 4H close onder 75k/.test(S));
  ok('pakket: alle actieve tags per tijdframe (week + dag + entry), uitgezette niet', /Weekly Bullish: BOS/.test(S) && /4H Bearish: MSB/.test(S) && /15M Bullish: BOS, FVG, OB/.test(S) && !/1H[^\n]*OB/.test(S), (S.match(/Lagen[^]{0,300}/) || [''])[0]);
  ok('pakket: confirmations afgevinkt en open', /Confirmations afgevinkt: FVG/.test(S) && /Confirmations open: OB/.test(S));
  ok('pakket: criteria afgevinkt en open', /Criteria afgevinkt: HTF-trend mee/.test(S) && /Criteria open: Volume boven gemiddeld/.test(S));
  ok('pakket: stop en TP\'s', /Stop: 75020/.test(S) && /TP's: 77400 · 78150,5/.test(S));
  ok('pakket: edge-regel zoals het plan hem toont (n, winrate, gem. R)', /Edge volgens het plan:/.test(S) && /Live n=\d+ · winrate \d+% · gem\. R [+−]\d/.test(S), (S.match(/Edge volgens het plan[^\n]*\n?[^\n]*/) || [''])[0]);
  ok('pakket: week- en dag-bias, levels, mentaal', /Weekplan[^]*Weekly Bullish/.test(pk) && /Dagplan[^]*4H Bearish/.test(pk) && /BTC 78\.150 weekly high/.test(pk) && /BTC 76\.200 Asia-low/.test(pk) && /Mentaal vandaag: 2\/5/.test(pk), (pk.match(/## Regels uit TradingPlan[^]{0,700}/) || [''])[0]);
  ok('de overdracht is gewist', await p.evaluate(() => localStorage.getItem('tp3:mori') === null));
  await p.waitForSelector('#aiFeed .aiterug', { timeout: 4000 }).catch(() => {});
  ok('na het antwoord: "← Terug naar je plan"', await p.evaluate(() => { const a = document.querySelector('#aiFeed .aiterug'); return !!a && /Terug naar je plan/.test(a.textContent) && a.getAttribute('href') === '../tradingplan/tradingplan.html'; }));
  ok('"Wat is er verstuurd?" toont het pakket', await p.evaluate(() => { const d = [...document.querySelectorAll('#aiFeed details.aisent pre')].pop(); return !!d && /# Scenario uit TradingPlan/.test(d.textContent); }));
  ok('het antwoord staat in het gesprek', await p.evaluate(a => document.getElementById('aiFeed').innerText.includes(a.slice(0, 30)), ANTWOORD));
  for (const th of ['light', 'dark']) for (const w of [1280, 390]) {
    await p.setViewportSize({ width: w, height: 900 }); await p.evaluate(x => { setTheme(x); render(); }, th); await p.waitForTimeout(250);
    if (w === 390) ok(`journal ${th} 390: geen horizontale scroll`, await p.evaluate(() => document.documentElement.scrollWidth <= 392));
    await p.screenshot({ path: `${H.SHOTS}/mori-antwoord-${th === 'dark' ? 'donker' : 'licht'}-${w}.png`, fullPage: false });
  }
  await p.setViewportSize({ width: 1280, height: 900 }); await p.evaluate(() => { setTheme('light'); render(); });

  console.log('--- 2b. bedragen verbergen ---');
  await p.evaluate(() => { AIPREFS.hideAmounts = true; persistAIPrefs(); });
  await p.evaluate(d => localStorage.setItem('tp3:mori', JSON.stringify({ soort: 'scenario', sid: 's_btc', day: d, ts: Date.now() })), DAG);
  await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => window.__nep && window.__nep.verzoeken.length > 0, null, { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(400);
  v = await N.verzoeken(p); pk = v[0] ? pakket(v[0].body) : '';
  ok('met "bedragen verbergen": geen bedragen in het pakket', !!pk && !/\$/.test(pk), (pk.match(/.*\$.*/) || [''])[0]);
  await p.evaluate(() => { AIPREFS.hideAmounts = false; persistAIPrefs(); });

  console.log('--- 2c. dagplan → journal ---');
  await p.goto(srv.TP, { waitUntil: 'load' }); await p.waitForTimeout(500);
  await Promise.all([p.waitForNavigation({ waitUntil: 'load' }), p.click('[data-a="dagMori"]')]);
  await p.waitForFunction(() => window.__nep && window.__nep.verzoeken.length > 0 && !AI_UI.bezig, null, { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(300);
  v = await N.verzoeken(p); body = v[0] ? v[0].body : {}; pk = pakket(body); op = opdracht(body);
  const dagVraag = body.messages ? body.messages[body.messages.length - 1].content : '';
  ok('één verzoek: "Review mijn dagplan van …"', v.length === 1 && /^Review mijn dagplan van \S/.test(dagVraag), dagVraag);
  ok('opdracht: dagplan bespreken, sterkste en zwakste, tegenspraak, mentaal, geen advies, één punt', /Bespreek het dagplan/.test(op) && /sterkst/.test(op) && /zichzelf tegen/.test(op) && /mentale score/.test(op) && /Geen koop- of verkoopadvies/.test(op) && /één concreet punt/.test(op), op.slice(0, 300));
  const D = (pk.match(/# Dagplan uit TradingPlan[^]*$/) || [''])[0];
  ok('pakket: week (lagen met bias, levels, no-trade, focus)', /Weekly Bullish: BOS/.test(D) && /BTC 78\.150 weekly high/.test(D) && /do FOMC 19:00/.test(D) && /Alleen A-setups/.test(D), D.slice(0, 500));
  ok('pakket: dag (lagen, levels, mentaal, dagstart — oude pre-flight-dag omgezet)', /4H Bearish: MSB/.test(D) && /BTC 76\.200 Asia-low/.test(D) && /Mentaal vandaag: 2\/5/.test(D) && /Dagstart: Nieuws gecheckt ✓, Goed geslapen open/.test(D), D.slice(0, 800));
  ok('pakket: elk scenario met titel, pair, richting, playbook, grade, status, edge en rang', /[12]\. BTC trend-pullback · BTC long · Trend-pullback · grade A · open/.test(D) && /[12]\. ETH London SFP · ETH short · London SFP · grade C · open/.test(D) && (D.match(/edge: /g) || []).length === 2, (D.match(/## Scenario's[^]{0,600}/) || [''])[0]);
  ok('pakket: risico per grade', /Risico per grade: A 2%, B 1%, C niet traden/.test(D));
  ok('pakket: geen id van een scenario', !/s_btc|s_zc/.test(pk));

  console.log('--- 3. oude, kapotte en verweesde overdrachten ---');
  const naarJournal = async waarde => { await p.evaluate(w => { if (w == null) localStorage.removeItem('tp3:mori'); else localStorage.setItem('tp3:mori', w); }, waarde); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1200);
    return { n: (await N.verzoeken(p)).length, weg: await p.evaluate(() => localStorage.getItem('tp3:mori') === null), feed: await p.evaluate(() => (document.getElementById('aiFeed') || { innerText: '' }).innerText) }; };
  let r = await naarJournal(JSON.stringify({ soort: 'scenario', sid: 's_btc', day: DAG, ts: Date.now() - 11 * 60000 }));
  ok('ouder dan 10 minuten: niets verstuurd, gewist', r.n === 0 && r.weg, JSON.stringify(r));
  r = await naarJournal('{kapot');
  ok('kapotte JSON: niets verstuurd, gewist', r.n === 0 && r.weg);
  r = await naarJournal(JSON.stringify({ soort: 'iets', day: DAG, ts: Date.now() }));
  ok('onbekende soort: niets verstuurd, gewist', r.n === 0 && r.weg);
  r = await naarJournal(JSON.stringify({ soort: 'scenario', sid: 'bestaat_niet', day: DAG, ts: Date.now() }));
  ok('scenario bestaat niet meer: melding, niets verstuurd', r.n === 0 && r.weg && /bestaat niet meer/.test(r.feed), r.feed.slice(0, 200));
  r = await naarJournal(JSON.stringify({ soort: 'dag', day: '2020-01-01', ts: Date.now() }));
  ok('dag bestaat niet: melding, niets verstuurd', r.n === 0 && r.weg && /niet meer/.test(r.feed), r.feed.slice(0, 200));

  console.log('--- dag zonder scenario\'s ---');
  await p.goto(srv.TP, { waitUntil: 'load' });
  await p.evaluate(d => { const P = JSON.parse(localStorage.getItem('tp3:plans')); P.days[d].scenarios = []; localStorage.setItem('tp3:plans', JSON.stringify(P)); }, DAG);
  await herlaad();
  ok('dag-knop uit, met uitleg', await p.evaluate(() => { const d = document.querySelector('[data-a="dagMori"]'); return !!d && d.disabled && /scenario/i.test(d.title + ' ' + (document.getElementById(d.getAttribute('aria-describedby')) || {}).textContent); }));

  console.log('--- 4. de sleutel ---');
  const log = await p.evaluate(() => JSON.parse(sessionStorage.getItem('__tp3log') || '[]'));
  ok('er zijn tp3:mori-overdrachten geschreven', log.some(([k]) => k === 'tp3:mori'), log.map(x => x[0]).join());
  ok('geen sleutel in een tp3:*-schrijfactie of overdracht', log.every(([, v]) => !v.includes(N.NEP) && !/sk-ant/.test(v)));
  ok('geen sleutel in tp3:* in de opslag', await p.evaluate(k => Object.keys(localStorage).filter(x => /^tp3:/.test(x)).every(x => !localStorage.getItem(x).includes(k)), N.NEP));
  ok('geen sleutel in de verstuurde pakketten of vragen (alleen in de header)', !JSON.stringify(body).includes(N.NEP) && !JSON.stringify(v.map(x => x.body)).includes(N.NEP));
  ok('het plan leest de sleutel nooit', await p.evaluate(() => !window.__lees.includes('sj_ai_key')));
  ok('geen echte aanroep naar Anthropic', netwerkAnthropic === 0, netwerkAnthropic);

  console.log('--- journal: titel-terugval ---');
  await j.reload({ waitUntil: 'load' }); await j.waitForTimeout(1000);
  ok('journal: planTitel geeft "<pair> <playbook>" zonder titel', await j.evaluate(() => planTitel({ id: 's_x', title: '', pair: 'ETH', pb: 'London SFP' }) === 'ETH London SFP' && planTitel({ id: 's_x', title: 's_x', pair: 'SOL', pb: '' }) === 'SOL' && planTitel({ id: 's_x', title: 'Mijn titel', pair: 'BTC' }) === 'Mijn titel'));

  ok('geen JS-fouten', errs.length === 0, errs.join(' | '));
  await b.close(); srv.close();
  process.exit(T.eind());
})();
