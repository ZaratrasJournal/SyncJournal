// Alle scenario's rond R-multiple, van randgeval tot gemiddelde.
//
// Aanleiding: Denny meldde op v1.0 (28-09-2026) dat R op +0,0R bleef staan bij winst én verlies.
// Oorzaak: hij had nergens een stop-loss ingevuld, en zonder stop is R niet te bepalen. De app
// gebruikte 0 als sentinel voor "onbekend", waardoor "we weten het niet" en "precies break-even"
// dezelfde tekst kregen — en waardoor élk R-gemiddelde naar nul werd getrokken door trades die
// niets zeggen.
//
// Deze spec loopt de volledige waaier af: per trade (welke invoer geeft wél een R, welke niet),
// de weergave (streepje vs. getal), en de gemiddelden op elk scherm dat er een toont.
const { chromium } = require('playwright');
const path = require('path');

let pass = 0, fail = 0;
const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const B = { pair: 'BTC/USDC', exchange: 'okx', status: 'closed', size: '0.01', dir: 'long', setup: 'Breakout' };
let dag = 0;
const t = (o) => ({ ...B, id: o.id, date: '2026-09-' + String(10 + (dag++)).padStart(2, '0'), time: '10:00', ...o });

// ─── De waaier aan invoer ───
const RIJEN = [
  // 1-2 · geen stop: R is niet te bepalen, ongeacht of je won of verloor
  t({ id: 'geen-sl-winst',  entry: 60000, exit: 60600, pnl: 6.43 }),
  t({ id: 'geen-sl-verlies', entry: 60000, exit: 59600, pnl: -3.95 }),
  // 3-4 · opgeslagen R uit de sync
  t({ id: 'r-positief', entry: 60000, exit: 61800, stop: 59000, pnl: 18, r: 1.8 }),
  t({ id: 'r-negatief', entry: 60000, exit: 59000, stop: 59000, pnl: -10, r: -1 }),
  // 5 · échte break-even mét stop — moet 0 blijven tonen, niet een streepje
  t({ id: 'echt-nul', entry: 60000, exit: 60000, stop: 59000, pnl: 0 }),
  // 6 · stop == entry: risico is nul, delen door nul → niet te bepalen
  t({ id: 'stop-is-entry', entry: 60000, exit: 61000, stop: 60000, pnl: 10 }),
  // 7 · stop maar geen exit en geen TP's → niets om R uit af te leiden
  t({ id: 'stop-zonder-exit', entry: 60000, stop: 59000, pnl: 0, status: 'open' }),
  // 8 · kapotte data: |R| > 100 is per definitie fout en mag nergens meetellen
  t({ id: 'absurde-r', entry: 60000, exit: 60100, pnl: 1, r: 500 }),
  // 9 · short met stop, R af te leiden uit de prijzen
  t({ id: 'short-theoretisch', dir: 'short', entry: 60000, exit: 59000, stop: 61000, pnl: 10 }),
];

