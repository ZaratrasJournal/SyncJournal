// Web Analytics meet alleen op syncjournal.nl: niet op de werkversie, niet lokaal.
//
// Sinds 16-09-2026 stond Web Analytics op "Automatic setup", maar het meetscript kwam nooit in de
// pagina's (2 bezoeken in 24 uur, 30-09-2026). Nu laden de pagina's het zelf, met een kleine
// voorwaarde op de hostnaam. Deze spec serveert de echte bestanden onder de echte adressen en kijkt
// of het meetscript precies daar geladen wordt, met het goede token. Het script van Cloudflare zelf
// wordt nagemaakt: er gaat niets naar Cloudflare en er komt geen nepbezoek in de statistieken.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const TOKEN = 'c6001fe65da94f1eb99df53cad11d8d5';
const PAGINAS = [['landing', '/', 'site/index.html'], ['app', '/app', 'work/syncjournal.html'], ['plan', '/plan/', 'site/plan/index.html'], ['privacy', '/privacy.html', 'site/privacy.html']];

(async () => {
  const b = await chromium.launch();
  for (const [naam, pad, bestand] of PAGINAS) {
    console.log(`─── ${naam} ───`);
    const html = fs.readFileSync(path.resolve(bestand), 'utf8');
    for (const host of ['syncjournal.nl', 'work.syncjournal.nl', 'lokaal']) {
      const p = await b.newPage();
      const beacon = [];
      await p.route('**/*', r => {
        const u = r.request().url();
        if (host !== 'lokaal' && u.split('?')[0] === `https://${host}${pad}`) return r.fulfill({ status: 200, contentType: 'text/html', body: html });
        if (u.startsWith('https://static.cloudflareinsights.com/beacon.min.js')) {
          beacon.push(u);
          // nagemaakt: onthoudt welk token de pagina meegaf, precies zoals het echte script het leest
          return r.fulfill({ status: 200, contentType: 'text/javascript', body: 'window.__cf = document.querySelector("script[data-cf-beacon]").getAttribute("data-cf-beacon");' });
        }
        if (u.startsWith('file://')) return r.continue();
        return r.abort();
      });
      const url = host === 'lokaal' ? 'file:///' + path.resolve(bestand).split(path.sep).join('/') : `https://${host}${pad}`;
      await p.goto(url, { waitUntil: 'load' }).catch(() => {});
      await p.waitForTimeout(500);
      const cf = await p.evaluate(() => window.__cf || null).catch(() => null);
      if (host === 'syncjournal.nl') {
        ok(`${host}: meetscript geladen, één keer`, beacon.length === 1, String(beacon.length));
        ok(`${host}: met het token van de site`, !!cf && JSON.parse(cf).token === TOKEN, String(cf));
      } else {
        ok(`${host}: geen meetscript`, beacon.length === 0, String(beacon.length));
      }
      await p.close();
    }
  }
  console.log(`\n=== Web Analytics: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
