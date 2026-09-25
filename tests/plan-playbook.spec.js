// Playbook-koppeling (Denny 2026-09-25): de poort in TradingPlan kiest de setup uit de
// journal-playbooks, de grade komt uit het playbook (alleen omlaag), verplichte criteria worden
// vinkjes en dekken vaste poort-punten, en de gekoppelde journal-trade krijgt setup + grade.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const APP = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');
const TP = 'file:///' + path.resolve('tradingplan/tradingplan.html').split(path.sep).join('/');
const PB = {
  'London SFP': { name: 'London SFP', status: 'active', defaultGrade: 'A', criteria: [{ text: 'Sweep van de London-low', mandatory: true, covers: 'trigger' }, { text: 'Reclaim binnen 2 candles', mandatory: true, covers: '' }, { text: 'Session sweep zichtbaar', mandatory: false, covers: '' }], antiCriteria: [{ text: 'Vlak vóór high-impact nieuws', mandatory: false }] },
  'Range-fade': { name: 'Range-fade', status: 'testing', defaultGrade: 'B', criteria: [{ text: 'Afwijzing op VAH / VAL', mandatory: true, covers: 'zone' }], antiCriteria: [] },
  'Oud': { name: 'Oud', status: 'retired', defaultGrade: 'C', criteria: [], antiCriteria: [] }
};
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1360, height: 900 } }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e).split('\n')[0])); p.on('dialog', d => d.accept());
  await p.route('**/*', r => /^https?:/.test(r.request().url()) ? r.abort() : r.continue());
  await p.addInitScript(() => { localStorage.setItem('sj_welcomed', 'true'); if (!localStorage.getItem('tp2:meta')) localStorage.setItem('tp2:meta', JSON.stringify({ schema: 2, introSeen: true, pbSeen: true })); });
  // journal: playbooks + één gesyncte trade van vandaag zonder setup, en één met eigen setup
  await p.goto(APP, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1200);
  const seed = await p.evaluate(async (PB) => {
    localStorage.removeItem('tp2:trades'); localStorage.removeItem('tp2:plans');
    PBOOK = {}; Object.keys(PB).forEach(k => PBOOK[k] = pbNormalize(k, PB[k])); persistPbook();
    const now = Date.now(), d = new Date(now), date = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const t = (id, pair, dir, open, extra) => ({ id, exchange: 'blofin', srcId: 'blofin_' + id + '_' + open, status: 'closed', kind: 'live', pair, dir, entry: 100, exit: 101, stop: 99, size: '1000', pnl: 10, r: 1, fees: 0, date, time: new Date(open).toTimeString().slice(0, 5), openTime: String(open), closeTime: String(open + 36e5), tps: [], tags: [], notes: '', session: 'London', ...extra });
    T = [t(1, 'BTC/USDT', 'long', now + 5 * 60000, {}), t(2, 'ETH/USDT', 'short', now + 5 * 60000, { setup: 'Range-fade', grade: 'B' })]; TRASH = []; persist();
    await new Promise(r => setTimeout(r, 400));
    return { pb: Object.keys(PBOOK).length, date };
  }, PB);
  ok('journal: 3 playbooks opgeslagen (1 archief)', seed.pb === 3);

  console.log('─── Journal: criteria-editor met "dekt poort-punt" ───');
  const ed = await p.evaluate(() => { go('playbook'); openPbEdit('London SFP'); const sel = [...document.querySelectorAll('#pbcrit .critcov')]; return { n: sel.length, v: sel.map(s => s.value), opts: sel[0] ? [...sel[0].options].map(o => o.value).join(',') : '' }; });
  ok('elk criterium heeft een keuzemenu, London SFP: trigger / leeg / leeg', ed.n === 3 && ed.v.join('|') === 'trigger||', JSON.stringify(ed));
  ok('opties zijn de vaste poort-punten zonder harde stops', /trend/.test(ed.opts) && /rr/.test(ed.opts) && !/ftmo|mind/.test(ed.opts), ed.opts);
  const saved = await p.evaluate(() => { pbCritCov(1, "zone"); savePbook(); return PBOOK['London SFP'].criteria.map(c => c.covers).join('|'); });
  ok('keuze wordt opgeslagen op het playbook', saved === 'trigger|zone|', saved);
  ok('detail toont welk poort-punt een criterium dekt', await p.evaluate(() => { openPlaybook('London SFP'); return /dekt poort-punt "Trigger uit de lijst"/.test(document.getElementById('main').innerText) || /dekt poort-punt/.test(document.getElementById('main').innerHTML); }));
  await p.evaluate(() => { PBOOK['London SFP'].criteria[1].covers = ''; persistPbook(); }); await p.waitForTimeout(300);

  console.log('─── TradingPlan: poort kiest uit de journal-playbooks ───');
  await p.goto(TP, { waitUntil: 'load' }); await p.waitForTimeout(1200);
  await p.keyboard.press('5'); await p.waitForTimeout(300);
  const chips = await p.evaluate(() => [...document.querySelectorAll('#pt-pb .pbchip')].map(x => x.textContent.trim()));
  ok('chips: London SFP (A) en Range-fade (B, test); archief niet', chips.length === 2 && /ALondon SFP/.test(chips[0]) && /BRange-fadetest/.test(chips[1]), JSON.stringify(chips));
  ok('zonder keuze: oordeel vraagt eerst om een setup', await p.evaluate(() => /Kies eerst welke setup/.test(document.getElementById('pt-why').textContent)));
  await p.click('#pt-pb .pbchip:has-text("London SFP")'); await p.waitForTimeout(200);
  const st = await p.evaluate(() => ({ on: document.querySelector('.stype button.on') && document.querySelector('.stype button.on').dataset.t, def: !!document.querySelector('.stype button.def[data-t="A"]'), disB: document.querySelector('.stype button[data-t="B"]').disabled, disC: document.querySelector('.stype button[data-t="C"]').disabled, order: (document.getElementById('pt-pbchecks').compareDocumentPosition(document.getElementById('pt-list')) & 4) === 4, pbInputs: document.querySelectorAll('#pt-pbchecks input').length, opt: document.querySelectorAll('#pt-pbchecks .chk.opt').length, anti: document.querySelectorAll('#pt-pbchecks .chk.anti').length, covered: [...document.querySelectorAll('#pt-list .cov .l')].map(x => x.textContent), fixedInputs: document.querySelectorAll('#pt-list input').length, head: document.getElementById('pt-fixed-h').innerText, stats: !document.getElementById('pt-pbstats').hidden, statsTxt: document.getElementById('pt-pbstats').innerText.replace(/\s+/g, ' ') }));
  ok('grade springt op A uit het playbook; B en C blijven kiesbaar (omlaag)', st.on === 'A' && st.def && !st.disB && !st.disC, JSON.stringify(st));
  ok('playbook-blok staat boven de vaste checklist: 2 verplicht + 1 optioneel + 1 anti', st.order && st.pbInputs === 4 && st.opt === 1 && st.anti === 1, JSON.stringify(st));
  ok('"Trigger uit de lijst" is gedekt: geen tweede vinkje, 6 vaste inputs, kop zegt 1 punt gedekt', st.covered.join() === 'Trigger uit de lijst' && st.fixedInputs === 6 && /1 punt al gedekt/.test(st.head), JSON.stringify({ c: st.covered, n: st.fixedInputs, h: st.head }));
  ok('statistiekkaart zichtbaar, zegt nog geen trades met deze setup', st.stats && /Nog geen gesloten live-trades/.test(st.statsTxt), st.statsTxt.slice(0, 120));
  // alles vast afvinken, playbook nog open → 2 punten open → geen trade; dan verplichte erbij → volle size
  for (const i of await p.$$('#pt-list input')) await i.check();
  const v0 = await p.evaluate(() => document.querySelector('#pt-verdict .g').textContent + ' | ' + document.getElementById('pt-why').textContent);
  ok('vaste lijst compleet maar playbook open → geen trade, mist de 2 verplichte', /Geen trade/.test(v0) && /Sweep van de London-low/.test(v0) && /Reclaim binnen 2 candles/.test(v0), v0);
  for (const i of await p.$$('#pt-pbchecks input[data-must="1"]')) await i.check();
  const v1 = await p.evaluate(() => document.querySelector('#pt-verdict .g').textContent + ' | ' + document.getElementById('pt-why').textContent);
  ok('verplichte playbook-punten erbij → volle size 2%, 8 van 8 (7 vast − 1 gedekt + 2 playbook)', /Volle size · 2%/.test(v1) && /8 van 8/.test(v1), v1);
  await p.click('.stype button[data-t="B"]'); await p.waitForTimeout(150);
  const v2 = await p.evaluate(() => document.querySelector('#pt-verdict .g').textContent + ' | ' + document.getElementById('pt-stype-note').innerText);
  ok('omlaag naar B: volle size 1% + melding', /Volle size · 1%/.test(v2) && /A-playbook vandaag een B-setup/.test(v2), v2);
  await p.click('.stype button[data-t="A"]'); await p.waitForTimeout(100);
  await (await p.$('#pt-pbchecks input[data-anti="1"]')).check(); await p.waitForTimeout(150);
  const v3 = await p.evaluate(() => document.querySelector('#pt-verdict .g').textContent + ' | ' + document.getElementById('pt-why').textContent);
  ok('anti-criterium aangevinkt → geen trade', /Geen trade/.test(v3) && /Anti-criterium/.test(v3), v3);
  await (await p.$('#pt-pbchecks input[data-anti="1"]')).uncheck();
  await (await p.$('#pt-pbchecks input[data-must="1"]')).uncheck(); await p.waitForTimeout(150);
  ok('één verplicht playbook-punt open → halve size', await p.evaluate(() => /Halve size/.test(document.querySelector('#pt-verdict .g').textContent)));
  await (await p.$('#pt-pbchecks input[data-must="1"]')).check();
  // opslaan: record krijgt pb + pbGrade; log toont playbook
  await p.fill('#pt-sym', 'BTC'); await p.check('#pt-taken'); await p.click('#pt-save'); await p.waitForTimeout(400);
  const rec = await p.evaluate(() => { const r = JSON.parse(localStorage.getItem('tp2:trades'))[0]; return { pb: r.pb, pbGrade: r.pbGrade, setup: r.setup, exec: r.exec, sym: r.sym, checks: r.checks.trigger, log: (document.querySelector('[data-tab="log"]').click(), document.getElementById('log-body').innerText.replace(/\s+/g, ' ').slice(0, 160)) }; });
  ok('record: pb London SFP, pbGrade A, setup A, VOL, gedekt punt trigger=true', rec.pb === 'London SFP' && rec.pbGrade === 'A' && rec.setup === 'A' && rec.exec === 'VOL' && rec.checks === true, JSON.stringify(rec));
  ok('log toont de playbook-naam', /London SFP/.test(rec.log), rec.log);
  ok('na opslaan is de poort leeg: geen setup gekozen', await p.evaluate(() => { document.querySelector('[data-tab="poort"]').click(); return !document.querySelector('#pt-pb .pbchip.on') && !document.querySelector('.stype button.on'); }));

  console.log('─── TradingPlan: tabblad Regels ───');
  await p.keyboard.press('2'); await p.waitForTimeout(300);
  const rg = await p.evaluate(() => ({ title: document.getElementById('ph-title').textContent, tbl: document.getElementById('rg-tbl').innerText.replace(/\s+/g, ' '), href: document.getElementById('rg-journal').getAttribute('href') }));
  ok('tab heet Regels; tabel met London SFP (dekt "Trigger uit de lijst") en Range-fade (test), archief niet', /Regels/.test(rg.title) && /London SFP/.test(rg.tbl) && /dekt "Trigger uit de lijst"/.test(rg.tbl) && /Range-fade/.test(rg.tbl) && /test/.test(rg.tbl) && !/Oud/.test(rg.tbl), rg.tbl.slice(0, 200));
  ok('knop verwijst naar de playbook-pagina van de journal', /\?page=playbook$/.test(rg.href), rg.href);

  console.log('─── Journal: gekoppelde trade krijgt setup en grade uit de poort ───');
  await p.goto(APP, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500);
  const jm = await p.evaluate(() => { const btc = T.find(t => t.id === 1), eth = T.find(t => t.id === 2); return { ref: btc.planRef, setup: btc.setup, grade: btc.grade, ethSetup: eth.setup, ethGrade: eth.grade, line: planLine(btc).replace(/<[^>]+>/g, ' ') }; });
  ok('BTC-trade gekoppeld, setup "London SFP" en grade A overgenomen', !!jm.ref && jm.ref !== 'none' && jm.setup === 'London SFP' && jm.grade === 'A', JSON.stringify(jm));
  ok('ETH-trade met eigen setup blijft onaangeraakt', jm.ethSetup === 'Range-fade' && jm.ethGrade === 'B');
  ok('poort-regel toont de playbook-naam', /London SFP/.test(jm.line) && /A-setup/.test(jm.line), jm.line);
  // handmatig koppelen via planSetRef neemt ook over; eigen setup wordt nooit overschreven
  const ms = await p.evaluate(() => { const btc = T.find(t => t.id === 1); btc.setup = 'Eigen keuze'; btc.grade = ''; planSetRef(1, btc.planRef); return { setup: T.find(t => t.id === 1).setup, grade: T.find(t => t.id === 1).grade }; });
  ok('handmatig koppelen: eigen setup blijft, lege grade wordt gevuld', ms.setup === 'Eigen keuze' && ms.grade === 'A', JSON.stringify(ms));

  console.log('─── Zonder journal-playbooks: poort zoals voorheen ───');
  await p.evaluate(async () => { PBOOK = {}; persistPbook(); await new Promise(r => setTimeout(r, 300)); });
  await p.goto(TP, { waitUntil: 'load' }); await p.waitForTimeout(1200); await p.keyboard.press('5'); await p.waitForTimeout(300);
  const zonder = await p.evaluate(() => ({ chips: document.querySelectorAll('#pt-pb .pbchip').length, fixed: document.querySelectorAll('#pt-list input').length, head: document.getElementById('pt-fixed-h').hidden, stype: document.querySelectorAll('.stype button:not([disabled])').length, stats: document.getElementById('pt-pbstats').hidden }));
  ok('geen chips, 7 vaste vinkjes, kop verborgen, A/B/C vrij, geen statistiekkaart', zonder.chips === 0 && zonder.fixed === 7 && zonder.head && zonder.stype === 3 && zonder.stats, JSON.stringify(zonder));
  await p.click('.stype button[data-t="B"]'); for (const i of await p.$$('#pt-list input')) await i.check();
  ok('oordeel zonder playbook: volle size 1%, 7 van 7', await p.evaluate(() => /Volle size · 1%/.test(document.querySelector('#pt-verdict .g').textContent) && /7 van 7/.test(document.getElementById('pt-why').textContent)));

  ok('geen JS-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== Plan-playbook: ${pass}/${pass + fail} ===`); await b.close(); process.exit(fail ? 1 : 0);
})();
