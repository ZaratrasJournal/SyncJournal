// v12.79 — visuele check: opent l18 (Blofin-lesson) in alle 6 thema's en maakt screenshot.
// Doel: snel zien of TL;DR-block, callouts, step-cirkels, code-blokken, scroll-progress
// in elk thema voldoende contrast hebben en goed leesbaar zijn.
//
// Output: tests/screenshots/lesson-themes/<theme>.png
const { test } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');
const SHOT_DIR = path.join(__dirname, 'screenshots/lesson-themes');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

const THEMES = ['sync', 'classic', 'aurora', 'light', 'parchment', 'daylight'];

test.describe('Lesson-modal kleur-leesbaarheid per thema', () => {
  for (const theme of THEMES) {
    test(`${theme} thema`, async ({ page }) => {
      await page.addInitScript((t) => {
        localStorage.setItem('tj_welcomed', '1');
        localStorage.setItem('tj_milestones_seen', JSON.stringify([
          'trades-10','trades-50','trades-100','trades-250','trades-500','trades-1000',
          'win-streak-5','win-streak-10','first-win'
        ]));
        localStorage.setItem('tj_theme', t);
        document.documentElement.classList.add('theme-' + t);
        // Body class wordt op mount gezet via React, maar als safety:
        if (document.body) document.body.className = 'theme-' + t;
      }, theme);

      await page.goto(FILE_URL, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 15_000 });
      // Force theme class op body
      await page.evaluate((t) => { document.body.className = 'theme-' + t; }, theme);
      await page.evaluate(() => { window.location.hash = '#/help'; });
      await page.waitForTimeout(500);

      // Open Blofin-lesson (heeft TL;DR + callouts + step-cirkels — representatief)
      await page.getByText('Blofin koppelen + importeren').first().click();
      await page.waitForTimeout(600);

      // Viewport groot genoeg voor lesson-modal
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.waitForTimeout(200);

      await page.screenshot({
        path: path.join(SHOT_DIR, theme + '.png'),
        fullPage: false,
      });
    });
  }
});
