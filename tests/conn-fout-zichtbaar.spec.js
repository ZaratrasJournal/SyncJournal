// Een mislukte exchange-koppeling moet zichtbaar blijven, niet verdwijnen.
//
// Een OKX-gebruiker zette "Trusted IP addresses" aan. Twee dingen gingen mis:
//   1. Op "Verbinden" schreef de app de koppeling meteen als geslaagd weg en slikte de echte
//      fout in een lege `catch(e){}` — je zag een groene "✓ verbonden" terwijl niets werkte.
//   2. De fout die je wél kreeg (via "Test verbinding") stond in een toast, die na een paar
//      seconden weg is — terwijl de uitleg juist moet blijven staan terwijl je je sleutel
//      opnieuw aanmaakt.
// Gemeld via Denny, 28-09-2026.
const { chromium } = require('playwright');
const path = require('path');

let pass = 0, fail = 0;
const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const OKX_RUW = "OKX /api/v5/account/balance: Your IP 2a06:98c0:3600::103 is not included in your API key's 96621ef6 IP whitelist.";

(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));

  // Elke proxy-aanroep faalt met de whitelist-fout; file:// blijft gewoon laden.
  let faalModus = true;
  await p.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith('file://')) return route.continue();
    if (route.request().method() === 'POST')
      return faalModus
        ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ error: OKX_RUW }) })
        : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, balance: '1234.56' }) });
    return route.abort();
  });

  await p.setViewportSize({ width: 1500, height: 1100 });
  await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(600);
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(800);
  await p.evaluate(() => { try { hideWelcome(); } catch (e) {} });
  ok('boot zonder JS-fouten', errs.length === 0, errs[0]);

  console.log('─── Vooraf: de kaart waarschuwt al vóór je een sleutel maakt ───');
  await p.evaluate(() => { STATE.setTab = 'accounts'; go('instellingen'); });
  await p.waitForTimeout(400);
  const notes = await p.evaluate(() => {
    const uit = {};
    ['okx', 'mexc', 'kraken', 'blofin', 'hyperliquid'].forEach(id => {
      try { connExpand(id); } catch (e) {}
      const n = document.querySelector('.conncfg .connnote');
      uit[id] = n ? n.textContent : '';
      try { connExpand(id); } catch (e) {}
    });
    return uit;
  });
  ok('OKX waarschuwt voor de IP-whitelist', /IP-whitelist/i.test(notes.okx), notes.okx.slice(0, 120));
  ok('MEXC toont geen verbind-uitleg meer (koppeling gestopt)', notes.mexc === '', notes.mexc.slice(0, 120));
  ok('Kraken ook', /IP-whitelist/i.test(notes.kraken), notes.kraken.slice(0, 120));
  // Blofin tekent in de browser en Hyperliquid gebruikt publieke data: daar wérkt een
  // whitelist juist wél, dus die waarschuwing hoort er nadrukkelijk níét te staan.
  ok('Blofin waarschuwt NIET (whitelist werkt daar wel)', !/IP-whitelist/i.test(notes.blofin), notes.blofin.slice(0, 120));
  ok('Hyperliquid waarschuwt NIET', !/IP-whitelist/i.test(notes.hyperliquid), notes.hyperliquid.slice(0, 120));

  console.log('─── Een mislukte test blijft in beeld staan ───');
  await p.evaluate(() => {
    CONNS.okx = { connected: true, apiKey: 'k', apiSecret: 's', passphrase: 'p', hint: 'abcd' };
    persistConns(); STATE.connOpen = 'okx'; render();
  });
  await p.waitForTimeout(300);
  await p.evaluate(() => testConn('okx'));
  await p.waitForTimeout(700);

  const naFout = await p.evaluate(() => {
    const el = document.querySelector('.connerr');
    return { opgeslagen: CONN_ERR.okx || null, inBeeld: el ? el.textContent.trim() : null };
  });
  ok('de fout is onthouden', !!naFout.opgeslagen, String(naFout.opgeslagen));
  ok('en staat als blok in de verbind-kaart', !!naFout.inBeeld, String(naFout.inBeeld));
  ok('met het bruikbare advies, niet de ruwe tekst', /tussenserver/i.test(naFout.inBeeld || ''), naFout.inBeeld);
  ok('het Cloudflare-IP staat er niet in', !/2a06:98c0/.test(naFout.inBeeld || ''), naFout.inBeeld);

  // Een toast verdwijnt; het blok hoort te blijven staan.
  await p.waitForTimeout(4500);
  const blijft = await p.evaluate(() => !!document.querySelector('.connerr'));
  ok('staat er na 4,5 seconde nog steeds', blijft === true);

  console.log('─── Verbinden slikt de fout niet meer in ───');
  await p.evaluate(() => { CONN_ERR = {}; delete CONNS.mexc; persistConns(); render(); });
  await p.evaluate(() => {
    STATE.connOpen = 'kraken'; render();
  });
  await p.waitForTimeout(300);
  await p.evaluate(() => {
    const zet = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    zet('ck_kraken', 'sleutel'); zet('cs_kraken', 'geheim');
    connectEx('kraken');
  });
  await p.waitForTimeout(1200);
  const naConnect = await p.evaluate(() => CONN_ERR.kraken || null);
  ok('de fout uit de eerste aanvraag is opgevangen', !!naConnect, String(naConnect));
  ok('en is de bruikbare tekst', /tussenserver/i.test(naConnect || ''), String(naConnect));

  console.log('─── Een geslaagde poging wist de fout ───');
  faalModus = false;
  await p.evaluate(() => { STATE.connOpen = 'okx'; render(); });
  await p.evaluate(() => testConn('okx'));
  await p.waitForTimeout(700);
  const naHerstel = await p.evaluate(() => ({
    opgeslagen: CONN_ERR.okx || null, inBeeld: !!document.querySelector('.connerr'),
  }));
  ok('de onthouden fout is gewist', naHerstel.opgeslagen === null, String(naHerstel.opgeslagen));
  ok('en het blok is uit beeld', naHerstel.inBeeld === false);

  console.log('─── De FAQ klopt weer ───');
  const faq = await p.evaluate(() => {
    const r = {};
    FAQS.forEach(([, items]) => (items || []).forEach(([v, a]) => {
      if (/API-keys veilig/i.test(v)) r.keys = a;
      if (/Hoe koppel ik/i.test(v)) r.koppel = a;
    }));
    return r;
  });
  ok('de FAQ beweert niet meer dat álles rechtstreeks gaat',
     !/praat rechtstreeks met de exchange; je keys gaan niet naar een externe server/i.test(faq.keys || ''), (faq.keys || '').slice(0, 90));
  ok('noemt de drie exchanges die via de tussenserver lopen',
     /OKX/.test(faq.keys) && /MEXC/.test(faq.keys) && /Kraken/.test(faq.keys), (faq.keys || '').slice(0, 90));
  ok('en de twee die dat niet doen', /Blofin/.test(faq.keys) && /Hyperliquid/.test(faq.keys), (faq.keys || '').slice(0, 90));
  ok('de koppel-uitleg noemt de IP-whitelist', /IP-whitelist/i.test(faq.koppel || ''), (faq.koppel || '').slice(-90));

  ok('geen nieuwe JS-fouten', errs.length === 0, errs[0]);

  console.log(`\n=== Verbind-fout zichtbaar: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
