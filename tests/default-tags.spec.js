// Verifieert de DEFAULT_TAGS-baseline die nieuwe users krijgen wanneer ze de app voor het
// eerst openen (geen tj_tags in localStorage). Voorkomt regressie wanneer iemand later
// per ongeluk de defaults wijzigt of een tag-categorie hernoemt.
const { test, expect } = require('@playwright/test');
const path = require('path');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');

const EXPECTED_DEFAULTS = {
  setupTags: ['BOS', 'MSB', 'SFP', 'F2R', 'F2L', 'Structuur', 'MLS', 'Range', 'Bullish retest', 'Bearish retest'],
  confirmationTags: ['Liquidity Sweep', 'OB', 'FVG', 'EQL/EQH', 'Flat candle', 'Session sweep US/UK/AS', 'VAH / VAL / POC', 'Range retest', 'Range acceptatie', 'Spot koop', 'Spot verkoop'],
  timeframeTags: ['1M', '5M', '15M', '30M', '1H', '2H', '4H', '12H', 'Daily', 'Weekly'],
  emotionTags: ['FOMO', 'Gehaast', 'Twijfels', 'Geduldig', 'Rustig', 'Zelfverzekerd'],
  mistakeTags: ['Te vroeg in', 'SL te krap', 'SL te wijd', 'Geen plan', 'Overtrading', 'TP te vroeg', 'Positie te groot', 'Revenge trade'],
  missedReasonTags: ['🐢 Durf', '🔪 Buiten regels', '⏰ Te laat gespot', '💰 Kapitaal vol', '🌫️ Onduidelijk', '🚷 Bewuste skip', '🛌 Offline'],
};

test.describe('DEFAULT_TAGS baseline voor nieuwe users', () => {
  test('Verse user krijgt exact de DEFAULT_TAGS uit het screenshot in TagManager', async ({ page }) => {
    // Geen seedLocalStorage — bewust verse start zonder tj_tags
    await page.addInitScript(() => {
      // Skip welkomstscherm + alle milestone-modals
      localStorage.setItem('tj_welcomed', '1');
      localStorage.setItem('tj_milestones_seen', JSON.stringify([
        'trades-10','trades-50','trades-100','trades-250','trades-500','trades-1000',
        'win-streak-5','win-streak-10','first-win'
      ]));
      // trackMissedTrades aan zodat Missed-redenen-categorie zichtbaar is
      localStorage.setItem('tj_config', JSON.stringify({ trackMissedTrades: true }));
    });
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 15_000 });
    await page.evaluate(() => { window.location.hash = '#/tags'; });
    await page.waitForFunction(() => /Tag categorie/i.test(document.body.innerText), { timeout: 5_000 });
    await page.waitForTimeout(500);

    // Voor elke categorie: verifieer dat exact de verwachte tags getoond worden via data-testid
    for (const [catKey, expected] of Object.entries(EXPECTED_DEFAULTS)) {
      for (const tag of expected) {
        const box = page.locator(`[data-testid="tag-box-${catKey}-${tag}"]`);
        await expect(box, `${catKey} mist '${tag}'`).toBeVisible();
      }
    }
  });

  test('Bestaande user met tj_tags behoudt eigen config (geen automatische merge naar nieuwe defaults)', async ({ page }) => {
    // Seed een minimal tag-config — moet die behouden worden, niet vervangen worden
    const ownConfig = {
      setupTags: ['MijnEigenSetup'],
      confirmationTags: [],
      timeframeTags: ['1H'],
      emotionTags: ['Kalm'], // legacy emotion uit oude defaults
      mistakeTags: [],
      missedReasonTags: [],
    };
    await page.addInitScript((cfg) => {
      localStorage.setItem('tj_tags', JSON.stringify(cfg));
      localStorage.setItem('tj_welcomed', '1');
      localStorage.setItem('tj_milestones_seen', JSON.stringify(['trades-10','first-win']));
    }, ownConfig);
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 15_000 });
    await page.evaluate(() => { window.location.hash = '#/tags'; });
    await page.waitForFunction(() => /Tag categorie/i.test(document.body.innerText), { timeout: 5_000 });
    await page.waitForTimeout(400);

    // De eigen tag moet zichtbaar zijn
    await expect(page.locator('[data-testid="tag-box-setupTags-MijnEigenSetup"]')).toBeVisible();
    await expect(page.locator('[data-testid="tag-box-emotionTags-Kalm"]')).toBeVisible();
    // Een nieuwe-default die NIET in eigen config staat moet ontbreken
    await expect(page.locator('[data-testid="tag-box-setupTags-Structuur"]')).not.toBeVisible();
    // Validatie via localStorage zelf
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('tj_tags') || '{}'));
    expect(stored.setupTags).toEqual(['MijnEigenSetup']);
    expect(stored.emotionTags).toEqual(['Kalm']);
  });
});
