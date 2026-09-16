// Borgt de opruiming van achtergebleven demo-playbooks (Denny op work, 2026-09-16):
// v0.9.70 stopte het zaaien, maar bestaande opslag hield de 6 demo's vast. pbDemoCleanup
// (boot) verwijdert ze alsnog — uitsluitend exact-onaangeraakte exemplaren zonder trades
// op die setup. Bewerkte, gebruikte en eigen playbooks blijven gegarandeerd staan.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
  const b = await chromium.launch(); const p = await b.newPage(); p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(400);

  // Opslag naspelen zoals die er bij een pre-v0.9.70 gebruiker uitziet: alle 6 demo's
  // (zaai-vorm = array van criteria-teksten), waarvan één bewerkt en één met een trade,
  // plus een eigen playbook.
  await p.evaluate(async () => {
    try { hideWelcome() } catch (e) {}
    const demo = {
      'London SFP': ['Wacht op sweep van Londen high/low', 'Bevestiging via LTF break of structure', 'Entry op retest, SL achter de sweep', 'TP1 op 2R, rest laten lopen'],
      'Trend-pullback': ['Alleen in richting van de HTF-trend', 'Wacht pullback naar EMA/order-block', 'Entry op bevestigingscandle', 'Risk max 1% per trade'],
      'BOS-retest': ['Break of structure op M15', 'Wacht op retest van de breakzone', 'SL achter de structuur', 'Minimaal 2R doel'],
      'Range-fade': ['Duidelijke range vereist', 'Fade alleen de extremen', 'Klein risico, snelle TP', 'Nooit in een trending markt'],
      'Reclaim': ['Level reclaim én hold', 'Wacht bevestiging boven/onder', 'SL krap achter het level'],
      'News trade': ['Alleen high-impact nieuws', 'Wacht tot de eerste spike eruit is', 'Klein risico — hoge variantie'],
    };
    const pb = {};
    Object.entries(demo).forEach(([k, v]) => pb[k] = pbNormalize(k, v));
    pb['Reclaim'].oneLiner = 'zelf aangepast';            // bewerkt → moet blijven
    pb['Mijn eigen'] = pbNormalize('Mijn eigen', ['Eigen regel 1']); // eigen → moet blijven
    await IDB.set('pbook', pb);
    await IDB.set('trades', [{ id: 1, date: '2026-09-10', time: '10:00', pair: 'BTC/USDT', dir: 'long', setup: 'BOS-retest', session: 'London', status: 'closed', kind: 'live', exchange: '', entry: 100, exit: 110, stop: 95, size: '1000', pnl: 50, r: 1, tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] }]);
    DB.save('welcomed', true); DB.save('inited', true);
  });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(600);

  const res = await p.evaluate(async () => ({ keys: Object.keys(PBOOK).sort(), stored: Object.keys((await IDB.get('pbook')) || {}).sort(), reclaimNote: (PBOOK['Reclaim'] || {}).oneLiner }));
  ok('onaangeraakte + ongebruikte demo-playbooks zijn opgeruimd', !res.keys.includes('London SFP') && !res.keys.includes('Trend-pullback') && !res.keys.includes('Range-fade') && !res.keys.includes('News trade'), JSON.stringify(res.keys));
  ok('demo met eigen bewerking blijft staan', res.keys.includes('Reclaim') && res.reclaimNote === 'zelf aangepast');
  ok('demo met een trade op die setup blijft staan', res.keys.includes('BOS-retest'));
  ok('eigen playbook blijft staan', res.keys.includes('Mijn eigen'));
  ok('opruiming is ook persistent opgeslagen', res.stored.join() === res.keys.join(), JSON.stringify(res.stored));
  ok('tweede start: opruiming is idempotent', await p.evaluate(() => pbDemoCleanup() === 0 && Object.keys(PBOOK).length === 3));
  ok('geen JS-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== Demo-playbook-opruiming: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
