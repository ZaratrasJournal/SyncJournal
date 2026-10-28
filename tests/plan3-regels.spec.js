// TradingPlan v3, ronde 3 punt 6: het blok "Vandaag" overzichtelijk.
//  - elk tijdframe is een eigen laag: één regel (kaartje) met tijdframe · bias (leeg = "bias?") · tags, lange lijst "+N"
//  - tikken op een regel = bewerken in het venster "Tags · 4H": bias bovenaan, "Laag weghalen" onderaan; geen "+ tag"
//    en geen × op de regels zelf
//  - de week apart en compact bovenaan ("Week · Weekly Bullish · …", tik = weekplan); week-tags op een tijdframe dat
//    ook in de dag staat: gestippeld in die dag-regel, voor vandaag uit te zetten in het venster
//  - de uitleg ("… tellen niet mee in de edge") achter een ⓘ naast de kop; "+ Tijdframe" als één kleine link
//  - afbeeldingen en links in een eigen trechter-stap "Charts"
//  - dezelfde regel in het Week-scherm, in een opengeklapt scenario en in het scenario-formulier
const { chromium } = require('playwright'); const path = require('path');
const H = require('./helpers/plan3'); const SHOTS = H.SHOTS;
const NAAM = 'Plan v3 regels (punt 6)';
const TAGS = { setupTags: ['BOS', 'MSB', 'SFP', 'Range'], confirmationTags: ['Liquidity Sweep', 'OB', 'FVG', 'EQL/EQH', 'Support OB', 'Flat candle'], timeframeTags: ['5M', '15M', '1H', '4H', 'Daily', 'Weekly'], emotionTags: ['FOMO'], mistakeTags: [], missedReasonTags: [], customTags: [] };
const L = (tf, setups = [], confirmations = [], bias = '') => ({ tf, bias, setups, confirmations });
const leeg = () => ({ imgs: [], links: [] });

