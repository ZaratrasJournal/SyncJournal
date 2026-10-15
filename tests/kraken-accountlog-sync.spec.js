// Kraken sync via the account-log (Worker v21 action 'account_log', Denny 15-10-2026).
// Denny's export of 15-10: the events path had made 4 copies of a trashed December trade, glued a
// June long onto the 14-10 short (one "long" from 06-06 to 14-10), and left the short open without
// a time. This spec runs the real syncExchange('kraken') with that state and a fake Worker.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const Z = s => Date.parse(s + 'Z');
// JSON account-log: a cash row and a position row per execution (as in kraken-account-log.spec.js)
const maakLogs = () => { let id = 100; const logs = [];
  const paar = (dt, oldB, newB, px, o = {}) => { const ex = 'exec-' + id;
    logs.push({ id: id++, date: dt + 'Z', info: 'futures trade', asset: 'usd', contract: 'pf_xbtusd', old_balance: 1000, new_balance: 1000 + (o.pnl || 0) - (o.fee || 0), trade_price: px, realized_pnl: o.pnl || 0, fee: o.fee || 0, realized_funding: 0, execution: ex, booking_uid: 'c' + id });
    logs.push({ id: id++, date: dt + 'Z', info: 'futures trade', asset: 'pf_xbtusd', contract: 'pf_xbtusd', old_balance: oldB, new_balance: newB, new_average_entry_price: o.avg || null, trade_price: px, execution: ex, booking_uid: 'p' + id }); };
  paar('2025-12-07T09:24:00', 0, 0.0028, 89613, { fee: 0.1, avg: 89613 });          // December long (in the trash)
  paar('2025-12-07T09:30:00', 0.0028, 0, 88037, { pnl: -4.4, fee: 0.1 });
  paar('2026-06-06T10:21:00', 0, 0.0108, 78434, { fee: 0.2, avg: 78434 });           // June long
  paar('2026-06-06T14:00:00', 0.0108, 0, 78702, { pnl: 2.9, fee: 0.2 });
  paar('2026-10-14T17:12:05', 0, -0.0092, 81489, { fee: 0.15, avg: 81489 });         // the 14-10 short: open 19:12 Amsterdam
  paar('2026-10-14T17:40:00', -0.0092, -0.0046, 81000, { pnl: 2.25, fee: 0.08 });    // TP1
  paar('2026-10-14T18:12:00', -0.0046, 0, 81900, { pnl: -1.89, fee: 0.08 });         // rest at market, small loss
  return logs; };

const bouwLogs = (lijst) => { let id = 5000; const logs = [];
  lijst.forEach(([dt, oldB, newB, px, o = {}]) => { const ex = 'exec-' + id;
    logs.push({ id: id++, date: dt + 'Z', info: 'futures trade', asset: 'usd', contract: 'pf_xbtusd', old_balance: 1000, new_balance: 1000 + (o.pnl || 0) - (o.fee || 0), trade_price: px, realized_pnl: o.pnl || 0, fee: o.fee || 0, realized_funding: 0, execution: ex, booking_uid: 'c' + id });
    logs.push({ id: id++, date: dt + 'Z', info: 'futures trade', asset: 'pf_xbtusd', contract: 'pf_xbtusd', old_balance: oldB, new_balance: newB, new_average_entry_price: o.avg || null, trade_price: px, execution: ex, booking_uid: 'p' + id }); });
  return logs; };
