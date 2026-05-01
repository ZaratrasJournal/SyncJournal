// Comprehensive multi-screen design-review spec.
//
// Loops 6 thema's × 3 schermen (Dashboard / Trades / Instellingen) = 18 screenshots,
// alle gevoed met dezelfde Blofin-fixture (16 trades, 1 partial) zodat we niet alleen
// de empty-state zien.
//
// Output: tests/screenshots/design-review/<theme>-<screen>.png
// Baseline: tests/screenshots/baseline/design-review/<theme>-<screen>.png
//
// Voor pre-commit smoke gebruik tests/themes.spec.js (sneller, alleen Dashboard).
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { diffPng } = require('./helpers/diff-baseline');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');
const FIXTURE = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures/blofin-partial-state.json'), 'utf8')
);
const SHOT_DIR = path.join(__dirname, 'screenshots/design-review');
const BASELINE_DIR = path.join(__dirname, 'screenshots/baseline/design-review');
const DIFF_DIR = path.join(__dirname, 'screenshots/diff/design-review');

// Pixel-diff regressie threshold. Daadwerkelijke baseline-drift door dynamic
// content (live tickers, timestamps, mindset-quote rotatie) zit op 0.2-0.7%.
// 2% geeft ~3x veiligheidsmarge en vangt echte regressies (kleur-shifts,
// layout-wijzigingen) zonder false positives op rotatie.
const MAX_DIFF_RATIO = 0.02;

const THEMES = ['sync', 'classic', 'aurora', 'light', 'parchment', 'daylight'];
const SCREENS = [
  { route: 'dashboard', label: 'dashboard' },
  { route: 'trades',    label: 'trades' },
  { route: 'accounts',  label: 'accounts' }, // = Instellingen
];

test.describe('Design-review (multi-screen × multi-theme)', () => {
  for (const theme of THEMES) {
    for (const screen of SCREENS) {
      test(`${theme} / ${screen.label}`, async ({ page }) => {
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        page.on('console', m => {
          if (m.type() !== 'error') return;
          const text = m.text();
          if (/\[BABEL\] Note:/.test(text)) return;
          if (/Failed to load resource.*favicon/.test(text)) return;
          errors.push('[console] ' + text);
        });

        // Seed fixture + theme + skip welcome + skip milestones (anders blokkeert
        // 10-trades / first-win modal de screenshot)
        await page.addInitScript(({ fx, t, route }) => {
          if (fx.trades) localStorage.setItem('tj_trades', JSON.stringify(fx.trades));
          if (fx.config) localStorage.setItem('tj_config', JSON.stringify(fx.config));
          if (fx.accounts) localStorage.setItem('tj_accounts', JSON.stringify(fx.accounts));
          if (fx.playbooks) localStorage.setItem('tj_playbooks', JSON.stringify(fx.playbooks));
          // Theme override
          const cfg = JSON.parse(localStorage.getItem('tj_config') || '{}');
          cfg.theme = t;
          localStorage.setItem('tj_config', JSON.stringify(cfg));
          localStorage.setItem('tj_welcomed', '1');
          // Mark alle milestones als gezien — voorkom popup-blocker over fixture-data
          localStorage.setItem('tj_milestones_seen', JSON.stringify([
            'trades-10','trades-50','trades-100','trades-250','trades-500','trades-1000',
            'win-streak-5','win-streak-10','first-win',
          ]));
          // Initial route — set hash before mount
          window.location.hash = `#/${route}`;
        }, { fx: FIXTURE, t: theme, route: screen.route });

        await page.goto(FILE_URL, { waitUntil: 'networkidle' });
        await page.waitForFunction(
          () => /Dashboard/i.test(document.body.innerText),
          { timeout: 15_000 }
        );
        // Settle: theme effect + route navigation
        await page.waitForTimeout(1200);

        // Verify body theme class
        const className = await page.evaluate(() => document.body.className);
        expect(className, `body.className voor ${theme}`).toContain(`theme-${theme}`);

        // Verify route navigated
        const currentHash = await page.evaluate(() => window.location.hash);
        expect(currentHash, `route voor ${screen.label}`).toContain(screen.route);

        // Geen JS-errors
        expect(errors, `Geen JS-errors voor ${theme}/${screen.label}`).toHaveLength(0);

        // Screenshot
        const shotPath = path.join(SHOT_DIR, `${theme}-${screen.label}.png`);
        await page.screenshot({ path: shotPath, fullPage: false });

        // Pixel-diff vs baseline (soft threshold — dynamic content tolereren)
        const baselinePath = path.join(BASELINE_DIR, `${theme}-${screen.label}.png`);
        const diffPath = path.join(DIFF_DIR, `${theme}-${screen.label}.diff.png`);
        const result = await diffPng(shotPath, baselinePath, { diffPath });

        if (result.missingBaseline) {
          console.log(`  [diff] ${theme}/${screen.label}: BASELINE MISSING — kopieer huidige als baseline`);
        } else if (result.sizeMismatch) {
          throw new Error(`${theme}/${screen.label}: viewport-size mismatch met baseline`);
        } else {
          const pct = (result.ratio * 100).toFixed(2);
          console.log(`  [diff] ${theme}/${screen.label}: ${pct}% pixels gewijzigd (${result.numDiff}/${result.total})`);
          expect(
            result.ratio,
            `Pixel-diff voor ${theme}/${screen.label} = ${pct}% — overschrijdt drempel ${(MAX_DIFF_RATIO*100).toFixed(0)}%. Bekijk diff: ${diffPath}`
          ).toBeLessThan(MAX_DIFF_RATIO);
        }
      });
    }
  }
});
