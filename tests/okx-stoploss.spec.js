// OKX: the original stop-loss, the planned take-profits and TP/SL/Close per close (F10, plan
// docs/plan-okx-stoploss-2026-10-24.md). Synthetic rows in OKX's own format (orders-algo-history via Worker v24 'algos'),
// a full sync with a fake Worker, and - if present - Denny's recording (tests/_fixtures/okx-algos.json) against his trades.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const Z = s => Date.parse(s + 'Z');
const INST = 'BTC-USD_UM_XPERP-310404';
// an algo order as orders-algo-history gives it (one-way mode: posSide net, side = the closing side)
const algo = (id, cTime, side, o) => ({ algoId: String(id), instId: INST, ordType: 'conditional', side, posSide: 'net', sz: '', closeFraction: '', reduceOnly: 'true',
  slTriggerPx: '', tpTriggerPx: '', state: 'canceled', actualSide: '', cTime: String(cTime), uTime: String(cTime), triggerTime: '', ordIdList: [], ...o });
// Denny's short of 05-10: 24 contracts @85.840, TP 82.900 (9), TP 81.600 (14), the last one by hand at 81.413,5
const OPEN = Z('2026-10-05T04:16:16'), DICHT = Z('2026-10-08T18:53:27');
const SHORT = { dir: 'short', entry: 85840, openTime: String(OPEN), closeTime: String(DICHT), pair: 'BTC/USDC', qtyAsset: 0.0024 };
const ALGOS = [algo(1, OPEN + 30e3, 'buy', { slTriggerPx: '87000', sz: '24', state: 'canceled', uTime: String(DICHT) }),
  algo(2, Z('2026-10-07T14:39:17'), 'buy', { tpTriggerPx: '82900', sz: '9', state: 'effective', actualSide: 'tp', triggerTime: String(Z('2026-10-07T14:49:17')), uTime: String(Z('2026-10-07T14:49:17')), ordIdList: ['o1'] }),
  algo(3, Z('2026-10-07T14:39:40'), 'buy', { tpTriggerPx: '81600', sz: '14', state: 'effective', actualSide: 'tp', triggerTime: String(Z('2026-10-08T15:20:42')), uTime: String(Z('2026-10-08T15:20:42')), ordIdList: ['o2'] })];

