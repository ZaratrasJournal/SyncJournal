// Koppeling SyncJournal ↔ TradingPlan (stap 2 van docs/opdracht-tradingplan-koppeling.md).
// Journal: planMatch op symbool + richting + venster, planRef op de trade, handmatige correctie
// blijft staan, poort-regel in de hover-details, geen badge in de tradelijst, tradingplan-blok in de back-up.
// TradingPlan: R van gekoppelde trades komt uit de journal (IndexedDB sj_db), niet meer handmatig.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const F = f => 'file:///' + path.resolve(f).split(path.sep).join('/');
const APP = F('work/syncjournal.html'), TP = F('tradingplan/tradingplan.html');
const dk = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const now = new Date(), DK = dk(now);
const at = (h, m) => new Date(DK + 'T' + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':00');
const REC = [
  { id: 101, ts: at(9, 50).toISOString(), week: 'w', day: DK, sym: 'BTC', dir: 'Short', tf: '15m', setup: 'A', checks: { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 1 }, missing: [], exec: 'VOL', risk: 2, taken: true, r: null, noTrade: [], notes: '' },
  { id: 102, ts: at(10, 0).toISOString(), week: 'w', day: DK, sym: 'BTC', dir: 'Short', tf: '15m', setup: 'B', checks: { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 1 }, missing: ['e'], exec: 'HALF', risk: 0.5, taken: true, r: null, noTrade: [], notes: '' },
  { id: 103, ts: at(10, 20).toISOString(), week: 'w', day: DK, sym: 'BTC', dir: 'Short', tf: '15m', setup: 'A', checks: { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 1 }, missing: [], exec: 'VOL', risk: 2, taken: true, r: null, noTrade: [], notes: '' },
  { id: 104, ts: at(7, 0).toISOString(), week: 'w', day: DK, sym: 'ETH', dir: 'Long', tf: '15m', setup: 'C', checks: {}, missing: [], exec: 'VOL', risk: 0.5, taken: true, r: null, noTrade: [], notes: '' },
  { id: 105, ts: at(14, 0).toISOString(), week: 'w', day: DK, sym: 'SOL', dir: 'Long', tf: '15m', setup: 'A', checks: {}, missing: [], exec: 'VOL', risk: 2, taken: false, r: null, noTrade: [], notes: 'niet genomen' }
];
const trade = (id, pair, dir, h, m, r) => ({ id, exchange: 'okx', status: 'closed', pair, dir, entry: 100, exit: 110, size: '1000', pnl: r * 10, r, fees: 0, date: DK, time: String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'), openTime: String(+at(h, m)), closeTime: String(+at(h + 1, m)), tps: [], tags: [], notes: '' });

(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e).split('\n')[0])); p.on('dialog', d => d.accept());
  await p.route('**/*', r => /^https?:/.test(r.request().url()) ? r.abort() : r.continue());
  await p.addInitScript(rec => { localStorage.setItem('sj_welcomed', 'true'); localStorage.setItem('tp2:trades', JSON.stringify(rec)); localStorage.setItem('tp2:cfg', JSON.stringify({ matchMin: 45 })); localStorage.setItem('tp2:plans', '{}'); }, REC);
  await p.goto(APP, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1300);

  console.log('--- matchen ---');
  await p.evaluate(ts => { T = ts; TRASH = []; persist(); }, [trade(1, 'BTC/USDC', 'short', 10, 2, 2.1), trade(2, 'BTC/USDC', 'short', 10, 25, -1), trade(3, 'ETH/USDC', 'long', 9, 30, 0.5), trade(4, 'BTC/USDC', 'long', 11, 0, 1), trade(5, 'SOL/USDC', 'long', 14, 5, 1)]);
  const n = await p.evaluate(() => planMatch());
  const refs = await p.evaluate(() => Object.fromEntries(T.map(t => [t.id, t.planRef || null])));
  ok('2 matches: BTC short 10:02 → record 10:00 (dichtstbij), BTC short 10:25 → record 10:20', n === 2 && refs[1] === '102' && refs[2] === '103', JSON.stringify(refs));
  ok('ETH long 9:30 niet: record van 7:00 ligt buiten het venster van 45 min', refs[3] === null);
  ok('BTC long niet: andere richting; SOL niet: record "niet genomen"', refs[4] === null && refs[5] === null);
  ok('elk record hoort bij maximaal één trade (9:50 blijft over)', await p.evaluate(() => T.filter(t => t.planRef === '102').length === 1));
  await p.evaluate(() => { T.push({ ...T[0], id: 6, openTime: String(+T[0].openTime + 60000), time: '10:03', planRef: undefined }); delete T[5].planRef; persist(); });
  ok('een nieuwe trade later: pakt het overgebleven record 9:50 (binnen 45 min)', await p.evaluate(() => planMatch()) === 1 && await p.evaluate(() => T.find(t => t.id === 6).planRef === '101'));

  console.log('--- handmatige correctie blijft staan ---');
  await p.evaluate(() => planSetRef(2, 'none'));
  await p.evaluate(() => { T.push(trade => trade); T.pop(); });
  const na = await p.evaluate(() => { const n = planMatch(); return { n, ref2: T.find(t => t.id === 2).planRef }; });
  ok('"none" wordt niet opnieuw gematcht', na.ref2 === 'none' && na.n === 0, JSON.stringify(na));
  await p.evaluate(() => planSetRef(2, '103'));
  ok('handmatig gekoppeld aan 103 blijft zo na een nieuwe match-ronde', await p.evaluate(() => { planMatch(); return T.find(t => t.id === 2).planRef === '103'; }));

  console.log('--- weergave in de journal ---');
  const hd = await p.evaluate(() => ({ t1: planLine(T.find(t => t.id === 1)), t3: planLine(T.find(t => t.id === 3)) }));
  ok('hover-details: "Poort · B-setup · 6/7 · halve size · 0,5% · mist: e" met knop andere/geen', /B-setup/.test(hd.t1) && /6\/7/.test(hd.t1) && /halve size/.test(hd.t1) && /0,5%/.test(hd.t1) && /mist: e/.test(hd.t1) && /andere \/ geen/.test(hd.t1), hd.t1.replace(/<[^>]+>/g, ' '));
  ok('zonder record: "Geen poort-beoordeling gevonden" + koppelen', /Geen poort-beoordeling gevonden/.test(hd.t3) && /koppelen/.test(hd.t3), hd.t3.replace(/<[^>]+>/g, ' '));
  const lijst = await p.evaluate(() => { STATE.page = 'trades'; STATE.tradeTab = 'all'; render(); return { badges: document.querySelectorAll('.kbadge').length, tekst: [...document.querySelectorAll('.kbadge')].map(x => x.textContent).join() }; });
  ok('tradelijst toont géén "zonder poort"-badge meer (weg sinds v0.9.139: ruis op alles van vóór de koppeling)', !/zonder poort/.test(lijst.tekst), JSON.stringify(lijst));
  await p.evaluate(() => planPick(3));
  const pick = await p.evaluate(() => ({ open: document.getElementById('modal').classList.contains('on'), knoppen: [...document.querySelectorAll('#modal .mbody .btn')].map(b => b.textContent.trim()) }));
  ok('kiezer toont de genomen poort-records van die dag (niet de "niet genomen") + "geen"', pick.open && pick.knoppen.length === 5 && /09:50.*BTC Short.*A-setup.*volle size/.test(pick.knoppen[1]) && /Geen — deze trade ging bewust zonder poort/.test(pick.knoppen[4]) && !pick.knoppen.some(k => /SOL/.test(k)), JSON.stringify(pick.knoppen));
  await p.evaluate(() => planSetRef(3, '104'));
  ok('kiezen koppelt en sluit de kiezer', await p.evaluate(() => T.find(t => t.id === 3).planRef === '104' && !document.getElementById('modal').classList.contains('on')));

  console.log('--- back-up ---');
  const bk = await p.evaluate(() => { const s = snapshotPayload(); return { heeft: !!(s.tradingplan && s.tradingplan.trades && s.tradingplan.cfg), refs: s.trades.filter(t => t.planRef).length }; });
  ok('snapshot bevat het tradingplan-blok (tekst) én de planRefs op de trades', bk.heeft && bk.refs >= 4, JSON.stringify(bk));
  const rt = await p.evaluate(async () => { const s = JSON.parse(JSON.stringify(snapshotPayload())); localStorage.removeItem('tp2:trades'); localStorage.removeItem('tp2:cfg'); T = []; persist(); await applyBackup(s); return { tp: JSON.parse(localStorage.getItem('tp2:trades')).length, cfg: JSON.parse(localStorage.getItem('tp2:cfg')).matchMin, ref: T.find(t => t.time === '10:02').planRef }; });
  ok('terugzetten herstelt tp2:trades, tp2:cfg en de koppelingen', rt.tp === 5 && rt.cfg === 45 && rt.ref === '102', JSON.stringify(rt));
  ok('journal: geen JS-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();

  console.log('--- TradingPlan leest de R uit de journal ---');
  const c2 = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p2 = await c2.newPage(); const e2 = []; p2.on('pageerror', e => e2.push(String(e).split('\n')[0]));
  await p2.addInitScript(rec => { localStorage.setItem('tp2:trades', JSON.stringify(rec)); localStorage.setItem('tp2:meta', JSON.stringify({ schema: 2, introSeen: true })); localStorage.setItem('tp2:plans', '{}'); }, REC.map(r => r.id === 101 ? { ...r, r: 0.3 } : r));
  // journal-trades in IndexedDB sj_db (zoals de journal ze bewaart), gekoppeld aan 102 en 103
  await p2.addInitScript(async ([DK]) => { await new Promise(res => { const r = indexedDB.open('sj_db', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => { const tx = r.result.transaction('kv', 'readwrite'); tx.objectStore('kv').put([{ id: 1, pair: 'BTC/USDC', dir: 'short', r: 2.1, planRef: '102', date: DK }, { id: 2, pair: 'BTC/USDC', dir: 'short', r: -1, planRef: '103', date: DK }, { id: 3, pair: 'ETH/USDC', dir: 'long', r: 0.5, date: DK }], 'trades'); tx.oncomplete = () => { r.result.close(); res(); }; }; r.onerror = () => res(); }); }, [DK]);
  await p2.goto(TP, { waitUntil: 'load' }); await p2.waitForTimeout(900);
  const jr = await p2.evaluate(() => ({ jr: window.__tpJR(), log: document.getElementById('log-body').innerText.replace(/\s+/g, ' ') }));
  ok('JR gevuld voor 102 (+2,1) en 103 (−1), niet voor 101', jr.jr['102'] && jr.jr['102'].r === 2.1 && jr.jr['103'].r === -1 && !jr.jr['101'], JSON.stringify(jr.jr));
  ok('log: R van 102/103 uit de journal (badge "journal"), 101 blijft invoerbaar', (jr.log.match(/journal/g) || []).length === 2 && await p2.evaluate(() => document.querySelectorAll('#log-body input[type=number]').length === 3), jr.log.slice(0, 200));
  await p2.keyboard.press('6'); await p2.waitForTimeout(200);
  const af = await p2.evaluate(() => ({ r: document.getElementById('af-r').value, hint: document.getElementById('af-r-hint').textContent, badges: document.querySelectorAll('#af-trades .badge').length }));
  ok('afsluiting: R vandaag = 0,3 (eigen) + 2,1 − 1 (journal) = +1,40', af.r === '1,4' && /Uit de log/.test(af.hint) && af.badges === 2, JSON.stringify(af));
  await p2.keyboard.press('5'); await p2.waitForTimeout(200);
  ok('poort-statistiek telt de journal-R mee (n=3 met een R)', await p2.evaluate(() => /3 van 30/.test(document.getElementById('pt-weinig').innerText)));
  ok('tradingplan: geen JS-errors', e2.length === 0, e2.slice(0, 3).join(' | '));
  await c2.close();
  console.log(`\n=== Plan-koppeling: ${pass}/${pass + fail} ===`); await b.close(); process.exit(fail ? 1 : 0);
})();
