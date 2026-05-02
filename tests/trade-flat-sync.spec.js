// Verificeert dat trade.layers[].setups / .timeframe / .confirmations bij elke load
// gederiveerd worden naar de platte arrays setupTags / timeframeTags / confirmationTags.
// Zonder die sync zien FilterBar, Analytics, detectTendencies en TagManager geen
// layer-only tags — zoals Denny rapporteerde voor zijn 173 trades met combo-tags.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { seedLocalStorage } = require('./helpers/seed');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');

const baseTrade = {
  pair: 'BTC/USDT', direction: 'long',
  entry: '50000', exit: '50500', pnl: '25',
  stopLoss: '49500', positionSize: '5000', positionSizeAsset: '0.1',
  leverage: '10', source: 'blofin', status: 'closed',
  emotionTags: [], mistakeTags: [], confirmationTags: [],
};

async function readTrades(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('tj_trades') || '[]'));
}

test.describe('Trade flat-fields sync vanuit layers', () => {
  test('Migratie: layer-only trade krijgt flat-arrays gevuld na load', async ({ page }) => {
    const fixture = { trades: [{
      ...baseTrade,
      id: 't_layer_only',
      date: '2026-04-25', time: '14:00:00',
      // Layers gevuld, flat-arrays expliciet leeg — simuleert Denny's situatie
      setupTags: [], timeframeTags: [],
      layers: [
        { id: 'L1', timeframe: '1H', setups: ['SFP'], confirmations: ['Liquidity Sweep'] },
        { id: 'L2', timeframe: '5M', setups: ['MSB'], confirmations: ['OB'] },
      ],
    }]};
    await page.addInitScript(seedLocalStorage, fixture);
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 15_000 });

    const trades = await readTrades(page);
    const t = trades.find(x => x.id === 't_layer_only');
    expect(t).toBeDefined();
    // Flat-arrays moeten unie zijn van alle layer-waardes
    expect(t.setupTags.sort()).toEqual(['MSB', 'SFP']);
    expect(t.timeframeTags.sort()).toEqual(['1H', '5M']);
    expect(t.confirmationTags.sort()).toEqual(['Liquidity Sweep', 'OB']);
    // Layers blijven intact (geen mutatie / dataloss)
    expect(t.layers).toHaveLength(2);
    expect(t.layers[0].setups).toEqual(['SFP']);
  });

  test('Trade zonder layers — flat-arrays blijven ongemoeid', async ({ page }) => {
    const fixture = { trades: [{
      ...baseTrade,
      id: 't_flat_only',
      date: '2026-04-25', time: '14:00:00',
      setupTags: ['Trend continuation', 'HTF support'],
      timeframeTags: ['4H'],
      // Géén layers
    }]};
    await page.addInitScript(seedLocalStorage, fixture);
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 15_000 });

    const t = (await readTrades(page)).find(x => x.id === 't_flat_only');
    expect(t.setupTags.sort()).toEqual(['HTF support', 'Trend continuation']);
    expect(t.timeframeTags).toEqual(['4H']);
  });

  test('Trade met layers:[] (lege array) — flat-arrays blijven ongemoeid', async ({ page }) => {
    const fixture = { trades: [{
      ...baseTrade,
      id: 't_empty_layers',
      date: '2026-04-25', time: '14:00:00',
      setupTags: ['Manual tag'],
      timeframeTags: ['1H'],
      layers: [],  // expliciet lege array — geen sync
    }]};
    await page.addInitScript(seedLocalStorage, fixture);
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 15_000 });

    const t = (await readTrades(page)).find(x => x.id === 't_empty_layers');
    expect(t.setupTags).toEqual(['Manual tag']);
    expect(t.timeframeTags).toEqual(['1H']);
  });

  test('Layers winnen bij conflict met handmatig getypte flat-tags', async ({ page }) => {
    const fixture = { trades: [{
      ...baseTrade,
      id: 't_conflict',
      date: '2026-04-25', time: '14:00:00',
      // Stale flat-tags die niet meer in de layers voorkomen
      setupTags: ['StaleTag', 'AnotherStale'],
      timeframeTags: ['Daily'],
      layers: [
        { id: 'L1', timeframe: '15M', setups: ['SFP'], confirmations: [] },
      ],
    }]};
    await page.addInitScript(seedLocalStorage, fixture);
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 15_000 });

    const t = (await readTrades(page)).find(x => x.id === 't_conflict');
    // Layers zijn bron-van-waarheid: stale flat-tags worden vervangen
    expect(t.setupTags).toEqual(['SFP']);
    expect(t.timeframeTags).toEqual(['15M']);
  });

  test('TagManager toont Nx-counter voor layer-only setups + delete-modal vuurt', async ({ page }) => {
    const fixture = { trades: Array.from({ length: 3 }, (_, i) => ({
      ...baseTrade,
      id: `t_${i+1}`,
      date: '2026-04-25', time: '14:00:00',
      setupTags: [], timeframeTags: [], confirmationTags: [],
      layers: [
        { id: `L${i+1}`, timeframe: '1H', setups: ['SFP'], confirmations: [] },
      ],
    }))};
    await page.addInitScript(seedLocalStorage, fixture);
    await page.addInitScript(() => {
      localStorage.setItem('tj_tags', JSON.stringify({
        setupTags: ['SFP', 'MSB'],
        emotionTags: [], mistakeTags: [], timeframeTags: [], confirmationTags: [], missedReasonTags: [],
      }));
      localStorage.setItem('tj_milestones_seen', JSON.stringify([
        'trades-10','trades-50','trades-100','trades-250','trades-500','trades-1000',
        'win-streak-5','win-streak-10','first-win'
      ]));
    });
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 15_000 });
    await page.evaluate(() => { window.location.hash = '#/tags'; });
    await page.waitForFunction(() => /Tag categorie/i.test(document.body.innerText), { timeout: 5_000 });
    await page.waitForTimeout(500);

    // De SFP-tag-box moet "3x" tonen (3 trades gebruiken 'em)
    const tagBox = page.locator('[data-testid="tag-box-setupTags-SFP"]');
    await expect(tagBox).toContainText('3x');

    // Klik ✕ op SFP — verwacht modal (niet native confirm) want usedCount > 0
    await tagBox.locator('button[title="Verwijder"]').click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText(/Tag "SFP" verwijderen\?/)).toBeVisible();
  });
});
