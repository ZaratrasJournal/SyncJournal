// Een lopende positie telt pas mee in de statistieken als hij helemaal dicht is.
//
// Denny 07-10-2026: win-rate 43% en reeks "3V", terwijl zijn twee lopende posities allebei al een TP
// hadden. Zo'n positie (partial) telde als trade met P&L 0: geen winst, dus omlaag met de win-rate, en
// in de reeks als verlies. Maar na een TP kan de rest nog op de stop eindigen; de uitkomst staat pas
// vast als hij dicht is. Dan telt hij mee met zijn hele resultaat, winst of verlies.
const { chromium } = require('playwright');
const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const ms = s => String(Date.parse(s));
const live = (id, date, time, pnl, extra) => ({ id, exchange: 'okx', kind: 'live', status: 'closed', pair: 'BTC/USDC', dir: 'long', setup: 'MSB', date, time,
  openTime: ms(date + 'T' + time + ':00+02:00'), closeTime: ms(date + 'T' + time + ':00+02:00'), entry: 1, exit: 1, pnl, ...extra });
// Denny's export van 07-10: vijf gesloten trades (3 winst, 2 verlies), twee met een TP die nog lopen
const TRADES = [
  live(39, '2026-09-28', '16:14', 0.0089), live(40, '2026-09-28', '17:40', 0.4508), live(41, '2026-09-30', '08:50', -2.0222),
  live(42, '2026-09-30', '15:36', 0.6619), live(45, '2026-09-30', '19:25', -9.9307),
  live(82, '2026-10-05', '16:24', 0, { status: 'partial', realizedPnl: 9.5332, closeTime: '' }),
  live(83, '2026-10-05', '06:16', 0, { status: 'partial', realizedPnl: 2.5092, closeTime: '' }),
  live(84, '2026-10-06', '09:00', 0, { status: 'open', closeTime: '' }),
];

