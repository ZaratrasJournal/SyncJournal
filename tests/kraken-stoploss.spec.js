// Kraken: the original stop-loss of a position from the trigger history (Worker v22, Denny 18-10-2026).
// Kraken's /triggers has no position id and no SL/TP field: a stop belongs to a position by contract,
// closing side, the loss side of the entry and the time window (opening − 60 s … close).
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const Z = s => Date.parse(s + 'Z');
const plaats = (ts, dir, prijs, extra = {}) => ({ uid: 'e' + ts, timestamp: ts, event: { OrderTriggerPlaced: { order: { uid: 't' + ts, tradeable: 'PF_XBTUSD', direction: dir, quantity: '0.0092', orderType: 'stop', reduceOnly: true, timestamp: ts, triggerOptions: { triggerPrice: String(prijs), triggerSide: dir === 'Buy' ? 'Above' : 'Below', triggerSignal: 'MarkPrice' } }, reason: 'new_user_order' } }, ...extra });
const wijzig = (ts, dir, oud, nieuw) => ({ uid: 'w' + ts, timestamp: ts, event: { OrderTriggerUpdated: { oldOrderTrigger: { tradeable: 'PF_XBTUSD', direction: dir, triggerOptions: { triggerPrice: String(oud) }, orderType: 'stop' }, newOrderTrigger: { tradeable: 'PF_XBTUSD', direction: dir, triggerOptions: { triggerPrice: String(nieuw) }, orderType: 'stop' }, reason: 'edited_by_user' } } });
const annuleer = (ts, dir, prijs, orderUid) => ({ uid: 'c' + ts, timestamp: ts, event: { OrderTriggerCancelled: { order: { uid: orderUid, tradeable: 'PF_XBTUSD', direction: dir, quantity: '0.0092', orderType: 'stop', triggerOptions: { triggerPrice: String(prijs) } }, reason: 'cancelled_by_user' } } });
const SHORT = { positionId: 'PF_XBTUSD', direction: 'short', entry: '81489', openTime: String(Z('2026-10-14T18:12:52')), closeTime: String(Z('2026-10-15T15:05:30')) };

