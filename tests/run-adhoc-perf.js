// Ad-hoc laadtijd-meting (geen test-framework). Meet wat de gebruiker als "laden" ervaart.
const { chromium } = require('@playwright/test');
const path = require('path');
const FILE = 'file:///' + path.resolve(__dirname, '../work/tradejournal.html').split(path.sep).join('/');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const t0 = Date.now();
  await page.goto(FILE, { waitUntil: 'domcontentloaded' });
  const tDom = Date.now();
  await page.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 30000 });
  const tInteractive = Date.now();
  const res = await page.evaluate(() => performance.getEntriesByType('resource')
    .filter(r => /babel|react|chart|xlsx|jspdf|html2canvas|sortable/i.test(r.name))
    .map(r => ({ f: r.name.split('/').pop().slice(0, 30), ms: Math.round(r.duration), kb: Math.round((r.transferSize || r.encodedBodySize || 0) / 1024) })));
  console.log('goto -> DOMContentLoaded   :', tDom - t0, 'ms');
  console.log('goto -> "Dashboard" zichtbaar:', tInteractive - t0, 'ms  (= ervaren laadtijd)');
  console.log('\nCDN-scripts (duur / grootte):');
  res.forEach(r => console.log('  ', r.f.padEnd(32), String(r.ms).padStart(5) + 'ms', String(r.kb).padStart(5) + 'kb'));
  await browser.close();
})();
