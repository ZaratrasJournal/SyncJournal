// TradingPlan v2 (het echte bestand, tradingplan/tradingplan.html):
//  - bestaande v1-data in localStorage (tp2:*) → na laden alles aanwezig, migratie eenmalig
//  - screenshots in IndexedDB "tp2" (toevoegen, back-up mee, import zet terug)
//  - v1-back-up importeren, lege start met uitleg, route/cockpit/poort/afsluiting/instellingen
//  - licht/donker, mobiel, reduced motion
const { chromium } = require('playwright'); const path = require('path');
const APP = 'file:///' + path.resolve('tradingplan/tradingplan.html').split(path.sep).join('/');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
// 1×1 png
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const dk = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const now = new Date(), DK = dk(now), Y1 = dk(new Date(now - 864e5));
function isoWeek(d) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return t.getUTCFullYear() + '-W' + String(Math.ceil(((t - y0) / 864e5 + 1) / 7)).padStart(2, '0'); }
const WK = isoWeek(now);
// v1-data zoals die nu in browsers van leden staat: geen cfg, geen meta, trades met grade, plan-tekstveld
const V1 = {
  plans: {
    ['week-' + WK]: { id: 'week-' + WK, type: 'week', key: WK, checks: { review: true, wopen: true }, images: [], links: [], saved: true, savedAt: '2026-09-21T19:00:00.000Z', updatedAt: '2026-09-21T19:00:00.000Z', bias: 'Bearish', maxtrades: '4', focus: 'Geen entry zonder SFP', notrade: 'Na 2 verliezers op één dag' },
    ['dag-' + Y1]: { id: 'dag-' + Y1, type: 'dag', key: Y1, checks: { start: true, trend: true }, images: [{ data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' }], links: [{ url: 'https://www.tradingview.com/x/abc', label: 'chart' }], saved: true, savedAt: Y1 + 'T07:30:00.000Z', updatedAt: Y1 + 'T07:30:00.000Z', bias: 'Bearish', plan: 'Als sweep 79k dan short', mind: '2' },
    ['dag-' + DK]: { id: 'dag-' + DK, type: 'dag', key: DK, checks: {}, images: [], links: [], saved: false, savedAt: null, updatedAt: DK + 'T07:00:00.000Z', bias: 'Bullish', mind: '5', scenarios: [{ title: 'Reclaim', als: 'prijs reclaimt 76k', dan: 'long', ongeldig: 'close onder 75.5k', text: '', images: [], links: [] }] }
  },
  trades: [
    { id: 1, ts: Y1 + 'T09:00:00.000Z', week: WK, day: Y1, sym: 'BTC', dir: 'Short', tf: '15m', checks: { trend: true, zone: true, trigger: true, sl: true, rr: true, ftmo: true, mind: true }, missing: [], grade: 'A', risk: 1, taken: true, r: 2.1, noTrade: [], notes: 'v1 A' },
    { id: 2, ts: Y1 + 'T13:00:00.000Z', week: WK, day: Y1, sym: 'BTC', dir: 'Long', tf: '5m', checks: { trend: true, zone: false, trigger: true, sl: true, rr: true, ftmo: true, mind: true }, missing: ['zone'], grade: 'B', risk: 0.5, taken: true, r: -1, noTrade: [], notes: 'v1 B' },
    { id: 3, ts: DK + 'T08:00:00.000Z', week: WK, day: DK, sym: 'ETH', dir: 'Long', tf: '15m', checks: {}, missing: ['trend', 'rr'], grade: 'NO', risk: 0, taken: true, r: -1, noTrade: [], notes: 'v1 regelbreuk' }
  ],
  pb: { gradeA: '• Mijn eigen A-regel' }
};

(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1360, height: 900 }, colorScheme: 'dark' }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e).split('\n')[0])); p.on('dialog', d => d.accept());
  await p.addInitScript(v => { if (localStorage.getItem('tp2:meta')) return;   /* alleen de allereerste keer seeden (init-scripts draaien ook na een reload) */ localStorage.setItem('tp2:plans', JSON.stringify(v.plans)); localStorage.setItem('tp2:trades', JSON.stringify(v.trades)); localStorage.setItem('tp2:pb', JSON.stringify(v.pb)); localStorage.setItem('tp2:theme', 'dark'); }, V1);
  await p.goto(APP, { waitUntil: 'load' }); await p.waitForTimeout(700);

  console.log('--- bestaande v1-data → v2 ---');
  const m = await p.evaluate(() => ({ meta: JSON.parse(localStorage.getItem('tp2:meta')), cfg: JSON.parse(localStorage.getItem('tp2:cfg')), tr: JSON.parse(localStorage.getItem('tp2:trades')), pl: JSON.parse(localStorage.getItem('tp2:plans')), help: document.getElementById('help').hidden, theme: document.documentElement.getAttribute('data-theme') }));
  ok('schema 2 gezet, bestaande gebruiker ziet geen uitleg, thema bewaard', m.meta.schema === 2 && m.meta.introSeen === true && m.help === true && m.theme === 'dark', JSON.stringify(m.meta));
  ok('cfg aangemaakt met 7 poort-checks, regel setup×checklist, venster 45', m.cfg.pt.length === 7 && m.cfg.gradeMode === 'assen' && m.cfg.matchMin === 45, JSON.stringify(Object.keys(m.cfg)));
  ok('trades gemigreerd: A→vol, B→half, NO→regelbreuk, setup onbekend, R en notities intact', m.tr.map(t => t.exec).join() === 'VOL,HALF,NO' && m.tr.every(t => t.setup === '') && m.tr[0].r === 2.1 && m.tr[2].notes === 'v1 regelbreuk', JSON.stringify(m.tr.map(t => [t.grade, t.exec, t.r])));
  const d1 = m.pl['dag-' + Y1];
  ok('oud plan-tekstveld → scenario 1; dagplan-screenshot + link verhuisd naar scenario 1', d1.scenarios.length === 1 && d1.scenarios[0].text === 'Als sweep 79k dan short' && d1.scenarios[0].images.length === 1 && d1.scenarios[0].links.length === 1 && d1.images.length === 0, JSON.stringify(d1.scenarios[0]).slice(0, 200));
  ok('inline base64-screenshot verplaatst naar IndexedDB (idb-id, geen data meer)', !!d1.scenarios[0].images[0].idb && !d1.scenarios[0].images[0].data, JSON.stringify(d1.scenarios[0].images[0]).slice(0, 80));
  const idb = await p.evaluate(() => new Promise(res => { const r = indexedDB.open('tp2', 1); r.onsuccess = () => { const st = r.result.transaction('img', 'readonly').objectStore('img'); const g = st.getAllKeys(); g.onsuccess = () => res(g.result.length); }; r.onerror = () => res(-1); }));
  ok('IndexedDB tp2 bevat die screenshot', idb === 1, 'keys=' + idb);
  ok('playbook-aanpassing van de gebruiker bewaard, rest standaard', await p.evaluate(() => /Mijn eigen A-regel/.test(document.querySelector('[data-pb="gradeA"]').innerText) && /Verliezen van constructie/.test(document.querySelector('[data-pb="short"]').innerText)));

  console.log('--- overzicht en poort met deze data ---');
  const ov = await p.evaluate(() => ({ route: [...document.querySelectorAll('#route .rs .s')].map(x => x.textContent).join(), kpi: document.getElementById('kpi').innerText.replace(/\s+/g, ' ') }));
  ok('route: weekplan klaar, dagplan bezig, poort klaar (trade vandaag), afsluiting nog', /klaar,klaar,bezig,klaar,nog doen/.test(ov.route) || /nog doen,klaar,bezig,klaar,nog doen/.test(ov.route), ov.route);
  ok('cockpit: bias Bullish, week Bearish, 1 vandaag · 3 / 4 week, mentaal 5 onrustig', /Bullish/.test(ov.kpi) && /1 vandaag · 3 \/ 4 week/.test(ov.kpi) && /5 \/ 5/.test(ov.kpi) && /onrustig/.test(ov.kpi), ov.kpi);
  await p.keyboard.press('5'); await p.waitForTimeout(200);
  ok('poort: waarschuwing mentaal 5, trade 4 van max 4', await p.evaluate(() => /5 \/ 5/.test(document.getElementById('pt-warns').innerText) && /Trade 4 van max 4/.test(document.getElementById('pt-warns').innerText)));
  ok('statistiek: n= en "te weinig data" (3 van 30)', await p.evaluate(() => /3 van 30/.test(document.getElementById('pt-weinig').innerText)));

  console.log('--- screenshot toevoegen → IndexedDB, back-up neemt hem mee ---');
  await p.keyboard.press('4'); await p.waitForTimeout(200);
  await p.setInputFiles('#sc-wrap .sc-card:first-child input[type=file]', { name: 'chart.png', mimeType: 'image/png', buffer: PNG }); await p.waitForTimeout(700);
  const im = await p.evaluate(() => { const pl = JSON.parse(localStorage.getItem('tp2:plans')); const s = pl['dag-' + new Date().toISOString().slice(0, 10)] || Object.values(pl).find(x => x.type === 'dag' && x.scenarios && x.scenarios[0].title === 'Reclaim'); return { n: s.scenarios[0].images.length, idb: s.scenarios[0].images[0] && s.scenarios[0].images[0].idb, thumbs: document.querySelectorAll('#sc-wrap .thumb').length }; });
  ok('chart bij scenario 1: in localStorage alleen een idb-id, thumbnail zichtbaar', im.n === 1 && !!im.idb && im.thumbs === 1, JSON.stringify(im));
  const bk = await p.evaluate(() => { let json = null; const orig = URL.createObjectURL; URL.createObjectURL = b => { const fr = new FileReader(); fr.onload = () => { window.__bk = fr.result; }; fr.readAsText(b); return 'blob:x'; }; document.getElementById('exp-json').click(); URL.createObjectURL = orig; return new Promise(r => setTimeout(() => r(window.__bk), 300)); });
  const bkj = JSON.parse(bk);
  ok('back-up v2: trades, plans, playbook, cfg, meta én images (2 stuks)', bkj.version === 2 && bkj.cfg && bkj.meta && Object.keys(bkj.images || {}).length === 2 && bkj.trades.length === 3, JSON.stringify(Object.keys(bkj)) + ' images=' + Object.keys(bkj.images || {}).length);

  console.log('--- afsluiting en les ---');
  await p.keyboard.press('6'); await p.waitForTimeout(200);
  await p.click('#af-sc [data-v="0"]'); await p.click('#af-fol [data-v="nee"]'); await p.fill('#af-les', 'Niet handelen met een 5.'); await p.click('#af-save'); await p.waitForTimeout(200);
  ok('afsluiting opgeslagen met R uit de log (−1)', await p.evaluate(() => { const pl = JSON.parse(localStorage.getItem('tp2:plans')); const d = Object.values(pl).find(x => x.close && x.close.saved); return d && d.close.gevolgd === 'nee' && d.close.r === -1; }));

  console.log('--- v1-back-up importeren (bestand zoals de oude app het maakte) ---');
  const v1file = JSON.stringify({ app: 'TradingPlan', version: 1, exported: '2026-09-20T10:00:00.000Z', trades: V1.trades.slice(0, 1), plans: { ['dag-' + Y1]: V1.plans['dag-' + Y1] }, playbook: V1.pb, images: { im_old: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' } });
  await p.evaluate(t => window.__tpImport(t), v1file); await p.waitForTimeout(1300); await p.waitForLoadState('load'); await p.waitForTimeout(600);
  const imp = await p.evaluate(() => ({ tr: JSON.parse(localStorage.getItem('tp2:trades')), meta: JSON.parse(localStorage.getItem('tp2:meta')), rows: document.querySelectorAll('#log-body tr').length }));
  ok('na v1-import: 1 trade (vol), schema 2, log gevuld', imp.tr.length === 1 && imp.tr[0].exec === 'VOL' && imp.meta.schema === 2 && imp.rows >= 2, JSON.stringify({ n: imp.tr.length, exec: imp.tr[0] && imp.tr[0].exec, schema: imp.meta && imp.meta.schema, rows: imp.rows }));
  await ctx.close();

  console.log('--- nieuwe gebruiker ---');
  const c2 = await b.newContext({ viewport: { width: 1360, height: 900 } }); const p2 = await c2.newPage(); p2.on('pageerror', e => errs.push('leeg: ' + String(e).split('\n')[0]));
  await p2.goto(APP, { waitUntil: 'load' }); await p2.waitForTimeout(500);
  ok('uitleg opent vanzelf; route alles "nog doen"', await p2.evaluate(() => !document.getElementById('help').hidden && [...document.querySelectorAll('#route .rs .s')].every(x => x.textContent === 'nog doen')));
  await p2.click('#h-skip'); await p2.waitForTimeout(100);
  ok('overslaan onthouden (introSeen)', await p2.evaluate(() => JSON.parse(localStorage.getItem('tp2:meta')).introSeen === true));
  await c2.close();

  console.log('--- mobiel, licht, reduced motion ---');
  const c3 = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light', reducedMotion: 'reduce' }); const p3 = await c3.newPage(); p3.on('pageerror', e => errs.push('mob: ' + String(e).split('\n')[0]));
  await p3.addInitScript(() => { localStorage.setItem('tp2:meta', JSON.stringify({ schema: 2, introSeen: true })); });
  await p3.goto(APP, { waitUntil: 'load' }); await p3.waitForTimeout(400);
  ok('geen horizontale scroll op 390px', await p3.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
  for (const k of ['2', '3', '4', '5', '6', '7', '8']) { await p3.keyboard.press(k); await p3.waitForTimeout(80); }
  ok('alle tabs openen zonder fouten op mobiel', errs.filter(e => /mob:/.test(e)).length === 0);
  await c3.close();
  ok('geen JS-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== TradingPlan v2: ${pass}/${pass + fail} ===`); await b.close(); process.exit(fail ? 1 : 0);
})();
