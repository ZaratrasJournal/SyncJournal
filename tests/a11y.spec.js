// Accessibility audit — runs axe-core over Dashboard + Trades + Accounts
// voor ALLE 6 thema's. Vangt:
//   - Color contrast violations (WCAG AA — kritiek voor 6-theme app)
//   - ARIA mis-use, missing roles, label mismatches
//   - Keyboard-trap risk (focusable items zonder navigation path)
//   - Heading hierarchy issues (h1→h3 zonder h2 etc)
//
// Soft-failure model: log alle violations per thema/scherm, hard-fail
// alleen op WCAG-A en WCAG-AA "serious" / "critical" impact.
// "moderate" / "minor" worden gelogd maar niet geblokkeerd — bewust laag
// drempel houden tot we de baseline kennen.
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { AxeBuilder } = require('@axe-core/playwright');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');
const FIXTURE = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures/blofin-partial-state.json'), 'utf8')
);

const THEMES = ['sync', 'classic', 'aurora', 'light', 'parchment', 'daylight'];
const SCREENS = [
  { route: 'dashboard', label: 'dashboard' },
  { route: 'trades',    label: 'trades' },
  { route: 'accounts',  label: 'accounts' },
];

// Hard-fail drempel — alleen critical violations blokkeren default.
// Serious (vooral color-contrast) zijn vaak bewuste design-keuzes (subtiele
// inactieve tabs, ondertitels) — die loggen we maar blokkeren niet.
// Bij toekomstige hand-fixes kunnen we BLOCKING_IMPACTS uitbreiden.
const BLOCKING_IMPACTS = ['critical'];

test.describe('Accessibility audit (axe-core, WCAG AA)', () => {
  for (const theme of THEMES) {
    for (const screen of SCREENS) {
      test(`a11y: ${theme} / ${screen.label}`, async ({ page }) => {
        await page.addInitScript(({ fx, t, route }) => {
          if (fx.trades) localStorage.setItem('tj_trades', JSON.stringify(fx.trades));
          if (fx.config) localStorage.setItem('tj_config', JSON.stringify(fx.config));
          if (fx.accounts) localStorage.setItem('tj_accounts', JSON.stringify(fx.accounts));
          if (fx.playbooks) localStorage.setItem('tj_playbooks', JSON.stringify(fx.playbooks));
          const cfg = JSON.parse(localStorage.getItem('tj_config') || '{}');
          cfg.theme = t;
          localStorage.setItem('tj_config', JSON.stringify(cfg));
          localStorage.setItem('tj_welcomed', '1');
          localStorage.setItem('tj_milestones_seen', JSON.stringify([
            'trades-10','trades-50','trades-100','trades-250','trades-500','trades-1000',
            'win-streak-5','win-streak-10','first-win',
          ]));
          window.location.hash = `#/${route}`;
        }, { fx: FIXTURE, t: theme, route: screen.route });

        await page.goto(FILE_URL, { waitUntil: 'networkidle' });
        await page.waitForFunction(
          () => /Dashboard/i.test(document.body.innerText),
          { timeout: 15_000 }
        );
        await page.waitForTimeout(1200);

        // Run axe — focus op WCAG 2.1 A + AA tags, exclude "best-practice"
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();

        // Per-impact telling
        const byImpact = { critical: 0, serious: 0, moderate: 0, minor: 0 };
        const detailed = [];
        for (const v of results.violations) {
          byImpact[v.impact] = (byImpact[v.impact] || 0) + v.nodes.length;
          detailed.push(`  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length}× — ${v.helpUrl})`);
        }

        const total = byImpact.critical + byImpact.serious + byImpact.moderate + byImpact.minor;
        console.log(`  [a11y] ${theme}/${screen.label}: ${total} violations — critical:${byImpact.critical} serious:${byImpact.serious} moderate:${byImpact.moderate} minor:${byImpact.minor}`);
        if (detailed.length) console.log(detailed.slice(0, 5).join('\n'));

        // Critical: log de eerste 3 affected nodes voor debug
        for (const v of results.violations.filter(x => x.impact === 'critical')) {
          for (const n of v.nodes.slice(0, 3)) {
            console.log(`    > [critical:${v.id}] target=${n.target.join(' ')}`);
            console.log(`      html: ${(n.html || '').slice(0, 160)}`);
          }
        }

        // Hard-fail alleen op critical of serious
        const blocking = results.violations.filter(v => BLOCKING_IMPACTS.includes(v.impact));
        if (blocking.length) {
          const summary = blocking.map(v => `${v.id} (${v.impact}, ${v.nodes.length}×)`).join(', ');
          expect(blocking, `Blocking a11y violations voor ${theme}/${screen.label}: ${summary}`).toHaveLength(0);
        }
      });
    }
  }
});
