// Kraken: a running position had no date and the wrong session (Denny 14-10-2026, B4).
// /derivatives/api/v3/openpositions does not document fillTime and sent "1970-01-01T00:00:00.000Z".
// The opening time comes from the position events (/api/history/v3/positions) that fetchTrades
// already loads: the event where the position goes from 0 to non-zero. Kraken adapter only.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const OPEN_MS = Date.parse('2026-10-14T17:12:05Z');   // 19:12 Amsterdam (CEST)
const ev = (uid, ts, oud, nieuw, prijs, wissel) => ({ uid, timestamp: ts, event: { PositionUpdate: { tradeable: 'PF_XBTUSD', oldPosition: oud, newPosition: nieuw, executionPrice: prijs, executionSize: Math.abs(nieuw - oud), fillTime: ts, timestamp: ts, positionChange: wissel, executionUid: uid, realizedPnL: 0, fee: 0.01 } } });
(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
  const b = await chromium.launch(); const p = await b.newPage(); p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  await p.evaluate(() => { try { hideWelcome() } catch (e) {} });

  console.log('─── Open positie: geen nep-tijd van 1970 ───');
  const open = await p.evaluate(async () => {
    window.proxyCall = async () => ({ positions: [{ symbol: 'PF_XBTUSD', side: 'short', size: 0.0092, price: 81489, fillTime: '1970-01-01T00:00:00.000Z', unrealizedFunding: 0 }] });
    return (await ExchangeAPI.kraken.fetchOpenPositions('k', 's'))[0];
  });
  ok('id bevat geen 1970', !/1970/.test(open.id), open.id);
  ok('datum blijft leeg zolang de tijd onbekend is (geen 01-01-1970)', open.date === '' && !open.openTime, JSON.stringify({ d: open.date, o: open.openTime }));

  console.log('─── Openingstijd uit de positie-events ───');
  const r = await p.evaluate(([OPEN_MS, evs]) => { const closed = ExchangeAPI.kraken._krLevenslopen(evs); return { closed: closed.length, lopend: ExchangeAPI.kraken._lopend }; },
    [OPEN_MS, [ev('e1', OPEN_MS, 0, -0.0092, 81489, 'open')]]);
  ok('lopende positie levert geen gesloten trade', r.closed === 0);
  ok('lopende positie onthouden met openingstijd en richting', r.lopend && r.lopend.PF_XBTUSD && r.lopend.PF_XBTUSD.openTime === OPEN_MS && r.lopend.PF_XBTUSD.dir === 'short', JSON.stringify(r.lopend));
  const r2 = await p.evaluate((evs) => { ExchangeAPI.kraken._krLevenslopen(evs); return ExchangeAPI.kraken._lopend; },
    [ev('e9', OPEN_MS, -0.005, -0.0092, 81489, 'increase')]);
  ok('opening vóór het venster (eerste event niet vanaf 0): geen verzonnen tijd', !(r2 && r2.PF_XBTUSD), JSON.stringify(r2));

  console.log('─── afterImport vult de open rij ───');
  const rij = await p.evaluate(([OPEN_MS, evs]) => {
    T = [{ id: 87, exchange: 'kraken', pair: 'BTC/USD', dir: 'short', status: 'open', kind: 'live', date: '', time: '', openTime: '', closeTime: '', session: 'London', entry: 81489, stop: 82235, placeholder: true, srcId: 'kraken_open_PF_XBTUSD_1970-01-01T00:00:00.000Z_short', notes: 'mijn notitie' },
         { id: 5, exchange: 'blofin', pair: 'BTC/USD', dir: 'short', status: 'open', kind: 'live', date: '', time: '', openTime: '', session: 'London', entry: 1 }];
    ExchangeAPI.kraken._krLevenslopen(evs); ExchangeAPI.kraken.afterImport([]);
    return { k: T.find(t => t.id === 87), b: T.find(t => t.id === 5) };
  }, [OPEN_MS, [ev('e1', OPEN_MS, 0, -0.0092, 81489, 'open')]]);
  ok('openingstijd gezet', +rij.k.openTime === OPEN_MS, rij.k.openTime);
  ok('datum en tijd in Amsterdam (14-10 19:12)', rij.k.date === '2026-10-14' && rij.k.time === '19:12', rij.k.date + ' ' + rij.k.time);
  ok('sessie volgt de tijd (US PM, niet London)', rij.k.session === 'US PM', rij.k.session);
  ok('stop en notitie blijven staan', rij.k.stop === 82235 && rij.k.notes === 'mijn notitie');
  ok('andere exchange (Blofin) niet aangeraakt', rij.b.openTime === '' && rij.b.session === 'London');
  const tweede = await p.evaluate(() => { const t = T.find(x => x.id === 87); t.openTime = '1111'; ExchangeAPI.kraken.afterImport([]); return t.openTime; });
  ok('een bekende openingstijd wordt nooit overschreven', tweede === '1111');
  const andereKant = await p.evaluate(([OPEN_MS, evs]) => {
    T = [{ id: 88, exchange: 'kraken', pair: 'BTC/USD', dir: 'long', status: 'open', kind: 'live', date: '', time: '', openTime: '', session: 'London', entry: 1 }];
    ExchangeAPI.kraken._krLevenslopen(evs); ExchangeAPI.kraken.afterImport([]); return T[0].openTime;
  }, [OPEN_MS, [ev('e1', OPEN_MS, 0, -0.0092, 81489, 'open')]]);
  ok('andere richting (long) krijgt de tijd van een short niet', andereKant === '');

  console.log('─── Terugkijken zolang een open rij geen tijd heeft ───');
  const st = await p.evaluate(async () => {
    const calls = []; window.proxyCall = async (q) => { calls.push(q.startTime); return { trades: [], events: [{ uid: 'x', timestamp: 1, event: { PositionUpdate: {} } }] }; };
    CONNS.kraken = { ...(CONNS.kraken || {}), evt: 1 };
    const nu = Date.now(), start = nu - 3600e3;
    T = [{ id: 87, exchange: 'kraken', pair: 'BTC/USD', dir: 'short', status: 'open', kind: 'live', openTime: '' }];
    await ExchangeAPI.kraken.fetchTrades('k', 's', null, start); const metOpen = calls.pop();
    T = [{ id: 87, exchange: 'kraken', pair: 'BTC/USD', dir: 'short', status: 'open', kind: 'live', openTime: String(nu - 7200e3) }];
    await ExchangeAPI.kraken.fetchTrades('k', 's', null, start); const zonder = calls.pop();
    return { metOpen, zonder, start, nu };
  });
  ok('open rij zonder tijd → venster 30 dagen terug', st.metOpen <= st.nu - 29 * 864e5, String(st.metOpen));
  ok('open rij mét tijd → gewoon venster', st.zonder === st.start);

  console.log('─── Review-fixes v1.9.1 ───');
  const eenKeer = await p.evaluate(async () => {
    const calls = []; window.proxyCall = async (q) => { calls.push(q.startTime); return { trades: [], events: [{ uid: 'x', timestamp: 1, event: { PositionUpdate: {} } }] }; };
    const nu = Date.now(), start = nu - 3600e3;
    T = [{ id: 87, exchange: 'kraken', pair: 'BTC/USD', dir: 'short', status: 'open', kind: 'live', openTime: '' }];
    await ExchangeAPI.kraken.fetchTrades('k', 's', null, start); ExchangeAPI.kraken.afterImport([]);   // opening niet gevonden
    await ExchangeAPI.kraken.fetchTrades('k', 's', null, start);
    return { eerste: calls[0], tweede: calls[1], start };
  });
  ok('niet gevonden → daarna niet bij elke sync opnieuw 30 dagen terug', eenKeer.eerste < eenKeer.start && eenKeer.tweede === eenKeer.start, JSON.stringify(eenKeer));
  const stale = await p.evaluate(async () => {
    const calls = []; window.proxyCall = async (q) => { calls.push(q.startTime); return { trades: [], events: [{ uid: 'x', timestamp: 1, event: { PositionUpdate: {} } }] }; };
    const start = Date.now() - 3600e3;
    T = [{ id: 87, exchange: 'kraken', pair: 'BTC/USD', dir: 'short', status: 'open', kind: 'live', openTime: '', _stale: true },
         { id: 88, exchange: 'kraken', pair: 'ETH/USD', dir: 'long', status: 'open', kind: 'live', openTime: '2026-09-01T10:00:00.000Z' }];
    await ExchangeAPI.kraken.fetchTrades('k', 's', null, start); return calls[0] === start;
  });
  ok('verouderde rij of rij met ISO-tijd → geen terugkijken', stale);
  const iso = await p.evaluate(([OPEN_MS, evs]) => {
    T = [{ id: 88, exchange: 'kraken', pair: 'BTC/USD', dir: 'short', status: 'open', kind: 'live', openTime: '2026-09-01T10:00:00.000Z', date: '2026-09-01', time: '12:00' }];
    ExchangeAPI.kraken._krLevenslopen(evs); ExchangeAPI.kraken.afterImport([]); return T[0].openTime;
  }, [OPEN_MS, [ev('e1', OPEN_MS, 0, -0.0092, 81489, 'open')]]);
  ok('een ISO-openingstijd wordt niet overschreven', iso === '2026-09-01T10:00:00.000Z', iso);
  const mig = await p.evaluate(async () => {
    T = [{ id: 87, exchange: 'kraken', pair: 'BTC/USD', dir: 'short', status: 'open', kind: 'live', openTime: '', srcId: 'kraken_open_PF_XBTUSD_1970-01-01T00:00:00.000Z_short' }];
    window.proxyCall = async () => ({ positions: [{ symbol: 'PF_XBTUSD', side: 'short', size: 0.0092, price: 81489, fillTime: '1970-01-01T00:00:00.000Z' }] });
    const o = (await ExchangeAPI.kraken.fetchOpenPositions('k', 's'))[0];
    return { oud: T[0].srcId, nieuw: o.id };
  });
  ok('oude 1970-id wordt omgezet, zodat hij blijft matchen', mig.oud === mig.nieuw, JSON.stringify(mig));
  const dubbel = await p.evaluate(() => {
    T = [{ id: 1, exchange: 'kraken', srcId: 'kraken_pos_PF_XBTUSD_2000', positionId: 'PF_XBTUSD', openTime: '2000', closeTime: '9000', status: 'closed', pnl: 10, notes: '' },
         { id: 2, exchange: 'kraken', srcId: 'kraken_pos_PF_XBTUSD_5000', positionId: 'PF_XBTUSD', openTime: '5000', closeTime: '9000', status: 'closed', pnl: 6, notes: 'notitie' },
         { id: 3, exchange: 'kraken', srcId: 'kraken_pos_PF_ETHUSD_5000', positionId: 'PF_ETHUSD', openTime: '5000', closeTime: '9000', status: 'closed', pnl: 1 }];
    ExchangeAPI.kraken.afterImport([]); return T.map(t => t.id + ':' + (t.notes || '')).join(',');
  });
  ok('dezelfde levensloop twee keer (ander venster) → één rij, notitie bewaard', dubbel === '1:notitie,3:', dubbel);

  ok('geen JS-fouten', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log(`\n=== Kraken openingstijd: ${pass}/${pass + fail} ===`); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  ✗ crash: ' + String(e).split('\n')[0]); process.exit(1); });
