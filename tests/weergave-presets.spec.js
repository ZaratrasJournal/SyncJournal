// Borgt de weergave-presets (Rustig/Standaard/Alles, Denny 2026-09-15): presets zetten
// per-onderdeel toggles, handmatig afwijken maakt "aangepast", een preset-klik herstelt
// exact. Kernregels: alleen rendering (cijfers identiek in elke stand), migratie van de
// oude Dashboard-toggles (STATE.sections), persist + backup-roundtrip.
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
  await p.evaluate(() => {
    try { hideWelcome() } catch (e) {}
    T = [
      { id: 1, date: '2026-09-12', time: '10:00', pair: 'BTC/USDT', dir: 'long', setup: 'Reclaim', session: 'London', status: 'closed', kind: 'live', exchange: '', entry: 100, exit: 110, stop: 95, size: '1000', pnl: 100, r: 2, openTime: String(+new Date('2026-09-12T10:00:00')), closeTime: String(+new Date('2026-09-12T14:26:00')), tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [], notes: 'testnotitie' },
      { id: 2, date: '2026-09-13', time: '09:00', pair: 'SOL/USDT', dir: 'short', setup: '', session: 'London', status: 'closed', kind: 'live', exchange: '', entry: 200, exit: 190, stop: 205, size: '500', pnl: 25, r: 1, durationMin: 30, tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] },
    ]; persist(); clearGFilter(); setFilter('kind', 'alle');
  });
  ok('boot zonder JS-errors', errs.length === 0, errs.slice(0, 2).join(' | '));

  console.log('─── Default + preset-schakelen ───');
  ok('verse gebruiker start op Alles', await p.evaluate(() => VIEW.preset === 'alles'));
  ok('nav toont alle pagina\'s in Alles', await p.evaluate(() => document.querySelectorAll('#nav button,#navbot button').length === 10));
  const nettoAlles = await p.evaluate(() => { go('dashboard'); return document.querySelector('.kpis .kpi .kv, .kpis [class*=kpi]')?.textContent || document.querySelector('.kpis')?.textContent || ''; });
  await p.evaluate(() => viewPreset('rustig')); await p.waitForTimeout(300);
  ok('Rustig: Analytics/Tendencies/Playbook/AI uit de nav', await p.evaluate(() => { const ps = [...document.querySelectorAll('#nav button,#navbot button')].map(x => x.dataset.p); return !ps.includes('analytics') && !ps.includes('tendencies') && !ps.includes('playbook') && !ps.includes('ai') && ps.includes('dashboard') && ps.includes('review'); }));
  ok('Rustig dashboard: kern-KPI\'s wel, pro-KPI\'s niet', await p.evaluate(() => { const t = document.getElementById('main').textContent; return /Netto|netto/.test(t) && !/Profit factor/i.test(t) && !/Expectancy/i.test(t); }));
  ok('Rustig dashboard: edge-paneel en Maand-P&L weg', await p.evaluate(() => { const t = document.getElementById('main').textContent; return !/Waar zit je edge/.test(t) && !/Maand-P&L/.test(t); }));
  const nettoRustig = await p.evaluate(() => document.querySelector('.kpis')?.textContent || '');
  ok('kern-cijfers identiek in Rustig vs Alles', nettoRustig.length > 0 && nettoAlles.startsWith(nettoRustig.slice(0, 10)), `alles="${nettoAlles.slice(0, 30)}" rustig="${nettoRustig.slice(0, 30)}"`);

  console.log('─── Trades-tabel per preset ───');
  await p.evaluate(() => go('trades')); await p.waitForTimeout(300);
  ok('Rustig: geen Exchange/Entry/Exit/Size/R/Sessie/Tags-kolommen', await p.evaluate(() => { const hs = [...document.querySelectorAll('thead th')].map(x => x.textContent.trim()); return !hs.some(x => /^Exchange/.test(x)) && !hs.some(x => /^Entry/.test(x)) && !hs.some(x => /^R($| )/.test(x)) && hs.some(x => /^Datum/.test(x)) && hs.some(x => /^P&L/.test(x)) && hs.some(x => /^Setup/.test(x)); }));
  await p.locator('tbody tr.mrow', { hasText: 'BTC/USDT' }).hover(); await p.waitForTimeout(150);
  ok('Rustig hover-uitklap: tijdlijn wél, stats/notities niet', await p.evaluate(() => { const d = document.getElementById('drow-1'); return d && !d.hidden && /Open/.test(d.textContent) && /Close/.test(d.textContent) && !/Stop-loss/i.test(d.textContent) && !/testnotitie/.test(d.textContent); }));
  await p.evaluate(() => viewPreset('alles')); await p.waitForTimeout(300);
  await p.locator('tbody tr.mrow', { hasText: 'BTC/USDT' }).hover(); await p.waitForTimeout(150);
  ok('Alles hover-uitklap: stats + notitie terug', await p.evaluate(() => { const d = document.getElementById('drow-1'); return d && !d.hidden && /Stop-loss/i.test(d.textContent) && /testnotitie/.test(d.textContent); }));
  ok('Alles: alle 12 kolommen terug', await p.evaluate(() => document.querySelectorAll('thead th').length === 13)); // 12 + checkbox

  console.log('─── Aangepast + exact herstel ───');
  await p.evaluate(() => viewPreset('standaard'));
  const before = await p.evaluate(() => JSON.stringify(VIEW.v));
  await p.evaluate(() => viewTog('dEdge')); await p.waitForTimeout(200);
  ok('handmatige toggle → preset "aangepast"', await p.evaluate(() => VIEW.preset === 'aangepast' && !VIEW.v.dEdge));
  ok('aangepast-chip zichtbaar in Instellingen → Weergave', await p.evaluate(() => { go('instellingen'); setSetTab('weergave'); return !!document.querySelector('.vpcust'); }));
  await p.evaluate(() => viewPreset('standaard'));
  ok('preset-klik herstelt exact', await p.evaluate((b) => JSON.stringify(VIEW.v) === b && VIEW.preset === 'standaard', before));

  console.log('─── Instellingen-UI ───');
  ok('drie preset-kaarten aanwezig, Standaard actief', await p.evaluate(() => { const c = [...document.querySelectorAll('.vpcard')]; return c.length === 3 && c[1].classList.contains('on'); }));
  ok('per-onderdeel toggles aanwezig (pagina\'s + dashboard + tabel)', await p.evaluate(() => { const t = document.getElementById('main').textContent; return /Tendencies/.test(t) && /Pro-KPI/.test(t) && /Entry \/ Exit/.test(t) && /hover-detail/i.test(t); }));
  ok('aparte Dashboard-tab is weg', await p.evaluate(() => ![...document.querySelectorAll('#setTabs button')].some(b => /Dashboard/.test(b.textContent))));

  console.log('─── Formulier: Meer velden + gevuld-blijft-zichtbaar ───');
  await p.evaluate(() => { viewPreset('rustig'); go('trades'); openForm(null); }); await p.waitForTimeout(300);
  const vis = id => p.evaluate(i => { const el = document.getElementById(i); return el ? getComputedStyle(el.closest('.field')).display !== 'none' : null; }, id);
  ok('nieuw formulier in Rustig: kernvelden zichtbaar', (await vis('f_entry')) && (await vis('f_pair')) && (await vis('f_pnl')));
  ok('nieuw formulier in Rustig: stop/risk/MAE verborgen', !(await vis('f_stop')) && !(await vis('f_risk')) && !(await vis('f_mae')));
  ok('sectiekop zonder zichtbare velden is weg', await p.evaluate(() => { const h = [...document.querySelectorAll('#modal .msub')].find(x => /psychologie/.test(x.textContent)); return h && getComputedStyle(h).display === 'none'; }));
  ok('Meer velden-knop toont aantal', await p.evaluate(() => { const b = document.getElementById('fMoreBtn'); return b && !b.hidden && /Meer velden \(\d+\)/.test(b.textContent); }));
  await p.evaluate(() => { document.getElementById('f_entry').value = '123'; toggleFormMore(); }); await p.waitForTimeout(150);
  ok('uitklappen: stop-loss zichtbaar, getypte entry blijft staan', (await vis('f_stop')) && await p.evaluate(() => document.getElementById('f_entry').value === '123'));
  await p.evaluate(() => { toggleFormMore(); }); await p.waitForTimeout(150);
  ok('weer inklappen verbergt stop-loss opnieuw', !(await vis('f_stop')));
  await p.evaluate(() => { formDirty = false; closeForm(); });
  await p.evaluate(() => openForm(1)); await p.waitForTimeout(300); // trade 1 heeft stop=95 + notitie
  ok('bewerken in Rustig: gevuld stop-veld blijft zichtbaar (vf-keep)', (await vis('f_stop')) && await p.evaluate(() => document.getElementById('f_stop').value === '95'));
  ok('leeg risk-veld blijft verborgen bij bewerken', !(await vis('f_risk')));
  await p.evaluate(() => { formDirty = false; closeForm(); viewPreset('alles'); openForm(null); }); await p.waitForTimeout(250);
  ok('preset Alles: alles zichtbaar, geen Meer velden-knop', (await vis('f_stop')) && (await vis('f_mae')) && await p.evaluate(() => document.getElementById('fMoreBtn').hidden));
  await p.evaluate(() => { formDirty = false; closeForm(); });

  console.log('─── Fase 3: ⋯-menu, nudge, welkomst-keuze ───');
  await p.evaluate(() => { viewPreset('standaard'); go('dashboard'); }); await p.waitForTimeout(300);
  ok('⋯-menu op paneelkoppen aanwezig', await p.evaluate(() => document.querySelectorAll('#main .pmenu').length >= 3));
  await p.evaluate(() => hideViewPanel('dEquity', 'Equity-curve')); await p.waitForTimeout(200);
  ok('paneel verbergen via ⋯ → weg + aangepast + toast met ongedaan', await p.evaluate(() => { const gone = ![...document.querySelectorAll('#main h3')].some(x => /Equity-curve/.test(x.textContent)); const t = document.querySelector('#toasts .tact'); return gone && VIEW.preset === 'aangepast' && t && /Ongedaan/.test(t.textContent); }));
  await p.evaluate(() => document.querySelector('#toasts .tact').click()); await p.waitForTimeout(200);
  ok('ongedaan maken herstelt paneel én preset', await p.evaluate(() => VIEW.preset === 'standaard' && VIEW.v.dEquity === 1 && [...document.querySelectorAll('#main h3')].some(x => /Equity-curve/.test(x.textContent))));
  await p.evaluate(() => { for (let i = 0; i < 30; i++) T.push({ ...T[1], id: 100 + i }); persist(); viewPreset('rustig'); go('dashboard'); }); await p.waitForTimeout(300);
  ok('nudge verschijnt in Rustig bij ≥25 trades', await p.evaluate(() => !!document.querySelector('.vnudge')));
  await p.evaluate(() => dismissNudge(false)); await p.waitForTimeout(200);
  ok('nudge wegklikken → blijft weg (persist)', await p.evaluate(() => !document.querySelector('.vnudge') && DB.load('view', {}).nudged === 1));
  await p.evaluate(() => showWelcome()); await p.waitForTimeout(150);
  ok('welkomstscherm heeft de drie start-keuzes', await p.evaluate(() => document.querySelectorAll('.wl-vopts button').length === 3));
  await p.evaluate(() => { document.querySelectorAll('.wl-vopts button')[1].click(); }); await p.waitForTimeout(200);
  ok('keuze op welkomstscherm zet preset (Standaard)', await p.evaluate(() => VIEW.preset === 'standaard' && document.querySelectorAll('.wl-vopts button')[1].classList.contains('on')));
  await p.evaluate(() => hideWelcome());

  console.log('─── Persist + migratie + backup ───');
  await p.evaluate(() => viewPreset('rustig'));
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(600);
  ok('preset overleeft reload', await p.evaluate(() => VIEW.preset === 'rustig' && !VIEW.v.pgAnalytics));
  ok('nav na reload direct gefilterd', await p.evaluate(() => ![...document.querySelectorAll('#nav button')].some(x => x.dataset.p === 'analytics')));
  // migratie: oude sections-toggles, geen view-key
  await p.evaluate(() => { DB.save('state', { theme: 'light', sections: { hero: true, kpis: true, equity: true, monthly: true, edge: false, recent: true } }); Object.keys(localStorage).filter(k => /view$/.test(k)).forEach(k => localStorage.removeItem(k)); });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(600);
  ok('migratie: oude Dashboard-toggle (edge uit) → VIEW aangepast', await p.evaluate(() => VIEW.preset === 'aangepast' && !VIEW.v.dEdge && VIEW.v.dHero === 1));
  ok('export bevat view (en altijd alle trades)', await p.evaluate(() => { const s = snapshotPayload(); return s.view && s.view.v && !s.sections && Array.isArray(s.trades); }));
  ok('oude backup met sections wordt geadopteerd', await p.evaluate(() => { adoptViewBackup({ sections: { hero: false, kpis: true } }); return !VIEW.v.dHero && VIEW.preset === 'aangepast'; }));
  ok('nieuwe backup met view wint', await p.evaluate(() => { adoptViewBackup({ view: { preset: 'rustig', v: { ...VIEW_PRESETS.rustig } } }); return VIEW.preset === 'rustig' && VIEW.v.dHero === 1; }));

  ok('geen JS-errors totaal', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== Weergave-presets: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
