// TradingPlan v2 — grondige doorloop (Denny 25-09-2026: "elke pagina en mogelijkheid, data én visueel").
// Speelt een echte week na op het echte bestand: weekplan → dagplan (overnemen, scenario's, charts,
// vinken/uitvinken) → poort (alle regels) → afsluiting → log (R, verwijderen, back-up rondje) →
// instellingen (lijsten bewerken, template, herstel). Daarna: koppeling met de journal op de
// demo-dataset, sneltoetsen, thema, mobiel, reduced motion, en screenshots van elke tab.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const F = f => 'file:///' + path.resolve(f).split(path.sep).join('/');
const TP = F('tradingplan/tradingplan.html'), APP = F('work/syncjournal.html');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const dk = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const now = new Date(), DK = dk(now), Y1 = dk(new Date(now - 864e5));
function isoWeek(d) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return t.getUTCFullYear() + '-W' + String(Math.ceil(((t - y0) / 864e5 + 1) / 7)).padStart(2, '0'); }
const WK = isoWeek(now);
const shot = async (p, name) => { await p.screenshot({ path: 'tests/screenshots/plan-' + name + '.png', fullPage: true }); };

(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1360, height: 900 }, colorScheme: 'dark' }); const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(String(e).split('\n')[0])); p.on('dialog', d => d.accept());
  await p.addInitScript(() => { if (!localStorage.getItem('tp2:meta')) localStorage.setItem('tp2:meta', JSON.stringify({ schema: 2, introSeen: true })); });
  await p.goto(TP, { waitUntil: 'load' }); await p.waitForTimeout(500);
  const tab = async k => { await p.keyboard.press(k); await p.waitForTimeout(150); };
  const set = (sel, v) => p.evaluate(([s, v]) => { const el = document.querySelector(s); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, [sel, v]);
  const txt = id => p.evaluate(id => (document.getElementById(id) || { innerText: '' }).innerText.replace(/\s+/g, ' '), id);
  const plans = () => p.evaluate(() => JSON.parse(localStorage.getItem('tp2:plans') || '{}'));

  console.log('═══ A. Weekplan ═══');
  await tab('3');
  ok('leeg: weekstart 0 / 10, status "Concept bewaard · nog niet in de log"', /0 \/ 10/.test(await txt('wk-prog')) && /nog niet in de log/.test(await p.evaluate(() => document.querySelector('[data-status="wk"]').textContent)));
  await p.evaluate(() => { document.querySelectorAll('#wk-list input').forEach((i, n) => { if (n < 4) i.click(); }); });
  ok('4 vinkjes → 4 / 10 en stap-nummer nog "1"', /4 \/ 10/.test(await txt('wk-prog')) && await p.evaluate(() => document.getElementById('wk-n').textContent === '1'));
  await p.evaluate(() => { document.querySelectorAll('#wk-list input')[0].click(); });
  ok('uitvinken → 3 / 10', /3 \/ 10/.test(await txt('wk-prog')));
  await p.evaluate(() => { document.querySelectorAll('#wk-list input').forEach(i => { if (!i.checked) i.click(); }); });
  ok('alles aan → 10 / 10, stap-nummer wordt ✓', /10 \/ 10/.test(await txt('wk-prog')) && await p.evaluate(() => document.getElementById('wk-n').textContent === '✓'));
  await p.click('[data-segf="wk:bias"] [data-v="Bearish"]');
  await set('[data-f="wk:open"]', '76.800'); await set('[data-f="wk:range"]', '74.2k – 79.5k'); await set('[data-f="wk:levels"]', '79.5k supply\n74.2k demand'); await set('[data-f="wk:liq"]', 'Weekend high 79.3k'); await set('[data-f="wk:maxtrades"]', '4'); await set('[data-f="wk:news"]', 'wo CPI 14:30'); await set('[data-f="wk:focus"]', 'Geen entry zonder SFP'); await set('[data-f="wk:notrade"]', 'Binnen 2 minuten na high-impact nieuws\nNa 2 verliezers op één dag');
  await p.setInputFiles('[data-drop="wk"] input[type=file]', { name: 'wk.png', mimeType: 'image/png', buffer: PNG }); await p.waitForTimeout(500);
  await set('[data-linkurl="wk"]', 'https://www.tradingview.com/x/abc123/'); await p.click('[data-linkadd="wk"]'); await p.waitForTimeout(100);
  await p.waitForTimeout(800);
  let w = (await plans())['week-' + WK];
  ok('concept bewaard: bias, velden, screenshot (idb), link', w && w.bias === 'Bearish' && w.maxtrades === '4' && w.images.length === 1 && !!w.images[0].idb && w.links.length === 1, JSON.stringify(w && { b: w.bias, m: w.maxtrades, i: w.images, l: w.links }));
  await p.evaluate(() => document.querySelector('[data-links="wk"] .x').click()); await p.waitForTimeout(700);
  ok('link weer verwijderd', (await plans())['week-' + WK].links.length === 0);
  await p.click('[data-save="wk"]'); await p.waitForTimeout(200);
  ok('opslaan → "Opgeslagen in log"', /Opgeslagen in log/.test(await p.evaluate(() => document.querySelector('[data-status="wk"]').textContent)));
  await set('[data-f="wk:focus"]', 'Geen entry zonder SFP (2)'); await p.waitForTimeout(800);
  ok('na wijziging: "daarna gewijzigd (concept bewaard)"', /daarna gewijzigd/.test(await p.evaluate(() => document.querySelector('[data-status="wk"]').textContent)));
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(150);
  ok('‹ naar vorige week: leeg formulier, knop "Naar deze week"', await p.evaluate(() => !document.getElementById('wk-today').hidden && document.querySelector('[data-f="wk:focus"]').value === ''));
  await p.click('#wk-today'); await p.waitForTimeout(150);
  ok('terug naar deze week: velden staan er weer', await p.evaluate(() => document.querySelector('[data-f="wk:focus"]').value === 'Geen entry zonder SFP (2)'));
  await shot(p, 'weekplan');

  console.log('═══ B. Dagplan ═══');
  await tab('4');
  ok('weekcontext zichtbaar met bias, focus, max trades, nieuws', /Bearish/.test(await txt('dg-ctx')) && /Geen entry zonder SFP/.test(await txt('dg-ctx')) && /4/.test(await txt('dg-ctx')));
  await p.click('#dg-take-wk'); await p.waitForTimeout(300);
  ok('levels + liquiditeit overgenomen uit het weekplan', await p.evaluate(() => /79\.5k supply/.test(document.querySelector('[data-f="dg:levels"]').value) && /Weekend high/.test(document.querySelector('[data-f="dg:levels"]').value)));
  await p.click('#dg-take-wk'); await p.waitForTimeout(200);
  ok('tweede keer: "al ingevuld", niets overschreven', await p.evaluate(() => /al ingevuld/.test(document.getElementById('toast').textContent)));
  // gisteren invullen (als bron voor "neem gisteren over")
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(150);
  await p.click('[data-segf="dg:bias"] [data-v="Bullish"]'); await set('[data-f="dg:tD"]', 'up'); await set('[data-f="dg:levels"]', 'POC 75.4k'); await p.waitForTimeout(800);
  await p.click('#dg-today'); await p.waitForTimeout(150);
  ok('vandaag: knop "Neem gisteren over" verschijnt', await p.evaluate(() => !!document.getElementById('dg-take-prev')));
  await p.click('#dg-take-prev'); await p.waitForTimeout(300);
  ok('bias + trend overgenomen, levels NIET overschreven (stond al vol)', await p.evaluate(() => document.querySelector('[data-segf="dg:bias"] [aria-pressed="true"]').dataset.v === 'Bullish' && document.querySelector('[data-f="dg:tD"]').value === 'up' && /79\.5k supply/.test(document.querySelector('[data-f="dg:levels"]').value)));
  await p.click('[data-segf="dg:bias"] [data-v="Bearish"]');
  // scenario's
  await p.click('#sc-add'); await p.waitForTimeout(100);
  ok('scenario 1 toegevoegd, cursor in "Als"', await p.evaluate(() => document.querySelectorAll('#sc-wrap .sc-card').length === 1 && document.activeElement.classList.contains('sc-als')));
  await set('#sc-wrap .sc-card:nth-child(1) .sc-title', 'Sweep 79.5k'); await set('#sc-wrap .sc-card:nth-child(1) .sc-als', 'prijs sweept 79.5k met 15m SFP'); await set('#sc-wrap .sc-card:nth-child(1) .sc-dan', 'short naar POC 76.1k'); await set('#sc-wrap .sc-card:nth-child(1) .sc-ong', '15m close boven 79.8k');
  await p.click('#sc-add'); await p.waitForTimeout(100);
  await set('#sc-wrap .sc-card:nth-child(2) .sc-als', 'reclaim 77.4k'); await set('#sc-wrap .sc-card:nth-child(2) .sc-dan', 'long naar VAH');
  await p.setInputFiles('#sc-wrap .sc-card:nth-child(2) input[type=file]', { name: 'c.png', mimeType: 'image/png', buffer: PNG }); await p.waitForTimeout(600);
  await p.evaluate(() => { const c = document.querySelectorAll('#sc-wrap .sc-card')[1]; c.querySelector('.sc-note').click(); }); await p.waitForTimeout(100);
  await set('#sc-wrap .sc-card:nth-child(2) .sc-text', 'Alleen als A-setup');
  await p.waitForTimeout(800);
  let d0 = (await plans())['dag-' + DK];
  ok('2 scenario\'s bewaard: titel, als/dan/ongeldig, chart bij 2, toelichting', d0.scenarios.length === 2 && d0.scenarios[0].title === 'Sweep 79.5k' && /SFP/.test(d0.scenarios[0].als) && d0.scenarios[1].images.length === 1 && d0.scenarios[1].text === 'Alleen als A-setup', JSON.stringify(d0.scenarios.map(s => [s.title, s.images.length, s.text])));
  await p.evaluate(() => { document.querySelectorAll('#sc-wrap .sc-card')[0].querySelector('.sc-del').click(); }); await p.waitForTimeout(300);
  d0 = (await plans())['dag-' + DK];
  ok('scenario 1 verwijderd → het andere schuift op naar 1 (met zijn chart)', d0.scenarios.length === 1 && d0.scenarios[0].als === 'reclaim 77.4k' && d0.scenarios[0].images.length === 1);
  // checklist
  await p.evaluate(() => { document.querySelectorAll('#dg-list input').forEach((i, n) => { if (n < 12) i.click(); }); });
  ok('dagstart 12 / 12 → stap ✓, poort-waarschuwing verdwijnt', /12 \/ 12/.test(await txt('dg-prog')) && await p.evaluate(() => document.getElementById('dg-n').textContent === '✓'));
  await p.evaluate(() => { document.querySelectorAll('#dg-list input')[3].click(); });
  ok('één uitvinken → 11 / 12', /11 \/ 12/.test(await txt('dg-prog')));
  await set('[data-f="dg:ftmo"]', 'daily loss nog 3,2% over'); await set('[data-f="dg:mind"]', '4');
  await p.click('[data-save="dg"]'); await p.waitForTimeout(200);
  ok('dagplan opgeslagen in log', /Opgeslagen in log/.test(await p.evaluate(() => document.querySelector('[data-status="dg"]').textContent)));
  await shot(p, 'dagplan');

  console.log('═══ C. Overzicht (cockpit) ═══');
  await tab('1');
  const ov = await txt('kpi');
  ok('cockpit: bias Bearish, week Bearish, focus, 0 / 4 trades, FTMO, mentaal 4 onrustig', /Bearish/.test(ov) && /Geen entry zonder SFP/.test(ov) && /0 vandaag · 0 \/ 4 week/.test(ov) && /3,2%/.test(ov) && /onrustig/.test(ov), ov);
  ok('route: playbook nog, weekplan klaar, dagplan klaar, poort bezig, afsluiting nog', await p.evaluate(() => [...document.querySelectorAll('#route .rs .s')].map(x => x.textContent).join()) === 'nog doen,klaar,klaar,bezig,nog doen', await p.evaluate(() => [...document.querySelectorAll('#route .rs .s')].map(x => x.textContent).join()));
  ok('no-trade-condities en het scenario staan in de cockpit', /Binnen 2 minuten/.test(await txt('ov-nt')) && /reclaim 77\.4k/.test(await txt('ov-sc')));
  await p.click('#route .rs[data-goto="playbook"]'); await p.waitForTimeout(150);
  ok('route-stap klikt door naar Playbook en zet hem op klaar', await p.evaluate(() => !document.querySelector('[data-panel="playbook"]').hidden && JSON.parse(localStorage.getItem('tp2:meta')).pbSeen === true));
  await shot(p, 'playbook');
  await tab('1'); await shot(p, 'overzicht');

  console.log('═══ D. Poort ═══');
  await tab('5');
  ok('dagstart 11/12 → waarschuwing "maak eerst je dagstart af"', /Dagstart 11\/12/.test(await txt('pt-dagstart')));
  ok('mentaal 4 → waarschuwing, nog geen trades → "Trade 1 van max 4"', /4 \/ 5/.test(await txt('pt-warns')) && /Trade 1 van max 4/.test(await txt('pt-warns')));
  const verdict = () => p.evaluate(() => document.querySelector('#pt-verdict .g').textContent);
  ok('start: no-trade-condities open → geen trade', await verdict() === 'Geen trade' && /No-trade/.test(await txt('pt-why')));
  await p.evaluate(() => { document.querySelectorAll('#pt-notrade input').forEach(i => { i.checked = true; i.dispatchEvent(new Event('change')); }); });
  ok('condities afgevinkt, niets gecheckt → harde stops', /Harde stop/.test(await txt('pt-why')));
  await p.evaluate(() => { document.querySelectorAll('#pt-list input').forEach(i => { i.checked = true; }); document.getElementById('pt-list').dispatchEvent(new Event('change')); });
  ok('alles gecheckt zonder setup → "Kies eerst welke setup"', /Kies eerst/.test(await txt('pt-why')));
  await p.click('#pt-stype [data-t="A"]');
  ok('A-setup, alles ✓ → Volle size · 2%', await verdict() === 'Volle size · 2%');
  await p.evaluate(() => { document.querySelector('#pt-list [data-pt="rr"]').checked = false; document.getElementById('pt-list').dispatchEvent(new Event('change')); });
  ok('A-setup, 2R mist → Halve size · 1%', await verdict() === 'Halve size · 1%');
  await p.evaluate(() => { document.querySelector('#pt-list [data-pt="ftmo"]').checked = false; document.getElementById('pt-list').dispatchEvent(new Event('change')); });
  ok('harde stop FTMO mist → Geen trade', await verdict() === 'Geen trade' && /Harde stop: FTMO/.test(await txt('pt-why')));
  await p.evaluate(() => { document.querySelector('#pt-list [data-pt="ftmo"]').checked = true; document.querySelector('#pt-list [data-pt="rr"]').checked = true; document.getElementById('pt-list').dispatchEvent(new Event('change')); });
  await p.click('#pt-stype [data-t="C"]');
  ok('C-setup, alles ✓ → Volle size · 0,5%', await verdict() === 'Volle size · 0,5%');
  await p.click('#dir [data-dir="Short"]'); await set('#pt-sym', 'btc'); await set('#pt-tf', '15m'); await set('#pt-notes', 'Eerste trade van de dag');
  await p.click('#pt-taken'); await p.click('#pt-save'); await p.waitForTimeout(200);
  const t1 = await p.evaluate(() => JSON.parse(localStorage.getItem('tp2:trades'))[0]);
  ok('opgeslagen: BTC Short 15m, C-setup, vol, 0,5%, genomen, notitie', t1.sym === 'BTC' && t1.dir === 'Short' && t1.tf === '15m' && t1.setup === 'C' && t1.exec === 'VOL' && t1.risk === 0.5 && t1.taken && t1.notes === 'Eerste trade van de dag', JSON.stringify(t1).slice(0, 200));
  ok('poort weer schoon; teller "Trade 2 van max 4"', await p.evaluate(() => document.querySelectorAll('#pt-list input:checked').length === 0 && document.getElementById('pt-notes').value === '') && /Trade 2 van max 4/.test(await txt('pt-warns')));
  // regelbreuk
  await p.evaluate(() => { document.querySelectorAll('#pt-notrade input').forEach((i, n) => { i.checked = n === 0; i.dispatchEvent(new Event('change')); }); });
  await p.click('#pt-taken');
  ok('toch nemen bij "geen trade" → waarschuwing regelbreuk zichtbaar', await p.evaluate(() => !document.getElementById('pt-warn').hidden));
  await p.click('#pt-save'); await p.waitForTimeout(200);
  const t2 = await p.evaluate(() => JSON.parse(localStorage.getItem('tp2:trades'))[0]);
  ok('regelbreuk gelogd met de open no-trade-conditie', t2.exec === 'NO' && t2.noTrade.length === 1 && t2.taken);
  ok('statistiek: regelbreuken 1, C-setups 1, te weinig data', /Regelbreuken/i.test(await txt('pt-stats')) && /van 30/.test(await txt('pt-weinig')));
  await p.click('#pt-clear');
  await shot(p, 'poort');

  console.log('═══ E. Log ═══');
  await tab('7');
  ok('log: 2 trades, 1 dagplan, 1 weekplan (4 rijen)', await p.evaluate(() => document.querySelectorAll('#log-body tr').length === 4));
  await p.evaluate(() => { const inp = document.querySelectorAll('#log-body input[type=number]')[1]; inp.value = '1.4'; inp.dispatchEvent(new Event('change')); });
  ok('R invullen bij de eerste trade → opgeslagen (+1,4)', await p.evaluate(() => JSON.parse(localStorage.getItem('tp2:trades')).some(t => t.r === 1.4)));
  await p.click('#log-filter [data-v="trade"]'); await p.waitForTimeout(100);
  ok('filter trades: 2 rijen', await p.evaluate(() => document.querySelectorAll('#log-body tr').length === 2));
  await p.evaluate(() => document.querySelector('#log-body .del').click()); await p.waitForTimeout(150);
  ok('regelbreuk verwijderd → 1 trade over', await p.evaluate(() => JSON.parse(localStorage.getItem('tp2:trades')).length === 1 && document.querySelectorAll('#log-body tr').length === 1));
  await p.click('#log-filter [data-v="all"]'); await p.waitForTimeout(100);
  await shot(p, 'log');

  console.log('═══ F. Afsluiting ═══');
  await tab('6');
  ok('afsluiting: scenario-knop "reclaim…" + geen; R uit de log +1,40; 1 trade', await p.evaluate(() => document.querySelectorAll('#af-sc button').length === 2 && document.getElementById('af-r').value === '1,4' && document.querySelectorAll('#af-trades li').length === 1));
  await p.click('#af-save'); await p.waitForTimeout(100);
  ok('opslaan zonder keuze → melding, niet opgeslagen', /Kies welk scenario/.test(await txt('toast')) && !(await plans())['dag-' + DK].close);
  await p.click('#af-sc [data-v="geen"]'); await p.click('#af-fol [data-v="ja"]'); await set('#af-les', 'Wachten op de 15m close.'); await p.click('#af-save'); await p.waitForTimeout(200);
  ok('afsluiting opgeslagen: geen scenario, ja, les, R 1,4', await p.evaluate(() => { const c = JSON.parse(localStorage.getItem('tp2:plans'))['dag-' + new Date().toISOString().slice(0, 10)] || Object.values(JSON.parse(localStorage.getItem('tp2:plans'))).find(x => x.close && x.close.saved); return c && c.close.scenario === 'geen' && c.close.gevolgd === 'ja' && c.close.les === 'Wachten op de 15m close.' && c.close.r === 1.4; }));
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(150);
  ok('› naar morgen: leeg, geen trades', await p.evaluate(() => document.getElementById('af-r').value === '' && document.querySelectorAll('#af-trades li').length === 0));
  await p.click('#af-today'); await p.waitForTimeout(150);
  await shot(p, 'afsluiting');
  await tab('7');
  ok('log toont de afsluiting met les', await p.evaluate(() => /Afsluiting/.test(document.getElementById('log-body').innerText) && /Wachten op de 15m close/.test(document.getElementById('log-body').innerText)));
  await tab('1');
  ok('route: afsluiting klaar, alles groen behalve niets', await p.evaluate(() => [...document.querySelectorAll('#route .rs .s')].map(x => x.textContent).join()) === 'klaar,klaar,klaar,klaar,klaar');

  console.log('═══ G. Back-up rondje ═══');
  const bk = await p.evaluate(() => { const orig = URL.createObjectURL; URL.createObjectURL = b => { const fr = new FileReader(); fr.onload = () => { window.__bk = fr.result; }; fr.readAsText(b); return 'blob:x'; }; document.getElementById('exp-json').click(); URL.createObjectURL = orig; return new Promise(r => setTimeout(() => r(JSON.parse(window.__bk)), 300)); });
  ok('back-up v2 met 1 trade, 3 plannen, 2 screenshots, cfg', bk.version === 2 && bk.trades.length === 1 && Object.keys(bk.plans).length === 3 && Object.keys(bk.images).length === 2 && bk.cfg.pt.length === 7, JSON.stringify({ t: bk.trades.length, p: Object.keys(bk.plans).length, i: Object.keys(bk.images).length }));
  await p.evaluate(() => { localStorage.removeItem('tp2:plans'); localStorage.removeItem('tp2:trades'); });
  await p.evaluate(b => window.__tpImport(JSON.stringify(b)), bk); await p.waitForTimeout(1300); await p.waitForLoadState('load'); await p.waitForTimeout(600);
  ok('na import: plannen, trade, screenshots (thumbnails) en afsluiting terug', await p.evaluate(() => { const pl = JSON.parse(localStorage.getItem('tp2:plans')); const d = Object.values(pl).find(x => x.close && x.close.saved); document.querySelector('[data-tab="dag"]').click(); return Object.keys(pl).length === 3 && JSON.parse(localStorage.getItem('tp2:trades')).length === 1 && !!d && document.querySelectorAll('#sc-wrap .thumb img').length === 1 && document.querySelector('#sc-wrap .thumb img').src.startsWith('data:image'); }));

  console.log('═══ H. Instellingen ═══');
  await tab('8');
  await p.evaluate(() => { const li = document.querySelector('[data-ed="pt"] li'); const inp = li.querySelector('input.t'); inp.value = 'Trend mee (D/4h/1h)'; inp.dispatchEvent(new Event('input')); });
  await p.evaluate(() => document.querySelectorAll('[data-ed="pt"] li')[0].querySelector('[data-a="down"]').click()); await p.waitForTimeout(100);
  ok('hernoemd en één omlaag: poort toont "Prijs in HP-zone" eerst, dan "Trend mee (D/4h/1h)"', await p.evaluate(() => { const l = [...document.querySelectorAll('#pt-list .l')].map(x => x.textContent); return l[0] === 'Prijs in HP-zone' && l[1] === 'Trend mee (D/4h/1h)'; }));
  await p.evaluate(() => document.querySelectorAll('[data-ed="pt"] li')[1].querySelector('.hd').click()); await p.waitForTimeout(100);
  ok('"harde stop" aangezet op Trend → poort markeert hem, legenda telt 3 harde stops', await p.evaluate(() => document.querySelectorAll('#pt-list .chk.hard').length === 3));
  await p.evaluate(() => document.querySelectorAll('[data-ed="pt"] li')[6].querySelector('[data-a="del"]').click()); await p.waitForTimeout(100);
  ok('check verwijderd → 6 checks, legenda "6 van 6"', await p.evaluate(() => document.querySelectorAll('#pt-list input').length === 6 && /6 van 6/.test(document.getElementById('pt-leg').innerText)));
  await p.click('[data-addg="dg"]'); await p.click('[data-add="dg"]'); await p.waitForTimeout(100);
  ok('dagstart: kopje + punt toegevoegd → 13 punten', await p.evaluate(() => document.querySelectorAll('#dg-list input').length === 13 && document.querySelectorAll('#dg-list .group-title').length === 6));
  const tpl = await p.evaluate(() => { const orig = URL.createObjectURL; URL.createObjectURL = b => { const fr = new FileReader(); fr.onload = () => { window.__tpl = fr.result; }; fr.readAsText(b); return 'blob:x'; }; document.getElementById('tpl-exp').click(); URL.createObjectURL = orig; return new Promise(r => setTimeout(() => r(JSON.parse(window.__tpl)), 300)); });
  ok('template-export: cfg + playbook, zónder plannen of trades', tpl.template === 1 && tpl.cfg.pt.length === 6 && tpl.playbook && !tpl.plans && !tpl.trades, JSON.stringify(Object.keys(tpl)));
  await p.click('[data-reset="pt"]'); await p.waitForTimeout(100);
  ok('herstel standaard poort → 7 checks, 2 harde stops', await p.evaluate(() => document.querySelectorAll('#pt-list input').length === 7 && document.querySelectorAll('#pt-list .chk.hard').length === 2));
  await set('#cfg-match', '30');
  ok('koppelvenster 30 opgeslagen in cfg', await p.evaluate(() => JSON.parse(localStorage.getItem('tp2:cfg')).matchMin === 30));
  await p.evaluate(() => { const i = document.querySelector('[data-max="A"]'); i.value = '3'; i.dispatchEvent(new Event('input')); });
  ok('max A = 3% → poort toont "max 3%"', await p.evaluate(() => /max 3%/.test(document.getElementById('pt-stype').innerText)));
  await p.click('#tpl-reset'); await p.waitForTimeout(150);
  ok('herstel alles: max A weer 2%, 12 dagstart-punten, plannen/trades blijven', await p.evaluate(() => JSON.parse(localStorage.getItem('tp2:cfg')).max.A === 2 && document.querySelectorAll('#dg-list input').length === 12 && JSON.parse(localStorage.getItem('tp2:trades')).length === 1));
  await shot(p, 'instellingen');

  console.log('═══ I. Uitleg, thema, sneltoetsen ═══');
  await p.click('#btnHelp'); await p.waitForTimeout(100);
  ok('? opent de uitleg; Esc sluit', await p.evaluate(() => !document.getElementById('help').hidden) && (await p.keyboard.press('Escape'), await p.waitForTimeout(80), await p.evaluate(() => document.getElementById('help').hidden)));
  await p.click('#btnTheme'); await p.waitForTimeout(100);
  const th = await p.evaluate(() => ({ attr: document.documentElement.getAttribute('data-theme'), ls: localStorage.getItem('tp2:theme') }));
  ok('thema-toggle schakelt en onthoudt (light)', th.attr === 'light' && th.ls === 'light', JSON.stringify(th));
  await tab('1'); await shot(p, 'overzicht-licht'); await tab('5'); await shot(p, 'poort-licht');
  await p.click('#btnTheme');
  await ctx.close();

  console.log('═══ J. Koppeling met de journal op de demo-dataset ═══');
  const demo = JSON.parse(fs.readFileSync(path.resolve('site/demo-dataset.json'), 'utf8'));
  const c2 = await b.newContext({ viewport: { width: 1360, height: 900 } }); const p2 = await c2.newPage(); const e2 = []; p2.on('pageerror', e => e2.push(String(e).split('\n')[0])); p2.on('dialog', d => d.accept());
  await p2.route('**/*', r => /^https?:/.test(r.request().url()) ? r.abort() : r.continue());
  // poort-records die bij drie demo-trades van 2026-08-31 horen (BTC short 18:59, ETH long 16:02) — ARB long krijgt er bewust geen
  const REC = [
    { id: 9001, ts: new Date(1788195540000 - 6 * 60000).toISOString(), day: '2026-08-31', sym: 'BTC', dir: 'Short', tf: '15m', setup: 'A', checks: { trend: 1, zone: 1, trigger: 1, sl: 1, rr: 1, ftmo: 1, mind: 1 }, missing: [], exec: 'VOL', risk: 2, taken: true, r: null, noTrade: [], notes: 'demo-koppeling' },
    { id: 9002, ts: new Date(1788184920000 - 10 * 60000).toISOString(), day: '2026-08-31', sym: 'ETH', dir: 'Long', tf: '15m', setup: 'B', checks: { trend: 1, zone: 1, trigger: 1, sl: 1, rr: 0, ftmo: 1, mind: 1 }, missing: ['rr'], exec: 'HALF', risk: 0.5, taken: true, r: null, noTrade: [], notes: '' }
  ];
  await p2.addInitScript(rec => { localStorage.setItem('sj_welcomed', 'true'); if (localStorage.getItem('tp2:trades')) return;   /* init-scripts draaien ook na een reload: alleen de eerste keer seeden */ localStorage.setItem('tp2:trades', JSON.stringify(rec)); localStorage.setItem('tp2:plans', JSON.stringify({ 'dag-2026-08-31': { id: 'dag-2026-08-31', type: 'dag', key: '2026-08-31', checks: {}, images: [], links: [], scenarios: [{ title: 'Sweep', als: 'x', dan: 'y', ongeldig: '', text: '', images: [], links: [] }], close: { scenario: 0, gevolgd: 'deels', les: 'demo', r: null, saved: true, savedAt: '2026-08-31T18:00:00.000Z' } } })); localStorage.setItem('tp2:cfg', JSON.stringify({ matchMin: 45 })); localStorage.setItem('tp2:meta', JSON.stringify({ schema: 2, introSeen: true })); }, REC);
  await p2.goto(APP, { waitUntil: 'domcontentloaded' }); await p2.waitForTimeout(1200);
  await p2.evaluate(async d => { await applyBackup(d); }, demo); await p2.waitForTimeout(1500);
  const jm = await p2.evaluate(() => { const n = planMatch(); const btc = T.find(t => t.pair === 'BTC/USDT' && t.date === '2026-08-31' && t.time === '18:59'); const eth = T.find(t => t.pair === 'ETH/USDT' && t.date === '2026-08-31' && t.time === '16:02'); const arb = T.find(t => t.pair === 'ARB/USDT' && t.date === '2026-08-31'); return { n, T: T.length, btc: btc && btc.planRef, eth: eth && eth.planRef, arb: arb && arb.planRef, badge: planBadge(arb).length > 0, line: planLine(btc).replace(/<[^>]+>/g, ' ') }; });
  ok('demo-dataset geladen (3000 trades); 2 matches: BTC→9001, ETH→9002, ARB zonder', jm.T === 3000 && jm.n === 2 && jm.btc === '9001' && jm.eth === '9002' && !jm.arb && jm.badge, JSON.stringify(jm));
  ok('hover-regel van de BTC-trade: A-setup · 7/7 · volle size · 2%', /A-setup/.test(jm.line) && /7\/7/.test(jm.line) && /volle size/.test(jm.line) && /2%/.test(jm.line), jm.line);
  await p2.evaluate(() => { STATE.tend = 'plan'; clearGFilter(); go('tendencies'); });
  const tt = await p2.evaluate(() => document.getElementById('main').innerText.replace(/\s+/g, ' '));
  ok('Tendencies → Plan: 2 gekoppeld, drempel "2 van 30", uitvoering/setup zichtbaar', /2 gekoppeld/.test(tt) && /2 van 30/.test(tt) && /A-setup/.test(tt) && /Halve size/.test(tt), tt.slice(0, 300));
  await p2.screenshot({ path: 'tests/screenshots/plan-tendencies-demo.png', fullPage: true });
  // TradingPlan in dezelfde origin: leest de R van de gekoppelde demo-trades
  await p2.goto(TP, { waitUntil: 'load' }); await p2.waitForTimeout(900);
  const jr = await p2.evaluate(() => ({ jr: window.__tpJR(), log: document.getElementById('log-body').innerText.replace(/\s+/g, ' ') }));
  ok('TradingPlan: R uit de journal voor 9001 (+1,40) en 9002 (−0,92), badge "journal" in de log', jr.jr['9001'] && Math.abs(jr.jr['9001'].r - 1.4) < 0.001 && jr.jr['9002'] && Math.abs(jr.jr['9002'].r + 0.92) < 0.001 && /journal/.test(jr.log), JSON.stringify(jr.jr));
  ok('poort-statistiek telt de journal-R mee: 2 van 30', await p2.evaluate(() => { document.querySelector('[data-tab="poort"]').click(); return /2 van 30/.test(document.getElementById('pt-weinig').innerText); }));
  // voorbeeld-poortrecords uit de journal (Instellingen) → 40 records + afsluitingen → journal koppelt ze
  await p2.evaluate(() => document.querySelector('[data-tab="instellingen"]').click()); await p2.click('#demo-poort'); await p2.waitForTimeout(1600); await p2.waitForLoadState('load'); await p2.waitForTimeout(600);
  const dr = await p2.evaluate(() => { const tr = JSON.parse(localStorage.getItem('tp2:trades')); const pl = JSON.parse(localStorage.getItem('tp2:plans')); return { n: tr.length, vb: tr.filter(t => t.notes === 'voorbeeld').length, setups: [...new Set(tr.map(t => t.setup))].sort().join(), sluit: Object.values(pl).filter(x => x.close && x.close.saved).length }; });
  ok('knop "Voorbeeld-poortrecords": 40 records erbij (42 totaal), A/B/C, dagafsluitingen aangemaakt', dr.n === 42 && dr.vb === 40 && dr.setups === 'A,B,C' && dr.sluit >= 5, JSON.stringify(dr));
  await p2.goto(APP, { waitUntil: 'domcontentloaded' }); await p2.waitForTimeout(1500);
  const lk = await p2.evaluate(() => { const n = T.filter(t => t.planRef && t.planRef !== 'none').length; STATE.tend = 'plan'; clearGFilter(); go('tendencies'); return { n, txt: document.getElementById('main').innerText.replace(/\s+/g, ' ').slice(0, 300) }; });
  ok('journal koppelt bij het opstarten: ≥40 gekoppeld, Tendencies → Plan zonder drempelmelding', lk.n >= 40 && /gekoppeld/.test(lk.txt) && !/Nog te weinig data/.test(lk.txt), JSON.stringify(lk));
  ok('journal + tradingplan: geen JS-errors', e2.length === 0, e2.slice(0, 3).join(' | '));
  await c2.close();

  console.log('═══ K. Mobiel + reduced motion ═══');
  const c3 = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', reducedMotion: 'reduce' }); const p3 = await c3.newPage(); const e3 = []; p3.on('pageerror', e => e3.push(String(e).split('\n')[0]));
  await p3.addInitScript(() => { localStorage.setItem('tp2:meta', JSON.stringify({ schema: 2, introSeen: true })); });
  await p3.goto(TP, { waitUntil: 'load' }); await p3.waitForTimeout(400);
  let overflow = false; for (const t of ['overzicht', 'playbook', 'week', 'dag', 'poort', 'afsluiting', 'log', 'instellingen']) { await p3.evaluate(t => document.querySelector('[data-tab="' + t + '"]').click(), t); await p3.waitForTimeout(80); if (await p3.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)) overflow = true; if (t === 'dag' || t === 'poort') await p3.screenshot({ path: 'tests/screenshots/plan-mobiel-' + t + '.png', fullPage: true }); }
  ok('mobiel: geen horizontale scroll op alle 8 tabs, geen fouten', !overflow && e3.length === 0, e3.join(' | '));
  await c3.close();
  ok('geen JS-errors in de hoofd-doorloop', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== Plan-doorloop: ${pass}/${pass + fail} ===`); await b.close(); process.exit(fail ? 1 : 0);
})();
