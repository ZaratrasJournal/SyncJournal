// Kraken: de account-log (CSV-export én, straks, JSON van /api/history/v3/account-log) wordt
// door één adapter-functie tot levenslopen gebouwd: ExchangeAPI.kraken.levenslopenUitAccountLog.
// Deel 1 toetst tegen Denny's echte export (tests/_fixtures/, gitignored; overgeslagen als hij
// ontbreekt) met een onafhankelijke reconstructie als referentie (tests/helpers/kraken-recon.js).
// Deel 2 zijn gerichte synthetische gevallen. Zie docs/opdracht-kraken-fix-2026-09-26.md §6.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const { reconstruct, compare } = require('./helpers/kraken-recon.js');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const bij = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 1e-6 : tol);
const APP = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');
const CSV = path.resolve('tests/_fixtures/kraken-account-log-2026-09-26.csv');
const csvText = (!process.env.SJ_GEEN_FIXTURES && fs.existsSync(CSV)) ? fs.readFileSync(CSV, 'utf8') : null;

// ── synthetische account-log-rijen in de vorm van de CSV-export ──
let nr = 0;
const rij = (o) => ({ uid: 'u' + (++nr), dateTime: o.dt, account: 'flex', type: o.type || 'futures trade', symbol: o.symbol, contract: o.contract || 'pf_xbtusd',
  change: String(o.change), 'new balance': String(o.nb), 'new average entry price': o.avg != null ? String(o.avg) : '', 'trade price': o.px != null ? String(o.px) : '',
  'mark price': '', 'funding rate': '', 'realized pnl': o.pnl != null ? String(o.pnl) : '', fee: o.fee != null ? String(o.fee) : '',
  'realized funding': o.funding != null ? String(o.funding) : '', collateral: '', 'liquidation fee': o.liqFee != null ? String(o.liqFee) : '', 'position uid': '' });
/* Eén uitvoering = positie-regel + cash-regel (in chronologische volgorde). o.kfee: fee met
   KFEE betaald → géén cash-regel. o.cashBal: lopend usd-saldo (niet relevant voor de keten). */
const uitvoering = (dt, change, nb, px, o = {}) => {
  const pnl = o.pnl || 0, fee = o.fee || 0, funding = o.funding || 0, liq = o.liqFee || 0;
  const pos = rij({ dt, symbol: o.contract || 'pf_xbtusd', contract: o.contract, change, nb, avg: o.avg, px, type: o.type });
  if (o.kfee) return [pos];
  const cash = rij({ dt, symbol: 'usd', contract: o.contract, change: o.cashChange != null ? o.cashChange : (pnl + funding - fee - liq), nb: 0, px, pnl, fee, funding, liqFee: liq, type: o.type });
  return [pos, cash];
};
const fundingRij = (dt, bedrag, contract) => rij({ dt, type: 'funding rate change', symbol: 'usd', contract: contract || 'pf_xbtusd', change: bedrag, nb: 0, funding: bedrag });
const desc = rows => rows.slice().reverse();   // zoals de export: nieuwste eerst

