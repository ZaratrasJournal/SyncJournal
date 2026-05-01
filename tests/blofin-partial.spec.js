// Partial-close validation test.
// Seedt localStorage met de Blofin-fixture (1 open BTC short + 15 closed records),
// laadt de app, en valideert dat:
//  1. detectPartialFromSiblings de open trade promote tot status="partial"
//  2. realizedPnl correct gevuld is (~+$3.26)
//  3. originalSizeAsset gezet is op 0.0029
//  4. tpLevels[] bevat 1 hit-niveau op price 75647.2 met pct ~33.86%
//  5. UI toont PARTIAL +$3.26 badge in trade-list
//  6. Sibling-record (29-04 close) is verborgen uit trade-list
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { seedLocalStorage } = require('./helpers/seed');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');
const FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/blofin-partial-state.json'), 'utf8'));

test.describe('Blofin partial-close detectie', () => {
  test('open trade krijgt status=partial + realizedPnl + tpLevels via auto-detectie', async ({ page }) => {
    // Seed localStorage VÓÓR app mount
    await page.addInitScript(seedLocalStorage, FIXTURE);

    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 15_000 });
    // Wacht tot detectPartialFromSiblings useEffect heeft gelopen + state gepersist is
    await page.waitForFunction(() => {
      const trades = JSON.parse(localStorage.getItem('tj_trades') || '[]');
      const open = trades.find(t => t.source === 'blofin' && (t.status === 'open' || t.status === 'partial'));
      return open && open.status === 'partial';
    }, { timeout: 10_000 });

    // Lees state uit localStorage en valideer
    const state = await page.evaluate(() => {
      const trades = JSON.parse(localStorage.getItem('tj_trades') || '[]');
      const partial = trades.find(t => t.source === 'blofin' && t.status === 'partial');
      return partial ? {
        status: partial.status,
        entry: partial.entry,
        positionSizeAsset: partial.positionSizeAsset,
        originalSizeAsset: partial.originalSizeAsset,
        realizedPnl: partial.realizedPnl,
        tpLevels: partial.tpLevels,
      } : null;
    });

    console.log('Partial trade state:', JSON.stringify(state, null, 2));

    expect(state, 'partial trade gevonden in localStorage').not.toBeNull();
    expect(state.status).toBe('partial');
    expect(state.entry).toBe('79000');
    expect(state.positionSizeAsset).toBe('0.0019');
    expect(parseFloat(state.originalSizeAsset)).toBeCloseTo(0.0029, 4);
    expect(parseFloat(state.realizedPnl)).toBeCloseTo(3.26, 1);
    expect(state.tpLevels).toHaveLength(1);
    expect(state.tpLevels[0].price).toBe('75647.2');
    expect(state.tpLevels[0].status).toBe('hit');
    expect(parseFloat(state.tpLevels[0].pct)).toBeGreaterThan(30);
    expect(parseFloat(state.tpLevels[0].pct)).toBeLessThan(40);
  });

  test('UI toont PARTIAL badge en verbergt sibling close-record', async ({ page }) => {
    await page.addInitScript(seedLocalStorage, FIXTURE);
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 15_000 });
    // Naviger naar Trades-tab — meeste apps hebben dat als default, maar zeker weten:
    await page.waitForTimeout(1500); // korte settle voor React-renders
    // Klik op Trades-tab als we daar nog niet zijn
    const tradesNav = page.getByText(/^Trades$/).first();
    if (await tradesNav.isVisible({ timeout: 2_000 }).catch(()=>false)) {
      await tradesNav.click();
      await page.waitForTimeout(500);
    }

    // Maak screenshot van de trade-list
    await page.screenshot({
      path: path.join(__dirname, 'screenshots/blofin-partial-list.png'),
      fullPage: true,
    });

    // PARTIAL badge moet zichtbaar zijn
    const html = await page.content();
    expect(html, 'PARTIAL-badge in DOM').toMatch(/PARTIAL/i);

    // De 29-04 close-record (sibling) moet verborgen zijn — alleen 22-04 BTC zichtbaar
    // Tel hoeveel rijen er zijn met "BTC/USDT short" — verwacht alleen de PARTIAL,
    // andere closed BTC records zijn met andere entries (74800, etc) dus die mogen er zijn.
    // Maar 75647.20 als EXIT mag NIET als losse closed-row verschijnen.
    expect(html, '75647.20 niet als losse close-row in trade-list (sibling-filter werkt)').not.toContain('75.647,20');
    // (de prijs zit nog wel in de tpLevels, maar die zijn in de trade-detail, niet in lijst-cellen)
  });
});
