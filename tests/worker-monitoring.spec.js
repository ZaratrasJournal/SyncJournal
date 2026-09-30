// De monitoring-code voor de Worker (docs/worker-monitoring.js) telt de juiste uitkomst en lekt niets.
//
// Die code gaat met de hand in de productie-Worker, buiten deze repo, en daar kunnen we niet testen.
// Deze spec draait hem hier tegen een nagemaakte proxy: klopt de indeling in uitkomsten (die het
// dagrapport groepeert), en belandt er nooit een sleutel, geheim of IP-adres in een telling — dat
// belooft de privacypagina.
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const code = fs.readFileSync(path.resolve(__dirname, '../docs/worker-monitoring.js'), 'utf8').replace(/^export default/m, 'const __worker =');
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
// de bestaande Worker, nagemaakt: antwoordt wat de test hem opgeeft, of gooit
const proxy = { antwoord: null, async fetch(request) { const a = this.antwoord; if (a === 'gooi') throw new Error('kapot'); return json(a.body, a.status); } };
const worker = new Function('proxy', 'json', code + '\nreturn __worker;')(proxy, json);

const SLEUTEL = 'c0ffee12-3456-7890-abcd-ef0123456789', GEHEIM = 'mijn-api-secret-zeer-geheim-1234567890', PASS = 'Passphrase!2026';
const IP6 = '2a06:98c0:3600::103', IP4 = '81.204.12.7';

async function verzoek(antwoord, body = {}, env = {}) {
  proxy.antwoord = antwoord;
  const punten = [], wacht = [];
  env = { SJ_METRICS: { writeDataPoint: p => punten.push(p) }, SJ_KOPPEL_ZOUT: 'zout-voor-de-test', ...env };
  const req = new Request('https://morani-proxy.example/', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ exchange: 'okx', action: 'trades', apiKey: SLEUTEL, apiSecret: GEHEIM, passphrase: PASS, client: 'syncjournal-web', ...body }) });
  const res = await worker.fetch(req, env, { waitUntil: p => wacht.push(p) });
  await Promise.all(wacht);
  return { res, punt: punten[0], punten };
}
const geenGeheimen = p => { const s = JSON.stringify(p); return ![SLEUTEL, GEHEIM, PASS, IP6, IP4, 'zout-voor-de-test'].some(x => s.includes(x)); };

