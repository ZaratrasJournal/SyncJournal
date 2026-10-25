// Lege staten (backlog C1): elke pagina kent twee lege toestanden, met elk een eigen tekst en een
// volgende stap (CLAUDE.md, "Toestanden benoemen vóór je bouwt").
//   leeg           — nog nooit een trade: zeg waar je trades vandaan halen (sync, CSV, handmatig).
//   niets in beeld — wel trades, maar periode of filter laat er geen over: een knop die dat terugdraait.
// Grafieken tonen bij geen data een melding in plaats van een leeg assenstelsel; bij precies één trade
// tekenen ze iets of zeggen ze waarom niet. Alles komt uit emptyState(key) met een regel in EMPTY:
// de oude losse *-empty-classes mogen nergens meer staan.
//
// Draai: node tests/lege-staten.spec.js   (screenshots in tests/screenshots/lege-staten/)
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const SHOTS = path.join('tests', 'screenshots', 'lege-staten'); fs.mkdirSync(SHOTS, { recursive: true });
const OUDE_CLASSES = ['lt-empty', 'revempty', 'txempty', 'thm-empty', 'tagcard-empty', 'ml-empty', 'drow-empty'];
const PAGINAS = ['dashboard', 'trades', 'analytics', 'tendencies', 'kalender', 'playbook', 'review', 'ai'];

const T0 = { time: '10:00', dir: 'long', status: 'closed', kind: 'live', entry: 100, exit: 110, stop: 95, size: '1000', exchange: '', session: 'London', setup: 'Breakout' };
const SET = [
  { ...T0, id: 1, date: '2026-09-01', pair: 'BTC/USDT', pnl: 10 },
  { ...T0, id: 2, date: '2026-09-15', pair: 'ETH/USDT', pnl: -5, exit: 97.5, session: 'US AM' },
  { ...T0, id: 3, date: '2026-10-02', pair: 'SOL/USDT', pnl: 7, setup: 'Range' },
];

// Wat staat er nu in #main: de lege staat (key, kop, knop) en of er een leeg assenstelsel staat.
const stand = () => {
  // the page's own state; a one-line state (a hero without balance) comes second
  const e = document.querySelector('#main [data-empty]:not(.empty-regel)') || document.querySelector('#main [data-empty]');
  return {
    key: e ? e.dataset.empty : '', kop: e ? (e.querySelector('.empty-h') || e).textContent.trim() : '',
    tekst: e ? e.textContent.replace(/\s+/g, ' ').trim() : '',
    knop: e ? ((e.querySelector('button') || {}).textContent || '').trim() : '',
    alle: [...document.querySelectorAll('#main [data-empty]')].map(x => x.dataset.empty),
    // een grafiek zonder iets erin getekend = een leeg assenstelsel
    leegAssen: [...document.querySelectorAll('#main .recharts-wrapper')].filter(w => !w.querySelector(
      '.recharts-area-curve[d], .recharts-line-curve[d], .recharts-bar-rectangle path, .recharts-pie-sector path, .recharts-radar-polygon, .recharts-scatter-symbol')).length,
    grafieken: document.querySelectorAll('#main .recharts-wrapper').length,
  };
};
const zet = async (p, fn, arg) => { await p.evaluate(fn, arg); await p.waitForTimeout(450); };
const naar = async (p, pg) => {
  if (pg === 'ai') await p.evaluate(() => { AIPREFS.enabled = true; aiKeyGet = () => 'sk-ant-test'; });
  await H.go(p, pg); await p.waitForTimeout(450);
};
// the button of the page's own state, not of a one-line state such as the hero's "no balance"
const KNOP = '#main [data-empty]:not(.empty-regel) button';
const oudeClasses = p => p.evaluate(l => l.filter(c => document.getElementsByClassName(c).length), OUDE_CLASSES);

