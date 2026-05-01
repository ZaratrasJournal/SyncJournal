// Demo screenshot runner — toont alle 6 directions × 1 screenshot per direction.
// Output naar tests/screenshots/demo-share-v2-<direction>.png
const { chromium } = require('playwright');
const path = require('path');

const DIRECTIONS = ['reactions', 'cinema', 'dossier', 'monogram', 'portrait', 'archive'];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1700, height: 1500 } });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('[err]', m.text()); });

  const APP = path.resolve(__dirname, '../demos/share-card-v2-demo.html');
  const url = 'file:///' + APP.replace(/\\/g, '/');
  await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1500);

  for (const dir of DIRECTIONS) {
    await page.evaluate((d) => {
      const tile = document.querySelector(`.direction-tile[data-direction="${d}"]`);
      if (tile) tile.click();
    }, dir);
    await page.waitForTimeout(700);
    const out = path.join(__dirname, `screenshots/demo-share-v2-${dir}.png`);
    await page.screenshot({ path: out, fullPage: true });
    console.log(`SHOT: ${dir} → ${out}`);
  }

  await browser.close();
  console.log('OK — 6 screenshots gemaakt');
})().catch(e => { console.error(e); process.exit(1); });
