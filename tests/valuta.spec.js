// Valuta-omrekening (Denny 21-09-2026). Alles wat de app opslaat staat in dollars;
// de weergave rekent om met ECB-dagkoersen. Een trade rekent met de koers van zijn
// handelsdag, een saldo met de koers van nu.
// De koers-API wordt hier afgevangen: de test mag niet afhangen van het internet.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const APP = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
const LAATST = 0.90, OUD = 0.80;          // ronde koersen, zodat de som met het oog klopt
const VANDAAG = new Date().toISOString().slice(0, 10);

(async () => {
  const b = await chromium.launch(); const errs = [];

  async function open({ koersen = true } = {}) {
    const ctx = await b.newContext(); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
    p.on('dialog', d => d.accept());
    await p.route('**/*', route => {
      const u = route.request().url();
      if (/frankfurter/.test(u)) {
        if (!koersen) return route.abort();
        const body = /latest/.test(u)
          ? { amount: 1, base: 'USD', date: VANDAAG, rates: { EUR: LAATST } }
          : { amount: 1, base: 'USD', rates: { '2026-03-02': { EUR: OUD }, [VANDAAG]: { EUR: LAATST } } };
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      }
      return /^https?:/.test(u) ? route.abort() : route.continue();
    });
    await p.addInitScript(() => {
      localStorage.setItem('sj_welcomed', 'true');
      localStorage.setItem('sj_state', JSON.stringify({ currency: 'EUR', theme: 'light' }));
    });
    await p.goto(APP, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1500);
    return { ctx, p };
  }

  // twee gesloten trades: één oud (koers 0,80) en één van vandaag (koers 0,90)
  const zaai = (p) => p.evaluate(async ([vandaag]) => {
    const base = { time: '10:00', pair: 'BTC/USDT', dir: 'long', setup: '', session: 'London', status: 'closed', kind: 'live', exchange: 'blofin', entry: 60000, exit: 61000, stop: 59000, size: '1000', tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] };
    T = [{ ...base, id: 1, date: '2026-03-02', pnl: 100, r: 1 }, { ...base, id: 2, date: vandaag, pnl: 200, r: 2 }];
    EXMAP.blofin.val = 1000; persistExMeta();
    persist();
    await fxSync();   // koersreeks aanvullen tot aan de oudste trade
    render();
  }, [VANDAAG]);

  console.log('─── Koersen ophalen en toepassen ───');
  {
    const { ctx, p } = await open();
    await zaai(p); await p.waitForTimeout(400);
    // De koers staat niet op de trade maar wordt opgezocht in het koersenboek: de ECB-koers
    // van een dag verandert nooit meer, dus het resultaat ligt net zo vast — zonder dat de
    // app daarvoor naar de opslag hoeft te schrijven (dat verstoorde de tabblad-bewaking).
    const r = await p.evaluate(() => ({ ok: fxOk(), laatst: FX.latest, disp: dispCur(), sym: CURSYM(), fx1: fxFor(T[0].date), fx2: fxFor(T[1].date) }));
    ok('koers opgehaald en euro is beschikbaar', r.ok && r.disp === 'EUR' && r.sym === '€', JSON.stringify(r));
    ok('oude trade rekent met de koers van zijn eigen handelsdag', r.fx1 === OUD, JSON.stringify(r.fx1));
    ok('trade van vandaag rekent met de koers van vandaag', r.fx2 === LAATST, JSON.stringify(r.fx2));

    const som = await p.evaluate(() => ({ usd: T.reduce((s, t) => s + t.pnl, 0), eur: CLOSED.reduce((s, t) => s + t.pnl, 0) }));
    ok('opgeslagen blijft dollars, weergave is euro', som.usd === 300 && Math.abs(som.eur - (100 * OUD + 200 * LAATST)) < 1e-9, JSON.stringify(som));

    const bal = await p.evaluate(() => ({ usd: totalBalance(), toond: fxNow(totalBalance()) }));
    ok('saldo gebruikt de koers van nu, niet die van een trade', bal.usd === 1000 && Math.abs(bal.toond - 900) < 1e-9, JSON.stringify(bal));

    const prijs = await p.evaluate(() => ({ entry: CLOSED.find(t => t.id === 1).entry, r: CLOSED.find(t => t.id === 1).r }));
    ok('prijzen en R blijven onaangeroerd', prijs.entry === 60000 && prijs.r === 1, JSON.stringify(prijs));
    await ctx.close();
  }

  console.log('─── Wisselen tussen euro en dollar ───');
  {
    const { ctx, p } = await open();
    await zaai(p); await p.waitForTimeout(300);
    const heen = await p.evaluate(() => { setCurrency('USD'); return { sym: CURSYM(), net: CLOSED.reduce((s, t) => s + t.pnl, 0) }; });
    ok('dollar toont de onbewerkte bedragen', heen.sym === '$' && heen.net === 300, JSON.stringify(heen));
    const terug = await p.evaluate(() => { setCurrency('EUR'); return { sym: CURSYM(), net: CLOSED.reduce((s, t) => s + t.pnl, 0) }; });
    ok('en terug naar euro levert weer hetzelfde omgerekende bedrag', terug.sym === '€' && Math.abs(terug.net - 260) < 1e-9, JSON.stringify(terug));
    ok('het opgeslagen bedrag is door het wisselen niet veranderd', await p.evaluate(() => T.reduce((s, t) => s + t.pnl, 0) === 300));

    const ratio = await p.evaluate(() => { const a = aggOf(CLOSED); setCurrency('USD'); const b = aggOf(CLOSED); return { wrA: a.wr, wrB: b.wr, pfA: a.pf, pfB: b.pf }; });
    ok('win-rate en profit factor veranderen niet van valuta', ratio.wrA === ratio.wrB && Math.abs(ratio.pfA - ratio.pfB) < 1e-9, JSON.stringify(ratio));
    await ctx.close();
  }

  console.log('─── Geen internet: liever dollars dan verzonnen euro’s ───');
  {
    const { ctx, p } = await open({ koersen: false });
    await zaai(p); await p.waitForTimeout(400);
    const r = await p.evaluate(() => ({ ok: fxOk(), disp: dispCur(), sym: CURSYM(), keuze: STATE.currency, net: CLOSED.reduce((s, t) => s + t.pnl, 0) }));
    ok('zonder koers valt de weergave terug op dollars', !r.ok && r.disp === 'USD' && r.sym === '$', JSON.stringify(r));
    ok('je keuze voor euro blijft wel bewaard', r.keuze === 'EUR');
    ok('en er wordt niets omgerekend', r.net === 300, JSON.stringify(r.net));
    await ctx.close();
  }

  console.log('─── Weekend: de koers van de laatste beursdag ervoor ───');
  {
    const { ctx, p } = await open();
    const r = await p.evaluate(() => {
      FX.rates = { '2026-03-02': 0.8, '2026-03-06': 0.85 }; FX.latest = 0.9;
      return { zaterdag: fxFor('2026-03-07'), exact: fxFor('2026-03-06'), voorAlles: fxFor('2026-01-01') };
    });
    ok('een weekenddag pakt de laatste beursdag ervoor', r.zaterdag === 0.85, JSON.stringify(r.zaterdag));
    ok('een dag met eigen koers pakt die', r.exact === 0.85);
    ok('een datum vóór onze oudste koers pakt de oudste die we kennen', r.voorAlles === 0.8, JSON.stringify(r.voorAlles));
    await ctx.close();
  }

  ok('geen JS-errors totaal', errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));
  console.log(`\n=== Valuta-omrekening: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
