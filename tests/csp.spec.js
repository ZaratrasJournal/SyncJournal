// F14 stap 5 (26-10-2026): the Content-Security-Policy in site/_headers ships as Report-Only.
// This spec serves the app, the landing and the info pages with that policy as an ENFORCING header
// and checks that everything still works without a single CSP violation — so switching to
// enforcing later (docs/csp.md) is safe. It also proves the policy really bites (a host that is
// not listed is blocked) and that every external host the app talks to is allowed.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs'); const http = require('http');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

// Cloudflare Pages _headers: a path line, then indented "Name: value" lines.
function leesHeaders() {
  const regels = {}; let cur = null;
  for (const r of fs.readFileSync('site/_headers', 'utf8').split(/\r?\n/)) {
    if (!r.trim() || r.trim().startsWith('#')) continue;
    if (!/^\s/.test(r)) { cur = r.trim(); regels[cur] = regels[cur] || {}; continue; }
    const i = r.indexOf(':'); if (cur && i > 0) regels[cur][r.slice(0, i).trim()] = r.slice(i + 1).trim();
  }
  return regels;
}
const H = leesHeaders();
const RO = 'Content-Security-Policy-Report-Only';
const CSP_PADEN = ['/', '/index.html', '/app', '/app.html'];

// Every external host the app or landing loads or calls. Keep in sync with docs/csp.md.
const VERBINDINGEN = [
  'https://morani-proxy.moranitraden.workers.dev/', 'https://openapi.blofin.com/api/v1/market/instruments',
  'https://api.hyperliquid.xyz/info', 'https://www.okx.com/api/v5/public/instruments', 'https://eea.okx.com/api/v5/public/instruments',
  'https://api.mexc.com/api/v1/contract/detail', 'https://api.anthropic.com/v1/messages', 'https://api.frankfurter.dev/v1/latest',
  'https://www.googleapis.com/drive/v3/files', 'https://drive-token.syncjournal.nl/', 'https://cloudflareinsights.com/cdn-cgi/rum',
];

const MIME = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain' };
// Serves site/ like Cloudflare Pages does, with /app and /app.html = the dev file. The CSP is sent
// enforcing; the other headers from _headers go along unchanged.
function server() {
  return http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    let f = u === '/' ? 'site/index.html' : (u === '/app' || u === '/app.html') ? 'work/syncjournal.html' : path.join('site', u);
    if (!path.resolve(f).startsWith(path.resolve('.')) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); }
    const hdr = { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' };
    Object.entries(H[u] || {}).forEach(([k, v]) => { hdr[k === RO ? 'Content-Security-Policy' : k] = v; });
    res.writeHead(200, hdr); fs.createReadStream(f).pipe(res);
  });
}

