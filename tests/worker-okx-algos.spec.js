// Worker v24 (docs/worker-v24.js): OKX action 'algos' (Denny 24-10-2026, plan docs/plan-okx-stoploss-2026-10-24.md).
// Runs the complete file with a fake internet, like worker-executions.spec.js: the OKX paths on eea.okx.com, the
// OKX signature, one call per ordType group × state, paging with `after`, the page cap, the entry-order filter,
// errors per call under _okxDebug, and that everything else is byte-for-byte v23.
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
let pass = 0, fail = 0;
const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const SLEUTEL = 'okx-key', GEHEIM = 'okx-geheim-voor-de-test', PASS = 'okx-pass';
let verzoeken = [], antwoord = () => ({ code: '0', data: [] });
const nepFetch = async (url, init) => {
  verzoeken.push({ url: String(url), headers: (init && init.headers) || {} });
  return new Response(JSON.stringify(antwoord(new URL(String(url)))), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
const v24Pad = path.resolve(__dirname, '../docs/worker-v24.js');
if (!fs.existsSync(v24Pad)) { console.log('  ✗ docs/worker-v24.js bestaat niet'); process.exit(1); }
const v24 = fs.readFileSync(v24Pad, 'utf8');
const v23 = fs.readFileSync(path.resolve(__dirname, '../docs/worker-v23.js'), 'utf8');
const { worker } = new Function('fetch', v24.replace(/^export default/m, 'const __worker =') + '\nreturn { worker: __worker };')(nepFetch);
const vraag = async (body) => {
  const res = await worker.fetch(new Request('https://morani-proxy.example/', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ exchange: 'okx', apiKey: SLEUTEL, apiSecret: GEHEIM, passphrase: PASS, ...body }) }), {}, { waitUntil() {} });
  return { status: res.status, data: await res.json() };
};
const SINCE = Date.parse('2026-08-01T00:00:00Z');
const algo = (i, cTime) => ({ algoId: 'a' + i, instId: 'BTC-USDT-SWAP', ordType: 'conditional', side: 'sell', posSide: 'long', slTriggerPx: '79000', cTime: String(cTime || SINCE + 1000 * i), uTime: String(SINCE + 1000 * i), ordIdList: ['o' + i] });
const pad = u => u.pathname + u.search;

