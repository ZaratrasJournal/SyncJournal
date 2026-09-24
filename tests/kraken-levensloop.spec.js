// Kraken: één positie-levensloop = één trade (model B).
// Bron: Kraken Futures docs, GET /api/history/v3/positions (PositionUpdate), gelezen 22-09-2026:
//   positionChange  open | close | increase | decrease | reverse | noChange | unknown
//   tradeType       userExecution | liquidation | partialLiquidation | assignment | unwind
//   updateReason    trade | fundingRealisation | settlement
//   per event       oldPosition, newPosition, executionPrice, executionSize, executionUid,
//                   realizedPnL, fee, realizedFunding, fillTime (mag null zijn), timestamp
// Toets: Denny's echte Kraken-account-log (tests/_fixtures/kraken-export.csv, 2437 regels)
// wordt omgezet naar gebeurtenissen en moet dezelfde levenslopen opleveren als een
// onafhankelijke telling op die CSV.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
let skipped = 0; const skip = n => { skipped++; console.log('  ⏭ ' + n + ' — fixture niet in deze kloon, overgeslagen'); };
const bij = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 1e-6 : tol);
const APP = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');
const CSV = path.resolve('tests/_fixtures/kraken-export.csv');

// ── de echte account-log omzetten naar PositionUpdate-gebeurtenissen ──
function uitCsv() {
  if (process.env.SJ_GEEN_FIXTURES || !fs.existsSync(CSV)) return null;
  const L = fs.readFileSync(CSV, 'utf8').trim().split(/\r?\n/);
  const H = L[0].split(','), i = n => H.indexOf(n);
  const R = L.slice(1).map(l => l.split(','));
  const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
  // de P&L staat op de valutaregel van dezelfde uitvoering, niet op de positieregel
  /* Meerdere uitvoeringen kunnen in dezelfde seconde vallen. De valutaregels staan in
     dezelfde volgorde als de positieregels, dus koppelen we ze op volgorde binnen die
     seconde in plaats van ze bij elkaar op te tellen. */
  const geld = {};
  R.filter(r => r[i('contract')] && r[i('symbol')] !== r[i('contract')]).forEach(r => {
    const k = r[i('dateTime')] + '|' + r[i('contract')];
    (geld[k] || (geld[k] = [])).push({ pnl: num(r[i('realized pnl')]), fee: num(r[i('fee')]), funding: num(r[i('realized funding')]) });
  });
  const beurt = {};
  const pos = R.filter(r => r[i('contract')] && r[i('symbol')] === r[i('contract')])
    .sort((a, b) => a[i('dateTime')].localeCompare(b[i('dateTime')]));
  const stand = {}; const events = []; let n = 0;
  for (const r of pos) {
    const sym = r[i('contract')], ch = num(r[i('change')]), nb = num(r[i('new balance')]);
    const ts = +new Date(r[i('dateTime')].replace(' ', 'T') + 'Z');
    const oud = stand[sym] || 0; stand[sym] = nb;
    const gk = r[i('dateTime')] + '|' + sym; const bi = (beurt[gk] = (beurt[gk] || 0) + 1) - 1;
    const g = (geld[gk] || [])[bi] || { pnl: 0, fee: 0, funding: 0 };
    const wissel = Math.abs(nb) < 1e-12 ? 'close' : Math.abs(oud) < 1e-12 ? 'open' : (Math.abs(nb) > Math.abs(oud) ? 'increase' : 'decrease');
    events.push({ uid: 'u' + (n++), timestamp: ts, event: { PositionUpdate: {
      accountUid: 'a', tradeable: sym, oldPosition: String(oud), newPosition: String(nb),
      oldAverageEntryPrice: null, newAverageEntryPrice: r[i('new average entry price')] || '0',
      fillTime: ts, fee: String(g.fee), feeCurrency: 'USD', realizedPnL: String(g.pnl),
      realizedFunding: String(g.funding), positionChange: wissel, executionUid: 'e' + n,
      executionPrice: r[i('trade price')] || '0', executionSize: String(Math.abs(nb - oud) || Math.abs(ch)),
      tradeType: 'userExecution', timestamp: ts, updateReason: 'trade' } } });
  }
  // onafhankelijke telling van de levenslopen op dezelfde rijen
  const st2 = {}; const loops = [];
  for (const e of events) {
    const u = e.event.PositionUpdate, sym = u.tradeable, nb = parseFloat(u.newPosition);
    const s = st2[sym] || (st2[sym] = { n: 0, pnl: 0, fee: 0, fund: 0, begin: e.timestamp });
    s.n++; s.pnl += parseFloat(u.realizedPnL); s.fee += Math.abs(parseFloat(u.fee)); s.fund += parseFloat(u.realizedFunding);
    if (Math.abs(nb) < 1e-12) { loops.push({ sym, stappen: s.n, netto: s.pnl - s.fee + s.fund, begin: s.begin, eind: e.timestamp }); delete st2[sym]; }
  }
  return { events, loops };
}
const ECHT = uitCsv();

