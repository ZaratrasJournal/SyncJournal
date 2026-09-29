// Prijzen zonder rekenruis: 83228, niet 83227.99999999999.
//
// Denny 29-09-2026: het formulier van een gesloten Hyperliquid-trade toonde entry
// 83227.99999999999. Een gemiddelde uit fills (som van prijs × aantal, gedeeld door het totaal)
// levert in binaire kommagetallen zulke ruis op. De tabel rondt af; het formulier niet.
// Nu worden prijzen opgepoetst bij elke opslag (dekt sync, formulier en import) en bij het laden.
const { chromium } = require('playwright');
const path = require('path');

let pass = 0, fail = 0;
const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const RUIS = { id: 'hl', pair: 'BTC/USDC', dir: 'long', exchange: 'hyperliquid', kind: 'live', status: 'closed',
  date: '2026-09-28', time: '17:40', size: '707.44', pnl: 0.4508, fees: 0.6372,
  entry: 83227.99999999999, exit: 83356.00000000001, stop: 82500,
  tps: [{ price: 83300.00000000001, pct: 100, hit: true, ts: 0 }] };
const MEME = { id: 'meme', pair: 'PEPE/USDT', dir: 'long', exchange: 'okx', kind: 'live', status: 'closed',
  date: '2026-09-27', time: '10:00', size: '100', pnl: 1, entry: 0.000012345678, exit: 0.0000131, stop: 0.0000119 };
const ECHT = { id: 'echt', pair: 'ETH/USDC', dir: 'long', exchange: 'okx', kind: 'live', status: 'closed',
  date: '2026-09-26', time: '10:00', size: '100', pnl: 1, entry: 1234.56789, exit: 1300.1, stop: 1200.25 };

(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(600);
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(800);
  await p.evaluate(() => { try { hideWelcome(); } catch (e) {} });
  ok('boot zonder JS-fouten', errs.length === 0, errs[0]);

  console.log('─── Bij opslaan (dekt sync, formulier en import) ───');
  const na = await p.evaluate(rijen => { T = rijen.map(x => ({ ...EMPTY_TRADE, ...JSON.parse(JSON.stringify(x)) })); persist();
    const f = id => T.find(t => t.id === id); return { hl: f('hl'), meme: f('meme'), echt: f('echt') }; }, [RUIS, MEME, ECHT]);
  ok('entry 83227.99999999999 wordt 83228', na.hl.entry === 83228, String(na.hl.entry));
  ok('exit 83356.00000000001 wordt 83356', na.hl.exit === 83356, String(na.hl.exit));
  ok('TP-prijs wordt 83300', na.hl.tps[0].price === 83300, String(na.hl.tps[0].price));
  ok('stop die al schoon was, blijft gelijk', na.hl.stop === 82500, String(na.hl.stop));
  ok('memecoin-prijs 0.000012345678 blijft precies', na.meme.entry === 0.000012345678, String(na.meme.entry));
  ok('echte decimalen (1234.56789) blijven staan', na.echt.entry === 1234.56789 && na.echt.stop === 1200.25, `${na.echt.entry} / ${na.echt.stop}`);
  ok('P&L en fees worden niet aangeraakt', na.hl.pnl === 0.4508 && na.hl.fees === 0.6372, `${na.hl.pnl} / ${na.hl.fees}`);

  console.log('─── Bij laden: een al opgeslagen trade met ruis wordt schoon ───');
  await p.evaluate(async r => { await IDB.set('trades', [JSON.parse(JSON.stringify(r))]); }, RUIS);   // direct, zonder persist
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1000);
  const geladen = await p.evaluate(() => { try { hideWelcome(); } catch (e) {} const t = T.find(x => x.id === 'hl') || T[0]; return { entry: t.entry, exit: t.exit }; });
  ok('na herladen staat entry op 83228', geladen.entry === 83228, String(geladen.entry));
  ok('en exit op 83356', geladen.exit === 83356, String(geladen.exit));

  console.log('─── Wat je in het formulier ziet ───');
  const veld = await p.evaluate(() => { const t = T.find(x => x.id === 'hl') || T[0]; openForm(t.id); const v = (document.getElementById('f_entry') || {}).value; closeForm(); return v; });
  ok('het entry-veld toont 83228', veld === '83228', String(veld));

  ok('geen nieuwe JS-fouten', errs.length === 0, errs[0]);
  console.log(`\n=== Afronding prijzen: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
