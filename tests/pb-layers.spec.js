// Borgt Denny's melding 2026-09-16: een playbook kiezen in het trade-formulier nam de
// setup-lagen (met tags) van dat playbook niet mee in de trade. Nu: lagen worden
// overgenomen bij keuze, handmatige lagen worden nooit stilletjes overschreven (toast met
// vervang-knop), wisselen/deselecteren werkt op onaangeraakte auto-lagen, en de lagen
// komen echt in de opgeslagen trade terecht (incl. tag-filter-integratie).
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
  const b = await chromium.launch(); const p = await b.newPage(); p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.setViewportSize({ width: 1700, height: 1000 });
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(600);
  await p.evaluate(() => {
    try { hideWelcome() } catch (e) {}
    T = []; persist(); clearGFilter();
    PBOOK['Mijn SFP'] = pbNormalize('Mijn SFP', { name: 'Mijn SFP', defaultGrade: 'A', criteria: [{ text: 'regel', mandatory: false }], status: 'active',
      layers: [{ timeframe: '4H', bias: 'Bullish', setups: ['SFP'], confirmations: ['FVG'] }, { timeframe: '15M', bias: '', setups: ['SFP'], confirmations: ['Eigen-conf'] }] });
    PBOOK['Zonder lagen'] = pbNormalize('Zonder lagen', { name: 'Zonder lagen', criteria: [], status: 'active', layers: [] });
    PBOOK['Alt'] = pbNormalize('Alt', { name: 'Alt', status: 'active', layers: [{ timeframe: '1H', bias: 'Bearish', setups: ['BOS'], confirmations: [] }] });
    persistPbook();
    tagConfig.setupTags = ['SFP', 'BOS']; tagConfig.confirmationTags = ['FVG']; persistTagConfig();
    go('trades');
  });
  ok('boot zonder JS-errors', errs.length === 0, errs.slice(0, 2).join(' | '));

  console.log('─── Playbook kiezen neemt de lagen mee ───');
  const r1 = await p.evaluate(() => {
    openForm(null);
    const sel = document.getElementById('f_playbook'); sel.value = 'Mijn SFP'; onPlaybookPick();
    const chips = [...document.querySelectorAll('#layerbuilder .tagopt.on')].map(x => x.textContent);
    return { n: formLayers.length, l1: formLayers[0], l2: formLayers[1], grade: formGrade, chips };
  });
  ok('beide lagen overgenomen (timeframe + bias + tags)', r1.n === 2 && r1.l1.timeframe === '4H' && r1.l1.bias === 'Bullish' && r1.l1.confirmations.join() === 'FVG' && r1.l2.confirmations.join() === 'Eigen-conf', JSON.stringify(r1));
  ok('default-grade blijft ook werken', r1.grade === 'A');
  ok('chips in de builder tonen de selectie, óók een tag buiten de tag-config', r1.chips.includes('FVG') && r1.chips.includes('Eigen-conf'), JSON.stringify(r1.chips));
  ok('playbook-lagen zijn een kopie (playbook zelf blijft ongemoeid)', await p.evaluate(() => { formLayers[0].confirmations.push('X'); const okr = PBOOK['Mijn SFP'].layers[0].confirmations.join() === 'FVG'; formLayers[0].confirmations.pop(); return okr; }));

  console.log('─── Wisselen en deselecteren ───');
  ok('ander playbook kiezen vervangt onaangeraakte auto-lagen', await p.evaluate(() => { const sel = document.getElementById('f_playbook'); sel.value = 'Alt'; onPlaybookPick(); return formLayers.length === 1 && formLayers[0].timeframe === '1H' && formLayers[0].bias === 'Bearish'; }));
  ok('playbook zonder lagen laat bestaande lagen staan', await p.evaluate(() => { const sel = document.getElementById('f_playbook'); sel.value = 'Zonder lagen'; onPlaybookPick(); return formLayers.length === 1 && formLayers[0].timeframe === '1H'; }));
  ok('terug naar (geen) wist alleen onaangeraakte auto-lagen', await p.evaluate(() => { const sel = document.getElementById('f_playbook'); sel.value = 'Alt'; onPlaybookPick(); sel.value = ''; onPlaybookPick(); return formLayers.length === 0; }));

  console.log('─── Eigen lagen nooit stilletjes overschrijven ───');
  const r2 = await p.evaluate(() => {
    addLayer(); setLayerTF(0, '1D'); toggleLayerTag(0, 'setups', 'BOS');
    const sel = document.getElementById('f_playbook'); sel.value = 'Mijn SFP'; onPlaybookPick();
    const kept = formLayers.length === 1 && formLayers[0].timeframe === '1D';
    const tb = [...document.querySelectorAll('.toast button')].find(x => /Vervang/.test(x.textContent));
    return { kept, toast: !!tb };
  });
  ok('handmatige laag blijft staan + toast biedt vervangen aan', r2.kept && r2.toast, JSON.stringify(r2));
  ok('vervang-knop in de toast past de playbook-lagen alsnog toe', await p.evaluate(() => { const tb = [...document.querySelectorAll('.toast button')].find(x => /Vervang/.test(x.textContent)); if (tb) tb.click(); return formLayers.length === 2 && formLayers[0].timeframe === '4H'; }));

  console.log('─── Opslaan: lagen landen in de trade ───');
  const r3 = await p.evaluate(() => {
    document.getElementById('f_pair').value = 'BTC/USDT'; document.getElementById('f_entry').value = '100'; document.getElementById('f_exit').value = '110'; document.getElementById('f_pnl').value = '50';
    submitForm(null);
    const t = T[0];
    return { layers: (t.layers || []).length, conf: (t.layers || []).flatMap(L => L.confirmations), setup: t.setup, tf: t.timeframe, tags: tradeTagsAll(t) };
  });
  ok('trade opgeslagen met 2 lagen en playbook als setup', r3.layers === 2 && r3.setup === 'Mijn SFP' && r3.tf === '15M', JSON.stringify(r3));
  ok('laag-confirmaties tellen mee als tags (tag-filter/tabel)', r3.tags.includes('FVG') && r3.tags.includes('Eigen-conf'), JSON.stringify(r3.tags));
  ok('trade heropenen toont de lagen weer in het formulier', await p.evaluate(() => { openForm(T[0].id); const okr = formLayers.length === 2 && formLayers[1].confirmations.join() === 'Eigen-conf'; closeForm(); return okr; }));

  console.log('─── Standaard-weergave: lagen-veld wordt zichtbaar na keuze ───');
  const r4 = await p.evaluate(() => {
    viewPreset('standaard');
    openForm(null);
    const fld = () => document.getElementById('layerbuilder').closest('.field');
    const before = getComputedStyle(fld()).display === 'none';
    const sel = document.getElementById('f_playbook'); sel.value = 'Mijn SFP'; onPlaybookPick();
    const after = getComputedStyle(fld()).display !== 'none';
    closeForm(); viewPreset('alles');
    return { before, after };
  });
  ok('pro-veld verborgen vóór keuze, zichtbaar mét overgenomen lagen', r4.before && r4.after, JSON.stringify(r4));

  ok('geen JS-errors totaal', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== Playbook-lagen in trade: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
