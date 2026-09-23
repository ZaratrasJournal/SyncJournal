// Handmatige trades krijgen dezelfde stappentabel, afgeleid uit wat je toch al invult
// (Denny 23-09-2026, optie 1 uit demos/handmatige-stappen-demo.html): instap op je entry
// met je hele positie, een afbouw per aangevinkte TP, de rest op je exit.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const bij = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 1e-6 : tol);
const APP = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');
const OPEN = +new Date('2026-09-15T09:30:00'), DICHT = +new Date('2026-09-15T11:30:00');

(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext(); const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
  p.on('dialog', d => d.accept());
  await p.route('**/*', r => /^https?:/.test(r.request().url()) ? r.abort() : r.continue());
  await p.addInitScript(() => localStorage.setItem('sj_welcomed', 'true'));
  await p.goto(APP, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1200);

  // de trade uit de demo: XAU long, 2 lots vanaf 2400, TP1 op 2420 (helft), rest op 2430
  const stappen = (o) => p.evaluate(([x, open, dicht]) => {
    const t = { id: 1, exchange: 'manual', srcId: '', pair: 'XAU/USD', dir: 'long', status: 'closed', kind: 'live',
      date: '2026-09-15', time: '09:30', openTime: String(open), closeTime: String(dicht),
      entry: 2400, exit: 2430, stop: 2380, pnl: 59, r: 1.25, size: '4800', qtyAsset: 2, fees: 1,
      tps: [{ price: 2420, pct: 50, r: '', hit: true, ts: +new Date('2026-09-15T10:15:00') }, { price: 2450, pct: 50, r: '', hit: false, ts: 0 }],
      tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [], ...x };
    T = [t];
    const tl = stappenVan(t);
    return { n: tl.length, kinds: tl.map(s => s.kind).join(), synth: tl.every(s => s.synthetic),
      qty: tl.map(s => +s.qty.toFixed(6)), prijs: tl.map(s => s.price), tijden: tl.map(s => s.ts),
      pnl: tl.map(s => s.pnl == null ? null : +s.pnl.toFixed(4)), fees: +tl.reduce((a, s) => a + s.fee, 0).toFixed(6),
      eind: tl.length ? tl[tl.length - 1].posAfter : null };
  }, [o, OPEN, DICHT]);
  const tabel = (o) => p.evaluate(([x, open, dicht]) => {
    const t = { id: 1, exchange: 'manual', srcId: '', pair: 'XAU/USD', dir: 'long', status: 'closed', kind: 'live',
      date: '2026-09-15', time: '09:30', openTime: String(open), closeTime: String(dicht),
      entry: 2400, exit: 2430, stop: 2380, pnl: 59, r: 1.25, size: '4800', qtyAsset: 2, fees: 1,
      tps: [{ price: 2420, pct: 50, r: '', hit: true, ts: +new Date('2026-09-15T10:15:00') }, { price: 2450, pct: 50, r: '', hit: false, ts: 0 }],
      tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [], ...x };
    T = [t]; CONNS.okx = { connected: true, apiKey: 'k', apiSecret: 's', passphrase: 'p' };
    openForm(1);
    const el = document.querySelector('.exwrap');
    const r = { blok: !!el, tabel: !!(el && el.querySelector('table')),
      rijen: el ? el.querySelectorAll('tbody tr:not(.exday):not(.exnew)').length : 0,
      tekst: el ? el.innerText.replace(/\s+/g, ' ').trim() : '',
      knop: !!(el && el.querySelector('button')), tpBouwer: !!document.getElementById('tpbuilder') };
    closeForm(); return r;
  }, [o, OPEN, DICHT]);

  console.log('─── De trade uit de demo ───');
  {
    const r = await stappen({});
    ok('drie stappen: instap, TP1 eraf, rest op de exit', r.n === 3 && r.kinds === 'open,close,close', JSON.stringify(r.kinds));
    ok('en ze zijn allemaal gemarkeerd als afgeleid', r.synth === true);
    ok('aantallen: 2 in, 1 op TP1, 1 op de exit', JSON.stringify(r.qty) === JSON.stringify([2, 1, 1]), JSON.stringify(r.qty));
    ok('prijzen: 2400, 2420, 2430', JSON.stringify(r.prijs) === JSON.stringify([2400, 2420, 2430]), JSON.stringify(r.prijs));
    ok('tijden: open, de tijd van TP1, en de sluittijd',
      r.tijden[0] === OPEN && r.tijden[1] === +new Date('2026-09-15T10:15:00') && r.tijden[2] === DICHT, JSON.stringify(r.tijden));
    ok('P&L per stap: +20 op TP1, +30 op de rest', JSON.stringify(r.pnl) === JSON.stringify([null, 20, 30]), JSON.stringify(r.pnl));
    ok('de fees zijn naar rato verdeeld en tellen op tot 1', bij(r.fees, 1), JSON.stringify(r.fees));
    ok('de positie eindigt vlak', r.eind === 0, JSON.stringify(r.eind));
  }

  console.log('─── In het formulier ───');
  {
    const r = await tabel({});
    ok('de stappentabel staat er, met drie regels', r.tabel && r.rijen === 3, JSON.stringify({ t: r.tabel, n: r.rijen }));
    ok('met een zichtbare markering dat het afgeleid is', /afgeleid uit je invoer/.test(r.tekst), r.tekst.slice(0, 90));
    ok('en de TP-bouwer blijft gewoon staan', r.tpBouwer === true);
  }

  console.log('─── Wanneer het níét moet gebeuren ───');
  {
    const geenTp = await stappen({ tps: [] });
    ok('zonder TP’s geen tabel — in en uit vertelt niets nieuws', geenTp.n === 0, JSON.stringify(geenTp.n));
    const eenTp100 = await stappen({ tps: [{ price: 2430, pct: 100, r: '', hit: true, ts: 0 }] });
    ok('één TP voor de hele positie ook niet', eenTp100.n === 0, JSON.stringify(eenTp100.n));
    const nietGeraakt = await stappen({ tps: [{ price: 2420, pct: 50, r: '', hit: false, ts: 0 }, { price: 2450, pct: 50, r: '', hit: false, ts: 0 }] });
    ok('niet-aangevinkte TP’s tellen niet mee', nietGeraakt.n === 0, JSON.stringify(nietGeraakt.n));
    const open = await stappen({ status: 'open', exit: 0 });
    ok('een lopende positie krijgt geen afgeleide stappen', open.n === 0, JSON.stringify(open.n));
    const geenSize = await stappen({ qtyAsset: 0, size: '' });
    ok('zonder size valt er niets af te leiden', geenSize.n === 0, JSON.stringify(geenSize.n));
    const geenTijd = await stappen({ openTime: '', closeTime: '' });
    ok('zonder open- en sluittijd ook niet', geenTijd.n === 0, JSON.stringify(geenTijd.n));
  }

  console.log('─── Gesyncte trades blijven op de echte stappen wachten ───');
  {
    const r = await tabel({ exchange: 'okx', srcId: 'okx_123_456' });
    ok('geen verzonnen tabel', r.tabel === false, JSON.stringify(r));
    ok('maar de knop om ze op te halen', r.knop && /nog niet opgehaald/.test(r.tekst), r.tekst.slice(0, 80));
    const metFills = await p.evaluate(([open, dicht]) => {
      const t = { id: 1, exchange: 'okx', srcId: 'okx_1_2', pair: 'BTC/USDC', dir: 'short', status: 'closed', kind: 'live',
        date: '2026-09-15', time: '09:30', openTime: String(open), closeTime: String(dicht), entry: 100, exit: 90, pnl: 10, r: 1,
        size: '100', qtyAsset: 1, fees: 0.1, tps: [{ price: 95, pct: 50, r: '', hit: true, ts: 0 }],
        fills: [{ ts: open, side: 'sell', kind: 'open', qty: 1, qtyAsset: 1, price: 100, fee: 0.05, posAfter: 1, posAfterAsset: 1, dirAfter: 'short', avgEntry: 100, pnl: null },
          { ts: dicht, side: 'buy', kind: 'close', qty: 1, qtyAsset: 1, price: 90, fee: 0.05, posAfter: 0, posAfterAsset: 0, dirAfter: '', avgEntry: 100, pnl: 10 }],
        tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] };
      T = [t]; const tl = stappenVan(t);
      return { n: tl.length, synth: tl.some(s => s.synthetic), prijs: tl.map(s => s.price) };
    }, [OPEN, DICHT]);
    ok('en met echte stappen worden die gebruikt, niet de afgeleide',
      metFills.n === 2 && !metFills.synth && JSON.stringify(metFills.prijs) === JSON.stringify([100, 90]), JSON.stringify(metFills));
  }

  console.log('─── Randgevallen ───');
  {
    const short = await stappen({ dir: 'short', entry: 2400, exit: 2370, stop: 2420, pnl: 59,
      tps: [{ price: 2380, pct: 50, r: '', hit: true, ts: 0 }, { price: 2350, pct: 50, r: '', hit: false, ts: 0 }] });
    ok('bij een short is de instap een verkoop en telt de winst de goede kant op',
      short.kinds === 'open,close,close' && short.pnl[1] === 20 && short.pnl[2] === 30, JSON.stringify(short));
    const geenTijdTp = await stappen({ tps: [{ price: 2420, pct: 50, r: '', hit: true, ts: 0 }, { price: 2450, pct: 50, r: '', hit: false, ts: 0 }] });
    ok('een TP zonder tijd wordt netjes tussen open en sluiting gezet',
      geenTijdTp.n === 3 && geenTijdTp.tijden[1] > OPEN && geenTijdTp.tijden[1] < DICHT, JSON.stringify(geenTijdTp.tijden));
    const drie = await stappen({ tps: [{ price: 2410, pct: 30, r: '', hit: true, ts: 0 }, { price: 2420, pct: 30, r: '', hit: true, ts: 0 }, { price: 2440, pct: 40, r: '', hit: false, ts: 0 }] });
    ok('drie niveaus waarvan twee geraakt geeft vier stappen', drie.n === 4 && drie.kinds === 'open,close,close,close', JSON.stringify(drie.kinds));
    ok('en de aantallen kloppen met de percentages', JSON.stringify(drie.qty) === JSON.stringify([2, 0.6, 0.6, 0.8]), JSON.stringify(drie.qty));
    const zonderFees = await stappen({ fees: 0 });
    ok('zonder fees blijft alles op nul staan', bij(zonderFees.fees, 0), JSON.stringify(zonderFees.fees));
    const uitSize = await stappen({ qtyAsset: 0 });
    ok('geen qtyAsset? dan uit size gedeeld door entry', bij(uitSize.qty[0], 2, 1e-9), JSON.stringify(uitSize.qty));
    const teveel = await stappen({ tps: [{ price: 2410, pct: 70, r: '', hit: true, ts: 0 }, { price: 2420, pct: 70, r: '', hit: true, ts: 0 }] });
    ok('meer dan 100% verdeeld breekt niets', teveel.n >= 2 && teveel.qty.every(q => q > 0), JSON.stringify(teveel));
  }

  ok('geen JS-errors totaal', errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));
  console.log(`\n=== Afgeleide stappen: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
