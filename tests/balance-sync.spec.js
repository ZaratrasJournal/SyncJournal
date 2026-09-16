// Borgt Denny's melding 2026-09-16: Hyperliquid verbonden op work, saldo alleen even in
// een toast te zien en verder nergens — leeg dashboard. Vier wortel-oorzaken gedekt:
// (1) verbinden haalt nu direct saldo + trades op, (2) saldi worden persistent opgeslagen
// en overleven herladen, (3) het dashboard toont de balans-hero óók bij nul trades zodra
// er een account is, (4) de nep-"YTD +11,4%" is vervangen door echte YTD-cijfers.
// Adapter wordt gemockt (Hyperliquid-vorm: walletOnly) — de flow zelf is echt.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
  const b = await chromium.launch(); const p = await b.newPage(); p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.setViewportSize({ width: 1700, height: 1000 });
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(600);

  const mock = () => {
    window.__fills = [];
    ExchangeAPI.hyperliquid.testConnection = async () => ({ success: true, balance: window.__bal });
    ExchangeAPI.hyperliquid.fetchTrades = async () => window.__fills;
    ExchangeAPI.hyperliquid.fetchOpenPositions = async () => [];
    window.__bal = '1234.56';
  };
  await p.evaluate(m => { try { hideWelcome() } catch (e) {} T = []; persist(); clearGFilter(); eval('(' + m + ')()'); }, String(mock));
  ok('boot zonder JS-errors', errs.length === 0, errs.slice(0, 2).join(' | '));

  console.log('─── Lege journal: dashboard vóór verbinden ───');
  ok('zonder account gewoon de eerste-trade-uitleg', await p.evaluate(() => { go('dashboard'); return !document.querySelector('#main .hero') && /eerste trade/i.test(document.getElementById('main').textContent); }));

  console.log('─── Verbinden = saldo + eerste sync automatisch ───');
  const r1 = await p.evaluate(async () => {
    go('instellingen'); connExpand('hyperliquid');
    document.getElementById('cw_hyperliquid').value = '0xABCDEF1234567890';
    connectEx('hyperliquid');
    await new Promise(r => setTimeout(r, 300));
    return { val: EXMAP.hyperliquid.val, conn: !!(CONNS.hyperliquid && CONNS.hyperliquid.connected), stored: (DB.load('exmeta', {}).hyperliquid || {}).val };
  });
  ok('verbonden en saldo direct op het account', r1.conn && r1.val === 1234.56, JSON.stringify(r1));
  ok('saldo ook persistent opgeslagen (exmeta)', r1.stored === 1234.56, String(r1.stored));

  console.log('─── Dashboard bij nul trades mét account ───');
  const r2 = await p.evaluate(() => { go('dashboard'); const m = document.getElementById('main'); const hero = m.querySelector('.hero'); return { hero: !!hero, txt: hero ? hero.textContent : '', legend: m.querySelectorAll('.legend .row').length, empty: /eerste trade/i.test(m.textContent) }; });
  ok('balans-hero zichtbaar met het echte saldo (afgerond weergegeven)', r2.hero && /1\.235|1235/.test(r2.txt), r2.txt.slice(0, 80));
  ok('HL staat in de accounts-legenda', r2.legend >= 1);
  ok('daaronder nog steeds de eerste-trade-uitleg', r2.empty);

  console.log('─── Sync haalt trades binnen en ververst het saldo ───');
  const r3 = await p.evaluate(async () => {
    window.__fills = [{ id: 'hl_t1', date: '2026-09-10', time: '10:00', pair: 'BTC/USDC', direction: 'long', entry: '100', exit: '110', positionSize: '1000', pnl: '50', fees: '0', leverage: '5', source: 'hyperliquid', status: 'closed', openTime: '1788990000000', closeTime: '1789000000000', setupTags: [], confirmationTags: [], timeframeTags: [], emotionTags: [], mistakeTags: [], customTags: [], rating: 0, notes: '' }];
    window.__bal = '1284.56';
    const n = await syncExchange('hyperliquid', { quiet: true });
    return { n, trades: T.length, ex: (T[0] || {}).exchange, val: EXMAP.hyperliquid.val };
  });
  ok('trade binnengekomen via sync', r3.n === 1 && r3.trades === 1 && r3.ex === 'hyperliquid', JSON.stringify(r3));
  ok('saldo mee-ververst met de sync', r3.val === 1284.56, String(r3.val));

  console.log('─── Dashboard met trades: echte YTD ───');
  const r4 = await p.evaluate(() => { go('dashboard'); const hero = document.querySelector('#main .hero'); return hero ? hero.textContent : ''; });
  ok('hero toont balans + YTD op basis van echte P&L', /YTD/.test(r4) && /50/.test(r4) && !/11,4/.test(r4), r4.slice(0, 120));

  console.log('─── Verbindingstest legt saldo ook vast ───');
  ok('testConn schrijft het geteste saldo naar het account', await p.evaluate(async () => { window.__bal = '1300'; await testConn('hyperliquid'); return EXMAP.hyperliquid.val === 1300; }));

  console.log('─── Herladen: saldo blijft staan ───');
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(700);
  const r5 = await p.evaluate(() => { try { hideWelcome() } catch (e) {} go('dashboard'); return { val: EXMAP.hyperliquid.val, hero: /1\.300|1300/.test((document.querySelector('#main .hero') || {}).textContent || '') }; });
  ok('saldo overleeft een herlaad en staat weer in de hero', r5.val === 1300 && r5.hero, JSON.stringify(r5));

  ok('geen JS-errors totaal', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== Saldo & verbind-flow: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
