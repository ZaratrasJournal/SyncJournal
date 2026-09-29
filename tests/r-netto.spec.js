// R-multiple = netto P&L (na fees) ÷ je risico in $, en overal hetzelfde getal.
//
// Denny 29-09-2026, één Hyperliquid-trade, drie R's: het formulier-veld "0", de samenvatting
// "+0,07R" (netto P&L ÷ risico) en de tabel "+0,2R" (prijsbeweging vóór fees). Afgesproken: zoals
// TradeZella e.a. — Realized R = Net P&L / Trade Risk, risico in $ vanaf je stop-loss.
// Backtest/paper/gemist houden hun theoretische R (vaak zonder echte P&L).
const { chromium } = require('playwright');
const path = require('path');

let pass = 0, fail = 0;
const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const MAAND = new Date().toISOString().slice(0, 7);
const L = { pair: 'BTC/USDC', dir: 'long', exchange: 'hyperliquid', kind: 'live', status: 'closed', session: 'US AM' };
// Denny's trade: risico = |83228 − 82500| ÷ 83228 × 707,44 = $6,188 → R = 0,4508 ÷ 6,188 = 0,0729
const HL = { ...L, id: 'hl', date: `${MAAND}-02`, time: '17:40', entry: 83228, exit: 83356, stop: 82500, size: '707.44', pnl: 0.4508, fees: 0.6372, r: 0 };
// Opgeslagen R wijkt af van de berekening: de berekening wint (risico $10, netto $15 → 1,5R)
const OUD = { ...L, id: 'oud', exchange: 'okx', date: `${MAAND}-03`, time: '10:00', entry: 100, exit: 116, stop: 90, size: '100', pnl: 15, r: 1.8 };
// Bruto winst, netto verlies door fees: R is negatief (−0,2), niet de +0,5 van de prijs
const FEES = { ...L, id: 'fees', exchange: 'okx', date: `${MAAND}-04`, time: '11:00', entry: 100, exit: 100.5, stop: 99, size: '100', pnl: -0.2, fees: 0.7 };
// Geen stop: R onbekend
const ZONDER = { ...L, id: 'zonder', exchange: 'okx', date: `${MAAND}-05`, time: '12:00', entry: 100, exit: 105, size: '100', pnl: 5 };
// Backtest met theoretische R en geen P&L: blijft 4,2
const BT = { ...L, id: 'bt', kind: 'backtest', exchange: '', date: `${MAAND}-01`, time: '09:00', entry: 100, exit: 0, stop: 95, size: '1000', pnl: 0, r: 4.2 };

(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await p.setViewportSize({ width: 1600, height: 1100 });
  await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(600);
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(800);
  await p.evaluate(() => { try { hideWelcome(); } catch (e) {} });
  ok('boot zonder JS-fouten', errs.length === 0, errs[0]);

  const r = await p.evaluate(async rijen => {
    T = rijen.map(x => ({ ...EMPTY_TRADE, ...x })); persist(); clearGFilter(); setFilter('kind', 'alle');
    const uit = { r: {} };
    T.forEach(t => { uit.r[t.id] = tradeROrNull(t); });
    go('trades');
    uit.cel = {};
    document.querySelectorAll('tbody tr').forEach(tr => { const tijd = (tr.textContent.match(/\d\d:\d\d/) || [''])[0]; const c = tr.querySelector('td[data-l="R"]'); if (c) uit.cel[tijd] = c.textContent.trim(); });
    // het formulier van Denny's trade: veld en samenvatting
    openForm('hl'); await new Promise(res => setTimeout(res, 300));
    uit.veld = (document.getElementById('f_r') || {}).value;
    closeForm(); openForm('zonder'); await new Promise(res => setTimeout(res, 300));
    uit.veldZonder = (document.getElementById('f_r') || {}).value;   // geen stop: leeg, niet "0"
    closeForm(); openForm('hl'); await new Promise(res => setTimeout(res, 300));
    uit.samenvatting = ((document.getElementById('calcline') || document.querySelector('.calcline') || {}).textContent || document.body.innerText.match(/P&L[^\n]*R\s*[+−-][\d,]+R/) || [''])[0] || '';
    closeForm();
    return uit;
  }, [HL, OUD, FEES, ZONDER, BT]);

  console.log('─── De berekening ───');
  ok('Denny\'s trade: R = 0,07 (netto ÷ risico)', Math.abs(r.r.hl - 0.0729) < 0.001, String(r.r.hl));
  ok('berekening wint van een afwijkende opgeslagen R (1,5, niet 1,8)', Math.abs(r.r.oud - 1.5) < 0.001, String(r.r.oud));
  ok('fees tellen mee: netto verlies = negatieve R (−0,2)', Math.abs(r.r.fees + 0.2) < 0.001, String(r.r.fees));
  ok('zonder stop: R onbekend', r.r.zonder === null, String(r.r.zonder));
  ok('backtest houdt zijn theoretische R (4,2)', r.r.bt === 4.2, String(r.r.bt));

  console.log('─── Tabel en formulier tonen hetzelfde getal ───');
  ok('tabel: +0,07R (niet +0,1R of +0,2R)', r.cel['17:40'] === '+0,07R', r.cel['17:40']);
  ok('tabel: +1,5R', r.cel['10:00'] === '+1,5R', r.cel['10:00']);
  ok('tabel: −0,20R', r.cel['11:00'] === '−0,20R', r.cel['11:00']);
  ok('tabel: streepje zonder stop', r.cel['12:00'] === '—', r.cel['12:00']);
  ok('tabel: backtest +4,2R', r.cel['09:00'] === '+4,2R', r.cel['09:00']);
  ok('formulier-veld R-multiple: 0.07 (niet 0)', String(r.veld) === '0.07', String(r.veld));
  ok('formulier-veld zonder stop: leeg, niet "0"', r.veldZonder === '', JSON.stringify(r.veldZonder));

  console.log('─── Gemiddelden en AI-coach ───');
  const gem = await p.evaluate(() => { const live = T.filter(t => t.kind !== 'backtest'); const g = gemR(live);
    T = T.filter(t => t.id === 'zonder'); persist(); setFilter('kind', 'live');
    return { avg: g.avg, n: g.n, coach: aiReply('hoe zit het met mijn risk'), rij: groupRows('session')[0] }; });
  ok('gemiddelde R telt 3 live trades met R', gem.n === 3, String(gem.n));
  ok('gemiddelde = (0,0729 + 1,5 − 0,2) ÷ 3', Math.abs(gem.avg - (0.0729 + 1.5 - 0.2) / 3) < 0.001, String(gem.avg));
  ok('AI-coach zegt geen "+0,00" als er geen R is', !/\+0,00/.test(gem.coach), gem.coach.slice(0, 160));
  ok('uitsplitsing per sessie: geen R = geen getal', gem.rij && gem.rij.r === null, JSON.stringify(gem.rij && gem.rij.r));

  ok('geen nieuwe JS-fouten', errs.length === 0, errs[0]);
  console.log(`\n=== R netto: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
