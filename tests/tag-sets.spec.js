// F14 stap 4 (26-10-2026): two starter tag sets, "Morani" (the existing set, unchanged) and
// "Algemeen" (neutral setups/confirmations for traders outside the community).
// Guards: an existing tagConfig stays byte-identical, a new journal can pick either set,
// merging never removes a tag, replacing only happens after a confirmation and keeps own labels.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
  const b = await chromium.launch(); const p = await b.newPage();
  let dialogAnswer = true, dialogs = 0; p.on('dialog', d => { dialogs++; dialogAnswer ? d.accept() : d.dismiss(); });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.setViewportSize({ width: 1400, height: 1000 });
  const fresh = async () => {
    await p.goto(url, { waitUntil: 'networkidle' });
    await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
    await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  };

  console.log('─── De twee sets ───');
  await fresh();
  const sets = await p.evaluate(() => ({ ids: Object.keys(TAG_SETS), mor: TAG_SETS.morani.cfg === DEFAULT_TAGCONFIG, alg: TAG_SETS.algemeen.cfg }));
  ok('TAG_SETS heeft morani en algemeen', sets.ids.includes('morani') && sets.ids.includes('algemeen'), sets.ids.join());
  ok('de Morani-set is precies de oude standaardset', sets.mor);
  ok('algemeen: neutrale setups (Breakout, Pullback, Reversal, Range, Trend continuation)', ['Breakout', 'Pullback', 'Reversal', 'Range', 'Trend continuation'].every(t => sets.alg.setupTags.includes(t)) && !sets.alg.setupTags.includes('F2R') && !sets.alg.setupTags.includes('MSB'), sets.alg.setupTags.join());
  ok('algemeen: neutrale confirmaties (Support/Resistance, Volume, Divergence, News)', ['Support/Resistance', 'Volume', 'Divergence', 'News'].every(t => sets.alg.confirmationTags.includes(t)) && !sets.alg.confirmationTags.includes('Spot koop'), sets.alg.confirmationTags.join());
  ok('algemeen: alle soorten gevuld, eigen labels leeg', ['timeframeTags', 'emotionTags', 'mistakeTags', 'missedReasonTags'].every(k => sets.alg[k].length > 0) && sets.alg.customTags.length === 0);

  console.log('─── Bestaande tagConfig blijft exact gelijk ───');
  const eigen = { setupTags: ['MijnSetup', 'BOS'], confirmationTags: ['X'], timeframeTags: ['1H'], emotionTags: ['FOMO'], mistakeTags: ['Fout1'], missedReasonTags: ['Durf'], customTags: ['Label'], emotionNeg: ['FOMO'] };
  await p.evaluate(c => { localStorage.setItem('sj_tagconfig', JSON.stringify(c)); }, eigen);
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  const na = await p.evaluate(() => ({ raw: localStorage.getItem('sj_tagconfig'), mem: JSON.stringify(tagConfig), eigen: tagConfigEigen() }));
  ok('opslag byte-gelijk na laden', na.raw === JSON.stringify(eigen), na.raw);
  ok('in het geheugen dezelfde lijsten', na.mem === JSON.stringify(eigen), na.mem);
  ok('telt als eigen tagConfig', na.eigen === true);
  // A start-choice on a journal with its own config merges, it never replaces
  await p.evaluate(() => kiesTagSet('algemeen', 'start'));
  const st = await p.evaluate(() => tagConfig);
  ok('start-keuze bij bestaande config voegt alleen toe', ['MijnSetup', 'BOS', 'Breakout'].every(t => st.setupTags.includes(t)) && st.customTags.join() === 'Label' && st.mistakeTags.includes('Fout1'), st.setupTags.join());

  console.log('─── Nieuwe journal kiest een set ───');
  await fresh();
  ok('verse journal: geen eigen tagConfig, standaard de Morani-set', await p.evaluate(() => !tagConfigEigen() && JSON.stringify(tagConfig.setupTags) === JSON.stringify(DEFAULT_TAGCONFIG.setupTags)));
  await p.evaluate(() => kiesTagSet('algemeen', 'start'));
  const g = await p.evaluate(() => ({ cfg: tagConfig, saved: JSON.parse(localStorage.getItem('sj_tagconfig') || 'null'), set: DB.load('tagset', '') }));
  ok('algemeen gekozen: setups = alleen de algemene set', JSON.stringify(g.cfg.setupTags) === JSON.stringify(sets.alg.setupTags), g.cfg.setupTags.join());
  ok('keuze bewaard in sj_tagconfig en sj_tagset', g.saved && g.saved.setupTags.includes('Breakout') && g.set === 'algemeen');
  ok('negatieve emoties kloppen (FOMO rood, Rustig groen)', await p.evaluate(() => isNegEmotie('FOMO') && !isNegEmotie('Rustig')));
  await fresh();
  await p.evaluate(() => kiesTagSet('morani', 'start'));
  ok('Morani gekozen: precies de oude set', await p.evaluate(() => ['setupTags', 'confirmationTags', 'timeframeTags', 'emotionTags', 'mistakeTags', 'missedReasonTags'].every(k => JSON.stringify(tagConfig[k]) === JSON.stringify(DEFAULT_TAGCONFIG[k])) && DB.load('tagset', '') === 'morani'));

  console.log('─── Samenvoegen verwijdert niets ───');
  await p.evaluate(() => { tagConfig.setupTags.push('Eigen1'); tagConfig.customTags = ['Mijn label']; persistTagConfig(); });
  const voor = await p.evaluate(() => JSON.parse(JSON.stringify(tagConfig)));
  await p.evaluate(() => kiesTagSet('algemeen', 'samenvoegen'));
  const mrg = await p.evaluate(() => JSON.parse(JSON.stringify(tagConfig)));
  ok('elke oude tag staat er nog, in dezelfde volgorde vooraan', Object.keys(voor).filter(k => Array.isArray(voor[k])).every(k => voor[k].every((t, i) => mrg[k][i] === t)), JSON.stringify(mrg.setupTags));
  ok('de algemene tags zijn erbij, zonder dubbelen', ['Breakout', 'Volume'].every(t => mrg.setupTags.includes(t) || mrg.confirmationTags.includes(t)) && mrg.setupTags.filter(t => t === 'Range').length === 1);
  ok('eigen labels onaangetast', mrg.customTags.join() === 'Mijn label');

  console.log('─── Vervangen alleen na bevestiging ───');
  dialogAnswer = false; dialogs = 0;
  await p.evaluate(() => kiesTagSet('algemeen', 'vervangen'));
  ok('geweigerde bevestiging: niets veranderd', dialogs === 1 && await p.evaluate(m => JSON.stringify(tagConfig) === m, JSON.stringify(mrg)));
  dialogAnswer = true;
  await p.evaluate(() => kiesTagSet('algemeen', 'vervangen'));
  const rep = await p.evaluate(() => JSON.parse(JSON.stringify(tagConfig)));
  ok('na bevestiging: setups = algemene set', !rep.setupTags.includes('BOS') && rep.setupTags.includes('Breakout'));
  ok('eigen labels blijven ook bij vervangen', rep.customTags.join() === 'Mijn label');

  console.log('─── Instellingen → Tags ───');
  await fresh();
  const ui = await p.evaluate(() => { STATE.setTab = 'tags'; go('instellingen'); const el = document.getElementById('tagSetKeuze'); return el ? el.textContent : ''; });
  ok('blok met beide sets staat in Instellingen → Tags', /Morani/.test(ui) && /algemene set/i.test(ui), ui.slice(0, 200));
  ok('strategieën van Morani genoemd', /strategieën van Morani/.test(ui));
  for (const th of ['light', 'dark']) {
    await p.evaluate(t => { setTheme(t); render(); }, th); await p.waitForTimeout(700);
    await p.screenshot({ path: `tests/screenshots/tag-sets-${th}.png`, fullPage: false });
  }
  await p.setViewportSize({ width: 390, height: 844 }); await p.evaluate(() => { document.body.classList.remove('nav-open'); render(); }); await p.waitForTimeout(700);
  ok('390px: geen horizontale scroll door het blok', await p.evaluate(() => { const el = document.getElementById('tagSetKeuze'); return el && el.scrollWidth <= el.clientWidth + 1; }));
  await p.screenshot({ path: 'tests/screenshots/tag-sets-390.png' });

  ok('geen JS-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== Tag-sets: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