(async () => {
  const b = await chromium.launch(); const { p, errs } = await H.openJournal(b);
  await p.evaluate(rows => { T = rows.map(t => ({ ...EMPTY_TRADE, ...t })); persist(); STATE.currency = 'USD'; STATE.calMonth = '2026-10'; }, TRADES);
  const analytics = () => p.evaluate(() => {
    go('analytics');
    const kaart = re => { const k = [...document.querySelectorAll('.kpi.kcard')].find(x => re.test(x.querySelector('.k').innerText)); return k ? k.querySelector('.v').innerText.replace(/\s+/g, ' ') : ''; };
    const main = document.getElementById('main').innerText.replace(/\s+/g, ' ');
    return { wr: kaart(/win-rate/i), exp: kaart(/expectancy/i), net: kaart(/netto/i), teller: (main.match(/\d+ trades in de berekening[^📊]*?(?=\s{0,2}[⚠✓]|$)/) || [''])[0].slice(0, 80),
      reeks: (main.match(/(\d+[WV]) huidige reeks/) || [])[1], laatste: document.querySelectorAll('.fstrip .fdot').length };
  });

  console.log('─── Twee posities met een TP en één open: nog geen uitkomst ───');
  const a = await analytics();
  ok('win-rate 60% (3 van de 5 gesloten), niet 43% (3 van 7)', a.wr === '60%', a.wr);
  ok('expectancy −$ 2,17 (−10,83 over 5), niet −$ 1,55 (over 7)', /2,17/.test(a.exp), a.exp);
  ok('netto P&L: al het geboekte geld, +$ 1,21 (−10,83 + 9,53 + 2,51 geboekt)', /^\+\$ 1,21$/.test(a.net), a.net);
  ok('reeks: 1V (de laatste gesloten trade), niet 3V', a.reeks === '1V', a.reeks);
  ok('"laatste trades": alleen de vijf gesloten', a.laatste === 5, String(a.laatste));
  ok('de teller zegt het: 5 trades in de berekening · 3 lopend niet meegerekend', /^5 trades in de berekening · 3 lopend niet meegerekend/.test(a.teller), a.teller);

  console.log('─── Kalender oktober: alleen lopende posities (5 okt), plus de open trade ───');
  const kal = await p.evaluate(() => {
    go('kalender'); const tekst = el => el ? el.innerText.replace(/\s+/g, ' ').trim() : '';
    const m = tekst(document.getElementById('main')).match(/netto maand (\S+ \S+) (\d+) trades/i);
    const cel = [...document.querySelectorAll('.calgrid .cell')].find(c => tekst(c.querySelector('.dn')) === '5');
    const week = cel && cel.closest('.calrow').querySelector('.wtot');
    const maand = document.querySelector('.ymc[data-mo="9"] .ymv');
    const jc = document.querySelector('.yc[data-iso="2026-10-05"]');
    let tip = ''; if (jc) { yhMove({ target: jc }); tip = tekst(document.getElementById('yhtip')); yhHide(); }
    let mtip = ''; const mc = document.querySelector('.ymc[data-mo="9"]'); if (mc) { ymMove({ target: mc }); mtip = tekst(document.getElementById('yhtip')); yhHide(); }
    return { netto: m && m[1], n: m ? +m[2] : null, cel: tekst(cel), week: tekst(week), maand: tekst(maand), kleur: jc ? jc.getAttribute('style') : '', tip, mtip };
  });
  ok('"Netto maand" +$ 12,04 en 0 trades: geboekt geld, nog geen afgelopen trade', kal.netto === '+$ 12,04' && kal.n === 0, JSON.stringify([kal.netto, kal.n]));
  ok('de dag van 5 oktober: +$ 12,04 en "loopt", geen 0·NaN%', /\+\$ 12,04/.test(kal.cel) && /loopt/.test(kal.cel) && !/NaN/.test(kal.cel), kal.cel);
  ok('weektotaal +$ 12,04, geen streepje', /\+\$ 12,04/.test(kal.week), kal.week);
  ok('maandstrook oktober toont het bedrag, geen streepje', /12/.test(kal.maand) && !/—/.test(kal.maand), kal.maand);
  ok('jaaroverzicht: 5 oktober heeft een kleur', /color-mix/.test(kal.kleur), kal.kleur);
  ok('tooltip van die dag: lopend en het bedrag, niet "Geen trades"', /Lopend/.test(kal.tip) && /12,04/.test(kal.tip) && !/Geen trades/.test(kal.tip), kal.tip);
  ok('tooltip van de maand: lopend en het bedrag', /Lopend/.test(kal.mtip) && /12/.test(kal.mtip) && !/Geen trades/.test(kal.mtip), kal.mtip);

  console.log('─── Geld: het geboekte deel van een lopende positie telt ───');
  await p.clock.setFixedTime(new Date('2026-10-07T12:00:00+02:00'));   // "deze maand" = oktober
  const geld = await p.evaluate(() => {
    go('analytics');
    const k = [...document.querySelectorAll('.kpi.kcard')].find(x => /netto/i.test(x.querySelector('.k').innerText));
    const waarvan = k && [...k.querySelectorAll('*')].find(x => /waarvan/.test(x.textContent) && !x.children.length);
    const echt = rcAreaChart; let eq = null;
    rcAreaChart = (data, o) => { if (o && o.gid === 'gEq') eq = data.map(d => d.y); return echt(data, o); };
    go('dashboard'); rcAreaChart = echt;
    const meta = (document.querySelector('.hero .meta') || {}).innerText || '';
    STATE.page = 'trades'; STATE.tradeTab = 'all'; render();
    const foot = (document.querySelector('tfoot') || {}).innerText || '';
    return { waarvan: waarvan ? waarvan.textContent.replace(/\s+/g, ' ').trim() : '', mask: !!waarvan && !!waarvan.closest('.mask'), eq,
      maand: (meta.replace(/\s+/g, ' ').match(/Gerealiseerd deze maand (\S+ \S+)/) || [])[1], foot: foot.replace(/\s+/g, ' ') };
  });
  ok('onder de netto P&L: "waarvan +$ 12,04 uit lopende posities", gemaskeerd', geld.waarvan === 'waarvan +$ 12,04 uit lopende posities' && geld.mask, JSON.stringify(geld.waarvan) + ' mask=' + geld.mask);
  ok('equity-curve: de geboekte TP\'s erbij, eindigt op +1,21', JSON.stringify(geld.eq) === JSON.stringify([0.01, 0.46, -1.56, -0.9, -10.83, -8.32, 1.21]), JSON.stringify(geld.eq));
  ok('dashboard "Gerealiseerd deze maand" (oktober): +$ 12,04', geld.maand === '+$ 12,04', geld.maand);
  ok('totaal onder de tradelijst: +$ 1,21', /\+\$ 1,21/.test(geld.foot), geld.foot);

  // %-weergave: rendement t.o.v. de accountgrootte (100), in dollars - ook als je euro's toont
  const pct = await p.evaluate(() => {
    MANUAL = [{ id: 'm1', name: 'Boek', transactions: [{ id: 1, type: 'deposit', amount: 100, date: '2026-01-01' }] }]; persistManual();
    const lees = () => { go('analytics'); const k = [...document.querySelectorAll('.kpi.kcard')].find(x => /netto/i.test(x.querySelector('.k').innerText)); return k.querySelector('.v').innerText.trim(); };
    STATE.unit = 'pct'; const usd = lees();
    // euro kan alleen met een koers; het netwerk is in de test dicht
    const koers = FX.latest; FX.latest = 0.9; T.forEach(t => { t.fx = 0.9; }); STATE.currency = 'EUR'; const eur = lees();
    STATE.unit = 'val'; const eurBedrag = lees();
    T.forEach(t => { delete t.fx; }); FX.latest = koers; STATE.currency = 'USD'; MANUAL = []; persistManual(); render();
    return { usd, eur, eurBedrag };
  });
  // basis = 100 − alles wat er sinds de oudste trade geboekt is (1,21): 1,2111 / 98,79 = 1,23%
  ok('%: +1,23% op een account van 100 (het geboekte deel telt, ook in de basis)', pct.usd === '+1,23%', pct.usd);
  ok('% is in euro-weergave hetzelfde: +1,23%', pct.eur === '+1,23%', pct.eur);
  ok('in euro: +€ 1,09 (1,21 × 0,9)', /1,09/.test(pct.eurBedrag), pct.eurBedrag);

  const dubbel = await p.evaluate(() => {
    T.push({ ...EMPTY_TRADE, id: 90, kind: 'live', status: 'closed', exchange: 'okx', pair: 'BTC/USDC', date: '2026-10-01', time: '10:00', pnl: 1, realizedPnl: 50 }); persist();
    go('analytics'); const k = [...document.querySelectorAll('.kpi.kcard')].find(x => /netto/i.test(x.querySelector('.k').innerText)); const v = k.querySelector('.v').innerText.trim();
    T = T.filter(t => t.id !== 90); persist(); render(); return v;
  });
  ok('een gesloten trade met een achtergebleven realizedPnl telt alleen zijn P&L: +$ 2,21', dubbel === '+$ 2,21', dubbel);

  console.log('─── De rest raakt alsnog de stop: per saldo verlies ───');
  await p.evaluate(() => { const t = T.find(x => x.id === 82); Object.assign(t, { status: 'closed', realizedPnl: '', pnl: -3.1, closeTime: String(Date.parse('2026-10-07T10:00:00+02:00')) }); persist(); });
  const b2 = await analytics();
  ok('nu telt hij mee, als verlies: win-rate 50% (3 van 6)', b2.wr === '50%', b2.wr);
  ok('reeks 2V', b2.reeks === '2V', b2.reeks);
  ok('teller: 6 in de berekening · 2 lopend', /^6 trades in de berekening · 2 lopend niet meegerekend/.test(b2.teller), b2.teller);

  console.log('─── Playbook en real/paper/backtest ───');
  const pb = await p.evaluate(() => { PBOOK.MSB = PBOOK.MSB || { criteria: [] }; const d = document.createElement('div'); d.innerHTML = playbookDetail('MSB'); return (d.textContent.match(/\d+% win/) || [''])[0]; });
  ok('playbook MSB: 50% win (3 van 6), de lopende niet meegeteld', pb === '50% win', pb);
  const ero = await p.evaluate(() => eroBuckets(T).real.n);
  ok('real/paper/backtest-vergelijking: 6 echte trades', ero === 6, String(ero));

  // Review 07-10-2026: niet elke partial draagt zijn eigen geld. Bij MEXC en Kraken (sibling-model) staat
  // in realizedPnl de som van gesloten rijen die zelf al meetellen.
  console.log('─── Per exchange: wie draagt het geboekte geld? ───');
  const netKaart = () => p.evaluate(() => { go('dashboard'); const k = [...document.querySelectorAll('.kpi.kcard')].find(x => /netto/i.test(x.querySelector('.k').innerText)); return k ? k.querySelector('.v').innerText.trim() : '(geen kaart)'; });
  const mexc = await p.evaluate(() => {
    T = [{ ...EMPTY_TRADE, id: 1, srcId: 'mexc_a', exchange: 'mexc', kind: 'live', status: 'closed', pair: 'BTC/USDT', dir: 'long', entry: 100, exit: 110, size: '1000', pnl: 10, date: '2026-10-01', time: '10:00' },
         { ...EMPTY_TRADE, id: 2, srcId: 'mexc_b', exchange: 'mexc', kind: 'live', status: 'open', pair: 'BTC/USDT', dir: 'long', entry: 100, exit: 0, size: '1000', pnl: 0, date: '2026-10-01', time: '10:00' }];
    persist(); STATE.unit = 'val'; runPartialDetect('mexc'); render(); const t = T.find(x => x.id === 2); return { status: t.status, realized: +t.realizedPnl };
  });
  ok('MEXC: de rest wordt partial met de som van de gesloten deel-rij (10)', mexc.status === 'partial' && mexc.realized === 10, JSON.stringify(mexc));
  const mexcNet = await netKaart();
  ok('MEXC: netto +$ 10,00, niet dubbel (+$ 20,00)', mexcNet === '+$ 10,00', mexcNet);
  await p.evaluate(() => {
    T = [{ ...EMPTY_TRADE, id: 1, srcId: 'kraken_pos_PF_XBTUSD_1', exchange: 'kraken', kind: 'live', status: 'closed', pair: 'BTC/USD', dir: 'long', entry: 60000, exit: 61000, size: '600', qtyAsset: 0.01, pnl: 20, date: '2026-09-01', time: '10:00' },
         { ...EMPTY_TRADE, id: 2, srcId: 'kraken_open_PF_XBTUSD', placeholder: true, exchange: 'kraken', kind: 'live', status: 'open', pair: 'BTC/USD', dir: 'long', entry: 60000, exit: 0, size: '600', qtyAsset: 0.01, pnl: 0, date: '2026-10-03', time: '10:00' }];
    persist(); runPartialDetect('kraken'); render();
  });
  const krakenNet = await netKaart();
  ok('Kraken: netto +$ 20,00, niet dubbel (+$ 40,00)', krakenNet === '+$ 20,00', krakenNet);
  // een geïmporteerde trade (realizedPnl = 0 na sjFromTj) die je zelf op Partial zet: zijn P&L is wat er geboekt is
  await p.evaluate(() => {
    const t = sjFromTj({ ...EMPTY_TRADE, id: 'blofin_csv_x', source: 'blofin', status: 'closed', pair: 'ETH/USDT', direction: 'long', entry: '2000', exit: '2050', pnl: '25', date: '2026-10-01', time: '09:00' });
    t.id = 50; t.status = 'partial'; T = [t]; persist(); render();
  });
  const csvNet = await netKaart();
  ok('CSV-trade die je op Partial zet: netto +$ 25,00, niet $ 0', csvNet === '+$ 25,00', csvNet);
  // R-weergave: een lopende positie telt met de R van wat hij geboekt heeft, niet van de hele positie
  const rNet = await p.evaluate(() => {
    T = [{ ...EMPTY_TRADE, id: 11, srcId: 'okx_b', exchange: 'okx', kind: 'live', status: 'partial', pair: 'BTC/USDC', dir: 'long', entry: 100, exit: 110, stop: 95, size: '1000', pnl: 0, r: 0, realizedPnl: 50, date: '2026-10-02', time: '10:00' }];
    persist(); STATE.unit = 'r'; go('dashboard');
    const k = [...document.querySelectorAll('.kpi.kcard')].find(x => /netto/i.test(x.querySelector('.k').innerText)); const v = k ? k.querySelector('.v').innerText.trim() : '';
    STATE.unit = 'val'; render(); return v;
  });
  // risico (100 − 95) ÷ 100 × 1000 = 50; geboekt 50 → +1R (de hele positie tot 110 zou +2R zijn)
  ok('R: netto +1,0R voor 50 geboekt op 50 risico, niet +2,0R', /^\+1,0R/.test(rNet), rNet);

  ok('geen JS-fouten', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== Lopend niet meegeteld: ${pass}/${pass + fail} ===`); await b.close(); process.exit(fail ? 1 : 0);
})();