// ── synthetische gebeurtenissen voor de gerichte gevallen ──
const ev = (o) => ({ uid: 'u' + (o.ts), timestamp: o.ts, event: { PositionUpdate: {
  accountUid: 'a', tradeable: o.sym || 'PF_XBTUSD', oldPosition: String(o.oud), newPosition: String(o.nieuw),
  newAverageEntryPrice: String(o.avg || 0), fillTime: o.fillTime != null ? o.fillTime : o.ts,
  fee: String(o.fee || 0), feeCurrency: 'USD', realizedPnL: String(o.pnl || 0), realizedFunding: String(o.funding || 0),
  positionChange: o.wissel, executionUid: 'e' + o.ts, executionPrice: String(o.px || 0), executionSize: String(o.sz || 0),
  tradeType: o.soort || 'userExecution', timestamp: o.ts, updateReason: o.reden || 'trade' } } });

(async () => {
  const b = await chromium.launch(); const errs = [];
  async function open() {
    const ctx = await b.newContext(); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
    p.on('dialog', d => d.accept());
    await p.route('**/*', r => /^https?:/.test(r.request().url()) ? r.abort() : r.continue());
    await p.addInitScript(() => localStorage.setItem('sj_welcomed', 'true'));
    await p.goto(APP, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1200);
    await p.evaluate(() => { T = []; TRASH = []; });
    return { ctx, p };
  }
  const bouw = (p, events) => p.evaluate(e => ExchangeAPI.kraken._krLevenslopen(e).map(t => ({
    id: t.id, pair: t.pair, dir: t.direction, entry: +t.entry, exit: +t.exit, qty: +t.positionSizeAsset,
    pnl: +t.pnl, fees: +t.fees, open: +t.openTime, close: +t.closeTime,
    steps: (t.fills || []).map(x => x.kind).join(','), n: (t.fills || []).length })), events);
  // de proxy nabootsen: met of zonder gebeurtenissen
  const server = (p, antwoord) => p.evaluate(a => {
    window.__KR = a; window.__KRcalls = [];
    window.fetch = async (url, init) => {
      const body = JSON.parse(init.body);
      window.__KRcalls.push({ action: body.action, startTime: +body.startTime || 0, withEvents: body.withEvents === true });
      const d = body.action === 'trades' ? window.__KR
        : body.action === 'test' ? { success: true, balance: '100' }
        : body.action === 'open_positions' ? { positions: [] } : {};
      return { ok: true, status: 200, json: async () => d, text: async () => JSON.stringify(d) };
    };
    CONNS.kraken = { connected: true, apiKey: 'k', apiSecret: 's', lastSync: 0, syncFrom: '2026-01-01' }; persistConns();
  }, antwoord);

  console.log('─── De echte account-log als gebeurtenissen ───');
  if (ECHT) {
    const { ctx, p } = await open();
    const t = await bouw(p, ECHT.events);
    ok(`${ECHT.events.length} gebeurtenissen worden ${ECHT.loops.length} levenslopen`, t.length === ECHT.loops.length, `${t.length} vs ${ECHT.loops.length}`);
    ok('en dat zijn er veel minder dan er sluitingen zijn', t.length < ECHT.events.length / 2, `${t.length} vs ${ECHT.events.length}`);
    const somT = t.reduce((a, x) => a + x.pnl, 0), somV = ECHT.loops.reduce((a, l) => a + l.netto, 0);
    ok('Σ P&L = Σ realizedPnL − fees + funding over dezelfde gebeurtenissen', bij(somT, somV, 0.01), `${somT.toFixed(4)} vs ${somV.toFixed(4)}`);
    ok('elke levensloop begint en eindigt op dezelfde gebeurtenis als de onafhankelijke telling',
      ECHT.loops.every(l => t.some(x => x.open === l.begin && x.close === l.eind)),
      JSON.stringify(ECHT.loops.filter(l => !t.some(x => x.open === l.begin && x.close === l.eind)).slice(0, 2)));
    ok('elke trade heeft stappen met minstens één afbouw', t.every(x => x.n >= 1 && /close|liq/.test(x.steps)), JSON.stringify(t.filter(x => !/close|liq/.test(x.steps)).slice(0, 2)));
    ok('er zitten posities met meerdere afbouwstappen tussen', t.some(x => (x.steps.match(/close/g) || []).length >= 2), JSON.stringify(t.map(x => x.steps).slice(0, 4)));
    ok('sleutels zijn uniek', new Set(t.map(x => x.id)).size === t.length);
    ok('entry, exit en size zijn gevuld', t.every(x => x.entry > 0 && x.exit > 0 && x.qty > 0), JSON.stringify(t.filter(x => !(x.entry > 0 && x.exit > 0 && x.qty > 0)).slice(0, 2)));
    await ctx.close();
  } else skip('de echte Kraken-account-log');

  console.log('─── Wat Kraken zelf per gebeurtenis zegt ───');
  {
    const { ctx, p } = await open();
    const basis = [
      ev({ ts: 1000, oud: 0, nieuw: 0.003, wissel: 'open', px: 80000, sz: 0.003, fee: 0.1 }),
      ev({ ts: 2000, oud: 0.003, nieuw: 0.001, wissel: 'decrease', px: 81000, sz: 0.002, fee: 0.05, pnl: 2 }),
      ev({ ts: 2500, oud: 0.001, nieuw: 0.001, wissel: 'noChange', reden: 'fundingRealisation', funding: -0.03 }),
      ev({ ts: 3000, oud: 0.001, nieuw: 0, wissel: 'close', px: 82000, sz: 0.001, fee: 0.03, pnl: 2 }),
    ];
    const t = await bouw(p, basis);
    ok('één levensloop met open, af, af — de fundingboeking is geen stap', t.length === 1 && t[0].steps === 'open,close,close' && t[0].n === 3, JSON.stringify(t));
    // funding wordt niet apart bewaard (migrateOldTrade laat onbekende velden vallen), maar
    // zit wel in de P&L: 4 bruto − 0,18 fees − 0,03 funding = 3,79
    ok('maar de funding telt wél mee in de P&L: 4 − 0,18 − 0,03 = 3,79', bij(t[0].pnl, 3.79, 1e-9), JSON.stringify(t[0]));
    const liq = await bouw(p, [
      ev({ ts: 1000, oud: 0, nieuw: -0.003, wissel: 'open', px: 80000, sz: 0.003, fee: 0.1 }),
      ev({ ts: 3000, oud: -0.003, nieuw: 0, wissel: 'close', px: 86000, sz: 0.003, fee: 0.1, pnl: -18, soort: 'liquidation' }),
    ]);
    ok('een liquidatie krijgt het eigen label', liq.length === 1 && liq[0].steps === 'open,liq', JSON.stringify(liq[0] && liq[0].steps));
    ok('en de short is als short herkend', liq[0] && liq[0].dir === 'short', JSON.stringify(liq[0] && liq[0].dir));
    const heropen = await bouw(p, [...basis,
      ev({ ts: 4000, oud: 0, nieuw: 0.002, wissel: 'open', px: 85000, sz: 0.002, fee: 0.08 }),
      ev({ ts: 5000, oud: 0.002, nieuw: 0, wissel: 'close', px: 86000, sz: 0.002, fee: 0.08, pnl: 2 })]);
    ok('opnieuw openen op hetzelfde instrument wordt een tweede trade', heropen.length === 2 && heropen[1].id !== heropen[0].id, JSON.stringify(heropen.map(x => x.id)));
    const volgorde = await bouw(p, [...basis].reverse());
    ok('in omgekeerde volgorde aangeleverd: zelfde uitkomst', JSON.stringify(volgorde) === JSON.stringify(t), JSON.stringify(volgorde));
    await ctx.close();
  }

  console.log('─── Oude proxy: alles blijft zoals het was ───');
  {
    const { ctx, p } = await open();
    const oudeVorm = { source: 'position_updates', trades: [
      { fill_id: 'PF_XBTUSD_1700_long', pair_clean: 'BTC/USD', symbol: 'PF_XBTUSD', direction: 'long', entry_price: '80000', exit_price: '81000', size: '0.002', pnl: '2', fee: 0.05, funding: 0, fillTime: new Date(2000).toISOString(), status: 'closed', tpLevels: [], originalSizeAsset: '0.002' },
    ] };
    await server(p, oudeVorm);
    const n = await p.evaluate(() => syncExchange('kraken', { quiet: true }));
    const r = await p.evaluate(() => ({ n: T.length, ids: T.map(t => t.srcId), evt: (CONNS.kraken || {}).evt }));
    ok('zonder gebeurtenissen loopt het oude pad gewoon door', n === 1 && r.n === 1 && r.ids[0] === 'kraken_PF_XBTUSD_1700_long', JSON.stringify(r));
    ok('en er wordt niets opnieuw opgehaald', !r.evt, JSON.stringify(r.evt));
    await ctx.close();
  }

  console.log('─── Nieuwe proxy: de oude rij gaat op in zijn levensloop ───');
  {
    const { ctx, p } = await open();
    const events = [
      ev({ ts: 1000, oud: 0, nieuw: 0.003, wissel: 'open', px: 80000, sz: 0.003, fee: 0.1 }),
      ev({ ts: 2000, oud: 0.003, nieuw: 0.001, wissel: 'decrease', px: 81000, sz: 0.002, fee: 0.05, pnl: 2 }),
      ev({ ts: 3000, oud: 0.001, nieuw: 0, wissel: 'close', px: 82000, sz: 0.001, fee: 0.03, pnl: 2 }),
    ];
    await server(p, { source: 'position_updates', trades: [], events });
    // de journal bevat al een rij uit het oude pad, met een notitie erop
    await p.evaluate(() => { T = [{ id: 1, exchange: 'kraken', srcId: 'kraken_oud1', status: 'closed', kind: 'live', pair: 'BTC/USD', dir: 'long',
      date: '1970-01-01', time: '01:00', openTime: '1000', closeTime: '2000', entry: 80000, exit: 81000, pnl: 1.95, notes: 'mijn notitie', tags: ['tp1'],
      tps: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] }]; persist(); });
    const n = await p.evaluate(() => syncExchange('kraken', { quiet: true }));
    const r = await p.evaluate(() => ({ n: T.length, ids: T.map(t => t.srcId), notes: T[0] && T[0].notes, tags: T[0] && T[0].tags, pnl: T[0] && +T[0].pnl, steps: T[0] && (T[0].fills || []).length, evt: (CONNS.kraken || {}).evt, haal: window.__KRcalls.filter(c => c.action === 'trades') }));
    ok('de levensloop komt binnen als één trade met zijn stappen', n === 1 && r.n === 1 && /^kraken_pos_/.test(r.ids[0]) && r.steps === 3, JSON.stringify(r));
    ok('de oude rij is erin opgegaan, met notitie en label', r.notes === 'mijn notitie' && (r.tags || []).includes('tp1'), JSON.stringify({ notes: r.notes, tags: r.tags }));
    ok('de P&L is die van de hele positie', bij(r.pnl, 4 - 0.18, 1e-9), JSON.stringify(r.pnl));
    ok('de proxy-upgrade is één keer opgemerkt, en de oudere historie is er meteen bij gehaald',
      r.evt === 1 && r.haal.length === 2 && r.haal[1].startTime < r.haal[0].startTime, JSON.stringify({ evt: r.evt, haal: r.haal }));
    ok('en we vragen er expliciet om — zo krijgt de oude journal ze niet ongevraagd',
      r.haal.every(c => c.withEvents === true), JSON.stringify(r.haal));
    const n2 = await p.evaluate(() => { window.__KRcalls = []; return syncExchange('kraken', { quiet: true }); });
    const r2 = await p.evaluate(() => ({ n: T.length, haal: window.__KRcalls.filter(c => c.action === 'trades').length }));
    ok('een tweede sync voegt niets toe en haalt de historie niet nóg eens op', n2 === 0 && r2.n === 1 && r2.haal === 1, JSON.stringify(r2));
    await ctx.close();
  }

  console.log('─── Rommel in de gebeurtenissen ───');
  {
    const { ctx, p } = await open();
    const t = await bouw(p, [
      ev({ ts: 1000, oud: 0, nieuw: 0.003, wissel: 'open', px: 80000, sz: 0.003, fee: 0.1 }),
      { uid: 'x', timestamp: 1500 },                                   // geen event-blok
      { uid: 'y', timestamp: 1600, event: { PositionUpdate: {} } },     // leeg
      ev({ ts: 1700, oud: 0.003, nieuw: 0.003, wissel: 'noChange', px: 0, sz: 0 }),   // zonder uitvoering
      ev({ ts: 1800, oud: 0.003, nieuw: 0.003, wissel: 'unknown', px: 'abc', sz: 'x' }),
      ev({ ts: 3000, oud: 0.003, nieuw: 0, wissel: 'close', px: 82000, sz: 0.003, fee: 0.03, pnl: 4 }),
    ]);
    ok('rommel wordt overgeslagen, de levensloop blijft heel', t.length === 1 && t[0].steps === 'open,close', JSON.stringify(t));
    const leeg = await bouw(p, []);
    ok('geen gebeurtenissen is geen fout', Array.isArray(leeg) && leeg.length === 0);
    await ctx.close();
  }

  ok('geen JS-errors totaal', errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));
  console.log(`\n=== Kraken-levensloop: ${pass}/${pass + fail}${skipped ? ' · ' + skipped + ' delen overgeslagen (fixtures niet in deze kloon)' : ''} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
