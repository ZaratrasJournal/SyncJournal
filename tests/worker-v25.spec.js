// Worker v25 (docs/worker-v25.js): backlog W5 + W1.
// W5a: okxHost only from a fixed list (since v19 any host got the signed OKX headers).
// W5b: the 'algos' action no longer fetches orders-history; the app only reads history and pending.
// W1: Access-Control-Allow-Origin was '*'. Two modes behind one switch: 'meten' (default, everything works,
//     the origin is counted for the daily report) and 'afdwingen' (only the listed origins get CORS).
// Runs the complete file with a fake internet, like worker-okx-algos.spec.js.
const fs = require('fs'); const path = require('path');
let pass = 0, fail = 0;
const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const pad25 = path.resolve(__dirname, '../docs/worker-v25.js');
if (!fs.existsSync(pad25)) { console.log('  ✗ docs/worker-v25.js bestaat niet'); process.exit(1); }
const lees = (p) => fs.readFileSync(p, 'utf8').split('\r\n').join('\n');   // a Windows checkout has CRLF
const v25 = lees(pad25);
const v24 = lees(path.resolve(__dirname, '../docs/worker-v24.js'));

let verzoeken = [];
const nepFetch = async (url, init) => {
  verzoeken.push({ url: String(url), headers: (init && init.headers) || {} });
  return new Response(JSON.stringify({ code: '0', data: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
const laad = (modus) => {
  let code = v25.replace(/^export default/m, 'const __worker =');
  if (modus) code = code.replace(/const ORIGIN_MODUS = '[a-z]+';/, `const ORIGIN_MODUS = '${modus}';`);
  return new Function('fetch', code + '\nreturn { worker: __worker };')(nepFetch).worker;
};
const telling = [];
const env = { SJ_METRICS: { writeDataPoint: (d) => telling.push(d) } };
const ctx = { waitUntil() {} };
const vraag = async (worker, body, origin, methode = 'POST') => {
  const headers = { 'Content-Type': 'application/json' };
  if (origin !== undefined) headers.Origin = origin;
  const req = new Request('https://morani-proxy.example/', methode === 'POST'
    ? { method: 'POST', headers, body: JSON.stringify({ exchange: 'okx', apiKey: 'k', apiSecret: 's', passphrase: 'p', action: 'test', ...body }) }
    : { method: methode, headers });
  const res = await worker.fetch(req, env, ctx);
  await new Promise(r => setTimeout(r, 5));   // the count runs after the response (waitUntil)
  return res;
};
const functie = (bron, naam) => { const i = bron.indexOf('async function ' + naam + '('); const j = bron.indexOf('\n}\n', i); return i < 0 ? '' : bron.slice(i, j); };

(async () => {
  const meten = laad();
  console.log('─── W5a: okxHost alleen uit een vaste lijst ───');
  verzoeken = [];
  await vraag(meten, { okxHost: 'https://evil.example' });
  ok('een vreemde host krijgt geen verzoek (en dus geen sleutel)', verzoeken.length > 0 && verzoeken.every(v => new URL(v.url).origin === 'https://eea.okx.com'), verzoeken.map(v => v.url).join());
  verzoeken = [];
  await vraag(meten, { okxHost: 'https://eea.okx.com.evil.example' });
  ok('ook geen host die met eea.okx.com begint', verzoeken.every(v => new URL(v.url).origin === 'https://eea.okx.com'), verzoeken.map(v => v.url).join());
  verzoeken = [];
  await vraag(meten, { okxHost: 'https://www.okx.com' });
  ok('www.okx.com mag (globale accounts)', verzoeken.length > 0 && verzoeken.every(v => new URL(v.url).origin === 'https://www.okx.com'), verzoeken.map(v => v.url).join());
  verzoeken = [];
  await vraag(meten, {});
  ok('zonder okxHost: eea.okx.com, zoals altijd', verzoeken.every(v => new URL(v.url).origin === 'https://eea.okx.com'));

  console.log('─── W5b: algos zonder orders-history ───');
  verzoeken = [];
  const r = await vraag(meten, { action: 'algos', startTime: Date.parse('2026-08-01') });
  const d = await r.json(); const paden = verzoeken.map(v => new URL(v.url).pathname);
  ok('geen orders-history meer', !paden.includes('/api/v5/trade/orders-history'), [...new Set(paden)].join());
  ok('wel 6× algo-historie en 2× openstaand', paden.filter(p => p === '/api/v5/trade/orders-algo-history').length === 6 && paden.filter(p => p === '/api/v5/trade/orders-algo-pending').length === 2);
  ok('het antwoord houdt dezelfde vorm (orders is een lege lijst)', d.source === 'algos' && Array.isArray(d.history) && Array.isArray(d.pending) && Array.isArray(d.orders) && d.orders.length === 0, JSON.stringify(d).slice(0, 160));

  console.log('─── W1, stand "meten" (standaard): alles werkt, de herkomst wordt geteld ───');
  ok('standaard staat de schakelaar op meten', /const ORIGIN_MODUS = 'meten';/.test(v25));
  telling.length = 0;
  let res = await vraag(meten, {}, 'https://evil.example');
  ok('een onbekende website werkt nog (geen verrassing voor Morani\'s journal)', res.status === 200 && res.headers.get('Access-Control-Allow-Origin') === '*');
  ok('en wordt geteld: alleen schema + host', telling.length === 1 && telling[0].blobs[5] === 'https://evil.example', JSON.stringify(telling[0] && telling[0].blobs));
  telling.length = 0;
  await vraag(meten, {}, 'null');
  ok('de oude TradeJournal als bestand telt als "null"', telling[0] && telling[0].blobs[5] === 'null');
  telling.length = 0;
  await vraag(meten, {});
  ok('zonder Origin (geen browser) een lege herkomst', telling[0] && telling[0].blobs[5] === '');
  ok('de eerste vijf telvelden zijn zoals in v24 (het dagrapport leest ze op plaats)', telling[0] && telling[0].blobs.length === 6 && telling[0].blobs[0] === 'okx' && telling[0].blobs[1] === 'test');

  console.log('─── W1, stand "afdwingen": alleen de eigen websites ───');
  const streng = laad('afdwingen');
  for (const o of ['https://syncjournal.nl', 'https://www.syncjournal.nl', 'https://work.syncjournal.nl', 'http://localhost:8765', 'http://127.0.0.1:5500', 'http://localhost', 'null']) {
    res = await vraag(streng, {}, o);
    ok(o + ': werkt, met de eigen origin terug en Vary: Origin', res.status === 200 && res.headers.get('Access-Control-Allow-Origin') === o && /Origin/.test(res.headers.get('Vary') || ''), res.status + ' ' + res.headers.get('Access-Control-Allow-Origin'));
  }
  verzoeken = [];
  res = await vraag(streng, {}, 'https://evil.example');
  ok('een vreemde website: 403, geen CORS-header, en geen verzoek naar de exchange', res.status === 403 && !res.headers.get('Access-Control-Allow-Origin') && verzoeken.length === 0, res.status + ' ' + res.headers.get('Access-Control-Allow-Origin'));
  res = await vraag(streng, {}, 'https://syncjournal.nl.evil.example');
  ok('ook geen website die op syncjournal.nl lijkt', res.status === 403);
  res = await vraag(streng, null, 'https://evil.example', 'OPTIONS');
  ok('preflight van een vreemde website: 403', res.status === 403 && !res.headers.get('Access-Control-Allow-Origin'));
  res = await vraag(streng, null, 'https://syncjournal.nl', 'OPTIONS');
  ok('preflight van syncjournal.nl: toegestaan, met POST en Content-Type', res.status < 300 && res.headers.get('Access-Control-Allow-Origin') === 'https://syncjournal.nl' && /POST/.test(res.headers.get('Access-Control-Allow-Methods') || '') && /Content-Type/i.test(res.headers.get('Access-Control-Allow-Headers') || ''));
  res = await vraag(streng, {});
  ok('zonder Origin-header (geen browser): werkt zoals nu', res.status === 200);
  telling.length = 0;
  await vraag(streng, {}, 'https://evil.example');
  ok('een geweigerde website telt als uitkomst "origin"', telling[0] && telling[0].blobs[2] === 'origin' && telling[0].blobs[5] === 'https://evil.example', JSON.stringify(telling[0] && telling[0].blobs));

  console.log('─── De rest is v24 ───');
  for (const h of ['handleMEXC', 'handleBlofin', 'handleKraken'])
    ok(h + ' is byte-voor-byte v24', functie(v25, h) && functie(v25, h) === functie(v24, h));
  ok('de kop noemt v25', /Cloudflare Worker Proxy v25/.test(v25.slice(0, 300)));

  console.log(`\n=== Worker v25: ${pass}/${pass + fail} ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  ✗ crash: ' + (e && e.stack || e)); process.exit(1); });
