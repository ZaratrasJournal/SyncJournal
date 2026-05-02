// Verifies the v12.71 bulk-tag panel additions:
//   - Timeframe-categorie zichtbaar (5e knoppenrij)
//   - Layer-builder: TF + setups + confirms → "+ Voeg layer toe"
//   - Layer-aware simple-tag: tag-knop schrijft naar eerste layer als die bestaat
//   - Dedupe: zelfde layer twee keer toevoegen = no-op
//   - Disabled-state: knop alleen actief als ≥1 setup of ≥1 confirmation gepickt
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

function makeFlatOnlyTrade(id, dateOffset = 1) {
  const d = new Date();
  d.setDate(d.getDate() - dateOffset);
  return {
    ...baseTrade, id,
    date: d.toISOString().split('T')[0], time: '14:00:00',
    setupTags: [], timeframeTags: [],
    layers: [],
  };
}

function makeLayeredTrade(id, dateOffset = 1) {
  const d = new Date();
  d.setDate(d.getDate() - dateOffset);
  return {
    ...baseTrade, id,
    date: d.toISOString().split('T')[0], time: '14:00:00',
    setupTags: [], timeframeTags: [], confirmationTags: [],
    layers: [
      { id: 'L_existing', timeframe: '4H', setups: ['MSB'], confirmations: ['Liquidity Sweep'] },
    ],
  };
}

const TAG_CFG = {
  setupTags: ['BOS', 'MSB', 'SFP'],
  emotionTags: ['Kalm'],
  mistakeTags: ['Te vroeg in'],
  timeframeTags: ['1M', '5M', '15M', '1H', '4H', 'Daily'],
  confirmationTags: ['Liquidity Sweep', 'OB', 'FVG'],
  missedReasonTags: [],
};

async function setup(page, trades) {
  await page.addInitScript(seedLocalStorage, { trades });
  await page.addInitScript((cfg) => {
    localStorage.setItem('tj_tags', JSON.stringify(cfg));
    localStorage.setItem('tj_milestones_seen', JSON.stringify([
      'trades-10','trades-50','trades-100','trades-250','trades-500','trades-1000',
      'win-streak-5','win-streak-10','first-win'
    ]));
  }, TAG_CFG);
  await page.goto(FILE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 15_000 });
  await page.evaluate(() => { window.location.hash = '#/trades'; });
  await page.waitForFunction(() => /Status/i.test(document.body.innerText), { timeout: 5_000 });
  await page.waitForTimeout(500);
}

async function selectAllTrades(page) {
  // De "checkbox" is een <div> in een <th>, geen echte input. Klik de eerste <th>
  // in de table-header (bevat de toggleAll-handler).
  await page.locator('thead th').first().click();
}

async function openBulkTagPanel(page) {
  await page.getByRole('button', { name: 'Tags toevoegen', exact: true }).click();
  await expect(page.getByText(/Tags toevoegen aan \d+ trades/)).toBeVisible({ timeout: 3_000 });
}

async function readTrades(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('tj_trades') || '[]'));
}

