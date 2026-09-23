// Afronding van de Kraken-ombouw (23-09-2026). Twee dingen die overbleven:
//  1. de knop "Stappen ophalen" verscheen zodra een adapter fetchFills had — maar zonder
//     stepsForTrade kan backfillFills er niets mee, en antwoordde hij gegarandeerd
//     "niets op te halen". Dat raakte Kraken én MEXC.
//  2. Kraken's fetchFills was dood gewicht: de stappen komen uit de positie-gebeurtenissen,
//     en het fills-pad draagt volgens de docs geen realized_pnl.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const APP = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');

(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext(); const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
  p.on('dialog', d => d.accept());
  await p.route('**/*', r => /^https?:/.test(r.request().url()) ? r.abort() : r.continue());
  await p.addInitScript(() => localStorage.setItem('sj_welcomed', 'true'));
  await p.goto(APP, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1300);

  console.log('─── Welke adapters kunnen stappen ophalen ───');
  {
    const r = await p.evaluate(() => {
      const uit = {};
      Object.keys(ExchangeAPI).forEach(id => {
        const a = ExchangeAPI[id];
        uit[id] = { fills: typeof a.fetchFills === 'function', steps: typeof a.stepsForTrade === 'function' };
      });
      return uit;
    });
    ok('OKX en Blofin kunnen het allebei', r.okx.fills && r.okx.steps && r.blofin.fills && r.blofin.steps, JSON.stringify({ okx: r.okx, blofin: r.blofin }));
    ok('Kraken heeft geen fills-pad meer — de stappen komen uit de gebeurtenissen',
      !r.kraken.fills && !r.kraken.steps, JSON.stringify(r.kraken));
    ok('geen enkele adapter heeft nog fills zónder stappen-vertaling',
      Object.values(r).every(x => !x.fills || x.steps), JSON.stringify(Object.entries(r).filter(([, x]) => x.fills && !x.steps)));
  }

  console.log('─── De knop verschijnt alleen waar hij ook werkt ───');
  {
    const r = await p.evaluate(() => {
      const mk = (ex, srcId) => ({ id: 1, exchange: ex, srcId, pair: 'BTC/USD', dir: 'long', status: 'closed', kind: 'live',
        date: '2026-09-20', time: '10:00', openTime: String(+new Date('2026-09-20T10:00')), closeTime: String(+new Date('2026-09-20T12:00')),
        entry: 80000, exit: 81000, pnl: 10, r: 1, size: '100', qtyAsset: 0.001, fees: 0.1,
        tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] });
      const kijk = (ex, srcId) => { T = [mk(ex, srcId)]; openForm(1);
        const el = document.querySelector('.exwrap');
        const r = { blok: !!el, knop: !!(el && el.querySelector('button')), tekst: el ? el.innerText.replace(/\s+/g, ' ').trim().slice(0, 60) : '' };
        closeForm(); return r; };
      CONNS = { okx: { connected: true, apiKey: 'k', apiSecret: 's', passphrase: 'p' },
        kraken: { connected: true, apiKey: 'k', apiSecret: 's' },
        mexc: { connected: true, apiKey: 'k', apiSecret: 's' },
        blofin: { connected: true, apiKey: 'k', apiSecret: 's', passphrase: 'p' } };
      return { okx: kijk('okx', 'okx_1_2'), kraken: kijk('kraken', 'kraken_pos_PF_XBTUSD_1'),
        mexc: kijk('mexc', 'mexc_1_2'), blofin: kijk('blofin', 'blofin_1_2') };
    });
    ok('OKX en Blofin tonen hem, want daar valt iets te halen', r.okx.knop && r.blofin.knop, JSON.stringify({ o: r.okx, b: r.blofin }));
    ok('Kraken niet meer — die krijgt zijn stappen via de sync', !r.kraken.blok, JSON.stringify(r.kraken));
    ok('MEXC ook niet, die had hem alleen maar in naam', !r.mexc.blok, JSON.stringify(r.mexc));
  }

  console.log('─── Een Kraken-levensloop toont gewoon zijn stappen ───');
  {
    const r = await p.evaluate(() => {
      const nu = Date.now();
      const ev = (i, oud, nieuw, wissel, px, pnl) => ({ uid: 'u' + i, timestamp: nu - (3 - i) * 36e5, event: { PositionUpdate: {
        tradeable: 'PF_XBTUSD', oldPosition: String(oud), newPosition: String(nieuw), newAverageEntryPrice: '80000',
        fillTime: nu - (3 - i) * 36e5, fee: '0.2', realizedPnL: String(pnl), realizedFunding: '0', positionChange: wissel,
        executionUid: 'e' + i, executionPrice: String(px), executionSize: String(Math.abs(nieuw - oud)),
        tradeType: 'userExecution', timestamp: nu - (3 - i) * 36e5, updateReason: 'trade' } } });
      const trades = ExchangeAPI.kraken._krLevenslopen([
        ev(0, 0, 0.01, 'open', 80000, 0), ev(1, 0.01, 0.004, 'decrease', 80700, 4), ev(2, 0.004, 0, 'close', 80500, 3)]);
      T = [{ ...sjFromTj(trades[0]), id: 1 }];
      openForm(1);
      const el = document.querySelector('.exwrap');
      const uit = { tabel: !!(el && el.querySelector('table')),
        rijen: el && el.querySelector('table') ? el.querySelectorAll('tbody tr:not(.exday):not(.exnew)').length : 0,
        knop: !!(el && el.querySelector('button')), afgeleid: !!el && /afgeleid/.test(el.innerText) };
      closeForm(); return uit;
    });
    ok('drie stappen in de tabel', r.tabel && r.rijen === 3, JSON.stringify(r));
    ok('geen knop en geen markering "afgeleid" — dit komt van Kraken zelf', !r.knop && !r.afgeleid, JSON.stringify(r));
  }

  ok('geen JS-errors totaal', errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));
  console.log(`\n=== Kraken-afronding: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
