// Schuifje "API-sleutels in back-ups" (Instellingen → Data, besluit Zaratras 30-10-2026; vervolg op F12).
// Standaard uit: dan gaan sleutels nergens mee. Aan (na één bevestiging in de pagina): exchange-sleutels en
// het walletadres gaan mee in Exporteer JSON, Backup nu, de map-back-up, en staan voorgekozen in Data
// overzetten. Google Drive alleen met een eigen vinkje; de Mori-sleutel alleen met een eigen vinkje en
// nooit als hij "alleen voor deze sessie" is. Veiligheidskopieën in IndexedDB altijd zonder. Het schuifje
// zelf gaat niet mee in een back-up. Alleen nep-sleutels; niets gaat het netwerk op.
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const DS = require('./helpers/dov-datasets'); const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const NEP = {
  blofin: { apiKey: 'NEPKEY-BLOFIN-s1', apiSecret: 'NEPSEC-BLOFIN-s2', passphrase: 'NEPPASS-BLOFIN-s3' },
  okx: { apiKey: 'NEPKEY-OKX-s4', apiSecret: 'NEPSEC-OKX-s5', passphrase: 'NEPPASS-OKX-s6' },
  kraken: { apiKey: 'NEPKEY-KRAKEN-s7', apiSecret: 'NEPSEC-KRAKEN-s8' },
  hyperliquid: { wallet: '0xNEPWALLET000000000000000000000000000s9' },
};
const AI = 'sk-ant-api03-NEP-schuif-mori-sleutel';
const GEHEIM = Object.values(NEP).flatMap(o => Object.values(o));
const lekt = s => GEHEIM.filter(x => String(s).includes(x));
const conns = () => Object.fromEntries(Object.entries(NEP).map(([id, c]) => [id, { connected: true, autoSync: false, hint: (c.apiKey || c.wallet).slice(-4), ...c }]));
const SHOTS = path.resolve('docs/sleutels-schuif-screenshots'); fs.mkdirSync(SHOTS, { recursive: true });

