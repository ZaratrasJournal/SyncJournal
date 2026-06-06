const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGE: ' + String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  const url = 'file:///' + path.resolve(__dirname, '..', 'work', 'tradejournal.html').replace(/\\/g, '/');
  await page.goto(url);
  await page.waitForTimeout(2000);
  // Trigger demo-mode
  try {
    const demoBtn = page.locator('text=Probeer met demo').first();
    if (await demoBtn.isVisible({ timeout: 2000 })) await demoBtn.click();
    await page.waitForTimeout(1500);
  } catch {}
  // Dismiss eventuele modal eerst
  try {
    const dismiss = page.locator('button:has-text("Begrepen")').first();
    if (await dismiss.isVisible({ timeout: 1500 })) await dismiss.click();
    await page.waitForTimeout(500);
  } catch {}
  // Navigeer naar Analytics via hash
  await page.goto(url + '#/analytics');
  await page.waitForTimeout(2500);
  // Dismiss nogmaals
  try {
    const dismiss = page.locator('button:has-text("Begrepen")').first();
    if (await dismiss.isVisible({ timeout: 1500 })) await dismiss.click();
    await page.waitForTimeout(500);
  } catch {}

  const checks = [];
  const tryClick = async (label, selector) => {
    try {
      await page.locator(selector).first().click({ timeout: 2000 });
      await page.waitForTimeout(800);
      const pnlText = await page.locator('text=NET PNL').first().locator('..').textContent();
      checks.push({ filter: label, ok: true, netPnl: pnlText.replace(/\s+/g, ' ').trim().substring(0, 80) });
    } catch (e) {
      checks.push({ filter: label, ok: false, error: String(e).substring(0, 120) });
    }
  };

  await tryClick('baseline (geen filter)', 'text=NET PNL');
  await tryClick('Long', 'button:has-text("Long")');
  await tryClick('Long (reset)', 'button.active:has-text("Long")');
  await tryClick('Short', 'button:has-text("Short")');
  await tryClick('Short (reset)', 'button.active:has-text("Short")');
  await tryClick('Winners', 'button:has-text("Winners")');
  await tryClick('Winners (reset)', 'button.active:has-text("Winners")');
  await tryClick('Losers', 'button:has-text("Losers")');
  await tryClick('Losers (reset)', 'button.active:has-text("Losers")');

  // Datum filter
  try {
    const dateFrom = page.locator('input[type="date"]').first();
    await dateFrom.fill('2026-06-01');
    await page.waitForTimeout(800);
    const pnlText = await page.locator('text=NET PNL').first().locator('..').textContent();
    checks.push({ filter: 'datum vanaf 2026-06-01', ok: true, netPnl: pnlText.replace(/\s+/g, ' ').trim().substring(0, 80) });
    await dateFrom.fill('');
    await page.waitForTimeout(500);
  } catch (e) {
    checks.push({ filter: 'datum filter', ok: false, error: String(e).substring(0, 120) });
  }

  await page.screenshot({ path: 'tests/screenshots/v12.227-filter-state.png', fullPage: false });
  console.log('=== FILTER CHECK RESULTS ===');
  checks.forEach(c => {
    if (c.ok) console.log(`  OK  ${c.filter} -> ${c.netPnl}`);
    else console.log(`  FAIL ${c.filter}: ${c.error}`);
  });
  console.log('=== JS ERRORS ===');
  console.log('Total errors:', errs.length);
  errs.slice(0, 8).forEach(e => console.log(' -', e.substring(0, 250)));
  await browser.close();
  process.exit(errs.length ? 1 : 0);
})();
