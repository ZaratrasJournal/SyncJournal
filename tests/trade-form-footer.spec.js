// Regressie: de sticky actie-balk (Trade opslaan / Deel kaart / Annuleren) onderaan het
// trade-formulier moet dezelfde achtergrond hebben als het form-paneel — anders krijg je
// een lelijke donkere band (gemeld in classic-thema: footer var(--bg)=#10111a vs paneel
// var(--glass)=#1e2030). Fix v12.230: footer background = var(--glass).
//
// Run: npx playwright test tests/trade-form-footer.spec.js
const { test, expect } = require('@playwright/test');
const path = require('path');
const { seedLocalStorage } = require('./helpers/seed');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');

// Classic = waar de bug zichtbaar was (solide glass). Sync = translucent thema (regressie-check).
for (const theme of ['classic', 'sync', 'parchment']) {
  test(`trade-form footer matcht paneel-achtergrond (${theme})`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(seedLocalStorage, { config: { defaultQuote: 'USDT', theme, exchanges: {} } });
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.locator('button', { hasText: /\+ Trade/ }).first().click();
    await page.locator('button', { hasText: /Trade opslaan/ }).waitFor({ timeout: 10_000 });

    const r = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(b => /Trade opslaan/.test(b.textContent));
      const footer = btn.parentElement;
      // v12.239: footer zit nu in de content-kolom (tf-form-col) binnen het form-paneel
      // (.tf-form-grid). De content-kolom is transparant, dus de footer-glass ligt naadloos
      // over de paneel-glass — vergelijk daarom met het paneel, niet de transparante wrapper.
      const panel = footer.closest('.tf-form-grid') || footer.parentElement;
      return { footerBg: getComputedStyle(footer).backgroundColor, parentBg: getComputedStyle(panel).backgroundColor };
    });

    expect(errors, 'geen JS-errors').toHaveLength(0);
    // Footer mag NIET de donkere page-bg zijn; moet matchen met het paneel eromheen.
    expect(r.footerBg, `footer (${r.footerBg}) moet paneel (${r.parentBg}) matchen — geen donkere band`).toBe(r.parentBg);
  });
}
