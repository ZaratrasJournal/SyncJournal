const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => console.log('[PAGEERROR]', e.message));
  page.on('console', m => {
    const t = m.type();
    if (t === 'error' || t === 'warning') console.log('[' + t + ']', m.text().slice(0, 300));
  });
  const APP = path.resolve(__dirname, '../work/tradejournal.html');
  const url = 'file:///' + APP.replace(/\\/g, '/');
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(4000);
  const text = await page.evaluate(() => document.body.innerText.slice(0, 500));
  console.log('---BODY---');
  console.log(text);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
