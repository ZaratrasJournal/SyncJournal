// Borgt fase 3 van het hosting-plan: Google Drive-backup, volledig offline getest via
// een nagemaakte Drive-API (snapshot-fixture-patroon) + fake Google Identity Services.
// Dekt: activatie via client-ID, koppelen (map + eerste upload), zelfde-dag-update i.p.v.
// duplicaat, retentie, mislukte upload stempelt niet, nieuwere-backup-check + overnemen,
// en de needsAuth-herverbind-banner.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
  const b = await chromium.launch(); const p = await b.newPage(); p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.setViewportSize({ width: 1700, height: 1000 });
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(600);
  await p.evaluate(() => { try { hideWelcome() } catch (e) {} });

  console.log('─── Productie-client-ID ingebakken ───');
  ok('Drive-kaart is standaard actief (client-ID hardcoded sinds v0.9.66)', await p.evaluate(() => { go('instellingen'); setSetTab('data'); const c = [...document.querySelectorAll('.bkchoice')].find(x => /☁️/.test(x.textContent)); return driveReady() && c && !c.disabled; }));

  console.log('─── Met client-ID + fake Drive-API ───');
  await p.evaluate(() => { localStorage.setItem('sj_drive_client_id', '"test-client-id"'); });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(600);
  await p.evaluate(() => {
    try { hideWelcome() } catch (e) {}
    T = [{ id: 1, date: '2026-09-16', time: '10:00', pair: 'BTC/USDT', dir: 'long', setup: '', session: 'London', status: 'closed', kind: 'live', exchange: '', entry: 100, exit: 110, stop: 95, size: '1000', pnl: 100, r: 2, tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] }];
    persist(); clearGFilter(); setFilter('kind', 'alle');
    // ── fake GIS + fake Drive REST ──
    window.__dv = { files: {}, nextId: 1, grants: 0, denyToken: false, failUpload: 0 };
    window.google = { accounts: { oauth2: { initTokenClient: (cfg) => ({ requestAccessToken: () => {
      if (window.__dv.denyToken) { (cfg.error_callback || cfg.callback)({}); return; }
      window.__dv.grants++; cfg.callback({ access_token: 'tok' + window.__dv.grants, expires_in: 3600 });
    } }) } } };
    const orig = window.fetch.bind(window);
    window.fetch = async (u, o) => {
      u = String(u); o = o || {};
      if (!u.includes('googleapis.com')) return orig(u, o);
      const dv = window.__dv; const J = (x, st) => new Response(JSON.stringify(x), { status: st || 200 });
      if (u.includes('/upload/')) {
        if (dv.failUpload > 0) { dv.failUpload--; return J({ error: 'boom' }, 500); }
        const m = u.match(/\/files\/([^?]+)\?uploadType=media/);
        if (m) { dv.files[m[1]].content = o.body; dv.files[m[1]].modifiedTime = new Date().toISOString(); return J({ id: m[1] }); }
        const nm = String(o.body).match(/"name":"([^"]+)"/)[1];
        const parts = String(o.body).split('\r\n\r\n'); const content = parts[2].split('\r\n--')[0];
        const id = 'f' + dv.nextId++; dv.files[id] = { id, name: nm, content, modifiedTime: new Date().toISOString() };
        return J({ id });
      }
      if (/\/files\/[^?]+\?alt=media/.test(u)) { const id = u.match(/\/files\/([^?]+)\?/)[1]; return new Response(dv.files[id].content, { status: 200 }); }
      if (/\/files\/[^?]+$/.test(u) && o.method === 'DELETE') { delete dv.files[u.match(/\/files\/([^?]+)$/)[1]]; return new Response(null, { status: 204 }); }
      if (u.includes('/files?q=')) {
        const q = decodeURIComponent(u);
        if (q.includes('folder')) return J({ files: window.__dv.folder ? [{ id: window.__dv.folder }] : [] });
        return J({ files: Object.values(dv.files).map(f => ({ id: f.id, name: f.name, modifiedTime: f.modifiedTime })) });
      }
      if (u.endsWith('/files') && o.method === 'POST') { window.__dv.folder = 'fold1'; return J({ id: 'fold1' }); }
      return J({}, 404);
    };
  });
  ok('client-ID aanwezig → Drive-kaart is actief', await p.evaluate(() => { go('instellingen'); setSetTab('data'); const c = [...document.querySelectorAll('.bkchoice')].find(x => /☁️/.test(x.textContent)); return driveReady() && c && !c.disabled; }));

  console.log('─── Koppelen + uploaden ───');
  await p.evaluate(() => bkChoose('drive')); await p.waitForTimeout(400);
  const conn = await p.evaluate(() => ({ choice: BK.choice, method: BK.method, folder: DRIVE.folderId, n: Object.keys(window.__dv.files).length, name: Object.values(window.__dv.files)[0]?.name, hasTrades: /"pair":"BTC\/USDT"/.test(Object.values(window.__dv.files)[0]?.content || '') }));
  ok('koppelen: map aangemaakt + eerste backup geüpload + gestempeld', conn.choice === 'drive' && conn.method === 'drive' && conn.folder === 'fold1' && conn.n === 1 && /^syncjournal-backup-\d{4}-\d{2}-\d{2}\.json$/.test(conn.name) && conn.hasTrades, JSON.stringify(conn));
  ok('kaart toont "gekoppeld"', await p.evaluate(() => { go('instellingen'); setSetTab('data'); return /gekoppeld/.test([...document.querySelectorAll('.bkchoice')].find(x => /☁️/.test(x.textContent)).textContent); }));
  ok('tweede backup dezelfde dag → update, geen duplicaat', await p.evaluate(async () => { const was = Object.keys(window.__dv.files).length; const r = await driveBackup(false); return r && Object.keys(window.__dv.files).length === was; }));
  ok('mislukte upload → geen stempel (alarm blijft eerlijk)', await p.evaluate(async () => { const was = BK.ts; window.__dv.failUpload = 1; await new Promise(r => setTimeout(r, 5)); const r = await driveBackup(false); return r === false && BK.ts === was; }));
  const ret = await p.evaluate(async () => {
    for (let i = 1; i <= 20; i++) { const id = 'old' + i; window.__dv.files[id] = { id, name: 'syncjournal-backup-2026-08-' + String(i).padStart(2, '0') + '.json', content: '{}', modifiedTime: '2026-08-01T00:00:00Z' }; }
    const r = await driveBackup(false);
    await new Promise(res => setTimeout(res, 300)); // retentie draait bewust async na de upload
    return { r, n: Object.keys(window.__dv.files).length, names: Object.values(window.__dv.files).map(f => f.name).sort().slice(0, 3), choice: BK.choice, folder: DRIVE.folderId };
  });
  ok('retentie: oude dagbestanden worden opgeruimd tot 14', ret.n <= 14, JSON.stringify(ret));

  console.log('─── Nieuwere backup op ander apparaat ───');
  const adopt = await p.evaluate(async () => {
    // simuleer: elders is een nieuwere backup gemaakt (andere trades, modifiedTime in de toekomst)
    const remote = JSON.stringify({ app: 'SyncJournal', trades: [{ id: 99, date: '2026-09-16', time: '20:00', pair: 'SOL/USDT', dir: 'long', setup: '', session: 'London', status: 'closed', kind: 'live', exchange: '', entry: 10, exit: 11, stop: 9, size: '100', pnl: 10, r: 1, tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] }] });
    window.__dv.files['fRemote'] = { id: 'fRemote', name: 'syncjournal-backup-2026-09-17.json', content: remote, modifiedTime: new Date(Date.now() + 3600e3).toISOString() };
    DB.save('data_ts', Date.now() - 86400e3); BK.ts = Date.now() - 86400e3;
    await driveStartupCheck(); await new Promise(r => setTimeout(r, 100));
    const banner = document.querySelector('.updbanner');
    return { adopt: !!DRIVE.adopt, bannerText: banner ? banner.textContent.slice(0, 60) : '' };
  });
  ok('startup-check ziet nieuwere Drive-backup → overneem-banner', adopt.adopt && /nieuwere backup/.test(adopt.bannerText), JSON.stringify(adopt));
  ok('Overnemen: veiligheidskopie eerst, data vervangen, banner weg', await p.evaluate(async () => { const snaps = SNAP_META.length; await driveAdopt(); await new Promise(r => setTimeout(r, 200)); return !DRIVE.adopt && T.length === 1 && T[0].pair === 'SOL/USDT' && SNAP_META.length === snaps + 1; }));

  console.log('─── Toestemming verlopen ───');
  ok('geweigerde token → herverbind-banner met knop', await p.evaluate(async () => { DRIVE.token = null; DRIVE.tokenExp = 0; window.__dv.denyToken = true; const r = await driveBackup(false); render(); const bn = [...document.querySelectorAll('.bkbanner')].find(x => /toestemming/.test(x.textContent)); return r === false && DRIVE.needsAuth && bn && /Opnieuw verbinden/.test(bn.textContent); }));
  ok('opnieuw verbinden (met toestemming) → backup werkt weer', await p.evaluate(async () => { window.__dv.denyToken = false; const r = await driveBackup(true); return r === true && !DRIVE.needsAuth; }));

  ok('geen JS-errors totaal', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== Drive-backup (fase 3): ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
