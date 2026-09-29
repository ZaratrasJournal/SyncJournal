// Overzetten van OKX-trades uit de oude TradeJournal: aparte trades blijven apart.
//
// Melding member Jarne, 29-09-2026: 12 OKX-trades in de oude journal, na het inlezen van zijn
// backup nog maar één — met de melding "11 rijen bleken tussenstanden van een positie die in
// stappen sloot". Oorzaak: opruimstap v3 groepeerde op posId alleen, maar OKX gebruikt één posId
// opnieuw voor elke nieuwe positie op hetzelfde paar (tot 30 dagen na het sluiten; zie v5). Wat
// wél bij elkaar hoort: zelfde posId én zelfde openingstijd (cTime), met een andere sluittijd.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const bij = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 1e-6 : tol);
const APP = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');

const DAG = 864e5, UUR = 36e5, START = 1788000000000;   // begin september 2026
const POS = '3100000000000001', POS2 = '3100000000000002';
// zoals de oude TradeJournal ze had: id okx_<posId>_<sluittijd>, openTime = cTime van de positie
const okxRij = o => ({ date: '2026-09-01', time: '10:00', pair: 'BTC/USDT', direction: 'long', source: 'okx', positionId: POS,
  entry: '110000', exit: '110500', stopLoss: '', positionSize: '110', positionSizeAsset: '0.001', fees: '0.10', status: 'closed',
  setupTags: [], confirmationTags: [], timeframeTags: [], emotionTags: [], mistakeTags: [], customTags: [], notes: '', links: [], layers: [], ...o });
// twaalf losse posities op hetzelfde paar, één per dag, allemaal onder dezelfde posId
const LOS = Array.from({ length: 12 }, (_, i) => {
  const open = START + i * DAG, dicht = open + 2 * UUR;
  return okxRij({ id: `okx_${POS}_${dicht}`, openTime: String(open), closeTime: String(dicht), pnl: String(((i % 3) - 1) * 1.5 + i / 10), notes: i === 4 ? 'mijn vijfde' : '' });
});
// één positie die in twee stappen sloot: zelfde posId én zelfde opening, cumulatieve P&L
const T0 = START + 20 * DAG;
const STAPPEN = [
  okxRij({ id: `okx_${POS2}_${T0 + UUR}`, positionId: POS2, openTime: String(T0), closeTime: String(T0 + UUR), pnl: '2', notes: 'TP1' }),
  okxRij({ id: `okx_${POS2}_${T0 + 3 * UUR}`, positionId: POS2, openTime: String(T0), closeTime: String(T0 + 3 * UUR), pnl: '5', customTags: ['tp2'] }),
];
const OUD = { trades: [...LOS, ...STAPPEN], accounts: [], tagConfig: {}, playbooks: [], config: {} };
const somLos = LOS.reduce((s, t) => s + (+t.pnl), 0);

(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext()).newPage();
  p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
  p.on('dialog', d => d.accept());
  await p.route('**/*', r => /^https?:/.test(r.request().url()) ? r.abort() : r.continue());
  await p.addInitScript(() => localStorage.setItem('sj_welcomed', 'true'));
  await p.goto(APP, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1200);

  for (const route of ['backup-bestand', 'zelfde browser']) {
    console.log(`─── Overzetten via ${route} ───`);
    const r = await p.evaluate(async ({ oud, route }) => {
      T = []; TRASH = []; persist(); DB.save('schema', 0);
      let pre;
      if (route === 'zelfde browser') { localStorage.setItem('tj_trades', JSON.stringify(oud.trades)); pre = TJMigrate.map(TJMigrate.readOld()); }
      else pre = TJMigrate.mapExport(oud);
      await applyBackup(pre.payload);
      localStorage.removeItem('tj_trades');
      return { issues: TJMigrate.verify(pre.payload, pre.old), warnings: pre.warnings, samen: MIG_SAMEN.n,
        t: T.map(t => ({ srcId: t.srcId, pnl: +t.pnl, open: +t.openTime, notes: t.notes, tags: t.tags })) };
    }, { oud: OUD, route });
    const los = r.t.filter(t => String(t.srcId).startsWith(`okx_${POS}_`));
    ok('alle 12 losse OKX-trades staan erin', los.length === 12, `${los.length} van 12 · ${r.t.length} trades in totaal`);
    ok('elk met een eigen sleutel: posId + openingstijd', new Set(los.map(t => t.srcId)).size === 12 && los.every(t => t.srcId === `okx_${POS}_${t.open}`),
      JSON.stringify(los.map(t => t.srcId)));
    ok('hun P&L is compleet: ' + somLos.toFixed(2), bij(los.reduce((s, t) => s + t.pnl, 0), somLos, 1e-6), los.reduce((s, t) => s + t.pnl, 0).toFixed(4));
    ok('de notitie bij de vijfde trade staat bij de vijfde trade', los.some(t => t.notes === 'mijn vijfde' && t.open === START + 4 * DAG));
    const stap = r.t.filter(t => String(t.srcId).startsWith(`okx_${POS2}`));
    ok('de positie die in twee stappen sloot wordt wél één trade', stap.length === 1 && r.samen === 1, JSON.stringify({ n: stap.length, samen: r.samen }));
    ok('met de laatste stand (P&L 5) en de notitie én tag van beide', stap[0] && bij(stap[0].pnl, 5) && stap[0].notes === 'TP1' && (stap[0].tags || []).includes('tp2'),
      JSON.stringify(stap[0]));
    ok('de controle na het overzetten vindt niets', r.issues.length === 0, r.issues.join(' | '));
  }

  ok('geen JS-fouten', errs.length === 0, errs[0]);
  console.log(`\n=== OKX overzetten: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
