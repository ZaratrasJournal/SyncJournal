// Executie-stappen: elke instap, bijkoop en afbouw van één positie zichtbaar.
// Aanleiding: Denny's OKX-positie 3809943469299781632 (21-09-2026). Eén positie, twee
// instappen, vier afbouwstappen waarvan één in winst, en middenin een bijshort.
//
// Het lopend-gemiddelde-model is hier de waarheidstoets: het moet de bedragen die OKX
// zélf rapporteert exact reproduceren. De cijfers hieronder komen uit zijn echte export.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const bij = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 1e-9 : tol);

const APP = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
const CT = 0.0001;   // 1 X-Perp-contract = 0,0001 BTC

// de echte fills, met de P&L die OKX per order rapporteerde
const ECHT = [
  { ts: 1789869078000, side: 'sell', qty: 38, price: 81008.90, fee: 0.15391691 },
  { ts: 1789869106000, side: 'sell', qty: 13, price: 81011.70, fee: 0.05265761 },
  { ts: 1789872312000, side: 'buy', qty: 25, price: 80378.50, fee: 0.10047313, okx: 1.57778431 },
  { ts: 1789922291000, side: 'buy', qty: 13, price: 81403.10, fee: 0.05300000, okx: -0.52 },
  { ts: 1789931306000, side: 'sell', qty: 39, price: 81055.10, fee: 0.15800000 },
  { ts: 1789953772000, side: 'buy', qty: 39, price: 82032.90, fee: 0.16000000, okx: -3.86 },
  { ts: 1790012341000, side: 'buy', qty: 13, price: 85888.60, fee: 0.05600000, okx: -6.30 },
];
const ruw = (f) => f.map(x => ({ instId: 'BTC-USD_UM_XPERP-04APR31', posSide: 'short', ts: String(x.ts), side: x.side, fillSz: String(x.qty), fillPx: String(x.price), fee: String(-x.fee) }));
const TRADE = {
  id: 1, exchange: 'okx', pair: 'BTC/USDC', dir: 'short', status: 'closed', kind: 'live',
  date: '2026-09-20', time: '03:51', entry: 81029.32, exit: 82039.31, openTime: '1789869078888',
  closeTime: '1790012341907', qtyAsset: 0.009, pnl: -9.7626, r: -0.6, size: '729.26', fees: 0.7279,
  tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [],
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
  // fills aanbieden alsof ze van de exchange komen, en de backfill draaien
  const backfill = (p, fills, trade) => p.evaluate(async ([rows, t]) => {
    ExchangeAPI.okx.fetchFills = async () => rows;
    CONNS.okx = { connected: true, apiKey: 'k', apiSecret: 's', passphrase: 'p' };
    T = [t]; persist();
    const n = await backfillFills('okx');
    return { n, fills: T[0].fills || [] };
  }, [fills, trade]);

  console.log('─── De rekenkern tegen OKX’ eigen bedragen ───');
  {
    const { ctx, p } = await open();
    const r = await p.evaluate(steps => {
      const f = fillTimeline(steps, { dir: 'short', mult: 0.0001 });
      return { f, sum: fillSummary(f) };
    }, ECHT.map(({ ts, side, qty, price, fee }) => ({ ts, side, qty, price, fee })));

    const closes = r.f.filter(x => x.kind === 'close');
    const verwacht = ECHT.filter(x => x.okx != null);
    ok('elke afbouwstap komt uit op het bedrag dat OKX rapporteert',
      closes.length === verwacht.length && closes.every((c, i) => bij(c.pnl, verwacht[i].okx, 0.011)),
      JSON.stringify(closes.map(c => +c.pnl.toFixed(4))));
    // de eerste hebben we op acht decimalen van OKX, dus die mag scherper
    ok('en de eerste, waarvan we OKX’ volle precisie hebben, tot op vier decimalen',
      bij(closes[0].pnl, 1.57778431, 0.0001), JSON.stringify(closes[0].pnl));

    ok('het gewogen gemiddelde over alle instappen is exact OKX’ openAvgPx',
      bij(r.sum.avgEntry, 81029.32444444444, 1e-6), JSON.stringify(r.sum.avgEntry));
    ok('de soorten stappen kloppen: open, bij, af', r.f.map(x => x.kind).join() === 'open,add,close,close,add,close,close', r.f.map(x => x.kind).join());
    ok('de positie loopt op tot 52 contracten en eindigt op nul',
      r.sum.peak === 52 && r.f[r.f.length - 1].posAfter === 0, JSON.stringify({ piek: r.sum.peak, eind: r.f[r.f.length - 1].posAfter }));
    ok('drie instappen, vier afbouwstappen', r.sum.entries === 3 && r.sum.exits === 4, JSON.stringify(r.sum));
    ok('afbouwen laat het gemiddelde ongemoeid, bijkopen verschuift het',
      bij(r.f[2].avgEntry, r.f[3].avgEntry) && !bij(r.f[3].avgEntry, r.f[4].avgEntry), JSON.stringify(r.f.map(x => +x.avgEntry.toFixed(2))));
    await ctx.close();
  }

  console.log('─── Randgevallen van de rekenkern ───');
  {
    const { ctx, p } = await open();
    const r = await p.evaluate(() => {
      const lang = fillTimeline([{ ts: 1, side: 'buy', qty: 10, price: 100 }, { ts: 2, side: 'sell', qty: 10, price: 110 }], { dir: 'long', mult: 1 });
      const doorElkaar = fillTimeline([{ ts: 9, side: 'sell', qty: 5, price: 110 }, { ts: 1, side: 'buy', qty: 5, price: 100 }], { dir: 'long', mult: 1 });
      // 10 long, dan 15 verkopen: 10 worden afgerekend, de resterende 5 draaien je om
      const omkeer = fillTimeline([{ ts: 1, side: 'buy', qty: 10, price: 100 }, { ts: 2, side: 'sell', qty: 15, price: 110 }], { mult: 1 });
      const dubbel = fillTimeline([{ ts: 1, id: 'a', side: 'buy', qty: 5, price: 100 }, { ts: 1, id: 'a', side: 'buy', qty: 5, price: 100 }, { ts: 2, id: 'b', side: 'sell', qty: 5, price: 110 }], { mult: 1 });
      const nul = fillTimeline([{ ts: 1, side: 'buy', qty: 0, price: 100 }, { ts: 2, side: 'buy', qty: 3, price: 100 }], { mult: 1 });
      const leeg = fillTimeline([], { dir: 'long', mult: 1 });
      const geenMult = fillTimeline([{ ts: 1, side: 'buy', qty: 2, price: 50 }, { ts: 2, side: 'sell', qty: 2, price: 60 }], { dir: 'long' });
      return {
        langPnl: lang[1].pnl, volgorde: doorElkaar.map(x => x.kind).join(),
        omkeerPnl: omkeer[1].pnl, omkeerKind: omkeer[1].kind, omkeerPos: omkeer[1].posAfter,
        omkeerDir: omkeer[1].dirAfter, omkeerAvg: omkeer[1].avgEntry,
        dubbelLen: dubbel.length, dubbelPos: dubbel[0].posAfter,
        nulLen: nul.length, leeg: leeg.length, geenMultPnl: geenMult[1].pnl,
      };
    });
    ok('long rekent gespiegeld: koop 100, verkoop 110 = +10 per stuk', bij(r.langPnl, 100), JSON.stringify(r.langPnl));
    ok('fills in willekeurige volgorde worden op tijd gezet', r.volgorde === 'open,close', r.volgorde);
    ok('meer sluiten dan openstaat rekent alleen af over wat open stond', bij(r.omkeerPnl, 100), JSON.stringify(r.omkeerPnl));
    ok('en de rest draait je positie om, met een nieuwe basis',
      r.omkeerKind === 'flip' && r.omkeerPos === 5 && r.omkeerDir === 'short' && bij(r.omkeerAvg, 110),
      JSON.stringify({ k: r.omkeerKind, pos: r.omkeerPos, dir: r.omkeerDir, avg: r.omkeerAvg }));
    ok('dezelfde fill twee keer telt één keer', r.dubbelLen === 2 && r.dubbelPos === 5, JSON.stringify({ len: r.dubbelLen, pos: r.dubbelPos }));
    ok('een fill van nul wordt overgeslagen', r.nulLen === 1, JSON.stringify(r.nulLen));
    ok('een lege lijst geeft een lege lijst', r.leeg === 0);
    ok('zonder contractwaarde rekent hij in hele eenheden', bij(r.geenMultPnl, 20), JSON.stringify(r.geenMultPnl));
    await ctx.close();
  }

  console.log('─── Ophalen tijdens een sync ───');
  {
    const { ctx, p } = await open();
    const r = await backfill(p, ruw(ECHT), TRADE);
    ok('de trade krijgt zijn stappen', r.n === 1 && r.fills.length === 7, JSON.stringify({ n: r.n, len: r.fills.length }));
    ok('de contractwaarde wordt uit de trade zelf afgeleid (0,0001 BTC per contract)',
      bij(r.fills[0].qtyAsset, 0.0038) && bij(r.fills[4].qtyAsset, 0.0039), JSON.stringify(r.fills.map(f => f.qtyAsset)));
    ok('het gerealiseerde bedrag uit de stappen ligt bij de P&L van de trade',
      bij(r.fills.filter(f => f.kind === 'close').reduce((s, f) => s + f.pnl, 0) - TRADE.fees, TRADE.pnl, 0.1),
      JSON.stringify(r.fills.filter(f => f.kind === 'close').reduce((s, f) => s + f.pnl, 0)));

    const nog = await p.evaluate(async () => { const n = await backfillFills('okx'); return { n, len: T[0].fills.length }; });
    ok('een tweede keer doet niets: de stappen staan er al', nog.n === 0 && nog.len === 7, JSON.stringify(nog));

    const bijgewerkt = await p.evaluate(() => {
      const vers = { ...T[0], closeTime: '1790099999999', pnl: -12 };
      const gew = refreshFromSync(T[0], vers);
      return { gew, fills: (T[0].fills || []).length };
    });
    ok('groeit de positie verder, dan vervallen de oude stappen', bijgewerkt.gew && bijgewerkt.fills === 0, JSON.stringify(bijgewerkt));
    await ctx.close();
  }
  {
    const { ctx, p } = await open();
    const enkel = await backfill(p, ruw([ECHT[0], ECHT[6]]).slice(0, 1), TRADE);
    ok('bij één losse fill wordt er niets opgeslagen', enkel.n === 0 && enkel.fills.length === 0, JSON.stringify(enkel));

    const stale = await p.evaluate(async () => {
      TAB_STALE = true; T[0].fills = [];
      const n = await backfillFills('okx'); TAB_STALE = false; return n;
    });
    ok('een verouderd tabblad haalt niets op', stale === 0, JSON.stringify(stale));
    await ctx.close();
  }

  console.log('─── De weergave ───');
  {
    const { ctx, p } = await open();
    await backfill(p, ruw(ECHT), TRADE);
    const r = await p.evaluate(() => {
      const h = execTable(T[0]);
      const rijen = (h.match(/<tr>/g) || []).length;
      return {
        rijen, kop: /3 instappen/.test(h) && /4 afbouwstappen/.test(h),
        beide: /eerste instap/.test(h) && /gemiddeld/.test(h),
        vlak: /vlak/.test(h), totaal: /Samen/.test(h),
        centen: /\+\$ 1,58/.test(h) && /−\$ 6,30/.test(h),
        simpel: execTable({ pair: 'X', dir: 'long', fills: [] }),
      };
    });
    ok('elke stap krijgt een rij, plus kop en totaal', r.rijen === 9, JSON.stringify(r.rijen));
    ok('de kop telt de instappen en afbouwstappen', r.kop);
    ok('en zet je eerste instap naast je gemiddelde', r.beide);
    ok('de laatste stap toont dat de positie vlak is', r.vlak);
    ok('er is een totaalregel', r.totaal);
    ok('bedragen per stap staan op de cent, niet afgerond op hele euro’s', r.centen);
    ok('een trade zonder stappen toont geen tabel', r.simpel === '');
    await ctx.close();
  }

  console.log('─── Samen met de valuta-omrekening ───');
  {
    const ctx = await b.newContext(); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
    await p.route('**/*', route => {
      const u = route.request().url();
      if (/frankfurter/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ amount: 1, base: 'USD', date: '2026-09-21', rates: { EUR: 0.5 } }) });
      return /^https?:/.test(u) ? route.abort() : route.continue();
    });
    await p.addInitScript(() => { localStorage.setItem('sj_welcomed', 'true'); localStorage.setItem('sj_state', JSON.stringify({ currency: 'EUR' })); });
    await p.goto(APP, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1500);
    await backfill(p, ruw(ECHT), TRADE);
    const r = await p.evaluate(async () => {
      await fxSync(); render();
      const bron = T[0].fills.filter(f => f.kind === 'close').reduce((s, f) => s + f.pnl, 0);
      const toond = (FT.find(t => t.id === 1) || {}).fills.filter(f => f.kind === 'close').reduce((s, f) => s + f.pnl, 0);
      return { valuta: dispCur(), bron, toond };
    });
    ok('de stappen gaan mee in de weergave-valuta', r.valuta === 'EUR' && bij(r.toond, r.bron * 0.5, 1e-6), JSON.stringify(r));
    ok('en het opgeslagen bedrag blijft onaangeroerd in dollars', bij(r.bron, -9.0898, 0.001), JSON.stringify(r.bron));
    await ctx.close();
  }

  ok('geen JS-errors totaal', errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));
  console.log(`\n=== Executie-stappen: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