(async () => {
  const b = await chromium.launch();
  const { p, errs } = await H.openJournal(b);
  const VOL = DS.volledig(); VOL.conns = conns();
  await H.seed(p, VOL); await p.evaluate(k => localStorage.setItem('sj_ai_key', k), AI);
  const download = async (fn) => { const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }), p.evaluate(fn)]); return fs.readFileSync(await dl.path(), 'utf8'); };
  // nep-map (FSA) en nep-Drive: vangen wat er geschreven wordt
  await p.evaluate(() => {
    window.__written = {};
    BK_DIR = { name: 'Nep', queryPermission: async () => 'granted', requestPermission: async () => 'granted',
      getFileHandle: async n => ({ createWritable: async () => ({ write: async d => { window.__written[n] = d; }, close: async () => {} }) }),
      values: async function* () { for (const n of Object.keys(window.__written)) yield { kind: 'file', name: n }; }, removeEntry: async n => { delete window.__written[n]; } };
    window.__mapNu = async () => { window.__written = {}; const was = BK.choice; BK.choice = 'map'; await autoBackup(false); BK.choice = was; return Object.values(window.__written).join(''); };
    window.__driveNu = async () => { const bodies = []; const keep = { driveToken, driveEnsureFolder, driveList, driveFetch };
      driveToken = async () => 'tok'; driveEnsureFolder = async () => { DRIVE.folderId = 'nep'; return 'nep'; }; driveList = async () => [];
      driveFetch = async (u, o) => { bodies.push(String((o && o.body) || '')); return new Response('{"id":"x"}', { status: 200 }); };
      const was = BK.choice; BK.choice = 'drive'; _bkLastPayload = ''; try { await driveBackup(false); } finally { Object.assign(window, keep); BK.choice = was; }
      return bodies.join(''); };
    window.__snapNu = async () => { await Snapshots.create('spec'); return JSON.stringify(await IDB.get('snap_' + SNAP_META[0].id)); };
  });
  const data = async () => { await p.evaluate(() => { closeForm(); go('instellingen'); setSetTab('data'); }); await p.waitForTimeout(150); };
  const rij = () => p.evaluate(() => { const r = document.getElementById('bkKeysRow'); return r ? r.innerText.replace(/\s+/g, ' ') : ''; });

  console.log('─── Standaard: uit ───');
  await data();
  ok('Data-tab: schuifje "API-sleutels in back-ups", standaard uit', /API-sleutels in back-ups/.test(await rij()) && await p.evaluate(() => { const s = document.querySelector('#bkKeysRow [role="switch"]'); return !!s && s.getAttribute('aria-checked') === 'false'; }));
  ok('uit: export, map, Drive, veiligheidskopie zonder sleutels en zonder Mori-sleutel', await (async () => {
    const e = await download(() => exportJSON()); const m = await p.evaluate(() => __mapNu()); const d = await p.evaluate(() => __driveNu()); const s = await p.evaluate(() => __snapNu());
    return [e, m, d, s].every(x => x.length > 100 && lekt(x).length === 0 && !x.includes(AI));
  })());
  ok('uit: exporteren vraagt niets meer (geen venster)', await p.evaluate(() => !document.getElementById('modal').classList.contains('on')));
  ok('uit: melding na exporteren zegt "zonder API-sleutels"', await p.evaluate(() => [...document.querySelectorAll('#toasts .toast')].some(t => /zonder API-sleutels/.test(t.textContent))));
  ok('Data-tab noemt "Zonder API-sleutels · wijzig in Instellingen → Data"', /Zonder API-sleutels · wijzig in Instellingen → Data/.test(await H.mainText(p)));

  console.log('─── Aanzetten: één bevestiging in de pagina ───');
  let dialogen = 0; p.on('dialog', () => dialogen++);
  await p.click('#bkKeysRow [role="switch"]'); await p.waitForTimeout(150);
  const bev = await p.evaluate(() => (document.getElementById('bkKeysBevestig') || {}).innerText || '');
  ok('waarschuwing in de pagina, nog niet aan', /Iedereen met een back-up-bestand kan dan je exchange-account gebruiken/.test(bev) && /alleen-lezen-sleutels/.test(bev) && await p.evaluate(() => !bkKeysAan()), bev);
  await p.click('#bkKeysBevestig [data-annuleer]'); await p.waitForTimeout(100);
  ok('annuleren: blijft uit', await p.evaluate(() => !bkKeysAan() && !document.getElementById('bkKeysBevestig')));
  await p.click('#bkKeysRow [role="switch"]'); await p.waitForTimeout(100); await p.click('#bkKeysBevestig [data-bevestig]'); await p.waitForTimeout(150);
  ok('bevestigd: aan, zonder browser-dialoog', await p.evaluate(() => bkKeysAan()) && dialogen === 0);
  ok('bewaard per apparaat onder sj_bk_sleutels', await p.evaluate(() => JSON.parse(localStorage.getItem('sj_bk_sleutels') || '{}').aan === true));

  console.log('─── Aan: handmatig en map mét, Drive en Mori nog niet ───');
  const e1 = await download(() => exportJSON());
  ok('Exporteer (exportJSON): alle sleutels en het walletadres, geen venster', lekt(e1).length === GEHEIM.length && await p.evaluate(() => !document.getElementById('modal').classList.contains('on')), lekt(e1).length + '/' + GEHEIM.length);
  ok('melding na exporteren zegt "met API-sleutels"', await p.evaluate(() => [...document.querySelectorAll('#toasts .toast')].some(t => /met API-sleutels/i.test(t.textContent))));
  const bk1 = await download(() => { BK.choice = 'handmatig'; bkNow(); });
  ok('Backup nu (zelf): met sleutels', lekt(bk1).length === GEHEIM.length);
  ok('map-back-up: met sleutels', lekt(await p.evaluate(() => __mapNu())).length === GEHEIM.length);
  ok('back-up-status zegt "met API-sleutels"', await (async () => { await data(); return /Laatste backup.*met API-sleutels/.test(await H.mainText(p)); })());
  ok('Data-tab noemt "🔑 Met API-sleutels · wijzig in Instellingen → Data"', /🔑 Met API-sleutels · wijzig in Instellingen → Data/.test(await H.mainText(p)));
  ok('Drive zonder het Drive-vinkje: geen sleutels', lekt(await p.evaluate(() => __driveNu())).length === 0);
  ok('Mori-sleutel zonder het Mori-vinkje: niet mee', !e1.includes(AI) && !bk1.includes(AI));
  await p.evaluate(() => exportOverzicht()); await p.waitForTimeout(150);
  ok('Data overzetten: eigen keuze, voorgekozen op "met"', await p.evaluate(() => _dovExp.keys === true && document.querySelector('#modal input[name="sjKeys"][value="met"]').checked));
  await data();

  console.log('─── Drive-vinkje ───');
  ok('Drive niet gekoppeld: vinkje uit te schakelen met uitleg', await p.evaluate(() => { BK.choice = 'handmatig'; render(); const c = document.getElementById('bkKeysDrive'); return !!c && c.disabled; }) && /Koppel eerst Google Drive/.test(await rij()));
  await p.evaluate(() => { BK.choice = 'drive'; render(); }); await p.waitForTimeout(100);
  ok('uitleg: een kopie in de cloud', /kopie in de cloud/.test(await rij()));
  await p.click('#bkKeysDrive'); await p.waitForTimeout(100);
  const dr = await p.evaluate(() => __driveNu());
  ok('met Drive-vinkje: Drive-back-up mét sleutels, nog zonder Mori-sleutel', lekt(dr).length === GEHEIM.length && !dr.includes(AI));

  console.log('─── Mori-vinkje ───');
  await p.click('#bkKeysMori'); await p.waitForTimeout(100);
  const e2 = await download(() => exportJSON()); const m2 = await p.evaluate(() => __mapNu()); const d2 = await p.evaluate(() => __driveNu());
  ok('met Mori-vinkje: in export, map en Drive', e2.includes(AI) && m2.includes(AI) && d2.includes(AI));
  await p.click('#bkKeysDrive'); await p.waitForTimeout(100);
  ok('Drive-vinkje weer uit: Drive krijgt ook de Mori-sleutel niet', !(await p.evaluate(() => __driveNu())).includes(AI));
  await p.click('#bkKeysDrive'); await p.waitForTimeout(100);
  await p.evaluate(k => { localStorage.removeItem('sj_ai_key'); sessionStorage.setItem('sj_ai_key', k); }, AI);
  const e3 = await download(() => exportJSON());
  ok('sessie-sleutel ("alleen voor deze sessie") gaat nooit mee', !e3.includes(AI) && !(await p.evaluate(() => __mapNu())).includes(AI));
  await data();
  ok('Mori-vinkje legt uit dat een sessie-sleutel niet meegaat', /alleen voor deze sessie/.test(await rij()));
  await p.evaluate(k => { sessionStorage.removeItem('sj_ai_key'); localStorage.setItem('sj_ai_key', k); }, AI);

  console.log('─── Altijd zonder ───');
  const s = await p.evaluate(() => __snapNu());
  ok('veiligheidskopie in IndexedDB: geen sleutels en geen Mori-sleutel, ook met alles aan', lekt(s).length === 0 && !s.includes(AI));
  const diag = JSON.stringify(await p.evaluate(() => diagReport()));
  ok('diagReport: geen sleutels', lekt(diag).length === 0 && !diag.includes(AI));
  ok('het schuifje zelf gaat niet mee in een back-up', !/bk_sleutels|"aan":true,"drive"/.test(e2) && !('bkSleutels' in JSON.parse(e2)));

  console.log('─── Importeren ───');
  await H.wipe(p);
  ok('na wissen: schuifje weer uit, geen Mori-sleutel', await p.evaluate(() => !bkKeysAan() && !localStorage.getItem('sj_ai_key')));
  await p.evaluate(d => dovImportModal(d, 'met.json'), JSON.parse(e2)); await p.waitForTimeout(150);
  await p.evaluate(async () => { await dovImportGo(); await new Promise(r => setTimeout(r, 500)); closeForm(); });
  const im = await p.evaluate(() => ({ c: Object.values(CONNS).filter(c => c.connected && (c.apiSecret || c.wallet)).length, ai: localStorage.getItem('sj_ai_key'), aan: bkKeysAan() }));
  ok('import mét sleutels: koppelingen verbonden, Mori-sleutel terug (er stond er geen)', im.c === 4 && im.ai === AI, JSON.stringify(im));
  ok('import zet het schuifje niet aan', !im.aan);
  await p.evaluate(() => { localStorage.setItem('sj_ai_key', 'sk-ant-api03-NEP-al-aanwezig'); });
  await p.evaluate(d => dovImportModal(d, 'met.json'), JSON.parse(e2)); await p.waitForTimeout(150);
  await p.evaluate(async () => { await dovImportGo(); await new Promise(r => setTimeout(r, 500)); closeForm(); });
  ok('bestaande Mori-sleutel wordt nooit overschreven', await p.evaluate(() => localStorage.getItem('sj_ai_key') === 'sk-ant-api03-NEP-al-aanwezig'));
  await p.evaluate(() => { localStorage.removeItem('sj_ai_key'); sessionStorage.setItem('sj_ai_key', 'sk-ant-api03-NEP-sessie'); });
  await p.evaluate(d => dovImportModal(d, 'met.json'), JSON.parse(e2)); await p.waitForTimeout(150);
  await p.evaluate(async () => { await dovImportGo(); await new Promise(r => setTimeout(r, 500)); closeForm(); });
  ok('ook een sessie-sleutel wordt niet overschreven', await p.evaluate(() => !localStorage.getItem('sj_ai_key') && sessionStorage.getItem('sj_ai_key') === 'sk-ant-api03-NEP-sessie'));
  await p.evaluate(() => sessionStorage.removeItem('sj_ai_key'));

  console.log('─── Uitzetten direct; lege staat ───');
  await p.evaluate(() => { bkKeysZet(true); }); await data();
  await p.click('#bkKeysRow [role="switch"]'); await p.waitForTimeout(100);
  ok('uitzetten mag direct', await p.evaluate(() => !bkKeysAan() && !document.getElementById('bkKeysBevestig')));
  await p.evaluate(() => { CONNS = {}; persistConns(); render(); }); await p.waitForTimeout(100);
  ok('geen sleutels opgeslagen: schuifje zichtbaar met "Je hebt nu geen API-sleutels opgeslagen"', /Je hebt nu geen API-sleutels opgeslagen/.test(await rij()) && await p.evaluate(() => !!document.querySelector('#bkKeysRow [role="switch"]')));

  console.log('─── Screenshots: licht en donker, 1280 en 390 ───');
  await H.seed(p, VOL); await p.evaluate(k => localStorage.setItem('sj_ai_key', k), AI);
  for (const th of ['light', 'dark']) for (const w of [1280, 390]) {
    await p.setViewportSize({ width: w, height: 900 });
    await p.evaluate(t => { setTheme(t); bkKeysZet(true); BK.choice = 'drive'; go('instellingen'); setSetTab('data'); }, th); await p.waitForTimeout(250);
    const m = await p.evaluate(() => { const r = document.getElementById('bkKeysRow'); r.scrollIntoView({ block: 'center' }); const b = r.getBoundingClientRect(); return { w: b.width, over: document.documentElement.scrollWidth > window.innerWidth + 1 }; });
    ok(`${th} ${w}px: rij in beeld, geen horizontale scroll`, m.w > 200 && !m.over, JSON.stringify(m));
    await p.waitForTimeout(100); await p.screenshot({ path: path.join(SHOTS, `data-${th}-${w}.png`) });
    if (w === 390) { await p.evaluate(() => { bkKeysZet(false); render(); }); await p.click('#bkKeysRow [role="switch"]'); await p.waitForTimeout(150);
      await p.evaluate(() => document.getElementById('bkKeysRow').scrollIntoView({ block: 'center' })); await p.screenshot({ path: path.join(SHOTS, `bevestigen-${th}-390.png`) }); }
  }
  ok('geen JS-fouten', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== Sleutels-schuif: ${pass}/${pass + fail} ===`); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
