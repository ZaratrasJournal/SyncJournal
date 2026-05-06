// v12.96 — MEXC positionSize self-heal voor legacy pre-v12.89 trades.
//
// Pre-v12.89: bij CORS-fail op contract-detail endpoint kreeg een MEXC trade
// `positionSize = String(closeVol)` opgeslagen (= raw contracts, opgevat als USD).
// Daardoor werd qty bij display = positionSize/entry = factor-fout-kleine BTC.
// Symptoom: TP% som > 100%, per-TP winst ≠ trade PnL.
//
// Self-heal: bij elke load via normalizeTrade, recompute asset uit pnl+fees als
// (exit-entry)*asset*sign sterk afwijkt van pnl. PnL is autoritatief.
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
  await page.waitForFunction(() => {
    const arr = JSON.parse(localStorage.getItem('tj_trades') || '[]');
    return arr.length > 0;
  }, { timeout: 5_000 });
}

test.describe('MEXC positionSize self-heal (v12.96)', () => {
  test('Factor-8 mismatch (legacy bug) wordt gecorrigeerd', async ({ page }) => {
    // De exact case uit Denny's screenshot: pid 1360488693
    // Werkelijk: 0.0336 BTC × $80282.5 = $2697 notional, PnL $14.27
    // Opgeslagen (bug): asset 0.004185 BTC, positionSize $336 (= raw closeVol 336 als USD)
    await loadAppWithTrade(page, {
      id: 'mexc_legacy',
      source: 'mexc',
      status: 'closed',
      direction: 'short',
      pair: 'BTC/USDT',
      positionId: '1360488693',
      entry: '80282.5',
      exit: '79857.5',
      positionSize: '336',
      positionSizeAsset: '0.004185',
      pnl: '14.2777',
      fees: '0',
      tpLevels: [],
    });

    // Wacht tot self-heal heeft gelopen
    await page.waitForFunction(() => {
      const t = JSON.parse(localStorage.getItem('tj_trades'))[0];
      return t._sizeRehealed === true;
    }, { timeout: 5_000 });

    const corrected = await page.evaluate(() => JSON.parse(localStorage.getItem('tj_trades'))[0]);
    const asset = parseFloat(corrected.positionSizeAsset);
    const size = parseFloat(corrected.positionSize);

    // Verwacht: asset ≈ 0.0336, positionSize ≈ 2697.49
    expect(asset, 'asset gecorrigeerd naar ~0.0336').toBeCloseTo(0.0336, 3);
    expect(size, 'positionSize ≈ 2697').toBeCloseTo(2697.49, 0);
    expect(corrected._sizeRehealed, 'marker gezet').toBe(true);
  });

  test('Trade die al correct staat wordt NIET aangeraakt', async ({ page }) => {
    // Trade waar PnL en asset consistent zijn (within 5% ruis)
    // Long BTC: entry=70000, exit=70500, asset=0.01 BTC → PnL = 500*0.01 = $5
    await loadAppWithTrade(page, {
      id: 'mexc_correct',
      source: 'mexc',
      status: 'closed',
      direction: 'long',
      pair: 'BTC/USDT',
      positionId: '111',
      entry: '70000',
      exit: '70500',
      positionSize: '700',
      positionSizeAsset: '0.01',
      pnl: '5.0',
      fees: '0.05',
      tpLevels: [],
    });

    await page.waitForTimeout(500);
    const t = await page.evaluate(() => JSON.parse(localStorage.getItem('tj_trades'))[0]);
    expect(parseFloat(t.positionSizeAsset), 'asset onveranderd').toBe(0.01);
    expect(parseFloat(t.positionSize), 'size onveranderd').toBe(700);
    expect(t._sizeRehealed, 'geen marker — niet aangeraakt').toBeUndefined();
  });

  test('Migratie loopt eenmalig — _sizeRehealed marker voorkomt dubbel', async ({ page }) => {
    // Trade met marker al gezet → niet opnieuw normaliseren
    await loadAppWithTrade(page, {
      id: 'mexc_already_healed',
      source: 'mexc',
      status: 'closed',
      direction: 'short',
      entry: '80000',
      exit: '79500',
      positionSize: '500', // bewust "fout" om te checken of het NIET wordt aangeraakt
      positionSizeAsset: '0.00625',
      pnl: '2.5',
      fees: '0',
      _sizeRehealed: true,
    });

    await page.waitForTimeout(500);
    const t = await page.evaluate(() => JSON.parse(localStorage.getItem('tj_trades'))[0]);
    expect(parseFloat(t.positionSize), 'positionSize onveranderd door marker').toBe(500);
  });

  test('Open trade wordt overgeslagen (alleen closed)', async ({ page }) => {
    await loadAppWithTrade(page, {
      id: 'mexc_open',
      source: 'mexc',
      status: 'open',
      direction: 'long',
      entry: '80000',
      exit: '80500', // mark price, niet echte exit
      positionSize: '500', // raw contracts
      positionSizeAsset: '0.00625',
      pnl: '3.13', // unrealized
      fees: '0',
    });

    await page.waitForTimeout(500);
    const t = await page.evaluate(() => JSON.parse(localStorage.getItem('tj_trades'))[0]);
    expect(t._sizeRehealed, 'open trade niet aangeraakt').toBeUndefined();
  });

  test('Trade met fees wordt correct gecorrigeerd (gross = netto + fees)', async ({ page }) => {
    // BTC short, entry=80000, exit=79500, asset=0.01, gross=$5, fee=$0.5, netto=$4.5
    // Bug-state: opgeslagen asset=0.001 (factor 10 fout)
    await loadAppWithTrade(page, {
      id: 'mexc_with_fees',
      source: 'mexc',
      status: 'closed',
      direction: 'short',
      entry: '80000',
      exit: '79500',
      positionSize: '80',
      positionSizeAsset: '0.001',
      pnl: '4.5',
      fees: '0.5',
    });

    await page.waitForFunction(() => {
      const t = JSON.parse(localStorage.getItem('tj_trades'))[0];
      return t._sizeRehealed === true;
    }, { timeout: 5_000 });

    const corrected = await page.evaluate(() => JSON.parse(localStorage.getItem('tj_trades'))[0]);
    // expected asset = (4.5 + 0.5) / 500 = 0.01
    expect(parseFloat(corrected.positionSizeAsset), 'asset met fees inbegrepen').toBeCloseTo(0.01, 4);
  });
});
