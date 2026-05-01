// Reactie-meme cropping check — voor elk van de 5 memes (goodfellas/giggling/
// omg/finalboss/pablo) maakt het screenshots van zowel 16:9 als 1:1 zodat
// Denny visueel kan beoordelen of het gezicht volledig zichtbaar is.
//
// Output: tests/screenshots/meme-check-<variant>-{16x9,1x1}.png
const { chromium } = require('playwright');
const path = require('path');

const VARIANTS = [
  { id: 'goodfellas', rmult: 5.6, side: 'long',  pnl: 945 },
  { id: 'giggling',   rmult: 0.5, side: 'long',  pnl: 84  },
  { id: 'omg',        rmult: NaN, side: 'long',  pnl: 0   },
  { id: 'finalboss',  rmult: 8.2, side: 'short', pnl: 1840 },
  { id: 'pablo',      rmult: -1,  side: 'short', pnl: -320 },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1700, height: 1500 } });
  page.on('pageerror', e => console.error('[pageerror]', e.message));

  const APP = path.resolve(__dirname, '../demos/share-card-v2-demo.html');
  const url = 'file:///' + APP.replace(/\\/g, '/');
  await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1500);

  // Force direction = reactions
  await page.evaluate(() => {
    document.querySelector('.direction-tile[data-direction="reactions"]').click();
  });
  await page.waitForTimeout(500);

  for (const v of VARIANTS) {
    // Set form data + click variant tile
    await page.evaluate((data) => {
      document.getElementById('i-rmult').value = isNaN(data.rmult) ? '' : data.rmult;
      document.getElementById('i-rmult').dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('i-side').value = data.side;
      document.getElementById('i-side').dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('i-pnl').value = data.pnl;
      document.getElementById('i-pnl').dispatchEvent(new Event('input', { bubbles: true }));
      // Click the variant tile (manual override)
      document.querySelector(`.mood-tile[data-variant="${data.id}"]`).click();
    }, v);
    await page.waitForTimeout(700);

    // Capture both card-16x9 and card-1x1 elementen exact
    const card16 = await page.$('#card-16x9-render');
    if (card16) {
      await card16.screenshot({
        path: path.join(__dirname, `screenshots/meme-check-${v.id}-16x9.png`)
      });
      console.log(`SHOT 16:9 ${v.id}`);
    }
    const card1 = await page.$('#card-1x1-render');
    if (card1) {
      await card1.screenshot({
        path: path.join(__dirname, `screenshots/meme-check-${v.id}-1x1.png`)
      });
      console.log(`SHOT 1:1  ${v.id}`);
    }
  }

  await browser.close();
  console.log('OK — 10 meme-check screenshots gemaakt');
})().catch(e => { console.error(e); process.exit(1); });
