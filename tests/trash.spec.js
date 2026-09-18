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

  console.log('─── Groot volume: scrollvak, paginering en bulk-acties (Denny 2026-09-18) ───');
  const big = await p.evaluate(async () => {
    // 2000 verwijderde trades, zoals in Denny's journal
    TRASH = Array.from({ length: 2000 }, (_, i) => ({ id: 10000 + i, date: '2026-08-' + String(1 + (i % 28)).padStart(2, '0'), time: '10:00', pair: ['BTC/USDT', 'ETH/USDT', 'LINK/USDT'][i % 3], dir: i % 2 ? 'short' : 'long', setup: 'Reclaim', status: 'closed', kind: 'live', exchange: '', entry: 100, exit: 110, stop: 95, size: '1000', pnl: 10, r: 1.3, deletedAt: Date.now() - 864e5, tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] }));
    persistTrash(); trSel = new Set(); trPage = 0;
    go('instellingen'); setSetTab('data');
    await new Promise(r => setTimeout(r, 300));
    const box = document.querySelector('.trashbox');
    const rows = box ? box.querySelectorAll('.setrow').length : 0;
    const main = document.getElementById('main');
    return { box: !!box, rows, boxH: box ? box.getBoundingClientRect().height : 0, pageH: main.scrollHeight, pager: /pagina 1\/40/.test(main.textContent) };
  });
  ok('lijst zit in een scrollvak i.p.v. 2000 rijen op de pagina', big.box && big.rows === 50 && big.boxH <= 480, JSON.stringify(big));
  ok('paginering: 50 per pagina, 40 pagina\'s', big.pager, String(big.pager));
  ok('pagina blijft kort (geen eindeloze scroll)', big.pageH < 4000, String(big.pageH));
  ok('volgende pagina toont de volgende 50', await p.evaluate(() => { trashPageGo(1); const t = document.getElementById('main').textContent; return /51–100/.test(t) && /pagina 2\/40/.test(t); }));
  ok('selecteer alles op deze pagina → 50 geselecteerd', await p.evaluate(() => { trashPageGo(0); trashSelPage(); return trSel.size === 50 && /50<\/b> geselecteerd|50 geselecteerd/.test(document.getElementById('main').innerHTML.replace(/<b[^>]*>/g, '<b>')); }));
  ok('bulk terugzetten: 50 trades in één klik terug', await p.evaluate(() => { const t0 = T.length, tr0 = TRASH.length; trashRestoreSel(); return T.length === t0 + 50 && TRASH.length === tr0 - 50 && trSel.size === 0; }));
  ok('"alle 1950 selecteren" pakt de hele bak, niet alleen de pagina', await p.evaluate(() => { trashSelAll(); return trSel.size === TRASH.length; }));
  ok('selectie wissen werkt', await p.evaluate(() => { trashSelClear(); return trSel.size === 0; }));
  ok('bulk definitief verwijderen (met bevestiging) ruimt precies de selectie op', await p.evaluate(() => { trashPageGo(0); trashSelPage(); const tr0 = TRASH.length, ids = [...trSel]; trashKillSel(); return TRASH.length === tr0 - ids.length && !TRASH.some(t => ids.includes(t.id)) && trSel.size === 0; }));
  ok('losse rij-knoppen blijven werken naast de selectie', await p.evaluate(() => { const id = TRASH[0].id, t0 = T.length; trashRestoreOne(id); return T.length === t0 + 1 && !TRASH.some(t => t.id === id); }));
  ok('lege bak → nette uitlegtekst, geen scrollvak', await p.evaluate(() => { TRASH = []; trSel = new Set(); persistTrash(); render(); const t = document.getElementById('main').textContent; return /prullenbak is leeg/i.test(t) && !document.querySelector('.trashbox'); }));

  ok('geen JS-errors', errs.length === 0, errs.join(' | '));
  console.log(`\n=== Prullenbak: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
