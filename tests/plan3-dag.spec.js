// TradingPlan v3, taak 4: Dag-scherm (Cockpit) en Week-scherm.
//  (a) links de trechter week → dag → levels → charts → dagstart → gevoel; rechts de gerangschikte scenario's, één regel
//      "Live n · wr · gemR | Backtest n · wr · gemR" met plek en "sterkste"
//  (b) tik → open: trigger, ongeldig-als, geërfde tags, confirmations als afvinklijst met voortgangsbalk, edge-tabel,
//      stop/TP's, notitie; alles af → "Klaar om te nemen · 1% risico" (grade C met 0% → "C: niet traden")
//  (c) status met één tik, statusTs gezet · (d) mentaal ≤ 2 → "Overweeg alleen A-setups"; dagstart blokkeert niets
//  (e) scenario toevoegen, bewerken, verwijderen; playbook kiezen vult entry-laag en grade
//  (f) 390 breed: trechter ingeklapt tot dagstart en gevoel · (g) "Gisteren overnemen"
const { chromium } = require('playwright');
const H = require('./helpers/plan3'); const NAAM = 'Plan v3 dag';
const L = (tf, setups = [], confirmations = [], bias = '') => ({ tf, bias, setups, confirmations });
const leeg = () => ({ imgs: [], links: [] });
const sc = o => Object.assign({ title: o.pb, pair: 'BTC', dir: 'long', grade: 'B', trigger: '', invalid: '', entry: L('15M'), off: [], checked: [], stop: '', tps: [], media: leeg(), note: '', status: 'open', statusTs: null, trades: [] }, o);
const SCEN = [
  sc({ id: 's_tp', title: 'BTC trend-pullback', pb: 'Trend-pullback', grade: 'A', trigger: 'Als 15M een BOS zet boven 76.200', invalid: '4H close onder 75.000', entry: L('15M', ['BOS'], ['FVG'], 'Bullish'), stop: '75.020', tps: ['77.400', '78.150'], note: 'Niet vóór London open' }),
  sc({ id: 's_bb', title: 'Backtestbaas 1H', pb: 'Backtestbaas', entry: L('1H', ['BOS']), off: ['4H|MSB', '1H|OB'] }),
  sc({ id: 's_c', title: 'Gok zonder data', pb: 'Bestaat niet', grade: 'C', entry: L('5M', [], ['OB']) }),
];

