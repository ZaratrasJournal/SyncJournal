// Borgt de nieuwe standaard-tags voor verse journals (Denny 2026-09-17, zijn eigen set
// uit het tag-beheer): exacte lijsten per categorie, emotie-splitsing negatief/positief,
// de kalm-heuristiek met de nieuwe namen, en dat bestaande gebruikers hun eigen lijsten
// behouden. Verse journals starten zonder eigen labels (customTags leeg).
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
  await p.evaluate(() => { try { hideWelcome() } catch (e) {} });
  ok('boot zonder JS-errors', errs.length === 0, errs.slice(0, 2).join(' | '));

  console.log('─── Verse journal: exact Denny\'s set ───');
  const cfg = await p.evaluate(() => JSON.parse(JSON.stringify(tagConfig)));
  ok('setups: 10 stuks, o.a. BOS/MSB/F2R/Structuur, zonder demo-namen', cfg.setupTags.length === 10 && ['BOS', 'MSB', 'F2R', 'Structuur', 'Bearish retest'].every(t => cfg.setupTags.includes(t)) && !cfg.setupTags.includes('London SFP') && !cfg.setupTags.includes('VWAP-bounce'), cfg.setupTags.join(','));
  ok('confirmaties: 13 stuks incl. Support/Resistance OB en Spot koop/verkoop', cfg.confirmationTags.length === 13 && ['Support OB', 'Resistance OB', 'Session sweep US/UK/AS', 'VAH / VAL / POC', 'Spot koop', 'Spot verkoop', 'FVG'].every(t => cfg.confirmationTags.includes(t)), cfg.confirmationTags.join(','));
  ok('timeframes: 10 stuks van 5M t/m Weekly', cfg.timeframeTags.length === 10 && ['5M', '10M', '12H', 'Weekly'].every(t => cfg.timeframeTags.includes(t)) && !cfg.timeframeTags.includes('1M'), cfg.timeframeTags.join(','));
  ok('emoties: precies 6 (3 negatief, 3 positief)', cfg.emotionTags.length === 6 && ['FOMO', 'Gehaast', 'Twijfels', 'Geduldig', 'Rustig', 'Zelfverzekerd'].every(t => cfg.emotionTags.includes(t)), cfg.emotionTags.join(','));
  ok('fouten: 8 stuks, zonder "Te laat in"', cfg.mistakeTags.length === 8 && cfg.mistakeTags.includes('Revenge trade') && !cfg.mistakeTags.includes('Te laat in'), cfg.mistakeTags.join(','));
  ok('missed-redenen: 7 stuks incl. Bewuste skip en Offline', cfg.missedReasonTags.length === 7 && ['Durf', 'Bewuste skip', 'Offline', 'Kapitaal vol'].every(t => cfg.missedReasonTags.includes(t)), cfg.missedReasonTags.join(','));
  ok('eigen labels starten leeg', cfg.customTags.length === 0);

  console.log('─── Formulier gebruikt de nieuwe set ───');
  const form = await p.evaluate(() => {
    openForm(null);
    const emoHtml = document.getElementById('emobuilder').innerHTML;
    const negBlok = emoHtml.split('Positief')[0], posBlok = emoHtml.split('Positief')[1] || '';
    const mist = document.getElementById('mistakebuilder').textContent;
    addLayer(); const layer = document.getElementById('layerbuilder').textContent;
    formLayers = []; formDirty = false; closeForm();
    return { negOk: ['FOMO', 'Gehaast', 'Twijfels'].every(e => negBlok.includes(e)), posOk: ['Geduldig', 'Rustig', 'Zelfverzekerd'].every(e => posBlok.includes(e)), posClean: !/FOMO|Gehaast/.test(posBlok), mistOk: /Overtrading/.test(mist) && /Revenge trade/.test(mist), layerOk: /Structuur/.test(layer) && /Spot koop/.test(layer) };
  });
  ok('emoties netjes gesplitst: FOMO/Gehaast/Twijfels negatief, rest positief', form.negOk && form.posOk && form.posClean, JSON.stringify(form));
  ok('fouten-picker en setup-lagen tonen de nieuwe tags', form.mistOk && form.layerOk);
  ok('filterbar-fouten en setups-dropdown volgen mee', await p.evaluate(() => {
    T = [{ id: 1, date: '2026-09-10', time: '10:00', pair: 'BTC/USDT', dir: 'long', setup: '', session: 'London', status: 'closed', kind: 'live', exchange: '', entry: 100, exit: 110, stop: 95, size: '1000', pnl: 50, r: 1, tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] }]; persist(); go('trades');
    const dd = document.querySelector('[data-dd="mistake"]'); const su = document.querySelector('[data-dd="setup"]');
    return dd && /Revenge trade/.test(dd.textContent) && !/Te laat in/.test(dd.textContent) && su && /F2R/.test(su.textContent);
  }));

  console.log('─── Kalm-heuristiek met de nieuwe namen ───');
  ok('"Rustig" telt als kalm in de checklist, "Geduldig" geeft rating 5 bij winst', await p.evaluate(() => {
    const t1 = { pnl: 50, emotions: ['Rustig'], mistakes: [] };
    const t2 = { pnl: 50, rating: 0, emotions: ['Geduldig'], mistakes: [] };
    const rating = t2.rating || (tradeEmotions(t2).some(e => CALM_EMOS.includes(e)) ? (t2.pnl > 0 ? 5 : 4) : (t2.pnl > 0 ? 3 : 2));
    return defChecks(t1)[3] === true && rating === 5 && defChecks({ pnl: 0, emotions: ['FOMO'], mistakes: [] })[3] === false;
  }));

  console.log('─── Bestaande gebruiker behoudt eigen lijsten ───');
  await p.evaluate(() => { tagConfig.setupTags = ['MijnEigenSetup']; tagConfig.customTags = ['MijnLabel']; persistTagConfig(); });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(600);
  ok('eigen aanpassingen overleven een herlaad (defaults dringen zich niet op)', await p.evaluate(() => { try { hideWelcome() } catch (e) {} return tagConfig.setupTags.join() === 'MijnEigenSetup' && tagConfig.customTags.join() === 'MijnLabel' && tagConfig.mistakeTags.length === 8; }));

  ok('geen JS-errors totaal', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== Standaard-tags: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
