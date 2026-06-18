// Test de hypothese: babel-standalone past zonder data-presets zware default-presets toe
// (env-downleveling). Meet laadtijd met data-presets="react" (alleen JSX-transform).
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const APP = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = f => 'file:///' + f.split(path.sep).join('/');

async function measure(browser, url, runs = 2) {
  const times = []; let errs = [];
  for (let i = 0; i < runs; i++) {
    const page = await browser.newPage();
    const c = [];
    page.on('pageerror', e => c.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') c.push('console: ' + m.text()); });
    const t0 = Date.now();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 40000 });
    times.push(Date.now() - t0);
    if (i === runs - 1) errs = c.filter(e => !/deoptimised|max of 500KB/i.test(e));
    await page.close();
  }
  return { min: Math.min(...times), times, errs };
}

(async () => {
  const html = fs.readFileSync(APP, 'utf8');
  const variant = html.replace('<script type="text/babel">', '<script type="text/babel" data-presets="react">');
  const TMP = path.resolve(__dirname, '_presets-tmp.html');
  fs.writeFileSync(TMP, variant);

  const browser = await chromium.launch();
  const r = await measure(browser, FILE_URL(TMP), 2);
  console.log(`data-presets="react": ${r.min} ms  (runs: ${r.times.join(', ')})`);
  console.log(r.errs.length ? ('errors: ' + r.errs.join(' | ')) : '(geen JS-errors — draait correct)');
  fs.unlinkSync(TMP);
  await browser.close();
})();