(async () => {
  const srv = await H.server(), T = H.teller(NAAM), ok = T.ok;
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await H.alleenLokaal(ctx);
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e).split('\n')[0])); p.on('dialog', d => d.accept());
  await p.goto(srv.TP, { waitUntil: 'load' });
  await H.zaaiJournal(p, { trades: H.FIXTURE(), pbook: H.PBOOK });
  await p.evaluate(s => { const id = __tp3.vandaag(), wid = __tp3.isoWeek(id), P = __tp3.load();
    P.weeks[wid] = { id: wid, layers: [{ tf: 'Weekly', bias: 'Bullish', setups: ['BOS'], confirmations: [] }, { tf: 'Daily', bias: 'Bullish', setups: [], confirmations: ['Liquidity Sweep'] }], levels: 'BTC 78.150 weekly high', noTrade: 'do FOMC 19:00', focus: 'Alleen A-setups in London', media: { imgs: [], links: [] }, les: '' };
    P.days[id] = { id, week: wid, layers: [{ tf: '4H', bias: 'Bullish', setups: ['MSB'], confirmations: [] }, { tf: '1H', bias: '', setups: [], confirmations: ['OB'] }], levels: 'BTC 76.200 Asia-low', mental: null, pre: [false, false, false], media: { imgs: [], links: [] }, les: '', scenarios: s };
    __tp3.save(P); }, SCEN);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(500);

  console.log('--- (a) cockpit ---');
  const a = await p.evaluate(() => ({ stappen: [...document.querySelectorAll('.funnel .fstep h3')].map(x => x.textContent.trim().split(' ')[0]), rijen: [...document.querySelectorAll('.ritem')].map(r => ({ id: r.dataset.s, plek: r.querySelector('.rnum').textContent.trim(), sterk: !!r.querySelector('.tag-sterk'), lijn: r.querySelector('.rline').textContent.replace(/\s+/g, ' ').trim() })), txt: document.getElementById('app').innerText + ' ' + document.getElementById('d-levels').value }));
  ok('trechter: Week → Vandaag → Levels → Charts → Dagstart → Gevoel', a.stappen.join() === 'Week,Vandaag,Levels,Charts,Dagstart,Gevoel', a.stappen.join());
  ok('scenario\'s gerangschikt: Backtestbaas (+1,0R backtest) · trend-pullback (+0,58R live) · zonder data', a.rijen.map(r => r.id).join() === 's_bb,s_tp,s_c' && a.rijen.map(r => r.plek).join() === '1,2,3', JSON.stringify(a.rijen.map(r => r.id)));
  ok('regel: "Live 13 · 62% · +0,58R | Backtest 8 · 63% · +0,50R"', a.rijen[1].lijn === 'Live 13 · 62% · +0,58R | Backtest 8 · 63% · +0,50R', a.rijen[1].lijn);
  ok('regel Backtestbaas: "Live 3 · 67% · +0,33R | Backtest 12 · 67% · +1,0R"', a.rijen[0].lijn === 'Live 3 · 67% · +0,33R | Backtest 12 · 67% · +1,0R', a.rijen[0].lijn);
  ok('"sterkste" alleen op plek 1', a.rijen[0].sterk && !a.rijen[1].sterk && !a.rijen[2].sterk);
  ok('zonder data: "Nog geen trades met deze combinatie."', /Nog geen trades met deze combinatie/.test(a.rijen[2].lijn), a.rijen[2].lijn);
  // ronde 3 punt 6: de context-zin staat achter de ⓘ bij Vandaag
  await p.click('.funnel h3 [data-a="info"]'); await p.waitForTimeout(80); a.txt = await p.evaluate(() => document.getElementById('app').innerText + ' ' + document.getElementById('d-levels').value);
  ok('context één keer (achter de ⓘ): Weekly en Daily tellen niet mee', (a.txt.match(/tellen niet mee/g) || []).length === 1 && /Weekly en Daily tellen niet mee/.test(a.txt), (a.txt.match(/[^\n]*tellen niet mee[^\n]*/) || [''])[0]);
  await p.click('.funnel h3 [data-a="info"]');
  ok('week-focus en levels in beeld', /Alleen A-setups in London/.test(a.txt) && /78\.150/.test(a.txt) && /76\.200/.test(a.txt));

  console.log('--- (b) opengeklapt ---');
  await p.click('.ritem[data-s="s_tp"] .rrow'); await p.waitForTimeout(150);
  const o = await p.evaluate(() => { const r = document.querySelector('.ritem[data-s="s_tp"] .rdetail'); return r && { txt: r.innerText, chk: r.querySelectorAll('[data-a="chk"]').length, prog: !!r.querySelector('.prog'), tabel: !!r.querySelector('.etable'), erf: r.querySelectorAll('.chip.inh').length }; });
  ok('open: trigger, ongeldig-als, stop, TP\'s en notitie', o && /BOS zet boven 76\.200/.test(o.txt) && /4H close onder 75\.000/.test(o.txt) && /75\.020/.test(o.txt) && /77\.400 · 78\.150/.test(o.txt) && /Niet vóór London open/.test(o.txt), o && o.txt.slice(0, 300));
  ok('open: geërfde tags (4), afvinklijst (FVG) met voortgangsbalk, edge-tabel', o && o.erf === 4 && o.chk === 1 && o.prog && o.tabel, JSON.stringify(o && { erf: o.erf, chk: o.chk }));
  ok('nog niet klaar: geen groene staat', o && !/Klaar om te nemen/.test(o.txt));
  await p.click('.ritem[data-s="s_tp"] [data-a="chk"][data-v="FVG"]'); await p.waitForTimeout(120);
  const klaar = await p.evaluate(() => ({ txt: document.querySelector('.ritem[data-s="s_tp"]').innerText, ready: document.querySelector('.ritem[data-s="s_tp"]').classList.contains('ready'), checked: __tp3.dayOf(__tp3.vandaag()).scenarios.find(s => s.id === 's_tp').checked }));
  ok('alle confirmations af → groen "Klaar om te nemen · 1% risico", bewaard', klaar.ready && /Klaar om te nemen · 1% risico/.test(klaar.txt) && klaar.checked.join() === 'FVG', JSON.stringify(klaar.checked));
  await p.click('.ritem[data-s="s_c"] .rrow'); await p.click('.ritem[data-s="s_c"] [data-a="chk"][data-v="OB"]'); await p.waitForTimeout(120);
  ok('grade C met 0% → "Klaar om te nemen · C: niet traden"', /Klaar om te nemen · C: niet traden/.test(await p.evaluate(() => document.querySelector('.ritem[data-s="s_c"]').innerText)));
  await p.click('.ritem[data-s="s_tp"] .lrij[data-tf="Weekly"]'); await p.click('#modal .chip.inh[data-v="Weekly|BOS"]'); await p.click('#modal [data-a="close"]'); await p.waitForTimeout(80);
  ok('geërfde tag uitzetten in het opengeklapte scenario (tik op de laag, dan op de tag)', await p.evaluate(() => __tp3.dayOf(__tp3.vandaag()).scenarios.find(s => s.id === 's_tp').off.includes('Weekly|BOS')));

  console.log('--- (c) status ---');
  await p.click('.ritem[data-s="s_tp"] [data-a="status"][data-v="gemist"]'); await p.waitForTimeout(100);
  const st = await p.evaluate(() => __tp3.dayOf(__tp3.vandaag()).scenarios.find(s => s.id === 's_tp'));
  ok('één tik: status gemist, statusTs gezet', st.status === 'gemist' && st.statusTs > 1.7e12, st.status + ' ' + st.statusTs);
  ok('de rij toont de nieuwe status', await p.evaluate(() => /Gemist/.test(document.querySelector('.ritem[data-s="s_tp"] .schip').textContent)));
  await p.click('.ritem[data-s="s_tp"] [data-a="status"][data-v="open"]'); await p.waitForTimeout(80);
  ok('terug naar open: statusTs leeg', await p.evaluate(() => __tp3.dayOf(__tp3.vandaag()).scenarios.find(s => s.id === 's_tp').statusTs === null));

  console.log('--- (d) gevoel en dagstart ---');
  ok('zonder negatieve emotie geen waarschuwing', !/Overweeg alleen A-setups/.test(await p.evaluate(() => document.getElementById('app').innerText)));
  await p.evaluate(() => { const t = __tp3.tags(); t.emotionTags = ['FOMO', 'Rustig']; t.emotionNeg = ['FOMO']; localStorage.setItem('sj_tagconfig', JSON.stringify(t)); __tp3.render(); });
  await p.click('[data-a="emo"][data-v="FOMO"]'); await p.waitForTimeout(80);
  const m = await p.evaluate(() => ({ txt: document.getElementById('app').innerText, first: document.querySelector('#app .mentwarn') && document.querySelector('#app .mentwarn').getBoundingClientRect().top < document.querySelector('.cockpit').getBoundingClientRect().top }));
  ok('negatieve emotie (FOMO) → bovenaan "Overweeg alleen A-setups"', /Overweeg alleen A-setups/.test(m.txt) && m.first);
  ok('dagstart niet af: "Zet om in trade" blijft klikbaar', await p.evaluate(() => { const k = document.querySelector('.ritem[data-s="s_tp"] [data-a="convert"]'); return !!k && !k.disabled; }));
  await p.click('[data-a="ds"][data-v="Nieuws gecheckt"]'); await p.waitForTimeout(80);
  ok('dagstart-vinkje bewaard (op tekst)', await p.evaluate(() => __tp3.dayOf(__tp3.vandaag()).dagstart.join() === 'Nieuws gecheckt'));
  await p.fill('#d-levels', 'BTC 76.200 Asia-low\nETH 3.480 4H OB');
  ok('levels van de dag bewaard', await p.evaluate(() => /ETH 3\.480/.test(__tp3.dayOf(__tp3.vandaag()).levels)));
  await H.vierShots(p, 'dag', async q => { await q.click('.ritem[data-s="s_tp"] .rrow'); await q.waitForTimeout(150); });

  console.log('--- (e) toevoegen, bewerken, verwijderen ---');
  await p.click('[data-a="newScen"]'); await p.waitForTimeout(120);
  await p.selectOption('#sc-pb', 'Trend-pullback'); await p.waitForTimeout(120);
  const vul = await p.evaluate(() => ({ tf: document.querySelector('#sc-tf').value, grade: (document.querySelector('#modal [data-a="dset"][data-p="grade"].on') || {}).textContent, chips: [...document.querySelectorAll('#modal .lrij .chip:not(.inh):not(.meer)')].map(x => x.textContent.trim()) }));
  ok('playbook kiezen: entry-laag 15M met BOS, FVG, OB en grade A uit het journal-playbook', vul.tf === '15M' && vul.grade === 'A' && vul.chips.join() === 'BOS,FVG,OB', JSON.stringify(vul));
  ok('het formulier toont de edge van de combinatie', /Live \d+/.test(await p.evaluate(() => document.querySelector('#modal').innerText)));
  await p.fill('#sc-title', 'Nieuw <b>scenario</b>'); await p.fill('#sc-pair', 'eth/usdt'); await p.click('#modal [data-a="dset"][data-p="dir"][data-v="short"]');
  await p.click('#modal [data-a="saveScen"]'); await p.waitForTimeout(150);
  const nieuw = await p.evaluate(() => __tp3.dayOf(__tp3.vandaag()).scenarios.slice(-1)[0]);
  ok('toegevoegd: pair ETH, short, Trend-pullback', nieuw.pair === 'ETH' && nieuw.dir === 'short' && nieuw.pb === 'Trend-pullback', JSON.stringify({ pair: nieuw.pair, dir: nieuw.dir }));
  ok('titel met HTML als tekst getoond', await p.evaluate(() => !document.querySelector('#app .ritem b b') && /Nieuw <b>scenario<\/b>/.test(document.getElementById('app').innerText)));
  await p.click(`.ritem[data-s="${nieuw.id}"] .rrow`); await p.click(`.ritem[data-s="${nieuw.id}"] [data-a="editScen"]`); await p.waitForTimeout(100);
  await p.fill('#sc-title', 'ETH short'); await p.click('#modal [data-a="saveScen"]'); await p.waitForTimeout(100);
  ok('bewerkt: titel ETH short', await p.evaluate(id => __tp3.dayOf(__tp3.vandaag()).scenarios.find(s => s.id === id).title === 'ETH short', nieuw.id));
  await p.click(`.ritem[data-s="${nieuw.id}"] [data-a="editScen"]`); await p.click('#modal [data-a="delScen"]'); await p.click('#modal [data-a="delJa"]');   /* round 5: confirm in the page */ await p.waitForTimeout(100);
  ok('verwijderd', await p.evaluate(id => !__tp3.dayOf(__tp3.vandaag()).scenarios.some(s => s.id === id), nieuw.id));

  console.log('--- (f) telefoon ---');
  await p.setViewportSize({ width: 390, height: 900 }); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(300);
  const tel = await p.evaluate(() => [...document.querySelectorAll('.funnel .fstep')].filter(x => x.offsetParent).map(x => x.querySelector('h3').textContent.trim()));
  ok('390 breed: trechter ingeklapt tot Dagstart en Gevoel', tel.join() === 'Dagstart,Gevoel', tel.join());
  await p.click('[data-a="ctx"]'); await p.waitForTimeout(80);
  ok('uitklappen toont de hele trechter', await p.evaluate(() => [...document.querySelectorAll('.funnel .fstep')].filter(x => x.offsetParent).length === 6));
  ok('390 breed: geen horizontale scroll', await p.evaluate(() => document.documentElement.scrollWidth <= 391));
  await p.setViewportSize({ width: 1280, height: 900 });

  console.log('--- kleur (polish punt 2) ---');
  await p.evaluate(() => { const P = __tp3.load(); P.days[__tp3.vandaag()].scenarios.find(s => s.id === 's_c').status = 'gemist'; __tp3.save(P); __tp3.render(); });
  const kl = await p.evaluate(() => {
    const tok = (v, prop = 'color') => { const e = document.createElement('i'); e.style[prop] = `var(${v})`; document.body.appendChild(e); const c = getComputedStyle(e)[prop]; e.remove(); return c; };
    const rand = id => getComputedStyle(document.querySelector(`.ritem[data-s="${id}"]`)).borderLeftColor, br = id => parseFloat(getComputedStyle(document.querySelector(`.ritem[data-s="${id}"]`)).borderLeftWidth);
    const tabs = []; for (const k of ['week', 'dag', 'afsluiting', 'log']) { document.querySelector(`nav.tabs [data-v="${k}"]`).click(); tabs.push(getComputedStyle(document.querySelector('nav.tabs button.on')).borderBottomColor); }
    document.querySelector('nav.tabs [data-v="dag"]').click();
    const stip = [...document.querySelectorAll('.funnel .fstep')].map(f => getComputedStyle(f, '::after').borderTopColor);
    const g = document.querySelector('.ritem[data-s="s_tp"] .grade');
    return { open: rand('s_bb'), gemist: rand('s_c'), breed: br('s_bb'), accent: tok('--accent'), amber: tok('--amber'), green: tok('--green'), greenSoft: tok('--green-soft', 'backgroundColor'),
      grade: [getComputedStyle(g).color, getComputedStyle(g).backgroundColor], tabs, stip,
      palet: ['--accent', '--green', '--red', '--amber', '--teal', '--violet', '--pink'].map(v => tok(v)) };
  });
  ok('scenario-kaart: linkerrand naar status (open accent, gemist amber), minstens 3px', kl.open === kl.accent && kl.gemist === kl.amber && kl.breed >= 3, JSON.stringify([kl.open, kl.gemist, kl.breed]));
  ok('grade A: groene badge', kl.grade[0] === kl.green && kl.grade[1] === kl.greenSoft, JSON.stringify(kl.grade));
  ok('trechter: elke stap een eigen kleur uit de palette', kl.stip.length === 6 && new Set(kl.stip).size === 6 && kl.stip.every(c => kl.palet.includes(c)), JSON.stringify(kl.stip));
  ok('actieve tab: een eigen gekleurde onderstreping per tab', new Set(kl.tabs).size === 4 && kl.tabs.every(c => kl.palet.includes(c)), JSON.stringify(kl.tabs));
  await p.evaluate(() => { const P = __tp3.load(); P.days[__tp3.vandaag()].scenarios.find(s => s.id === 's_c').status = 'open'; __tp3.save(P); __tp3.render(); });

  console.log('--- (g) gisteren overnemen ---');
  await p.evaluate(() => { const id = __tp3.vandaag(), P = __tp3.load(), d = P.days[id], gis = new Date(id + 'T12:00:00Z'); gis.setUTCDate(gis.getUTCDate() - 1); const gid = gis.toISOString().slice(0, 10);
    d.id = gid; d.week = __tp3.isoWeek(gid); d.scenarios.forEach((s, i) => { s.status = i === 1 ? 'genomen' : 'open'; s.checked = ['FVG']; }); P.days[gid] = d; delete P.days[id]; __tp3.save(P); });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(300);
  ok('lege dag met knop "Gisteren overnemen"', await p.evaluate(() => /Gisteren overnemen/.test((document.querySelector('[data-a="overnemen"]') || {}).textContent || '')));
  await p.click('[data-a="overnemen"]'); await p.waitForTimeout(150);
  const ov = await p.evaluate(() => { const P = __tp3.load(), ids = Object.keys(P.days).sort(), g = P.days[ids[0]], v = P.days[ids[1]]; return { n: ids.length, tfs: v.layers.map(l => l.tf).join(), lv: v.levels, sc: v.scenarios.map(s => ({ t: s.title, st: s.status, ch: s.checked.length, nieuw: !g.scenarios.some(x => x.id === s.id) })), pre: v.pre, gisteren: g.scenarios.length }; });
  ok('lagen en levels gekopieerd', ov.n === 2 && ov.tfs === '4H,1H' && /ETH 3\.480/.test(ov.lv), JSON.stringify(ov).slice(0, 200));
  ok('alleen de open scenario\'s (2 van 3), status open, nieuw id, afvinklijst leeg', ov.sc.length === 2 && ov.sc.every(s => s.st === 'open' && s.nieuw && s.ch === 0), JSON.stringify(ov.sc));
  ok('gisteren blijft zoals hij was', ov.gisteren === 3);

  console.log('--- Week-scherm ---');
  await p.click('nav.tabs [data-v="week"]'); await p.waitForTimeout(100);
  const wk = await p.evaluate(() => ({ lagen: [...document.querySelectorAll('#app .lrij .tf')].map(x => x.textContent).join(), nt: document.querySelector('[data-f="week.noTrade"]').value, focus: document.querySelector('[data-f="week.focus"]').value, lv: document.querySelector('[data-f="week.levels"]').value }));
  ok('week: lagen Weekly · Daily, levels, no-trade, focus', wk.lagen === 'Weekly,Daily' && wk.nt === 'do FOMC 19:00' && /Alleen A-setups/.test(wk.focus) && /78\.150/.test(wk.lv), JSON.stringify(wk));
  await p.fill('[data-f="week.focus"]', 'Na 2 verliezen stoppen');
  ok('focus bewaard', await p.evaluate(() => { const P = __tp3.load(); return P.weeks[__tp3.isoWeek(__tp3.vandaag())].focus === 'Na 2 verliezen stoppen'; }));
  const ws = await H.vierShots(p, 'week', async q => { await q.click('nav.tabs [data-v="week"]'); await q.waitForTimeout(100); });
  ok('week 390 breed: geen horizontale scroll', !ws.licht && !ws.donker);

  console.log('--- playbook-criteria bij een scenario (polish punt 6) ---');
  const PB6 = Object.assign({}, H.PBOOK, { 'Trend-pullback': Object.assign({}, H.PBOOK['Trend-pullback'], { criteria: [{ text: 'HTF-trend mee', mandatory: true }, { text: 'Volume boven gemiddeld', mandatory: false }, { text: '', mandatory: true }],
    antiCriteria: [{ text: 'Vlak voor nieuws', mandatory: false }], stop: 'Onder de sweep', target: '2R', minRR: '2' }), 'Oud': ['Alleen in London'] });
  await H.zaaiJournal(p, { trades: H.FIXTURE(), pbook: PB6 });
  await p.evaluate(() => { const id = __tp3.vandaag(), P = { v: 1, weeks: {}, days: {} };
    const sc = (id, pb, conf, extra) => Object.assign({ id, title: id, pair: 'BTC', dir: 'long', pb, grade: 'A', trigger: '', invalid: '', entry: { tf: '15M', bias: '', setups: [], confirmations: conf }, off: [], checked: [], stop: '', tps: [], media: { imgs: [], links: [] }, note: '', status: 'open', statusTs: null, trades: [] }, extra || {});
    P.days[id] = { id, week: __tp3.isoWeek(id), layers: [], levels: '', mental: null, pre: [false, false, false], media: { imgs: [], links: [] }, les: '', scenarios: [sc('s_kr', 'Trend-pullback', ['FVG']), sc('s_zc', 'Backtestbaas', ['OB'], { checked: ['OB'] })] };
    localStorage.setItem('tp3:plans', JSON.stringify(P)); });
  await p.setViewportSize({ width: 1280, height: 900 }); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(500);
  await p.click('nav.tabs [data-v="dag"]').catch(() => {});
  ok('oud scenario zonder critChecked → [] na het laden', await p.evaluate(() => JSON.stringify(__tp3.dayOf(__tp3.vandaag()).scenarios.map(s => s.critChecked)) === '[[],[]]'));
  ok('oud playbook-formaat (lijst met teksten) wordt criteria', await p.evaluate(() => JSON.stringify(__tp3.pbInfo('Oud').criteria) === JSON.stringify([{ text: 'Alleen in London', mandatory: false }])));
  await p.click('[data-a="newScen"]'); await p.selectOption('#sc-pb', 'Trend-pullback'); await p.waitForTimeout(120);
  let pbt = await p.evaluate(() => (document.querySelector('#modal .pbcrit') || {}).innerText || '');
  ok('playbook kiezen: de criteria verschijnen meteen, de verplichte gemarkeerd', /HTF-trend mee\s*verplicht/i.test(pbt) && /Volume boven gemiddeld/.test(pbt) && !/Volume boven gemiddeld\s*verplicht/i.test(pbt), pbt);
  ok('anti-criteria als "Niet als …", en stop / target / min. R:R op één regel', /Niet als: Vlak voor nieuws/.test(pbt) && /Stop Onder de sweep · Target 2R · Min\. R:R 2/.test(pbt.replace(/\s+/g, ' ')), pbt);
  ok('een leeg criterium telt niet mee', (await p.evaluate(() => document.querySelectorAll('#modal .pbcrit .crit').length)) === 2);
  await p.selectOption('#sc-pb', 'Backtestbaas'); await p.waitForTimeout(120);
  pbt = await p.evaluate(() => { const b = document.querySelector('#modal .pbcrit'); return b ? { t: b.innerText, href: (b.querySelector('a') || {}).href || '' } : null; });
  ok('playbook zonder criteria: geen leeg blok, wel "Dit playbook heeft nog geen criteria" met een link naar het playbook', pbt && /Dit playbook heeft nog geen criteria/.test(pbt.t) && /page=playbook&pb=Backtestbaas/.test(pbt.href), JSON.stringify(pbt));
  await p.click('#modal [data-a="close"]'); await p.waitForTimeout(80);
  await p.click('.ritem[data-s="s_kr"] .rrow'); await p.waitForTimeout(120);
  await p.click('.ritem[data-s="s_kr"] [data-a="critOpen"]'); await p.waitForTimeout(80);   // criteria are closed by default (round 3, point 8; plan3-criteria)
  const det = () => p.evaluate(() => { const r = document.querySelector('.ritem[data-s="s_kr"]'); return { crit: [...r.querySelectorAll('[data-a="crit"]')].map(x => x.dataset.v), anti: [...r.querySelectorAll('.anti')].map(x => x.innerText.trim()), antiKlik: !!r.querySelector('.anti [data-a]'), ready: r.classList.contains('ready') }; });
  let d6 = await det();
  ok('opengeklapt: criteria als afvinklijst naast de confirmations', d6.crit.join() === 'HTF-trend mee,Volume boven gemiddeld', JSON.stringify(d6));
  ok('anti-criteria als waarschuwing (amber), niet af te vinken', d6.anti.length === 1 && /Niet als: Vlak voor nieuws/.test(d6.anti[0]) && !d6.antiKlik && await p.evaluate(() => { const e = document.createElement('i'); e.style.color = 'var(--amber)'; document.body.appendChild(e); const c = getComputedStyle(e).color; e.remove(); return getComputedStyle(document.querySelector('.ritem[data-s="s_kr"] .anti')).color === c; }), JSON.stringify(d6.anti));
  await p.click('.ritem[data-s="s_kr"] [data-a="chk"][data-v="FVG"]'); await p.click('.ritem[data-s="s_kr"] [data-a="crit"][data-v="Volume boven gemiddeld"]'); await p.waitForTimeout(100);
  ok('alle confirmations af, verplicht criterium nog niet: nog niet klaar', !(await det()).ready);
  await p.click('.ritem[data-s="s_kr"] [data-a="crit"][data-v="HTF-trend mee"]'); await p.waitForTimeout(100);
  ok('ook het verplichte criterium af: "Klaar om te nemen"', (await det()).ready && /Klaar om te nemen/.test(await p.evaluate(() => document.querySelector('.ritem[data-s="s_kr"]').innerText)));
  ok('afgevinkt bewaard in critChecked', await p.evaluate(() => __tp3.dayOf(__tp3.vandaag()).scenarios[0].critChecked.slice().sort().join() === 'HTF-trend mee,Volume boven gemiddeld'));
  ok('playbook zonder criteria: klaar zoals vroeger (alleen de confirmations)', await p.evaluate(() => { __tp3.S.open.s_zc = true; __tp3.render(); const r = document.querySelector('.ritem[data-s="s_zc"]'); return r.classList.contains('ready') && /Dit playbook heeft nog geen criteria/.test(r.innerText) && !r.querySelector('[data-a="crit"]'); }));
  PB6['Trend-pullback'].criteria = [{ text: 'HTF-trend mee (4H)', mandatory: true }, { text: 'Volume boven gemiddeld', mandatory: false }];
  await H.zaaiJournal(p, { trades: H.FIXTURE(), pbook: PB6 }); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(500);
  await p.click('.ritem[data-s="s_kr"] .rrow'); await p.waitForTimeout(120); await p.click('.ritem[data-s="s_kr"] [data-a="critOpen"]'); await p.waitForTimeout(80);
  d6 = await det();
  ok('playbook gewijzigd in de journal: het scenario volgt de nieuwe tekst, het vinkje van de oude valt weg', d6.crit.join() === 'HTF-trend mee (4H),Volume boven gemiddeld' && !d6.ready && await p.evaluate(() => __tp3.dayOf(__tp3.vandaag()).scenarios[0].critChecked.join() === 'Volume boven gemiddeld'), JSON.stringify(d6));
  await H.vierShots(p, 'criteria', async q => { await q.click('.ritem[data-s="s_kr"] .rrow'); await q.click('.ritem[data-s="s_kr"] [data-a="critOpen"]'); await q.waitForTimeout(120); });
  await H.vierShots(p, 'criteria-form', async q => { await q.click('.ritem[data-s="s_kr"] .rrow'); await q.click('.ritem[data-s="s_kr"] [data-a="editScen"]'); await q.waitForTimeout(120); });
  await H.zaaiJournal(p, { trades: H.FIXTURE(), pbook: H.PBOOK });

  console.log('--- één lettertype en één typeschaal (polish punt 5) ---');
  const SCHAAL = [12, 13.5, 15, 19];
  const typo = () => p.evaluate(() => { const fam = new Set(), maat = new Set(), hoofd = new Set(), nums = [];
    document.querySelectorAll('body *:not(svg):not(svg *):not(script):not(style)').forEach(e => { if (!e.getClientRects().length) return; const c = getComputedStyle(e);
      const tekst = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(e.tagName);
      if (!tekst) return; fam.add(c.fontFamily); maat.add(parseFloat(c.fontSize));
      if (c.textTransform === 'uppercase') hoofd.add([c.fontSize, c.fontWeight, c.letterSpacing].join(' '));
      if (/\d/.test(e.textContent) && c.fontVariantNumeric !== 'tabular-nums') nums.push(e.className || e.tagName); });
    return { fam: [...fam], maat: [...maat].sort((a, b) => a - b), hoofd: [...hoofd], nums: [...new Set(nums)].slice(0, 5) }; });
  const schermen = [['Dag (opengeklapt)', async () => { await p.click('nav.tabs [data-v="dag"]'); await p.click('.ritem .rrow'); }], ['scenario-formulier', async () => { await p.click('[data-a="newScen"]'); }],
    ['Week', async () => { await p.click('#modal [data-a="close"]'); await p.click('nav.tabs [data-v="week"]'); }], ['Afsluiting', async () => { await p.click('nav.tabs [data-v="afsluiting"]'); }], ['Log', async () => { await p.click('nav.tabs [data-v="log"]'); }]];
  await p.evaluate(() => { const P = __tp3.load(); const d = P.days[Object.keys(P.days).sort().pop()]; if (d) { const id = __tp3.vandaag(); if (!P.days[id]) { P.days[id] = Object.assign({}, d, { id, week: __tp3.isoWeek(id) }); } __tp3.save(P); } });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(400);
  for (const [naam, ga] of schermen) { await ga(); await p.waitForTimeout(150); const t = await typo();
    ok(`${naam}: alleen Inter (geen monospace)`, t.fam.every(f => /^Inter\b/.test(f) || /^"?Plus Jakarta Sans/.test(f)) && !t.fam.some(f => /mono|Plex/i.test(f)), JSON.stringify(t.fam));
    ok(`${naam}: hooguit vier groottes (12 / 13,5 / 15 / 19)`, t.maat.every(m => SCHAAL.includes(m)), JSON.stringify(t.maat));
    ok(`${naam}: labels in hoofdletters één stijl`, t.hoofd.length <= 1, JSON.stringify(t.hoofd));
    ok(`${naam}: getallen met tabular-nums`, !t.nums.length, JSON.stringify(t.nums)); }
  ok('geen --fn of IBM Plex Mono meer in het plan', !/--fn|IBM Plex Mono|monospace/.test(require('fs').readFileSync(require('path').join(H.ROOT, 'tradingplan/tradingplan.html'), 'utf8')));

  ok('geen JS-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close(); srv.close(); process.exit(T.eind());
})();
