// Kalender → Jaaroverzicht: de 53 weken passen in het paneel, zonder heen-en-weer scrollen.
//
// Denny 07-10-2026: "het jaaroverzicht schaalt niet mee bij lagere resolutie. Ik moet onderin van links
// naar rechts scrollen." De celgrootte rekende met de breedte van het hele scherm (2.2vw) en vergat de
// zijbalk en de marges: op alles onder ~2200 px breed werd het rooster breder dan zijn paneel.
// 1536 × 864 is een 1920-scherm op 125% Windows-schaal, de standaard op laptops.
const { chromium } = require('playwright');
const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const MAX_CEL = 30;   // gelijk aan de bovengrens in de CSS: op een groot scherm geen reuzentegels
const MIN_CEL = 10;   // daaronder is een dag niet meer aan te wijzen

(async () => {
  const b = await chromium.launch(); const { p, errs } = await H.openJournal(b);
  await p.evaluate(() => {
    T = [{ ...EMPTY_TRADE, id: 1, kind: 'live', status: 'closed', pair: 'BTC/USDC', date: '2026-09-30', time: '19:25', pnl: -9.93 },
         { ...EMPTY_TRADE, id: 2, kind: 'live', status: 'closed', pair: 'BTC/USDC', date: '2026-10-05', time: '06:16', pnl: 2.5 }];
    persist(); STATE.calMonth = '2026-10';
  });
  const meet = () => p.evaluate(() => {
    const w = document.querySelector('.yh-wrap'), c = document.querySelector('.yh-cells .yc');
    if (!w || !c) return { fout: 'geen jaaroverzicht' };
    const r = c.getBoundingClientRect();
    return { scroll: w.scrollWidth - w.clientWidth, paneel: w.clientWidth, cel: +r.width.toFixed(1), hoog: +r.height.toFixed(1) };
  });

  for (const [w, h, naam] of [[1280, 720, 'kleine laptop'], [1536, 864, '1920 op 125% schaal'], [1920, 1080, '1920 op 100%'], [2560, 1440, '2K-scherm']]) {
    console.log(`─── ${w} × ${h} (${naam}) ───`);
    await p.setViewportSize({ width: w, height: h });
    await p.evaluate(() => go('kalender')); await p.waitForTimeout(300);
    const m = await meet();
    ok('geen horizontale scrollbalk: het hele jaar past in het paneel', !m.fout && m.scroll <= 1, JSON.stringify(m));
    ok(`vierkante cellen tussen ${MIN_CEL} en ${MAX_CEL} px`, !m.fout && m.cel >= MIN_CEL && m.cel <= MAX_CEL + 0.5 && Math.abs(m.cel - m.hoog) <= 0.5, JSON.stringify(m));
  }

  console.log('─── Telefoon (390 breed) ───');
  await p.setViewportSize({ width: 390, height: 844 });
  await p.evaluate(() => go('kalender')); await p.waitForTimeout(300);
  const tel = await meet();
  // 53 weken passen niet leesbaar op een telefoon: daar mag het rooster scrollen, maar de cellen blijven aanwijsbaar
  ok('cellen blijven aanwijsbaar; het rooster scrollt binnen zijn paneel, de pagina niet', !tel.fout && tel.cel >= 8 && await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), JSON.stringify(tel));

  await p.setViewportSize({ width: 1536, height: 864 });
  for (const th of ['light', 'dark']) { await p.evaluate(th => { setTheme(th); go('kalender'); }, th); await p.waitForTimeout(300); }
  ok('geen JS-fouten', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== Jaaroverzicht past: ${pass}/${pass + fail} ===`); await b.close(); process.exit(fail ? 1 : 0);
})();