test.describe('Bulk-tag panel: timeframe + layer-builder', () => {
  test('Timeframe-categorie staat tussen de bulk-tag-knoppen', async ({ page }) => {
    await setup(page, [makeFlatOnlyTrade('t1'), makeFlatOnlyTrade('t2', 2)]);
    await selectAllTrades(page);
    await openBulkTagPanel(page);

    // Timeframe-kop moet zichtbaar zijn als categorie-label
    await expect(page.getByText('Timeframe').first()).toBeVisible();
    // En timeframe-knoppen ('1H', '4H') moeten in 't panel zitten
    await expect(page.getByRole('button', { name: '1H', exact: true }).first()).toBeVisible();
  });

  test('Layer-builder: TF + setup + confirm → klik "+ Voeg layer toe" voegt layer aan beide trades', async ({ page }) => {
    await setup(page, [makeFlatOnlyTrade('t1'), makeFlatOnlyTrade('t2', 2)]);
    await selectAllTrades(page);
    await openBulkTagPanel(page);

    // Knop moet eerst disabled zijn
    const addBtn = page.getByRole('button', { name: /\+ Voeg layer toe/i });
    await expect(addBtn).toBeDisabled();

    // Locators scope op de layer-builder via data-testid om collision te voorkomen
    // met de simple-tag knoppen (1H/4H/SFP/OB komen ook voor in de Timeframe/Setup/Confirm-rijen).
    const builderRoot = page.locator('[data-testid="bulk-layer-builder"]');
    await builderRoot.getByRole('button', { name: '4H', exact: true }).click();
    await builderRoot.getByRole('button', { name: 'SFP', exact: true }).click();
    await builderRoot.getByRole('button', { name: 'OB', exact: true }).click();

    await expect(addBtn).toBeEnabled();
    await addBtn.click();
    await page.waitForTimeout(300);

    const trades = await readTrades(page);
    for (const id of ['t1', 't2']) {
      const t = trades.find(x => x.id === id);
      expect(t.layers).toHaveLength(1);
      expect(t.layers[0].timeframe).toBe('4H');
      expect(t.layers[0].setups).toEqual(['SFP']);
      expect(t.layers[0].confirmations).toEqual(['OB']);
      // Flat-arrays moeten ook gederiveerd zijn (syncTradeFlatFields)
      expect(t.setupTags).toEqual(['SFP']);
      expect(t.timeframeTags).toEqual(['4H']);
      expect(t.confirmationTags).toEqual(['OB']);
    }
  });

  test('Layer-builder dedupeert: zelfde layer 2x toevoegen blijft 1 layer', async ({ page }) => {
    await setup(page, [makeFlatOnlyTrade('t1')]);
    await selectAllTrades(page);
    await openBulkTagPanel(page);

    const builderRoot = page.locator('[data-testid="bulk-layer-builder"]');
    await builderRoot.getByRole('button', { name: '1H', exact: true }).click();
    await builderRoot.getByRole('button', { name: 'SFP', exact: true }).click();
    const addBtn = page.getByRole('button', { name: /\+ Voeg layer toe/i });
    await addBtn.click();
    await page.waitForTimeout(200);

    // Zelfde layer nog eens — pickers zijn gewist, dus opnieuw selecteren
    await builderRoot.getByRole('button', { name: '1H', exact: true }).click();
    await builderRoot.getByRole('button', { name: 'SFP', exact: true }).click();
    await addBtn.click();
    await page.waitForTimeout(200);

    const t = (await readTrades(page)).find(x => x.id === 't1');
    expect(t.layers).toHaveLength(1);
  });

  test('Layer-aware tag: simple setup-knop op trade MET layers schrijft naar eerste layer', async ({ page }) => {
    await setup(page, [makeLayeredTrade('t_layered')]);
    await selectAllTrades(page);
    await openBulkTagPanel(page);

    // Klik 'BOS' in de Setup Type-rij (eerste kolom van categorieën, niet layer-builder)
    // Ze hebben dezelfde naam dus we moeten op volgorde — eerste match is de simple-knop.
    await page.getByRole('button', { name: 'BOS', exact: true }).first().click();
    await page.waitForTimeout(200);

    const t = (await readTrades(page)).find(x => x.id === 't_layered');
    // Eerste layer moet nu ['MSB', 'BOS'] hebben
    expect(t.layers[0].setups.sort()).toEqual(['BOS', 'MSB']);
    // Layer-count blijft 1 (geen nieuwe layer aangemaakt)
    expect(t.layers).toHaveLength(1);
    // Flat-array moet de unie reflecteren
    expect(t.setupTags.sort()).toEqual(['BOS', 'MSB']);
  });

  test('Layer-aware tag op flat-only trade: simple setup-knop schrijft naar flat (geen layer aangemaakt)', async ({ page }) => {
    await setup(page, [makeFlatOnlyTrade('t_flat')]);
    await selectAllTrades(page);
    await openBulkTagPanel(page);

    await page.getByRole('button', { name: 'BOS', exact: true }).first().click();
    await page.waitForTimeout(200);

    const t = (await readTrades(page)).find(x => x.id === 't_flat');
    expect(t.layers).toEqual([]);
    expect(t.setupTags).toEqual(['BOS']);
  });

  test('Toggle: tag-knop highlight als alle selected trades de tag hebben, klik = remove', async ({ page }) => {
    // Beide trades hebben SFP in flat — knop moet direct active zijn
    const trades = [
      { ...makeFlatOnlyTrade('t1'), setupTags: ['SFP'] },
      { ...makeFlatOnlyTrade('t2', 2), setupTags: ['SFP'] },
    ];
    await setup(page, trades);
    await selectAllTrades(page);
    await openBulkTagPanel(page);

    // SFP-knop in Setup Type-rij moet aria-pressed="true" hebben (active state)
    const sfpBtn = page.getByRole('button', { name: 'SFP', exact: true }).first();
    await expect(sfpBtn).toHaveAttribute('aria-pressed', 'true');

    // Klik → tag moet weg zijn van beide
    await sfpBtn.click();
    await page.waitForTimeout(200);

    const after = await readTrades(page);
    expect(after.find(x => x.id === 't1').setupTags).toEqual([]);
    expect(after.find(x => x.id === 't2').setupTags).toEqual([]);
    // Knop moet nu inactive zijn
    await expect(sfpBtn).toHaveAttribute('aria-pressed', 'false');
  });

  test('Toggle: tag op één-van-twee trades is NIET active (mixed state)', async ({ page }) => {
    const trades = [
      { ...makeFlatOnlyTrade('t1'), setupTags: ['SFP'] },
      { ...makeFlatOnlyTrade('t2', 2), setupTags: [] }, // mist SFP
    ];
    await setup(page, trades);
    await selectAllTrades(page);
    await openBulkTagPanel(page);

    const sfpBtn = page.getByRole('button', { name: 'SFP', exact: true }).first();
    // Mixed state — niet alle trades hebben de tag → niet active
    await expect(sfpBtn).toHaveAttribute('aria-pressed', 'false');

    // Klik → voegt toe aan beide
    await sfpBtn.click();
    await page.waitForTimeout(200);

    const after = await readTrades(page);
    expect(after.find(x => x.id === 't1').setupTags).toEqual(['SFP']);
    expect(after.find(x => x.id === 't2').setupTags).toEqual(['SFP']);
    await expect(sfpBtn).toHaveAttribute('aria-pressed', 'true');
  });

  test('Toggle layer-aware: untag op layered trade strip de tag uit alle layers', async ({ page }) => {
    const trade = {
      ...makeLayeredTrade('t_l'),
      // Twee layers, beide hebben SFP
      layers: [
        { id: 'L1', timeframe: '4H', setups: ['MSB', 'SFP'], confirmations: ['Liquidity Sweep'] },
        { id: 'L2', timeframe: '1H', setups: ['SFP'], confirmations: ['OB'] },
      ],
    };
    await setup(page, [trade]);
    await selectAllTrades(page);
    await openBulkTagPanel(page);

    const sfpBtn = page.getByRole('button', { name: 'SFP', exact: true }).first();
    await expect(sfpBtn).toHaveAttribute('aria-pressed', 'true');

    await sfpBtn.click();
    await page.waitForTimeout(200);

    const t = (await readTrades(page)).find(x => x.id === 't_l');
    // SFP weg uit beide layers
    expect(t.layers[0].setups).toEqual(['MSB']);
    expect(t.layers[1].setups).toEqual([]);
    // Layers blijven bestaan (geen layer verwijderd)
    expect(t.layers).toHaveLength(2);
    // Flat ge-resynced uit layers
    expect(t.setupTags).toEqual(['MSB']);
  });

  test('Toggle timeframe-untag: layer behoudt setups/confirmations, alleen TF wordt geleegd', async ({ page }) => {
    const trade = {
      ...makeLayeredTrade('t_tf'),
      layers: [
        { id: 'L1', timeframe: '4H', setups: ['MSB'], confirmations: ['Liquidity Sweep'] },
      ],
    };
    await setup(page, [trade]);
    await selectAllTrades(page);
    await openBulkTagPanel(page);

    const tfBtn = page.getByRole('button', { name: '4H', exact: true }).first();
    await expect(tfBtn).toHaveAttribute('aria-pressed', 'true');

    await tfBtn.click();
    await page.waitForTimeout(200);

    const t = (await readTrades(page)).find(x => x.id === 't_tf');
    expect(t.layers).toHaveLength(1);
    expect(t.layers[0].timeframe).toBe('');
    expect(t.layers[0].setups).toEqual(['MSB']);
    expect(t.layers[0].confirmations).toEqual(['Liquidity Sweep']);
    expect(t.timeframeTags).toEqual([]);
  });
});
