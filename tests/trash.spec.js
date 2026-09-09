// Borgt de prullenbak: verwijderen → TRASH (aparte lijst, telt nergens mee), undo-toast,
// terugzetten/definitief/legen in Instellingen → Data, 30-dagen-purge, sync-dedupe,
// export/import met trash-veld, persistentie via IndexedDB over een reload heen.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const mk = (id) => ({ id, date: '2026-09-0' + (1 + (id % 8)), time: '10:1' + (id % 9), pair: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'][id % 3], dir: id % 2 ? 'long' : 'short', setup: 'Trend-pullback', session: 'London', grade: 'A', exchange: 'mexc', status: 'closed', kind: 'live', entry: 100, stop: 95, tp: 110, exit: 108, size: 5000, rrPlanned: 2, mae: 0.4, mfe: 2, durationMin: 60, emotion: 'Kalm', tvLinks: [], screenshots: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], pnl: 100, r: 1 });
(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
  const b = await chromium.launch(); const p = await b.newPage(); p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.setViewportSize({ width: 1600, height: 1000 });
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  await p.evaluate(() => { try { hideWelcome() } catch (e) {} });
  const rows = []; for (let i = 0; i < 10; i++) rows.push(mk(i));
  await p.evaluate((rows) => { T = rows; TRASH = []; persist(); persistTrash(); clearGFilter(); setFilter('kind', 'alle'); go('trades'); }, rows);
  await p.waitForTimeout(300);
  ok('boot + seed zonder fout', errs.length === 0, errs.join(' | '));

  console.log('─── Verwijderen → prullenbak + undo ───');
  await p.evaluate(() => delTrade(3));
  await p.waitForTimeout(200);
  ok('trade uit T, in TRASH (met deletedAt)', await p.evaluate(() => T.length === 9 && TRASH.length === 1 && TRASH[0].id === 3 && TRASH[0].deletedAt > 0));
  ok('undo-toast met actieknop zichtbaar', await p.evaluate(() => { const t = document.querySelector('#toasts .toast .tact'); return t && /Ongedaan/.test(t.textContent); }));
  await p.evaluate(() => document.querySelector('#toasts .toast .tact').click());
  await p.waitForTimeout(200);
  ok('undo zet trade terug (deletedAt weg)', await p.evaluate(() => T.length === 10 && TRASH.length === 0 && !T.find(t => t.id === 3).deletedAt));

  console.log('─── Bulk + paneel in Instellingen → Data ───');
  await p.evaluate(() => { STATE.selected = [1, 4, 7]; bulkDelete(); });
  await p.waitForTimeout(200);
  ok('bulk: 3 naar prullenbak, selectie leeg', await p.evaluate(() => T.length === 7 && TRASH.length === 3 && STATE.selected.length === 0));
  await p.evaluate(() => { go('instellingen'); setSetTab('data'); });
  await p.waitForTimeout(300);
  ok('paneel toont teller + rijen', await p.evaluate(() => { const h = [...document.querySelectorAll('.section-sub')].find(x => /Prullenbak/.test(x.textContent)); return h && /· 3/.test(h.textContent) && [...document.querySelectorAll('button')].filter(x => /Terugzetten/.test(x.textContent)).length === 3; }));
  ok('rij toont bewaartermijn (nog 30 dagen)', await p.evaluate(() => /nog 30 dagen/.test(document.querySelector('#main').textContent)));
  await p.evaluate(() => trashRestoreOne(4));
  await p.waitForTimeout(200);
  ok('terugzetten vanuit paneel', await p.evaluate(() => T.length === 8 && TRASH.length === 2 && T.some(t => t.id === 4)));
  await p.evaluate(() => trashKill(1));  // confirm wordt auto-geaccepteerd
  await p.waitForTimeout(200);
  ok('definitief verwijderen (×)', await p.evaluate(() => TRASH.length === 1 && !TRASH.some(t => t.id === 1) && T.length === 8));

  console.log('─── Persistentie (IndexedDB, reload) ───');
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(600);
  await p.evaluate(() => { try { hideWelcome() } catch (e) {} });
  ok('TRASH overleeft reload', await p.evaluate(() => TRASH.length === 1 && TRASH[0].id === 7 && T.length === 8));

  console.log('─── 30-dagen-purge + id-botsing ───');
  ok('purge ruimt >30 dagen op, recent blijft', await p.evaluate(() => { TRASH.push({ ...T[0], id: 990, deletedAt: Date.now() - 31 * 864e5 }); const n = purgeTrash(); return n === 1 && TRASH.length === 1 && TRASH[0].id === 7; }));
  ok('trashDaysLeft telt af', await p.evaluate(() => { const t = { deletedAt: Date.now() - 25 * 864e5 }; const d = trashDaysLeft(t); return d >= 4 && d <= 5; }));
  ok('nextId kijkt óók naar TRASH (geen hergebruik)', await p.evaluate(() => nextId() > 7));
  ok('restore bij id-botsing → vers id', await p.evaluate(() => { TRASH.push({ ...TRASH[0], id: 0, pair: 'CLASH/USDT' }); trashRestore([0]); const c = T.filter(t => t.id === 0); return c.length === 1 && T.some(t => t.pair === 'CLASH/USDT'); }));

  console.log('─── Sync-dedupe ───');
  ok('gesyncte trade met trash-key wordt overgeslagen', await p.evaluate(() => { const dead = TRASH[0]; const fresh = { ...mkFresh(), pair: 'NEW/USDT' }; function mkFresh() { return { ...dead }; } const n = addSyncedTrades([{ ...dead }, fresh]); return n === 1 && !T.some(t => t.pair === dead.pair && t.id !== dead.id && t.deletedAt) && T.some(t => t.pair === 'NEW/USDT'); }));

  console.log('─── Export / import ───');
  ok('export bevat trash-veld', await p.evaluate(() => Array.isArray(snapshotPayload().trash) && snapshotPayload().trash.length === TRASH.length));
  ok('import zet trash terug', await p.evaluate(() => { const pl = snapshotPayload(); TRASH = []; applyBackup(pl); return TRASH.length === pl.trash.length; }));
  ok('oude back-up zonder trash-veld → lege bak (tolerant)', await p.evaluate(() => { const pl = snapshotPayload(); delete pl.trash; applyBackup(pl); return Array.isArray(TRASH) && TRASH.length === 0; }));

  console.log('─── Telt nergens mee ───');
  await p.evaluate(() => { STATE.selected = []; delTrade(T[0].id); go('analytics'); });
  await p.waitForTimeout(500);
  ok('analytics rekent zonder prullenbak-trades', await p.evaluate(() => { const tile = [...document.querySelectorAll('#main *')].map(x => x.textContent); return !!tile; }) && await p.evaluate(() => TRASH.length === 1));

  ok('geen JS-errors', errs.length === 0, errs.join(' | '));
  console.log(`\n=== Prullenbak: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
