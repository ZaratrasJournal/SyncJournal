// Backlog F7: Analytics panel "Stop-management en uitvoering". How often the stop moved and what that brought (R and
// P&L), and how trades closed (stop / TP / by hand / liquidation). R via gemR / tradeROrNull (never t.r); a trade without
// a stop history counts nowhere. Follows the filter bar and the own / funded / all money filter. Numbers checked by hand:
// entry 100, stop 99, size $1.000 → risk $10, so P&L $10 = 1R.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const SHOTS = path.resolve('tests/screenshots/stop-analytics'); fs.mkdirSync(SHOTS, { recursive: true });

(async () => {
  const b = await chromium.launch(); const { p, errs } = await H.openJournal(b);
  const zet = (o) => p.evaluate((o) => {
    const base = { time: '10:00', dir: 'long', setup: '', session: 'London', status: 'closed', kind: 'live', entry: 100, stop: 99, size: '1000', pair: 'BTC/USDT', exchange: 'okx', stopBron: 'okx',
      tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] };
    const dicht = s => [{ kind: 'open', ts: 1, qty: 1, price: 100 }, { kind: 'close', ts: 2, qty: 1, price: 100, soort: s }];
    FUNDED = [{ id: 'fdC', kind: 'funded', firm: 'FTMO', name: '100k', size: 100000, status: 'actief', stop: null, logins: [], start: '2026-09-29', payouts: [] }];
    T = o.leeg ? [{ ...base, id: 9, date: '2026-10-01', exchange: '', stopBron: '', pnl: 5, exit: 100.5 }] : [
      { ...base, id: 1, date: '2026-10-01', pnl: 0, exit: 100, stopLaatst: 100, fills: dicht('sl') },           // be, 0R, stop
      { ...base, id: 2, date: '2026-10-02', pnl: 20, exit: 102, stopLaatst: 100.05, fills: dicht('tp') },       // be, 2R, tp
      { ...base, id: 3, date: '2026-10-03', pnl: 10, exit: 101, stopLaatst: 99.5, fills: dicht('hand') },       // strakker, 1R, hand
      { ...base, id: 4, date: '2026-10-04', pnl: -20, exit: 98, stopLaatst: 98, fills: dicht('sl'), exchange: 'fdC', stopBron: '' },   // ruimer, −2R, stop (funded)
      { ...base, id: 5, date: '2026-10-05', pnl: -10, exit: 99, stopLaatst: 99, fills: dicht('sl') },           // geen, −1R, stop
      { ...base, id: 6, date: '2026-10-06', pnl: 5, exit: 100.5, exchange: '', stopBron: '' }];                  // no history
    persistFunded(); persist(); STATE.currency = 'USD';
    STATE.funded = true; STATE.fundedMee = false; STATE.anGeld = o.geld || 'alles';
    STATE.theme = o.theme || 'light'; document.body.classList.toggle('dark', STATE.theme === 'dark');
    clearGFilter(); setFilter('kind', 'alle'); if (o.pair) setFilter('pair', o.pair); go('analytics');
  }, o || {});
  const paneel = () => p.evaluate(() => {
    const el = document.querySelector('#main [data-stop-uitvoering]'); if (!el) return null;
    const rij = k => { const r = el.querySelector(`[data-rij="${k}"]`); return r ? r.innerText.replace(/\s+/g, ' ').trim() : null; };
    const leeg = el.querySelector('[data-empty]');
    return { txt: el.innerText.replace(/\s+/g, ' '), leeg: leeg ? leeg.dataset.empty : '',
      geen: rij('geen'), be: rij('be'), strakker: rij('strakker'), ruimer: rij('ruimer'), stop: rij('stop'), tp: rij('tp'), hand: rij('hand'), liquidatie: rij('liquidatie') }; });

  console.log('─── Met de hand nagerekend ───');
  await zet({}); let a = await paneel();
  ok('paneel staat in Analytics', !!a, JSON.stringify(a));
  if (!a) { console.log(`\n=== Stop-analytics: ${pass}/${pass + fail} ===`); await b.close(); process.exit(1); }
  ok('"5 van 6 trades" met een stopgeschiedenis, en "te weinig trades voor een conclusie" (onder 10)', /5 van 6 trades/.test(a.txt) && /te weinig trades voor een conclusie/.test(a.txt), a.txt.slice(0, 200));
  ok('naar break-even: 2 trades, gem. +1,0R, netto +$ 20', /^Naar break-even 2 \+1,0R \+\$ ?20/.test(a.be || ''), a.be);
  ok('strakker: 1, +1,0R, +$ 10', /^Strakker 1 \+1,0R \+\$ ?10/.test(a.strakker || ''), a.strakker);
  ok('verder weg ⚠: 1, −2,0R, −$ 20', /^Verder weg ⚠ 1 −2,0R −\$ ?20/.test(a.ruimer || ''), a.ruimer);
  ok('niet verzet: 1, −1,0R, −$ 10', /^Niet verzet 1 −1,0R −\$ ?10/.test(a.geen || ''), a.geen);
  ok('dicht op de stop-loss: 3, gem. −1,0R, −$ 30', /^Stop-loss 3 −1,0R −\$ ?30/.test(a.stop || ''), a.stop);
  ok('take-profit: 1, +2,0R, +$ 20; met de hand: 1, +1,0R, +$ 10', /^Take-profit 1 \+2,0R \+\$ ?20/.test(a.tp || '') && /^Met de hand 1 \+1,0R \+\$ ?10/.test(a.hand || ''), a.tp + ' | ' + a.hand);
  ok('liquidatie zonder trades: een streepje voor de R', /^Liquidatie 0 —/.test(a.liquidatie || ''), a.liquidatie);
  ok('zegt eerlijk dat we niet weten wat er zonder verzetten was gebeurd', /zonder koersdata/i.test(a.txt), a.txt.slice(-250));
  await p.waitForTimeout(400); await (await p.$('#main [data-stop-uitvoering]')).screenshot({ path: path.join(SHOTS, 'light.png') });
  await zet({ theme: 'dark' }); await p.waitForTimeout(400); await (await p.$('#main [data-stop-uitvoering]')).screenshot({ path: path.join(SHOTS, 'dark.png') });

  console.log('─── Eigen / funded / alles ───');
  await zet({ geld: 'eigen' }); a = await paneel();
  ok('eigen: de funded trade (verder weg) valt weg, 4 van 5', a && /4 van 5 trades/.test(a.txt) && /^Verder weg ⚠ 0 —/.test(a.ruimer || ''), a && (a.txt.slice(0, 120) + ' | ' + a.ruimer));
  await zet({ geld: 'funded' }); a = await paneel();
  ok('funded: alleen die ene, 1 van 1', a && /1 van 1 trade/.test(a.txt) && /^Verder weg ⚠ 1 −2,0R/.test(a.ruimer || ''), a && (a.txt.slice(0, 120) + ' | ' + a.ruimer));

  console.log('─── Lege staten ───');
  await zet({ leeg: true }); a = await paneel();
  ok('leeg: nog nooit een trade met stopgeschiedenis → emptyState stop-leeg', a && a.leeg === 'stop-leeg', JSON.stringify(a));
  await zet({ pair: 'ETH/USDT' }); a = await p.evaluate(() => ({ p: !!document.querySelector('#main [data-stop-uitvoering]'), leeg: [...document.querySelectorAll('#main [data-empty]')].map(x => x.dataset.empty) }));
  ok('filter laat geen trades over: de pagina toont de gewone lege staat', !a.p && a.leeg.length > 0, JSON.stringify(a));
  await p.evaluate(() => { T = T.filter(t => t.id === 6 || t.id === 1); T.find(t => t.id === 1).pair = 'ETH/USDT'; persist(); clearGFilter(); setFilter('kind', 'alle'); setFilter('pair', 'BTC/USDT'); go('analytics'); });
  a = await paneel();
  ok('niets in beeld: wel stopgeschiedenis, maar niet in dit filter → emptyState stop-niets', a && a.leeg === 'stop-niets', JSON.stringify(a));

  ok('geen JS-fouten', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== Stop-analytics: ${pass}/${pass + fail} ===`);
  await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  ✗ crash: ' + String(e).split('\n')[0]); process.exit(1); });
