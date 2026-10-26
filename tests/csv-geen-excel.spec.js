// C4 · Excel-bestanden worden niet meer ingelezen (besluit Zaratras, 26-10-2026).
//
// Het enige externe script van de app (xlsx@0.18.5 van cdn.jsdelivr.net) is weg. Leden die hun
// MEXC-historie als .xlsx exporteren mogen niet vastlopen: kiezen ze toch een .xlsx of .xls, dan
// importeert de journal niets en zegt hij hoe het wel kan (opslaan als CSV). Een CSV werkt gewoon.
//
// Draai: node tests/csv-geen-excel.spec.js
const fs = require('fs'); const path = require('path');
const { chromium } = require('playwright'); const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const MELDING = 'Open het in Excel of Google Sheets en kies Opslaan als → CSV';
// Begin van een echt .xlsx-bestand (zip) en van een oud .xls-bestand (OLE): genoeg om als binair bestand te gelden.
const XLSX = Buffer.concat([Buffer.from('504b0304140006000800', 'hex'), Buffer.alloc(200, 7)]);
const XLS = Buffer.concat([Buffer.from('d0cf11e0a1b11ae1', 'hex'), Buffer.alloc(200, 3)]);

(async () => {
  const b = await chromium.launch();
  const ctxReq = [];
  const { p, errs } = await H.openJournal(b, { timezoneId: 'Europe/Amsterdam', init: () => {
    // vastleggen welke externe scripts de pagina probeert te laden, ook als het netwerk dicht is
    window.__scripts = []; new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.tagName === 'SCRIPT' && n.src) window.__scripts.push(n.src); })))
      .observe(document, { childList: true, subtree: true });
  } });
  p.on('request', r => ctxReq.push(r.url()));
  await H.reload(p);   // the listener exists only after the first load; load again so every request is seen
  await p.evaluate(() => { setFilter('kind', 'alle'); });

  console.log('─── geen extern script ───');
  const scripts = await p.evaluate(() => [...document.querySelectorAll('script[src]')].map(s => s.src).concat(window.__scripts));
  ok('geen <script src> meer in de app', !scripts.length, scripts.join(', '));
  ok('niets opgevraagd bij cdn.jsdelivr.net', !ctxReq.some(u => /jsdelivr/.test(u)), ctxReq.filter(u => /jsdelivr/.test(u)).join(', '));
  ok('de app kent geen XLSX-bibliotheek meer', await p.evaluate(() => typeof XLSX === 'undefined'));

  console.log('─── het importveld ───');
  await p.evaluate(() => { STATE.setTab = 'accounts'; go('instellingen'); });
  await p.waitForSelector('#csvFileInp', { state: 'attached', timeout: 5000 });
  const veld = await p.evaluate(() => { const i = document.getElementById('csvFileInp'); return { accept: i.accept, tekst: i.closest('.panel').innerText }; });
  ok('het bestandsveld accepteert alleen .csv', veld.accept === '.csv', veld.accept);
  ok('de tekst bij het veld noemt CSV, niet XLSX', /Trade-history importeren \(CSV\)/.test(veld.tekst) && !/XLSX/i.test(veld.tekst), veld.tekst.slice(0, 120));

  for (const [naam, buf] of [['mexc-history.xlsx', XLSX], ['MEXC History.XLS', XLS]]) {
    console.log(`─── ${naam} ───`);
    const voor = await p.evaluate(() => T.length);
    await p.setInputFiles('#csvFileInp', { name: naam, mimeType: 'application/octet-stream', buffer: buf });
    await p.waitForSelector('[data-csvk="excel"]', { timeout: 5000 }).catch(() => {});
    const m = await H.modalText(p);
    ok(`${naam}: melding dat het een Excel-bestand is`, /Dit is een Excel-bestand/.test(m) && m.includes(MELDING) && /lees dat bestand hier in/.test(m), m.slice(0, 200));
    ok(`${naam}: de melding noemt het bestand`, m.includes(naam), m.slice(0, 200));
    ok(`${naam}: geen accountkeuze, geen import`, !(await p.$('#csvkGo')) && (await p.evaluate(() => T.length)) === voor);
    await p.evaluate(() => closeForm());
  }

  console.log('─── een MEXC-export als CSV werkt nog ───');
  await p.setInputFiles('#csvFileInp', { name: 'mexc-futures.csv', mimeType: 'text/csv', buffer: fs.readFileSync(path.join('tests', 'fixtures-csv', 'mexc-futures.csv')) });
  await p.waitForSelector('#csvkGo', { timeout: 5000 }).catch(() => {});
  const m = await H.modalText(p);
  ok('MEXC-CSV herkend, met accountkeuze', /Herkend: MEXC futures-historie · 2 trades/.test(m) && !!(await p.$('#csvkGo')), m.slice(0, 160));
  const voor = await p.evaluate(() => T.length);
  await p.click('#csvkGo'); await p.waitForFunction(n => T.length > n, voor, { timeout: 5000 }).catch(() => {});
  ok('MEXC-CSV: 2 trades geïmporteerd', (await p.evaluate(() => T.length)) === voor + 2);

  console.log('─── FAQ ───');
  const faqTekst = fs.readFileSync('work/syncjournal.html', 'utf8').match(/\['Hoe importeer ik een CSV-bestand\?','([^']*)'/);
  ok('FAQ: exporteren als CSV, niet "CSV of XLSX"', faqTekst && !/XLSX/.test(faqTekst[1]), faqTekst && faqTekst[1].slice(0, 200));
  ok('FAQ: een MEXC-Excel-export eerst opslaan als CSV', faqTekst && /MEXC/.test(faqTekst[1]) && /Excel/.test(faqTekst[1]) && /Opslaan als/.test(faqTekst[1]), faqTekst && faqTekst[1].slice(0, 200));

  ok('geen JS-fouten', errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n=== CSV zonder Excel: ${pass}/${pass + fail} ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
