// Review page order (Zaratras 26-10-2026): newest trade on top — by close moment, an open trade
// (or one without a close moment) by its open moment; equal moments in a fixed order.
// 'Per trade', 'Beeld' and the presentation all page through that same order.
const { chromium } = require('playwright');
const { openJournal, seedTrades, go } = require('./helpers/dov-page');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (extra ? '  → ' + extra : '')); } };
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAAAASUVORK5CYII=';
const ms = s => String(Date.parse(s));
const mk = (pair, over) => Object.assign({ date: '2026-10-01', time: '10:00', pair, dir: 'long', setup: 'BOS', session: 'London', exchange: 'blofin', status: 'closed', kind: 'live',
  pnl: 50, r: 1, entry: 100, stop: 95, exit: 105, screenshots: [PNG], tvLinks: [], layers: [], tags: [], emotions: [], mistakes: [] }, over);
// Seeded oldest-first on purpose, so a list that just follows the stored order is visibly wrong.
const TRADES = [
  mk('AAA/USDT', { date: '2026-10-05', time: '08:00', openTime: ms('2026-10-05T08:00:00Z'), closeTime: ms('2026-10-18T15:00:00Z') }), // opened early, closed late
  mk('CCC/USDT', { date: '2026-10-15', time: '12:00' }),                                                                               // no timestamps: date + time
  mk('BBB/USDT', { date: '2026-10-20', time: '09:00', status: 'open', openTime: ms('2026-10-20T09:00:00Z'), closeTime: '', pnl: 0, exit: '' }), // open: open moment
  mk('DDD/USDT', { date: '2026-10-02', time: '10:00', closeTime: ms('2026-10-02T10:00:00Z') }),
  mk('EEE/USDT', { date: '2026-10-02', time: '10:00', closeTime: ms('2026-10-02T10:00:00Z') }),                                        // same moment as DDD
];
const WANT = ['BBB/USDT', 'AAA/USDT', 'CCC/USDT', 'EEE/USDT', 'DDD/USDT'];   // ties: the later id first
(async () => {
  const b = await chromium.launch();
  const { p, errs } = await openJournal(b, { klok: new Date('2026-10-26T12:00:00Z') });
  await seedTrades(p, TRADES);
  await go(p, 'review');
  await p.evaluate(() => setRevMode('trade'));

  console.log('─── Per trade ───');
  const lijst = await p.evaluate(() => [...document.querySelectorAll('.revitem')].map(e => e.textContent.match(/[A-Z]{3}\/USDT/)[0]));
  ok('lijst nieuw → oud (sluiten, open trade op openen, gelijk op id)', lijst.join() === WANT.join(), lijst.join());
  const pairSel = () => p.evaluate(() => T.find(x => x.id === STATE.revSel).pair);
  await p.evaluate(() => { STATE.revSel = -1; render(); });
  ok('zonder keuze opent de nieuwste trade', /BBB/.test(await p.evaluate(() => document.querySelector('.revtrade h3').textContent)));
  await p.evaluate(() => { STATE.revSel = T.find(x => x.pair === 'BBB/USDT').id; render(); });
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(100);
  ok('→ gaat naar de volgende in de lijst (ouder)', (await pairSel()) === WANT[1], await pairSel());
  await p.evaluate(() => revNav(1));
  ok('revNav(1) volgt de lijst', (await pairSel()) === WANT[2], await pairSel());
  await p.evaluate(() => revNav(-1));
  ok('revNav(-1) terug', (await pairSel()) === WANT[1], await pairSel());
  ok('teller klopt met de plek', /2\/5/.test(await p.evaluate(() => document.querySelector('.revtrade .phead').textContent)));

  console.log('─── Beeld ───');
  await p.evaluate(() => { STATE.revMonth = 0; setRevMode('beeld'); });
  const kaarten = await p.evaluate(() => [...document.querySelectorAll('.revcard')].map(e => e.textContent.match(/[A-Z]{3}\/USDT/)[0]));
  ok('kaarten in dezelfde volgorde', kaarten.join() === WANT.join(), kaarten.join());
  await p.evaluate(() => [...document.querySelectorAll('.revmonth .btn')].find(x => /Presenteer maand/.test(x.textContent)).click());
  const pres = await p.evaluate(() => revPres.items.map(x => T.find(t => t.id === x.id).pair));
  ok('presentatie in dezelfde volgorde', pres.join() === WANT.join(), pres.join());
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(100);
  ok('→ in de presentatie gaat naar de volgende (ouder)', await p.evaluate(() => T.find(t => t.id === revPres.items[revPres.i].id).pair) === WANT[1]);
  await p.keyboard.press('Escape');

  console.log('─── Andere pagina\'s ongemoeid ───');
  ok('T (opslagvolgorde) niet omgegooid', (await p.evaluate(() => T.map(t => t.pair).join())) === TRADES.map(t => t.pair).join());
  ok('geen JS-errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(`\n${pass} ✓  ${fail} ✗`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