(async () => {
  console.log('─── site/_headers ───');
  const pol = CSP_PADEN.map(p => (H[p] || {})[RO]);
  ok('CSP als Report-Only op /, /index.html, /app en /app.html', pol.every(Boolean), JSON.stringify(pol.map(Boolean)));
  ok('overal dezelfde policy', pol.every(x => x === pol[0]));
  ok('nergens al afdwingend', !Object.values(H).some(h => h['Content-Security-Policy']));
  ok('de bestaande cache-regels staan er nog', H['/version.json'] && H['/version.json']['Cache-Control'] === 'no-store' && H['/app']['Cache-Control'] === 'no-cache');
  const P = pol[0] || '';
  const dir = Object.fromEntries(P.split(';').map(s => s.trim()).filter(Boolean).map(s => { const [k, ...v] = s.split(/\s+/); return [k, v]; }));
  ok("object-src 'none', base-uri 'self', frame-ancestors 'none'", (dir['object-src'] || []).join() === "'none'" && (dir['base-uri'] || []).join() === "'self'" && (dir['frame-ancestors'] || []).join() === "'none'");
  ok("geen 'unsafe-eval'", !/unsafe-eval/.test(P));
  ok('docs/csp.md bestaat en noemt elke host uit de policy', fs.existsSync('docs/csp.md') && P.match(/https:\/\/[a-z0-9.-]+/g).every(h => fs.readFileSync('docs/csp.md', 'utf8').includes(h.replace('https://', ''))));

  const srv = server(); await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const BASE = 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch();
  const errs = [], csp = [];
  const nieuw = async (vp = { width: 1400, height: 950 }) => {
    const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage(); p.on('dialog', d => d.accept());
    p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
    p.on('console', m => { if (/Content Security Policy|Content-Security-Policy/i.test(m.text())) csp.push(m.text().slice(0, 200)); });
    await p.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); });
    return [ctx, p];
  };
  const schendingen = async p => (await p.evaluate(() => window.__csp || [])).concat(csp.splice(0));

  console.log('─── Afdwingend: de app ───');
  {
    const [ctx, p] = await nieuw();
    const resp = await p.goto(BASE + '/app.html', { waitUntil: 'load' });
    ok('server stuurt de CSP afdwingend', !!(await resp.allHeaders())['content-security-policy']);
    await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
    await p.goto(BASE + '/app.html?demo=1', { waitUntil: 'load' }); await p.waitForTimeout(2500);
    ok('app start: React en de nav staan er, versie bekend', await p.evaluate(() => typeof React === 'object' && document.querySelectorAll('#nav button').length > 3 && typeof APP_VERSION === 'string'));
    ok('voorbeelddata geladen (fetch naar demo-dataset.json mag)', await p.evaluate(() => T.length > 100), String(await p.evaluate(() => T.length)));
    const paginas = await p.evaluate(() => Object.keys(PAGES));
    const kapot = [];
    for (const pg of paginas) {
      await p.evaluate(x => { try { hideOnboarding(); } catch (e) {} go(x); }, pg); await p.waitForTimeout(250);
      const leeg = await p.evaluate(() => (document.getElementById('content') || document.querySelector('main') || document.body).innerText.trim().length < 20);
      if (leeg) kapot.push(pg);
    }
    ok(`alle ${paginas.length} pagina's renderen`, kapot.length === 0, kapot.join());
    for (const t of ['accounts', 'weergave', 'tags', 'ai', 'data', 'updates', 'wissen']) { await p.evaluate(x => { STATE.setTab = x; go('instellingen'); }, t); await p.waitForTimeout(120); }
    await p.evaluate(() => { openForm(null); }); await p.waitForTimeout(200); await p.evaluate(() => { formDirty = false; closeForm(); });
    await p.evaluate(() => { setTheme('dark'); render(); }); await p.waitForTimeout(200); await p.evaluate(() => { setTheme('light'); render(); });
    const v1 = await schendingen(p);
    ok('geen CSP-schending tijdens het rondlopen', v1.length === 0, v1.slice(0, 4).join(' | '));

    console.log('─── Elke externe host is toegestaan ───');
    const geblokt = await p.evaluate(async urls => {
      window.__csp = [];
      await Promise.all(urls.map(u => fetch(u, { method: 'POST', body: '{}', mode: 'no-cors' }).catch(() => {})));
      await new Promise(r => setTimeout(r, 300)); return window.__csp.slice();
    }, VERBINDINGEN);
    ok(`${VERBINDINGEN.length} hosts geven geen schending`, geblokt.length === 0, geblokt.join(' | '));
    const scr = await p.evaluate(async () => {
      window.__csp = [];
      const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; document.head.appendChild(s);
      const i = new Image(); i.src = 'https://s3.tradingview.com/snapshots/x/x.png'; document.body.appendChild(i);
      await new Promise(r => setTimeout(r, 400)); return window.__csp.slice();
    });
    ok('Google-login-script (Drive) en screenshot-URLs van buiten mogen', scr.length === 0, scr.join(' | '));
    csp.splice(0);

    console.log('─── De policy bijt echt ───');
    const bijt = await p.evaluate(async () => {
      window.__csp = [];
      await fetch('https://voorbeeld-niet-toegestaan.example/x').catch(() => {});
      const s = document.createElement('script'); s.src = 'https://evil.example/x.js'; document.head.appendChild(s);
      await new Promise(r => setTimeout(r, 300)); return window.__csp.slice();
    });
    ok('fetch en script naar een onbekende host worden geblokkeerd', bijt.some(x => /connect-src/.test(x)) && bijt.some(x => /script-src/.test(x)), bijt.join(' | '));
    csp.splice(0);
    await ctx.close();
  }

  console.log('─── Afdwingend: lege journal, telefoonbreedte ───');
  {
    const [ctx, p] = await nieuw({ width: 390, height: 844 });
    await p.goto(BASE + '/app', { waitUntil: 'load' });
    await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
    await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1500);
    ok('lege journal start', await p.evaluate(() => Array.isArray(T) && T.length === 0));
    const v = await schendingen(p);
    ok('geen CSP-schending', v.length === 0, v.slice(0, 4).join(' | '));
    await ctx.close();
  }

  console.log('─── Afdwingend: landing ───');
  for (const u of ['/', '/index.html']) {
    const [ctx, p] = await nieuw();
    await p.goto(BASE + u, { waitUntil: 'load' }); await p.waitForTimeout(1200);
    ok(`${u}: landing rendert en het script draait (knoppen gevuld)`, await p.evaluate(() => !!document.querySelector('#heroCta .pri')));
    const v = await schendingen(p);
    ok(`${u}: geen CSP-schending`, v.length === 0, v.slice(0, 4).join(' | '));
    await ctx.close();
  }

  await b.close(); srv.close();
  ok('geen JS-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== CSP: ${pass}/${pass + fail} ===`);
  process.exit(fail ? 1 : 0);
})();
