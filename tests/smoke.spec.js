// Smoke test — laad work/tradejournal.html, verifieer dat de basis-UI laadt en
// dat de versie zichtbaar is. Geen seed nodig (gebruikt user's localStorage als die er is,
// of lege state anders). Doel: detecteert build-breakage / JS-errors snel.
const { test, expect } = require('@playwright/test');
const path = require('path');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');

test.describe('SyncJournal smoke', () => {
  test('app laadt zonder JS-errors en toont versie', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => {
      if (m.type() !== 'error') return;
      const text = m.text();
      // Skip benign Babel-info en favicon-404
      if (/\[BABEL\] Note:/.test(text)) return;
      if (/Failed to load resource.*favicon/.test(text)) return;
      errors.push('[console] ' + text);
    });

    // Skip welcome-modal voor smoke (anders moeten we 'm wegklikken)
    await page.addInitScript(() => { localStorage.setItem('tj_welcomed', '1'); });

    await page.goto(FILE_URL, { waitUntil: 'networkidle' });

    // Wacht tot Dashboard-tab is verschenen — stabieler dan tekst-match
    await page.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 15_000 });
    // En tot React's main app-state is gehydrateerd (config geladen uit localStorage)
    await page.waitForFunction(() => !!window.localStorage, { timeout: 5_000 });
    await page.waitForTimeout(1000); // settle voor late effects

    // Geen JS-errors tijdens load
    if (errors.length) {
      console.log('JS errors gevonden:', errors);
    }
    expect(errors, 'Geen JS-errors bij app-load').toHaveLength(0);

    // Versie-string moet ergens in de DOM staan
    const html = await page.content();
    expect(html).toContain('v12.62');

    await page.screenshot({
      path: path.join(__dirname, 'screenshots/smoke-default.png'),
      fullPage: false,
    });
  });
});
