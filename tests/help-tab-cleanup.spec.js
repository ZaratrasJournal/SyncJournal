// v12.82 — verifieert HelpPage cleanup:
//   1. Startersguide-tab is weg (alleen Handleiding + FAQ subtabs)
//   2. Help-header tekst genoemt geen "startersguide" meer
//   3. FAQ heeft de nieuwe gebruiksvriendelijke entries (geen DevTools-instructies meer,
//      geen 'python -m http.server' voor non-tech users)
const { test, expect } = require('@playwright/test');
const path = require('path');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');

async function setup(page) {
  await page.addInitScript(() => {
    localStorage.setItem('tj_welcomed', '1');
    localStorage.setItem('tj_milestones_seen', JSON.stringify(['trades-10','first-win']));
  });
  await page.goto(FILE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 15_000 });
  await page.evaluate(() => { window.location.hash = '#/help'; });
  await page.waitForTimeout(500);
}

test.describe('HelpPage cleanup (v12.82)', () => {
  test('Startersguide-tab is weg, alleen Handleiding + FAQ', async ({ page }) => {
    await setup(page);

    // Subtab-knoppen
    await expect(page.getByRole('button', { name: /Handleiding/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /FAQ/i })).toBeVisible();

    // Startersguide-knop NIET meer aanwezig
    await expect(page.getByRole('button', { name: /Startersguide/i })).not.toBeVisible();
  });

  test('Help-header tekst noemt geen "startersguide"', async ({ page }) => {
    await setup(page);
    const header = await page.locator('text=/Alles wat je moet weten om te starten/i').first().textContent();
    expect(header).not.toMatch(/startersguide/i);
  });

  test('FAQ-tab opent en toont gebruiksvriendelijke entries', async ({ page }) => {
    await setup(page);
    await page.getByRole('button', { name: /FAQ/i }).click();
    await page.waitForTimeout(300);

    // Een van de vereenvoudigde FAQ-entries moet zichtbaar zijn
    await expect(page.getByText(/Welcome-modal weggeklikt/i)).toBeVisible();
    // Geen DevTools-instructie meer
    const html = await page.content();
    expect(html).not.toMatch(/F12.*Console.*localStorage\.removeItem/);
    expect(html).not.toMatch(/python -m http\.server/);
  });

  test('Legacy users met startersguide in localStorage worden gemapt naar lessons', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('tj_welcomed', '1');
      localStorage.setItem('tj_milestones_seen', JSON.stringify(['trades-10','first-win']));
      localStorage.setItem('tj_help_subtab', 'startersguide'); // legacy state
    });
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 15_000 });
    await page.evaluate(() => { window.location.hash = '#/help'; });
    await page.waitForTimeout(500);

    // Ondanks legacy "startersguide" state moet de Handleiding (= lessons) actief zijn
    // Lesson-cards moeten zichtbaar zijn (= lessons-view rendert)
    await expect(page.getByText('Wat is een trading journal?').first()).toBeVisible();
  });
});