(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
  const b = await chromium.launch(); const p = await b.newPage(); p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  await p.evaluate(() => { try { hideWelcome() } catch (e) {} });
  const t = (els, L = SHORT) => p.evaluate(([els, L]) => { const k = ExchangeAPI.kraken; return k._stopVoorLevensloop(L, k._triggerRegels(els)); }, [els, L]);

  console.log('─── Welke trigger is de stop-loss ───');
  ok('SL geplaatst na de instap', (await t([plaats(Z('2026-10-14T18:13:30'), 'Buy', 82235)])).stop === 82235);
  ok('bracket: 20 s vóór de instap telt mee', (await t([plaats(Z('2026-10-14T18:12:32'), 'Buy', 82235)])).stop === 82235);
  ok('een wijziging in de marge vóór de instap is de stop van de vorige positie: telt niet', (await t([wijzig(Z('2026-10-14T18:12:22'), 'Buy', 83000, 82900)])).stop === null);
  ok('5 min vóór de instap telt niet', (await t([plaats(Z('2026-10-14T18:07:52'), 'Buy', 82235)])).stop === null);
  ok('TP (winstkant, buy onder entry) is geen SL', (await t([plaats(Z('2026-10-14T18:13:30'), 'Buy', 80000)])).stop === null);
  ok('stop in dezelfde richting (sell) is geen SL', (await t([plaats(Z('2026-10-14T18:13:30'), 'Sell', 82235)])).stop === null);
  ok('ander contract telt niet', (await t([plaats(Z('2026-10-14T18:13:30'), 'Buy', 82235)], { ...SHORT, positionId: 'PF_ETHUSD' })).stop === null);
  ok('geen triggers → null', (await t([])).stop === null);
  ok('na de sluiting geplaatst telt niet', (await t([plaats(Z('2026-10-15T16:00:00'), 'Buy', 82235)])).stop === null);
  const LONG = { ...SHORT, direction: 'long' };
  ok('long: sell-stop onder de entry is de SL', (await t([plaats(Z('2026-10-14T18:13:30'), 'Sell', 80500)], LONG)).stop === 80500);
  ok('long: sell boven de entry (TP) is geen SL', (await t([plaats(Z('2026-10-14T18:13:30'), 'Sell', 83000)], LONG)).stop === null);
  ok('TP en SL samen: de SL wint, ook als de TP eerder kwam', (await t([plaats(Z('2026-10-14T18:13:00'), 'Buy', 80000), plaats(Z('2026-10-14T18:13:30'), 'Buy', 82235)])).stop === 82235);

  console.log('─── Verschoven stop ───');
  let r = await t([plaats(Z('2026-10-14T18:13:30'), 'Buy', 82235), wijzig(Z('2026-10-14T20:00:00'), 'Buy', 82235, 81489)]);
  ok('naar break-even geschoven: oorspronkelijke stop blijft, verschoven=true', r.stop === 82235 && r.verschoven === true, JSON.stringify(r));
  r = await t([plaats(Z('2026-10-14T18:13:30'), 'Buy', 82235)]);
  ok('niet verschoven: verschoven=false', r.verschoven === false);
r = await t([plaats(Z('2026-10-14T18:13:30'), 'Buy', 82235), plaats(Z('2026-10-14T18:20:00'), 'Buy', 80000)]);  ok('een TP die later geplaatst wordt is geen verschuiving', r.stop === 82235 && r.verschoven === false, JSON.stringify(r));
  r = await t([plaats(Z('2026-10-14T18:13:30'), 'Buy', 82235), annuleer(Z('2026-10-14T19:00:00'), 'Buy', 82235, 't' + Z('2026-10-14T18:13:30')), plaats(Z('2026-10-14T19:00:01'), 'Buy', 81600)]);
  ok('geannuleerd en opnieuw geplaatst: eerste blijft, verschoven=true', r.stop === 82235 && r.verschoven === true, JSON.stringify(r));
  r = await t([plaats(Z('2026-10-14T18:00:00'), 'Buy', 82500), wijzig(Z('2026-10-14T18:14:00'), 'Buy', 82500, 82235)]);
  ok('geplaatst vóór het venster, gewijzigd erin: de oude prijs telt als eerste plaatsing', r.stop === 82500 && r.verschoven === true, JSON.stringify(r));
  r = await t([plaats(Z('2026-10-14T18:13:30'), 'Buy', 82235), plaats(Z('2026-10-14T18:13:31'), 'Buy', 82235)]);
  ok('dezelfde stop twee keer (dubbele pagina) is niet verschoven', r.stop === 82235 && r.verschoven === false, JSON.stringify(r));

  console.log('─── Echte data (Denny, 14–16 okt) ───');
  // stop placed at the fill (reason partial_fill), TPs on the profit side, every trigger cancelled at the close
  const echt = require('./fixtures/kraken-triggers-sample.json');
  const uitkomst = await p.evaluate((f) => { const k = ExchangeAPI.kraken, rg = k._triggerRegels(f.elements); return f.posities.map(L => ({ ...k._stopVoorLevensloop(L, rg), verwacht: L.verwachtStop, dir: L.direction })); }, echt);
  uitkomst.forEach((u, i) => ok(`positie ${i + 1} (${u.dir}): stop ${u.verwacht}, niet verschoven`, u.stop === u.verwacht && u.verschoven === false, JSON.stringify(u)));

  console.log('─── Ruwe vormen ───');
  const rg = await p.evaluate((els) => ExchangeAPI.kraken._triggerRegels(els), [plaats(1, 'Buy', 82235), { event: { Onbekend: {} } }, null, { timestamp: 5, event: { OrderTriggerPlaced: { order: { tradeable: 'pf_xbtusd', direction: 'Sell', orderType: 'stp', triggerOptions: { triggerPrice: 'x' } } } } }]);
  ok('onbekende events, null en prijsloze regels vallen weg', rg.length === 1 && rg[0].contract === 'PF_XBTUSD' && rg[0].side === 'buy' && rg[0].price === 82235 && rg[0].soort === 'geplaatst', JSON.stringify(rg));

  console.log('─── In de sync ───');
  // account-log: a short 14-10 18:12:52 → 15-10 15:05:30, entry 81489; one execution = a cash row and a position row
  let lid = 100;
  const uitvoering = (iso, oud, nieuw, px, pnl, fee) => { const date = iso + 'Z', ex = 'exec-' + lid;
    return [{ id: lid++, date, info: 'futures trade', asset: 'usd', contract: 'pf_xbtusd', old_balance: 1000, new_balance: 1000 + pnl - fee, trade_price: px, realized_pnl: pnl, fee, realized_funding: 0, execution: ex, booking_uid: 'c' + lid },
            { id: lid++, date, info: 'futures trade', asset: 'pf_xbtusd', contract: 'pf_xbtusd', old_balance: oud, new_balance: nieuw, new_average_entry_price: nieuw ? 81489 : null, trade_price: px, execution: ex, booking_uid: 'p' + lid }]; };
  const logs = [...uitvoering('2026-10-14T18:12:52', 0, -0.0092, 81489, 0, 0.3), ...uitvoering('2026-10-15T15:05:30', -0.0092, 0, 81000, 4.5, 0.3)];
  const SL = [plaats(Z('2026-10-14T18:13:30'), 'Buy', 82235)];
  // triggers: an array = Worker v22, 'v21' = old Worker (answers with the trades flow), 'fout' = rate limit
  const sync = (triggers, prep) => p.evaluate(async ([logs, triggers, prep]) => {
    window.__vragen = [];
    window.proxyCall = async (q) => { window.__vragen.push(q);
      if (q.action === 'open_positions') return { positions: [] };
      if (q.action === 'account_log') return { source: 'account_log', logs, _logDebug: { afgekapt: false } };
      if (q.action === 'triggers') { if (triggers === 'fout') throw new Error('Kraken triggers: apiLimitExceeded'); return triggers === 'v21' ? { source: 'position_updates', elements: [] } : { source: 'triggers', elements: triggers, _trigDebug: {} }; }
      return {}; };
    if (prep) new Function(prep)();
    const res = await syncExchange('kraken', { quiet: true });
    const k = T.filter(t => t.exchange === 'kraken');
    return { res, n: k.length, k: k[0] && { stop: k[0].stop, stopBron: k[0].stopBron, stopVerschoven: k[0].stopVerschoven, r: tradeROrNull(k[0]) }, vragen: window.__vragen };
  }, [logs, triggers, prep || '']);
  const vers = "T = []; TRASH = []; DB.save('kraken_weg', []); CONNS.kraken = { connected: true, apiKey: 'k', apiSecret: 's', evt: 1, syncFrom: '2026-10-01' };";
  const bestaand = (velden) => vers + `T.push({ ...sjFromTj(ExchangeAPI.kraken.levenslopenUitAccountLog(ExchangeAPI.kraken._logRegelsUitJson(${JSON.stringify(logs)})).trades[0]), id: 9001, ...${JSON.stringify(velden)} });`;

  r = await sync(SL, vers);
  ok('nieuwe trade krijgt stop 82.235 van Kraken', r.n === 1 && r.k.stop === 82235 && r.k.stopBron === 'kraken', JSON.stringify(r.k));
  ok('R-multiple nu berekend (geen streepje)', r.k.r != null && r.k.r > 0, String(r.k.r));
  const tv = r.vragen.filter(v => v.action === 'triggers');
  ok('één triggers-verzoek per sync, met het venster van de posities', tv.length === 1 && tv[0].startTime <= Z('2026-10-14T18:12:52') - 60e3 && tv[0].before > Z('2026-10-15T15:05:30'), JSON.stringify(tv.map(v => [v.startTime, v.before])));
  r = await sync(SL.concat(wijzig(Z('2026-10-14T20:00:00'), 'Buy', 82235, 81489)), vers);
  ok('naar break-even geschoven: stop 82.235, gemarkeerd als verschoven', r.k.stop === 82235 && r.k.stopVerschoven === true, JSON.stringify(r.k));
  r = await sync(SL, bestaand({ stop: 82000 }));
  // Denny 18-10: the exchange wins, like entry and exit; a stop you typed gives way to the one Kraken knows
  ok('Kraken wint van een zelf ingevulde stop', r.n === 1 && r.k.stop === 82235 && r.k.stopBron === 'kraken', JSON.stringify(r.k));
  r = await sync(SL, bestaand({ stop: 0 }));
  ok('lege stop van een bestaande trade wordt ingevuld', r.k.stop === 82235 && r.k.stopBron === 'kraken', JSON.stringify(r.k));
  r = await sync(SL, bestaand({ stop: 83000, stopBron: 'kraken' }));
  ok('stop van Kraken wordt bijgewerkt zolang de gebruiker hem niet aanpaste', r.k.stop === 82235 && r.k.stopBron === 'kraken', JSON.stringify(r.k));
  r = await sync(SL, bestaand({ stop: 0, stopBron: 'gebruiker' }));
  ok('ook een eerder met de hand gewiste stop: Kraken wint', r.k.stop === 82235 && r.k.stopBron === 'kraken', JSON.stringify(r.k));
  r = await sync([], bestaand({ stop: 82000 }));
  ok('kent Kraken geen stop, dan blijft je eigen stop staan', r.k.stop === 82000 && !r.k.stopBron, JSON.stringify(r.k));
  r = await sync('v21', vers);
  ok('Worker v21: sync slaagt, alleen zonder stop', r.res !== -1 && r.n === 1 && !(r.k.stop > 0), JSON.stringify(r));
  r = await sync('fout', vers);
  ok('fout bij triggers: trades komen toch binnen', r.res !== -1 && r.n === 1 && !(r.k.stop > 0), JSON.stringify(r).slice(0, 300));

  console.log('─── Bestaande historie (eenmalig) en een oude Worker ───');
  const geenNieuwe = "CONNS.kraken = { ...CONNS.kraken, log: 1, logVanaf: 0, stappen: ExchangeAPI.kraken._HERHAAL, lastSync: Date.now() }; const o = window.proxyCall; window.proxyCall = async q => q.action === 'account_log' ? { source: 'account_log', logs: [], _logDebug: { afgekapt: false } } : o(q);";
  r = await sync(SL, bestaand({ stop: 0 }) + geenNieuwe);
  ok('trades van vóór de update krijgen eenmalig hun stop', r.k.stop === 82235 && r.k.stopBron === 'kraken' && r.vragen.some(v => v.action === 'triggers'), JSON.stringify(r.k));
  ok('… en dat wordt onthouden', await p.evaluate(() => !!CONNS.kraken.stopsKlaar));
  r = await sync(SL, geenNieuwe);
  ok('daarna geen triggers-verzoek meer als er niets nieuws is', !r.vragen.some(v => v.action === 'triggers'), JSON.stringify(r.vragen.map(v => v.action)));
  r = await sync(SL, bestaand({ stop: 0 }) + geenNieuwe.replace("q.action === 'account_log'", "q.action === 'triggers' ? { source: 'triggers', elements: [], _trigDebug: { afgekapt: true } } : q.action === 'account_log'"));
  ok('afgekapte trigger-historie: niet als klaar onthouden', await p.evaluate(() => !CONNS.kraken.stopsKlaar));
  r = await sync('v21', vers);
  ok('Worker v21 wordt onthouden', await p.evaluate(() => +CONNS.kraken.trigOud > 0));
  r = await sync(SL);
  ok('… en de volgende sync vraagt het een dag niet meer', !r.vragen.some(v => v.action === 'triggers'), JSON.stringify(r.vragen.map(v => v.action)));
  r = await sync(SL, "CONNS.kraken.trigOud = Date.now() - 25 * 3600e3;");
  ok('na een dag opnieuw proberen (Worker inmiddels v22): stop komt binnen', r.vragen.some(v => v.action === 'triggers') && r.k.stop === 82235, JSON.stringify(r.k));

  console.log('─── Terugzetten uit de prullenbak (Denny 18-10: short 24-03 07:37) ───');
  // a trashed old-route row (other id, wrong numbers) keeps the position away; restoring it must bring the position back
  const oudeRij = "T.push({ ...sjFromTj(ExchangeAPI.kraken.levenslopenUitAccountLog(ExchangeAPI.kraken._logRegelsUitJson(" + JSON.stringify(logs) + ")).trades[0]), id: 9002, srcId: 'kraken_pos_PF_XBTUSD_" + (Z('2026-10-14T18:12:52') + 997) + "', pnl: -2.8, notes: 'mijn notitie' });";
  r = await sync(SL, vers + oudeRij + "trashDelete([9002]);");
  ok('weggegooid blijft weg', r.n === 0, JSON.stringify(r).slice(0, 200));
  r = await sync(SL, "trashRestore([9002]);");
  ok('teruggezet: de positie komt terug, met de juiste cijfers en de stop', r.n === 1 && r.k.stop === 82235, JSON.stringify(r).slice(0, 300));
  const terug = await p.evaluate(() => { const k = T.filter(t => t.exchange === 'kraken'); return { n: k.length, notes: k.map(t => t.notes).join('|'), pnl: k.map(t => t.pnl), inPrullenbak: TRASH.filter(t => t.exchange === 'kraken').length }; });
  ok('één rij, je notitie is meegekomen, P&L uit de account-log', terug.n === 1 && /mijn notitie/.test(terug.notes) && terug.pnl[0] !== -2.8, JSON.stringify(terug));
  r = await sync(SL);
  ok('een volgende sync laat hem staan', r.n === 1, String(r.n));
  // like the real Worker: the account-log only from `since`; a normal sync asks since the last sync, the position is older
  const alleenSinds = "CONNS.kraken = { ...CONNS.kraken, log: 1, logVanaf: 0, stappen: ExchangeAPI.kraken._HERHAAL, lastSync: Date.now() }; const o = window.proxyCall; window.proxyCall = async q => { const d = await o(q); if (q.action === 'account_log' && d && d.logs) d.logs = d.logs.filter(l => Date.parse(l.date) >= (+q.startTime || 0)); return d; };";
  r = await sync(SL, vers + oudeRij + "trashDelete([9002]);");
  r = await sync(SL, "trashRestore([9002]);" + alleenSinds);
  const vraagVan = (r.vragen.find(v => v.action === 'account_log') || {}).startTime;
  ok('na terugzetten vraagt de sync de account-log op vanaf die trade', vraagVan <= Z('2026-10-14T18:12:52'), String(vraagVan));
  const pnlTerug = await p.evaluate(() => T.filter(t => t.exchange === 'kraken').map(t => t.pnl));
  ok('… en de positie komt terug met de cijfers uit Kraken en de stop', r.n === 1 && r.k.stop === 82235 && pnlTerug[0] !== -2.8, JSON.stringify(pnlTerug));
  ok('daarna is de markering weg (geen oude startdatum bij elke sync)', await p.evaluate(() => !T.some(t => t.teruggezet)));

  console.log('─── Oude ids met milliseconden (van vóór 17-10) ───');
  // rows and the thrown-away memory from v1.10 carry ids in ms; since 17-10 the lifecycle id is in whole seconds
  const msId = 'kraken_pos_PF_XBTUSD_' + (Z('2026-10-14T18:12:52') + 768);
  r = await sync(SL, vers + `T.push({ ...sjFromTj(ExchangeAPI.kraken.levenslopenUitAccountLog(ExchangeAPI.kraken._logRegelsUitJson(${JSON.stringify(logs)})).trades[0]), id: 9003, srcId: '${msId}', notes: 'oud id' });`);
  const msRij = await p.evaluate(() => T.filter(t => t.exchange === 'kraken').map(t => ({ id: t.id, notes: t.notes, stop: t.stop })));
  ok('bestaande rij met een ms-id wordt bijgewerkt, niet vervangen door een kopie', msRij.length === 1 && msRij[0].id === 9003 && msRij[0].stop === 82235, JSON.stringify(msRij));
  r = await sync(SL, vers + `DB.save('kraken_weg', ['${msId}']);`);
  ok('weggegooid met een ms-id blijft weg', r.n === 0, String(r.n));
  r = await sync(SL, vers + `T.push({ ...sjFromTj(ExchangeAPI.kraken.levenslopenUitAccountLog(ExchangeAPI.kraken._logRegelsUitJson(${JSON.stringify(logs)})).trades[0]), id: 9004, srcId: '${msId}', dir: 'long' }); trashDelete([9004]);`);
  ok('weggegooide rij met een ms-id in de prullenbak houdt de positie weg', r.n === 0, String(r.n));

  // Denny 18-10: a broken old-route row ('long') and the real short share the id in whole seconds; the real one must win
  const levensloop = `ExchangeAPI.kraken.levenslopenUitAccountLog(ExchangeAPI.kraken._logRegelsUitJson(${JSON.stringify(logs)})).trades[0]`;
  r = await sync(SL, vers + `T.push({ ...sjFromTj(${levensloop}), id: 9005, srcId: '${msId}', notes: 'echte short' }); T.push({ ...sjFromTj(${levensloop}), id: 9006, srcId: '${msId.slice(0, -1)}7', dir: 'long', entry: 70331 }); trashDelete([9006]); trashRestore([9006]);`);
  const tweeRijen = await p.evaluate(() => T.filter(t => t.exchange === 'kraken').map(t => ({ id: t.id, dir: t.dir, notes: t.notes })));
  ok('kapotte rij met hetzelfde id (andere richting) neemt de positie niet over', tweeRijen.length === 1 && tweeRijen[0].id === 9005 && tweeRijen[0].dir === 'short', JSON.stringify(tweeRijen));

  console.log('─── Lopende positie (F4) ───');
  // only the opening in the account-log, the position still open at Kraken; its stop placed at the fill, later to break-even
  const alleenOpen = JSON.stringify(logs.slice(0, 2));
  const lopend = `const o2 = window.proxyCall; window.proxyCall = async q => q.action === 'open_positions' ? { positions: [{ symbol: 'PF_XBTUSD', side: 'short', size: 0.0092, price: 81489, fillTime: '1970-01-01T00:00:00.000Z' }] }
    : q.action === 'account_log' ? { source: 'account_log', logs: ${alleenOpen}, _logDebug: { afgekapt: false } } : o2(q);`;
  r = await sync(SL.concat(wijzig(Z('2026-10-14T20:00:00'), 'Buy', 82235, 81489)), vers + lopend);
  const open = await p.evaluate(() => T.filter(t => t.exchange === 'kraken').map(t => ({ status: t.status, stop: t.stop, bron: t.stopBron, v: t.stopVerschoven })));
  ok('lopende positie krijgt de oorspronkelijke stop van Kraken', open.length === 1 && open[0].status === 'open' && open[0].stop === 82235 && open[0].bron === 'kraken' && open[0].v === true, JSON.stringify(open));
  const tvOpen = r.vragen.filter(v => v.action === 'triggers');
  ok('nog steeds één triggers-verzoek, tot nu', tvOpen.length === 1 && tvOpen[0].before >= Date.now() - 6e4, JSON.stringify(tvOpen.map(v => [v.startTime, v.before])));
  r = await sync(SL, lopend.replace('o2', 'o3').replace('o2(q)', 'o3(q)') + "T.find(t => t.exchange === 'kraken').stop = 80000; T.find(t => t.exchange === 'kraken').stopBron = 'gebruiker';");
  const eigen = await p.evaluate(() => T.filter(t => t.exchange === 'kraken').map(t => ({ stop: t.stop, bron: t.stopBron })));
  ok('ook op de lopende positie wint Kraken', eigen[0].stop === 82235 && eigen[0].bron === 'kraken', JSON.stringify(eigen));

  console.log('─── Formulier ───');
  await sync(SL, vers);
  const form = await p.evaluate(() => { const t = T.find(x => x.exchange === 'kraken'); openForm(t.id);
    const el = document.getElementById('f_stop'), lbl = (el.closest('.field').querySelector('label') || {}).textContent || '';
    const ro = el.readOnly; el.value = '82100'; submitForm(t.id); return { lbl, ro, stop: t.stop, bron: t.stopBron }; });
  ok('formulier laat zien dat de stop van Kraken komt', /van Kraken/.test(form.lbl), form.lbl);
  ok('de stop van Kraken is vergrendeld, net als entry en exit', form.ro === true && form.stop === 82235 && form.bron === 'kraken', JSON.stringify(form));
  const vrij = await p.evaluate(() => { const t = T.find(x => x.exchange === 'kraken'); t.stop = 0; delete t.stopBron; openForm(t.id);
    const el = document.getElementById('f_stop'); const ro = el.readOnly; el.value = '82100'; submitForm(t.id); return { ro, stop: t.stop }; });
  ok('zonder stop van Kraken kun je hem zelf invullen', vrij.ro === false && vrij.stop === 82100, JSON.stringify(vrij));
  const zelfde = await p.evaluate(() => { const t = T.find(x => x.exchange === 'kraken'); t.stopBron = 'kraken'; t.stop = 82235; openForm(t.id); submitForm(t.id); return t.stopBron; });
  ok('opslaan zonder de stop te wijzigen laat de bron staan', zelfde === 'kraken', zelfde);
  await p.evaluate(async () => { const t = T.find(x => x.exchange === 'kraken'); t.stopVerschoven = true; persist(); await new Promise(r => setTimeout(r, 400)); });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  const na = await p.evaluate(() => { const t = T.find(x => x.exchange === 'kraken'); return t && { bron: t.stopBron, v: t.stopVerschoven, stop: t.stop }; });
  ok('stopBron en stopVerschoven overleven het herladen', na && na.bron === 'kraken' && na.v === true && na.stop === 82235, JSON.stringify(na));

  ok('geen JS-fouten', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log(`\n=== Kraken stop-loss: ${pass}/${pass + fail} ===`); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  ✗ crash: ' + String(e).split('\n')[0]); process.exit(1); });
