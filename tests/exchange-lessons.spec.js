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

// v12.83: detail-lessons l18-l22 staan niet meer als losse cards in de grid.
// Open ze via de CSV-hub (l04) → klik op de exchange-knop.
async function openExchangeLessonViaHub(page, exchangeRegex) {
  await page.getByText('CSV importeren — kies je exchange').first().click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: exchangeRegex }).click();
  await page.waitForTimeout(400);
}

test.describe('Exchange-lessons hub + 4 nieuwe lessons (v12.78)', () => {
  test('Exchange-detail-lessons (l18-l22) NIET als losse cards in grid (alleen via hub)', async ({ page }) => {
    await setup(page);
    // De hub-cards moeten zichtbaar zijn
    await expect(page.getByText('CSV importeren — kies je exchange').first()).toBeVisible();
    await expect(page.getByText('Exchange koppelen — kies je exchange').first()).toBeVisible();
    // De detail-lessons NIET als losse card in de grid
    await expect(page.getByText('Blofin koppelen + importeren').first()).not.toBeVisible();
    await expect(page.getByText('MEXC koppelen + importeren').first()).not.toBeVisible();
    await expect(page.getByText('Kraken Futures koppelen + importeren').first()).not.toBeVisible();
    await expect(page.getByText('Hyperliquid koppelen + importeren').first()).not.toBeVisible();
    await expect(page.getByText('FTMO (MT5) koppelen + importeren').first()).not.toBeVisible();
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
    await openExchangeLessonViaHub(page, /📥 Kraken Futures →/i);

    await expect(page.getByText(/EU-traders/i).first()).toBeVisible();
    await expect(page.getByText(/ESMA/).first()).toBeVisible();
    // Spot ≠ Futures discriminator moet erin staan
    await expect(page.getByText(/Spot ≠ Futures keys/i).first()).toBeVisible();
    await expect(page.getByText(/booking_uid/).first()).toBeVisible();
  });

  test('Hyperliquid-lesson (l21): privacy-warning prominent + 0x-formaat', async ({ page }) => {
    await setup(page);
    await openExchangeLessonViaHub(page, /📥 Hyperliquid →/i);

    await expect(page.getByText(/Privacy: alle trades zijn publiek/i).first()).toBeVisible();
    await expect(page.getByText(/HyperTracker/).first()).toBeVisible();
    await expect(page.getByText(/42 totaal/).first()).toBeVisible();
    await expect(page.getByText(/10\.000/).first()).toBeVisible();
  });

  test('FTMO-lesson (l22): CSV-only + US vs Global pitfall + MetriX-pad', async ({ page }) => {
    await setup(page);
    await openExchangeLessonViaHub(page, /📥 FTMO \(MT5\) →/i);

    await expect(page.getByText(/Geen API beschikbaar/i).first()).toBeVisible();
    await expect(page.getByText(/MetriX/i).first()).toBeVisible();
    await expect(page.getByText(/FTMO US.*FTMO Global|FTMO Global.*FTMO US/i).first()).toBeVisible();
    await expect(page.getByText(/netting\/FIFO/i).first()).toBeVisible();
  });

  test('Detail-lesson heeft tab-strip BOVENAAN met active-state + cross-navigatie werkt', async ({ page }) => {
    await setup(page);
    // Open Blofin (l18) via de CSV-hub
    await openExchangeLessonViaHub(page, /📥 Blofin →/i);

    // Tab-strip moet zichtbaar zijn — alle 5 exchanges
    const tabsContainer = page.locator('.lesson-exchange-tabs').first();
    await expect(tabsContainer).toBeVisible();

    // Self-exchange (Blofin) heeft active-state via aria-current
    const blofinTab = tabsContainer.locator('button[aria-current="page"]');
    await expect(blofinTab).toBeVisible();
    await expect(blofinTab).toContainText('Blofin');

    // Andere 4 zijn klikbaar via .lesson-link met data-lesson-target
    for (const exch of ['MEXC', 'Kraken Futures', 'Hyperliquid', 'FTMO (MT5)']) {
      const tab = tabsContainer.locator(`button.lesson-link:has-text("${exch}")`);
      await expect(tab).toBeVisible();
    }

    // Onderaan-sectie ("Andere exchange?" h2) moet WEG zijn (verplaatst naar boven als tabs)
    await expect(page.getByRole('heading', { name: 'Andere exchange?' })).not.toBeVisible();

    // Klik op MEXC-tab → l19 opent in dezelfde modal
    await tabsContainer.locator('button.lesson-link:has-text("MEXC")').click();
    await page.waitForTimeout(400);
    await expect(page.getByText('MEXC koppelen + importeren').first()).toBeVisible();

    // Op MEXC-lesson is MEXC nu de active tab + Blofin is klikbaar
    const mexcTabs = page.locator('.lesson-exchange-tabs').first();
    const mexcActive = mexcTabs.locator('button[aria-current="page"]');
    await expect(mexcActive).toContainText('MEXC');
    await expect(mexcTabs.locator('button.lesson-link:has-text("Blofin")')).toBeVisible();
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
    await expect(page.getByText(/Geen API beschikbaar/i).first()).toBeVisible();
  });
});
