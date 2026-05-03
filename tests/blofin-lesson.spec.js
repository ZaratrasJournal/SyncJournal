// Verifieert dat de v12.75 Blofin-lesson (l18) zichtbaar is in de Help-tab,
// rendert zonder JS-errors, en de "Open Accounts"-knop in de lesson-content
// daadwerkelijk navigeert naar de Accounts-tab. Meta-test: voorkomt dat een
// LESSONS-array-mutatie de lesson onbedoeld weghaalt of breekt.
const { test, expect } = require('@playwright/test');
const path = require('path');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');

test.describe('Blofin-handleiding lesson (l18)', () => {
  test('Lesson is zichtbaar in Help → lessons en bevat de kernsecties', async ({ page }) => {
    // Skip welkomst + alle milestones zodat clicks niet worden onderschept
    await page.addInitScript(() => {
      localStorage.setItem('tj_welcomed', '1');
      localStorage.setItem('tj_milestones_seen', JSON.stringify([
        'trades-10','trades-50','trades-100','trades-250','trades-500','trades-1000',
        'win-streak-5','win-streak-10','first-win'
      ]));
    });

    const errors = [];
    // Filter Babel's deoptimisation-NOTE — geen echte error, hoort bij in-browser
    // compilatie van een groot single-file script.
    const noise = /\[BABEL\] Note:.*deoptimised/i;
    page.on('pageerror', e => { const t = String(e); if (!noise.test(t)) errors.push(t); });
    page.on('console', m => { if (m.type() === 'error' && !noise.test(m.text())) errors.push(m.text()); });

    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 15_000 });

    // Naviger naar de Help-tab
    await page.evaluate(() => { window.location.hash = '#/help'; });
    await page.waitForTimeout(800);

    // Lesson-card moet zichtbaar zijn in de overview
    await expect(page.getByText('Blofin koppelen + importeren').first()).toBeVisible({ timeout: 5_000 });

    // Open de lesson via klik
    await page.getByText('Blofin koppelen + importeren').first().click();
    await page.waitForTimeout(400);

    // Kern-secties moeten zichtbaar zijn (compactere v12.80-versie)
    await expect(page.getByText(/TL;DR · 30 seconden/i)).toBeVisible();
    await expect(page.getByText(/Pad A — CSV exporteren/i)).toBeVisible();
    await expect(page.getByText(/Pad B — API-koppeling/i)).toBeVisible();
    await expect(page.getByText(/90-dagen-trap/i)).toBeVisible();
    await expect(page.getByText(/Pitfalls/i).first()).toBeVisible();

    // Footer "Laatst gecontroleerd"-stempel
    await expect(page.getByText(/Laatst gecontroleerd: 2026-05-02/)).toBeVisible();

    // Code-verwijzing naar de exacte CSV-headers (essentiële details voor user)
    await expect(page.getByText(/Underlying Asset/)).toBeVisible();
    await expect(page.getByText(/Avg Fill/)).toBeVisible();

    // Geen JS errors gedurende render
    expect(errors, `JS errors tijdens rendering:\n${errors.join('\n')}`).toEqual([]);
  });

  test('Hub-navigatie: klik Blofin-knop in l04 (CSV) opent l18 zonder modal-close', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('tj_welcomed', '1');
      localStorage.setItem('tj_milestones_seen', JSON.stringify(['trades-10','first-win']));
    });
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 15_000 });
    await page.evaluate(() => { window.location.hash = '#/help'; });
    await page.waitForTimeout(500);

    // Open de CSV-hub-lesson (l04)
    await page.getByText(/CSV importeren — kies je exchange/i).first().click();
    await page.waitForTimeout(300);

    // Verifieer dat hub-knoppen voor alle exchanges zichtbaar zijn
    await expect(page.getByRole('button', { name: /📥 Blofin/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /📥 MEXC/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /📥 FTMO/i })).toBeVisible();

    // Klik op Blofin-knop → moet l18 (Blofin lesson) openen
    await page.getByRole('button', { name: /📥 Blofin →/i }).click();
    await page.waitForTimeout(400);

    // Lesson-titel van l18 moet nu zichtbaar zijn (modal swap, niet close)
    await expect(page.locator('text=Blofin koppelen + importeren').first()).toBeVisible({ timeout: 3_000 });
    // Specifieke l18-content (90-dagen-trap) bewijst dat de juiste lesson is geopend
    await expect(page.getByText(/90-dagen-trap/i)).toBeVisible();
  });

  test('"Open Accounts"-knop in de lesson navigeert naar de Accounts-tab', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('tj_welcomed', '1');
      localStorage.setItem('tj_milestones_seen', JSON.stringify(['trades-10','first-win']));
    });
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 15_000 });
    await page.evaluate(() => { window.location.hash = '#/help'; });
    await page.waitForTimeout(500);

    await page.getByText('Blofin koppelen + importeren').first().click();
    await page.waitForTimeout(300);

    // Klik de "Open Accounts →" CTA aan het eind van de lesson
    const cta = page.getByRole('button', { name: /Open Accounts/i });
    await expect(cta).toBeVisible({ timeout: 3_000 });
    await cta.click();
    await page.waitForTimeout(500);

    // De lesson-link callt setTab() zonder URL-hash-update — dus check content,
    // niet location.hash. Accounts-tab toont een API-Key-input voor bv. Blofin.
    await expect(page.getByText('API verbinding instellen').first()).toBeVisible({ timeout: 5_000 });
  });
});
