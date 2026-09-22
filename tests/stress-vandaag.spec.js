// Aanvallende ronde op alles wat op 22-09-2026 is gebouwd: het levensloop-model, de
// afrondingsmarge in de rekenkern, de migratieketen v2→v7, de sortering en het slot op
// gesyncte trades. Niet "werkt het", maar "waar breekt het".
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const bij = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 1e-9 : tol);
const APP = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');

(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext(); const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
  p.on('dialog', d => d.accept());
  await p.route('**/*', r => /^https?:/.test(r.request().url()) ? r.abort() : r.continue());
  await p.addInitScript(() => localStorage.setItem('sj_welcomed', 'true'));
  await p.goto(APP, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1300);

  console.log('─── De rekenkern onder lastige getallen ───');
  const kern = await p.evaluate(() => {
    const tl = (steps, o) => fillTimeline(steps, o || { mult: 1 });
    const S = (ts, side, qty, price, extra) => ({ ts, side, qty, price, fee: 0, ...extra });
    const uit = {};
    // drie instappen die niet netjes optellen, daarna in één keer dicht
    uit.driedelig = tl([S(1, 'buy', 0.1, 100), S(2, 'buy', 0.2, 101), S(3, 'sell', 0.30000000000000004, 110)]).map(x => x.kind).join();
    // heel kleine posities (satoshi-schaal)
    uit.klein = tl([S(1, 'buy', 1e-8, 100), S(2, 'sell', 1e-8, 110)]).map(x => x.kind).join();
    // heel grote posities
    uit.groot = tl([S(1, 'buy', 1e7, 100), S(2, 'sell', 1e7, 101)]).map(x => x.kind).join();
    // twintig kleine afbouwstappen die samen exact de positie zijn
    const veel = [S(0, 'buy', 1, 100)];
    for (let i = 1; i <= 20; i++) veel.push(S(i, 'sell', 0.05, 100 + i));
    const v = tl(veel);
    uit.veel = { kinds: [...new Set(v.map(x => x.kind))].join(), eind: v[v.length - 1].posAfter };
    // een echte omkering blijft een omkering
    uit.omkeer = tl([S(1, 'buy', 1, 100), S(2, 'sell', 3, 110)]).map(x => x.kind).join();
    // net-iets-te-veel afgebouwd: dat hoort nog steeds een omkering te zijn
    uit.ietsTeveel = tl([S(1, 'buy', 1, 100), S(2, 'sell', 1.5, 110)]).map(x => x.kind).join();
    // de marge mag een echte restpositie niet wegpoetsen
    uit.restje = tl([S(1, 'buy', 1, 100), S(2, 'sell', 0.999, 110)]).map(x => x.posAfter);
    return uit;
  });
  ok('drie instappen met afrondingsresten sluiten netjes af', kern.driedelig === 'open,add,close', kern.driedelig);
  ok('een positie van 0,00000001 werkt', kern.klein === 'open,close', kern.klein);
  ok('een positie van 10 miljoen ook', kern.groot === 'open,close', kern.groot);
  ok('twintig afbouwstappen eindigen exact vlak', kern.veel.kinds === 'open,close' && kern.veel.eind === 0, JSON.stringify(kern.veel));
  ok('een echte omkering blijft een omkering', kern.omkeer === 'open,flip', kern.omkeer);
  ok('anderhalf keer afbouwen ook', kern.ietsTeveel === 'open,flip', kern.ietsTeveel);
  ok('maar een restpositie van 0,001 blijft staan', bij(kern.restje[1], 0.001, 1e-12), JSON.stringify(kern.restje));

  console.log('─── De migratieketen in één keer, van schema 1 ───');
  const mig = await p.evaluate(async () => {
    const basis = { status: 'closed', kind: 'live', pair: 'BTC/USDC', dir: 'long', date: '2026-04-01', time: '10:00',
      entry: 80000.123456789, exit: 80500.987654321, stop: 0, pnl: 1, r: 0, size: '100', tags: [], tps: [{ price: 80500.55555, pct: 100, r: '', hit: true, ts: 0 }],
      layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] };
    const d = { app: 'SyncJournal', schemaVersion: 1, trades: [
      // OKX: oude sleutel mét tijd (v3) én zonder (v5), twee tussenstanden van één positie
      { ...basis, id: 1, exchange: 'okx', srcId: 'okx_555_1777000000000', openTime: '1776900000000', closeTime: '1777000000000', pnl: 3, notes: 'eerste' },
      { ...basis, id: 2, exchange: 'okx', srcId: 'okx_555_1777100000000', openTime: '1776900000000', closeTime: '1777100000000', pnl: 5 },
      // Blofin: twee tussenstanden van één levensloop + een eerdere levensloop
      { ...basis, id: 3, exchange: 'blofin', srcId: 'blofin_800_1777000000000', openTime: '1776900000000', closeTime: '1777000000000', pnl: 2, tags: ['tp1'] },
      { ...basis, id: 4, exchange: 'blofin', srcId: 'blofin_800_1777100000000', openTime: '1776900000000', closeTime: '1777100000000', pnl: 4 },
      { ...basis, id: 5, exchange: 'blofin', srcId: 'blofin_800_1770000000000', openTime: '1769900000000', closeTime: '1770000000000', pnl: -1 },
      // Hyperliquid: rij per sluiting
      { ...basis, id: 6, exchange: 'hyperliquid', srcId: 'hyperliquid_9001', openTime: '1776900000000', closeTime: '1777000000000', pnl: 7 },
      // en wat er niet aangeraakt mag worden
      { ...basis, id: 7, exchange: 'blofin', srcId: 'blofin_csv_abc', openTime: '1776900000000', closeTime: '1777000000000', pnl: 8 },
      { ...basis, id: 8, exchange: 'manual', srcId: '', openTime: '1776900000000', closeTime: '1777000000000', pnl: 9, notes: 'van mij' },
    ], trash: [{ ...basis, id: 9, exchange: 'okx', srcId: 'okx_555', openTime: '1776900000000', deletedAt: 1 }],
      conns: { okx: { connected: true, apiKey: 'k', lastSync: 9e12 }, blofin: { connected: true, apiKey: 'k', lastSync: 9e12 }, hyperliquid: { connected: true, wallet: '0x1', lastSync: 9e12 } } };
    await applyBackup(d); await new Promise(r => setTimeout(r, 1800));
    return { schema: DB.load('schema', 0), n: T.length, ids: T.map(t => t.srcId),
      okx: T.filter(t => /^okx_/.test(t.srcId || '')).map(t => ({ id: t.srcId, pnl: +t.pnl, notes: t.notes })),
      blofin: T.filter(t => /^blofin_\d/.test(t.srcId || '')).map(t => ({ id: t.srcId, pnl: +t.pnl, tags: t.tags })),
      hlOud: T.filter(t => t._hlOud).length,
      prul: TRASH.map(t => t.srcId),
      entry: T[0] && T[0].entry, tpPrijs: T[0] && (T[0].tps[0] || {}).price,
      datum: T.filter(t => +t.openTime).every(t => t.date === ts2date(+t.openTime)),
      onaangeroerd: T.filter(t => /csv|^$/.test(t.srcId || '')).map(t => ({ id: t.srcId, pnl: +t.pnl })),
      last: { okx: CONNS.okx.lastSync, blofin: CONNS.blofin.lastSync, hl: CONNS.hyperliquid.lastSync } };
  });
  ok('het schema staat op de huidige versie', mig.schema === await p.evaluate(() => SCHEMA_VERSION), JSON.stringify(mig.schema));
  ok('OKX: twee tussenstanden worden één positie, met de notitie erbij',
    mig.okx.length === 1 && mig.okx[0].pnl === 5 && mig.okx[0].notes === 'eerste' && /^okx_555_1776900000000$/.test(mig.okx[0].id), JSON.stringify(mig.okx));
  ok('Blofin: twee tussenstanden samengevoegd, de eerdere levensloop blijft apart',
    mig.blofin.length === 2 && mig.blofin.some(x => x.pnl === 4 && (x.tags || []).includes('tp1')) && mig.blofin.some(x => x.pnl === -1), JSON.stringify(mig.blofin));
  ok('Hyperliquid is gemarkeerd voor de volgende sync', mig.hlOud === 1, JSON.stringify(mig.hlOud));
  ok('CSV- en handmatige trades zijn niet aangeraakt', mig.onaangeroerd.length === 2 && mig.onaangeroerd.every(x => x.pnl === 8 || x.pnl === 9), JSON.stringify(mig.onaangeroerd));
  ok('de prullenbak is mee hernoemd', mig.prul[0] === 'okx_555_1776900000000', JSON.stringify(mig.prul));
  ok('prijzen zijn afgerond (v4), ook in de TP-niveaus', bij(mig.entry, 80000.12, 0.001) && bij(mig.tpPrijs, 80500.56, 0.001), JSON.stringify({ e: mig.entry, tp: mig.tpPrijs }));
  ok('de datum komt van het open-moment (v2)', mig.datum === true);
  ok('alle drie de syncs kijken terug', Object.values(mig.last).every(v => v < 1776900000000), JSON.stringify(mig.last));

  console.log('─── Hetzelfde nog eens: migraties mogen niet dubbel werken ───');
  const nogmaals = await p.evaluate(async () => {
    const voor = { n: T.length, som: T.reduce((s, t) => s + (+t.pnl || 0), 0), ids: T.map(t => t.srcId).join('|') };
    DB.save('schema', 1); await runMigrations();
    return { voor, na: { n: T.length, som: T.reduce((s, t) => s + (+t.pnl || 0), 0), ids: T.map(t => t.srcId).join('|') } };
  });
  ok('de opruimstappen nog eens draaien verandert niets', JSON.stringify(nogmaals.voor) === JSON.stringify(nogmaals.na), JSON.stringify(nogmaals));

  console.log('─── Het slot op gesyncte trades, van alle kanten ───');
  const slot = await p.evaluate(() => {
    const gevallen = { gesynct: 'okx_1_2', hlGesynct: 'hyperliquid_9', csv: 'blofin_csv_x', leeg: '' };
    const uit = {};
    Object.entries(gevallen).forEach(([naam, srcId]) => {
      T = [{ id: 1, exchange: 'okx', srcId, pair: 'BTC/USDC', dir: 'long', status: 'closed', kind: 'live', date: '2026-04-01', time: '10:00',
        openTime: '1776900000000', closeTime: '1777000000000', entry: 100, exit: 110, stop: 0, pnl: 10, r: 0, size: '100', fees: 1,
        tps: [{ price: 105, pct: 100, r: '', hit: true, ts: 0 }], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] }];
      openForm(1);
      const ro = document.getElementById('f_entry').hasAttribute('readonly');
      // proberen te knoeien: waardes overschrijven en opslaan
      document.getElementById('f_entry').value = '1'; document.getElementById('f_pnl').value = '999';
      document.getElementById('f_notes').value = 'notitie ' + naam;
      submitForm(1);
      uit[naam] = { ro, entry: T[0].entry, pnl: T[0].pnl, tps: T[0].tps.length, notes: T[0].notes };
    });
    return uit;
  });
  ok('gesynct: op slot, en knoeien via de console heeft geen effect',
    slot.gesynct.ro && slot.gesynct.entry === 100 && slot.gesynct.pnl === 10, JSON.stringify(slot.gesynct));
  ok('maar de notitie komt er wel door', slot.gesynct.notes === 'notitie gesynct', JSON.stringify(slot.gesynct.notes));
  ok('een Hyperliquid-trade met bron-id zit óók op slot',
    slot.hlGesynct.ro && slot.hlGesynct.entry === 100 && slot.hlGesynct.pnl === 10, JSON.stringify(slot.hlGesynct));
  ok('alleen CSV-imports en handmatige trades blijven bewerkbaar',
    [slot.csv, slot.leeg].every(x => !x.ro && x.entry === 1 && x.pnl === 999), JSON.stringify({ csv: slot.csv, leeg: slot.leeg }));

  console.log('─── Sortering onder rare data ───');
  const sort = await p.evaluate(() => {
    const mk = (id, o) => ({ id, exchange: 'okx', srcId: 'okx_' + id, pair: 'BTC/USDC', dir: 'long', status: 'closed', kind: 'live',
      date: '2026-04-01', time: '10:00', openTime: '', closeTime: '', entry: 1, exit: 2, pnl: 1, r: 0, size: '1',
      tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [], ...o });
    const op = (d, t) => String(+new Date(d + 'T' + t));
    T = [mk(1, { date: '2026-04-01', time: '23:59', openTime: op('2026-04-01', '23:59:10') }),
      mk(2, { date: '2026-04-02', time: '00:01', openTime: op('2026-04-02', '00:01:00') }),
      mk(3, { date: '2026-04-01', time: '' }), mk(4, { date: '', time: '' }),
      mk(5, { date: '2026-04-01', time: '10:00', openTime: 'kapot' }),
      // zelfde minuut als 1, maar een paar seconden eerder — daar is openTime voor
      mk(6, { date: '2026-04-01', time: '23:59', openTime: op('2026-04-01', '23:59:02') })];
    persist(); STATE.page = 'trades'; STATE.tradeTab = 'all'; STATE.sortCol = 'date'; STATE.sortDir = -1; render();
    const rijen = FT.slice().sort((a, b) => (tradeMoment(b) - tradeMoment(a)) || (b.id - a.id)).map(t => t.id);
    return { rijen, cellen: [...document.querySelectorAll('td[data-l="Datum"]')].length };
  });
  ok('middernacht-grens: 02-04 00:01 staat boven 01-04 23:59', sort.rijen[0] === 2, JSON.stringify(sort.rijen));
  ok('en binnen dezelfde minuut beslissen de seconden: 23:59:10 vóór 23:59:02',
    sort.rijen[1] === 1 && sort.rijen[2] === 6, JSON.stringify(sort.rijen));
  ok('een kapotte openTime valt terug op datum + tijd, en breekt niets', sort.cellen === 6, JSON.stringify(sort));

  console.log('─── Stappen renderen onder rare waarden ───');
  const render = await p.evaluate(() => {
    const mk = (fills) => ({ id: 1, exchange: 'okx', srcId: 'okx_x', pair: 'BTC/USDC', dir: 'short', status: 'closed', kind: 'live',
      date: '2026-04-01', time: '10:00', openTime: '1776900000000', closeTime: '1777000000000', entry: 100, exit: 110, pnl: 1, r: 0,
      size: '1', fees: 0.1, fills, tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] });
    const basis = [{ ts: 1, side: 'sell', kind: 'open', qty: 1, qtyAsset: 1, price: 100, fee: 0.05, posAfter: 1, posAfterAsset: 1, dirAfter: 'short', avgEntry: 100, pnl: null }];
    const gevallen = {
      alleenOpen: [...basis],
      metLiq: [...basis, { ts: 2, side: 'buy', kind: 'liq', qty: 1, qtyAsset: 1, price: 90, fee: 0.05, posAfter: 0, posAfterAsset: 0, dirAfter: '', avgEntry: 100, pnl: 10 }],
      nulPrijs: [...basis, { ts: 2, side: 'buy', kind: 'close', qty: 1, qtyAsset: 1, price: 0, fee: 0, posAfter: 0, posAfterAsset: 0, dirAfter: '', avgEntry: 100, pnl: 0 }],
      reusachtig: [...basis, { ts: 2, side: 'buy', kind: 'close', qty: 1e9, qtyAsset: 1e9, price: 1e9, fee: 1e6, posAfter: 0, posAfterAsset: 0, dirAfter: '', avgEntry: 100, pnl: 1e9 }],
    };
    const uit = {};
    Object.entries(gevallen).forEach(([naam, f]) => {
      try { T = [mk(f)]; openForm(1); const el = document.querySelector('.exwrap table');
        uit[naam] = { tabel: !!el, rijen: el ? el.querySelectorAll('tbody tr:not(.exday):not(.exnew)').length : 0 }; closeForm(); }
      catch (e) { uit[naam] = { fout: e.message }; }
    });
    return uit;
  });
  ok('één losse instap geeft geen tabel (er valt niets te tonen)', render.alleenOpen.tabel === false, JSON.stringify(render.alleenOpen));
  ok('een liquidatie telt als afbouw en krijgt wél een tabel', render.metLiq.tabel && render.metLiq.rijen === 2, JSON.stringify(render.metLiq));
  ok('prijs nul en reuzengetallen breken de tabel niet', render.nulPrijs.tabel && render.reusachtig.tabel, JSON.stringify(render));

  ok('geen JS-errors in de hele ronde', errs.length === 0, [...new Set(errs)].slice(0, 4).join(' | '));
  console.log(`\n=== Stress 22-09: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
