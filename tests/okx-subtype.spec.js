// OKX stap 2: lezen wat OKX zelf per fill zegt, in plaats van het afleiden.
// Bron (docs-v5, Transaction details, geverifieerd 22-09-2026):
//   subType  3/4 open long/short · 5/6 close long/short · 100-107 liquidatie · 125-128 ADL
//   fillPnl  "Realised P&L from this fill for close-position trades ... Returns 0 for opening trades"
//   ts       "...For chronological ordering of trades, sort by fillTime, not ts."
// Toets: Denny's echte zeven fills (positie 3809943469299781632) moeten exact hetzelfde
// blijven opleveren, én blijven kloppen wanneer `side` opzettelijk wordt verminkt.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const bij = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 1e-9 : tol);
const APP = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');
const INST = 'BTC-USD_UM_XPERP-04APR31';

// de echte fills, met de P&L die OKX per order rapporteerde (short: sell opent, buy sluit)
const ECHT = [
  { ts: 1789869078000, side: 'sell', qty: 38, price: 81008.90, fee: 0.15391691, sub: '4' },
  { ts: 1789869106000, side: 'sell', qty: 13, price: 81011.70, fee: 0.05265761, sub: '4' },
  { ts: 1789872312000, side: 'buy', qty: 25, price: 80378.50, fee: 0.10047313, sub: '6', okx: 1.57778431 },
  { ts: 1789922291000, side: 'buy', qty: 13, price: 81403.10, fee: 0.05300000, sub: '6', okx: -0.52 },
  { ts: 1789931306000, side: 'sell', qty: 39, price: 81055.10, fee: 0.15800000, sub: '4' },
  { ts: 1789953772000, side: 'buy', qty: 39, price: 82032.90, fee: 0.16000000, sub: '6', okx: -3.86 },
  { ts: 1790012341000, side: 'buy', qty: 13, price: 85888.60, fee: 0.05600000, sub: '6', okx: -6.30 },
];
const ruw = (f, o) => f.map((x, i) => ({
  instId: INST, posSide: 'short', tradeId: 't' + i, ordId: 'o' + i,
  ts: String(x.ts), fillTime: String(x.ts), side: x.side, subType: x.sub,
  fillSz: String(x.qty), fillPx: String(x.price), fee: String(-x.fee),
  fillPnl: String(x.okx != null ? x.okx : 0), ...(o ? o(x, i) : {}),
}));
const TRADE = {
  id: 1, exchange: 'okx', srcId: 'okx_3809943469299781632_1789869078888', pair: 'BTC/USDC', dir: 'short',
  status: 'closed', kind: 'live', date: '2026-09-20', time: '03:51', entry: 81029.32, exit: 82039.31,
  openTime: '1789869078888', closeTime: '1790012341907', qtyAsset: 0.009, pnl: -9.7626, r: -0.6,
  size: '729.26', fees: 0.7279, tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [],
};

