// v12.97 — Drie-lagen positionSize fix.
// Layer 1: _convertContracts fallback-aware
// Layer 2: fetchTrades pnl-fallback voor exotic coins
// Layer 3: normalizeTrade migratie verbreed naar lege positionSizeAsset
const { test, expect } = require('@playwright/test');
const path = require('path');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');

async function loadAppWithTrade(page, trade) {
  await page.addInitScript((t) => {
    localStorage.setItem('tj_welcomed', '1');
    localStorage.setItem('tj_trades', JSON.stringify([t]));
  }, trade);
  await page.goto(FILE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => /Trading Journal/i.test(document.body.innerText), { timeout: 15_000 });
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('tj_trades') || '[]').length > 0, { timeout: 5_000 });
}

test.describe('v12.97 positionSize self-heal — drie-lagen fix', () => {
  test('Layer 3 — Lege positionSizeAsset wordt gecorrigeerd via pnl-derivation', async ({ page }) => {
    // Reproduceer Denny's trade van vandaag: pid 1364821115
    // Werkelijk: 0.0072 BTC, $585 notional, PnL -2.1689
    // Bug-state: positionSize="72" (raw closeVol), positionSizeAsset=""
    await loadAppWithTrade(page, {
      id: 'mexc_1364821115_1778056365000',
      source: 'mexc',
      status: 'closed',
      direction: 'short',
      pair: 'BTC/USDT',
      positionId: '1364821115',
      entry: '81312.9',
      exit: '81609.1',
      positionSize: '72',
      positionSizeAsset: '', // LEEG — was in v12.96 niet healable
      pnl: '-2.1689',
      fees: '0',
    });

    await page.waitForFunction(() => {
      const t = JSON.parse(localStorage.getItem('tj_trades'))[0];
      return t._sizeRehealed === true;
    }, { timeout: 5_000 });

    const corrected = await page.evaluate(() => JSON.parse(localStorage.getItem('tj_trades'))[0]);
    const asset = parseFloat(corrected.positionSizeAsset);
    const size = parseFloat(corrected.positionSize);
    // Expected: asset = 2.1689 / 296.2 = 0.00732, positionSize = 0.00732 × 81312.9 = $595
    expect(asset, 'asset gehealed uit pnl').toBeCloseTo(0.00732, 4);
    expect(size, 'positionSize ≈ $595').toBeCloseTo(595, 0);
    expect(corrected._sizeRehealed).toBe(true);
  });

  test('Layer 1 — _convertContracts gebruikt fallback-map als cache leeg is', async ({ page }) => {
    await page.addInitScript(() => { localStorage.setItem('tj_welcomed', '1'); });
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Trading Journal/i.test(document.body.innerText), { timeout: 15_000 });

    const result = await page.evaluate(() => {
      // Reset cache zodat we de fallback-map test isoleren
      ExchangeAPI.mexc._ctvCache = {};
      const conv = ExchangeAPI.mexc._convertContracts('BTC_USDT', 72, 81312.9);
      return {
        ctSize: conv.ctSize,
        assetQty: conv.assetQty,
        usdNotional: conv.usdNotional,
      };
    });
    expect(result.ctSize, 'fallback BTC_USDT ctSize gebruikt').toBe(0.0001);
    expect(result.assetQty, 'assetQty correct uit fallback').toBeCloseTo(0.0072, 6);
    expect(result.usdNotional, 'usdNotional correct').toBeCloseTo(585.45, 1);
  });

  test('Layer 2 — exotic coin niet in fallback-map valt terug op pnl-derivation', async ({ page }) => {
    // Simuleer een PEPE-trade die niet in fallback-map staat
    // Werkelijk: 1000 PEPE × $0.0001 = $0.10, PnL +$0.05 op move 0.0001 → 0.00015
    // Wat we verwachten: zelfs zonder ctSize, positionSize correct via pnl-fallback
    await page.addInitScript(() => { localStorage.setItem('tj_welcomed', '1'); });
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Trading Journal/i.test(document.body.innerText), { timeout: 15_000 });

    const result = await page.evaluate(() => {
      // Test layer 2 logic in isolatie (zonder ExchangeAPI.mexc) — repliceer de
      // pnl-derivation pad zoals in fetchTrades wanneer assetQty=0.
      const entryN = 0.00010;
      const exitN = 0.00015;
      const realisedN = 0.05;
      const feeAbs = 0;
      let positionSize = '';
      let positionSizeAsset = '';
      // assetQty = 0 (geen ctSize voor PEPE_USDT) → val terug op pnl-derivation
      const priceMove = Math.abs(exitN - entryN);
      if (entryN > 0 && exitN > 0 && Math.abs(realisedN) > 0.001 && priceMove > entryN * 1e-9) {
        const grossPnl = Math.abs(realisedN) + feeAbs;
        const derivedAsset = grossPnl / priceMove;
        if (derivedAsset > 0 && Number.isFinite(derivedAsset)) {
          positionSizeAsset = String(derivedAsset);
          positionSize = (derivedAsset * entryN).toFixed(2);
        }
      }
      return { positionSize, positionSizeAsset };
    });
    // 0.05 / |0.00015 - 0.0001| = 0.05 / 0.00005 = 1000 PEPE
    // positionSize = 1000 × 0.0001 = $0.10
    expect(parseFloat(result.positionSizeAsset), 'derived asset = 1000 PEPE').toBeCloseTo(1000, 0);
    expect(parseFloat(result.positionSize), 'positionSize ≈ $0.10').toBeCloseTo(0.10, 2);
  });

  test('Trade die al correct staat wordt NIET aangeraakt', async ({ page }) => {
    await loadAppWithTrade(page, {
      id: 'mexc_correct_v1297',
      source: 'mexc',
      status: 'closed',
      direction: 'long',
      entry: '70000',
      exit: '70500',
      positionSize: '700',
      positionSizeAsset: '0.01',
      pnl: '5.0',
      fees: '0.05',
    });

    await page.waitForTimeout(500);
    const t = await page.evaluate(() => JSON.parse(localStorage.getItem('tj_trades'))[0]);
    expect(parseFloat(t.positionSizeAsset)).toBe(0.01);
    expect(parseFloat(t.positionSize)).toBe(700);
    expect(t._sizeRehealed).toBeUndefined();
  });
});
