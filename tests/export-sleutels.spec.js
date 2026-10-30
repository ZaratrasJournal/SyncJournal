// F12 (BACKLOG.md), sinds 30-10-2026 via het schuifje "API-sleutels in back-ups" (Instellingen → Data):
// standaard (schuifje uit) gaan de API-sleutels nergens mee: export, Backup nu, map, Drive. Aan: mee in
// export, Backup nu en map (details en Drive/Mori-vinkjes in sleutels-schuif.spec.js). "Data overzetten"
// houdt zijn eigen keuze. Veiligheidskopieën in IndexedDB en diagReport: nooit een sleutel.
//
// Nep-sleutels per exchange (Blofin, OKX, Kraken, MEXC, Hyperliquid-wallet) plus handmatige accounts.
// Er gaat niets het netwerk op (dov-page sluit http(s) af).
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const DS = require('./helpers/dov-datasets'); const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const NEP = {
  blofin: { apiKey: 'NEPKEY-BLOFIN-f12a', apiSecret: 'NEPSEC-BLOFIN-f12b', passphrase: 'NEPPASS-BLOFIN-f12c' },
  okx: { apiKey: 'NEPKEY-OKX-f12d', apiSecret: 'NEPSEC-OKX-f12e', passphrase: 'NEPPASS-OKX-f12f' },
  kraken: { apiKey: 'NEPKEY-KRAKEN-f12g', apiSecret: 'NEPSEC-KRAKEN-f12h' },
  mexc: { apiKey: 'NEPKEY-MEXC-f12i', apiSecret: 'NEPSEC-MEXC-f12j' },
  hyperliquid: { wallet: '0xNEPWALLET00000000000000000000000000f12k' },
};
const AI = 'sk-ant-api03-NEP-F12-mori-sleutel';
const GEHEIM = [...Object.values(NEP).flatMap(o => Object.values(o))];
const lekt = s => GEHEIM.filter(x => String(s).includes(x));
const conns = () => Object.fromEntries(Object.entries(NEP).map(([id, c]) => [id, { connected: true, autoSync: false, hint: (c.apiKey || c.wallet).slice(-4), syncFrom: '2026-01-01', ...c }]));
const SHOTS = path.resolve('tests/screenshots'); fs.mkdirSync(SHOTS, { recursive: true });

