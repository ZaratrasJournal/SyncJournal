// Toggle-check — voor elk van de 4 te-integreren directions (reactions/cinema/
// dossier/monogram) maakt screenshots van twee configs:
//   1. Alle toggles aan (default)
//   2. Minimaal: alleen pair + side + pnl zichtbaar
const { chromium } = require('playwright');
const path = require('path');

const DIRECTIONS = ['reactions', 'cinema', 'dossier', 'monogram'];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1700, height: 1500 } });
  page.on('pageerror', e => console.error('[pageerror]', e.message));

  const APP = path.resolve(__dirname, '../demos/share-card-v2-demo.html');
  const url = 'file:///' + APP.replace(/\\/g, '/');
  await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1500);

  for (const dir of DIRECTIONS) {
    // 1. Alles aan (default)
    await page.evaluate((d) => {
      document.querySelector(`.direction-tile[data-direction="${d}"]`).click();
      document.querySelectorAll('input[data-show]').forEach(cb => { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); });
    }, dir);
    await page.waitForTimeout(700);
    const card16Full = await page.$('#card-16x9-render');
    if (card16Full) await card16Full.screenshot({ path: path.join(__dirname, `screenshots/toggle-${dir}-full-16x9.png`) });
    const card1Full = await page.$('#card-1x1-render');
    if (card1Full) await card1Full.screenshot({ path: path.join(__dirname, `screenshots/toggle-${dir}-full-1x1.png`) });
    console.log(`SHOT ${dir} — alles aan`);

    // 2. Minimaal: alleen pnl checked, rest uit
    await page.evaluate(() => {
      document.querySelectorAll('input[data-show]').forEach(cb => {
        cb.checked = (cb.dataset.show === 'pnl');
        cb.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
    await page.waitForTimeout(700);
    const card16Min = await page.$('#card-16x9-render');
    if (card16Min) await card16Min.screenshot({ path: path.join(__dirname, `screenshots/toggle-${dir}-min-16x9.png`) });
    const card1Min = await page.$('#card-1x1-render');
    if (card1Min) await card1Min.screenshot({ path: path.join(__dirname, `screenshots/toggle-${dir}-min-1x1.png`) });
    console.log(`SHOT ${dir} — minimaal (alleen PnL)`);
  }

  await browser.close();
  console.log('OK — 16 toggle-check screenshots gemaakt');
})().catch(e => { console.error(e); process.exit(1); });
