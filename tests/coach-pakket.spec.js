// AI-coach: het pakket dat de coach krijgt (docs/research-ai-coach-2026-10-25.md, §6.2).
//
// "De app rekent, het model leest." coachPakket() zet de cijfers klaar die de coach mag noemen; het model
// rekent zelf niets. Daarom moeten die cijfers precies zijn wat de journal zelf toont, mag een trade zonder
// stop-loss nooit als 0R meetellen (CLAUDE.md, R-multiple), en gaan bedragen en notities alleen mee als de
// trader dat wil. Geen netwerk: dit is een pure functie.
const { chromium } = require('playwright');
const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const NOTITIE = 'Te vroeg ingestapt, wachtte niet op de retest';
const tr = (id, date, pnl, extra) => ({ id, exchange: 'blofin', kind: 'live', status: 'closed', pair: 'BTC/USDT', dir: 'long', setup: 'London SFP',
  session: 'London', date, time: '10:00', entry: 100, stop: 98, size: 1000, pnl, fees: 0, durationMin: 30, ...extra });
// Risico per trade met stop: |100 − 98| ÷ 100 × 1000 = $20, dus R = pnl ÷ 20.
const TRADES = [
  tr(1, '2026-10-01', 40, { emotions: ['Rustig'], grade: 'A' }),
  tr(2, '2026-10-02', -20, { emotions: ['FOMO'], mistakes: ['Te vroeg in'], notes: NOTITIE, grade: 'B' }),
  tr(3, '2026-10-05', 30, { session: 'US AM', setup: 'Trend-pullback', grade: 'A' }),
  tr(4, '2026-10-06', -10, { session: 'US AM', setup: 'Trend-pullback', dir: 'short', emotions: ['FOMO'] }),
  tr(5, '2026-10-07', 12.5, { stop: '', pair: 'ETH/USDT' }),   // zonder stop-loss: geen R
  tr(6, '2026-10-08', -7.25, { stop: '', pair: 'ETH/USDT', mistakes: ['Te vroeg in'] }),   // zonder stop-loss
];

