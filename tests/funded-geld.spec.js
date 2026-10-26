// Funded modus (F11), stap 1: funded geld telt nooit stilletjes als eigen geld.
// Met een funded-item en trades erop blijven de balans, het P&L-% en de dashboard-tegels gelijk
// aan die zonder die trades. Met "Funded meetellen" aan tellen alleen lopende/actieve items mee.
// Met de modus uit zijn funded trades nergens te zien, en de cijfers van Blofin, OKX, Kraken,
// Hyperliquid en MEXC zijn precies die van vóór de funded modus.
const { chromium } = require('playwright');
const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

(async () => {
  const b = await chromium.launch(); const { p, errs } = await H.openJournal(b);
  await p.evaluate(async () => {
    localStorage.clear(); try { await IDB.clearAll(); } catch (e) {}
    const base = { time: '10:00', dir: 'long', setup: 'London SFP', session: 'London', status: 'closed', kind: 'live', entry: 100, exit: 110, stop: 95, size: '1000', tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] };
    // Eigen trades op alle vijf exchanges, plus een oude FTMO-trade zonder account (die blijft eigen geld tot je kiest).
    T = [
      { ...base, id: 1, date: '2026-09-01', exchange: 'blofin', pair: 'BTC/USDT', pnl: 80 },
      { ...base, id: 2, date: '2026-09-03', exchange: 'okx', pair: 'ETH/USDT', pnl: -30 },
      { ...base, id: 3, date: '2026-09-05', exchange: 'kraken', pair: 'BTC/USD', pnl: 120 },
      { ...base, id: 4, date: '2026-09-07', exchange: 'hyperliquid', pair: 'SOL/USDC', pnl: 45 },
      { ...base, id: 5, date: '2026-09-09', exchange: 'mexc', pair: 'XRP/USDT', pnl: -15 },
      { ...base, id: 6, date: '2026-09-11', exchange: 'ftmo', pair: 'EURUSD', pnl: 60 },
    ];
    EXMAP.blofin.val = 1000; EXMAP.okx.val = 500; EXMAP.kraken.val = 700; EXMAP.hyperliquid.val = 300; EXMAP.mexc.val = 100;
    persistExMeta(); persist(); clearGFilter(); STATE.page = 'dashboard'; render();
  });

  // Alles wat we vergelijken: balans, het P&L-% per eigen trade, de dashboard-tegels en het aantal trades per pagina.
  const meet = () => p.evaluate(() => {
    go('dashboard');
    const dash = { kpis: (document.querySelector('#main .kpis') || {}).innerText || '', hero: (document.querySelector('#main .hero .big') || {}).innerText || '' };
    const pct = {}; T.filter(t => [1, 2, 3, 4, 5, 6].includes(t.id)).forEach(t => pct[t.id] = pnlPctOf(t));
    const n = {}; ['trades', 'analytics', 'kalender', 'tendencies'].forEach(pg => { go(pg); n[pg] = FT.length; });
    go('dashboard');
    return { bal: totalBalance(), pct, dash, n, eq: BOEKINGEN.length };
  });

  console.log('─── Zonder funded (basis) ───');
  const basis = await meet();
  ok('basis: balans 2600, zes eigen trades', Math.abs(basis.bal - 2600) < 0.01 && basis.n.trades === 6, JSON.stringify(basis.n));

  console.log('─── Funded-item met trades, modus aan, meetellen uit ───');
  await p.evaluate(() => {
    const base = { time: '10:00', dir: 'long', setup: 'London SFP', session: 'London', status: 'closed', kind: 'live', entry: 100, exit: 110, stop: 95, size: '1000', tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] };
    FUNDED = [{ id: 'fd_test1', kind: 'challenge', firm: 'FTMO', name: '100k #1', size: 100000, status: 'bezig', stop: null, logins: [], start: '2026-09-01', payouts: [] }];
    T.push({ ...base, id: 11, date: '2026-09-02', exchange: 'fd_test1', pair: 'US30', pnl: 5000 },
           { ...base, id: 12, date: '2026-09-12', exchange: 'fd_test1', pair: 'XAUUSD', pnl: -1000 });
    STATE.funded = true; STATE.fundedMee = false; persist(); render();
  });
  const aan = await meet();
  ok('balans blijft 2600', Math.abs(aan.bal - basis.bal) < 0.01, aan.bal);
  ok('P&L-% van elke eigen trade blijft gelijk', JSON.stringify(aan.pct) === JSON.stringify(basis.pct), JSON.stringify(aan.pct) + ' vs ' + JSON.stringify(basis.pct));
  ok('dashboard-tegels en balans blijven gelijk', aan.dash.kpis === basis.dash.kpis && aan.dash.hero === basis.dash.hero, aan.dash.kpis.replace(/\s+/g, ' ').slice(0, 120));
  ok('equity en maand-P&L op het dashboard: alleen eigen geld', aan.eq === basis.eq, aan.eq + ' vs ' + basis.eq);
  ok('Trades, Kalender, Analytics en Tendencies tonen de funded trades wel', aan.n.trades === 8 && aan.n.analytics === 8 && aan.n.kalender === 8 && aan.n.tendencies === 8, JSON.stringify(aan.n));
  ok('P&L-% van een funded trade rekent op de grootte (5000 / 100.000 = 5%)', await p.evaluate(() => pnlPctOf(T.find(t => t.id === 11)) === 5));

  console.log('─── Funded meetellen aan ───');
  await p.evaluate(() => { STATE.fundedMee = true; render(); });
  const mee = await meet();
  ok('balans telt het lopende item mee: 2600 + 100.000 + 4.000', Math.abs(mee.bal - 106600) < 0.01, mee.bal);
  ok('P&L-% van eigen trades verandert niet door meetellen', JSON.stringify(mee.pct) === JSON.stringify(basis.pct));
  ok('dashboard: netto P&L telt de funded trades mee', mee.dash.kpis !== basis.dash.kpis && mee.eq === basis.eq + 2, mee.dash.kpis.replace(/\s+/g, ' ').slice(0, 120));
  ok('dashboard: balans gemarkeerd "incl. funded"', await p.evaluate(() => /incl\. funded/i.test(document.querySelector('#main .hero').innerText)));
  await p.evaluate(() => { FUNDED[0].status = 'niet'; render(); });
  const afg = await meet();
  ok('een afgeronde challenge telt bij meetellen niet mee', Math.abs(afg.bal - basis.bal) < 0.01 && afg.eq === basis.eq, afg.bal);

  console.log('─── Modus uit: verborgen, niet gewist ───');
  await p.evaluate(() => { FUNDED[0].status = 'bezig'; STATE.funded = false; STATE.fundedMee = true; render(); });
  const uit = await meet();
  ok('funded trades zijn nergens te zien', uit.n.trades === 6 && uit.n.analytics === 6 && uit.n.kalender === 6 && uit.n.tendencies === 6, JSON.stringify(uit.n));
  ok('meetellen doet niets zolang de modus uit staat', Math.abs(uit.bal - basis.bal) < 0.01, uit.bal);
  ok('trades staan nog in de opslag', await p.evaluate(() => T.filter(t => t.exchange === 'fd_test1').length === 2));
  ok('Blofin, OKX, Kraken, Hyperliquid en MEXC: cijfers precies als vóór de funded modus', JSON.stringify(uit) === JSON.stringify(basis), JSON.stringify(uit).slice(0, 200));

  ok('geen JS-fouten', !errs.length, errs.join(' | '));
  await b.close();
  console.log(`\n=== Funded-geld: ${pass}/${pass + fail} ===`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
