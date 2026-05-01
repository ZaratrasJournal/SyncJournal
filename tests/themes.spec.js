// Multi-theme regressie-test — laadt de app voor elk van de 6 thema's,
// asserteert dat:
//   1. body krijgt class `theme-<X>`
//   2. Dashboard rendert (geen white-screen-of-death door theme-bug)
//   3. Geen JS-errors tijdens load
//   4. Versie zichtbaar
// Maakt screenshot per thema in tests/screenshots/themes/<theme>.png voor visuele review.
//
// Bron: voor toekomstige pixel-diff regressie eerst een baseline vastleggen
// (kopie naar tests/screenshots/baseline/themes/) wanneer de huidige output goed is.
const { test, expect } = require('@playwright/test');
const path = require('path');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');
const SHOT_DIR = path.join(__dirname, 'screenshots/themes');

const THEMES = ['sync', 'classic', 'aurora', 'light', 'parchment', 'daylight'];

test.describe('Multi-theme regressie', () => {
  for (const theme of THEMES) {
    test(`theme=${theme} laadt + body.className correct + geen JS-errors`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => {
        if (m.type() !== 'error') return;
        const text = m.text();
        if (/\[BABEL\] Note:/.test(text)) return;
        if (/Failed to load resource.*favicon/.test(text)) return;
        errors.push('[console] ' + text);
      });

      // Seed localStorage met gekozen theme + skip welcome modal
      await page.addInitScript((t) => {
        localStorage.setItem('tj_welcomed', '1');
        const existing = JSON.parse(localStorage.getItem('tj_config') || '{}');
        existing.theme = t;
        localStorage.setItem('tj_config', JSON.stringify(existing));
      }, theme);

      await page.goto(FILE_URL, { waitUntil: 'networkidle' });
      await page.waitForFunction(
        () => /Dashboard/i.test(document.body.innerText),
        { timeout: 15_000 }
      );
      // Settle voor late effects (theme wordt in useEffect gezet)
      await page.waitForTimeout(800);

      // 1. Body krijgt theme-class
      const className = await page.evaluate(() => document.body.className);
      expect(className, `body.className voor theme=${theme}`).toContain(`theme-${theme}`);

      // 2. Versie zichtbaar (sanity check)
      const html = await page.content();
      expect(html, 'versie aanwezig in DOM').toMatch(/v\d+\.\d+/);

      // 3. Geen JS-errors
      expect(errors, `Geen JS-errors voor theme=${theme}`).toHaveLength(0);

      // 4. Screenshot voor visuele review
      await page.screenshot({
        path: path.join(SHOT_DIR, `${theme}.png`),
        fullPage: false, // viewport-shot, niet hele scroll
      });
    });
  }
});
