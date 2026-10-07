// De stappen van een positie staan er vanaf de opening, niet pas na de eerste sluiting — OKX en Blofin.
//
// Denny 07-10-2026: "het lijkt me dat je dit al in een trade wilt zien vanaf dat die open gaat toch?
// Voor elke exchange." OKX en Blofin halen hun stappen per trade op (backfillFills). Die liet open
// trades links liggen en wees een trade met alleen een instap af ("minder dan twee stappen", "geen
// sluiting"). Hyperliquid staat in hl-deels-dicht.spec.js; Kraken heeft nog het bekende gat.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const bij = (a, b, tol = 1e-9) => Math.abs(+a - b) <= tol;
const APP = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');

const OPEN_T = Date.parse('2026-10-05T14:24:15Z'), BIJ_T = Date.parse('2026-10-06T09:00:00Z');
// OKX: 90 contracten van 0,0001 BTC = 0,009 BTC short; later 30 contracten erbij
const OKX = { exchange: 'okx', kind: 'live', status: 'open', placeholder: true, srcId: 'okx_open_3900000000000000001_' + OPEN_T, positionId: '3900000000000000001',
  pair: 'BTC/USDC', dir: 'short', date: '2026-10-05', time: '16:24', openTime: String(OPEN_T), entry: 86303, qtyAsset: 0.009, size: '776.73' };
const okxFill = (ts, side, sz, px, fee) => ({ instId: 'BTC-USD_UM_XPERP-251226', posSide: 'short', fillTime: String(ts), ts: String(ts), side, fillSz: String(sz), fillPx: String(px), fee: String(-fee), subType: '' });
// Blofin: 2 contracten (één contract = 1 asset in deze fixture) long ETH
const BLOFIN = { exchange: 'blofin', kind: 'live', status: 'open', srcId: 'blofin_open_77', positionId: '77', pair: 'ETH/USDT', dir: 'long',
  date: '2026-10-05', time: '16:24', openTime: String(OPEN_T), entry: 3000, qtyAsset: 2, size: '6000' };
const bfFill = (ts, side, sz, px, fee) => ({ instId: 'ETH-USDT', positionSide: 'long', ts: String(ts), side, fillSize: String(sz), fillPrice: String(px), fee: String(fee), tradeId: 't' + ts });

