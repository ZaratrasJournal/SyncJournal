// Overzetten van de oude TradeJournal naar SyncJournal, met het nieuwe positie-model.
// Aanleiding: Denny 22-09-2026 — "krijgen we straks geen fouten?". De oude journal maakte van
// één positie die in stappen sloot meerdere rijen, elk met de cumulatieve P&L, dus telde hij
// die positie dubbel. Sinds Blofin op model B staat en detectPartials daar een no-op is,
// moeten de opruimstappen ook over overgezette data lopen — en moet de controle daarmee rekenen.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const bij = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 1e-6 : tol);
const APP = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');

const CT = 1776900000000, U1 = CT + 3 * 36e5, U2 = CT + 9 * 36e5;
// zoals de oude TradeJournal ze in tj_trades had staan
const oudeTrade = o => ({ id: 'x', date: '2026-04-22', time: '16:14', pair: 'BTC/USDT', direction: 'long', source: 'blofin',
  entry: '80000', exit: '80500', stopLoss: '79000', positionSize: '240', positionSizeAsset: '0.003', pnl: '3.26', fees: '0.12',
  status: 'closed', openTime: String(CT), closeTime: String(U1), setupTags: [], confirmationTags: [], timeframeTags: [],
  emotionTags: [], mistakeTags: [], customTags: [], notes: '', links: [], layers: [], ...o });
const OUD = {
  trades: [
    // één Blofin-positie, in twee stappen gesloten → twee rijen met cumulatieve P&L
    oudeTrade({ id: 'blofin_8000000610734_' + U1, positionId: '8000000610734', closeTime: String(U1), exit: '80500', pnl: '3.26', positionSizeAsset: '0.001', notes: 'eerste TP' }),
    oudeTrade({ id: 'blofin_8000000610734_' + U2, positionId: '8000000610734', closeTime: String(U2), exit: '81000', pnl: '4.52', positionSizeAsset: '0.0029', customTags: ['tp2'] }),
    // een eerdere levensloop onder hetzelfde positie-id
    oudeTrade({ id: 'blofin_8000000610734_1770000000000', positionId: '8000000610734', openTime: '1769900000000', closeTime: '1770000000000', exit: '79000', pnl: '-1' }),
    // Hyperliquid, rij per sluiting
    oudeTrade({ id: 'hyperliquid_555001', source: 'hyperliquid', pair: 'BTC/USDC', positionId: '', pnl: '2', openTime: String(CT), closeTime: String(U1) }),
    // handmatig ingevoerd, zonder bron
    oudeTrade({ id: 'handmatig_1', source: 'manual', positionId: '', pnl: '5', notes: 'mijn eigen trade' }),
  ],
  accounts: [{ id: 'acc_blofin', type: 'blofin', label: 'Blofin', apiKey: 'k', apiSecret: 's', passphrase: 'p' },
    { id: 'acc_hl', type: 'hyperliquid', label: 'HL', walletAddress: '0x' + 'a'.repeat(40) }],
  tags: {}, playbooks: [], config: {}, privacy: false,
};
const somOud = OUD.trades.reduce((s, t) => s + (+t.pnl), 0);   // 13,78 — met de dubbeltelling erin

