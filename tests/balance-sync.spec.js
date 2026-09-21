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

  console.log('─── Key-based exchange (Kraken): zelfde flow ───');
  const rk = await p.evaluate(async () => {
    window.__args = null;
    ExchangeAPI.kraken.testConnection = async (k, s) => { window.__args = [k, s]; return { success: true, balance: '5000.4' }; };
    ExchangeAPI.kraken.fetchTrades = async () => [];
    ExchangeAPI.kraken.fetchOpenPositions = async () => [];
    go('instellingen'); connExpand('kraken');
    document.getElementById('ck_kraken').value = 'KEY123'; document.getElementById('cs_kraken').value = 'SEC456';
    connectEx('kraken');
    await new Promise(r => setTimeout(r, 300));
    return { val: EXMAP.kraken.val, args: window.__args, stored: (DB.load('exmeta', {}).kraken || {}).val };
  });
  ok('API-key + secret bereiken de adapter en saldo landt op het account', rk.args && rk.args[0] === 'KEY123' && rk.args[1] === 'SEC456' && rk.val === 5000.4 && rk.stored === 5000.4, JSON.stringify(rk));

  console.log('─── Passphrase-exchange (OKX) ───');
  const ro = await p.evaluate(async () => {
    window.__args = null;
    ExchangeAPI.okx.testConnection = async (k, s, ph) => { window.__args = [k, s, ph]; return { success: true, balance: '77' }; };
    ExchangeAPI.okx.fetchTrades = async () => [];
    ExchangeAPI.okx.fetchOpenPositions = async () => [];
    go('instellingen'); connExpand('okx');
    document.getElementById('ck_okx').value = 'OK'; document.getElementById('cs_okx').value = 'OS'; document.getElementById('cp_okx').value = 'PASS9';
    connectEx('okx');
    await new Promise(r => setTimeout(r, 300));
    return { val: EXMAP.okx.val, ph: window.__args && window.__args[2] };
  });
  ok('passphrase gaat mee en saldo landt', ro.ph === 'PASS9' && ro.val === 77, JSON.stringify(ro));

  console.log('─── Gedeprecieerde exchange (MEXC) ───');
  ok('MEXC koppelen blijft geblokkeerd en refreshBalance doet niets', await p.evaluate(async () => {
    connectEx('mexc');
    const notConn = !(CONNS.mexc && CONNS.mexc.connected);
    CONNS.mexc = { connected: true, apiKey: 'x', apiSecret: 'y' }; // geforceerd oud restant
    const r = await refreshBalance('mexc');
    delete CONNS.mexc; persistConns();
    return notConn && r === false && EXMAP.mexc.val === 0;
  }));

  console.log('─── Handmatig account ───');
  const rm = await p.evaluate(() => {
    T = []; persist(); Object.keys(CONNS).forEach(k => delete CONNS[k]); persistConns();
    EXCHANGES.forEach(e => e.val = 0); persistExMeta();
    MANUAL.length = 0;
    MANUAL.push({ id: 'm_test', name: 'FTMO 100K', transactions: [{ id: 'tx1', type: 'deposit', amount: '2500', date: '2026-09-01', note: 'start' }] });
    persistManual(); go('dashboard');
    const m = document.getElementById('main'); const hero = m.querySelector('.hero');
    return { hero: !!hero, txt: hero ? hero.textContent : '', legend: [...m.querySelectorAll('.legend .row')].map(x => x.textContent).join('|') };
  });
  ok('lege journal + alleen handmatig account → hero met dat saldo', rm.hero && /2\.500|2500/.test(rm.txt), rm.txt.slice(0, 80));
  ok('handmatig account in de legenda', /FTMO 100K/.test(rm.legend), rm.legend);
  ok('handmatig account op €0 toont tóch de hero (net gestart)', await p.evaluate(() => { MANUAL[0].transactions = []; persistManual(); go('dashboard'); return !!document.querySelector('#main .hero'); }));
  ok('handmatige balans beweegt mee met trades op dat account', await p.evaluate(() => {
    MANUAL[0].transactions = [{ id: 'tx1', type: 'deposit', amount: '2500', date: '2026-09-01', note: '' }]; persistManual();
    T = [{ id: 1, date: '2026-09-10', time: '10:00', pair: 'EUR/USD', dir: 'long', setup: '', session: 'London', status: 'closed', kind: 'live', exchange: 'm_test', entry: 1, exit: 1.1, stop: 0.9, size: '1000', pnl: 150, r: 1, tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] }]; persist();
    go('dashboard'); const hero = document.querySelector('#main .hero');
    return hero && /2\.650|2650/.test(hero.textContent);
  }));

  console.log('─── Ongekoppelde exchanges blijven overal onzichtbaar ───');
  const rv = await p.evaluate(() => {
    T = []; persist(); Object.keys(CONNS).forEach(k => delete CONNS[k]); persistConns();
    EXCHANGES.forEach(e => e.val = 0); persistExMeta(); MANUAL.length = 0; persistManual();
    go('trades');
    const noDD = !document.querySelector('[data-dd="exchange"]');
    openForm(null);
    const formOpts = [...document.getElementById('f_exchange').options].map(o => o.value);
    closeForm();
    CONNS.hyperliquid = { connected: true, wallet: '0x1' }; persistConns(); render();
    const dd = document.querySelector('[data-dd="exchange"]');
    const ddOpts = dd ? [...dd.querySelectorAll('.ddchk span')].map(x => x.textContent) : [];
    openForm(null);
    const formOpts2 = [...document.getElementById('f_exchange').options].map(o => o.value);
    const sel = document.getElementById('f_exchange').value;
    closeForm();
    return { noDD, fallbackN: formOpts.length, ddOpts, formOpts2, sel };
  });
  ok('niets gekoppeld → geen accounts-filter in de filterbar', rv.noDD);
  ok('formulier valt dan terug op alle actieve exchanges', rv.fallbackN >= 4, String(rv.fallbackN));
  ok('één koppeling → filter en formulier tonen alléén die', rv.ddOpts.join() === 'Hyperliquid' && rv.formOpts2.join() === 'hyperliquid' && rv.sel === 'hyperliquid', JSON.stringify({ dd: rv.ddOpts, f: rv.formOpts2 }));
  ok('exchange met alleen trades blijft zichtbaar (trades nooit onvindbaar)', await p.evaluate(() => {
    T = [{ id: 1, date: '2026-09-10', time: '10:00', pair: 'BTC/USDT', dir: 'long', setup: '', session: 'London', status: 'closed', kind: 'live', exchange: 'mexc', entry: 100, exit: 110, stop: 95, size: '1000', pnl: 50, r: 1, tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] }]; persist(); render();
    const dd = document.querySelector('[data-dd="exchange"]');
    return dd && /MEXC/.test(dd.textContent);
  }));

  console.log('\u2500\u2500\u2500 Markering op een koppeling die nog niet af is (Denny 21-09-2026) \u2500\u2500\u2500');
  const flag = await p.evaluate(() => {
    go('instellingen');
    const rij = n => [...document.querySelectorAll('.setrow')].find(r => (r.querySelector('b') || {}).textContent && r.querySelector('b').textContent.indexOf(n) === 0);
    const kr = rij('Kraken'), mx = rij('MEXC'), bl = rij('Blofin');
    return {
      krChip: !!(kr && kr.querySelector('.exflag')) && kr.querySelector('.exflag').textContent,
      krUitleg: !!(kr && kr.querySelector('.exnote')),
      krKoppelbaar: !!(kr && [...kr.querySelectorAll('button')].some(b => /Verbinden|Beheren/.test(b.textContent))),
      mxChip: !!(mx && mx.querySelector('.exflag')) && mx.querySelector('.exflag').textContent,
      mxKoppelbaar: !!(mx && mx.querySelector('button')),
      blSchoon: !!bl && !bl.querySelector('.exflag') && !bl.querySelector('.exnote'),
    };
  });
  ok('Kraken toont de markering "in ontwikkeling"', flag.krChip === 'in ontwikkeling', JSON.stringify(flag.krChip));
  ok('met een uitleg eronder', flag.krUitleg);
  ok('maar blijft gewoon te koppelen (anders dan een gestopte API)', flag.krKoppelbaar && !flag.mxKoppelbaar, JSON.stringify(flag));
  ok('MEXC houdt zijn eigen markering', flag.mxChip === 'API gestopt', JSON.stringify(flag.mxChip));
  ok('een exchange zonder markering blijft schoon', flag.blSchoon);

  ok('geen JS-errors totaal', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== Saldo & verbind-flow: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
