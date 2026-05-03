// v12.78 — verifieert dat alle 4 nieuwe exchange-lessons (l19 MEXC, l20 Kraken Futures,
// l21 Hyperliquid, l22 FTMO MT5) zichtbaar en functioneel zijn, en dat de hub-knoppen
// in l04 (CSV) en l05 (API) navigeren naar de juiste detail-lesson.
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

test.describe('Exchange-lessons hub + 4 nieuwe lessons (v12.78)', () => {
  test('Alle 5 lesson-cards zichtbaar in Help: l18 t/m l22', async ({ page }) => {
    await setup(page);
    // Per lesson: titel zichtbaar in de cards-grid
    await expect(page.getByText('Blofin koppelen + importeren').first()).toBeVisible();
    await expect(page.getByText('MEXC koppelen + importeren').first()).toBeVisible();
    await expect(page.getByText('Kraken Futures koppelen + importeren').first()).toBeVisible();
    await expect(page.getByText('Hyperliquid koppelen + importeren').first()).toBeVisible();
    await expect(page.getByText('FTMO (MT5) koppelen + importeren').first()).toBeVisible();
  });

  test('CSV-hub (l04): alle 5 exchange-knoppen zijn klikbaar (geen disabled meer)', async ({ page }) => {
    await setup(page);
    await page.getByText(/CSV importeren — kies je exchange/i).first().click();
    await page.waitForTimeout(300);

    // Alle 5 knoppen moeten enabled zijn (data-lesson-target attribute aanwezig)
    for (const exch of ['Blofin', 'MEXC', 'Kraken Futures', 'Hyperliquid', 'FTMO (MT5)']) {
      const btn = page.getByRole('button', { name: new RegExp('📥 ' + exch.replace(/[()]/g, '\\$&')) });
      await expect(btn).toBeVisible();
      await expect(btn).toBeEnabled();
    }
  });

  test('CSV-hub klik op MEXC opent l19 met TL;DR + 90-dagen-trap', async ({ page }) => {
    await setup(page);
    await page.getByText(/CSV importeren — kies je exchange/i).first().click();
    await page.waitForTimeout(300);

    await page.getByRole('button', { name: /📥 MEXC →/i }).click();
    await page.waitForTimeout(400);

    // Lesson-titel + key-content
    await expect(page.getByText('MEXC koppelen + importeren').first()).toBeVisible();
    await expect(page.getByText(/TL;DR · 30 seconden/i).first()).toBeVisible();
    await expect(page.getByText(/90-dagen-trap/i)).toBeVisible();
    await expect(page.getByText(/Avg Entry Price/)).toBeVisible();
  });

  test('Kraken-lesson (l20): EU/ESMA-warning + futures.kraken.com onderscheid', async ({ page }) => {
    await setup(page);
    await page.getByText('Kraken Futures koppelen + importeren').first().click();
    await page.waitForTimeout(400);

    await expect(page.getByText(/EU-traders/i).first()).toBeVisible();
    await expect(page.getByText(/ESMA/).first()).toBeVisible();
    // Spot ≠ Futures discriminator moet erin staan
    await expect(page.getByText(/Spot ≠ Futures keys/i).first()).toBeVisible();
    await expect(page.getByText(/booking_uid/).first()).toBeVisible();
  });

  test('Hyperliquid-lesson (l21): privacy-warning prominent + 0x-formaat', async ({ page }) => {
    await setup(page);
    await page.getByText('Hyperliquid koppelen + importeren').first().click();
    await page.waitForTimeout(400);

    await expect(page.getByText(/Privacy bovenaan: alle trades zijn publiek/i).first()).toBeVisible();
    await expect(page.getByText(/HyperTracker/).first()).toBeVisible();
    await expect(page.getByText(/42 tekens totaal/).first()).toBeVisible();
    await expect(page.getByText(/10\.000/).first()).toBeVisible();
  });

  test('FTMO-lesson (l22): CSV-only + US vs Global pitfall + MetriX-pad', async ({ page }) => {
    await setup(page);
    await page.getByText('FTMO (MT5) koppelen + importeren').first().click();
    await page.waitForTimeout(400);

    await expect(page.getByText(/Geen API-koppeling/i).first()).toBeVisible();
    await expect(page.getByText(/MetriX/i).first()).toBeVisible();
    await expect(page.getByText(/FTMO US.*FTMO Global|FTMO Global.*FTMO US/i).first()).toBeVisible();
    await expect(page.getByText(/netting\/FIFO/i).first()).toBeVisible();
  });

  test('Detail-lesson heeft "Andere exchange?"-sectie + cross-navigatie werkt', async ({ page }) => {
    await setup(page);
    // Open Blofin (l18)
    await page.getByText('Blofin koppelen + importeren').first().click();
    await page.waitForTimeout(400);

    // "Andere exchange?"-sectie moet zichtbaar zijn
    await expect(page.getByText('Andere exchange?').first()).toBeVisible();
    // 4 chip-knoppen voor de andere exchanges (geen Blofin want we ZIJN op Blofin)
    await expect(page.getByRole('button', { name: /MEXC →/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Kraken Futures →/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Hyperliquid →/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /FTMO \(MT5\) →/ }).first()).toBeVisible();

    // Klik op MEXC-chip → l19 opent in dezelfde modal
    await page.getByRole('button', { name: /🟢 MEXC →/ }).click();
    await page.waitForTimeout(400);
    await expect(page.getByText('MEXC koppelen + importeren').first()).toBeVisible();

    // Op MEXC-lesson moet nu "Andere exchange?"-sectie ook bestaan, met Blofin-chip
    await expect(page.getByRole('button', { name: /🟣 Blofin →/ })).toBeVisible();
  });

  test('API-hub (l05): 4 knoppen actief + FTMO als callout-link naar l22', async ({ page }) => {
    await setup(page);
    await page.getByText(/Exchange koppelen — kies je exchange/i).first().click();
    await page.waitForTimeout(300);

    // 4 actieve buttons (Blofin/MEXC/Kraken/Hyperliquid)
    for (const exch of ['Blofin', 'MEXC', 'Kraken Futures', 'Hyperliquid']) {
      const btn = page.getByRole('button', { name: new RegExp('🔗 ' + exch) });
      await expect(btn).toBeVisible();
      await expect(btn).toBeEnabled();
    }
    // FTMO-callout button (link naar l22)
    const ftmoBtn = page.getByRole('button', { name: /📥 FTMO-handleiding openen/i });
    await expect(ftmoBtn).toBeVisible();
    await ftmoBtn.click();
    await page.waitForTimeout(400);

    // FTMO-lesson moet nu open zijn
    await expect(page.getByText('FTMO (MT5) koppelen + importeren').first()).toBeVisible();
    await expect(page.getByText(/Geen API-koppeling/i).first()).toBeVisible();
  });
});
