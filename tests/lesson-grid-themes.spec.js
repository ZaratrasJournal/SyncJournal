// v12.81 — visuele check: lesson-grid (Help → lessons) in alle 6 thema's.
// Doel: card-styling (illustration-gradient + cards background + level-badges)
// passen bij elk thema.
const { test } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');
const SHOT_DIR = path.join(__dirname, 'screenshots/lesson-grid-themes');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

const THEMES = ['sync', 'classic', 'aurora', 'light', 'parchment', 'daylight'];

test.describe('Lesson-grid kleur-leesbaarheid per thema', () => {
  for (const theme of THEMES) {
    test(`${theme} thema`, async ({ page }) => {
      await page.addInitScript((t) => {
        localStorage.setItem('tj_welcomed', '1');
        localStorage.setItem('tj_milestones_seen', JSON.stringify([
          'trades-10','trades-50','trades-100','trades-250','trades-500','trades-1000',
          'win-streak-5','win-streak-10','first-win'
        ]));
        localStorage.setItem('tj_theme', t);
      }, theme);

      await page.goto(FILE_URL, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 15_000 });
      await page.evaluate((t) => { document.body.className = 'theme-' + t; }, theme);
      await page.evaluate(() => { window.location.hash = '#/help'; });
      await page.waitForTimeout(500);

      await page.setViewportSize({ width: 1280, height: 1100 });
      await page.waitForTimeout(200);

      await page.screenshot({
        path: path.join(SHOT_DIR, theme + '.png'),
        fullPage: false,
      });
    });
  }
});
