// Een IP-whitelist op de API-sleutel moet een bruikbare melding geven, geen ruwe exchange-tekst.
//
// Een OKX-gebruiker zette "Trusted IP addresses" aan en vulde zijn eigen IP in. OKX antwoordde:
//   "Your IP 2a06:98c0:3600::103 is not included in your API key's ... IP whitelist."
// Dat IP is niet van hem — 2a06:98c0::/29 is een Cloudflare-range, oftewel onze Worker. De app
// praat via die Worker met de exchange, dus de exchange ziet nooit het IP van de gebruiker.
// Whitelisten kán daardoor niet werken: Workers hebben geen vast uitgaand IP.
//
// De ruwe tekst stuurde mensen het verkeerde gat in ("dan vul ik het juiste IP wel in"), dus
// vertaalt proxyCall hem nu naar de enige oplossing die werkt: whitelist uitzetten.
// Gemeld via Denny, 28-09-2026.
const { chromium } = require('playwright');
const path = require('path');

let pass = 0, fail = 0;
const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const OKX_RUW = "OKX /api/v5/account/balance: Your IP 2a06:98c0:3600::103 is not included in your API key's 96621ef6-1442-4a59-be3c-42ce0d074bc7 IP whitelist.";

(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await p.setViewportSize({ width: 1500, height: 950 });
  await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(600);
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(800);
  await p.evaluate(() => { try { hideWelcome(); } catch (e) {} });
  ok('boot zonder JS-fouten', errs.length === 0, errs[0]);

  console.log('─── De vertaling zelf ───');
  const r = await p.evaluate((ruw) => ({
    okx: proxyFoutTekst(ruw, 'okx'),
    // Andere exchanges achter dezelfde Worker hebben exact hetzelfde probleem.
    kraken: proxyFoutTekst('EAPI:Invalid key -- IP address not in allowlist', 'kraken'),
    zonderEx: proxyFoutTekst(ruw, ''),
    // Wat géén whitelist-fout is, moet onaangeroerd doorgegeven worden.
    anders: proxyFoutTekst('Invalid signature', 'okx'),
    leeg: proxyFoutTekst('', 'okx'),
  }), OKX_RUW);

  ok('OKX-melding wordt vertaald', r.okx !== OKX_RUW && r.okx.length > 0, r.okx);
  ok('zegt wát je moet doen: whitelist uitzetten', /whitelist\s+uit|zet die uit/i.test(r.okx), r.okx);
  ok('legt uit waaróm: tussenserver', /tussenserver/i.test(r.okx), r.okx);
  ok('noemt dat leesrechten genoeg zijn', /leesrechten/i.test(r.okx), r.okx);
  ok('noemt de exchange bij naam', /OKX/.test(r.okx), r.okx);
  ok('toont het verwarrende Cloudflare-IP niet meer', !/2a06:98c0/.test(r.okx), r.okx);
  ok('werkt ook voor Kraken (allowlist-bewoording)', /tussenserver/i.test(r.kraken), r.kraken);
  ok('zonder exchange-naam nog steeds leesbaar', /tussenserver/i.test(r.zonderEx), r.zonderEx);

  console.log('─── Alleen exchanges achter de Worker ───');
  // Blofin tekent rechtstreeks vanuit de browser en Hyperliquid gebruikt publieke wallet-data.
  // Die zien dus wél het echte IP van de gebruiker, en voor hen is een whitelist juist zinvol.
  // Ze mogen deze vertaling daarom nooit krijgen — en dat gebeurt vanzelf, omdat ze proxyCall
  // niet gebruiken. Deze assertie bewaakt dat die aanname blijft kloppen.
  const viaWorker = await p.evaluate(() => {
    const bron = f => (typeof f === 'function' ? String(f) : '');
    const gebruikt = ad => Object.keys(ad || {}).some(k => /proxyCall/.test(bron(ad[k])));
    return { blofin: gebruikt(ExchangeAPI.blofin), hyperliquid: gebruikt(ExchangeAPI.hyperliquid),
             okx: gebruikt(ExchangeAPI.okx), kraken: gebruikt(ExchangeAPI.kraken), mexc: gebruikt(ExchangeAPI.mexc) };
  });
  ok('OKX loopt via de Worker', viaWorker.okx === true);
  ok('Kraken loopt via de Worker', viaWorker.kraken === true);
  ok('MEXC loopt via de Worker', viaWorker.mexc === true);
  ok('Blofin niet — tekent in de browser, ziet het echte IP', viaWorker.blofin === false);
  ok('Hyperliquid niet — publieke wallet-data', viaWorker.hyperliquid === false);

  console.log('─── Andere fouten blijven ongemoeid ───');
  ok('"Invalid signature" gaat onveranderd door', r.anders === 'Invalid signature', r.anders);
  ok('lege fout blijft leeg', r.leeg === '', JSON.stringify(r.leeg));

  console.log('─── End-to-end: wat de gebruiker in de toast ziet ───');
  // Worker-antwoord nabootsen: HTTP 200 met een error-veld, zoals proxyCall het krijgt.
  await p.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith('file://')) return route.continue();
    if (/proxy|worker|\.dev|syncjournal/i.test(u) && route.request().method() === 'POST')
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ error: OKX_RUW }) });
    return route.abort();
  });

  const toastTekst = await p.evaluate(async () => {
    try {
      await proxyCall({ exchange: 'okx', action: 'test', apiKey: 'x', apiSecret: 'y', passphrase: 'z' });
      return '(geen fout gegooid)';
    } catch (e) { return (e && e.message) || String(e); }
  });
  ok('proxyCall gooit de vertaalde tekst, niet de ruwe', /tussenserver/i.test(toastTekst), toastTekst);
  ok('en het ruwe IP zit er niet meer in', !/2a06:98c0/.test(toastTekst), toastTekst);

  ok('geen nieuwe JS-fouten', errs.length === 0, errs[0]);

  console.log(`\n=== IP-whitelist-melding: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
