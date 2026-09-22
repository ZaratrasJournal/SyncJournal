// Hyperliquid: één positie-levensloop = één trade, met de fills als stappen (model B, 22-09-2026).
// Daarvóór maakte elke sluiting een eigen trade (FIFO tegen de oudste opens): drie TP's
// werden drie rijen, en de analytics telden sluitingen in plaats van beslissingen.
//
// Bron van waarheid: de snapshot uit Denny's wallet (tests/_fixtures/hyperliquid-snapshot.json,
// 81 fills, april-mei 2026). De verwachtingen worden in deze test onafhankelijk uit de fills
// berekend, zodat de adapter tegen iets anders dan zichzelf wordt gehouden.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const bij = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 1e-6 : tol);

const APP = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');
const FIX = path.resolve('tests/_fixtures/hyperliquid-snapshot.json');
const SNAP = (!process.env.SJ_GEEN_FIXTURES && fs.existsSync(FIX)) ? JSON.parse(fs.readFileSync(FIX, 'utf8')) : null;
let skipped = 0; const skip = n => { skipped++; console.log('  ⏭ ' + n + ' — fixture niet in deze kloon, overgeslagen'); };

const FILLS = SNAP ? (SNAP.fills || (SNAP.raw && SNAP.raw.fills) || []) : [];

