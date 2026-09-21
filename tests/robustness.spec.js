// Borgt de hardening uit de audit van 2026-09-18. Kern: rommelige data mag de app nooit
// onbruikbaar maken — zeker niet in een herstel-situatie (import / Drive-herstel /
// veiligheidskopie), want daar zit een gebruiker die al iets kwijt dreigt te raken.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const BAD_BACKUP = {
  app: 'SyncJournal', trades: [
    { id: 1, date: '2026-09-01', time: '10:00', pair: 'BTC/USDT', dir: 'long', status: 'closed', kind: 'live', pnl: 50, r: 1, entry: 100, exit: 110, stop: 95, size: '1000' },
    { id: 2, time: '10:00', pair: 'ETH/USDT', dir: 'long', status: 'closed', kind: 'live', pnl: 20, r: 1 },     // GEEN date
    { id: 3, date: '2026-09-03', pair: 'SOL/USDT', status: 'closed', pnl: 'abc', r: 'veel' },                    // tekst i.p.v. getal
    { id: 4, date: '2026-09-04', pair: 'ARB/USDT', status: 'closed', pnl: null, tags: 'geen-array', tps: null }, // verkeerde types
    'dit is geen trade',                                                                                          // geen object
  ]
};
(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
  const b = await chromium.launch(); const p = await b.newPage(); p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
  await p.setViewportSize({ width: 1700, height: 1000 });
  // Vaste bedragen in deze spec: geen wisselkoers erbij (de omrekening zelf staat in valuta.spec).
  await p.route('**/*', r => /frankfurter/.test(r.request().url()) ? r.abort() : r.continue());
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(600);
  await p.evaluate(() => { try { hideWelcome() } catch (e) {} });

  console.log('─── Rommelige back-up importeren ───');
  const imp = await p.evaluate(async (bad) => {
    let thrown = '';
    try { applyBackup(bad); } catch (e) { thrown = String(e).split('\n')[0]; }
    await new Promise(r => setTimeout(r, 300));
    return { thrown, n: T.length, datums: T.map(t => typeof t.date), pnls: T.map(t => t.pnl), tagsArrays: T.every(t => Array.isArray(t.tags) && Array.isArray(t.tps)) };
  }, BAD_BACKUP);
  ok('import werpt geen fout meer', imp.thrown === '', imp.thrown);
  ok('alle 5 records overleven als bruikbare trades', imp.n === 5, String(imp.n));
  ok('datums zijn altijd tekst (ontbrekend → leeg)', imp.datums.every(d => d === 'string'), JSON.stringify(imp.datums));
  ok('bedragen zijn altijd eindige getallen ("abc"/null → 0)', imp.pnls.every(v => typeof v === 'number' && isFinite(v)), JSON.stringify(imp.pnls));
  ok('lijst-velden zijn altijd lijsten', imp.tagsArrays);

  console.log('─── Elke pagina blijft werken ───');
  const pages = await p.evaluate(async () => {
    clearGFilter(); setFilter('kind', 'alle');
    const res = {};
    for (const pg of ['dashboard', 'trades', 'analytics', 'kalender', 'tendencies', 'review', 'playbook']) {
      try { go(pg); await new Promise(r => setTimeout(r, 350)); res[pg] = document.getElementById('main').innerText.trim().length > 40 ? 'ok' : 'LEEG'; }
      catch (e) { res[pg] = 'CRASH'; }
    }
    return res;
  });
  ok('geen enkele pagina crasht of blijft leeg', Object.values(pages).every(v => v === 'ok'), JSON.stringify(pages));
  ok('geen JS-errors tijdens het doorlopen', errs.length === 0, errs.slice(0, 2).join(' | '));

  console.log('─── Herstart met die data ───');
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(900);
  const boot = await p.evaluate(async () => {
    try { hideWelcome() } catch (e) {}
    go('dashboard'); await new Promise(r => setTimeout(r, 400));
    return { tekst: document.getElementById('main').innerText.trim().length, trades: T.length, datums: T.every(t => typeof t.date === 'string') };
  });
  ok('na herstart werkt het dashboard gewoon', boot.tekst > 80 && boot.trades === 5 && boot.datums, JSON.stringify(boot));

  console.log('─── Maand/kalender negeren datumloze trades i.p.v. te raden ───');
  ok('maandgrafiek toont geen "undefined"-maand', await p.evaluate(async () => { go('dashboard'); await new Promise(r => setTimeout(r, 500)); return !/undefined/i.test(document.getElementById('main').innerText); }));
  ok('kalender rekent alleen met echte datums', await p.evaluate(async () => { go('kalender'); await new Promise(r => setTimeout(r, 400)); const t = document.getElementById('main').innerText; return !/NaN|undefined/.test(t); }));

  console.log('─── Rekenfuncties: geen Infinity/NaN meer ───');
  const calc = await p.evaluate(() => {
    const mk = (id, pnl, r) => ({ id, date: '2026-09-0' + id, time: '10:00', pair: 'BTC/USDT', dir: 'long', setup: '', session: 'London', status: 'closed', kind: 'live', exchange: '', entry: 100, exit: 110, stop: 95, size: '1000', pnl, r, tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] });
    T = [mk(1, 100, 1), mk(2, 50, 1)]; persist(); clearGFilter(); setFilter('kind', 'alle'); go('dashboard');
    const winstOnly = { ...agg() };
    T = []; persist(); go('dashboard');
    const leeg = { ...agg() };
    return { pf: String(winstOnly.pf), leegWr: String(leeg.wr), leegExp: String(leeg.exp), leegAvgR: String(leeg.avgR) };
  });
  ok('alleen winnaars → profit factor 99 i.p.v. Infinity', calc.pf === '99', calc.pf);
  ok('lege lijst → 0 i.p.v. NaN', calc.leegWr === '0' && calc.leegExp === '0' && calc.leegAvgR === '0', JSON.stringify(calc));

  console.log('─── Size met NL-komma ───');
  const sz = await p.evaluate(() => {
    openForm(null);
    const set = (id, v) => { const el = document.getElementById('f_' + id); if (el) el.value = v; };
    set('pair', 'BTC/USDT'); set('entry', '100'); set('exit', '110'); set('size', '1000,50'); set('pnl', '25');
    submitForm(null);
    const t = T.find(x => x.pair === 'BTC/USDT');
    return { sz: SZ(t), duizendtal: SZ({ size: '8.000' }), gewoon: SZ({ size: '1000' }) };
  });
  ok('"1000,50" → 1000,5 (was NaN)', sz.sz === 1000.5, String(sz.sz));
  ok('"8.000" blijft 8000 en "1000" blijft 1000', sz.duizendtal === 8000 && sz.gewoon === 1000, JSON.stringify(sz));
  ok('size-kolom toont een bedrag i.p.v. een streepje', await p.evaluate(async () => { go('trades'); await new Promise(r => setTimeout(r, 300)); const c = document.querySelector('td[data-l="Size"]'); return !!c && !/^—$/.test(c.textContent.trim()); }));

  console.log('─── Zelfcontrole merkt kapotte data op ───');
  ok('niet-numerieke P&L wordt gemeld', await p.evaluate(() => {
    let gemeld = ''; const orig = ErrorCenter.report; ErrorCenter.report = (k, e, o) => { gemeld = String((o && o.userMsg) || ''); };
    T = [{ id: 1, date: '2026-09-01', pnl: NaN, status: 'closed', tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] }];
    const r = selfCheck(); ErrorCenter.report = orig;
    return r === false && /P&L/.test(gemeld);
  }));

  console.log('─── Leesbaarheid & invoergemak (audit-punten 9 en 10) ───');
  const ct = await p.evaluate(async (theme) => {
    const lum = (c) => { const m = (c.match(/[\d.]+/g) || []).map(Number); const f = m.slice(0, 3).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * f[0] + .7152 * f[1] + .0722 * f[2]; };
    const bgOf = (el) => { let n = el; while (n && n !== document.documentElement) { const c = getComputedStyle(n).backgroundColor; if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c; n = n.parentElement; } return getComputedStyle(document.body).backgroundColor; };
    const ratio = (sel) => { const el = document.querySelector(sel); if (!el) return null; const l1 = lum(getComputedStyle(el).color), l2 = lum(bgOf(el)); return +(((Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05))).toFixed(2); };
    setTheme(theme); T = [{ id: 1, date: '2026-09-01', time: '10:00', pair: 'BTC/USDT', dir: 'long', setup: 'SFP', session: 'London', status: 'closed', kind: 'live', exchange: 'blofin', entry: 100, exit: 110, stop: 95, size: '1000', pnl: 50, r: 1, tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] }];
    persist(); EXMAP.blofin.val = 1000; persistExMeta(); clearGFilter(); viewPreset('alles'); go('dashboard');
    await new Promise(r => setTimeout(r, 400));
    return { kopjes: ratio('.eyebrow'), labels: ratio('.kpi .k') };
  }, 'light');
  ok('kleine labels zijn leesbaar in het lichte thema (≥4,5:1)', ct.kopjes >= 4.5 && ct.labels >= 4.5, JSON.stringify(ct));
  const ctd = await p.evaluate(async () => {
    const lum = (c) => { const m = (c.match(/[\d.]+/g) || []).map(Number); const f = m.slice(0, 3).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * f[0] + .7152 * f[1] + .0722 * f[2]; };
    setTheme('dark'); render(); await new Promise(r => setTimeout(r, 300));
    const el = document.querySelector('.eyebrow'); if (!el) return null;
    let n = el, bg = null; while (n && !bg) { const c = getComputedStyle(n).backgroundColor; if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) bg = c; n = n.parentElement; }
    const l1 = lum(getComputedStyle(el).color), l2 = lum(bg);
    setTheme('light');
    return +(((Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05))).toFixed(2);
  });
  ok('en ook in het donkere thema', ctd >= 4.5, String(ctd));
  ok('nieuwe trade: cursor staat meteen in het eerste veld', await p.evaluate(async () => { go('trades'); openForm(null); await new Promise(r => setTimeout(r, 200)); const a = document.activeElement; const id = a && a.id; formDirty = false; closeForm(); return id === 'f_pair'; }));
  ok('bestaande trade bewerken pakt de focus niet af', await p.evaluate(async () => { openForm(T[0].id); await new Promise(r => setTimeout(r, 200)); const id = document.activeElement && document.activeElement.id; formDirty = false; closeForm(); return id !== 'f_pair'; }));

  ok('geen JS-errors totaal', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== Robuustheid (audit-hardening): ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