(async () => {
  const b = await chromium.launch(); const { p, errs } = await H.openJournal(b);
  await H.seed(p, { app: 'SyncJournal', trades: TRADES, settings: { currency: 'USD', theme: 'light' } });
  await p.evaluate(() => { STATE.unit = 'val'; clearGFilter(); setFilter('kind', 'alle'); render(); });

  ok('coachPakket() bestaat', await p.evaluate(() => typeof coachPakket === 'function'));
  const pk = o => p.evaluate(o => coachPakket(o).tekst, o || {});

  console.log('─── Kerncijfers = wat Analytics toont ───');
  const ana = await p.evaluate(() => { go('analytics'); const o = {};
    document.querySelectorAll('.kpis .kpi').forEach(k => { o[k.querySelector('.k').textContent.trim()] = k.querySelector('.v').textContent.trim(); }); return o; });
  const tekst = await pk();
  const alles = (tekst.match(/^- Alles.*$/m) || [''])[0];
  const veld = re => (alles.match(re) || [, '(niet gevonden)'])[1].trim();
  ok('netto = Analytics "Netto P&L" (' + ana['Netto P&L'] + ')', veld(/netto (.+?) ·/) === ana['Netto P&L'], alles);
  ok('winrate = Analytics "Win-rate" (' + ana['Win-rate'] + ')', veld(/winrate (.+?) ·/) === ana['Win-rate'], alles);
  ok('profit factor = Analytics (' + ana['Profit factor'] + ')', veld(/profit factor (.+?) ·/) === ana['Profit factor'], alles);
  ok('expectancy = Analytics (' + ana['Expectancy'] + ')', veld(/expectancy (.+?) ·/) === ana['Expectancy'], alles);
  ok('het aantal trades staat erbij', /^- Alles \(6 trades\)/.test(alles), alles);

  console.log('─── R: gemiddelde alleen over trades mét stop-loss ───');
  const verwachtR = (2 + -1 + 1.5 + -0.5) / 4;   // trades 1–4; 5 en 6 hebben geen R
  ok('gem. R over 4 trades, 2 zonder R', alles.includes('gem. R ' + (verwachtR >= 0 ? '+' : '−') + Math.abs(verwachtR).toFixed(2).replace('.', ',') + ' (n=4, 2 zonder R)'), alles);
  const regel5 = (tekst.match(/^- #\d+ .*ETH\/USDT.*$/m) || [''])[0];   // trades 5 en 6: ETH, zonder stop
  ok('trade zonder stop-loss toont "geen R"', /geen R/.test(regel5), regel5);
  ok('en nergens "+0,00" als R', !/R \+0,00/.test(tekst) && !/\+0,00R/.test(tekst), (tekst.match(/.*\+0,00.*/) || [''])[0]);
  ok('de uitleg zegt dat geen R onbekend is, niet 0', /geen R.*onbekend/i.test(tekst));

  console.log('─── Groepen: n bij elke groep ───');
  const groepRegels = tekst.split('\n').filter(l => /^## /.test(l) ? false : /^- (?!#|Alles|Laatste)/.test(l) && /: /.test(l));
  ok('er zijn groepsregels', groepRegels.length >= 8, groepRegels.length + ' regels');
  ok('elke groepsregel heeft n=', groepRegels.every(l => /: n=\d+/.test(l)), groepRegels.find(l => !/: n=\d+/.test(l)));
  for (const kop of ['Setup', 'Sessie', 'Weekdag', 'Richting', 'Symbool', 'Grade', 'Fout', 'Emotie']) ok('groep "' + kop + '" staat erin', new RegExp('^## .*' + kop, 'm').test(tekst));
  const fomo = (tekst.match(/^- FOMO: .*$/m) || [''])[0];
  ok('FOMO: 2 trades, winrate 0%', /n=2 · .*winrate 0%/.test(fomo), fomo);
  ok('de regel over kleine groepen staat erin', /n < 5/.test(tekst));

  console.log('─── Bedragen verbergen ───');
  const verborgen = await pk({ hideAmounts: true });
  ok('geen $ of € in het pakket', !/[$€]/.test(verborgen), (verborgen.match(/.*[$€].*/) || [''])[0]);
  ok('geen bedragen uit de trades (40, 12,5, 7,25)', !/\b40\b|12,5|7,25/.test(verborgen.replace(/^#.*$/gm, '')), (verborgen.match(/.*(\b40\b|12,5|7,25).*/) || [''])[0]);
  ok('winrate en R blijven', /winrate 50%/.test(verborgen) && /gem\. R/.test(verborgen));
  ok('het pakket zegt dat bedragen zijn weggelaten', /bedragen.*weggelaten/i.test(verborgen));

  console.log('─── Notities ───');
  ok('notities gaan standaard mee', tekst.includes(NOTITIE));
  ok('notities uit: geen notitie in het pakket', !(await pk({ notes: false })).includes(NOTITIE));

  console.log('─── Eén trade in focus ───');
  // het importeren nummert de trades opnieuw; zoek de trade met de notitie op
  const fid = await p.evaluate(n => T.find(t => t.notes === n).id, NOTITIE);
  const focus = await pk({ focusId: fid });
  ok('de trade met de notitie staat als focus bovenaan de trades', new RegExp('## Trade in focus\\n- #' + fid + ' ').test(focus), focus.slice(focus.indexOf('## Trade in focus'), focus.indexOf('## Trade in focus') + 200));
  ok('met de cijfers van zijn setup', /Zijn setup \(London SFP\): n=4 · /.test(focus), (focus.match(/.*Zijn setup.*/) || [''])[0]);

  console.log('─── Profit factor zonder verlies: ∞, nooit 99,00 ───');
  await p.evaluate(() => { T = T.filter(t => t.pnl > 0); persist(); render(); });
  const winst = await pk();
  ok('profit factor ∞', /profit factor ∞/.test(winst), (winst.match(/^- Alles.*$/m) || [''])[0]);
  ok('nergens 99,00', !/99,00/.test(winst));

  console.log('─── Lege selectie ───');
  const leeg = await p.evaluate(() => { CLOSED = []; BOEKINGEN = []; return coachPakket({}); });
  ok('geen gesloten trades: n = 0', leeg.n === 0, JSON.stringify(leeg).slice(0, 120));

  ok('geen JS-fouten', errs.length === 0, errs[0]);
  console.log(`\n=== Coach-pakket: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
