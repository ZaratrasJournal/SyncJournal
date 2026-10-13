// Playbook-kaart: "Gem. R" rekent zoals de rest van de app, met gemR().
//
// Denny 13-10-2026: "bij de playbook zie ik niet de R verschijnen" — +0,00 bij vier trades die
// allemaal een stop hebben. De kaart telde het opgeslagen t.r op (bij gesyncte trades 0) en deelde
// door álle trades: dezelfde fout als v1.1 (zie CLAUDE.md, "R-multiple: 0 is niet onbekend").
const { chromium } = require('playwright');
const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const SETUP = '1H MSB/BOS';
const tr = (id, ex, date, entry, stop, size, pnl, extra) => ({ id, exchange: ex, kind: 'live', status: 'closed', pair: 'BTC/USDC', dir: 'long', setup: SETUP,
  date, time: '10:00', entry, stop, size: String(size), pnl, r: 0, durationMin: 30, ...extra });
// Denny's vier gesloten trades van deze playbook (export 13-10), allemaal met stop en r: 0 opgeslagen
const TRADES = [
  tr(39, 'okx', '2026-09-28', 83365.8, 82401, 225.09, 0.0089),
  tr(40, 'hyperliquid', '2026-09-28', 83228, 82500, 707.44, 0.4508),
  tr(82, 'hyperliquid', '2026-10-05', 86303, 87700, 385.77, 14.2874, { dir: 'short' }),
  tr(83, 'okx', '2026-10-05', 85840, 87000, 206.02, 8.8614, { dir: 'short' }),
];
// netto P&L ÷ risico in $ (|entry − stop| ÷ entry × size), gemiddeld over de trades mét een R
const rVan = t => t.pnl / (Math.abs(t.entry - t.stop) / t.entry * +t.size);
const VERWACHT = TRADES.reduce((s, t) => s + rVan(t), 0) / TRADES.length;
const tekst = v => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2).replace('.', ',');

(async () => {
  const b = await chromium.launch(); const { p, errs } = await H.openJournal(b);
  const kaartR = setup => p.evaluate(s => {
    go('playbook'); const k = [...document.querySelectorAll('.pbcard')].find(c => (c.querySelector('.nm') || {}).textContent === s);
    const st = k && [...k.querySelectorAll('.stats .s')].find(x => /Gem\. R/i.test(x.querySelector('.l').textContent));
    return st ? st.querySelector('.v').textContent.trim() : '(geen kaart)';
  }, setup);
  await p.evaluate(rows => { T = rows.map(t => ({ ...EMPTY_TRADE, ...t })); PBOOK['1H MSB/BOS'] = PBOOK['1H MSB/BOS'] || { criteria: [] }; persist(); }, TRADES);

  const r1 = await kaartR(SETUP);
  ok(`Gem. R = ${tekst(VERWACHT)} (netto ÷ risico), niet +0,00`, r1 === tekst(VERWACHT), r1);

  // een trade zonder stop heeft geen R: hij telt niet mee, en trekt het gemiddelde niet naar nul
  await p.evaluate(() => { T.push({ ...EMPTY_TRADE, id: 90, exchange: 'okx', kind: 'live', status: 'closed', pair: 'BTC/USDC', dir: 'long', setup: '1H MSB/BOS', date: '2026-10-06', time: '10:00', entry: 100, stop: 0, size: '100', pnl: 5, r: 0, durationMin: 30 }); persist(); });
  const r2 = await kaartR(SETUP);
  ok('een trade zonder stop verandert het gemiddelde niet', r2 === tekst(VERWACHT), r2);

  // Zelfde fout op andere plekken: Analytics "Cumulatieve R" telde t.r op (bleef leeg), en de R per
  // tradeduur telde een onbekende R als 0.
  const ana = await p.evaluate(() => {
    const echt = lineSeries; let cr = null; lineSeries = (vals, o) => { if (o && o.id === 'cr') cr = vals; return echt(vals, o); };
    go('analytics'); lineSeries = echt;
    const d = [...document.querySelectorAll('*')].find(x => !x.children.length && /^15m–1u$/.test(x.textContent.trim()));
    const rij = d && d.closest('.hbar, .hb, .hbrow, div').parentElement;
    return { cr, duur: rij ? rij.textContent.replace(/\s+/g, ' ') : '' };
  });
  let cum = 0; const crVerwacht = [0, ...TRADES.map(t => +(cum += rVan(t)).toFixed(2))];
  ok('Cumulatieve R loopt op tot ' + crVerwacht[crVerwacht.length - 1] + 'R, de trade zonder stop telt niet mee', JSON.stringify(ana.cr) === JSON.stringify(crVerwacht), JSON.stringify(ana.cr));
  ok('R per tradeduur (15m–1u): ' + tekst(VERWACHT) + 'R, niet omlaag getrokken door de trade zonder stop', ana.duur.includes(tekst(VERWACHT) + 'R'), ana.duur);

  // de prullenbak toonde het opgeslagen t.r: +0,0R
  const bak = await p.evaluate(() => { trashDelete([82]); const d = document.createElement('div'); d.innerHTML = trashPanel(); const v = d.textContent.replace(/\s+/g, ' '); undoTrash([82]); return v; });
  const r82 = rVan(TRADES[2]);
  ok('prullenbak: de trade van 05-10 toont ' + (r82 >= 0 ? '+' : '−') + Math.abs(r82).toFixed(1).replace('.', ',') + 'R, niet +0,0R', bak.includes((r82 >= 0 ? '+' : '−') + Math.abs(r82).toFixed(1).replace('.', ',') + 'R'), bak.slice(0, 200));

  // een playbook waarvan geen enkele trade een stop heeft: een streepje, geen +0,00
  await p.evaluate(() => { T = [{ ...EMPTY_TRADE, id: 91, exchange: 'okx', kind: 'live', status: 'closed', pair: 'BTC/USDC', dir: 'long', setup: 'Zonder stop', date: '2026-10-06', time: '10:00', entry: 100, stop: 0, size: '100', pnl: 5, r: 0 }];
    PBOOK['Zonder stop'] = { criteria: [] }; persist(); });
  const r3 = await kaartR('Zonder stop');
  ok('geen enkele trade met een stop: "—", geen +0,00', r3 === '—', r3);

  ok('geen JS-fouten', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== Playbook Gem. R: ${pass}/${pass + fail} ===`); await b.close(); process.exit(fail ? 1 : 0);
})();
