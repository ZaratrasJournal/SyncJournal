// Dashboard: de equity-curve loopt van oud naar nieuw, en de trend naast Netto P&L is geen P&L-percentage.
//
// Denny 07-10-2026: "de equity curve wordt niet goed weergegeven ... en mijn P&L staat -493%".
// 1. equity() draaide de lijst om in de veronderstelling dat T nieuwste-eerst staat. Gesyncte trades
//    komen er achteraan bij (oudste eerst), dus de curve liep achterstevoren: de grote min voorop.
// 2. De trend naast Netto P&L en Expectancy was de relatieve verandering tussen de eerste en tweede
//    helft van de periode: (−9,27 − −1,56) / 1,56 = −493%. Bij een kleine of negatieve eerste helft
//    zegt dat niets, en naast een bedrag leest het als "je P&L is −493%".
// Denny's live trades uit zijn export van 07-10, in de volgorde waarin ze opgeslagen staan.
const { chromium } = require('playwright');
const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const ms = s => String(Date.parse(s));
const live = (id, ex, date, time, pnl, extra) => ({ id, exchange: ex, kind: 'live', status: 'closed', pair: 'BTC/USDC', dir: 'long', date, time,
  openTime: ms(date + 'T' + time + ':00+02:00'), closeTime: ms(date + 'T' + time + ':00+02:00'), entry: 1, exit: 1, pnl, ...extra });
const TRADES = [
  live(39, 'okx', '2026-09-28', '16:14', 0.0089),
  live(40, 'hyperliquid', '2026-09-28', '17:40', 0.4508),
  live(41, 'okx', '2026-09-30', '08:50', -2.0222),
  live(42, 'okx', '2026-09-30', '15:36', 0.6619),
  live(45, 'hyperliquid', '2026-09-30', '19:25', -9.9307),
  live(82, 'hyperliquid', '2026-10-05', '16:24', 0, { status: 'partial', realizedPnl: 9.5332, closeTime: '' }),
  live(83, 'okx', '2026-10-05', '06:16', 0, { status: 'partial', realizedPnl: 2.5092, closeTime: '' }),
];
// van oud naar nieuw: 0,0089 → 0,4597 → −1,5625 → −0,9006 → −10,8313. De twee lopende posities (partial)
// tellen in de statistieken mee als "gesloten + partial", met P&L 0: ze staan achteraan en veranderen niets.
const VERWACHT = [0.01, 0.46, -1.56, -0.9, -10.83, -10.83, -10.83];

