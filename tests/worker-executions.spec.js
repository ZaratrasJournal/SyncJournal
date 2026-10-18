// Worker v23 (docs/worker-v23.js): Kraken action 'executions' (Denny 18-10-2026).
// Runs the complete file here with a fake internet, like worker-accountlog.spec.js: the request
// (path, sort, count, since/before), the Kraken signature over the url-encoded query, paging via
// continuation_token, the page cap, errors, and that everything else is byte-for-byte v22.
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
let pass = 0, fail = 0;
const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const SLEUTEL = 'kraken-key-123', GEHEIM = Buffer.from('kraken-geheim-voor-de-test-0123456789').toString('base64');
let verzoeken = [], antwoord = () => ({ elements: [] });
const nepFetch = async (url, init) => {
  verzoeken.push({ url: String(url), headers: (init && init.headers) || {} });
  return new Response(JSON.stringify(antwoord(new URL(String(url)))), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
const v23Pad = path.resolve(__dirname, '../docs/worker-v23.js');
if (!fs.existsSync(v23Pad)) { console.log('  ✗ docs/worker-v23.js bestaat niet'); process.exit(1); }
const v23 = fs.readFileSync(v23Pad, 'utf8');
const v22 = fs.readFileSync(path.resolve(__dirname, '../docs/worker-v22.js'), 'utf8');
const { worker } = new Function('fetch', v23.replace(/^export default/m, 'const __worker =') + '\nreturn { worker: __worker };')(nepFetch);
const vraag = async (body) => {
  const res = await worker.fetch(new Request('https://morani-proxy.example/', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ exchange: 'kraken', apiKey: SLEUTEL, apiSecret: GEHEIM, ...body }) }), {}, { waitUntil() {} });
  return { status: res.status, data: await res.json() };
};
const el = i => ({ uid: 'u' + i, timestamp: 1790000000000 + i, event: { OrderTriggerPlaced: { order: { uid: 't' + i, tradeable: 'PF_XBTUSD', direction: 'Buy', quantity: '0.001', orderType: 'stop',
  triggerOptions: { triggerPrice: '82235', triggerSide: 'Above', triggerSignal: 'MarkPrice' }, reduceOnly: true, timestamp: 1790000000000 + i } } } });

(async () => {
  const SINCE = 1792000000000;
  console.log('─── Eén pagina ───');
  verzoeken = []; antwoord = () => ({ accountUid: 'a', len: 2, elements: [el(1), el(2)] });
  let r = await vraag({ action: 'executions', startTime: SINCE });
  const u = new URL(verzoeken[0].url);
  ok('juiste endpoint', u.origin + u.pathname === 'https://futures.kraken.com/api/history/v3/executions', u.pathname);
  ok('sort=asc, count=1000, since in ms', u.searchParams.get('sort') === 'asc' && u.searchParams.get('count') === '1000' && u.searchParams.get('since') === String(SINCE), u.search);
  ok('antwoord: source executions met de elementen', r.status === 200 && r.data.source === 'executions' && r.data.elements.length === 2 && r.data._execDebug.paginas === 1, JSON.stringify(r.data).slice(0, 200));
  const h = verzoeken[0].headers, qs = u.search.slice(1);
  const verwacht = crypto.createHmac('sha512', Buffer.from(GEHEIM, 'base64')).update(crypto.createHash('sha256').update(qs + h.Nonce + '/api/history/v3/executions').digest()).digest('base64');
  ok('handtekening volgens Kraken (postData + nonce + pad → SHA-256 → HMAC-SHA-512)', h.APIKey === SLEUTEL && h.Authent === verwacht);

  console.log('─── Pagineren ───');
  verzoeken = []; antwoord = (url) => url.searchParams.get('continuation_token') ? { elements: [el(3)] } : { elements: Array.from({ length: 1000 }, (_, i) => el(i)), continuationToken: 'abc' };
  r = await vraag({ action: 'executions', startTime: SINCE, before: SINCE + 864e5 });
  ok('tweede pagina met continuation_token=abc', verzoeken.length === 2 && new URL(verzoeken[1].url).searchParams.get('continuation_token') === 'abc' && r.data.elements.length === 1001);
  ok('before gaat mee, op elke pagina', verzoeken.every(v => new URL(v.url).searchParams.get('before') === String(SINCE + 864e5)));
  ok('niet afgekapt', r.data._execDebug.afgekapt === false);
  verzoeken = []; antwoord = () => ({ elements: Array.from({ length: 1000 }, (_, i) => el(i)), continuationToken: 'p' + verzoeken.length });
  r = await vraag({ action: 'executions', startTime: SINCE });
  ok('maximaal 10 pagina\'s (rate-limit), en dan afgekapt=true', verzoeken.length === 10 && r.data._execDebug.afgekapt === true && r.data.elements.length === 10000);
  verzoeken = []; antwoord = (url) => url.searchParams.get('continuation_token') ? { elements: [el(9)] } : { elements: Array.from({ length: 500 }, (_, i) => el(i)), continuationToken: 'abc' };
  r = await vraag({ action: 'executions', startTime: SINCE });
  ok('Kraken geeft minder dan 1000 per pagina, met token: toch doorgaan', verzoeken.length === 2 && r.data.elements.length === 501, verzoeken.length + ' verzoeken');
  verzoeken = []; antwoord = () => ({ elements: [el(1)], continuationToken: 'zelfde' });
  r = await vraag({ action: 'executions', startTime: SINCE });
  ok('hetzelfde token twee keer: stoppen', verzoeken.length === 2 && r.data._execDebug.afgekapt === false, verzoeken.length + ' verzoeken');

  console.log('─── Fouten ───');
  antwoord = () => ({ result: 'error', error: 'apiLimitExceeded' });
  r = await vraag({ action: 'executions', startTime: SINCE });
  ok('Kraken-fout → HTTP 500 met een leesbare fout', r.status === 500 && /Kraken executions/.test(r.data.error) && /apiLimitExceeded/.test(r.data.error), JSON.stringify(r.data));

  console.log('─── De rest is v22 ───');
  const lf = s => s.replace(/\r\n/g, '\n');   // line endings differ per checkout (Windows autocrlf)
  const zonderKop = s => lf(s).slice(lf(s).indexOf('const ALLOWED_ORIGIN'));
  const blok = /\n  \/\/ v23: execution history[\s\S]*?\n  }\n(?=\n  \/\/ v14)/;
  ok('alle andere code byte-voor-byte gelijk aan v22', zonderKop(v23).replace(blok, '') === zonderKop(v22));
  verzoeken = []; antwoord = () => ({ elements: [] });
  r = await vraag({ action: 'triggers', startTime: SINCE });
  ok('actie triggers werkt zoals in v22', r.data.source === 'triggers' && new URL(verzoeken[0].url).pathname === '/api/history/v3/triggers');

  console.log(`\n=== Worker v23 executions: ${pass}/${pass + fail} ===`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  ✗ crash: ' + String(e).split('\n')[0]); process.exit(1); });
