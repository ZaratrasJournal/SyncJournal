// TradingPlan v2 — demo-check: route, cockpit, poort-logica, afsluiting, log, instellingen,
// v1-backup importeren, nieuwe gebruiker (uitleg + lege staten), mobiel. Draait op de demo.
const { chromium } = require('playwright'); const path = require('path');
const APP = 'file:///' + path.resolve('demos/tradingplan-v2-demo.html').split(path.sep).join('/');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1360, height: 900 }, colorScheme: 'dark' }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e).split('\n')[0])); p.on('dialog', d => d.accept());
  await p.goto(APP, { waitUntil: 'load' }); await p.waitForTimeout(500);

  console.log('--- overzicht (voorbeelddata) ---');
  const r = await p.evaluate(() => ({ route: [...document.querySelectorAll('#route .rs')].map(x => x.querySelector('.t').textContent + ':' + x.querySelector('.s').textContent), kpi: document.getElementById('kpi').innerText.replace(/\s+/g, ' ').slice(0, 400), sc: document.querySelectorAll('#ov-sc .sc').length, nt: document.querySelectorAll('#ov-nt span').length, help: document.getElementById('help').hidden, tabs: document.querySelectorAll('#tabs button').length }));
  ok('route: 5 stappen met status', r.route.length === 5 && /Playbook:klaar/.test(r.route[0]) && /Weekplan:klaar/.test(r.route[1]) && /Dagplan:bezig/.test(r.route[2]) && /Poort:klaar/.test(r.route[3]) && /Afsluiting:nog doen/.test(r.route[4]), JSON.stringify(r.route));
  ok('cockpit: bias, 2 trades vandaag en 5/5 week (limiet), 2 verliezers, mentaal 4 onrustig', /Bearish/.test(r.kpi) && /2 vandaag · 5 \/ 5 week/.test(r.kpi) && /weeklimiet bereikt/.test(r.kpi) && /al 2 verliezers/.test(r.kpi) && /onrustig/.test(r.kpi), r.kpi);
  ok('2 scenario-kaarten, 3 no-trade-condities, uitleg dicht, 8 tabs', r.sc === 2 && r.nt === 3 && r.help === true && r.tabs === 8, JSON.stringify([r.sc, r.nt, r.help, r.tabs]));
  await p.screenshot({ path: 'tests/screenshots/tp2-overzicht.png', fullPage: true });

  console.log('--- poort ---');
  await p.keyboard.press('5'); await p.waitForTimeout(200);
  const pt = await p.evaluate(() => ({ warns: document.getElementById('pt-warns').innerText.replace(/\s+/g, ' '), verdict: document.querySelector('#pt-verdict .g').textContent, why: document.getElementById('pt-why').textContent, weinig: document.getElementById('pt-weinig').innerText, mw: !!document.querySelector('#pt-list .mw'), stats: document.getElementById('pt-stats').innerText.replace(/\s+/g, ' ').slice(0, 300) }));
  ok('waarschuwingen: trade 6 van max 5 (limiet), 2 verliezers, mentaal 4 (ook bij de check zelf)', /Trade 6 van max 5/.test(pt.warns) && /limiet/.test(pt.warns) && /2 verliezers/.test(pt.warns) && /4 \/ 5/.test(pt.warns) && pt.mw, pt.warns);
  ok('no-trade-condities open: geen trade, ongeacht de rest', pt.verdict === 'Geen trade' && /No-trade-conditie/.test(pt.why), pt.why);
  await p.evaluate(() => { document.querySelectorAll('#pt-notrade input').forEach(i => { i.checked = true; i.dispatchEvent(new Event('change')); }); });
  ok('no-trade afgevinkt, niets gecheckt: harde stops gaan voor', await p.evaluate(() => /Harde stop/.test(document.getElementById('pt-why').textContent)), await p.evaluate(() => document.getElementById('pt-why').textContent));
  await p.evaluate(() => { document.querySelectorAll('#pt-list input').forEach(i => { i.checked = true; }); document.getElementById('pt-list').dispatchEvent(new Event('change')); });
  ok('alles gecheckt maar geen setup gekozen: "kies eerst welke setup"', await p.evaluate(() => /Kies eerst/.test(document.getElementById('pt-why').textContent)), await p.evaluate(() => document.getElementById('pt-why').textContent));
  ok('statistiek: te weinig data (8 van 30), n= per groep', /8 van 30/.test(pt.weinig) && /n=/.test(pt.stats), pt.weinig + ' | ' + pt.stats);
  await p.click('#pt-stype [data-t="B"]');
  await p.evaluate(() => { document.querySelectorAll('#pt-list input').forEach((i, n) => { i.checked = n !== 4; }); document.getElementById('pt-list').dispatchEvent(new Event('change')); });
  ok('B-setup, 1 punt open: Halve size 0,5%', await p.evaluate(() => document.querySelector('#pt-verdict .g').textContent) === 'Halve size · 0,5%');
  await p.evaluate(() => { document.querySelectorAll('#pt-list input').forEach(i => { i.checked = true; }); document.getElementById('pt-list').dispatchEvent(new Event('change')); });
  ok('alles afgevinkt: Volle size 1%', await p.evaluate(() => document.querySelector('#pt-verdict .g').textContent) === 'Volle size · 1%');
  await p.evaluate(() => { document.querySelectorAll('#pt-notrade input').forEach((i, n) => { i.checked = n < 2; i.dispatchEvent(new Event('change')); }); });
  ok('no-trade-conditie open: geen trade', await p.evaluate(() => document.querySelector('#pt-verdict .g').textContent) === 'Geen trade');
  await p.evaluate(() => { document.querySelectorAll('#pt-notrade input').forEach(i => { i.checked = true; i.dispatchEvent(new Event('change')); }); document.getElementById('pt-taken').checked = true; document.getElementById('pt-save').click(); });
  await p.waitForTimeout(150);
  ok('trade opgeslagen; teller loopt door (7 van 5)', await p.evaluate(() => document.getElementById('pt-warns').innerText.includes('Trade 7 van max 5') && /limiet/.test(document.getElementById('pt-warns').innerText)));
  await p.screenshot({ path: 'tests/screenshots/tp2-poort.png', fullPage: true });

  console.log('--- afsluiting ---');
  await p.keyboard.press('6'); await p.waitForTimeout(200);
  const af = await p.evaluate(() => ({ sc: document.querySelectorAll('#af-sc button').length, r: document.getElementById('af-r').value, hint: document.getElementById('af-r-hint').textContent, trades: document.querySelectorAll('#af-trades li').length }));
  ok('2 scenario-knoppen + geen; R automatisch -2 uit de log; 3 trades van vandaag', af.sc === 3 && af.r === '-2' && /Uit de log/.test(af.hint) && af.trades === 3, JSON.stringify(af));
  await p.click('#af-sc [data-v="0"]'); await p.click('#af-fol [data-v="deels"]'); await p.fill('#af-les', 'Na CPI eerst de 15m close afwachten.'); await p.click('#af-save'); await p.waitForTimeout(200);
  ok('afsluiting opgeslagen in log', await p.evaluate(() => /Opgeslagen in log/.test(document.getElementById('af-status').textContent)));
  await p.keyboard.press('1'); await p.waitForTimeout(200);
  ok('route: afsluiting nu klaar', await p.evaluate(() => /Afsluiting:klaar/.test([...document.querySelectorAll('#route .rs')].map(x => x.querySelector('.t').textContent + ':' + x.querySelector('.s').textContent).join())));

  console.log('--- dagplan ---');
  await p.keyboard.press('4'); await p.waitForTimeout(200);
  ok('les van gisteren bovenaan', await p.evaluate(() => /Wacht op de 15m close/.test(document.getElementById('dg-les').innerText)));
  ok('stap 1 checklist 10 / 12, stap 2 formulier met weekcontext', await p.evaluate(() => /10 \/ 12/.test(document.getElementById('dg-prog').innerText) && /uit je weekplan/i.test(document.getElementById('dg-ctx').innerText)));
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(100);
  ok('‹ bladert naar gisteren', await p.evaluate(() => document.getElementById('dg-today').hidden === false));
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(100);
  await p.screenshot({ path: 'tests/screenshots/tp2-dagplan.png', fullPage: true });

  console.log('--- log ---');
  await p.keyboard.press('7'); await p.waitForTimeout(200);
  ok('afsluitingen en setup/oordeel per trade zichtbaar', await p.evaluate(() => document.querySelectorAll('#log-body .bg-purple').length >= 2 && document.querySelectorAll('#log-body .gmark').length >= 8));
  await p.click('#log-filter [data-v="afsluiting"]'); await p.waitForTimeout(100);
  ok('filter afsluitingen: 3 rijen', await p.evaluate(() => document.querySelectorAll('#log-body tr').length === 3), await p.evaluate(() => document.querySelectorAll('#log-body tr').length));

  console.log('--- instellingen ---');
  await p.keyboard.press('8'); await p.waitForTimeout(200);
  await p.click('[data-add="pt"]'); await p.waitForTimeout(100);
  ok('poort-check toegevoegd: 8 checks in de poort, legenda "8 van 8"', await p.evaluate(() => document.querySelectorAll('#pt-list input').length === 8 && /8 van 8/.test(document.getElementById('pt-leg').innerText)));
  await p.click('#gm [data-v="playbook"]'); await p.waitForTimeout(100);
  ok('regel "playbook wint": halve size bestaat niet', await p.evaluate(() => /bestaat niet/.test(document.getElementById('pt-leg').innerText)));
  await p.click('#gm [data-v="checklist"]'); await p.waitForTimeout(100);
  ok('regel "checklist wint": A · 1% en statistiek per A/B-trades', await p.evaluate(() => /1%/.test(document.getElementById('pt-leg').innerText) && /A-trades/.test(document.getElementById('pt-stats').innerText)));
  await p.click('#gm [data-v="assen"]');
  await p.click('[data-reset="pt"]'); await p.waitForTimeout(100);
  ok('herstel standaard: weer 7 checks', await p.evaluate(() => document.querySelectorAll('#pt-list input').length === 7));
  await p.screenshot({ path: 'tests/screenshots/tp2-instellingen.png', fullPage: true });

  console.log('--- v1-backup importeren ---');
  const v1b = JSON.stringify({ app: 'TradingPlan', version: 1, plans: { 'dag-2026-09-10': { id: 'dag-2026-09-10', type: 'dag', key: '2026-09-10', checks: { start: true }, images: [], links: [], saved: true, savedAt: '2026-09-10T08:00:00.000Z', updatedAt: '2026-09-10T08:00:00.000Z', bias: 'Bullish', plan: 'Oud vrij tekstveld', mind: '2' } }, trades: [{ id: 99, ts: '2026-09-10T10:00:00.000Z', week: '2026-W37', day: '2026-09-10', sym: 'BTC', dir: 'Long', tf: '15m', checks: {}, missing: ['rr'], grade: 'B', risk: 0.5, taken: true, r: 1.5, noTrade: [], notes: 'v1' }], playbook: { gradeA: '• Oud A' }, images: {} });
  await p.evaluate(t => window.__tpImport(t), v1b); await p.waitForTimeout(1200); await p.waitForLoadState('load'); await p.waitForTimeout(400);
  const imp = await p.evaluate(() => { const t = JSON.parse(localStorage.getItem('tp2demo:trades'))[0]; const pl = JSON.parse(localStorage.getItem('tp2demo:plans'))['dag-2026-09-10']; return { exec: t.exec, setup: t.setup, sc: pl.scenarios && pl.scenarios.length, oud: pl.scenarios && pl.scenarios[0].text, pbA: JSON.parse(localStorage.getItem('tp2demo:pb')).gradeA, log: document.getElementById('log-body').innerText.includes('v1') }; });
  ok('grade B wordt half, setup onbekend, oud tekstveld wordt scenario 1, playbook mee, in de log', imp.exec === 'HALF' && imp.setup === '' && imp.sc === 1 && imp.oud === 'Oud vrij tekstveld' && imp.pbA === '• Oud A' && imp.log, JSON.stringify(imp));
  await ctx.close();

  console.log('--- nieuwe gebruiker (leeg) ---');
  const c2 = await b.newContext({ viewport: { width: 1360, height: 900 } }); const p2 = await c2.newPage(); p2.on('pageerror', e => errs.push('leeg: ' + String(e).split('\n')[0])); p2.on('dialog', d => d.accept());
  await p2.addInitScript(() => { localStorage.setItem('tp2demo:meta', '{}'); localStorage.setItem('tp2demo:plans', '{}'); });
  await p2.goto(APP, { waitUntil: 'load' }); await p2.waitForTimeout(400);
  const e2 = await p2.evaluate(() => ({ help: !document.getElementById('help').hidden, titel: document.querySelector('#help-box h3').textContent }));
  ok('uitleg opent op kaart 1', e2.help && /Beslissen v/.test(e2.titel), JSON.stringify(e2));
  await p2.click('#h-next'); await p2.click('#h-next'); await p2.click('#h-next'); await p2.waitForTimeout(100);
  ok('kaart 4 toont de sneltoetsen', await p2.evaluate(() => /sneltoetsen/i.test(document.getElementById('help-box').innerText) && !!document.getElementById('h-go')));
  await p2.click('#h-go'); await p2.waitForTimeout(200);
  const e3 = await p2.evaluate(() => ({ route: [...document.querySelectorAll('#route .rs .s')].map(x => x.textContent).join(), leeg: document.querySelector('#ov-sc .empty-state') !== null, kpi: document.getElementById('kpi').innerText }));
  ok('route alles "nog doen", lege staat met uitleg, cockpit zonder waarden', /^nog doen,nog doen,nog doen,nog doen,nog doen$/.test(e3.route) && e3.leeg && /nog niet/.test(e3.kpi), JSON.stringify(e3).slice(0, 200));
  await p2.screenshot({ path: 'tests/screenshots/tp2-leeg.png', fullPage: true });
  ok('uitleg via ? opnieuw te openen', await p2.evaluate(() => { document.getElementById('btnHelp').click(); return !document.getElementById('help').hidden; }));
  await c2.close();

  console.log('--- mobiel, licht thema ---');
  const c3 = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light' }); const p3 = await c3.newPage(); p3.on('pageerror', e => errs.push('mob: ' + String(e).split('\n')[0]));
  await p3.goto(APP, { waitUntil: 'load' }); await p3.waitForTimeout(400);
  ok('geen horizontale scroll', await p3.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), await p3.evaluate(() => document.documentElement.scrollWidth + '>' + document.documentElement.clientWidth));
  await p3.screenshot({ path: 'tests/screenshots/tp2-mobiel.png', fullPage: true }); await c3.close();
  ok('geen JS-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== TradingPlan v2 demo: ${pass}/${pass + fail} ===`); await b.close(); process.exit(fail ? 1 : 0);
})();