(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await p.setViewportSize({ width: 1500, height: 950 });
  await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(600);
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(800);
  await p.evaluate(() => { try { hideWelcome(); } catch (e) {} });
  ok('boot zonder JS-fouten', errs.length === 0, errs[0]);

  await p.evaluate((rijen) => {
    T = rijen.map(x => ({ ...EMPTY_TRADE, ...x }));
    persist(); clearGFilter(); setFilter('kind', 'alle'); go('trades');
  }, RIJEN);
  await p.waitForTimeout(500);

  console.log('─── Per trade: wanneer is R te bepalen? ───');
  const per = await p.evaluate(() => {
    const uit = {}; T.forEach(x => { uit[x.id] = tradeROrNull(x); }); return uit;
  });
  ok('geen stop + winst → onbekend', per['geen-sl-winst'] === null, String(per['geen-sl-winst']));
  ok('geen stop + verlies → onbekend', per['geen-sl-verlies'] === null, String(per['geen-sl-verlies']));
  ok('opgeslagen R blijft +1.8', per['r-positief'] === 1.8, String(per['r-positief']));
  ok('opgeslagen R blijft −1 (verlies op de stop)', per['r-negatief'] === -1, String(per['r-negatief']));
  ok('échte break-even mét stop → 0, niet onbekend', per['echt-nul'] === 0, String(per['echt-nul']));
  ok('stop gelijk aan entry → onbekend (geen risico)', per['stop-is-entry'] === null, String(per['stop-is-entry']));
  ok('stop zonder exit of TP → onbekend', per['stop-zonder-exit'] === null, String(per['stop-zonder-exit']));
  ok('absurde R (500) telt niet als geldig', per['absurde-r'] === null, String(per['absurde-r']));
  ok('short leidt R correct af uit de prijzen (+1)', per['short-theoretisch'] === 1, String(per['short-theoretisch']));

  console.log('─── De R-kolom toont het verschil ───');
  const waarden = await p.evaluate(() =>
    [...document.querySelectorAll('td[data-l="R"]')].map(td => td.textContent.trim()));
  const cellen = waarden;
  ok('elke rij heeft een R-cel', waarden.length === RIJEN.length, JSON.stringify(cellen));
  ok('vijf rijen tonen een streepje', waarden.filter(c => c === '—').length === 5, JSON.stringify(cellen));
  ok('+1,8R staat er', waarden.includes('+1,8R'), JSON.stringify(cellen));
  ok('−1,0R staat er (verlies toont wél een R)', waarden.includes('−1,0R') || waarden.includes('-1,0R'), JSON.stringify(cellen));
  ok('+0,0R staat er precies één keer', waarden.filter(c => c === '+0,0R').length === 1, JSON.stringify(cellen));
  ok('+1,0R voor de short', waarden.includes('+1,0R'), JSON.stringify(cellen));

  console.log('─── Het gemiddelde telt alleen wat telbaar is ───');
  // Vier trades hebben een R: +1.8, −1, 0, +1 → som 1.8, gemiddelde 0.45.
  // Zou je de vijf onbekende als 0 meetellen, dan kom je op 0.20 uit.
  const gem = await p.evaluate(() => {
    const dicht = T.filter(x => x.status !== 'open');
    const g = gemR(dicht), a = aggOf(dicht);
    return { n: g.n, miss: g.miss, avg: +g.avg.toFixed(4), aggAvg: +a.avgR.toFixed(4), aggRn: a.rN, totaal: dicht.length };
  });
  ok('vier trades hebben een bruikbare R', gem.n === 4, 'n=' + gem.n);
  ok('vier trades hebben er geen (van de acht gesloten)', gem.miss === 4, 'miss=' + gem.miss);
  ok('gemiddelde = 1,8 / 4 = 0,45', Math.abs(gem.avg - 0.45) < 1e-6, String(gem.avg));
  ok('niet 0,225 — de onbekende tellen niet als nul mee', Math.abs(gem.avg - 0.225) > 1e-6, String(gem.avg));
  ok('aggOf geeft hetzelfde gemiddelde', Math.abs(gem.aggAvg - 0.45) < 1e-6, String(gem.aggAvg));
  ok('aggOf meldt hoeveel trades meetelden', gem.aggRn === 4, String(gem.aggRn));

  console.log('─── Niets te middelen → streepje, geen +0,00R ───');
  const leeg = await p.evaluate(() => {
    const zonder = T.filter(x => x.id === 'geen-sl-winst' || x.id === 'geen-sl-verlies');
    const a = aggOf(zonder);
    return { rN: a.rN, avg: a.avgR, n: a.n };
  });
  ok('geen enkele trade met R → rN is 0', leeg.rN === 0, String(leeg.rN));
  ok('en er zijn wél trades (dus niet "leeg")', leeg.n === 2, String(leeg.n));

  // Dashboard met uitsluitend trades zonder stop: de KPI hoort — te tonen.
  await p.evaluate(() => {
    T = T.filter(x => x.id === 'geen-sl-winst' || x.id === 'geen-sl-verlies');
    persist(); go('dashboard');
  });
  await p.waitForTimeout(600);
  const kpiTekst = await p.evaluate(() => {
    const kaart = [...document.querySelectorAll('.kpi')].find(k => /Gem\. R/.test(k.textContent));
    return kaart ? kaart.textContent.replace(/\s+/g, ' ').trim() : null;
  });
  ok('de Gem. R-kaart staat op het dashboard', kpiTekst !== null, String(kpiTekst));
  ok('en toont een streepje, geen +0,00R', kpiTekst && !/\+0[.,]00R?/.test(kpiTekst), kpiTekst);

  ok('geen JS-fouten na alle schermen', errs.length === 0, errs[0]);

  console.log(`\n=== R-scenario's: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
