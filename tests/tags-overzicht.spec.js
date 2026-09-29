// De Tags-kolom in het trade-overzicht toont wat je in "Setup & psychologie" aanklikte.
//
// Denny 29-09-2026, met screenshot van het formulier: laag 1H · Bullish · setup MSB, emotie
// Geduldig — "wat ik heb geselecteerd komt niet terug in het overzicht". Uit zijn export bleek
// alles correct opgeslagen; de kolom toonde alleen eigen labels en bevestigingen. Setups,
// emoties en fouten vielen weg, en een playbook met alleen setups leverde een lege kolom op.
//
// Alleen de WEERGAVE is verbreed. Filters, zoeken en statistieken lopen via tradeTagsAll en
// mogen niet verschuiven — dat bewaakt het laatste blok.
const { chromium } = require('playwright');
const path = require('path');

let pass = 0, fail = 0;
const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const B = { pair: 'BTC/USDC', dir: 'long', status: 'open', date: '2026-09-28', entry: 83000, size: '200' };
// Zoals in Denny's export
const HL  = { ...B, id: 'hl1',  exchange: 'hyperliquid', time: '17:40', setup: '1H MSB/BOS',
  layers: [{ timeframe: '1H', bias: 'Bullish', setups: ['MSB'], confirmations: [] }], emotions: ['Geduldig'], emotion: 'Geduldig' };
const OKX = { ...B, id: 'okx1', exchange: 'okx', time: '16:14', setup: '1H MSB/BOS',
  layers: [{ timeframe: '1H', bias: 'Bullish', setups: ['MSB'], confirmations: [] }] };
// Alles door elkaar, met een bevestiging die óók als losse tag bestaat (mag maar één keer)
const MIX = { ...B, id: 'mix1', exchange: 'blofin', time: '09:00', status: 'closed', exit: 84000, pnl: 10,
  layers: [{ timeframe: '4H', setups: ['BOS'], confirmations: ['OB'] }, { timeframe: '15M', setups: ['SFP'], confirmations: [] }],
  tags: ['OB', 'nieuwsdag'], emotions: ['FOMO'], mistakes: ['Te vroeg in'] };
// Niets aangeklikt: de kolom blijft leeg (geen streepje, geen fout)
const LEEG = { ...B, id: 'leeg1', exchange: 'okx', time: '08:00', status: 'closed', exit: 83100, pnl: 1 };

(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await p.setViewportSize({ width: 1600, height: 1000 });
  await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(600);
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(800);
  await p.evaluate(() => { try { hideWelcome(); } catch (e) {} });
  ok('boot zonder JS-fouten', errs.length === 0, errs[0]);

  await p.evaluate((rijen) => {
    T = rijen.map(x => ({ ...EMPTY_TRADE, ...x }));
    persist(); clearGFilter(); setFilter('kind', 'alle'); go('trades');
  }, [HL, OKX, MIX, LEEG]);
  await p.waitForTimeout(500);

  // Tags-cel per trade, via de rij van die trade (datum/tijd is uniek in deze set)
  const cellen = await p.evaluate(() => {
    const uit = {};
    document.querySelectorAll('tbody tr').forEach(tr => {
      const tagCel = tr.querySelector('td[data-l="Tags"]');
      if (!tagCel) return;
      const chips = [...tagCel.querySelectorAll('.tagchip')].map(c => c.textContent.trim());
      uit[tr.textContent.match(/\d\d:\d\d/) ? tr.textContent.match(/\d\d:\d\d/)[0] : '?'] = chips;
    });
    return uit;
  });

  console.log('─── Wat je aanklikte, komt terug ───');
  ok('Hyperliquid: de setup MSB staat erin', (cellen['17:40'] || []).includes('MSB'), JSON.stringify(cellen['17:40']));
  ok('Hyperliquid: de emotie Geduldig staat erin', (cellen['17:40'] || []).includes('Geduldig'), JSON.stringify(cellen['17:40']));
  ok('OKX: een playbook met alleen setups geeft geen lege kolom meer', (cellen['16:14'] || []).includes('MSB'), JSON.stringify(cellen['16:14']));

  console.log('─── Alle soorten, elk één keer ───');
  const mix = cellen['09:00'] || [];
  ['BOS', 'SFP', 'OB', 'nieuwsdag', 'FOMO', 'Te vroeg in'].forEach(x =>
    ok(`gemengde trade toont "${x}"`, mix.includes(x), JSON.stringify(mix)));
  ok('"OB" staat er één keer, al zit hij zowel in de laag als in de tags', mix.filter(x => x === 'OB').length === 1, JSON.stringify(mix));
  ok('setups komen eerst, dan de rest', mix.indexOf('BOS') < mix.indexOf('FOMO'), JSON.stringify(mix));

  console.log('─── Niets aangeklikt ───');
  ok('lege trade: lege kolom, geen chips', (cellen['08:00'] || ['x']).length === 0, JSON.stringify(cellen['08:00']));

  console.log('─── Filters en statistieken verschuiven niet ───');
  const filt = await p.evaluate(() => ({
    hl: tradeTagsAll(T.find(t => t.id === 'hl1')),
    mix: tradeTagsAll(T.find(t => t.id === 'mix1')),
  }));
  ok('tradeTagsAll (filters/zoeken/stats) is onveranderd: geen setups of emoties', filt.hl.length === 0, JSON.stringify(filt.hl));
  ok('tradeTagsAll blijft eigen tags + bevestigingen', JSON.stringify(filt.mix.sort()) === JSON.stringify(['OB', 'nieuwsdag']), JSON.stringify(filt.mix));

  ok('geen nieuwe JS-fouten', errs.length === 0, errs[0]);
  console.log(`\n=== Tags-overzicht: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
