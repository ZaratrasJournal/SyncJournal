// TradingPlan v3, taak 2: lagen met vrije tijdframes, tags uit de journal.
//  - de tijdframe-keuze toont tagConfig.timeframeTags; laag toevoegen/weghalen met één tik; altijd top-down
//  - ronde 3 punt 1: tags en tijdframes alleen uit sj_tagconfig; het plan schrijft daar nooit naar, en verwijst bij een
//    lege soort naar Instellingen → Tags in de journal
//  - de dag erft de week-lagen gedimd, een scenario erft week + dag gedimd; uitzetten → "<tf>|<tag>" in off
const { chromium } = require('playwright'); const path = require('path');
const H = require('./helpers/plan3'); const SHOTS = H.SHOTS;
const NAAM = 'Plan v3 lagen';
const TAGS = { setupTags: ['BOS', 'MSB', 'SFP'], confirmationTags: ['Liquidity Sweep', 'OB', 'FVG'], timeframeTags: ['5M', '15M', '1H', '4H', 'Daily'], emotionTags: [], mistakeTags: [], missedReasonTags: [], customTags: [] };

(async () => {
  const srv = await H.server(), { TP, APP } = srv, T = H.teller(NAAM), ok = T.ok;
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await H.alleenLokaal(ctx);
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
  await p.addInitScript(t => { if (!localStorage.getItem('sj_tagconfig')) localStorage.setItem('sj_tagconfig', JSON.stringify(t)); localStorage.setItem('sj_welcomed', 'true'); }, TAGS);
  await p.goto(TP, { waitUntil: 'load' }); await p.waitForTimeout(400);
  let tcStart = await p.evaluate(() => localStorage.getItem('sj_tagconfig'));
  await p.click('[data-a="maakDag"]'); await p.waitForTimeout(150);
  const tfs = () => p.evaluate(() => __tp3.dayOf(__tp3.vandaag()).layers.map(l => l.tf).join());

  console.log('--- tijdframes ---');
  ok('daytrade-dag: 4H · 1H', await tfs() === '4H,1H');
  await p.click('[data-a="tfPicker"][data-p="day"]'); await p.waitForTimeout(100);
  const keuze = await p.evaluate(() => [...document.querySelectorAll('[data-a="addTf"]')].map(x => x.dataset.v));
  ok('de keuze toont de journal-tijdframes die nog geen laag zijn, top-down', keuze.join() === 'Daily,15M,5M', keuze.join());
  await p.click('[data-a="addTf"][data-v="15M"]'); await p.waitForTimeout(100);
  ok('15M toegevoegd met één tik, onderaan', await tfs() === '4H,1H,15M', await tfs());
  await p.click('[data-a="tfPicker"][data-p="day"]'); await p.click('[data-a="addTf"][data-v="Daily"]'); await p.waitForTimeout(100);
  ok('Daily toegevoegd: komt bovenaan (top-down)', await tfs() === 'Daily,4H,1H,15M', await tfs());
  await p.click('[data-a="rmLaag"][data-p="day"][data-v="1H"]'); await p.waitForTimeout(100);
  ok('1H weghalen met één tik', await tfs() === 'Daily,4H,15M', await tfs());

  console.log('--- tags en tijdframes alleen via Instellingen (ronde 3 punt 1) ---');
  await p.click('[data-a="tfPicker"][data-p="day"]'); await p.waitForTimeout(80);
  ok('"+ tijdframe" heeft geen veld om zelf een tijdframe in te typen', await p.evaluate(() => !document.querySelector('#nieuwTf') && !document.querySelector('[data-a="nieuwTf"]')));
  await p.click('[data-a="addTf"][data-v="5M"]'); await p.waitForTimeout(80);
  await p.click('[data-a="tfPicker"][data-p="day"]'); await p.waitForTimeout(80);
  await p.click('[data-a="addTf"][data-v="1H"]'); await p.waitForTimeout(80);
  await p.click('[data-a="tfPicker"][data-p="day"]'); await p.waitForTimeout(80);
  const vol = await p.evaluate(() => { const g = document.querySelector('.tfpick .geentags'), a = g && g.querySelector('a'); return { txt: g ? g.textContent : '', href: a ? a.getAttribute('href') : '' }; });
  ok('alle journal-tijdframes al een laag: één regel met een link naar Instellingen → Tags', /Instellingen → Tags/.test(vol.txt) && /\?page=instellingen&tab=tags$/.test(vol.href), JSON.stringify(vol));
  await p.click('[data-a="tfPicker"][data-p=""]'); await p.waitForTimeout(60);
  await p.click('[data-a="rmLaag"][data-p="day"][data-v="5M"]'); await p.click('[data-a="rmLaag"][data-p="day"][data-v="1H"]'); await p.waitForTimeout(80);
  ok('terug naar Daily · 4H · 15M', await tfs() === 'Daily,4H,15M', await tfs());

  await p.click('[data-a="picker"][data-p="day.0"]'); await p.waitForTimeout(100);
  const groepen = await p.evaluate(() => [...document.querySelectorAll('#modal [data-a="pick"]')].map(x => x.dataset.v));
  ok('de tag-keuze toont de journal-setups en -confirmations', groepen.join() === 'BOS,MSB,SFP,Liquidity Sweep,OB,FVG', groepen.join());
  ok('geen blok "Ontbreekt er een?" meer: geen veld, geen soort-keuze, geen +', await p.evaluate(() => !document.querySelector('#newtag,#newkind,[data-a="newtag"]') && !/Ontbreekt er een/.test(document.getElementById('modal').textContent)));
  ok('het venster wijst naar Instellingen → Tags in de journal', await p.evaluate(() => { const a = [...document.querySelectorAll('#modal a')].find(x => /Instellingen → Tags/.test(x.textContent)); return !!a && /\?page=instellingen&tab=tags$/.test(a.getAttribute('href')); }));
  await p.click('#modal [data-a="pick"][data-v="BOS"]'); await p.click('#modal [data-a="pick"][data-v="OB"]');
  await p.click('#modal [data-a="close"]'); await p.waitForTimeout(100);
  const L0 = await p.evaluate(() => __tp3.dayOf(__tp3.vandaag()).layers[0]);
  ok('Daily-laag: setup BOS, confirmation OB (gekozen uit de lijst)', L0.setups.join() === 'BOS' && L0.confirmations.join() === 'OB', JSON.stringify(L0));
  ok('__tp3 heeft geen voegTagToe/voegTijdframeToe meer', await p.evaluate(() => !('voegTagToe' in __tp3) && !('voegTijdframeToe' in __tp3)));
  // Een tag met HTML (bv. uit een oude back-up) wordt als tekst getoond, niet uitgevoerd.
  await p.evaluate(() => { const P = __tp3.load(); P.days[__tp3.vandaag()].layers[0].confirmations.push('<img src=x onerror=alert(1)>'); __tp3.save(P); __tp3.render(); });
  await p.waitForTimeout(80);
  ok('een tag met HTML wordt als tekst getoond, niet uitgevoerd', await p.evaluate(() => !document.querySelector('#app img[src="x"]') && /<img/.test(document.getElementById('app').innerText)));
  await p.evaluate(() => { const P = __tp3.load(); P.days[__tp3.vandaag()].layers[0].confirmations = ['OB']; __tp3.save(P); __tp3.render(); });
  await p.click('[data-a="bias"][data-p="day.0"][data-v="Bullish"]'); await p.waitForTimeout(80);
  ok('bias zetten op een laag', await p.evaluate(() => __tp3.dayOf(__tp3.vandaag()).layers[0].bias === 'Bullish'));
  await p.click('[data-a="bias"][data-p="day.0"][data-v="Bullish"]'); await p.waitForTimeout(80);
  ok('nog eens tikken = bias weer leeg', await p.evaluate(() => __tp3.dayOf(__tp3.vandaag()).layers[0].bias === ''));
  ok('sj_tagconfig byte-gelijk na de hele sessie hierboven', await p.evaluate(() => localStorage.getItem('sj_tagconfig')) === tcStart);

  console.log('--- lege soort: verwijzing naar de journal ---');
  const leeg = await ctx.newPage(); leeg.on('pageerror', e => errs.push('leeg: ' + String(e).split('\n')[0]));
  await leeg.addInitScript(() => { window.__tagSchrijf = 0; const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'sj_tagconfig') window.__tagSchrijf++; return o.call(this, k, v); }; });
  await leeg.goto(TP, { waitUntil: 'load' });
  const voorLeeg = await leeg.evaluate(() => localStorage.getItem('sj_tagconfig'));
  await leeg.evaluate(() => localStorage.setItem('sj_tagconfig', JSON.stringify({ setupTags: [], confirmationTags: ['OB'], timeframeTags: ['4H', '1H'], emotionTags: [], mistakeTags: [], missedReasonTags: [], customTags: [] })));
  await leeg.reload({ waitUntil: 'load' }); await leeg.waitForTimeout(250);
  await leeg.click('[data-a="picker"][data-p="day.0"]'); await leeg.waitForTimeout(80);
  ok('geen setups in de journal: "Nog geen setups. Voeg ze toe in de journal: Instellingen → Tags"', await leeg.evaluate(() => { const g = document.querySelector('#modal .geentags'); return !!g && /^Nog geen setups\. Voeg ze toe in de journal: Instellingen → Tags$/.test(g.textContent.trim()) && !!g.querySelector('a[href$="?page=instellingen&tab=tags"]'); }));
  ok('na herladen schreef het plan in deze tab nooit naar sj_tagconfig', await leeg.evaluate(() => window.__tagSchrijf) === 0);
  await leeg.evaluate(v => v == null ? localStorage.removeItem('sj_tagconfig') : localStorage.setItem('sj_tagconfig', v), voorLeeg); await leeg.close();

  const j = await ctx.newPage(); j.on('pageerror', e => errs.push('journal: ' + String(e).split('\n')[0]));
  await j.goto(APP + '?page=instellingen&tab=tags', { waitUntil: 'load' }); await j.waitForTimeout(1200);
  ok('de link opent de journal op Instellingen → Tags', await j.evaluate(() => STATE.setTab === 'tags' && /Setup/.test(document.body.innerText)), await j.evaluate(() => STATE.setTab));
  await j.close();
  tcStart = await p.evaluate(() => localStorage.getItem('sj_tagconfig'));   // de journal mag zijn eigen tags opnieuw opslaan

  console.log('--- erven: week → dag → scenario ---');
  await p.evaluate(() => { const P = __tp3.load(), id = __tp3.vandaag(), wid = __tp3.isoWeek(id);
    P.weeks[wid] = { id: wid, layers: [{ tf: 'Weekly', bias: 'Bullish', setups: ['BOS'], confirmations: [] }, { tf: 'Daily', bias: 'Bullish', setups: [], confirmations: ['Liquidity Sweep'] }], levels: '', noTrade: '', focus: '', media: { imgs: [], links: [] }, les: '' };
    P.days[id].layers = [{ tf: '4H', bias: 'Bullish', setups: ['MSB'], confirmations: [] }, { tf: '1H', bias: '', setups: [], confirmations: ['OB'] }]; __tp3.save(P); });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(300);
  const erf = await p.evaluate(() => ({ inh: [...document.querySelectorAll('#app .layer.inh .tf')].map(x => x.textContent), eigen: [...document.querySelectorAll('#app .layer:not(.inh) .tf')].map(x => x.textContent) }));
  ok('de dag toont de week-lagen gedimd (Weekly, Daily) boven de eigen lagen (4H, 1H)', erf.inh.join() === 'Weekly,Daily' && erf.eigen.join() === '4H,1H', JSON.stringify(erf));
  await p.click('[data-a="newScen"]'); await p.waitForTimeout(150);
  const sc = await p.evaluate(() => ({ chips: [...document.querySelectorAll('#modal .chip.inh')].map(x => x.dataset.v), entry: (document.querySelector('#modal [data-f="draft.entry.tf"]') || {}).value }));
  ok('scenario erft week + dag gedimd: 4 chips', sc.chips.join() === 'Weekly|BOS,Daily|Liquidity Sweep,4H|MSB,1H|OB', sc.chips.join());
  ok('entry-laag start op het stijl-tijdframe (daytrade 15M)', sc.entry === '15M', sc.entry);
  await p.click('#modal .chip.inh[data-v="Weekly|BOS"]'); await p.waitForTimeout(80);
  ok('gedimde chip uitzetten: doorgestreept', await p.evaluate(() => document.querySelector('#modal .chip.inh[data-v="Weekly|BOS"]').classList.contains('off')));
  await p.click('#modal [data-a="picker"][data-p="draft.entry"]'); await p.click('#modal [data-a="pick"][data-v="SFP"]'); await p.click('#modal [data-a="pick"][data-v="FVG"]'); await p.click('#modal [data-a="close"]'); await p.waitForTimeout(80);
  ok('terug in het scenario-formulier na de tag-keuze', await p.evaluate(() => !!document.querySelector('#modal [data-a="saveScen"]')));
  await p.fill('#modal [data-f="draft.title"]', 'Test');
  await p.click('#modal [data-a="saveScen"]'); await p.waitForTimeout(150);
  const s = await p.evaluate(() => __tp3.dayOf(__tp3.vandaag()).scenarios[0]);
  ok('bewaard: off = ["Weekly|BOS"], entry 15M met SFP en FVG', s && s.off.join() === 'Weekly|BOS' && s.entry.tf === '15M' && s.entry.setups.join() === 'SFP' && s.entry.confirmations.join() === 'FVG', JSON.stringify(s && { off: s.off, entry: s.entry }));
  ok('scenario-model: id s_…, status open, trades []', s && /^s_[0-9a-z]+$/.test(s.id) && s.status === 'open' && Array.isArray(s.trades) && s.statusTs === null);

  console.log('--- kleuren: elke tag-soort zoals in de journal (polish punt 1) ---');
  ok('tagKleur: setup accent, confirmation teal, tijdframe violet, de rest muted (TAG_CATS)', await p.evaluate(() =>
    ['BOS', 'OB', '4H', 'Iets eigens'].map(__tp3.tagKleur).join() === 'var(--accent),var(--teal),var(--violet),var(--muted)'));
  const tokens = await p.evaluate(() => { const v = () => ['--violet', '--teal', '--pink'].map(k => getComputedStyle(document.documentElement).getPropertyValue(k).trim().toUpperCase()).join();
    const licht = v(); document.documentElement.dataset.theme = 'dark'; const donker = v(); document.documentElement.dataset.theme = 'light'; return { licht, donker }; });
  ok('tokens --violet/--teal/--pink letterlijk uit de journal, licht en donker', tokens.licht === '#7C5CE0,#0E9E96,#D6409F' && tokens.donker === '#A78BFA,#2CC5B6,#F472B6', JSON.stringify(tokens));
  await p.evaluate(sid => { __tp3.S.open[sid] = true; __tp3.render(); }, s.id); await p.waitForTimeout(100);
  const kl = await p.evaluate(() => {
    const tok = v => { const e = document.createElement('i'); e.style.color = `var(${v})`; document.body.appendChild(e); const c = getComputedStyle(e).color; e.remove(); return c; };
    const chip = (sel, txt) => [...document.querySelectorAll(sel)].find(x => x.textContent.includes(txt));
    const st = e => e ? getComputedStyle(e) : {}; const dot = e => e ? getComputedStyle(e, '::before').backgroundColor : '';
    const eigenSet = chip('#app .layer:not(.inh) .chip', 'MSB'), eigenConf = chip('#app .layer:not(.inh) .chip', 'OB'), erfSet = chip('#app .funnel .layer.inh .chip', 'BOS');
    const uit = document.querySelector('#app .rdetail .chip.inh[data-v="Weekly|BOS"]'), erfAan = document.querySelector('#app .rdetail .chip.inh[data-v="Daily|Liquidity Sweep"]');
    const bias = v => document.querySelector(`#app [data-a="bias"][data-p="day.0"][data-v="${v}"]`);
    return { accent: tok('--accent'), teal: tok('--teal'), violet: tok('--violet'), green: tok('--green'), red: tok('--red'), muted: tok('--muted'), faint: tok('--faint'),
      eigenSet: [st(eigenSet).color, dot(eigenSet), st(eigenSet).borderTopStyle, +st(eigenSet).opacity], eigenConf: st(eigenConf).color,
      erfSet: [st(erfSet).color, st(erfSet).borderTopStyle, +st(erfSet).opacity],
      uit: uit && [st(uit).color, st(uit).textDecorationLine, +st(uit).opacity], erfAan: erfAan && [st(erfAan).color, st(erfAan).borderTopStyle],
      tf: st(document.querySelector('#app .layer:not(.inh) .tf')).color,
      bull: bias('Bullish') && [st(bias('Bullish')).backgroundColor, bias('Bullish').classList.contains('on')], bear: st(bias('Bearish')).color, neutr: st(bias('Neutraal')).color };
  });
  ok('eigen setup-chip: accent, met een stip in de kleur, doorgetrokken rand, vol', kl.eigenSet[0] === kl.accent && kl.eigenSet[1] === kl.accent && kl.eigenSet[2] === 'solid' && kl.eigenSet[3] === 1, JSON.stringify(kl.eigenSet));
  ok('eigen confirmation-chip: teal', kl.eigenConf === kl.teal, kl.eigenConf);
  ok('tijdframe-label van een laag: violet', kl.tf === kl.violet, kl.tf);
  ok('geërfde chip (week in de dag): zelfde kleur, stippelrand, gedimd', kl.erfSet[0] === kl.accent && kl.erfSet[1] === 'dashed' && kl.erfSet[2] < 1, JSON.stringify(kl.erfSet));
  ok('geërfd in het scenario: teal met stippelrand', kl.erfAan && kl.erfAan[0] === kl.teal && kl.erfAan[1] === 'dashed', JSON.stringify(kl.erfAan));
  ok('uitgezet: grijs en doorgestreept, nog lichter dan geërfd', kl.uit && kl.uit[0] === kl.faint && /line-through/.test(kl.uit[1]) && kl.uit[2] < kl.erfSet[2], JSON.stringify(kl.uit));
  ok('bias: gekozen Bullish gevuld groen; Bearish rood, Neutraal muted', kl.bull && kl.bull[1] && kl.bull[0] === kl.green && kl.bear === kl.red && kl.neutr === kl.muted, JSON.stringify([kl.bull, kl.bear, kl.neutr]));
  await p.evaluate(sid => { __tp3.S.open[sid] = false; __tp3.render(); }, s.id);

  for (const [th, w] of [['licht', 1280], ['licht', 390], ['donker', 1280], ['donker', 390]]) {
    await p.evaluate(t => { localStorage.setItem('sj_state', JSON.stringify({ theme: t })); }, th === 'donker' ? 'dark' : 'light'); await p.reload({ waitUntil: 'load' }); await p.setViewportSize({ width: w, height: 900 }); await p.waitForTimeout(200);
    await p.screenshot({ path: path.join(SHOTS, `lagen-${th}-${w}.png`), fullPage: true });
    if (w === 390) ok(`390 breed (${th}): geen horizontale scroll`, await p.evaluate(() => document.documentElement.scrollWidth <= 391));
  }
  console.log('--- wat de week al heeft, staat niet nog eens in de dag (polish punt 3) ---');
  const WEEK3 = [{ tf: 'Daily', bias: 'Bullish', setups: ['BOS'], confirmations: [] }, { tf: '4H', bias: 'Bullish', setups: [], confirmations: ['Liquidity Sweep'] }];
  await p.evaluate(W => { const id = __tp3.vandaag(), wid = __tp3.isoWeek(id); localStorage.setItem('tp3:plans', JSON.stringify({ v: 1, weeks: { [wid]: { id: wid, layers: W, levels: '', noTrade: '', focus: '', media: { imgs: [], links: [] }, les: '' } }, days: {} })); }, WEEK3);
  await p.setViewportSize({ width: 1280, height: 900 }); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(300);
  await p.click('[data-a="maakDag"]'); await p.waitForTimeout(150);
  ok('nieuwe dag (Daytrade = 4H · 1H) met een weekplan Daily · 4H: alleen een 1H-laag', await tfs() === '1H', await tfs());
  const rijen = () => p.evaluate(() => [...document.querySelectorAll('#app .layer')].map(r => r.dataset.tf + ':' + [...r.querySelectorAll('.chip:not(.add)')].map(c => (c.classList.contains('inh') ? '↑' : '') + c.textContent.replace(/[↑×]/g, '').trim()).join('/')));
  let rj = await rijen();
  ok('de dag toont elk tijdframe één keer: Daily, 4H (geërfd), 1H', rj.map(r => r.split(':')[0]).join() === 'Daily,4H,1H', JSON.stringify(rj));
  ok('de 4H-rij draagt de week-tag gedimd en een "+ tag"', rj[1] === '4H:↑Liquidity Sweep' && await p.evaluate(() => !!document.querySelector('#app .layer[data-tf="4H"] [data-a="picker"]')), JSON.stringify(rj));
  ok('de week-bias staat gestippeld in de bias-knoppen van die rij (geen eigen bias)', await p.evaluate(() => { const r = document.querySelector('#app .layer[data-tf="4H"]'); return r.querySelector('[data-a="bias"][data-v="Bullish"]').classList.contains('erf') && !r.querySelector('[data-a="bias"].on'); }));
  await p.click('#app .layer[data-tf="4H"] [data-a="picker"]'); await p.click('#modal [data-a="pick"][data-v="MSB"]'); await p.click('#modal [data-a="close"]'); await p.waitForTimeout(120);
  rj = await rijen();
  ok('dag-tag op 4H: komt in een dag-laag 4H (bewaard)', await tfs() === '4H,1H' && await p.evaluate(() => __tp3.dayOf(__tp3.vandaag()).layers[0].setups.join() === 'MSB'), await tfs());
  ok('…en staat in dezelfde rij: één 4H-rij met de week-tag en de dag-tag', rj.filter(r => r.startsWith('4H:')).length === 1 && rj[1] === '4H:↑Liquidity Sweep/MSB', JSON.stringify(rj));
  ok('de dag-tag telt mee in de edge (4H MSB naast 4H Liquidity Sweep)', await p.evaluate(() => { const d = __tp3.dayOf(__tp3.vandaag()), w = __tp3.weekOf(d.week); const r = __tp3.eisen({ entry: { tf: '15M', bias: '', setups: [], confirmations: [] }, off: [] }, d, w).map(x => x.label); return r.includes('4H MSB') && r.includes('4H Liquidity Sweep') && r.includes('Daily BOS'); }));
  await p.click('#app .layer[data-tf="4H"] [data-a="rmtag"][data-v="MSB"]'); await p.waitForTimeout(100);
  ok('dag-tag weer weg: de week-rij blijft staan', (await rijen()).map(r => r.split(':')[0]).join() === 'Daily,4H,1H');
  console.log('  bestaande dag');
  await p.evaluate(W => { const P = JSON.parse(localStorage.getItem('tp3:plans')), d = P.days[Object.keys(P.days)[0]];
    d.layers = [{ tf: 'Daily', bias: '', setups: [], confirmations: ['OB'] }, { tf: '4H', bias: '', setups: [], confirmations: [] }, { tf: '1H', bias: 'Bearish', setups: [], confirmations: [] }];
    localStorage.setItem('tp3:plans', JSON.stringify(P)); }, WEEK3);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(300);
  ok('bij laden: de lege 4H-dag-laag (week heeft 4H) is weg, de gevulde Daily blijft', await tfs() === 'Daily,1H', await tfs());
  rj = await rijen();
  ok('Daily samengevoegd: één rij met de week-tag gedimd en de dag-tag', rj[0] === 'Daily:↑BOS/OB' && rj.filter(r => r.startsWith('Daily:')).length === 1, JSON.stringify(rj));
  console.log('  scenario');
  await p.click('[data-a="newScen"]'); await p.waitForTimeout(150);
  const mrij = () => p.evaluate(() => [...document.querySelectorAll('#modal .layer')].map(r => r.dataset.tf));
  ok('scenario-formulier: één rij per tijdframe (Daily, 4H, 1H, entry 15M)', (await mrij()).join() === 'Daily,4H,1H,15M', (await mrij()).join());
  await p.selectOption('#modal [data-f="draft.entry.tf"]', '4H'); await p.waitForTimeout(100);
  ok('entry op 4H: de entry-laag zit in de 4H-rij, geen tweede 4H', (await mrij()).join() === 'Daily,4H,1H' && await p.evaluate(() => !!document.querySelector('#modal .layer[data-tf="4H"] [data-a="picker"][data-p="draft.entry"]')), (await mrij()).join());
  await p.click('#modal [data-a="close"]'); await p.waitForTimeout(80);
  for (const [th, w] of [['licht', 1280], ['donker', 390]]) {
    await p.evaluate(t => { localStorage.setItem('sj_state', JSON.stringify({ theme: t })); }, th === 'donker' ? 'dark' : 'light'); await p.reload({ waitUntil: 'load' }); await p.setViewportSize({ width: w, height: 900 }); await p.waitForTimeout(200);
    if (w === 390) await p.click('[data-a="ctx"]');
    await p.screenshot({ path: path.join(SHOTS, `lagen-week-dag-${th}-${w}.png`), fullPage: true });
  }
  await p.setViewportSize({ width: 1280, height: 900 });

  console.log('--- geërfde tags zonder pijltje, met uitleg; week-tag voor vandaag uitzetten (ronde 3 punt 2) ---');
  await p.evaluate(W => { const id = __tp3.vandaag(), wid = __tp3.isoWeek(id); localStorage.setItem('tp3:plans', JSON.stringify({ v: 1,
    weeks: { [wid]: { id: wid, layers: W, levels: '', noTrade: '', focus: '', media: { imgs: [], links: [] }, les: '' } },
    days: { [id]: { id, week: wid, layers: [{ tf: '1H', bias: '', setups: ['MSB'], confirmations: [] }], levels: '', mental: null, pre: [false, false, false], media: { imgs: [], links: [] }, les: '',
      scenarios: [{ id: 's_p2', title: 'P2', pair: 'BTC', dir: 'long', pb: '', grade: 'B', trigger: '', invalid: '', entry: { tf: '15M', bias: '', setups: [], confirmations: [] }, off: [], checked: [], critChecked: [], stop: '', tps: [], media: { imgs: [], links: [] }, note: '', status: 'open', statusTs: null, trades: [] }] } } })); }, WEEK3);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(300);
  const fun = () => p.evaluate(() => { const f = document.querySelector('#app .funnel'); return { pijl: /↑/.test(f.innerText), uitleg: [...f.querySelectorAll('.erfuitleg')].map(x => x.textContent.trim()),
    chip: (() => { const c = f.querySelector('.chip.inh[data-v="Daily|BOS"]'); return c && { title: c.title, off: c.classList.contains('off'), btn: c.tagName }; })(),
    bias: (f.querySelector('.layer[data-tf="4H"] [data-a="bias"].erf') || {}).title || '' }; });
  let fu = await fun();
  ok('geen "↑" meer bij geërfde tags in de dag', !fu.pijl);
  ok('één uitlegregel: "Gestippeld = uit je weekplan. Tik om voor vandaag uit te zetten."', fu.uitleg.length === 1 && fu.uitleg[0] === 'Gestippeld = uit je weekplan. Tik om voor vandaag uit te zetten.', JSON.stringify(fu.uitleg));
  ok('tooltip op de geërfde chip: "Uit je weekplan"', fu.chip && /^Uit je weekplan/.test(fu.chip.title) && fu.chip.btn === 'BUTTON', JSON.stringify(fu.chip));
  ok('de gestippelde week-bias valt onder dezelfde uitleg (tooltip "Uit je weekplan")', /^Uit je weekplan/.test(fu.bias), fu.bias);
  await p.click('#app .funnel .chip.inh[data-v="Daily|BOS"]'); await p.waitForTimeout(100);
  fu = await fun();
  const dOff = await p.evaluate(() => { const d = __tp3.dayOf(__tp3.vandaag()); return { off: d.off, eis: __tp3.eisen(d.scenarios[0], d, __tp3.weekOf(d.week)).map(x => x.label) }; });
  ok('tik = voor vandaag uitgezet: Day.off ["Daily|BOS"], chip doorgestreept', dOff.off.join() === 'Daily|BOS' && fu.chip.off, JSON.stringify(dOff.off));
  ok('uitgezet voor vandaag: telt niet mee in de edge van de scenario\'s', !dOff.eis.includes('Daily BOS') && dOff.eis.includes('4H Liquidity Sweep') && dOff.eis.includes('1H MSB'), dOff.eis.join());
  await p.click('.ritem[data-s="s_p2"] .rrow'); await p.waitForTimeout(100);
  const sc2 = await p.evaluate(() => { const r = document.querySelector('.ritem[data-s="s_p2"] .rdetail'); const t = v => (r.querySelector(`.chip.inh[data-v="${v}"]`) || {}).title;
    return { pijl: /↑/.test(r.innerText), week: t('4H|Liquidity Sweep'), dag: t('1H|MSB'), uitDag: !r.querySelector('.chip.inh[data-v="Daily|BOS"]'), uitleg: (r.querySelector('.erfuitleg') || {}).textContent || '' }; });
  ok('scenario: geen "↑"; tooltip "Uit je weekplan" en "Uit je dagplan" naar de bron', !sc2.pijl && /^Uit je weekplan/.test(sc2.week) && /^Uit je dagplan/.test(sc2.dag), JSON.stringify(sc2));
  ok('scenario: een week-tag die de dag uitzette, erft het scenario niet', sc2.uitDag);
  ok('scenario: dezelfde korte uitleg, voor dit scenario', /^Gestippeld = uit je week- of dagplan\. Tik om voor dit scenario uit te zetten\.$/.test(sc2.uitleg.trim()), sc2.uitleg);
  await p.click('#app .funnel .chip.inh[data-v="Daily|BOS"]'); await p.waitForTimeout(100);
  ok('nog eens tikken: weer aan', await p.evaluate(() => __tp3.dayOf(__tp3.vandaag()).off.length === 0));
  await p.click('[data-a="newScen"]'); await p.waitForTimeout(120);
  ok('scenario-formulier: geen "↑", wel de uitleg', await p.evaluate(() => !/↑/.test(document.getElementById('modal').innerText) && !!document.querySelector('#modal .erfuitleg')));
  await p.click('#modal [data-a="close"]');

  ok('sj_tagconfig byte-gelijk aan het begin, na de hele plan-sessie (week, dag, scenario, thema\'s)', await p.evaluate(() => localStorage.getItem('sj_tagconfig')) === tcStart);
  ok('geen JS-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close(); srv.close(); process.exit(T.eind());
})();