(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext()).newPage();
  p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
  p.on('dialog', d => d.accept());
  await p.route('**/*', r => /^https?:/.test(r.request().url()) ? r.abort() : r.continue());
  await p.addInitScript(() => localStorage.setItem('sj_welcomed', 'true'));
  await p.goto(APP, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1200);

  // backfill met nagemaakte fills; geeft de stappen van de eerste rij terug
  const backfill = (ex, fills, trade) => p.evaluate(async ([ex, rows, t]) => {
    ExchangeAPI[ex].fetchFills = async () => rows;
    CONNS[ex] = { connected: true, apiKey: 'k', apiSecret: 's', passphrase: 'p' };
    if (t) { T = [{ ...EMPTY_TRADE, id: 1, ...t }]; persist(); }
    const r = await backfillFills(ex);
    return { n: (r && r.n) || 0, reden: (r && r.reden) || '', stappen: (T[0].fills || []).map(f => ({ kind: f.kind, qty: f.qtyAsset, prijs: f.price, na: f.posAfterAsset })) };
  }, [ex, fills, trade]);

  console.log('─── OKX: een verse short, alleen de instap ───');
  const o1 = await backfill('okx', [okxFill(OPEN_T + 300, 'sell', 90, 86303, 0.36)], OKX);
  ok('de instap staat erin: open, 0,009 BTC @86.303 (contracten omgerekend)', o1.stappen.length === 1 && o1.stappen[0].kind === 'open' && bij(o1.stappen[0].qty, 0.009) && o1.stappen[0].prijs === 86303,
    JSON.stringify(o1));
  const voet = await p.evaluate(async () => { openForm(1); await new Promise(r => setTimeout(r, 300)); const v = document.querySelector('.extab'); const s = v ? v.innerText.replace(/\s+/g, ' ') : 'geen stappen-blok'; closeForm(); return s; });
  ok('het formulier toont "Zo is deze positie gelopen" met de instap', /Open/.test(voet) && /86\.303/.test(voet), voet.slice(0, 160));

  console.log('─── OKX: 30 contracten bijgekocht — de stappen worden opnieuw opgehaald ───');
  const o2 = await p.evaluate(async ([OPEN_T, BIJ_T]) => {
    // de open positie zoals de exchange hem nu meldt: groter
    ExchangeAPI.okx.fetchOpenPositions = async () => [{ ...EMPTY_TRADE, id: 'okx_open_3900000000000000001_' + OPEN_T, positionId: '3900000000000000001', openTime: String(OPEN_T),
      date: '2026-10-05', time: '16:24', pair: 'BTC/USDC', direction: 'short', entry: '86100', positionSize: '1033.2', positionSizeAsset: '0.012', source: 'okx', status: 'open' }];
    await syncOpenTrades('okx', { quiet: true });
    return { leeg: !(T[0].fills || []).length, qty: T[0].qtyAsset };
  }, [OPEN_T, BIJ_T]);
  ok('na de bijkoop zijn de oude stappen vervallen', o2.leeg, JSON.stringify(o2));
  const o3 = await backfill('okx', [okxFill(OPEN_T + 300, 'sell', 90, 86303, 0.36), okxFill(BIJ_T, 'sell', 30, 85500, 0.12)]);
  ok('en opnieuw opgehaald: instap + bijkoop, samen 0,012 BTC', o3.stappen.length === 2 && o3.stappen[1].kind === 'add' && bij(o3.stappen[1].na, 0.012), JSON.stringify(o3.stappen));
  const o4 = await p.evaluate(async () => { const voor = (T[0].fills || []).length; await syncOpenTrades('okx', { quiet: true }); return { voor, na: (T[0].fills || []).length }; });
  ok('ongewijzigde positie: de stappen blijven staan (geen nieuw verzoek nodig)', o4.voor === 2 && o4.na === 2, JSON.stringify(o4));

  console.log('─── Blofin: een verse long, alleen de instap ───');
  const b1 = await backfill('blofin', [bfFill(OPEN_T + 500, 'buy', 2, 3000, 1.2)], BLOFIN);
  ok('de instap staat erin: open, 2 ETH @3.000', b1.stappen.length === 1 && b1.stappen[0].kind === 'open' && bij(b1.stappen[0].qty, 2) && b1.stappen[0].prijs === 3000, JSON.stringify(b1));

  // Denny 07-10-2026, zijn OKX-short van 05-10: één order in elf stukjes (24 contracten) en een TP van 9.
  // De tabel toonde elf "instappen" en alles 2,67× te groot: de contractwaarde werd afgeleid uit de
  // sluitingen (0,0024 / 9), terwijl de grootte van een deels gesloten trade de hele positie is.
  console.log('─── OKX: deels dicht, één order in elf stukjes (Denny\'s short van 05-10) ───');
  const ORDER = '3981950639221428224', TP_T = Date.parse('2026-10-07T14:49:17Z'), ST = Date.parse('2026-10-05T04:16:16Z');
  const stukjes = [3, 4, 1, 2, 1, 1, 2, 1, 1, 1, 7].map((c, i) => ({ ...okxFill(ST, 'sell', c, 85840, 0.0042917 * c), tradeId: 'f' + i, ordId: ORDER }));
  const tp = { ...okxFill(TP_T, 'buy', 9, 82900.1, 0.037305045), ordId: '3989023279207600129', fillPnl: '2.64591' };
  const deels = await backfill('okx', [...stukjes, tp], { ...OKX, status: 'partial', placeholder: false, srcId: 'okx_3809943469299781632_1791173776681',
    openTime: String(ST), closeTime: String(TP_T), entry: 85840, exit: 82900.1, qtyAsset: 0.0024, size: '77.26', pnl: 0, realizedPnl: 2.5092 });
  ok('één order is één stap: instap en TP, niet elf instappen', deels.stappen.length === 2 && deels.stappen[0].kind === 'open' && deels.stappen[1].kind === 'close',
    JSON.stringify(deels.stappen.map(s => s.kind)));
  ok('instap 0,0024 BTC (24 contracten van 0,0001)', !!deels.stappen[0] && bij(deels.stappen[0].qty, 0.0024), JSON.stringify(deels.stappen[0]));
  ok('TP 0,0009 BTC @82.900,1 — klopt met +$ 2,65 bij 2.939,9 koersverschil', !!deels.stappen[1] && bij(deels.stappen[1].qty, 0.0009) && deels.stappen[1].prijs === 82900.1,
    JSON.stringify(deels.stappen[1]));
  ok('rest na de TP: 0,0015 BTC', !!deels.stappen[1] && bij(deels.stappen[1].na, 0.0015), JSON.stringify(deels.stappen[1]));

  console.log('─── Een journal met de oude, foute stappen herstelt (opruimstap v10) ───');
  const herstel = await p.evaluate(async ([rows]) => {
    // zoals Denny's trade 83 nu opgeslagen staat: twaalf stappen, alles 2,67× te groot
    T[0].fills = Array.from({ length: 12 }, (_, i) => ({ ts: 1791173776681, side: i < 11 ? 'sell' : 'buy', kind: i ? (i < 11 ? 'add' : 'close') : 'open', qty: 1, qtyAsset: 0.00026667, price: 85840, posAfterAsset: 0.004 }));
    const dicht = { ...T[0], id: 2, status: 'closed', srcId: 'okx_dicht', fills: [{ kind: 'open', qty: 1 }, { kind: 'close', qty: 1 }] };
    T.push(dicht);
    MIGRATIONS.find(m => m.v === 10).up();
    const naMigratie = { lopend: T[0].fills.length, dicht: T[1].fills.length };
    ExchangeAPI.okx.fetchFills = async () => rows;
    await backfillFills('okx');
    return { naMigratie, stappen: T[0].fills.map(f => [f.kind, +f.qtyAsset.toFixed(8)]) };
  }, [[...stukjes, tp]]);
  ok('de opruimstap haalt de foute stappen van de lopende positie weg, en laat een gesloten trade staan', herstel.naMigratie.lopend === 0 && herstel.naMigratie.dicht === 2, JSON.stringify(herstel.naMigratie));
  ok('de volgende sync zet de juiste terug: instap 0,0024, TP 0,0009', JSON.stringify(herstel.stappen) === JSON.stringify([['open', 0.0024], ['close', 0.0009]]), JSON.stringify(herstel.stappen));

  console.log('─── Wat niet verandert ───');
  const dicht = await backfill('okx', [okxFill(OPEN_T + 300, 'sell', 90, 86303, 0.36)], { ...OKX, status: 'closed', placeholder: false, srcId: 'okx_3900000000000000001_' + OPEN_T, closeTime: String(BIJ_T), exit: 85000, pnl: 11 });
  ok('een gesloten trade met alleen een instap blijft zonder stappen (daar hoort een sluiting bij)', dicht.stappen.length === 0, JSON.stringify(dicht));
  const leeg = await backfill('okx', [], OKX);
  ok('geen fills: niets kapot, geen stappen', leeg.stappen.length === 0 && leeg.n === 0, JSON.stringify(leeg));

  ok('geen JS-fouten', errs.length === 0, errs[0]);
  console.log(`\n=== Stappen vanaf de opening: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
