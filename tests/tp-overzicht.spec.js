// Het TP-overzicht rekende het niet-gehaalde deel van je positie altijd af op je stop-loss,
// ook bij een trade die al gesloten was. Een trade die op +1,48R sloot meldde daardoor
// "gerealiseerd +0,0R". Gevonden bij het bouwen van de demo (23-09-2026).
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const bij = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 1e-6 : tol);
const APP = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');

(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext(); const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
  p.on('dialog', d => d.accept());
  await p.route('**/*', r => /^https?:/.test(r.request().url()) ? r.abort() : r.continue());
  await p.addInitScript(() => localStorage.setItem('sj_welcomed', 'true'));
  await p.goto(APP, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1200);

  const meet = (o) => p.evaluate(x => {
    const t = { id: 1, exchange: 'manual', srcId: '', pair: 'XAU/USD', dir: 'long', status: 'closed', kind: 'live',
      date: '2026-09-15', time: '09:30', openTime: String(+new Date('2026-09-15T09:30')), closeTime: String(+new Date('2026-09-15T11:30')),
      entry: 2400, exit: 2430, stop: 2380, pnl: 59, r: 1.48, size: '4800', fees: 1,
      tps: [{ price: 2420, pct: 50, r: '', hit: true, ts: 0 }, { price: 2450, pct: 50, r: '', hit: false, ts: 0 }],
      tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [], ...x };
    T = [t];
    const s = tpStats(t);
    return { wExit: s.wExit, wR: s.wR == null ? null : +s.wR.toFixed(3), dicht: s.dicht,
      tekst: tpBreakdown(t).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() };
  }, o);

  console.log('─── Een gesloten trade rekent met zijn echte exit ───');
  {
    const r = await meet({});
    ok('het niet-gehaalde deel gaat op de exit (2.430), niet op de stop', bij(r.wExit, 2425), JSON.stringify(r.wExit));
    ok('en dat geeft +1,25R in plaats van 0R', bij(r.wR, 1.25), JSON.stringify(r.wR));
    ok('het woord "gerealiseerd" klopt nu ook', /gerealiseerd/.test(r.tekst) && r.dicht === true, r.tekst.slice(-70));
  }

  console.log('─── Een lopende positie blijft een aanname ───');
  {
    const r = await meet({ status: 'open', exit: 0 });
    ok('dan wordt er wél met de stop gerekend', bij(r.wExit, 2400), JSON.stringify(r.wExit));
    ok('en heet het geen "gerealiseerd" maar "bij je stop"', /bij je stop/.test(r.tekst) && !/gerealiseerd/.test(r.tekst), r.tekst.slice(-70));
    ok('met een zichtbare aantekening dat het een aanname is', /aanname/.test(r.tekst), r.tekst.slice(-90));
  }

  console.log('─── Randgevallen ───');
  {
    const alles = await meet({ tps: [{ price: 2420, pct: 50, r: '', hit: true, ts: 0 }, { price: 2430, pct: 50, r: '', hit: true, ts: 0 }] });
    ok('alle TP’s geraakt: de gewogen exit is die van de niveaus zelf', bij(alles.wExit, 2425), JSON.stringify(alles.wExit));
    const geen = await meet({ tps: [{ price: 2420, pct: 50, r: '', hit: false, ts: 0 }, { price: 2450, pct: 50, r: '', hit: false, ts: 0 }] });
    ok('geen enkele TP geraakt: alles op de exit', bij(geen.wExit, 2430), JSON.stringify(geen.wExit));
    const zonderStop = await meet({ stop: 0 });
    ok('zonder stop is er nog steeds een gewogen exit', bij(zonderStop.wExit, 2425), JSON.stringify(zonderStop.wExit));
    ok('maar geen R — zonder stop is er geen risico om tegen af te zetten', zonderStop.wR === null, JSON.stringify(zonderStop.wR));
    const short = await meet({ dir: 'short', entry: 2400, exit: 2370, stop: 2420, pnl: 59,
      tps: [{ price: 2380, pct: 50, r: '', hit: true, ts: 0 }, { price: 2350, pct: 50, r: '', hit: false, ts: 0 }] });
    ok('bij een short telt het de goede kant op', bij(short.wExit, 2375) && bij(short.wR, 1.25), JSON.stringify(short));
    const leeg = await p.evaluate(() => tpStats({ tps: [] }));
    ok('zonder TP-niveaus is er niets te melden', leeg === null);
  }

  ok('geen JS-errors totaal', errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));
  console.log(`\n=== TP-overzicht: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