(async () => {
  console.log('─── Uitkomsten ───');
  const gevallen = [
    ['gelukt', { status: 200, body: { trades: [{ pnl: 1 }] } }, 'ok'],
    ['IP-whitelist (OKX)', { status: 500, body: { error: `OKX /api/v5/account/balance: Your IP ${IP6} is not included in your API key's IP whitelist.` } }, 'ip-whitelist'],
    ['ongeldige sleutel (OKX)', { status: 500, body: { error: 'OKX /api/v5/account/balance: Invalid OK-ACCESS-KEY' } }, 'sleutel'],
    ['verkeerde passphrase', { status: 500, body: { error: 'OKX /api/v5/account/balance: OK-ACCESS-PASSPHRASE incorrect' } }, 'sleutel'],
    ['Kraken authenticationError', { status: 500, body: { error: 'authenticationError' } }, 'sleutel'],
    ['rate-limit van onze eigen Worker', { status: 429, body: { error: 'Te veel verzoeken, probeer over een minuut opnieuw' } }, 'rate-limit'],
    ['exchange druk', { status: 500, body: { error: 'OKX /api/v5/account/positions-history: System busy. Please try again later.' } }, 'exchange-fout'],
    ['fout in een 200-antwoord', { status: 200, body: { error: 'Kraken verbinding mislukt' } }, 'exchange-fout'],
    ['kapot verzoek', { status: 400, body: { error: 'Invalid JSON' } }, 'verzoek'],
    ['de Worker gooit', 'gooi', 'worker-fout'],
  ];
  for (const [naam, antwoord, verwacht] of gevallen) {
    const { punt } = await verzoek(antwoord);
    ok(`${naam} → ${verwacht}`, punt && punt.blobs[2] === verwacht, JSON.stringify(punt && punt.blobs));
  }

  console.log('─── Wat er in een telling staat ───');
  const ip = await verzoek(gevallen[1][1]);
  ok('exchange, actie, uitkomst, fouttekst, client — in die volgorde', ip.punt.blobs[0] === 'okx' && ip.punt.blobs[1] === 'trades' && ip.punt.blobs[4] === 'syncjournal-web',
    JSON.stringify(ip.punt.blobs));
  ok('de fouttekst blijft leesbaar, zonder het IP-adres', /not included in your API key/.test(ip.punt.blobs[3]) && /\/api\/v5\/account\/balance/.test(ip.punt.blobs[3]) && !ip.punt.blobs[3].includes(IP6),
    ip.punt.blobs[3]);
  ok('HTTP-status en duur als getallen', ip.punt.doubles[0] === 500 && ip.punt.doubles[1] >= 0, JSON.stringify(ip.punt.doubles));
  ok('één index: een vingerafdruk van 8 tekens', ip.punt.indexes.length === 1 && /^[0-9a-f]{8}$/.test(ip.punt.indexes[0]), JSON.stringify(ip.punt.indexes));
  const lek = await verzoek({ status: 500, body: { error: `Blofin: key ${SLEUTEL} secret ${GEHEIM} from ${IP4} sig K7gNU3sdo+OL0wNhqoVWhr3g6s1xYv72ol/pe/Unols=` } });
  ok('een fouttekst met sleutel, geheim, IP en handtekening erin: die komen er niet in', geenGeheimen(lek.punt), lek.punt.blobs[3]);
  const alles = []; for (const g of gevallen) alles.push((await verzoek(g[1])).punt);   // na elkaar: de nep-proxy is gedeeld
  ok('in geen enkele telling een sleutel, geheim, passphrase, IP of het zout', alles.every(geenGeheimen));
  ok('bij "gelukt" geen fouttekst', alles[0].blobs[3] === '', JSON.stringify(alles[0].blobs));

  console.log('─── Vingerafdruk ───');
  const a1 = (await verzoek(gevallen[0][1])).punt.indexes[0], a2 = (await verzoek(gevallen[1][1])).punt.indexes[0];
  const b = (await verzoek(gevallen[0][1], { apiKey: 'een-andere-sleutel-0000' })).punt.indexes[0];
  const ander = (await verzoek(gevallen[0][1], {}, { SJ_KOPPEL_ZOUT: 'ander-zout' })).punt.indexes[0];
  ok('dezelfde koppeling geeft steeds dezelfde vingerafdruk', a1 === a2, a1 + ' / ' + a2);
  ok('een andere sleutel een andere', a1 !== b, a1 + ' / ' + b);
  ok('zonder het geheime zout is hij niet na te rekenen (ander zout, andere code)', a1 !== ander);
  ok('geen zout ingesteld: vingerafdruk blijft leeg', (await verzoek(gevallen[0][1], {}, { SJ_KOPPEL_ZOUT: '' })).punt.indexes[0] === '');

  console.log('─── Het antwoord aan de app blijft hetzelfde ───');
  const r1 = await verzoek(gevallen[0][1]);
  ok('status en inhoud ongewijzigd', r1.res.status === 200 && (await r1.res.json()).trades[0].pnl === 1);
  const r2 = await verzoek(gevallen[1][1]);
  ok('ook bij een fout', r2.res.status === 500 && /whitelist/.test((await r2.res.json()).error));
  const zonder = await verzoek(gevallen[0][1], {}, { SJ_METRICS: undefined });
  ok('zonder de binding: gewoon doorgeven, niets tellen', zonder.res.status === 200 && zonder.punten.length === 0);
  proxy.antwoord = gevallen[0][1];
  const get = await worker.fetch(new Request('https://morani-proxy.example/', { method: 'OPTIONS' }), { SJ_METRICS: { writeDataPoint: () => { throw new Error('mag niet'); } } }, {});
  ok('een CORS-preflight (OPTIONS) telt niet mee', !!get);

  console.log(`\n=== Worker-monitoring: ${pass}/${pass + fail} ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
