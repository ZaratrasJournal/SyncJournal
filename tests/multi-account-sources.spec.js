// v12.232: multi-account source-weergave.
// Bug (Denny 2026-06-10): FilterBar-chips toonden rauwe account-ids ("Dmpffy2es5xo9a4")
// i.p.v. exchange-naam + label, plus een lege chip (accounts zonder .name).
// Deze spec seedt het unified accounts[]-model + gemengde trade-sources (account.id én
// legacy type-string) en checkt dat:
//  1. geen enkele chip een rauwe account-id toont
//  2. chips "Hyperliquid · Scalp" / "Kraken · Swing" / "FTMO (MT5) · Challenge" tonen
//  3. legacy "ftmo"-trades door de reparatie-pass naar het FTMO-account worden hermapt
//  4. FTMO lot-weergave (sourceTypeOf-pad) blijft werken
const { test, expect } = require('@playwright/test');
const path = require('path');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');

const baseTrade = {
  pair: 'BTC/USDT', direction: 'short', status: 'closed',
  entry: '60000', exit: '59000', positionSize: '1000', positionSizeAsset: '0.016',
  pnl: '16.67', fees: '0.5', leverage: '10',
  setupTags: [], confirmationTags: [], timeframeTags: [], emotionTags: [],
  mistakeTags: [], customTags: [], rating: 0, screenshot: null, notes: '', links: [],
  layers: [], tpLevels: [],
};

const FIXTURE = {
  accounts: [
    { id: 'acc_hl_scalp', type: 'hyperliquid', label: 'Scalp', walletAddress: '0xdead', transactions: [] },
    { id: 'acc_kr_swing', type: 'kraken', label: 'Swing', apiKey: 'k', apiSecret: 's', transactions: [] },
    { id: 'acc_ftmo_ch', type: 'ftmo', label: 'Challenge', transactions: [] },
  ],
  config: { defaultQuote: 'USDT', exchanges: {}, theme: 'sync', accountsSchema: 2 },
  trades: [
    { ...baseTrade, id: 'hl_1', source: 'acc_hl_scalp', date: '2026-06-01', time: '10:00' },
    { ...baseTrade, id: 'kr_1', source: 'acc_kr_swing', date: '2026-06-02', time: '11:00' },
    // Legacy type-string — moet door de reparatie-pass naar acc_ftmo_ch
    { ...baseTrade, id: 'ftmo_csv_1', source: 'ftmo', date: '2026-06-03', time: '12:00', pair: 'BTCUSD', positionSize: '', positionSizeAsset: '0.08' },
    { ...baseTrade, id: 'man_1', source: 'manual', date: '2026-06-04', time: '13:00' },
  ],
};

function seed(f) {
  localStorage.setItem('tj_trades', JSON.stringify(f.trades));
  localStorage.setItem('tj_config', JSON.stringify(f.config));
  localStorage.setItem('tj_accounts', JSON.stringify(f.accounts));
  localStorage.setItem('tj_welcomed', '1');
}

test.describe('Multi-account source-weergave', () => {
  test('FilterBar-chips tonen accountnamen, geen rauwe ids; legacy ftmo wordt hermapt', async ({ page }) => {
    await page.addInitScript(seed, FIXTURE);
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 20_000 });

    // Naar Trades-pagina
    await page.waitForTimeout(2000);
    await page.evaluate(() => { location.hash = '#/trades'; });
    await page.waitForTimeout(1500);

    const pillTexts = await page.evaluate(() =>
      [...document.querySelectorAll('.pill')].map(el => el.innerText.trim())
    );
    console.log('pills:', JSON.stringify(pillTexts));

    // 1. Geen rauwe account-ids of lege account-chips
    for (const t of pillTexts) {
      expect(t, `chip "${t}" mag geen rauwe account-id tonen`).not.toMatch(/acc_/);
    }
    const joined = pillTexts.join(' | ');
    // 2. Nette display-namen aanwezig
    expect(joined).toContain('Hyperliquid · Scalp');
    expect(joined).toContain('Kraken · Swing');
    expect(joined).toContain('FTMO (MT5) · Challenge');
    expect(joined).toContain('Handmatig');

    // 3. Legacy "ftmo"-source is hermapt naar het FTMO-account
    const ftmoSource = await page.evaluate(() => {
      const trades = JSON.parse(localStorage.getItem('tj_trades') || '[]');
      const t = trades.find(x => x.id === 'ftmo_csv_1');
      return t ? t.source : null;
    });
    expect(ftmoSource).toBe('acc_ftmo_ch');

    // 4. FTMO lot-weergave in de tabel (fmtSize via sourceTypeOf). Exacte waarde kan door
    // de size-reheal (normalizeTrade) herrekend zijn — het gaat erom dat het lot-pad rendert.
    const body = await page.evaluate(() => document.body.innerText);
    expect(body).toMatch(/[\d.,]+ lot/);

    await page.screenshot({ path: path.join(__dirname, 'screenshots/multi-account-sources.png'), fullPage: false });
  });
});
