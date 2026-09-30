// Worker v20 (docs/worker-v20.js): telt de juiste uitkomst, lekt niets, en verandert niets aan het antwoord.
//
// Die code gaat met de hand in Morani's Worker, buiten deze repo, en daar kunnen we niet testen. Deze
// spec draait het complete bestand hier, met de echte handlers; alleen het internet (OKX, Kraken) is
// nagemaakt. Klopt de indeling in uitkomsten die het dagrapport groepeert — ook voor de fouten die
// OKX en Kraken met status 200 teruggeven — en belandt er nooit een sleutel, geheim of IP-adres in een
// telling, zoals de privacypagina belooft.
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const SLEUTEL = 'c0ffee12-3456-7890-abcd-ef0123456789', GEHEIM = 'mijn-api-secret-zeer-geheim-1234567890', PASS = 'Passphrase!2026';
const KRAKEN_GEHEIM = Buffer.from('kraken-geheim-voor-de-test-0123456789').toString('base64');
const IP6 = '2a06:98c0:3600::103', IP4 = '81.204.12.7', ZOUT = 'zout-voor-de-test';

// het internet: antwoorden per stukje URL, of 'gooi' voor een netwerkfout
let web = {}, webAanroepen = 0;
const nepFetch = async (url) => {
  webAanroepen++;
  const hit = Object.keys(web).find(k => String(url).includes(k));
  const a = hit ? web[hit] : { code: '0', data: [] };
  if (a === 'gooi') throw new Error('network down');
  return new Response(JSON.stringify(a), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
const code = fs.readFileSync(path.resolve(__dirname, '../docs/worker-v20.js'), 'utf8').replace(/^export default/m, 'const __worker =');
const { worker, proxy } = new Function('fetch', code + '\nreturn { worker: __worker, proxy };')(nepFetch);

async function verzoek(body, { env = {}, methode = 'POST', ruw } = {}) {
  const punten = [], wacht = [];
  env = { SJ_METRICS: { writeDataPoint: p => punten.push(p) }, SJ_KOPPEL_ZOUT: ZOUT, ...env };
  const init = { method: methode, headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': IP4 } };
  if (methode === 'POST') init.body = ruw != null ? ruw : JSON.stringify({ apiKey: SLEUTEL, apiSecret: GEHEIM, passphrase: PASS, client: 'syncjournal-web', ...body });
  const res = await worker.fetch(new Request('https://morani-proxy.example/', init), env, { waitUntil: p => wacht.push(p) });
  await Promise.all(wacht);
  return { res, punt: punten[0], punten };
}
const geenGeheimen = p => { const s = JSON.stringify(p); return ![SLEUTEL, GEHEIM, PASS, KRAKEN_GEHEIM, IP6, IP4, ZOUT].some(x => s.includes(x)); };
const OKX_IP = { code: '50110', msg: `Your IP ${IP6} is not included in your API key's IP whitelist.` };
const OKX_SLEUTEL = { code: '50111', msg: 'Invalid OK-ACCESS-KEY' };
const KR = { exchange: 'kraken', apiSecret: KRAKEN_GEHEIM };

(async () => {
  console.log('─── Uitkomsten, met de echte handlers ───');
  const gevallen = [
    ['OKX test gelukt', { 'account/balance': { code: '0', data: [{ totalEq: '123.4' }] } }, { exchange: 'okx', action: 'test' }, 'ok'],
    ['OKX test: IP-whitelist', { 'account/balance': OKX_IP }, { exchange: 'okx', action: 'test' }, 'ip-whitelist'],
    ['OKX test: ongeldige sleutel', { 'account/balance': OKX_SLEUTEL }, { exchange: 'okx', action: 'test' }, 'sleutel'],
    ['OKX test: exchange tijdelijk weg', { 'account/balance': { code: '50001', msg: 'Service temporarily unavailable' } }, { exchange: 'okx', action: 'test' }, 'exchange-fout'],
    ['OKX trades: FUTURES én SWAP geweigerd (status 200)', { 'positions-history': OKX_SLEUTEL }, { exchange: 'okx', action: 'trades' }, 'sleutel'],
    ['OKX trades: alleen SWAP faalt, FUTURES levert → gelukt', { 'instType=FUTURES': { code: '0', data: [{ posId: '1' }] }, 'instType=SWAP': { code: '51000', msg: 'Parameter instType error' } }, { exchange: 'okx', action: 'trades' }, 'ok'],
    ['OKX fills: beide met IP-whitelist geweigerd', { 'fills-history': OKX_IP }, { exchange: 'okx', action: 'fills' }, 'ip-whitelist'],
    ['OKX open posities gelukt', { 'account/positions': { code: '0', data: [] } }, { exchange: 'okx', action: 'open_positions' }, 'ok'],
    ['Kraken test: authenticationError', { 'v3/accounts': { result: 'error', error: 'authenticationError' } }, { ...KR, action: 'test' }, 'sleutel'],
    ['Kraken trades: positions onbereikbaar (status 200)', { 'history/v3/positions': 'gooi' }, { ...KR, action: 'trades' }, 'exchange-fout'],
    ['onbekende exchange', {}, { exchange: 'bybit', action: 'test' }, 'verzoek'],
  ];
  for (const [naam, w, body, verwacht] of gevallen) {
    web = w;
    const { punt } = await verzoek(body);
    ok(`${naam} → ${verwacht}`, punt && punt.blobs[2] === verwacht, JSON.stringify(punt && punt.blobs));
  }
  web = {};
  const kapot = await verzoek(null, { ruw: '{kapot' });
  ok('kapotte JSON → verzoek', kapot.punt && kapot.punt.blobs[2] === 'verzoek' && kapot.res.status === 400, JSON.stringify(kapot.punt && kapot.punt.blobs));
  const echteFetch = proxy.fetch; proxy.fetch = async () => { throw new Error('kapot'); };
  const gooit = await verzoek({ exchange: 'okx', action: 'test' });
  proxy.fetch = echteFetch;
  ok('de handler zelf gooit → worker-fout, en de app krijgt een nette 500', gooit.punt.blobs[2] === 'worker-fout' && gooit.res.status === 500);

  console.log('─── Wat er in een telling staat ───');
  web = { 'account/balance': OKX_IP };
  const ip = await verzoek({ exchange: 'okx', action: 'test' });
  ok('exchange, actie, uitkomst, fouttekst, client — in die volgorde', ip.punt.blobs[0] === 'okx' && ip.punt.blobs[1] === 'test' && ip.punt.blobs[4] === 'syncjournal-web', JSON.stringify(ip.punt.blobs));
  ok('de fouttekst blijft leesbaar, zonder het IP-adres', /not included in your API key/.test(ip.punt.blobs[3]) && /\/api\/v5\/account\/balance/.test(ip.punt.blobs[3]) && !ip.punt.blobs[3].includes(IP6), ip.punt.blobs[3]);
  ok('HTTP-status en duur als getallen', ip.punt.doubles[0] === 500 && ip.punt.doubles[1] >= 0, JSON.stringify(ip.punt.doubles));
  ok('één index: een vingerafdruk van 8 tekens', ip.punt.indexes.length === 1 && /^[0-9a-f]{8}$/.test(ip.punt.indexes[0]), JSON.stringify(ip.punt.indexes));
  web = { 'account/balance': { code: '1', msg: `key ${SLEUTEL} secret ${GEHEIM} from ${IP4} sig K7gNU3sdo+OL0wNhqoVWhr3g6s1xYv72ol/pe/Unols=` } };
  const lek = await verzoek({ exchange: 'okx', action: 'test' });
  ok('een fouttekst met sleutel, geheim, IP en handtekening erin: die komen er niet in', geenGeheimen(lek.punt), lek.punt.blobs[3]);
  const alles = [];
  for (const [, w, body] of gevallen) { web = w; alles.push((await verzoek(body)).punt); }
  ok('in geen enkele telling een sleutel, geheim, passphrase, IP of het zout', alles.every(geenGeheimen));
  ok('bij "gelukt" geen fouttekst', alles[0].blobs[3] === '', JSON.stringify(alles[0].blobs));

  console.log('─── Andere apps op deze Worker (Morani, de oude journal) ───');
  web = { 'account/balance': OKX_IP };
  for (const client of [undefined, 'morani-web']) {
    const { punt } = await verzoek({ exchange: 'okx', action: 'test', client });
    ok(`client ${client || '(geen)'}: wel geteld, met uitkomst`, punt && punt.blobs[2] === 'ip-whitelist' && punt.blobs[4] === 'ander', JSON.stringify(punt && punt.blobs));
    ok(`client ${client || '(geen)'}: geen fouttekst en geen vingerafdruk`, punt && punt.blobs[3] === '' && punt.indexes[0] === '', JSON.stringify(punt && [punt.blobs[3], punt.indexes]));
  }

  console.log('─── Vingerafdruk ───');
  web = {};
  const vp = async (extra = {}, env = {}) => (await verzoek({ exchange: 'okx', action: 'test', ...extra }, { env })).punt.indexes[0];
  const a1 = await vp(), a2 = await vp(), b = await vp({ apiKey: 'een-andere-sleutel-0000' }), ander = await vp({}, { SJ_KOPPEL_ZOUT: 'ander-zout' });
  ok('dezelfde koppeling geeft steeds dezelfde vingerafdruk', a1 === a2, a1 + ' / ' + a2);
  ok('een andere sleutel een andere', a1 !== b, a1 + ' / ' + b);
  ok('zonder het geheime zout is hij niet na te rekenen (ander zout, andere code)', a1 !== ander);
  ok('geen zout ingesteld: vingerafdruk blijft leeg', (await vp({}, { SJ_KOPPEL_ZOUT: '' })) === '');

  console.log('─── Het antwoord aan de apps blijft hetzelfde als in v19 ───');
  for (const [naam, w, body] of [gevallen[0], gevallen[1], gevallen[4]]) {
    web = w;
    const via = await verzoek(body);
    const direct = await proxy.fetch(new Request('https://morani-proxy.example/', { method: 'POST', body: JSON.stringify({ apiKey: SLEUTEL, apiSecret: GEHEIM, passphrase: PASS, client: 'syncjournal-web', ...body }) }));
    const [t1, t2] = [await via.res.text(), await direct.text()];
    ok(`${naam}: zelfde status en inhoud`, via.res.status === direct.status && t1 === t2, `${via.res.status} vs ${direct.status}`);
  }
  web = {};
  const zonder = await verzoek({ exchange: 'okx', action: 'test' }, { env: { SJ_METRICS: undefined } });
  ok('zonder de binding SJ_METRICS: gewoon doorgeven, niets tellen', zonder.res.status === 200 && zonder.punten.length === 0);
  const pre = await verzoek(null, { methode: 'OPTIONS' });
  ok('een CORS-preflight (OPTIONS): gewoon beantwoord, niet geteld', pre.res.status === 200 && pre.punten.length === 0 && pre.res.headers.get('Access-Control-Allow-Origin') === '*');

  console.log('─── Snelheidslimiet (binding LIMIET) ───');
  web = {};
  const limiet = success => ({ LIMIET: { limit: async ({ key }) => { limiet.laatste = key; return { success }; } } });
  const vrij = await verzoek({ exchange: 'okx', action: 'test' }, { env: limiet(true) });
  ok('onder de limiet: gewoon doorgeven', vrij.res.status === 200 && vrij.punt.blobs[2] === 'ok');
  ok('de limiet telt per IP', limiet.laatste === IP4, String(limiet.laatste));
  const voor = webAanroepen;
  const vol = await verzoek({ exchange: 'okx', action: 'test' }, { env: limiet(false) });
  ok('boven de limiet: 429 met de bekende melding, en de exchange wordt niet aangeroepen',
    vol.res.status === 429 && /Te veel verzoeken/.test((await vol.res.json()).error) && webAanroepen === voor);
  ok('en dat telt als rate-limit', vol.punt && vol.punt.blobs[2] === 'rate-limit', JSON.stringify(vol.punt && vol.punt.blobs));
  const geenLimiet = await verzoek({ exchange: 'okx', action: 'test' }, { env: {} });
  ok('zonder de binding LIMIET: geen limiet', geenLimiet.res.status === 200);

  console.log(`\n=== Worker-monitoring: ${pass}/${pass + fail} ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
