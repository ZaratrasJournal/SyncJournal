// Toegankelijkheid: axe-core (WCAG 2.1 A + AA) over Dashboard, Trades, Instellingen en het
// trade-formulier, in licht en donker. Staat in de uitsluitlijst van run-all-sj.js (eigen,
// tragere poort): node tests/a11y.spec.js
//
// Blokkeert alleen op impact "critical". "serious" (vooral kleurcontrast) en lager worden per
// scherm gelogd: dat zijn vaak bewuste ontwerpkeuzes, die we eerst als baseline willen kennen.
//
// Herschreven in T2 (24-10-2026): de oude spec liep zes thema's van de oude app af.
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const H = require('./helpers/dov-page');
const { volledig } = require('./helpers/dov-datasets');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const BLOKKEREND = ['critical'];
const SCHERMEN = ['dashboard', 'trades', 'instellingen', 'formulier'];
const DATA = (() => { const d = volledig(); delete d.conns; delete d.settings; d.sync = { auto: false, interval: '30m' }; return d; })();

(async () => {
  const b = await chromium.launch(); const { p, errs } = await H.openJournal(b);
  await H.seed(p, DATA);
  let formulierGeopend = false;
  for (const theme of ['light', 'dark']) {
    console.log(`─── ${theme} ───`);
    await p.evaluate(t => setTheme(t), theme);
    await p.waitForTimeout(500);   // body heeft transition: background .35s
    for (const scherm of SCHERMEN) {
      if (scherm === 'formulier') { await H.go(p, 'trades'); await p.evaluate(() => openForm(T[0].id)); await p.waitForTimeout(300); formulierGeopend = true; }
      else { await p.evaluate(() => { try { closeForm(); } catch (e) {} }); await H.go(p, scherm); }
      await H.stil(p);
      const r = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      const per = { critical: 0, serious: 0, moderate: 0, minor: 0 };
      r.violations.forEach(v => { per[v.impact] = (per[v.impact] || 0) + v.nodes.length; });
      console.log(`    ${theme}/${scherm}: critical ${per.critical} · serious ${per.serious} · moderate ${per.moderate} · minor ${per.minor}`);
      r.violations.filter(v => v.impact !== 'minor').slice(0, 4).forEach(v => console.log(`      [${v.impact}] ${v.id} ${v.nodes.length}× — ${v.help} · ${v.nodes[0].target.join(' ')}`));
      const blok = [];
      for (const v of r.violations.filter(x => BLOKKEREND.includes(x.impact))) for (const n of v.nodes) blok.push(v.id + ' ' + n.target.join(' '));
      ok(`${theme}/${scherm}: geen critical a11y-fouten (${r.passes.length} regels geslaagd)`, blok.length === 0 && r.passes.length > 10, blok.slice(0, 4).join(', '));
      if (scherm === 'formulier') {
        const labels = r.violations.filter(v => v.id === 'label').reduce((n, v) => n + v.nodes.length, 0);
        ok(`${theme}/formulier: elk invoerveld heeft een label (axe "label")`, labels === 0, labels + '× zonder label');
        // Een schermlezer hoort de zichtbare labeltekst, niet alleen "invoerveld".
        const namen = {};
        for (const [veld, naam] of [['Datum', /^Datum$/], ['Entry', /^Entry$/], ['Exit', /^Exit$/], ['P&L ($)', /^P&L \(\$\)$/]]) namen[veld] = await p.getByRole('textbox', { name: naam }).count();
        ok(`${theme}/formulier: velden zijn vindbaar op hun zichtbare label (Datum, Entry, Exit, P&L)`, Object.values(namen).every(n => n === 1), JSON.stringify(namen));
      }
      else if (formulierGeopend) ok(`${theme}/${scherm}: geen formulierveld van een gesloten formulier in de toegankelijkheidsboom`, await p.locator('#modal').ariaSnapshot() === '' && await p.getByRole('textbox', { name: /^Entry$/ }).count() === 0,
        (await p.locator('#modal').ariaSnapshot()).slice(0, 120));
    }
  }
  ok('geen JS-fouten', errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n=== A11y: ${pass}/${pass + fail} ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
