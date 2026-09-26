// Import-keuze (docs/opdracht-data-overzetten.md §3.2): per onderdeel kiezen, vervangen of
// samenvoegen, ontbrekend onderdeel laat huidige data staan, controle achteraf, veiligheidskopie,
// oude-app-bestand via het overzetten-scherm met "gaat niet mee".
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const DS = require('./helpers/dov-datasets'); const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
(async () => {
  const b = await chromium.launch(); const { ctx, p, errs } = await H.openJournal(b);
  const VOL = DS.volledig();
  await H.seed(p, VOL);
  const exportAll = () => p.evaluate(() => { const sel = {}; DOV_PARTS.forEach(x => sel[x.k] = true); return dovBuildExport(sel, true); });
  const FILE = await exportAll();

  console.log('─── Modal: wat zit erin, wat heb je nu ───');
  await p.evaluate(d => dovImportModal(d, 'syncjournal-backup-2026-09-24.json'), FILE); await p.waitForTimeout(150);
  const mt = await H.modalText(p);
  ok('kop: bestandsnaam, versie, bevat API-sleutels, trades in bestand tegenover nu', /syncjournal-backup-2026-09-24\.json/.test(mt) && /v0\.9\.\d+/.test(mt) && /bevat API-sleutels/.test(mt) && /40 · netto/.test(mt) && /nu in je journal: 40/.test(mt), mt.slice(0, 300));
  ok('per onderdeel "in bestand" en "nu"; trades met vervangen/samenvoegen', await p.evaluate(() => document.querySelectorAll('#modal [data-dov]').length === 10 && !!document.getElementById('dovMode') && /40 in bestand/.test(document.querySelector('#modal [data-dov="trades"]').innerText)));
  ok('waarschuwing over sleutels alleen bij Exchange-koppelingen', /Ze worden alleen overgenomen als je Exchange-koppelingen aanvinkt/.test(mt));
  ok('toelichting vervangen', /Vervangen:/.test(await p.evaluate(() => document.getElementById('dovModeNote').innerText)));
  await p.evaluate(() => dovImpMode('samenvoegen'));
  ok('toelichting samenvoegen met aantal nieuw (0, alles is er al)', /Samenvoegen:.*0 nieuw/.test(await p.evaluate(() => document.getElementById('dovModeNote').innerText)));
  await p.evaluate(() => closeForm());

  console.log('─── Gedeeltelijk bestand: alleen playbooks en tags ───');
  const PART = { app: 'SyncJournal', appVersion: 'v0.9.135', schemaVersion: 8, exported: '2026-09-22T12:00:00Z', tagConfig: { ...FILE.tagConfig, customTags: ['van sebas'] }, pbook: { 'Sweep-reclaim': { ...FILE.pbook['London SFP'], name: 'Sweep-reclaim' } } };
  await p.evaluate(d => dovImportModal(d, 'playbooks-van-sebas.json'), PART); await p.waitForTimeout(150);
  const pt = await H.modalText(p);
  ok('ontbrekende onderdelen grijs: "niet in dit bestand, jouw huidige blijft staan"; geen trades in dit bestand', await p.evaluate(() => document.querySelectorAll('#modal .dov-na').length === 8) && /geen trades in dit bestand/.test(pt) && /zonder sleutels/.test(pt), pt.slice(0, 250));
  await p.evaluate(async () => { await dovImportGo(); await new Promise(r => setTimeout(r, 500)); });
  const after1 = await p.evaluate(() => ({ trades: T.length, pb: Object.keys(PBOOK).sort().join(), tags: tagConfig.customTags.join(), conns: Object.keys(CONNS).length, manual: MANUAL.length, modal: document.getElementById('modal').innerText.replace(/\s+/g, ' ') }));
  ok('trades, koppelingen en accounts onaangeraakt; playbooks vervangen door die uit het bestand; tags overgenomen', after1.trades === 40 && after1.pb === 'Sweep-reclaim' && after1.tags === 'van sebas' && after1.conns === 4 && after1.manual === 2, JSON.stringify(after1).slice(0, 200));
  ok('resultaat: geen controle op trades (niet overgenomen), samenvatting noemt playbooks en tags', /Controle geslaagd/.test(after1.modal) && /playbooks overgenomen/.test(after1.modal) && /tags overgenomen/.test(after1.modal), after1.modal.slice(0, 200));
  await p.evaluate(() => closeForm());
  await H.seed(p, VOL);   // terug naar de volledige staat

  console.log('─── Samenvoegen: nieuw erbij, dubbel en verwijderd overgeslagen ───');
  const MERGE = JSON.parse(JSON.stringify(FILE));
  const extra = [50, 51, 52, 53, 54].map(i => { const t = JSON.parse(JSON.stringify(FILE.trades[i % 40])); t.date = '2026-09-' + (10 + i - 50); t.pair = 'LINK/USDT'; t.srcId = 'blofin_new_' + i; t.pnl = 1; return t; });
  const weg = JSON.parse(JSON.stringify(FILE.trades[1])); weg.srcId = 'blofin_weg_1'; weg.date = '2026-08-01';   // staat in de prullenbak
  const dubbelHand = JSON.parse(JSON.stringify(FILE.trades.find(t => !t.srcId)));   // handmatige trade die er al is
  MERGE.trades = MERGE.trades.concat(extra, [weg, dubbelHand]);
  await p.evaluate(d => dovImportModal(d, 'merge.json'), MERGE); await p.evaluate(() => dovImpMode('samenvoegen'));
  ok('toelichting: 5 nieuw', /5 nieuw/.test(await p.evaluate(() => document.getElementById('dovModeNote').innerText)));
  await p.evaluate(async () => { await dovImportGo(); await new Promise(r => setTimeout(r, 500)); });
  const after2 = await p.evaluate(() => ({ n: T.length, link: T.filter(t => t.pair === 'LINK/USDT').length, weg: T.some(t => t.srcId === 'blofin_weg_1'), modal: document.getElementById('modal').innerText.replace(/\s+/g, ' '), pnl0: T[0].pnl, notes: T.filter(t => /ünïcödé/.test(t.notes || '')).length }));
  ok('45 trades: 40 van jou + 5 nieuw; prullenbak-guard en handmatige dubbel overgeslagen', after2.n === 45 && after2.link === 5 && !after2.weg, JSON.stringify({ n: after2.n, link: after2.link, weg: after2.weg }));
  ok('controle geslaagd met samenvoeg-samenvatting', /Controle geslaagd/.test(after2.modal) && /45 trades: 40 van jou \+ 5 nieuw/.test(after2.modal), after2.modal.slice(0, 200));
  ok('bestaande trades ongewijzigd (notities met unicode intact)', after2.notes > 0);
  await p.evaluate(() => closeForm());

  console.log('─── Vervangen zonder sleutels en zonder koppelingen ───');
  const NOKEYS = await p.evaluate(() => { const sel = {}; DOV_PARTS.forEach(x => sel[x.k] = true); return dovBuildExport(sel, false); });
  await p.evaluate(d => dovImportModal(d, 'gedeeld.json'), NOKEYS); await p.evaluate(() => dovImpToggle('exmeta', false));
  await p.evaluate(async () => { await dovImportGo(); await new Promise(r => setTimeout(r, 500)); });
  const after3 = await p.evaluate(() => ({ n: T.length, connected: Object.values(CONNS).filter(c => c.connected).length, hint: CONNS.blofin && CONNS.blofin.hint, val: EXMAP.blofin.val, modal: document.getElementById('modal').innerText.replace(/\s+/g, ' ') }));
  ok('koppelingen zonder sleutels tellen niet als verbonden, hint blijft; saldi niet overgenomen', after3.connected === 0 && after3.hint === '5533' && after3.val === 10527 && after3.n === 45, JSON.stringify(after3).slice(0, 200));
  ok('samenvatting: zonder sleutels (opnieuw verbinden), saldi overgeslagen', /zonder sleutels \(opnieuw verbinden\)/.test(after3.modal) && /saldi en accountnamen overgeslagen/.test(after3.modal), after3.modal.slice(0, 300));
  await p.evaluate(() => closeForm());
  await H.seed(p, VOL);

  console.log('─── Kapot bestand: controle rood, veiligheidskopie terug ───');
  const snapTs0 = await p.evaluate(() => (SNAP_META[0] || {}).ts || '');
  await p.evaluate(d => dovImportModal(d, 'kapot.json'), DS.kapot());
  await p.evaluate(async () => { await dovImportGo(); await new Promise(r => setTimeout(r, 500)); });
  const after4 = await p.evaluate(() => ({ modal: document.getElementById('modal').innerText.replace(/\s+/g, ' '), pnl3: T[3].pnl, snapLabel: (SNAP_META[0] || {}).label, snapTs: (SNAP_META[0] || {}).ts, last: DB.load('last_import', null) }));
  ok('controle mislukt: 2 trades met onleesbare P&L benoemd, niets kwijt', /Controle mislukt/.test(after4.modal) && /2 trades hebben een onleesbare P&L/.test(after4.modal) && /Er is niets kwijt/.test(after4.modal), after4.modal.slice(0, 250));
  ok('veiligheidskopie "vóór import" is gemaakt; last_import onthoudt de afwijking', after4.snapLabel === 'vóór import' && after4.snapTs !== snapTs0 && after4.last && after4.last.ok === false && after4.last.issues.length > 0, JSON.stringify(after4.last));
  ok('knop "Veiligheidskopie terugzetten" staat in de modal', /Veiligheidskopie terugzetten/.test(after4.modal));
  const pnlVoor = VOL.trades[3].pnl;
  await p.evaluate(async () => { const b = [...document.querySelectorAll('#modal button')].find(x => /Veiligheidskopie terugzetten/.test(x.textContent)); b.click(); await new Promise(r => setTimeout(r, 900)); });
  const after5 = await p.evaluate(() => ({ n: T.length, pnl3: T[3].pnl }));
  ok('terugzetten herstelt de staat van vóór de import (P&L van trade 3 weer intact)', after5.n === 40 && Math.abs(after5.pnl3 - pnlVoor) < 0.001, JSON.stringify(after5) + ' verwacht ' + pnlVoor);

  console.log('─── Oud TradeJournal-bestand: overzetten-scherm met "gaat niet mee" ───');
  const OUD = { version: 12, schemaVersion: 12, exportDate: '2026-09-10T10:00:00Z', trades: [{ id: 'a1', date: '2026-09-01', time: '10:00', pair: 'BTC/USDT', direction: 'long', entry: '60000', exit: '60500', stopLoss: '59500', positionSize: '1000', pnl: '8.3', setupTags: ['London SFP'], emotionTags: [], mistakeTags: [], source: 'manual', status: 'closed', complianceChecks: ['x'] }], tagConfig: { setupTags: ['London SFP'] }, accounts: [], config: { theme: 'sync' }, playbooks: [] };
  await p.evaluate(d => { const arr = d.trades; if (looksOldExport(arr)) migPreview(TJMigrate.mapExport(d), 'file'); }, OUD); await p.waitForTimeout(150);
  const ot = await H.modalText(p);
  ok('overzetten-scherm met de vaste regel "Gaat niet mee" (discipline, reflecties, mindset, mijlpalen, TP-templates)', /Controleer wat er wordt overgezet/.test(ot) && /Gaat niet mee/.test(ot) && /discipline-vinkjes, weekreflecties, mindset-voorkeuren, mijlpalen, TP-templates/.test(ot) && /Afgevinkte playbook-criteria bij entry komen als tekst/.test(ot), ot.slice(0, 300));
  await p.evaluate(() => closeForm());

  console.log('─── importJSON stuurt een nieuw bestand naar de keuze-modal ───');
  const tmp = path.resolve('tests/screenshots/_dov-tmp.json'); fs.writeFileSync(tmp, JSON.stringify(PART));
  const [chooser] = await Promise.all([p.waitForEvent('filechooser'), p.evaluate(() => importJSON())]);
  await chooser.setFiles(tmp); let mtxt = ''; for (let i = 0; i < 30 && !/Wat zit erin/.test(mtxt); i++) { await p.waitForTimeout(100); mtxt = await H.modalText(p); }
  ok('bestand kiezen → "Wat zit erin en wat neem je over?" met de bestandsnaam', /Wat zit erin en wat neem je over\?/.test(mtxt) && /_dov-tmp\.json/.test(mtxt), mtxt.slice(0, 120));
  await p.evaluate(() => closeForm()); try { fs.unlinkSync(tmp); } catch (e) {}

  ok('geen JS-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== Import-keuze: ${pass}/${pass + fail} ===`); await b.close(); process.exit(fail ? 1 : 0);
})();
