// R zonder stop-loss moet "—" tonen, niet "+0,0R".
//
// Denny meldde op v1.0 (28-09-2026) dat de R-kolom bij al zijn OKX-trades op +0.0R bleef staan,
// bij winst én bij verlies. Dat klopte: hij had nergens een stop-loss ingevuld, en zonder stop is
// er geen risico om het resultaat tegen af te zetten — R is dan niet te bepalen.
//
// De app had daar al een antwoord op: tradeROrNull() geeft null bij onbekend, en de R-eenheid
// (unitTrade) toont dan een streepje. Alleen de R-kólom sloeg die helper over en las t.r rechtstreeks,
// waar 0 zowel "break-even" als "onbekend" betekent. Gevolg: "+0,0R" bij een trade van −$3,95.
//
// Deze spec bewaakt het onderscheid dat daardoor verloren ging: onbekend → "—", echt nul → "+0,0R".
const { chromium } = require('playwright');
const path = require('path');

let pass = 0, fail = 0;
const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const B = { pair: 'BTC/USDC', exchange: 'okx', dir: 'long', status: 'closed', setup: '', size: '0.01' };

// Zoals Denny's trades binnenkomen: gesynct, met resultaat, zonder stop-loss.
const WINST   = { ...B, id: 'z1', date: '2026-09-22', time: '10:00', entry: 60000, exit: 60600, pnl: 6.43 };
const VERLIES = { ...B, id: 'z2', date: '2026-09-23', time: '11:00', entry: 60000, exit: 59600, pnl: -3.95 };
// Controle: mét stop hoort R gewoon te verschijnen.
const MET_SL  = { ...B, id: 'm1', date: '2026-09-24', time: '12:00', entry: 60000, exit: 61800, stop: 59000, pnl: 18, r: 1.8 };
// En een échte nul-trade moet "+0,0R" blijven tonen — dat is een andere bewering dan "onbekend".
const NUL     = { ...B, id: 'n1', date: '2026-09-25', time: '13:00', entry: 60000, exit: 60000, stop: 59000, pnl: 0 };

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

  await p.evaluate((d) => {
    T = d.rijen.map(x => ({ ...EMPTY_TRADE, ...x }));
    persist(); clearGFilter(); setFilter('kind', 'alle'); go('trades');
  }, { rijen: [WINST, VERLIES, MET_SL, NUL] });
  await p.waitForTimeout(500);

  console.log('─── De rekenkant: onbekend is niet nul ───');
  const rek = await p.evaluate(() => {
    const van = id => T.find(t => t.id === id);
    return {
      winst: tradeROrNull(van('z1')), verlies: tradeROrNull(van('z2')),
      metSl: tradeROrNull(van('m1')), nul: tradeROrNull(van('n1')),
      kolomZichtbaar: VV('tR'),
    };
  });
  ok('winst zonder stop → R onbekend (null)', rek.winst === null, 'kreeg: ' + rek.winst);
  ok('verlies zonder stop → R onbekend (null)', rek.verlies === null, 'kreeg: ' + rek.verlies);
  ok('mét stop → R is gewoon 1.8', rek.metSl === 1.8, 'kreeg: ' + rek.metSl);
  ok('echte break-even mét stop → 0, niet null', rek.nul === 0, 'kreeg: ' + rek.nul);

  console.log('─── De R-kolom in de Trades-tabel ───');
  ok('de R-kolom staat aan', rek.kolomZichtbaar === true);
  const cellen = await p.evaluate(() =>
    [...document.querySelectorAll('td[data-l="R"]')].map(td => td.textContent.trim()));
  ok('er staan vier R-cellen', cellen.length === 4, JSON.stringify(cellen));
  ok('precies één cel toont +0,0R — alleen de echte nul-trade', cellen.filter(c => c === '+0,0R').length === 1, JSON.stringify(cellen));
  ok('twee cellen tonen een streepje', cellen.filter(c => c === '—').length === 2, JSON.stringify(cellen));
  ok('de trade mét stop toont +1,8R', cellen.includes('+1,8R'), JSON.stringify(cellen));
  ok('de echte nul-trade toont +0,0R', cellen.includes('+0,0R'), JSON.stringify(cellen));

  console.log('─── Het streepje legt zichzelf uit ───');
  const titels = await p.evaluate(() =>
    [...document.querySelectorAll('td[data-l="R"] .rbadge.n')].map(e => e.getAttribute('title') || ''));
  ok('beide streepjes hebben een uitleg-tooltip', titels.length === 2 && titels.every(t => /stop-loss/i.test(t)), JSON.stringify(titels));

  console.log('─── Dashboard: "Recente trades" vertelt hetzelfde ───');
  await p.evaluate(() => go('dashboard')); await p.waitForTimeout(500);
  const dash = await p.evaluate(() => {
    const tab = [...document.querySelectorAll('table')].find(t => /BTC\/USDC/.test(t.textContent));
    if (!tab) return null;
    return [...tab.querySelectorAll('tbody tr')].map(tr => (tr.lastElementChild.previousElementSibling || {}).textContent || '');
  });
  ok('de recente-trades-tabel staat er', dash && dash.length > 0, JSON.stringify(dash));
  ok('daar staan ook streepjes, geen +0,0R', dash && dash.filter(c => c.trim() === '—').length === 2, JSON.stringify(dash));

  console.log('─── En het detailscherm ───');
  await p.evaluate(() => { STATE.revSel = 'z2'; go('review'); }); await p.waitForTimeout(500);
  const detail = await p.evaluate(() => {
    const chip = [...document.querySelectorAll('.chip')].find(e => /behaald/.test(e.textContent));
    const groot = [...document.querySelectorAll('.pnlbig')].map(e => (e.parentElement || {}).textContent || '')[0];
    return { chip: chip ? chip.textContent.trim() : null, groot: (groot || '').trim() };
  });
  ok('de "behaald"-chip toont een streepje', detail.chip && /behaald\s*—/.test(detail.chip), detail.chip);
  ok('het grote R-getal naast de P&L ook', detail.groot && detail.groot.includes('—') && !/\+0[.,]0R/.test(detail.groot), detail.groot);

  ok('geen nieuwe JS-fouten', errs.length === 0, errs[0]);

  console.log(`\n=== R zonder stop: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
