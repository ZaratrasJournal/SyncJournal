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

  ok('geen JS-errors totaal', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== TJ-migratie (fase 3): ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