(async () => {
  const b = await chromium.launch();
  const { ctx, p, errs } = await H.openJournal(b);
  const VOL = DS.volledig(); VOL.conns = conns();
  const zaai = async () => { await H.seed(p, VOL); await p.evaluate(k => localStorage.setItem('sj_ai_key', k), AI); };
  await zaai();
  const download = async (fn) => { const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }), p.evaluate(fn)]); return fs.readFileSync(await dl.path(), 'utf8'); };
  const kies = (v) => p.evaluate(v => { const r = document.querySelector(`#modal input[name="sjKeys"][value="${v}"]`); r.click(); }, v);
  const bovenaan = () => p.evaluate(() => { const m = document.querySelector('#modal .mbody'); return !!m && !!m.firstElementChild && m.firstElementChild.id === 'sleutelKeuze'; });

  console.log('─── Exporteren (exportJSON): schuifje uit = zonder, zonder te vragen ───');
  const bk0 = await p.evaluate(() => BK.ts);
  const zonder = await download(() => exportJSON());
  const Z = JSON.parse(zonder);
  ok('exportJSON vraagt niets: geen venster', await p.evaluate(() => !document.getElementById('modal').classList.contains('on')));
  ok('zonder: geen enkele nep-sleutel, secret, passphrase of wallet', lekt(zonder).length === 0, lekt(zonder).join());
  ok('zonder: koppelingen blijven herkenbaar (hint) en vragen om een sleutel', Z.conns.blofin.hint === NEP.blofin.apiKey.slice(-4) && Object.values(Z.conns).every(c => c.needKey === true), JSON.stringify(Z.conns.blofin));
  ok('zonder: trades, playbooks, tags, handmatige accounts gaan mee', Z.trades.length === VOL.trades.length && Object.keys(Z.pbook).length === 4 && Z.manual.length === VOL.manual.length && !!Z.tagConfig);
  ok('export stempelt de back-up (zonder sleutels)', await p.evaluate(b0 => BK.ts > b0 && BK.keys === false, bk0));
  await p.evaluate(() => bkKeysZet(true));
  const met = await download(() => exportJSON());
  ok('schuifje aan: alle nep-sleutels per exchange staan erin (ook het walletadres)', lekt(met).length === GEHEIM.length, lekt(met).length + '/' + GEHEIM.length);
  ok('sj_ai_key gaat niet mee zonder het Mori-vinkje', !zonder.includes(AI) && !met.includes(AI));
  await p.evaluate(() => bkKeysZet(false));

  console.log('─── Data overzetten (exportOverzicht) ───');
  await p.evaluate(() => exportOverzicht()); await p.waitForTimeout(150);
  ok('keuze staat bovenaan het overzicht, met schuifje uit voorgekozen op zonder', await bovenaan() && await p.evaluate(() => document.querySelector('#modal input[name="sjKeys"][value="zonder"]').checked && _dovExp.keys === false));
  ok('totaalregel zegt "zonder sleutels"', /zonder sleutels/.test(await p.evaluate(() => document.getElementById('dovExpTot').innerText)));
  const dovZ = await download(() => dovExportGo());
  ok('DOV zonder: geen sleutel, manifest keysIncluded false', lekt(dovZ).length === 0 && JSON.parse(dovZ).manifest.keysIncluded === false, lekt(dovZ).join());
  await p.evaluate(() => exportOverzicht()); await p.waitForTimeout(150); await kies('met');
  const dovM = await download(() => dovExportGo());
  ok('DOV met: sleutels erin, manifest keysIncluded true', lekt(dovM).length === GEHEIM.length && JSON.parse(dovM).manifest.keysIncluded === true);
  ok('DOV: sj_ai_key nooit', !dovZ.includes(AI) && !dovM.includes(AI) && !JSON.stringify(await p.evaluate(() => dovBuildExport({}, true, null))).includes(AI));

  console.log('─── Handmatige back-up (Backup nu) ───');
  const bkZ = await download(() => { BK.choice = 'handmatig'; persistBK(); bkNow(); });
  ok('Backup nu (schuifje uit): direct, geen sleutel', lekt(bkZ).length === 0 && await p.evaluate(() => !document.getElementById('modal').classList.contains('on')));
  await p.evaluate(() => {
    window.__written = {};
    BK_DIR = { name: 'Nep', queryPermission: async () => 'granted', requestPermission: async () => 'granted',
      getFileHandle: async n => ({ createWritable: async () => ({ write: async d => { window.__written[n] = d; }, close: async () => {} }) }),
      values: async function* () { for (const n of Object.keys(window.__written)) yield { kind: 'file', name: n }; }, removeEntry: async n => { delete window.__written[n]; } };
    BK.choice = 'map'; persistBK(); bkNow();
  }); await p.waitForTimeout(300);
  const mapZ = await p.evaluate(() => Object.values(window.__written).join(''));
  ok('Backup nu met map-keuze (schuifje uit): in de map, zonder sleutel', mapZ.length > 100 && lekt(mapZ).length === 0, String(mapZ.length));

  console.log('─── Automatisch (schuifje uit) en veiligheidskopieën: zonder ───');
  const auto = await p.evaluate(async () => { window.__written = {}; await autoBackup(false); return Object.values(window.__written).join(''); });
  ok('automatische map-back-up: geen sleutel', auto.length > 100 && lekt(auto).length === 0 && !auto.includes(AI));
  const drive = await p.evaluate(async () => {
    const bodies = []; const keep = { driveToken, driveEnsureFolder, driveList, driveFetch };   // driveReady: productie-client-ID zit erin
    driveToken = async () => 'tok'; driveEnsureFolder = async () => { DRIVE.folderId = 'nep'; return 'nep'; }; driveList = async () => [];
    driveFetch = async (u, o) => { bodies.push(String((o && o.body) || '')); return new Response('{"id":"x"}', { status: 200 }); };
    BK.choice = 'drive'; let r; try { r = await driveBackup(false); } finally { Object.assign(window, keep); BK.choice = 'handmatig'; persistBK(); }
    return { r, body: bodies.join('') };
  });
  ok('automatische Drive-back-up: geen sleutel', drive.body.length > 100 && lekt(drive.body).length === 0 && !drive.body.includes(AI), JSON.stringify({ r: drive.r, n: drive.body.length }));
  ok('snapshotPayload (gedeeld door automatisch, Drive, map) zonder sleutel', lekt(JSON.stringify(await p.evaluate(() => snapshotPayload()))).length === 0);
  const snap = await p.evaluate(async () => { await Snapshots.create('spec'); const out = []; for (const m of SNAP_META) out.push(JSON.stringify(await IDB.get('snap_' + m.id))); return out.join(''); });
  ok('veiligheidskopie in IndexedDB: geen sleutel', snap.length > 100 && lekt(snap).length === 0 && !snap.includes(AI));
  const herst = await p.evaluate(async () => { const id = SNAP_META[0].id; await Snapshots.restore(id); await new Promise(r => setTimeout(r, 300)); return Object.fromEntries(Object.entries(CONNS).map(([k, c]) => [k, { c: !!c.connected, s: !!(c.apiSecret || c.wallet) }])); });
  ok('veiligheidskopie terugzetten op hetzelfde apparaat: koppelingen houden hun sleutels', Object.values(herst).every(x => x.c && x.s), JSON.stringify(herst));

  console.log('─── diagReport ───');
  const diag = JSON.stringify(await p.evaluate(() => diagReport()));
  ok('diagReport: geen enkele sleutel of wallet, geen sj_ai_key', lekt(diag).length === 0 && !diag.includes(AI), lekt(diag).join());

  console.log('─── Importeren ───');
  await H.wipe(p);
  await p.evaluate(d => dovImportModal(d, 'zonder.json'), Z); await p.waitForTimeout(150);
  await p.evaluate(async () => { await dovImportGo(); await new Promise(r => setTimeout(r, 600)); });
  const imp = await p.evaluate(() => ({ n: T.length, pb: Object.keys(PBOOK).length, tags: (tagConfig.customTags || []).length, man: MANUAL.length, conns: Object.fromEntries(Object.entries(CONNS).map(([k, c]) => [k, { c: !!c.connected, nk: !!c.needKey, h: c.hint }])), modal: document.getElementById('modal').innerText.replace(/\s+/g, ' ') }));
  ok('bestand zonder sleutels: trades en instellingen komen binnen', imp.n === VOL.trades.length && imp.pb === 4 && imp.tags > 0 && imp.man === VOL.manual.length, JSON.stringify(imp).slice(0, 200));
  ok('koppelingen staan op "sleutel nodig" (niet verbonden, hint bewaard)', Object.keys(NEP).every(id => imp.conns[id] && !imp.conns[id].c && imp.conns[id].nk && imp.conns[id].h), JSON.stringify(imp.conns));
  ok('samenvatting zegt: opnieuw verbinden', /opnieuw verbinden/.test(imp.modal), imp.modal.slice(0, 300));
  await p.evaluate(() => { closeForm(); go('instellingen'); setSetTab('accounts'); }); await p.waitForTimeout(200);
  const acc = await H.mainText(p);
  ok('Accounts toont "sleutel nodig" bij Blofin, OKX, Kraken en Hyperliquid', (acc.match(/sleutel nodig/g) || []).length >= 4, acc.slice(0, 400));
  await H.wipe(p);
  const oud = { ...VOL }; delete oud.manifest;   // oud formaat: snapshotPayload van vóór F12, sleutels erin
  await p.evaluate(d => dovImportModal(d, 'oud.json'), oud); await p.waitForTimeout(150);
  ok('oud bestand mét sleutels: import-kop zegt "bevat API-sleutels"', /bevat API-sleutels/.test(await H.modalText(p)));
  await p.evaluate(async () => { await dovImportGo(); await new Promise(r => setTimeout(r, 600)); closeForm(); });
  const oudR = await p.evaluate(() => Object.fromEntries(Object.entries(CONNS).map(([k, c]) => [k, { c: !!c.connected, k: c.apiKey || c.wallet || '' }])));
  ok('oud bestand mét sleutels: koppelingen werken weer (verbonden, sleutels terug)', Object.entries(NEP).every(([id, c]) => oudR[id] && oudR[id].c && oudR[id].k === (c.apiKey || c.wallet)), JSON.stringify(oudR));
  ok('sj_ai_key niet uit een bestand overgenomen', await p.evaluate(() => !localStorage.getItem('sj_ai_key')));

  console.log('─── Toestanden ───');
  // fout bij exporteren: het bestand maken mislukt → foutmelding, geen stempel
  const foutBk = await p.evaluate(() => BK.ts);
  await p.evaluate(() => { window.__echtURL = URL.createObjectURL; URL.createObjectURL = () => { throw new Error('nep-fout'); }; try { exportJSON(); } finally { URL.createObjectURL = window.__echtURL; } });
  ok('fout bij exporteren: melding "lukte niet", geen stempel', await p.evaluate(b0 => BK.ts === b0 && [...document.querySelectorAll('#toasts .toast')].some(t => /lukte niet/.test(t.textContent)), foutBk));
  // geen koppelingen: geen keuze nodig, wel zeggen dat er geen sleutels zijn
  await p.evaluate(() => { CONNS = {}; persistConns(); });
  const geen = await download(() => exportJSON());
  ok('geen koppelingen: exportJSON downloadt direct', JSON.parse(geen).trades.length === VOL.trades.length && !(await p.evaluate(() => document.getElementById('modal').classList.contains('on'))));
  ok('geen koppelingen: melding zegt dat er geen sleutels zijn', await p.evaluate(() => [...document.querySelectorAll('#toasts .toast')].some(t => /geen API-sleutels/.test(t.textContent))));
  await p.evaluate(() => exportOverzicht()); await p.waitForTimeout(150);
  const geenOv = await H.modalText(p);
  ok('geen koppelingen in Data overzetten: melding bovenaan "geen API-sleutels", geen keuze', await bovenaan() && /geen API-sleutels/.test(geenOv) && await p.evaluate(() => !document.querySelector('#modal input[name="sjKeys"]')), geenOv.slice(0, 200));
  await p.evaluate(() => closeForm());

  console.log('─── Licht, donker, 390px: de keuze in Data overzetten ───');
  await zaai();
  for (const th of ['light', 'dark']) {
    for (const w of [1360, 390]) {
      await p.setViewportSize({ width: w, height: 860 });
      await p.evaluate(t => { setTheme(t); exportOverzicht(); }, th); await p.waitForTimeout(250);
      const m = await p.evaluate(() => { const k = document.getElementById('sleutelKeuze'), r = k.getBoundingClientRect(), mod = document.getElementById('modal');
        return { top: r.top, bottom: r.bottom, vh: window.innerHeight, w: r.width, over: mod.scrollWidth > mod.clientWidth + 1, docOver: document.documentElement.scrollWidth > window.innerWidth + 1 }; });
      ok(`${th} ${w}px: keuze in beeld, geen horizontale scroll`, m.top >= 0 && m.bottom <= m.vh && m.w > 200 && !m.over && !m.docOver, JSON.stringify(m));
      await p.screenshot({ path: path.join(SHOTS, `export-sleutels-${th}-${w}.png`) });
      await p.evaluate(() => closeForm());
    }
  }
  ok('geen JS-fouten', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== Export-sleutels: ${pass}/${pass + fail} ===`); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
