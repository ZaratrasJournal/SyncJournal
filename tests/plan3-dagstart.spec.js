// TradingPlan v3, ronde 3 punt 3: "Pre-flight" heet "Dagstart", en de lijst is vrij (hooguit 8 punten).
//  - overal "Dagstart", nergens meer "pre-flight" in beeld (trechter, kop, tandwiel)
//  - toevoegen, weghalen en hernoemen in de trechter-stap én in het tandwiel; een nieuwe gebruiker start met drie punten
//  - vinkjes per dag op tekst (Day.dagstart); weghalen laat andere vinkjes staan, hernoemen neemt het vinkje mee
//  - migratie: oude Day.pre [bool,bool,bool] → teksten via de oude cfg.pre op dezelfde index; daarna geen pre meer
const { chromium } = require('playwright'); const path = require('path');
const H = require('./helpers/plan3'); const SHOTS = H.SHOTS;
const NAAM = 'Plan v3 dagstart';

(async () => {
  const srv = await H.server(), { TP } = srv, T = H.teller(NAAM), ok = T.ok;
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await H.alleenLokaal(ctx);
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
  await p.goto(TP, { waitUntil: 'load' }); await p.waitForTimeout(400);
  const dag = () => p.evaluate(() => __tp3.dayOf(__tp3.vandaag()));
  const pre = () => p.evaluate(() => __tp3.cfg().pre);
  const kop = () => p.evaluate(() => document.querySelector('.pagehead p').textContent);
  const geenPreflight = () => p.evaluate(() => !/pre-?flight/i.test(document.body.innerText));

  console.log('--- nieuwe gebruiker ---');
  ok('lege staat zegt "dagstart", niet "pre-flight"', await geenPreflight() && /dagstart/.test(await p.evaluate(() => document.getElementById('app').innerText)));
  await p.click('[data-a="maakDag"]'); await p.waitForTimeout(150);
  ok('drie standaardpunten', (await pre()).join('|') === 'Nieuws gecheckt|Goed geslapen|Limieten in orde', (await pre()).join('|'));
  ok('de trechter-stap heet "Dagstart"', await p.evaluate(() => [...document.querySelectorAll('.funnel .fstep h3')].map(h => h.textContent.trim()).includes('Dagstart')));
  ok('de kop toont "Dagstart 0/3"', /Dagstart 0\/3/.test(await kop()), await kop());
  ok('nergens "pre-flight" in beeld', await geenPreflight());
  await p.click('[data-a="ds"][data-v="Goed geslapen"]'); await p.waitForTimeout(80);
  ok('afvinken bewaart de tekst: Day.dagstart ["Goed geslapen"], geen Day.pre', JSON.stringify((await dag()).dagstart) === '["Goed geslapen"]' && !('pre' in await dag()), JSON.stringify(await dag()));
  ok('kop "Dagstart 1/3"', /Dagstart 1\/3/.test(await kop()), await kop());

  console.log('--- bewerken in de trechter-stap ---');
  await p.click('[data-a="dsBewerk"]'); await p.waitForTimeout(80);
  await p.fill('#ds-nieuw', 'Kalender gecheckt'); await p.click('[data-a="dsToe"]'); await p.waitForTimeout(80);
  ok('+ onderaan: "Kalender gecheckt" erbij', (await pre()).join('|') === 'Nieuws gecheckt|Goed geslapen|Limieten in orde|Kalender gecheckt');
  ok('kop "Dagstart 1/4"', /Dagstart 1\/4/.test(await kop()), await kop());
  await p.fill('[data-ds="1"]', 'Acht uur slaap'); await p.press('[data-ds="1"]', 'Enter'); await p.waitForTimeout(100);
  ok('hernoemen: "Goed geslapen" → "Acht uur slaap", het vinkje gaat mee', (await pre())[1] === 'Acht uur slaap' && JSON.stringify((await dag()).dagstart) === '["Acht uur slaap"]', JSON.stringify([await pre(), (await dag()).dagstart]));
  await p.fill('[data-ds="0"]', 'Acht uur slaap'); await p.press('[data-ds="0"]', 'Enter'); await p.waitForTimeout(100);
  ok('dubbele naam geweigerd met een melding', (await pre())[0] === 'Nieuws gecheckt' && /staat er al/.test(await p.evaluate(() => (document.querySelector('.toast') || {}).textContent || '')));
  await p.click('[data-a="dsWeg"][data-v="0"]'); await p.waitForTimeout(80);
  ok('× haalt "Nieuws gecheckt" weg; het andere vinkje blijft', (await pre()).join('|') === 'Acht uur slaap|Limieten in orde|Kalender gecheckt' && JSON.stringify((await dag()).dagstart) === '["Acht uur slaap"]');
  for (let i = 0; i < 5; i++) { await p.fill('#ds-nieuw', 'Punt ' + i); await p.press('#ds-nieuw', 'Enter'); await p.waitForTimeout(60); }
  ok('hooguit 8 punten: de 9e wordt geweigerd', (await pre()).length === 8 && /Hooguit 8/.test(await p.evaluate(() => (document.querySelector('.toast') || {}).textContent || '') + await p.evaluate(() => document.querySelector('.funnel').innerText)), (await pre()).length);
  ok('bij 8 punten is er geen veld meer om toe te voegen', await p.evaluate(() => !document.querySelector('#ds-nieuw')));
  await p.click('[data-a="dsBewerk"]'); await p.waitForTimeout(80);
  ok('"Klaar": terug naar de vinkjes (8 punten)', await p.evaluate(() => document.querySelectorAll('.funnel [data-a="ds"]').length === 8));
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(250);
  ok('na herladen: lijst en vinkje bewaard', (await pre()).length === 8 && JSON.stringify((await dag()).dagstart) === '["Acht uur slaap"]');

  console.log('--- bewerken in het tandwiel ---');
  await p.click('[data-a="settings"]'); await p.waitForTimeout(100);
  ok('tandwiel: kop "Dagstart (hooguit 8)", geen "pre-flight"', await p.evaluate(() => /Dagstart \(hooguit 8\)/.test(document.getElementById('modal').textContent) && !/pre-?flight/i.test(document.getElementById('modal').innerText)));
  for (let i = 7; i >= 3; i--) await p.click(`#modal [data-a="setDsWeg"][data-v="${i}"]`);
  await p.fill('#modal [data-f="draft.pre.0.t"]', 'Slaap ok');
  await p.fill('#set-ds-nieuw', 'Geen revenge'); await p.click('#modal [data-a="setDsToe"]'); await p.waitForTimeout(60);
  await p.click('[data-a="saveSettings"]'); await p.waitForTimeout(120);
  ok('tandwiel bewaart: weghalen, hernoemen, toevoegen', (await pre()).join('|') === 'Slaap ok|Limieten in orde|Kalender gecheckt|Geen revenge', (await pre()).join('|'));
  ok('hernoemen in het tandwiel neemt het vinkje mee', JSON.stringify((await dag()).dagstart) === '["Slaap ok"]', JSON.stringify((await dag()).dagstart));
  ok('kop "Dagstart 1/4"', /Dagstart 1\/4/.test(await kop()), await kop());

  console.log('--- migratie van pre-flight ---');
  await p.evaluate(() => { const id = __tp3.vandaag(), oud = '2026-01-05';
    localStorage.setItem('tp3:cfg', JSON.stringify({ stijl: 'daytrade', risk: { A: 1, B: 0.5, C: 0 }, pre: ['Nieuws', '', 'Limieten'] }));
    localStorage.setItem('tp3:plans', JSON.stringify({ v: 1, weeks: {}, days: {
      [id]: { id, layers: [], levels: '', mental: null, pre: [true, true, true], media: { imgs: [], links: [] }, les: '', scenarios: [] },
      [oud]: { id: oud, layers: [], levels: '', mental: null, pre: [false, false, true], media: { imgs: [], links: [] }, les: '', scenarios: [] } } })); });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(250);
  const mig = await p.evaluate(() => ({ v: __tp3.dayOf(__tp3.vandaag()), o: __tp3.dayOf('2026-01-05'), pre: __tp3.cfg().pre }));
  ok('oude pre [true,true,true] met cfg.pre ["Nieuws","","Limieten"] → dagstart ["Nieuws","Limieten"] (de lege regel telt niet)', JSON.stringify(mig.v.dagstart) === '["Nieuws","Limieten"]' && !('pre' in mig.v), JSON.stringify(mig.v));
  ok('oude dag [false,false,true] → ["Limieten"]', JSON.stringify(mig.o.dagstart) === '["Limieten"]');
  ok('cfg.pre zonder lege regels: ["Nieuws","Limieten"]', mig.pre.join('|') === 'Nieuws|Limieten');
  await p.click('[data-a="settings"]'); await p.fill('#set-ds-nieuw', 'Kalender'); await p.click('#modal [data-a="setDsToe"]'); await p.click('[data-a="saveSettings"]'); await p.waitForTimeout(120);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(250);
  ok('na een nieuwe lijst in het tandwiel blijft de migratie kloppen (opgeslagen vóór de lijst veranderde)', await p.evaluate(() => { const P = JSON.parse(localStorage.getItem('tp3:plans')); return Object.values(P.days).every(d => !('pre' in d)) && JSON.stringify(P.days['2026-01-05'].dagstart) === '["Limieten"]'; }));
  await p.evaluate(() => { localStorage.removeItem('tp3:cfg'); const id = __tp3.vandaag(); localStorage.setItem('tp3:plans', JSON.stringify({ v: 1, weeks: {}, days: { [id]: { id, layers: [], pre: [false, true, false], scenarios: [] } } })); });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(250);
  ok('zonder opgeslagen cfg: de standaardpunten op dezelfde index ("Goed geslapen")', JSON.stringify((await dag()).dagstart) === '["Goed geslapen"]', JSON.stringify((await dag()).dagstart));
  await p.evaluate(() => { const id = __tp3.vandaag(); localStorage.setItem('tp3:cfg', JSON.stringify({ pre: 'kapot' })); localStorage.setItem('tp3:plans', JSON.stringify({ v: 1, weeks: {}, days: { [id]: { id, layers: [], dagstart: ['x', 5, null], pre: 'kapot', scenarios: [] } } })); });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(250);
  ok('kapotte opslag: alleen tekst-vinkjes blijven, standaardlijst, geen fout', JSON.stringify((await dag()).dagstart) === '["x"]' && (await pre()).length === 3);
  await p.evaluate(() => localStorage.setItem('tp3:cfg', JSON.stringify({ pre: [] })));
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(250);
  ok('alle punten weg: de stap zegt wat te doen', await p.evaluate(() => /Nog geen dagstart-punten/.test(document.querySelector('.funnel').innerText)) && !/Dagstart \d/.test(await kop()));

  console.log('--- screenshots ---');
  await p.evaluate(() => { localStorage.setItem('tp3:cfg', JSON.stringify({ pre: ['Nieuws gecheckt', 'Goed geslapen', 'Limieten in orde', 'Kalender gecheckt'] })); const id = __tp3.vandaag(); localStorage.setItem('tp3:plans', JSON.stringify({ v: 1, weeks: {}, days: { [id]: { id, layers: [], dagstart: ['Goed geslapen'], scenarios: [] } } })); });
  const scroll = await H.vierShots(p, 'dagstart', async q => { await q.setViewportSize({ width: q.viewportSize().width, height: 900 }); if (q.viewportSize().width < 800) await q.click('[data-a="ctx"]').catch(() => {}); await q.click('[data-a="dsBewerk"]'); await q.waitForTimeout(80); });
  ok('390 breed: geen horizontale scroll (licht en donker)', !scroll.licht && !scroll.donker, JSON.stringify(scroll));

  ok('geen JS-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close(); srv.close(); process.exit(T.eind());
})();
