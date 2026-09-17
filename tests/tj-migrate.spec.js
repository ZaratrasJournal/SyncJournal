// Borgt fase 3 (Denny 2026-09-17): overzetten uit de oude TradeJournal mét controleerbaar
// voorvertoning-scherm, via beide routes — tj_-data in dezelfde browser én een oud
// export-bestand. API-sleutels gaan mee (behalve gedeprecieerd MEXC), playbooks/tags/
// accounts komen aan, en annuleren laat alles met rust.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
  const b = await chromium.launch(); const p = await b.newPage(); p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.setViewportSize({ width: 1700, height: 1000 });
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });

  // Oude-app-data zoals de echte TradeJournal die opslaat (unified accounts, v12-schema).
  const OLD = {
    accounts: [
      { id: 'acc_m1', type: 'manual', label: 'FTMO 100K', transactions: [{ id: 'tx1', type: 'deposit', amount: '100000', date: '2026-03-01', note: 'start' }] },
      { id: 'acc_bf', type: 'blofin', label: 'Blofin', apiKey: 'KEYBLOF123', apiSecret: 'SECRETX', passphrase: 'PP1', walletAddress: '', syncFrom: '2026-01-01', transactions: [] },
      { id: 'acc_hl', type: 'hyperliquid', label: 'HL', apiKey: '', apiSecret: '', passphrase: '', walletAddress: '0xDEAD42', transactions: [] },
      { id: 'acc_mx', type: 'mexc', label: 'MEXC', apiKey: 'MEXKEY99', apiSecret: 'S', transactions: [] },
    ],
    trades: [
      { id: 'ot1', date: '2026-05-01', time: '10:00', pair: 'BTC/USDT', direction: 'long', entry: '100', exit: '110', stopLoss: '95', positionSize: '1000', pnl: '100', fees: '1', leverage: '10', source: 'acc_bf', status: 'closed', setupTags: ['SFP'], confirmationTags: ['FVG'], emotionTags: ['Kalm'], mistakeTags: [], customTags: [], rating: 4, notes: 'goede trade' },
      { id: 'ot2', date: '2026-05-02', time: '11:00', pair: 'ETH/USDT', direction: 'short', entry: '200', exit: '210', stopLoss: '195', positionSize: '500', pnl: '-25', fees: '1', leverage: '5', source: 'acc_m1', status: 'closed', setupTags: [], confirmationTags: [], emotionTags: [], mistakeTags: ['Overtrading'], customTags: [], rating: 0, notes: '' },
      { id: 'ot3', date: '2026-05-03', time: '12:00', pair: 'SOL/USDT', direction: 'long', entry: '10', exit: '11', stopLoss: '9', positionSize: '300', pnl: '30', fees: '0', leverage: '3', source: 'acc_mx', status: 'closed', setupTags: [], confirmationTags: [], emotionTags: [], mistakeTags: [], customTags: [], rating: 0, notes: '' },
    ],
    tags: { setupTags: ['SFP', 'BOS'], confirmationTags: ['FVG'], emotionTags: ['Kalm'], mistakeTags: ['Overtrading'], timeframeTags: [], missedReasonTags: [] },
    playbooks: [{ name: 'London SFP', oneLiner: 'sweep + retest', criteria: [{ text: 'wacht op sweep', mandatory: true }], status: 'active' }],
    config: { theme: 'aurora' },
  };
  await p.evaluate((o) => {
    localStorage.setItem('tj_trades', JSON.stringify(o.trades));
    localStorage.setItem('tj_accounts', JSON.stringify(o.accounts));
    localStorage.setItem('tj_tags', JSON.stringify(o.tags));
    localStorage.setItem('tj_playbooks', JSON.stringify(o.playbooks));
    localStorage.setItem('tj_config', JSON.stringify(o.config));
  }, OLD);
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(700);

  console.log('─── Route A: zelfde browser ───');
  ok('boot toont het migratie-aanbod (gevonden-melding)', await p.evaluate(() => { const m = document.getElementById('modal'); return m.classList.contains('on') && /TradeJournal-data gevonden/.test(m.textContent) && /3 trades/.test(m.textContent); }));
  await p.evaluate(() => { [...document.querySelectorAll('#modal button')].find(x => /Veilig overzetten/.test(x.textContent)).click(); }); await p.waitForTimeout(300);
  const prev = await p.evaluate(() => document.getElementById('modal').textContent);
  ok('daarna het controle-overzicht met trades + periode + verdeling', /Controleer wat er wordt overgezet/.test(prev) && /3 trades/.test(prev) && /Blofin 1/.test(prev) && /FTMO 100K 1/.test(prev));
  ok('playbook, account en tags zichtbaar ter verificatie', /1 playbook/.test(prev) && /London SFP/.test(prev) && /1 handmatig account/.test(prev) && /tags/.test(prev));
  ok('koppelingen: Blofin en HL gaan mee met sleutel-hint', /Blofin/.test(prev) && /…F123/.test(prev) && /Hyperliquid/.test(prev) && /…AD42/.test(prev));
  ok('MEXC-waarschuwing (gedeprecieerd, sleutels niet mee)', /MEXC/.test(prev) && /niet overgezet/.test(prev));
  ok('geen sleutels in klare tekst in het overzicht', !/KEYBLOF123|SECRETX|MEXKEY99/.test(prev));

  ok('annuleren → niets gewijzigd', await p.evaluate(() => { [...document.querySelectorAll('#modal button')].find(x => /Annuleren/.test(x.textContent)).click(); return T.length === 0 && Object.keys(CONNS).length === 0; }));

  await p.evaluate(() => migRun()); await p.waitForTimeout(300);
  await p.evaluate(() => { [...document.querySelectorAll('#modal button')].find(x => /Veilig overzetten/.test(x.textContent)).click(); }); await p.waitForTimeout(600);
  const applied = await p.evaluate(() => ({
    report: /Overgezet/.test(document.getElementById('modal').textContent),
    t: T.length, pb: Object.keys(PBOOK), man: MANUAL.map(m => m.name),
    bfKey: (CONNS.blofin || {}).apiKey, bfPass: (CONNS.blofin || {}).passphrase, hlWallet: (CONNS.hyperliquid || {}).wallet,
    mexc: !!CONNS.mexc, theme: STATE.theme, exBf: T.filter(t => t.exchange === 'blofin').length,
    snap: (SNAP_META || []).some(s => s.label === 'vóór migratie'), flag: !!DB.load('migrated_from_tj', null),
    tags: (tagConfig.setupTags || []).includes('BOS'),
  }));
  ok('overzetten → rapport + 3 trades + playbook + account', applied.report && applied.t === 3 && applied.pb.includes('London SFP') && applied.man.includes('FTMO 100K'), JSON.stringify(applied));
  ok('API-sleutels overgenomen (Blofin key+passphrase, HL wallet), MEXC niet', applied.bfKey === 'KEYBLOF123' && applied.bfPass === 'PP1' && applied.hlWallet === '0xDEAD42' && !applied.mexc);
  ok('trades aan het juiste account, tags gemerged, thema gemapt', applied.exBf === 1 && applied.tags && applied.theme === 'dark');
  ok('veiligheidskopie + migratie-vlag gezet', applied.snap && applied.flag);

  console.log('─── Route B: oud export-bestand ───');
  await p.evaluate(async () => { closeForm(); localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(600);
  const fileRes = await p.evaluate(async (o) => {
    try { hideWelcome() } catch (e) {}
    const exportFile = { version: 12, schemaVersion: 3, exportDate: '2026-09-01T10:00:00Z', trades: o.trades, tagConfig: o.tags, accounts: o.accounts, config: o.config, playbooks: o.playbooks };
    migPreview(TJMigrate.mapExport(exportFile), 'file');
    const prevTxt = document.getElementById('modal').textContent;
    [...document.querySelectorAll('#modal button')].find(x => /Veilig overzetten/.test(x.textContent)).click();
    await new Promise(r => setTimeout(r, 500));
    return { prevOk: /back-upbestand/.test(prevTxt) && /3 trades/.test(prevTxt), t: T.length, bfKey: (CONNS.blofin || {}).apiKey, pb: Object.keys(PBOOK).length, snap: (SNAP_META || []).some(s => s.label === 'vóór import oude backup') };
  }, OLD);
  ok('bestand-route: zelfde overzicht en resultaat, incl. sleutels', fileRes.prevOk && fileRes.t === 3 && fileRes.bfKey === 'KEYBLOF123' && fileRes.pb === 1 && fileRes.snap, JSON.stringify(fileRes));
  ok('kale trades-export (alleen array) → overzicht met alleen trades', await p.evaluate((tr) => { closeForm(); const pre = TJMigrate.mapExport({ version: 7, trades: tr }); return pre.payload.trades.length === 3 && Object.keys(pre.payload.conns).length === 0 && Object.keys(pre.payload.pbook).length === 0; }, OLD.trades));
  ok('pre-unified backup (keys in config.exchanges) → koppeling gevonden', await p.evaluate(() => { const pre = TJMigrate.mapExport({ trades: [], config: { exchanges: { blofin: { apiKey: 'ZZKEY999', apiSecret: 's' } } } }); return (pre.payload.conns.blofin || {}).apiKey === 'ZZKEY999'; }));
  ok('Data-pagina toont de importeer-optie ook zonder oude data in de browser', await p.evaluate(() => { go('instellingen'); setSetTab('data'); return /Kom je van de oude TradeJournal/.test(document.getElementById('main').textContent); }));

  console.log('─── Round-trip met ECHTE oude-app-data (blofin-fixture, 16 trades) ───');
  const fs = require('fs');
  const fix = JSON.parse(fs.readFileSync(path.resolve('tests', 'fixtures', 'blofin-partial-state.json'), 'utf8'));
  const rt = await p.evaluate(async (fx) => {
    closeForm(); localStorage.clear(); try { await IDB.clearAll(); } catch (e) {}
    T = []; TRASH = []; MANUAL.length = 0; Object.keys(CONNS).forEach(k => delete CONNS[k]); PBOOK = {};
    const oldSum = fx.trades.reduce((s, t) => s + (+t.pnl || 0), 0);
    const pre = TJMigrate.mapExport({ version: 12, trades: fx.trades, accounts: [{ id: 'a1', type: 'blofin', label: 'Blofin Main', apiKey: 'BKEY1234', apiSecret: 's', passphrase: 'p', transactions: [] }], playbooks: fx.playbooks || [], config: fx.config || {} });
    migPreview(pre, 'file');
    const prevTxt = document.getElementById('modal').textContent;
    [...document.querySelectorAll('#modal button')].find(x => /Veilig overzetten/.test(x.textContent)).click();
    await new Promise(r => setTimeout(r, 500));
    const newSum = T.reduce((s, t) => s + (+t.pnl || 0), 0);
    const withSrc = T.filter(t => t.srcId).length, withOpen = T.filter(t => +t.openTime > 0).length;
    const closed = T.filter(t => t.status === 'closed'), open = T.filter(t => t.status !== 'closed');
    const sample = T.find(t => t.srcId && t.status === 'closed');
    const reportTxt = document.getElementById('modal').textContent;
    return { n: T.length, oldSum: +oldSum.toFixed(2), newSum: +newSum.toFixed(2), withSrc, withOpen, closed: closed.length, open: open.length,
      issues: /Integriteit/.test(reportTxt), reportNet: /netto/.test(reportTxt), prevNet: /netto/.test(prevTxt),
      acctName: EXMAP.blofin.acct, key: (CONNS.blofin || {}).apiKey,
      sampleDur: sample ? tradeDurationMin(sample) : null, sampleEx: sample ? sample.exchange : null };
  }, fix);
  ok('alle 16 trades over, open én gesloten', rt.n === 16 && rt.open > 0 && rt.closed > 0, JSON.stringify(rt));
  ok('totale P&L op de cent gelijk (' + rt.oldSum + ')', rt.oldSum === rt.newSum && !rt.issues, JSON.stringify({ o: rt.oldSum, n: rt.newSum }));
  ok('netto-bedrag zichtbaar in overzicht én rapport (zelf verifieerbaar)', rt.prevNet && rt.reportNet);
  ok('bron-ids en timestamps overgenomen (duur berekenbaar)', rt.withSrc === 16 && rt.withOpen === 16 && rt.sampleDur > 0, JSON.stringify({ src: rt.withSrc, open: rt.withOpen, dur: rt.sampleDur }));
  ok('accountnaam uit oude app + key aangekomen', rt.acctName === 'Blofin Main' && rt.key === 'BKEY1234');

  console.log('─── Geen duplicaten bij sync ná migratie ───');
  ok('zelfde trades opnieuw via sync-brug → 0 nieuw (srcId-dedupe)', await p.evaluate((fx) => { closeForm(); const before = T.length; const mapped = importTjClosed(fx.trades); return mapped.length === 0 && T.length === before; }, fix));

  console.log('─── Vangnetten ───');
  ok('integriteits-check slaat aan bij gemanipuleerde P&L', await p.evaluate((fx) => { const hold = T[0].pnl; T[0].pnl = (+T[0].pnl || 0) + 500; const iss = TJMigrate.verify({ trades: T }, { trades: fx.trades }); T[0].pnl = hold; return iss.some(x => /P&L wijkt af/.test(x)); }, fix));
  ok('veiligheidskopie kan de vorige staat écht terugzetten', await p.evaluate(async () => {
    const preTrades = T.length;
    const snap = SNAP_META.find(s => s.label === 'vóór import oude backup');
    if (!snap) return false;
    await Snapshots.restore(snap.id);
    const restored = T.length === 0; // vóór deze import was de journal leeg
    return restored && preTrades === 16;
  }));
  ok('afgebroken preview laat geen migratie-staat achter', await p.evaluate(() => { migPreview(TJMigrate.mapExport({ trades: [{ id: 'x', date: '2026-01-01', direction: 'long', status: 'closed', pnl: '1', setupTags: [] }] }), 'file'); closeForm(); return window._migPre === null || _migPre === null; }));

  ok('geen JS-errors totaal', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== TJ-migratie (fase 3): ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