(async () => {
  // 0. de bron zelf: geen enkele oude class meer in de app
  const src = fs.readFileSync('work/syncjournal.html', 'utf8');
  const inBron = OUDE_CLASSES.filter(c => new RegExp('\\b' + c + '\\b').test(src));
  ok('geen van de oude *-empty-classes staat nog in work/syncjournal.html', !inBron.length, inBron.join(', '));
  ok('equity() zet geen nulpunt meer in een lege reeks', !/if\(!data\.length\)data\.push\(\{x:0,y:0\}\)/.test(src));

  const b = await chromium.launch();
  for (const thema of ['light', 'dark']) {
    console.log(`\n— thema ${thema} —`);
    const { p, errs } = await H.openJournal(b);
    await zet(p, t => setTheme(t), thema);

    // (a) leeg: nog nooit een trade
    const leeg = {};
    for (const pg of PAGINAS) {
      await naar(p, pg); const s = await p.evaluate(stand); leeg[pg] = s;
      ok(`[a] ${pg}: lege staat met een volgende stap (knop)`, s.key && s.knop && s.tekst.length > 30, JSON.stringify(s));
      ok(`[a] ${pg}: geen leeg assenstelsel`, s.leegAssen === 0, JSON.stringify(s));
      await H.stil(p); await p.screenshot({ path: path.join(SHOTS, `a-${pg}-${thema}.png`), fullPage: true });
    }
    ok('[a] dashboard en trades zeggen waar je trades vandaan komen (sync / CSV / Accounts)',
      /sync/i.test(leeg.dashboard.tekst) && /CSV/.test(leeg.dashboard.tekst) && /Accounts/.test(leeg.trades.tekst), leeg.dashboard.tekst);
    // knop van de lege staat brengt je naar Instellingen → Accounts
    await naar(p, 'trades'); await p.click(KNOP);
    await p.waitForTimeout(400);
    ok('[a] knop op Trades opent Instellingen → Accounts', await p.evaluate(() => STATE.page === 'instellingen' && (STATE.setTab || 'accounts') === 'accounts'));

    // Instellingen: handmatige accounts, transacties, tags, prullenbak, veiligheidskopieën
    await zet(p, () => { STATE.setTab = 'accounts'; render(); });
    let inst = await p.evaluate(() => [...document.querySelectorAll('#main [data-empty]')].map(x => x.dataset.empty));
    ok('[a] Instellingen → Accounts: lege staat voor handmatige accounts', inst.includes('man-leeg'), inst.join(','));
    await zet(p, () => { MANUAL.push({ id: 'm_test', name: 'Test', balance: 100, transactions: [] }); STATE.manOpen = ''; toggleMan('m_test'); });
    inst = await p.evaluate(() => [...document.querySelectorAll('#main [data-empty]')].map(x => x.dataset.empty));
    ok('[a] handmatig account zonder mutaties: lege staat voor transacties', inst.includes('tx-leeg'), inst.join(','));
    await H.stil(p); await p.screenshot({ path: path.join(SHOTS, `a-instellingen-accounts-${thema}.png`), fullPage: true });
    await zet(p, () => { MANUAL.splice(MANUAL.findIndex(m => m.id === 'm_test'), 1); tagConfig.mistakeTags = []; tagConfig.emotionTags = (tagConfig.emotionTags || []).filter(e => !isNegEmotie(e)); STATE.setTab = 'tags'; render(); });
    inst = await p.evaluate(() => [...document.querySelectorAll('#main [data-empty]')].map(x => x.dataset.empty));
    ok('[a] Instellingen → Tags: lege categorie en lege emotiekolom via emptyState', inst.includes('tags-leeg') && inst.includes('tags-kolom'), inst.join(','));
    await H.stil(p); await p.screenshot({ path: path.join(SHOTS, `a-instellingen-tags-${thema}.png`), fullPage: true });
    await zet(p, () => { SNAP_META.length = 0; STATE.setTab = 'data'; render(); });   // boot makes a 'before schema update' copy
    inst = await p.evaluate(() => [...document.querySelectorAll('#main [data-empty]')].map(x => x.dataset.empty));
    ok('[a] Instellingen → Data: lege prullenbak en geen veiligheidskopieën via emptyState', inst.includes('prullenbak') && inst.includes('kopie-leeg'), inst.join(','));
    // trade-formulier en playbook-editor
    await zet(p, () => openForm(null));
    const form = await p.evaluate(() => [...document.querySelectorAll('[data-empty]')].map(x => x.dataset.empty));
    ok('[a] trade-formulier: lege emotiekolom via emptyState', form.includes('emo-kolom'), form.join(','));
    await zet(p, () => closeForm());
    await zet(p, () => openPbEdit(null));
    const pbe = await p.evaluate(() => [...document.querySelectorAll('[data-empty]')].map(x => x.dataset.empty));
    ok('[a] playbook-editor: lege criteria en anti-criteria via emptyState', pbe.includes('pb-crit') && pbe.includes('pb-anti'), pbe.join(','));
    await zet(p, () => closeForm());
    ok('[a] geen oude *-empty-class in de DOM', !(await oudeClasses(p)).length, (await oudeClasses(p)).join(','));

    // (b) niets in beeld: wel trades, periode laat niets over
    await H.seedTrades(p, SET);
    await zet(p, () => { STATE.calMonth = '2026-10'; });
    for (const pg of PAGINAS) {
      await naar(p, pg);
      await zet(p, () => { setDateFrom('2030-01-01'); reopenDD = null; render(); });
      const s = await p.evaluate(stand);
      ok(`[b] ${pg}: "niets in beeld" (${s.key}), andere tekst dan leeg`, s.key && s.kop && s.kop !== leeg[pg].kop && /periode|filter/i.test(s.tekst), JSON.stringify(s));
      ok(`[b] ${pg}: geen leeg assenstelsel`, s.leegAssen === 0, JSON.stringify(s));
      await H.stil(p); await p.screenshot({ path: path.join(SHOTS, `b-${pg}-${thema}.png`), fullPage: true });
      await p.click(KNOP); await p.waitForTimeout(450);
      const na = await p.evaluate(stand);
      ok(`[b] ${pg}: de knop zet het filter uit, de trades zijn terug`, await p.evaluate(() => FT.length === 3 && !FILTER.dateFrom) && !na.alle.includes(s.key), JSON.stringify(na));
    }
    // alleen oefentrades, filter staat standaard op Live: de knop moet ze ook laten zien
    await zet(p, () => { T.forEach(t => t.kind = 'paper'); persist(); go('dashboard'); render(); });
    let s = await p.evaluate(stand);
    ok('[b] alleen oefentrades achter de Live-filter: "niets in beeld"', s.key === 'trades-none', JSON.stringify(s));
    await p.click(KNOP); await p.waitForTimeout(450);
    ok('[b] knop laat de oefentrades zien', await p.evaluate(() => FT.length === 3), await p.evaluate(() => FILTER.kind));
    await zet(p, () => { T.forEach(t => t.kind = 'live'); FILTER.kind = 'live'; persist(); render(); });
    // Kalender: maand zonder trades terwijl er wel trades zijn
    await naar(p, 'kalender');
    await zet(p, () => { STATE.calMonth = '2025-03'; render(); });
    s = await p.evaluate(stand);
    ok('[b] kalender: maand zonder trades zegt dat, met een knop', s.key === 'kalender' && s.knop, JSON.stringify(s));
    await H.stil(p); await p.screenshot({ path: path.join(SHOTS, `b-kalender-maand-${thema}.png`), fullPage: true });
    await p.click(KNOP); await p.waitForTimeout(450);
    ok('[b] kalender-knop springt naar de laatste maand met trades', await p.evaluate(() => STATE.calMonth === '2026-10'));
    // Trades: zoekopdracht zonder resultaat
    await naar(p, 'trades');
    await zet(p, () => { STATE.query = 'XRP'; render(); });
    s = await p.evaluate(stand);
    ok('[b] trades: zoekopdracht zonder resultaat heeft een eigen tekst', s.key === 'trades-zoek' && /zoek/i.test(s.tekst), JSON.stringify(s));
    await p.click(KNOP); await p.waitForTimeout(400);
    ok('[b] trades: knop wist de zoekopdracht', await p.evaluate(() => STATE.query === '' && document.querySelectorAll('#main tbody tr.mrow').length === 3));
    ok('[b] geen oude *-empty-class in de DOM', !(await oudeClasses(p)).length, (await oudeClasses(p)).join(','));

    // (c) precies één trade
    await H.wipe(p); await zet(p, t => setTheme(t), thema);
    await H.seedTrades(p, [SET[0]]);
    for (const pg of ['dashboard', 'analytics', 'tendencies', 'playbook']) {
      await naar(p, pg); await p.waitForTimeout(500);
      const s1 = await p.evaluate(stand);
      ok(`[c] ${pg} met één trade: elke grafiek tekent iets of meldt waarom niet`, s1.leegAssen === 0, JSON.stringify(s1));
      await H.stil(p); await p.screenshot({ path: path.join(SHOTS, `c-${pg}-${thema}.png`), fullPage: true });
    }
    await zet(p, () => openPlaybook('Breakout')); await p.waitForTimeout(400);
    ok('[c] playbook-detail met één trade: geen leeg assenstelsel', (await p.evaluate(stand)).leegAssen === 0);
    // alle waarden nul
    await H.wipe(p); await zet(p, t => setTheme(t), thema);
    await H.seedTrades(p, SET.map(t => ({ ...t, pnl: 0, exit: 100 })));
    await naar(p, 'dashboard');
    s = await p.evaluate(stand);
    ok('[c] alle P&L nul: equity-curve tekent een vlakke lijn, geen leeg assenstelsel', s.leegAssen === 0 && s.grafieken > 0, JSON.stringify(s));

    // 390px: de lege staten passen op een telefoon, zonder horizontaal scrollen
    await H.wipe(p); await zet(p, t => setTheme(t), thema);
    await p.setViewportSize({ width: 390, height: 844 });
    for (const pg of ['dashboard', 'trades', 'analytics']) {
      await naar(p, pg); await H.stil(p);
      ok(`[a] ${pg} op 390px: geen horizontale scroll`, await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
      await p.screenshot({ path: path.join(SHOTS, `m-a-${pg}-${thema}.png`), fullPage: true });
    }
    await H.seedTrades(p, SET);
    for (const pg of ['dashboard', 'kalender']) {
      await naar(p, pg); await zet(p, () => { setDateFrom('2030-01-01'); reopenDD = null; render(); }); await H.stil(p);
      await p.screenshot({ path: path.join(SHOTS, `m-b-${pg}-${thema}.png`), fullPage: true });
      await zet(p, () => filterUit());
    }

    ok(`geen JS-fouten (${thema})`, errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));
    await p.context().close();
  }
  await b.close();
  console.log(`\n=== Lege staten: ${pass}/${pass + fail} ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
