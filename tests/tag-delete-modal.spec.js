// 3-keuze tag-delete modal — verifieert dat verwijderen van een tag in
// Instellingen → Tags 3 paden biedt: (A) overal weg, (B) alleen config, (C) annuleren.
// Plus ESC-key + click-outside dismiss.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { seedLocalStorage } = require('./helpers/seed');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');

// Vaste fixture: 5 trades met setupTag "FOMO". Datum recent zodat default-period-filter niet kapt.
function makeTradesWithFOMO() {
  const now = new Date();
  const dateMinus = (offset) => {
    const d = new Date(now);
    d.setDate(d.getDate() - offset);
    return d.toISOString().split('T')[0];
  };
  return Array.from({ length: 5 }, (_, i) => ({
    id: `t_fomo_${i+1}`,
    date: dateMinus(i + 1),
    time: '14:30:00',
    pair: 'BTC/USDT', direction: 'long',
    entry: '50000', exit: '50500', pnl: '25',
    stopLoss: '49500', positionSize: '5000', positionSizeAsset: '0.1',
    leverage: '10', source: 'blofin', status: 'closed',
    setupTags: ['FOMO'],
    emotionTags: [], mistakeTags: [], timeframeTags: [], confirmationTags: [],
  }));
}

const SEED = {
  trades: makeTradesWithFOMO(),
  // tj_tags wordt apart geseed via addInitScript want seed.js helper kent geen "tags" key
};

async function setup(page) {
  await page.addInitScript(seedLocalStorage, SEED);
  await page.addInitScript(() => {
    // Tag-config: voeg FOMO toe aan setupTags zodat hij in de TagManager UI verschijnt
    localStorage.setItem('tj_tags', JSON.stringify({
      setupTags: ['BOS', 'MSB', 'FOMO'],
      emotionTags: ['Kalm'],
      mistakeTags: [],
      timeframeTags: ['1H'],
      confirmationTags: [],
      missedReasonTags: [],
    }));
    // Skip alle milestone-modals (anders blokkeren ze klikken)
    localStorage.setItem('tj_milestones_seen', JSON.stringify([
      'trades-10','trades-50','trades-100','trades-250','trades-500','trades-1000',
      'win-streak-5','win-streak-10','first-win'
    ]));
  });
  await page.goto(FILE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 15_000 });
  // Navigeer naar Tags-tab
  await page.evaluate(() => { window.location.hash = '#/tags'; });
  await page.waitForFunction(() => /Tag categorie/i.test(document.body.innerText), { timeout: 5_000 });
  await page.waitForTimeout(500);
}

// Klikt het ✕-knopje van een specifieke tag binnen TagManager.
// Gebruikt data-testid="tag-box-${catKey}-${tag}" voor robuuste lookup.
async function clickDeleteOnTag(page, tagName, catKey = 'setupTags') {
  const tagBox = page.locator(`[data-testid="tag-box-${catKey}-${tagName}"]`);
  await tagBox.locator('button[title="Verwijder"]').click();
}

