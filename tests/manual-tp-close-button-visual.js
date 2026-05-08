// Visuele check: open een manual trade in de edit-modal met 100% hit TPs en zie de close-knop
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const APP = path.resolve(__dirname, '../work/tradejournal.html');
const OUT = path.resolve(__dirname, 'screenshots/manual-tp-close-button');

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 1200 } });
  const page = await ctx.newPage();
  page.on('pageerror', err => console.error('PAGE ERROR:', err.message));

  // Seed met manual trade die 100% hit TPs heeft
  await page.addInitScript(() => {
    localStorage.setItem('tj_welcomed', '1');
    const trades = [{
      id: 'manual_demo_1',
      source: 'manual',
      status: 'open',
      direction: 'long',
      pair: 'BTC/USDT',
      entry: '70000',
      stopLoss: '69000',
      positionSize: '1000',
      positionSizeAsset: '0.01428',
      pnl: '',
      exit: '',
      fees: '0',
      leverage: '10',
      date: '2026-05-08',
      time: '10:00',
      manualOverrides: [],
      tpLevels: [
        { id: 'tp1', price: '71000', pct: '50', status: 'hit', actualPrice: '71000' },
        { id: 'tp2', price: '72000', pct: '50', status: 'hit', actualPrice: '72000' },
      ],
      setupTags: [], confirmationTags: [], timeframeTags: [], emotionTags: [], mistakeTags: [], customTags: [],
      rating: 0, screenshot: null, notes: '', links: [], layers: [],
    }];
    localStorage.setItem('tj_trades', JSON.stringify(trades));
  });

  await page.goto('file://' + APP);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  // Navigate naar Trades-tab
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const t = btns.find(b => /^Trades$/.test(b.textContent.trim()));
    if (t) t.click();
  });
  await page.waitForTimeout(800);

  // Open de trade — zoek "70000" in de tabel
  await page.evaluate(() => {
    const cells = [...document.querySelectorAll('td')];
    const c = cells.find(el => el.textContent && el.textContent.includes('70000'));
    if (c) {
      const row = c.closest('tr');
      if (row) row.click();
    }
  });
  await page.waitForTimeout(1200);

  // Screenshot: full page (modal moet open zijn)
  await page.screenshot({ path: path.join(OUT, '01-modal-with-button.png'), fullPage: false });
  console.log('✓ 01-modal-with-button screenshot');

  // Test of de "Trade sluiten" knop daadwerkelijk in de DOM staat
  const buttonInfo = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const closeBtn = btns.find(b => b.textContent && b.textContent.includes('Trade sluiten'));
    if (closeBtn) {
      return {
        found: true,
        text: closeBtn.textContent,
        bg: closeBtn.style.background,
        visible: closeBtn.offsetWidth > 0 && closeBtn.offsetHeight > 0,
      };
    }
    return { found: false };
  });
  console.log('Button info:', JSON.stringify(buttonInfo, null, 2));

  await browser.close();
  process.exit(buttonInfo.found && buttonInfo.visible ? 0 : 1);
})();
