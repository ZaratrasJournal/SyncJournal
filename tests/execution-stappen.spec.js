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
  id: 1, exchange: 'okx', srcId: 'okx_3809943469299781632', pair: 'BTC/USDC', dir: 'short', status: 'closed', kind: 'live',
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
    const r = await backfillFills('okx');
    return { n: (r && r.n) || 0, reden: (r && r.reden) || '', fills: T[0].fills || [] };
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

    const nog = await p.evaluate(async () => { const r = await backfillFills('okx'); return { n: (r && r.n) || 0, len: T[0].fills.length }; });
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
      const r = await backfillFills('okx'); TAB_STALE = false; return (r && r.n) || 0;
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

  console.log('─── In het bewerkformulier, waar Denny keek ───');
  {
    const { ctx, p } = await open();
    const zonder = await p.evaluate(() => {
      CONNS.okx = { connected: true, apiKey: 'k', apiSecret: 's', passphrase: 'p' };
      T = [{ id: 1, exchange: 'okx', pair: 'BTC/USDC', dir: 'short', status: 'closed', kind: 'live', date: '2026-09-20', time: '03:51', entry: 81029.32, exit: 82039.31, size: '729.26', pnl: -9.7626, r: 0, openTime: '1789869078888', closeTime: '1790012341907', qtyAsset: 0.009, tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] }];
      openForm(1);
      const el = document.querySelector('.exwrap'); const txt = el ? el.innerText : '';
      closeForm(); return txt;
    });
    // De belofte "komt bij je volgende sync" is vervangen door een knop: doen is beter dan wachten.
    ok('zonder stappen zegt het formulier dat, met een knop om ze te halen',
      /nog niet opgehaald/.test(zonder) && /Stappen ophalen/.test(zonder), JSON.stringify(zonder.slice(0, 80)));

    const zonderKoppeling = await p.evaluate(() => {
      delete CONNS.okx; openForm(1);
      const el = document.querySelector('.exwrap'); const er = !!el; closeForm(); return er;
    });
    ok('zonder koppeling belooft het formulier niets', zonderKoppeling === false);

    await backfill(p, ruw(ECHT), TRADE);
    const met = await p.evaluate(() => {
      CONNS.okx = { connected: true, apiKey: 'k', apiSecret: 's', passphrase: 'p' };
      openForm(1);
      const el = document.querySelector('.exwrap'); const n = el ? el.querySelectorAll('tbody tr').length : 0;
      const centen = el ? /1,58/.test(el.innerText) : false;
      closeForm(); return { n, centen };
    });
    ok('met stappen staat de tabel in het formulier', met.n === 7, JSON.stringify(met.n));
    ok('inclusief de winst en het verlies per stap', met.centen, JSON.stringify(met));
    await ctx.close();
  }

  console.log('─── Bestaande trades worden opgeschoond ───');
  {
    const { ctx, p } = await open();
    const r = await p.evaluate(async () => {
      T = [{ id: 1, exchange: 'okx', pair: 'BTC/USDC', dir: 'short', status: 'closed', date: '2026-09-20', time: '03:51',
        entry: 81029.32444444444, exit: 82039.30777777778, size: '729.26', pnl: -9.7626, r: 0,
        tps: [{ price: 80500.123456789, pct: 50, hit: true, ts: 0 }], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] }];
      DB.save('schema', 3);
      await runMigrations();
      return { entry: T[0].entry, exit: T[0].exit, tp: T[0].tps[0].price };
    });
    ok('een bestaande entry met veertien decimalen wordt afgerond', r.entry === 81029.32, JSON.stringify(r.entry));
    ok('de exit ook', r.exit === 82039.31, JSON.stringify(r.exit));
    ok('en de prijs van een TP-niveau', r.tp === 80500.12, JSON.stringify(r.tp));
    await ctx.close();
  }

  console.log('─── Als het ophalen niet lukt, zegt de app waarom ───');
  {
    const { ctx, p } = await open();
    const r = await p.evaluate(async t0 => {
      CONNS.okx = { connected: true, apiKey: 'k', apiSecret: 's', passphrase: 'p' };
      const uit = {};
      T = [{ ...t0 }]; ExchangeAPI.okx.fetchFills = async () => []; uit.leeg = await backfillFills('okx');
      T = [{ ...t0 }]; ExchangeAPI.okx.fetchFills = async () => { throw new Error('403 van de proxy'); }; uit.fout = await backfillFills('okx');
      T = [{ ...t0 }]; ExchangeAPI.okx.fetchFills = async () => [{ instId: 'ETH-USDT-SWAP', posSide: 'long', ts: '1789869078000', side: 'buy', fillSz: '1', fillPx: '2000', fee: '-0.1' }];
      uit.mismatch = await backfillFills('okx');
      T = []; uit.niets = await backfillFills('okx');
      return uit;
    }, TRADE);
    ok('geen fills terug: zegt dat, met het gezochte tijdvenster', r.leeg.reden === 'geen-fills' && /venster|t\/m/.test(r.leeg.detail), JSON.stringify(r.leeg.reden));
    ok('een fout van de proxy komt er letterlijk uit', r.fout.reden === 'fout' && /403/.test(r.fout.detail), JSON.stringify(r.fout.detail));
    ok('fills die nergens bij horen: noemt het instrument en de kant',
      r.mismatch.reden === 'geen-match' && /ETH-USDT-SWAP/.test(r.mismatch.detail) && /buy\/long/.test(r.mismatch.detail), JSON.stringify(r.mismatch.detail).slice(0, 90));
    ok('niets te doen is geen fout', r.niets.reden === '', JSON.stringify(r.niets));

    const gemeld = await p.evaluate(async t0 => {
      T = [{ ...t0 }]; CONNS.okx = { connected: true, apiKey: 'k', apiSecret: 's', passphrase: 'p' };
      ExchangeAPI.okx.fetchFills = async () => [];
      ExchangeAPI.okx.fetchTrades = async () => [];
      ExchangeAPI.okx.testConnection = async () => ({ success: true, balance: '0' });
      ExchangeAPI.okx.fetchOpenPositions = async () => [];
      await syncExchange('okx', {});
      const bar = document.getElementById('errbar');
      return { zichtbaar: bar.classList.contains('on'), tekst: bar.innerText.slice(0, 120), log: (ErrorCenter.log[0] || {}).msg || '' };
    }, TRADE);
    ok('een handmatige sync meldt het zichtbaar', gemeld.zichtbaar && /stappen/i.test(gemeld.tekst), JSON.stringify(gemeld.tekst).slice(0, 110));
    ok('en de reden staat in de details', /geen-fills/.test(gemeld.log), JSON.stringify(gemeld.log).slice(0, 90));
    await ctx.close();
  }

  console.log('─── Afwijkende veldnamen en de knop (les uit de oude journal) ───');
  {
    const { ctx, p } = await open();
    const r = await p.evaluate(async t0 => {
      CONNS.okx = { connected: true, apiKey: 'k', apiSecret: 's', passphrase: 'p' };
      const anders = [
        { symbol: 'BTC-USD_UM_XPERP-04APR31', positionSide: 'short', fillTime: '1789869078000', side: 'sell', size: '38', price: '81008.9', commission: '-0.154', fillId: 'b1' },
        { symbol: 'BTC-USD_UM_XPERP-04APR31', positionSide: 'short', fillTime: '1789872312000', side: 'buy', size: '25', price: '80378.5', commission: '-0.1', fillId: 'b2' },
      ];
      T = [{ ...t0 }]; ExchangeAPI.okx.fetchFills = async () => anders;
      const a = await backfillFills('okx');
      const stappen = (T[0].fills || []).map(f => f.kind).join();
      // en de knop in het formulier
      T = [{ ...t0 }]; openForm(T[0].id);
      const knop = document.querySelector('.exwrap button');
      const label = knop ? knop.textContent : 'GEEN KNOP';
      closeForm();
      return { n: a.n, stappen, label };
    }, TRADE);
    ok('fills met andere veldnamen worden ook gelezen', r.n === 1 && r.stappen === 'open,close', JSON.stringify(r));
    ok('en in het formulier staat een knop om ze nu op te halen', r.label === 'Stappen ophalen', JSON.stringify(r.label));
    await ctx.close();
  }

  console.log('─── Het gevraagde tijdvenster (Denny’s diagnose 22-09-2026) ───');
  {
    // Zijn diagnose vroeg om 1-2-2025 t/m 21-9-2026: het venster liep van zijn oudste tot
    // zijn nieuwste trade, want alle 1002 werden in één aanvraag gepropt. OKX bewaart fills
    // ~3 maanden en geeft op zo'n bereik niets terug.
    const { ctx, p } = await open();
    const r = await p.evaluate(async t0 => {
      CONNS.okx = { connected: true, apiKey: 'k', apiSecret: 's', passphrase: 'p' };
      const dag = 864e5, nu = Date.now();
      const maak = (i, dagenTerug) => ({ ...t0, id: 100 + i, srcId: 'okx_' + i, fills: [],
        openTime: String(nu - dagenTerug * dag - 36e5), closeTime: String(nu - dagenTerug * dag) });
      const gevraagd = [];
      ExchangeAPI.okx.fetchFills = async (k, s2, p2, sym, van, tot) => { gevraagd.push([van, tot]); return []; };

      // één verse trade tussen een berg oude
      T = [maak(0, 1), ...Array.from({ length: 30 }, (_, i) => maak(i + 1, 300 + i))];
      await backfillFills('okx');
      const spanwijdte = gevraagd.map(([a, b]) => b - a);

      // veertig verse trades: de sync werkt er hooguit een handvol per keer af
      gevraagd.length = 0;
      T = Array.from({ length: 40 }, (_, i) => maak(i, i));
      await backfillFills('okx');
      const eersteRonde = gevraagd.length;

      // zes verse trades: na één ronde is er niets meer te proberen
      T = Array.from({ length: 6 }, (_, i) => maak(i, i));
      gevraagd.length = 0; await backfillFills('okx'); const ronde1 = gevraagd.length;
      gevraagd.length = 0; await backfillFills('okx'); const tweedeRonde = gevraagd.length;

      // een week later mag het weer
      T.forEach(t => { if (t.fillsNone) t.fillsNone = Date.now() - 8 * dag; });
      gevraagd.length = 0;
      await backfillFills('okx');
      const naEenWeek = gevraagd.length;

      // handmatige knop: precies die ene trade, ook als hij al is afgeschreven
      gevraagd.length = 0;
      const mik = T[3]; mik.fillsNone = Date.now();
      const los = await backfillFills('okx', { tradeId: mik.id });
      const losAantal = gevraagd.length;
      const losVenster = losAantal === 1 && gevraagd[0][0] < +mik.openTime && gevraagd[0][1] > +mik.closeTime;

      /* Voorbeelddata draagt het label van een exchange maar heeft geen bron-id: die
         574 OKX-demotrades vanaf 1-2-2025 maakten het venster negentien maanden breed. */
      gevraagd.length = 0;
      T = [{ ...maak(0, 2), srcId: '' }, maak(1, 3)];
      await backfillFills('okx');
      const demoOvergeslagen = gevraagd.length === 1;
      gevraagd.length = 0;
      await backfillFills('okx', { tradeId: T[0].id });
      const demoViaKnop = gevraagd.length === 1;

      // en een oude trade meldt dat de exchange hem niet meer heeft
      T = [maak(0, 200)];
      const oud = await backfillFills('okx', { tradeId: T[0].id });
      return { spanwijdte, eersteRonde, ronde1, tweedeRonde, naEenWeek, losAantal, losVenster,
        losReden: los.reden, demoOvergeslagen, demoViaKnop, oudDetail: oud.detail || '' };
    }, TRADE);

    ok('alleen de trade binnen de bewaartermijn wordt opgevraagd, niet de oude berg',
      r.spanwijdte.length === 1, JSON.stringify(r.spanwijdte.length));
    ok('en dat venster beslaat die ene positie, geen maanden',
      r.spanwijdte[0] < 3 * 864e5, JSON.stringify(Math.round(r.spanwijdte[0] / 36e5) + ' uur'));
    ok('per sync hooguit een handvol aanvragen, ook met veertig open staande',
      r.eersteRonde === 8, JSON.stringify(r.eersteRonde));
    ok('een mislukte poging wordt niet elke sync herhaald',
      r.ronde1 === 6 && r.tweedeRonde === 0, JSON.stringify({ ronde1: r.ronde1, ronde2: r.tweedeRonde }));
    ok('maar na een week krijgt hij een nieuwe kans', r.naEenWeek === 6, JSON.stringify(r.naEenWeek));
    ok('de knop vraagt precies één trade op, met zijn eigen venster',
      r.losAantal === 1 && r.losVenster, JSON.stringify({ n: r.losAantal, venster: r.losVenster }));
    ok('en trapt door de afschrijving heen', r.losReden === 'geen-fills', JSON.stringify(r.losReden));
    ok('voorbeelddata zonder bron-id wordt vanzelf niet opgevraagd',
      r.demoOvergeslagen, JSON.stringify(r.demoOvergeslagen));
    ok('maar de knop probeert het wél als je er zelf om vraagt',
      r.demoViaKnop, JSON.stringify(r.demoViaKnop));
    ok('bij een oude trade zegt de app dat de exchange hem niet meer bewaart',
      /ouder dan 90 dagen/.test(r.oudDetail), JSON.stringify(r.oudDetail).slice(0, 110));
    await ctx.close();
  }

  console.log('─── Wat de adapter teruggeeft ───');
  {
    /* De OKX-adapter had fetchFills twee keer staan. De tweede won, gaf {fills,total} in
       plaats van een array en liet alleen de afsluit-fills door. backfillFills leest
       raw.length → undefined → "geen fills", wat OKX ook antwoordde. (Denny 22-09-2026.) */
    const { ctx, p } = await open();
    const r = await p.evaluate(async () => {
      const ruw = [
        { instId: 'BTC-USD_UM_XPERP-04APR31', posSide: 'short', ts: '1', side: 'sell', fillSz: '10', fillPx: '100', fee: '-0.1' },
        { instId: 'BTC-USD_UM_XPERP-04APR31', posSide: 'short', ts: '2', side: 'buy', fillSz: '10', fillPx: '90', fee: '-0.1', fillPnl: '5' },
      ];
      const echt = window.fetch;
      window.fetch = async () => ({ ok: true, status: 200, json: async () => ({ fills: ruw }), text: async () => '' });
      const uit = {};
      // alleen adapters die het stappen-pad ondersteunen; de rest volgt nog het oude
      // TP-contract ({fills,total}) en wordt door backfillFills overgeslagen
      for (const id of Object.keys(ExchangeAPI)) {
        const ad = ExchangeAPI[id];
        if (typeof ad.fetchFills !== 'function' || typeof ad.stepsForTrade !== 'function') continue;
        try { const v = await ad.fetchFills('k', 's', 'p', '', 1, 9); uit[id] = Array.isArray(v) ? v.length : 'GEEN ARRAY: ' + JSON.stringify(v).slice(0, 60); }
        catch (e) { uit[id] = 'fout: ' + ((e && e.message) || e); }
      }
      window.fetch = echt;
      return uit;
    });
    const adapters = Object.keys(r);
    ok('elke adapter die stappen levert geeft een array terug, geen object',
      adapters.length > 0 && adapters.every(k => typeof r[k] === 'number'), JSON.stringify(r));
    ok('en OKX houdt ook de instap-fills over, niet alleen de afsluiters',
      r.okx === 2, JSON.stringify(r.okx));
    await ctx.close();
  }

  console.log('─── Wat de proxy terugmeldt ───');
  {
    /* Een lege lijst betekende twee dingen tegelijk: geen fills, of OKX weigerde de vraag.
       De Worker legt de reden onder _okxDebug — bewust daar en niet als `error`, want dat
       veld betekent op deze gedeelde Worker "request mislukt" en andere journals die hem
       gebruiken zouden daarop gaan gooien. */
    const { ctx, p } = await open();
    const r = await p.evaluate(async t0 => {
      CONNS.okx = { connected: true, apiKey: 'k', apiSecret: 's', passphrase: 'p' };
      const echt = window.fetch;
      const antwoord = (body) => { window.fetch = async () => ({ ok: true, status: 200, json: async () => body, text: async () => '' }); };
      const uit = {};

      antwoord({ fills: [], _okxDebug: { futures: 0, err_fut: 'OKX /api/v5/trade/fills-history: Invalid OK-ACCESS-KEY', swap: 0 } });
      T = [{ ...t0 }]; uit.sleutel = await backfillFills('okx');

      antwoord({ fills: [], _okxDebug: { futures: 0, swap: 0 } });   // niets mis, gewoon leeg
      T = [{ ...t0 }]; uit.echtLeeg = await backfillFills('okx');

      antwoord({ fills: [] });                                        // oudere Worker, geen debug
      T = [{ ...t0 }]; uit.oudeWorker = await backfillFills('okx');

      window.fetch = echt;
      return uit;
    }, TRADE);
    ok('een geweigerde sleutel komt er als fout uit, niet als "geen fills"',
      r.sleutel.reden === 'fout' && /Invalid OK-ACCESS-KEY/.test(r.sleutel.detail), JSON.stringify(r.sleutel).slice(0, 120));
    ok('en een echt leeg venster blijft gewoon "geen fills"',
      r.echtLeeg.reden === 'geen-fills', JSON.stringify(r.echtLeeg.reden));
    ok('een Worker die _okxDebug nog niet kent werkt onveranderd',
      r.oudeWorker.reden === 'geen-fills', JSON.stringify(r.oudeWorker.reden));
    await ctx.close();
  }

  ok('geen JS-errors totaal', errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));
  console.log(`\n=== Executie-stappen: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
