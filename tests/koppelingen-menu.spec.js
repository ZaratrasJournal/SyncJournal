// Koppelingen met saldo onderin het menu (wens Denny 21-09-2026, naar Coin Market Manager).
// Harde eis uit zijn melding: geen koppeling = niets zichtbaar, en na het verwijderen van
// een API ook niets meer. Daarom is dit blokje strenger dan de rest van de app: het toont
// alleen échte, bestaande koppelingen — niet een exchange waar je alleen nog oude trades
// van hebt, want dan zou een losgekoppelde regel met 0 blijven staan.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const APP = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');

(async () => {
  const b = await chromium.launch(); const errs = [];

  async function open(seed) {
    const ctx = await b.newContext(); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
    p.on('dialog', d => d.accept());
    await p.route('**/*', r => /frankfurter/.test(r.request().url()) ? r.abort() : (/^https?:/.test(r.request().url()) ? r.abort() : r.continue()));
    await p.addInitScript(s => {
      localStorage.setItem('sj_welcomed', 'true');
      localStorage.setItem('sj_state', JSON.stringify({ currency: 'USD' }));
      if (s) { localStorage.setItem('sj_conns', JSON.stringify(s.conns || {})); localStorage.setItem('sj_exmeta', JSON.stringify(s.exmeta || {})); }
    }, seed || null);
    await p.goto(APP, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1300);
    return { ctx, p };
  }
  const blok = p => p.evaluate(() => {
    const el = document.getElementById('sideconn');
    return {
      verborgen: el.hidden,
      namen: [...el.querySelectorAll('.sc-n')].map(x => x.textContent),
      waarden: [...el.querySelectorAll('.sc-v')].map(x => x.textContent.trim()),
      gemaskeerd: [...el.querySelectorAll('.sc-v')].every(x => x.classList.contains('mask') || x.classList.contains('dim')),
      waarschuwing: el.querySelectorAll('.sc-w').length,
      beheren: !!el.querySelector('.sc-h button'),
      totaal: /Totaal/i.test(el.innerText),
    };
  });

  console.log('─── Geen koppeling, niets te zien ───');
  {
    const { ctx, p } = await open();
    ok('zonder koppelingen is het blokje er niet', (await blok(p)).verborgen);
    const metTrades = await p.evaluate(() => {
      T = [{ id: 1, exchange: 'okx', pair: 'BTC/USDC', dir: 'long', status: 'closed', kind: 'live', date: '2026-09-01', time: '10:00', entry: 1, exit: 2, size: '100', pnl: 5, r: 1, tps: [], tags: [], layers: [], emotions: [], mistakes: [], checks: [], screenshots: [], tvLinks: [] }];
      EXMAP.okx.val = 500; persist(); render();
      return document.getElementById('sideconn').hidden;
    });
    ok('oude trades zonder koppeling tellen niet mee', metTrades === true);
    await ctx.close();
  }

  console.log('─── Met koppelingen ───');
  {
    const nu = Date.now();
    const { ctx, p } = await open({
      conns: {
        hyperliquid: { connected: true, wallet: '0x1', hint: '7448', lastSync: nu - 9e5 },
        okx: { connected: true, apiKey: 'k', apiSecret: 's', passphrase: 'p', lastSync: nu - 3 * 36e5 },
        kraken: { connected: true, apiKey: 'k', apiSecret: 's' },
      },
      exmeta: { hyperliquid: { val: 1234.5 }, okx: { val: 42.83 }, kraken: { val: 0 } },
    });
    const r = await blok(p);
    ok('elke koppeling krijgt een regel', !r.verborgen && r.namen.length === 3, JSON.stringify(r.namen));
    ok('met het saldo erachter', /1\.235/.test(r.waarden.join()) && /43/.test(r.waarden.join()), JSON.stringify(r.waarden));
    ok('een koppeling die nog niet gesynct is toont een streepje met een stip',
      r.waarden.some(v => v === '—') && r.waarschuwing === 1, JSON.stringify({ w: r.waarden, stip: r.waarschuwing }));
    ok('bedragen zijn te verbergen met de privacyknop', r.gemaskeerd);
    ok('er staat een knop naar Instellingen', r.beheren);
    ok('het totaal wordt niet herhaald (dat staat al in de balanspil)', !r.totaal);

    const priv = await p.evaluate(() => { STATE.priv = true; document.body.classList.add('priv'); render();
      const v = document.querySelector('#sideconn .sc-v.mask'); return v ? getComputedStyle(v).filter : 'geen'; });
    ok('en dan zijn ze ook echt onleesbaar', priv !== 'none' && priv !== 'geen', JSON.stringify(priv));
    await ctx.close();
  }

  console.log('─── Loskoppelen laat niets achter ───');
  {
    const { ctx, p } = await open({
      conns: { okx: { connected: true, apiKey: 'k', apiSecret: 's', passphrase: 'p', lastSync: Date.now() } },
      exmeta: { okx: { val: 42.83 } },
    });
    ok('eerst staat de koppeling er', (await blok(p)).namen.length === 1);
    await p.evaluate(() => { disconnectEx('okx'); });
    await p.waitForTimeout(300);
    const na = await blok(p);
    ok('na loskoppelen is het blokje helemaal weg', na.verborgen, JSON.stringify(na));
    await ctx.close();
  }

  console.log('─── Valuta ───');
  {
    const nu = Date.now();
    const ctx = await b.newContext(); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
    await p.route('**/*', route => {
      const u = route.request().url();
      if (/frankfurter/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ amount: 1, base: 'USD', date: '2026-09-21', rates: { EUR: 0.5 } }) });
      return /^https?:/.test(u) ? route.abort() : route.continue();
    });
    await p.addInitScript(t => {
      localStorage.setItem('sj_welcomed', 'true');
      localStorage.setItem('sj_state', JSON.stringify({ currency: 'EUR' }));
      localStorage.setItem('sj_conns', JSON.stringify({ okx: { connected: true, apiKey: 'k', apiSecret: 's', passphrase: 'p', lastSync: t } }));
      localStorage.setItem('sj_exmeta', JSON.stringify({ okx: { val: 100 } }));
    }, nu);
    await p.goto(APP, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1600);
    const r = await p.evaluate(async () => { await fxSync(); render(); return document.querySelector('#sideconn .sc-v').textContent.trim(); });
    ok('het saldo wordt omgerekend naar de weergave-valuta ($100 bij koers 0,5 = € 50)', /€/.test(r) && /50/.test(r), JSON.stringify(r));
    await ctx.close();
  }

  ok('geen JS-errors totaal', errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));
  console.log(`\n=== Koppelingen in het menu: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
