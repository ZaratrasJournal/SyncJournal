// Tendencies → Plan (stap 3): vijf sneden over gekoppelde trades, met n, drempels en observatiezin.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const APP = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');
const dk = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
// 40 gekoppelde trades over 20 dagen: A-setups winnen, C-setups verliezen, "mist rr" verliest
function fixture(nLinked) {
  const recs = [], trades = [], plans = {}; let id = 1;
  for (let i = 0; i < nLinked; i++) {
    const day = dk(new Date(Date.now() - (Math.floor(i / 2) + 1) * 864e5));
    const setup = i % 4 === 0 ? 'C' : (i % 4 === 1 ? 'B' : 'A');
    const miss = i % 5 === 0 ? ['rr'] : [];
    const exec = miss.length ? 'HALF' : 'VOL';
    const r = setup === 'A' ? 1.2 : setup === 'B' ? 0.4 : -0.9;
    const ts = new Date(day + 'T10:' + String(10 + (i % 2) * 20).padStart(2, '0') + ':00');
    recs.push({ id: 100 + i, ts: ts.toISOString(), day, sym: 'BTC', dir: 'Short', setup, exec, risk: 1, taken: true, checks: {}, missing: miss, noTrade: [], r: null, notes: '' });
    trades.push({ id: id++, exchange: 'okx', status: 'closed', pair: 'BTC/USDC', dir: 'short', entry: 100, exit: 100 - r, size: '1000', pnl: r * 10, r, fees: 0, date: day, time: '10:15', openTime: String(+ts + 5 * 60000), closeTime: String(+ts + 60 * 60000), tps: [], tags: [], notes: '', planRef: String(100 + i) });
    if (!plans['dag-' + day]) plans['dag-' + day] = { id: 'dag-' + day, type: 'dag', key: day, checks: {}, images: [], links: [], scenarios: [], close: { scenario: 0, gevolgd: Math.floor(i / 2) % 3 === 0 ? 'ja' : (Math.floor(i / 2) % 3 === 1 ? 'deels' : 'nee'), les: '', r: null, saved: true, savedAt: day + 'T17:00:00.000Z' } };
  }
  // twee trades zonder poort
  trades.push({ id: id++, exchange: 'okx', status: 'closed', pair: 'ETH/USDC', dir: 'long', entry: 100, exit: 98, size: '1000', pnl: -20, r: -2, fees: 0, date: dk(new Date(Date.now() - 864e5)), time: '15:00', openTime: String(Date.now() - 864e5), closeTime: String(Date.now() - 864e5 + 36e5), tps: [], tags: [], notes: '' });
  trades.push({ id: id++, exchange: 'okx', status: 'closed', pair: 'ETH/USDC', dir: 'long', entry: 100, exit: 99, size: '1000', pnl: -10, r: -1, fees: 0, date: dk(new Date(Date.now() - 2 * 864e5)), time: '15:00', openTime: String(Date.now() - 2 * 864e5), closeTime: String(Date.now() - 2 * 864e5 + 36e5), tps: [], tags: [], notes: '', planRef: 'none' });
  return { recs, trades, plans };
}

