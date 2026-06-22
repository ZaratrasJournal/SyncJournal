// v12.238 regressie: de account-tile in Instellingen → Accounts toonde de PnL-fallback
// (computeAccountCapital + sumTradePnl) i.p.v. de live API-balans, terwijl de TopBar wél de
// live balans toonde → de twee divergeerden (Denny's OKX-tile: -$0,13 i.p.v. live $22,33).
// Fix: tile spiegelt nu de TopBar-logica (live API-balans indien >0, anders tracker + PnL).
const { test, expect } = require('@playwright/test');
const path = require('path');
const { seedLocalStorage } = require('./helpers/seed');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');

const FIXTURE = {
  // accountsSchema:2 → sla de v12.231 unified-migratie over (die zou type:"okx" naar "manual" clobberen).
  config: { accountsSchema: 2, exchanges: {} },
  accounts: [
    { id: 'acc_okx1', type: 'okx', label: 'SyncJournal', apiKey: 'k', apiSecret: 's', passphrase: 'p', transactions: [] },
  ],
  // Twee gesloten verlies-trades → som -0,13 (de fallback-waarde die fout getoond werd).
  trades: [
    { id: 't1', source: 'acc_okx1', pair: 'BTC/USDC', direction: 'long', entry: '62640', exit: '62630', pnl: '-0.05', fees: '0', status: 'closed', date: '2026-06-19' },
    { id: 't2', source: 'acc_okx1', pair: 'BTC/USDC', direction: 'long', entry: '62640', exit: '62620', pnl: '-0.08', fees: '0', status: 'closed', date: '2026-06-19' },
  ],
};

test('Account-tile toont live API-balans (niet de PnL-fallback)', async ({ page }) => {
  // Onderschep elke Worker-call → test-actie geeft live balans 22.33 terug.
  await page.route(/workers\.dev/, route => {
    let body = {};
    try { body = JSON.parse(route.request().postData() || '{}'); } catch {}
    if (body.action === 'test') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ balance: '22.33' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ trades: [], positions: [] }) });
  });

  await page.addInitScript(seedLocalStorage, FIXTURE);
  await page.goto(FILE_URL, { waitUntil: 'networkidle' });

  // Naar Instellingen → Accounts.
  await page.getByRole('button', { name: 'Instellingen' }).first().click();

  // De OKX-tile (label "SyncJournal") — wacht tot de live fetch de cache vult en de tile omslaat.
  const tile = page.locator('div', { hasText: /^SyncJournal/ }).filter({ hasText: 'OKX' }).first();
  await expect(tile).toBeVisible({ timeout: 8000 });

  // De balans staat als laatste $-bedrag in de tile. Wacht tot 'ie de live waarde toont.
  await expect(async () => {
    const txt = await tile.innerText();
    expect(txt).toContain('22,33'); // live balans, NL-format
    expect(txt).not.toContain('-0,13'); // niet de PnL-fallback
  }).toPass({ timeout: 8000 });
});