(async () => {
  const b = await chromium.launch(); const errs = [];
  async function open() {
    const ctx = await b.newContext(); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
    p.on('dialog', d => d.accept());
    await p.route('**/*', r => /^https?:/.test(r.request().url()) ? r.abort() : r.continue());
    await p.addInitScript(() => localStorage.setItem('sj_welcomed', 'true'));
    await p.goto(APP, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1200);
    return { ctx, p };
  }
  const stappen = (p, rows, trade) => p.evaluate(async ([r, t]) => {
    ExchangeAPI.okx.fetchFills = async () => r;
    CONNS.okx = { connected: true, apiKey: 'k', apiSecret: 's', passphrase: 'p' };
    T = [{ ...t, fills: [] }]; persist();
    const uit = await backfillFills('okx', { tradeId: t.id });
    const sum = (T[0].fills || []).length ? fillSummary(T[0].fills) : null;
    return { n: uit.n, reden: uit.reden, sum, f: (T[0].fills || []).map(x => ({ kind: x.kind, ts: x.ts, qty: x.qty, price: x.price, pnl: x.pnl, pnlCalc: x.pnlCalc, avg: x.avgEntry, pos: x.posAfter })) };
  }, [rows, trade]);

  console.log('─── Denny’s echte positie, nu met subType en fillPnl ───');
  {
    const { ctx, p } = await open();
    const r = await stappen(p, ruw(ECHT), TRADE);
    ok('zeven stappen: open, bij, af, af, bij, af, af', r.f.map(x => x.kind).join() === 'open,add,close,close,add,close,close', r.f.map(x => x.kind).join());
    const af = r.f.filter(x => x.kind === 'close'), verwacht = ECHT.filter(x => x.okx != null);
    ok('elke afbouwstap toont nu exact het bedrag van OKX zelf',
      af.length === verwacht.length && af.every((c, i) => c.pnl === verwacht[i].okx), JSON.stringify(af.map(x => x.pnl)));
    ok('onze eigen berekening staat ernaast en komt op hetzelfde uit',
      af.every((c, i) => bij(c.pnlCalc, verwacht[i].okx, 0.011)), JSON.stringify(af.map(x => +x.pnlCalc.toFixed(4))));
    ok('het gewogen gemiddelde over alle instappen blijft OKX’ openAvgPx',
      bij(r.sum.avgEntry, 81029.32444444444, 1e-6), JSON.stringify(r.sum && r.sum.avgEntry));
    ok('en het loopt op zoals het hoort: 81.008,90 → 81.009,61 → 81.043,73',
      bij(r.f[0].avg, 81008.90, 0.01) && bij(r.f[1].avg, 81009.61, 0.01) && bij(r.f[4].avg, 81043.73, 0.01),
      JSON.stringify(r.f.map(x => +x.avg.toFixed(2))));
    await ctx.close();
  }

  console.log('─── Nu breken we het raadwerk: side verminkt, subType intact ───');
  {
    const { ctx, p } = await open();
    /* Één sluit-fill de verkeerde kant op: op een short sluit je met buy, maar hier staat
       sell. Zonder subType leest de teller dat als "positie vergroten". (Alle sides tegelijk
       omdraaien zou de positie alleen spiegelen; dan blijven de soorten per definitie gelijk.) */
    const kapot = (extra) => ruw(ECHT, (x, i) => (i === 2 ? { side: 'sell', ...extra } : {}));
    const r = await stappen(p, kapot(), TRADE);
    ok('de soorten stappen kloppen nog steeds', r.f.map(x => x.kind).join() === 'open,add,close,close,add,close,close', r.f.map(x => x.kind).join());
    ok('en de bedragen ook', r.f.filter(x => x.kind === 'close').every((c, i) => c.pnl === ECHT.filter(y => y.okx != null)[i].okx), JSON.stringify(r.f.filter(x => x.kind === 'close').map(x => x.pnl)));
    const zonder = await stappen(p, kapot({ subType: '' }), TRADE);
    ok('zónder subType wordt diezelfde fill een bijkoop — de vertaling doet dus het werk',
      zonder.f[2].kind === 'add' && zonder.f.map(x => x.kind).join() !== r.f.map(x => x.kind).join(),
      zonder.f.map(x => x.kind).join());
    await ctx.close();
  }

  console.log('─── fillTime is leidend, niet ts ───');
  {
    const { ctx, p } = await open();
    // OKX maakte de records in een andere volgorde aan dan de uitvoering plaatsvond
    const doorElkaar = ruw(ECHT).map((f, i) => ({ ...f, ts: String(1790012341000 - i) }));
    const r = await stappen(p, doorElkaar, TRADE);
    ok('de stappen volgen de uitvoeringstijd', r.f.map(x => x.ts).join() === ECHT.map(x => x.ts).join(), JSON.stringify(r.f.map(x => x.ts)));
    ok('en de soorten kloppen nog', r.f.map(x => x.kind).join() === 'open,add,close,close,add,close,close', r.f.map(x => x.kind).join());
    await ctx.close();
  }

  console.log('─── Liquidatie en ADL krijgen een eigen label ───');
  {
    const { ctx, p } = await open();
    const geliq = [
      { ts: 1789869078000, side: 'sell', qty: 51, price: 81000, fee: 0.2, sub: '4' },
      { ts: 1789931306000, side: 'buy', qty: 20, price: 80000, fee: 0.1, sub: '6', okx: 1.0 },
      { ts: 1790012341000, side: 'buy', qty: 31, price: 86000, fee: 0.1, sub: '105', okx: -15.5 },   // Liquidation short
    ];
    const r = await stappen(p, ruw(geliq), TRADE);
    ok('de gedwongen sluiting heet Liq, niet Af', r.f.map(x => x.kind).join() === 'open,close,liq', r.f.map(x => x.kind).join());
    ok('en telt gewoon mee als afbouw: de positie eindigt vlak', r.f[2].pos === 0 && r.f[2].pnl === -15.5, JSON.stringify(r.f[2]));
    const tabel = await p.evaluate(() => { openForm(1); const el = document.querySelector('.exwrap'); const txt = el ? el.innerText : ''; closeForm(); return txt; });
    ok('de stappentabel toont hem ook zo', /Liq/.test(tabel), JSON.stringify(tabel.slice(0, 140)));
    ok('een trade die alléén door liquidatie sloot wordt niet weggegooid', r.n === 1, JSON.stringify(r.n));
    await ctx.close();
  }

  console.log('─── Randgevallen ───');
  {
    const { ctx, p } = await open();
    const r = await p.evaluate(() => {
      const st = ExchangeAPI.okx._subType.bind(ExchangeAPI.okx);
      return { open: st('3'), sluit: st('5'), liq: st('104'), adl: st('126'), netBuy: st('1'), leeg: st(''), raar: st('abc'), onbekend: st('999') };
    });
    ok('3 opent, 5 sluit, 104 en 126 zijn gedwongen sluitingen',
      r.open.effect === 'inc' && r.sluit.effect === 'dec' && r.liq.liq === true && r.adl.liq === true, JSON.stringify(r));
    ok('1/2 (net-mode buy/sell) laat de teller beslissen, net als onbekende waarden',
      !r.netBuy.effect && !r.leeg.effect && !r.raar.effect && !r.onbekend.effect, JSON.stringify(r));
    const pos0 = await p.evaluate(() => fillTimeline([{ ts: 1, side: 'buy', qty: 2, price: 100, effect: 'dec' }, { ts: 2, side: 'sell', qty: 2, price: 110, effect: 'dec' }], { mult: 1 }).map(x => x.kind));
    ok('"sluiten" terwijl er niets openstaat opent alsnog — anders reken je tegen nul af', pos0.join() === 'open,close', JSON.stringify(pos0));
    await ctx.close();
  }

  ok('geen JS-errors totaal', errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));
  console.log(`\n=== OKX subType/fillPnl: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
