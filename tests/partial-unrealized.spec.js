// A partly closed trade also shows what the rest is doing (Denny 24-10-2026): "mijn partial TP laat na de eerste TP
// niet meer de live trade winst zien". The booked part stays the main number (it counts in your totals); under it,
// small: "deels dicht · ~+$ 8,12 unrealized" - the open rest at the last sync, counted nowhere.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/'), { waitUntil: 'networkidle' });
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  await p.evaluate(() => { try { hideWelcome(); } catch (e) {}
    STATE.currency = 'USD'; persistState();
    const basis = { exchange: 'hyperliquid', kind: 'live', pair: 'BTC/USDC', dir: 'short', entry: 81591.615, size: '603.78', tags: [], layers: [], tps: [] };
    T = [{ ...basis, id: 1, date: '2026-10-23', time: '14:08', status: 'partial', pnl: 0, realizedPnl: 3.58, unrealizedPnl: 8.12, srcId: 'hyperliquid_1' },
      { ...basis, id: 2, date: '2026-10-22', time: '10:00', status: 'partial', pnl: 0, realizedPnl: 2.1, srcId: 'hyperliquid_2' },
      { ...basis, id: 3, date: '2026-10-21', time: '10:00', status: 'open', pnl: 0, unrealizedPnl: 1.64, srcId: 'hyperliquid_open_BTC' }];
    persist(); clearGFilter(); setFilter('kind', 'alle'); });
  const cel = id => p.evaluate(id => { go('trades'); const tr = [...document.querySelectorAll('tbody tr.mrow')].find(r => (r.getAttribute('onclick') || '').includes('openForm(' + id + ')'));
    const td = tr && tr.querySelector('td[data-l="P&L"]'); const sp = td && td.querySelector('[title]');
    return td ? { tekst: td.textContent.replace(/\s+/g, ' ').trim(), titel: sp ? sp.title : '', mask: td.querySelectorAll('.mask').length } : null; }, id);

  let c = await cel(1);
  ok('partial: geboekt +$ 3,58 als hoofdgetal', c && /^\+\$ 3,58/.test(c.tekst), JSON.stringify(c));
  ok('eronder klein: "deels dicht", en op een eigen regel ~+$ 8,12 unrealized', c && /deels dicht\s*~\+\$ 8,12 unrealized/.test(c.tekst), JSON.stringify(c));
  ok('bij de muis: geboekt, unrealized en samen ~+$ 11,70', c && /geboekt \+\$ 3,58/.test(c.titel) && /unrealized ~\+\$ 8,12/.test(c.titel) && /samen ~\+\$ 11,70/.test(c.titel), JSON.stringify(c));
  ok('beide bedragen verborgen in de privacy-stand (mask)', c && c.mask >= 2, JSON.stringify(c));
  c = await cel(2);
  ok('partial zonder unrealized: alleen "deels dicht", zoals het was', c && /\+\$ 2,10\s*deels dicht$/.test(c.tekst), JSON.stringify(c));
  c = await cel(3);
  ok('open trade: ongewijzigd ~+$ 1,64', c && c.tekst === '~+$ 1,64', JSON.stringify(c));
  const eur = await p.evaluate(() => { FX.latest = 0.9; FX.latestDate = '2026-10-24'; FX.rates['2026-10-23'] = 0.9; FX.ts = Date.now(); fxSave(); STATE.currency = 'EUR'; persistState(); return true; });
  c = await cel(1);
  ok('in euro: ook het unrealized deel omgerekend (~+€ 7,31)', eur && c && /~\+€ 7,31 unrealized/.test(c.tekst), JSON.stringify(c));
  const tot = await p.evaluate(() => { STATE.currency = 'USD'; persistState(); return geboekt(T[0]); });
  ok('unrealized telt nergens mee: in je totalen alleen de geboekte 3,58', Math.abs(tot - 3.58) < 1e-9, String(tot));

  ok('geen JS-fouten', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log(`\n=== Partial unrealized: ${pass}/${pass + fail} ===`); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  ✗ crash: ' + String(e).split('\n')[0]); process.exit(1); });
