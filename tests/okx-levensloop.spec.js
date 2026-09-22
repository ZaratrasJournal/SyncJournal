// OKX: één positie-levensloop = één trade (Denny 22-09-2026, docs/okx-herstelplan.md stap 1).
// OKX hergebruikt een posId tot 30 dagen na een volledige sluiting. Met posId alleen als
// sleutel overschreef elke heropening de vorige trade. De sleutel is nu posId + cTime.
//
// Drie bronnen van echte data: Denny's back-ups van 21-09 en 22-09, en de snapshot van
// 29-06 met zes levenslopen onder één posId.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const bij = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 1e-6 : tol);

const APP = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');
const lees = f => (!process.env.SJ_GEEN_FIXTURES && fs.existsSync(f)) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
let skipped = 0; const skip = n => { skipped++; console.log('  ⏭ ' + n + ' — fixture niet in deze kloon, overgeslagen'); };

const BK21 = lees('syncjournal-backup-2026-09-21.json');
const BK22 = lees('syncjournal-backup-2026-09-22.json');
const SNAP = lees('okx-snapshot-2026-06-29-15-17.json');

const POS = '3809943469299781632', INST = 'BTC-USD_UM_XPERP-04APR31';
// de twee levenslopen uit Denny's journal, zoals positions-history ze aanlevert
const LOOP1 = { cTime: 1789869078888, uTime: 1790012341907, openAvgPx: 81029.3244, closeAvgPx: 82039.3078, closeTotalPos: 90, openMaxPos: 52, realizedPnl: -9.7626, fee: -0.7279 };
const LOOP1_TUSSEN = { ...LOOP1, uTime: 1789953772401, closeAvgPx: 81389.4273, closeTotalPos: 77, realizedPnl: -3.4449, fee: -0.7026 };
const LOOP2 = { cTime: 1790046180000, uTime: 1790070780000, openAvgPx: 85551.6, closeAvgPx: 86290.1, closeTotalPos: 19, openMaxPos: 19, realizedPnl: -1.5627, fee: -0.1633 };

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
    await p.evaluate(() => {
      ExchangeAPI.okx._ctvCache = { 'BTC-USD_UM_XPERP-04APR31': 0.0001, 'BTC-USD_UM_XPERP-310404': 0.0001 };
      ExchangeAPI.okx._ctvCacheTs = Date.now();
      T = []; TRASH = [];
    });
    return { ctx, p };
  }
  // positions-history-records door de adapter en de import halen, zoals een sync doet
  const sync = (p, loops) => p.evaluate(([ls, pos, inst]) => {
    const rec = l => ({ instId: inst, posId: pos, posSide: 'short', direction: 'short', settleCcy: 'USDC', type: '2',
      cTime: String(l.cTime), uTime: String(l.uTime), openAvgPx: String(l.openAvgPx), closeAvgPx: String(l.closeAvgPx),
      closeTotalPos: String(l.closeTotalPos), openMaxPos: String(l.openMaxPos), realizedPnl: String(l.realizedPnl), fee: String(l.fee), fundingFee: '0' });
    return importTjClosed(ls.map(l => ExchangeAPI.okx._normalise(rec(l)))).length;
  }, [loops, POS, INST]);
  const okx = p => p.evaluate(() => T.filter(t => t.exchange === 'okx' && t.srcId).map(t => ({ srcId: t.srcId, open: +t.openTime, close: +t.closeTime, pnl: +t.pnl, entry: +t.entry, exit: +t.exit, qty: +t.qtyAsset, fills: (t.fills || []).length, notes: t.notes || '' })));

  console.log('─── De sleutel ───');
  {
    const { ctx, p } = await open();
    const r = await p.evaluate(([l1, l2, pos, inst]) => {
      const n = l => ExchangeAPI.okx._normalise({ instId: inst, posId: pos, posSide: 'short', cTime: String(l.cTime), uTime: String(l.uTime), openAvgPx: '1', closeAvgPx: '1', closeTotalPos: '1', openMaxPos: '1', realizedPnl: '0', fee: '0' });
      const zonder = ExchangeAPI.okx._normalise({ instId: inst, posSide: 'short', cTime: '5', uTime: '9', openAvgPx: '1', closeAvgPx: '1', closeTotalPos: '1', openMaxPos: '1', realizedPnl: '0', fee: '0' });
      const o = ExchangeAPI.okx._normaliseOpen({ instId: inst, posId: pos, posSide: 'short', cTime: String(l1.cTime), avgPx: '1', pos: '1', lever: '10' });
      return { a: n(l1).id, b: n(l2).id, tussen: n({ ...l1, uTime: l1.uTime - 1000 }).id, zonder: zonder.id, open: o.id };
    }, [LOOP1, LOOP2, POS, INST]);
    ok('sleutel is posId + cTime', r.a === 'okx_' + POS + '_' + LOOP1.cTime, r.a);
    ok('een tussenstand van dezelfde levensloop heeft dezelfde sleutel', r.tussen === r.a, r.tussen);
    ok('een heropening met hetzelfde posId krijgt een andere sleutel', r.b !== r.a && r.b.endsWith('_' + LOOP2.cTime), r.b);
    ok('zonder posId valt hij terug op de sluittijd', r.zonder === 'okx_t9', r.zonder);
    ok('de open-placeholder draagt de cTime ook', /_1789869078888$/.test(r.open), r.open);
    await ctx.close();
  }

  console.log('─── Sync: tussenstand, eindstand, heropening ───');
  {
    const { ctx, p } = await open();
    const n1 = await sync(p, [LOOP1_TUSSEN]);
    const n2 = await sync(p, [LOOP1]);
    let t = await okx(p);
    ok('tussenstand en eindstand blijven één trade', n1 === 1 && n2 === 0 && t.length === 1, JSON.stringify({ n1, n2, n: t.length }));
    ok('met de eindstand als inhoud', t.length === 1 && bij(t[0].pnl, -9.7626, 1e-4) && bij(t[0].exit, 82039.31, 0.01), JSON.stringify(t[0]));
    await p.evaluate(() => { T[0].notes = 'mijn notitie'; });
    const n3 = await sync(p, [LOOP1, LOOP2]);
    t = await okx(p);
    ok('de heropening wordt een tweede trade, de eerste blijft staan', n3 === 1 && t.length === 2, JSON.stringify(t.map(x => x.srcId)));
    const eerste = t.find(x => x.open === LOOP1.cTime), tweede = t.find(x => x.open === LOOP2.cTime);
    ok('eerste positie: P&L −9,76 en 0,009 BTC', eerste && bij(eerste.pnl, -9.7626, 1e-4) && bij(eerste.qty, 0.009, 1e-9), JSON.stringify(eerste));
    ok('tweede positie: P&L −1,56 en 0,0019 BTC', tweede && bij(tweede.pnl, -1.5627, 1e-4) && bij(tweede.qty, 0.0019, 1e-9), JSON.stringify(tweede));
    ok('en de notitie op de eerste is niet aangeraakt', eerste && eerste.notes === 'mijn notitie', JSON.stringify(eerste && eerste.notes));
    await ctx.close();
  }

  console.log('─── Prullenbak-guard onder de nieuwe sleutel ───');
  {
    const { ctx, p } = await open();
    await sync(p, [LOOP1, LOOP2]);
    await p.evaluate(() => { const t = T.find(x => +x.openTime === 1789869078888); TRASH = [{ ...t, deletedAt: Date.now() }]; T = T.filter(x => x !== t); });
    const n = await sync(p, [LOOP1, LOOP2]);
    const t = await okx(p);
    ok('een verwijderde levensloop komt niet terug bij een hersync', n === 0 && t.length === 1 && t[0].open === LOOP2.cTime, JSON.stringify({ n, t: t.map(x => x.srcId) }));
    await ctx.close();
  }

  console.log('─── Snapshot 29-06: zes levenslopen, één posId ───');
  if (SNAP && Array.isArray(SNAP.positionsHistory)) {
    const { ctx, p } = await open();
    const r = await p.evaluate(rows => {
      const n = importTjClosed(rows.map(r => ExchangeAPI.okx._normalise(r))).length;
      const n2 = importTjClosed(rows.map(r => ExchangeAPI.okx._normalise(r))).length;
      return { n, n2, keys: T.map(t => t.srcId), pnls: T.map(t => +t.pnl) };
    }, SNAP.positionsHistory);
    ok('zes records met één posId worden zes trades', r.n === 6 && new Set(r.keys).size === 6, JSON.stringify(r.keys));
    ok('en een tweede sync voegt niets toe', r.n2 === 0, JSON.stringify(r.n2));
    ok('elke trade houdt zijn eigen P&L', r.pnls.length === 6 && new Set(r.pnls.map(x => x.toFixed(4))).size === 6, JSON.stringify(r.pnls));
    await ctx.close();
  } else skip('snapshot 29-06: zes levenslopen onder één posId');

  console.log('─── Migratie v5 op Denny’s back-up van 21-09 (schema 4) ───');
  if (BK21) {
    const { ctx, p } = await open();
    const r = await p.evaluate(async d => {
      applyBackup(d); await new Promise(x => setTimeout(x, 1800));
      return { schema: DB.load('schema', 0), t: T.filter(x => x.exchange === 'okx').map(x => ({ srcId: x.srcId, pnl: +x.pnl, fills: (x.fills || []).length })) };
    }, BK21);
    ok('schema staat op de huidige versie', r.schema === await p.evaluate(() => SCHEMA_VERSION), JSON.stringify(r.schema));
    ok('de ene positie blijft één trade, nu met cTime in de sleutel', r.t.length === 1 && r.t[0].srcId === 'okx_' + POS + '_' + LOOP1.cTime, JSON.stringify(r.t));
    await ctx.close();
  } else skip('migratie v5 op de back-up van 21-09');

  console.log('─── Migratie v5 + hersync op Denny’s back-up van 22-09 (de gelijmde rij) ───');
  if (BK22) {
    const { ctx, p } = await open();
    const voor = await p.evaluate(async d => {
      applyBackup(d); await new Promise(x => setTimeout(x, 2500));
      const c = CONNS.okx || {};
      return { schema: DB.load('schema', 0), conn: !!c.connected, lastSync: +c.lastSync || 0,
        t: T.filter(x => x.exchange === 'okx' && x.srcId).map(x => ({ srcId: x.srcId, open: +x.openTime, pnl: +x.pnl, fills: (x.fills || []).length })),
        prul: TRASH.filter(x => x.exchange === 'okx' && x.srcId).map(x => x.srcId) };
    }, BK22);
    ok('de gelijmde rij is hernoemd naar posId + cTime van de eerste positie',
      voor.t.length === 1 && voor.t[0].srcId === 'okx_' + POS + '_' + LOOP1.cTime, JSON.stringify(voor.t));
    ok('haar negen stappen zijn gewist (ze kwamen van twee posities)', voor.t.length === 1 && voor.t[0].fills === 0, JSON.stringify(voor.t[0] && voor.t[0].fills));
    ok('de prullenbak bevat geen oude OKX-sleutels meer', voor.prul.every(k => /^okx_\d+_\d+$/.test(k)), JSON.stringify(voor.prul));
    if (voor.conn) ok('de sync gaat terug tot vóór de eerste positie', voor.lastSync > 0 && voor.lastSync <= LOOP1.cTime - 3600e3, new Date(voor.lastSync).toLocaleString('nl-NL'));
    else console.log('  · back-up bevat geen actieve OKX-koppeling; lastSync-reset niet te toetsen');

    // de sync die daarna komt: positions-history levert beide levenslopen
    await p.evaluate(() => { ExchangeAPI.okx._ctvCache = { 'BTC-USD_UM_XPERP-04APR31': 0.0001 }; ExchangeAPI.okx._ctvCacheTs = Date.now(); });
    const n = await sync(p, [LOOP1, LOOP2]);
    const na = await okx(p);
    const e = na.find(x => x.open === LOOP1.cTime), z = na.find(x => x.open === LOOP2.cTime);
    ok('na de hersync staan beide posities er', n === 1 && na.length === 2, JSON.stringify(na.map(x => x.srcId)));
    ok('de overschreven positie is hersteld: P&L −9,76, exit 82.039', e && bij(e.pnl, -9.7626, 1e-4) && bij(e.exit, 82039.31, 0.01) && bij(e.qty, 0.009, 1e-9), JSON.stringify(e));
    ok('en die van 22-09 is een eigen trade: P&L −1,56', z && bij(z.pnl, -1.5627, 1e-4), JSON.stringify(z));
    await ctx.close();
  } else skip('migratie v5 + hersync op de back-up van 22-09');

  ok('geen JS-errors totaal', errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));
  console.log(`\n=== OKX-levensloop: ${pass}/${pass + fail}${skipped ? ' · ' + skipped + ' delen overgeslagen (fixtures niet in deze kloon)' : ''} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
