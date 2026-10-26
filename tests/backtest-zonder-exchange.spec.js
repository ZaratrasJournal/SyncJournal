// A backtest or practice trade belongs to no exchange (Denny 18-10-2026: "ik trade nergens"). The form offered
// only exchanges and silently picked the first (OKX) for a trade without one, so saving moved it to OKX.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/'), { waitUntil: 'networkidle' });
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  await p.evaluate(() => { try { hideWelcome() } catch (e) {}
    CONNS.okx = { connected: true, apiKey: 'k', apiSecret: 's', passphrase: 'p' };
    T = [{ id: 1, date: '2026-10-16', time: '19:15', exchange: '', account: '', pair: 'BTC/USDT', dir: 'long', kind: 'backtest', status: 'open', entry: 80975.5, stop: 79314.5, size: '500', pnl: 0, tps: [], tags: [], layers: [] }]; persist(); });

  console.log('─── Bestaande backtest zonder exchange ───');
  const r1 = await p.evaluate(() => { openForm(1); const v = document.getElementById('f_exchange').value; submitForm(1); return { v, ex: T[0].exchange }; });
  ok('formulier toont "Geen exchange" en opslaan houdt hem exchange-loos', r1.v === '' && r1.ex === '', JSON.stringify(r1));

  console.log('─── Nieuwe trade ───');
  const r2 = await p.evaluate(() => { openForm(null); const ex = document.getElementById('f_exchange'), voor = ex.value;
    const k = document.getElementById('f_kind'); k.value = 'backtest'; k.dispatchEvent(new Event('change')); return { voor, na: ex.value }; });
  ok('nieuwe trade begint bij een exchange; Soort = Backtest zet hem op Geen', r2.voor !== '' && r2.na === '', JSON.stringify(r2));
  const r3 = await p.evaluate(() => { openForm(null); const ex = document.getElementById('f_exchange'); ex.value = 'okx'; ex.dispatchEvent(new Event('change'));
    const k = document.getElementById('f_kind'); k.value = 'backtest'; k.dispatchEvent(new Event('change')); return ex.value; });
  ok('zelf een exchange gekozen: Backtest laat die staan', r3 === 'okx', r3);
  const r4 = await p.evaluate(() => { openForm(null); const k = document.getElementById('f_kind'); k.value = 'backtest'; k.dispatchEvent(new Event('change'));
    k.value = 'live'; k.dispatchEvent(new Event('change')); return document.getElementById('f_exchange').value; });
  ok('terug naar Live: weer een exchange (niet "Geen")', r4 !== '', r4);

  console.log('─── Exchange kiezen zet de soort (Zaratras 26-10-2026) ───');
  const r6 = await p.evaluate(() => { openForm(null); const ex = document.getElementById('f_exchange'), k = document.getElementById('f_kind');
    ex.value = ''; ex.dispatchEvent(new Event('change')); const geen = k.value;
    ex.value = 'okx'; ex.dispatchEvent(new Event('change')); return { geen, terug: k.value, ex: ex.value }; });
  ok('Geen exchange zet Soort op Backtest', r6.geen === 'backtest', JSON.stringify(r6));
  ok('weer een exchange kiezen zet Soort terug op Live (en houdt de exchange)', r6.terug === 'live' && r6.ex === 'okx', JSON.stringify(r6));
  const r7 = await p.evaluate(() => { openForm(null); const ex = document.getElementById('f_exchange'), k = document.getElementById('f_kind');
    k.value = 'paper'; k.dispatchEvent(new Event('change')); ex.value = ''; ex.dispatchEvent(new Event('change')); return k.value; });
  ok('Paper zonder exchange blijft Paper', r7 === 'paper', r7);
  const r8 = await p.evaluate(() => { openForm(null); const ex = document.getElementById('f_exchange'); ex.value = ''; ex.dispatchEvent(new Event('change'));
    return !document.getElementById('f_kind').closest('.field').classList.contains('vf-pro') || document.getElementById('f_kind').closest('.field').classList.contains('vf-keep'); });
  ok('Soort blijft in beeld als hij op Backtest springt', r8, String(r8));
  console.log('─── Bestaande trades openen en opslaan verandert de exchange niet (review v1.11) ───');
  const r5 = await p.evaluate(() => { T.push({ id: 2, date: '2026-10-10', time: '10:00', exchange: 'okx', account: 'okx', pair: 'BTC/USDT', dir: 'long', kind: 'paper', status: 'closed', entry: 1, exit: 2, size: '100', pnl: 1, tps: [], tags: [], layers: [] },
    { id: 3, date: '2026-01-10', time: '10:00', exchange: '', account: '', pair: 'BTC/USDT', dir: 'long', kind: 'live', status: 'closed', entry: 1, exit: 2, size: '100', pnl: 1, tps: [], tags: [], layers: [] }); persist();
    openForm(2); submitForm(2); openForm(3); submitForm(3); return { paper: T.find(t => t.id === 2).exchange, live: T.find(t => t.id === 3).exchange }; });
  ok('papertrade met OKX: openen en opslaan houdt OKX', r5.paper === 'okx', JSON.stringify(r5));
  ok('live-trade zonder exchange (oude journal): openen en opslaan houdt hem leeg', r5.live === '', JSON.stringify(r5));

  ok('geen JS-fouten', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log(`\n=== Backtest zonder exchange: ${pass}/${pass + fail} ===`); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  ✗ crash: ' + String(e).split('\n')[0]); process.exit(1); });
