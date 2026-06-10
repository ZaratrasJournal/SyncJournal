// E2E: éénmalige multi-account migratie draait bij app-load op een oud-model journal.
// Verifieert: vangnet weggeschreven, config.exchanges geleegd + accountsSchema=2,
// accounts[] krijgt typed records, en élke trade.source is hermapt (geen orphans).
//
// Run: npx playwright test tests/multi-account-migration.spec.js
const { test, expect } = require('@playwright/test');
const path = require('path');
const { seedLocalStorage } = require('./helpers/seed');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');

const OLD_CONFIG = { defaultQuote: 'USDT', theme: 'sync', exchanges: {
  hyperliquid: { walletAddress: '0x' + '1'.repeat(40), label: 'Main' },
  mexc: { apiKey: 'k', apiSecret: 's', label: 'Scalp' },
}};
const OLD_ACCOUNTS = [{ id: 'man_keep', name: 'Reserve', label: 'Off-platform', transactions: [{ id: 'tx1', type: 'deposit', amount: '2000' }] }];
const tr = (id, source, pnl) => ({ id, source, pair: 'BTC/USDT', direction: 'long', entry: '100', exit: '110', pnl, fees: '0', status: 'closed', date: '2026-06-01', time: '10:00', setupTags: [], confirmationTags: [], timeframeTags: [], emotionTags: [], mistakeTags: [], customTags: [], links: [], layers: [] });
const OLD_TRADES = [tr('t1', 'hyperliquid', '10'), tr('t2', 'mexc', '-5'), tr('t3', 'Reserve', '3'), tr('t4', 'manual', '1')];

async function readIdbTrades(page) {
  return await page.evaluate(() => new Promise((res) => {
    const req = indexedDB.open('morani_trades_v1', 1);
    req.onsuccess = () => { const db = req.result; const g = db.transaction('trades', 'readonly').objectStore('trades').getAll(); g.onsuccess = () => res(g.result || []); g.onerror = () => res([]); };
    req.onerror = () => res([]);
  }));
}

test('migratie draait éénmalig bij load: vangnet + remap, geen orphans', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/api.hyperliquid.xyz/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.addInitScript(seedLocalStorage, { trades: OLD_TRADES, config: OLD_CONFIG, accounts: OLD_ACCOUNTS });
  await page.goto(FILE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 15_000 });

  // Wacht tot de migratie heeft gedraaid (accountsSchema=2 in tj_config).
  await expect.poll(async () => await page.evaluate(() => { try { return (JSON.parse(localStorage.getItem('tj_config') || '{}').accountsSchema) || 0; } catch { return 0; } }), { timeout: 10_000 }).toBe(2);
  await page.waitForTimeout(500); // laat trade-persist (IDB) settelen

  expect(errors, 'app laadt zonder JS-errors na migratie').toHaveLength(0);

  const cfg = await page.evaluate(() => JSON.parse(localStorage.getItem('tj_config') || '{}'));
  const accts = await page.evaluate(() => JSON.parse(localStorage.getItem('tj_accounts') || '[]'));
  const backup = await page.evaluate(() => JSON.parse(localStorage.getItem('tj_premigration_backup') || 'null'));
  const idbTrades = await readIdbTrades(page);

  // Vangnet
  expect(backup, 'pre-migratie-backup weggeschreven').not.toBeNull();
  expect(Object.keys(backup.config.exchanges || {}).length, 'backup bevat oude exchanges').toBe(2);
  expect(backup.tradeSources.length, 'backup bevat per-trade source').toBe(4);

  // config.exchanges geleegd
  expect(Object.keys(cfg.exchanges || {}).length, 'config.exchanges geleegd').toBe(0);

  // accounts[] heeft typed records (2 exchange + 1 manual)
  const byType = t => accts.filter(a => a.type === t);
  expect(accts.length, '3 accounts (hyperliquid + mexc + manual)').toBe(3);
  expect(byType('hyperliquid')[0]?.walletAddress, 'hyperliquid wallet behouden').toBe('0x' + '1'.repeat(40));
  expect(byType('mexc')[0]?.apiKey, 'mexc apiKey behouden').toBe('k');
  expect(byType('manual')[0]?.id, 'manual account behoudt id').toBe('man_keep');

  // trade.source remap — geen orphans
  const acctIds = new Set(accts.map(a => a.id));
  const orphans = idbTrades.filter(t => t.source !== 'manual' && !acctIds.has(t.source));
  expect(orphans.map(t => t.id), 'geen orphan-trades na remap').toEqual([]);
  const hlId = byType('hyperliquid')[0].id;
  expect(idbTrades.find(t => t.id === 't1').source, 'HL-trade → HL-account.id').toBe(hlId);
  expect(idbTrades.find(t => t.id === 't3').source, 'manual-naam → manual id').toBe('man_keep');
  expect(idbTrades.find(t => t.id === 't4').source, "'manual' blijft literal").toBe('manual');
});
