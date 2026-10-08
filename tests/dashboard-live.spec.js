// Het dashboard telt en toont dezelfde trades als je filter: backtests tellen niet mee als "live".
//
// Denny 29-09-2026: "ik heb wat winst, maar ik zie het niet terug" en "de trades zie ik niet bij
// recente trades". Zijn journal: 39 backtest-trades (samen +$814) vooraan in de opslag, twee live
// trades van september achteraan. Twee dashboard-onderdelen keken niet naar het filter:
//   - YTD telde álle trades (zonderMergedChildren(T)), dus de backtests als gerealiseerde winst;
//     "deze maand" en Netto P&L telden wél alleen live (CLOSED).
//   - Recente trades pakte T.slice(0,6): de eerste zes uit de opslag, ongesorteerd en ongefilterd.
const { chromium } = require('playwright');
const path = require('path');

let pass = 0, fail = 0;
const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const JAAR = String(new Date().getFullYear());
const MAAND = new Date().toISOString().slice(0, 7);
const B = { pair: 'BTC/USDT', dir: 'long', entry: 100, exit: 110, size: '100' };
// Backtests eerst in de opslag, met oude datums en een groot bedrag dat niet mag meetellen
const RIJEN = [
  { ...B, id: 'bt1', kind: 'backtest', status: 'closed', date: JAAR + '-04-05', time: '10:00', pnl: 300 },
  { ...B, id: 'bt2', kind: 'backtest', status: 'closed', date: JAAR + '-05-06', time: '10:00', pnl: 300 },
  { ...B, id: 'bt3', kind: 'backtest', status: 'closed', date: JAAR + '-01-02', time: '10:00', pnl: 300 },
  // live, achteraan in de opslag
  { ...B, id: 'hl',  kind: 'live', exchange: 'hyperliquid', pair: 'BTC/USDC', status: 'closed', date: MAAND + '-02', time: '17:13', pnl: 0.45 },
  { ...B, id: 'okx', kind: 'live', exchange: 'okx', pair: 'BTC/USDC', status: 'closed', date: MAAND + '-03', time: '09:30', pnl: 0.01 },
  { ...B, id: 'opn', kind: 'live', exchange: 'okx', pair: 'ETH/USDC', status: 'open', date: MAAND + '-03', time: '11:00', pnl: 0 },
];

(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await p.setViewportSize({ width: 1600, height: 1200 });
  await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(600);
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(800);
  await p.evaluate(() => { try { hideWelcome(); } catch (e) {} });
  ok('boot zonder JS-fouten', errs.length === 0, errs[0]);

  const lees = () => p.evaluate(() => {
    go('dashboard');
    const meta = (document.querySelector('.panel.hero .meta') || {}).textContent || '';
    const tab = [...document.querySelectorAll('.panel')].find(x => /Recente trades/.test(x.textContent));
    const rijen = tab ? [...tab.querySelectorAll('tbody tr')].map(tr => [...tr.children].map(td => td.textContent.trim())) : [];
    return { meta: meta.replace(/\s+/g, ' ').trim(), datums: rijen.map(r => r[2]), paren: rijen.map(r => r[0]), setups: rijen.map(r => r[1]) };
  });

  await p.evaluate(rijen => { T = rijen.map(x => ({ ...EMPTY_TRADE, ...x })); persist(); clearGFilter(); setFilter('kind', 'live'); }, RIJEN);
  const live = await lees();

  console.log('─── Filter "Live trades": "deze maand" telt geen backtests ───');
  ok('"deze maand" = de live trades (+$ 0,46), niet de $ 900 aan backtests', /deze maand \+\$ 0,46/.test(live.meta) && !/300|600|900/.test(live.meta), live.meta);
  // Denny 08-10-2026: "deze maand +$ 22,71 · YTD +$ 23,17" was dubbel en verwarrend; het totaal staat
  // al in de Netto P&L-kaart. Eén getal onder de balans.
  ok('geen YTD meer naast "deze maand"', !/YTD|dit jaar/i.test(live.meta), live.meta);
  const metPct = await p.evaluate(() => {
    MANUAL = [{ id: 'm1', name: 'Boek', transactions: [{ id: 1, type: 'deposit', amount: 100, date: '2026-01-01' }] }]; persistManual(); go('dashboard');
    const m = ((document.querySelector('.panel.hero .meta') || {}).textContent || '').replace(/\s+/g, ' ').trim(); MANUAL = []; persistManual(); render(); return m;
  });
  // basis = balans 100 − wat deze maand geboekt is (0,46): 0,46 / 99,54 = +0,5%
  ok('"deze maand" krijgt het percentage dat eerst bij YTD stond: (+0,5%)', /deze maand \+\$ 0,46 \(\+0,5%\)/.test(metPct), metPct);

  console.log('─── Recente trades: nieuwste eerst, en alleen wat het filter laat zien ───');
  ok('er staan trades in Recente trades', live.datums.length > 0, JSON.stringify(live.datums));
  ok('geen enkele backtest in de lijst', !live.datums.some(d => /-0[1-6]$|0[1-6]$/.test(d) && !/^0[23]-/.test(d)) && live.paren.every(pr => /USDC/.test(pr)), JSON.stringify(live.paren));
  ok('de open trade van de 3e staat bovenaan (nieuwste)', /ETH\/USDC/.test(live.paren[0] || ''), JSON.stringify(live.paren));
  ok('daarna de OKX-trade, dan Hyperliquid', live.paren.length >= 3 && live.datums[1] >= live.datums[2], JSON.stringify(live.datums));
  ok('een trade zonder setup toont een streepje, geen "undefined"', !live.setups.some(s => /undefined/.test(s)), JSON.stringify(live.setups));

  console.log('─── Met filter "Alle soorten": wel backtests, maar nog steeds nieuwste eerst ───');
  await p.evaluate(() => setFilter('kind', 'alle'));
  const alle = await lees();
  ok('de nieuwste (live, deze maand) staat nog steeds bovenaan', /ETH\/USDC/.test(alle.paren[0] || ''), JSON.stringify(alle.paren));
  const sleutels = await p.evaluate(() => [...document.querySelectorAll('.panel')].find(x => /Recente trades/.test(x.textContent)) ? 1 : 0);
  ok('Recente trades bestaat nog', sleutels === 1);

  console.log('─── "Deze maand" volgt Amsterdam, ook in het eerste uur van een maand ───');
  // 1 november 00:30 in Amsterdam is in UTC nog 31 oktober; toISOString() gaf dan oktober
  await p.clock.setFixedTime(new Date('2026-11-01T00:30:00+01:00'));
  const nov = await p.evaluate(() => {
    T = [{ ...EMPTY_TRADE, id: 'okt', kind: 'live', exchange: 'okx', pair: 'BTC/USDC', dir: 'long', status: 'closed', date: '2026-10-31', time: '20:00', pnl: 2 },
         { ...EMPTY_TRADE, id: 'nov', kind: 'live', exchange: 'okx', pair: 'BTC/USDC', dir: 'long', status: 'closed', date: '2026-11-01', time: '00:10', pnl: 5 }];
    persist(); go('dashboard'); return ((document.querySelector('.panel.hero .meta') || {}).textContent || '').replace(/\s+/g, ' ').trim();
  });
  ok('om 00:30 op 1 november is "deze maand" november: +$ 5,00', /deze maand \+\$ 5,00/.test(nov), nov);

  ok('geen nieuwe JS-fouten', errs.length === 0, errs[0]);
  console.log(`\n=== Dashboard-live: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
