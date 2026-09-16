// Borgt fase 1 van het hosting-plan (Denny 2026-09-16): backup-status met stempel per
// geslaagde backup, app-breed alarm na de drempel (standaard 3 dagen, rood na 7),
// gratieperiode voor nieuwe gebruikers, snooze van 24u, keuze lokaal-automatisch (FSA-map,
// getest via fake handle) / handmatig, retentie van 14 dagbestanden.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const DAY = 86400e3;
(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
  const b = await chromium.launch(); const p = await b.newPage(); p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.setViewportSize({ width: 1700, height: 1000 });
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(600);
  await p.evaluate(() => {
    try { hideWelcome() } catch (e) {}
    T = [{ id: 1, date: '2026-09-12', time: '10:00', pair: 'BTC/USDT', dir: 'long', setup: '', session: 'London', status: 'closed', kind: 'live', exchange: '', entry: 100, exit: 110, stop: 95, size: '1000', pnl: 100, r: 2, tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] }];
    persist(); clearGFilter(); setFilter('kind', 'alle'); go('dashboard');
  });
  ok('boot zonder JS-errors', errs.length === 0, errs.slice(0, 2).join(' | '));

  console.log('─── Alarm-logica ───');
  ok('verse gebruiker: gratieperiode → geen banner', await p.evaluate(() => !document.querySelector('.bkbanner')));
  ok('nooit backup + app ouder dan drempel → banner "geen backup"', await p.evaluate((d) => { BK.first = Date.now() - 4 * d; render(); const bn = document.querySelector('.bkbanner'); return bn && /geen backup/.test(bn.textContent) && !bn.classList.contains('red'); }, DAY));
  ok('banner op élke pagina (ook Trades)', await p.evaluate(() => { go('trades'); return !!document.querySelector('.bkbanner'); }));
  ok('backup 4 dagen oud → amber met dagen-telling', await p.evaluate((d) => { BK.ts = Date.now() - 4 * d; BK.method = 'handmatig'; render(); const bn = document.querySelector('.bkbanner'); return bn && /4 dagen/.test(bn.textContent) && !bn.classList.contains('red'); }, DAY));
  ok('8 dagen oud → rood', await p.evaluate((d) => { BK.ts = Date.now() - 8 * d; render(); const bn = document.querySelector('.bkbanner'); return bn && bn.classList.contains('red'); }, DAY));
  ok('drempel op 14 → 4 dagen oud is stil', await p.evaluate((d) => { BK.ts = Date.now() - 4 * d; bkSetThreshold(14); const stil = !document.querySelector('.bkbanner'); bkSetThreshold(3); return stil; }, DAY));
  ok('snooze verbergt 24u, verlopen snooze → terug', await p.evaluate((d) => { BK.ts = Date.now() - 4 * d; render(); bkSnooze(); const weg = !document.querySelector('.bkbanner'); BK.snooze = Date.now() - 1000; render(); return weg && !!document.querySelector('.bkbanner'); }, DAY));
  ok('geen trades → nooit een banner', await p.evaluate(() => { const hold = T; T = []; render(); const stil = !document.querySelector('.bkbanner'); T = hold; render(); return stil; }));

  console.log('─── Stempelen ───');
  ok('exportJSON stempelt (methode handmatig) en dooft de banner', await p.evaluate(() => { exportJSON(); const s = DB.load('backup', {}); return s.ts > Date.now() - 5000 && s.method === 'handmatig' && !document.querySelector('.bkbanner'); }));
  ok('interne veiligheidskopie stempelt NIET', await p.evaluate(async () => { const was = BK.ts; await Snapshots.create('test'); return BK.ts === was; }));

  console.log('─── Instellingen → Data ───');
  await p.evaluate(() => { go('instellingen'); setSetTab('data'); }); await p.waitForTimeout(200);
  ok('status-regel + drie keuzekaarten (Drive uitgeschakeld als binnenkort)', await p.evaluate(() => { const t = document.getElementById('main').textContent; const cards = document.querySelectorAll('.bkchoice'); const drive = [...cards].find(c => /☁️/.test(c.textContent)); return /Laatste backup/.test(t) && cards.length === 3 && drive && drive.disabled && /binnenkort/.test(drive.textContent); }));
  ok('standaard-keuze is handmatig', await p.evaluate(() => [...document.querySelectorAll('.bkchoice')].find(c => /handmatig/i.test(c.textContent)).classList.contains('on')));

  console.log('─── Automatische map-backup (fake FSA-handle) ───');
  const auto = await p.evaluate(async () => {
    window.__written = {};
    BK_DIR = { name: 'FakeBackups',
      queryPermission: async () => 'granted', requestPermission: async () => 'granted',
      getFileHandle: async (n) => ({ createWritable: async () => ({ write: async (d) => { window.__written[n] = d; }, close: async () => {} }) }),
      values: async function* () { for (const n of Object.keys(window.__written)) yield { kind: 'file', name: n }; },
      removeEntry: async (n) => { delete window.__written[n]; } };
    BK.choice = 'map'; persistBK();
    const okr = await autoBackup(true);
    const name = Object.keys(window.__written)[0] || '';
    const parsed = name ? JSON.parse(window.__written[name]) : null;
    return { okr, name, trades: parsed && Array.isArray(parsed.trades) ? parsed.trades.length : -1, method: BK.method };
  });
  ok('autoBackup schrijft gedateerd JSON-bestand met alle trades', auto.okr && /^syncjournal-backup-\d{4}-\d{2}-\d{2}\.json$/.test(auto.name) && auto.trades >= 1, JSON.stringify(auto));
  ok('map-backup stempelt de status (methode map)', auto.method === 'map');
  ok('retentie: houdt de laatste 14 dagbestanden', await p.evaluate(async () => {
    for (let i = 1; i <= 20; i++) window.__written['syncjournal-backup-2026-08-' + String(i).padStart(2, '0') + '.json'] = '{}';
    await bkRetention();
    const names = Object.keys(window.__written).sort();
    return names.length === 14 && !names.includes('syncjournal-backup-2026-08-01.json');
  }));
  ok('map zonder toestemming → geen stempel, eerlijke mislukking', await p.evaluate(async () => { const was = BK.ts; BK_DIR.queryPermission = async () => 'denied'; const r = await autoBackup(false); BK_DIR.queryPermission = async () => 'granted'; return r === false && BK.ts === was; }));
  ok('bkNow met map-keuze schrijft via de map', await p.evaluate(async () => { window.__written = {}; bkNow(); await new Promise(r => setTimeout(r, 200)); return Object.keys(window.__written).length === 1; }));

  console.log('─── Persistentie ───');
  await p.evaluate(() => { BK.threshold = 5; persistBK(); });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(600);
  ok('drempel + keuze overleven reload', await p.evaluate(() => BK.threshold === 5 && BK.choice === 'map' && BK.ts > 0));

  ok('geen JS-errors totaal', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== Backup-bewaking: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
