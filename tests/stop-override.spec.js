// Backlog F9: a stop that comes from the exchange is locked. "Zelf aanpassen" frees it (stopBron 'gebruiker', the
// exchange's value kept in stopExchange), the next sync leaves a stop you corrected yourself alone, and "Terug naar
// <exchange>" restores the exchange's stop. Shared via EXMAP, for every exchange; the sync exception lives in each
// adapter. Synthetic trades only.
const { chromium } = require('playwright');
const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const Z = s => Date.parse(s + 'Z');

(async () => {
  const b = await chromium.launch(); const { p, errs } = await H.openJournal(b);
  const veld = () => p.evaluate(() => { const i = document.getElementById('f_stop'), l = document.querySelector('label[for="f_stop"]');
    const knop = t => [...document.querySelectorAll('#modal button')].find(x => x.textContent.trim().startsWith(t));
    return { ro: !!(i && i.readOnly), val: i && i.value, lbl: l ? l.innerText.replace(/\s+/g, ' ') : '', zelf: !!knop('Zelf aanpassen'), terug: (knop('Terug naar') || {}).textContent || '' }; });
  const klik = t => p.evaluate(t => { [...document.querySelectorAll('#modal button')].find(x => x.textContent.trim().startsWith(t)).click(); }, t);

  console.log('─── Kraken: zelf aanpassen, sync, terug ───');
  await p.evaluate(() => { T = [{ ...EMPTY_TRADE, id: 1, exchange: 'kraken', srcId: 'kraken_pos_X', kind: 'live', status: 'closed', pair: 'BTC/USD', dir: 'short', date: '2026-10-14', time: '20:12',
    entry: 81489, exit: 80000, size: '750', pnl: 10, stop: 82235, stopBron: 'kraken', openTime: '1', closeTime: '2' }]; persist(); openForm(1); });
  let v = await veld();
  ok('stop van Kraken: vergrendeld, met knop "Zelf aanpassen"', v.ro && v.zelf && !v.terug, JSON.stringify(v));
  await klik('Zelf aanpassen'); v = await veld();
  ok('na de klik: veld vrij, label "zelf aangepast · Kraken Futures: 82.235", knop "Terug naar Kraken Futures"', !v.ro && /zelf aangepast · Kraken Futures: 82\.235/.test(v.lbl) && /Terug naar Kraken Futures/.test(v.terug) && !v.zelf, JSON.stringify(v));
  await p.evaluate(() => { document.getElementById('f_stop').value = '82000'; submitForm(1); });
  let t = await p.evaluate(() => { const t = T[0]; return { stop: +t.stop, bron: t.stopBron, ex: t.stopExchange }; });
  ok('opgeslagen: stop 82.000, bron gebruiker, Kraken-waarde bewaard', t.stop === 82000 && t.bron === 'gebruiker' && t.ex && t.ex.bron === 'kraken' && t.ex.stop === 82235, JSON.stringify(t));
  t = await p.evaluate(() => { const k = ExchangeAPI.kraken; k._log = { levenslopen: [], weg: new Set(), stops: new Map([['kraken_pos_X', { stop: 82235, verschoven: false, laatst: 82235 }]]) };
    k.afterImport([]); const t = T[0]; return { stop: +t.stop, bron: t.stopBron, ex: t.stopExchange }; });
  ok('de volgende sync laat je eigen stop staan', t.stop === 82000 && t.bron === 'gebruiker', JSON.stringify(t));
  t = await p.evaluate(() => { const k = ExchangeAPI.kraken; k._log = { levenslopen: [], weg: new Set(), stops: new Map([['kraken_pos_X', { stop: 82300, verschoven: false, laatst: 82300 }]]) };
    k.afterImport([]); const t = T[0]; return { stop: +t.stop, ex: t.stopExchange }; });
  ok('… maar onthoudt wat Kraken nu zegt (82.300) voor "Terug naar"', t.stop === 82000 && t.ex && t.ex.stop === 82300, JSON.stringify(t));
  await p.evaluate(() => openForm(1)); v = await veld();
  ok('opnieuw geopend: veld vrij, label met de Kraken-waarde, knop terug', !v.ro && /zelf aangepast · Kraken Futures: 82\.300/.test(v.lbl) && /Terug naar/.test(v.terug), JSON.stringify(v));
  await klik('Terug naar'); v = await veld();
  t = await p.evaluate(() => { const t = T[0]; return { stop: +t.stop, bron: t.stopBron, ex: t.stopExchange || null }; });
  ok('terug naar Kraken: stop 82.300, bron kraken, override weg, veld weer vergrendeld', t.stop === 82300 && t.bron === 'kraken' && t.ex === null && v.ro && v.val === '82300' && v.zelf, JSON.stringify({ t, v }));
  t = await p.evaluate(() => { const k = ExchangeAPI.kraken; k._log = { levenslopen: [], weg: new Set(), stops: new Map([['kraken_pos_X', { stop: 82235, verschoven: false, laatst: 82235 }]]) };
    k.afterImport([]); return +T[0].stop; });
  ok('daarna wint Kraken weer bij de sync', t === 82235, String(t));
  await p.evaluate(() => closeForm());

  console.log('─── Hyperliquid en OKX: dezelfde knop, de sync respecteert hem ───');
  const hl = await p.evaluate(([orders]) => { const h = ExchangeAPI.hyperliquid;
    T = [{ ...EMPTY_TRADE, id: 2, exchange: 'hyperliquid', kind: 'live', status: 'closed', dir: 'long', entry: 81073, pair: 'BTC/USDC', positionId: 'BTC', qtyAsset: 0.00391,
      openTime: String(Date.parse('2026-10-15T19:00:00Z')), closeTime: String(Date.parse('2026-10-17T19:00:00Z')), stop: 79440, stopBron: 'hyperliquid', fills: [], tps: [] }];
    stopZelfAanpassen(2); T[0].stop = 79000;
    h._orders = { regels: h._orderRegels(orders), kinderen: new Map(), vanaf: 0 }; h._stopsInvullen();
    return { stop: +T[0].stop, bron: T[0].stopBron, ex: T[0].stopExchange }; },
    [[{ order: { coin: 'BTC', side: 'A', orderType: 'Stop Market', triggerPx: '79440', sz: '0.00391', origSz: '0.00391', oid: 4, timestamp: Z('2026-10-15T19:05:00'), isTrigger: true, reduceOnly: true, isPositionTpsl: false }, status: 'canceled', statusTimestamp: Z('2026-10-17T19:00:00') }]]);
  ok('Hyperliquid: eigen stop 79.000 blijft na de sync, waarde van Hyperliquid bewaard', hl.stop === 79000 && hl.bron === 'gebruiker' && hl.ex && hl.ex.bron === 'hyperliquid' && hl.ex.stop === 79440, JSON.stringify(hl));
  const OPEN = Z('2026-10-05T04:16:16'), DICHT = Z('2026-10-08T18:53:27');
  const okx = await p.evaluate(([open, dicht]) => { const o = ExchangeAPI.okx;
    T = [{ ...EMPTY_TRADE, id: 3, exchange: 'okx', kind: 'live', status: 'closed', dir: 'short', entry: 85840, qtyAsset: 0.0024, pair: 'BTC/USDC', openTime: String(open), closeTime: String(dicht),
      stop: 87000, stopBron: 'okx', stopAlgoId: '1', fills: [], tps: [] }];
    stopZelfAanpassen(3); T[0].stop = 86500;
    o._regels = o._algoRegels({ source: 'algos', history: [{ algoId: '1', instId: 'BTC-USD_UM_XPERP-310404', ordType: 'conditional', side: 'buy', posSide: 'net', sz: '24', reduceOnly: 'true', slTriggerPx: '87000', state: 'canceled', cTime: String(open + 30e3), uTime: String(dicht), ordIdList: [] }], pending: [] });
    o._dekking = 0; o.afterImport([]); const r1 = { stop: +T[0].stop, bron: T[0].stopBron };
    stopTerugNaarExchange(3); o.afterImport([]); return { r1, r2: { stop: +T[0].stop, bron: T[0].stopBron, ex: T[0].stopExchange || null } }; }, [OPEN, DICHT]);
  ok('OKX: eigen stop 86.500 blijft na de sync', okx.r1.stop === 86500 && okx.r1.bron === 'gebruiker', JSON.stringify(okx));
  ok('OKX: terug → 87.000 van OKX, en de sync houdt die', okx.r2.stop === 87000 && okx.r2.bron === 'okx' && okx.r2.ex === null, JSON.stringify(okx));

  console.log('─── Wat niet verandert ───');
  const hand = await p.evaluate(() => { T = [{ ...EMPTY_TRADE, id: 4, exchange: '', kind: 'live', status: 'closed', pair: 'BTC/USDT', dir: 'long', date: '2026-10-20', time: '10:00', entry: 100, exit: 110, stop: 95, size: '1000', pnl: 10 }];
    persist(); openForm(4); const r = { zelf: [...document.querySelectorAll('#modal button')].some(x => /Zelf aanpassen|Terug naar/.test(x.textContent)), ro: document.getElementById('f_stop').readOnly }; closeForm(); return r; });
  ok('een handmatige trade heeft geen knop en een vrij stop-veld', !hand.zelf && !hand.ro, JSON.stringify(hand));

  ok('geen JS-fouten', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== Stop zelf aanpassen: ${pass}/${pass + fail} ===`);
  await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  ✗ crash: ' + String(e).split('\n')[0]); process.exit(1); });
