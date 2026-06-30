// v12.239 — scroll-spy zijmenu in het trade-formulier (zoals het Instellingen-menu).
// Verifieert: zijmenu rendert de secties, klik highlight de juiste sectie (optimistisch),
// en er zijn geen JS-errors. Run: npx playwright test tests/trade-form-nav.spec.js
const { test, expect } = require('@playwright/test');
const path = require('path');
const { seedLocalStorage } = require('./helpers/seed');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');

async function openNewTrade(page) {
  const btn = page.locator('button', { hasText: 'Trade' }).filter({ has: page.locator('span.kbd') });
  if (await btn.count()) await btn.first().click();
  else await page.keyboard.press('n');
  await page.locator('.tf-nav a').first().waitFor({ timeout: 10000 });
}

test('trade-form zijmenu rendert de secties + geen JS-errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(seedLocalStorage, { config: { defaultQuote: 'USDT', exchanges: {} } });
  await page.goto(FILE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await openNewTrade(page);

  const labels = (await page.locator('.tf-nav a').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim());
  // Kern-secties die altijd aanwezig zijn (Entry-criteria alleen met playbook, Missed alleen bij missed-trade).
  expect(labels.some(l => /Prijzen & richting/.test(l))).toBe(true);
  expect(labels.some(l => /Take Profit/.test(l))).toBe(true);
  expect(labels.some(l => /Setup & Psychologie/.test(l))).toBe(true);
  expect(labels.some(l => /Media & Links/.test(l))).toBe(true);
  expect(labels.some(l => /Notities/.test(l))).toBe(true);

  // Bij openen is de eerste sectie actief.
  const active0 = (await page.locator('.tf-nav a.active').innerText()).replace(/\s+/g, ' ').trim();
  expect(active0).toMatch(/Prijzen & richting/);

  expect(errors, 'geen JS-errors').toHaveLength(0);
});

test('klik op een menu-item highlight die sectie', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(seedLocalStorage, { config: { defaultQuote: 'USDT', exchanges: {} } });
  await page.goto(FILE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await openNewTrade(page);

  for (const name of ['Take Profit', 'Setup & Psychologie', 'Notities', 'Prijzen & richting']) {
    await page.locator('.tf-nav a', { hasText: name }).first().click();
    await page.waitForTimeout(350);
    const active = (await page.locator('.tf-nav a.active').innerText()).replace(/\s+/g, ' ').trim();
    expect(active, `klik "${name}" → actief`).toContain(name);
  }
  expect(errors, 'geen JS-errors').toHaveLength(0);
});

test('klik geeft een flash-puls op de doel-sectie', async ({ page }) => {
  await page.addInitScript(seedLocalStorage, { config: { defaultQuote: 'USDT', exchanges: {} } });
  await page.goto(FILE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await openNewTrade(page);
  // klik Setup → #tf-setup krijgt de flash-class; daarna klik TP → setup verliest 'm, tp krijgt 'm.
  await page.locator('.tf-nav a', { hasText: 'Setup & Psychologie' }).first().click();
  await page.waitForTimeout(120);
  expect(await page.locator('#tf-setup.tf-flash').count(), 'setup flasht').toBe(1);
  await page.locator('.tf-nav a', { hasText: 'Take Profit' }).first().click();
  await page.waitForTimeout(120);
  expect(await page.locator('#tf-tp.tf-flash').count(), 'tp flasht').toBe(1);
  expect(await page.locator('#tf-setup.tf-flash').count(), 'setup flasht niet meer').toBe(0);
});
