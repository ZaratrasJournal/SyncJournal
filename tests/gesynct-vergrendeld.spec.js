// Gesyncte trades: de exchange is de bron (Denny 22-09-2026). In het formulier zijn entry,
// exit, size, fees en P&L alleen-lezen en de TP-bouwer verdwijnt; stop, risico, notities en
// tags blijven van de trader. Handmatige en CSV-trades blijven volledig bewerkbaar.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const APP = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');

const basis = { pair: 'BTC/USDC', dir: 'short', status: 'closed', kind: 'live', date: '2026-09-20', time: '03:51', entry: 81029.32, exit: 82039.31, stop: 0, pnl: -9.7626, fees: 0.7279, size: '729.26', qtyAsset: 0.009, r: -0.6,
  tps: [{ price: 80378.5, pct: 50, r: '', hit: true, ts: 0 }], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [], notes: '' };
const FILLS = [{ ts: 1, side: 'sell', qty: 90, qtyAsset: 0.009, price: 81029.32, fee: 0.4, kind: 'open', posAfter: 90, posAfterAsset: 0.009, dirAfter: 'short', avgEntry: 81029.32, pnl: null },
  { ts: 2, side: 'buy', qty: 90, qtyAsset: 0.009, price: 82039.31, fee: 0.33, kind: 'close', posAfter: 0, posAfterAsset: 0, dirAfter: '', avgEntry: 81029.32, pnl: -9.09 }];

(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext(); const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
  p.on('dialog', d => d.accept());
  await p.route('**/*', r => /^https?:/.test(r.request().url()) ? r.abort() : r.continue());
  await p.addInitScript(() => localStorage.setItem('sj_welcomed', 'true'));
  await p.goto(APP, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1200);
  await p.evaluate(([bs, fl]) => {
    T = [
      { ...bs, id: 1, exchange: 'okx', srcId: 'okx_3809943469299781632_1789869078888', fills: fl },
      { ...bs, id: 2, exchange: 'okx', srcId: '' },                                   // handmatig ingevoerd
      { ...bs, id: 3, exchange: 'hyperliquid', srcId: 'hyperliquid_csv_abc' },        // uit een CSV
    ];
    CONNS.okx = { connected: true, apiKey: 'k', apiSecret: 's', passphrase: 'p' };
  }, [basis, FILLS]);

  const kijk = id => p.evaluate(id => {
    openForm(id);
    const ro = k => { const el = document.getElementById('f_' + k); return el ? el.hasAttribute('readonly') : null; };
    const r = { entry: ro('entry'), exit: ro('exit'), size: ro('size'), pnl: ro('pnl'), fees: ro('fees'), stop: ro('stop'), notes: ro('notes'),
      tpBouwer: !!document.getElementById('tpbuilder'), slot: !!document.querySelector('.lockbar'), stappen: !!document.querySelector('.exwrap table') };
    closeForm(); return r;
  }, id);

  console.log('─── Gesyncte trade ───');
  const g = await kijk(1);
  ok('entry, exit, size, fees en P&L zijn alleen-lezen', g.entry && g.exit && g.size && g.fees && g.pnl, JSON.stringify(g));
  ok('stop en notities niet', g.stop === false && g.notes === false, JSON.stringify(g));
  ok('geen TP-bouwer, wel de stappentabel en de uitleg', !g.tpBouwer && g.stappen && g.slot, JSON.stringify(g));

  const bewaard = await p.evaluate(() => {
    openForm(1);
    // de trader vult zijn stop en een notitie in; en iemand knoeit via de console met de entry
    document.getElementById('f_stop').value = '80000'; calcTrade(true);
    const pnlNaCalc = document.getElementById('f_pnl').value;
    document.getElementById('f_notes').value = 'mijn les';
    document.getElementById('f_entry').value = '1'; document.getElementById('f_pnl').value = '999';
    submitForm(1);
    const t = T.find(x => x.id === 1);
    return { pnlNaCalc, entry: t.entry, pnl: t.pnl, size: t.size, tps: t.tps.length, stop: t.stop, notes: t.notes, r: t.r, fills: (t.fills || []).length };
  });
  ok('calcTrade laat de P&L van de exchange staan', bewaard.pnlNaCalc === '-9.7626', JSON.stringify(bewaard.pnlNaCalc));
  ok('opslaan: entry, P&L, size en TP\'s komen uit de trade, niet uit het formulier', bewaard.entry === 81029.32 && bewaard.pnl === -9.7626 && bewaard.size === '729.26' && bewaard.tps === 1, JSON.stringify(bewaard));
  ok('maar stop en notitie zijn wél opgeslagen, en R is herrekend met de echte P&L', bewaard.stop === 80000 && bewaard.notes === 'mijn les' && bewaard.r !== -0.6, JSON.stringify(bewaard));
  ok('de stappen blijven staan', bewaard.fills === 2, JSON.stringify(bewaard.fills));

  console.log('─── Handmatig en CSV ───');
  const h = await kijk(2), c = await kijk(3);
  ok('handmatige trade: alles bewerkbaar, met TP-bouwer', !h.entry && !h.pnl && h.tpBouwer && !h.slot, JSON.stringify(h));
  ok('CSV-trade: ook bewerkbaar', !c.entry && !c.pnl && c.tpBouwer && !c.slot, JSON.stringify(c));
  const nieuw = await p.evaluate(() => { openForm(null); const r = { entry: document.getElementById('f_entry').hasAttribute('readonly'), tp: !!document.getElementById('tpbuilder') }; closeForm(); return r; });
  ok('nieuwe trade: bewerkbaar, met TP-bouwer', !nieuw.entry && nieuw.tp, JSON.stringify(nieuw));

  ok('geen JS-errors totaal', errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));
  console.log(`\n=== Gesynct vergrendeld: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
