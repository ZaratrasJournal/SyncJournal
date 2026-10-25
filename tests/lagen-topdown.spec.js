// Setup-lagen staan top-down op tijdframe: hoogste boven, de entry (onderste laag) onderaan.
//
// Denny 13-10-2026: "laag 1 staat op de 1H, ik zet in laag 2 een 4H-confirmatie. Liever top-down: een
// hoger tijdframe gaat automatisch naar boven." De laatste laag is de entry-laag: daar komt het
// tijdframe van de trade vandaan. Een 4H-laag onder de 1H maakte de trade een 4H-trade.
// Plan: docs/plan-lagen-topdown-2026-10-13.md
const { chromium } = require('playwright');
const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const L = tf => ({ timeframe: tf, bias: '', setups: [], confirmations: [] });

(async () => {
  const b = await chromium.launch(); const { p, errs } = await H.openJournal(b);

  console.log('─── Sorteren ───');
  const s = await p.evaluate(Lf => {
    const L = tf => ({ timeframe: tf, bias: '', setups: [], confirmations: [] }), tfs = ls => ls.map(l => l.timeframe || '·');
    if (typeof sorteerLagen !== 'function') return { fout: 'sorteerLagen bestaat niet' };
    const twee = sorteerLagen([{ ...L('1H'), setups: ['A'] }, { ...L('1H'), setups: ['B'] }]);
    return {
      a: tfs(sorteerLagen([L('1H'), L('4H')])),
      b: tfs(sorteerLagen([L('15M'), L('Weekly'), L('1H'), L('Daily'), L('12H')])),
      leeg: tfs(sorteerLagen([L('15M'), L(''), L('4H')])),
      gelijk: twee.map(l => l.setups[0]),
      htf: tfs(sorteerLagen([L('1H'), L('HTF'), L('4H')])),
    };
  });
  ok('1H, 4H → 4H, 1H', JSON.stringify(s.a) === '["4H","1H"]', JSON.stringify(s));
  ok('15M, Weekly, 1H, Daily, 12H → Weekly, Daily, 12H, 1H, 15M', JSON.stringify(s.b) === '["Weekly","Daily","12H","1H","15M"]', JSON.stringify(s.b));
  ok('een laag zonder tijdframe blijft op zijn plek', JSON.stringify(s.leeg) === '["4H","·","15M"]', JSON.stringify(s.leeg));
  ok('twee 1H-lagen houden hun volgorde', JSON.stringify(s.gelijk) === '["A","B"]', JSON.stringify(s.gelijk));
  ok('een onleesbaar tijdframe ("HTF") gaat bovenaan, nooit de entry', JSON.stringify(s.htf) === '["HTF","4H","1H"]', JSON.stringify(s.htf));

  console.log('─── Formulier: 1H, dan een laag met 4H erbij ───');
  const lagenInBeeld = () => p.evaluate(() => [...document.querySelectorAll('#layerbuilder .layerrow')].map(r => {
    const on = [...r.querySelectorAll('.tagopt.on')].map(x => x.textContent.trim()); return on[0] || '·'; }));
  await p.evaluate(() => { openForm(null); addLayer(); setLayerTF(0, '1H'); addLayer(); setLayerTF(1, '4H'); });
  const beeld = await lagenInBeeld();
  ok('in beeld springt 4H meteen naar boven: 4H, 1H', JSON.stringify(beeld) === '["4H","1H"]', JSON.stringify(beeld));
  const keuzes = await p.evaluate(() => { const blok = [...[...document.querySelectorAll('#layerbuilder .layerrow')][0].querySelectorAll('.layertags')].find(x => /Timeframe/.test(x.querySelector('.lt-lbl').textContent));
    return [...blok.querySelectorAll('.tagopt')].map(x => x.textContent.trim()); });
  ok('de tijdframes zijn je tags, hoog → laag', JSON.stringify(keuzes) === '["Weekly","Daily","12H","4H","2H","1H","30M","15M","10M","5M"]', JSON.stringify(keuzes));
  const opgeslagen = await p.evaluate(() => {
    const zet = (k, v) => { const el = document.getElementById('f_' + k); if (el) el.value = v; };
    zet('pair', 'BTC/USDC'); zet('date', '2026-10-13'); zet('time', '10:00'); zet('dir', 'long'); zet('status', 'closed'); zet('kind', 'live'); zet('entry', '100'); zet('exit', '110'); zet('size', '1000');
    calcTrade(true); submitForm(null); const t = T[0]; return { tfs: t.layers.map(l => l.timeframe), timeframe: t.timeframe, id: t.id };
  });
  ok('opgeslagen: lagen 4H, 1H en de trade is een 1H-trade', JSON.stringify(opgeslagen.tfs) === '["4H","1H"]' && opgeslagen.timeframe === '1H', JSON.stringify(opgeslagen));

  console.log('─── Een oude trade met een tijdframe dat niet in je tags staat ───');
  const oud = await p.evaluate(() => {
    T.unshift({ ...EMPTY_TRADE, id: 777, kind: 'live', status: 'closed', pair: 'BTC/USDC', dir: 'long', date: '2026-10-01', time: '10:00', entry: 100, exit: 101, size: '100', pnl: 1,
      layers: [{ timeframe: '4H', bias: '', setups: [], confirmations: [] }, { timeframe: '1M', bias: '', setups: [], confirmations: [] }], timeframe: '1M' }); persist();
    openForm(777); const rij = [...document.querySelectorAll('#layerbuilder .layerrow')][1];
    const blok = rij && [...rij.querySelectorAll('.layertags')].find(x => /Timeframe/.test(x.querySelector('.lt-lbl').textContent));
    const r = { aan: blok ? [...blok.querySelectorAll('.tagopt.on')].map(x => x.textContent.trim()) : [], alle: blok ? [...blok.querySelectorAll('.tagopt')].map(x => x.textContent.trim()) : [] };
    closeForm(); return r;
  });
  ok('1M staat erbij en is geselecteerd, onderaan de lijst', JSON.stringify(oud.aan) === '["1M"]' && oud.alle[oud.alle.length - 1] === '1M', JSON.stringify(oud));

  console.log('─── Import van een oude backup ───');
  const imp = await p.evaluate(() => { const t = sjFromTj({ ...EMPTY_TRADE, id: 'x1', source: 'manual', status: 'closed', pair: 'BTC/USDT', direction: 'long', entry: '100', exit: '110', pnl: '10', date: '2026-10-01', time: '09:00',
    layers: [{ timeframe: '1H', bias: '', setups: ['MSB'], confirmations: [] }, { timeframe: '4H', bias: '', setups: [], confirmations: [] }] }); return { tfs: t.layers.map(l => l.timeframe), timeframe: t.timeframe }; });
  ok('een oude trade met lagen 1H, 4H komt binnen als 4H, 1H en is een 1H-trade', JSON.stringify(imp.tfs) === '["4H","1H"]' && imp.timeframe === '1H', JSON.stringify(imp));

  console.log('─── Playbook-editor ───');
  const pb = await p.evaluate(() => {
    openPbEdit(null); addLayer(); setLayerTF(0, '15M'); addLayer(); setLayerTF(1, 'Daily');
    const inBeeld = [...document.querySelectorAll('#layerbuilder .layerrow')].map(r => ([...r.querySelectorAll('.tagopt.on')][0] || {}).textContent);
    document.getElementById('pb_name').value = 'Topdown test'; savePbook();
    return { inBeeld, opgeslagen: ((PBOOK['Topdown test'] || {}).layers || []).map(l => l.timeframe) };
  });
  ok('playbook: Daily springt boven 15M, en zo opgeslagen', JSON.stringify(pb.inBeeld) === '["Daily","15M"]' && JSON.stringify(pb.opgeslagen) === '["Daily","15M"]', JSON.stringify(pb));

  console.log('─── Review 13-10: tags als tekst, tijdframe bewaren, kopie, lege taglijst ───');
  const vg = await p.evaluate(() => {
    const oud = [...tagConfig.timeframeTags], oudSetup = [...(tagConfig.setupTags || [])];
    tagConfig.timeframeTags = [...oud, '<img src=x onerror="window.__xss=1">'];
    tagConfig.setupTags = [...oudSetup, "Bull's flag"];
    openForm(null); addLayer();
    const rij = document.querySelector('#layerbuilder .layerrow');
    const chips = [...rij.querySelectorAll('.tagopt')].map(x => x.textContent.trim());
    const flag = [...rij.querySelectorAll('.tagopt')].find(x => x.textContent.trim() === "Bull's flag"); if (flag) flag.click();
    const gekozen = (formLayers[0].setups || []).slice();
    closeForm(); tagConfig.timeframeTags = oud; tagConfig.setupTags = oudSetup;
    return { xss: !!window.__xss, img: !!document.querySelector('#layerbuilder img'), tekstChip: chips.includes('<img src=x onerror="window.__xss=1">'), gekozen };
  });
  await p.waitForTimeout(300);
  const xss2 = await p.evaluate(() => !!window.__xss);
  ok('een tag met HTML wordt tekst: geen script, geen <img>', !vg.xss && !xss2 && !vg.img && vg.tekstChip, JSON.stringify(vg));
  ok("een setup-tag met een apostrof (Bull's flag) is aan te klikken", JSON.stringify(vg.gekozen) === JSON.stringify(["Bull's flag"]), JSON.stringify(vg.gekozen));

  const bewaar = await p.evaluate(() => {
    const basis = { ...EMPTY_TRADE, kind: 'live', status: 'closed', pair: 'BTC/USDC', dir: 'long', date: '2026-10-01', time: '10:00', entry: 100, exit: 110, size: '100', pnl: 10 };
    const lg = (tf, setups) => ({ timeframe: tf, bias: '', setups: setups || [], confirmations: [] });
    T.unshift({ ...basis, id: 601, timeframe: '1H', layers: [lg('4H'), lg('1H'), lg('', ['MSB'])] }, { ...basis, id: 602, timeframe: '15m', layers: [] }); persist();
    const r = {}; for (const id of [601, 602]) { openForm(id); submitForm(id); r[id] = (T.find(x => x.id === id) || {}).timeframe; } return r;
  });
  ok('opslaan met een onderste laag zonder tijdframe houdt 1H (de onderste laag mét tijdframe)', bewaar[601] === '1H', JSON.stringify(bewaar));
  ok('opslaan van een oude trade zonder lagen houdt zijn tijdframe (15m)', bewaar[602] === '15m', JSON.stringify(bewaar));

  const kopie = await p.evaluate(() => { const nu = DB.load('schema', 0); DB.save('schema', 10); const v = snapshotPayload().schemaVersion; DB.save('schema', nu); return v; });
  ok('een veiligheidskopie van vóór de update zegt schema 10, zodat terugzetten de opruimstap opnieuw doet', kopie === 10, String(kopie));

  const leeg = await p.evaluate(() => { const oud = [...tagConfig.timeframeTags]; tagConfig.timeframeTags = []; openForm(null); addLayer();
    const n = document.querySelectorAll('#layerbuilder .layerrow .tagopt').length; const tfs = tfKeuzes(); closeForm(); tagConfig.timeframeTags = oud; return { n, tfs }; });
  ok('alle tijdframe-tags verwijderd: de laag toont de standaardlijst, niet niets', leeg.tfs.length === 8 && leeg.tfs[0] === 'Daily', JSON.stringify(leeg.tfs));

  console.log('─── Opruimstap: bestaande trades, prullenbak en playbooks (schema 10 → 11) ───');
  await p.evaluate(async () => {
    const lg = (tf, bias, setups) => ({ timeframe: tf, bias: bias || '', setups: setups || [], confirmations: [] });
    const basis = { ...EMPTY_TRADE, kind: 'live', status: 'closed', pair: 'BTC/USDC', dir: 'long', date: '2026-10-01', time: '10:00', entry: 100, exit: 110, size: '100', pnl: 10 };
    T = [{ ...basis, id: 501, setup: 'X', timeframe: '4H', layers: [lg('1H', '', ['MSB']), lg('4H')] },
         { ...basis, id: 502, timeframe: '15M', layers: [lg('Daily', 'bearish'), lg('15M', 'bullish')] },
         { ...basis, id: 503, timeframe: '1H', layers: [] }];
    TRASH = [{ ...basis, id: 504, timeframe: '5M', layers: [lg('5M'), lg('1H')], deletedAt: Date.now() }];
    PBOOK = { 'Sjabloon': { ...(PBOOK['Sjabloon'] || {}), name: 'Sjabloon', criteria: [], layers: [lg('15M'), lg('4H', 'Bearish')] } };
    await IDB.set('trades', T); await IDB.set('trash', TRASH); await IDB.set('pbook', PBOOK); DB.save('schema', 10);
  });
  await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500);
  const m = await p.evaluate(() => {
    const tfs = ls => (ls || []).map(l => l.timeframe), t = id => T.find(x => x.id === id) || {};
    return { schema: DB.load('schema', 0), a: { tfs: tfs(t(501).layers), tf: t(501).timeframe, setup: t(501).setup },
      b: { bias: (t(502).layers || []).map(l => l.bias), tf: t(502).timeframe }, c: { tf: t(503).timeframe, n: (t(503).layers || []).length },
      bak: { tfs: tfs((TRASH.find(x => x.id === 504) || {}).layers), tf: (TRASH.find(x => x.id === 504) || {}).timeframe },
      pb: tfs((PBOOK['Sjabloon'] || {}).layers) };
  });
  ok('schema op de huidige versie', m.schema === await p.evaluate(() => SCHEMA_VERSION), String(m.schema));
  ok('"1H > 4H" wordt 4H, 1H en weer een 1H-trade; de setup blijft X', JSON.stringify(m.a.tfs) === '["4H","1H"]' && m.a.tf === '1H' && m.a.setup === 'X', JSON.stringify(m.a));
  ok('bias "bearish"/"bullish" wordt Bearish/Bullish', JSON.stringify(m.b.bias) === '["Bearish","Bullish"]' && m.b.tf === '15M', JSON.stringify(m.b));
  ok('een trade zonder lagen blijft zoals hij is', m.c.tf === '1H' && m.c.n === 0, JSON.stringify(m.c));
  ok('ook de prullenbak: 1H, 5M en een 5M-trade', JSON.stringify(m.bak.tfs) === '["1H","5M"]' && m.bak.tf === '5M', JSON.stringify(m.bak));
  ok('ook je playbook-sjabloon: 4H, 15M', JSON.stringify(m.pb) === '["4H","15M"]', JSON.stringify(m.pb));

  ok('geen JS-fouten', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== Lagen top-down: ${pass}/${pass + fail} ===`); await b.close(); process.exit(fail ? 1 : 0);
})();
