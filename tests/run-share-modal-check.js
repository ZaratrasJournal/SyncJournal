// Open de Share-card v2 modal in tradejournal.html via een fixture-trade en
// schiet screenshots van elke direction. Verifieert dat de v2 layout-fixes werken.
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
    window.location.hash = '#/trades';
  }, FIXTURE);

  const APP = path.resolve(__dirname, '../work/tradejournal.html');
  const url = 'file:///' + APP.replace(/\\/g, '/');
  await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForFunction(() => /Trades/i.test(document.body.innerText), { timeout: 15000 });
  await page.waitForTimeout(2000);

  // Klik eerste closed trade-row — trade-table gebruikt <tr onClick>
  const opened = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('tr')).filter(r => /WIN|LOSS|PARTIAL/.test(r.innerText));
    if (rows.length === 0) return 'no-tr-rows';
    const target = rows.find(r => /WIN|LOSS/.test(r.innerText)) || rows[0];
    target.click();
    return 'clicked-' + target.innerText.slice(0, 50).replace(/\n/g, '|');
  });
  console.log('Row click:', opened);
  await page.waitForTimeout(2000);

  // Klik op "📸 Deel kaart" button in de TradeForm modal
  const shared = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => /Deel kaart/i.test(b.innerText));
    if (!btn) return 'no-share-btn';
    btn.click();
    return 'clicked';
  });
  console.log('Share button:', shared);
  await page.waitForTimeout(1500);

  const modalOpen = await page.$('.tc-card');
  if (!modalOpen) {
    console.log('FAIL: modal niet open');
    await page.screenshot({ path: path.join(__dirname, 'screenshots/integ-fail.png'), fullPage: true });
    await browser.close();
    process.exit(1);
  }
  console.log('Modal open ✓');

  // Screenshots per direction
  const directions = ['reactions', 'cinema', 'dossier', 'monogram'];
  for (const dir of directions) {
    await page.evaluate((d) => {
      const tiles = Array.from(document.querySelectorAll('button'));
      const tile = tiles.find(t => {
        const txt = (t.innerText || '').toLowerCase().trim();
        return txt.startsWith(d) && txt.length < 30; // direction-tile heeft korte tekst
      });
      if (tile) tile.click();
    }, dir);
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(__dirname, `screenshots/integ-share-${dir}.png`), fullPage: true });
    console.log(`SHOT ${dir}`);
  }

  await browser.close();
  console.log('OK');
})().catch(e => { console.error(e); process.exit(1); });
