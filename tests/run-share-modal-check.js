// Open de Share-card v2 modal in tradejournal.html via een fixture-trade en
// schiet screenshots van de 4 directions. Bewijs dat de v2 integratie werkt.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const FIXTURE = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures/blofin-partial-state.json'), 'utf8')
);

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1700, height: 1500 } });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('[err]', m.text().slice(0, 200)); });

  await page.addInitScript((fx) => {
    if (fx.trades) localStorage.setItem('tj_trades', JSON.stringify(fx.trades));
    if (fx.config) localStorage.setItem('tj_config', JSON.stringify(fx.config));
    if (fx.accounts) localStorage.setItem('tj_accounts', JSON.stringify(fx.accounts));
    if (fx.playbooks) localStorage.setItem('tj_playbooks', JSON.stringify(fx.playbooks));
    localStorage.setItem('tj_welcomed', '1');
    localStorage.setItem('tj_milestones_seen', JSON.stringify([
      'trades-10','trades-50','trades-100','trades-250','trades-500','trades-1000',
      'win-streak-5','win-streak-10','first-win',
    ]));
    // Force route to trades
    window.location.hash = '#/trades';
  }, FIXTURE);

  const APP = path.resolve(__dirname, '../work/tradejournal.html');
  const url = 'file:///' + APP.replace(/\\/g, '/');
  await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForFunction(() => /Trades/i.test(document.body.innerText), { timeout: 15000 });
  await page.waitForTimeout(1500);

  // Click eerste trade-row to open TradeForm
  const firstRowClicked = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('[class*="tj-trow"], tr, [role="row"]'));
    for (const row of rows) {
      if (row.innerText && /ETH|BTC/.test(row.innerText) && /\d{2}-\d{2}-\d{4}|\d{2} [IV]/.test(row.innerText)) {
        // Click een editable element binnen de row
        const clickable = row.querySelector('button, [onclick], td');
        if (clickable) { clickable.click(); return true; }
        row.click(); return true;
      }
    }
    return false;
  });
  console.log('First row clicked:', firstRowClicked);
  await page.waitForTimeout(1500);

  // Klik op "Deel kaart" button
  let modalOpen = false;
  const deelClicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => /Deel kaart/i.test(b.innerText));
    if (btn) { btn.click(); return btn.innerText; }
    return null;
  });
  console.log('Clicked share button:', deelClicked);
  await page.waitForTimeout(1500);
  modalOpen = await page.$('.tc-card');

  if (!modalOpen) {
    console.log('FAIL: kon share-card modal niet openen via klik');
    await page.screenshot({ path: path.join(__dirname, 'screenshots/integ-no-modal.png'), fullPage: false });
    await browser.close();
    process.exit(1);
  }

  console.log('Modal open. Screenshotting per direction...');
  const directions = ['reactions', 'cinema', 'dossier', 'monogram'];
  for (const dir of directions) {
    await page.evaluate((d) => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => /^\s*\w+\s*$/.test(b.innerText) && b.innerText.toLowerCase().includes(d));
      if (btn) btn.click();
    }, dir);
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(__dirname, `screenshots/integ-share-${dir}.png`), fullPage: true });
    console.log(`SHOT ${dir}`);
  }

  await browser.close();
  console.log('OK');
})().catch(e => { console.error(e); process.exit(1); });