(async () => {
  const b = await chromium.launch(); const errs = [];
  async function open() {
    const ctx = await b.newContext({ timezoneId: 'Europe/Amsterdam' }); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
    p.on('dialog', d => d.accept());
    await p.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
    await p.goto(APP, { waitUntil: 'load' }); await p.waitForTimeout(600);
    await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
    await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(800);
    await p.evaluate(() => { try { hideWelcome() } catch (e) {} T = []; TRASH = []; persist(); persistTrash(); });
    return { ctx, p };
  }
  const bouw = (p, rows) => p.evaluate(rows => {
    const uit = ExchangeAPI.kraken.levenslopenUitAccountLog(ExchangeAPI.kraken._logRegelsUitCsv(rows));
    return { open: uit.open.length, waarschuwingen: uit.waarschuwingen, trades: uit.trades.map(t => ({
      id: t.id, pair: t.pair, dir: t.direction, entry: +t.entry, exit: +t.exit, qty: +t.positionSizeAsset, size: +t.positionSize,
      pnl: +t.pnl, fees: +t.fees, open: +t.openTime, close: +t.closeTime, date: t.date, time: t.time, notes: t.notes,
      steps: (t.fills || []).map(x => x.kind).join(','), n: (t.fills || []).length,
      tps: (t.tpLevels || []).map(x => ({ price: +x.price, pct: +x.pct, ts: x.ts, status: x.status })) })) };
  }, rows);
  const ams = (ms) => { const s = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms)); return { date: s.slice(0, 10), time: s.slice(11, 16) }; };

  console.log('─── Denny\'s echte account-log (107 posities, 413 fills) ───');
  if (csvText) {
    const { ctx, p } = await open();
    const ref = reconstruct(csvText);
    const r = await p.evaluate((t) => { const before = T.length; const n = sjImportCsvText(t, ''); return { n, added: T.length - before }; }, csvText);
    const lees = () => p.evaluate(() => T.filter(t => t.exchange === 'kraken').map(t => ({ id: t.id, srcId: t.srcId, date: t.date, time: t.time, pair: t.pair, dir: t.dir, entry: t.entry, exit: t.exit,
      size: t.size, qtyAsset: t.qtyAsset, pnl: t.pnl, fees: t.fees, openTime: t.openTime, closeTime: t.closeTime, status: t.status, notes: t.notes,
      fills: (t.fills || []).length, tps: (t.tps || []).map(x => ({ price: x.price, pct: x.pct, hit: x.hit, ts: x.ts })) })));
    const trades = await lees();
    ok(`import levert alle ${ref.positions.length} posities als trade`, r.n === ref.positions.length && trades.length === ref.positions.length, JSON.stringify(r));
    const cmp = compare(ref.positions, trades);
    console.log('  ' + cmp.summary);
    ok('missing 0, dir-mismatch 0, size-mismatch 0, pnl-mismatch 0, extra 0', cmp.missing === 0 && cmp.dirMis === 0 && cmp.sizeMis === 0 && cmp.pnlMis === 0 && cmp.extra === 0, cmp.lines.slice(0, 5).join(' | '));
    const somJ = trades.reduce((s, t) => s + (+t.pnl), 0);
    const somRef = ref.positions.reduce((s, p) => s + p.net + p.funding, 0);   // netto = gerealiseerd − fees + funding (trade-regels én funding rate change-regels)
    ok(`netto P&L ${somJ.toFixed(2)} = Σ realized pnl − Σ fee + Σ funding (${somRef.toFixed(2)})`, bij(somJ, somRef, 0.05), `${somJ.toFixed(4)} vs ${somRef.toFixed(4)}`);
    ok(`alle ${ref.fills} fills zijn stappen (Σ fills.length)`, trades.reduce((s, t) => s + t.fills, 0) === ref.fills, String(trades.reduce((s, t) => s + t.fills, 0)));
    ok('elke trade: openTime < closeTime, ≥2 stappen, gesloten', trades.every(t => +t.openTime < +t.closeTime && t.fills >= 2 && t.status === 'closed'), JSON.stringify(trades.filter(t => !(+t.openTime < +t.closeTime && t.fills >= 2)).slice(0, 2)));
    ok('datum en tijd zijn Amsterdam-tijd van het open-moment', trades.every(t => { const a = ams(+t.openTime); return t.date === a.date && t.time === a.time; }), JSON.stringify(trades.filter(t => { const a = ams(+t.openTime); return !(t.date === a.date && t.time === a.time); }).slice(0, 2)));
    const multi = ref.positions.filter(p => p.nCloses >= 2).length;
    ok(`${multi} posities met ≥2 sluitingen hebben ≥2 TP-niveaus (hit, met moment)`, trades.filter(t => t.tps.length >= 2).length === multi && trades.every(t => t.tps.every(x => x.hit && x.ts > 0)), String(trades.filter(t => t.tps.length >= 2).length));
    ok('TP-percentages tellen op tot 100', trades.every(t => bij(t.tps.reduce((s, x) => s + x.pct, 0), 100, 0.05)), JSON.stringify(trades.filter(t => !bij(t.tps.reduce((s, x) => s + x.pct, 0), 100, 0.05)).slice(0, 1)));
    ok('geen partial-data-notities: alle openingen staan in het bestand', trades.every(t => !t.notes), String(trades.filter(t => t.notes).length));
    ok('srcId-vorm kraken_pos_<CONTRACT>_<openTs> (zelfde als de API-route)', trades.every(t => new RegExp('^kraken_pos_PF_[A-Z]+_' + t.openTime + '$').test(t.srcId)), trades[0] && trades[0].srcId);
    const w = await p.evaluate((t) => { const uit = ExchangeAPI.kraken.levenslopenUitAccountLog(ExchangeAPI.kraken._logRegelsUitCsv((function () { const parse = (line) => { const out = []; let cur = '', inQ = false; for (const ch of line) { if (ch === '"') inQ = !inQ; else if (ch === ',' && !inQ) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map(v => v.trim()); }; const L = t.split('\n').filter(l => l.trim()); const H = parse(L[0]); return L.slice(1).map(l => { const v = parse(l); const r = {}; H.forEach((h, i) => r[h] = v[i] || ''); return r; }); })())); return { w: uit.waarschuwingen, open: uit.open.length }; }, csvText);
    ok('0 waarschuwingen (elke cash-regel sluitend, keten sluitend) en 0 open levenslopen', w.w.length === 0 && w.open === 0, JSON.stringify(w.w.slice(0, 3)));
    // steekproeven uit de opdracht (Kraken Pro toont UTC+1; hier Amsterdam)
    const mei20 = trades.find(t => t.date === '2026-05-20' && t.time === '10:05');
    ok('20 mei: long 77241 → twee sluitingen (77523, 77329), 3 stappen, +1,95', !!mei20 && mei20.dir === 'long' && bij(+mei20.entry, 77241, 0.5) && mei20.fills === 3 && mei20.tps.length === 2 && bij(+mei20.pnl, 1.95, 0.05), JSON.stringify(mei20));
    const jun6 = trades.find(t => t.date === '2026-06-06');
    ok('6 juni: short 60504 → 60997, vier sluitingen om 14:07, −12,83', !!jun6 && jun6.dir === 'short' && bij(+jun6.entry, 60504.44, 0.5) && jun6.tps.length === 4 && bij(+jun6.pnl, -12.83, 0.05) && ams(+jun6.closeTime).time === '14:07', JSON.stringify(jun6));
    const r2 = await p.evaluate((t) => sjImportCsvText(t, ''), csvText);
    const na = await lees();
    ok('tweede keer inlezen → 0 nieuw, nog steeds evenveel trades', r2 === 0 && na.length === trades.length, `${r2} / ${na.length}`);
    ok('en de trades zijn na de tweede import onveranderd', JSON.stringify(na) === JSON.stringify(trades));
    await ctx.close();
  } else console.log('  ⏭ tests/_fixtures/kraken-account-log-2026-09-26.csv ontbreekt in deze kloon — overgeslagen');

  console.log('─── Vier sluitingen in één seconde ───');
  {
    const { ctx, p } = await open();
    const rows = [
      ...uitvoering('2026-06-06 10:21:47', -0.02, -0.02, 60500, { fee: 0.5, avg: 60500 }),
      ...uitvoering('2026-06-06 12:07:02', 0.004, -0.016, 60993, { pnl: -1.972, fee: 0.1 }),
      ...uitvoering('2026-06-06 12:07:02', 0.002, -0.014, 60994, { pnl: -0.988, fee: 0.05 }),
      ...uitvoering('2026-06-06 12:07:02', 0.012, -0.002, 60995, { pnl: -5.94, fee: 0.3 }),
      ...uitvoering('2026-06-06 12:07:02', 0.002, 0, 60997, { pnl: -0.994, fee: 0.05 }),
    ];
    const a = await bouw(p, rows), d = await bouw(p, desc(rows));
    ok('één short met open + vier sluitingen', a.trades.length === 1 && a.trades[0].dir === 'short' && a.trades[0].steps === 'open,close,close,close,close', JSON.stringify(a.trades[0] && a.trades[0].steps));
    ok('netto = Σ pnl − Σ fee = −9,894 − 1,0 = −10,894', a.trades.length === 1 && bij(a.trades[0].pnl, -10.894, 1e-6), a.trades[0] && a.trades[0].pnl);
    ok('vier TP-niveaus, elk met het sluitmoment, samen 100%', a.trades[0].tps.length === 4 && a.trades[0].tps.every(x => x.ts === Date.parse('2026-06-06T12:07:02Z') && x.status === 'hit') && bij(a.trades[0].tps.reduce((s, x) => s + x.pct, 0), 100, 0.01), JSON.stringify(a.trades[0].tps));
    ok('in TP-volgorde van het bestand: 60993, 60994, 60995, 60997', a.trades[0].tps.map(x => x.price).join(',') === '60993,60994,60995,60997', a.trades[0].tps.map(x => x.price).join(','));
    ok('nieuwste-eerst aangeleverd (zoals de export): identiek resultaat', JSON.stringify(d) === JSON.stringify(a), JSON.stringify(d.trades[0] && d.trades[0].tps));
    ok('tijd in Amsterdam: open 12:21, dag 2026-06-06', a.trades[0].date === '2026-06-06' && a.trades[0].time === '12:21', a.trades[0].date + ' ' + a.trades[0].time);
    ok('geen waarschuwingen', a.waarschuwingen.length === 0, JSON.stringify(a.waarschuwingen));
    await ctx.close();
  }

  console.log('─── Fee met KFEE betaald: positie-regel zonder cash-regel ───');
  {
    const { ctx, p } = await open();
    const rows = [
      ...uitvoering('2025-12-19 07:25:03', -0.0005, -0.0005, 90000, { kfee: true, avg: 90000 }),
      ...uitvoering('2025-12-19 07:25:03', -0.0007, -0.0012, 90010, { kfee: true, avg: 90005.8 }),
      ...uitvoering('2025-12-19 07:25:03', -0.0018, -0.003, 90020, { fee: 0.08, avg: 90014.3 }),
      ...uitvoering('2025-12-19 09:00:00', 0.003, 0, 89000, { pnl: 3.04, fee: 0.13 }),
    ];
    const a = await bouw(p, rows);
    ok('de wezen zijn gewone stappen: open, add, add, close', a.trades.length === 1 && a.trades[0].steps === 'open,add,add,close', JSON.stringify(a.trades[0] && a.trades[0].steps));
    ok('fee alleen van de regels mét cash-regel: 0,21', bij(a.trades[0].fees, 0.21, 1e-9) && bij(a.trades[0].pnl, 3.04 - 0.21, 1e-9), JSON.stringify({ fees: a.trades[0].fees, pnl: a.trades[0].pnl }));
    ok('qty 0,003 en entry het gewogen gemiddelde', bij(a.trades[0].qty, 0.003, 1e-9) && bij(a.trades[0].entry, (0.0005 * 90000 + 0.0007 * 90010 + 0.0018 * 90020) / 0.003, 0.01), JSON.stringify({ qty: a.trades[0].qty, entry: a.trades[0].entry }));
    ok('geen waarschuwingen', a.waarschuwingen.length === 0, JSON.stringify(a.waarschuwingen));
    await ctx.close();
  }

  console.log('─── Omkering long → short in één uitvoering ───');
  {
    const { ctx, p } = await open();
    const rows = [
      ...uitvoering('2026-01-10 10:00:00', 0.003, 0.003, 80000, { fee: 0.12, avg: 80000 }),
      ...uitvoering('2026-01-10 11:00:00', -0.005, -0.002, 81000, { pnl: 3, fee: 0.2 }),   // sluit 0,003 long, opent 0,002 short
      ...uitvoering('2026-01-10 12:00:00', 0.002, 0, 80500, { pnl: 1, fee: 0.08 }),
    ];
    const a = await bouw(p, rows);
    ok('twee trades: de long tot de omkering, de short vanaf de omkering', a.trades.length === 2 && a.trades[0].dir === 'long' && a.trades[1].dir === 'short' && a.trades[0].close === a.trades[1].open, JSON.stringify(a.trades.map(t => [t.dir, t.open, t.close])));
    ok('long: open + close, pnl 3 en 3/5 van de omkeer-fee (0,12 + 0,12)', a.trades[0].steps === 'open,close' && bij(a.trades[0].pnl, 3 - 0.24, 1e-9), JSON.stringify(a.trades[0]));
    ok('short: open (0,002 @ 81000) + close, pnl 1 − 0,08 − 2/5 × 0,2', a.trades[1].steps === 'open,close' && bij(a.trades[1].entry, 81000, 1e-6) && bij(a.trades[1].qty, 0.002, 1e-9) && bij(a.trades[1].pnl, 1 - 0.08 - 0.08, 1e-9), JSON.stringify(a.trades[1]));
    ok('verschillende ids', a.trades[0].id !== a.trades[1].id);
    await ctx.close();
  }

  console.log('─── Liquidatie, funding binnen en buiten de levensloop ───');
  {
    const { ctx, p } = await open();
    const rows = [
      ...uitvoering('2026-02-01 10:00:00', -0.003, -0.003, 80000, { fee: 0.1, avg: 80000 }),
      fundingRij('2026-02-01 12:00:00', -0.03),                    // binnen: telt mee
      ...uitvoering('2026-02-01 13:00:00', 0.003, 0, 86000, { pnl: -18, fee: 0.1, type: 'futures liquidation', funding: -0.01 }),
      fundingRij('2026-02-01 16:00:00', -0.5),                     // erna, geen positie: telt niet mee
      fundingRij('2026-02-01 12:30:00', 0.02, 'pf_ethusd'),        // ander contract: telt niet mee
    ];
    const a = await bouw(p, rows);
    ok('de sluiting is een liquidatie-stap', a.trades.length === 1 && a.trades[0].steps === 'open,liq', JSON.stringify(a.trades[0] && a.trades[0].steps));
    ok('netto = −18 − 0,2 − 0,01 (funding op de regel) − 0,03 (funding-boeking binnen) = −18,24', bij(a.trades[0].pnl, -18.24, 1e-9), String(a.trades[0].pnl));
    ok('een liquidatie-sluiting is toch een gehaald niveau in de TP-lijst', a.trades[0].tps.length === 1 && a.trades[0].tps[0].status === 'hit');
    await ctx.close();
  }

  console.log('─── Opening buiten het bestand, niet-sluitende cash-regel, lege invoer ───');
  {
    const { ctx, p } = await open();
    const rows = [
      ...uitvoering('2026-03-01 10:00:00', 0.001, 0.003, 70100, { fee: 0.05, avg: 70050 }),   // keten begint op 0,002: opening ontbreekt
      ...uitvoering('2026-03-01 11:00:00', -0.003, 0, 70500, { pnl: 1.35, fee: 0.15 }),
    ];
    const a = await bouw(p, rows);
    ok('levensloop start met wat er al stond (synthetische opening op de gemiddelde instap)', a.trades.length === 1 && a.trades[0].steps === 'open,add,close' && bij(a.trades[0].qty, 0.003, 1e-9), JSON.stringify(a.trades[0]));
    ok('met de partial-data-notitie', /Partial data/.test(a.trades[0].notes), a.trades[0].notes);
    const scheef = await bouw(p, [
      ...uitvoering('2026-03-02 10:00:00', 0.001, 0.001, 70000, { fee: 0.05, avg: 70000 }),
      ...uitvoering('2026-03-02 11:00:00', -0.001, 0, 70500, { pnl: 0.5, fee: 0.05, cashChange: 0.9 }),   // change ≠ pnl − fee
    ]);
    ok('een cash-regel die niet sluit geeft een waarschuwing, de trade komt wel', scheef.trades.length === 1 && scheef.waarschuwingen.length === 1 && /niet sluitend/.test(scheef.waarschuwingen[0]), JSON.stringify(scheef.waarschuwingen));
    const leeg = await bouw(p, []);
    ok('geen regels is geen fout', leeg.trades.length === 0 && leeg.open === 0 && leeg.waarschuwingen.length === 0);
    const halfOpen = await bouw(p, uitvoering('2026-03-03 10:00:00', 0.001, 0.001, 70000, { fee: 0.05, avg: 70000 }));
    ok('een positie die nog loopt wordt geen trade maar staat in open', halfOpen.trades.length === 0 && halfOpen.open === 1);
    await ctx.close();
  }

  console.log('─── JSON van /api/history/v3/account-log geeft dezelfde trades als de CSV ───');
  {
    const { ctx, p } = await open();
    const csvRows = [
      ...uitvoering('2026-04-01 10:00:00', 0.002, 0.002, 75000, { fee: 0.1, avg: 75000 }),
      ...uitvoering('2026-04-01 11:00:00', -0.001, 0.001, 75500, { pnl: 0.5, fee: 0.05 }),
      ...uitvoering('2026-04-01 11:00:00', -0.001, 0, 75600, { pnl: 0.6, fee: 0.05, funding: -0.02 }),
    ];
    // JSON: cash-regel vóór de positie-regel (lager id), koppeling op execution
    let id = 100; const logs = [];
    const paar = (dt, oldB, newB, px, o) => {
      const ex = 'exec-' + (id);
      logs.push({ id: id++, date: dt.replace(' ', 'T') + 'Z', info: 'futures trade', asset: 'usd', contract: 'pf_xbtusd', old_balance: 1000, new_balance: 1000 + (o.pnl || 0) + (o.funding || 0) - (o.fee || 0), trade_price: px, realized_pnl: o.pnl || 0, fee: o.fee || 0, realized_funding: o.funding || 0, execution: ex, booking_uid: 'b' + id });
      logs.push({ id: id++, date: dt.replace(' ', 'T') + 'Z', info: 'futures trade', asset: 'pf_xbtusd', contract: 'pf_xbtusd', old_balance: oldB, new_balance: newB, new_average_entry_price: o.avg || null, trade_price: px, execution: ex, booking_uid: 'b' + id });
    };
    paar('2026-04-01 10:00:00', 0, 0.002, 75000, { fee: 0.1, avg: 75000 });
    paar('2026-04-01 11:00:00', 0.002, 0.001, 75500, { pnl: 0.5, fee: 0.05 });
    paar('2026-04-01 11:00:00', 0.001, 0, 75600, { pnl: 0.6, fee: 0.05, funding: -0.02 });
    const a = await bouw(p, csvRows);
    const j = await p.evaluate(logs => { const uit = ExchangeAPI.kraken.levenslopenUitAccountLog(ExchangeAPI.kraken._logRegelsUitJson(logs)); return { w: uit.waarschuwingen, trades: uit.trades.map(t => ({ id: t.id, dir: t.direction, entry: +t.entry, exit: +t.exit, qty: +t.positionSizeAsset, pnl: +t.pnl, fees: +t.fees, open: +t.openTime, close: +t.closeTime, steps: (t.fills || []).map(x => x.kind).join(','), tps: (t.tpLevels || []).map(x => [+x.price, +x.pct, x.ts]) })) }; }, logs);
    const kern = t => ({ id: t.id, dir: t.dir, entry: t.entry, exit: t.exit, qty: t.qty, pnl: t.pnl, fees: t.fees, open: t.open, close: t.close, steps: t.steps, tps: t.tps.map(x => Array.isArray(x) ? x : [x.price, x.pct, x.ts]) });
    ok('zelfde id, richting, prijzen, P&L, stappen en TP-niveaus', JSON.stringify(a.trades.map(kern)) === JSON.stringify(j.trades.map(kern)), JSON.stringify(a.trades.map(kern)) + ' vs ' + JSON.stringify(j.trades.map(kern)));
    ok('JSON: geen waarschuwingen (koppeling op execution, identiteit sluit)', j.w.length === 0, JSON.stringify(j.w));
    ok('netto 1,1 − 0,2 − 0,02 = 0,88', bij(j.trades[0].pnl, 0.88, 1e-9), String(j.trades[0] && j.trades[0].pnl));
    await ctx.close();
  }

  console.log('─── Doorgifte naar de journal: TP-momenten blijven staan ───');
  {
    const { ctx, p } = await open();
    const rows = [
      ...uitvoering('2026-05-01 10:00:00', 0.002, 0.002, 75000, { fee: 0.1, avg: 75000 }),
      ...uitvoering('2026-05-01 11:00:00', -0.001, 0.001, 75500, { pnl: 0.5, fee: 0.05 }),
      ...uitvoering('2026-05-01 12:00:00', -0.001, 0, 75600, { pnl: 0.6, fee: 0.05 }),
    ];
    const header = Object.keys(rows[0]);
    const csv = [header.join(','), ...rows.map(r => header.map(h => r[h]).join(','))].join('\n');
    const n = await p.evaluate(t => sjImportCsvText(t, ''), csv);
    const t = (await p.evaluate(() => T.filter(t => t.exchange === 'kraken').map(t => ({ srcId: t.srcId, date: t.date, time: t.time, tps: t.tps, fills: (t.fills || []).length, qtyAsset: t.qtyAsset, size: t.size }))))[0];
    ok('één trade, via de gedeelde brug, met stappen en asset-hoeveelheid', n === 1 && !!t && t.fills === 3 && bij(t.qtyAsset, 0.002, 1e-9) && bij(+t.size, 150, 0.01), JSON.stringify(t));
    ok('beide TP-niveaus hit, met hun moment (ts) — voor de tijdlijn en "tot 1e TP"', !!t && t.tps.length === 2 && t.tps.every(x => x.hit && +x.ts > 0) && t.tps[0].ts === Date.parse('2026-05-01T11:00:00Z'), JSON.stringify(t && t.tps));
    await ctx.close();
  }

  ok('geen JS-errors totaal', errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));
  console.log(`\n=== Kraken account-log: ${pass}/${pass + fail}${csvText ? '' : ' · echte export overgeslagen (fixture niet in deze kloon)'} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
