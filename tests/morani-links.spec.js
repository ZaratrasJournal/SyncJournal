// Morani-links (X, YouTube, website): onderaan het linkermenu met kopje "Morani", op 390px
// onderaan het uitklapmenu, en één regel onderaan de FAQ. Licht en donker zonder JS-fouten.
const { chromium } = require('playwright');
const { openJournal, go } = require('./helpers/dov-page.js');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const LINKS = [
  ['https://x.com/moranitrading', 'Morani op X'],
  ['https://www.youtube.com/@moranitraden', 'Morani op YouTube'],
  ['https://moranitraden.nl/', 'moranitraden.nl'],
];
// De drie links in een blok: href, target, rel en aria-label, in deze volgorde.
const linksIn = (p, sel) => p.evaluate(s => [...document.querySelectorAll(s + ' a')].map(a => ({
  href: a.getAttribute('href'), target: a.target, rel: a.rel, aria: a.getAttribute('aria-label') })), sel);
const klopt = (got, sel) => {
  ok(`${sel}: precies de drie Morani-URL's`, got.length === 3 && LINKS.every(([u], i) => got[i].href === u), JSON.stringify(got.map(g => g.href)));
  ok(`${sel}: openen in een nieuw tabblad met noopener noreferrer`, got.length === 3 && got.every(g => g.target === '_blank' && /\bnoopener\b/.test(g.rel) && /\bnoreferrer\b/.test(g.rel)), JSON.stringify(got.map(g => g.rel)));
  ok(`${sel}: elk een aria-label`, got.length === 3 && LINKS.every(([, l], i) => got[i].aria === l), JSON.stringify(got.map(g => g.aria)));
};

(async () => {
  const b = await chromium.launch();

  console.log('─── Menu (desktop) ───');
  {
    const { ctx, p, errs } = await openJournal(b);
    klopt(await linksIn(p, '.side-soc'), 'menu');
    const pos = await p.evaluate(() => {
      const h = document.querySelector('.side-soc .soc-h'), a = document.querySelector('.side-soc a');
      const last = [...document.querySelectorAll('#navbot button')].pop();
      if (!h || !a || !last) return null;
      return { tekst: h.textContent.trim(), kop: h.getBoundingClientRect(), link: a.getBoundingClientRect(), knop: last.getBoundingClientRect() };
    });
    ok('kopje "Morani" staat boven de iconen', pos && pos.tekst === 'Morani' && pos.kop.bottom <= pos.link.top + 1, JSON.stringify(pos && pos.tekst));
    ok('en onder de laatste menuknop', pos && pos.knop.bottom <= pos.kop.top + 1);
    ok('iconen zichtbaar in beeld', pos && pos.link.width > 0 && pos.link.bottom <= 900);

    console.log('─── FAQ ───');
    await go(p, 'faq');
    const regel = await p.evaluate(() => { const r = document.querySelector('.faqwrap .morline'); return r ? r.textContent.replace(/\s+/g, ' ').trim() : ''; });
    ok('regel "Meer van Morani: X · YouTube · moranitraden.nl"', regel === 'Meer van Morani: X · YouTube · moranitraden.nl', regel);
    klopt(await linksIn(p, '.faqwrap .morline'), 'FAQ');

    console.log('─── Thema ───');
    for (const t of ['dark', 'light']) {
      await p.evaluate(th => setTheme(th), t); await p.waitForTimeout(150);
      ok(`${t}: menu-links staan er nog en geen JS-fouten`, (await linksIn(p, '.side-soc')).length === 3 && errs.length === 0, errs.join(' | '));
    }
    await ctx.close();
  }

  console.log('─── Telefoon (390px) ───');
  {
    const { ctx, p, errs } = await openJournal(b, { viewport: { width: 390, height: 844 } });
    const inBeeld = () => p.evaluate(() => { const as = [...document.querySelectorAll('.side-soc a')]; return as.length === 3 && as.every(a => { const r = a.getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; }); });
    ok('menu dicht: iconen niet in beeld', (await linksIn(p, '.side-soc')).length === 3 && !(await inBeeld()));
    await p.click('#btnMenu'); await p.waitForTimeout(400);
    ok('menu open: de drie iconen staan in het uitklapmenu, in beeld', await inBeeld());
    ok('onderaan het uitklapmenu (onder de laatste menuknop)', await p.evaluate(() => { const last = [...document.querySelectorAll('#navbot button')].pop(); const s = document.querySelector('.side-soc'); return !!s && last.getBoundingClientRect().bottom <= s.getBoundingClientRect().top + 1; }));
    for (const t of ['dark', 'light']) { await p.evaluate(th => setTheme(th), t); await p.waitForTimeout(150); }
    ok('390px licht en donker: geen JS-fouten', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  console.log(`\n=== Morani-links: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