(async () => {
  const srv = await H.server(), T = H.teller(NAAM), ok = T.ok;
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await H.alleenLokaal(ctx);
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e).split('\n')[0])); p.on('dialog', d => d.accept());
  await p.addInitScript(t => { localStorage.setItem('sj_tagconfig', JSON.stringify(t)); }, TAGS);
  await p.goto(srv.TP, { waitUntil: 'load' });
  await H.zaaiJournal(p, { trades: H.FIXTURE(), pbook: H.PBOOK });
  const zaai = () => p.evaluate(({ W, D }) => { const id = __tp3.vandaag(), wid = __tp3.isoWeek(id);
    localStorage.setItem('tp3:plans', JSON.stringify({ v: 1, weeks: { [wid]: Object.assign({ id: wid, levels: '', noTrade: 'do FOMC 19:00', focus: '', media: { imgs: [], links: [] }, les: '' }, W) },
      days: { [id]: Object.assign({ id, week: wid, levels: '', mental: null, dagstart: [], emoties: [], off: [], media: { imgs: [], links: ['https://example.com/chart'] }, les: '' }, D) } })); },
  { W: { layers: [L('Weekly', ['BOS'], [], 'Bullish'), L('Daily', [], ['Liquidity Sweep'], 'Bullish'), L('4H', [], ['OB'], 'Bullish')] },
    D: { layers: [L('4H', ['MSB', 'SFP', 'Range'], ['FVG', 'EQL/EQH', 'Support OB', 'Flat candle']), L('1H', [], ['OB'], 'Bearish'), L('15M')],
      scenarios: [{ id: 's_tp', title: 'BTC trend-pullback', pair: 'BTC', dir: 'long', pb: 'Trend-pullback', grade: 'A', trigger: '', invalid: '', entry: L('15M', ['BOS'], ['FVG'], 'Bullish'), off: [], checked: [], critChecked: [], stop: '', tps: [], media: leeg(), note: '', status: 'open', statusTs: null, trades: [] }] } });
  await zaai(); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(500);
  const dag = () => p.evaluate(() => __tp3.dayOf(__tp3.vandaag()));

  console.log('--- Vandaag: één regel per laag ---');
  const v = await p.evaluate(() => { const st = [...document.querySelectorAll('.funnel .fstep')].find(x => /^Vandaag/.test(x.querySelector('h3').textContent.trim()));
    const rijen = [...st.querySelectorAll('.lrij')];
    return { tfs: rijen.map(r => r.dataset.tf), knop: rijen.every(r => r.tagName === 'BUTTON' && !r.querySelector('button')),
      hoog: rijen.map(r => r.getBoundingClientRect().height), kind: rijen.map(r => [...r.children].map(c => c.classList[0]).join(' ')),
      bias: rijen.map(r => { const x = r.querySelector('.bias'); return x ? x.textContent + (x.classList.contains('erf') ? '(erf)' : '') + (x.classList.contains('leeg') ? '(leeg)' : '') : ''; }),
      plus: !!st.querySelector('.chip.add,[data-a="rmtag"],.lrm,[data-a="rmLaag"]'), media: !!st.querySelector('.media'),
      meer: (rijen[0].querySelector('.meer:not([hidden])') || {}).textContent || '', zicht: [...rijen[0].querySelectorAll('.lchips .chip')].filter(c => !c.hidden).length,
      kaart: getComputedStyle(rijen[0]).borderTopStyle + ' ' + (parseFloat(getComputedStyle(rijen[0]).borderTopLeftRadius) > 0),
      tussen: rijen[1].getBoundingClientRect().top - rijen[0].getBoundingClientRect().bottom,
      week: (st.querySelector('.weekregel') || {}).textContent || '', weekA: (st.querySelector('.weekregel') || { dataset: {} }).dataset.a,
      ctxZicht: /tellen niet mee/.test(st.innerText), info: !!st.querySelector('h3 [data-a="info"]'),
      tfLink: [...st.querySelectorAll('[data-a="tfPicker"]')].map(x => x.textContent.trim()) }; });
  ok('de dag-lagen als regels, top-down: 4H, 1H, 15M (week-tijdframes niet als eigen regel)', v.tfs.join() === '4H,1H,15M', v.tfs.join());
  ok('elke regel is één knop (tikken = bewerken), zonder knoppen erin', v.knop);
  ok('een regel is een kaartje: eigen rand en ronde hoeken, met ruimte ertussen', /^solid true$/.test(v.kaart) && v.tussen >= 4, v.kaart + ' / ' + v.tussen);
  ok('elke regel is één regel hoog (ook met zeven tags)', v.hoog.every(h => h < 40), v.hoog.join());
  ok('volgorde op de regel: tijdframe · bias · tags', v.kind.every(k => /^tf bias lchips/.test(k)), JSON.stringify(v.kind));
  ok('bias: eigen gevuld, week-bias gestippeld, leeg = grijze "bias?"', v.bias.join() === 'Bullish(erf),Bearish,bias?(leeg)', v.bias.join());
  ok('lange tag-lijst: afgekapt met "+N" in plaats van een tweede regel', /^\+\d$/.test(v.meer) && v.zicht + +v.meer.slice(1) === 8, v.meer + ' / ' + v.zicht);
  ok('geen "+ tag", geen × en geen afbeeldingen meer in Vandaag', !v.plus && !v.media);
  ok('week apart en compact bovenaan: "Week · Weekly Bullish · Daily Bullish · 4H Bullish"', v.week.trim() === 'Week · Weekly Bullish · Daily Bullish · 4H Bullish' && v.weekA === 'tab', v.week);
  ok('de context-uitleg staat achter een ⓘ naast de kop (dicht: niet in beeld)', v.info && !v.ctxZicht);
  ok('"+ Tijdframe" is één kleine link onder de regels', v.tfLink.join() === '+ Tijdframe', v.tfLink.join());
  await p.click('.funnel h3 [data-a="info"]'); await p.waitForTimeout(80);
  const info = await p.evaluate(() => (document.querySelector('.funnel .infotxt') || {}).textContent || '');
  ok('ⓘ open: "Weekly en Daily tellen niet mee in de edge …" en de uitleg over gestippeld', /Weekly en Daily tellen niet mee in de edge/.test(info) && /Gestippeld = uit je weekplan/.test(info), info);
  await p.click('.funnel h3 [data-a="info"]');
  const charts = await p.evaluate(() => { const st = [...document.querySelectorAll('.funnel .fstep')]; return { kop: st.map(x => x.querySelector('h3').textContent.trim().split(/\s/)[0]).join(), media: st.filter(x => x.querySelector('.media')).map(x => x.querySelector('h3').textContent.trim()) }; });
  ok('trechter: Week → Vandaag → Levels → Charts → Dagstart → Gevoel', charts.kop === 'Week,Vandaag,Levels,Charts,Dagstart,Gevoel', charts.kop);
  ok('afbeeldingen en links staan alleen in de stap "Charts"', charts.media.join() === 'Charts', charts.media.join());

  console.log('--- tikken = bewerken ---');
  await p.click('.funnel .lrij[data-tf="4H"]'); await p.waitForTimeout(120);
  const m = await p.evaluate(() => { const mo = document.getElementById('modal'); const kop = [...mo.querySelectorAll('.mb h3')].map(x => x.textContent.trim());
    return { titel: (mo.querySelector('.mh h2') || {}).textContent, kop, eerst: mo.querySelector('.mb').firstElementChild.textContent.trim(), bias: mo.querySelectorAll('[data-a="bias"]').length,
      weg: (mo.querySelector('.mf [data-a="rmLaag"]') || {}).textContent || '', erf: [...mo.querySelectorAll('.chip.inh')].map(x => x.dataset.v + ':' + x.dataset.a) }; });
  ok('venster "Tags · 4H"', m.titel === 'Tags · 4H', m.titel);
  ok('bovenaan de bias (drie knoppen)', m.eerst === 'Bias' && m.bias === 3, JSON.stringify(m.kop));
  ok('de week-tag op 4H staat erin, voor vandaag uit te zetten', m.erf.join() === '4H|OB:dagOff', m.erf.join());
  ok('onderaan "Laag weghalen"', m.weg === 'Laag weghalen', m.weg);
  await p.click('#modal [data-a="bias"][data-v="Bullish"]'); await p.click('#modal [data-a="pick"][data-v="BOS"]'); await p.click('#modal .chip.inh[data-v="4H|OB"]'); await p.waitForTimeout(80);
  let d = await dag();
  ok('bias, tag en uitzetten in het venster: bewaard op de dag', d.layers[0].bias === 'Bullish' && d.layers[0].setups.includes('BOS') && d.off.join() === '4H|OB', JSON.stringify({ L: d.layers[0], off: d.off }));
  await p.click('#modal [data-a="close"]'); await p.waitForTimeout(80);
  const na = await p.evaluate(() => { const r = document.querySelector('.funnel .lrij[data-tf="4H"]'); return { bias: r.querySelector('.bias').textContent, uit: !!r.querySelector('.chip.inh.off[data-v="4H|OB"]') }; });
  ok('de regel toont het meteen: Bullish, en de week-tag doorgestreept', na.bias === 'Bullish' && na.uit, JSON.stringify(na));
  await p.click('.funnel .lrij[data-tf="15M"]'); await p.click('#modal .mf [data-a="rmLaag"]'); await p.waitForTimeout(100);
  d = await dag();
  ok('"Laag weghalen": 15M weg en het venster dicht', d.layers.map(x => x.tf).join() === '4H,1H' && !(await p.evaluate(() => !!document.querySelector('#modal .modal'))), d.layers.map(x => x.tf).join());
  await p.click('.funnel [data-a="tfPicker"]'); await p.waitForTimeout(80);
  const keuze = await p.evaluate(() => [...document.querySelectorAll('.funnel [data-a="addTf"]')].map(x => x.dataset.v));
  ok('"+ Tijdframe": alle journal-tijdframes die nog geen dag-laag zijn, ook die van de week', keuze.join() === 'Weekly,Daily,15M,5M', keuze.join());
  await p.click('.funnel [data-a="addTf"][data-v="Daily"]'); await p.waitForTimeout(100);
  const daily = await p.evaluate(() => { const r = document.querySelector('.funnel .lrij[data-tf="Daily"]'); return r && { erf: [...r.querySelectorAll('.chip.inh')].map(x => x.textContent), bias: r.querySelector('.bias').className }; });
  ok('Daily als dag-laag: de week-tag gestippeld in die regel, de week-bias gestippeld', daily && daily.erf.join() === 'Liquidity Sweep' && /erf/.test(daily.bias), JSON.stringify(daily));
  await p.click('.funnel .weekregel'); await p.waitForTimeout(100);
  ok('tik op de week-regel: naar het weekplan', await p.evaluate(() => __tp3.S.tab === 'week'));

  console.log('--- Week-scherm: dezelfde regel ---');
  const wk = await p.evaluate(() => [...document.querySelectorAll('#app .lrij')].map(r => r.dataset.tf + ':' + r.tagName + ':' + (r.querySelector('.bias') || {}).textContent));
  ok('Week: Weekly, Daily, 4H als regels met hun bias', wk.join() === 'Weekly:BUTTON:Bullish,Daily:BUTTON:Bullish,4H:BUTTON:Bullish', wk.join());
  await p.click('#app .lrij[data-tf="Daily"]'); await p.waitForTimeout(80);
  ok('tik: hetzelfde venster, met bias en "Laag weghalen"', await p.evaluate(() => document.querySelector('#modal .mh h2').textContent === 'Tags · Daily' && document.querySelectorAll('#modal [data-a="bias"]').length === 3 && !!document.querySelector('#modal .mf [data-a="rmLaag"]')));
  await p.click('#modal [data-a="bias"][data-v="Bearish"]'); await p.click('#modal [data-a="close"]'); await p.waitForTimeout(80);
  ok('week-bias Daily nu Bearish', await p.evaluate(() => __tp3.weekOf(__tp3.isoWeek(__tp3.vandaag())).layers[1].bias === 'Bearish'));
  await p.click('[data-a="tab"][data-v="dag"]'); await p.waitForTimeout(80);

  console.log('--- opengeklapt scenario en formulier: dezelfde regel ---');
  await p.click('.ritem[data-s="s_tp"] .rrow'); await p.waitForTimeout(120);
  const sc = await p.evaluate(() => { const r = document.querySelector('.ritem[data-s="s_tp"] .rdetail'); return { rij: [...r.querySelectorAll('.lrij')].map(x => x.dataset.tf), entry: !!r.querySelector('.lrij[data-tf="15M"] .entrymark'), knop: [...r.querySelectorAll('.lrij')].every(x => x.tagName === 'BUTTON' && !x.querySelector('button')), hoog: [...r.querySelectorAll('.lrij')].every(x => x.getBoundingClientRect().height < 40) }; });
  ok('scenario: één regel per tijdframe (week + dag + entry), één regel hoog', sc.rij.join() === 'Weekly,Daily,4H,1H,15M' && sc.entry && sc.knop && sc.hoog, JSON.stringify(sc));
  await p.click('.ritem[data-s="s_tp"] .lrij[data-tf="Weekly"]'); await p.waitForTimeout(80);
  const sm = await p.evaluate(() => ({ titel: document.querySelector('#modal .mh h2').textContent, erf: [...document.querySelectorAll('#modal .chip.inh')].map(x => x.dataset.v + ':' + x.dataset.a), bias: document.querySelectorAll('#modal [data-a="bias"]').length, weg: !!document.querySelector('#modal [data-a="rmLaag"]') }));
  ok('tik in het scenario: venster met de geërfde tags, voor dit scenario uit te zetten (geen bias, geen weghalen)', sm.titel === 'Tags · Weekly' && sm.erf.join() === 'Weekly|BOS:off' && !sm.bias && !sm.weg, JSON.stringify(sm));
  await p.click('#modal .chip.inh[data-v="Weekly|BOS"]'); await p.click('#modal [data-a="close"]'); await p.waitForTimeout(80);
  ok('uitgezet voor dit scenario (Scenario.off), zichtbaar doorgestreept', await p.evaluate(() => __tp3.dayOf(__tp3.vandaag()).scenarios[0].off.join() === 'Weekly|BOS' && !!document.querySelector('.ritem[data-s="s_tp"] .lrij[data-tf="Weekly"] .chip.inh.off')));
  await p.click('.ritem[data-s="s_tp"] [data-a="editScen"]'); await p.waitForTimeout(120);
  const fo = await p.evaluate(() => ({ rij: [...document.querySelectorAll('#modal .lrij')].map(x => x.dataset.tf + ':' + x.dataset.p), add: !!document.querySelector('#modal .chip.add') }));
  ok('formulier: dezelfde regels; de entry-regel bewerkt de entry-laag', fo.rij.join() === 'Weekly:draft@Weekly,Daily:draft@Daily,4H:draft@4H,1H:draft@1H,15M:draft.entry' && !fo.add, JSON.stringify(fo));
  await p.click('#modal .lrij[data-tf="15M"]'); await p.waitForTimeout(80);
  await p.click('#modal [data-a="pick"][data-v="OB"]'); await p.click('#modal [data-a="close"]'); await p.waitForTimeout(80);
  ok('terug in het formulier, met OB op de entry-laag', await p.evaluate(() => !!document.querySelector('#modal [data-a="saveScen"]') && [...document.querySelectorAll('#modal .lrij[data-tf="15M"] .chip')].some(c => c.textContent === 'OB')));
  await p.click('#modal [data-a="saveScen"]'); await p.waitForTimeout(100);
  ok('bewaard: entry 15M met FVG en OB', await p.evaluate(() => __tp3.dayOf(__tp3.vandaag()).scenarios[0].entry.confirmations.join() === 'FVG,OB'));

  console.log('--- herladen en randgevallen ---');
  await p.evaluate(() => { const P = JSON.parse(localStorage.getItem('tp3:plans')), d = P.days[Object.keys(P.days)[0]]; d.layers = d.layers.filter(x => x.tf !== 'Daily'); d.layers.unshift({ tf: 'Daily', bias: '', setups: [], confirmations: [] }); d.off = ['Daily|Liquidity Sweep']; localStorage.setItem('tp3:plans', JSON.stringify(P)); });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(300);
  ok('een lege dag-laag op een week-tijdframe blijft staan als de dag daar iets uitzet (anders zie je het niet meer)', (await dag()).layers.map(x => x.tf).join() === 'Daily,4H,1H', (await dag()).layers.map(x => x.tf).join());
  await p.evaluate(() => { const P = JSON.parse(localStorage.getItem('tp3:plans')); P.weeks = {}; const d = P.days[Object.keys(P.days)[0]]; d.layers = []; localStorage.setItem('tp3:plans', JSON.stringify(P)); });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(300);
  const leegD = await p.evaluate(() => { const st = [...document.querySelectorAll('.funnel .fstep')].find(x => /^Vandaag/.test(x.querySelector('h3').textContent.trim())); return { txt: st.innerText, week: !!st.querySelector('.weekregel'), info: !!st.querySelector('[data-a="info"]') }; });
  ok('geen lagen en geen weekplan: "Nog geen lagen. Voeg een tijdframe toe.", geen week-regel', /Nog geen lagen\. Voeg een tijdframe toe\./.test(leegD.txt) && !leegD.week, leegD.txt);

  console.log('--- screenshots, 390 zonder horizontaal scrollen ---');
  await zaai(); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(300);
  const sc390 = await H.vierShots(p, 'regels-dag', async q => { await q.waitForTimeout(300); const c = await q.$('[data-a="ctx"]'); if (c && await c.isVisible()) await c.click(); await q.evaluate(() => { __tp3.S.open.s_tp = true; __tp3.render(); }); await q.waitForTimeout(100); });
  ok('390 breed (dag + opengeklapt scenario): geen horizontale scroll, licht en donker', !sc390.licht && !sc390.donker, JSON.stringify(sc390));
  await p.setViewportSize({ width: 390, height: 900 }); await p.click('[data-a="ctx"]'); await p.waitForTimeout(150);
  const smal = await p.evaluate(() => [...document.querySelectorAll('.funnel .lrij')].map(r => r.getBoundingClientRect().height));
  ok('390 breed: ook daar één regel per laag', smal.length === 3 && smal.every(h => h < 40), smal.join());
  await p.setViewportSize({ width: 1280, height: 900 });
  const wk390 = await H.vierShots(p, 'regels-week', async q => { await q.click('[data-a="tab"][data-v="week"]'); await q.waitForTimeout(100); });
  ok('390 breed (week): geen horizontale scroll', !wk390.licht && !wk390.donker, JSON.stringify(wk390));
  console.log('  ' + path.join(SHOTS, 'regels-*.png'));

  ok('geen JS-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close(); srv.close(); process.exit(T.eind());
})();
