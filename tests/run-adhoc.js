// Adhoc runner — niet via Playwright test framework, gewoon Node.
// Voor snelle ad-hoc exploratie: laad app, manipuleer state, schiet screenshot,
// log naar stdout. Geen assertions — alleen "wat zie ik".
//
// Usage: node tests/run-adhoc.js
//        node tests/run-adhoc.js --fixture=blofin-partial-state.json
//        node tests/run-adhoc.js --theme=parchment
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');
const SHOT = path.join(__dirname, 'screenshots/adhoc-latest.png');

(async () => {
  console.log(`[adhoc] launching headless chromium`);
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  page.on('console', msg => console.log(`[browser:${msg.type()}]`, msg.text()));
  page.on('pageerror', err => console.error(`[pageerror]`, err.message));

  // Optional fixture seed
  if (args.fixture) {
    const fxPath = path.join(__dirname, 'fixtures', args.fixture);
    if (!fs.existsSync(fxPath)) { console.error(`Fixture not found: ${fxPath}`); process.exit(1); }
    const fixture = JSON.parse(fs.readFileSync(fxPath, 'utf8'));
    await page.addInitScript(seed => {
      if (seed.trades) localStorage.setItem('tj_trades', JSON.stringify(seed.trades));
      if (seed.config) localStorage.setItem('tj_config', JSON.stringify(seed.config));
      if (seed.accounts) localStorage.setItem('tj_accounts', JSON.stringify(seed.accounts));
      if (seed.playbooks) localStorage.setItem('tj_playbooks', JSON.stringify(seed.playbooks));
      localStorage.setItem('tj_welcomed', '1');
      // Optional theme override
      if (seed.config?.theme) {
        const c = JSON.parse(localStorage.getItem('tj_config') || '{}');
        c.theme = seed.config.theme;
        localStorage.setItem('tj_config', JSON.stringify(c));
      }
    }, fixture);
    console.log(`[adhoc] fixture seeded: ${fxPath}`);
  }

  // Optional theme via arg (overrides fixture)
  if (args.theme) {
    await page.addInitScript(theme => {
      const c = JSON.parse(localStorage.getItem('tj_config') || '{}');
      c.theme = theme;
      localStorage.setItem('tj_config', JSON.stringify(c));
    }, args.theme);
    console.log(`[adhoc] theme override: ${args.theme}`);
  }

  console.log(`[adhoc] navigating to ${FILE_URL}`);
  await page.goto(FILE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.body.innerText.includes('SyncJournal'), { timeout: 15_000 });
  await page.waitForTimeout(1500); // settle voor React-renders

  // Snapshot summary van de state
  const state = await page.evaluate(() => {
    const trades = JSON.parse(localStorage.getItem('tj_trades') || '[]');
    const config = JSON.parse(localStorage.getItem('tj_config') || '{}');
    const partials = trades.filter(t => t.status === 'partial');
    const open = trades.filter(t => t.status === 'open');
    const closed = trades.filter(t => t.status === 'closed');
    return {
      version: (window.APP_VERSION || {}).version || 'unknown',
      theme: config.theme || 'sync',
      trades: { total: trades.length, open: open.length, closed: closed.length, partial: partials.length },
      partials: partials.map(t => ({ pair: t.pair, entry: t.entry, realized: t.realizedPnl, tpCount: (t.tpLevels||[]).length })),
    };
  });
  console.log('[adhoc] state:', JSON.stringify(state, null, 2));

  await page.screenshot({ path: SHOT, fullPage: true });
  console.log(`[adhoc] screenshot saved: ${SHOT}`);

  await browser.close();
  console.log(`[adhoc] done`);
})().catch(e => { console.error('[adhoc] FAILED:', e); process.exit(1); });