test.describe('Tag-delete 3-keuze modal', () => {
  test('Pad A: "Verwijder uit config én van trades" → tag overal weg', async ({ page }) => {
    await setup(page);
    await clickDeleteOnTag(page, 'FOMO');

    // Modal moet verschijnen met juiste used-count
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText(/Tag "FOMO" verwijderen\?/)).toBeVisible();
    // De "5" zit in een <strong>, dus matchen we losser op de zin als geheel
    await expect(page.getByText(/Deze tag staat op/)).toBeVisible();

    await page.getByRole('button', { name: /⚠ Verwijder uit config én van trades/i }).click();

    // Modal weg
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 3_000 });

    // Tag uit config én van alle trades
    const state = await page.evaluate(() => ({
      tags: JSON.parse(localStorage.getItem('tj_tags') || '{}'),
      trades: JSON.parse(localStorage.getItem('tj_trades') || '[]'),
    }));
    expect(state.tags.setupTags).not.toContain('FOMO');
    expect(state.tags.setupTags).toEqual(['BOS', 'MSB']);
    const stillHasFOMO = state.trades.filter(t => (t.setupTags || []).includes('FOMO'));
    expect(stillHasFOMO).toHaveLength(0);
  });

  test('Pad B: "Verwijder uit config" → tag uit config maar trades behouden tag', async ({ page }) => {
    await setup(page);
    await clickDeleteOnTag(page, 'FOMO');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3_000 });

    // Het ✓-prefix onderscheidt deze knop van de ⚠-variant en van Annuleren
    await page.getByRole('button', { name: /✓ Verwijder uit config/i }).click();

    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 3_000 });

    const state = await page.evaluate(() => ({
      tags: JSON.parse(localStorage.getItem('tj_tags') || '{}'),
      trades: JSON.parse(localStorage.getItem('tj_trades') || '[]'),
    }));
    expect(state.tags.setupTags).not.toContain('FOMO');
    const stillHasFOMO = state.trades.filter(t => (t.setupTags || []).includes('FOMO'));
    expect(stillHasFOMO).toHaveLength(5);
  });

  test('Pad C: Annuleren → niets verandert', async ({ page }) => {
    await setup(page);
    await clickDeleteOnTag(page, 'FOMO');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3_000 });

    await page.getByRole('button', { name: /Annuleren/i }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 3_000 });

    const state = await page.evaluate(() => ({
      tags: JSON.parse(localStorage.getItem('tj_tags') || '{}'),
      trades: JSON.parse(localStorage.getItem('tj_trades') || '[]'),
    }));
    expect(state.tags.setupTags).toContain('FOMO');
    const stillHasFOMO = state.trades.filter(t => (t.setupTags || []).includes('FOMO'));
    expect(stillHasFOMO).toHaveLength(5);
  });

  test('ESC sluit modal zonder wijzigingen', async ({ page }) => {
    await setup(page);
    await clickDeleteOnTag(page, 'FOMO');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3_000 });

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 3_000 });

    const tags = await page.evaluate(() => JSON.parse(localStorage.getItem('tj_tags') || '{}'));
    expect(tags.setupTags).toContain('FOMO');
  });

  test('Click op backdrop sluit modal zonder wijzigingen', async ({ page }) => {
    await setup(page);
    await clickDeleteOnTag(page, 'FOMO');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 3_000 });

    // Klik op de backdrop (de buitenste container, niet de card binnen)
    const box = await dialog.boundingBox();
    await page.mouse.click(box.x + 10, box.y + 10); // hoek = zeker buiten card
    await expect(dialog).toBeHidden({ timeout: 3_000 });

    const tags = await page.evaluate(() => JSON.parse(localStorage.getItem('tj_tags') || '{}'));
    expect(tags.setupTags).toContain('FOMO');
  });

  test('Tag op 0 trades → géén modal, fallback naar simpele confirm()', async ({ page }) => {
    // Seed met "BOS" in config maar 0 trades die BOS gebruiken
    await page.addInitScript(seedLocalStorage, { trades: [
      { id: 'no_bos', date: '2026-04-25', time: '14:00:00', pair: 'BTC/USDT', direction: 'long',
        entry: '50000', exit: '50100', pnl: '5', stopLoss: '49500',
        setupTags: ['MSB'], emotionTags: [], mistakeTags: [], timeframeTags: [], confirmationTags: [],
        positionSize: '5000', positionSizeAsset: '0.1', leverage: '10', source: 'blofin', status: 'closed' },
    ]});
    await page.addInitScript(() => {
      localStorage.setItem('tj_tags', JSON.stringify({
        setupTags: ['BOS', 'MSB'], emotionTags: [], mistakeTags: [], timeframeTags: [], confirmationTags: [], missedReasonTags: [],
      }));
      localStorage.setItem('tj_milestones_seen', JSON.stringify(['trades-10','first-win']));
    });
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 15_000 });
    await page.evaluate(() => { window.location.hash = '#/tags'; });
    await page.waitForFunction(() => /Tag categorie/i.test(document.body.innerText), { timeout: 5_000 });
    await page.waitForTimeout(500);

    // Native window.confirm() interceppen — accepteer 'm
    let confirmCalled = false;
    page.on('dialog', async d => { confirmCalled = true; await d.accept(); });

    await clickDeleteOnTag(page, 'BOS');
    await page.waitForTimeout(400);

    // Custom modal mag NIET zijn verschenen
    await expect(page.getByRole('dialog')).toBeHidden();
    expect(confirmCalled).toBe(true);

    const tags = await page.evaluate(() => JSON.parse(localStorage.getItem('tj_tags') || '{}'));
    expect(tags.setupTags).not.toContain('BOS');
  });
});
