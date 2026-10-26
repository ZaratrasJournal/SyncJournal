// F14 stap 5 (26-10-2026): "Hoe veilig is SyncJournal?" (site/veiligheid.html), the links to it
// from the landing footer, the privacy statement and Settings → Accounts, and an honest privacy
// statement about the Worker (what it counts, which exchanges go through it, Mori's own key).
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const F = f => 'file:///' + path.resolve(f).split(path.sep).join('/');

(async () => {
  const b = await chromium.launch(); const errs = [];
  const page = async (vp = { width: 1280, height: 900 }, scheme = 'light') => { const ctx = await b.newContext({ viewport: vp, colorScheme: scheme }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e).split('\n')[0])); p.on('dialog', d => d.accept()); return [ctx, p]; };

  console.log('─── site/veiligheid.html ───');
  ok('bestand bestaat', fs.existsSync('site/veiligheid.html'));
  const html = fs.readFileSync('site/veiligheid.html', 'utf8');
  const tekst = html.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  ok('titel "Hoe veilig is SyncJournal?"', /<title>[^<]*Hoe veilig is SyncJournal\?/.test(html) && /<h1>Hoe veilig is SyncJournal\?<\/h1>/.test(html));
  ok('lokaal in je browser', /lokaal|in je eigen browser/i.test(tekst));
  ok('read-only uitleg per exchange: Blofin, OKX, Kraken Futures', ['Blofin', 'OKX', 'Kraken Futures'].every(x => tekst.includes(x)) && /read-only|alleen lezen/i.test(tekst));
  ok('Hyperliquid: alleen een walletadres', /Hyperliquid[^.]*walletadres/i.test(tekst));
  ok('tussenserver: OKX en Kraken via de Worker, Blofin rechtstreeks', /tussenserver/i.test(tekst) && /Blofin[^.]*rechtstreeks/i.test(tekst));
  ok('wat de tussenserver niet bewaart', /bewaart[^.]*niet|niet[^.]*bewaard/i.test(tekst));
  ok('back-ups en sleutels: standaard zonder', /standaard[^.]*zonder|zonder[^.]*sleutels/i.test(tekst));
  ok('Mori met je eigen Anthropic-sleutel, nooit in een back-up', /Mori/.test(tekst) && /Anthropic/.test(tekst) && /nooit[^.]*back-up|back-up[^.]*nooit/i.test(tekst));
  ok('sleutel kwijt of gelekt: intrekken bij de exchange', /intrek|trek[^.]*in/i.test(tekst) && /gelekt|kwijt/i.test(tekst));
  ok('noemt de maker Zaratras, niet Denny', /Zaratras/.test(tekst) && !/Denny/.test(tekst));
  ok('links naar privacy en de app', /href="privacy\.html"/.test(html) && /href="app\.html"|href="\/app"/.test(html));
  ok('alleen kleuren via CSS-variabelen buiten :root', !/(color|background|border)[^;{}]*#[0-9a-f]{3,6}/i.test(html.replace(/:root\{[^}]*\}/g, '').replace(/<link[^>]*>/g, '')));

  for (const scheme of ['light', 'dark']) {
    for (const vp of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      const [ctx, p] = await page(vp, scheme);
      await p.goto(F('site/veiligheid.html'), { waitUntil: 'load' });
      const r = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bg: getComputedStyle(document.body).backgroundColor }));
      ok(`${scheme} ${vp.width}px: geen horizontale scroll`, r.sw <= r.cw + 1, JSON.stringify(r));
      if (vp.width === 1280) ok(`${scheme}: achtergrond volgt het thema`, scheme === 'dark' ? /rgb\((1\d|[0-9]),/.test(r.bg) : /rgb\(2[0-9]{2},/.test(r.bg), r.bg);
      await p.screenshot({ path: `tests/screenshots/veiligheid-${scheme}-${vp.width}.png`, fullPage: vp.width === 390 ? false : true });
      await ctx.close();
    }
  }

  console.log('─── Links ernaartoe ───');
  const landing = fs.readFileSync('site/index.html', 'utf8');
  ok('landing-footer linkt naar veiligheid.html', /<footer[\s\S]*href="veiligheid\.html"[\s\S]*<\/footer>/.test(landing));
  const priv = fs.readFileSync('site/privacy.html', 'utf8');
  ok('privacy.html linkt naar veiligheid.html', /href="veiligheid\.html"/.test(priv));
  ok('sitemap noemt veiligheid.html', /veiligheid\.html/.test(fs.readFileSync('site/sitemap.xml', 'utf8')));

  console.log('─── Privacyverklaring: de Worker eerlijk beschreven ───');
  const ptekst = priv.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  ok('welke exchanges via de Worker: OKX en Kraken; Blofin rechtstreeks; Hyperliquid openbaar', /OKX/.test(ptekst) && /Kraken/.test(ptekst) && /Blofin[^.]*rechtstreeks/i.test(ptekst) && /Hyperliquid/.test(ptekst));
  ok('wat hij telt: exchange, soort verzoek, uitkomst en de website (herkomst)', /exchange/.test(ptekst) && /soort verzoek/.test(ptekst) && /website/i.test(ptekst));
  ok('geen sleutels en geen IP-adres in de tellingen', /geen IP-adres/i.test(ptekst) && /sleutel/i.test(ptekst));
  ok('Mori: rechtstreeks naar Anthropic met je eigen sleutel', /Mori/.test(ptekst) && /Anthropic/.test(ptekst));
  ok('wisselkoers via Frankfurter/ECB genoemd', /ECB|Frankfurter/.test(ptekst));

  console.log('─── App: Instellingen → Accounts ───');
  {
    const [ctx, p] = await page();
    await p.goto(F('work/syncjournal.html'), { waitUntil: 'networkidle' });
    await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
    await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(500);
    await p.evaluate(() => { try { hideOnboarding(); } catch (e) {} STATE.setTab = 'accounts'; go('instellingen'); });
    await p.waitForTimeout(300);
    const intro = await p.evaluate(() => { const a = [...document.querySelectorAll('a')].find(x => /Hoe veilig is dit\?/.test(x.textContent)); return a ? a.getAttribute('href') : null; });
    ok('"Hoe veilig is dit?" bij de intro van Accounts', intro && /veiligheid\.html$/.test(intro), intro);
    for (const ex of ['okx', 'blofin', 'kraken', 'hyperliquid']) {
      const h = await p.evaluate(e => { STATE.connOpen = e; render(); const c = document.querySelector('.conncfg'); const a = c && [...c.querySelectorAll('a')].find(x => /Hoe veilig is dit\?/.test(x.textContent)); return a ? a.getAttribute('href') + '|' + a.getAttribute('target') : null; }, ex);
      ok(`${ex}: link in het koppel-paneel, opent in een nieuw tabblad`, h && /veiligheid\.html\|_blank$/.test(h), h);
    }
    ok('lokaal wijst de link naar site/veiligheid.html (die bestaat)', await p.evaluate(() => veiligUrl()) === '../site/veiligheid.html');
    await ctx.close();
  }

  ok('geen JS-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== Veiligheid: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
