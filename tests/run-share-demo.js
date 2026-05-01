const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  page.on('console', m => { if (m.type()==='error') console.log('[err]', m.text()); });

  const APP = path.resolve(__dirname, '../demos/share-card-v2-demo.html');
  const url = 'file:///' + APP.replace(/\\/g, '/');
  await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1800);

  await page.screenshot({ path: path.join(__dirname, 'screenshots/demo-share-v2-initial.png'), fullPage: true });

  await page.evaluate(() => {
    document.getElementById('i-rmult').value = '-1';
    document.getElementById('i-rmult').dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(__dirname, 'screenshots/demo-share-v2-pablo.png'), fullPage: true });

  await page.evaluate(() => {
    document.getElementById('i-rmult').value = '8.2';
    document.getElementById('i-rmult').dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('i-side').value = 'short';
    document.getElementById('i-side').dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(__dirname, 'screenshots/demo-share-v2-finalboss.png'), fullPage: true });

  await browser.close();
  console.log('OK — 3 screenshots gemaakt');
})().catch(e => { console.error(e); process.exit(1); });