(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ timezoneId: 'Europe/Amsterdam', locale: 'nl-NL' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.accept());
  await p.clock.setFixedTime(new Date(Z('2026-10-09T10:00:00')));
  await p.goto('file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/'), { waitUntil: 'load' }); await p.waitForTimeout(600);
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(800);
  await p.evaluate(() => { try { hideWelcome(); } catch (e) {} const o = ExchangeAPI.okx; o._ctvCache = { 'BTC-USD_UM_XPERP-310404': 0.0001 }; o._ctvCacheTs = Date.now() + 864e5; });
  const sl = (rows, t = SHORT) => p.evaluate(([rows, t]) => { const o = ExchangeAPI.okx; return o._slTpVoorTrade(t, o._algoRegels({ source: 'algos', history: rows, pending: [] })); }, [rows, t]);

  console.log('─── Welke order is de SL of een TP van welke trade ───');
  let q = await sl(ALGOS);
  ok('SL 87.000 (buy-stop boven de entry van een short)', q.stop === 87000 && q.verschoven === false, JSON.stringify(q));
  ok('TP aan de winstkant is geen SL', (await sl([ALGOS[1]])).stop === null);
  ok('stop aan de verkeerde kant (sell bij een short) is geen SL', (await sl([algo(9, OPEN + 30e3, 'sell', { slTriggerPx: '87000', sz: '24' })])).stop === null);
  q = await sl([algo(10, OPEN + 30e3, 'buy', { slTriggerPx: '87463', sz: '24', uTime: String(OPEN + 36e5) }), algo(11, OPEN + 36e5 + 50e3, 'buy', { slTriggerPx: '86500', sz: '24', uTime: String(DICHT) })]);
  ok('verschoven zoals Denny het doet (annuleren + nieuwe order): stop 87.463, verschoven, verloop 2', q.stop === 87463 && q.verschoven === true && q.stopVerloop.length === 2, JSON.stringify(q));
  ok('SL van de vorige positie (vóór de opening al afgelopen) telt niet', (await sl([algo(12, OPEN - 30e3, 'buy', { slTriggerPx: '87000', sz: '24', uTime: String(OPEN - 10e3) })])).stop === null);
  ok('SL van de volgende positie (na de sluiting geplaatst) telt niet', (await sl([algo(13, DICHT + 60e3, 'buy', { slTriggerPx: '87000', sz: '24' })])).stop === null);
  q = await sl([algo(14, OPEN + 30e3, 'buy', { ordType: 'oco', slTriggerPx: '87000', tpTriggerPx: '83000', sz: '24', state: 'effective', actualSide: 'sl', ordIdList: ['o9'], uTime: String(DICHT) })]);
  ok('oco: de SL-kant is de stop, de TP-kant een gepland TP (niet geraakt)', q.stop === 87000 && q.tps.length === 1 && q.tps[0].price === 83000 && q.tps[0].status === 'niet geraakt', JSON.stringify(q));
  q = await sl(ALGOS);
  ok('geplande TP\'s: 82.900 en 81.600 geraakt, 37,5% en 58,33% (contracten × 0,0001 BTC)', q.tps.length === 2 && q.tps[0].price === 82900 && q.tps[0].status === 'geraakt' && q.tps[0].pct === 37.5 && q.tps[1].pct === 58.33, JSON.stringify(q.tps));
  q = await sl([algo(15, OPEN + 60e3, 'buy', { tpTriggerPx: '80000', closeFraction: '1', state: 'canceled', uTime: String(DICHT) })]);
  ok('TP op de hele positie (closeFraction 1): 100%, geannuleerd bij de sluiting = niet geraakt', q.tps.length === 1 && q.tps[0].pct === 100 && q.tps[0].status === 'niet geraakt', JSON.stringify(q.tps));

  console.log('─── Hoe ging elke afbouw ───');
  const soort = await p.evaluate(rows => { const o = ExchangeAPI.okx, f = o._afbouwSoort(o._algoRegels({ source: 'algos', history: rows, pending: [] }));
    return [f({ ordId: 'o1', fills: [{ kind: 'close' }] }), f({ ordId: 'o2', fills: [{ kind: 'close' }] }), f({ ordId: 'o3', fills: [{ kind: 'close' }] }), f({ ordId: '', fills: [{ kind: 'close' }] }),
      f({ ordId: 'o9', fills: [{ kind: 'close' }] }), f({ ordId: 'x', fills: [{ kind: 'liq' }] })]; },
    [...ALGOS, algo(14, OPEN + 30e3, 'buy', { ordType: 'oco', slTriggerPx: '87000', tpTriggerPx: '83000', sz: '24', state: 'effective', actualSide: 'sl', ordIdList: ['o9'] })]);
  ok('TP-order → tp, onbekende order → hand, geen order-nummer → null, oco op de SL-kant → sl, liquidatie → liq', JSON.stringify(soort) === JSON.stringify(['tp', 'tp', 'hand', null, 'sl', 'liq']), JSON.stringify(soort));

  console.log('─── In de sync (nep-Worker) ───');
  const rec = { instId: INST, posId: '900', posSide: 'net', direction: 'short', settleCcy: 'USDC', type: '2', cTime: String(OPEN), uTime: String(DICHT),
    openAvgPx: '85840', closeAvgPx: '82014.6', closeTotalPos: '24', openMaxPos: '24', realizedPnl: '9.18', fee: '-0.3', fundingFee: '0' };
  const fill = (ordId, ts, side, sz, px, subType) => ({ instId: INST, ordId, posSide: 'net', fillTime: String(ts), ts: String(ts), side, fillSz: String(sz), fillPx: String(px), fee: '-0.01', subType, fillPnl: '0', tradeId: ordId + ts });
  const FILLS = [fill('e1', OPEN, 'sell', 24, 85840, '4'), fill('o1', Z('2026-10-07T14:49:17'), 'buy', 9, 82900.1, '6'), fill('o2', Z('2026-10-08T15:20:42'), 'buy', 14, 81600.1, '6'), fill('o3', DICHT, 'buy', 1, 81413.5, '6')];
  const sync = (algos, prep) => p.evaluate(async ([rec, fills, algos, prep]) => {
    window.__vragen = [];
    window.proxyCall = async q => { window.__vragen.push(q.action);
      if (q.action === 'open_positions') return { positions: [] };
      if (q.action === 'trades') return { source: 'positions-history', trades: [rec] };
      if (q.action === 'fills') return { fills };
      if (q.action === 'algos') { if (algos === 'fout') throw new Error('OKX: 50011 Too Many Requests'); return algos === 'v23' ? { source: 'positions-history', trades: [rec] } : { source: 'algos', history: algos, pending: [], orders: [], _okxDebug: {} }; }
      return { success: true, balance: '100' }; };
    if (prep) new Function(prep)();
    const res = await syncExchange('okx', { quiet: true });
    const t = T.find(x => x.exchange === 'okx');
    return { res, stop: t && +t.stop, bron: t && t.stopBron, labels: t ? tpLabels(t.tps, t) : [], soort: t ? (t.fills || []).filter(isAfbouw).map(f => f.soort || '') : [], algos: window.__vragen.filter(a => a === 'algos').length };
  }, [rec, FILLS, algos, prep || '']);
  const vers = "T = []; TRASH = []; CONNS.okx = { connected: true, apiKey: 'k', apiSecret: 's', passphrase: 'p', syncFrom: '2026-10-01' }; persistConns();";
  let y = await sync(ALGOS, vers);
  ok('nieuwe trade: stop 87.000 van OKX', y.stop === 87000 && y.bron === 'okx', JSON.stringify(y));
  ok('labels TP1, TP2, TP3 ✋ (de laatste met de hand, in winst), ook op de stappen', y.labels.join() === 'TP1,TP2,TP3 ✋' && y.soort.join() === 'tp,tp,hand', JSON.stringify(y));
  ok('één algos-aanroep per sync', y.algos === 1, JSON.stringify(y));
  y = await sync(ALGOS, vers + "T.push({ ...EMPTY_TRADE, id: 7, exchange: 'okx', kind: 'live', srcId: 'okx_900_" + OPEN + "', status: 'closed', pair: 'BTC/USDC', dir: 'short', entry: 85840, openTime: '" + OPEN + "', closeTime: '" + DICHT + "', stop: 86000, stopBron: 'gebruiker', qtyAsset: 0.0024, fills: [] }); persist();");
  ok('een zelf getypte stop maakt plaats voor die van OKX', y.stop === 87000 && y.bron === 'okx', JSON.stringify(y));
  y = await sync('v23', vers);
  // before F10 an OKX trade had no TP levels and no kinds; without 'algos' it stays that way
  ok('oude Worker (v23): trade komt binnen, geen stop, geen labels (zoals vroeger)', y.res !== -1 && !(y.stop > 0) && y.labels.length === 0 && y.soort.every(k => !k), JSON.stringify(y));
  y = await sync('fout', vers);
  ok('fout bij algos (rate limit): trade komt binnen, geen stop', y.res !== -1 && !(y.stop > 0), JSON.stringify(y));
  const plan = await p.evaluate(() => { const t = T.find(x => x.exchange === 'okx'); t.tps = [...(t.tps || []), { price: 80000, pct: 10, r: '', hit: false, ts: 0 }]; persist(); return true; });
  y = await sync(ALGOS, "CONNS.okx.lastSync = Date.now() - 36e5; persistConns();");
  const eigen = await p.evaluate(() => (T.find(x => x.exchange === 'okx').tps || []).filter(x => !x.hit).map(x => x.price));
  ok('je eigen geplande TP blijft staan als de sync bijwerkt', plan && eigen.includes(80000), JSON.stringify(eigen));

  console.log('─── Review 24-10 ───');
  // 1: a half answer (one call failed) must not overwrite a good stop
  y = await sync(ALGOS, vers);
  const half = await p.evaluate(async rows => { const t = T.find(x => x.exchange === 'okx'); CONNS.okx.lastSync = Date.now() - 36e5; persistConns();
    const o = window.proxyCall; window.proxyCall = async q => q.action === 'algos' ? { source: 'algos', history: rows, pending: [], orders: [], _okxDebug: { errors: ['OKX orders-algo-history: Too Many Requests'] } } : o(q);
    await syncExchange('okx', { quiet: true }); window.proxyCall = o; return { stop: +t.stop, versch: !!t.stopVerschoven }; },
    [{ ...ALGOS[1] }, { ...ALGOS[2] }, { algoId: '20', instId: INST, ordType: 'conditional', side: 'buy', posSide: 'net', reduceOnly: 'true', slTriggerPx: '86500', sz: '24', state: 'canceled', cTime: String(OPEN + 36e5), uTime: String(DICHT), ordIdList: [] }]);
  ok('1: half antwoord (één verzoek mislukt): de stop van 87.000 blijft', half.stop === 87000, JSON.stringify(half));
  // 2: coverage = the newest of the oldest rows of the groups that were cut off
  const dek = await p.evaluate(() => { const o = ExchangeAPI.okx, nu = Date.now(), r = (st, dagen, i) => ({ algoId: st + i, ordType: 'conditional', state: st, cTime: String(nu - dagen * 864e5 + i * 1000) });
    const d = { source: 'algos', history: [...Array.from({ length: 500 }, (_, i) => r('canceled', 10, i)), ...Array.from({ length: 30 }, (_, i) => r('effective', 85, i))], _okxDebug: { afgekapt: true } };
    return (nu - o._dekkingVan(d)) / 864e5; });
  ok('2: canceled afgekapt op 10 dagen, effective tot 85: dekking ±10 dagen (niet 85)', dek > 9.9 && dek < 10.1, String(dek));
  // 3: algos fails in a sync where the trade comes in again: the TP list and its labels stay
  y = await sync(ALGOS, vers);
  y = await sync('fout', "CONNS.okx.lastSync = Date.now() - 36e5; persistConns();");
  ok('3: algos mislukt terwijl de trade opnieuw binnenkomt: labels blijven TP1, TP2, TP3 ✋', y.labels.join() === 'TP1,TP2,TP3 ✋', JSON.stringify(y));
  // 4: a running partial: a TP level is a share of the whole position, not of what was closed so far
  const pp = await p.evaluate(rows => { const o = ExchangeAPI.okx; const t = { ...EMPTY_TRADE, exchange: 'okx', status: 'partial', dir: 'short', entry: 85840, qtyAsset: 0.0024, pair: 'BTC/USDC', openTime: String(Date.parse('2026-10-05T04:16:16Z')),
    fills: [{ kind: 'open', ts: 1, qty: 0.0024, price: 85840, ordId: 'e1' }, { kind: 'close', ts: 2, qty: 0.0009, price: 82900.1, ordId: 'o1' }], tps: [] };
    o._labelAfbouw(t, o._algoRegels({ source: 'algos', history: rows, pending: [] })); return t.tps.map(x => x.pct); }, ALGOS);
  ok('4: partial, 9 van 24 contracten dicht: TP1 = 37,5% (niet 100%)', pp.length === 1 && pp[0] === 37.5, JSON.stringify(pp));
  // 5: a conditional with both SL and TP that fired on the SL
  const beide = algo(30, OPEN + 30e3, 'buy', { slTriggerPx: '87000', tpTriggerPx: '80000', sz: '24', state: 'effective', actualSide: 'sl', ordIdList: ['s1'], uTime: String(DICHT) });
  q = await sl([beide]);
  const k5 = await p.evaluate(rows => ExchangeAPI.okx._afbouwSoort(ExchangeAPI.okx._algoRegels({ source: 'algos', history: rows, pending: [] }))({ ordId: 's1', fills: [{ kind: 'close' }] }), [beide]);
  ok('5: conditional met SL én TP, geraakt op de SL: label sl, TP niet geraakt', k5 === 'sl' && q.tps[0] && q.tps[0].status === 'niet geraakt', JSON.stringify([k5, q.tps]));
  // 6: the SL amended in place (same algoId, new price) and the cost-price SL that moves to the entry
  const amend = await p.evaluate(rows => { const o = ExchangeAPI.okx; T = [{ ...EMPTY_TRADE, id: 1, exchange: 'okx', status: 'closed', dir: 'short', entry: 85840, qtyAsset: 0.0024, pair: 'BTC/USDC',
    openTime: String(Date.parse('2026-10-05T04:16:16Z')), closeTime: String(Date.parse('2026-10-08T18:53:27Z')), stop: 87000, stopBron: 'okx', stopAlgoId: '1', fills: [], tps: [] }];
    o._regels = o._algoRegels({ source: 'algos', history: rows, pending: [] }); o._dekking = 0; o.afterImport([]); return { stop: +T[0].stop, versch: !!T[0].stopVerschoven }; },
    [{ ...ALGOS[0], slTriggerPx: '86500' }]);
  ok('6: SL gewijzigd (zelfde algoId, nieuwe prijs 86.500): de stop blijft 87.000, verschoven', amend.stop === 87000 && amend.versch, JSON.stringify(amend));
  const kostprijs = await p.evaluate(rows => { const o = ExchangeAPI.okx; T[0].stopAlgoId = '1'; delete T[0].stopVerschoven;
    o._regels = o._algoRegels({ source: 'algos', history: rows, pending: [] }); o.afterImport([]); return { stop: +T[0].stop, versch: !!T[0].stopVerschoven }; },
    [{ ...ALGOS[0], slTriggerPx: '85840', amendPxOnTriggerType: '1' }]);
  ok('6: cost-price SL schoof naar de entry: de stop blijft 87.000, verschoven', kostprijs.stop === 87000 && kostprijs.versch, JSON.stringify(kostprijs));
  // 7: a stop that is not reduce-only (an entry stop for the other direction) is not this trade's SL
  ok('7: niet-reduceOnly stop telt niet als SL', (await sl([algo(40, OPEN + 30e3, 'buy', { slTriggerPx: '87000', sz: '24', reduceOnly: 'false' })])).stop === null);

  console.log('─── Denny\'s opname tegen zijn trades (export 22-10) ───');
  const OPN = path.resolve('tests/_fixtures/okx-algos.json'), EXP = path.resolve('syncjournal-backup-2026-10-22.json');
  if (fs.existsSync(OPN) && fs.existsSync(EXP)) {
    const opname = JSON.parse(fs.readFileSync(OPN, 'utf8'));
    const trades = JSON.parse(fs.readFileSync(EXP, 'utf8')).trades.filter(t => t.exchange === 'okx' && (t.fills || []).length)
      .map(t => ({ id: t.id, srcId: t.srcId, exchange: 'okx', kind: 'live', status: t.status, pair: t.pair, dir: t.dir, entry: t.entry, openTime: t.openTime, closeTime: t.closeTime, qtyAsset: t.qtyAsset, stop: t.stop, fills: t.fills, tps: t.tps, date: t.date, time: t.time }));
    const echt = await p.evaluate(([opname, trades]) => { T = trades.map(t => ({ ...EMPTY_TRADE, ...t })); const o = ExchangeAPI.okx;
      o._regels = o._algoRegels(opname); o._dekking = o._dekkingVan(opname); o.afterImport([]);
      return T.map(t => ({ datum: t.date, stop: +t.stop, bron: t.stopBron, labels: tpLabels(t.tps, t) })); }, [opname, trades]);
    const per = Object.fromEntries(echt.map(x => [x.datum, x]));
    ok('05-10 short: stop 87.000, TP1, TP2, TP3 ✋', per['2026-10-05'] && per['2026-10-05'].stop === 87000 && per['2026-10-05'].labels.join() === 'TP1,TP2,TP3 ✋', JSON.stringify(per['2026-10-05']));
    ok('20-10 long: stop 81.200, TP1, TP2, dan de rest met de hand op entry', per['2026-10-20'] && per['2026-10-20'].stop === 81200 && /^TP1,TP2,(TP3 ✋|Close ✋)$/.test(per['2026-10-20'].labels.join()), JSON.stringify(per['2026-10-20']));
    ok('28-09 long: stop 82.000 van OKX, met de hand gesloten', per['2026-09-28'] && per['2026-09-28'].stop === 82000 && per['2026-09-28'].bron === 'okx' && per['2026-09-28'].labels.every(l => /✋/.test(l)), JSON.stringify(per['2026-09-28']));
  } else console.log('  ⏭ geen opname of export in deze kloon — overgeslagen');

  ok('geen JS-fouten', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log(`\n=== OKX stop-loss: ${pass}/${pass + fail} ===`); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  ✗ crash: ' + String(e).split('\n')[0]); process.exit(1); });
