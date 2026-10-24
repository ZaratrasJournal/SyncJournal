// Thema's: SyncJournal heeft licht en donker. Per thema rendert elke pagina zonder JS-fout,
// met een achtergrond die bij het thema past (geen wit scherm in donker), en de themaknop
// rechtsboven wisselt, onthoudt de keuze na herladen en toont het juiste icoon.
// Screenshots per thema × pagina in tests/screenshots/themes/ voor visuele controle.
//
// Herschreven in T2 (24-10-2026): de oude spec liep zes thema's van de oude app af; theme-toggle
// (classic ↔ light) is hierin opgegaan.
const { chromium } = require('playwright');
const fs = require('fs');
const H = require('./helpers/dov-page');
const { volledig } = require('./helpers/dov-datasets');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

// Volledige dataset zonder koppelingen (geen sync-pogingen) en zonder eigen thema/privacy.
const DATA = (() => { const d = volledig(); delete d.conns; delete d.settings; d.sync = { auto: false, interval: '30m' }; return d; })();
const DIR = 'tests/screenshots/themes';
// relatieve luminantie van de body-achtergrond; licht ≈ 0,9+, donker ≈ 0,01
const LUM = () => { const m = getComputedStyle(document.body).backgroundColor.match(/\d+(\.\d+)?/g).map(Number);
  const c = m.slice(0, 3).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  const b = await chromium.launch(); const { p, errs } = await H.openJournal(b);
  await H.seed(p, DATA);
  const paginas = await p.evaluate(() => Object.keys(PAGES));

  console.log('─── Themaknop ───');
  const start = await p.evaluate(() => ({ theme: STATE.theme, dark: document.body.classList.contains('dark'), icoon: document.getElementById('btnTheme').innerHTML }));
  ok('standaard licht: geen dark-class', start.theme === 'light' && !start.dark, JSON.stringify(start));
  await p.click('#btnTheme');
  const na = await p.evaluate(() => ({ theme: STATE.theme, dark: document.body.classList.contains('dark'), icoon: document.getElementById('btnTheme').innerHTML, opgeslagen: JSON.parse(localStorage.getItem('sj_state') || '{}').theme }));
  ok('klik → donker, dark-class aan, keuze opgeslagen', na.theme === 'dark' && na.dark && na.opgeslagen === 'dark', JSON.stringify({ ...na, icoon: undefined }));
  ok('het icoon wisselt mee', na.icoon && na.icoon !== start.icoon);
  await H.reload(p);
  ok('na herladen nog steeds donker', await p.evaluate(() => STATE.theme === 'dark' && document.body.classList.contains('dark')));
  await p.click('#btnTheme');
  ok('nog een klik → terug naar licht', await p.evaluate(() => STATE.theme === 'light' && !document.body.classList.contains('dark')));

  for (const theme of ['light', 'dark']) {
    console.log(`─── ${theme} ───`);
    await p.evaluate(t => setTheme(t), theme);
    await p.waitForTimeout(500);   // body heeft transition: background .35s
    const lum = await p.evaluate(LUM);
    ok(`achtergrond past bij ${theme} (luminantie ${lum.toFixed(3)})`, theme === 'light' ? lum > 0.7 : lum < 0.1);
    const fout0 = errs.length, leeg = [];
    for (const pg of paginas) {
      await H.go(p, pg);
      const n = await p.evaluate(() => document.getElementById('main').innerText.trim().length);
      if (n < 20) leeg.push(pg);
      await H.stil(p); await p.screenshot({ path: `${DIR}/${theme}-${pg}.png`, fullPage: false });
    }
    ok(`elke pagina rendert in ${theme} (${paginas.length})`, leeg.length === 0, leeg.join(','));
    ok(`geen JS-fouten in ${theme}`, errs.length === fout0, errs.slice(fout0, fout0 + 2).join(' | '));
    await H.go(p, 'trades');
    await p.evaluate(() => openForm(T[0].id));
    ok(`trade-formulier opent in ${theme}`, await p.evaluate(() => document.getElementById('modal').classList.contains('on')));
    await p.screenshot({ path: `${DIR}/${theme}-formulier.png` });
    await p.evaluate(() => closeForm());
  }

  ok('geen JS-fouten totaal', errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n=== Thema's: ${pass}/${pass + fail} ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
