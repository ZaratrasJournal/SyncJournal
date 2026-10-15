// Worker v21 (docs/worker-v21.js): Kraken action 'account_log' (Denny 15-10-2026).
// Runs the complete file here with a fake internet, like worker-monitoring.spec.js: the request
// (path, sort, count, since/before), the Kraken signature over the url-encoded query, paging via
// `from`, the page cap, errors, and that everything else is byte-for-byte v20.
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
let pass = 0, fail = 0;
const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const SLEUTEL = 'kraken-key-123', GEHEIM = Buffer.from('kraken-geheim-voor-de-test-0123456789').toString('base64');
let verzoeken = [], antwoord = () => ({ accountUid: 'a', logs: [] });
const nepFetch = async (url, init) => {
  verzoeken.push({ url: String(url), headers: (init && init.headers) || {} });
  return new Response(JSON.stringify(antwoord(new URL(String(url)))), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
const v21 = fs.readFileSync(path.resolve(__dirname, '../docs/worker-v21.js'), 'utf8');
const v20 = fs.readFileSync(path.resolve(__dirname, '../docs/worker-v20.js'), 'utf8');
const { worker } = new Function('fetch', v21.replace(/^export default/m, 'const __worker =') + '\nreturn { worker: __worker };')(nepFetch);
const vraag = async (body) => {
  const res = await worker.fetch(new Request('https://morani-proxy.example/', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ exchange: 'kraken', apiKey: SLEUTEL, apiSecret: GEHEIM, ...body }) }), {}, { waitUntil() {} });
  return { status: res.status, data: await res.json() };
};
const regel = id => ({ id, date: '2026-10-14T17:12:05Z', info: 'futures trade', contract: 'pf_xbtusd', old_balance: 0, new_balance: -0.0092, trade_price: 81489, booking_uid: 'b' + id });

(async () => {
  console.log('─── Eén pagina ───');
  verzoeken = []; antwoord = () => ({ accountUid: 'a', logs: [regel(1), regel(2), regel(3)] });
  const SINCE = 1792000000000;
  let r = await vraag({ action: 'account_log', startTime: SINCE });
  const u = new URL(verzoeken[0].url);
  ok('juiste endpoint', u.origin + u.pathname === 'https://futures.kraken.com/api/history/v3/account-log', u.pathname);
  ok('sort=asc, count=1000, since in ms', u.searchParams.get('sort') === 'asc' && u.searchParams.get('count') === '1000' && u.searchParams.get('since') === String(SINCE), u.search);
  ok('antwoord: source account_log met de regels', r.status === 200 && r.data.source === 'account_log' && r.data.logs.length === 3 && r.data._logDebug.paginas === 1);
  const h = verzoeken[0].headers, qs = u.search.slice(1);
  const verwacht = crypto.createHmac('sha512', Buffer.from(GEHEIM, 'base64')).update(crypto.createHash('sha256').update(qs + h.Nonce + '/api/history/v3/account-log').digest()).digest('base64');
  ok('handtekening volgens Kraken (postData + nonce + pad → SHA-256 → HMAC-SHA-512)', h.APIKey === SLEUTEL && h.Authent === verwacht);

  console.log('─── Pagineren ───');
  verzoeken = []; antwoord = (url) => { const f = +url.searchParams.get('from') || 1; return { logs: f === 1 ? Array.from({ length: 1000 }, (_, i) => regel(i + 1)) : [regel(1001), regel(1002)] }; };
  r = await vraag({ action: 'account_log', startTime: SINCE, before: SINCE + 864e5 });
  ok('tweede pagina via from = laatste id + 1', verzoeken.length === 2 && new URL(verzoeken[1].url).searchParams.get('from') === '1001');
  ok('before gaat mee, op elke pagina', verzoeken.every(v => new URL(v.url).searchParams.get('before') === String(SINCE + 864e5)));
  ok('alle regels samen, niet afgekapt', r.data.logs.length === 1002 && r.data._logDebug.afgekapt === false);
  verzoeken = []; antwoord = (url) => { const f = +url.searchParams.get('from') || 1; return { logs: Array.from({ length: 1000 }, (_, i) => regel(f + i)) }; };
  r = await vraag({ action: 'account_log', startTime: SINCE });
  ok('maximaal 10 pagina\'s (rate-limit), en dan afgekapt=true', verzoeken.length === 10 && r.data._logDebug.afgekapt === true && r.data.logs.length === 10000);

  console.log('─── Fouten ───');
  antwoord = () => ({ result: 'error', error: 'apiLimitExceeded' });
  r = await vraag({ action: 'account_log', startTime: SINCE });
  ok('Kraken-fout → HTTP 500 met een leesbare fout (rate-limit herkenbaar)', r.status === 500 && /account-log/.test(r.data.error) && /apiLimitExceeded/.test(r.data.error), JSON.stringify(r.data));

  console.log('─── De rest is v20 ───');
  const lf = s => s.replace(/\r\n/g, '\n');   // line endings differ per checkout (Windows autocrlf)
  const zonderKop = s => lf(s).slice(lf(s).indexOf('const ALLOWED_ORIGIN'));
  const blok = /\n  \/\/ v21: account-log[\s\S]*?\n  }\n(?=\n  \/\/ v14)/;
  const v21Rest = zonderKop(v21).replace(blok, '').replace('withEvents, before }', 'withEvents }');
  ok('alle andere code byte-voor-byte gelijk aan v20', v21Rest === zonderKop(v20));
  verzoeken = []; antwoord = () => ({ elements: [] });
  r = await vraag({ action: 'trades', startTime: SINCE, withEvents: true });
  ok('actie trades werkt zoals in v20', r.data.source === 'position_updates' && new URL(verzoeken[0].url).pathname === '/api/history/v3/positions');

  console.log(`\n=== Worker v21 account-log: ${pass}/${pass + fail} ===`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  ✗ crash: ' + String(e).split('\n')[0]); process.exit(1); });