(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
  const b = await chromium.launch(); const p = await b.newPage(); p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  await p.evaluate(() => { try { hideWelcome() } catch (e) {} });

  const zet = (logs, worker) => p.evaluate(([logs, worker, Z]) => {
    window.__vragen = [];
    window.proxyCall = async (q) => { window.__vragen.push({ action: q.action, startTime: q.startTime, before: q.before });
      if (q.action === 'open_positions') return { positions: [] };
      if (q.action === 'account_log') { if (worker === 'v20') return { source: 'position_updates', trades: [], events: [] };
        const s = +q.startTime || 0, e = +q.before || Infinity; return { source: 'account_log', logs: logs.filter(l => { const t = Date.parse(l.date); return t >= s && t < e; }), _logDebug: { afgekapt: false } }; }
      if (q.action === 'trades') return { source: 'position_updates', trades: [], events: [] };
      return {};
    };
  }, [logs, worker]);

  await p.evaluate(`window.Z=s=>Date.parse(s+'Z')`);
  // Denny's state on 15-10 (from his export), plus a Blofin row that must stay untouched
  await p.evaluate(() => {
    const base = { exchange: 'kraken', pair: 'BTC/USD', kind: 'live', tags: [], layers: [], emotions: [], mistakes: [], screenshots: [], tvLinks: [] };
    const ev = (id, open, close, src, extra) => ({ ...base, id, status: 'closed', dir: 'long', openTime: String(open), closeTime: String(close), date: '', time: '', srcId: src, entry: 89613, exit: 88037, pnl: 1.44, fills: [], ...extra });
    T = [
      { ...base, id: 87, status: 'open', dir: 'short', entry: 81489, exit: 0, stop: 82235, notes: 'short notitie', openTime: '', date: '', time: '', placeholder: true, _stale: true, srcId: 'kraken_open_PF_XBTUSD_1970-01-01T00:00:00.000Z_short' },
      ev(89, Z('2025-12-07T09:24:00'), Z('2025-12-07T09:24:00'), 'kraken_pos_PF_XBTUSD_1765101600000'),
      ev(90, Z('2025-12-07T09:24:00'), Z('2025-12-07T09:24:00'), 'kraken_pos_PF_XBTUSD_1765105200000'),
      ev(91, Z('2025-12-07T09:24:00'), Z('2025-12-07T09:24:00'), 'kraken_pos_PF_XBTUSD_1765116000000'),
      ev(92, Z('2025-12-07T09:24:00'), Z('2025-12-07T09:24:00'), 'kraken_pos_PF_XBTUSD_1765117538340'),
      ev(94, Z('2026-06-06T10:21:00'), Z('2026-10-14T18:12:00'), 'kraken_pos_PF_XBTUSD_1780747622000', { notes: 'juni notitie', entry: 78434.48 }),
      { ...base, exchange: 'blofin', id: 5, status: 'closed', dir: 'long', openTime: '1', closeTime: '2', srcId: 'blofin_x', notes: 'blofin blijft', date: '2026-01-01', time: '10:00' },
    ];
    TRASH = [{ ...base, id: 900, status: 'closed', dir: 'long', srcId: 'kraken_pos_PF_XBTUSD_1765099440000', openTime: String(Z('2025-12-07T09:24:00')), closeTime: String(Z('2025-12-07T09:30:00')), _deletedAt: 1790622423000 }];
    CONNS.kraken = { connected: true, apiKey: 'k', apiSecret: 's', lastSync: Z('2026-10-15T16:00:00'), evt: 1 };
    persist();
  });
  await zet(maakLogs(), 'v21');
  const fout1 = await p.evaluate(async () => { try { await syncExchange('kraken', { quiet: true }); return ''; } catch (e) { return String(e.stack).slice(0, 600); } }); if (fout1) console.log('FOUT: ' + fout1);
  const r = await p.evaluate(() => ({ T: T.map(t => ({ id: t.id, ex: t.exchange, st: t.status, dir: t.dir, open: +t.openTime, close: +t.closeTime, date: t.date, time: t.time, entry: +t.entry, pnl: +t.pnl, notes: t.notes || '', stop: +t.stop || 0, src: t.srcId, steps: (t.fills || []).length })), trash: TRASH.map(t => t.id), vragen: window.__vragen, flag: CONNS.kraken.log }));

  console.log('─── Eerste sync via de account-log ───');
  const K = r.T.filter(t => t.ex === 'kraken');
  const short = K.find(t => t.dir === 'short');
  ok('vraagt de account-log op, eerste keer de hele historie', r.vragen.some(v => v.action === 'account_log' && !(+v.startTime > 0)), JSON.stringify(r.vragen));
  ok('je short van 14-10 staat er als gesloten trade', short && short.st === 'closed' && short.date === '2026-10-14' && short.time === '19:12', JSON.stringify(short));
  ok('met TP1 en de sluiting als stappen, entry 81.489', short && short.entry === 81489 && short.steps === 3);
  ok('netto P&L: 2,25 − 1,89 − fees', short && Math.abs(short.pnl - (2.25 - 1.89 - 0.15 - 0.08 - 0.08)) < 1e-6, short && String(short.pnl));
  ok('notitie en stop van de open rij zijn meeverhuisd', short && short.notes === 'short notitie' && short.stop === 82235, short && (short.notes + ' / ' + short.stop));
  ok('de open rij zonder tijd is weg', !K.some(t => t.st === 'open'));
  const juni = K.find(t => t.date === '2026-06-06');
  ok('juni-long apart, gesloten op 06-06 (niet meer vastgeplakt aan 14-10)', juni && juni.dir === 'long' && new Date(juni.close).toISOString().slice(0, 10) === '2026-06-06', JSON.stringify(juni));
  ok('notitie van de oude juni-rij bewaard', juni && juni.notes === 'juni notitie');
  ok('weggegooide december-trade komt niet terug', !K.some(t => t.date === '2025-12-07'));
  // 90-92 first merge into 89 (same position, notes move along), then 89 goes to the trash
  ok('de vier december-kopieën: samengevoegd en naar de prullenbak (niet gewist)', r.trash.includes(89) && ![89, 90, 91, 92].some(id => K.some(t => t.id === id)), JSON.stringify(r.trash));
  ok('de oude vastgeplakte rij 94 is vervangen', !K.some(t => t.id === 94));
  ok('precies 2 Kraken-trades: juni en de short', K.length === 2, JSON.stringify(K.map(t => t.date + ' ' + t.dir)));
  ok('Blofin-rij onaangeroerd', r.T.some(t => t.ex === 'blofin' && t.notes === 'blofin blijft'));
  ok('vlag gezet: volgende syncs alleen het nieuwe stuk', r.flag === 1);

  console.log('─── Tweede sync: niets dubbel ───');
  await p.evaluate(async () => { window.__vragen = []; CONNS.kraken.lastSync = Date.now(); await syncExchange('kraken', { quiet: true }); });
  const r2 = await p.evaluate(() => ({ n: T.filter(t => t.exchange === 'kraken').length, vragen: window.__vragen }));
  ok('nog steeds 2 Kraken-trades', r2.n === 2, String(r2.n));
  ok('nu met een venster vanaf de vorige sync', r2.vragen.some(v => v.action === 'account_log' && +v.startTime > 0));

  console.log('─── Venster begint midden in een positie ───');
  const wees = await p.evaluate(async (logs) => {
    T = []; TRASH = []; CONNS.kraken = { connected: true, apiKey: 'k', apiSecret: 's', lastSync: Z('2026-10-14T17:30:00') + 3600e3, evt: 1, log: 1, logVanaf: 0 };
    window.__vragen = []; await syncExchange('kraken', { quiet: true });
    return { trades: T.filter(t => t.exchange === 'kraken').map(t => ({ date: t.date, time: t.time, steps: (t.fills || []).length, notes: t.notes || '' })), vragen: window.__vragen.filter(v => v.action === 'account_log').map(v => v.startTime) };
  }, maakLogs());
  ok('vraagt verder terug tot de positie bij 0 begint', wees.vragen.length >= 2 && wees.vragen[1] < wees.vragen[0], JSON.stringify(wees.vragen));
  ok('dan de hele short, niet een afgeknipt stuk', wees.trades.length === 1 && wees.trades[0].time === '19:12' && wees.trades[0].steps === 3 && !/Partial/.test(wees.trades[0].notes), JSON.stringify(wees.trades));

  console.log('─── Lopende positie: openingstijd uit de account-log ───');
  const loopt = await p.evaluate(async (logs) => {
    const open = logs.filter(l => Date.parse(l.date) < Date.parse('2026-10-14T17:30:00Z'));   // only the opening of the short
    window.proxyCall = async (q) => {
      if (q.action === 'open_positions') return { positions: [{ symbol: 'PF_XBTUSD', side: 'short', size: 0.0092, price: 81489, fillTime: '1970-01-01T00:00:00.000Z' }] };
      if (q.action === 'account_log') return { source: 'account_log', logs: open.filter(l => Date.parse(l.date) >= (+q.startTime || 0)), _logDebug: { afgekapt: false } };
      return {};
    };
    T = []; TRASH = []; CONNS.kraken = { connected: true, apiKey: 'k', apiSecret: 's', lastSync: Date.parse('2026-10-14T17:00:00Z'), evt: 1, log: 1, logVanaf: 0 };
    await syncExchange('kraken', { quiet: true });
    return T.filter(t => t.exchange === 'kraken').map(t => ({ st: t.status, date: t.date, time: t.time, sessie: t.session }));
  }, maakLogs());
  ok('lopende short: één open rij met 14-10 19:12 en sessie US PM', loopt.length === 1 && loopt[0].st === 'open' && loopt[0].date === '2026-10-14' && loopt[0].time === '19:12' && loopt[0].sessie === 'US PM', JSON.stringify(loopt));

  console.log('─── Review: flip naast een trade in de prullenbak ───');
  const flip = await p.evaluate(async (logs) => {
    window.proxyCall = async (q) => q.action === 'open_positions' ? { positions: [] } : q.action === 'account_log' ? { source: 'account_log', logs, _logDebug: { afgekapt: false } } : {};
    const base = { exchange: 'kraken', pair: 'BTC/USD', kind: 'live', tags: [], layers: [], emotions: [], mistakes: [], screenshots: [], tvLinks: [] };
    // A (long 09:00-10:00) is in the trash; at 10:00 one execution closes A and opens short B
    TRASH = [{ ...base, id: 901, status: 'closed', dir: 'long', srcId: 'kraken_pos_PF_XBTUSD_x', openTime: String(Z('2026-03-01T09:00:00')), closeTime: String(Z('2026-03-01T10:00:00')) }];
    T = [{ ...base, id: 60, status: 'closed', dir: 'short', srcId: 'kraken_pos_PF_XBTUSD_1772359200001', positionId: 'PF_XBTUSD', openTime: String(Z('2026-03-01T10:00:00')), closeTime: String(Z('2026-03-01T11:00:00')), notes: 'B notitie', date: '2026-03-01', time: '11:00' }];
    DB.save('kraken_weg', []); CONNS.kraken = { connected: true, apiKey: 'k', apiSecret: 's', evt: 1 };
    await syncExchange('kraken', { quiet: true });
    return { T: T.filter(t => t.exchange === 'kraken').map(t => ({ id: t.id, dir: t.dir, notes: t.notes || '' })), trash: TRASH.map(t => t.id) };
  }, bouwLogs([['2026-03-01T09:00:00', 0, 0.002, 70000, { avg: 70000 }], ['2026-03-01T10:00:00', 0.002, -0.001, 71000, { pnl: 2 }], ['2026-03-01T11:00:00', -0.001, 0, 70500, { pnl: 0.5 }]]));
  ok('short B na de flip wordt geimporteerd (A blijft weg)', flip.T.length === 1 && flip.T[0].dir === 'short', JSON.stringify(flip));
  ok('B houdt de notitie van de oude rij; die rij gaat niet naar de prullenbak als echte trade', flip.T[0] && flip.T[0].notes === 'B notitie', JSON.stringify(flip));

  console.log('─── Echte data 15-10: oude rij met de verkeerde richting ───');
  const fout_richting = await p.evaluate(async (logs) => {
    window.proxyCall = async (q) => q.action === 'open_positions' ? { positions: [] } : q.action === 'account_log' ? { source: 'account_log', logs, _logDebug: { afgekapt: false } } : {};
    const base = { exchange: 'kraken', pair: 'BTC/USD', kind: 'live', status: 'closed', positionId: 'PF_XBTUSD', tags: [], layers: [], emotions: [], mistakes: [], screenshots: [], tvLinks: [], date: '2025-12-07', time: '10:24' };
    // Kraken: SHORT 10:24:47-16:57:18, in the trash with its account-log id. The events path made a LONG 10:24-10:24.
    const echtId = 'kraken_pos_PF_XBTUSD_' + Z('2025-12-07T09:24:47');
    TRASH = [{ ...base, id: 903, dir: 'short', srcId: echtId, openTime: String(Z('2025-12-07T09:24:47')), closeTime: String(Z('2025-12-07T15:57:18')) }];
    T = [{ ...base, id: 45, dir: 'long', srcId: 'kraken_pos_PF_XBTUSD_1765101600000', openTime: String(Z('2025-12-07T09:24:00')), closeTime: String(Z('2025-12-07T09:24:00')) },
         { ...base, id: 46, dir: 'long', srcId: 'kraken_pos_PF_XBTUSD_1765200000000', openTime: String(Z('2025-12-08T09:00:00')), closeTime: String(Z('2025-12-08T09:30:00')), notes: 'echte long' }];
    DB.save('kraken_weg', []); CONNS.kraken = { connected: true, apiKey: 'k', apiSecret: 's', evt: 1 };
    await syncExchange('kraken', { quiet: true });
    return { T: T.filter(t => t.exchange === 'kraken').map(t => ({ id: t.id, dir: t.dir, notes: t.notes || '' })), trash: TRASH.map(t => t.id) };
  }, bouwLogs([['2025-12-07T09:24:47', 0, -0.003, 89613, { avg: 89613 }], ['2025-12-07T15:57:18', -0.003, 0, 88037, { pnl: 4.7 }],
               ['2025-12-08T09:00:00', 0, 0.001, 90000, { avg: 90000 }], ['2025-12-08T09:30:00', 0.001, 0, 90100, { pnl: 0.1 }]]));
  ok('oude long-rij binnen een weggegooide short gaat naar de prullenbak', fout_richting.trash.includes(45) && !fout_richting.T.some(t => t.id === 45), JSON.stringify(fout_richting));
  ok('de weggegooide short zelf komt niet terug', !fout_richting.T.some(t => t.dir === 'short'), JSON.stringify(fout_richting.T));
  ok('een echte positie (8-12, long) blijft, met zijn notitie', fout_richting.T.some(t => t.dir === 'long' && t.notes === 'echte long'), JSON.stringify(fout_richting.T));

  console.log('─── Startdatum (syncFrom 25-09): oude rommel opruimen, geen oude trades importeren ───');
  const start = await p.evaluate(async (logs) => {
    const vragen = [];
    window.proxyCall = async (q) => { if (q.action === 'open_positions') return { positions: [] }; if (q.action !== 'account_log') return {};
      vragen.push(q.startTime || 0); return { source: 'account_log', logs: logs.filter(l => Date.parse(l.date) >= (+q.startTime || 0)), _logDebug: { afgekapt: false } }; };
    const base = { exchange: 'kraken', pair: 'BTC/USD', kind: 'live', status: 'closed', positionId: 'PF_XBTUSD', tags: [], layers: [], emotions: [], mistakes: [], screenshots: [], tvLinks: [], date: '2025-12-07', time: '10:24' };
    TRASH = [{ ...base, id: 905, dir: 'short', srcId: 'kraken_pos_PF_XBTUSD_' + Z('2025-12-07T09:24:47'), openTime: String(Z('2025-12-07T09:24:47')), closeTime: String(Z('2025-12-07T15:57:18')) }];
    T = [{ ...base, id: 45, dir: 'long', srcId: 'kraken_pos_PF_XBTUSD_1765101600000', openTime: String(Z('2025-12-07T09:24:47')), closeTime: String(Z('2025-12-07T09:24:47')) },
         { ...base, id: 44, dir: 'short', srcId: 'kraken_pos_PF_XBTUSD_1762300000000', openTime: String(Z('2025-11-05T11:51:37')), closeTime: String(Z('2025-11-05T11:51:37')), date: '2025-11-05' }];   // events copy of a trade before the start date, never trashed
    DB.save('kraken_weg', []); CONNS.kraken = { connected: true, apiKey: 'k', apiSecret: 's', evt: 1, syncFrom: '2026-09-25' };
    await syncExchange('kraken', { quiet: true });
    return { T: T.filter(t => t.exchange === 'kraken').map(t => t.date + ' ' + t.dir), trash: TRASH.map(t => t.id), vragen };
  }, bouwLogs([['2025-11-05T11:51:37', 0, 0.001, 90000, { avg: 90000 }], ['2025-11-05T16:51:22', 0.001, 0, 90500, { pnl: 0.5 }],     // before the start date, never in the journal
               ['2025-12-07T09:24:47', 0, -0.003, 89613, { avg: 89613 }], ['2025-12-07T15:57:18', -0.003, 0, 88037, { pnl: 4.7 }],   // trashed
               ['2026-10-14T18:12:52', 0, -0.0092, 81489, { avg: 81489 }], ['2026-10-15T15:05:30', -0.0092, 0, 81077, { pnl: 3.8 }]]));
  ok('kijkt voor het opruimen terug tot de oudste Kraken-rij', start.vragen.length && start.vragen[0] > 0 && start.vragen[0] <= Z('2025-12-07T09:24:47'), JSON.stringify(start.vragen));
  ok('oude rij van 7-12 naar de prullenbak', start.trash.includes(45), JSON.stringify(start));
  ok('oude events-rij van voor de startdatum (5-11, niet weggegooid) ook naar de prullenbak', start.trash.includes(44), JSON.stringify(start));
  ok('alleen de trade van na de startdatum geimporteerd (niet november)', start.T.length === 1 && start.T[0] === '2026-10-14 short', JSON.stringify(start.T));

  console.log('─── Startdatum later vervroegd: het ontbrekende stuk wordt opgehaald ───');
  const vroeger = await p.evaluate(async (logs) => {
    const vragen = [];
    window.proxyCall = async (q) => { if (q.action === 'open_positions') return { positions: [] }; if (q.action !== 'account_log') return {};
      vragen.push(q.startTime || 0); return { source: 'account_log', logs: logs.filter(l => Date.parse(l.date) >= (+q.startTime || 0)), _logDebug: { afgekapt: false } }; };
    T = []; TRASH = []; DB.save('kraken_weg', []);
    // first synced from 25-09 (log flag set), then the start date was moved to 01-06
    CONNS.kraken = { connected: true, apiKey: 'k', apiSecret: 's', evt: 1, syncFrom: '2026-09-25', lastSync: Date.now() - 600e3 };
    await syncExchange('kraken', { quiet: true });
    const eerst = T.filter(t => t.exchange === 'kraken').map(t => t.date);
    CONNS.kraken.syncFrom = '2026-06-01'; CONNS.kraken.lastSync = Date.now() - 600e3; vragen.length = 0;
    await syncExchange('kraken', { quiet: true });
    const daarna = T.filter(t => t.exchange === 'kraken').map(t => t.date).sort();
    const v2 = vragen.slice(); vragen.length = 0; CONNS.kraken.lastSync = Date.now() - 600e3;
    await syncExchange('kraken', { quiet: true });
    return { eerst, daarna, v2, v3: vragen.slice(), n3: T.filter(t => t.exchange === 'kraken').length };
  }, bouwLogs([['2026-05-10T08:00:00', 0, 0.001, 70000], ['2026-05-10T09:00:00', 0.001, 0, 70100, { pnl: 0.1 }],
               ['2026-06-10T08:00:00', 0, 0.001, 70000], ['2026-06-10T09:00:00', 0.001, 0, 70100, { pnl: 0.1 }],
               ['2026-10-10T08:00:00', 0, 0.001, 70000], ['2026-10-10T09:00:00', 0.001, 0, 70100, { pnl: 0.1 }]]));
  ok('eerst alleen vanaf 25-09', JSON.stringify(vroeger.eerst) === JSON.stringify(['2026-10-10']), JSON.stringify(vroeger));
  ok('na vervroegen naar 01-06: juni erbij, mei niet', JSON.stringify(vroeger.daarna) === JSON.stringify(['2026-06-10', '2026-10-10']), JSON.stringify(vroeger));
  ok('dat stuk wordt een keer opgehaald vanaf de nieuwe datum', vroeger.v2.length && Math.min(...vroeger.v2) <= Z('2026-06-01T00:00:00'), JSON.stringify(vroeger.v2));
  ok('de sync daarna is weer gewoon (geen dubbele, klein venster)', vroeger.n3 === 2 && vroeger.v3.every(v => v > Z('2026-10-01T00:00:00')), JSON.stringify(vroeger));

  console.log('─── Review: twee rijen met notities in een positie ───');
  const twee = await p.evaluate(async (logs) => {
    window.proxyCall = async (q) => q.action === 'open_positions' ? { positions: [] } : q.action === 'account_log' ? { source: 'account_log', logs, _logDebug: { afgekapt: false } } : {};
    const base = { exchange: 'kraken', pair: 'BTC/USD', kind: 'live', status: 'closed', dir: 'long', positionId: 'PF_XBTUSD', tags: [], layers: [], emotions: [], mistakes: [], screenshots: [], tvLinks: [], date: '2026-04-01', time: '10:00' };
    T = [{ ...base, id: 70, srcId: 'kraken_pos_PF_XBTUSD_111', openTime: String(Z('2026-04-01T08:00:00')), closeTime: String(Z('2026-04-01T09:00:00')), notes: 'eerste helft', tags: ['A'] },
         { ...base, id: 71, srcId: 'kraken_pos_PF_XBTUSD_222', openTime: String(Z('2026-04-01T09:00:00')), closeTime: String(Z('2026-04-01T10:00:00')), notes: 'tweede helft', tags: ['B'] }];
    TRASH = []; DB.save('kraken_weg', []); CONNS.kraken = { connected: true, apiKey: 'k', apiSecret: 's', evt: 1 };
    await syncExchange('kraken', { quiet: true });
    const k = T.filter(t => t.exchange === 'kraken');
    return { n: k.length, notes: k[0] && k[0].notes, tags: k[0] && k[0].tags, trash: TRASH.map(t => t.id) };
  }, bouwLogs([['2026-04-01T08:00:00', 0, 0.002, 70000, { avg: 70000 }], ['2026-04-01T09:00:00', 0.002, 0.001, 70500, { pnl: 1 }], ['2026-04-01T10:00:00', 0.001, 0, 71000, { pnl: 1 }]]));
  ok('een trade, met beide notities', twee.n === 1 && /eerste helft/.test(twee.notes) && /tweede helft/.test(twee.notes), JSON.stringify(twee));
  ok('tags samengevoegd', twee.tags && twee.tags.includes('A') && twee.tags.includes('B'), JSON.stringify(twee.tags));
  ok('de oude rijen staan in de prullenbak (terug te halen)', [70, 71].every(id => twee.trash.includes(id)), JSON.stringify(twee.trash));

  console.log('─── Review: afgekapte eerste sync gaat de volgende keer verder ───');
  const kap = await p.evaluate(async (logs) => {
    const vragen = [];
    window.proxyCall = async (q) => { if (q.action === 'open_positions') return { positions: [] };
      if (q.action !== 'account_log') return {};
      vragen.push(q.startTime || 0);
      const rest = logs.filter(l => Date.parse(l.date) >= (+q.startTime || 0) && (!q.before || Date.parse(l.date) < q.before));
      return { source: 'account_log', logs: rest.slice(0, 4), _logDebug: { afgekapt: rest.length > 4 } }; };   // the Worker caps at 4 rows here
    T = []; TRASH = []; DB.save('kraken_weg', []); CONNS.kraken = { connected: true, apiKey: 'k', apiSecret: 's', evt: 1 };
    for (let i = 0; i < 4; i++) { CONNS.kraken.lastSync = Date.now(); await syncExchange('kraken', { quiet: true }); }
    return { n: T.filter(t => t.exchange === 'kraken').length, vragen, klaar: CONNS.kraken.log };
  }, bouwLogs([['2026-05-01T08:00:00', 0, 0.001, 70000], ['2026-05-01T09:00:00', 0.001, 0, 70100, { pnl: 0.1 }], ['2026-05-02T08:00:00', 0, 0.001, 70000], ['2026-05-02T09:00:00', 0.001, 0, 70100, { pnl: 0.1 }], ['2026-05-03T08:00:00', 0, 0.001, 70000], ['2026-05-03T09:00:00', 0.001, 0, 70100, { pnl: 0.1 }]]));
  ok('na een paar syncs alle 3 trades binnen', kap.n === 3, JSON.stringify(kap));
  ok('begint niet steeds opnieuw bij het begin', kap.vragen.filter(v => !v).length <= 1, JSON.stringify(kap.vragen));
  ok('daarna klaar (vlag gezet)', kap.klaar === 1);

  console.log('─── Review: weggegooid blijft weg, ook na legen en opnieuw koppelen ───');
  const blijft = await p.evaluate(async (logs) => {
    window.proxyCall = async (q) => q.action === 'open_positions' ? { positions: [] } : q.action === 'account_log' ? { source: 'account_log', logs, _logDebug: { afgekapt: false } } : {};
    const base = { exchange: 'kraken', pair: 'BTC/USD', kind: 'live', status: 'closed', dir: 'long' };
    T = []; DB.save('kraken_weg', []);
    TRASH = [{ ...base, id: 902, srcId: 'kraken_pos_PF_XBTUSD_y', openTime: String(Z('2026-02-01T09:00:00')), closeTime: String(Z('2026-02-01T10:00:00')) }];
    CONNS.kraken = { connected: true, apiKey: 'k', apiSecret: 's', evt: 1 };
    await syncExchange('kraken', { quiet: true });
    const eerst = T.filter(t => t.exchange === 'kraken').length;
    TRASH = []; T = []; CONNS.kraken = { connected: true, apiKey: 'k', apiSecret: 's', evt: 1 };   // trash purged, account re-linked
    await syncExchange('kraken', { quiet: true });
    return { eerst, daarna: T.filter(t => t.exchange === 'kraken').length, log: ExchangeAPI.kraken._log };
  }, bouwLogs([['2026-02-01T09:00:00', 0, 0.001, 70000], ['2026-02-01T10:00:00', 0.001, 0, 70100, { pnl: 0.1 }]]));
  ok('blijft weg na legen van de prullenbak en opnieuw koppelen', blijft.eerst === 0 && blijft.daarna === 0, JSON.stringify(blijft));
  ok('_log wordt na de import opgeruimd (CSV-import daarna raakt er niet aan)', blijft.log === null);

  console.log('─── Review: fout bij een vervolgverzoek ───');
  const fout = await p.evaluate(async (logs) => {
    let n = 0;
    window.proxyCall = async (q) => { if (q.action === 'open_positions') return { positions: [] }; if (q.action !== 'account_log') return {};
      if (++n > 1) throw new Error('apiLimitExceeded'); return { source: 'account_log', logs, _logDebug: { afgekapt: true } }; };
    T = []; TRASH = []; DB.save('kraken_weg', []); CONNS.kraken = { connected: true, apiKey: 'k', apiSecret: 's', evt: 1 };
    const r = await syncExchange('kraken', { quiet: true });
    return { r, n: T.filter(t => t.exchange === 'kraken').length };
  }, bouwLogs([['2026-05-01T08:00:00', 0, 0.001, 70000], ['2026-05-01T09:00:00', 0.001, 0, 70100, { pnl: 0.1 }]]));
  ok('wat al binnen was wordt toch geimporteerd', fout.r !== -1 && fout.n === 1, JSON.stringify(fout));

  console.log('─── Oude Worker (v20): terugvallen ───');
  await zet(maakLogs(), 'v20');
  const terug = await p.evaluate(async () => { T = []; TRASH = []; CONNS.kraken = { connected: true, apiKey: 'k', apiSecret: 's', lastSync: Date.now() - 3600e3, evt: 1 }; window.__vragen = []; const n = await syncExchange('kraken', { quiet: true }); return { n, acties: window.__vragen.map(v => v.action) }; });
  ok('valt terug op de oude trades-route, zonder fout', terug.n !== -1 && terug.acties.includes('trades'), JSON.stringify(terug));

  ok('geen JS-fouten', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log(`\n=== Kraken account-log sync: ${pass}/${pass + fail} ===`); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  ✗ crash: ' + String(e).split('\n')[0]); process.exit(1); });