(async () => {
  console.log('─── Eén ronde: welke verzoeken ───');
  verzoeken = []; antwoord = () => ({ code: '0', data: [] });
  let r = await vraag({ action: 'algos', startTime: SINCE });
  const urls = verzoeken.map(v => new URL(v.url));
  ok('alles op eea.okx.com', urls.every(u => u.origin === 'https://eea.okx.com'), [...new Set(urls.map(u => u.origin))].join());
  const hist = urls.filter(u => u.pathname === '/api/v5/trade/orders-algo-history').map(u => u.searchParams.get('ordType') + '|' + u.searchParams.get('state'));
  ok('algo-historie: conditional,oco en move_order_stop × effective, canceled, order_failed (6 verzoeken)',
    hist.length === 6 && ['conditional,oco', 'move_order_stop'].every(t => ['effective', 'canceled', 'order_failed'].every(s => hist.includes(t + '|' + s))), JSON.stringify(hist));
  const pend = urls.filter(u => u.pathname === '/api/v5/trade/orders-algo-pending').map(u => u.searchParams.get('ordType'));
  ok('openstaand: conditional,oco en move_order_stop', pend.length === 2 && pend.includes('conditional,oco') && pend.includes('move_order_stop'), JSON.stringify(pend));
  const ord = urls.filter(u => u.pathname === '/api/v5/trade/orders-history').map(u => u.searchParams.get('instType'));
  ok('instap-orders: orders-history voor SWAP en FUTURES', ord.length === 2 && ord.includes('SWAP') && ord.includes('FUTURES'), JSON.stringify(ord));
  ok('antwoord: source algos, met history, pending en orders', r.status === 200 && r.data.source === 'algos' && Array.isArray(r.data.history) && Array.isArray(r.data.pending) && Array.isArray(r.data.orders), JSON.stringify(r.data).slice(0, 200));
  const h = verzoeken[0].headers, u0 = new URL(verzoeken[0].url);
  const verwacht = crypto.createHmac('sha256', GEHEIM).update(h['OK-ACCESS-TIMESTAMP'] + 'GET' + pad(u0)).digest('base64');
  ok('handtekening volgens OKX (base64 HMAC-SHA256 van ts + GET + pad met query)', h['OK-ACCESS-KEY'] === SLEUTEL && h['OK-ACCESS-PASSPHRASE'] === PASS && h['OK-ACCESS-SIGN'] === verwacht);

  console.log('─── Pagineren ───');
  verzoeken = []; antwoord = u => {
    if (u.pathname !== '/api/v5/trade/orders-algo-history' || u.searchParams.get('ordType') !== 'conditional,oco' || u.searchParams.get('state') !== 'effective') return { code: '0', data: [] };
    return u.searchParams.get('after') ? { code: '0', data: [algo(200), algo(201)] } : { code: '0', data: Array.from({ length: 100 }, (_, i) => algo(i)) };
  };
  r = await vraag({ action: 'algos', startTime: SINCE });
  const tweede = verzoeken.map(v => new URL(v.url)).filter(u => u.searchParams.get('state') === 'effective' && u.searchParams.get('ordType') === 'conditional,oco');
  ok('volle pagina (100): volgende met after=<laatste algoId>', tweede.length === 2 && tweede[1].searchParams.get('after') === 'a99' && r.data.history.length === 102, JSON.stringify(tweede.map(pad)));
  verzoeken = []; antwoord = u => (u.pathname === '/api/v5/trade/orders-algo-history' && u.searchParams.get('state') === 'canceled' && u.searchParams.get('ordType') === 'conditional,oco')
    ? { code: '0', data: Array.from({ length: 100 }, (_, i) => algo(i, SINCE - 864e5)) } : { code: '0', data: [] };
  r = await vraag({ action: 'algos', startTime: SINCE });
  ok('oudste cTime vóór startTime: niet verder terug', verzoeken.filter(v => /state=canceled/.test(v.url) && /conditional/.test(v.url)).length === 1, String(verzoeken.length));
  verzoeken = []; antwoord = u => (u.pathname === '/api/v5/trade/orders-algo-history' && u.searchParams.get('state') === 'effective' && u.searchParams.get('ordType') === 'move_order_stop')
    ? { code: '0', data: Array.from({ length: 100 }, (_, i) => algo(i + 1000 * verzoeken.length)) } : { code: '0', data: [] };
  r = await vraag({ action: 'algos', startTime: SINCE });
  ok('hooguit 5 pagina\'s per combinatie, en dan afgekapt=true', verzoeken.filter(v => /move_order_stop/.test(v.url) && /state=effective/.test(v.url)).length === 5 && r.data._okxDebug.afgekapt === true,
    String(verzoeken.filter(v => /move_order_stop/.test(v.url) && /state=effective/.test(v.url)).length));

  console.log('─── Instap-orders ───');
  verzoeken = []; antwoord = u => u.pathname === '/api/v5/trade/orders-history'
    ? { code: '0', data: [{ ordId: '1', attachAlgoOrds: [{ slTriggerPx: '79000' }], cTime: String(SINCE + 5) }, { ordId: '2', attachAlgoOrds: [], algoId: '', cTime: String(SINCE + 6) }, { ordId: '3', attachAlgoOrds: [], algoId: 'a7', source: '7', cTime: String(SINCE + 7) }] } : { code: '0', data: [] };
  r = await vraag({ action: 'algos', startTime: SINCE });
  ok('alleen orders met een plan (attachAlgoOrds) of uit een algo (algoId)', r.data.orders.map(o => o.ordId).sort().join() === '1,1,3,3', JSON.stringify(r.data.orders.map(o => o.ordId)));

  console.log('─── Fouten ───');
  verzoeken = []; antwoord = u => (u.pathname === '/api/v5/trade/orders-algo-pending' && u.searchParams.get('ordType') === 'move_order_stop')
    ? { code: '50011', msg: 'Too Many Requests', data: [] } : (u.pathname === '/api/v5/trade/orders-algo-pending' ? { code: '0', data: [algo(1)] } : { code: '0', data: [] });
  r = await vraag({ action: 'algos', startTime: SINCE });
  ok('een fout in één verzoek: de rest komt door, de fout staat onder _okxDebug.errors', r.status === 200 && r.data.pending.length === 1 && r.data._okxDebug.errors.some(e => /Too Many Requests/.test(e)) && !r.data.error, JSON.stringify(r.data).slice(0, 300));

  console.log('─── De rest is v23 ───');
  const lf = s => s.replace(/\r\n/g, '\n');
  const zonderKop = s => lf(s).slice(lf(s).indexOf('const ALLOWED_ORIGIN'));
  const blok = /\n  \/\/ v24: OKX algo orders[\s\S]*?\n  }\n(?=  \/\/ trades: OKX EEA)/;
  ok('alle andere code byte-voor-byte gelijk aan v23', zonderKop(v24).replace(blok, '\n') === zonderKop(v23));
  verzoeken = []; antwoord = () => ({ code: '0', data: [] });
  r = await vraag({ action: 'fills', startTime: SINCE });
  ok('actie fills werkt zoals in v23', Array.isArray(r.data.fills) && verzoeken.every(v => /fills-history/.test(v.url)));

  console.log(`\n=== Worker v24 OKX algos: ${pass}/${pass + fail} ===`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  ✗ crash: ' + String(e).split('\n')[0]); process.exit(1); });
