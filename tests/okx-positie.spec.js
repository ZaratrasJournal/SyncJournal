// OKX: één positie = één trade (melding Denny 21-09-2026).
// OKX levert een lopende positie bij elke sync opnieuw aan met een verdere stand:
// meer gesloten contracten, hogere cumulatieve P&L. Het bron-kenmerk bevatte de
// sluittijd, dus elke tussenstand werd een NIEUWE trade en telde de P&L dubbel.
// De cijfers hieronder komen uit zijn echte positie 3809943469299781632.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const APP = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
// stand na 3 afbouwstappen, en de eindstand na de vierde
const STAND1 = { uTime: 1789953772401, cont: 77, pnl: -3.4449, fee: -0.7026, exit: 81389.4273 };
const STAND2 = { uTime: 1790012341907, cont: 90, pnl: -9.7626, fee: -0.7279, exit: 82039.3078 };

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
      ExchangeAPI.okx._ctvCache = { 'BTC-USD_UM_XPERP-04APR31': 0.0001 };
      ExchangeAPI.okx._ctvCacheTs = Date.now();
      T = []; TRASH = [];
    });
    return { ctx, p };
  }
  const sync = (p, standen) => p.evaluate(stds => {
    const rec = s => ({
      instId: 'BTC-USD_UM_XPERP-04APR31', posId: '3809943469299781632', posSide: 'short',
      cTime: '1789869078888', uTime: String(s.uTime), openAvgPx: '81026.8926', closeAvgPx: String(s.exit),
      closeTotalPos: String(s.cont), openMaxPos: '90', realizedPnl: String(s.pnl),
      fee: String(s.fee), fundingFee: '0', settleCcy: 'USDC', type: '1',
    });
    return importTjClosed(stds.map(s => ExchangeAPI.okx._normalise(rec(s)))).length;
  }, standen);
  const trades = p => p.evaluate(() => T.filter(t => t.exchange === 'okx').map(t => ({ srcId: t.srcId, status: t.status, realized: t.realizedPnl, pnl: t.pnl, size: t.size, qty: t.qtyAsset, closeTime: t.closeTime, notes: t.notes, setup: t.setup, tags: t.tags })));

  console.log('─── Twee standen in één antwoord ───');
  {
    const { ctx, p } = await open();
    await sync(p, [STAND1, STAND2]);
    const r = await trades(p);
    ok('levert één trade op, niet twee', r.length === 1, JSON.stringify(r.length));
    ok('met de eindstand, niet de tussenstand', r[0] && r[0].pnl === STAND2.pnl && String(r[0].closeTime) === String(STAND2.uTime), JSON.stringify(r[0]));
    ok('de som telt niet dubbel', r.reduce((s, t) => s + t.pnl, 0) === STAND2.pnl, JSON.stringify(r.reduce((s, t) => s + t.pnl, 0)));
    await ctx.close();
  }

  console.log('─── Twee syncs na elkaar, positie groeit ───');
  {
    const { ctx, p } = await open();
    await sync(p, [STAND1]);
    const na1 = await trades(p);
    // sinds 24-09-2026: een positie die nog niet vlak staat is één rij met status partial;
    // het geboekte deel staat in realizedPnl, de P&L blijft 0 tot de positie dicht is
    ok('eerste sync: één lopende positie met het geboekte deel apart',
      na1.length === 1 && na1[0].status === 'partial' && na1[0].pnl === 0 && Math.abs((na1[0].realized || 0) - STAND1.pnl) < 1e-6, JSON.stringify(na1));

    // de gebruiker vult ondertussen zijn eigen dingen in
    await p.evaluate(() => { const t = T.find(x => x.exchange === 'okx'); t.notes = 'te vroeg ingestapt'; t.setup = 'SFP'; t.tags = ['revenge']; persist(); });
    await sync(p, [STAND2]);
    const na2 = await trades(p);
    ok('tweede sync maakt geen tweede trade aan', na2.length === 1, JSON.stringify(na2.length));
    ok('maar werkt de bestaande bij naar de eindstand', na2[0].pnl === STAND2.pnl && String(na2[0].closeTime) === String(STAND2.uTime), JSON.stringify(na2[0]));
    ok('jouw eigen notitie, setup en tags blijven staan', na2[0].notes === 'te vroeg ingestapt' && na2[0].setup === 'SFP' && (na2[0].tags || []).join() === 'revenge', JSON.stringify(na2[0]));
    await ctx.close();
  }

  console.log('─── Een weggegooide trade komt niet terug ───');
  {
    const { ctx, p } = await open();
    await sync(p, [STAND1]);
    await p.evaluate(() => { trashDelete(T.filter(t => t.exchange === 'okx').map(t => t.id)); });
    await sync(p, [STAND2]);
    ok('prullenbak wint van de sync', (await trades(p)).length === 0);
    await ctx.close();
  }

  console.log('─── Prijzen met nepnauwkeurigheid ───');
  {
    const { ctx, p } = await open();
    const r = await p.evaluate(() => {
      const rec = { instId: 'BTC-USD_UM_XPERP-04APR31', posId: '1', posSide: 'short', cTime: '1789869078888', uTime: '1790012341907',
        openAvgPx: '81029.32444444444', closeAvgPx: '82039.30777777778', closeTotalPos: '90', openMaxPos: '90',
        realizedPnl: '-9.7626', fee: '-0.7279', fundingFee: '0', settleCcy: 'USDC', type: '1' };
      const t = ExchangeAPI.okx._normalise(rec);
      return { entry: t.entry, exit: t.exit, klein: pxRound('0.000012345678'), midden: pxRound('2.33456789') };
    });
    ok('een afgeleide instapprijs wordt afgerond op centen', r.entry === '81029.32', JSON.stringify(r.entry));
    ok('en de uitstapprijs ook', r.exit === '82039.31', JSON.stringify(r.exit));
    ok('een muntje van een paar dollar houdt vier decimalen', r.midden === '2.3346', JSON.stringify(r.midden));
    ok('een centen-coin houdt er acht', r.klein === '0.00001235', JSON.stringify(r.klein));
    await ctx.close();
  }

  console.log('─── Size wordt gelezen zoals hij is opgeslagen ───');
  {
    const { ctx, p } = await open();
    const r = await p.evaluate(() => ({
      okx: SZ({ size: '623.91' }),          // adapter schrijft een gewoon kommagetal
      nl: SZ({ size: '1.234,56' }),          // handmatig ingevoerd in Nederlandse schrijfwijze
      rond: SZ({ size: '25000' }),
      leeg: SZ({ size: '' }),
    }));
    ok('"623.91" is 623,91 en niet 62.391', r.okx === 623.91, JSON.stringify(r.okx));
    ok('"1.234,56" blijft 1234,56', r.nl === 1234.56, JSON.stringify(r.nl));
    ok('een rond getal blijft ongemoeid', r.rond === 25000);
    ok('leeg is geen getal', Number.isNaN(r.leeg));
    await ctx.close();
  }

  console.log('─── Opruiming van journals die de dubbele rijen al hebben ───');
  {
    const { ctx, p } = await open();
    const r = await p.evaluate(() => {
      const basis = { exchange: 'okx', pair: 'BTC/USDC', dir: 'short', status: 'closed', kind: 'live', date: '2026-09-20', time: '03:51', entry: 81026.89, size: '623.91', r: 0, tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] };
      T = [
        { ...basis, id: 1, srcId: 'okx_3809943469299781632_1789953772401', closeTime: '1789953772401', pnl: -3.4449, notes: 'mijn notitie' },
        { ...basis, id: 2, srcId: 'okx_3809943469299781632_1790012341907', closeTime: '1790012341907', pnl: -9.7626, size: '729.24' },
      ];
      MIGRATIONS.find(m => m.v === 3).up();
      return T.filter(t => t.exchange === 'okx').map(t => ({ srcId: t.srcId, pnl: t.pnl, notes: t.notes }));
    });
    ok('van twee rijen blijft er één over', r.length === 1, JSON.stringify(r));
    ok('de eindstand blijft staan', r[0] && r[0].pnl === -9.7626, JSON.stringify(r[0]));
    ok('het kenmerk is nu de positie zelf', r[0] && r[0].srcId === 'okx_3809943469299781632', JSON.stringify(r[0] && r[0].srcId));
    ok('je notitie van de weggevallen rij verhuist mee', r[0] && r[0].notes === 'mijn notitie', JSON.stringify(r[0] && r[0].notes));
    await ctx.close();
  }

  ok('geen JS-errors totaal', errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));
  console.log(`\n=== OKX: één positie = één trade: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
