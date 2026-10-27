// Gedeeld voor de plan3-*-specs: de repo via een kleine localhost-server (plan en journal op dezelfde
// origin, zoals syncjournal.nl/plan en /app), een teller voor ✓/✗, en alles buiten localhost geblokkeerd.
// Waarom geen file://: twee tabbladen op file:// zagen in Chromium af en toe elkaars localStorage niet
// (3 van de 7 runs van plan3-lagen, 27-10-2026), en de app hoort volgens CLAUDE.md via localhost te draaien.
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.css': 'text/css' };

function server() {
  return new Promise(res => {
    const s = http.createServer((req, rsp) => {
      const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const f = path.join(ROOT, u.endsWith('/') ? u + 'index.html' : u);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end('niet gevonden'); }
      rsp.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(rsp);
    });
    s.listen(0, '127.0.0.1', () => { const base = 'http://localhost:' + s.address().port; res({ base, TP: base + '/tradingplan/tradingplan.html', APP: base + '/work/syncjournal.html', close: () => s.close() }); });
  });
}
// Alleen localhost; fonts en andere externe adressen worden afgebroken (geen netwerk in de test).
const alleenLokaal = ctx => ctx.route('**/*', r => /^https?:\/\/localhost[:/]/.test(r.request().url()) ? r.continue() : r.abort());
function teller(naam) {
  const t = { pass: 0, fail: 0, ok(n, c, e) { c ? (t.pass++, console.log('  ✓ ' + n)) : (t.fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); },
    eind() { console.log(`\n=== ${naam}: ${t.pass}/${t.pass + t.fail} ===`); return t.fail ? 1 : 0; } };
  return t;
}
const SHOTS = path.join(ROOT, 'tests', 'screenshots', 'plan3'); fs.mkdirSync(SHOTS, { recursive: true });
// Zet het thema zoals de journal het bewaart en herlaad.
async function thema(p, donker) { await p.evaluate(t => localStorage.setItem('sj_state', JSON.stringify({ theme: t })), donker ? 'dark' : 'light'); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(250); }
// Screenshots licht/donker × 1280/390; geeft per breedte terug of er horizontaal gescrold kan worden.
async function vierShots(p, naam, voor) {
  const scroll = {};
  for (const donker of [false, true]) for (const w of [1280, 390]) {
    await p.setViewportSize({ width: w, height: 900 }); await thema(p, donker); if (voor) await voor(p);
    await p.screenshot({ path: path.join(SHOTS, `${naam}-${donker ? 'donker' : 'licht'}-${w}.png`), fullPage: true });
    if (w === 390) scroll[donker ? 'donker' : 'licht'] = await p.evaluate(() => document.documentElement.scrollWidth > 391);
  }
  await p.setViewportSize({ width: 1280, height: 900 }); await thema(p, false);
  return scroll;
}
module.exports = { server, alleenLokaal, teller, SHOTS, thema, vierShots, ROOT };
