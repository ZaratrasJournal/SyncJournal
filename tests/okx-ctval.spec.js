// Backlog B2 (Denny 24-10-2026): OKX's contract-value safety net when the live /public/instruments lookup fails.
// OKX gives position sizes in contracts; the journal converts them to the asset with ctVal. The net only knew
// USDT-SWAP contracts, while EEA accounts trade USDC on FUTURES: the X-Perps (BTC-USD_UM_XPERP-310404) and the
// dated futures (BTC-USD_UM-261030). Values below are OKX's own (public instruments, 24-10-2026), per contract family.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/'), { waitUntil: 'networkidle' });
  const ct = ids => p.evaluate(ids => { const o = ExchangeAPI.okx; o._ctvCache = null; return Object.fromEntries(ids.map(i => [i, o._ctVal(i)])); }, ids);

  console.log('─── Live lookup mislukt: het vangnet ───');
  const v = await ct(['BTC-USD_UM_XPERP-310404', 'BTC-USD_UM-261030', 'ETH-USD_UM_XPERP-310404', 'ETH-USD_UM-261127', 'SOL-USD_UM_XPERP-310404', 'SOL-USD_UM-261225',
    'XRP-USD_UM_XPERP-310404', 'DOGE-USD_UM_XPERP-310404', 'LTC-USD_UM_XPERP-310404', 'ETH-USD_UM-270625', 'BTC-USDT-SWAP', 'POL-USDT-SWAP', 'SUI-USDT-SWAP', 'XYZ-USD_UM_XPERP-310404']);
  ok('BTC X-Perp: 0,0001 BTC per contract', v['BTC-USD_UM_XPERP-310404'] === 0.0001, JSON.stringify(v));
  ok('BTC datum-future: 0,01 (was 0,0001 — 100× te klein)', v['BTC-USD_UM-261030'] === 0.01, String(v['BTC-USD_UM-261030']));
  ok('ETH X-Perp en datum-future: 0,001 (was 1 — 1000× te groot)', v['ETH-USD_UM_XPERP-310404'] === 0.001 && v['ETH-USD_UM-261127'] === 0.001, JSON.stringify([v['ETH-USD_UM_XPERP-310404'], v['ETH-USD_UM-261127']]));
  ok('SOL X-Perp 0,01 en datum-future 0,1', v['SOL-USD_UM_XPERP-310404'] === 0.01 && v['SOL-USD_UM-261225'] === 0.1, JSON.stringify([v['SOL-USD_UM_XPERP-310404'], v['SOL-USD_UM-261225']]));
  ok('XRP 1, DOGE 10, LTC 0,1 (X-Perp)', v['XRP-USD_UM_XPERP-310404'] === 1 && v['DOGE-USD_UM_XPERP-310404'] === 10 && v['LTC-USD_UM_XPERP-310404'] === 0.1, JSON.stringify(v));
  ok('een nieuwe vervaldatum valt onder zijn familie (ETH-USD_UM-270625 → 0,001)', v['ETH-USD_UM-270625'] === 0.001, String(v['ETH-USD_UM-270625']));
  ok('USDT-SWAP blijft: BTC 0,01; nieuw POL 10, SUI 1', v['BTC-USDT-SWAP'] === 0.01 && v['POL-USDT-SWAP'] === 10 && v['SUI-USDT-SWAP'] === 1, JSON.stringify(v));
  ok('onbekend contract: 1, zoals het was', v['XYZ-USD_UM_XPERP-310404'] === 1, String(v['XYZ-USD_UM_XPERP-310404']));

  console.log('─── Onbekend contract: één waarschuwing (backlog B6) ───');
  const warns = [];
  p.on('console', m => { if (m.type() === 'warning') warns.push(m.text()); });
  await p.evaluate(() => { const o = ExchangeAPI.okx; o._ctvCache = null; ['XYZ-USDT-SWAP', 'XYZ-USDT-SWAP', 'BTC-USDT-SWAP', 'ETH-USD_UM_XPERP-310404', 'ABC-USD_UM_XPERP-310404'].forEach(i => o._ctVal(i)); });
  await p.waitForTimeout(100);   // console events arrive asynchronously
  const ctv = warns.filter(w => /ctVal/.test(w));
  ok('onbekend contract: één console.warn met de instId, ook als het vaker langskomt', ctv.filter(w => w.includes('XYZ-USDT-SWAP')).length === 1, JSON.stringify(ctv));
  ok('elk onbekend contract krijgt zijn eigen waarschuwing; bekende contracten geen', ctv.length === 2 && ctv.some(w => w.includes('ABC-USD_UM_XPERP-310404')), JSON.stringify(ctv));
  ok('de waarschuwing noemt geen sleutels', ctv.every(w => !/apiKey|secret|passphrase/i.test(w)), JSON.stringify(ctv));

  console.log('─── De live waarde wint ───');
  const live = await p.evaluate(() => { const o = ExchangeAPI.okx; o._ctvCache = { 'ETH-USD_UM_XPERP-310404': 0.002 }; return o._ctVal('ETH-USD_UM_XPERP-310404'); });
  ok('staat het contract in de live lijst, dan telt die', live === 0.002, String(live));

  console.log('─── In een open positie ───');
  const open = await p.evaluate(() => { const o = ExchangeAPI.okx; o._ctvCache = null;
    return o._normaliseOpen({ instId: 'ETH-USD_UM_XPERP-310404', posId: '1', posSide: 'long', pos: '250', avgPx: '3000', cTime: String(Date.now()), upl: '0', lever: '5', settleCcy: 'USDC' }).positionSizeAsset; });
  ok('250 contracten ETH X-Perp = 0,25 ETH', +open === 0.25, String(open));

  ok('geen JS-fouten', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log(`\n=== OKX contractwaarde: ${pass}/${pass + fail} ===`); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  ✗ crash: ' + String(e).split('\n')[0]); process.exit(1); });
