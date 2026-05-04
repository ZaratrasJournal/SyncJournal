// v12.85 — exchange-isolatie via adapter-pattern.
//
// Doel: bewijzen dat elke exchange haar eigen `detectPartials` adapter-methode
// heeft, en dat aanroepen op de ene exchange (bv. Blofin) trades van een andere
// exchange (bv. MEXC) NIET raken. Voorkomt kruis-besmetting bij toekomstige
// fixes — een Blofin-fix in `ExchangeAPI.blofin.detectPartials` kan onmogelijk
// het MEXC-pad beïnvloeden.
//
// Zie CLAUDE.md sectie "Exchange-architectuur" voor het architectuur-principe.
const { test, expect } = require('@playwright/test');
const path = require('path');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');

test.describe('Exchange-isolatie: detectPartials adapter-pattern (v12.85)', () => {
  test('Elke ondersteunde exchange heeft een eigen detectPartials methode', async ({ page }) => {
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Trading Journal/i.test(document.body.innerText), { timeout: 15_000 });

    // Verifieer dat ExchangeAPI globaal beschikbaar is en elke exchange een eigen
    // detectPartials methode heeft die een functie is.
    const adapters = await page.evaluate(() => {
      if (typeof ExchangeAPI === 'undefined') return null;
      const result = {};
      for (const ex of ['blofin', 'mexc', 'kraken', 'hyperliquid', 'ftmo']) {
        const a = ExchangeAPI[ex];
        result[ex] = {
          exists: !!a,
          hasDetectPartials: typeof a?.detectPartials === 'function',
        };
      }
      return result;
    });

    expect(adapters, 'ExchangeAPI moet globaal beschikbaar zijn').not.toBeNull();
    for (const ex of ['blofin', 'mexc', 'kraken', 'hyperliquid', 'ftmo']) {
      expect(adapters[ex].exists, `ExchangeAPI.${ex} bestaat`).toBe(true);
      expect(adapters[ex].hasDetectPartials, `ExchangeAPI.${ex}.detectPartials is een functie`).toBe(true);
    }
  });

  test('Blofin detectPartials raakt geen MEXC-trades (cross-exchange isolatie)', async ({ page }) => {
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Trading Journal/i.test(document.body.innerText), { timeout: 15_000 });

    // Mengsel: 1 Blofin open + 1 Blofin closed sibling (matching pair+direction+entry)
    // EN 1 MEXC open + 1 MEXC closed sibling (matching pair+direction+entry).
    // Run alleen Blofin's detectPartials. Verwacht: Blofin-trades worden partial
    // gemarkeerd, MEXC-trades blijven onaangeraakt (status = 'open' resp. 'closed').
    const result = await page.evaluate(() => {
      const trades = [
        { id: 'b_open_1', source: 'blofin', status: 'open',  pair: 'BTC/USDT', direction: 'long', entry: '70000', positionSizeAsset: '0.001' },
        { id: 'b_clos_1', source: 'blofin', status: 'closed', pair: 'BTC/USDT', direction: 'long', entry: '70000', exit: '71000', pnl: '1.00', _rawCloseSize: '0.001' },
        { id: 'm_open_1', source: 'mexc',   status: 'open',  pair: 'ETH/USDT', direction: 'long', entry: '3500',  positionSizeAsset: '0.1' },
        { id: 'm_clos_1', source: 'mexc',   status: 'closed', pair: 'ETH/USDT', direction: 'long', entry: '3500',  exit: '3600',  pnl: '10.00' },
      ];
      const after = ExchangeAPI.blofin.detectPartials(trades);
      const get = (id) => after.find(t => t.id === id);
      return {
        blofin_open_status: get('b_open_1')?.status,
        blofin_open_realizedPnl: get('b_open_1')?.realizedPnl,
        mexc_open_status: get('m_open_1')?.status,
        mexc_open_realizedPnl: get('m_open_1')?.realizedPnl,
        mexc_closed_status: get('m_clos_1')?.status,
      };
    });

    // Blofin-zijde: open trade is geüpgraded naar partial dankzij sibling
    expect(result.blofin_open_status, 'Blofin open trade is partial geworden').toBe('partial');
    expect(result.blofin_open_realizedPnl, 'Blofin partial heeft realizedPnl').toBeTruthy();

    // MEXC-zijde: ongeraakt — Blofin's adapter mag MEXC-trades nooit aanraken
    expect(result.mexc_open_status, 'MEXC open trade onveranderd door Blofin-adapter').toBe('open');
    expect(result.mexc_open_realizedPnl, 'MEXC trade kreeg geen realizedPnl van Blofin-adapter').toBeFalsy();
    expect(result.mexc_closed_status, 'MEXC closed trade onveranderd').toBe('closed');
  });

  test('MEXC detectPartials raakt geen Blofin-trades (cross-exchange isolatie omgekeerd)', async ({ page }) => {
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Trading Journal/i.test(document.body.innerText), { timeout: 15_000 });

    const result = await page.evaluate(() => {
      const trades = [
        { id: 'b_open_1', source: 'blofin', status: 'open',  pair: 'BTC/USDT', direction: 'long', entry: '70000', positionSizeAsset: '0.001' },
        { id: 'b_clos_1', source: 'blofin', status: 'closed', pair: 'BTC/USDT', direction: 'long', entry: '70000', exit: '71000', pnl: '1.00' },
        { id: 'm_open_1', source: 'mexc',   status: 'open',  pair: 'ETH/USDT', direction: 'long', entry: '3500',  positionSizeAsset: '0.1' },
        { id: 'm_clos_1', source: 'mexc',   status: 'closed', pair: 'ETH/USDT', direction: 'long', entry: '3500',  exit: '3600',  pnl: '10.00' },
      ];
      const after = ExchangeAPI.mexc.detectPartials(trades);
      const get = (id) => after.find(t => t.id === id);
      return {
        blofin_open_status: get('b_open_1')?.status,
        mexc_open_status: get('m_open_1')?.status,
      };
    });

    // MEXC-zijde: detectPartials op MEXC mag MEXC-trade markeren (zelfde shared logic)
    expect(result.mexc_open_status, 'MEXC open trade is partial via MEXC-adapter').toBe('partial');

    // Blofin-zijde: ongeraakt door MEXC-adapter
    expect(result.blofin_open_status, 'Blofin open trade onveranderd door MEXC-adapter').toBe('open');
  });

  test('FTMO detectPartials is no-op (CSV-only, geen API-side partial-detectie)', async ({ page }) => {
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Trading Journal/i.test(document.body.innerText), { timeout: 15_000 });

    const result = await page.evaluate(() => {
      const trades = [
        { id: 'f_open_1', source: 'ftmo',  status: 'open',  pair: 'EURUSD', direction: 'long', entry: '1.08000', positionSizeAsset: '1' },
        { id: 'f_clos_1', source: 'ftmo',  status: 'closed', pair: 'EURUSD', direction: 'long', entry: '1.08000', exit: '1.08500', pnl: '50' },
      ];
      const after = ExchangeAPI.ftmo.detectPartials(trades);
      // FTMO is no-op — input.length === output.length AND elke trade is identiek
      return {
        sameLength: after.length === trades.length,
        statusUnchanged: after.every((t, i) => t.status === trades[i].status),
        // No-op betekent ook geen realizedPnl, geen tpLevels toegevoegd
        noNewFields: after.every((t, i) => !t.realizedPnl || t.realizedPnl === trades[i].realizedPnl),
      };
    });

    expect(result.sameLength, 'FTMO no-op: zelfde aantal trades').toBe(true);
    expect(result.statusUnchanged, 'FTMO no-op: status unchanged').toBe(true);
    expect(result.noNewFields, 'FTMO no-op: geen velden toegevoegd').toBe(true);
  });

  test('Adapter-aanroep is functioneel equivalent met de oude shared functie (gedrag-behoud)', async ({ page }) => {
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Trading Journal/i.test(document.body.innerText), { timeout: 15_000 });

    // Bewijs dat de refactor pure structureel is: Blofin-adapter geeft exact
    // dezelfde output als directe shared-functie aanroep met "blofin" key.
    const result = await page.evaluate(() => {
      const trades = [
        { id: 'b1', source: 'blofin', status: 'open',  pair: 'BTC/USDT', direction: 'long', entry: '70000', positionSizeAsset: '0.001' },
        { id: 'b2', source: 'blofin', status: 'closed', pair: 'BTC/USDT', direction: 'long', entry: '70000', exit: '71000', pnl: '1.00', _rawCloseSize: '0.001' },
      ];
      const viaAdapter = ExchangeAPI.blofin.detectPartials(trades);
      const viaShared = detectPartialFromSiblings(trades, 'blofin');
      // Compareer JSON-strings — moet 1:1 identiek zijn
      return {
        identical: JSON.stringify(viaAdapter) === JSON.stringify(viaShared),
      };
    });

    expect(result.identical, 'adapter-aanroep === shared-aanroep (refactor is gedrag-behoudend)').toBe(true);
  });
});