// onafhankelijke groepering: sub-fills van één order samenvoegen, per coin de positie
// bijhouden (geseed uit de stand vóór de eerste order), vlak → levensloop klaar
function orders(fills) {
  const g = {};
  for (const f of fills) {
    const k = f.time + '|' + f.coin + '|' + f.dir;
    const o = g[k] || (g[k] = { time: +f.time, coin: f.coin, dir: f.dir, side: f.side, sz: 0, pxw: 0, fee: 0, pnl: 0, sp: null, tid: f.tid, subs: [] });
    o.sz += +f.sz; o.pxw += (+f.px) * (+f.sz); o.fee += +f.fee; o.pnl += +f.closedPnl; o.subs.push(f);
    const sp = +f.startPosition, opent = /Open|Buy/.test(f.dir);
    if (o.sp === null || (opent ? Math.abs(sp) < Math.abs(o.sp) : Math.abs(sp) > Math.abs(o.sp))) o.sp = sp;
  }
  return Object.values(g).map(o => ({ ...o, px: o.sz > 0 ? o.pxw / o.sz : 0 })).sort((a, b) => a.time - b.time);
}
function verwacht(fills) {
  const per = {}; const loops = [];
  for (const o of orders(fills)) {
    const buy = o.side === 'B';
    const st = per[o.coin] || (per[o.coin] = { pos: 0, orders: [] });
    if (!st.orders.length) { st.lone = Math.abs(o.sp) > 1e-9; st.pos = o.sp || 0; }   // liep al vóór het venster
    st.orders.push(o); st.pos += buy ? o.sz : -o.sz;
    if (Math.abs(st.pos) < 1e-9) {
      const closes = st.orders.filter(x => /Close/.test(x.dir)).length;
      const eersteClose = st.orders.findIndex(x => /Close/.test(x.dir));
      loops.push({ coin: o.coin, lone: st.lone, orders: st.orders, closes, eersteClose,
        fills: st.orders.flatMap(x => x.subs),
        net: st.orders.reduce((a, x) => a + x.pnl - x.fee, 0), first: st.orders[0], last: o });
      delete per[o.coin];
    }
  }
  return loops;
}
const LOOPS = verwacht(FILLS);
const naarFill = f => ({ coin: f.coin, dir: f.dir, side: f.side, startPosition: f.startPosition, px: f.px, sz: f.sz, fee: f.fee, closedPnl: f.closedPnl, ms: +f.time, tid: f.tid });

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
    await p.evaluate(() => { T = []; TRASH = []; });
    return { ctx, p };
  }
  const bouw = (p, fills, prefix) => p.evaluate(([fs, pf]) => ExchangeAPI.hyperliquid._reconstructTrades(fs, pf || 'hyperliquid').map(t => ({
    id: t.id, pair: t.pair, dir: t.direction, entry: +t.entry, exit: +t.exit, qty: +t.positionSizeAsset, pnl: +t.pnl, fees: +t.fees,
    open: +t.openTime, close: +t.closeTime, date: t.date, steps: (t.fills || []).length,
    closes: (t.fills || []).filter(x => x.kind === 'close').length, synthetic: (t.fills || []).some(x => x.synthetic), notes: t.notes || '' })), [fills, prefix]);

  if (!FILLS.length) skip('de echte wallet-snapshot (81 fills)');
  else {
    console.log(`─── De echte wallet: ${FILLS.length} fills, ${LOOPS.length} afgeronde levenslopen ───`);
    const { ctx, p } = await open();
    const t = await bouw(p, FILLS.map(naarFill));
    ok('één trade per afgeronde levensloop', t.length === LOOPS.length, `${t.length} vs ${LOOPS.length}`);
    ok('en dat zijn er minder dan er sluitingen zijn (de oude telling)',
      t.length < FILLS.filter(f => /Close/.test(f.dir)).length, `${t.length} vs ${FILLS.filter(f => /Close/.test(f.dir)).length} sluitingen`);
    const somT = t.reduce((a, x) => a + x.pnl, 0), somV = LOOPS.reduce((a, l) => a + l.net, 0);
    ok('Σ netto P&L = Σ closedPnl − Σ fees over diezelfde fills', bij(somT, somV, 0.01), `${somT.toFixed(4)} vs ${somV.toFixed(4)}`);
    ok('elke trade heeft stappen, waarvan minstens één afbouw', t.every(x => x.steps >= 2 && x.closes >= 1), JSON.stringify(t.filter(x => !(x.steps >= 2 && x.closes >= 1)).slice(0, 2)));
    ok('er zijn posities met meerdere afbouwstappen (dat is waar het om ging)', t.some(x => x.closes >= 2), JSON.stringify(t.map(x => x.closes)));
    ok('entry, exit en size zijn overal gevuld', t.every(x => x.entry > 0 && x.exit > 0 && x.qty > 0), JSON.stringify(t.filter(x => !(x.entry > 0 && x.exit > 0 && x.qty > 0)).slice(0, 2)));
    ok('sleutels zijn uniek', new Set(t.map(x => x.id)).size === t.length);
    const lone = t.filter(x => x.synthetic), loneV = LOOPS.filter(l => l.lone);
    ok('levenslopen die al liepen vóór het venster krijgen een afgeleide instap',
      lone.length === loneV.length, `${lone.length} vs ${loneV.length}`);
    ok('datum = moment van de eerste stap (je beslissing valt bij entry)',
      t.every(x => x.date === new Date(x.open).toISOString().slice(0, 10) || x.date === new Date(x.open).toLocaleDateString('sv-SE')), JSON.stringify(t[0]));
    // per levensloop: begin en eind kloppen met de onafhankelijke groepering
    const mis = LOOPS.filter(l => !t.some(x => x.open === +l.first.time && x.close === +l.last.time));
    ok('elke levensloop begint en eindigt op dezelfde fills als de onafhankelijke telling', mis.length === 0, JSON.stringify(mis.slice(0, 2).map(l => l.coin + ' ' + l.first.time)));

    // twee keer syncen: geen dubbelen, zelfde sleutels
    const dup = await p.evaluate(fills => {
      const n1 = importTjClosed(ExchangeAPI.hyperliquid._reconstructTrades(fills, 'hyperliquid')).length;
      const n2 = importTjClosed(ExchangeAPI.hyperliquid._reconstructTrades(fills, 'hyperliquid')).length;
      return { n1, n2, n: T.length, metStappen: T.filter(x => x.fills && x.fills.length).length };
    }, FILLS.map(naarFill));
    ok('een tweede sync voegt niets toe', dup.n1 === t.length && dup.n2 === 0 && dup.n === t.length, JSON.stringify(dup));
    ok('en de stappen komen mee in de journal', dup.metStappen === t.length, JSON.stringify(dup.metStappen));

    // CSV-pad: geen side en geen startPosition, alleen dir
    const csv = await bouw(p, FILLS.map(f => ({ ...naarFill(f), side: undefined, startPosition: undefined })), 'hyperliquid_csv');
    ok('zonder side/startPosition (CSV) komt dezelfde groepering eruit', csv.length === t.length && bij(csv.reduce((a, x) => a + x.pnl, 0), somT, 0.01), `${csv.length} vs ${t.length}`);
    await ctx.close();
  }

  console.log('─── Alleen de sluitingen in het venster (opens ervoor) ───');
  {
    const meer = LOOPS.find(l => l.closes >= 2 && !l.lone);
    if (!meer) skip('alleen de sluitingen in het venster (echte levensloop)');
    else {
      const { ctx, p } = await open();
      // het venster begint precies bij de eerste sluiting: alles ervoor is "buiten beeld"
      const inVenster = meer.orders.slice(meer.eersteClose).flatMap(x => x.subs).map(naarFill);
      const t = await bouw(p, inVenster);
      const voor = meer.orders.slice(0, meer.eersteClose);
      const entryEcht = voor.reduce((a, o) => a + o.px * o.sz, 0) / voor.reduce((a, o) => a + o.sz, 0);
      const netV = meer.orders.slice(meer.eersteClose).reduce((a, x) => a + x.pnl - x.fee, 0);
      ok('wordt één trade met een afgeleide instap', t.length === 1 && t[0].synthetic, JSON.stringify(t));
      ok('de afgeleide instap klopt met de echte gewogen instap van vóór het venster',
        t.length === 1 && bij(t[0].entry, entryEcht, Math.max(0.5, entryEcht * 1e-4)), `${t[0] && t[0].entry} vs ${entryEcht.toFixed(2)}`);
      ok('alle sluitingen zitten erin als afbouwstappen', t.length === 1 && t[0].closes === meer.closes, JSON.stringify(t[0] && t[0].closes));
      ok('en de netto P&L is die van de fills in het venster', t.length === 1 && bij(t[0].pnl, netV, 0.01), `${t[0] && t[0].pnl} vs ${netV.toFixed(4)}`);
      await ctx.close();
    }
  }

  console.log('─── Migratie v6: oude rijen gaan op in de levensloop ───');
  if (!LOOPS.some(l => l.closes >= 2 && !l.lone)) skip('migratie v6 op een echte levensloop'); else {
    const meer = LOOPS.find(l => l.closes >= 2 && !l.lone);
    const { ctx, p } = await open();
    const r = await p.evaluate(([fills, loop]) => {
      const closes = loop.orders.filter(o => /Close/.test(o.dir));
      // zo zagen de rijen eruit onder model A: één per sluiting
      T = closes.map((f, i) => ({ id: 100 + i, exchange: 'hyperliquid', srcId: 'hyperliquid_' + f.tid, status: 'closed', kind: 'live',
        pair: loop.coin + '/USDC', dir: /Long/.test(f.dir) ? 'long' : 'short', openTime: String(loop.orders[0].time), closeTime: String(f.time),
        date: '2026-04-01', time: '10:00', entry: 1, exit: +f.px, pnl: +f.closedPnl, notes: i === 0 ? 'oude notitie' : '', tags: i === 1 ? ['tp'] : [], tps: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] }));
      T.push({ id: 900, exchange: 'hyperliquid', srcId: 'hyperliquid_csv_abc', status: 'closed', kind: 'live', pair: 'ETH/USDC', dir: 'long', openTime: '1', closeTime: '2', date: '2026-01-01', time: '10:00', entry: 1, exit: 2, pnl: 1, tags: [], tps: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] });
      CONNS.hyperliquid = { connected: true, wallet: '0x1', lastSync: Date.now() };
      MIGRATIONS.find(m => m.v === 6).up();
      const naMig = { oud: T.filter(t => t._hlOud).length, csvOngemoeid: !T.find(t => t.id === 900)._hlOud, lastSync: CONNS.hyperliquid.lastSync };
      const nieuw = importTjClosed(ExchangeAPI.hyperliquid._reconstructTrades(fills, 'hyperliquid'));
      const n = ExchangeAPI.hyperliquid.afterImport(nieuw);
      const L = T.find(t => t.srcId && /^hyperliquid_\d/.test(t.srcId) && !t._hlOud);
      return { ...naMig, opgegaan: n, rest: T.filter(t => t._hlOud).length, totaal: T.length, notes: L && L.notes, tags: L && L.tags, stappen: L && (L.fills || []).length };
    }, [meer.fills.map(naarFill), meer]);
    ok('de oude sync-rijen zijn gemarkeerd, de CSV-rij niet', r.oud === meer.closes && r.csvOngemoeid, JSON.stringify(r));
    ok('de sync gaat terug tot vóór de oudste rij', r.lastSync <= meer.orders[0].time - 3600e3, new Date(r.lastSync).toLocaleString('nl-NL'));
    ok('na de sync zijn ze opgegaan in één levensloop', r.opgegaan === meer.closes && r.rest === 0 && r.totaal === 2, JSON.stringify(r));
    ok('met de notitie en tags van de oude rijen', r.notes === 'oude notitie' && Array.isArray(r.tags) && r.tags.includes('tp'), JSON.stringify({ notes: r.notes, tags: r.tags }));
    ok('en de stappen erbij', r.stappen >= 3, JSON.stringify(r.stappen));
    await ctx.close();
  }

  console.log('─── Rekenkern: de exchange levert de P&L per stap ───');
  {
    const { ctx, p } = await open();
    const r = await p.evaluate(() => {
      const f = fillTimeline([{ ts: 1, side: 'buy', qty: 2, price: 100 }, { ts: 2, side: 'sell', qty: 2, price: 110, pnlExch: 19.5 }], { mult: 1 });
      const g = fillTimeline([{ ts: 1, side: 'buy', qty: 2, price: 100 }, { ts: 2, side: 'sell', qty: 2, price: 110 }], { mult: 1 });
      return { exch: f[1].pnl, calc: f[1].pnlCalc, zonder: g[1].pnl };
    });
    ok('pnlExch is leidend, de eigen berekening blijft ernaast', r.exch === 19.5 && r.calc === 20, JSON.stringify(r));
    ok('zonder pnlExch blijft het de eigen berekening', r.zonder === 20, JSON.stringify(r.zonder));
    await ctx.close();
  }

  ok('geen JS-errors totaal', errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));
  console.log(`\n=== Hyperliquid-levensloop: ${pass}/${pass + fail}${skipped ? ' · ' + skipped + ' delen overgeslagen (fixtures niet in deze kloon)' : ''} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
