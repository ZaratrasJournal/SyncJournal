// Exchange-isolatie (CLAUDE.md, "Exchange-architectuur"): elke exchange heeft een eigen adapter,
// en de partial-detectie van de ene exchange raakt nooit de trades van een andere. Een fix voor
// MEXC mag Blofin niet veranderen, en andersom.
//
// SyncJournal kent twee modellen: siblings (MEXC, oud Kraken-pad: losse gesloten rijen naast een
// open rij) en levensloop (Blofin, OKX, Hyperliquid: één rij per positie, detectPartials = null).
//
// Herschreven in T2 (24-10-2026): de oude spec testte de adapters van work/tradejournal.html.
const { chromium } = require('playwright');
const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const ms = s => String(Date.parse(s));
// Per exchange hetzelfde patroon: een open BTC-long op entry 100 en een gesloten rij op dezelfde entry (+5)
const paar = (ex, base) => [
  { id: base, exchange: ex, status: 'open', kind: 'live', pair: 'BTC/USDT', dir: 'long', entry: 100, exit: '', size: '1000', pnl: '', date: '2026-10-01', time: '10:00', openTime: ms('2026-10-01T10:00:00Z'), srcId: ex + '_open_' + base },
  { id: base + 1, exchange: ex, status: 'closed', kind: 'live', pair: 'BTC/USDT', dir: 'long', entry: 100, exit: 105, size: '500', pnl: 5, date: '2026-10-01', time: '11:00', openTime: ms('2026-10-01T10:00:00Z'), closeTime: ms('2026-10-01T11:00:00Z'), srcId: ex + '_close_' + base },
];
const SET = [...paar('mexc', 10), ...paar('blofin', 20), ...paar('hyperliquid', 30), ...paar('okx', 40), ...paar('kraken', 50)];

(async () => {
  const b = await chromium.launch(); const { p, errs } = await H.openJournal(b);

  console.log('─── Adapters ───');
  const ad = await p.evaluate(() => {
    const ids = [...EXCHANGES.map(e => e.id), 'ftmo'];
    const objs = ids.map(id => ExchangeAPI[id]);
    return { ids, allemaal: objs.every(o => o && typeof o === 'object' && o.name), uniek: new Set(objs).size === ids.length,
      dp: Object.fromEntries(ids.map(id => [id, ExchangeAPI[id].detectPartials === null ? 'null' : typeof ExchangeAPI[id].detectPartials])) };
  });
  ok('elke exchange (+ FTMO) heeft een eigen adapter-object met naam', ad.allemaal && ad.uniek, JSON.stringify(ad.ids));
  ok('levensloop-model: Blofin, OKX, Hyperliquid en FTMO hebben géén sibling-detectie', ['blofin', 'okx', 'hyperliquid', 'ftmo'].every(x => ad.dp[x] === 'null'), JSON.stringify(ad.dp));
  ok('siblings-model: MEXC en Kraken hebben er wel een', ad.dp.mexc === 'function' && ad.dp.kraken === 'function', JSON.stringify(ad.dp));

  console.log('─── Detectie per exchange ───');
  const draai = ex => p.evaluate(async ({ set, ex }) => {
    T = set.map(t => ({ ...EMPTY_TRADE, ...t })); persist();
    const voor = JSON.stringify(T.filter(t => t.exchange !== ex));
    const eigenVoor = JSON.stringify(T.filter(t => t.exchange === ex));
    runPartialDetect(ex);
    return { andersGelijk: JSON.stringify(T.filter(t => t.exchange !== ex)) === voor,
      eigen: T.filter(t => t.exchange === ex).map(t => t.status + (t.realizedPnl !== '' && t.realizedPnl != null ? ':' + t.realizedPnl : '')).join(','),
      eigenGelijk: JSON.stringify(T.filter(t => t.exchange === ex)) === eigenVoor };
  }, { set: SET, ex });

  const mx = await draai('mexc');
  ok('MEXC: de open rij wordt partial met het geboekte deel (+5)', /partial:5/.test(mx.eigen), JSON.stringify(mx));
  ok('MEXC-detectie laat Blofin, OKX, Hyperliquid en Kraken ongemoeid', mx.andersGelijk);
  const kr = await draai('kraken');
  ok('Kraken (oud pad): de open rij wordt partial', /partial/.test(kr.eigen), JSON.stringify(kr));
  ok('Kraken-detectie laat de andere exchanges ongemoeid', kr.andersGelijk);
  for (const ex of ['blofin', 'okx', 'hyperliquid']) {
    const r = await draai(ex);
    ok(`${ex}: geen sibling-detectie, de rijen blijven zoals ze binnenkwamen`, r.eigenGelijk && r.andersGelijk, JSON.stringify(r));
  }
  const krPos = await p.evaluate(async () => {
    T = [{ ...EMPTY_TRADE, id: 1, srcId: 'kraken_pos_PF_XBTUSD_1759312800000', exchange: 'kraken', status: 'partial', kind: 'live', pair: 'BTC/USD', dir: 'long', entry: 100, size: '1000', pnl: '', realizedPnl: 7, date: '2026-10-01', time: '10:00' },
      { ...EMPTY_TRADE, id: 99, exchange: 'kraken', status: 'closed', kind: 'live', pair: 'BTC/USD', dir: 'long', entry: 100, exit: 103, size: '300', pnl: 3, date: '2026-10-01', time: '11:00' }];
    persist(); const voor = JSON.stringify(T[0]); runPartialDetect('kraken'); const na = JSON.stringify(T[0]); return na === voor ? true : voor + ' || ' + na;
  });
  ok('Kraken: een levensloop-rij (kraken_pos_) blijft buiten de sibling-detectie', krPos === true, krPos);

  ok('geen JS-fouten', errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n=== Exchange-isolatie: ${pass}/${pass + fail} ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
