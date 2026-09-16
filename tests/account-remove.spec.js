// Borgt Denny's verzoek 2026-09-16: bij het verwijderen van een account (handmatig of
// exchange-koppeling) kiest de gebruiker wat er met de gekoppelde trades gebeurt —
// mee naar de prullenbak (terughaalbaar) of behouden als losse trades. Loskoppelen van
// een exchange zet ook het saldo terug naar 0.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(600);

  const seed = () => {
    const base = { time: '10:00', pair: 'BTC/USDT', dir: 'long', setup: '', session: 'London', status: 'closed', kind: 'live', entry: 100, exit: 110, stop: 95, size: '1000', pnl: 50, r: 1, tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] };
    T = [{ ...base, id: 1, date: '2026-09-10', exchange: 'm_a' }, { ...base, id: 2, date: '2026-09-11', exchange: 'm_a' }, { ...base, id: 3, date: '2026-09-12', exchange: 'hyperliquid' }];
    TRASH = []; persistTrash(); persist();
    MANUAL.length = 0; MANUAL.push({ id: 'm_a', name: 'Acct A', transactions: [{ id: 't1', type: 'deposit', amount: '1000', date: '2026-09-01', note: '' }] }); persistManual();
    CONNS.hyperliquid = { connected: true, wallet: '0x1', hint: '0x1' }; persistConns();
    EXMAP.hyperliquid.val = 96; persistExMeta();
  };
  await p.evaluate(s => { try { hideWelcome() } catch (e) {} eval('(' + s + ')()'); }, String(seed));
  ok('boot zonder JS-errors', errs.length === 0, errs.slice(0, 2).join(' | '));

  console.log('─── Handmatig account: trades mee verwijderen ───');
  const r1 = await p.evaluate(() => {
    const seq = [true, true]; const orig = window.confirm; window.confirm = () => seq.shift(); removeManual('m_a'); window.confirm = orig;
    return { man: MANUAL.length, t: T.length, trash: TRASH.length, hlLeft: T.every(x => x.exchange === 'hyperliquid') };
  });
  ok('account weg, 2 trades naar prullenbak, HL-trade onaangeroerd', r1.man === 0 && r1.t === 1 && r1.trash === 2 && r1.hlLeft, JSON.stringify(r1));
  ok('prullenbak-trades zijn terug te halen', await p.evaluate(() => { trashRestore(TRASH.map(t => t.id)); return T.length === 3 && TRASH.length === 0; }));

  console.log('─── Handmatig account: trades behouden ───');
  const r2 = await p.evaluate(() => {
    MANUAL.push({ id: 'm_a', name: 'Acct A', transactions: [] }); persistManual();
    const seq = [true, false]; const orig = window.confirm; window.confirm = () => seq.shift(); removeManual('m_a'); window.confirm = orig;
    return { man: MANUAL.length, t: T.length, trash: TRASH.length };
  });
  ok('account weg, trades blijven als losse trades', r2.man === 0 && r2.t === 3 && r2.trash === 0, JSON.stringify(r2));

  console.log('─── Annuleren = niets gebeurt ───');
  const r3 = await p.evaluate(() => {
    MANUAL.push({ id: 'm_a', name: 'Acct A', transactions: [] }); persistManual();
    const orig = window.confirm; window.confirm = () => false; removeManual('m_a'); window.confirm = orig;
    return { man: MANUAL.length, t: T.length };
  });
  ok('eerste confirm geweigerd → account en trades onaangeroerd', r3.man === 1 && r3.t === 3, JSON.stringify(r3));

  console.log('─── Exchange loskoppelen ───');
  const r4 = await p.evaluate(() => {
    const seq = [true, true]; const orig = window.confirm; window.confirm = () => seq.shift(); disconnectEx('hyperliquid'); window.confirm = orig;
    return { conn: !!CONNS.hyperliquid, val: EXMAP.hyperliquid.val, t: T.length, trash: TRASH.length, stored: (DB.load('exmeta', {}).hyperliquid || {}).val };
  });
  ok('losgekoppeld, saldo naar 0 (ook opgeslagen), HL-trade naar prullenbak', !r4.conn && r4.val === 0 && r4.stored === 0 && r4.t === 2 && r4.trash === 1, JSON.stringify(r4));
  ok('zonder gekoppelde trades: alleen de verwijder-confirm', await p.evaluate(() => {
    CONNS.blofin = { connected: true, apiKey: 'x', apiSecret: 'y' }; persistConns();
    let asks = 0; const orig = window.confirm; window.confirm = () => { asks++; return true; }; disconnectEx('blofin'); window.confirm = orig;
    return asks === 1 && !CONNS.blofin;
  }));

  ok('geen JS-errors totaal', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== Account verwijderen: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
