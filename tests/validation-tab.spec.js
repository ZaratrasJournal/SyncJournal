// v12.95 — Validatie-checklist tab smoke + interaction.
const { test, expect } = require('@playwright/test');
const path = require('path');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');

test.describe('Validatie-checklist tab (v12.95)', () => {
  test('Tab opent + checkbox state persisteert in localStorage', async ({ page }) => {
    await page.addInitScript(() => { localStorage.setItem('tj_welcomed', '1'); });
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Trading Journal/i.test(document.body.innerText), { timeout: 15_000 });

    // Direct naar de validatie-tab
    await page.evaluate(() => { location.hash = '#/validation'; });
    await page.waitForTimeout(400);

    // Verifieer dat de checklist content rendert
    await expect(page.locator('text=Exchange validatie-checklist')).toBeVisible();
    await expect(page.locator('text=Tester naam')).toBeVisible();

    // Vink een checkbox aan (eerste in Blofin sectie)
    const firstCheckbox = page.locator('input[type="checkbox"]').first();
    await firstCheckbox.check();

    // Verifieer dat 'ie persisteert in localStorage
    const stored = await page.evaluate(() => localStorage.getItem('tj_validation_state'));
    expect(stored).toBeTruthy();
    const state = JSON.parse(stored);
    expect(state.checks).toBeDefined();
    const anyTrue = Object.values(state.checks).some(v => v === true);
    expect(anyTrue, 'minstens 1 checkbox is true in state').toBe(true);
  });

  test('Tester naam veld + voortgang teller werken', async ({ page }) => {
    await page.addInitScript(() => { localStorage.setItem('tj_welcomed', '1'); });
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Trading Journal/i.test(document.body.innerText), { timeout: 15_000 });
    await page.evaluate(() => { location.hash = '#/validation'; });
    await page.waitForTimeout(400);

    const testerInput = page.locator('input[placeholder*="Denny"]').first();
    await expect(testerInput).toBeVisible({ timeout: 5000 });
    await testerInput.fill('TestUser');

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('tj_validation_state') || '{}'));
    expect(stored.tester).toBe('TestUser');

    // Voortgang-teller is initieel 0/X (X totaal checks)
    const progressText = await page.locator('text=/\\d+\\/\\d+/').first().textContent();
    expect(progressText).toMatch(/\d+\/\d+/);
  });

  test('Reset-knop maakt checks leeg', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('tj_welcomed', '1');
      localStorage.setItem('tj_validation_state', JSON.stringify({
        tester: 'X',
        notes: { 'blofin/open_sl': 'test note' },
        checks: { 'blofin/open_sl/0': true, 'blofin/open_sl/1': true },
      }));
    });
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Trading Journal/i.test(document.body.innerText), { timeout: 15_000 });
    await page.evaluate(() => { location.hash = '#/validation'; });
    await page.waitForTimeout(400);

    // Auto-confirm de prompt
    page.on('dialog', d => d.accept());
    const resetBtn = page.locator('button', { hasText: 'Reset' }).first();
    await resetBtn.click();
    await page.waitForTimeout(200);

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('tj_validation_state') || '{}'));
    expect(Object.keys(stored.checks).length, 'checks leeg na reset').toBe(0);
    expect(Object.keys(stored.notes).length, 'notes leeg na reset').toBe(0);
    expect(stored.tester, 'tester naam blijft behouden').toBe('X');
  });
});
