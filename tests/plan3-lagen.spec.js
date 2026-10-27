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

  for (const [th, w] of [['licht', 1280], ['licht', 390], ['donker', 1280], ['donker', 390]]) {
    await p.evaluate(t => { localStorage.setItem('sj_state', JSON.stringify({ theme: t })); }, th === 'donker' ? 'dark' : 'light'); await p.reload({ waitUntil: 'load' }); await p.setViewportSize({ width: w, height: 900 }); await p.waitForTimeout(200);
    await p.screenshot({ path: path.join(SHOTS, `lagen-${th}-${w}.png`), fullPage: true });
    if (w === 390) ok(`390 breed (${th}): geen horizontale scroll`, await p.evaluate(() => document.documentElement.scrollWidth <= 391));
  }
  ok('geen JS-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close(); srv.close(); process.exit(T.eind());
})();
