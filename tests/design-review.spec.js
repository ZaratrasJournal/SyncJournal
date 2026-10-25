// Design-review: pixel-diff van de belangrijkste schermen in licht en donker, tegen een
// vastgelegde baseline. Thema-bugs zijn historisch onze grootste regressiecategorie (CLAUDE.md);
// dit is het vangnet daarvoor. Staat in de uitsluitlijst van run-all-sj.js (eigen, tragere poort):
//   node tests/design-review.spec.js
//
// Zelfde data en vaste klok bij elke run, zodat alleen een echte UI-wijziging verschil geeft.
// Screenshots: tests/screenshots/design-review/<thema>-<scherm>.png
// Baseline:    tests/screenshots/baseline/design-review/<thema>-<scherm>.png
// Baseline vastleggen of bijwerken ALLEEN na een bewuste UI-keuze (CLAUDE.md):
//   cp tests/screenshots/design-review/*.png tests/screenshots/baseline/design-review/
// Zonder baseline meldt de spec "overgeslagen" (⏭️ in de runner), niet groen.
//
// Herschreven in T2 (24-10-2026): de oude spec liep zes thema's van de oude app af; die
// baselines zijn weggehaald.
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const H = require('./helpers/dov-page');
const { volledig } = require('./helpers/dov-datasets');
const { diffPng } = require('./helpers/diff-baseline');
let pass = 0, fail = 0, zonder = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const SHOT_DIR = path.join(__dirname, 'screenshots/design-review');
const BASE_DIR = path.join(__dirname, 'screenshots/baseline/design-review');
const DIFF_DIR = path.join(__dirname, 'screenshots/diff/design-review');
// Meer dan 2% gewijzigde pixels = regressie (anti-aliasing op tekst blijft daar ruim onder).
const MAX_DIFF_RATIO = 0.02;
const KLOK = new Date('2026-05-20T12:00:00+02:00');   // na de laatste trade in de dataset
const SCHERMEN = ['dashboard', 'trades', 'analytics', 'playbook', 'instellingen'];
const DATA = (() => { const d = volledig(); delete d.conns; delete d.settings; d.sync = { auto: false, interval: '30m' }; return d; })();

(async () => {
  [SHOT_DIR, DIFF_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));
  const b = await chromium.launch();
  const { p, errs } = await H.openJournal(b, { klok: KLOK });
  await H.seed(p, DATA);
  // backup-banner en update-banner hangen af van opslag-tijdstempels; vast zetten
  await p.evaluate(() => { BK.ts = Date.now(); BK.snooze = 0; persistBK(); });

  for (const theme of ['light', 'dark']) {
    console.log(`─── ${theme} ───`);
    await p.evaluate(t => setTheme(t), theme);
    await p.waitForTimeout(500);   // body heeft transition: background .35s
    for (const scherm of SCHERMEN) {
      await H.go(p, scherm);
      await H.stil(p); await p.waitForTimeout(400);   // grafieken mounten na de render
      const naam = `${theme}-${scherm}`;
      const shot = path.join(SHOT_DIR, naam + '.png');
      await p.screenshot({ path: shot });
      const r = await diffPng(shot, path.join(BASE_DIR, naam + '.png'), { diffPath: path.join(DIFF_DIR, naam + '.diff.png') });
      if (r.missingBaseline) { zonder++; console.log(`  ⏭ ${naam}: geen baseline`); continue; }
      ok(`${naam}: ${(r.ratio * 100).toFixed(2)}% gewijzigd (max ${MAX_DIFF_RATIO * 100}%)`, !r.sizeMismatch && r.ratio < MAX_DIFF_RATIO, r.sizeMismatch ? 'ander formaat dan de baseline' : 'zie ' + path.relative(process.cwd(), path.join(DIFF_DIR, naam + '.diff.png')));
    }
  }
  ok('geen JS-fouten', errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n=== Design-review: ${pass}/${pass + fail}${zonder ? ` · ${zonder} zonder baseline, overgeslagen` : ''} ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