(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext(); const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
  p.on('dialog', d => d.accept());
  await p.route('**/*', r => /^https?:/.test(r.request().url()) ? r.abort() : r.continue());
  await p.addInitScript(() => localStorage.setItem('sj_welcomed', 'true'));
  await p.goto(APP, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1200);

  console.log('─── Overzetten uit dezelfde browser ───');
  const r = await p.evaluate(async oud => {
    T = []; TRASH = []; persist();
    // de oude app in dezelfde browser
    localStorage.setItem('tj_trades', JSON.stringify(oud.trades));
    localStorage.setItem('tj_accounts', JSON.stringify(oud.accounts));
    const pre = TJMigrate.map(TJMigrate.readOld());
    const schemaVoor = DB.load('schema', 0);
    await applyBackup(pre.payload);
    const issues = TJMigrate.verify(pre.payload, pre.old);
    return { schemaVoor, payloadSchema: pre.payload.schemaVersion, schemaNa: DB.load('schema', 0), issues,
      samen: { ...MIG_SAMEN }, n: T.length, som: T.reduce((s, t) => s + (+t.pnl || 0), 0),
      t: T.map(t => ({ srcId: t.srcId, ex: t.exchange, pnl: +t.pnl, qty: +t.qtyAsset, open: +t.openTime, notes: t.notes, tags: t.tags, hlOud: !!t._hlOud, date: t.date, time: t.time })),
      hlLast: (CONNS.hyperliquid || {}).lastSync, bfLast: (CONNS.blofin || {}).lastSync };
  }, OUD);

  ok('de overgezette data draagt een schema-versie, zodat de opruimstappen lopen', r.payloadSchema === 1, JSON.stringify(r.payloadSchema));
  ok('en het schema staat daarna op de huidige versie', r.schemaNa === await p.evaluate(() => SCHEMA_VERSION), JSON.stringify(r.schemaNa));
  ok('de twee tussenstanden van één Blofin-positie zijn samengevoegd', r.samen.n === 1 && r.n === 4, JSON.stringify({ samen: r.samen.n, n: r.n }));
  ok('met de laatste stand (P&L 4,52) en de notitie én tag van beide',
    (() => { const t = r.t.find(x => x.srcId === 'blofin_8000000610734_' + CT); return t && bij(t.pnl, 4.52, 0.001) && t.notes === 'eerste TP' && (t.tags || []).includes('tp2'); })(),
    JSON.stringify(r.t.find(x => x.srcId === 'blofin_8000000610734_' + CT)));
  ok('de eerdere levensloop blijft een eigen trade', r.t.some(x => x.srcId === 'blofin_8000000610734_1769900000000'), JSON.stringify(r.t.map(x => x.srcId)));
  ok('de dubbeltelling is weg: totaal 10,52 in plaats van 13,78',
    bij(r.som, somOud - 3.26, 0.001), `${r.som.toFixed(2)} vs ${(somOud - 3.26).toFixed(2)} (oud ${somOud.toFixed(2)})`);
  ok('de Hyperliquid-rij is gemarkeerd voor de eerstvolgende sync', r.t.some(x => x.ex === 'hyperliquid' && x.hlOud), JSON.stringify(r.t.filter(x => x.ex === 'hyperliquid')));
  ok('en beide syncs kijken terug tot vóór de oudste rij', r.hlLast > 0 && r.hlLast <= CT - 3600e3 && r.bfLast > 0 && r.bfLast <= 1769900000000 - 3600e3, JSON.stringify({ hl: r.hlLast, bf: r.bfLast }));
  ok('de handmatige trade is ongemoeid', r.t.some(x => x.pnl === 5 && x.notes === 'mijn eigen trade'), JSON.stringify(r.t.find(x => x.pnl === 5)));
  ok('de datum komt van het open-moment, niet van de sluiting (v2)',
    r.t.every(x => { const d = new Date(x.open); return x.date === `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }),
    JSON.stringify(r.t.map(x => x.date + ' ' + x.time + ' ← ' + new Date(x.open).toLocaleString('nl-NL'))));
  ok('de controle meldt geen enkel probleem', r.issues.length === 0, JSON.stringify(r.issues));

  console.log('─── Zonder de opruimstappen zou de controle alarm slaan ───');
  const zonder = await p.evaluate(async oud => {
    T = []; TRASH = []; persist();
    const pre = TJMigrate.map({ ...oud, accounts: [] });
    const { schemaVersion, ...zonderSchema } = pre.payload;       // zoals het vóór deze fix ging
    await applyBackup(zonderSchema);
    return { n: T.length, som: T.reduce((s, t) => s + (+t.pnl || 0), 0), issues: TJMigrate.verify(pre.payload, pre.old) };
  }, OUD);
  ok('zonder schema-versie blijven de dubbele rijen staan', zonder.n === 5 && bij(zonder.som, somOud, 0.001), JSON.stringify(zonder));
  ok('en dát is precies wat de controle nu zou melden', zonder.issues.length > 0, JSON.stringify(zonder.issues));

  console.log('─── Een oud back-upbestand (andere browser) ───');
  const bestand = await p.evaluate(async oud => {
    T = []; TRASH = []; persist();
    const pre = TJMigrate.mapExport({ trades: oud.trades, accounts: oud.accounts, tagConfig: {}, playbooks: [], config: {} });
    await applyBackup(pre.payload);
    return { schema: pre.payload.schemaVersion, n: T.length, som: T.reduce((s, t) => s + (+t.pnl || 0), 0), issues: TJMigrate.verify(pre.payload, pre.old) };
  }, OUD);
  ok('een oud back-upbestand loopt door dezelfde opruimstappen', bestand.schema === 1 && bestand.n === 4 && bij(bestand.som, somOud - 3.26, 0.001), JSON.stringify(bestand));
  ok('ook daar geen meldingen', bestand.issues.length === 0, JSON.stringify(bestand.issues));

  console.log('─── Rommel in de oude data ───');
  const rommel = await p.evaluate(async () => {
    T = []; TRASH = []; persist();
    const pre = TJMigrate.map({ trades: [
      { id: 'blofin_1_2', source: 'blofin', positionId: '1', pnl: 'x', entry: 'abc', openTime: 'nope', closeTime: '', date: '', pair: '' },
      { id: '', source: 'blofin', pnl: '1' },
      null, 'geen trade',
    ], accounts: [], tags: {}, playbooks: [], config: {} });
    await applyBackup(pre.payload);
    const fouten = [];
    for (const t of T) { try { openForm(t.id); closeForm(); } catch (e) { fouten.push(e.message); } }
    try { render(); } catch (e) { fouten.push('render: ' + e.message); }
    return { n: T.length, fouten, warnings: pre.warnings, issues: TJMigrate.verify(pre.payload, pre.old) };
  });
  ok('kapotte oude rijen breken het overzetten niet', rommel.fouten.length === 0, JSON.stringify(rommel.fouten));
  ok('onleesbare regels worden benoemd in plaats van genegeerd', /onleesbaar/.test((rommel.warnings || []).join(' ')), JSON.stringify(rommel.warnings));
  ok('en elke overgezette trade is te openen', rommel.n >= 1, JSON.stringify(rommel.n));

  ok('geen JS-errors totaal', errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));
  console.log(`\n=== Overzetten oude journal: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
