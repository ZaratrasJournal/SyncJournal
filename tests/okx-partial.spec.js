// Melding Denny 24-09-2026: een OKX-positie die deels gesloten is stond twee keer in de lijst
// — één gesloten rij voor het geboekte deel en één "partial" rij voor de rest. En die tweede
// verscheen pas ná een sync.
//
// Oorzaak: de adapter maakte van zo'n positie een GESLOTEN trade, terwijl de rest nog liep.
// De open rest kwam als losse placeholder binnen. Bij de eerste sync gingen die samen, maar
// elke volgende sync maakte de placeholder opnieuw aan zonder nieuwe gesloten trade om in op
// te gaan. In model B is een positie die nog niet vlak staat één rij met status 'partial'.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const bij = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 1e-6 : tol);
const APP = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');
// zijn echte positie
const POS = '3809943469299781632', INST = 'BTC-USD_UM_XPERP-04APR31';
const CT = 1790144822017, UT = CT + 8 * 36e5;

(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext(); const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
  p.on('dialog', d => d.accept());
  await p.route('**/*', r => /^https?:/.test(r.request().url()) ? r.abort() : r.continue());
  await p.addInitScript(() => localStorage.setItem('sj_welcomed', 'true'));
  await p.goto(APP, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1300);

  // 35 contracten short op 86.415; 25 gesloten op 84.913,84, 10 lopen nog
  const HIST_DEELS = { instId: INST, posId: POS, posSide: 'short', direction: 'short', settleCcy: 'USDC',
    type: '1', cTime: String(CT), uTime: String(UT), openAvgPx: '86415', closeAvgPx: '84913.84',
    closeTotalPos: '25', openMaxPos: '35', realizedPnl: '3.4562', fee: '-0.1', fundingFee: '0' };
  const HIST_DICHT = { ...HIST_DEELS, type: '2', uTime: String(UT + 36e5), closeAvgPx: '84500',
    closeTotalPos: '35', realizedPnl: '5.9', fee: '-0.14' };
  const OPEN = [{ instId: INST, posId: POS, posSide: 'short', cTime: String(CT), uTime: String(UT),
    settleCcy: 'USDC', ccy: 'USDC', avgPx: '86415', pos: '-10', lever: '10', upl: '1.2', liqPx: '90000', markPx: '85000' }];

  const zet = (hist, open) => p.evaluate(([h, o, inst]) => {
    window.__S = { hist: h, open: o };
    ExchangeAPI.okx._ctvCache = { [inst]: 0.0001 }; ExchangeAPI.okx._ctvCacheTs = Date.now();
    window.fetch = async (u, init) => {
      const body = JSON.parse(init.body); const a = d => ({ ok: true, status: 200, json: async () => d, text: async () => '' });
      if (body.action === 'trades') return a({ source: 'positions-history', trades: window.__S.hist });
      if (body.action === 'open_positions') return a({ positions: window.__S.open });
      if (body.action === 'fills') return a({ fills: [] });
      if (body.action === 'test') return a({ success: true, balance: '100' });
      return a({});
    };
    if (!CONNS.okx) { CONNS.okx = { connected: true, apiKey: 'k', apiSecret: 's', passphrase: 'p', lastSync: 0, syncFrom: '' }; persistConns(); }
  }, [hist, open, INST]);
  const sync = () => p.evaluate(() => syncExchange('okx', { quiet: true }));
  const rijen = () => p.evaluate(() => T.filter(t => t.exchange === 'okx').map(t => ({
    srcId: t.srcId, status: t.status, qty: +t.qtyAsset, entry: +t.entry, exit: +t.exit,
    pnl: +t.pnl, realized: +t.realizedPnl || 0, unreal: +t.unrealizedPnl || 0, ph: !!t.placeholder, notes: t.notes || '' })));

  console.log('─── Deels gesloten: één rij, niet twee ───');
  {
    await p.evaluate(() => { T = []; TRASH = []; CONNS = {}; persist(); });
    await zet([HIST_DEELS], OPEN);
    const n1 = await sync(); let r = await rijen();
    ok('de sync levert één trade', n1 === 1 && r.length === 1, JSON.stringify(r.map(x => x.srcId)));
    ok('met status partial, niet gesloten', r[0].status === 'partial', JSON.stringify(r[0].status));
    ok('geen losse placeholder ernaast', !r.some(x => x.ph), JSON.stringify(r));
    ok('het geboekte deel staat apart: +3,46 gerealiseerd, P&L nog 0',
      bij(r[0].realized, 3.4562, 0.001) && r[0].pnl === 0, JSON.stringify({ rz: r[0].realized, pnl: r[0].pnl }));
    ok('de grootte is de hele positie (0,0035), niet alleen het gesloten deel',
      bij(r[0].qty, 0.0035, 1e-9), JSON.stringify(r[0].qty));
    ok('entry 86.415 en de gemiddelde exit tot nu toe 84.913,84', r[0].entry === 86415 && bij(r[0].exit, 84913.84, 0.01), JSON.stringify(r[0]));
  }

  console.log('─── En dat blijft zo bij elke volgende sync ───');
  {
    await p.evaluate(() => { const t = T.find(x => x.exchange === 'okx'); t.notes = 'mijn notitie'; persist(); });
    for (let i = 0; i < 3; i++) await sync();
    const r = await rijen();
    ok('nog steeds één rij, na drie syncs', r.length === 1, JSON.stringify(r.map(x => x.srcId + ':' + x.status)));
    ok('nog steeds partial, met de hele positie', r[0].status === 'partial' && bij(r[0].qty, 0.0035, 1e-9), JSON.stringify(r[0]));
    ok('en je notitie is niet verdwenen', r[0].notes === 'mijn notitie', JSON.stringify(r[0].notes));
  }

  console.log('─── Als de rest daarna dicht gaat ───');
  {
    await zet([HIST_DICHT], []);
    const n = await sync(); const r = await rijen();
    ok('dezelfde rij wordt gesloten, er komt er geen bij', n === 0 && r.length === 1, JSON.stringify({ n, r }));
    ok('status closed, P&L 5,90, geen gerealiseerd-deel meer',
      r[0].status === 'closed' && bij(r[0].pnl, 5.9, 0.001) && !r[0].realized, JSON.stringify(r[0]));
    ok('en de grootte is nu de volledig gesloten positie', bij(r[0].qty, 0.0035, 1e-9), JSON.stringify(r[0].qty));
    ok('de notitie staat er nog', r[0].notes === 'mijn notitie', JSON.stringify(r[0].notes));
  }

  console.log('─── Een volledig gesloten positie blijft gewoon gesloten ───');
  {
    await p.evaluate(() => { T = []; TRASH = []; CONNS = {}; persist(); });
    await zet([HIST_DICHT], []);
    const n = await sync(); const r = await rijen();
    ok('één gesloten trade, geen partial', n === 1 && r.length === 1 && r[0].status === 'closed', JSON.stringify(r));
    ok('met de P&L van de exchange', bij(r[0].pnl, 5.9, 0.001), JSON.stringify(r[0].pnl));
  }

  console.log('─── Een positie die nog helemaal openstaat ───');
  {
    await p.evaluate(() => { T = []; TRASH = []; CONNS = {}; persist(); });
    await zet([], OPEN);
    await sync(); const r = await rijen();
    ok('komt binnen als open rij', r.length === 1 && r[0].status === 'open', JSON.stringify(r));
    ok('met de niet-gerealiseerde P&L', bij(r[0].unreal, 1.2, 0.001), JSON.stringify(r[0].unreal));
  }

  console.log('─── De weergave ───');
  {
    await p.evaluate(() => { T = []; TRASH = []; CONNS = {}; persist(); });
    await zet([HIST_DEELS], OPEN);
    await sync();
    const r = await p.evaluate(() => {
      STATE.page = 'trades'; STATE.tradeTab = 'all'; render();
      const cel = [...document.querySelectorAll('td[data-l="P&L"]')].map(c => c.innerText.replace(/\s+/g, ' ').trim());
      const tabs = [...document.querySelectorAll('.ttab, [class*="tab"]')].map(x => x.textContent.trim()).filter(x => /Open|Gesloten|Alle/.test(x)).join(' | ');
      return { rijen: document.querySelectorAll('td[data-l="Datum"]').length, cel, tabs: tabs.slice(0, 80) };
    });
    ok('er staat één rij in de lijst', r.rijen === 1, JSON.stringify(r.rijen));
    ok('en die toont het geboekte bedrag met "deels dicht"', /3/.test(r.cel[0]) && /deels dicht/.test(r.cel[0]), JSON.stringify(r.cel));
  }

  ok('geen JS-errors totaal', errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));
  console.log(`\n=== OKX deels gesloten: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
