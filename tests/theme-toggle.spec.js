// v12.84 — verifieert dat de top-right thema-toggle wisselt tussen `light` en
// `classic`. Voorheen wisselde 'ie tussen `morani`/`purple` (verwijderd) waardoor
// de knop niets deed. Andere thema's blijven kiesbaar via Instellingen → Thema.
const { test, expect } = require('@playwright/test');
const path = require('path');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');

async function setup(page, startTheme) {
  await page.addInitScript((t) => {
    localStorage.setItem('tj_welcomed', '1');
    localStorage.setItem('tj_theme', t);
    // tj_config persisteert thema; setConfig leest van tj_config bij init
    const cfg = JSON.parse(localStorage.getItem('tj_config') || '{}');
    cfg.theme = t;
    localStorage.setItem('tj_config', JSON.stringify(cfg));
  }, startTheme);
  await page.goto(FILE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 15_000 });
  await page.waitForTimeout(300);
}

const toggleBtn = (page) => page.locator('button[aria-label*="thema"]').first();
const currentTheme = (page) => page.evaluate(() => {
  const cfg = JSON.parse(localStorage.getItem('tj_config') || '{}');
  return cfg.theme;
});

test.describe('Top-right theme-toggle (v12.84)', () => {
  test('Vanuit classic → klik → light', async ({ page }) => {
    await setup(page, 'classic');
    expect(await currentTheme(page)).toBe('classic');

    await toggleBtn(page).click();
    await page.waitForTimeout(300);

    expect(await currentTheme(page)).toBe('light');
    // Body krijgt theme-light class
    await expect(page.locator('body')).toHaveClass(/theme-light/);
  });

  test('Vanuit light → klik → classic', async ({ page }) => {
    await setup(page, 'light');
    expect(await currentTheme(page)).toBe('light');

    await toggleBtn(page).click();
    await page.waitForTimeout(300);

    expect(await currentTheme(page)).toBe('classic');
    await expect(page.locator('body')).toHaveClass(/theme-classic/);
  });

  test('Vanuit aurora (ander dark thema) → klik → light (dichtstbijzijnde "licht"-richting)', async ({ page }) => {
    await setup(page, 'aurora');
    await toggleBtn(page).click();
    await page.waitForTimeout(300);

    expect(await currentTheme(page)).toBe('light');
  });

  test('Knop heeft proper aria-label en tooltip die wisselt met state', async ({ page }) => {
    await setup(page, 'classic');
    const btn = toggleBtn(page);
    await expect(btn).toHaveAttribute('aria-label', /donker|licht/i);
    const titleDark = await btn.getAttribute('title');
    expect(titleDark).toMatch(/wissel/i);

    await btn.click();
    await page.waitForTimeout(300);
    const titleLight = await btn.getAttribute('title');
    expect(titleLight).not.toBe(titleDark);
  });
});