(async () => {
  const b = await chromium.launch(); const { p, errs } = await H.openJournal(b);
  await p.evaluate(rows => {
    T = rows.map(t => ({ ...EMPTY_TRADE, ...t })); persist();
    STATE.currency = 'USD';
    // vang de reeks die de equity-curve van het dashboard krijgt
    const echt = rcAreaChart; window.__eq = null;
    rcAreaChart = (data, o) => { if (o && o.gid === 'gEq') window.__eq = data.map(d => d.y); return echt(data, o); };
    go('dashboard');
  }, TRADES);
  await p.waitForTimeout(400);

  console.log('─── Equity-curve ───');
  const reeks = await p.evaluate(() => window.__eq);
  ok('van oud naar nieuw: eerst de kleine winsten, de −9,93 als laatste', JSON.stringify(reeks) === JSON.stringify(VERWACHT), JSON.stringify(reeks));
  ok('eindigt op de Netto P&L (−10,83)', !!reeks && reeks[reeks.length - 1] === -10.83, JSON.stringify(reeks));
  // een handmatige trade komt vooraan in T (unshift), een sync achteraan: de volgorde in T zegt niets
  const gemengd = await p.evaluate(() => { T.unshift(T.pop()); T.reverse(); render(); return window.__eq; });
  ok('volgorde in de opslag maakt niet uit', JSON.stringify(gemengd) === JSON.stringify(VERWACHT), JSON.stringify(gemengd));
  const chip = await p.evaluate(() => { const h = [...document.querySelectorAll('.panel .phead')].find(x => /Equity-curve/.test(x.innerText)); return h ? h.innerText.replace(/\s+/g, ' ') : ''; });
  ok('het label belooft geen "year-to-date" (de curve toont alle trades in je filter)', !!chip && !/year-to-date/i.test(chip), chip);

  // De lijn mag geen top of dal tekenen die er niet is: een "natural"-spline schoot tussen de punten
  // door en werd onderaan afgesneden (de −9,93 dook onder de −10,83 en de grafiek uit).
  await p.waitForTimeout(1800);   // Recharts tekent de lijn in ~1,5 s van links naar rechts
  const binnen = await p.evaluate(([lo, hi]) => {
    const svg = document.querySelector('.ch-eq svg.recharts-surface'), lijn = svg && svg.querySelector('.recharts-area-curve');
    // pixel-positie van een bedrag, via twee streepjes op de Y-as ("4,00", "−4,00")
    const ticks = [...(svg ? svg.querySelectorAll('.recharts-yAxis .recharts-cartesian-axis-tick text') : [])]
      .map(t => ({ v: +t.textContent.replace('−', '-').replace(/\./g, '').replace(',', '.'), y: +t.getAttribute('y') })).filter(t => isFinite(t.v));
    if (!lijn || ticks.length < 2) return { fout: 'geen grafiek' };
    const [a, z] = [ticks[0], ticks[ticks.length - 1]], px = v => a.y + (v - a.v) * (z.y - a.y) / (z.v - a.v);
    const b = lijn.getBBox();
    return { lijnTop: +b.y.toFixed(1), hoogste: +px(hi).toFixed(1), lijnBodem: +(b.y + b.height).toFixed(1), laagste: +px(lo).toFixed(1) };
  }, [Math.min(...VERWACHT), Math.max(...VERWACHT)]);
  ok('de lijn blijft tussen je hoogste en laagste stand: geen verzonnen top of dal tussen de punten', !binnen.fout && binnen.lijnBodem <= binnen.laagste + 1 && binnen.lijnTop >= binnen.hoogste - 1, JSON.stringify(binnen));
  const ana = await p.evaluate(() => { window.__eq = null; go('analytics'); return window.__eq; });
  ok('Analytics: dezelfde curve, van oud naar nieuw', JSON.stringify(ana) === JSON.stringify(VERWACHT), JSON.stringify(ana));

  console.log('─── Trend naast Netto P&L en Expectancy (Analytics) ───');
  const kpi = await p.evaluate(() => [...document.querySelectorAll('.kpi.kcard')].map(k => ({ label: k.querySelector('.k').innerText, trend: (k.querySelector('.ktrend') || {}).innerText || '' })));
  const net = kpi.find(k => /Netto/i.test(k.label)), exp = kpi.find(k => /Expectancy/i.test(k.label));
  ok('Netto P&L: geen percentage meer naast het bedrag (was "493%")', !!net && !/%/.test(net.trend), JSON.stringify(net));
  ok('Expectancy: ook geen relatief percentage', !!exp && !/%/.test(exp.trend), JSON.stringify(exp));
  const wr = kpi.find(k => /Win-rate/i.test(k.label));
  ok('Win-rate houdt zijn trend in punten', !!wr && /pt/.test(wr.trend), JSON.stringify(wr));
  const uitleg = await p.evaluate(() => [...document.querySelectorAll('.ktrend')].every(x => /helft/.test(x.title || '')));
  ok('elke trend zegt waarmee hij vergelijkt (tooltip)', uitleg);

  await p.evaluate(() => setTheme('light')); await p.evaluate(() => setTheme('dark'));
  ok('geen JS-fouten', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== Equity-curve en trend: ${pass}/${pass + fail} ===`); await b.close(); process.exit(fail ? 1 : 0);
})();