(async () => {
  const b = await chromium.launch(); const errs = [];
  async function open(fx) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
    await p.route('**/*', r => /^https?:/.test(r.request().url()) ? r.abort() : r.continue());
    await p.addInitScript(f => { localStorage.setItem('sj_welcomed', 'true'); if (f) { localStorage.setItem('tp2:trades', JSON.stringify(f.recs)); localStorage.setItem('tp2:plans', JSON.stringify(f.plans)); localStorage.setItem('tp2:cfg', JSON.stringify({ matchMin: 45, pt: [{ k: 'rr', t: 'Minimaal 2R naar TP1' }] })); } }, fx);
    await p.goto(APP, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1200);
    if (fx) await p.evaluate(ts => { T = ts; TRASH = []; persist(); clearGFilter(); }, fx.trades);
    await p.evaluate(() => { STATE.tend = 'plan'; go('tendencies'); });
    return { ctx, p, txt: () => p.evaluate(() => document.getElementById('main').innerText.replace(/\s+/g, ' ')) };
  }

  console.log('--- 40 gekoppelde trades ---');
  {
    const { ctx, p, txt } = await open(fixture(40)); const t = await txt();
    ok('subtab "Plan" bestaat en staat aan', await p.evaluate(() => { const b = [...document.querySelectorAll('#tendTabs button')].find(x => x.dataset.t === 'plan'); return b && b.classList.contains('on'); }));
    ok('koptelling: 40 gekoppeld · 2 zonder poort', /40 gekoppeld · 2 zonder poort/.test(t), t.slice(0, 200));
    ok('geen drempelmelding bij 40', !/Nog te weinig data/.test(t));
    ok('uitvoering: volle size en halve size met n=', /Volle size/.test(t) && /Halve size/.test(t) && /n=32/.test(t) && /n=8/.test(t), t.slice(0, 400));
    ok('setup-type: A/B/C met n=20/10/10 en gem. R', /A-setup/.test(t) && /n=20/.test(t) && /B-setup/.test(t) && /C-setup/.test(t) && /\+1,20R/.test(t) && /−0,90R|-0,90R/.test(t), t.slice(0, 600));
    ok('gemiste checks: "Minimaal 2R naar TP1" met n=8', /Minimaal 2R naar TP1/.test(t) && /n=8/.test(t));
    ok('met/zonder poort: 40 vs 2', /Met poort-beoordeling/.test(t) && /Zonder poort/.test(t) && /n=2/.test(t));
    ok('plan gevolgd: ja / deels / nee als dagen', /Plan gevolgd/.test(t) && /Deels gevolgd/.test(t) && /Niet gevolgd/.test(t));
    const obs = await p.evaluate(() => [...document.querySelectorAll('.plan-obs')].map(x => x.innerText.replace(/\s+/g, ' ')));
    ok('observatiezin bij setup-type (A vs C, ≥10 elk, verschil 2,1R)', obs.some(o => /C-setup/.test(o) && /A-setup/.test(o) && /Verschil \+2,10R/.test(o)), JSON.stringify(obs));
    ok('géén observatie bij "met/zonder poort" (zonder = 2 trades < 10)', !obs.some(o => /Zonder poort/.test(o)), JSON.stringify(obs));
    ok('observatie is een observatie, geen bevel', !obs.some(o => /schrap|stop met|moet je/i.test(o)));
    await p.screenshot({ path: 'tests/screenshots/tend-plan.png', fullPage: true });
    { const ps = await p.$$('#main .panel'); await ps[ps.length - 1].screenshot({ path: 'tests/screenshots/tend-plan-laatste.png' }); }
    await ctx.close();
  }

  console.log('--- 29 gekoppelde trades: drempel ---');
  {
    const { ctx, txt } = await open(fixture(29)); const t = await txt();
    ok('drempelmelding "29 van 30", geen observaties', /Nog te weinig data.*29 van 30/.test(t) && !/Verschil/.test(t), t.slice(0, 300));
    await ctx.close();
  }

  console.log('--- geen poort-records ---');
  {
    const { ctx, txt, p } = await open(null); await p.evaluate(() => { T = [{ id: 1, exchange: 'okx', status: 'closed', pair: 'BTC/USDC', dir: 'long', entry: 100, exit: 110, size: '1000', pnl: 100, r: 1, fees: 0, date: '2026-09-20', time: '10:00', openTime: '1790000000000', closeTime: '1790003600000', tps: [], tags: [], notes: '' }]; persist(); STATE.tend = 'plan'; go('tendencies'); });
    const t = await txt();
    ok('lege staat legt uit wat de tab doet en verwijst naar Plan', /nog geen poort-beoordelingen/i.test(t) && /Plan/.test(t), t.slice(0, 300));
    await p.evaluate(() => { STATE.tend = 'sessie'; render(); });
    ok('terug naar "Per sessie" werkt gewoon', await p.evaluate(() => /Win-rate per sessie/.test(document.getElementById('main').innerText)));
    await ctx.close();
  }
  ok('geen JS-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== Plan-tendencies: ${pass}/${pass + fail} ===`); await b.close(); process.exit(fail ? 1 : 0);
})();
