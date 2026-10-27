// TradingPlan v3, taak 2: lagen met vrije tijdframes, tags uit de journal.
//  - de tijdframe-keuze toont tagConfig.timeframeTags; laag toevoegen/weghalen met één tik; altijd top-down
//  - een nieuw tijdframe (1M) komt ook in sj_tagconfig, en de journal houdt hem na herladen
//  - een nieuwe setup- of confirmation-tag komt ook in de journal-taglijst
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

  console.log('--- nieuw tijdframe komt in de journal ---');
  await p.click('[data-a="tfPicker"][data-p="day"]'); await p.fill('#nieuwTf', 'abc'); await p.click('[data-a="nieuwTf"]'); await p.waitForTimeout(100);
  ok('onleesbaar tijdframe "abc" geweigerd met een melding', await tfs() === 'Daily,4H,15M' && /tijdframe/i.test(await p.evaluate(() => (document.querySelector('.toast') || {}).textContent || '')));
  await p.click('[data-a="tfPicker"][data-p="day"]'); await p.fill('#nieuwTf', '1m'); await p.click('[data-a="nieuwTf"]'); await p.waitForTimeout(100);
  const tc = await p.evaluate(() => JSON.parse(localStorage.getItem('sj_tagconfig')).timeframeTags);
  ok('1M als laag toegevoegd (onderaan: kleinste)', await tfs() === 'Daily,4H,15M,1M', await tfs());
  ok('1M in sj_tagconfig.timeframeTags, op volgorde van klein naar groot zoals de journal', tc.join() === '1M,5M,15M,1H,4H,Daily', tc.join());

  console.log('--- nieuwe tag komt in de journal ---');
  await p.click('[data-a="picker"][data-p="day.0"]'); await p.waitForTimeout(100);
  const groepen = await p.evaluate(() => [...document.querySelectorAll('#modal [data-a="pick"]')].map(x => x.dataset.v));
  ok('de tag-keuze toont de journal-setups en -confirmations', groepen.join() === 'BOS,MSB,SFP,Liquidity Sweep,OB,FVG', groepen.join());
  await p.click('#modal [data-a="pick"][data-v="BOS"]');
  await p.fill('#newtag', 'Weekly open'); await p.selectOption('#newkind', 'conf'); await p.click('[data-a="newtag"]'); await p.waitForTimeout(100);
  await p.fill('#newtag', 'Turtle soup'); await p.selectOption('#newkind', 'set'); await p.click('[data-a="newtag"]'); await p.waitForTimeout(100);
  await p.fill('#newtag', '<img src=x onerror=alert(1)>'); await p.selectOption('#newkind', 'conf'); await p.click('[data-a="newtag"]'); await p.waitForTimeout(100);
  await p.click('#modal [data-a="close"]'); await p.waitForTimeout(100);
  const L0 = await p.evaluate(() => __tp3.dayOf(__tp3.vandaag()).layers[0]);
  ok('Daily-laag: setups BOS + Turtle soup, confirmation Weekly open', L0.setups.join() === 'BOS,Turtle soup' && L0.confirmations.slice(0, 1).join() === 'Weekly open', JSON.stringify(L0));
  const tc2 = await p.evaluate(() => JSON.parse(localStorage.getItem('sj_tagconfig')));
  ok('Turtle soup in setupTags, Weekly open in confirmationTags van de journal', tc2.setupTags.includes('Turtle soup') && tc2.confirmationTags.includes('Weekly open'));
  ok('een tag met HTML wordt als tekst getoond, niet uitgevoerd', await p.evaluate(() => !document.querySelector('#app img[src="x"]') && /&lt;img|<img/.test(document.getElementById('app').innerText)));
  await p.click('[data-a="bias"][data-p="day.0"][data-v="Bullish"]'); await p.waitForTimeout(80);
  ok('bias zetten op een laag', await p.evaluate(() => __tp3.dayOf(__tp3.vandaag()).layers[0].bias === 'Bullish'));
  await p.click('[data-a="bias"][data-p="day.0"][data-v="Bullish"]'); await p.waitForTimeout(80);
  ok('nog eens tikken = bias weer leeg', await p.evaluate(() => __tp3.dayOf(__tp3.vandaag()).layers[0].bias === ''));

  const j = await ctx.newPage(); j.on('pageerror', e => errs.push('journal: ' + String(e).split('\n')[0]));
  await j.goto(APP, { waitUntil: 'load' }); await j.waitForTimeout(1200);
  await j.reload({ waitUntil: 'load' }); await j.waitForTimeout(1200);
  const jt = await j.evaluate(() => ({ tf: tagConfig.timeframeTags, set: tagConfig.setupTags, conf: tagConfig.confirmationTags }));
  ok('journal na herladen: 1M in de tijdframes, de nieuwe tags in de lijsten', jt.tf.includes('1M') && jt.set.includes('Turtle soup') && jt.conf.includes('Weekly open'), JSON.stringify(jt.tf));
  await j.close();

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

  ok('geen JS-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close(); srv.close(); process.exit(T.eind());
})();
