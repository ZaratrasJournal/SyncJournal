// Landingspagina (site/index.html) ↔ journal (site/app.html), 24-09-2026.
// Nieuwe bezoeker, terugkerende gebruiker, "Landingspagina overslaan", tegels, rondkijken,
// de Rustig/Standaard/Alles-keuze, het logo terug, reduced motion, en robots/sitemap.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const F = f => 'file:///' + path.resolve('site', f).split(path.sep).join('/');
const LANDING = F('index.html'), APP = F('app.html');

(async () => {
  const b = await chromium.launch(); const errs = [];
  const nieuw = async (opts = {}) => { const ctx = await b.newContext({ viewport: { width: 1280, height: 820 }, ...opts }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e).split('\n')[0])); p.on('dialog', d => d.accept()); return [ctx, p]; };
  const url = p => p.url().replace(/^.*\/site\//, '');

  console.log('─── Nieuwe bezoeker ───');
  {
    const [ctx, p] = await nieuw();
    await p.goto(LANDING, { waitUntil: 'load' }); await p.waitForTimeout(300);
    ok('blijft op de landingspagina (geen redirect)', url(p) === 'index.html', url(p));
    ok('knop "Begin je journal" → app.html?view=standaard', await p.evaluate(() => { const a = document.querySelector('#heroCta .pri'); return a && a.textContent.includes('Begin je journal') && a.getAttribute('href') === 'app.html?view=standaard'; }));
    ok('"Rondkijken" → app.html?demo=1&view=standaard', await p.evaluate(() => document.querySelector('#heroCta .btn:not(.pri)').getAttribute('href') === 'app.html?demo=1&view=standaard'));
    await p.click('#vopts [data-v="rustig"]');
    ok('keuze Rustig → knoppen geven ?view=rustig mee', await p.evaluate(() => document.querySelector('#heroCta .pri').getAttribute('href') === 'app.html?view=rustig' && document.querySelector('#closeCta .pri').getAttribute('href') === 'app.html?view=rustig'));
    await p.waitForTimeout(3800);
    ok('hero speelt af: bubbels zijn naar de curve gevlogen, cijfers staan', await p.evaluate(() => document.querySelectorAll('.bub.fly').length >= 6 && document.getElementById('sN').textContent === '10'));
    await p.click('#heroCta .pri'); await p.waitForLoadState('load'); await p.waitForTimeout(900);
    ok('landt in de journal, URL is schoon (geen ?view meer)', url(p) === 'app.html', url(p));
    ok('journal: geen oud welkomscherm, sj_welcomed gezet, preset Rustig', await p.evaluate(() => !document.getElementById('welcome').classList.contains('on') && DB.load('welcomed', false) === true && VIEW.preset === 'rustig'));
    await ctx.close();
  }

  console.log('─── Tegels en rondkijken ───');
  {
    const [ctx, p] = await nieuw();
    await p.goto(LANDING, { waitUntil: 'load' }); await p.waitForTimeout(200);
    await p.evaluate(() => document.querySelector('[data-page="analytics"]').scrollIntoView()); await p.click('[data-page="analytics"]'); await p.waitForLoadState('load'); await p.waitForTimeout(900);
    ok('tegel Analytics → journal opent op Analytics, URL schoon', url(p) === 'app.html' && await p.evaluate(() => STATE.page === 'analytics'), url(p));
    await p.goto(APP + '?demo=1', { waitUntil: 'load' }); await p.waitForTimeout(2500);
    ok('?demo=1 → voorbeelddata geladen, URL schoon', url(p) === 'app.html' && await p.evaluate(() => T.length > 0), url(p) + ' T=' + await p.evaluate(() => T.length));
    await ctx.close();
  }

  console.log('─── Terugkerende gebruiker ───');
  {
    const [ctx, p] = await nieuw();
    await p.addInitScript(() => { localStorage.setItem('sj_welcomed', 'true'); localStorage.setItem('sj_view', JSON.stringify({ preset: 'alles', v: {}, nudged: 0 })); });
    await p.goto(LANDING, { waitUntil: 'load' }); await p.waitForTimeout(300);
    ok('blijft op de landing (LANDING_ALTIJD), knop "Open mijn journal" → app.html', url(p) === 'index.html' && await p.evaluate(() => { const a = document.querySelector('#heroCta .pri'); return /Open mijn journal/.test(a.textContent) && a.getAttribute('href') === 'app.html'; }));
    ok('zijn eerdere keuze (Alles) staat aan; hij wordt niet opnieuw meegegeven', await p.evaluate(() => document.querySelector('#vopts button.on').dataset.v === 'alles'));
    await p.waitForTimeout(3600);
    ok('hero-animatie speelt ook voor hem', await p.evaluate(() => document.querySelectorAll('.bub.fly').length >= 6));
    ok('de landing heeft niets geschreven', await p.evaluate(() => Object.keys(localStorage).sort().join() === 'sj_view,sj_welcomed'), await p.evaluate(() => Object.keys(localStorage).join()));
    await ctx.close();
  }

  console.log('─── Landingspagina overslaan ───');
  {
    const [ctx, p] = await nieuw();
    await p.addInitScript(() => { localStorage.setItem('sj_welcomed', 'true'); localStorage.setItem('sj_skip_landing', 'true'); });
    await p.goto(LANDING, { waitUntil: 'load' }); await p.waitForTimeout(1200);
    ok('aan → meteen door naar de journal', url(p) === 'app.html', url(p));
    await p.goto(LANDING + '?landing=1', { waitUntil: 'load' }); await p.waitForTimeout(400);
    ok('?landing=1 (het logo) toont de landing tóch', url(p).startsWith('index.html'), url(p));
    await ctx.close();
  }

  console.log('─── In de journal: instelling en logo ───');
  {
    const [ctx, p] = await nieuw();
    await p.goto(APP, { waitUntil: 'load' }); await p.waitForTimeout(900);
    ok('verse start zonder landing: geen overlay, welcomed gezet', await p.evaluate(() => !document.getElementById('welcome').classList.contains('on') && DB.load('welcomed', false) === true));
    const r = await p.evaluate(() => { STATE.setTab = 'weergave'; go('instellingen'); const row = [...document.querySelectorAll('.setrow')].find(x => /Landingspagina overslaan/.test(x.textContent)); const sw = row && row.querySelector('.sw'); const uit = sw && !sw.classList.contains('on'); sw && sw.click(); return { row: !!row, uit, na: DB.load('skip_landing', false) }; });
    ok('Instellingen → Weergave: "Landingspagina overslaan", standaard uit, schakelaar schrijft sj_skip_landing', r.row && r.uit && r.na === true, JSON.stringify(r));
    await p.evaluate(() => toggleSkipLanding());
    ok('en weer uit', await p.evaluate(() => DB.load('skip_landing', false) === false));
    await p.click('.logo'); await p.waitForLoadState('load'); await p.waitForTimeout(300);
    ok('logo → landingspagina, met ?landing=1', url(p) === 'index.html?landing=1', url(p));
    await ctx.close();
  }

  console.log('─── Reduced motion ───');
  {
    const [ctx, p] = await nieuw({ reducedMotion: 'reduce' });
    await p.goto(LANDING, { waitUntil: 'load' }); await p.waitForTimeout(500);
    ok('geen animatie: eindtoestand meteen (curve, coins op de curve, cijfers)', await p.evaluate(() => document.getElementById('hero').classList.contains('static') && document.getElementById('sN').textContent === '10' && document.querySelectorAll('.bub.fly').length === 0));
    ok('coin-strip staat stil', await p.evaluate(() => getComputedStyle(document.getElementById('track')).animationName === 'none'));
    await ctx.close();
  }

  console.log('─── Mobiel ───');
  {
    const [ctx, p] = await nieuw({ viewport: { width: 390, height: 844 } });
    await p.goto(LANDING, { waitUntil: 'load' }); await p.waitForTimeout(4000);
    ok('geen horizontale scroll', await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    await ctx.close();
  }

  console.log('─── Bestanden ───');
  {
    const rb = fs.readFileSync(path.resolve('site/robots.txt'), 'utf8'), sm = fs.readFileSync(path.resolve('site/sitemap.xml'), 'utf8'), hd = fs.readFileSync(path.resolve('site/_headers'), 'utf8');
    ok('robots.txt: landing toegestaan, app niet, sitemap genoemd', /Allow: \/\n/.test(rb) && /Disallow: \/app\n/.test(rb) && /Sitemap: https:\/\/syncjournal\.nl\/sitemap\.xml/.test(rb));
    ok('sitemap.xml: landing + privacy, niet de app', /<loc>https:\/\/syncjournal\.nl\/<\/loc>/.test(sm) && /privacy\.html/.test(sm) && !/app\.html/.test(sm));
    ok('_headers: app.html en /app revalideren altijd', /\/app\.html\s*\n\s*Cache-Control: no-cache/.test(hd) && /\/app\s*\n\s*Cache-Control: no-cache/.test(hd));
    const idx = fs.readFileSync(path.resolve('site/index.html'), 'utf8');
    ok('landing: geen demo-balk, geen externe scripts, canonical + og:image', !/demobar/.test(idx) && !/<script src=/.test(idx) && /rel="canonical"/.test(idx) && /og:image/.test(idx));
    ok('tekst belooft alleen wat bestaat: Blofin/OKX/Hyperliquid/Kraken (bèta), CSV-import, back-up', /Blofin, OKX, Hyperliquid en Kraken Futures \(bèta\)/.test(idx) && /CSV-import/.test(idx) && /Google Drive/.test(idx) && !/testimonial|gebruikers vertrouwen|revolutionair|ultiem/i.test(idx));
  }

  ok('geen JS-errors totaal', errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));
  console.log(`\n=== Landingspagina: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
